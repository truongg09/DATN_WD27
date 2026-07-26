const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * Ghi chú quan trọng về dữ liệu (đọc kỹ trước khi sửa):
 * - Bảng `bookings` có 2 cột trạng thái song song do migrate cũ->mới: `status` (cũ) và
 *   `bookingStatus` (mới). Nguồn sự thật (source of truth) PHẢI là COALESCE(bookingStatus, status).
 * - Tương tự có `created_at` (cũ) và `createdAt` (mới) -> luôn COALESCE(created_at, createdAt).
 * - `payments.paidAmount`  = số tiền THỰC TẾ đã thu (đúng cho báo cáo doanh thu tiền mặt / dòng tiền).
 * - `payments.roomAmount` / `serviceAmount` = số tiền GHI HÓA ĐƠN (đúng cho báo cáo doanh thu theo hạng mục),
 *   có thể lớn hơn paidAmount nếu khách mới đặt cọc / chưa thanh toán hết.
 * - Booking bị 'cancelled' hoặc 'no_show' KHÔNG được tính vào công suất phòng, doanh thu theo loại phòng.
 */

function requireAdminOrStaff(req, res) {
  if (!['admin', 'staff'].includes(req.user?.role)) {
    res.status(403).json({ ok: false, message: 'Chỉ quản trị viên/nhân viên được xem báo cáo' });
    return false;
  }
  return true;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatLocalDateTime(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function monthBounds(year, monthIndex0) {
  const from = new Date(year, monthIndex0, 1, 0, 0, 0, 0);
  const to = new Date(year, monthIndex0 + 1, 0, 23, 59, 59, 999);
  return { from, to, daysInMonth: to.getDate() };
}

const NON_COUNTING_STATUSES = ['cancelled', 'no_show'];

/**
 * GET /api/reports/monthly?year=2026
 * Trả về báo cáo chi tiết 12 tháng trong năm, dùng CHỈ dữ liệu thật trong DB.
 */
router.get('/monthly', requireAuth, async (req, res) => {
  try {
    if (!requireAdminOrStaff(req, res)) return;

    const year = Number(req.query.year) || new Date().getFullYear();
    const yearFrom = formatLocalDateTime(new Date(year, 0, 1, 0, 0, 0, 0));
    const yearTo = formatLocalDateTime(new Date(year, 11, 31, 23, 59, 59, 999));

    // Tổng số phòng đang hoạt động (không tính phòng đã xóa)
    const [[roomKpi]] = await db.query(
      'SELECT COUNT(*) AS total FROM rooms WHERE isDeleted = 0'
    );
    const totalRooms = Number(roomKpi?.total) || 0;

    // 1) Doanh thu + số đơn + công nợ theo từng tháng (1 query, group by tháng)
    const [monthlyRows] = await db.query(
      `
        SELECT
          MONTH(COALESCE(b.created_at, b.createdAt)) AS bucket,
          COUNT(DISTINCT b.id) AS bookingsCount,
          SUM(CASE WHEN COALESCE(b.bookingStatus, b.status) IN ('cancelled','no_show') THEN 1 ELSE 0 END) AS cancelledCount,
          COALESCE(SUM(p.roomAmount), 0) AS roomRevenue,
          COALESCE(SUM(p.serviceAmount), 0) AS serviceRevenue,
          COALESCE(SUM(p.paidAmount), 0) AS paidAmount,
          COALESCE(SUM(p.remainingAmount), 0) AS remainingAmount
        FROM bookings b
        LEFT JOIN payments p ON p.bookingId = b.id
        WHERE COALESCE(b.created_at, b.createdAt) BETWEEN ? AND ?
        GROUP BY bucket
        ORDER BY bucket
      `,
      [yearFrom, yearTo]
    );

    // 2) Khách hàng mới theo tháng (accounts.role = customer)
    const [newCustomerRows] = await db.query(
      `
        SELECT
          MONTH(COALESCE(a.created_at, a.createdAt)) AS bucket,
          COUNT(*) AS total
        FROM accounts a
        WHERE a.role = 'customer'
          AND COALESCE(a.created_at, a.createdAt) BETWEEN ? AND ?
        GROUP BY bucket
        ORDER BY bucket
      `,
      [yearFrom, yearTo]
    );

    // 3) Công suất phòng theo từng tháng (occupancy) - tính riêng từng tháng vì
    // logic "đêm phòng đã bán" cần so khớp khoảng ngày check-in/check-out, không group by đơn giản được.
    const occupancyByMonth = await Promise.all(
      Array.from({ length: 12 }, (_, idx) => idx).map(async (monthIndex0) => {
        const { from, to, daysInMonth } = monthBounds(year, monthIndex0);
        const fromStr = formatLocalDateTime(from);
        const toStr = formatLocalDateTime(to);

        const [[row]] = await db.query(
          `
            SELECT COALESCE(SUM(
              GREATEST(
                0,
                DATEDIFF(
                  LEAST(COALESCE(bd.checkOutDate, b.check_out), DATE(?)),
                  GREATEST(COALESCE(bd.checkInDate, b.check_in), DATE(?))
                )
              )
            ), 0) AS bookedNights
            FROM bookings b
            LEFT JOIN booking_details bd ON bd.bookingId = b.id
            WHERE COALESCE(b.bookingStatus, b.status) NOT IN ('cancelled', 'no_show')
              AND COALESCE(bd.checkInDate, b.check_in) <= DATE(?)
              AND COALESCE(bd.checkOutDate, b.check_out) >= DATE(?)
          `,
          [toStr, fromStr, toStr, fromStr]
        );

        const bookedNights = Number(row?.bookedNights) || 0;
        const maxNights = totalRooms * daysInMonth;
        const occupancyRate = maxNights > 0 ? Math.round((bookedNights / maxNights) * 100) : 0;
        return { month: monthIndex0 + 1, occupancyRate, bookedNights };
      })
    );

    // Gộp tất cả lại thành mảng 12 tháng đầy đủ, không thiếu tháng nào dù không có dữ liệu
    const monthly = Array.from({ length: 12 }, (_, idx) => {
      const m = idx + 1;
      const revRow = monthlyRows.find((r) => Number(r.bucket) === m);
      const custRow = newCustomerRows.find((r) => Number(r.bucket) === m);
      const occRow = occupancyByMonth.find((r) => r.month === m);

      return {
        month: m,
        label: `Tháng ${m}`,
        bookingsCount: Number(revRow?.bookingsCount) || 0,
        cancelledCount: Number(revRow?.cancelledCount) || 0,
        roomRevenue: Number(revRow?.roomRevenue) || 0,
        serviceRevenue: Number(revRow?.serviceRevenue) || 0,
        totalRevenue: (Number(revRow?.roomRevenue) || 0) + (Number(revRow?.serviceRevenue) || 0),
        paidAmount: Number(revRow?.paidAmount) || 0,
        remainingAmount: Number(revRow?.remainingAmount) || 0,
        newCustomers: Number(custRow?.total) || 0,
        occupancyRate: occRow?.occupancyRate || 0
      };
    });

    // 4) Doanh thu + số đơn theo LOẠI PHÒNG (cả năm)
    const [byRoomTypeRows] = await db.query(
      `
        SELECT
          COALESCE(rt.typeName, 'Không rõ') AS roomType,
          COUNT(DISTINCT b.id) AS bookingsCount,
          COALESCE(SUM(p.roomAmount), 0) AS revenue
        FROM bookings b
        LEFT JOIN booking_details bd ON bd.bookingId = b.id
        LEFT JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
        LEFT JOIN room_types rt ON rt.id = r.roomTypeId
        LEFT JOIN payments p ON p.bookingId = b.id
        WHERE COALESCE(b.created_at, b.createdAt) BETWEEN ? AND ?
          AND COALESCE(b.bookingStatus, b.status) NOT IN ('cancelled', 'no_show')
        GROUP BY roomType
        ORDER BY revenue DESC
      `,
      [yearFrom, yearTo]
    );

    // 5) Doanh thu + số giao dịch theo PHƯƠNG THỨC THANH TOÁN (cả năm)
    const [byPaymentMethodRows] = await db.query(
      `
        SELECT
          COALESCE(NULLIF(TRIM(p.paymentMethod), ''), 'Chưa xác định') AS method,
          COUNT(*) AS transactionCount,
          COALESCE(SUM(p.paidAmount), 0) AS amount
        FROM payments p
        WHERE p.paymentDate BETWEEN ? AND ?
        GROUP BY method
        ORDER BY amount DESC
      `,
      [yearFrom, yearTo]
    );

    // 6) Tổng công nợ hiện tại (đơn chưa hủy, chưa thu hết tiền)
    const [[outstandingRow]] = await db.query(
      `
        SELECT COALESCE(SUM(p.remainingAmount), 0) AS totalOutstanding
        FROM payments p
        JOIN bookings b ON b.id = p.bookingId
        WHERE COALESCE(b.bookingStatus, b.status) NOT IN ('cancelled', 'no_show')
          AND COALESCE(b.created_at, b.createdAt) BETWEEN ? AND ?
      `,
      [yearFrom, yearTo]
    );

    // 7) Tổng phí bồi thường hư hỏng trong năm (chi phí phát sinh, tham khảo)
    const [[damageRow]] = await db.query(
      `
        SELECT COALESCE(SUM(dr.compensationFee), 0) AS totalDamage
        FROM damage_reports dr
        WHERE dr.reportDate BETWEEN ? AND ?
      `,
      [yearFrom, yearTo]
    );

    // Tổng hợp KPI toàn năm từ chính dữ liệu monthly (không tính lại, tránh sai lệch)
    const yearSummary = monthly.reduce(
      (acc, m) => {
        acc.totalRevenue += m.totalRevenue;
        acc.totalPaid += m.paidAmount;
        acc.totalBookings += m.bookingsCount;
        acc.totalCancelled += m.cancelledCount;
        acc.totalNewCustomers += m.newCustomers;
        acc.occupancySum += m.occupancyRate;
        return acc;
      },
      {
        totalRevenue: 0,
        totalPaid: 0,
        totalBookings: 0,
        totalCancelled: 0,
        totalNewCustomers: 0,
        occupancySum: 0
      }
    );

    res.json({
      ok: true,
      year,
      summary: {
        totalRevenue: yearSummary.totalRevenue,
        totalPaid: yearSummary.totalPaid,
        totalOutstanding: Number(outstandingRow?.totalOutstanding) || 0,
        totalBookings: yearSummary.totalBookings,
        totalCancelled: yearSummary.totalCancelled,
        cancelRate:
          yearSummary.totalBookings > 0
            ? Math.round((yearSummary.totalCancelled / yearSummary.totalBookings) * 100)
            : 0,
        newCustomers: yearSummary.totalNewCustomers,
        avgOccupancyRate: Math.round(yearSummary.occupancySum / 12),
        totalDamageFees: Number(damageRow?.totalDamage) || 0
      },
      monthly,
      byRoomType: byRoomTypeRows.map((r) => ({
        roomType: r.roomType,
        bookingsCount: Number(r.bookingsCount) || 0,
        revenue: Number(r.revenue) || 0
      })),
      byPaymentMethod: byPaymentMethodRows.map((r) => ({
        method: r.method,
        transactionCount: Number(r.transactionCount) || 0,
        amount: Number(r.amount) || 0
      }))
    });
  } catch (error) {
    console.error('Report monthly error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

module.exports = router;
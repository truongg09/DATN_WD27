const express = require('express');
const db = require('../config/db');
const { requireAuth, isStaff } = require('../middleware/auth');

const router = express.Router();

function requireAdminOrStaff(req, res) {
  if (!isStaff(req.user)) {
    res.status(403).json({ ok: false, message: 'Chỉ quản trị viên/nhân viên được xem báo cáo' });
    return false;
  }
  return true;
}

// Đơn đã hủy hoặc khách không đến: không tính vào doanh thu và công nợ.
// Hai cột trạng thái legacy có thể lệch nhau nên chỉ cần một cột báo hủy là đủ.
const CANCELLED_EXPR = `(
  COALESCE(b.bookingStatus, b.status) IN ('cancelled','no_show')
  OR b.status IN ('cancelled','no_show')
)`;

// Đơn giữ chỗ chưa thanh toán đồng nào thì chưa thực sự chiếm phòng, không được
// tính vào công suất (nếu không tỷ lệ lấp đầy bị phồng lên bởi các hold 15 phút).
const UNPAID_HOLD_EXPR = `(
  COALESCE(b.bookingStatus, b.status) = 'pending'
  AND COALESCE((SELECT SUM(p.paidAmount) FROM payments p WHERE p.bookingId = b.id), 0) <= 0
)`;

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
 *
 * LƯU Ý QUAN TRỌNG VỀ JOIN:
 * `booking_details.bookingId` và `payments.bookingId` KHÔNG có ràng buộc UNIQUE
 * trong schema (chỉ là index thường) -> về mặt lý thuyết 1 booking có thể có
 * nhiều dòng booking_details (nhiều phòng/1 đơn) hoặc nhiều dòng payments
 * (nhiều lần thanh toán). Nếu JOIN thẳng 2 bảng "1-nhiều" này cùng lúc với
 * bookings, kết quả sẽ bị nhân bản (fan-out) -> SUM() bị thổi phồng sai.
 * Vì vậy mọi query dưới đây đều gộp (GROUP BY bookingId) payments trước khi
 * join, và không join payments + booking_details trong cùng 1 query.
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
    // payments được gộp theo bookingId trước (subquery `pay`) để tránh nhân bản
    // dòng nếu sau này 1 booking có nhiều dòng payments (vd: nhiều lần thanh toán).
    const [monthlyRows] = await db.query(
      `
        SELECT
          MONTH(COALESCE(b.created_at, b.createdAt)) AS bucket,
          COUNT(DISTINCT b.id) AS bookingsCount,
          SUM(CASE WHEN ${CANCELLED_EXPR} THEN 1 ELSE 0 END) AS cancelledCount,
          -- Doanh thu ghi nhận (billed) chỉ tính đơn còn hiệu lực. Đơn đã hủy /
          -- khách không đến không tạo ra doanh thu, kể cả khi đã phát sinh hóa đơn.
          COALESCE(SUM(CASE WHEN ${CANCELLED_EXPR} THEN 0 ELSE pay.roomAmount END), 0) AS roomRevenue,
          COALESCE(SUM(CASE WHEN ${CANCELLED_EXPR} THEN 0 ELSE pay.serviceAmount END), 0) AS serviceRevenue,
          -- Tiền thực thu giữ nguyên mọi đơn: đây là tiền đã vào két. Khoản đã
          -- hoàn cho khách đã được trừ khỏi payments.paidAmount lúc duyệt hoàn.
          COALESCE(SUM(pay.paidAmount), 0) AS paidAmount,
          -- Công nợ chỉ tính đơn còn hiệu lực: khách hủy phòng thì không còn nợ.
          COALESCE(SUM(CASE WHEN ${CANCELLED_EXPR} THEN 0 ELSE pay.remainingAmount END), 0) AS remainingAmount
        FROM bookings b
        LEFT JOIN (
          SELECT
            bookingId,
            SUM(roomAmount) AS roomAmount,
            SUM(serviceAmount) AS serviceAmount,
            SUM(paidAmount) AS paidAmount,
            SUM(remainingAmount) AS remainingAmount
          FROM payments
          GROUP BY bookingId
        ) pay ON pay.bookingId = b.id
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
    // Ở đây JOIN với booking_details KHÔNG bị coi là lỗi fan-out: mỗi dòng
    // booking_details đại diện cho 1 phòng thực tế được đặt, nên 1 booking có
    // N phòng phải tính N lần đêm-phòng - đây là hành vi ĐÚNG cho occupancy.
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
                  -- Đêm cuối kỳ: khách ở đến hết ngày ?to vẫn tính là 1 đêm, nên
                  -- biên phải là ?to + 1 ngày. Dùng thẳng ?to sẽ hụt đúng 1 đêm
                  -- với mọi booking vắt qua cuối kỳ.
                  LEAST(COALESCE(bd.checkOutDate, b.check_out), DATE_ADD(DATE(?), INTERVAL 1 DAY)),
                  GREATEST(COALESCE(bd.checkInDate, b.check_in), DATE(?))
                )
              )
            ), 0) AS bookedNights
            FROM bookings b
            LEFT JOIN booking_details bd ON bd.bookingId = b.id
            WHERE NOT ${CANCELLED_EXPR}
              AND NOT ${UNPAID_HOLD_EXPR}
              AND COALESCE(bd.checkInDate, b.check_in) <= DATE(?)
              AND COALESCE(bd.checkOutDate, b.check_out) > DATE(?)
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
    // SỬA LỖI FAN-OUT: bản cũ join booking_details (1-nhiều) VÀ payments
    // (1-nhiều) cùng lúc trong 1 query -> nếu 1 booking có nhiều phòng và/hoặc
    // nhiều dòng payments, SUM(p.roomAmount) bị nhân bản (tính nhiều lần cho
    // cùng 1 khoản tiền), khiến doanh thu theo loại phòng bị thổi phồng sai
    // lệch, thậm chí tổng cộng các loại phòng có thể lớn hơn tổng doanh thu
    // thật của cả năm.
    // Cách sửa: không suy ra tiền theo loại phòng từ bảng payments (vốn là
    // tổng tiền của CẢ booking) nữa, mà tính trực tiếp từ chính dòng
    // booking_details (đã có sẵn roomPrice cho từng phòng) x số đêm ở của
    // phòng đó. Nhờ vậy mỗi phòng chỉ đóng góp đúng doanh thu của chính nó,
    // không phụ thuộc vào có bao nhiêu dòng payments đi kèm.
    const [byRoomTypeRows] = await db.query(
      `
        SELECT
          COALESCE(rt.typeName, 'Không rõ') AS roomType,
          COUNT(DISTINCT b.id) AS bookingsCount,
          COALESCE(SUM(
            bd.roomPrice * GREATEST(1, DATEDIFF(bd.checkOutDate, bd.checkInDate))
            + COALESCE(bd.occupancySurcharge, 0)
          ), 0) AS revenue
        FROM bookings b
        JOIN booking_details bd ON bd.bookingId = b.id
        LEFT JOIN rooms r ON r.id = bd.roomId
        LEFT JOIN room_types rt ON rt.id = r.roomTypeId
        WHERE COALESCE(b.created_at, b.createdAt) BETWEEN ? AND ?
          AND COALESCE(b.bookingStatus, b.status) NOT IN ('cancelled', 'no_show')
        GROUP BY roomType
        ORDER BY revenue DESC
      `,
      [yearFrom, yearTo]
    );

    // 5) Doanh thu + số giao dịch theo PHƯƠNG THỨC THANH TOÁN (cả năm)
    // Query này chỉ đọc thẳng từ bảng payments, không join thêm bảng 1-nhiều
    // nào khác nên không bị fan-out.
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
    // Cũng gộp payments theo bookingId trước khi join để tránh nhân bản dòng
    // (booking JOIN payments là 1-nhiều nếu sau này có nhiều dòng payments/booking).
    const [[outstandingRow]] = await db.query(
      `
        SELECT COALESCE(SUM(pay.remainingAmount), 0) AS totalOutstanding
        FROM bookings b
        JOIN (
          SELECT bookingId, SUM(remainingAmount) AS remainingAmount
          FROM payments
          GROUP BY bookingId
        ) pay ON pay.bookingId = b.id
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
const express = require('express');
const db = require('../config/db');
const { requireAuth, requireStaff, isStaff } = require('../middleware/auth');

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


// ── Bộ báo cáo chi tiết ────────────────────────────────────────────────────
// Các endpoint dưới đây trước nằm ở controllers/reportController.js: file đó tự
// tạo express.Router() nhưng không nơi nào require nên toàn bộ là code chết,
// gọi vào chỉ nhận 404. Chuyển vào đây để được mount thật, đồng thời bổ sung
// requireAuth + requireStaff vì số liệu doanh thu không thể để công khai.
// ------------------------------------------------------------
// Helper: chuẩn hoá khoảng ngày từ query string
// ------------------------------------------------------------
function resolveDateRange(query) {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const toISO = (d) => d.toISOString().slice(0, 10);

  const from = query.from || toISO(firstOfMonth);
  // "to" lấy hết ngày (23:59:59) để không bỏ sót các payment trong ngày cuối
  const to = query.to || toISO(today);

  return { from, toStart: to, toEnd: `${to} 23:59:59` };
}

const EXCLUDED_STATUSES = ['cancelled', 'no_show'];

// ==============================================================
// 1) DOANH THU THEO THỜI GIAN (line/bar chart theo ngày/tháng)
//    GET /api/reports/revenue?from=...&to=...&groupBy=day|month
// ==============================================================
router.get('/revenue', requireAuth, requireStaff, async (req, res) => {
  try {
    const { from, toEnd } = resolveDateRange(req.query);
    const groupBy = req.query.groupBy === 'day' ? '%Y-%m-%d' : '%Y-%m';

    const [rows] = await db.query(
      `
      SELECT
        DATE_FORMAT(p.paymentDate, ?) AS period,
        SUM(p.paidAmount)                                            AS collectedRevenue,
        SUM(p.totalAmount)                                           AS billedRevenue,
        SUM(CASE WHEN p.paymentStatus = 'paid' THEN p.paidAmount ELSE 0 END)          AS revenueFullyPaid,
        SUM(CASE WHEN p.paymentStatus = 'deposit_paid' THEN p.paidAmount ELSE 0 END)  AS revenueDepositOnly,
        COUNT(DISTINCT p.bookingId)                                  AS bookingsCount
      FROM payments p
      JOIN bookings b ON b.id = p.bookingId
      WHERE p.paymentDate BETWEEN ? AND ?
        AND p.paymentStatus IN ('paid', 'deposit_paid')
        AND b.bookingStatus NOT IN (?, ?)
      GROUP BY period
      ORDER BY period
      `,
      [groupBy, from, toEnd, ...EXCLUDED_STATUSES]
    );

    const summary = rows.reduce(
      (acc, r) => {
        acc.totalCollected += Number(r.collectedRevenue) || 0;
        acc.totalBilled += Number(r.billedRevenue) || 0;
        acc.totalBookings += Number(r.bookingsCount) || 0;
        return acc;
      },
      { totalCollected: 0, totalBilled: 0, totalBookings: 0 }
    );

    res.json({ ok: true, range: { from, to: toEnd }, summary, data: rows });
  } catch (err) {
    console.error('[GET /reports/revenue]', err);
    res.status(500).json({ ok: false, message: 'Lỗi khi lấy báo cáo doanh thu' });
  }
});

// ==============================================================
// 2) DOANH THU THEO LOẠI PHÒNG
//    GET /api/reports/room-types?from=...&to=...
//    Prorate paidAmount theo tỷ lệ roomAmount/totalAmount vì 1 payment
//    có thể gồm cả tiền phòng + tiền dịch vụ + phụ thu.
// ==============================================================
router.get('/room-types', requireAuth, requireStaff, async (req, res) => {
  try {
    const { from, toEnd } = resolveDateRange(req.query);

    const [rows] = await db.query(
      `
      SELECT
        rt.id                                                                AS roomTypeId,
        rt.typeName,
        COUNT(DISTINCT b.id)                                                 AS bookingsCount,
        SUM(
          p.paidAmount * (p.roomAmount / NULLIF(p.totalAmount, 0))
        )                                                                    AS roomRevenue,
        ROUND(AVG(bd.roomPrice), 0)                                          AS avgRoomPrice
      FROM payments p
      JOIN bookings b        ON b.id = p.bookingId
      JOIN booking_details bd ON bd.bookingId = b.id
      JOIN rooms r            ON r.id = bd.roomId
      JOIN room_types rt      ON rt.id = r.roomTypeId
      WHERE p.paymentDate BETWEEN ? AND ?
        AND p.paymentStatus IN ('paid', 'deposit_paid')
        AND b.bookingStatus NOT IN (?, ?)
      GROUP BY rt.id, rt.typeName
      ORDER BY roomRevenue DESC
      `,
      [from, toEnd, ...EXCLUDED_STATUSES]
    );

    res.json({ ok: true, range: { from, to: toEnd }, data: rows });
  } catch (err) {
    console.error('[GET /reports/room-types]', err);
    res.status(500).json({ ok: false, message: 'Lỗi khi lấy báo cáo theo loại phòng' });
  }
});

// ==============================================================
// 3) CÔNG SUẤT PHÒNG (OCCUPANCY RATE)
//    GET /api/reports/occupancy?from=...&to=...
//    Dùng WITH RECURSIVE để sinh dãy ngày, đếm số phòng có khách mỗi ngày
//    rồi so với tổng số phòng đang hoạt động (isDeleted = 0).
//    Yêu cầu MySQL >= 8.0 (bạn đang dùng 8.4.3 nên OK).
// ==============================================================
router.get('/occupancy', requireAuth, requireStaff, async (req, res) => {
  try {
    const { from, toStart } = resolveDateRange(req.query);

    const [dailyRows] = await db.query(
      `
      WITH RECURSIVE date_range AS (
        SELECT CAST(? AS DATE) AS d
        UNION ALL
        SELECT d + INTERVAL 1 DAY FROM date_range WHERE d < CAST(? AS DATE)
      ),
      valid_stays AS (
        SELECT bd.roomId, bd.checkInDate, bd.checkOutDate
        FROM booking_details bd
        JOIN bookings b ON b.id = bd.bookingId
        WHERE b.bookingStatus NOT IN (?, ?)
          AND bd.checkInDate IS NOT NULL
          AND bd.checkOutDate IS NOT NULL
      ),
      total_rooms AS (
        SELECT COUNT(*) AS cnt FROM rooms WHERE isDeleted = 0
      )
      SELECT
        dr.d                                          AS reportDate,
        COUNT(DISTINCT vs.roomId)                      AS occupiedRooms,
        tr.cnt                                          AS totalRooms,
        ROUND(COUNT(DISTINCT vs.roomId) / tr.cnt * 100, 2) AS occupancyRate
      FROM date_range dr
      CROSS JOIN total_rooms tr
      LEFT JOIN valid_stays vs
        ON dr.d >= vs.checkInDate AND dr.d < vs.checkOutDate
      GROUP BY dr.d, tr.cnt
      ORDER BY dr.d
      `,
      [from, toStart, ...EXCLUDED_STATUSES]
    );

    // Tổng hợp: công suất trung bình cả kỳ = tổng room-night đã bán / tổng room-night khả dụng
    const totalRooms = dailyRows.length ? Number(dailyRows[0].totalRooms) : 0;
    const soldRoomNights = dailyRows.reduce((s, r) => s + Number(r.occupiedRooms), 0);
    const availableRoomNights = totalRooms * dailyRows.length;
    const avgOccupancyRate = availableRoomNights
      ? Number(((soldRoomNights / availableRoomNights) * 100).toFixed(2))
      : 0;

    res.json({
      ok: true,
      range: { from, to: toStart },
      summary: { totalRooms, soldRoomNights, availableRoomNights, avgOccupancyRate },
      data: dailyRows,
    });
  } catch (err) {
    console.error('[GET /reports/occupancy]', err);
    res.status(500).json({ ok: false, message: 'Lỗi khi lấy báo cáo công suất phòng' });
  }
});

// ==============================================================
// 4) CÔNG NỢ / TRẠNG THÁI THANH TOÁN
//    GET /api/reports/payment-status?from=...&to=...
//    Dùng bookings.createdAt (thời điểm phát sinh đơn) thay vì paymentDate
//    vì đơn "unpaid" không có paymentDate nhưng vẫn cần xuất hiện trong báo cáo.
// ==============================================================
router.get('/payment-status', requireAuth, requireStaff, async (req, res) => {
  try {
    const { from, toEnd } = resolveDateRange(req.query);

    const [rows] = await db.query(
      `
      SELECT
        p.paymentStatus,
        COUNT(*)               AS count,
        SUM(p.totalAmount)     AS totalBilled,
        SUM(p.paidAmount)      AS totalCollected,
        SUM(p.remainingAmount) AS totalOutstanding
      FROM payments p
      JOIN bookings b ON b.id = p.bookingId
      WHERE b.createdAt BETWEEN ? AND ?
        AND b.bookingStatus NOT IN (?, ?)
      GROUP BY p.paymentStatus
      `,
      [from, toEnd, ...EXCLUDED_STATUSES]
    );

    // Danh sách chi tiết các đơn còn nợ (remainingAmount > 0) để nhân viên theo dõi thu tiền
    const [outstandingList] = await db.query(
      `
      SELECT
        b.bookingCode, b.guest_name AS guestName, b.guest_phone AS guestPhone,
        p.totalAmount, p.paidAmount, p.remainingAmount, p.paymentStatus,
        b.createdAt
      FROM payments p
      JOIN bookings b ON b.id = p.bookingId
      WHERE p.remainingAmount > 0
        AND b.createdAt BETWEEN ? AND ?
        AND b.bookingStatus NOT IN (?, ?)
      ORDER BY p.remainingAmount DESC
      `,
      [from, toEnd, ...EXCLUDED_STATUSES]
    );

    res.json({ ok: true, range: { from, to: toEnd }, data: rows, outstandingList });
  } catch (err) {
    console.error('[GET /reports/payment-status]', err);
    res.status(500).json({ ok: false, message: 'Lỗi khi lấy báo cáo công nợ' });
  }
});

// ==============================================================
// 5) TỶ LỆ HỦY / NO-SHOW
//    GET /api/reports/cancellation-rate?from=...&to=...
// ==============================================================
router.get('/cancellation-rate', requireAuth, requireStaff, async (req, res) => {
  try {
    const { from, toEnd } = resolveDateRange(req.query);

    const [rows] = await db.query(
      `
      SELECT
        bookingStatus,
        COUNT(*) AS count
      FROM bookings
      WHERE createdAt BETWEEN ? AND ?
      GROUP BY bookingStatus
      `,
      [from, toEnd]
    );

    const total = rows.reduce((s, r) => s + Number(r.count), 0);
    const data = rows.map((r) => ({
      ...r,
      percentage: total ? Number(((r.count / total) * 100).toFixed(2)) : 0,
    }));

    const cancelled = data.find((r) => r.bookingStatus === 'cancelled')?.count || 0;
    const noShow = data.find((r) => r.bookingStatus === 'no_show')?.count || 0;

    res.json({
      ok: true,
      range: { from, to: toEnd },
      summary: {
        totalBookings: total,
        cancelledCount: cancelled,
        noShowCount: noShow,
        cancellationRate: total ? Number(((cancelled / total) * 100).toFixed(2)) : 0,
        noShowRate: total ? Number(((noShow / total) * 100).toFixed(2)) : 0,
      },
      data,
    });
  } catch (err) {
    console.error('[GET /reports/cancellation-rate]', err);
    res.status(500).json({ ok: false, message: 'Lỗi khi lấy báo cáo hủy phòng' });
  }
});

// ==============================================================
// 6) DOANH THU & TOP DỊCH VỤ
//    GET /api/reports/services?from=...&to=...
// ==============================================================
router.get('/services', requireAuth, requireStaff, async (req, res) => {
  try {
    const { from, toEnd } = resolveDateRange(req.query);

    const [rows] = await db.query(
      `
      SELECT
        s.id AS serviceId,
        s.serviceName,
        SUM(bs.quantity)   AS totalQuantity,
        SUM(bs.totalPrice) AS totalRevenue
      FROM booking_services bs
      JOIN services s  ON s.id = bs.serviceId
      JOIN bookings b  ON b.id = bs.bookingId
      WHERE b.createdAt BETWEEN ? AND ?
        AND b.bookingStatus NOT IN (?, ?)
      GROUP BY s.id, s.serviceName
      ORDER BY totalRevenue DESC
      `,
      [from, toEnd, ...EXCLUDED_STATUSES]
    );

    const totalServiceRevenue = rows.reduce((s, r) => s + Number(r.totalRevenue), 0);

    res.json({ ok: true, range: { from, to: toEnd }, summary: { totalServiceRevenue }, data: rows });
  } catch (err) {
    console.error('[GET /reports/services]', err);
    res.status(500).json({ ok: false, message: 'Lỗi khi lấy báo cáo dịch vụ' });
  }
});

// ==============================================================
// 7) ĐÁNH GIÁ KHÁCH HÀNG (REVIEWS)
//    GET /api/reports/reviews?from=...&to=...
// ==============================================================
router.get('/reviews', requireAuth, requireStaff, async (req, res) => {
  try {
    const { from, toEnd } = resolveDateRange(req.query);

    const [[summary]] = await db.query(
      `
      SELECT
        ROUND(AVG(rating), 2) AS avgRating,
        COUNT(*)              AS totalReviews,
        SUM(rating = 5) AS fiveStar,
        SUM(rating = 4) AS fourStar,
        SUM(rating = 3) AS threeStar,
        SUM(rating = 2) AS twoStar,
        SUM(rating = 1) AS oneStar
      FROM reviews
      WHERE createdAt BETWEEN ? AND ?
      `,
      [from, toEnd]
    );

    res.json({ ok: true, range: { from, to: toEnd }, summary });
  } catch (err) {
    console.error('[GET /reports/reviews]', err);
    res.status(500).json({ ok: false, message: 'Lỗi khi lấy báo cáo đánh giá' });
  }
});

// ==============================================================
// 8) TỔNG HỢP KPI (dùng cho 4 thẻ Statistic trên đầu trang)
//    GET /api/reports/summary?from=...&to=...
//    Gộp các số liệu quan trọng nhất thành 1 lần gọi duy nhất
//    để trang Dashboard không phải gọi 7 API riêng lẻ.
// ==============================================================
router.get('/summary', requireAuth, requireStaff, async (req, res) => {
  try {
    const { from, toEnd } = resolveDateRange(req.query);

    const [[revenueRow]] = await db.query(
      `
      SELECT SUM(p.paidAmount) AS collectedRevenue, COUNT(DISTINCT p.bookingId) AS bookingsCount
      FROM payments p
      JOIN bookings b ON b.id = p.bookingId
      WHERE p.paymentDate BETWEEN ? AND ?
        AND p.paymentStatus IN ('paid', 'deposit_paid')
        AND b.bookingStatus NOT IN (?, ?)
      `,
      [from, toEnd, ...EXCLUDED_STATUSES]
    );

    const [[newCustomersRow]] = await db.query(
      `SELECT COUNT(*) AS newCustomers FROM accounts WHERE role = 'customer' AND created_at BETWEEN ? AND ?`,
      [from, toEnd]
    );

    const [[roomsRow]] = await db.query(`SELECT COUNT(*) AS totalRooms FROM rooms WHERE isDeleted = 0`);

    res.json({
      ok: true,
      range: { from, to: toEnd },
      kpis: {
        revenueTotal: Number(revenueRow.collectedRevenue) || 0,
        bookingsTotal: Number(revenueRow.bookingsCount) || 0,
        newCustomers: Number(newCustomersRow.newCustomers) || 0,
        totalRooms: Number(roomsRow.totalRooms) || 0,
      },
    });
  } catch (err) {
    console.error('[GET /reports/summary]', err);
    res.status(500).json({ ok: false, message: 'Lỗi khi lấy tổng hợp KPI' });
  }
});

module.exports = router;

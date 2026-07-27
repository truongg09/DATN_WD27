
const express = require('express');
const router = express.Router();
const db = require('../db'); // ⚠️ Thay bằng pool mysql2/promise thực tế của bạn

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
router.get('/revenue', async (req, res) => {
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
router.get('/room-types', async (req, res) => {
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
router.get('/occupancy', async (req, res) => {
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
router.get('/payment-status', async (req, res) => {
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
router.get('/cancellation-rate', async (req, res) => {
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
router.get('/services', async (req, res) => {
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
router.get('/reviews', async (req, res) => {
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
router.get('/summary', async (req, res) => {
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
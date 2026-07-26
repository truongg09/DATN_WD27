const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Đếm các yêu cầu từ khách đang chờ xử lý - dùng cho badge đỏ trên menu admin
router.get('/pending-counts', requireAuth, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user?.role)) {
      return res.status(403).json({ message: 'Chỉ quản trị viên được xem' });
    }

    const [[bookings]] = await db.query(
      "SELECT COUNT(*) AS c FROM bookings WHERE status = 'pending'"
    );
    const [[serviceRequests]] = await db.query(
      "SELECT COUNT(*) AS c FROM booking_service_requests WHERE status = 'pending'"
    );
    const [[refunds]] = await db.query(
      "SELECT COUNT(*) AS c FROM payment_refunds WHERE status = 'pending'"
    );
    const [[withdrawals]] = await db.query(
      "SELECT COUNT(*) AS c FROM wallet_transactions WHERE type = 'withdrawal' AND status = 'pending'"
    );

    const data = {
      pendingBookings: Number(bookings.c) || 0,
      pendingServiceRequests: Number(serviceRequests.c) || 0,
      pendingRefunds: Number(refunds.c) || 0,
      pendingWithdrawals: Number(withdrawals.c) || 0
    };
    data.total =
      data.pendingBookings + data.pendingServiceRequests + data.pendingRefunds + data.pendingWithdrawals;

    res.json({ data });
  } catch (error) {
    console.error('Pending counts error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Việc cần làm hôm nay: booking chờ xác nhận, khách check-in/check-out hôm nay, phòng đang trống
router.get('/today', requireAuth, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user?.role)) {
      return res.status(403).json({ message: 'Chỉ quản trị viên được xem' });
    }

    // 1) Booking đang chờ xác nhận (hàng đợi cần xử lý, không giới hạn theo ngày tạo)
    const [pendingBookings] = await db.query(`
      SELECT
        b.id,
        b.bookingCode,
        COALESCE(c.fullName, b.guest_name) AS guestName,
        r.roomNumber,
        rt.typeName AS roomTypeName,
        COALESCE(b.created_at, b.createdAt) AS createdAt
      FROM bookings b
      LEFT JOIN customers c ON c.id = b.customerId
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      LEFT JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
      LEFT JOIN room_types rt ON rt.id = r.roomTypeId
      WHERE COALESCE(b.bookingStatus, b.status) = 'pending'
      ORDER BY COALESCE(b.created_at, b.createdAt) ASC
    `);

    // 2) Khách check-in hôm nay (loại bỏ booking đã hủy)
    const [checkInsToday] = await db.query(`
      SELECT
        b.id,
        b.bookingCode,
        COALESCE(c.fullName, b.guest_name) AS guestName,
        r.roomNumber,
        rt.typeName AS roomTypeName,
        COALESCE(bd.checkInDate, b.check_in) AS checkInDate
      FROM bookings b
      LEFT JOIN customers c ON c.id = b.customerId
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      LEFT JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
      LEFT JOIN room_types rt ON rt.id = r.roomTypeId
      WHERE COALESCE(bd.checkInDate, b.check_in) = CURDATE()
        AND COALESCE(b.bookingStatus, b.status) NOT IN ('cancelled')
      ORDER BY r.roomNumber ASC
    `);

    // 3) Khách check-out hôm nay
    const [checkOutsToday] = await db.query(`
      SELECT
        b.id,
        b.bookingCode,
        COALESCE(c.fullName, b.guest_name) AS guestName,
        r.roomNumber,
        rt.typeName AS roomTypeName,
        COALESCE(bd.checkOutDate, b.check_out) AS checkOutDate
      FROM bookings b
      LEFT JOIN customers c ON c.id = b.customerId
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      LEFT JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
      LEFT JOIN room_types rt ON rt.id = r.roomTypeId
      WHERE COALESCE(bd.checkOutDate, b.check_out) = CURDATE()
        AND COALESCE(b.bookingStatus, b.status) NOT IN ('cancelled')
      ORDER BY r.roomNumber ASC
    `);

    // 4) Phòng đang trống, có thể xếp khách ngay
    const [availableRooms] = await db.query(`
      SELECT r.id, r.roomNumber, r.floor, rt.typeName AS roomTypeName, rt.defaultPrice
      FROM rooms r
      LEFT JOIN room_types rt ON rt.id = r.roomTypeId
      WHERE r.status = 'available' AND r.isDeleted = 0
      ORDER BY r.floor ASC, r.roomNumber ASC
    `);

    res.json({
      ok: true,
      pendingBookings: {
        count: pendingBookings.length,
        items: pendingBookings
      },
      checkInsToday: {
        count: checkInsToday.length,
        items: checkInsToday
      },
      checkOutsToday: {
        count: checkOutsToday.length,
        items: checkOutsToday
      },
      availableRooms: {
        count: availableRooms.length,
        items: availableRooms
      }
    });
  } catch (error) {
    console.error('Dashboard today error:', error);
    res.status(500).json({ ok: false, message: 'Internal server error' });
  }
});

function formatLocalDateTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// mode: 'month' | 'year' | 'custom'
// customFrom/customTo: chuỗi 'YYYY-MM-DD' lấy từ query khi mode = custom
function getDateRange(mode, customFrom, customTo) {
  const now = new Date();
  let from;
  let to;

  if (mode === 'year') {
    from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (mode === 'custom' && DATE_ONLY_PATTERN.test(customFrom) && DATE_ONLY_PATTERN.test(customTo) && customFrom <= customTo) {
    const [fy, fm, fd] = customFrom.split('-').map(Number);
    const [ty, tm, td] = customTo.split('-').map(Number);
    from = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
    to = new Date(ty, tm - 1, td, 23, 59, 59, 999);
  } else {
    // custom không hợp lệ (hoặc mode = month) -> fallback về tháng hiện tại
    from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return { from: formatLocalDateTime(from), to: formatLocalDateTime(to), fromDate: from, toDate: to };
}

function daysInRange(fromDate, toDate) {
  const ms = toDate.getTime() - fromDate.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1);
}

// mode = 'custom' dùng chung trục ngày với 'month' (liệt kê từng ngày trong khoảng)
function buildCategories(mode, fromDate, toDate) {
  const categories = [];

  if (mode === 'year') {
    for (let m = 0; m < 12; m += 1) {
      categories.push(`T${m + 1}`);
    }
    return categories;
  }

  const cursor = new Date(fromDate);
  while (cursor <= toDate) {
    categories.push(String(cursor.getDate()).padStart(2, '0'));
    cursor.setDate(cursor.getDate() + 1);
  }
  return categories;
}

function mapSeriesRows(rows, mode, categories) {
  const data = categories.map(() => 0);

  rows.forEach((row) => {
    const bucket = Number(row.bucket);
    const idx = bucket - 1;
    if (idx >= 0 && idx < data.length) {
      data[idx] = Number(row.total) || 0;
    }
  });

  return data;
}

router.get('/', async (req, res) => {
  try {
    const mode = ['year', 'custom'].includes(req.query.mode) ? req.query.mode : 'month';
    const { from, to, fromDate, toDate } = getDateRange(mode, req.query.from, req.query.to);
    const categories = buildCategories(mode, fromDate, toDate);
    const periodDays = daysInRange(fromDate, toDate);

    // roomTypeId dùng để lọc toàn bộ số liệu theo 1 loại phòng cụ thể (nếu người dùng chọn)
    const roomTypeIdRaw = req.query.roomTypeId;
    const roomTypeId = roomTypeIdRaw && Number.isInteger(Number(roomTypeIdRaw)) ? Number(roomTypeIdRaw) : null;

    const revenueGroupExpr =
      mode === 'year'
        ? 'MONTH(p.paymentDate)'
        : 'DAY(p.paymentDate)';

    const bookingGroupExpr =
      mode === 'year'
        ? 'MONTH(COALESCE(b.created_at, b.createdAt))'
        : 'DAY(COALESCE(b.created_at, b.createdAt))';

    // Payments không có sẵn roomTypeId -> phải join qua bookings/booking_details/rooms để lọc.
    // Điều kiện roomTypeId để rỗng ('') khi không lọc, có giá trị khi có lọc.
    const revenueRoomTypeJoin = `
      LEFT JOIN bookings pb ON pb.id = p.bookingId
      LEFT JOIN booking_details pbd ON pbd.bookingId = pb.id
      LEFT JOIN rooms pr ON pr.id = COALESCE(pbd.roomId, pb.room_id)
    `;
    const revenueRoomTypeFilter = roomTypeId ? 'AND pr.roomTypeId = ?' : '';

    const bookingRoomTypeJoin = `
      LEFT JOIN booking_details bbd ON bbd.bookingId = b.id
      LEFT JOIN rooms br ON br.id = COALESCE(bbd.roomId, b.room_id)
    `;
    const bookingRoomTypeFilter = roomTypeId ? 'AND br.roomTypeId = ?' : '';

    const revenueParams = [from, to, ...(roomTypeId ? [roomTypeId] : [])];
    const bookingParams = [from, to, ...(roomTypeId ? [roomTypeId] : [])];

    const [[revenueKpi]] = await db.query(
      `
        SELECT COALESCE(SUM(p.paidAmount), 0) AS total
        FROM payments p
        ${revenueRoomTypeJoin}
        WHERE p.paymentStatus = 'paid'
          AND p.paymentDate >= ?
          AND p.paymentDate <= ?
          ${revenueRoomTypeFilter}
      `,
      revenueParams
    );

    // Doanh thu riêng phần tiền phòng (không tính dịch vụ/phụ thu) -> dùng để tính ADR chính xác hơn
    const [[roomRevenueKpi]] = await db.query(
      `
        SELECT COALESCE(SUM(p.roomAmount), 0) AS total
        FROM payments p
        ${revenueRoomTypeJoin}
        WHERE p.paymentStatus = 'paid'
          AND p.paymentDate >= ?
          AND p.paymentDate <= ?
          ${revenueRoomTypeFilter}
      `,
      revenueParams
    );

    const [[bookingKpi]] = await db.query(
      `
        SELECT COUNT(DISTINCT b.id) AS total
        FROM bookings b
        ${bookingRoomTypeJoin}
        WHERE COALESCE(b.created_at, b.createdAt) >= ?
          AND COALESCE(b.created_at, b.createdAt) <= ?
          ${bookingRoomTypeFilter}
      `,
      bookingParams
    );

    const [[cancelledKpi]] = await db.query(
      `
        SELECT COUNT(DISTINCT b.id) AS total
        FROM bookings b
        ${bookingRoomTypeJoin}
        WHERE COALESCE(b.created_at, b.createdAt) >= ?
          AND COALESCE(b.created_at, b.createdAt) <= ?
          AND COALESCE(b.bookingStatus, b.status) = 'cancelled'
          ${bookingRoomTypeFilter}
      `,
      bookingParams
    );

    // Khách hàng mới không gắn với loại phòng -> không áp dụng roomTypeId filter ở đây
    const [[customerKpi]] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM accounts a
        WHERE a.role = 'customer'
          AND COALESCE(a.created_at, a.createdAt) >= ?
          AND COALESCE(a.created_at, a.createdAt) <= ?
      `,
      [from, to]
    );

    const [[roomKpi]] = await db.query(
      roomTypeId
        ? 'SELECT COUNT(*) AS total FROM rooms WHERE roomTypeId = ? AND isDeleted = 0'
        : 'SELECT COUNT(*) AS total FROM rooms WHERE isDeleted = 0',
      roomTypeId ? [roomTypeId] : []
    );
    const totalRooms = Number(roomKpi?.total) || 0;

    const [[bookedNightsRow]] = await db.query(
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
        LEFT JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
        WHERE COALESCE(b.bookingStatus, b.status) NOT IN ('cancelled')
          AND COALESCE(bd.checkInDate, b.check_in) <= DATE(?)
          AND COALESCE(bd.checkOutDate, b.check_out) >= DATE(?)
          ${roomTypeId ? 'AND r.roomTypeId = ?' : ''}
      `,
      roomTypeId ? [to, from, to, from, roomTypeId] : [to, from, to, from]
    );

    const bookedNights = Number(bookedNightsRow?.bookedNights) || 0;
    const maxNights = totalRooms * periodDays;
    const occupancyRate = maxNights > 0 ? Math.round((bookedNights / maxNights) * 100) : 0;

    // ADR = doanh thu phòng / số đêm đã bán ra. RevPAR = doanh thu phòng / (tổng phòng x số ngày trong kỳ)
    const roomRevenueTotal = Number(roomRevenueKpi?.total) || 0;
    const adr = bookedNights > 0 ? Math.round(roomRevenueTotal / bookedNights) : 0;
    const revpar = maxNights > 0 ? Math.round(roomRevenueTotal / maxNights) : 0;

    const totalBookingsForCancelRate = Number(bookingKpi?.total) || 0;
    const cancelledBookings = Number(cancelledKpi?.total) || 0;
    const cancellationRate =
      totalBookingsForCancelRate > 0
        ? Number(((cancelledBookings / totalBookingsForCancelRate) * 100).toFixed(1))
        : 0;

    const [[ratingRow]] = await db.query(
      `
        SELECT AVG(rev.rating) AS avgRating
        FROM reviews rev
        LEFT JOIN bookings b ON b.id = rev.bookingId
        ${roomTypeId ? bookingRoomTypeJoin : ''}
        WHERE rev.createdAt >= ?
          AND rev.createdAt <= ?
          ${roomTypeId ? 'AND br.roomTypeId = ?' : ''}
      `,
      roomTypeId ? [from, to, roomTypeId] : [from, to]
    );
    const avgRating = ratingRow?.avgRating != null ? Number(Number(ratingRow.avgRating).toFixed(1)) : null;

    const [revenueRows] = await db.query(
      `
        SELECT ${revenueGroupExpr} AS bucket, COALESCE(SUM(p.paidAmount), 0) AS total
        FROM payments p
        ${revenueRoomTypeJoin}
        WHERE p.paymentStatus = 'paid'
          AND p.paymentDate >= ?
          AND p.paymentDate <= ?
          ${revenueRoomTypeFilter}
        GROUP BY bucket
        ORDER BY bucket
      `,
      revenueParams
    );

    const [bookingRows] = await db.query(
      `
        SELECT ${bookingGroupExpr} AS bucket, COUNT(DISTINCT b.id) AS total
        FROM bookings b
        ${bookingRoomTypeJoin}
        WHERE COALESCE(b.created_at, b.createdAt) >= ?
          AND COALESCE(b.created_at, b.createdAt) <= ?
          ${bookingRoomTypeFilter}
        GROUP BY bucket
        ORDER BY bucket
      `,
      bookingParams
    );

    const [paymentMethodRows] = await db.query(
      `
        SELECT
          COALESCE(NULLIF(TRIM(p.paymentMethod), ''), 'Khác') AS label,
          COUNT(*) AS total
        FROM payments p
        ${revenueRoomTypeJoin}
        WHERE p.paymentDate >= ?
          AND p.paymentDate <= ?
          ${revenueRoomTypeFilter}
        GROUP BY label
        ORDER BY total DESC
      `,
      revenueParams
    );

    const [topRoomTypeRows] = await db.query(
      `
        SELECT
          COALESCE(rt.typeName, 'Không rõ') AS label,
          COUNT(*) AS total
        FROM bookings b
        LEFT JOIN booking_details bd ON bd.bookingId = b.id
        LEFT JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
        LEFT JOIN room_types rt ON rt.id = r.roomTypeId
        WHERE COALESCE(b.created_at, b.createdAt) >= ?
          AND COALESCE(b.created_at, b.createdAt) <= ?
          ${roomTypeId ? 'AND r.roomTypeId = ?' : ''}
        GROUP BY label
        ORDER BY total DESC
        LIMIT 5
      `,
      roomTypeId ? [from, to, roomTypeId] : [from, to]
    );

    // Doanh thu theo từng loại phòng (khi đang lọc 1 loại phòng cụ thể thì chỉ còn 1 cột)
    const [revenueByRoomTypeRows] = await db.query(
      `
        SELECT
          COALESCE(rt.typeName, 'Không rõ') AS label,
          COALESCE(SUM(p.paidAmount), 0) AS total
        FROM payments p
        ${revenueRoomTypeJoin}
        LEFT JOIN room_types rt ON rt.id = pr.roomTypeId
        WHERE p.paymentStatus = 'paid'
          AND p.paymentDate >= ?
          AND p.paymentDate <= ?
          ${revenueRoomTypeFilter}
        GROUP BY label
        ORDER BY total DESC
      `,
      revenueParams
    );

    res.json({
      ok: true,
      range: { from, to },
      mode,
      kpis: {
        revenueTotal: Number(revenueKpi?.total) || 0,
        bookingsTotal: Number(bookingKpi?.total) || 0,
        newCustomers: Number(customerKpi?.total) || 0,
        occupancyRate,
        adr,
        revpar,
        cancellationRate,
        avgRating
      },
      revenueSeries: {
        categories,
        data: mapSeriesRows(revenueRows, mode, categories)
      },
      bookingSeries: {
        categories,
        data: mapSeriesRows(bookingRows, mode, categories)
      },
      paymentMethodDonut: {
        labels: paymentMethodRows.map((row) => row.label),
        data: paymentMethodRows.map((row) => Number(row.total) || 0)
      },
      topRoomTypes: {
        labels: topRoomTypeRows.map((row) => row.label),
        data: topRoomTypeRows.map((row) => Number(row.total) || 0)
      },
      revenueByRoomType: {
        labels: revenueByRoomTypeRows.map((row) => row.label),
        data: revenueByRoomTypeRows.map((row) => Number(row.total) || 0)
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

module.exports = router;
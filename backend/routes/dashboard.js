const express = require('express');
const db = require('../config/db');
const { requireAuth, requireStaff } = require('../middleware/auth');

const router = express.Router();

/**
 * GHI CHÚ QUAN TRỌNG VỀ SCHEMA:
 * Bảng `bookings` có 2 cột trạng thái (`status` cũ và `bookingStatus` mới) và có thể
 * lệch nhau trong dữ liệu thực tế (VD: status='cancelled' nhưng bookingStatus='confirmed').
 * Để tránh coi 1 booking đã hủy là vẫn đang hoạt động (gây double-booking / sai số liệu),
 * ta dùng quy tắc: nếu MỘT TRONG HAI cột nói là 'cancelled' hoặc 'no_show' thì coi booking
 * đó là không còn hoạt động. Ngược lại ưu tiên bookingStatus (cột mới) rồi mới tới status.
 *
 * Về lâu dài nên gộp 2 cột này thành 1 cột duy nhất (xem file migration đi kèm).
 */
const BOOKING_EFFECTIVE_STATUS_EXPR = `
  CASE
    WHEN 'cancelled' IN (b.status, b.bookingStatus) THEN 'cancelled'
    WHEN 'no_show' IN (b.status, b.bookingStatus) THEN 'no_show'
    ELSE COALESCE(b.bookingStatus, b.status)
  END
`;

// Danh sách trạng thái được coi là "không còn chiếm phòng / không tính vào doanh thu hoạt động"
const INACTIVE_BOOKING_STATUSES = ['cancelled', 'no_show'];

// Đếm các yêu cầu từ khách đang chờ xử lý - dùng cho badge đỏ trên menu admin
router.get('/pending-counts', requireAuth, requireStaff, async (req, res) => {
  try {

    // Dùng COALESCE(bookingStatus, status) thay vì chỉ `status` để không bỏ sót
    // các booking mà cột status cũ chưa được cập nhật.
    const [[bookings]] = await db.query(
      "SELECT COUNT(*) AS c FROM bookings b WHERE COALESCE(b.bookingStatus, b.status) = 'pending'"
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
    // Khách khai đã chuyển khoản và đang chờ lễ tân đối soát. Đây là việc cần xử
    // lý gấp nhất (khách không check-in được cho tới khi xác nhận) nhưng trước
    // đây không được đếm nên badge không bao giờ báo.
    const [[transferConfirmations]] = await db.query(
      "SELECT COUNT(*) AS c FROM payment_confirmation_requests WHERE status = 'pending'"
    );
    // Khách đang lưu trú còn nợ tiền dịch vụ/hư hỏng phát sinh.
    const [[unpaidStays]] = await db.query(
      `SELECT COUNT(DISTINCT b.id) AS c
       FROM bookings b
       JOIN payments p ON p.bookingId = b.id
       WHERE COALESCE(b.bookingStatus, b.status) = 'checked_in'
         AND COALESCE(p.remainingAmount, 0) > 0`
    );
    // Đánh giá mới của khách gửi đang chờ admin duyệt.
    const [[pendingReviews]] = await db.query(
      "SELECT COUNT(*) AS c FROM reviews WHERE status = 'pending'"
    );

    const data = {
      pendingBookings: Number(bookings.c) || 0,
      pendingServiceRequests: Number(serviceRequests.c) || 0,
      pendingRefunds: Number(refunds.c) || 0,
      pendingWithdrawals: Number(withdrawals.c) || 0,
      pendingTransferConfirmations: Number(transferConfirmations.c) || 0,
      unpaidStays: Number(unpaidStays.c) || 0,
      pendingReviews: Number(pendingReviews.c) || 0
    };
    data.total =
      data.pendingBookings +
      data.pendingServiceRequests +
      data.pendingRefunds +
      data.pendingWithdrawals +
      data.pendingTransferConfirmations +
      data.unpaidStays +
      data.pendingReviews;

    res.json({ data });
  } catch (error) {
    console.error('Pending counts error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Việc cần làm hôm nay: booking chờ xác nhận, khách check-in/check-out hôm nay, phòng đang trống
router.get('/today', requireAuth, requireStaff, async (req, res) => {
  try {

    // Giới hạn số dòng trả về để tránh load cả nghìn booking pending cùng lúc.
    // Có thể truyền ?limit=... nếu FE cần xem nhiều hơn, tối đa 200.
    const rawLimit = Number(req.query.limit);
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;

    // 1) Booking đang chờ xác nhận (hàng đợi cần xử lý, không giới hạn theo ngày tạo)
    const [[pendingBookingsCountRow]] = await db.query(`
      SELECT COUNT(*) AS c
      FROM bookings b
      WHERE COALESCE(b.bookingStatus, b.status) = 'pending'
    `);

    const [pendingBookings] = await db.query(
      `
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
      LIMIT ?
      `,
      [limit]
    );

    // 2) Khách check-in hôm nay (loại bỏ booking đã hủy / no-show, dùng trạng thái hiệu lực)
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
        AND ${BOOKING_EFFECTIVE_STATUS_EXPR} NOT IN ('cancelled', 'no_show')
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
        AND ${BOOKING_EFFECTIVE_STATUS_EXPR} NOT IN ('cancelled', 'no_show')
      ORDER BY r.roomNumber ASC
    `);

    // 4) Phòng đang trống, có thể xếp khách ngay.
    // QUAN TRỌNG: KHÔNG dựa vào cột `rooms.status` để xác định phòng trống, vì cột này
    // không được đồng bộ tự động khi khách check-in/check-out (không có trigger nào cập
    // nhật nó). Thay vào đó, tính "trống" theo thời gian thực: 1 phòng được coi là trống
    // nếu KHÔNG có booking còn hiệu lực nào đang phủ ngày hôm nay trên phòng đó, và bản
    // thân phòng không đang ở trạng thái bảo trì / đã xóa.
    const [availableRooms] = await db.query(`
      SELECT r.id, r.roomNumber, r.floor, rt.typeName AS roomTypeName, rt.defaultPrice
      FROM rooms r
      LEFT JOIN room_types rt ON rt.id = r.roomTypeId
      WHERE r.isDeleted = 0
        AND r.status NOT IN ('maintenance')
        AND NOT EXISTS (
          SELECT 1
          FROM bookings b
          LEFT JOIN booking_details bd ON bd.bookingId = b.id
          WHERE COALESCE(bd.roomId, b.room_id) = r.id
            AND ${BOOKING_EFFECTIVE_STATUS_EXPR} NOT IN ('cancelled', 'no_show')
            AND COALESCE(bd.checkInDate, b.check_in) <= CURDATE()
            AND COALESCE(bd.checkOutDate, b.check_out) > CURDATE()
        )
      ORDER BY r.floor ASC, r.roomNumber ASC
    `);

    res.json({
      ok: true,
      pendingBookings: {
        count: Number(pendingBookingsCountRow?.c) || 0,
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
// queryMonth: 1-12 (khi muốn xem cụ thể một tháng trong năm)
// queryYear: YYYY (mặc định là năm hiện tại)
function getDateRange(mode, customFrom, customTo, queryMonth, queryYear) {
  const now = new Date();
  let from;
  let to;
  let fallback = false;

  const targetYear = queryYear && !isNaN(Number(queryYear)) ? Number(queryYear) : now.getFullYear();
  const parsedMonth = queryMonth !== undefined && queryMonth !== null && queryMonth !== '' && !isNaN(Number(queryMonth)) && Number(queryMonth) >= 1 && Number(queryMonth) <= 12
    ? Number(queryMonth) - 1
    : null;

  if (mode === 'year') {
    from = new Date(targetYear, 0, 1, 0, 0, 0, 0);
    to = new Date(targetYear, 11, 31, 23, 59, 59, 999);
  } else if (mode === 'custom' && DATE_ONLY_PATTERN.test(customFrom) && DATE_ONLY_PATTERN.test(customTo) && customFrom <= customTo) {
    const [fy, fm, fd] = customFrom.split('-').map(Number);
    const [ty, tm, td] = customTo.split('-').map(Number);
    from = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
    to = new Date(ty, tm - 1, td, 23, 59, 59, 999);
  } else {
    // mode = 'month' (nếu có queryMonth thì lấy tháng đó, không thì lấy tháng hiện tại)
    const m = parsedMonth !== null ? parsedMonth : now.getMonth();
    from = new Date(targetYear, m, 1, 0, 0, 0, 0);
    to = new Date(targetYear, m + 1, 0, 23, 59, 59, 999);
    if (mode === 'custom') fallback = true;
  }

  return { from: formatLocalDateTime(from), to: formatLocalDateTime(to), fromDate: from, toDate: to, fallback };
}

// Số ngày trong khoảng [fromDate, toDate], tính theo ngày lịch (không lệch +1 ngày).
// VD: 01/01 00:00:00 -> 31/01 23:59:59.999 phải ra đúng 31 ngày, không phải 32.
function daysInRange(fromDate, toDate) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const startOfFrom = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const startOfTo = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  const diffDays = Math.round((startOfTo.getTime() - startOfFrom.getTime()) / msPerDay) + 1;
  return Math.max(1, diffDays);
}

function formatDateKey(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// mode = 'custom' dùng trục ngày đầy đủ 'YYYY-MM-DD' (không phải chỉ số ngày-trong-tháng),
// để không bị gộp nhầm dữ liệu của các tháng khác nhau vào cùng 1 cột khi khoảng chọn
// vắt qua nhiều tháng.
function buildCategories(mode, fromDate, toDate) {
  const categories = [];

  if (mode === 'year') {
    for (let m = 0; m < 12; m += 1) {
      categories.push(`T${m + 1}`);
    }
    return categories;
  }

  if (mode === 'custom') {
    const cursor = new Date(fromDate);
    while (cursor <= toDate) {
      categories.push(formatDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return categories;
  }

  // mode === 'month': liệt kê từng ngày trong tháng, chỉ hiển thị số ngày (01, 02, ...)
  const cursor = new Date(fromDate);
  while (cursor <= toDate) {
    categories.push(String(cursor.getDate()).padStart(2, '0'));
    cursor.setDate(cursor.getDate() + 1);
  }
  return categories;
}

// rows: mảng { bucket, total } trả về từ SQL.
// - mode 'year': bucket là số tháng (1-12) -> map trực tiếp theo index.
// - mode 'month': bucket là số ngày trong tháng (1-31) -> map trực tiếp theo index.
// - mode 'custom': bucket là chuỗi ngày đầy đủ 'YYYY-MM-DD' -> phải so khớp theo giá trị,
//   không dùng index số, để không bị lẫn giữa các tháng khác nhau.
function mapSeriesRows(rows, mode, categories) {
  const data = categories.map(() => 0);

  if (mode === 'custom') {
    const indexByDate = new Map(categories.map((cat, idx) => [cat, idx]));
    rows.forEach((row) => {
      // MySQL driver có thể trả bucket dạng Date object hoặc string tùy cấu hình,
      // nên luôn ép về chuỗi 'YYYY-MM-DD' để so khớp.
      const bucket = row.bucket instanceof Date ? formatDateKey(row.bucket) : String(row.bucket).slice(0, 10);
      const idx = indexByDate.get(bucket);
      if (idx !== undefined) {
        data[idx] = Number(row.total) || 0;
      }
    });
    return data;
  }

  rows.forEach((row) => {
    const bucket = Number(row.bucket);
    const idx = bucket - 1;
    if (idx >= 0 && idx < data.length) {
      data[idx] = Number(row.total) || 0;
    }
  });

  return data;
}

router.get('/', requireAuth, requireStaff, async (req, res) => {
  try {
    const mode = ['year', 'custom'].includes(req.query.mode) ? req.query.mode : 'month';
    const { from, to, fromDate, toDate, fallback } = getDateRange(mode, req.query.from, req.query.to, req.query.month, req.query.year);
    const categories = buildCategories(mode, fromDate, toDate);
    const periodDays = daysInRange(fromDate, toDate);

    // roomTypeId dùng để lọc toàn bộ số liệu theo 1 loại phòng cụ thể (nếu người dùng chọn)
    const roomTypeIdRaw = req.query.roomTypeId;
    const roomTypeId = roomTypeIdRaw && Number.isInteger(Number(roomTypeIdRaw)) ? Number(roomTypeIdRaw) : null;

    const revenueGroupExpr =
      mode === 'year'
        ? 'MONTH(p.paymentDate)'
        : mode === 'custom'
          ? "DATE_FORMAT(p.paymentDate, '%Y-%m-%d')"
          : 'DAY(p.paymentDate)';

    const bookingGroupExpr =
      mode === 'year'
        ? 'MONTH(COALESCE(b.created_at, b.createdAt))'
        : mode === 'custom'
          ? "DATE_FORMAT(COALESCE(b.created_at, b.createdAt), '%Y-%m-%d')"
          : 'DAY(COALESCE(b.created_at, b.createdAt))';

    // Lọc theo loại phòng bằng EXISTS để multi-room an toàn, không fan-out
    const bookingRoomTypeFilter = roomTypeId
      ? `
        AND EXISTS (
          SELECT 1
          FROM booking_details bbd
          JOIN rooms br ON br.id = COALESCE(bbd.roomId, b.room_id)
          WHERE bbd.bookingId = b.id
            AND br.roomTypeId = ?
        )
      `
      : '';

    const bookingParams = [from, to, ...(roomTypeId ? [roomTypeId] : [])];

    // Doanh thu nhận diện theo cùng chuẩn với trang Báo cáo:
    // - Đơn lưu trú (checked_in, checked_out): phòng + dịch vụ + phụ thu - giảm giá
    // - Đơn hủy / no_show: tiền phạt/cọc thực tế giữ lại sau hoàn tiền (paidAmount)
    // - Tiền thực thu: tổng tiền đã vào két (paidAmount của mọi thanh toán hợp lệ)
    // - Doanh thu tiền phòng (chỉ đơn lưu trú): dùng để tính ADR/RevPAR chính xác
    const [[revenueKpi]] = await db.query(
      `
        SELECT
          COALESCE(SUM(
            CASE
              WHEN ${BOOKING_EFFECTIVE_STATUS_EXPR} IN ('checked_in', 'checked_out') THEN
                GREATEST(0, COALESCE(pay.roomAmount, 0) + COALESCE(pay.serviceAmount, 0) + COALESCE(pay.surchargeAmount, 0) - COALESCE(pay.discountAmount, 0))
              WHEN ${BOOKING_EFFECTIVE_STATUS_EXPR} IN ('cancelled', 'no_show') THEN
                COALESCE(pay.paidAmount, 0)
              ELSE 0
            END
          ), 0) AS totalRevenue,
          COALESCE(SUM(pay.paidAmount), 0) AS totalCollected,
          COALESCE(SUM(
            CASE
              WHEN ${BOOKING_EFFECTIVE_STATUS_EXPR} IN ('checked_in', 'checked_out') THEN
                COALESCE(pay.roomAmount, 0)
              ELSE 0
            END
          ), 0) AS roomRevenue
        FROM bookings b
        LEFT JOIN (
          SELECT
            bookingId,
            SUM(roomAmount) AS roomAmount,
            SUM(serviceAmount) AS serviceAmount,
            SUM(surchargeAmount) AS surchargeAmount,
            SUM(discountAmount) AS discountAmount,
            SUM(paidAmount) AS paidAmount,
            SUM(remainingAmount) AS remainingAmount,
            SUM(totalAmount) AS totalAmount
          FROM payments
          GROUP BY bookingId
        ) pay ON pay.bookingId = b.id
        WHERE COALESCE(b.created_at, b.createdAt) >= ?
          AND COALESCE(b.created_at, b.createdAt) <= ?
          ${bookingRoomTypeFilter}
      `,
      bookingParams
    );

    const [[bookingKpi]] = await db.query(
      `
        SELECT COUNT(DISTINCT b.id) AS total
        FROM bookings b
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
        WHERE COALESCE(b.created_at, b.createdAt) >= ?
          AND COALESCE(b.created_at, b.createdAt) <= ?
          AND ${BOOKING_EFFECTIVE_STATUS_EXPR} = 'cancelled'
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
        ? "SELECT COUNT(*) AS total FROM rooms WHERE roomTypeId = ? AND isDeleted = 0 AND status <> 'maintenance'"
        : "SELECT COUNT(*) AS total FROM rooms WHERE isDeleted = 0 AND status <> 'maintenance'",
      roomTypeId ? [roomTypeId] : []
    );
    const totalRooms = Number(roomKpi?.total) || 0;

    const [[bookedNightsRow]] = await db.query(
      `
        SELECT COALESCE(SUM(
          GREATEST(
            0,
            DATEDIFF(
              -- Biên phải là ?to + 1 ngày: khách ở đến hết ngày cuối kỳ vẫn tính
              -- 1 đêm. Dùng thẳng ?to làm hụt đúng 1 đêm mỗi booking vắt qua kỳ.
              LEAST(COALESCE(bd.checkOutDate, b.check_out), DATE_ADD(DATE(?), INTERVAL 1 DAY)),
              GREATEST(COALESCE(bd.checkInDate, b.check_in), DATE(?))
            )
          )
        ), 0) AS bookedNights
        FROM bookings b
        LEFT JOIN booking_details bd ON bd.bookingId = b.id
        LEFT JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
        WHERE ${BOOKING_EFFECTIVE_STATUS_EXPR} NOT IN ('cancelled', 'no_show')
          -- Đơn giữ chỗ chưa trả đồng nào chưa thực sự chiếm phòng.
          AND NOT (
            ${BOOKING_EFFECTIVE_STATUS_EXPR} = 'pending'
            AND COALESCE((SELECT SUM(p.paidAmount) FROM payments p WHERE p.bookingId = b.id), 0) <= 0
          )
          AND COALESCE(bd.checkInDate, b.check_in) <= DATE(?)
          AND COALESCE(bd.checkOutDate, b.check_out) > DATE(?)
          ${roomTypeId ? 'AND r.roomTypeId = ?' : ''}
      `,
      roomTypeId ? [to, from, to, from, roomTypeId] : [to, from, to, from]
    );

    const bookedNights = Number(bookedNightsRow?.bookedNights) || 0;
    const maxNights = totalRooms * periodDays;
    const occupancyRate = maxNights > 0 ? Number(((bookedNights / maxNights) * 100).toFixed(2)) : 0;

    // ADR = doanh thu phòng / số đêm đã bán ra. RevPAR = doanh thu phòng / (tổng phòng x số ngày trong kỳ)
    const roomRevenueTotal = Number(revenueKpi?.roomRevenue) || 0;
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
        WHERE rev.createdAt >= ?
          AND rev.createdAt <= ?
          ${bookingRoomTypeFilter}
      `,
      bookingParams
    );
    const avgRating = ratingRow?.avgRating != null ? Number(Number(ratingRow.avgRating).toFixed(1)) : null;

    // Chuỗi doanh thu theo thời gian (reconcile 100% với revenueTotal)
    const [revenueRows] = await db.query(
      `
        SELECT
          ${bookingGroupExpr} AS bucket,
          COALESCE(SUM(
            CASE
              WHEN ${BOOKING_EFFECTIVE_STATUS_EXPR} IN ('checked_in', 'checked_out') THEN
                GREATEST(0, COALESCE(pay.roomAmount, 0) + COALESCE(pay.serviceAmount, 0) + COALESCE(pay.surchargeAmount, 0) - COALESCE(pay.discountAmount, 0))
              WHEN ${BOOKING_EFFECTIVE_STATUS_EXPR} IN ('cancelled', 'no_show') THEN
                COALESCE(pay.paidAmount, 0)
              ELSE 0
            END
          ), 0) AS total
        FROM bookings b
        LEFT JOIN (
          SELECT
            bookingId,
            SUM(roomAmount) AS roomAmount,
            SUM(serviceAmount) AS serviceAmount,
            SUM(surchargeAmount) AS surchargeAmount,
            SUM(discountAmount) AS discountAmount,
            SUM(paidAmount) AS paidAmount
          FROM payments
          GROUP BY bookingId
        ) pay ON pay.bookingId = b.id
        WHERE COALESCE(b.created_at, b.createdAt) >= ?
          AND COALESCE(b.created_at, b.createdAt) <= ?
          ${bookingRoomTypeFilter}
        GROUP BY bucket
        ORDER BY bucket
      `,
      bookingParams
    );

    const [bookingRows] = await db.query(
      `
        SELECT ${bookingGroupExpr} AS bucket, COUNT(DISTINCT b.id) AS total
        FROM bookings b
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
        LEFT JOIN bookings b ON b.id = p.bookingId
        WHERE p.paymentStatus = 'paid'
          AND p.paymentDate >= ?
          AND p.paymentDate <= ?
          ${bookingRoomTypeFilter}
        GROUP BY label
        ORDER BY total DESC
      `,
      bookingParams
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

    // Doanh thu theo từng loại phòng (tính trực tiếp từ booking_details x số đêm, tránh fan-out với payments)
    const [revenueByRoomTypeRows] = await db.query(
      `
        SELECT
          COALESCE(rt.typeName, 'Không rõ') AS label,
          COALESCE(SUM(
            bd.roomPrice * GREATEST(1, DATEDIFF(bd.checkOutDate, bd.checkInDate))
          ), 0) AS total
        FROM bookings b
        JOIN booking_details bd ON bd.bookingId = b.id
        LEFT JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
        LEFT JOIN room_types rt ON rt.id = COALESCE(bd.roomTypeId, r.roomTypeId)
        WHERE COALESCE(b.created_at, b.createdAt) >= ?
          AND COALESCE(b.created_at, b.createdAt) <= ?
          AND ${BOOKING_EFFECTIVE_STATUS_EXPR} IN ('checked_in', 'checked_out')
          ${roomTypeId ? 'AND r.roomTypeId = ?' : ''}
        GROUP BY label
        ORDER BY total DESC
      `,
      roomTypeId ? [from, to, roomTypeId] : [from, to]
    );

    res.json({
      ok: true,
      range: { from, to },
      mode,
      // true nếu người dùng chọn "Tùy chỉnh" nhưng khoảng ngày không hợp lệ và hệ thống
      // đã tự động rơi về tháng hiện tại. FE cần hiển thị cảnh báo khi cờ này bật.
      rangeFallback: fallback,
      kpis: {
        revenueTotal: Number(revenueKpi?.totalRevenue) || 0,
        collectedTotal: Number(revenueKpi?.totalCollected) || 0,
        roomRevenueTotal: Number(revenueKpi?.roomRevenue) || 0,
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
    res.status(500).json({ ok: false, error: 'Lỗi máy chủ nội bộ' });
  }
});

module.exports = router;
const db = require('../config/db');

const run = (connection) => connection || db;
const HOLD_MINUTES = 15;
const { LATE_CHECKIN_GRACE_HOUR } = require('../utils/bookingPolicy');

const BOOKING_SELECT = `
  SELECT
    b.id,
    b.bookingCode AS booking_code,
    b.voucherId AS voucher_id,
    b.user_id,
    b.status,
    b.total_price,
    b.totalAmount AS booking_total_amount,
    COALESCE(
      (
        SELECT p.totalAmount
        FROM payments p
        WHERE p.bookingId = b.id
        ORDER BY p.id DESC
        LIMIT 1
      ),
      b.total_price,
      0
    ) AS payable_total,
    b.created_at,
    b.notes,
    b.cancellation_reason,
    bd.id AS detail_id,
    bd.roomId AS room_id,
    DATE(COALESCE(bd.checkInDate, b.check_in)) AS check_in,
    DATE(COALESCE(bd.checkOutDate, b.check_out)) AS check_out,
    bd.adults,
    bd.children,
    bd.roomPrice AS room_price,
    COALESCE(bd.occupancySurcharge, 0) AS occupancy_surcharge,
    COALESCE(b.guest_name, c.fullName) AS customer_name,
    COALESCE(b.guest_email, a.email) AS customer_email,
    COALESCE(b.guest_phone, c.phone, a.phone) AS customer_phone,
    r.roomNumber AS room_number,
    r.floor AS room_floor,
    r.area AS room_area,
    r.status AS room_status,
    rt.typeName AS room_type_name,
    rt.defaultPrice AS price_per_night,
    rt.capacity AS room_capacity
  FROM bookings b
  LEFT JOIN booking_details bd ON bd.bookingId = b.id
  LEFT JOIN customers c ON c.accountId = b.user_id
  LEFT JOIN accounts a ON a.id = b.user_id
  LEFT JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
  LEFT JOIN room_types rt ON rt.id = r.roomTypeId
`;

const getAccountById = async (userId, connection) => {
  const [rows] = await run(connection).query(
    'SELECT id, email, phone FROM accounts WHERE id = ?',
    [userId]
  );
  return rows[0] || null;
};

const getOrCreateCustomerId = async (accountId, connection) => {
  const [existing] = await run(connection).query(
    'SELECT id FROM customers WHERE accountId = ?',
    [accountId]
  );

  if (existing.length > 0) {
    return existing[0].id;
  }

  const account = await getAccountById(accountId, connection);
  if (!account) {
    return null;
  }

  const [result] = await run(connection).query(
    'INSERT INTO customers (accountId, fullName, phone) VALUES (?, ?, ?)',
    [accountId, account.email, account.phone]
  );

  return result.insertId;
};

const getRoomWithType = async (roomId, connection, lock = false) => {
  const [rows] = await run(connection).query(
    `
      SELECT
        r.id,
        r.roomTypeId,
        r.roomNumber,
        r.floor,
        r.area,
        r.status,
        rt.typeName AS room_type_name,
        rt.defaultPrice AS price_per_night,
        rt.capacity
      FROM rooms r
      JOIN room_types rt ON rt.id = r.roomTypeId
      WHERE r.id = ?
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [roomId]
  );
  return rows[0] || null;
};

const expireUnpaidBookingHolds = async (connection) => {
  await run(connection).query(
    `
      UPDATE bookings b
      JOIN payments p ON p.bookingId = b.id
      SET b.status = 'cancelled',
          b.bookingStatus = 'cancelled'
      WHERE b.status IN ('pending', 'confirmed')
        AND p.paymentStatus = 'unpaid'
        AND COALESCE(p.paidAmount, 0) <= 0
        AND b.created_at < DATE_SUB(NOW(), INTERVAL ${HOLD_MINUTES} MINUTE)
    `
  );
};

const getSecuredConflictingBookings = async (
  roomId,
  checkIn,
  checkOut,
  connection,
  lock = false,
  { excludeBookingId } = {}
) => {
  const values = [roomId, checkOut, checkIn];
  const excludeClause = excludeBookingId ? 'AND b.id != ?' : '';
  if (excludeBookingId) {
    values.push(excludeBookingId);
  }

  const [rows] = await run(connection).query(
    `
      SELECT b.id, b.status, COALESCE(bd.checkInDate, b.check_in) AS checkInDate,
             COALESCE(bd.checkOutDate, b.check_out) AS checkOutDate,
             b.created_at,
             COALESCE(p.paymentStatus, 'unpaid') AS paymentStatus,
             COALESCE(p.paidAmount, 0) AS paidAmount
      FROM bookings b
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      LEFT JOIN payments p ON p.id = (
        SELECT p2.id
        FROM payments p2
        WHERE p2.bookingId = b.id
        ORDER BY p2.id DESC
        LIMIT 1
      )
      WHERE COALESCE(bd.roomId, b.room_id) = ?
        AND b.status IN ('pending', 'confirmed', 'checked_in')
        AND DATE(COALESCE(bd.checkInDate, b.check_in)) < ?
        AND DATE(COALESCE(bd.checkOutDate, b.check_out)) > ?
        ${excludeClause}
        AND (
          b.status = 'checked_in'
          OR p.paymentStatus = 'paid'
          OR COALESCE(p.paidAmount, 0) > 0
        )
      ${lock ? 'FOR UPDATE' : ''}
    `,
    values
  );
  return rows;
};

const getConflictingBookings = async (
  roomId,
  checkIn,
  checkOut,
  connection,
  lock = false,
  { excludeBookingId } = {}
) => {
  const values = [roomId, checkOut, checkIn];
  const excludeClause = excludeBookingId ? 'AND b.id != ?' : '';
  if (excludeBookingId) {
    values.push(excludeBookingId);
  }

  const [rows] = await run(connection).query(
    `
      SELECT b.id, b.status, COALESCE(bd.checkInDate, b.check_in) AS checkInDate,
             COALESCE(bd.checkOutDate, b.check_out) AS checkOutDate,
             b.created_at,
             COALESCE(p.paymentStatus, 'unpaid') AS paymentStatus
      FROM bookings b
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      LEFT JOIN payments p ON p.id = (
        SELECT p2.id
        FROM payments p2
        WHERE p2.bookingId = b.id
        ORDER BY p2.id DESC
        LIMIT 1
      )
      WHERE COALESCE(bd.roomId, b.room_id) = ?
        AND b.status IN ('pending', 'confirmed', 'checked_in')
        AND DATE(COALESCE(bd.checkInDate, b.check_in)) < ?
        AND DATE(COALESCE(bd.checkOutDate, b.check_out)) > ?
        ${excludeClause}
        AND (
          b.status = 'checked_in'
          OR p.paymentStatus = 'paid'
          OR COALESCE(p.paidAmount, 0) > 0
          OR (
            COALESCE(p.paymentStatus, 'unpaid') = 'unpaid'
            AND COALESCE(p.paidAmount, 0) <= 0
            AND b.created_at >= DATE_SUB(NOW(), INTERVAL ${HOLD_MINUTES} MINUTE)
          )
        )
      ${lock ? 'FOR UPDATE' : ''}
    `,
    values
  );
  return rows;
};

const cancelCompetingUnpaidBookings = async (
  roomId,
  checkIn,
  checkOut,
  excludeBookingId,
  connection
) => {
  await run(connection).query(
    `
      UPDATE bookings b
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      JOIN payments p ON p.bookingId = b.id
      SET b.status = 'cancelled',
          b.bookingStatus = 'cancelled'
      WHERE COALESCE(bd.roomId, b.room_id) = ?
        AND b.id != ?
        AND b.status IN ('pending', 'confirmed')
        AND DATE(COALESCE(bd.checkInDate, b.check_in)) < ?
        AND DATE(COALESCE(bd.checkOutDate, b.check_out)) > ?
        AND p.paymentStatus = 'unpaid'
        AND COALESCE(p.paidAmount, 0) <= 0
    `,
    [roomId, excludeBookingId, checkOut, checkIn]
  );
};

const listAvailableRoomsByType = async (roomTypeId, checkIn, checkOut, connection, lock = false) => {
  await expireUnpaidBookingHolds(connection);

  const [rooms] = await run(connection).query(
    `
      SELECT
        r.id,
        r.roomNumber,
        r.roomTypeId,
        rt.typeName AS room_type_name,
        rt.defaultPrice AS price_per_night,
        rt.capacity
      FROM rooms r
      JOIN room_types rt ON rt.id = r.roomTypeId
      WHERE r.roomTypeId = ?
        AND r.status != 'maintenance'
        AND NOT EXISTS (
          SELECT 1
          FROM bookings b
          LEFT JOIN booking_details bd ON bd.bookingId = b.id
          LEFT JOIN payments p ON p.id = (
            SELECT p2.id
            FROM payments p2
            WHERE p2.bookingId = b.id
            ORDER BY p2.id DESC
            LIMIT 1
          )
          WHERE COALESCE(bd.roomId, b.room_id) = r.id
            AND b.status IN ('pending', 'confirmed', 'checked_in')
            AND DATE(COALESCE(bd.checkInDate, b.check_in)) < ?
            AND DATE(COALESCE(bd.checkOutDate, b.check_out)) > ?
            AND (
              b.status = 'checked_in'
              OR p.paymentStatus = 'paid'
              OR COALESCE(p.paidAmount, 0) > 0
              OR (
                COALESCE(p.paymentStatus, 'unpaid') = 'unpaid'
                AND COALESCE(p.paidAmount, 0) <= 0
                AND b.created_at >= DATE_SUB(NOW(), INTERVAL ${HOLD_MINUTES} MINUTE)
              )
            )
        )
      ORDER BY r.id ASC
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [roomTypeId, checkOut, checkIn]
  );

  return rooms;
};

const listRoomTypeAvailability = async (checkIn, checkOut, connection) => {
  await expireUnpaidBookingHolds(connection);

  const [roomTypes] = await run(connection).query(
    `
      SELECT id, typeName AS room_type_name, defaultPrice AS price_per_night, capacity
      FROM room_types
      ORDER BY id ASC
    `
  );

  const result = [];
  for (const roomType of roomTypes) {
    const rooms = await listAvailableRoomsByType(roomType.id, checkIn, checkOut, connection);
    result.push({
      ...roomType,
      availableRooms: rooms.length,
      roomIds: rooms.map((room) => room.id)
    });
  }

  return result;
};

const getBookedAvailabilityRows = async () => [];

const createBooking = async (payload, totalPrice, connection) => {
  const account = await getAccountById(payload.userId, connection);
  if (!account) {
    throw new Error('Customer not found');
  }

  const customerId = await getOrCreateCustomerId(payload.userId, connection);

  const bookingStatus = payload.status === 'pending' ? 'pending' : 'confirmed';

  const [result] = await run(connection).query(
    `
      INSERT INTO bookings (user_id, customerId, room_id, check_in, check_out, total_price, totalAmount, status, bookingStatus, notes, guest_name, guest_email, guest_phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.userId,
      customerId,
      payload.roomId,
      payload.checkIn,
      payload.checkOut,
      totalPrice,
      totalPrice,
      bookingStatus,
      bookingStatus,
      payload.notes || null,
      payload.guestName || null,
      payload.guestEmail || null,
      payload.guestPhone || null
    ]
  );

  return result.insertId;
};

const createBookingDetail = async (bookingId, payload, roomPrice, occupancySurcharge = 0, connection) => {
  await run(connection).query(
    `
      INSERT INTO booking_details
        (bookingId, roomId, checkInDate, checkOutDate, adults, children, roomPrice, occupancySurcharge)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      bookingId,
      payload.roomId,
      payload.checkIn,
      payload.checkOut,
      payload.adults,
      payload.children,
      roomPrice,
      occupancySurcharge
    ]
  );
};

const upsertAvailabilityRows = async () => {};

const getServiceById = async (serviceId, connection) => {
  const [rows] = await run(connection).query(
    'SELECT id, serviceName, price FROM services WHERE id = ?',
    [serviceId]
  );
  return rows[0] || null;
};

const addBookingService = async (bookingId, service, quantity, connection) => {
  const totalPrice = Number(service.price) * quantity;
  const [result] = await run(connection).query(
    `
      INSERT INTO booking_services (bookingId, serviceId, quantity, totalPrice)
      VALUES (?, ?, ?, ?)
    `,
    [bookingId, service.id, quantity, totalPrice]
  );

  return result.insertId;
};

const sumBookingServices = async (bookingId, connection) => {
  const [[row]] = await run(connection).query(
    'SELECT COALESCE(SUM(totalPrice), 0) AS total FROM booking_services WHERE bookingId = ?',
    [bookingId]
  );
  return Number(row?.total || 0);
};

const createCustomerNotification = async (accountId, title, content, connection) => {
  if (!accountId) return null;

  const [result] = await run(connection).query(
    `
      INSERT INTO notifications (accountId, title, content, isRead)
      VALUES (?, ?, ?, 0)
    `,
    [accountId, title, content]
  );
  return result.insertId;
};

const replaceBookingGuests = async (bookingId, guests, connection) => {
  await run(connection).query('DELETE FROM booking_guests WHERE bookingId = ?', [bookingId]);

  for (const guest of guests) {
    await run(connection).query(
      `
        INSERT INTO booking_guests (bookingId, fullName, identityNumber, phone, note)
        VALUES (?, ?, ?, ?, ?)
      `,
      [bookingId, guest.fullName, guest.identityNumber, guest.phone || null, guest.note || null]
    );
  }
};

const addDamageCharge = async (bookingId, roomId, payload, connection) => {
  const totalPrice = payload.quantity * payload.unitPrice;
  const [result] = await run(connection).query(
    `
      INSERT INTO booking_damage_charges
        (bookingId, roomId, itemName, quantity, unitPrice, totalPrice, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      bookingId,
      roomId,
      payload.itemName,
      payload.quantity,
      payload.unitPrice,
      totalPrice,
      payload.note || null
    ]
  );

  return { id: result.insertId, totalPrice };
};

const sumDamageCharges = async (bookingId, connection) => {
  const [[row]] = await run(connection).query(
    'SELECT COALESCE(SUM(totalPrice), 0) AS total FROM booking_damage_charges WHERE bookingId = ?',
    [bookingId]
  );
  return Number(row?.total || 0);
};

const updateBookingStay = async (bookingId, checkOut, totalPrice, connection, occupancySurcharge = null) => {
  // Cột legacy totalAmount phải bao gồm cả tiền dịch vụ (lúc tạo booking nó được
  // ghi bằng total_price + serviceAmount). Ghi đè bằng riêng tiền phòng sẽ làm
  // cột này thiếu tiền dịch vụ và lệch với payments.totalAmount.
  const serviceAmount = await sumBookingServices(bookingId, connection);

  await run(connection).query(
    'UPDATE bookings SET check_out = ?, total_price = ?, totalAmount = ? WHERE id = ?',
    [checkOut, totalPrice, Number(totalPrice) + serviceAmount, bookingId]
  );

  if (occupancySurcharge != null) {
    await run(connection).query(
      'UPDATE booking_details SET checkOutDate = ?, occupancySurcharge = ? WHERE bookingId = ?',
      [checkOut, occupancySurcharge, bookingId]
    );
    return;
  }

  await run(connection).query(
    'UPDATE booking_details SET checkOutDate = ? WHERE bookingId = ?',
    [checkOut, bookingId]
  );
};

const transferBookingRoom = async (booking, toRoom, payload, connection) => {
  await run(connection).query(
    `
      INSERT INTO booking_room_transfers
        (bookingId, fromRoomId, toRoomId, fromDate, toDate, pricePerNight, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      booking.id,
      booking.room_id,
      toRoom.id,
      payload.fromDate,
      payload.toDate,
      Number(toRoom.price_per_night || 0),
      payload.reason || null
    ]
  );

  await run(connection).query(
    'UPDATE bookings SET room_id = ? WHERE id = ?',
    [toRoom.id, booking.id]
  );

  await run(connection).query(
    'UPDATE booking_details SET roomId = ?, roomPrice = ? WHERE bookingId = ?',
    [toRoom.id, Number(toRoom.price_per_night || 0), booking.id]
  );
};

// Các khoảng giá theo mùa/thời điểm của một loại phòng (bảng room_prices)
const listRoomPriceRanges = async (roomTypeId, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT startDate, endDate, price, priceType
      FROM room_prices
      WHERE roomTypeId = ?
      ORDER BY DATEDIFF(endDate, startDate) ASC, id DESC
    `,
    [roomTypeId]
  );
  return rows;
};

const getBookingById = async (bookingId, connection, lock = false) => {
  const [rows] = await run(connection).query(
    `${BOOKING_SELECT} WHERE b.id = ? ${lock ? 'FOR UPDATE' : ''}`,
    [bookingId]
  );
  return rows[0] || null;
};

const listBookings = async ({ userId, status } = {}) => {
  const conditions = [];
  const values = [];

  if (userId) {
    conditions.push('b.user_id = ?');
    values.push(userId);
  }

  if (status) {
    conditions.push('b.status = ?');
    values.push(status);
  }

  const [rows] = await db.query(
    `
      ${BOOKING_SELECT}
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY b.created_at DESC
    `,
    values
  );
  return rows;
};

const updateBookingStatus = async (bookingId, status, connection) => {
  await run(connection).query(
    'UPDATE bookings SET status = ?, bookingStatus = ? WHERE id = ?',
    [status, status, bookingId]
  );
};

const releaseAvailabilityByBooking = async () => {};

const updateRoomStatus = async (roomId, status, connection) => {
  await run(connection).query(
    'UPDATE rooms SET status = ? WHERE id = ?',
    [status, roomId]
  );
};

// Lưu giá đã chốt của từng đêm. Gọi lúc đặt phòng và khi gia hạn thêm đêm.
const saveNightlyPrices = async (bookingId, prices, connection) => {
  if (!Array.isArray(prices) || prices.length === 0) return;

  const values = prices.map((item) => [bookingId, item.date, item.price]);
  await run(connection).query(
    `INSERT INTO booking_nightly_prices (bookingId, stayDate, price)
     VALUES ?
     ON DUPLICATE KEY UPDATE price = VALUES(price)`,
    [values]
  );
};

// Giá đã chốt của các đêm trong khoảng [from, to). Trả mảng rỗng với những
// booking tạo trước khi có bảng này để nơi gọi tự tính lại như cũ.
const listNightlyPrices = async (bookingId, from, to, connection) => {
  const [rows] = await run(connection).query(
    `SELECT stayDate, price
     FROM booking_nightly_prices
     WHERE bookingId = ? AND stayDate >= ? AND stayDate < ?
     ORDER BY stayDate ASC`,
    [bookingId, from, to]
  );
  return rows;
};

// Ghi một dòng dấu vết vào lịch sử thao tác của đặt phòng.
// entry: { action, description, oldValue, newValue, amount, actorId, actorName, actorRole }
const addBookingHistory = async (bookingId, entry, connection) => {
  const [result] = await run(connection).query(
    `
      INSERT INTO booking_history
        (bookingId, action, description, oldValue, newValue, amount, performedBy, performedByName, performedByRole)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      bookingId,
      entry.action,
      entry.description || null,
      entry.oldValue != null ? JSON.stringify(entry.oldValue) : null,
      entry.newValue != null ? JSON.stringify(entry.newValue) : null,
      entry.amount != null ? entry.amount : null,
      entry.actorId || null,
      entry.actorName || null,
      entry.actorRole || 'system'
    ]
  );
  return result.insertId;
};

const listBookingHistory = async (bookingId, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT id, bookingId, action, description, oldValue, newValue, amount,
             performedBy, performedByName, performedByRole, createdAt
      FROM booking_history
      WHERE bookingId = ?
      ORDER BY createdAt DESC, id DESC
    `,
    [bookingId]
  );
  return rows.map((row) => {
    let oldValue = null;
    let newValue = null;
    try { oldValue = row.oldValue ? JSON.parse(row.oldValue) : null; } catch { oldValue = row.oldValue; }
    try { newValue = row.newValue ? JSON.parse(row.newValue) : null; } catch { newValue = row.newValue; }
    return { ...row, oldValue, newValue };
  });
};

// Lấy tên hiển thị của người thực hiện thao tác từ tài khoản.
const getActorDisplayName = async (accountId, connection) => {
  if (!accountId) return null;
  const [rows] = await run(connection).query(
    `
      SELECT COALESCE(NULLIF(e.fullName, ''), NULLIF(c.fullName, ''), NULLIF(a.full_name, ''), a.email) AS name
      FROM accounts a
      LEFT JOIN customers c ON c.accountId = a.id
      LEFT JOIN employees e ON e.accountId = a.id
      WHERE a.id = ?
      LIMIT 1
    `,
    [accountId]
  );
  return rows[0]?.name || null;
};

const listEligibleNoShowBookings = async (connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT
        b.id,
        b.user_id,
        b.room_id,
        b.status,
        DATE(COALESCE(bd.checkInDate, b.check_in)) AS check_in,
        COALESCE(p.paidAmount, 0) AS paid_amount,
        COALESCE(p.paymentStatus, 'unpaid') AS payment_status
      FROM bookings b
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      JOIN payments p ON p.bookingId = b.id
      WHERE b.status = 'confirmed'
        AND COALESCE(p.paidAmount, 0) > 0
        AND NOW() > DATE_ADD(DATE(COALESCE(bd.checkInDate, b.check_in)), INTERVAL 1 DAY) + INTERVAL ${LATE_CHECKIN_GRACE_HOUR} HOUR
    `
  );
  return rows;
};

module.exports = {
  getAccountById,
  getOrCreateCustomerId,
  getRoomWithType,
  expireUnpaidBookingHolds,
  getSecuredConflictingBookings,
  getConflictingBookings,
  cancelCompetingUnpaidBookings,
  listAvailableRoomsByType,
  listRoomTypeAvailability,
  listRoomPriceRanges,
  getBookedAvailabilityRows,
  createBooking,
  createBookingDetail,
  upsertAvailabilityRows,
  getServiceById,
  addBookingService,
  sumBookingServices,
  createCustomerNotification,
  replaceBookingGuests,
  addDamageCharge,
  sumDamageCharges,
  updateBookingStay,
  transferBookingRoom,
  saveNightlyPrices,
  listNightlyPrices,
  addBookingHistory,
  listBookingHistory,
  getActorDisplayName,
  getBookingById,
  listBookings,
  updateBookingStatus,
  releaseAvailabilityByBooking,
  updateRoomStatus,
  listEligibleNoShowBookings
};

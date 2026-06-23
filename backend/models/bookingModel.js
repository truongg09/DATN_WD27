const db = require('../config/db');

const run = (connection) => connection || db;

const BOOKING_SELECT = `
  SELECT
    b.id,
    b.user_id,
    b.status,
    b.total_price,
    b.created_at,
    b.notes,
    bd.id AS detail_id,
    bd.roomId AS room_id,
    DATE(COALESCE(bd.checkInDate, b.check_in)) AS check_in,
    DATE(COALESCE(bd.checkOutDate, b.check_out)) AS check_out,
    bd.adults,
    bd.children,
    bd.roomPrice AS room_price,
    COALESCE(b.guest_name, c.fullName) AS customer_name,
    COALESCE(b.guest_email, a.email) AS customer_email,
    COALESCE(b.guest_phone, c.phone, a.phone) AS customer_phone,
    r.roomNumber AS room_number,
    rt.typeName AS room_type_name,
    rt.defaultPrice AS price_per_night
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

const getConflictingBookings = async (roomId, checkIn, checkOut, connection, lock = false) => {
  const [rows] = await run(connection).query(
    `
      SELECT b.id, b.status, COALESCE(bd.checkInDate, b.check_in) AS checkInDate,
             COALESCE(bd.checkOutDate, b.check_out) AS checkOutDate
      FROM bookings b
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      WHERE COALESCE(bd.roomId, b.room_id) = ?
        AND b.status IN ('pending', 'confirmed', 'checked_in')
        AND DATE(COALESCE(bd.checkInDate, b.check_in)) < ?
        AND DATE(COALESCE(bd.checkOutDate, b.check_out)) > ?
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [roomId, checkOut, checkIn]
  );
  return rows;
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

const createBookingDetail = async (bookingId, payload, roomPrice, connection) => {
  await run(connection).query(
    `
      INSERT INTO booking_details
        (bookingId, roomId, checkInDate, checkOutDate, adults, children, roomPrice)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      bookingId,
      payload.roomId,
      payload.checkIn,
      payload.checkOut,
      payload.adults,
      payload.children,
      roomPrice
    ]
  );
};

const upsertAvailabilityRows = async () => {};

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
    'UPDATE bookings SET status = ? WHERE id = ?',
    [status, bookingId]
  );
};

const releaseAvailabilityByBooking = async () => {};

const updateRoomStatus = async (roomId, status, connection) => {
  await run(connection).query(
    'UPDATE rooms SET status = ? WHERE id = ?',
    [status, roomId]
  );
};

module.exports = {
  getAccountById,
  getOrCreateCustomerId,
  getRoomWithType,
  getConflictingBookings,
  getBookedAvailabilityRows,
  createBooking,
  createBookingDetail,
  upsertAvailabilityRows,
  getBookingById,
  listBookings,
  updateBookingStatus,
  releaseAvailabilityByBooking,
  updateRoomStatus
};

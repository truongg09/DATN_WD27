const db = require('../config/db');

const run = (connection) => connection || db;

const BOOKING_SELECT = `
  SELECT
    b.id,
    b.customerId AS user_id,
    b.bookingCode AS booking_code,
    b.bookingStatus AS status,
    b.totalAmount AS total_price,
    b.createdAt AS created_at,
    bd.id AS detail_id,
    bd.roomId AS room_id,
    DATE(bd.checkInDate) AS check_in,
    DATE(bd.checkOutDate) AS check_out,
    bd.adults,
    bd.children,
    bd.roomPrice AS room_price,
    COALESCE(c.fullName, a.full_name) AS customer_name,
    a.email AS customer_email,
    COALESCE(c.phone, a.phone) AS customer_phone,
    r.roomNumber AS room_number,
    rt.typeName AS room_type_name,
    rt.defaultPrice AS price_per_night
  FROM bookings b
  JOIN booking_details bd ON bd.bookingId = b.id
  LEFT JOIN customers c ON c.id = b.customerId
  LEFT JOIN accounts a ON a.id = c.accountId
  JOIN rooms r ON r.id = bd.roomId
  JOIN room_types rt ON rt.id = r.roomTypeId
`;

const getAccountById = async (userId, connection) => {
  const [rows] = await run(connection).query(
    'SELECT id, full_name, email, phone FROM accounts WHERE id = ?',
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
    [accountId, account.full_name, account.phone]
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
      SELECT b.id, b.bookingStatus, bd.checkInDate, bd.checkOutDate
      FROM bookings b
      JOIN booking_details bd ON bd.bookingId = b.id
      WHERE bd.roomId = ?
        AND b.bookingStatus IN ('pending', 'confirmed', 'checkin')
        AND DATE(bd.checkInDate) < ?
        AND DATE(bd.checkOutDate) > ?
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [roomId, checkOut, checkIn]
  );
  return rows;
};

const getBookedAvailabilityRows = async () => [];

const generateBookingCode = async (connection) => {
  const [rows] = await run(connection).query('SELECT COUNT(*) AS count FROM bookings');
  const sequence = Number(rows[0].count) + 1;
  return `BK${String(sequence).padStart(5, '0')}`;
};

const createBooking = async (payload, totalPrice, connection) => {
  const customerId = await getOrCreateCustomerId(payload.userId, connection);
  if (!customerId) {
    throw new Error('Customer not found');
  }

  const bookingCode = await generateBookingCode(connection);
  const bookingStatus = payload.status === 'pending' ? 'pending' : 'confirmed';

  const [result] = await run(connection).query(
    `
      INSERT INTO bookings (customerId, bookingCode, bookingStatus, totalAmount, createdAt)
      VALUES (?, ?, ?, ?, NOW())
    `,
    [customerId, bookingCode, bookingStatus, totalPrice]
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
    conditions.push('c.accountId = ?');
    values.push(userId);
  }

  if (status) {
    conditions.push('b.bookingStatus = ?');
    values.push(status);
  }

  const [rows] = await db.query(
    `
      ${BOOKING_SELECT}
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY b.createdAt DESC
    `,
    values
  );
  return rows;
};

const updateBookingStatus = async (bookingId, status, connection) => {
  await run(connection).query(
    'UPDATE bookings SET bookingStatus = ? WHERE id = ?',
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

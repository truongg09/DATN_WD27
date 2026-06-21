const db = require('../config/db');

const run = (connection) => connection || db;

const getAccountById = async (userId, connection) => {
  const [rows] = await run(connection).query(
    'SELECT id, full_name, email, phone FROM accounts WHERE id = ?',
    [userId]
  );
  return rows[0] || null;
};

const getRoomWithType = async (roomId, connection, lock = false) => {
  const [rows] = await run(connection).query(
    `
      SELECT r.*, rt.name AS room_type_name, rt.price_per_night, rt.capacity
      FROM rooms r
      JOIN room_types rt ON rt.id = r.room_type_id
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
      SELECT id, status, check_in, check_out
      FROM bookings
      WHERE room_id = ?
        AND status IN ('pending', 'confirmed', 'checked_in')
        AND check_in < ?
        AND check_out > ?
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [roomId, checkOut, checkIn]
  );
  return rows;
};

const getBookedAvailabilityRows = async (roomId, checkIn, checkOut, connection, lock = false) => {
  const [rows] = await run(connection).query(
    `
      SELECT id, booking_id, date, status
      FROM room_availability
      WHERE room_id = ?
        AND date >= ?
        AND date < ?
        AND status = 'booked'
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [roomId, checkIn, checkOut]
  );
  return rows;
};

const createBooking = async (payload, totalPrice, connection) => {
  const [result] = await run(connection).query(
    `
      INSERT INTO bookings (user_id, room_id, check_in, check_out, total_price, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.userId,
      payload.roomId,
      payload.checkIn,
      payload.checkOut,
      totalPrice,
      payload.status,
      payload.notes
    ]
  );
  return result.insertId;
};

const createBookingDetail = async (bookingId, payload, roomPrice, connection) => {
  await run(connection).query(
    `
      INSERT INTO booking_details
        (booking_id, room_id, check_in_date, check_out_date, adults, children, room_price)
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

const upsertAvailabilityRows = async (roomId, bookingId, dates, connection) => {
  if (dates.length === 0) {
    return;
  }

  const values = dates.map((date) => [roomId, bookingId, date, 'booked']);
  await run(connection).query(
    `
      INSERT INTO room_availability (room_id, booking_id, date, status)
      VALUES ?
      ON DUPLICATE KEY UPDATE booking_id = VALUES(booking_id), status = VALUES(status)
    `,
    [values]
  );
};

const getBookingById = async (bookingId, connection, lock = false) => {
  const [rows] = await run(connection).query(
    `
      SELECT
        b.*,
        a.full_name AS customer_name,
        a.email AS customer_email,
        a.phone AS customer_phone,
        r.room_number,
        rt.name AS room_type_name,
        rt.price_per_night,
        bd.id AS detail_id,
        bd.check_in_date,
        bd.check_out_date,
        bd.adults,
        bd.children,
        bd.room_price
      FROM bookings b
      JOIN accounts a ON a.id = b.user_id
      JOIN rooms r ON r.id = b.room_id
      JOIN room_types rt ON rt.id = r.room_type_id
      LEFT JOIN booking_details bd ON bd.booking_id = b.id
      WHERE b.id = ?
      ${lock ? 'FOR UPDATE' : ''}
    `,
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
      SELECT
        b.*,
        a.full_name AS customer_name,
        r.room_number,
        rt.name AS room_type_name,
        bd.adults,
        bd.children
      FROM bookings b
      JOIN accounts a ON a.id = b.user_id
      JOIN rooms r ON r.id = b.room_id
      JOIN room_types rt ON rt.id = r.room_type_id
      LEFT JOIN booking_details bd ON bd.booking_id = b.id
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

const releaseAvailabilityByBooking = async (bookingId, connection) => {
  await run(connection).query(
    `
      UPDATE room_availability
      SET status = 'available', booking_id = NULL
      WHERE booking_id = ?
    `,
    [bookingId]
  );
};

const updateRoomStatus = async (roomId, status, connection) => {
  await run(connection).query(
    'UPDATE rooms SET status = ? WHERE id = ?',
    [status, roomId]
  );
};

module.exports = {
  getAccountById,
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

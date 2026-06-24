const db = require('../config/db');

const run = (connection) => connection || db;
const HOLD_MINUTES = 15;

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

const updateBookingStay = async (bookingId, checkOut, totalPrice, connection) => {
  await run(connection).query(
    'UPDATE bookings SET check_out = ?, total_price = ?, totalAmount = ? WHERE id = ?',
    [checkOut, totalPrice, totalPrice, bookingId]
  );

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
  expireUnpaidBookingHolds,
  getConflictingBookings,
  listAvailableRoomsByType,
  listRoomTypeAvailability,
  getBookedAvailabilityRows,
  createBooking,
  createBookingDetail,
  upsertAvailabilityRows,
  getServiceById,
  addBookingService,
  sumBookingServices,
  replaceBookingGuests,
  addDamageCharge,
  sumDamageCharges,
  updateBookingStay,
  transferBookingRoom,
  getBookingById,
  listBookings,
  updateBookingStatus,
  releaseAvailabilityByBooking,
  updateRoomStatus
};

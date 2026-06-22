const db = require('../config/db');

const run = (connection) => connection || db;

const PAYMENT_SELECT = `
  SELECT
    p.*,
    b.bookingStatus AS booking_status,
    COALESCE(c.fullName, a.full_name) AS customer_name,
    r.roomNumber AS room_number
  FROM payments p
  JOIN bookings b ON b.id = p.bookingId
  LEFT JOIN customers c ON c.id = b.customerId
  LEFT JOIN accounts a ON a.id = c.accountId
  LEFT JOIN booking_details bd ON bd.bookingId = b.id
  LEFT JOIN rooms r ON r.id = bd.roomId
`;

const createPayment = async (payload, connection) => {
  const [result] = await run(connection).query(
    `
      INSERT INTO payments (
        bookingId,
        roomAmount,
        serviceAmount,
        surchargeAmount,
        discountAmount,
        depositAmount,
        paidAmount,
        remainingAmount,
        totalAmount,
        paymentMethod,
        paymentStatus
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.bookingId,
      payload.roomAmount,
      payload.serviceAmount,
      payload.surchargeAmount,
      payload.discountAmount,
      payload.depositAmount,
      payload.paidAmount,
      payload.remainingAmount,
      payload.totalAmount,
      payload.paymentMethod || null,
      payload.paymentStatus || 'unpaid'
    ]
  );
  return result.insertId;
};

const getPaymentById = async (paymentId, connection, lock = false) => {
  const [rows] = await run(connection).query(
    `${PAYMENT_SELECT} WHERE p.id = ? ${lock ? 'FOR UPDATE' : ''}`,
    [paymentId]
  );
  return rows[0] || null;
};

const getPaymentByBookingId = async (bookingId, connection) => {
  const [rows] = await run(connection).query(
    `${PAYMENT_SELECT} WHERE p.bookingId = ? ORDER BY p.id DESC LIMIT 1`,
    [bookingId]
  );
  return rows[0] || null;
};

const listPayments = async ({ bookingId, paymentStatus } = {}) => {
  const conditions = [];
  const values = [];

  if (bookingId) {
    conditions.push('p.bookingId = ?');
    values.push(bookingId);
  }

  if (paymentStatus) {
    conditions.push('p.paymentStatus = ?');
    values.push(paymentStatus);
  }

  const [rows] = await db.query(
    `
      ${PAYMENT_SELECT}
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY p.id DESC
    `,
    values
  );
  return rows;
};

const updatePayment = async (paymentId, fields, connection) => {
  const entries = Object.entries(fields);
  if (entries.length === 0) {
    return;
  }

  const setClause = entries.map(([key]) => `${key} = ?`).join(', ');
  const values = entries.map(([, value]) => value);

  await run(connection).query(
    `UPDATE payments SET ${setClause} WHERE id = ?`,
    [...values, paymentId]
  );
};

module.exports = {
  createPayment,
  getPaymentById,
  getPaymentByBookingId,
  listPayments,
  updatePayment
};

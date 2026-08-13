const db = require('../config/db');

const run = (connection) => connection || db;

const PAYMENT_SELECT = `
  SELECT
    p.*,
    b.status AS booking_status,
    COALESCE(b.guest_name, c.fullName, a.email) AS customer_name,
    (SELECT GROUP_CONCAT(DISTINCT r2.roomNumber ORDER BY r2.roomNumber SEPARATOR ', ')
       FROM booking_details bd2 JOIN rooms r2 ON r2.id = bd2.roomId
      WHERE bd2.bookingId = b.id) AS room_number,
    pcr.status AS verification_status,
    pcr.amount AS verification_amount,
    pcr.submittedAt AS verification_submitted_at,
    (SELECT pgo.orderId FROM payment_gateway_orders pgo WHERE pgo.paymentId = p.id ORDER BY pgo.id DESC LIMIT 1) AS gateway_order_id,
    (SELECT pgo.provider FROM payment_gateway_orders pgo WHERE pgo.paymentId = p.id ORDER BY pgo.id DESC LIMIT 1) AS gateway_provider,
    (SELECT pgo.status FROM payment_gateway_orders pgo WHERE pgo.paymentId = p.id ORDER BY pgo.id DESC LIMIT 1) AS gateway_status,
    (SELECT pgo.expiresAt FROM payment_gateway_orders pgo WHERE pgo.paymentId = p.id ORDER BY pgo.id DESC LIMIT 1) AS gateway_expires_at
  FROM payments p
  JOIN bookings b ON b.id = p.bookingId
  LEFT JOIN customers c ON c.accountId = b.user_id
  LEFT JOIN accounts a ON a.id = b.user_id
  LEFT JOIN payment_confirmation_requests pcr ON pcr.paymentId = p.id
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

const getPaymentByTransactionCode = async (transactionCode, connection) => {
  const [rows] = await run(connection).query(
    `${PAYMENT_SELECT} WHERE p.transactionCode = ? ORDER BY p.id DESC LIMIT 1`,
    [transactionCode]
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

const upsertConfirmationRequest = async ({ paymentId, bookingId, amount, paymentMethod, note }, connection) => {
  await run(connection).query(
    `
      INSERT INTO payment_confirmation_requests
        (paymentId, bookingId, amount, paymentMethod, status, note, submittedAt, confirmedBy, confirmedAt)
      VALUES (?, ?, ?, ?, 'pending', ?, NOW(), NULL, NULL)
      ON DUPLICATE KEY UPDATE
        amount = VALUES(amount), paymentMethod = VALUES(paymentMethod), status = 'pending',
        note = VALUES(note), submittedAt = NOW(), confirmedBy = NULL, confirmedAt = NULL
    `,
    [paymentId, bookingId, amount, paymentMethod, note || null]
  );
};

const getConfirmationRequest = async (paymentId, connection, lock = false) => {
  const [rows] = await run(connection).query(
    `SELECT * FROM payment_confirmation_requests WHERE paymentId = ? ${lock ? 'FOR UPDATE' : ''}`,
    [paymentId]
  );
  return rows[0] || null;
};

const confirmConfirmationRequest = async (paymentId, confirmedBy, connection) => {
  await run(connection).query(
    `UPDATE payment_confirmation_requests
     SET status = 'confirmed', confirmedBy = ?, confirmedAt = NOW()
     WHERE paymentId = ? AND status = 'pending'`,
    [confirmedBy || null, paymentId]
  );
};

const createGatewayOrder = async (payload, connection) => {
  await run(connection).query(
    "UPDATE payment_gateway_orders SET status = 'cancelled' WHERE paymentId = ? AND status = 'created'",
    [payload.paymentId]
  );
  await run(connection).query(
    `INSERT INTO payment_gateway_orders
       (paymentId, bookingId, provider, orderId, amount, expiresAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [payload.paymentId, payload.bookingId, payload.provider, payload.orderId, payload.amount, payload.expiresAt]
  );
};

const getGatewayOrder = async (orderId, connection, lock = false) => {
  const [rows] = await run(connection).query(
    `SELECT * FROM payment_gateway_orders WHERE orderId = ? ${lock ? 'FOR UPDATE' : ''}`,
    [orderId]
  );
  return rows[0] || null;
};

const updateGatewayOrderStatus = async (orderId, status, connection) => {
  await run(connection).query(
    `UPDATE payment_gateway_orders
        SET status = ?, paidAt = IF(? = 'paid', COALESCE(paidAt, NOW()), paidAt)
      WHERE orderId = ?`,
    [status, status, orderId]
  );
};

module.exports = {
  createPayment,
  getPaymentById,
  getPaymentByBookingId,
  getPaymentByTransactionCode,
  listPayments,
  updatePayment,
  upsertConfirmationRequest,
  getConfirmationRequest,
  confirmConfirmationRequest,
  createGatewayOrder,
  getGatewayOrder,
  updateGatewayOrderStatus
};

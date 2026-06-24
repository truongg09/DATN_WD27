const db = require('../config/db');

const run = (connection) => connection || db;

const INVOICE_SELECT = `
  SELECT
    i.*,
    b.customerId AS user_id,
    COALESCE(b.guest_name, c.fullName, a.email) AS customer_name,
    a.email AS customer_email,
    COALESCE(c.phone, a.phone) AS customer_phone,
    r.roomNumber AS room_number,
    rt.typeName AS room_type_name,
    DATE(bd.checkInDate) AS check_in,
    DATE(bd.checkOutDate) AS check_out
  FROM invoices i
  JOIN bookings b ON b.id = i.bookingId
  LEFT JOIN customers c ON c.id = b.customerId
  LEFT JOIN accounts a ON a.id = c.accountId
  LEFT JOIN booking_details bd ON bd.bookingId = b.id
  LEFT JOIN rooms r ON r.id = bd.roomId
  LEFT JOIN room_types rt ON rt.id = r.roomTypeId
`;

const createInvoice = async (payload, connection) => {
  const [result] = await run(connection).query(
    `
      INSERT INTO invoices (
        bookingId,
        paymentId,
        invoiceCode,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        status,
        invoiceDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      payload.bookingId,
      payload.paymentId,
      payload.invoiceCode,
      payload.subtotal,
      payload.discountAmount,
      payload.taxAmount || 0,
      payload.totalAmount,
      payload.status || 'issued'
    ]
  );
  return result.insertId;
};

const getInvoiceById = async (invoiceId) => {
  const [rows] = await db.query(`${INVOICE_SELECT} WHERE i.id = ?`, [invoiceId]);
  return rows[0] || null;
};

const getInvoiceByNumber = async (invoiceCode) => {
  const [rows] = await db.query(`${INVOICE_SELECT} WHERE i.invoiceCode = ?`, [invoiceCode]);
  return rows[0] || null;
};

const getInvoiceByBookingId = async (bookingId) => {
  const [rows] = await db.query(
    `${INVOICE_SELECT} WHERE i.bookingId = ? ORDER BY i.invoiceDate DESC LIMIT 1`,
    [bookingId]
  );
  return rows[0] || null;
};

const listInvoices = async ({ userId, bookingId, status } = {}) => {
  const conditions = [];
  const values = [];

  if (userId) {
    conditions.push('c.accountId = ?');
    values.push(userId);
  }

  if (bookingId) {
    conditions.push('i.bookingId = ?');
    values.push(bookingId);
  }

  if (status) {
    conditions.push('i.status = ?');
    values.push(status);
  }

  const [rows] = await db.query(
    `
      ${INVOICE_SELECT}
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY i.invoiceDate DESC
    `,
    values
  );
  return rows;
};

const getNextInvoiceSequence = async (connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT COUNT(*) AS count
      FROM invoices
      WHERE YEAR(invoiceDate) = YEAR(CURRENT_DATE())
        AND MONTH(invoiceDate) = MONTH(CURRENT_DATE())
    `
  );
  return Number(rows[0].count) + 1;
};

module.exports = {
  createInvoice,
  getInvoiceById,
  getInvoiceByNumber,
  getInvoiceByBookingId,
  listInvoices,
  getNextInvoiceSequence
};

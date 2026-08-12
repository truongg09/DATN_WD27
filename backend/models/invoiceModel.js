const db = require('../config/db');

const run = (connection) => connection || db;

const INVOICE_SELECT = `
  SELECT
    i.*,
    MAX(p.depositAmount) AS deposit_amount,
    MAX(p.paidAmount) AS paid_amount,
    MAX(p.remainingAmount) AS remaining_amount,
    MAX(p.paymentStatus) AS payment_status,
    MAX(p.paymentMethod) AS payment_method,
    MAX(b.customerId) AS user_id,
    COALESCE(MAX(b.guest_name), MAX(c.fullName), MAX(a.email)) AS customer_name,
    MAX(a.email) AS customer_email,
    COALESCE(MAX(b.guest_phone), MAX(c.phone), MAX(a.phone)) AS customer_phone,
    MIN(r.roomNumber) AS room_number,
    MIN(rt.typeName) AS room_type_name,
    COUNT(DISTINCT bd.id) AS room_quantity,
    DATE(MIN(bd.checkInDate)) AS check_in,
    DATE(MIN(bd.checkOutDate)) AS check_out,
    SUM(COALESCE(bd.occupancySurcharge, 0)) AS occupancy_surcharge,
    SUM(COALESCE(bd.children, 0)) AS children_count,
    COALESCE(
      SUM(bd.roomPrice * GREATEST(DATEDIFF(bd.checkOutDate, bd.checkInDate), 1)),
      0
    ) AS stay_room_amount
  FROM invoices i
  LEFT JOIN payments p ON p.id = i.paymentId
  JOIN bookings b ON b.id = i.bookingId
  LEFT JOIN customers c ON c.id = b.customerId
  LEFT JOIN accounts a ON a.id = c.accountId
  LEFT JOIN booking_details bd ON bd.bookingId = b.id
  LEFT JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
  LEFT JOIN room_types rt ON rt.id = r.roomTypeId
`;

const createInvoice = async (payload, connection) => {
  const [result] = await run(connection).query(
    `
      INSERT INTO invoices (
        bookingId,
        paymentId,
        invoiceCode,
        roomAmount,
        serviceAmount,
        surchargeAmount,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        status,
        invoiceDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.bookingId,
      payload.paymentId,
      payload.invoiceCode,
      payload.roomAmount,
      payload.serviceAmount,
      payload.surchargeAmount,
      payload.subtotal,
      payload.discountAmount,
      payload.taxAmount || 0,
      payload.totalAmount,
      payload.status || 'issued',
      payload.invoiceDate || new Date()
    ]
  );
  return result.insertId;
};

const updateInvoiceAmounts = async (invoiceId, fields, connection) => {
  const entries = Object.entries(fields);
  if (entries.length === 0) return;
  const setClause = entries.map(([key]) => `${key} = ?`).join(', ');
  const values = entries.map(([, value]) => value);
  await run(connection).query(
    `UPDATE invoices SET ${setClause} WHERE id = ?`,
    [...values, invoiceId]
  );
};

const getInvoiceById = async (invoiceId, connection) => {
  const [rows] = await run(connection).query(`${INVOICE_SELECT} WHERE i.id = ? GROUP BY i.id`, [invoiceId]);
  return rows[0] || null;
};

const getInvoiceByNumber = async (invoiceNumber, connection) => {
  const [rows] = await run(connection).query(`${INVOICE_SELECT} WHERE i.invoiceCode = ? GROUP BY i.id`, [invoiceNumber]);
  return rows[0] || null;
};

const getInvoiceByBookingId = async (bookingId, connection) => {
  const [rows] = await run(connection).query(
    `${INVOICE_SELECT} WHERE i.bookingId = ? GROUP BY i.id ORDER BY i.id DESC LIMIT 1`,
    [bookingId]
  );
  return rows[0] || null;
};

const listInvoiceServices = async (bookingId, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT
        bs.serviceId AS serviceId,
        s.serviceName AS serviceName,
        bs.quantity AS quantity,
        bs.unitPrice AS unitPrice,
        bs.totalPrice
      FROM booking_services bs
      JOIN services s ON s.id = bs.serviceId
      WHERE bs.bookingId = ? AND bs.status = 'used'
      ORDER BY bs.id ASC
    `,
    [bookingId]
  );
  return rows;
};

const listInvoiceDamages = async (bookingId, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT
        bdc.id,
        bdc.roomId,
        r.roomNumber,
        COALESCE(bdc.chargeType, 'damage') AS chargeType,
        bdc.itemName,
        bdc.quantity,
        bdc.unitPrice,
        bdc.totalPrice,
        bdc.note
      FROM booking_damage_charges bdc
      LEFT JOIN rooms r ON r.id = bdc.roomId
      WHERE bdc.bookingId = ? AND COALESCE(bdc.status, 'used') = 'used'
      ORDER BY bdc.id ASC
    `,
    [bookingId]
  );
  return rows;
};

const listInvoiceRooms = async (bookingId, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT
        bd.id AS bookingDetailId,
        bd.roomId AS id,
        r.roomNumber AS number,
        bd.roomTypeId AS roomTypeId,
        rt.typeName AS typeName,
        bd.roomPrice AS roomPrice
      FROM booking_details bd
      JOIN rooms r ON r.id = bd.roomId
      LEFT JOIN room_types rt ON rt.id = bd.roomTypeId
      WHERE bd.bookingId = ?
      ORDER BY bd.id ASC
    `,
    [bookingId]
  );
  return rows;
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
      GROUP BY i.id
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
  updateInvoiceAmounts,
  getInvoiceById,
  getInvoiceByNumber,
  getInvoiceByBookingId,
  listInvoiceServices,
  listInvoiceDamages,
  listInvoiceRooms,
  listInvoices,
  getNextInvoiceSequence
};

const db = require('../config/db');

const run = (connection) => connection || db;

const INVOICE_SELECT = `
  SELECT
    i.*,
    p.depositAmount AS deposit_amount,
    p.paidAmount AS paid_amount,
    p.remainingAmount AS remaining_amount,
    b.customerId AS user_id,
    COALESCE(b.guest_name, c.fullName, a.email) AS customer_name,
    a.email AS customer_email,
    COALESCE(c.phone, a.phone) AS customer_phone,
    r.roomNumber AS room_number,
    rt.typeName AS room_type_name,
    DATE(bd.checkInDate) AS check_in,
    DATE(bd.checkOutDate) AS check_out,
    COALESCE(bd.occupancySurcharge, 0) AS occupancy_surcharge,
    COALESCE(bd.children, 0) AS children_count,
    COALESCE(
      bd.roomPrice * GREATEST(DATEDIFF(bd.checkOutDate, bd.checkInDate), 1),
      0
    ) AS stay_room_amount
  FROM invoices i
  LEFT JOIN payments p ON p.id = i.paymentId
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
        roomAmount,
        serviceAmount,
        surchargeAmount,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        status,
        invoiceDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
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
      payload.status || 'issued'
    ]
  );
  return result.insertId;
};

const updateInvoiceAmounts = async (invoiceId, payload, connection) => {
  await run(connection).query(
    `UPDATE invoices
     SET paymentId = ?, roomAmount = ?, serviceAmount = ?, surchargeAmount = ?, subtotal = ?,
         discountAmount = ?, totalAmount = ?, status = 'issued', invoiceDate = NOW()
     WHERE id = ?`,
    [
      payload.paymentId,
      payload.roomAmount,
      payload.serviceAmount,
      payload.surchargeAmount,
      payload.subtotal,
      payload.discountAmount,
      payload.totalAmount,
      invoiceId
    ]
  );
};

const getInvoiceById = async (invoiceId, connection) => {
  const [rows] = await run(connection).query(`${INVOICE_SELECT} WHERE i.id = ?`, [invoiceId]);
  return rows[0] || null;
};

const getInvoiceByNumber = async (invoiceCode) => {
  const [rows] = await db.query(`${INVOICE_SELECT} WHERE i.invoiceCode = ?`, [invoiceCode]);
  return rows[0] || null;
};

const getInvoiceByBookingId = async (bookingId, connection) => {
  const [rows] = await run(connection).query(
    `${INVOICE_SELECT} WHERE i.bookingId = ? ORDER BY i.invoiceDate DESC LIMIT 1`,
    [bookingId]
  );
  return rows[0] || null;
};

const listInvoiceServices = async (bookingId, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT
        bs.serviceId,
        s.serviceName,
        bs.quantity,
        s.price AS unitPrice,
        bs.totalPrice
      FROM booking_services bs
      JOIN services s ON s.id = bs.serviceId
      WHERE bs.bookingId = ?
      ORDER BY bs.id ASC
    `,
    [bookingId]
  );
  return rows;
};

const listInvoiceNightlyPrices = async (bookingId, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT
        bnp.id,
        DATE_FORMAT(bnp.stayDate, '%Y-%m-%d') AS stayDate,
        bnp.price,
        COALESCE(bnp.priceType, 'normal') AS priceType,
        bnp.note,
        bnp.roomId,
        r.roomNumber
      FROM booking_nightly_prices bnp
      LEFT JOIN rooms r ON r.id = bnp.roomId
      WHERE bnp.bookingId = ?
      ORDER BY bnp.stayDate ASC
    `,
    [bookingId]
  );
  return rows;
};

const listInvoiceTransfers = async (bookingId, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT
        t.id,
        t.fromRoomId,
        t.toRoomId,
        DATE_FORMAT(t.fromDate, '%Y-%m-%d') AS fromDate,
        DATE_FORMAT(t.toDate, '%Y-%m-%d') AS toDate,
        t.pricePerNight,
        t.reason,
        t.createdAt,
        fr.roomNumber AS fromRoomNumber,
        tr.roomNumber AS toRoomNumber
      FROM booking_room_transfers t
      LEFT JOIN rooms fr ON fr.id = t.fromRoomId
      LEFT JOIN rooms tr ON tr.id = t.toRoomId
      WHERE t.bookingId = ?
      ORDER BY t.id ASC
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
        bdc.bookingId,
        bdc.roomId,
        r.roomNumber,
        COALESCE(bdc.chargeType, 'damage') AS chargeType,
        bdc.itemName,
        bdc.quantity,
        bdc.unitPrice,
        bdc.totalPrice,
        COALESCE(bdc.status, 'used') AS status,
        bdc.note,
        bdc.createdAt
      FROM booking_damage_charges bdc
      LEFT JOIN rooms r ON r.id = bdc.roomId
      WHERE bdc.bookingId = ? AND COALESCE(bdc.status, 'used') != 'cancelled'
      ORDER BY bdc.id ASC
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
  listInvoiceNightlyPrices,
  listInvoiceTransfers,
  listInvoiceDamages,
  listInvoices,
  getNextInvoiceSequence
};

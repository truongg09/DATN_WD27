const db = require('../config/db');

const run = (connection) => connection || db;

const INVOICE_SELECT = `
  SELECT
    i.*,
    p.depositAmount AS deposit_amount,
    p.paidAmount AS paid_amount,
    p.remainingAmount AS remaining_amount,
    COALESCE(b.customerId, b.user_id) AS user_id,
    COALESCE(b.guest_name, c.fullName, a.email) AS customer_name,
    COALESCE(b.guest_email, a.email) AS customer_email,
    COALESCE(b.guest_phone, c.phone, a.phone) AS customer_phone,
    DATE(b.check_in) AS check_in,
    DATE(b.check_out) AS check_out
  FROM invoices i
  LEFT JOIN payments p ON p.id = i.paymentId
  JOIN bookings b ON b.id = i.bookingId
  LEFT JOIN customers c ON c.id = b.customerId
  LEFT JOIN accounts a ON a.id = c.accountId
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
      WHERE bs.bookingId = ? AND COALESCE(bs.status, 'used') = 'used'
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
      WHERE bdc.bookingId = ? AND COALESCE(bdc.status, 'used') = 'used'
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

const listInvoiceRooms = async (bookingId, connection) => {
  const [details] = await run(connection).query(
    `
      SELECT
        bd.id AS bookingDetailId,
        bd.roomId,
        r.roomNumber,
        COALESCE(bd.roomTypeId, r.roomTypeId) AS roomTypeId,
        rt.typeName,
        bd.roomPrice,
        DATE_FORMAT(bd.checkInDate, '%Y-%m-%d') AS checkInDate,
        DATE_FORMAT(bd.checkOutDate, '%Y-%m-%d') AS checkOutDate,
        COALESCE(bd.adults, 1) AS adults,
        COALESCE(bd.children, 0) AS children,
        COALESCE(bd.occupancySurcharge, 0) AS occupancySurcharge
      FROM booking_details bd
      LEFT JOIN rooms r ON r.id = bd.roomId
      LEFT JOIN room_types rt ON rt.id = COALESCE(bd.roomTypeId, r.roomTypeId)
      WHERE bd.bookingId = ?
      ORDER BY bd.id ASC
    `,
    [bookingId]
  );

  if (details.length > 0) {
    return details;
  }

  // Fallback for legacy scalar bookings without booking_details rows
  const [legacy] = await run(connection).query(
    `
      SELECT
        NULL AS bookingDetailId,
        b.room_id AS roomId,
        r.roomNumber,
        COALESCE(b.room_type_id, r.roomTypeId) AS roomTypeId,
        rt.typeName,
        b.room_price AS roomPrice,
        DATE_FORMAT(b.check_in, '%Y-%m-%d') AS checkInDate,
        DATE_FORMAT(b.check_out, '%Y-%m-%d') AS checkOutDate,
        COALESCE(b.adults, 1) AS adults,
        COALESCE(b.children, 0) AS children,
        0 AS occupancySurcharge
      FROM bookings b
      LEFT JOIN rooms r ON r.id = b.room_id
      LEFT JOIN room_types rt ON rt.id = COALESCE(b.room_type_id, r.roomTypeId)
      WHERE b.id = ?
    `,
    [bookingId]
  );

  return legacy;
};

module.exports = {
  createInvoice,
  updateInvoiceAmounts,
  getInvoiceById,
  getInvoiceByNumber,
  getInvoiceByBookingId,
  listInvoiceRooms,
  listInvoiceServices,
  listInvoiceNightlyPrices,
  listInvoiceTransfers,
  listInvoiceDamages,
  listInvoices,
  getNextInvoiceSequence
};

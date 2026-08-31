const db = require('../config/db');

const run = (connection) => connection || db;

const generateNoShowCode = (bookingId) => {
  return `UUDAI${bookingId}`;
};

const createVoucher = async (
  { code, discountPercentage, validFrom, validUntil, usageLimit = 1 },
  connection
) => {
  const [result] = await run(connection).query(
    `
      INSERT INTO vouchers (code, discountType, discountValue, quantity, startDate, endDate, status)
      VALUES (?, 'percentage', ?, ?, ?, ?, 'active')
    `,
    [code, discountPercentage, usageLimit, validFrom, validUntil]
  );
  return result.insertId;
};

const assignVoucherToUser = async (
  { userId, voucherId, bookingId, source = 'no_show' },
  connection
) => {
  const [result] = await run(connection).query(
    `
      INSERT INTO customer_vouchers (userId, voucherId, bookingId, source, isUsed)
      VALUES (?, ?, ?, ?, 0)
    `,
    [userId, voucherId, bookingId, source]
  );
  return result.insertId;
};

const getVoucherByBookingId = async (bookingId, source = 'no_show', connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT
        cv.id,
        cv.userId,
        cv.voucherId,
        cv.bookingId,
        cv.source,
        cv.isUsed,
        cv.createdAt,
        v.code,
        v.discountValue AS discountPercentage,
        v.startDate AS validFrom,
        v.endDate AS validUntil
      FROM customer_vouchers cv
      JOIN vouchers v ON v.id = cv.voucherId
      WHERE cv.bookingId = ? AND cv.source = ?
      ORDER BY cv.id DESC
      LIMIT 1
    `,
    [bookingId, source]
  );
  return rows[0] || null;
};

const getVoucherByCode = async (code, connection) => {
  const [rows] = await run(connection).query(
    'SELECT * FROM vouchers WHERE UPPER(code) = ?',
    [String(code || '').trim().toUpperCase()]
  );
  return rows[0] || null;
};

const hasNoShowVoucher = async (bookingId, connection) => {
  const voucher = await getVoucherByBookingId(bookingId, 'no_show', connection);
  return Boolean(voucher);
};

module.exports = {
  generateNoShowCode,
  createVoucher,
  assignVoucherToUser,
  getVoucherByBookingId,
  getVoucherByCode,
  hasNoShowVoucher
};
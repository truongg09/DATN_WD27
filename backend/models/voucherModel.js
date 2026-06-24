const db = require('../config/db');

const run = (connection) => connection || db;

const generateNoShowCode = (bookingId) => {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `NOSHOW${bookingId}${suffix}`;
};

const createVoucher = async (
  { code, discountPercentage, validFrom, validUntil, usageLimit = 1 },
  connection
) => {
  const [result] = await run(connection).query(
    `
      INSERT INTO vouchers (code, discount_percentage, valid_from, valid_until, usage_limit, times_used)
      VALUES (?, ?, ?, ?, ?, 0)
    `,
    [code, discountPercentage, validFrom, validUntil, usageLimit]
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
        cv.bookingId,
        cv.source,
        cv.isUsed,
        cv.createdAt,
        v.code,
        v.discount_percentage AS discountPercentage,
        v.valid_from AS validFrom,
        v.valid_until AS validUntil
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

const hasNoShowVoucher = async (bookingId, connection) => {
  const voucher = await getVoucherByBookingId(bookingId, 'no_show', connection);
  return Boolean(voucher);
};

module.exports = {
  generateNoShowCode,
  createVoucher,
  assignVoucherToUser,
  getVoucherByBookingId,
  hasNoShowVoucher
};

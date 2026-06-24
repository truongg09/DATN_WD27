const voucherModel = require('../models/voucherModel');

const NO_SHOW_DISCOUNT_PERCENT = 10;
const NO_SHOW_VOUCHER_VALID_DAYS = 90;

const formatDate = (date) => date.toISOString().slice(0, 10);

const createNoShowCompensationVoucher = async (userId, bookingId, connection) => {
  const existing = await voucherModel.hasNoShowVoucher(bookingId, connection);
  if (existing) {
    return voucherModel.getVoucherByBookingId(bookingId, 'no_show', connection);
  }

  const validFrom = formatDate(new Date());
  const validUntilDate = new Date();
  validUntilDate.setDate(validUntilDate.getDate() + NO_SHOW_VOUCHER_VALID_DAYS);
  const validUntil = formatDate(validUntilDate);
  const code = voucherModel.generateNoShowCode(bookingId);

  const voucherId = await voucherModel.createVoucher(
    {
      code,
      discountPercentage: NO_SHOW_DISCOUNT_PERCENT,
      validFrom,
      validUntil,
      usageLimit: 1
    },
    connection
  );

  await voucherModel.assignVoucherToUser(
    {
      userId,
      voucherId,
      bookingId,
      source: 'no_show'
    },
    connection
  );

  return voucherModel.getVoucherByBookingId(bookingId, 'no_show', connection);
};

module.exports = {
  NO_SHOW_DISCOUNT_PERCENT,
  NO_SHOW_VOUCHER_VALID_DAYS,
  createNoShowCompensationVoucher
};

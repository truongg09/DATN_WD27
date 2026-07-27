const HttpError = require('../utils/httpError');
const { normalizeIdParam } = require('./bookingValidator');

const PAYMENT_METHODS = ['cash', 'momo', 'vnpay', 'bank_transfer'];
const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'];

const toAmount = (value, fieldName, defaultValue = 0) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const number = Number(value);
  if (Number.isNaN(number) || number < 0) {
    throw new HttpError(400, `${fieldName} phải là số không âm`);
  }
  return number;
};

const normalizePaymentMethod = (value) => {
  if (!value) {
    return null;
  }

  const method = String(value).toLowerCase();
  if (!PAYMENT_METHODS.includes(method)) {
    throw new HttpError(400, `Phương thức thanh toán không hợp lệ. Giá trị cho phép: ${PAYMENT_METHODS.join(', ')}`);
  }
  return method;
};

const normalizeCreatePaymentPayload = (body) => ({
  bookingId: normalizeIdParam(body.bookingId ?? body.booking_id, 'bookingId'),
  serviceAmount: toAmount(body.serviceAmount ?? body.service_amount, 'serviceAmount'),
  surchargeAmount: toAmount(body.surchargeAmount ?? body.surcharge_amount, 'surchargeAmount'),
  discountAmount: toAmount(body.discountAmount ?? body.discount_amount, 'discountAmount'),
  depositAmount: toAmount(body.depositAmount ?? body.deposit_amount, 'depositAmount'),
  paymentMethod: normalizePaymentMethod(body.paymentMethod ?? body.payment_method)
});

const normalizeProcessPaymentPayload = (body) => {
  const paymentMethod = normalizePaymentMethod(body.paymentMethod ?? body.payment_method);
  if (!paymentMethod) {
    throw new HttpError(400, 'Vui lòng chọn phương thức thanh toán');
  }

  return {
    paymentMethod,
    amount: body.amount !== undefined ? toAmount(body.amount, 'amount') : undefined,
    sandbox: body.sandbox === true
  };
};

const normalizePaymentFilters = (query) => {
  const filters = {};

  if (query.bookingId || query.booking_id) {
    filters.bookingId = normalizeIdParam(query.bookingId || query.booking_id, 'bookingId');
  }

  if (query.paymentStatus || query.payment_status || query.status) {
    const status = String(query.paymentStatus || query.payment_status || query.status).toLowerCase();
    if (!PAYMENT_STATUSES.includes(status)) {
      throw new HttpError(400, `Trạng thái thanh toán không hợp lệ. Giá trị cho phép: ${PAYMENT_STATUSES.join(', ')}`);
    }
    filters.paymentStatus = status;
  }

  return filters;
};

module.exports = {
  normalizeCreatePaymentPayload,
  normalizeProcessPaymentPayload,
  normalizePaymentFilters,
  normalizeIdParam
};

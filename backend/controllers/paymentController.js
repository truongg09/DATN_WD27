const paymentService = require('../services/paymentService');
const {
  normalizeCreatePaymentPayload,
  normalizeProcessPaymentPayload,
  normalizePaymentFilters,
  normalizeIdParam
} = require('../validators/paymentValidator');

const sendError = (res, error) => {
  console.error('Payment API error:', error);
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    message: statusCode === 500 ? 'Lỗi máy chủ nội bộ' : error.message,
    ...(error.details ? { details: error.details } : {})
  });
};

const createPayment = async (req, res) => {
  try {
    const payload = normalizeCreatePaymentPayload(req.body);
    const payment = await paymentService.createPayment(payload);
    res.status(201).json({
      message: 'Tạo thanh toán thành công',
      data: payment
    });
  } catch (error) {
    sendError(res, error);
  }
};

const listPayments = async (req, res) => {
  try {
    const filters = normalizePaymentFilters(req.query);
    const payments = await paymentService.listPayments(filters);
    res.json({ data: payments });
  } catch (error) {
    sendError(res, error);
  }
};

const getPaymentById = async (req, res) => {
  try {
    const paymentId = normalizeIdParam(req.params.id);
    const payment = await paymentService.getPaymentById(paymentId);
    res.json({ data: payment });
  } catch (error) {
    sendError(res, error);
  }
};

const getPaymentByBookingId = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.bookingId, 'bookingId');
    const payment = await paymentService.getPaymentByBookingId(bookingId);
    res.json({ data: payment });
  } catch (error) {
    sendError(res, error);
  }
};

const processPayment = async (req, res) => {
  try {
    const paymentId = normalizeIdParam(req.params.id);
    const payload = normalizeProcessPaymentPayload(req.body);
    const result = await paymentService.processPayment(paymentId, payload);
    res.json({
      message: 'Xử lý thanh toán thành công',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const refundPayment = async (req, res) => {
  try {
    const paymentId = normalizeIdParam(req.params.id);
    const payment = await paymentService.refundPayment(paymentId);
    res.json({
      message: 'Hoàn tiền thành công',
      data: payment
    });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  createPayment,
  listPayments,
  getPaymentById,
  getPaymentByBookingId,
  processPayment,
  refundPayment
};

const paymentService = require('../services/paymentService');
const {
  normalizeCreatePaymentPayload,
  normalizeProcessPaymentPayload,
  normalizeConfirmPaymentPayload,
  normalizePaymentFilters,
  normalizeIdParam
} = require('../validators/paymentValidator');

const sendError = (res, error) => {
  console.error('Payment API error:', error);
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    message: statusCode === 500 ? 'Internal server error' : error.message,
    ...(error.details ? { details: error.details } : {})
  });
};

const createPayment = async (req, res) => {
  try {
    const payload = normalizeCreatePaymentPayload(req.body);
    const payment = await paymentService.createPayment(payload);
    res.status(201).json({
      message: 'Payment created successfully',
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
      message: 'Payment processed successfully',
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
      message: 'Payment refunded successfully',
      data: payment
    });
  } catch (error) {
    sendError(res, error);
  }
};

const confirmPayment = async (req, res) => {
  try {
    const paymentId = normalizeIdParam(req.params.id);
    const payload = normalizeConfirmPaymentPayload(req.body);
    const result = await paymentService.confirmPayment(paymentId, payload);
    res.json({
      message: 'Payment confirmed successfully',
      data: result
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
  confirmPayment,
  refundPayment
};
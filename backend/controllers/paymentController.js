const paymentService = require('../services/paymentService');
const HttpError = require('../utils/httpError');
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

const createGatewayOrder = async (req, res) => {
  try {
    const paymentId = normalizeIdParam(req.params.id);
    const payload = normalizeProcessPaymentPayload(req.body);
    const data = await paymentService.createGatewayOrder(paymentId, { ...payload, ipAddress: req.ip });
    res.json({ data });
  } catch (error) {
    sendError(res, error);
  }
};

const vnpayReturn = async (req, res) => {
  const { verifyVnpay, FRONTEND_URL } = require('../services/paymentGatewayService');
  const orderId = String(req.query.vnp_TxnRef || '');
  const paymentId = Number(orderId.split('-')[1]);
  let bookingId = '';
  let success = false;
  let paymentStatus = '';
  try {
    if (Number.isInteger(paymentId) && paymentId > 0) {
      const payment = await paymentService.getPaymentById(paymentId);
      bookingId = String(payment.bookingId);
    }
    if (verifyVnpay(req.query) && req.query.vnp_ResponseCode === '00') {
      const settledPayment = await paymentService.settleGatewayPayment({
        orderId,
        paymentMethod: 'vnpay',
        amount: Number(req.query.vnp_Amount) / 100
      });
      const payment = await paymentService.getPaymentByBookingId(settledPayment.bookingId);
      bookingId = String(payment.bookingId);
      paymentStatus = payment.paymentStatus;
      success =
        Number(payment.paidAmount) > 0
        && ['deposit_paid', 'paid'].includes(payment.paymentStatus);
    }
  } catch (error) {
    console.error('VNPay return error:', error);
  }
  res.redirect(
    `${FRONTEND_URL}/booking/${bookingId}?gateway=vnpay&payment=${success ? 'success' : 'failed'}${paymentStatus ? `&status=${encodeURIComponent(paymentStatus)}` : ''}`
  );
};

const vnpayIpn = async (req, res) => {
  const { verifyVnpay } = require('../services/paymentGatewayService');
  try {
    if (!verifyVnpay(req.query)) return res.json({ RspCode: '97', Message: 'Invalid signature' });
    if (req.query.vnp_ResponseCode === '00') {
      await paymentService.settleGatewayPayment({ orderId: String(req.query.vnp_TxnRef), paymentMethod: 'vnpay', amount: Number(req.query.vnp_Amount) / 100 });
    }
    res.json({ RspCode: '00', Message: 'Confirm Success' });
  } catch (error) {
    res.json({ RspCode: '99', Message: error.message });
  }
};

const momoIpn = async (req, res) => {
  const { verifyMomo } = require('../services/paymentGatewayService');
  try {
    if (!verifyMomo(req.body)) return res.status(400).json({ message: 'Invalid MoMo signature' });
    if (Number(req.body.resultCode) === 0) {
      await paymentService.settleGatewayPayment({ orderId: req.body.orderId, paymentMethod: 'momo', amount: Number(req.body.amount) });
    }
    res.json({ resultCode: 0, message: 'Success' });
  } catch (error) {
    res.status(500).json({ resultCode: 99, message: error.message });
  }
};

const momoReturn = async (req, res) => {
  const { verifyMomo, FRONTEND_URL } = require('../services/paymentGatewayService');
  const orderId = String(req.query.orderId || '');
  const paymentId = Number(orderId.split('-')[1]);
  let bookingId = '';
  let success = false;
  let paymentStatus = '';

  try {
    if (Number.isInteger(paymentId) && paymentId > 0) {
      const payment = await paymentService.getPaymentById(paymentId);
      bookingId = String(payment.bookingId);
    }
    if (verifyMomo(req.query) && Number(req.query.resultCode) === 0) {
      const settledPayment = await paymentService.settleGatewayPayment({
        orderId,
        paymentMethod: 'momo',
        amount: Number(req.query.amount)
      });
      const payment = await paymentService.getPaymentByBookingId(settledPayment.bookingId);
      bookingId = String(payment.bookingId);
      paymentStatus = payment.paymentStatus;
      success =
        Number(payment.paidAmount) > 0
        && ['deposit_paid', 'paid'].includes(payment.paymentStatus);
    }
  } catch (error) {
    console.error('MoMo return error:', error);
  }

  res.redirect(
    `${FRONTEND_URL}/booking/${bookingId}?gateway=momo&payment=${success ? 'success' : 'failed'}${paymentStatus ? `&status=${encodeURIComponent(paymentStatus)}` : ''}`
  );
};

const submitTransferConfirmation = async (req, res) => {
  try {
    const paymentId = normalizeIdParam(req.params.id);
    const payload = normalizeProcessPaymentPayload(req.body);
    const payment = await paymentService.submitTransferConfirmation(paymentId, payload);
    res.status(202).json({ message: 'Payment verification requested', data: payment });
  } catch (error) {
    sendError(res, error);
  }
};

const confirmTransferPayment = async (req, res) => {
  try {
    if (!['admin', 'employee', 'staff'].includes(req.user?.role)) {
      throw new HttpError(403, 'Only admin or receptionist can confirm payment');
    }
    const paymentId = normalizeIdParam(req.params.id);
    const payment = await paymentService.confirmTransferPayment(paymentId, req.user.userId);
    res.json({ message: 'Payment confirmed', data: payment });
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
  refundPayment,
  createGatewayOrder,
  vnpayReturn,
  vnpayIpn,
  momoReturn,
  momoIpn,
  submitTransferConfirmation,
  confirmTransferPayment
};

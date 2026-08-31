const paymentService = require('../services/paymentService');
const HttpError = require('../utils/httpError');
const {
  normalizeCreatePaymentPayload,
  normalizeProcessPaymentPayload,
  normalizeConfirmPaymentPayload,
  normalizeWalletPaymentPayload,
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

const gatewayFrontendReturnUrl = ({ frontendUrl, bookingId, orderId, gateway, success, paymentStatus, returnContext }) => {
  const resultQuery = `gateway=${gateway}&payment=${success ? 'success' : 'failed'}${paymentStatus ? `&status=${encodeURIComponent(paymentStatus)}` : ''}`;
  if (returnContext === 'admin_bookings' || orderId.endsWith('_ADMIN')) {
    return `${frontendUrl}/admin/bookings?${resultQuery}&bookingId=${encodeURIComponent(bookingId)}`;
  }
  if (returnContext === 'staff_bookings' || orderId.endsWith('_STAFF')) {
    return `${frontendUrl}/staff/bookings?${resultQuery}&bookingId=${encodeURIComponent(bookingId)}`;
  }
  return `${frontendUrl}/booking/${bookingId}?${resultQuery}`;
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
    const result = await paymentService.processPayment(paymentId, payload, req.user || null);
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
    const payment = await paymentService.refundPayment(paymentId, req.user || null);
    res.json({
      message: 'Hoàn tiền thành công, số tiền đã được cộng vào ví khách hàng',
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

    // Khách chỉ được xác nhận khi có mã đơn hàng do cổng thanh toán trả về.
    // Không có ràng buộc này, chính chủ booking gọi thẳng endpoint là hệ thống
    // ghi nhận "đã trả đủ" mà không hề có tiền vào.
    if (!['admin', 'employee', 'staff'].includes(req.user?.role) && !payload.gatewayOrderId) {
      throw new HttpError(
        403,
        'Thanh toán phải được xác nhận qua cổng thanh toán hoặc bởi nhân viên khách sạn'
      );
    }

    const result = await paymentService.confirmPayment(paymentId, payload, req.user || null);
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
    const verified = verifyVnpay(req.query);
    if (verified && req.query.vnp_ResponseCode === '00') {
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
    } else if (verified && orderId) {
      await paymentService.failGatewayOrder(orderId, req.query.vnp_ResponseCode === '11' ? 'expired' : 'failed');
    }
  } catch (error) {
    console.error('VNPay return error:', error);
  }
  res.redirect(gatewayFrontendReturnUrl({
    frontendUrl: FRONTEND_URL, bookingId, orderId, gateway: 'vnpay', success, paymentStatus,
    returnContext: req.query.returnContext
  }));
};

const vnpayIpn = async (req, res) => {
  const { verifyVnpay } = require('../services/paymentGatewayService');
  try {
    if (!verifyVnpay(req.query)) return res.json({ RspCode: '97', Message: 'Invalid signature' });
    if (req.query.vnp_ResponseCode === '00') {
      await paymentService.settleGatewayPayment({ orderId: String(req.query.vnp_TxnRef), paymentMethod: 'vnpay', amount: Number(req.query.vnp_Amount) / 100 });
    } else {
      await paymentService.failGatewayOrder(
        String(req.query.vnp_TxnRef),
        req.query.vnp_ResponseCode === '11' ? 'expired' : 'failed'
      );
    }
    res.json({ RspCode: '00', Message: 'Confirm Success' });
  } catch (error) {
    res.json({ RspCode: '99', Message: error.message });
  }
};

const zalopayCallback = async (req, res) => {
  const { verifyZalopayCallback } = require('../services/paymentGatewayService');
  try {
    if (!verifyZalopayCallback(req.body)) {
      return res.json({ return_code: -1, return_message: 'Invalid ZaloPay MAC' });
    }
    const callbackData = JSON.parse(req.body.data);
    await paymentService.settleGatewayPayment({
      orderId: callbackData.app_trans_id,
      paymentMethod: 'zalopay',
      amount: Number(callbackData.amount)
    });
    res.json({ return_code: 1, return_message: 'Success' });
  } catch (error) {
    res.json({ return_code: 0, return_message: error.message });
  }
};

const zalopayReturn = async (req, res) => {
  const { FRONTEND_URL, queryZalopayOrder } = require('../services/paymentGatewayService');
  const orderId = String(req.query.apptransid || req.query.app_trans_id || '');
  const paymentId = Number(orderId.split('_')[1]);
  const gatewayReportedSuccess = String(req.query.status || '') === '1';
  let bookingId = '';
  let success = false;
  let paymentStatus = '';

  try {
    if (Number.isInteger(paymentId) && paymentId > 0) {
      let payment = await paymentService.getPaymentById(paymentId);
      bookingId = String(payment.bookingId);

      // A localhost callback cannot be reached by ZaloPay's servers. On the
      // browser return, query the signed server API and settle this exact order
      // before deciding which notice the customer should see.
      if (
        gatewayReportedSuccess
        && payment.transactionCode === orderId
        && !payment.paymentDate
      ) {
        const queryResult = await queryZalopayOrder(orderId);
        if (Number(queryResult.return_code) === 1) {
          await paymentService.settleGatewayPayment({
            orderId,
            paymentMethod: 'zalopay',
            amount: Number(queryResult.amount)
          });
          payment = await paymentService.getPaymentById(paymentId);
        }
      }

      paymentStatus = payment.paymentStatus;
      success =
        gatewayReportedSuccess
        && payment.transactionCode === orderId
        && Boolean(payment.paymentDate)
        && Number(payment.paidAmount) > 0
        && ['deposit_paid', 'paid'].includes(payment.paymentStatus);
    }
  } catch (error) {
    console.error('ZaloPay return error:', error);
  }

  res.redirect(gatewayFrontendReturnUrl({
    frontendUrl: FRONTEND_URL, bookingId, orderId, gateway: 'zalopay', success, paymentStatus,
    returnContext: req.query.returnContext
  }));
};

const submitTransferConfirmation = async (req, res) => {
  try {
    const paymentId = normalizeIdParam(req.params.id);
    const payload = normalizeProcessPaymentPayload(req.body);
    const payment = await paymentService.submitTransferConfirmation(paymentId, payload, req.user || null);
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
    const payment = await paymentService.confirmTransferPayment(paymentId, req.user.userId, req.user);
    res.json({ message: 'Payment confirmed', data: payment });
  } catch (error) {
    sendError(res, error);
  }
};

const previewVoucher = async (req, res) => {
  try {
    const paymentId = normalizeIdParam(req.params.id);
    const data = await paymentService.previewVoucher(
      paymentId,
      req.body?.code,
      { userId: req.user.userId, role: req.user.role }
    );
    res.json({ data });
  } catch (error) {
    sendError(res, error);
  }
};

const payWithWallet = async (req, res) => {
  try {
    const paymentId = normalizeIdParam(req.params.id);
    const payload = normalizeWalletPaymentPayload(req.body);
    const result = await paymentService.payWithWallet(
      paymentId,
      payload,
      req.user || null
    );
    res.json({
      message: result.idempotent
        ? 'Giao dịch ví đã được ghi nhận trước đó'
        : 'Thanh toán bằng ví thành công',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const listCustomerVouchers = async (req, res) => {
  try {
    const paymentId = normalizeIdParam(req.params.id);
    const data = await paymentService.listCustomerVouchers(
      paymentId,
      { userId: req.user.userId, role: req.user.role }
    );
    res.json({ data });
  } catch (error) {
    sendError(res, error);
  }
};

const applyVoucher = async (req, res) => {
  try {
    const paymentId = normalizeIdParam(req.params.id);
    const result = await paymentService.applyVoucher(
      paymentId,
      req.body?.code,
      { userId: req.user.userId, role: req.user.role }
    );
    res.json({ message: 'Áp dụng voucher thành công', data: result });
  } catch (error) {
    sendError(res, error);
  }
};

const removeVoucher = async (req, res) => {
  try {
    const paymentId = normalizeIdParam(req.params.id);
    const result = await paymentService.removeVoucher(paymentId, {
      userId: req.user.userId,
      role: req.user.role
    });
    res.json({ message: 'Đã gỡ voucher khỏi đơn', data: result });
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
  payWithWallet,
  confirmPayment,
  refundPayment,
  createGatewayOrder,
  vnpayReturn,
  vnpayIpn,
  zalopayReturn,
  zalopayCallback,
  listCustomerVouchers,
  applyVoucher,
  removeVoucher,
  previewVoucher,
  submitTransferConfirmation,
  confirmTransferPayment,
  refundPayment
};
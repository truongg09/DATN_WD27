const express = require('express');
const paymentController = require('../controllers/paymentController');
const { requireAuth } = require('../middleware/auth');
const {
  requireStaff,
  requirePaymentAccess,
  requireBookingPaymentAccess
} = require('../middleware/paymentAuthorization');
const { rateLimit, byUser } = require('../middleware/rateLimit');

const router = express.Router();

// Thử mã giảm giá không ghi lại dấu vết gì, nên nếu thả tự do thì có thể dò
// cạn kho voucher (kể cả mã của chiến dịch chưa chạy) bằng cách thử hàng loạt.
const voucherAttemptLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyBy: byUser,
  scope: 'voucher-attempt',
  message: 'Bạn thử mã giảm giá quá nhiều lần. Vui lòng đợi một phút rồi thử lại.'
});

const walletPaymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  keyBy: byUser,
  scope: 'wallet-payment',
  message: 'Bạn thao tác thanh toán ví quá nhiều lần. Vui lòng đợi một phút rồi thử lại.'
});

router.post('/', requireAuth, requireStaff, paymentController.createPayment);
router.get('/', requireAuth, requireStaff, paymentController.listPayments);
router.get('/gateway/vnpay/return', paymentController.vnpayReturn);
router.get('/gateway/vnpay/ipn', paymentController.vnpayIpn);
router.get('/gateway/zalopay/return', paymentController.zalopayReturn);
router.post('/gateway/zalopay/callback', paymentController.zalopayCallback);
router.get('/booking/:bookingId', requireAuth, requireBookingPaymentAccess, paymentController.getPaymentByBookingId);
router.get('/:id/customer-vouchers', requireAuth, requirePaymentAccess, paymentController.listCustomerVouchers);
router.post('/:id/preview-voucher', requireAuth, requirePaymentAccess, voucherAttemptLimiter, paymentController.previewVoucher);
router.post('/:id/apply-voucher', requireAuth, requirePaymentAccess, voucherAttemptLimiter, paymentController.applyVoucher);
router.post('/:id/pay-wallet', requireAuth, requirePaymentAccess, walletPaymentLimiter, paymentController.payWithWallet);
router.post('/:id/gateway-order', requireAuth, requirePaymentAccess, paymentController.createGatewayOrder);
router.post('/:id/transfer-confirmation', requireAuth, requirePaymentAccess, paymentController.submitTransferConfirmation);
router.post('/:id/confirm-transfer', requireAuth, requireStaff, paymentController.confirmTransferPayment);
// Used by the local payment sandbox as well as staff tools. Authorization is
// limited to the booking owner or staff by requirePaymentAccess.
router.post('/:id/confirm', requireAuth, requirePaymentAccess, paymentController.confirmPayment);
router.get('/:id', requireAuth, requirePaymentAccess, paymentController.getPaymentById);
router.post('/:id/pay', requireAuth, requireStaff, paymentController.processPayment);
router.patch('/:id/refund', requireAuth, requireStaff, paymentController.refundPayment);

module.exports = router;

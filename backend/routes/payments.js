const express = require('express');
const paymentController = require('../controllers/paymentController');
const { requireAuth } = require('../middleware/auth');
const {
  requireStaff,
  requirePaymentAccess,
  requireBookingPaymentAccess
} = require('../middleware/paymentAuthorization');

const router = express.Router();

router.post('/', requireAuth, requireStaff, paymentController.createPayment);
router.get('/', requireAuth, requireStaff, paymentController.listPayments);
router.get('/gateway/vnpay/return', paymentController.vnpayReturn);
router.get('/gateway/vnpay/ipn', paymentController.vnpayIpn);
router.post('/gateway/momo/ipn', paymentController.momoIpn);
router.get('/booking/:bookingId', requireAuth, requireBookingPaymentAccess, paymentController.getPaymentByBookingId);
router.post('/:id/gateway-order', requireAuth, requirePaymentAccess, paymentController.createGatewayOrder);
router.post('/:id/transfer-confirmation', requireAuth, requirePaymentAccess, paymentController.submitTransferConfirmation);
router.post('/:id/confirm-transfer', requireAuth, requireStaff, paymentController.confirmTransferPayment);
router.post('/:id/confirm', requireAuth, requireStaff, paymentController.confirmPayment);
router.get('/:id', requireAuth, requirePaymentAccess, paymentController.getPaymentById);
router.post('/:id/pay', requireAuth, requireStaff, paymentController.processPayment);
router.patch('/:id/refund', requireAuth, requireStaff, paymentController.refundPayment);

module.exports = router;

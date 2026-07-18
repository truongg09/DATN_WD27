const express = require('express');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

router.post('/', paymentController.createPayment);
router.get('/', paymentController.listPayments);
router.get('/booking/:bookingId', paymentController.getPaymentByBookingId);
router.get('/:id', paymentController.getPaymentById);
router.post('/:id/pay', paymentController.processPayment);
router.post('/:id/confirm', paymentController.confirmPayment);
router.patch('/:id/refund', paymentController.refundPayment);

module.exports = router;

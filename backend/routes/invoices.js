const express = require('express');
const invoiceController = require('../controllers/invoiceController');
const { requireAuth } = require('../middleware/auth');
const { requireStaff, requireBookingPaymentAccess } = require('../middleware/paymentAuthorization');
const { requireInvoiceAccess } = require('../middleware/invoiceAuthorization');

const router = express.Router();

router.get('/', requireAuth, requireStaff, invoiceController.listInvoices);
router.get('/booking/:bookingId', requireAuth, requireBookingPaymentAccess, invoiceController.getInvoiceByBookingId);
router.get('/:id', requireAuth, requireInvoiceAccess, invoiceController.getInvoiceById);

module.exports = router;

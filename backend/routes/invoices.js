const express = require('express');
const invoiceController = require('../controllers/invoiceController');

const router = express.Router();

router.get('/', invoiceController.listInvoices);
router.get('/booking/:bookingId', invoiceController.getInvoiceByBookingId);
router.get('/:id', invoiceController.getInvoiceById);

module.exports = router;

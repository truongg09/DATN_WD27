const invoiceService = require('../services/invoiceService');
const { normalizeIdParam } = require('../validators/paymentValidator');

const sendError = (res, error) => {
  console.error('Invoice API error:', error);
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    message: statusCode === 500 ? 'Internal server error' : error.message,
    ...(error.details ? { details: error.details } : {})
  });
};

const listInvoices = async (req, res) => {
  try {
    const filters = {};

    if (req.query.userId || req.query.customerId) {
      filters.userId = normalizeIdParam(req.query.userId || req.query.customerId, 'userId');
    }

    if (req.query.bookingId || req.query.booking_id) {
      filters.bookingId = normalizeIdParam(req.query.bookingId || req.query.booking_id, 'bookingId');
    }

    if (req.query.status) {
      filters.status = req.query.status;
    }

    const invoices = await invoiceService.listInvoices(filters);
    res.json({ data: invoices });
  } catch (error) {
    sendError(res, error);
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const invoiceId = normalizeIdParam(req.params.id);
    const invoice = await invoiceService.getInvoiceById(invoiceId);
    res.json({ data: invoice });
  } catch (error) {
    sendError(res, error);
  }
};

const getInvoiceByBookingId = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.bookingId, 'bookingId');
    const invoice = await invoiceService.getInvoiceByBookingId(bookingId);
    res.json({ data: invoice });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  listInvoices,
  getInvoiceById,
  getInvoiceByBookingId
};

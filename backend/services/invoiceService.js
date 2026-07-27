const invoiceModel = require('../models/invoiceModel');
const paymentModel = require('../models/paymentModel');
const HttpError = require('../utils/httpError');
const { formatInvoice } = require('../utils/formatters');

const buildInvoiceCode = async (connection) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const sequence = await invoiceModel.getNextInvoiceSequence(connection);
  return `HD${year}${month}-${String(sequence).padStart(5, '0')}`;
};

const issueInvoiceForPayment = async (paymentId, connection) => {
  const payment = await paymentModel.getPaymentById(paymentId, connection, !!connection);
  if (!payment) {
    throw new HttpError(404, 'Không tìm thấy thanh toán');
  }

  const existing = await invoiceModel.getInvoiceByBookingId(payment.bookingId);
  if (existing) {
    return formatInvoice(existing);
  }

  const roomAmount = Number(payment.roomAmount ?? 0);
  const serviceAmount = Number(payment.serviceAmount ?? 0);
  const discountAmount = Number(payment.discountAmount ?? 0);
  const subtotal = roomAmount + serviceAmount;

  const invoiceCode = await buildInvoiceCode(connection);
  const invoiceId = await invoiceModel.createInvoice(
    {
      invoiceCode,
      bookingId: payment.bookingId,
      paymentId: payment.id,
      subtotal,
      discountAmount,
      taxAmount: 0,
      totalAmount: Number(payment.totalAmount),
      status: 'issued'
    },
    connection
  );

  const invoice = await invoiceModel.getInvoiceById(invoiceId, connection);
  return formatInvoice(invoice);
};

const listInvoices = async (filters) => {
  const rows = await invoiceModel.listInvoices(filters);
  return rows.map(formatInvoice);
};

const getInvoiceById = async (invoiceId) => {
  const invoice = await invoiceModel.getInvoiceById(invoiceId);
  if (!invoice) {
    throw new HttpError(404, 'Không tìm thấy hóa đơn');
  }
  return formatInvoice(invoice);
};

const getInvoiceByBookingId = async (bookingId) => {
  const invoice = await invoiceModel.getInvoiceByBookingId(bookingId);
  if (!invoice) {
    throw new HttpError(404, 'Không tìm thấy hóa đơn của đặt phòng này');
  }
  return formatInvoice(invoice);
};

module.exports = {
  issueInvoiceForPayment,
  listInvoices,
  getInvoiceById,
  getInvoiceByBookingId
};

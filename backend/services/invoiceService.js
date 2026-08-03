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

const enrichInvoiceWithServices = async (row, connection) => {
  const invoice = formatInvoice(row);
  const serviceRows = await invoiceModel.listInvoiceServices(invoice.bookingId, connection);
  const services = serviceRows.map((service) => ({
    serviceId: Number(service.serviceId),
    serviceName: service.serviceName,
    quantity: Number(service.quantity ?? 0),
    unitPrice: Number(service.unitPrice ?? 0),
    totalPrice: Number(service.totalPrice ?? 0)
  }));
  const serviceAmount = services.reduce((sum, service) => sum + service.totalPrice, 0);
  // Tính lại tiền phòng từ đơn giá lưu trú và số đêm. Dữ liệu hóa đơn cũ có
  // trường hợp đã gộp tiền dịch vụ vào roomAmount nên không dùng số đó làm gốc.
  const roomAmount =
    Number(invoice.stayRoomAmount || 0) > 0
      ? Number(invoice.stayRoomAmount)
      : invoice.roomAmount;
  const totalAmount =
    roomAmount + serviceAmount + invoice.surchargeAmount - invoice.discountAmount;

  return {
    ...invoice,
    services,
    roomAmount,
    serviceAmount,
    subtotal: roomAmount + serviceAmount + invoice.surchargeAmount,
    totalAmount
  };
};

const issueInvoiceForPayment = async (paymentId, connection) => {
  const payment = await paymentModel.getPaymentById(paymentId, connection, !!connection);
  if (!payment) {
    throw new HttpError(404, 'Không tìm thấy thanh toán');
  }

  const existing = await invoiceModel.getInvoiceByBookingId(payment.bookingId, connection);
  if (existing) {
    return enrichInvoiceWithServices(existing, connection);
  }

  const roomAmount = Number(payment.roomAmount ?? 0);
  const serviceAmount = Number(payment.serviceAmount ?? 0);
  const surchargeAmount = Number(payment.surchargeAmount ?? 0);
  const discountAmount = Number(payment.discountAmount ?? 0);
  const subtotal = roomAmount + serviceAmount + surchargeAmount;

  const invoiceCode = await buildInvoiceCode(connection);
  const invoiceId = await invoiceModel.createInvoice(
    {
      invoiceCode,
      bookingId: payment.bookingId,
      paymentId: payment.id,
      roomAmount,
      serviceAmount,
      surchargeAmount,
      subtotal,
      discountAmount,
      taxAmount: 0,
      totalAmount: Number(payment.totalAmount),
      status: 'issued'
    },
    connection
  );

  const invoice = await invoiceModel.getInvoiceById(invoiceId, connection);
  return enrichInvoiceWithServices(invoice, connection);
};

const listInvoices = async (filters) => {
  const rows = await invoiceModel.listInvoices(filters);
  return Promise.all(rows.map((row) => enrichInvoiceWithServices(row)));
};

const getInvoiceById = async (invoiceId) => {
  const invoice = await invoiceModel.getInvoiceById(invoiceId);
  if (!invoice) {
    throw new HttpError(404, 'Không tìm thấy hóa đơn');
  }
  return enrichInvoiceWithServices(invoice);
};

const getInvoiceByBookingId = async (bookingId) => {
  const invoice = await invoiceModel.getInvoiceByBookingId(bookingId);
  if (!invoice) {
    throw new HttpError(404, 'Không tìm thấy hóa đơn của đặt phòng này');
  }
  return enrichInvoiceWithServices(invoice);
};

module.exports = {
  issueInvoiceForPayment,
  listInvoices,
  getInvoiceById,
  getInvoiceByBookingId
};

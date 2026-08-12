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
  if (!row) return null;
  const invoice = formatInvoice(row);
  const serviceRows = await invoiceModel.listInvoiceServices(invoice.bookingId, connection);
  const services = serviceRows.map((service) => ({
    serviceId: Number(service.serviceId),
    serviceName: service.serviceName,
    quantity: Number(service.quantity ?? 0),
    unitPrice: Number(service.unitPrice ?? 0),
    totalPrice: Number(service.totalPrice ?? 0)
  }));

  const damageRows = await invoiceModel.listInvoiceDamages(invoice.bookingId, connection);
  const damages = damageRows.map((d) => ({
    id: Number(d.id),
    roomId: Number(d.roomId || 0),
    roomNumber: d.roomNumber || '',
    chargeType: d.chargeType || 'damage',
    itemName: d.itemName,
    quantity: Number(d.quantity ?? 1),
    unitPrice: Number(d.unitPrice ?? 0),
    totalPrice: Number(d.totalPrice ?? 0),
    note: d.note || ''
  }));

  const damageAmount = damages.reduce((sum, d) => sum + d.totalPrice, 0);
  const occupancySurcharge = Number(invoice.occupancySurcharge || 0);
  const surchargeAmount = Number(invoice.surchargeAmount || 0);
  const lateCheckoutSurcharge = Math.max(surchargeAmount - occupancySurcharge - damageAmount, 0);

  const bookingRooms = await invoiceModel.listInvoiceRooms(invoice.bookingId, connection);
  const fallbackRooms = invoice.roomNumber ? [{ id: 0, number: invoice.roomNumber }] : [];
  const finalRooms = bookingRooms.length > 0 ? bookingRooms : fallbackRooms;

  // Dùng số tiền đã chốt trong invoice; danh sách dịch vụ chỉ dùng để hiển thị.
  const serviceAmount = Number(invoice.serviceAmount || 0);
  // Tính lại tiền phòng từ đơn giá lưu trú và số đêm. Dữ liệu hóa đơn cũ có
  // trường hợp đã gộp tiền dịch vụ vào roomAmount nên không dùng số đó làm gốc.
  const roomAmount = Number(invoice.roomAmount || 0);
  const totalAmount = Number(invoice.totalAmount || 0);

  return {
    ...invoice,
    services,
    damages,
    damageAmount,
    lateCheckoutSurcharge,
    roomQuantity: Math.max(finalRooms.length, Number(row.room_quantity || 1)),
    booking_rooms: finalRooms,
    roomAmount,
    serviceAmount,
    surchargeAmount,
    subtotal: Number(invoice.subtotal || roomAmount + serviceAmount + surchargeAmount),
    totalAmount
  };
};

const issueInvoiceForPayment = async (paymentId, connection) => {
  const payment = await paymentModel.getPaymentById(paymentId, connection, !!connection);
  if (!payment) {
    throw new HttpError(404, 'Không tìm thấy thanh toán');
  }

  const roomAmount = Number(payment.roomAmount ?? 0);
  const serviceAmount = Number(payment.serviceAmount ?? 0);
  const surchargeAmount = Number(payment.surchargeAmount ?? 0);
  const discountAmount = Number(payment.discountAmount ?? 0);
  const subtotal = roomAmount + serviceAmount + surchargeAmount;

  const snapshot = {
    paymentId: payment.id,
    roomAmount,
    serviceAmount,
    surchargeAmount,
    subtotal,
    discountAmount,
    totalAmount: Number(payment.totalAmount)
  };
  const existing = await invoiceModel.getInvoiceByBookingId(payment.bookingId, connection);
  if (existing) {
    await invoiceModel.updateInvoiceAmounts(existing.id, snapshot, connection);
    return enrichInvoiceWithServices(
      await invoiceModel.getInvoiceById(existing.id, connection),
      connection
    );
  }

  const invoiceCode = await buildInvoiceCode(connection);
  const invoiceId = await invoiceModel.createInvoice(
    {
      invoiceCode,
      bookingId: payment.bookingId,
      paymentId: snapshot.paymentId,
      roomAmount: snapshot.roomAmount,
      serviceAmount: snapshot.serviceAmount,
      surchargeAmount: snapshot.surchargeAmount,
      subtotal: snapshot.subtotal,
      discountAmount: snapshot.discountAmount,
      taxAmount: 0,
      totalAmount: snapshot.totalAmount,
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

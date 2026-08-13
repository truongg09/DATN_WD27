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

const DAY_NAMES_VI = [
  'Chủ nhật',
  'Thứ hai',
  'Thứ ba',
  'Thứ tư',
  'Thứ năm',
  'Thứ sáu',
  'Thứ bảy'
];

const enrichInvoiceWithServices = async (row, connection) => {
  const invoice = formatInvoice(row);
  const [serviceRows, nightlyRows, transferRows, damageRows] = await Promise.all([
    invoiceModel.listInvoiceServices(invoice.bookingId, connection),
    invoiceModel.listInvoiceNightlyPrices(invoice.bookingId, connection),
    invoiceModel.listInvoiceTransfers(invoice.bookingId, connection),
    invoiceModel.listInvoiceDamages(invoice.bookingId, connection)
  ]);

  const services = serviceRows.map((service) => ({
    serviceId: Number(service.serviceId),
    serviceName: service.serviceName,
    quantity: Number(service.quantity ?? 0),
    unitPrice: Number(service.unitPrice ?? 0),
    totalPrice: Number(service.totalPrice ?? 0)
  }));

  const damages = damageRows.map((d) => ({
    id: Number(d.id),
    chargeType: d.chargeType,
    itemName: d.itemName,
    quantity: Number(d.quantity ?? 1),
    unitPrice: Number(d.unitPrice ?? 0),
    totalPrice: Number(d.totalPrice ?? 0),
    roomNumber: d.roomNumber,
    note: d.note,
    createdAt: d.createdAt
  }));

  const transfers = transferRows.map((t) => ({
    id: Number(t.id),
    fromRoomId: Number(t.fromRoomId),
    fromRoomNumber: t.fromRoomNumber,
    toRoomId: Number(t.toRoomId),
    toRoomNumber: t.toRoomNumber,
    fromDate: t.fromDate,
    toDate: t.toDate,
    pricePerNight: Number(t.pricePerNight ?? 0),
    reason: t.reason,
    createdAt: t.createdAt
  }));

  const checkInDate = new Date(invoice.checkIn);
  const checkOutDate = new Date(invoice.checkOut);
  const totalNightsCalculated = Math.max(1, Math.round((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));

  let effectiveNightlyRows = nightlyRows;
  const basePricePerNight = invoice.stayRoomAmount && totalNightsCalculated > 0
    ? Math.round(invoice.stayRoomAmount / totalNightsCalculated)
    : (row.room_price ? Number(row.room_price) : 0);

  if (effectiveNightlyRows.length === 0 && invoice.checkIn && invoice.checkOut) {
    try {
      const bookingService = require('./bookingService');
      const calcResult = await bookingService.calcNightlyPrices(
        row.roomTypeId || row.room_type_id,
        basePricePerNight,
        invoice.checkIn,
        invoice.checkOut,
        connection,
        row.room_id || row.roomId
      );
      effectiveNightlyRows = calcResult.prices.map((p) => ({
        id: null,
        stayDate: p.stayDate || p.date,
        price: p.price,
        priceType: p.priceType,
        note: p.note,
        roomId: row.room_id || row.roomId,
        roomNumber: row.room_number || invoice.roomNumber
      }));
    } catch (calcErr) {
      console.warn('Fallback calcNightlyPrices in invoiceService warning:', calcErr.message);
    }
  }

  const totalNights = effectiveNightlyRows.length || totalNightsCalculated;

  const nightlyPrices = effectiveNightlyRows.map((n) => {
    const d = new Date(`${n.stayDate}T00:00:00Z`);
    const day = d.getUTCDay();
    const isHoliday = n.priceType === 'holiday';
    const isSunday = day === 0 || n.priceType === 'sunday';
    const isSaturday = day === 6 || (n.priceType === 'weekend' && !isSunday);
    const nightPrice = Number(n.price ?? 0);
    const basePrice = basePricePerNight || nightPrice;
    const surcharge = Math.max(0, nightPrice - basePrice);

    return {
      id: n.id,
      stayDate: n.stayDate,
      dayName: DAY_NAMES_VI[day] || '',
      price: nightPrice,
      basePrice,
      surcharge,
      priceType: n.priceType || 'normal',
      isHoliday,
      isSunday,
      isSaturday,
      isWeekend: isSunday || isSaturday,
      note: n.note,
      roomId: n.roomId,
      roomNumber: n.roomNumber
    };
  });

  const baseRoomAmount = nightlyPrices.length > 0 && basePricePerNight > 0
    ? nightlyPrices.length * basePricePerNight
    : Number(invoice.roomAmount || 0);

  const holidaySurcharge = nightlyPrices
    .filter((p) => p.isHoliday)
    .reduce((sum, p) => sum + Math.max(0, p.price - (basePricePerNight || p.price)), 0);

  const sundaySurcharge = nightlyPrices
    .filter((p) => p.isSunday && !p.isHoliday)
    .reduce((sum, p) => sum + Math.max(0, p.price - (basePricePerNight || p.price)), 0);

  const weekendSurcharge = nightlyPrices
    .filter((p) => p.isSaturday && !p.isHoliday)
    .reduce((sum, p) => sum + Math.max(0, p.price - (basePricePerNight || p.price)), 0);

  const damageAmount = damages.reduce((sum, d) => sum + d.totalPrice, 0);
  const serviceAmount = Number(invoice.serviceAmount || 0);
  const occupancySurcharge = Number(invoice.occupancySurcharge || 0);
  const roomAmount = Number(invoice.roomAmount || 0);
  const surchargeAmount = Number(invoice.surchargeAmount || 0);
  const discountAmount = Number(invoice.discountAmount || 0);
  const totalAmount = Number(invoice.totalAmount || 0);

  const breakdown = {
    basePricePerNight,
    totalNights,
    baseRoomAmount,
    holidaySurcharge,
    sundaySurcharge,
    weekendSurcharge,
    occupancySurcharge,
    damageAmount,
    serviceAmount,
    discountAmount,
    roomAmount,
    surchargeAmount,
    totalAmount
  };

  return {
    ...invoice,
    services,
    damages,
    transfers,
    nightlyPrices,
    breakdown,
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

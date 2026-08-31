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
  const [serviceRows, nightlyRows, transferRows, damageRows, roomRows, lateChargeRows] = await Promise.all([
    invoiceModel.listInvoiceServices(invoice.bookingId, connection),
    invoiceModel.listInvoiceNightlyPrices(invoice.bookingId, connection),
    invoiceModel.listInvoiceTransfers(invoice.bookingId, connection),
    invoiceModel.listInvoiceDamages(invoice.bookingId, connection),
    invoiceModel.listInvoiceRooms(invoice.bookingId, connection),
    invoiceModel.listInvoiceLateCharges(invoice.bookingId, connection)
  ]);

  const rooms = roomRows.map((r) => ({
    bookingDetailId: r.bookingDetailId ? Number(r.bookingDetailId) : null,
    roomId: r.roomId ? Number(r.roomId) : null,
    roomNumber: r.roomNumber || (r.roomId ? `P.${r.roomId}` : 'Chưa xếp'),
    roomTypeId: r.roomTypeId ? Number(r.roomTypeId) : null,
    typeName: r.typeName || 'Chưa cập nhật',
    roomTypeName: r.typeName || 'Chưa cập nhật',
    roomPrice: Number(r.roomPrice ?? 0),
    checkInDate: r.checkInDate || invoice.checkIn,
    checkOutDate: r.checkOutDate || invoice.checkOut,
    adults: Number(r.adults ?? 1),
    children: Number(r.children ?? 0),
    occupancySurcharge: Number(r.occupancySurcharge ?? 0)
  }));

  const roomNumbers = rooms.map((r) => r.roomNumber).filter(Boolean);
  const roomNumber = roomNumbers.length > 0 ? roomNumbers.join(', ') : (row.room_number || invoice.roomNumber || 'Chưa xếp');

  const roomTypeNames = [...new Set(rooms.map((r) => r.typeName).filter(Boolean))];
  const roomTypeName = roomTypeNames.length > 0 ? roomTypeNames.join(', ') : (row.room_type_name || invoice.roomTypeName || 'Chưa cập nhật');

  const checkInDates = rooms.map((r) => r.checkInDate).filter(Boolean).sort();
  const checkOutDates = rooms.map((r) => r.checkOutDate).filter(Boolean).sort();
  const checkIn = checkInDates[0] || invoice.checkIn;
  const checkOut = checkOutDates[checkOutDates.length - 1] || invoice.checkOut;

  const totalOccupancySurcharge = rooms.reduce((sum, r) => sum + r.occupancySurcharge, 0);
  const totalChildrenCount = rooms.reduce((sum, r) => sum + r.children, 0);

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

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const totalNightsCalculated = Math.max(1, Math.round((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));

  const totalRoomBasePricePerNight = rooms.reduce((sum, r) => sum + r.roomPrice, 0);
  const basePricePerNight = totalRoomBasePricePerNight > 0
    ? totalRoomBasePricePerNight
    : (invoice.stayRoomAmount && totalNightsCalculated > 0
      ? Math.round(invoice.stayRoomAmount / totalNightsCalculated)
      : (row.room_price ? Number(row.room_price) : 0));

  let effectiveNightlyRows = nightlyRows;

  if (effectiveNightlyRows.length === 0 && checkIn && checkOut) {
    try {
      const bookingService = require('./bookingService');
      const firstRoomTypeId = rooms[0]?.roomTypeId || row.roomTypeId || row.room_type_id;
      const firstRoomId = rooms[0]?.roomId || row.room_id || row.roomId;
      const calcResult = await bookingService.calcNightlyPrices(
        firstRoomTypeId,
        basePricePerNight,
        checkIn,
        checkOut,
        connection,
        firstRoomId
      );
      effectiveNightlyRows = calcResult.prices.map((p) => ({
        id: null,
        stayDate: p.stayDate || p.date,
        price: p.price,
        priceType: p.priceType,
        note: p.note,
        roomId: firstRoomId,
        roomNumber: roomNumber
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
      roomNumber: n.roomNumber || (n.roomId ? `P.${n.roomId}` : roomNumber)
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

  const lateCharges = lateChargeRows.map((l) => ({
    id: Number(l.id),
    name: 'Phụ thu trả phòng muộn',
    lateMinutes: Number(l.lateMinutes ?? 0),
    tierPercent: Number(l.tierPercent ?? 0),
    nightlyRate: Number(l.nightlyRate ?? 0),
    totalPrice: Number(l.totalPrice ?? 0),
    note: l.note || (l.lateMinutes ? `Trễ ${l.lateMinutes} phút (${l.tierPercent}%)` : 'Phụ thu trả phòng muộn'),
    createdAt: l.createdAt
  }));

  const damageAmount = damages.reduce((sum, d) => sum + d.totalPrice, 0);
  const lateCheckoutAmount = lateCharges.reduce((sum, l) => sum + l.totalPrice, 0);
  const serviceAmount = Number(invoice.serviceAmount || 0);
  const occupancySurcharge = Math.max(Number(invoice.occupancySurcharge || 0), totalOccupancySurcharge);
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
    lateCheckoutAmount,
    lateCheckoutSurcharge: lateCheckoutAmount,
    serviceAmount,
    discountAmount,
    roomAmount,
    surchargeAmount,
    totalAmount
  };

  return {
    ...invoice,
    roomNumber,
    roomTypeName,
    checkIn,
    checkOut,
    childrenCount: totalChildrenCount || Number(invoice.childrenCount || 0),
    occupancySurcharge,
    rooms,
    services,
    damages,
    lateCharges,
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
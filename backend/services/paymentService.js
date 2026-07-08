const db = require('../config/db');
const paymentModel = require('../models/paymentModel');
const bookingModel = require('../models/bookingModel');
const invoiceService = require('./invoiceService');
const HttpError = require('../utils/httpError');
const { formatPayment } = require('../utils/formatters');

const buildPaymentAmounts = ({
  roomAmount,
  serviceAmount = 0,
  surchargeAmount = 0,
  discountAmount = 0,
  depositAmount = 0
}) => {
  const totalAmount = roomAmount + serviceAmount + surchargeAmount - discountAmount;
  const paidAmount = Math.min(depositAmount, totalAmount);
  const remainingAmount = totalAmount - paidAmount;

  return {
    roomAmount,
    serviceAmount,
    surchargeAmount,
    discountAmount,
    depositAmount,
    paidAmount,
    remainingAmount,
    totalAmount,
    paymentStatus: remainingAmount <= 0 ? 'paid' : 'unpaid'
  };
};

const generateTransactionCode = (method) => {
  const prefix =
    method === 'momo' ? 'MOMO'
      : method === 'vnpay' ? 'VNPAY'
        : method === 'bank_transfer' ? 'BANK'
          : 'CASH';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

const createPaymentForBooking = async (bookingId, options = {}, connection) => {
  const booking = await bookingModel.getBookingById(bookingId, connection, !!connection);
  if (!booking) {
    throw new HttpError(404, 'Booking not found');
  }

  const existing = await paymentModel.getPaymentByBookingId(bookingId, connection);
  if (existing) {
    return formatPayment(existing);
  }

  const amounts = buildPaymentAmounts({
    roomAmount: Number(booking.total_price),
    serviceAmount: options.serviceAmount || 0,
    surchargeAmount: options.surchargeAmount || 0,
    discountAmount: options.discountAmount || 0,
    depositAmount: options.depositAmount || 0
  });

  const paymentId = await paymentModel.createPayment(
    {
      bookingId,
      ...amounts,
      paymentMethod: options.paymentMethod || null
    },
    connection
  );

  const payment = await paymentModel.getPaymentById(paymentId, connection);
  return formatPayment(payment);
};

const createPayment = async (payload) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const payment = await createPaymentForBooking(payload.bookingId, payload, connection);
    await connection.commit();
    return payment;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const recalculatePaymentForBooking = async (bookingId, connection) => {
  const booking = await bookingModel.getBookingById(bookingId, connection, !!connection);
  if (!booking) {
    throw new HttpError(404, 'Booking not found');
  }

  const payment = await paymentModel.getPaymentByBookingId(bookingId, connection);
  if (!payment) {
    return null;
  }

  const roomAmount = Number(booking.total_price || 0);
  const serviceAmount = await bookingModel.sumBookingServices(bookingId, connection);
  const surchargeAmount = await bookingModel.sumDamageCharges(bookingId, connection);
  const discountAmount = Number(payment.discountAmount || 0);
  const paidAmount = Number(payment.paidAmount || 0);
  const totalAmount = Math.max(roomAmount + serviceAmount + surchargeAmount - discountAmount, 0);
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);

  await paymentModel.updatePayment(
    payment.id,
    {
      roomAmount,
      serviceAmount,
      totalAmount,
      remainingAmount,
      paymentStatus: remainingAmount <= 0 ? 'paid' : 'unpaid'
    },
    connection
  );

  const updatedPayment = await paymentModel.getPaymentById(payment.id, connection);
  return formatPayment(updatedPayment);
};

const listPayments = async (filters) => {
  const rows = await paymentModel.listPayments(filters);
  return rows.map(formatPayment);
};

const getPaymentById = async (paymentId) => {
  const payment = await paymentModel.getPaymentById(paymentId);
  if (!payment) {
    throw new HttpError(404, 'Payment not found');
  }
  return formatPayment(payment);
};

const getPaymentByBookingId = async (bookingId) => {
  const payment = await paymentModel.getPaymentByBookingId(bookingId);
  if (!payment) {
    throw new HttpError(404, 'Payment not found for this booking');
  }
  return formatPayment(payment);
};

const ROOM_TAKEN_MESSAGE = 'Phòng vừa được đặt bởi khách khác, vui lòng đặt phòng khác!';

const processPayment = async (paymentId, payload) => {
  const connection = await db.getConnection();
  let committed = false;

  try {
    await connection.beginTransaction();

    await bookingModel.expireUnpaidBookingHolds(connection);

    const payment = await paymentModel.getPaymentById(paymentId, connection, true);
    if (!payment) {
      throw new HttpError(404, 'Payment not found');
    }

    if (payment.paymentStatus === 'paid') {
      throw new HttpError(409, 'Payment is already completed');
    }

    if (payment.paymentStatus === 'refunded') {
      throw new HttpError(409, 'Cannot pay a refunded payment');
    }

    const booking = await bookingModel.getBookingById(payment.bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Booking not found');
    }

    await bookingModel.getRoomWithType(booking.room_id, connection, true);

    if (booking.status === 'cancelled') {
      const lostRace = await bookingModel.getSecuredConflictingBookings(
        booking.room_id,
        booking.check_in,
        booking.check_out,
        connection,
        false,
        { excludeBookingId: booking.id }
      );

      throw new HttpError(
        409,
        lostRace.length > 0
          ? ROOM_TAKEN_MESSAGE
          : 'Đặt phòng đã hết thời gian giữ chỗ, vui lòng đặt lại phòng khác'
      );
    }

    const conflicts = await bookingModel.getSecuredConflictingBookings(
      booking.room_id,
      booking.check_in,
      booking.check_out,
      connection,
      true,
      { excludeBookingId: booking.id }
    );

    if (conflicts.length > 0) {
      await bookingModel.updateBookingStatus(booking.id, 'cancelled', connection);
      await connection.commit();
      committed = true;
      throw new HttpError(409, ROOM_TAKEN_MESSAGE);
    }

    const payAmount = payload.amount ?? Number(payment.remainingAmount);
    if (payAmount <= 0) {
      throw new HttpError(400, 'Payment amount must be greater than 0');
    }

    if (payAmount > Number(payment.remainingAmount)) {
      throw new HttpError(400, 'Payment amount exceeds remaining balance');
    }

    // Đặt cọc (trả một phần khi chưa trả gì) là thanh toán từ xa -> không nhận tiền mặt
    const isDepositPayment =
      Number(payment.paidAmount) === 0 && payAmount < Number(payment.remainingAmount);
    if (isDepositPayment && payload.paymentMethod === 'cash') {
      throw new HttpError(
        400,
        'Đặt cọc giữ phòng phải thanh toán từ xa (chuyển khoản QR/MoMo/VNPay). Tiền mặt chỉ áp dụng khi thanh toán tại khách sạn.'
      );
    }

    const newPaidAmount = Number(payment.paidAmount) + payAmount;
    const newRemainingAmount = Number(payment.totalAmount) - newPaidAmount;
    const isFullyPaid = newRemainingAmount <= 0;
    const transactionCode = generateTransactionCode(payload.paymentMethod);
    const paymentDate = new Date();

    await paymentModel.updatePayment(
      paymentId,
      {
        paymentMethod: payload.paymentMethod,
        paidAmount: newPaidAmount,
        remainingAmount: Math.max(newRemainingAmount, 0),
        paymentStatus: isFullyPaid ? 'paid' : 'unpaid',
        transactionCode,
        paymentDate
      },
      connection
    );

    await bookingModel.updateBookingStatus(booking.id, 'confirmed', connection);
    await bookingModel.cancelCompetingUnpaidBookings(
      booking.room_id,
      booking.check_in,
      booking.check_out,
      booking.id,
      connection
    );

    let invoice = null;
    if (isFullyPaid) {
      invoice = await invoiceService.issueInvoiceForPayment(paymentId, connection);
    }

    await connection.commit();
    committed = true;

    const updatedPayment = await paymentModel.getPaymentById(paymentId);
    return {
      payment: formatPayment(updatedPayment),
      invoice,
      redirectUrl:
        payload.paymentMethod === 'momo'
          ? `https://test-payment.momo.vn/pay?txn=${transactionCode}`
          : payload.paymentMethod === 'vnpay'
            ? `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=${transactionCode}`
            : null
    };
  } catch (error) {
    if (!committed) {
      await connection.rollback();
    }
    throw error;
  } finally {
    connection.release();
  }
};

const refundPayment = async (paymentId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const payment = await paymentModel.getPaymentById(paymentId, connection, true);
    if (!payment) {
      throw new HttpError(404, 'Payment not found');
    }

    if (payment.paymentStatus !== 'paid') {
      throw new HttpError(409, 'Only paid payments can be refunded');
    }

    await paymentModel.updatePayment(
      paymentId,
      {
        paymentStatus: 'refunded',
        paidAmount: 0,
        remainingAmount: payment.totalAmount,
        paymentDate: null,
        transactionCode: null
      },
      connection
    );

    await connection.commit();
    const updatedPayment = await paymentModel.getPaymentById(paymentId);
    return formatPayment(updatedPayment);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  createPaymentForBooking,
  createPayment,
  recalculatePaymentForBooking,
  listPayments,
  getPaymentById,
  getPaymentByBookingId,
  processPayment,
  refundPayment
};
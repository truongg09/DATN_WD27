const db = require('../config/db');
const paymentModel = require('../models/paymentModel');
const bookingModel = require('../models/bookingModel');
const invoiceService = require('./invoiceService');
const emailService = require('./emailService');
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

  const paymentStatus = remainingAmount <= 0
    ? 'paid'
    : paidAmount > 0
      ? 'deposit_paid'
      : 'unpaid';

  return {
    roomAmount,
    serviceAmount,
    surchargeAmount,
    discountAmount,
    depositAmount,
    paidAmount,
    remainingAmount,
    totalAmount,
    paymentStatus
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

const createGatewayOrder = async (paymentId, { paymentMethod, amount, ipAddress }) => {
  if (!['momo', 'vnpay'].includes(paymentMethod)) {
    throw new HttpError(400, 'Gateway payment method must be momo or vnpay');
  }
  const payment = await getPaymentById(paymentId);
  if (payment.paymentStatus === 'paid' || payment.paymentStatus === 'refunded') {
    throw new HttpError(409, 'Payment cannot be sent to gateway');
  }
  const payableAmount = Number(amount ?? payment.remainingAmount);
  if (payableAmount <= 0 || payableAmount > Number(payment.remainingAmount)) {
    throw new HttpError(400, 'Invalid gateway payment amount');
  }
  const orderId = `${paymentMethod.toUpperCase()}-${payment.id}-${Date.now()}`;
  const orderInfo = `Thanh toan booking ${payment.bookingId}`;
  await paymentModel.updatePayment(payment.id, { paymentMethod, transactionCode: orderId });
  const gateway = require('./paymentGatewayService');
  const paymentUrl = paymentMethod === 'vnpay'
    ? gateway.createVnpayUrl({ orderId, amount: payableAmount, orderInfo, ipAddress })
    : await gateway.createMomoPayment({ orderId, bookingId: payment.bookingId, amount: payableAmount, orderInfo });
  return { orderId, paymentUrl };
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

  const occupancySurcharge = Number(booking.occupancy_surcharge || 0);
  const amounts = buildPaymentAmounts({
    roomAmount: Math.max(Number(booking.total_price || 0) - occupancySurcharge, 0),
    serviceAmount: options.serviceAmount || 0,
    surchargeAmount: occupancySurcharge + Number(options.surchargeAmount || 0),
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

  const guestSurcharge = Number(booking.occupancy_surcharge || 0);
  const roomAmount = Math.max(Number(booking.total_price || 0) - guestSurcharge, 0);
  const serviceAmount = await bookingModel.sumBookingServices(bookingId, connection);
  const damageSurcharge = await bookingModel.sumDamageCharges(bookingId, connection);
  const surchargeAmount = guestSurcharge + damageSurcharge;
  const discountAmount = Number(payment.discountAmount || 0);
  const paidAmount = Number(payment.paidAmount || 0);
  const totalAmount = Math.max(roomAmount + serviceAmount + surchargeAmount - discountAmount, 0);
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);

  const paymentStatus = remainingAmount <= 0
    ? 'paid'
    : paidAmount > 0
      ? 'deposit_paid'
      : 'unpaid';

  await paymentModel.updatePayment(
    payment.id,
    {
      roomAmount,
      serviceAmount,
      surchargeAmount,
      totalAmount,
      remainingAmount,
      paymentStatus
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

    const transactionCode = generateTransactionCode(payload.paymentMethod);
    const isOnline = ['momo', 'vnpay'].includes(payload.paymentMethod);

    if (isOnline) {
      // Just save the method & transaction code, leave status unpaid until they confirm on the sandbox page
      await paymentModel.updatePayment(
        paymentId,
        {
          paymentMethod: payload.paymentMethod,
          transactionCode
        },
        connection
      );

      await connection.commit();

      const updatedPayment = await paymentModel.getPaymentById(paymentId);
      return {
        payment: formatPayment(updatedPayment),
        invoice: null,
        redirectUrl: `/booking/${booking.id}/payment/sandbox?method=${payload.paymentMethod}&amount=${payAmount}&txn=${transactionCode}`
      };
    }

    // Cash payment processed immediately
    const newPaidAmount = Number(payment.paidAmount) + payAmount;
    const newRemainingAmount = Number(payment.totalAmount) - newPaidAmount;
    const isFullyPaid = newRemainingAmount <= 0;
    const paymentDate = new Date();

    await paymentModel.updatePayment(
      paymentId,
      {
        paymentMethod: payload.paymentMethod,
        paidAmount: newPaidAmount,
        remainingAmount: Math.max(newRemainingAmount, 0),
        paymentStatus: isFullyPaid ? 'paid' : 'deposit_paid',
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
    const updatedBooking = await bookingModel.getBookingById(booking.id);
    void emailService.sendPaymentConfirmation(updatedBooking, formatPayment(updatedPayment));
    return {
      payment: formatPayment(updatedPayment),
      invoice,
      redirectUrl: null
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const confirmPayment = async (paymentId, payload) => {
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

    if (booking.status === 'cancelled') {
      throw new HttpError(409, 'Đặt phòng đã hết thời gian giữ chỗ, vui lòng đặt lại phòng khác');
    }

    const conflicts = await bookingModel.getConflictingBookings(
      booking.room_id,
      booking.check_in,
      booking.check_out,
      connection,
      true,
      { excludeBookingId: booking.id }
    );

    if (conflicts.length > 0) {
      await bookingModel.updateBookingStatus(booking.id, 'cancelled', connection);
      throw new HttpError(409, 'Phòng vừa được đặt bởi khách khác, vui lòng đặt phòng khác!');
    }

    const payAmount = Number(payload.amount);
    if (payAmount <= 0) {
      throw new HttpError(400, 'Payment amount must be greater than 0');
    }

    if (payAmount > Number(payment.remainingAmount)) {
      throw new HttpError(400, 'Payment amount exceeds remaining balance');
    }

    const newPaidAmount = Number(payment.paidAmount) + payAmount;
    const newRemainingAmount = Number(payment.totalAmount) - newPaidAmount;
    const isFullyPaid = newRemainingAmount <= 0;
    const transactionCode = payload.transactionCode || payment.transactionCode || generateTransactionCode(payment.paymentMethod);
    const paymentDate = new Date();

    await paymentModel.updatePayment(
      paymentId,
      {
        paidAmount: newPaidAmount,
        remainingAmount: Math.max(newRemainingAmount, 0),
        paymentStatus: isFullyPaid ? 'paid' : 'unpaid',
        transactionCode,
        paymentDate
      },
      connection
    );

    // Update booking status to confirmed if it was pending
    if (booking.status === 'pending') {
      await bookingModel.updateBookingStatus(booking.id, 'confirmed', connection);
    }

    let invoice = null;
    if (isFullyPaid) {
      invoice = await invoiceService.issueInvoiceForPayment(paymentId, connection);
    }

    await connection.commit();
    committed = true;

    const updatedPayment = await paymentModel.getPaymentById(paymentId);
    return {
      payment: formatPayment(updatedPayment),
      invoice
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

const settleGatewayPayment = async ({ orderId, paymentMethod, amount }) => {
  const payment = await paymentModel.getPaymentByTransactionCode(orderId);
  if (!payment) throw new HttpError(404, 'Gateway order not found');
  if (payment.paymentStatus === 'paid') return formatPayment(payment);
  if (payment.paymentStatus === 'refunded') throw new HttpError(409, 'Payment was refunded');
  const paid = Number(amount);
  if (!Number.isFinite(paid) || paid <= 0 || paid > Number(payment.remainingAmount)) {
    throw new HttpError(400, 'Gateway amount is invalid');
  }
  const result = await processPayment(payment.id, { paymentMethod, amount: paid });
  return result.payment;
};

const submitTransferConfirmation = async (paymentId, payload) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const payment = await paymentModel.getPaymentById(paymentId, connection, true);
    if (!payment) throw new HttpError(404, 'Payment not found');
    if (payment.paymentStatus === 'paid' || payment.paymentStatus === 'refunded') {
      throw new HttpError(409, 'Payment cannot be submitted for verification');
    }
    if (payload.paymentMethod !== 'bank_transfer') {
      throw new HttpError(400, 'Only bank transfer can be manually verified');
    }
    const amount = Number(payload.amount ?? payment.remainingAmount);
    if (amount <= 0 || amount > Number(payment.remainingAmount)) {
      throw new HttpError(400, 'Verification amount is invalid');
    }
    await paymentModel.upsertConfirmationRequest({
      paymentId: payment.id,
      bookingId: payment.bookingId,
      amount,
      paymentMethod: payload.paymentMethod,
      note: payload.note
    }, connection);
    await connection.commit();
    return formatPayment(await paymentModel.getPaymentById(paymentId));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const confirmTransferPayment = async (paymentId, confirmedBy) => {
  const request = await paymentModel.getConfirmationRequest(paymentId);
  if (!request) throw new HttpError(404, 'Payment verification request not found');
  if (request.status !== 'pending') throw new HttpError(409, 'Payment verification request is no longer pending');

  // Only this server-side confirmation calls processPayment, which is the only
  // point where paidAmount and paymentStatus may be changed for a bank transfer.
  const result = await processPayment(paymentId, {
    paymentMethod: 'bank_transfer',
    amount: Number(request.amount)
  });
  await paymentModel.confirmConfirmationRequest(paymentId, confirmedBy);
  return result.payment;
};

module.exports = {
  createPaymentForBooking,
  createPayment,
  createGatewayOrder,
  settleGatewayPayment,
  submitTransferConfirmation,
  confirmTransferPayment,
  recalculatePaymentForBooking,
  listPayments,
  getPaymentById,
  getPaymentByBookingId,
  processPayment,
  confirmPayment,
  refundPayment
};

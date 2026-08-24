const db = require('../config/db');
const paymentModel = require('../models/paymentModel');
const bookingModel = require('../models/bookingModel');
const invoiceModel = require('../models/invoiceModel');
const invoiceService = require('./invoiceService');
const voucherService = require('./voucherService');
const emailService = require('./emailService');
const HttpError = require('../utils/httpError');
const { formatPayment } = require('../utils/formatters');
const { getCheckOutDeadline } = require('../utils/bookingPolicy');

const GATEWAY_PAYMENT_MINUTES = 15;

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

const paymentMethodLabel = (method) => ({
  cash: 'tiền mặt',
  bank_transfer: 'chuyển khoản',
  vnpay: 'VNPay',
  zalopay: 'ZaloPay',
  credit_card: 'thẻ tín dụng'
}[method] || method || 'khác');

const money = (amount) => `${Number(amount || 0).toLocaleString('vi-VN')}₫`;

// Ghi dấu vết thanh toán vào lịch sử đặt phòng (booking_history).
// Không ném lỗi: sự cố ghi log không được làm hỏng giao dịch tiền đã nhận.
const logBookingHistory = async (bookingId, action, description, extra, actor, connection) => {
  try {
    let actorName = null;
    if (actor?.userId) {
      actorName = await bookingModel.getActorDisplayName(actor.userId, connection);
    }
    await bookingModel.addBookingHistory(
      bookingId,
      {
        action,
        description,
        // Mọi mốc từ luồng thanh toán đều gắn vào nhóm 'payment' trừ khi nơi
        // gọi chỉ định khác (VD phòng bị gỡ thì gắn vào phòng).
        entityType: extra?.entityType || 'payment',
        entityId: extra?.entityId,
        entityLabel: extra?.entityLabel,
        oldValue: extra?.oldValue,
        newValue: extra?.newValue,
        amount: extra?.amount,
        actorId: actor?.userId || null,
        actorName: actorName || actor?.email || null,
        actorRole: actor?.role || 'system'
      },
      connection
    );
  } catch (error) {
    console.error('Ghi lịch sử thanh toán thất bại:', error.message);
  }
};

const generateTransactionCode = (method) => {
  const prefix =
    method === 'zalopay' ? 'ZALOPAY'
      : method === 'vnpay' ? 'VNPAY'
        : method === 'bank_transfer' ? 'BANK'
          : 'CASH';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

const getRequiredDepositAmount = (payment) => Math.min(
  Math.ceil(Number(payment.totalAmount) * 0.3),
  Number(payment.remainingAmount)
);

const validatePaymentAmount = (payment, amount) => {
  const payAmount = Number(amount);
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    throw new HttpError(400, 'Số tiền thanh toán phải lớn hơn 0');
  }
  if (payAmount > Number(payment.remainingAmount)) {
    throw new HttpError(400, 'Số tiền thanh toán vượt quá số tiền còn lại');
  }
  const isInitialPartialPayment = Number(payment.paidAmount) === 0
    && payAmount < Number(payment.remainingAmount);
  const requiredDepositAmount = getRequiredDepositAmount(payment);
  if (isInitialPartialPayment && payAmount !== requiredDepositAmount) {
    throw new HttpError(400, `Tiền cọc phải bằng đúng 30% tổng giá trị booking (${money(requiredDepositAmount)})`);
  }
  if (Number(payment.paidAmount) > 0 && payAmount !== Number(payment.remainingAmount)) {
    throw new HttpError(400, 'Sau khi đặt cọc, lần thanh toán tiếp theo phải thanh toán toàn bộ số tiền còn lại');
  }
  return payAmount;
};

const assertAllBookingRoomsAvailable = async (booking, connection) => {
  const stays = await bookingModel.getBookingRoomStays(booking.id, connection, true);
  if (!stays.length) throw new HttpError(409, 'Booking chưa được gán phòng hợp lệ');
  for (const stay of stays) {
    const room = await bookingModel.getRoomWithType(stay.roomId, connection, true);
    if (!room || room.status === 'maintenance') {
      throw new HttpError(409, 'Một phòng trong booking hiện không còn khả dụng');
    }
    const conflicts = await bookingModel.getConflictingBookings(
      stay.roomId, stay.checkIn, stay.checkOut, connection, true, { excludeBookingId: booking.id }
    );
    if (conflicts.length) {
      throw new HttpError(409, 'Một phòng trong booking vừa được khách khác đặt, vui lòng đặt lại');
    }
  }
};

const createGatewayOrder = async (paymentId, { paymentMethod, amount, ipAddress }) => {
  if (!['zalopay', 'vnpay'].includes(paymentMethod)) {
    throw new HttpError(400, 'Gateway payment method must be zalopay or vnpay');
  }
  const connection = await db.getConnection();
  let order;
  try {
  await connection.beginTransaction();
  await bookingModel.expireUnpaidBookingHolds(connection);
  const payment = await paymentModel.getPaymentById(paymentId, connection, true);
  if (!payment) throw new HttpError(404, 'Không tìm thấy thanh toán');
  if (payment.paymentStatus === 'paid' || payment.paymentStatus === 'refunded') {
    throw new HttpError(409, 'Payment cannot be sent to gateway');
  }
  const booking = await bookingModel.getBookingById(payment.bookingId, connection, true);
  if (!booking || booking.status === 'cancelled') {
    throw new HttpError(409, 'Đặt phòng đã hết thời gian giữ chỗ hoặc đã bị hủy, vui lòng đặt lại phòng');
  }
  await assertAllBookingRoomsAvailable(booking, connection);
  const payableAmount = validatePaymentAmount(payment, amount ?? payment.remainingAmount);
  const orderId = paymentMethod === 'zalopay'
    ? `${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(2).replace(/-/g, '')}_${payment.id}_${Date.now()}`
    : `${paymentMethod.toUpperCase()}-${payment.id}-${Date.now()}`;
  // paymentDate belongs to the previously completed installment. Clear it
  // when opening a new gateway order so its callback is processed exactly once.
  // Hạn giữ phòng chỉ áp dụng trước khoản cọc đầu tiên. Khi khách đã cọc,
  // booking đã được bảo đảm và mỗi lần trả phần còn lại có một phiên cổng
  // thanh toán 15 phút độc lập, không bị chặn bởi hold_expires_at cũ.
  const hasSecuredDeposit = Number(payment.paidAmount) > 0
    || payment.paymentStatus === 'deposit_paid';
  const expiresAt = hasSecuredDeposit
    ? new Date(Date.now() + GATEWAY_PAYMENT_MINUTES * 60 * 1000)
    : new Date(booking.hold_expires_at || Date.now());
  const remainingSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  if (paymentMethod === 'zalopay' && remainingSeconds < 305) {
    throw new HttpError(409, 'Cần còn ít nhất 5 phút để thanh toán bằng ZaloPay');
  }
  if (paymentMethod === 'vnpay' && remainingSeconds < 60) {
    throw new HttpError(409, 'Không còn đủ thời gian để tạo giao dịch VNPay');
  }
  if (expiresAt.getTime() <= Date.now()) throw new HttpError(409, 'Booking đã hết thời gian thanh toán');
  await paymentModel.createGatewayOrder({
    paymentId: payment.id, bookingId: booking.id, provider: paymentMethod,
    orderId, amount: payableAmount, expiresAt
  }, connection);
  await paymentModel.updatePayment(payment.id, {
    paymentMethod,
    transactionCode: orderId,
    paymentDate: null
  }, connection);
  await connection.commit();
  order = { orderId, bookingId: payment.bookingId, payableAmount, expiresAt };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  const gateway = require('./paymentGatewayService');
  const orderInfo = `Thanh toan booking ${order.bookingId}`;
  try {
    const paymentUrl = paymentMethod === 'vnpay'
      ? gateway.createVnpayUrl({ orderId: order.orderId, amount: order.payableAmount, orderInfo, ipAddress, expiresAt: order.expiresAt })
      : await gateway.createZalopayPayment({
        orderId: order.orderId, bookingId: order.bookingId, amount: order.payableAmount,
        orderInfo, expiresAt: order.expiresAt
      });
    return { orderId: order.orderId, paymentUrl, expiresAt: order.expiresAt };
  } catch (error) {
    await paymentModel.updateGatewayOrderStatus(order.orderId, 'failed');
    throw error;
  }
};

const createPaymentForBooking = async (bookingId, options = {}, connection) => {
  const booking = await bookingModel.getBookingById(bookingId, connection, !!connection);
  if (!booking) {
    throw new HttpError(404, 'Không tìm thấy đặt phòng');
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
  let committed = false;

  try {
    await connection.beginTransaction();
    const payment = await createPaymentForBooking(payload.bookingId, payload, connection);
    await connection.commit();
    committed = true;
    return payment;
  } catch (error) {
    if (!committed) {
      await connection.rollback();
    }
    throw error;
  } finally {
    connection.release();
  }
};

const recalculatePaymentForBooking = async (bookingId, connection) => {
  const booking = await bookingModel.getBookingById(bookingId, connection, !!connection);
  if (!booking) {
    throw new HttpError(404, 'Không tìm thấy đặt phòng');
  }

  const payment = await paymentModel.getPaymentByBookingId(bookingId, connection);
  if (!payment) {
    return null;
  }

  const guestSurcharge = Number(booking.occupancy_surcharge || 0);
  const roomAmount = Math.max(Number(booking.total_price || 0) - guestSurcharge, 0);
  const serviceAmount = await bookingModel.sumBookingServices(bookingId, connection);
  const damageSurcharge = await bookingModel.sumDamageCharges(bookingId, connection);
  const lateCheckoutSurcharge = await bookingModel.sumLateCheckoutCharges(bookingId, connection);
  const surchargeAmount = guestSurcharge + damageSurcharge + lateCheckoutSurcharge;
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

  try {
    const existingInvoice = await invoiceModel.getInvoiceByBookingId(bookingId, connection);
    if (existingInvoice) {
      await invoiceModel.updateInvoiceAmounts(
        existingInvoice.id,
        {
          paymentId: payment.id,
          roomAmount,
          serviceAmount,
          surchargeAmount,
          subtotal: roomAmount + serviceAmount + surchargeAmount,
          discountAmount,
          totalAmount
        },
        connection
      );
    }
  } catch (invErr) {
    console.warn('Sync invoice in recalculatePaymentForBooking warning:', invErr.message);
  }

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
    throw new HttpError(404, 'Không tìm thấy thanh toán');
  }
  return formatPayment(payment);
};

const getPaymentByBookingId = async (bookingId) => {
  const payment = await paymentModel.getPaymentByBookingId(bookingId);
  if (!payment) {
    throw new HttpError(404, 'Không tìm thấy thanh toán của đặt phòng này');
  }
  return formatPayment(payment);
};

const ROOM_TAKEN_MESSAGE = 'Phòng vừa được đặt bởi khách khác, vui lòng đặt phòng khác!';

const processPayment = async (paymentId, payload, actor = null) => {
  const connection = await db.getConnection();
  let committed = false;

  try {
    await connection.beginTransaction();

    await bookingModel.expireUnpaidBookingHolds(connection);

    const payment = await paymentModel.getPaymentById(paymentId, connection, true);
    if (!payment) {
      throw new HttpError(404, 'Không tìm thấy thanh toán');
    }

    if (payment.paymentStatus === 'paid') {
      await connection.commit();
      committed = true;
      return {
        payment: formatPayment(payment),
        invoice: null,
        redirectUrl: null,
        idempotent: true
      };
    }

    if (payment.paymentStatus === 'refunded') {
      throw new HttpError(409, 'Không thể thanh toán giao dịch đã hoàn tiền');
    }

    const booking = await bookingModel.getBookingById(payment.bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Không tìm thấy đặt phòng');
    }

    await assertAllBookingRoomsAvailable(booking, connection);
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

    const payAmount = validatePaymentAmount(payment, payload.amount ?? Number(payment.remainingAmount));
    if (payAmount <= 0) {
      throw new HttpError(400, 'Số tiền thanh toán phải lớn hơn 0');
    }

    if (payAmount > Number(payment.remainingAmount)) {
      throw new HttpError(400, 'Số tiền thanh toán vượt quá số dư còn lại');
    }

    // Đặt cọc (trả một phần khi chưa trả gì) là thanh toán từ xa -> không nhận tiền mặt
    const isDepositPayment =
      Number(payment.paidAmount) === 0 && payAmount < Number(payment.remainingAmount);
    if (isDepositPayment && payload.paymentMethod === 'cash') {
      throw new HttpError(
        400,
        'Đặt cọc giữ phòng phải thanh toán từ xa (chuyển khoản QR/ZaloPay/VNPay). Tiền mặt chỉ áp dụng khi thanh toán tại khách sạn.'
      );
    }
    if (
      ['zalopay', 'vnpay'].includes(payload.paymentMethod) &&
      payload.sandbox !== true
    ) {
      throw new HttpError(400, 'Giao dịch thử nghiệm phải được thực hiện qua cổng Sandbox');
    }

    const transactionCode = generateTransactionCode(payload.paymentMethod);
    const isOnline = ['zalopay', 'vnpay'].includes(payload.paymentMethod);

    if (isOnline) {
      // Compatibility for older frontend bundles that still call /pay:
      // always send online payments through the real sandbox gateway instead
      // of the removed local simulation page.
      await connection.commit();
      const gatewayOrder = await createGatewayOrder(paymentId, {
        paymentMethod: payload.paymentMethod,
        amount: payAmount
      });
      return {
        payment: formatPayment(await paymentModel.getPaymentById(paymentId)),
        invoice: null,
        redirectUrl: gatewayOrder.paymentUrl
      };
    }

    // Cash payment processed immediately
    const newPaidAmount = Number(payment.paidAmount) + payAmount;
    const newRemainingAmount = Number(payment.totalAmount) - newPaidAmount;
    const isFullyPaid = newRemainingAmount <= 0;
    const isInitialDeposit = Number(payment.paidAmount) === 0 && !isFullyPaid;
    const paymentDate = new Date();

    await paymentModel.updatePayment(
      paymentId,
      {
        paymentMethod: payload.paymentMethod,
        depositAmount: isInitialDeposit ? payAmount : Number(payment.depositAmount || 0),
        paidAmount: newPaidAmount,
        remainingAmount: Math.max(newRemainingAmount, 0),
        paymentStatus: isFullyPaid ? 'paid' : 'deposit_paid',
        transactionCode,
        paymentDate
      },
      connection
    );

    // Chỉ xác nhận đơn đang chờ. Khách đang lưu trú trả thêm tiền dịch vụ/hư
    // hỏng mà bị đưa ngược về 'confirmed' thì không check-out được nữa.
    if (['pending', 'confirmed'].includes(booking.status)) {
      await bookingModel.updateBookingStatus(booking.id, 'confirmed', connection);
    } else if (booking.status === 'no_show') {
      // Khách đã bị đánh no-show nhưng nay trả tiền và kỳ nghỉ vẫn chưa kết
      // thúc thì rõ ràng họ vẫn đến. Không mở lại thì đơn kẹt ở no-show vĩnh
      // viễn, lễ tân không check-in được dù khách đã thanh toán đủ.
      const stayDeadline = getCheckOutDeadline(
        booking.check_out,
        booking.requested_check_out_time
      );
      if (new Date() <= stayDeadline) {
        await bookingModel.updateBookingStatus(booking.id, 'confirmed', connection);
        await logBookingHistory(
          booking.id,
          'status_change',
          'Khách đã thanh toán nên đơn được mở lại từ trạng thái khách không đến về đã xác nhận.',
          {
            oldValue: { status: 'no_show' },
            newValue: { status: 'confirmed' }
          },
          actor,
          connection
        );
      }
    }
    await bookingModel.cancelCompetingUnpaidBookings(
      booking.room_id,
      booking.check_in,
      booking.check_out,
      booking.id,
      connection
    );

    await logBookingHistory(
      booking.id,
      'payment',
      `Nhận thanh toán ${paymentMethodLabel(payload.paymentMethod)} ${money(payAmount)}${
        isFullyPaid
          ? ' — đã thanh toán đủ'
          : ` — đã trả ${money(newPaidAmount)}, còn lại ${money(Math.max(newRemainingAmount, 0))}`
      }`,
      {
        newValue: {
          paymentMethod: payload.paymentMethod,
          paidAmount: newPaidAmount,
          remainingAmount: Math.max(newRemainingAmount, 0),
          paymentStatus: isFullyPaid ? 'paid' : 'deposit_paid'
        },
        amount: payAmount
      },
      actor,
      connection
    );

    await connection.commit();
    committed = true;

    // Payment settlement is the source of truth. Invoice generation is a
    // follow-up operation and must never roll back money already received.
    let invoice = null;
    // Invoice is finalized at check-out, after all services and charges are locked.
    if (isFullyPaid && booking.status === 'checked_out') {
      try {
        invoice = await invoiceService.issueInvoiceForPayment(paymentId);
      } catch (error) {
        console.error(`Issue invoice for payment #${paymentId} failed:`, error);
      }
    }

    const updatedPayment = await paymentModel.getPaymentById(paymentId);
    const updatedBooking = await bookingModel.getBookingById(booking.id);
    const bookingServices = await bookingModel.getBookingServicesByBookingId(booking.id);
    void emailService.sendPaymentConfirmation(
      { ...updatedBooking, services: bookingServices },
      formatPayment(updatedPayment)
    );
    return {
      payment: formatPayment(updatedPayment),
      invoice,
      redirectUrl: null
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

const confirmPayment = async (paymentId, payload, actor = null) => {
  const connection = await db.getConnection();
  let committed = false;

  try {
    await connection.beginTransaction();

    await bookingModel.expireUnpaidBookingHolds(connection);

    const payment = await paymentModel.getPaymentById(paymentId, connection, true);
    if (!payment) {
      throw new HttpError(404, 'Payment not found');
    }

    // VNPay/ZaloPay may notify through both the browser return URL and callback.
    // Match the callback to the currently-open order while holding the row
    // lock, then make duplicate callbacks idempotent.
    if (payload.gatewayOrderId) {
      const gatewayOrder = await paymentModel.getGatewayOrder(payload.gatewayOrderId, connection, true);
      if (!gatewayOrder || Number(gatewayOrder.paymentId) !== Number(payment.id)) {
        throw new HttpError(409, 'Gateway order không thuộc thanh toán này');
      }
      if (gatewayOrder.status === 'paid' && payment.paymentDate) {
        await connection.commit();
        committed = true;
        return { payment: formatPayment(payment), invoice: null };
      }
      if (gatewayOrder.status !== 'created') {
        throw new HttpError(409, 'Gateway order không còn hiệu lực');
      }
      if (payment.transactionCode !== payload.gatewayOrderId) {
        throw new HttpError(409, 'Gateway order is no longer active');
      }
      if (payment.paymentDate) {
        await connection.commit();
        committed = true;
        return {
          payment: formatPayment(payment),
          invoice: null
        };
      }
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

    await assertAllBookingRoomsAvailable(booking, connection);
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

    const payAmount = validatePaymentAmount(payment, payload.amount);
    if (payAmount <= 0) {
      throw new HttpError(400, 'Payment amount must be greater than 0');
    }

    if (payAmount > Number(payment.remainingAmount)) {
      throw new HttpError(400, 'Payment amount exceeds remaining balance');
    }

    const newPaidAmount = Number(payment.paidAmount) + payAmount;
    const newRemainingAmount = Number(payment.totalAmount) - newPaidAmount;
    const isFullyPaid = newRemainingAmount <= 0;
    const isInitialDeposit = Number(payment.paidAmount) === 0 && !isFullyPaid;
    const transactionCode =
      payload.gatewayOrderId
      || payload.transactionCode
      || payment.transactionCode
      || generateTransactionCode(payment.paymentMethod);
    const paymentDate = new Date();

    await paymentModel.updatePayment(
      paymentId,
      {
        depositAmount: isInitialDeposit ? payAmount : Number(payment.depositAmount || 0),
        paidAmount: newPaidAmount,
        remainingAmount: Math.max(newRemainingAmount, 0),
        paymentStatus: isFullyPaid ? 'paid' : 'deposit_paid',
        transactionCode,
        paymentDate
      },
      connection
    );

    // Update booking status to confirmed if it was pending
    if (booking.status === 'pending') {
      await bookingModel.updateBookingStatus(booking.id, 'confirmed', connection);
    }
    if (payload.gatewayOrderId) {
      const gatewayOrder = await paymentModel.getGatewayOrder(payload.gatewayOrderId, connection, true);
      if (Number(gatewayOrder.amount) !== payAmount) {
        throw new HttpError(400, 'Số tiền callback không khớp giao dịch đã tạo');
      }
      await paymentModel.updateGatewayOrderStatus(payload.gatewayOrderId, 'paid', connection);
    }

    await logBookingHistory(
      booking.id,
      'payment',
      `Xác nhận thanh toán ${paymentMethodLabel(payload.paymentMethod || payment.paymentMethod)} ${money(payAmount)}${
        isFullyPaid
          ? ' — đã thanh toán đủ'
          : ` — đã trả ${money(newPaidAmount)}, còn lại ${money(Math.max(newRemainingAmount, 0))}`
      }${transactionCode ? ` (mã GD: ${transactionCode})` : ''}`,
      {
        newValue: {
          paidAmount: newPaidAmount,
          remainingAmount: Math.max(newRemainingAmount, 0),
          paymentStatus: isFullyPaid ? 'paid' : 'deposit_paid',
          transactionCode
        },
        amount: payAmount
      },
      actor,
      connection
    );

    await connection.commit();
    committed = true;

    // Keep a successful gateway payment even if invoice creation fails.
    let invoice = null;
    // Gateway settlement follows the same rule: do not issue an invoice before check-out.
    if (isFullyPaid && booking.status === 'checked_out') {
      try {
        invoice = await invoiceService.issueInvoiceForPayment(paymentId);
      } catch (error) {
        console.error(`Issue invoice for payment #${paymentId} failed:`, error);
      }
    }

    const updatedPayment = await paymentModel.getPaymentById(paymentId);
    const updatedBooking = await bookingModel.getBookingById(booking.id);
    const bookingServices = await bookingModel.getBookingServicesByBookingId(booking.id);
    void emailService.sendPaymentConfirmation(
      { ...updatedBooking, services: bookingServices },
      formatPayment(updatedPayment)
    );
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

const refundPayment = async (paymentId, actor = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const payment = await paymentModel.getPaymentById(paymentId, connection, true);
    if (!payment) {
      throw new HttpError(404, 'Không tìm thấy thanh toán');
    }

    if (payment.paymentStatus !== 'paid') {
      throw new HttpError(409, 'Chỉ giao dịch đã thanh toán mới có thể hoàn tiền');
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

    await logBookingHistory(
      payment.bookingId,
      'refund',
      `Hoàn tiền giao dịch #${payment.id}: ${money(payment.paidAmount)}`,
      {
        oldValue: { paymentStatus: payment.paymentStatus, paidAmount: Number(payment.paidAmount) },
        newValue: { paymentStatus: 'refunded' },
        amount: Number(payment.paidAmount)
      },
      actor,
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
  const gatewayOrder = await paymentModel.getGatewayOrder(orderId);
  if (!gatewayOrder || gatewayOrder.provider !== paymentMethod) {
    throw new HttpError(404, 'Gateway order not found');
  }
  if (gatewayOrder.status === 'paid') {
    return formatPayment(await paymentModel.getPaymentById(gatewayOrder.paymentId));
  }
  if (gatewayOrder.status !== 'created') {
    throw new HttpError(409, 'Gateway order is no longer active');
  }
  const payment = await paymentModel.getPaymentByTransactionCode(orderId);
  if (!payment) throw new HttpError(404, 'Gateway order not found');
  // The other gateway notification may already have settled this exact order.
  if (payment.paymentDate) return formatPayment(payment);
  if (payment.paymentStatus === 'refunded') throw new HttpError(409, 'Payment was refunded');
  const paid = Number(amount);
  if (!Number.isFinite(paid) || paid !== Number(gatewayOrder.amount) || paid > Number(payment.remainingAmount)) {
    throw new HttpError(400, 'Gateway amount is invalid');
  }

  // A verified gateway callback settles the existing order directly. Calling
  // processPayment here would create another VNPay/ZaloPay order instead of
  // recording the money that has already been received.
  const result = await confirmPayment(payment.id, {
    amount: paid,
    transactionCode: orderId,
    gatewayOrderId: orderId,
    paymentMethod
  });
  return result.payment;
};

const failGatewayOrder = async (orderId, status = 'failed') => {
  if (!['failed', 'expired', 'cancelled'].includes(status)) return;
  const order = await paymentModel.getGatewayOrder(orderId);
  if (order?.status === 'created') await paymentModel.updateGatewayOrderStatus(orderId, status);
};

const submitTransferConfirmation = async (paymentId, payload, actor = null) => {
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
    const amount = validatePaymentAmount(payment, payload.amount ?? payment.remainingAmount);
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

    // Ghi dấu vết: khách đã khai báo chuyển khoản, đang chờ lễ tân đối soát.
    // Đây mới là YÊU CẦU, tiền chưa được ghi nhận vào payment.
    await logBookingHistory(
      payment.bookingId,
      'transfer_confirmation',
      `Khách báo đã chuyển khoản ${money(amount)}, chờ khách sạn đối soát`,
      { amount },
      actor,
      connection
    );

    await connection.commit();
    return formatPayment(await paymentModel.getPaymentById(paymentId));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const confirmTransferPayment = async (paymentId, confirmedBy, actor = null) => {
  const request = await paymentModel.getConfirmationRequest(paymentId);
  if (!request) throw new HttpError(404, 'Payment verification request not found');
  if (request.status !== 'pending') throw new HttpError(409, 'Payment verification request is no longer pending');

  // Only this server-side confirmation calls processPayment, which is the only
  // point where paidAmount and paymentStatus may be changed for a bank transfer.
  const result = await processPayment(paymentId, {
    paymentMethod: 'bank_transfer',
    amount: Number(request.amount)
  }, actor || (confirmedBy ? { userId: confirmedBy, role: 'employee' } : null));
  await paymentModel.confirmConfirmationRequest(paymentId, confirmedBy);
  return result.payment;
};

// Thử một mã voucher mà KHÔNG ghi gì vào cơ sở dữ liệu, để khách xem trước
// được giảm bao nhiêu trước khi quyết định áp.
const previewVoucher = async (paymentId, code, actor) => {
  const userId = typeof actor === 'object' ? actor?.userId : actor;
  const userRole = typeof actor === 'object' ? actor?.role : 'customer';
  const isStaffUser = ['admin', 'employee', 'staff', 'manager', 'receptionist'].includes(userRole);

  const payment = await paymentModel.getPaymentById(paymentId);
  if (!payment) throw new HttpError(404, 'Không tìm thấy thanh toán');

  const booking = await bookingModel.getBookingById(payment.bookingId);
  if (!booking) throw new HttpError(404, 'Không tìm thấy đặt phòng');
  if (!isStaffUser && Number(booking.user_id) !== Number(userId)) {
    throw new HttpError(403, 'Bạn không có quyền xem voucher của đặt phòng này');
  }

  const paidAmount = Number(payment.paidAmount || 0);
  const subtotal = Number(payment.roomAmount || 0)
    + Number(payment.serviceAmount || 0)
    + Number(payment.surchargeAmount || 0);

  const evaluation = await voucherService.evaluateVoucherForBooking({
    code,
    booking,
    subtotal,
    payableCeiling: Math.max(subtotal - paidAmount, 0),
    userId,
    userRole
  });

  return {
    code: evaluation.voucher.code,
    discountType: evaluation.voucher.discountType,
    discountValue: Number(evaluation.voucher.discountValue),
    maxDiscount: Number(evaluation.voucher.maxDiscount || 0),
    minBookingAmount: Number(evaluation.voucher.minBookingAmount || 0),
    validUntil: evaluation.voucher.endDate,
    roomTypes: evaluation.allowedRoomTypes.map((item) => item.typeName),
    subtotal,
    paidAmount,
    discountAmount: evaluation.discountAmount,
    // Mức giảm gốc trước khi bị chặn bởi trần giảm hoặc số tiền còn phải trả,
    // dùng để giải thích cho khách vì sao giảm ít hơn con số ghi trên voucher.
    rawDiscount: evaluation.rawDiscount,
    cappedByMaxDiscount: evaluation.cappedByMaxDiscount,
    cappedByPayable: evaluation.cappedByPayable,
    totalAfterDiscount: subtotal - evaluation.discountAmount,
    remainingAfterDiscount: Math.max(subtotal - evaluation.discountAmount - paidAmount, 0)
  };
};

const applyVoucher = async (paymentId, code, actor) => {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) throw new HttpError(400, 'Vui lòng nhập mã voucher');

  const userId = typeof actor === 'object' ? actor?.userId : actor;
  const userRole = typeof actor === 'object' ? actor?.role : 'customer';
  const isStaff = ['admin', 'employee', 'staff', 'manager', 'receptionist'].includes(userRole);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [paymentRows] = await connection.query(
      'SELECT * FROM payments WHERE id = ? FOR UPDATE',
      [paymentId]
    );
    const payment = paymentRows[0];
    if (!payment) throw new HttpError(404, 'Không tìm thấy thanh toán');
    if (!['unpaid', 'deposit_paid'].includes(payment.paymentStatus)) {
      throw new HttpError(409, 'Không thể áp voucher cho giao dịch này');
    }

    const booking = await bookingModel.getBookingById(payment.bookingId, connection, true);
    if (!booking) throw new HttpError(404, 'Không tìm thấy đặt phòng');
    if (!isStaff && Number(booking.user_id) !== Number(userId)) {
      throw new HttpError(403, 'Bạn không có quyền áp voucher cho đặt phòng này');
    }
    if (booking.voucher_id || booking.voucherId) throw new HttpError(409, 'Đặt phòng đã áp dụng voucher');

    // Voucher chỉ dùng ở lần thanh toán cuối (hoặc lúc trả phòng), không dùng
    // để bớt tiền cọc giữ phòng. Cọc là khoản cam kết giữ phòng nên phải tính
    // trên giá gốc; giảm giá được trừ vào phần thanh toán còn lại.
    const hasPaidDeposit = Number(payment.paidAmount || 0) > 0;
    const isAtCheckout = ['checked_in', 'checked_out'].includes(booking.status);
    if (!hasPaidDeposit && !isAtCheckout) {
      throw new HttpError(
        409,
        'Voucher chỉ được áp dụng ở lần thanh toán cuối. Vui lòng thanh toán tiền cọc giữ phòng trước, mã giảm giá sẽ được trừ vào số tiền còn lại.'
      );
    }

    // Khóa dòng voucher trước khi kiểm tra để hai khách dùng cùng lúc không
    // cùng trừ được một lượt cuối cùng.
    await connection.query('SELECT id FROM vouchers WHERE UPPER(code) = ? FOR UPDATE', [
      normalizedCode
    ]);

    const guestSurcharge = Number(booking.occupancy_surcharge || 0);
    const roomAmount = Math.max(Number(booking.total_price || 0) - guestSurcharge, 0);
    const serviceAmount = await bookingModel.sumBookingServices(payment.bookingId, connection);
    const damageSurcharge = await bookingModel.sumDamageCharges(payment.bookingId, connection);
    // Phải cộng cả phí trả phòng muộn giống recalculatePaymentForBooking. Thiếu
    // khoản này thì áp voucher sau khi khách trả phòng muộn sẽ ghi đè tổng tiền
    // và xóa luôn phí trễ giờ khỏi hóa đơn.
    const lateCheckoutSurcharge = await bookingModel.sumLateCheckoutCharges(
      payment.bookingId,
      connection
    );
    const surchargeAmount = guestSurcharge + damageSurcharge + lateCheckoutSurcharge;
    const subtotal = roomAmount + serviceAmount + surchargeAmount;
    const paidAmount = Number(payment.paidAmount || 0);

    // Giảm giá chỉ được trừ vào phần chưa trả. Phần khách đã đóng (tiền cọc)
    // giữ nguyên, đúng nguyên tắc voucher không làm giảm tiền cọc.
    const evaluation = await voucherService.evaluateVoucherForBooking(
      {
        code: normalizedCode,
        booking,
        subtotal,
        payableCeiling: Math.max(subtotal - paidAmount, 0),
        userId,
        userRole
      },
      connection
    );

    const { voucher, customerVoucher, discountAmount } = evaluation;
    const totalAmount = subtotal - discountAmount;
    const remainingAmount = Math.max(totalAmount - paidAmount, 0);

    const newPaymentStatus = remainingAmount <= 0
      ? 'paid'
      : paidAmount > 0
        ? 'deposit_paid'
        : 'unpaid';

    await paymentModel.updatePayment(paymentId, {
      roomAmount,
      serviceAmount,
      surchargeAmount,
      discountAmount,
      totalAmount,
      remainingAmount,
      paymentStatus: newPaymentStatus
    }, connection);

    await connection.query('UPDATE bookings SET voucherId = ?, totalAmount = ? WHERE id = ?', [
      voucher.id,
      totalAmount,
      booking.id
    ]);
    await connection.query('UPDATE vouchers SET quantity = quantity - 1 WHERE id = ?', [
      voucher.id
    ]);
    if (customerVoucher) {
      await connection.query('UPDATE customer_vouchers SET isUsed = 1 WHERE id = ?', [
        customerVoucher.id
      ]);
    }

    await logBookingHistory(
      booking.id,
      'voucher_applied',
      `Áp dụng mã ưu đãi ${voucher.code}: giảm ${money(discountAmount)}, tổng còn ${money(totalAmount)}`,
      {
        newValue: { voucherCode: voucher.code, discountAmount, totalAmount },
        amount: discountAmount
      },
      typeof actor === 'object' ? actor : { userId, role: 'customer' },
      connection
    );

    await connection.commit();
    return {
      payment: formatPayment(await paymentModel.getPaymentById(paymentId)),
      voucher: {
        id: voucher.id,
        code: voucher.code,
        discountAmount
      }
    };
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
  createGatewayOrder,
  settleGatewayPayment,
  failGatewayOrder,
  submitTransferConfirmation,
  confirmTransferPayment,
  recalculatePaymentForBooking,
  listPayments,
  getPaymentById,
  getPaymentByBookingId,
  applyVoucher,
  previewVoucher,
  processPayment,
  confirmPayment,
  refundPayment
};

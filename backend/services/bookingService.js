const db = require('../config/db');
const bookingModel = require('../models/bookingModel');
const paymentService = require('./paymentService');
const voucherService = require('./voucherService');
const HttpError = require('../utils/httpError');
const {
  dayString,
  isWithinLateCheckInWindow,
  isLateCheckIn,
  isPastNoShowDeadline,
  getLateCheckInDeadline,
  LATE_CHECKIN_GRACE_HOUR
} = require('../utils/bookingPolicy');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HOLD_MINUTES = 15;

const dateToUtc = (date) => new Date(`${date}T00:00:00.000Z`);

const getNightCount = (checkIn, checkOut) => {
  return Math.round((dateToUtc(checkOut) - dateToUtc(checkIn)) / MS_PER_DAY);
};

const getStayDates = (checkIn, checkOut) => {
  const dates = [];
  const cursor = dateToUtc(checkIn);
  const end = dateToUtc(checkOut);

  while (cursor < end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

const ensureBookable = async (payload, connection, lock = false) => {
  await bookingModel.expireUnpaidBookingHolds(connection);

  const customer = await bookingModel.getAccountById(payload.userId, connection);
  const room = await bookingModel.getRoomWithType(payload.roomId, connection, lock);

  if (!customer) {
    throw new HttpError(404, 'Customer not found');
  }

  if (!room) {
    throw new HttpError(404, 'Room not found');
  }

  if (room.status === 'maintenance') {
    throw new HttpError(409, 'Room is under maintenance');
  }

  if (payload.adults + payload.children > room.capacity) {
    throw new HttpError(400, `Guest count exceeds room capacity (${room.capacity})`);
  }

  const bookingConflicts = await bookingModel.getConflictingBookings(
    payload.roomId,
    payload.checkIn,
    payload.checkOut,
    connection,
    lock
  );
  const availabilityConflicts = await bookingModel.getBookedAvailabilityRows(
    payload.roomId,
    payload.checkIn,
    payload.checkOut,
    connection,
    lock
  );

  if (bookingConflicts.length > 0 || availabilityConflicts.length > 0) {
    throw new HttpError(409, 'Room is not available for the selected dates', {
      conflictingBookingIds: bookingConflicts.map((booking) => booking.id)
    });
  }

  return { customer, room };
};

const ensureRoomAvailable = async (payload, connection, lock = false) => {
  await bookingModel.expireUnpaidBookingHolds(connection);

  const room = await bookingModel.getRoomWithType(payload.roomId, connection, lock);

  if (!room) {
    throw new HttpError(404, 'Room not found');
  }

  if (room.status === 'maintenance') {
    throw new HttpError(409, 'Room is under maintenance');
  }

  const bookingConflicts = await bookingModel.getConflictingBookings(
    payload.roomId,
    payload.checkIn,
    payload.checkOut,
    connection,
    lock
  );
  const availabilityConflicts = await bookingModel.getBookedAvailabilityRows(
    payload.roomId,
    payload.checkIn,
    payload.checkOut,
    connection,
    lock
  );

  return {
    room,
    bookingConflicts,
    availabilityConflicts,
    available: bookingConflicts.length === 0 && availabilityConflicts.length === 0
  };
};

const checkAvailability = async (payload) => {
  const { room, bookingConflicts, available } = await ensureRoomAvailable(payload);

  return {
    available,
    roomId: payload.roomId,
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    nights: getNightCount(payload.checkIn, payload.checkOut),
    pricePerNight: Number(room.price_per_night),
    holdMinutes: HOLD_MINUTES,
    conflictingBookingIds: bookingConflicts.map((booking) => booking.id)
  };
};

const checkTypeAvailability = async (payload) => {
  await bookingModel.expireUnpaidBookingHolds();

  const allTypes = await bookingModel.listRoomTypeAvailability(payload.checkIn, payload.checkOut);
  const requested = payload.rooms.map((item) => {
    const type = allTypes.find((roomType) => Number(roomType.id) === Number(item.roomTypeId));
    const availableRooms = Number(type?.availableRooms || 0);
    const shortage = Math.max(item.quantity - availableRooms, 0);

    return {
      roomTypeId: item.roomTypeId,
      roomTypeName: type?.room_type_name || `Loại phòng #${item.roomTypeId}`,
      requestedQuantity: item.quantity,
      availableRooms,
      canBookQuantity: Math.min(item.quantity, availableRooms),
      shortage,
      enough: shortage === 0,
      roomIds: (type?.roomIds || []).slice(0, item.quantity)
    };
  });

  const totalShortage = requested.reduce((sum, item) => sum + item.shortage, 0);
  const requestedTypeIds = new Set(payload.rooms.map((item) => Number(item.roomTypeId)));
  const suggestions = allTypes
    .filter((roomType) => !requestedTypeIds.has(Number(roomType.id)) && Number(roomType.availableRooms) > 0)
    .map((roomType) => ({
      roomTypeId: roomType.id,
      roomTypeName: roomType.room_type_name,
      availableRooms: Number(roomType.availableRooms),
      pricePerNight: Number(roomType.price_per_night),
      capacity: Number(roomType.capacity)
    }));

  return {
    available: totalShortage === 0,
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    requested,
    suggestions,
    message:
      totalShortage === 0
        ? 'Đủ phòng theo yêu cầu'
        : 'Không đủ số lượng phòng theo yêu cầu, vui lòng giảm số lượng hoặc chọn thêm loại phòng khác'
  };
};

const expireUnpaidBookingHolds = () => bookingModel.expireUnpaidBookingHolds();

const getRefundPolicy = (checkIn, paidAmount = 0) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkInDate = dateToUtc(dayString(checkIn));
  const daysBeforeCheckIn = Math.ceil((checkInDate - today) / MS_PER_DAY);
  const rate = daysBeforeCheckIn > 7 ? 1 : daysBeforeCheckIn >= 3 ? 0.5 : 0;

  return {
    daysBeforeCheckIn,
    refundRate: rate,
    refundableAmount: Math.round(Number(paidAmount || 0) * rate)
  };
};

const createBooking = async (payload) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { room } = await ensureBookable(payload, connection, true);
    const nights = getNightCount(payload.checkIn, payload.checkOut);
    const roomPrice = Number(room.price_per_night);
    const totalPrice = roomPrice * nights;
    const dates = getStayDates(payload.checkIn, payload.checkOut);

    const bookingId = await bookingModel.createBooking(payload, totalPrice, connection);
    await bookingModel.createBookingDetail(bookingId, payload, roomPrice, connection);
    await bookingModel.upsertAvailabilityRows(payload.roomId, bookingId, dates, connection);
    const payment = await paymentService.createPaymentForBooking(bookingId, {}, connection);

    await connection.commit();

    const booking = await bookingModel.getBookingById(bookingId);
    return { ...booking, payment };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const listBookings = (filters) => bookingModel.listBookings(filters);

const getBookingById = async (bookingId) => {
  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) {
    throw new HttpError(404, 'Booking not found');
  }
  return booking;
};

const cancelBooking = async (bookingId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Booking not found');
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw new HttpError(409, `Cannot cancel booking with status ${booking.status}`);
    }

    let refundPolicy = null;
    try {
      const payment = await paymentService.getPaymentByBookingId(bookingId);
      refundPolicy = getRefundPolicy(booking.check_in, payment.paidAmount);
    } catch {
      refundPolicy = getRefundPolicy(booking.check_in, 0);
    }

    await bookingModel.updateBookingStatus(bookingId, 'cancelled', connection);

    await connection.commit();
    return {
      ...(await bookingModel.getBookingById(bookingId)),
      refundPolicy
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const saveGuestIdentities = async (bookingId, payload) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Booking not found');
    }

    await bookingModel.replaceBookingGuests(bookingId, payload.guests, connection);

    await connection.commit();
    return bookingModel.getBookingById(bookingId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const addServiceCharge = async (bookingId, payload) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Booking not found');
    }

    if (!['confirmed', 'checked_in'].includes(booking.status)) {
      throw new HttpError(409, `Cannot add service charge to booking with status ${booking.status}`);
    }

    const service = await bookingModel.getServiceById(payload.serviceId, connection);
    if (!service) {
      throw new HttpError(404, 'Service not found');
    }

    await bookingModel.addBookingService(bookingId, service, payload.quantity, connection);
    const payment = await paymentService.recalculatePaymentForBooking(bookingId, connection);

    await connection.commit();
    return {
      booking: await bookingModel.getBookingById(bookingId),
      service: {
        id: service.id,
        serviceName: service.serviceName,
        quantity: payload.quantity,
        totalPrice: Number(service.price) * payload.quantity
      },
      payment
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const addDamageCharge = async (bookingId, payload) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Booking not found');
    }

    if (!['checked_in'].includes(booking.status)) {
      throw new HttpError(409, `Cannot add damage charge to booking with status ${booking.status}`);
    }

    const damage = await bookingModel.addDamageCharge(bookingId, booking.room_id, payload, connection);
    const payment = await paymentService.recalculatePaymentForBooking(bookingId, connection);

    await connection.commit();
    return { damage, payment };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const extendStay = async (bookingId, payload) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Booking not found');
    }

    if (!['confirmed', 'checked_in'].includes(booking.status)) {
      throw new HttpError(409, `Cannot extend booking with status ${booking.status}`);
    }

    const currentCheckOut = dayString(booking.check_out);
    if (dateToUtc(payload.checkOut) <= dateToUtc(currentCheckOut)) {
      throw new HttpError(400, 'new checkOut must be after current checkOut');
    }

    const conflicts = await bookingModel.getConflictingBookings(
      booking.room_id,
      currentCheckOut,
      payload.checkOut,
      connection,
      true,
      { excludeBookingId: bookingId }
    );

    if (conflicts.length > 0) {
      throw new HttpError(409, 'Không thể gia hạn vì phòng đã có khách khác đặt sau ngày trả hiện tại', {
        conflictingBookingIds: conflicts.map((item) => item.id)
      });
    }

    const addedNights = getNightCount(currentCheckOut, payload.checkOut);
    const addedAmount = Number(booking.room_price || booking.price_per_night || 0) * addedNights;
    const newTotalPrice = Number(booking.total_price || 0) + addedAmount;

    await bookingModel.updateBookingStay(bookingId, payload.checkOut, newTotalPrice, connection);
    const payment = await paymentService.recalculatePaymentForBooking(bookingId, connection);

    await connection.commit();
    return {
      booking: await bookingModel.getBookingById(bookingId),
      addedNights,
      addedAmount,
      payment
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const transferRoom = async (bookingId, payload) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Booking not found');
    }

    if (booking.status !== 'checked_in') {
      throw new HttpError(409, `Cannot transfer room with status ${booking.status}`);
    }

    const toRoom = await bookingModel.getRoomWithType(payload.toRoomId, connection, true);
    if (!toRoom) {
      throw new HttpError(404, 'Target room not found');
    }

    if (toRoom.status === 'maintenance') {
      throw new HttpError(409, 'Target room is under maintenance');
    }

    const conflicts = await bookingModel.getConflictingBookings(
      toRoom.id,
      payload.fromDate,
      payload.toDate,
      connection,
      true,
      { excludeBookingId: bookingId }
    );

    if (conflicts.length > 0) {
      throw new HttpError(409, 'Phòng chuyển đến không còn trống trong giai đoạn này', {
        conflictingBookingIds: conflicts.map((item) => item.id)
      });
    }

    await bookingModel.transferBookingRoom(booking, toRoom, payload, connection);
    await bookingModel.updateRoomStatus(booking.room_id, 'available', connection);
    await bookingModel.updateRoomStatus(toRoom.id, 'occupied', connection);

    const currentNights = getNightCount(dayString(booking.check_in), dayString(booking.check_out));
    const newTotalPrice = Number(toRoom.price_per_night || 0) * currentNights;
    await bookingModel.updateBookingStay(bookingId, dayString(booking.check_out), newTotalPrice, connection);
    const payment = await paymentService.recalculatePaymentForBooking(bookingId, connection);

    await connection.commit();
    return {
      booking: await bookingModel.getBookingById(bookingId),
      payment
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const checkIn = async (bookingId, payload = {}) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Booking not found');
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw new HttpError(409, `Cannot check in booking with status ${booking.status}`);
    }

    const payment = await paymentService.getPaymentByBookingId(bookingId);
    if (!payment || Number(payment.paidAmount || 0) <= 0) {
      throw new HttpError(409, 'Vui lòng thanh toán trước khi check-in');
    }

    if (payment.remainingAmount > 0 || payment.paymentStatus !== 'paid') {
      throw new HttpError(409, 'Vui lòng thanh toán đủ số tiền còn lại trước khi check-in');
    }

    const now = new Date();
    if (!isWithinLateCheckInWindow(booking.check_in, now)) {
      const checkInDay = new Date(`${dayString(booking.check_in)}T00:00:00`);
      if (now < checkInDay) {
        throw new HttpError(409, 'Chưa đến ngày nhận phòng');
      }
      throw new HttpError(
        409,
        `Đã quá thời gian check-in muộn (trước ${LATE_CHECKIN_GRACE_HOUR}:00 ngày hôm sau). Vui lòng liên hệ lễ tân.`
      );
    }

    if (Array.isArray(payload.guests) && payload.guests.length > 0) {
      await bookingModel.replaceBookingGuests(bookingId, payload.guests, connection);
    }

    await bookingModel.updateBookingStatus(bookingId, 'checked_in', connection);
    await bookingModel.updateRoomStatus(booking.room_id, 'occupied', connection);

    await connection.commit();

    const updatedBooking = await bookingModel.getBookingById(bookingId);
    const lateCheckIn = isLateCheckIn(booking.check_in, now);

    return {
      ...updatedBooking,
      lateCheckIn,
      message: lateCheckIn
        ? 'Check-in muộn thành công. Phòng vẫn được giữ theo cam kết vì khách đã thanh toán.'
        : 'Check-in thành công'
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const markNoShow = async (bookingId, { allowBeforeDeadline = false, connection: externalConnection } = {}) => {
  const ownsConnection = !externalConnection;
  const connection = externalConnection || (await db.getConnection());

  try {
    if (ownsConnection) {
      await connection.beginTransaction();
    }

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Booking not found');
    }

    if (booking.status === 'no_show') {
      throw new HttpError(409, 'Booking is already marked as no-show');
    }

    if (!['confirmed', 'pending'].includes(booking.status)) {
      throw new HttpError(409, `Cannot mark no-show for booking with status ${booking.status}`);
    }

    const paymentRow = await paymentService.getPaymentByBookingId(bookingId);
    if (!paymentRow || Number(paymentRow.paidAmount || 0) <= 0) {
      throw new HttpError(409, 'Chỉ áp dụng no-show cho booking đã thanh toán');
    }

    if (!allowBeforeDeadline && !isPastNoShowDeadline(booking.check_in)) {
      const deadline = getLateCheckInDeadline(booking.check_in);
      throw new HttpError(
        409,
        `Chưa đến thời điểm xử lý no-show. Hệ thống sẽ tự động xử lý sau ${deadline.toLocaleString('vi-VN')}`
      );
    }

    await bookingModel.updateBookingStatus(bookingId, 'no_show', connection);
    await bookingModel.updateRoomStatus(booking.room_id, 'available', connection);

    const voucher = await voucherService.createNoShowCompensationVoucher(
      booking.user_id,
      bookingId,
      connection
    );

    if (ownsConnection) {
      await connection.commit();
    }

    return {
      booking: await bookingModel.getBookingById(bookingId, ownsConnection ? undefined : connection),
      voucher: {
        code: voucher.code,
        discountPercentage: Number(voucher.discountPercentage),
        validFrom: voucher.validFrom,
        validUntil: voucher.validUntil,
        message: `Đã tặng voucher giảm ${voucherService.NO_SHOW_DISCOUNT_PERCENT}% cho lần đặt phòng tiếp theo`
      },
      refundPolicy: {
        refunded: false,
        message: 'Không hoàn tiền theo chính sách no-show'
      }
    };
  } catch (error) {
    if (ownsConnection) {
      await connection.rollback();
    }
    throw error;
  } finally {
    if (ownsConnection) {
      connection.release();
    }
  }
};

const processNoShows = async () => {
  const connection = await db.getConnection();
  const results = [];

  try {
    await connection.beginTransaction();
    const candidates = await bookingModel.listEligibleNoShowBookings(connection);

    for (const candidate of candidates) {
      try {
        const result = await markNoShow(candidate.id, {
          allowBeforeDeadline: true,
          connection
        });
        results.push({ bookingId: candidate.id, status: 'processed', voucherCode: result.voucher.code });
      } catch (error) {
        results.push({
          bookingId: candidate.id,
          status: 'skipped',
          reason: error.message
        });
      }
    }

    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const checkOut = async (bookingId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Booking not found');
    }

    if (booking.status !== 'checked_in') {
      throw new HttpError(409, `Cannot check out booking with status ${booking.status}`);
    }

    const payment = await paymentService.getPaymentByBookingId(bookingId);
    if (!payment || payment.remainingAmount > 0 || payment.paymentStatus !== 'paid') {
      throw new HttpError(409, 'Vui lòng thanh toán toàn bộ tiền phòng và chi phí phát sinh trước khi check-out');
    }

    await bookingModel.updateBookingStatus(bookingId, 'checked_out', connection);
    await bookingModel.updateRoomStatus(booking.room_id, 'available', connection);

    await connection.commit();
    return bookingModel.getBookingById(bookingId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  checkAvailability,
  checkTypeAvailability,
  expireUnpaidBookingHolds,
  createBooking,
  listBookings,
  getBookingById,
  cancelBooking,
  saveGuestIdentities,
  addServiceCharge,
  addDamageCharge,
  extendStay,
  transferRoom,
  checkIn,
  checkOut,
  markNoShow,
  processNoShows
};

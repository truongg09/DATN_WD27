const db = require('../config/db');
const bookingModel = require('../models/bookingModel');
const paymentService = require('./paymentService');
const HttpError = require('../utils/httpError');

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

    // Service requests are recorded as "pending" only — they do not affect the
    // payment until an admin confirms each one.
    if (Array.isArray(payload.serviceRequests) && payload.serviceRequests.length > 0) {
      for (const request of payload.serviceRequests) {
        const service = await bookingModel.getServiceById(request.serviceId, connection);
        if (service) {
          await bookingModel.addBookingServiceRequest(bookingId, request.serviceId, request.quantity, connection);
        }
      }
    }

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
  booking.serviceRequests = await bookingModel.getBookingServiceRequests(bookingId);
  return booking;
};

const listServiceRequests = (filters) => bookingModel.listServiceRequests(filters);

const confirmServiceRequest = async (requestId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const request = await bookingModel.getServiceRequestById(requestId, connection, true);
    if (!request) {
      throw new HttpError(404, 'Service request not found');
    }
    if (request.status !== 'pending') {
      throw new HttpError(409, 'Service request already processed');
    }

    const booking = await bookingModel.getBookingById(request.bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Booking not found');
    }
    if (['cancelled', 'checked_out'].includes(booking.status)) {
      throw new HttpError(409, `Cannot confirm service for booking with status ${booking.status}`);
    }

    const service = await bookingModel.getServiceById(request.serviceId, connection);
    if (!service) {
      throw new HttpError(404, 'Service not found');
    }

    await bookingModel.addBookingService(request.bookingId, service, request.quantity, connection);
    await bookingModel.updateServiceRequestStatus(requestId, 'confirmed', connection);
    const payment = await paymentService.recalculatePaymentForBooking(request.bookingId, connection);

    await connection.commit();
    return {
      booking: await getBookingById(request.bookingId),
      payment
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const rejectServiceRequest = async (requestId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const request = await bookingModel.getServiceRequestById(requestId, connection, true);
    if (!request) {
      throw new HttpError(404, 'Service request not found');
    }
    if (request.status !== 'pending') {
      throw new HttpError(409, 'Service request already processed');
    }

    await bookingModel.updateServiceRequestStatus(requestId, 'rejected', connection);

    await connection.commit();
    return { booking: await getBookingById(request.bookingId) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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

const dayString = (value) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
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
    if (!payment || payment.remainingAmount > 0 || payment.paymentStatus !== 'paid') {
      throw new HttpError(409, 'Vui lòng thanh toán đủ số tiền còn lại trước khi check-in');
    }

    if (Array.isArray(payload.guests) && payload.guests.length > 0) {
      await bookingModel.replaceBookingGuests(bookingId, payload.guests, connection);
    }

    await bookingModel.updateBookingStatus(bookingId, 'checked_in', connection);
    await bookingModel.updateRoomStatus(booking.room_id, 'occupied', connection);

    await connection.commit();
    return bookingModel.getBookingById(bookingId);
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
  listServiceRequests,
  confirmServiceRequest,
  rejectServiceRequest,
  extendStay,
  transferRoom,
  checkIn,
  checkOut
};

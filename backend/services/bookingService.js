const db = require('../config/db');
const bookingModel = require('../models/bookingModel');
const paymentService = require('./paymentService');
const HttpError = require('../utils/httpError');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const dateToUtc = (date) => new Date(`${date}T00:00:00.000Z`);

const getNightCount = (checkIn, checkOut) => {
  return Math.round((dateToUtc(checkOut) - dateToUtc(checkIn)) / MS_PER_DAY);
};

const getStayDates = (checkIn, checkOut) => {
  const dates = [];
  const end = dateToUtc(checkOut);

  }

  return dates;
};

const ensureBookable = async (payload, connection, lock = false) => {
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
    conflictingBookingIds: bookingConflicts.map((booking) => booking.id)
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

    await bookingModel.updateBookingStatus(bookingId, 'cancelled', connection);

    await connection.commit();
    return bookingModel.getBookingById(bookingId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const checkIn = async (bookingId) => {
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
  createBooking,
  listBookings,
  getBookingById,
  cancelBooking,
  checkIn,
  checkOut
};

const bookingService = require('../services/bookingService');
const {
  normalizeAvailabilityPayload,
  normalizeBookingPayload,
  normalizeIdParam
} = require('../validators/bookingValidator');

const sendError = (res, error) => {
  console.error('Booking API error:', error);
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    message: statusCode === 500 ? 'Internal server error' : error.message,
    ...(error.details ? { details: error.details } : {})
  });
};

const checkAvailability = async (req, res) => {
  try {
    const payload = normalizeAvailabilityPayload(req.body);
    const result = await bookingService.checkAvailability(payload);
    res.json({ data: result });
  } catch (error) {
    sendError(res, error);
  }
};

const createBooking = async (req, res) => {
  try {
    const payload = normalizeBookingPayload(req.body, req.user?.userId);
    const booking = await bookingService.createBooking(payload);
    res.status(201).json({
      message: 'Booking created successfully',
      data: booking
    });
  } catch (error) {
    sendError(res, error);
  }
};

const listBookings = async (req, res) => {
  try {
    const filters = {};
    if (req.query.userId || req.query.customerId) {
      filters.userId = normalizeIdParam(req.query.userId || req.query.customerId, 'userId');
    }
    if (req.query.status) {
      filters.status = req.query.status;
    }

    const bookings = await bookingService.listBookings(filters);
    res.json({ data: bookings });
  } catch (error) {
    sendError(res, error);
  }
};

const getBookingById = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const booking = await bookingService.getBookingById(bookingId);
    res.json({ data: booking });
  } catch (error) {
    sendError(res, error);
  }
};

const cancelBooking = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const booking = await bookingService.cancelBooking(bookingId);
    res.json({
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    sendError(res, error);
  }
};

const checkIn = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const booking = await bookingService.checkIn(bookingId);
    res.json({
      message: 'Booking checked in successfully',
      data: booking
    });
  } catch (error) {
    sendError(res, error);
  }
};

const checkOut = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const booking = await bookingService.checkOut(bookingId);
    res.json({
      message: 'Booking checked out successfully',
      data: booking
    });
  } catch (error) {
    sendError(res, error);
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

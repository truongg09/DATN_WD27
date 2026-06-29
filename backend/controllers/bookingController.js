const bookingService = require('../services/bookingService');
const HttpError = require('../utils/httpError');
const {
  normalizeAvailabilityPayload,
  normalizeBookingPayload,
  normalizeDamageChargePayload,
  normalizeExtendStayPayload,
  normalizeGuestIdentitiesPayload,
  normalizeServiceChargePayload,
  normalizeTransferRoomPayload,
  normalizeTypeAvailabilityPayload,
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

const checkTypeAvailability = async (req, res) => {
  try {
    const payload = normalizeTypeAvailabilityPayload(req.body);
    const result = await bookingService.checkTypeAvailability(payload);
    res.json({ data: result });
  } catch (error) {
    sendError(res, error);
  }
};

const createBooking = async (req, res) => {
  try {
    const userFromToken = req.user?.userId;
    const payload = normalizeBookingPayload(req.body, userFromToken);

    if (userFromToken && payload.userId !== userFromToken) {
      throw new HttpError(403, 'Cannot create booking for another user');
    }

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

const listMyBookings = async (req, res) => {
  try {
    const userId = normalizeIdParam(req.user?.userId, 'userId');
    const bookings = await bookingService.listBookings({ userId });
    res.json({ data: bookings });
  } catch (error) {
    sendError(res, error);
  }
};

const getBookingById = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const booking = await bookingService.getBookingById(bookingId);

    if (
      req.user?.role === 'customer' &&
      Number(booking.user_id) !== Number(req.user.userId)
    ) {
      throw new HttpError(403, 'Cannot view another customer booking');
    }

    res.json({ data: booking });
  } catch (error) {
    sendError(res, error);
  }
};

const cancelBooking = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);

    if (req.user?.role === 'customer') {
      const currentBooking = await bookingService.getBookingById(bookingId);
      if (Number(currentBooking.user_id) !== Number(req.user.userId)) {
        throw new HttpError(403, 'Cannot cancel another customer booking');
      }
    }

    const booking = await bookingService.cancelBooking(bookingId);
    res.json({
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    sendError(res, error);
  }
};

const addServiceCharge = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const payload = normalizeServiceChargePayload(req.body);
    const result = await bookingService.addServiceCharge(bookingId, payload);
    res.json({
      message: 'Service charge added successfully',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const saveGuestIdentities = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const payload = normalizeGuestIdentitiesPayload(req.body);
    const booking = await bookingService.saveGuestIdentities(bookingId, payload);
    res.json({
      message: 'Guest identities saved successfully',
      data: booking
    });
  } catch (error) {
    sendError(res, error);
  }
};

const addDamageCharge = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const payload = normalizeDamageChargePayload(req.body);
    const result = await bookingService.addDamageCharge(bookingId, payload);
    res.json({
      message: 'Damage charge added successfully',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const transferRoom = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const payload = normalizeTransferRoomPayload(req.body);
    const result = await bookingService.transferRoom(bookingId, payload);
    res.json({
      message: 'Room transferred successfully',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const extendStay = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const payload = normalizeExtendStayPayload(req.body);
    const result = await bookingService.extendStay(bookingId, payload);
    res.json({
      message: 'Booking extended successfully',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const checkIn = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const payload = req.body?.guests ? normalizeGuestIdentitiesPayload(req.body) : {};
    const booking = await bookingService.checkIn(bookingId, payload);
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
  checkTypeAvailability,
  createBooking,
  listBookings,
  listMyBookings,
  getBookingById,
  cancelBooking,
  addServiceCharge,
  saveGuestIdentities,
  addDamageCharge,
  extendStay,
  transferRoom,
  checkIn,
  checkOut
};
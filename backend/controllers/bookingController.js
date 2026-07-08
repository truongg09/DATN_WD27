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

    const booking = await bookingService.cancelBooking(bookingId, req.body?.refund || null);
    res.json({
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    sendError(res, error);
  }
};

const getRefundPreview = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);

    if (req.user?.role === 'customer') {
      const currentBooking = await bookingService.getBookingById(bookingId);
      if (Number(currentBooking.user_id) !== Number(req.user.userId)) {
        throw new HttpError(403, 'Cannot view another customer booking');
      }
    }

    const preview = await bookingService.getRefundPreview(bookingId);
    res.json({ data: preview });
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
    const result = await bookingService.checkIn(bookingId, payload);
    res.json({
      message: result.message || 'Booking checked in successfully',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const markNoShow = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const result = await bookingService.markNoShow(bookingId);
    res.json({
      message: 'Booking marked as no-show',
      data: result
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

const listServiceRequests = async (req, res) => {
  try {
    const db = require('../config/db');
    const status = req.query.status;
    
    let query = `
      SELECT 
        sr.id,
        sr.bookingId,
        sr.serviceId,
        sr.quantity,
        sr.status,
        sr.createdAt,
        b.status as bookingStatus,
        r.roomNumber,
        c.fullName as bookingCustomer,
        c.phone as bookingPhone
      FROM booking_service_requests sr
      LEFT JOIN bookings b ON sr.bookingId = b.id
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN customers c ON b.customerId = c.id
    `;
    
    const params = [];
    if (status) {
      query += ' WHERE sr.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY sr.createdAt DESC';
    
    const [rows] = await db.query(query, params);
    
    // Try to fetch service details for each request
    const enrichedRows = await Promise.all(
      rows.map(async (row) => {
        try {
          const [services] = await db.query(
            'SELECT name, price FROM services WHERE id = ?',
            [row.serviceId]
          );
          if (services.length > 0) {
            return {
              ...row,
              serviceName: services[0].name,
              price: services[0].price,
              estimatedTotal: services[0].price * row.quantity
            };
          }
        } catch (e) {
          // Ignore service fetch errors
        }
        return {
          ...row,
          serviceName: null,
          price: null,
          estimatedTotal: null
        };
      })
    );
    
    res.json({ data: enrichedRows });
  } catch (error) {
    console.error('Error listing service requests:', error);
    res.status(500).json({ message: 'Error fetching service requests' });
  }
};

const confirmServiceRequest = async (req, res) => {
  try {
    const db = require('../config/db');
    const requestId = normalizeIdParam(req.params.id);
    
    // Get the service request
    const [requests] = await db.query(
      'SELECT * FROM booking_service_requests WHERE id = ?',
      [requestId]
    );
    
    if (!requests.length) {
      return res.status(404).json({ message: 'Service request not found' });
    }
    
    const request = requests[0];
    
    // Get service details
    const [services] = await db.query(
      'SELECT price FROM services WHERE id = ?',
      [request.serviceId]
    );
    
    if (!services.length) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    const service = services[0];
    const totalAmount = service.price * request.quantity;
    
    // Add to booking_services
    await db.query(
      `INSERT INTO booking_services (bookingId, serviceId, quantity, price, totalAmount, createdAt)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [request.bookingId, request.serviceId, request.quantity, service.price, totalAmount]
    );
    
    // Update request status
    await db.query(
      'UPDATE booking_service_requests SET status = ? WHERE id = ?',
      ['confirmed', requestId]
    );
    
    // Recalculate booking total
    await db.query(`
      UPDATE bookings b
      SET totalAmount = (
        SELECT COALESCE(SUM(totalAmount), 0) 
        FROM booking_services 
        WHERE bookingId = b.id
      )
      WHERE id = ?
    `, [request.bookingId]);
    
    res.json({ message: 'Service request confirmed and added to booking' });
  } catch (error) {
    console.error('Error confirming service request:', error);
    res.status(500).json({ message: 'Error confirming service request' });
  }
};

const rejectServiceRequest = async (req, res) => {
  try {
    const db = require('../config/db');
    const requestId = normalizeIdParam(req.params.id);
    
    await db.query(
      'UPDATE booking_service_requests SET status = ? WHERE id = ?',
      ['rejected', requestId]
    );
    
    res.json({ message: 'Service request rejected' });
  } catch (error) {
    console.error('Error rejecting service request:', error);
    res.status(500).json({ message: 'Error rejecting service request' });
  }
};

module.exports = {
  checkAvailability,
  checkTypeAvailability,
  createBooking,
  listBookings,
  listMyBookings,
  getBookingById,
  getRefundPreview,
  cancelBooking,
  addServiceCharge,
  saveGuestIdentities,
  addDamageCharge,
  extendStay,
  transferRoom,
  checkIn,
  checkOut,
  markNoShow,
  listServiceRequests,
  confirmServiceRequest,
  rejectServiceRequest
};
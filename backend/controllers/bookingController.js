const bookingService = require('../services/bookingService');
const HttpError = require('../utils/httpError');
const { isStaff } = require('../middleware/auth');
const {
  normalizeAvailabilityPayload,
  normalizeBookingPayload,
  normalizeDamageChargePayload,
  normalizeExtendStayPayload,
  normalizeUpdateStayPayload,
  normalizeGuestIdentitiesPayload,
  normalizeServiceChargePayload,
  normalizeUpdateServiceChargePayload,
  normalizeTransferRoomPayload,
  normalizeTypeAvailabilityPayload,
  normalizeIdParam
} = require('../validators/bookingValidator');

// Mặc định từ chối: chỉ nhân viên hoặc đúng chủ đặt phòng mới được xem/thao tác.
// Trước đây chỉ kiểm tra khi role === 'customer', nên request không kèm token
// (req.user undefined) bỏ qua sạch kiểm tra quyền.
const ensureBookingAccess = (user, booking, action = 'xem') => {
  if (isStaff(user)) {
    return;
  }
  if (!user?.userId || Number(booking.user_id) !== Number(user.userId)) {
    throw new HttpError(403, `Không thể ${action} đặt phòng của khách hàng khác`);
  }
};

const sendError = (res, error) => {
  console.error('Booking API error:', error);
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    message: statusCode === 500 ? 'Lỗi máy chủ nội bộ' : error.message,
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
    // Khách không bao giờ được chọn tài khoản khác bằng cách sửa userId gửi từ
    // trình duyệt: JWT là nguồn sự thật. Chỉ nhân viên (đặt hộ tại quầy) mới
    // được truyền userId khác với token của mình.
    const payload = normalizeBookingPayload(
      isStaff(req.user) ? req.body : { ...req.body, userId: userFromToken },
      userFromToken
    );

    const booking = await bookingService.createBooking(payload, req.user || null);
    res.status(201).json({
      message: 'Đặt phòng thành công',
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
    if (!isStaff(req.user)) {
      filters.userId = normalizeIdParam(req.user?.userId, 'userId');
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
    ensureBookingAccess(req.user, booking);

    res.json({ data: booking });
  } catch (error) {
    sendError(res, error);
  }
};

const cancelBooking = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);

    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'hủy');

    const booking = await bookingService.cancelBooking(
      bookingId,
      req.body?.refund || null,
      req.body?.reason,
      req.user || null
    );
    res.json({
      message: 'Hủy đặt phòng thành công',
      data: booking
    });
  } catch (error) {
    sendError(res, error);
  }
};

// Lịch sử thao tác của một đặt phòng (ai làm gì, lúc nào)
const getBookingHistory = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);

    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking);

    const history = await bookingService.getBookingHistory(bookingId);
    res.json({ data: history });
  } catch (error) {
    sendError(res, error);
  }
};

// Bảng kê tiền còn thiếu + thông tin dựng QR. Khách xem được đơn của mình để
// tự thanh toán trong app; nhân viên xem được mọi đơn để thu tiền tại quầy.
const getPaymentSummary = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);

    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking);

    const summary = await bookingService.getPaymentSummary(bookingId);
    res.json({ data: summary });
  } catch (error) {
    sendError(res, error);
  }
};

// Lễ tân gửi yêu cầu thanh toán cho khách (thông báo trong app + ghi lịch sử).
const requestOutstandingPayment = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const summary = await bookingService.requestOutstandingPayment(bookingId, req.user || null);
    res.json({
      message: 'Đã gửi yêu cầu thanh toán tới khách',
      data: summary
    });
  } catch (error) {
    sendError(res, error);
  }
};

const getRefundPreview = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);

    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking);

    const preview = await bookingService.getRefundPreview(bookingId);
    res.json({ data: preview });
  } catch (error) {
    sendError(res, error);
  }
};

const addServiceCharge = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'thêm dịch vụ');
    const payload = normalizeServiceChargePayload(req.body);
    const result = await bookingService.addServiceCharge(bookingId, payload, req.user || null);
    res.json({
      message: 'Đã thêm dịch vụ thành công',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const updateServiceCharge = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const serviceChargeId = normalizeIdParam(req.params.serviceChargeId, 'serviceChargeId');
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'sửa dịch vụ');
    const payload = normalizeUpdateServiceChargePayload(req.body);
    const result = await bookingService.updateServiceCharge(bookingId, serviceChargeId, payload, req.user || null);
    res.json({
      message: 'Cập nhật số lượng dịch vụ thành công',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const deleteServiceCharge = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const serviceChargeId = normalizeIdParam(req.params.serviceChargeId, 'serviceChargeId');
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'xóa dịch vụ');
    const result = await bookingService.deleteServiceCharge(bookingId, serviceChargeId, req.user || null);
    res.json({
      message: 'Xóa dịch vụ thành công',
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
    const booking = await bookingService.saveGuestIdentities(bookingId, payload, req.user || null);
    res.json({
      message: 'Đã lưu thông tin khách lưu trú',
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
    const result = await bookingService.addDamageCharge(bookingId, payload, req.user || null);
    res.json({
      message: 'Đã thêm phí hư hỏng',
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
    const result = await bookingService.transferRoom(bookingId, payload, req.user || null);
    res.json({
      message: 'Chuyển phòng thành công',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const extendStay = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'gia hạn');
    const payload = normalizeExtendStayPayload(req.body);
    const result = await bookingService.extendStay(bookingId, payload, req.user || null);
    res.json({
      message: 'Gia hạn đặt phòng thành công',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const updateStay = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'cập nhật');
    const payload = normalizeUpdateStayPayload(req.body);
    const result = await bookingService.updateStay(bookingId, payload, req.user || null);
    res.json({
      message: 'Cập nhật đặt phòng thành công',
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
    const result = await bookingService.checkIn(bookingId, payload, req.user || null);
    res.json({
      message: result.message || 'Nhận phòng thành công',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const markNoShow = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const result = await bookingService.markNoShow(bookingId, { actor: req.user || null });
    res.json({
      message: 'Đã đánh dấu khách không đến',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const checkOut = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const booking = await bookingService.checkOut(bookingId, req.user || null);
    res.json({
      message: 'Trả phòng thành công',
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
            'SELECT serviceName, price FROM services WHERE id = ?',
            [row.serviceId]
          );
          if (services.length > 0) {
            return {
              ...row,
              serviceName: services[0].serviceName,
              price: Number(services[0].price),
              estimatedTotal: Number(services[0].price) * row.quantity
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
    res.status(500).json({ message: 'Không thể tải yêu cầu dịch vụ' });
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
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu dịch vụ' });
    }
    
    const request = requests[0];

    if (request.status !== 'pending') {
      return res.status(409).json({ message: 'Yêu cầu dịch vụ này đã được xử lý' });
    }

    // Ghi dịch vụ vào booking_services + tính lại hóa đơn/payment (serviceAmount)
    const result = await bookingService.addServiceCharge(request.bookingId, {
      serviceId: request.serviceId,
      quantity: request.quantity
    }, req.user || null);

    // Update request status
    await db.query(
      'UPDATE booking_service_requests SET status = ? WHERE id = ?',
      ['confirmed', requestId]
    );

    res.json({
      message: 'Đã xác nhận dịch vụ và cộng vào hóa đơn của khách',
      data: result
    });
  } catch (error) {
    sendError(res, error);
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
    
    res.json({ message: 'Đã từ chối yêu cầu dịch vụ' });
  } catch (error) {
    console.error('Error rejecting service request:', error);
    res.status(500).json({ message: 'Không thể từ chối yêu cầu dịch vụ' });
  }
};

module.exports = {
  checkAvailability,
  checkTypeAvailability,
  createBooking,
  listBookings,
  listMyBookings,
  getBookingById,
  getBookingHistory,
  getPaymentSummary,
  requestOutstandingPayment,
  getRefundPreview,
  cancelBooking,
  addServiceCharge,
  updateServiceCharge,
  deleteServiceCharge,
  saveGuestIdentities,
  addDamageCharge,
  extendStay,
  updateStay,
  transferRoom,
  checkIn,
  checkOut,
  markNoShow,
  listServiceRequests,
  confirmServiceRequest,
  rejectServiceRequest
};

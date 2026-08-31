const bookingService = require('../services/bookingService');
const HttpError = require('../utils/httpError');
const { isStaff } = require('../middleware/auth');
const {
  normalizeAvailabilityPayload,
  normalizeBookingPayload,
  normalizeDamageChargePayload,
  normalizeUpdateDamageChargePayload,
  normalizeExtendStayPayload,
  normalizeUpdateStayPayload,
  normalizeGuestIdentitiesPayload,
  normalizeServiceChargePayload,
  normalizeUpdateServiceChargePayload,
  normalizeStatusPayload,
  normalizeTransferRoomPayload,
  normalizeTypeAvailabilityPayload,
  normalizeIdParam,
  normalizeReassignRoomPayload
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

// Chi tiết dòng thời gian có thể chứa email/ID nội bộ của nhân viên,
// nên khách hàng không nhận history trong payload chi tiết.
const withoutEmbeddedHistory = (booking) => {
  const safeBooking = { ...booking };
  delete safeBooking.history;
  return safeBooking;
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
    await bookingService.processOverdueCheckIns().catch((err) => {
      console.error('Error processing overdue check-ins in listBookings:', err);
    });

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

const updateArrivalTime = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const booking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, booking, 'cập nhật giờ đến');

    const { requestedCheckInTime, requestedCheckInDayOffset, dayOffset, notes } = req.body;
    if (!requestedCheckInTime) {
      throw new HttpError(400, 'Vui lòng cung cấp giờ đến dự kiến mới');
    }

    const result = await bookingService.updateBookingRequestedCheckInTime(
      bookingId,
      { requestedCheckInTime, requestedCheckInDayOffset, dayOffset, notes },
      req.user || null
    );

    res.json({
      message: 'Đã cập nhật giờ đến dự kiến thành công',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const recordCustomerContact = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const { action, note } = req.body || {};
    if (!action) {
      throw new HttpError(400, 'Vui lòng cung cấp hành động liên hệ (action)');
    }

    const result = await bookingService.recordCustomerContact(
      bookingId,
      { action, note },
      req.user || null
    );

    res.json({
      message: result.message || 'Cập nhật trạng thái liên hệ thành công',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const processOverdue = async (req, res) => {
  try {
    const results = await bookingService.processOverdueCheckIns();
    res.json({
      message: 'Xử lý các đặt phòng quá hạn check-in thành công',
      data: results
    });
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

    res.json({ data: isStaff(req.user) ? booking : withoutEmbeddedHistory(booking) });
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

    const history = await bookingService.getBookingHistory(bookingId, {
      entityType: req.query.entityType ? String(req.query.entityType) : undefined
    });
    res.json({ data: history });
  } catch (error) {
    sendError(res, error);
  }
};

// Bảng kê tiền còn thiếu + thông tin dựng QR. Khách xem được đơn của mình để
// tự thanh toán trong app; nhân viên xem được mọi đơn để thu tiền tại quầy.
// Lịch sử thao tác của một phòng (dành cho nhân viên xem lại lịch sử phòng).
const getRoomHistory = async (req, res) => {
  try {
    const roomId = normalizeIdParam(req.params.roomId, 'roomId');
    const data = await bookingService.getRoomHistory(roomId);
    res.json({ data });
  } catch (error) {
    sendError(res, error);
  }
};

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

const getBookingServices = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'xem dịch vụ');
    const services = await bookingService.getBookingServices(bookingId);
    res.json({ data: services });
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
      message: 'Cập nhật dịch vụ thành công',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const updateServiceChargeStatus = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const serviceChargeId = normalizeIdParam(req.params.serviceChargeId, 'serviceChargeId');
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'cập nhật trạng thái dịch vụ');
    const { status } = normalizeStatusPayload(req.body);
    const result = await bookingService.updateServiceChargeStatus(bookingId, serviceChargeId, status, req.user || null);
    res.json({
      message: 'Cập nhật trạng thái dịch vụ thành công',
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
    ensureBookingAccess(req.user, currentBooking, 'hủy dịch vụ');
    const result = await bookingService.deleteServiceCharge(bookingId, serviceChargeId, req.user || null);
    res.json({
      message: 'Hủy dịch vụ thành công',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const saveGuestIdentities = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'khai báo khách lưu trú');
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

const getDamageCharges = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'xem khoản phát sinh');
    const charges = await bookingService.getDamageCharges(bookingId);
    res.json({ data: charges });
  } catch (error) {
    sendError(res, error);
  }
};

const addDamageCharge = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'thêm khoản phát sinh');
    const payload = normalizeDamageChargePayload(req.body);
    const result = await bookingService.addDamageCharge(bookingId, payload, req.user || null);
    res.json({
      message: 'Đã thêm khoản phát sinh/hư hỏng',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const updateDamageCharge = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const chargeId = normalizeIdParam(req.params.chargeId, 'chargeId');
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'sửa khoản phát sinh');
    const payload = normalizeUpdateDamageChargePayload(req.body);
    const result = await bookingService.updateDamageCharge(bookingId, chargeId, payload, req.user || null);
    res.json({
      message: 'Cập nhật khoản phát sinh thành công',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const updateDamageChargeStatus = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const chargeId = normalizeIdParam(req.params.chargeId, 'chargeId');
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'cập nhật trạng thái khoản phát sinh');
    const { status } = normalizeStatusPayload(req.body);
    const result = await bookingService.updateDamageChargeStatus(bookingId, chargeId, status, req.user || null);
    res.json({
      message: 'Cập nhật trạng thái khoản phát sinh thành công',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const deleteDamageCharge = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const chargeId = normalizeIdParam(req.params.chargeId, 'chargeId');
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'hủy khoản phát sinh');
    const result = await bookingService.deleteDamageCharge(bookingId, chargeId, req.user || null);
    res.json({
      message: 'Hủy khoản phát sinh thành công',
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

const previewBookingChange = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'xem trước thay đổi');
    const result = await bookingService.previewBookingChange(bookingId, req.body || {});
    res.json({
      message: 'Tính toán chi phí thay đổi thành công',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const changeStay = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'thay đổi ngày ở/chuyển phòng');
    const isStaffOrAdmin = req.user?.role === 'admin' || req.user?.role === 'staff';
    const payload = {
      ...(req.body || {}),
      isStaffOrAdmin
    };
    const result = await bookingService.executeBookingChange(bookingId, payload, req.user || null);
    res.json({
      message: result.message || 'Cập nhật ngày ở và phòng thành công',
      data: result.data || result
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
    const payload = {
      ...(req.body?.guests ? normalizeGuestIdentitiesPayload(req.body) : {}),
      waiveEarlySurcharge: Boolean(req.body?.waiveEarlySurcharge ?? req.body?.waive ?? (!req.body?.applyEarlySurcharge && req.body?.applyEarlySurcharge !== undefined ? true : false)),
      waiveReason: typeof req.body?.waiveReason === 'string'
        ? req.body.waiveReason.trim()
        : (typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''),
    };
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

const extendHold = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const result = await bookingService.extendRoomHoldDeadline(
      bookingId,
      { additionalHours: req.body?.additionalHours || 2, note: req.body?.note || '' },
      req.user || null
    );
    res.json({
      message: result.message || 'Gia hạn giữ phòng thành công',
      data: result.booking
    });
  } catch (error) {
    sendError(res, error);
  }
};

const reactivateNoShow = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const result = await bookingService.reactivateNoShowBooking(
      bookingId,
      { targetRoomId: req.body?.targetRoomId || null, note: req.body?.note || '' },
      req.user || null
    );
    res.json({
      message: result.message || 'Khôi phục đặt phòng thành công',
      data: result.booking
    });
  } catch (error) {
    sendError(res, error);
  }
};

const checkOut = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const booking = await bookingService.checkOut(
      bookingId,
      req.body?.actualCheckOutTime,
      req.user || null,
      { waiveLateFee: Boolean(req.body?.waiveLateFee) }
    );
    if (booking.requiresPayment) {
      return res.status(409).json({
        message: `Đã cộng phí trả phòng muộn ${Number(booking.lateCheckout.feeAmount || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}₫. Vui lòng thu đủ tiền trước khi trả phòng.`,
        data: booking
      });
    }
    res.json({
      message: booking.lateCheckout ? `Trả phòng thành công (đã tính phí trễ giờ)` : 'Trả phòng thành công',
      data: booking
    });
  } catch (error) {
    sendError(res, error);
  }
};

// ── Yêu cầu dịch vụ do KHÁCH tự đặt ──────────────────────────────────────────
// Khách không ghi thẳng vào booking_services (như lễ tân) mà tạo một dòng chờ
// duyệt trong booking_service_requests. Tiền chỉ được cộng vào đơn khi lễ tân
// bấm xác nhận (confirmServiceRequest). Nhờ vậy khách còn quyền tự huỷ chừng
// nào yêu cầu chưa được duyệt — dùng đúng bảng và cột đã có, không thêm gì.

const SERVICE_REQUEST_SELECT = `
  SELECT sr.id, sr.bookingId, sr.bookingDetailId,
         COALESCE(bd.roomId, sr.roomId) AS roomId,
         sr.serviceId, sr.quantity, sr.status, sr.note, sr.createdAt,
         s.serviceName, s.description, s.price AS unitPrice,
         (s.price * sr.quantity) AS totalPrice,
         r.roomNumber
    FROM booking_service_requests sr
    LEFT JOIN services s ON s.id = sr.serviceId
    LEFT JOIN bookings b ON b.id = sr.bookingId
    LEFT JOIN booking_details bd ON bd.id = sr.bookingDetailId
    LEFT JOIN rooms r ON r.id = COALESCE(bd.roomId, sr.roomId, b.room_id)
`;

/** Khách xem các yêu cầu dịch vụ của chính đơn mình. */
const listBookingServiceRequests = async (req, res) => {
  try {
    const db = require('../config/db');
    const bookingId = normalizeIdParam(req.params.id);
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'xem dịch vụ trong');

    const [rows] = await db.query(
      `${SERVICE_REQUEST_SELECT} WHERE sr.bookingId = ? ORDER BY sr.id DESC`,
      [bookingId]
    );
    res.json({ data: rows });
  } catch (error) {
    sendError(res, error);
  }
};

/** Khách gửi yêu cầu dịch vụ, chờ lễ tân duyệt mới tính tiền. */
const createServiceRequest = async (req, res) => {
  try {
    const db = require('../config/db');
    const bookingId = normalizeIdParam(req.params.id);
    const currentBooking = await bookingService.getBookingById(bookingId);
    ensureBookingAccess(req.user, currentBooking, 'đặt thêm dịch vụ cho');

    const bookingStatus = String(
      currentBooking.bookingStatus || currentBooking.status || ''
    ).toLowerCase();
    if (!['pending', 'confirmed', 'checked_in'].includes(bookingStatus)) {
      throw new HttpError(
        400,
        'Đơn đặt phòng đã kết thúc, không thể đặt thêm dịch vụ.'
      );
    }

    const serviceId = normalizeIdParam(req.body.serviceId, 'serviceId');
    const quantity = normalizeIdParam(req.body.quantity ?? 1, 'quantity');
    const roomId = req.body.roomId != null ? normalizeIdParam(req.body.roomId, 'roomId') : null;
    const bookingDetailId = req.body.bookingDetailId != null
      ? normalizeIdParam(req.body.bookingDetailId, 'bookingDetailId')
      : null;
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 500) : null;

    const [services] = await db.query('SELECT id FROM services WHERE id = ?', [serviceId]);
    if (services.length === 0) {
      throw new HttpError(404, 'Không tìm thấy dịch vụ này');
    }

    const [result] = await db.query(
      `INSERT INTO booking_service_requests
         (bookingId, bookingDetailId, roomId, serviceId, quantity, status, note)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [bookingId, bookingDetailId, roomId, serviceId, quantity, note]
    );

    const [rows] = await db.query(`${SERVICE_REQUEST_SELECT} WHERE sr.id = ?`, [result.insertId]);

    res.status(201).json({
      message: 'Đã gửi yêu cầu dịch vụ, vui lòng chờ lễ tân xác nhận.',
      data: rows[0] || { id: result.insertId }
    });
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * Khách tự huỷ yêu cầu dịch vụ khi lễ tân CHƯA duyệt.
 * Đã duyệt rồi thì tiền đã vào đơn, phải nhờ lễ tân xử lý.
 */
const cancelServiceRequest = async (req, res) => {
  try {
    const db = require('../config/db');
    const requestId = normalizeIdParam(req.params.id);

    const [requests] = await db.query(
      'SELECT * FROM booking_service_requests WHERE id = ?',
      [requestId]
    );
    if (!requests.length) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu dịch vụ' });
    }

    const request = requests[0];
    const currentBooking = await bookingService.getBookingById(request.bookingId);
    ensureBookingAccess(req.user, currentBooking, 'hủy dịch vụ trong');

    if (request.status === 'confirmed') {
      return res.status(400).json({
        message:
          'Dịch vụ đã được lễ tân xác nhận, vui lòng liên hệ lễ tân nếu cần hỗ trợ.'
      });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Yêu cầu dịch vụ này đã được xử lý.' });
    }

    // Điều kiện status='pending' ngay trong câu UPDATE để hai người bấm cùng lúc
    // (khách huỷ / lễ tân duyệt) không ghi đè kết quả của nhau.
    const [result] = await db.query(
      "UPDATE booking_service_requests SET status = 'cancelled' WHERE id = ? AND status = 'pending'",
      [requestId]
    );
    if (result.affectedRows === 0) {
      return res.status(409).json({
        message: 'Yêu cầu vừa được lễ tân xử lý, vui lòng tải lại trang.'
      });
    }

    res.json({ message: 'Hủy dịch vụ thành công', data: { id: requestId } });
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
        sr.bookingDetailId,
        COALESCE(bd.roomId, sr.roomId) AS roomId,
        sr.serviceId,
        sr.quantity,
        sr.status,
        sr.note,
        sr.createdAt,
        b.status as bookingStatus,
        r.roomNumber,
        c.fullName as bookingCustomer,
        c.phone as bookingPhone
      FROM booking_service_requests sr
      LEFT JOIN bookings b ON sr.bookingId = b.id
      LEFT JOIN booking_details bd ON bd.id = sr.bookingDetailId
      LEFT JOIN rooms r ON r.id = COALESCE(bd.roomId, sr.roomId, b.room_id)
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

    let targetRoomId = request.roomId || null;
    let targetBookingDetailId = request.bookingDetailId || null;

    if (targetBookingDetailId) {
      const [bdRows] = await db.query(
        'SELECT roomId FROM booking_details WHERE id = ? AND bookingId = ?',
        [targetBookingDetailId, request.bookingId]
      );
      if (bdRows.length > 0 && bdRows[0].roomId) {
        targetRoomId = bdRows[0].roomId;
      }
    }

    // Ghi dịch vụ vào booking_services + tính lại hóa đơn/payment (serviceAmount)
    const result = await bookingService.addServiceCharge(request.bookingId, {
      serviceId: request.serviceId,
      quantity: request.quantity,
      roomId: targetRoomId,
      bookingDetailId: targetBookingDetailId
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

    // Chỉ đổi được yêu cầu còn đang chờ. Câu lệnh cũ không lọc theo trạng thái
    // và không xét affectedRows nên luôn báo thành công, kể cả khi id không tồn
    // tại hoặc yêu cầu đã được xác nhận trước đó — tức là đè ngược confirmed
    // thành rejected trong khi tiền dịch vụ đã tính vào đơn.
    const [result] = await db.query(
      "UPDATE booking_service_requests SET status = 'rejected' WHERE id = ? AND status = 'pending'",
      [requestId]
    );

    if (result.affectedRows === 0) {
      return res.status(409).json({
        message: 'Yêu cầu không tồn tại hoặc đã được xử lý trước đó'
      });
    }

    // Khách đang chờ nên phải báo lại, nếu không họ cứ thấy "chờ xác nhận" mãi
    // và không hiểu vì sao dịch vụ biến mất. Lỗi ghi thông báo không được làm
    // hỏng thao tác từ chối vốn đã ghi xong.
    try {
      const [rows] = await db.query(
        `SELECT sr.bookingId, b.user_id, s.serviceName
           FROM booking_service_requests sr
           LEFT JOIN bookings b ON b.id = sr.bookingId
           LEFT JOIN services s ON s.id = sr.serviceId
          WHERE sr.id = ?`,
        [requestId]
      );
      const info = rows[0];
      if (info?.user_id) {
        await db.query(
          `INSERT INTO notifications (accountId, title, content, isRead)
           VALUES (?, ?, ?, 0)`,
          [
            info.user_id,
            'Yêu cầu dịch vụ không được duyệt',
            `Rất tiếc, yêu cầu dịch vụ ${info.serviceName || ''} cho đặt phòng #${info.bookingId} chưa thể phục vụ. Vui lòng liên hệ lễ tân để được hỗ trợ.`
          ]
        );
      }
    } catch (notifyError) {
      console.error('Không tạo được thông báo từ chối dịch vụ:', notifyError.message);
    }

    res.json({ message: 'Đã từ chối yêu cầu dịch vụ' });
  } catch (error) {
    console.error('Error rejecting service request:', error);
    res.status(500).json({ message: 'Không thể từ chối yêu cầu dịch vụ' });
  }
};

const reassignRoom = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const payload = normalizeReassignRoomPayload(req.body);
    const result = await bookingService.reassignConflictingBooking(bookingId, payload, req.user || null);
    res.json({
      message: 'Đã đổi phòng cho đặt phòng',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};


const resetBookingHold = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const result = await bookingService.resetBookingHold(bookingId, req.user || null);
    res.json({
      message: result.message || 'Gia hạn giữ phòng thành công',
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

const adminCheckAvailability = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const result = await bookingService.adminCheckAvailabilityForBooking(bookingId, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    sendError(res, error);
  }
};

const adminPreviewModify = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const result = await bookingService.adminPreviewModifyBooking(bookingId, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    sendError(res, error);
  }
};

const adminModifyBooking = async (req, res) => {
  try {
    const bookingId = normalizeIdParam(req.params.id);
    const actor = {
      userId: req.user?.id || null,
      role: req.user?.role || 'admin',
      fullName: req.user?.fullName || 'Admin'
    };
    const result = await bookingService.adminModifyBooking(bookingId, req.body, actor);
    res.json({ success: true, data: result });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  adminCheckAvailability,
  adminPreviewModify,
  adminModifyBooking,
  checkAvailability,
  checkTypeAvailability,
  createBooking,
  listBookings,
  listMyBookings,
  getBookingById,
  getBookingHistory,
  getRoomHistory,
  getPaymentSummary,
  requestOutstandingPayment,
  getRefundPreview,
  cancelBooking,
  resetBookingHold,
  getBookingServices,
  addServiceCharge,
  updateServiceCharge,
  updateServiceChargeStatus,
  deleteServiceCharge,
  saveGuestIdentities,
  getDamageCharges,
  addDamageCharge,
  updateDamageCharge,
  updateDamageChargeStatus,
  deleteDamageCharge,
  extendStay,
  updateStay,
  transferRoom,
  previewBookingChange,
  changeStay,
  checkIn,
  checkOut,
  markNoShow,
  extendHold,
  reactivateNoShow,
  updateArrivalTime,
  recordCustomerContact,
  processOverdue,
  listServiceRequests,
  listBookingServiceRequests,
  createServiceRequest,
  cancelServiceRequest,
  confirmServiceRequest,
  rejectServiceRequest,
  reassignRoom
};
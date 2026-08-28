const express = require('express');
const bookingController = require('../controllers/bookingController');
const { requireAuth, requireStaff } = require('../middleware/auth');

const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

// Hai API tra cứu này KHÔNG cần đăng nhập, mà mỗi lần gọi đều chạy vài lệnh
// UPDATE dọn đơn hết hạn cộng nhiều truy vấn theo từng hạng phòng. Pool chỉ có
// vài kết nối nên gọi dồn dập là nghẽn cả site.
const availabilityLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  scope: 'availability',
  message: 'Bạn tra cứu quá nhanh, vui lòng chờ một chút rồi thử lại.'
});

// Tạo đơn: đã có hạn mức đơn chờ thanh toán ở tầng nghiệp vụ, thêm chặn tần
// suất để không ai dội hàng trăm request một lúc.
const createBookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyBy: (req) => `user:${req.user?.userId || req.ip}`,
  message: 'Bạn đặt phòng quá nhanh, vui lòng chờ một chút rồi thử lại.'
});


router.post('/check-availability', availabilityLimiter, bookingController.checkAvailability);
router.post('/check-type-availability', availabilityLimiter, bookingController.checkTypeAvailability);
router.post('/', requireAuth, createBookingLimiter, bookingController.createBooking);
router.get('/me', requireAuth, bookingController.listMyBookings);
// Khách đăng nhập chỉ nhận được đặt phòng của chính mình (controller tự ép lọc
// theo userId trong token); nhân viên mới xem được toàn bộ danh sách.
router.get('/', requireAuth, bookingController.listBookings);
router.get('/:id', requireAuth, bookingController.getBookingById);
router.get('/:id/history', requireAuth, requireStaff, bookingController.getBookingHistory);
// Lịch sử thao tác của một phòng, gộp từ mọi đơn từng dùng phòng đó
router.get('/room-history/:roomId', requireAuth, requireStaff, bookingController.getRoomHistory);
router.get('/:id/payment-summary', requireAuth, bookingController.getPaymentSummary);
router.post('/:id/payment-request', requireAuth, requireStaff, bookingController.requestOutstandingPayment);
router.get('/:id/refund-preview', requireAuth, bookingController.getRefundPreview);
router.patch('/:id/cancel', requireAuth, bookingController.cancelBooking);
router.post('/:id/reset-hold', requireAuth, bookingController.resetBookingHold);
router.post('/:id/guests', requireAuth, bookingController.saveGuestIdentities);
// Khách (chủ booking) hoặc nhân viên thao tác dịch vụ/phí phát sinh trên booking
// Khách đặt thêm dịch vụ giữa kỳ lưu trú: tạo yêu cầu chờ lễ tân duyệt, chưa
// tính tiền ngay. Chừng nào chưa được duyệt thì khách còn tự huỷ được.
router.get('/:id/service-requests', requireAuth, bookingController.listBookingServiceRequests);
router.post('/:id/service-requests', requireAuth, bookingController.createServiceRequest);

router.get('/:id/services', requireAuth, bookingController.getBookingServices);
router.post('/:id/services', requireAuth, bookingController.addServiceCharge);
router.patch('/:id/services/:serviceChargeId/status', requireAuth, bookingController.updateServiceChargeStatus);
router.patch('/:id/services/:serviceChargeId', requireAuth, bookingController.updateServiceCharge);
router.delete('/:id/services/:serviceChargeId', requireAuth, bookingController.deleteServiceCharge);

router.get('/:id/damages', requireAuth, bookingController.getDamageCharges);
router.post('/:id/damages', requireAuth, requireStaff, bookingController.addDamageCharge);
router.patch('/:id/damages/:chargeId', requireAuth, requireStaff, bookingController.updateDamageCharge);
router.delete('/:id/damages/:chargeId', requireAuth, requireStaff, bookingController.deleteDamageCharge);
router.patch('/:id/extend', requireAuth, bookingController.extendStay);
router.patch('/:id/update-stay', requireAuth, bookingController.updateStay);
router.patch('/:id/transfer-room', requireAuth, requireStaff, bookingController.transferRoom);
router.post('/:id/preview-change', requireAuth, bookingController.previewBookingChange);
router.patch('/:id/change-stay', requireAuth, bookingController.changeStay);
router.patch('/:id/no-show', requireAuth, requireStaff, bookingController.markNoShow);
router.patch('/:id/extend-hold', requireAuth, requireStaff, bookingController.extendHold);
router.patch('/:id/reactivate', requireAuth, requireStaff, bookingController.reactivateNoShow);
router.patch('/:id/reassign-room', requireAuth, requireStaff, bookingController.reassignRoom);
router.patch('/:id/check-in', requireAuth, requireStaff, bookingController.checkIn);
router.patch('/:id/check-out', requireAuth, requireStaff, bookingController.checkOut);
router.patch('/:id/arrival-time', requireAuth, bookingController.updateArrivalTime);
router.post('/:id/contact-status', requireAuth, requireStaff, bookingController.recordCustomerContact);
router.patch('/:id/contact-status', requireAuth, requireStaff, bookingController.recordCustomerContact);
// Quét toàn bộ đơn quá hạn nhận phòng, đánh dấu no-show và phát voucher đền bù
// nên phải là thao tác của nhân viên, không phải của khách.
router.post('/process-overdue', requireAuth, requireStaff, bookingController.processOverdue);
router.post('/:id/admin-check-availability', requireAuth, requireStaff, bookingController.adminCheckAvailability);
router.post('/:id/admin-preview-modify', requireAuth, requireStaff, bookingController.adminPreviewModify);
router.patch('/:id/admin-modify', requireAuth, requireStaff, bookingController.adminModifyBooking);

module.exports = router;

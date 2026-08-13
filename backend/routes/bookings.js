const express = require('express');
const bookingController = require('../controllers/bookingController');
const { requireAuth, requireStaff } = require('../middleware/auth');

const router = express.Router();

router.post('/check-availability', bookingController.checkAvailability);
router.post('/check-type-availability', bookingController.checkTypeAvailability);
router.post('/', requireAuth, bookingController.createBooking);
router.get('/me', requireAuth, bookingController.listMyBookings);
// Khách đăng nhập chỉ nhận được đặt phòng của chính mình (controller tự ép lọc
// theo userId trong token); nhân viên mới xem được toàn bộ danh sách.
router.get('/', requireAuth, bookingController.listBookings);
router.get('/:id', requireAuth, bookingController.getBookingById);
router.get('/:id/history', requireAuth, bookingController.getBookingHistory);
// Lịch sử thao tác của một phòng, gộp từ mọi đơn từng dùng phòng đó
router.get('/room-history/:roomId', requireAuth, requireStaff, bookingController.getRoomHistory);
router.get('/:id/payment-summary', requireAuth, bookingController.getPaymentSummary);
router.post('/:id/payment-request', requireAuth, requireStaff, bookingController.requestOutstandingPayment);
router.get('/:id/refund-preview', requireAuth, bookingController.getRefundPreview);
router.patch('/:id/cancel', requireAuth, bookingController.cancelBooking);
router.post('/:id/reset-hold', requireAuth, bookingController.resetBookingHold);
router.post('/:id/guests', requireAuth, requireStaff, bookingController.saveGuestIdentities);
// Khách (chủ booking) hoặc nhân viên thao tác dịch vụ/phí phát sinh trên booking
router.get('/:id/services', requireAuth, bookingController.getBookingServices);
router.post('/:id/services', requireAuth, bookingController.addServiceCharge);
router.patch('/:id/services/:serviceChargeId/status', requireAuth, bookingController.updateServiceChargeStatus);
router.patch('/:id/services/:serviceChargeId', requireAuth, bookingController.updateServiceCharge);
router.delete('/:id/services/:serviceChargeId', requireAuth, bookingController.deleteServiceCharge);

router.get('/:id/damages', requireAuth, bookingController.getDamageCharges);
router.post('/:id/damages', requireAuth, requireStaff, bookingController.addDamageCharge);
router.patch('/:id/damages/:chargeId/status', requireAuth, requireStaff, bookingController.updateDamageChargeStatus);
router.patch('/:id/damages/:chargeId', requireAuth, requireStaff, bookingController.updateDamageCharge);
router.delete('/:id/damages/:chargeId', requireAuth, requireStaff, bookingController.deleteDamageCharge);
router.patch('/:id/extend', requireAuth, bookingController.extendStay);
router.patch('/:id/update-stay', requireAuth, bookingController.updateStay);
router.patch('/:id/transfer-room', requireAuth, requireStaff, bookingController.transferRoom);
router.patch('/:id/check-in', requireAuth, requireStaff, bookingController.checkIn);
router.patch('/:id/check-out', requireAuth, requireStaff, bookingController.checkOut);
router.patch('/:id/arrival-time', requireAuth, bookingController.updateArrivalTime);
router.post('/process-overdue', requireAuth, bookingController.processOverdue);
router.post('/:id/admin-check-availability', requireAuth, requireStaff, bookingController.adminCheckAvailability);
router.post('/:id/admin-preview-modify', requireAuth, requireStaff, bookingController.adminPreviewModify);
router.patch('/:id/admin-modify', requireAuth, requireStaff, bookingController.adminModifyBooking);

module.exports = router;

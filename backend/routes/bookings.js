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
router.get('/:id/payment-summary', requireAuth, bookingController.getPaymentSummary);
router.post('/:id/payment-request', requireAuth, requireStaff, bookingController.requestOutstandingPayment);
router.get('/:id/refund-preview', requireAuth, bookingController.getRefundPreview);
router.patch('/:id/cancel', requireAuth, bookingController.cancelBooking);
router.post('/:id/guests', requireAuth, requireStaff, bookingController.saveGuestIdentities);
// Khách (chủ booking) được phép sửa/thêm/xóa dịch vụ trên booking của mình
router.post('/:id/services', requireAuth, bookingController.addServiceCharge);
router.patch('/:id/services/:serviceChargeId', requireAuth, bookingController.updateServiceCharge);
router.delete('/:id/services/:serviceChargeId', requireAuth, bookingController.deleteServiceCharge);
router.post('/:id/damages', requireAuth, requireStaff, bookingController.addDamageCharge);
router.patch('/:id/extend', requireAuth, bookingController.extendStay);
router.patch('/:id/update-stay', requireAuth, bookingController.updateStay);
router.patch('/:id/transfer-room', requireAuth, requireStaff, bookingController.transferRoom);
router.patch('/:id/check-in', requireAuth, requireStaff, bookingController.checkIn);
router.patch('/:id/check-out', requireAuth, requireStaff, bookingController.checkOut);
router.patch('/:id/no-show', requireAuth, requireStaff, bookingController.markNoShow);
router.patch('/:id/reassign-room', requireAuth, requireStaff, bookingController.reassignRoom);

module.exports = router;

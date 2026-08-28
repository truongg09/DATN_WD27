const express = require('express');
const bookingController = require('../controllers/bookingController');
const { requireAuth, requireStaff } = require('../middleware/auth');

const router = express.Router();

// Service requests made by customers at booking time.
// GET    /api/service-requests           -> list (optional ?status=pending|confirmed|rejected)
// PATCH  /api/service-requests/:id/confirm -> charge the service to the booking & recalc payment
// PATCH  /api/service-requests/:id/reject  -> mark the request as rejected
//
// Cả ba đường dẫn đều là nghiệp vụ quầy lễ tân: danh sách lộ tên khách và số
// phòng, còn xác nhận thì tính thêm tiền vào đơn của khách. Thiếu hai lớp chặn
// này thì người lạ gọi thẳng API cũng làm được.
router.get('/', requireAuth, requireStaff, bookingController.listServiceRequests);
router.patch('/:id/confirm', requireAuth, requireStaff, bookingController.confirmServiceRequest);
router.patch('/:id/reject', requireAuth, requireStaff, bookingController.rejectServiceRequest);

// Ngoại lệ duy nhất không cần requireStaff: khách tự huỷ yêu cầu của chính mình
// khi lễ tân chưa duyệt. Handler tự đối chiếu chủ đơn (ensureBookingAccess) và
// từ chối nếu yêu cầu đã được xác nhận.
router.patch('/:id/cancel', requireAuth, bookingController.cancelServiceRequest);

module.exports = router;

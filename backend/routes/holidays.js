const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/holidayController');
const { requireAuth, requireStaff, requireAdmin } = require('../middleware/auth');

// Route công khai hoặc người dùng đăng nhập để lấy danh sách ngày lễ
router.get('/', holidayController.getHolidays);
router.get('/:id', holidayController.getHolidayById);

// Các route quản lý dành riêng cho Admin / Staff
router.post('/auto-sync', requireAuth, requireStaff, holidayController.syncUpcomingHolidays);
router.post('/', requireAuth, requireStaff, holidayController.createHoliday);
router.put('/:id', requireAuth, requireStaff, holidayController.updateHoliday);
router.delete('/:id', requireAuth, requireAdmin, holidayController.deleteHoliday);

module.exports = router;

const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/holidayController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Route công khai hoặc người dùng đăng nhập để lấy danh sách ngày lễ
router.get('/', holidayController.getHolidays);
router.get('/:id', holidayController.getHolidayById);

// Các route quản lý dành riêng cho Admin / Employee
router.post('/', requireAuth, requireRole(['admin', 'employee']), holidayController.createHoliday);
router.put('/:id', requireAuth, requireRole(['admin', 'employee']), holidayController.updateHoliday);
router.delete('/:id', requireAuth, requireRole(['admin']), holidayController.deleteHoliday);

module.exports = router;

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

// GET /api/notifications/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const accountId = req.user.userId;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;

    const result = await notificationService.getUserNotifications(accountId, { limit, offset });
    res.json(result);
  } catch (error) {
    console.error('Get user notifications error:', error);
    res.status(500).json({ message: 'Lỗi khi tải thông báo' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const accountId = req.user.userId;
    const notificationId = Number(req.params.id);

    if (!notificationId) {
      return res.status(400).json({ message: 'ID thông báo không hợp lệ' });
    }

    const result = await notificationService.markNotificationAsRead(notificationId, accountId);

    if (result.notFound) {
      return res.status(404).json({ message: 'Thông báo không tồn tại' });
    }

    if (result.forbidden) {
      return res.status(403).json({ message: 'Không có quyền thao tác trên thông báo của tài khoản khác' });
    }

    res.json({ message: 'Đã đánh dấu đã đọc' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Lỗi khi cập nhật thông báo' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    const accountId = req.user.userId;
    await notificationService.markAllNotificationsAsRead(accountId);
    res.json({ message: 'Đã đánh dấu tất cả đã đọc' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ message: 'Lỗi khi cập nhật thông báo' });
  }
});

module.exports = router;

const express = require('express');
const db = require('../config/db');

const { requireAuth, requireStaff, requireAdmin } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

const buildVoucherNotification = (voucher) => {
  const discountText = voucher.discountType === 'percentage'
    ? `${Number(voucher.discountValue)}%${voucher.maxDiscount ? ` (tối đa ${new Intl.NumberFormat('vi-VN').format(voucher.maxDiscount)}đ)` : ''}`
    : `${new Intl.NumberFormat('vi-VN').format(voucher.discountValue)}đ`;
  const minAmountText = voucher.minBookingAmount ? ` cho đơn từ ${new Intl.NumberFormat('vi-VN').format(voucher.minBookingAmount)}đ` : '';
  const expiryText = voucher.endDate ? ` đến hết ${new Date(voucher.endDate).toLocaleDateString('vi-VN')}` : '';

  const title = `Ưu đãi mới: Mã giảm giá ${voucher.code}`;
  const content = `Nhận ngay ưu đãi giảm ${discountText}${minAmountText}${expiryText}. Số lượng có hạn, hãy nhanh tay áp dụng khi đặt phòng!`;

  return { title, content };
};

const normalizeVoucherPayload = (body) => {
  const discountType = body.discountType === 'percent' ? 'percentage' : body.discountType;
  const discountValue = Number(body.discountValue);
  const maxDiscount = Number(body.maxDiscount || 0);
  const minBookingAmount = Number(body.minBookingAmount || 0);
  const quantity = Number(body.quantity || 1);

  if (!['percentage', 'fixed'].includes(discountType)) return { error: 'Loại giảm giá không hợp lệ' };
  if (!Number.isFinite(discountValue) || discountValue <= 0) return { error: 'Giá trị giảm giá phải lớn hơn 0' };
  if (discountType === 'percentage' && discountValue > 100) return { error: 'Giảm giá phần trăm phải từ 0 đến 100%' };
  if (!Number.isFinite(maxDiscount) || maxDiscount < 0) return { error: 'Mức giảm tối đa không hợp lệ' };
  // Voucher phần trăm không có trần sẽ giảm theo tổng đơn, đơn càng lớn mất
  // càng nhiều tiền. Bắt buộc đặt trần để giới hạn thiệt hại.
  if (discountType === 'percentage' && maxDiscount <= 0) {
    return { error: 'Voucher giảm theo phần trăm phải có mức giảm tối đa lớn hơn 0' };
  }
  if (!Number.isFinite(minBookingAmount) || minBookingAmount < 0) return { error: 'Giá trị đơn tối thiểu không hợp lệ' };
  if (!Number.isInteger(quantity) || quantity < 1) return { error: 'Số lượng voucher phải là số nguyên dương' };
  if (body.endDate < body.startDate) return { error: 'Ngày kết thúc phải sau ngày bắt đầu' };

  // Danh sách rỗng nghĩa là voucher dùng được cho mọi hạng phòng.
  const roomTypeIds = Array.isArray(body.roomTypeIds)
    ? [...new Set(body.roomTypeIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    : [];

  return {
    data: {
      ...body,
      code: String(body.code || '').trim().toUpperCase(),
      discountType,
      discountValue,
      maxDiscount: maxDiscount || null,
      minBookingAmount: minBookingAmount || null,
      quantity,
      roomTypeIds,
    },
  };
};

// Ghi lại danh sách hạng phòng áp dụng của một voucher.
const replaceVoucherRoomTypes = async (connection, voucherId, roomTypeIds) => {
  await connection.query('DELETE FROM voucher_room_types WHERE voucherId = ?', [voucherId]);
  if (roomTypeIds.length === 0) return;
  await connection.query(
    'INSERT INTO voucher_room_types (voucherId, roomTypeId) VALUES ?',
    [roomTypeIds.map((roomTypeId) => [voucherId, roomTypeId])]
  );
};

// Voucher dành riêng cho khách đang đăng nhập: các mã được tặng riêng cho họ
// (VD voucher đền bù khi khách sạn hủy phòng) cộng với các mã công khai còn
// hiệu lực. Trước đây trang Hồ sơ gọi thẳng GET '/' nên khách nhìn thấy cả
// voucher đền bù tặng riêng người khác.
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [vouchers] = await db.query(
      `SELECT DISTINCT
         v.id, v.code, v.discountType, v.discountValue, v.maxDiscount,
         v.minBookingAmount, v.startDate, v.endDate, v.status,
         cv.source AS grantedSource,
         (cv.id IS NOT NULL) AS isPersonal,
         (
           SELECT GROUP_CONCAT(rt.typeName SEPARATOR ', ')
           FROM voucher_room_types vrt
           JOIN room_types rt ON rt.id = vrt.roomTypeId
           WHERE vrt.voucherId = v.id
         ) AS roomTypeNames
       FROM vouchers v
       LEFT JOIN customer_vouchers cv
         ON cv.voucherId = v.id AND cv.userId = ? AND cv.isUsed = 0
       WHERE v.status = 'active'
         AND v.quantity > 0
         AND NOW() BETWEEN v.startDate AND v.endDate
         AND (
           cv.id IS NOT NULL
           OR NOT EXISTS (SELECT 1 FROM customer_vouchers cv2 WHERE cv2.voucherId = v.id)
         )
       ORDER BY isPersonal DESC, v.endDate ASC`,
      [req.user.userId]
    );
    res.json({ data: vouchers });
  } catch (error) {
    console.error('List my vouchers error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Danh sách đầy đủ phục vụ màn hình quản trị (kèm số lượng còn lại, mã đã hết
// hạn...) nên chỉ quản trị viên được xem.
router.get('/', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [vouchers] = await db.query(
      `SELECT
         id,
         code,
         discountType,
         discountValue,
         maxDiscount,
         minBookingAmount,
         quantity,
         startDate,
         endDate,
         status,
         (
           SELECT GROUP_CONCAT(vrt.roomTypeId)
           FROM voucher_room_types vrt
           WHERE vrt.voucherId = vouchers.id
         ) AS roomTypeIds,
         (
           SELECT GROUP_CONCAT(rt.typeName SEPARATOR ', ')
           FROM voucher_room_types vrt
           JOIN room_types rt ON rt.id = vrt.roomTypeId
           WHERE vrt.voucherId = vouchers.id
         ) AS roomTypeNames
       FROM vouchers
       ORDER BY id DESC`
    );
    res.json({ data: vouchers });
  } catch (error) {
    console.error('List vouchers error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const normalized = normalizeVoucherPayload(req.body);
    if (normalized.error) return res.status(400).json({ message: normalized.error });
    const { code, discountType, discountValue, maxDiscount, minBookingAmount, quantity, startDate, endDate, status = 'active' } = normalized.data;

    if (!code || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ message: 'Thiếu thông tin voucher' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        `INSERT INTO vouchers (code, discountType, discountValue, maxDiscount, minBookingAmount, quantity, startDate, endDate, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [code, discountType, discountValue, maxDiscount, minBookingAmount, quantity, startDate, endDate, status]
      );
      await replaceVoucherRoomTypes(connection, result.insertId, normalized.data.roomTypeIds);

      // Nếu voucher tạo ra ở trạng thái active -> thông báo cho khách hàng
      if (status === 'active') {
        const { title, content } = buildVoucherNotification(normalized.data);
        await notificationService.createNotificationForCustomers({
          type: 'voucher',
          title,
          content,
          referenceType: 'voucher',
          referenceId: result.insertId
        }, connection);
      }

      await connection.commit();
      res.status(201).json({ data: { id: result.insertId }, message: 'Tạo voucher thành công' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create voucher error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Mã voucher đã tồn tại' });
    }
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const voucherId = Number(req.params.id);
    const normalized = normalizeVoucherPayload(req.body);
    if (normalized.error) return res.status(400).json({ message: normalized.error });
    const { code, discountType, discountValue, maxDiscount, minBookingAmount, quantity, startDate, endDate, status } = normalized.data;

    if (!voucherId || !code || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ message: 'Thiếu thông tin voucher' });
    }

    // Lấy trạng thái cũ của voucher để kiểm tra xem đã từng active chưa
    const [existingVouchers] = await db.query('SELECT status, code FROM vouchers WHERE id = ?', [voucherId]);
    const oldStatus = existingVouchers[0]?.status;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `UPDATE vouchers
         SET code = ?, discountType = ?, discountValue = ?, maxDiscount = ?, minBookingAmount = ?, quantity = ?, startDate = ?, endDate = ?, status = ?
         WHERE id = ?`,
        [code, discountType, discountValue, maxDiscount, minBookingAmount, quantity, startDate, endDate, status || 'active', voucherId]
      );
      await replaceVoucherRoomTypes(connection, voucherId, normalized.data.roomTypeIds);

      // Nếu voucher chuyển từ trạng thái không active sang active lần đầu -> thông báo cho khách hàng
      if (oldStatus !== 'active' && (status === 'active' || (!status && oldStatus !== 'active'))) {
        const { title, content } = buildVoucherNotification(normalized.data);
        await notificationService.createNotificationForCustomers({
          type: 'voucher',
          title,
          content,
          referenceType: 'voucher',
          referenceId: voucherId
        }, connection);
      }

      await connection.commit();
      res.json({ message: 'Cập nhật voucher thành công' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update voucher error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Mã voucher đã tồn tại' });
    }
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const voucherId = Number(req.params.id);
    if (!voucherId) {
      return res.status(400).json({ message: 'ID voucher không hợp lệ' });
    }

    await db.query('DELETE FROM vouchers WHERE id = ?', [voucherId]);
    res.json({ message: 'Xóa voucher thành công' });
  } catch (error) {
    console.error('Delete voucher error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

module.exports = router;

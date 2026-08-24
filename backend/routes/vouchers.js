const express = require('express');
const db = require('../config/db');

const { requireAuth, requireStaff, requireAdmin } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');

const router = express.Router();

// Voucher gán riêng thì ngoài thông báo trong web còn gửi email cho từng khách.
// Email chỉ là thông báo nên gọi SAU commit và không chờ kết quả: SMTP hỏng
// không được phép làm hỏng thao tác tạo/sửa voucher mà admin vừa thực hiện.
const sendVoucherEmails = async (userIds, voucher, { isCompensation = false } = {}) => {
  const targets = [...new Set(userIds || [])];
  if (targets.length === 0 || !emailService.isEmailConfigured()) return;

  try {
    const [recipients] = await db.query(
      `SELECT a.id, a.email, COALESCE(c.fullName, a.email) AS fullName
         FROM accounts a
         LEFT JOIN customers c ON c.accountId = a.id
        WHERE a.id IN (?) AND a.email IS NOT NULL AND a.email <> ''`,
      [targets]
    );
    const [roomTypeRows] = await db.query(
      `SELECT GROUP_CONCAT(rt.typeName SEPARATOR ', ') AS roomTypeNames
         FROM voucher_room_types vrt
         JOIN room_types rt ON rt.id = vrt.roomTypeId
        WHERE vrt.voucherId = ?`,
      [voucher.id]
    );

    const payload = { ...voucher, roomTypeNames: roomTypeRows[0]?.roomTypeNames || null };
    for (const recipient of recipients) {
      void emailService.sendVoucherGrantedEmail({
        to: recipient.email,
        customerName: recipient.fullName,
        voucher: payload,
        isCompensation
      });
    }
  } catch (error) {
    console.error(`Send voucher email for voucher #${voucher.id} failed:`, error.message);
  }
};

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
  const targetType = body.targetType === 'specific' ? 'specific' : 'all';
  const customerIds = targetType === 'specific' && Array.isArray(body.customerIds)
    ? [...new Set(body.customerIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    : [];

  if (targetType === 'specific') {
    if (customerIds.length === 0) {
      return { error: 'Vui lòng chọn ít nhất một khách hàng cho voucher này' };
    }
  } else {
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { error: 'Số lượng voucher phải là số nguyên dương' };
    }
  }

  const effectiveQuantity = targetType === 'specific' ? customerIds.length : quantity;

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
      quantity: effectiveQuantity,
      roomTypeIds,
      targetType,
      customerIds,
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

// Danh sách khách hàng (role='customer', status='active') để Admin chọn khi tạo/sửa voucher cụ thể
router.get('/eligible-customers', requireAuth, requireStaff, async (_req, res) => {
  try {
    const [customers] = await db.query(
      `SELECT 
         a.id AS userId,
         COALESCE(c.fullName, a.email) AS fullName,
         a.email,
         COALESCE(c.phone, a.phone, '') AS phone
       FROM accounts a
       LEFT JOIN customers c ON c.accountId = a.id
       WHERE a.role = 'customer' AND a.status = 'active'
       ORDER BY COALESCE(c.fullName, a.email) ASC`
    );
    res.json({ data: customers });
  } catch (error) {
    console.error('List eligible customers error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Voucher dành riêng cho khách đang đăng nhập: các mã được tặng riêng cho họ
// (VD voucher đền bù khi khách sạn hủy phòng, voucher admin gán) cộng với các mã công khai còn
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

    if (vouchers.length === 0) {
      return res.json({ data: [] });
    }

    const voucherIds = vouchers.map((v) => v.id);
    const [assignments] = await db.query(
      `SELECT 
         cv.id AS customerVoucherId,
         cv.voucherId,
         cv.userId,
         cv.source,
         cv.isUsed,
         cv.bookingId,
         COALESCE(c.fullName, a.email) AS fullName,
         a.email,
         COALESCE(c.phone, a.phone, '') AS phone
       FROM customer_vouchers cv
       JOIN accounts a ON a.id = cv.userId
       LEFT JOIN customers c ON c.accountId = a.id
       WHERE cv.voucherId IN (?)
       ORDER BY cv.id ASC`,
      [voucherIds]
    );

    const assignmentMap = new Map();
    for (const a of assignments) {
      if (!assignmentMap.has(a.voucherId)) {
        assignmentMap.set(a.voucherId, []);
      }
      assignmentMap.get(a.voucherId).push({
        customerVoucherId: a.customerVoucherId,
        userId: a.userId,
        fullName: a.fullName,
        email: a.email,
        phone: a.phone,
        isUsed: Number(a.isUsed),
        source: a.source,
        bookingId: a.bookingId,
      });
    }

    const enrichedVouchers = vouchers.map((v) => {
      const assigned = assignmentMap.get(v.id) || [];
      let targetType = 'all';
      if (assigned.length > 0) {
        targetType = assigned.some((a) => a.source === 'no_show') ? 'no_show' : 'specific';
      }
      const unusedCount = assigned.filter((a) => a.isUsed === 0).length;
      const usedCount = assigned.filter((a) => a.isUsed === 1).length;
      return {
        ...v,
        targetType,
        customerCount: assigned.length,
        customerIds: assigned.map((a) => a.userId),
        assignedCustomers: assigned,
        unusedCount,
        usedCount,
      };
    });

    res.json({ data: enrichedVouchers });
  } catch (error) {
    console.error('List vouchers error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const normalized = normalizeVoucherPayload(req.body);
    if (normalized.error) return res.status(400).json({ message: normalized.error });
    const {
      code,
      discountType,
      discountValue,
      maxDiscount,
      minBookingAmount,
      quantity,
      startDate,
      endDate,
      status = 'active',
      targetType = 'all',
      customerIds = [],
    } = normalized.data;

    if (!code || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ message: 'Thiếu thông tin voucher' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      if (targetType === 'specific') {
        const [validCustomers] = await connection.query(
          "SELECT id FROM accounts WHERE role = 'customer' AND status = 'active' AND id IN (?)",
          [customerIds]
        );
        if (validCustomers.length !== customerIds.length) {
          await connection.rollback();
          return res.status(400).json({ message: 'Một hoặc nhiều khách hàng được chọn không tồn tại hoặc không hoạt động' });
        }
      }

      const [result] = await connection.query(
        `INSERT INTO vouchers (code, discountType, discountValue, maxDiscount, minBookingAmount, quantity, startDate, endDate, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [code, discountType, discountValue, maxDiscount, minBookingAmount, quantity, startDate, endDate, status]
      );
      const voucherId = result.insertId;

      await replaceVoucherRoomTypes(connection, voucherId, normalized.data.roomTypeIds);

      if (targetType === 'specific' && customerIds.length > 0) {
        const cvRows = customerIds.map((uid) => [uid, voucherId, null, 'admin', 0]);
        await connection.query(
          'INSERT INTO customer_vouchers (userId, voucherId, bookingId, source, isUsed) VALUES ?',
          [cvRows]
        );
      }

      // Nếu voucher tạo ra ở trạng thái active -> thông báo
      if (status === 'active') {
        const { title, content } = buildVoucherNotification(normalized.data);
        if (targetType === 'all') {
          await notificationService.createNotificationForCustomers({
            type: 'voucher',
            title,
            content,
            referenceType: 'voucher',
            referenceId: voucherId
          }, connection);
        } else if (targetType === 'specific') {
          for (const uid of customerIds) {
            await notificationService.createNotificationForUser({
              accountId: uid,
              type: 'voucher',
              title,
              content,
              referenceType: 'voucher',
              referenceId: voucherId
            }, connection);
          }
        }
      }

      await connection.commit();

      // Chỉ voucher gán riêng mới gửi mail: voucher công khai đã có thông báo
      // trong web cho mọi khách, gửi thêm mail hàng loạt dễ bị coi là spam.
      if (status === 'active' && targetType === 'specific') {
        void sendVoucherEmails(customerIds, { ...normalized.data, id: voucherId });
      }

      res.status(201).json({ data: { id: voucherId }, message: 'Tạo voucher thành công' });
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
    const {
      code,
      discountType,
      discountValue,
      maxDiscount,
      minBookingAmount,
      quantity,
      startDate,
      endDate,
      status = 'active',
      targetType = 'all',
      customerIds = [],
    } = normalized.data;

    if (!voucherId || !code || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ message: 'Thiếu thông tin voucher' });
    }

    // Gom người nhận email trong transaction, gửi sau khi commit thành công.
    let emailTargetUserIds = [];

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Lấy voucher hiện tại và các assignments
      const [existingVouchers] = await connection.query('SELECT * FROM vouchers WHERE id = ?', [voucherId]);
      if (existingVouchers.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Không tìm thấy voucher' });
      }
      const existingVoucher = existingVouchers[0];
      const oldStatus = existingVoucher.status;

      const [existingAssignments] = await connection.query(
        'SELECT id, userId, isUsed, source, bookingId FROM customer_vouchers WHERE voucherId = ?',
        [voucherId]
      );

      const [usedBookings] = await connection.query(
        'SELECT id FROM bookings WHERE voucherId = ? LIMIT 1',
        [voucherId]
      );
      const hasEverBeenUsed = usedBookings.length > 0 || existingAssignments.some((a) => Number(a.isUsed) === 1);

      const isNoShowVoucher = existingAssignments.some((a) => a.source === 'no_show');
      const oldTargetType = isNoShowVoucher ? 'no_show' : (existingAssignments.length > 0 ? 'specific' : 'all');

      // Rule 7: Không cho phép thay đổi đối tượng áp dụng nếu voucher đã từng được sử dụng
      if (oldTargetType !== targetType) {
        if (hasEverBeenUsed) {
          await connection.rollback();
          return res.status(400).json({ message: 'Không thể thay đổi đối tượng áp dụng vì voucher đã được sử dụng' });
        }
      }

      let effectiveQuantity = quantity;

      if (isNoShowVoucher) {
        // Không cho phép đổi target type hoặc customerIds của voucher no_show
        if (targetType !== 'all' && (customerIds.length > 1 || (customerIds.length === 1 && customerIds[0] !== existingAssignments[0].userId))) {
          await connection.rollback();
          return res.status(400).json({ message: 'Không thể thay đổi đối tượng áp dụng của voucher bồi thường No-show' });
        }
        effectiveQuantity = existingVoucher.quantity;
      } else {
        // Voucher thông thường: xử lý assignments
        const existingUserIds = new Set(existingAssignments.map((a) => Number(a.userId)));
        const usedAssignments = existingAssignments.filter((a) => Number(a.isUsed) === 1);
        const usedUserIds = new Set(usedAssignments.map((a) => Number(a.userId)));

        if (targetType === 'all') {
          if (hasEverBeenUsed || usedUserIds.size > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Không thể thay đổi đối tượng áp dụng vì voucher đã được sử dụng' });
          }
          // Xóa tất cả assignment chưa dùng
          await connection.query('DELETE FROM customer_vouchers WHERE voucherId = ?', [voucherId]);
          effectiveQuantity = quantity;
        } else if (targetType === 'specific') {
          // Rule 6: Kiểm tra nếu khách hàng đã dùng bị xóa khỏi danh sách
          for (const usedUid of usedUserIds) {
            if (!customerIds.includes(usedUid)) {
              await connection.rollback();
              return res.status(400).json({ message: 'Không thể xóa khách hàng đã sử dụng voucher này' });
            }
          }

          // Kiểm tra các customerId mới có hợp lệ không
          if (customerIds.length > 0) {
            const [validCustomers] = await connection.query(
              "SELECT id FROM accounts WHERE role = 'customer' AND status = 'active' AND id IN (?)",
              [customerIds]
            );
            if (validCustomers.length !== customerIds.length) {
              await connection.rollback();
              return res.status(400).json({ message: 'Một hoặc nhiều khách hàng được chọn không tồn tại hoặc không hoạt động' });
            }
          }

          // Xóa khách hàng bị bỏ chọn (chỉ những ai chưa dùng isUsed = 0)
          const toRemoveUserIds = [...existingUserIds].filter((uid) => !customerIds.includes(uid));
          if (toRemoveUserIds.length > 0) {
            await connection.query(
              'DELETE FROM customer_vouchers WHERE voucherId = ? AND userId IN (?) AND isUsed = 0',
              [voucherId, toRemoveUserIds]
            );
          }

          // Thêm khách hàng mới được bổ sung
          const toAddUserIds = customerIds.filter((uid) => !existingUserIds.has(uid));
          if (toAddUserIds.length > 0) {
            const newCvRows = toAddUserIds.map((uid) => [uid, voucherId, null, 'admin', 0]);
            await connection.query(
              'INSERT INTO customer_vouchers (userId, voucherId, bookingId, source, isUsed) VALUES ?',
              [newCvRows]
            );

            // Rule 5: Nếu voucher đang active -> chỉ gửi notification cho những khách hàng mới được thêm vào
            if (status === 'active') {
              const { title, content } = buildVoucherNotification(normalized.data);
              for (const uid of toAddUserIds) {
                await notificationService.createNotificationForUser({
                  accountId: uid,
                  type: 'voucher',
                  title,
                  content,
                  referenceType: 'voucher',
                  referenceId: voucherId
                }, connection);
              }
              // Email cũng chỉ gửi cho người mới được thêm, để khách đã được gán
              // từ trước không bị nhận lại mail mỗi lần admin sửa voucher.
              emailTargetUserIds.push(...toAddUserIds);
            }
          }

          // Rule 3, 4, 5: Quantity của specific voucher tự động đồng bộ = số assignment chưa dùng (isUsed = 0)
          const [unusedRows] = await connection.query(
            'SELECT COUNT(*) AS unusedCount FROM customer_vouchers WHERE voucherId = ? AND isUsed = 0',
            [voucherId]
          );
          effectiveQuantity = Number(unusedRows[0].unusedCount);
        }
      }

      await connection.query(
        `UPDATE vouchers
         SET code = ?, discountType = ?, discountValue = ?, maxDiscount = ?, minBookingAmount = ?, quantity = ?, startDate = ?, endDate = ?, status = ?
         WHERE id = ?`,
        [code, discountType, discountValue, maxDiscount, minBookingAmount, effectiveQuantity, startDate, endDate, status || 'active', voucherId]
      );
      await replaceVoucherRoomTypes(connection, voucherId, normalized.data.roomTypeIds);

      // Nếu voucher chuyển từ trạng thái không active sang active
      if (oldStatus !== 'active' && status === 'active') {
        const { title, content } = buildVoucherNotification(normalized.data);
        if (targetType === 'all' && !isNoShowVoucher) {
          await notificationService.createNotificationForCustomers({
            type: 'voucher',
            title,
            content,
            referenceType: 'voucher',
            referenceId: voucherId
          }, connection);
        } else if (targetType === 'specific' || isNoShowVoucher) {
          // Gửi cho các khách hàng được assign (notificationService tự deduplicate)
          const targetUids = isNoShowVoucher ? existingAssignments.map((a) => a.userId) : customerIds;
          for (const uid of targetUids) {
            await notificationService.createNotificationForUser({
              accountId: uid,
              type: 'voucher',
              title,
              content,
              referenceType: 'voucher',
              referenceId: voucherId
            }, connection);
          }
          // Voucher vừa được bật lên active: mã giờ mới thực sự dùng được nên
          // báo cho toàn bộ khách đang giữ nó, kể cả người được gán từ trước.
          emailTargetUserIds.push(...targetUids);
        }
      }

      await connection.commit();

      if (emailTargetUserIds.length > 0) {
        void sendVoucherEmails(
          emailTargetUserIds,
          { ...normalized.data, id: voucherId },
          { isCompensation: isNoShowVoucher }
        );
      }

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

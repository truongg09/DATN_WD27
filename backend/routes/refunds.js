const express = require('express');
const db = require('../config/db');
const { requireAuth, isStaff } = require('../middleware/auth');
const bookingModel = require('../models/bookingModel');

const router = express.Router();

// Ghi dấu vết duyệt/từ chối hoàn tiền vào lịch sử đặt phòng.
const logRefundHistory = async (connection, bookingId, action, description, amount, user) => {
  try {
    const actorName = user?.userId
      ? await bookingModel.getActorDisplayName(user.userId, connection)
      : null;
    await bookingModel.addBookingHistory(
      bookingId,
      {
        action,
        description,
        entityType: 'payment',
        amount,
        actorId: user?.userId || null,
        actorName: actorName || user?.email || null,
        actorRole: user?.role || 'system'
      },
      connection
    );
  } catch (error) {
    console.error('Ghi lịch sử hoàn tiền thất bại:', error.message);
  }
};

const REFUND_SELECT = `
  SELECT
    r.*,
    b.customerId AS user_id,
    COALESCE(b.guest_name, c.fullName, a.email) AS customer_name,
    a.email AS customer_email,
    COALESCE(c.phone, a.phone) AS customer_phone,
    COALESCE(room_info.room_type_details, CONCAT(COALESCE(rm_fallback.roomNumber, '—'), ' · ', COALESCE(rt_fallback.typeName, 'Phòng'))) AS room_type_details,
    COALESCE(room_info.room_numbers, rm_fallback.roomNumber) AS room_number
  FROM payment_refunds r
  JOIN bookings b ON b.id = r.bookingId
  LEFT JOIN customers c ON c.id = b.customerId
  LEFT JOIN accounts a ON a.id = c.accountId
  LEFT JOIN (
    SELECT
      bd.bookingId,
      GROUP_CONCAT(
        DISTINCT CONCAT(COALESCE(rm.roomNumber, '—'), ' · ', COALESCE(rt.typeName, 'Phòng'))
        ORDER BY rm.roomNumber
        SEPARATOR '\n'
      ) AS room_type_details,
      GROUP_CONCAT(DISTINCT rm.roomNumber ORDER BY rm.roomNumber SEPARATOR ', ') AS room_numbers
    FROM booking_details bd
    LEFT JOIN rooms rm ON rm.id = bd.roomId
    LEFT JOIN room_types rt ON rt.id = COALESCE(bd.roomTypeId, rm.roomTypeId)
    WHERE rm.roomNumber IS NOT NULL
    GROUP BY bd.bookingId
  ) room_info ON room_info.bookingId = b.id
  LEFT JOIN rooms rm_fallback ON rm_fallback.id = b.room_id
  LEFT JOIN room_types rt_fallback ON rt_fallback.id = rm_fallback.roomTypeId
`;

const requireStaff = (req, res, next) => {
  if (!isStaff(req.user)) {
    return res.status(403).json({ message: 'Chỉ nhân viên hoặc quản trị viên được thao tác hoàn tiền' });
  }
  return next();
};

// Danh sách yêu cầu hoàn tiền (admin/staff), lọc theo status
router.get('/', requireAuth, requireStaff, async (req, res) => {
  try {
    const conditions = [];
    const values = [];

    if (req.query.status) {
      conditions.push('r.status = ?');
      values.push(String(req.query.status));
    }
    if (req.query.bookingId) {
      conditions.push('r.bookingId = ?');
      values.push(Number(req.query.bookingId));
    }

    const [rows] = await db.query(
      `
        ${REFUND_SELECT}
        ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
        ORDER BY r.status = 'pending' DESC, r.createdAt DESC
      `,
      values
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('List refunds error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Yêu cầu hoàn tiền của chính khách đang đăng nhập
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `
        ${REFUND_SELECT}
        WHERE c.accountId = ?
        ORDER BY r.createdAt DESC
      `,
      [req.user.userId]
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('List my refunds error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Duyệt hoàn tiền: đánh dấu payment đã hoàn + chốt yêu cầu
router.patch('/:id/approve', requireAuth, requireStaff, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT * FROM payment_refunds WHERE id = ? FOR UPDATE',
      [Number(req.params.id)]
    );
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu hoàn tiền' });
    }

    const refund = rows[0];
    if (refund.status !== 'pending') {
      await connection.rollback();
      return res.status(409).json({ message: 'Yêu cầu này đã được xử lý' });
    }

    await connection.query(
      `UPDATE payment_refunds SET status = 'approved', note = ?, processedAt = NOW() WHERE id = ?`,
      [req.body?.note || null, refund.id]
    );

    // Trừ đúng số tiền đã hoàn khỏi khoản đã thu. Trước đây mọi yêu cầu (kể cả
    // hoàn một phần khi check-out sớm) đều đánh dấu payment là 'refunded' mà
    // vẫn giữ nguyên paidAmount, làm doanh thu bị trừ quá tay và khóa payment.
    const [paymentRows] = await connection.query(
      'SELECT id, paidAmount, totalAmount FROM payments WHERE id = ? FOR UPDATE',
      [refund.paymentId]
    );
    const payment = paymentRows[0];
    if (payment) {
      const refundAmount = Number(refund.amount || 0);
      const newPaidAmount = Math.max(Number(payment.paidAmount || 0) - refundAmount, 0);
      const newRemainingAmount = Math.max(Number(payment.totalAmount || 0) - newPaidAmount, 0);
      const newStatus = newPaidAmount <= 0
        ? 'refunded'
        : newRemainingAmount <= 0
          ? 'paid'
          : 'deposit_paid';

      await connection.query(
        'UPDATE payments SET paidAmount = ?, remainingAmount = ?, paymentStatus = ? WHERE id = ?',
        [newPaidAmount, newRemainingAmount, newStatus, payment.id]
      );
    }

    // Cộng tiền hoàn vào ví của khách
    const [[bookingRow]] = await connection.query(
      'SELECT customerId FROM bookings WHERE id = ?',
      [refund.bookingId]
    );
    if (bookingRow?.customerId) {
      await connection.query(
        `
          INSERT INTO wallet_transactions
            (customerId, refundId, bookingId, type, amount, status, note, processedAt)
          VALUES (?, ?, ?, 'refund_credit', ?, 'approved', ?, NOW())
        `,
        [
          bookingRow.customerId,
          refund.id,
          refund.bookingId,
          refund.amount,
          `Hoàn tiền hủy đặt phòng #${refund.bookingId}`
        ]
      );
    }

    await logRefundHistory(
      connection,
      refund.bookingId,
      'refund_approved',
      `Duyệt hoàn tiền ${Number(refund.amount || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}₫ vào ví khách${req.body?.note ? `. Ghi chú: ${req.body.note}` : ''}`,
      Number(refund.amount || 0),
      req.user
    );

    await connection.commit();
    res.json({ message: 'Đã duyệt hoàn tiền, tiền đã cộng vào ví của khách', data: { id: refund.id, status: 'approved' } });
  } catch (error) {
    await connection.rollback();
    console.error('Approve refund error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  } finally {
    connection.release();
  }
});

// Từ chối hoàn tiền (kèm lý do)
router.patch('/:id/reject', requireAuth, requireStaff, async (req, res) => {
  try {
    const refundId = Number(req.params.id);
    const [result] = await db.query(
      `UPDATE payment_refunds SET status = 'rejected', note = ?, processedAt = NOW() WHERE id = ? AND status = 'pending'`,
      [req.body?.note || null, refundId]
    );

    if (result.affectedRows === 0) {
      return res.status(409).json({ message: 'Yêu cầu không tồn tại hoặc đã được xử lý' });
    }

    const [[refund]] = await db.query(
      'SELECT bookingId, amount FROM payment_refunds WHERE id = ?',
      [refundId]
    );
    if (refund) {
      await logRefundHistory(
        null,
        refund.bookingId,
        'refund_rejected',
        `Từ chối yêu cầu hoàn tiền ${Number(refund.amount || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}₫${req.body?.note ? `. Lý do: ${req.body.note}` : ''}`,
        Number(refund.amount || 0),
        req.user
      );
    }

    res.json({ message: 'Đã từ chối yêu cầu hoàn tiền' });
  } catch (error) {
    console.error('Reject refund error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

module.exports = router;

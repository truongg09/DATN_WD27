const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const REFUND_SELECT = `
  SELECT
    r.*,
    b.customerId AS user_id,
    COALESCE(b.guest_name, c.fullName, a.email) AS customer_name,
    a.email AS customer_email,
    COALESCE(c.phone, a.phone) AS customer_phone,
    rm.roomNumber AS room_number
  FROM payment_refunds r
  JOIN bookings b ON b.id = r.bookingId
  LEFT JOIN customers c ON c.id = b.customerId
  LEFT JOIN accounts a ON a.id = c.accountId
  LEFT JOIN booking_details bd ON bd.bookingId = b.id
  LEFT JOIN rooms rm ON rm.id = bd.roomId
`;

const requireStaff = (req, res, next) => {
  if (!['admin', 'staff'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Chỉ quản trị viên được thao tác hoàn tiền' });
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
    res.status(500).json({ message: 'Internal server error' });
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
    res.status(500).json({ message: 'Internal server error' });
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

    await connection.query(
      `UPDATE payments SET paymentStatus = 'refunded' WHERE id = ?`,
      [refund.paymentId]
    );

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

    await connection.commit();
    res.json({ message: 'Đã duyệt hoàn tiền, tiền đã cộng vào ví của khách', data: { id: refund.id, status: 'approved' } });
  } catch (error) {
    await connection.rollback();
    console.error('Approve refund error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    connection.release();
  }
});

// Từ chối hoàn tiền (kèm lý do)
router.patch('/:id/reject', requireAuth, requireStaff, async (req, res) => {
  try {
    const [result] = await db.query(
      `UPDATE payment_refunds SET status = 'rejected', note = ?, processedAt = NOW() WHERE id = ? AND status = 'pending'`,
      [req.body?.note || null, Number(req.params.id)]
    );

    if (result.affectedRows === 0) {
      return res.status(409).json({ message: 'Yêu cầu không tồn tại hoặc đã được xử lý' });
    }

    res.json({ message: 'Đã từ chối yêu cầu hoàn tiền' });
  } catch (error) {
    console.error('Reject refund error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

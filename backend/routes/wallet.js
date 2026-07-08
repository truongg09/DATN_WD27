const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const requireStaff = (req, res, next) => {
  if (!['admin', 'staff'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Chỉ quản trị viên được thao tác' });
  }
  return next();
};

const getCustomerIdByAccount = async (accountId, connection = db) => {
  const [rows] = await connection.query(
    'SELECT id FROM customers WHERE accountId = ? LIMIT 1',
    [accountId]
  );
  return rows[0]?.id || null;
};

// Số dư khả dụng = credit approved - withdrawal (pending + approved).
// Lệnh rút pending vẫn trừ để không rút quá tay.
const getBalance = async (customerId, connection = db) => {
  const [[row]] = await connection.query(
    `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'refund_credit' AND status = 'approved' THEN amount ELSE 0 END), 0) AS credited,
        COALESCE(SUM(CASE WHEN type = 'withdrawal' AND status IN ('pending', 'approved') THEN amount ELSE 0 END), 0) AS withdrawn,
        COALESCE(SUM(CASE WHEN type = 'withdrawal' AND status = 'pending' THEN amount ELSE 0 END), 0) AS pendingWithdraw
      FROM wallet_transactions
      WHERE customerId = ?
    `,
    [customerId]
  );

  const credited = Number(row.credited) || 0;
  const withdrawn = Number(row.withdrawn) || 0;
  return {
    credited,
    pendingWithdraw: Number(row.pendingWithdraw) || 0,
    available: Math.max(credited - withdrawn, 0)
  };
};

// Ví của khách đang đăng nhập: số dư + lịch sử giao dịch
router.get('/me', requireAuth, async (req, res) => {
  try {
    const customerId = await getCustomerIdByAccount(req.user.userId);
    if (!customerId) {
      return res.json({ data: { balance: { credited: 0, pendingWithdraw: 0, available: 0 }, transactions: [] } });
    }

    const balance = await getBalance(customerId);
    const [transactions] = await db.query(
      `SELECT * FROM wallet_transactions WHERE customerId = ? ORDER BY createdAt DESC`,
      [customerId]
    );

    res.json({ data: { balance, transactions } });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Khách tạo lệnh rút tiền từ số dư ví
router.post('/withdraw', requireAuth, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const customerId = await getCustomerIdByAccount(req.user.userId, connection);
    if (!customerId) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy hồ sơ khách hàng' });
    }

    const amount = Math.round(Number(req.body?.amount) || 0);
    if (amount <= 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Số tiền rút phải lớn hơn 0' });
    }

    // Khóa các dòng ví của khách để tránh 2 lệnh rút song song vượt số dư
    await connection.query(
      'SELECT id FROM wallet_transactions WHERE customerId = ? FOR UPDATE',
      [customerId]
    );

    const balance = await getBalance(customerId, connection);
    if (amount > balance.available) {
      await connection.rollback();
      return res.status(400).json({
        message: `Số dư khả dụng chỉ còn ${new Intl.NumberFormat('vi-VN').format(balance.available)}₫`
      });
    }

    const method = req.body?.refundMethod === 'cash' ? 'cash' : 'bank_transfer';
    let bankFields = { bankBin: null, bankName: null, accountNumber: null, accountName: null };

    if (method === 'bank_transfer') {
      const accountNumber = String(req.body?.accountNumber || '').replace(/\s+/g, '');
      const accountName = String(req.body?.accountName || '').trim().toUpperCase();
      const bankName = String(req.body?.bankName || '').trim();

      if (!/^[A-Za-z0-9]{4,30}$/.test(accountNumber)) {
        await connection.rollback();
        return res.status(400).json({ message: 'Số tài khoản không hợp lệ (4-30 ký tự chữ/số)' });
      }
      if (accountName.length < 3) {
        await connection.rollback();
        return res.status(400).json({ message: 'Vui lòng nhập tên chủ tài khoản' });
      }
      if (!bankName) {
        await connection.rollback();
        return res.status(400).json({ message: 'Vui lòng chọn ngân hàng' });
      }

      bankFields = {
        bankBin: String(req.body?.bankBin || '').slice(0, 10) || null,
        bankName: bankName.slice(0, 100),
        accountNumber,
        accountName: accountName.slice(0, 100)
      };
    }

    const [result] = await connection.query(
      `
        INSERT INTO wallet_transactions
          (customerId, type, amount, status, refundMethod, bankBin, bankName, accountNumber, accountName)
        VALUES (?, 'withdrawal', ?, 'pending', ?, ?, ?, ?, ?)
      `,
      [customerId, amount, method, bankFields.bankBin, bankFields.bankName, bankFields.accountNumber, bankFields.accountName]
    );

    await connection.commit();
    res.status(201).json({
      message: 'Đã gửi yêu cầu rút tiền, chờ khách sạn duyệt',
      data: { id: result.insertId, amount, refundMethod: method, status: 'pending' }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Withdraw error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    connection.release();
  }
});

// Admin: danh sách lệnh rút tiền
router.get('/withdrawals', requireAuth, requireStaff, async (req, res) => {
  try {
    const conditions = [`w.type = 'withdrawal'`];
    const values = [];

    if (req.query.status) {
      conditions.push('w.status = ?');
      values.push(String(req.query.status));
    }

    const [rows] = await db.query(
      `
        SELECT
          w.*,
          COALESCE(c.fullName, a.email) AS customer_name,
          a.email AS customer_email,
          COALESCE(c.phone, a.phone) AS customer_phone
        FROM wallet_transactions w
        JOIN customers c ON c.id = w.customerId
        LEFT JOIN accounts a ON a.id = c.accountId
        WHERE ${conditions.join(' AND ')}
        ORDER BY w.status = 'pending' DESC, w.createdAt DESC
      `,
      values
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('List withdrawals error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin duyệt lệnh rút (đã chi tiền cho khách)
router.patch('/withdrawals/:id/approve', requireAuth, requireStaff, async (req, res) => {
  try {
    const [result] = await db.query(
      `
        UPDATE wallet_transactions
        SET status = 'approved', note = ?, processedAt = NOW()
        WHERE id = ? AND type = 'withdrawal' AND status = 'pending'
      `,
      [req.body?.note || null, Number(req.params.id)]
    );

    if (result.affectedRows === 0) {
      return res.status(409).json({ message: 'Lệnh rút không tồn tại hoặc đã được xử lý' });
    }

    res.json({ message: 'Đã duyệt rút tiền' });
  } catch (error) {
    console.error('Approve withdrawal error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin từ chối lệnh rút (số dư tự trả lại vì lệnh rejected không còn bị trừ)
router.patch('/withdrawals/:id/reject', requireAuth, requireStaff, async (req, res) => {
  try {
    const [result] = await db.query(
      `
        UPDATE wallet_transactions
        SET status = 'rejected', note = ?, processedAt = NOW()
        WHERE id = ? AND type = 'withdrawal' AND status = 'pending'
      `,
      [req.body?.note || null, Number(req.params.id)]
    );

    if (result.affectedRows === 0) {
      return res.status(409).json({ message: 'Lệnh rút không tồn tại hoặc đã được xử lý' });
    }

    res.json({ message: 'Đã từ chối lệnh rút, số dư được hoàn lại ví' });
  } catch (error) {
    console.error('Reject withdrawal error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

const express = require('express');
const db = require('../config/db');
const { requireAuth, isStaff } = require('../middleware/auth');
const {
  getCustomerIdByAccount,
  getBalance,
  lockWalletAndGetBalance,
  withRunningBalance
} = require('../services/walletService');

const router = express.Router();

// Chống spam hàng đợi duyệt rút tiền của kế toán.
const MIN_WITHDRAW_AMOUNT = 50000;
const MAX_PENDING_WITHDRAWALS = 3;

const requireStaff = (req, res, next) => {
  if (!isStaff(req.user)) {
    return res.status(403).json({ message: 'Chỉ quản trị viên được thao tác' });
  }
  return next();
};

// Ví của khách đang đăng nhập: số dư + lịch sử giao dịch
router.get('/me', requireAuth, async (req, res) => {
  try {
    const customerId = await getCustomerIdByAccount(req.user.userId);
    if (!customerId) {
      return res.json({
        data: {
          balance: { credited: 0, pendingWithdraw: 0, paidFromWallet: 0, available: 0 },
          transactions: []
        }
      });
    }

    const balance = await getBalance(customerId);
    const [transactions] = await db.query(
      `SELECT * FROM wallet_transactions
       WHERE customerId = ?
       ORDER BY createdAt DESC, id DESC`,
      [customerId]
    );

    res.json({ data: { balance, transactions: withRunningBalance(transactions) } });
  } catch (error) {
    console.error('Get wallet error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      message: statusCode === 500 ? 'Lỗi máy chủ nội bộ' : error.message
    });
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

    // Mức rút tối thiểu: không chặn thì khách rút 1₫ mỗi lệnh, số dư 2 triệu
    // thành 2 triệu phiếu chờ duyệt, ngập hàng đợi của kế toán.
    if (amount < MIN_WITHDRAW_AMOUNT) {
      await connection.rollback();
      return res.status(400).json({
        message: `Số tiền rút tối thiểu là ${MIN_WITHDRAW_AMOUNT.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}₫`
      });
    }

    // Khóa theo khách hàng để lệnh rút và thanh toán bằng ví không
    // thể cùng lúc tiêu vượt số dư. Hàm này cũng đếm đúng
    // type='withdrawal' (bản cũ nhầm thành 'withdraw').
    const balance = await lockWalletAndGetBalance(customerId, connection);
    if (balance.pendingWithdrawalCount >= MAX_PENDING_WITHDRAWALS) {
      await connection.rollback();
      return res.status(429).json({
        message: `Bạn đang có ${MAX_PENDING_WITHDRAWALS} lệnh rút chờ duyệt. Vui lòng đợi khách sạn xử lý xong.`
      });
    }
    if (amount > balance.available) {
      await connection.rollback();
      return res.status(400).json({
        message: `Số dư khả dụng chỉ còn ${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(balance.available)}₫`
      });
    }

    const method = req.body?.refundMethod === 'cash' ? 'cash' : 'bank_transfer';
    let bankFields = { bankBin: null, bankName: null, accountNumber: null, accountName: null };

    if (method === 'bank_transfer') {
      const accountNumber = String(req.body?.accountNumber || '').replace(/\s+/g, '');
      const accountName = String(req.body?.accountName || '').trim().toUpperCase();
      const bankName = String(req.body?.bankName || '').trim();

      if (!/^\d{4,30}$/.test(accountNumber)) {
        await connection.rollback();
        return res.status(400).json({ message: 'Số tài khoản ngân hàng chỉ được bao gồm các chữ số (0-9)' });
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
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      message: statusCode === 500 ? 'Lỗi máy chủ nội bộ' : error.message
    });
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
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
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
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
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
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

module.exports = router;

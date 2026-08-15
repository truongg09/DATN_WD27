const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const emailService = require('../services/emailService');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { fullName, email, phone, password, dob, gender } = req.body;
    const trimmedFullName = String(fullName || '').trim();

    if (!trimmedFullName || !email || !phone || !password) {
      return res.status(400).json({
        message: 'Vui lòng nhập đầy đủ họ tên, email, số điện thoại và mật khẩu'
      });
    }

    if (trimmedFullName.length < 2) {
      return res.status(400).json({ message: 'Họ và tên phải có ít nhất 2 ký tự' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Email không hợp lệ' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    const [existingUsers] = await db.query(
      'SELECT id FROM accounts WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Email đã được đăng ký' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Ghi họ tên vào cả hai bảng: accounts.full_name dùng cho màn hình quản trị
    // nhân viên và các chỗ chỉ có tài khoản, customers.fullName dùng cho hồ sơ
    // khách và hiển thị trên đơn đặt phòng.
    //
    // Tạo tài khoản và hồ sơ khách trong cùng một transaction. Nếu lệnh thứ hai
    // hỏng mà lệnh đầu đã chạy thì tài khoản vẫn đăng nhập được nhưng không có
    // hồ sơ, kéo theo lỗi ở khắp nơi về sau.
    const connection = await db.getConnection();
    let accountId;
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        `
          INSERT INTO accounts (full_name, email, phone, password, role, status)
          VALUES (?, ?, ?, ?, 'customer', 'active')
        `,
        [trimmedFullName, email, phone, hashedPassword]
      );

      accountId = result.insertId;

      await connection.query(
        `
          INSERT INTO customers (accountId, fullName, phone, dateOfBirth, gender)
          VALUES (?, ?, ?, ?, ?)
        `,
        [accountId, trimmedFullName, phone, dob || null, gender || null]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const token = jwt.sign(
      { userId: accountId, email, role: 'customer' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      message: 'Đăng ký thành công',
      token,
      user: {
        id: accountId,
        email,
        phone,
        fullName: trimmedFullName,
        role: 'customer'
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      message: 'Không thể đăng ký tài khoản. Vui lòng kiểm tra kết nối database và bảng accounts',
      error: error.message
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu' });
    }

    const [users] = await db.query(
      `SELECT a.*, COALESCE(NULLIF(c.fullName, ''), NULLIF(a.full_name, ''), a.email) AS fullName
       FROM accounts a
       LEFT JOIN customers c ON c.accountId = a.id
       WHERE a.email = ?`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    const user = users[0];
    // Chỉ chấp nhận mật khẩu đã băm bằng bcrypt. Nhánh so sánh chuỗi thuần
    // trước đây cho phép đăng nhập bằng mật khẩu lưu thô trong database mẫu.
    const passwordMatch = await bcrypt.compare(password, user.password || '');

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    // Khóa tài khoản trên trang quản trị phải chặn được đăng nhập.
    if (user.status && user.status !== 'active') {
      return res.status(403).json({
        message: 'Tài khoản đã bị khóa. Vui lòng liên hệ khách sạn để được hỗ trợ.'
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      message: 'Không thể đăng nhập. Vui lòng kiểm tra kết nối database',
      error: error.message
    });
  }
});

const { requireAuth } = require('../middleware/auth');

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ mật khẩu cũ và mới!' });
    }

    const [users] = await db.query('SELECT * FROM accounts WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản!' });
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(oldPassword, user.password || '');

    if (!passwordMatch) {
      return res.status(400).json({ message: 'Mật khẩu cũ không chính xác!' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự!' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE accounts SET password = ? WHERE id = ?', [hashedPassword, userId]);

    res.json({ message: 'Đổi mật khẩu thành công!' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ', error: error.message });
  }
});

// ── Quên mật khẩu ──────────────────────────────────────────────────────────
// Màn hình /forgot-password trước đây chỉ hiện thông báo thành công giả, backend
// không hề có endpoint nào. Hai route dưới đây làm đúng luồng: gửi liên kết kèm
// token dùng một lần, hết hạn sau ít phút.

const RESET_TOKEN_TTL_MINUTES = 30;
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

router.post('/forgot-password', async (req, res) => {
  // Luôn trả cùng một câu trả lời dù email có tồn tại hay không, để không ai
  // dùng màn hình này để dò xem địa chỉ nào đã đăng ký.
  const genericResponse = {
    message: 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi liên kết đặt lại mật khẩu.'
  };

  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: 'Vui lòng nhập email' });
    }

    const [accounts] = await db.query(
      'SELECT id, email, status FROM accounts WHERE LOWER(email) = ? LIMIT 1',
      [email]
    );
    const account = accounts[0];
    if (!account || account.status === 'locked') {
      return res.json(genericResponse);
    }

    const [customers] = await db.query(
      'SELECT fullName FROM customers WHERE accountId = ? LIMIT 1',
      [account.id]
    );
    const customer = customers[0] || null;

    // Vô hiệu hóa các token cũ chưa dùng để mỗi lần yêu cầu chỉ còn một liên kết
    // hợp lệ.
    await db.query(
      'UPDATE password_reset_tokens SET usedAt = NOW() WHERE accountId = ? AND usedAt IS NULL',
      [account.id]
    );

    const token = crypto.randomBytes(32).toString('hex');
    await db.query(
      `INSERT INTO password_reset_tokens (accountId, tokenHash, expiresAt)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [account.id, hashResetToken(token), RESET_TOKEN_TTL_MINUTES]
    );

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    await emailService.sendPasswordResetEmail({
      to: account.email,
      name: customer?.fullName || '',
      resetUrl: `${frontendUrl}/reset-password?token=${token}`,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES
    });

    if (!emailService.isEmailConfigured()) {
      // Máy chủ chưa cấu hình SMTP thì email bị bỏ qua im lặng. Ghi log để người
      // chạy thử tại máy vẫn lấy được liên kết mà không phải dò trong cơ sở dữ liệu.
      console.info(`[auth] Liên kết đặt lại mật khẩu cho ${account.email}: ${frontendUrl}/reset-password?token=${token}`);
    }

    return res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Thiếu mã đặt lại hoặc mật khẩu mới' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự!' });
    }

    const [rows] = await db.query(
      `SELECT id, accountId FROM password_reset_tokens
       WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > NOW()
       LIMIT 1`,
      [hashResetToken(String(token))]
    );
    if (rows.length === 0) {
      return res.status(400).json({
        message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại.'
      });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    await db.query('UPDATE accounts SET password = ? WHERE id = ?', [
      hashedPassword,
      rows[0].accountId
    ]);
    await db.query('UPDATE password_reset_tokens SET usedAt = NOW() WHERE id = ?', [rows[0].id]);

    return res.json({ message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

module.exports = router;

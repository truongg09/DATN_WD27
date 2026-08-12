const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, phone, password, dob, gender } = req.body;

    if (!email || !phone || !password) {
      return res.status(400).json({
        message: 'Vui lòng nhập đầy đủ email, số điện thoại và mật khẩu'
      });
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
    const [result] = await db.query(
      `
        INSERT INTO accounts (email, phone, password, role, status)
        VALUES (?, ?, ?, 'customer', 'active')
      `,
      [email, phone, hashedPassword]
    );

    const accountId = result.insertId;

    // Tạo bản ghi customer tương ứng
    await db.query(
      `
        INSERT INTO customers (accountId, fullName, phone, dateOfBirth, gender)
        VALUES (?, ?, ?, ?, ?)
      `,
      [accountId, email.split('@')[0], phone, dob || null, gender || null]
    );

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
        fullName: email.split('@')[0],
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

const RESET_TOKEN_EXPIRES_IN = process.env.RESET_TOKEN_EXPIRES_IN || '15m';
const RESET_TOKEN_EXPIRES_MINUTES = 15;

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Vui lòng nhập email' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ message: 'Email không hợp lệ' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [rows] = await db.query(
      `SELECT a.id, a.email, a.status, a.role,
              COALESCE(NULLIF(c.fullName, ''), NULLIF(a.full_name, ''), a.email) AS fullName
       FROM accounts a
       LEFT JOIN customers c ON c.accountId = a.id
       WHERE LOWER(a.email) = ?
       LIMIT 1`,
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.json({
        message: 'Nếu email đã được đăng ký, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu trong vài phút. Vui lòng kiểm tra hộp thư đến hoặc thư rác.',
        delivered: false
      });
    }

    const user = rows[0];

    if (user.status && user.status !== 'active') {
      return res.json({
        message: 'Nếu email đã được đăng ký, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu trong vài phút. Vui lòng kiểm tra hộp thư đến hoặc thư rác.',
        delivered: false
      });
    }

    const resetToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        purpose: 'password_reset',
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: RESET_TOKEN_EXPIRES_IN }
    );

    let emailResult;
    try {
      const { sendResetPasswordEmail } = require('../services/emailService');
      emailResult = await sendResetPasswordEmail({
        to: user.email,
        fullName: user.fullName,
        token: resetToken,
        expiresMinutes: RESET_TOKEN_EXPIRES_MINUTES
      });
    } catch (mailError) {
      console.error('[forgot-password] email error:', mailError.message);
    }

    console.info(
      `[forgot-password] token issued for ${user.email} (id=${user.id}), email=${emailResult && emailResult.skipped ? 'skipped' : (emailResult && emailResult.failed ? 'failed' : 'sent')}`
    );

    return res.json({
      message: 'Nếu email đã được đăng ký, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu trong vài phút. Vui lòng kiểm tra hộp thư đến hoặc thư rác.',
      delivered: !(emailResult && (emailResult.skipped || emailResult.failed)),
      token: process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST ? resetToken : undefined
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      message: 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.',
      error: error.message
    });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Thiếu token đặt lại mật khẩu' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Vui lòng nhập mật khẩu mới' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    let decoded;
    try {
      decoded = jwt.verify(String(token), JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(400).json({ message: 'Link đặt lại mật khẩu đã hết hạn. Vui lòng gửi yêu cầu mới.' });
      }
      return res.status(400).json({ message: 'Link đặt lại mật khẩu không hợp lệ. Vui lòng gửi yêu cầu mới.' });
    }

    if (!decoded || decoded.purpose !== 'password_reset' || !decoded.userId) {
      return res.status(400).json({ message: 'Link đặt lại mật khẩu không hợp lệ. Vui lòng gửi yêu cầu mới.' });
    }

    const [users] = await db.query('SELECT id, email, status FROM accounts WHERE id = ?', [decoded.userId]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'Tài khoản không tồn tại' });
    }

    const user = users[0];
    if (decoded.email && String(decoded.email).toLowerCase() !== String(user.email).toLowerCase()) {
      return res.status(400).json({ message: 'Token không khớp với tài khoản.' });
    }
    if (user.status && user.status !== 'active') {
      return res.status(403).json({ message: 'Tài khoản đã bị khóa. Vui lòng liên hệ khách sạn để được hỗ trợ.' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    await db.query('UPDATE accounts SET password = ? WHERE id = ?', [hashedPassword, user.id]);

    console.info(`[reset-password] password updated for ${user.email} (id=${user.id})`);

    return res.json({ message: 'Đặt lại mật khẩu thành công. Bây giờ bạn có thể đăng nhập bằng mật khẩu mới.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      message: 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.',
      error: error.message
    });
  }
});


module.exports = router;

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


module.exports = router;

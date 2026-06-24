const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

router.post('/register', async (req, res) => {
  try {
    const { email, phone, password, fullName } = req.body;

    if (!email || !phone || !password || !fullName) {
      return res.status(400).json({
        message: 'Vui lòng nhập đầy đủ họ tên, email, số điện thoại và mật khẩu'
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
    const [accountResult] = await db.query(
      `
        INSERT INTO accounts (email, phone, password, role, status)
        VALUES (?, ?, ?, 'customer', 'active')
      `,
      [email, phone, hashedPassword]
    );

    const [customerResult] = await db.query(
      `
        INSERT INTO customers (accountId, fullName, phone)
        VALUES (?, ?, ?)
      `,
      [accountResult.insertId, fullName, phone]
    );

    const token = jwt.sign(
      { userId: accountResult.insertId, email, role: 'customer' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Đăng ký thành công',
      token,
      user: {
        id: accountResult.insertId,
        customerId: customerResult.insertId,
        email,
        phone,
        fullName,
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

    const [users] = await db.query('SELECT * FROM accounts WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    const user = users[0];
    let passwordMatch = false;

    if (user.password.startsWith("$2b$")) {
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
      passwordMatch = password === user.password;
    }

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    // Get customer info
    const [customers] = await db.query(
      'SELECT id, fullName FROM customers WHERE accountId = ?',
      [user.id]
    );

    const customer = customers[0] || {};

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user.id,
        customerId: customer.id,
        email: user.email,
        phone: user.phone,
        fullName: customer.fullName,
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

module.exports = router;

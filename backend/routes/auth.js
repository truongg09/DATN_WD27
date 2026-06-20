const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const router = express.Router();

const JWT_SECRET = 'your-secret-key-change-this-in-production';

// Register
router.post('/register', async (req, res) => {
  console.log('=== REGISTER ENDPOINT HIT!');
  try {
    console.log('Register request body:', req.body);
    const { full_name, email, phone, password } = req.body;

    // Check if user already exists
    console.log('Checking for existing user with email:', email);
    const [existingUsers] = await db.query('SELECT id FROM accounts WHERE email = ?', [email]);
    console.log('Existing users result:', existingUsers);

    if (existingUsers.length > 0) {
      console.log('Email already exists');
      return res.status(400).json({ message: 'Email đã được đăng ký' });
    }

    // Hash password
    console.log('Hashing password');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    console.log('Inserting new user into accounts table');
    const [result] = await db.query(
      'INSERT INTO accounts (full_name, email, phone, password) VALUES (?, ?, ?, ?)',
      [full_name, email, phone, hashedPassword]
    );
    console.log('Insert result:', result);

    // Generate JWT
    const token = jwt.sign(
      { userId: result.insertId, email, role: 'customer' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: result.insertId,
        fullName: full_name,
        email,
        phone,
        role: 'customer'
      }
    });
  } catch (error) {
    console.error('Register error details:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  console.log('=== LOGIN ENDPOINT HIT!');
  try {
    const { email, password } = req.body;

    // Find user
    const [users] = await db.query('SELECT * FROM accounts WHERE email = ?', [email]);
    console.log('Found user:', users[0]);

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = users[0];

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const responseData = {
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    };
    console.log('Sending response:', responseData);

    res.json(responseData);
  } catch (error) {
    console.error('Login error details:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

module.exports = router;
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const employeeRoutes = require('./routes/employees');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const invoiceRoutes = require('./routes/invoices');

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/invoices', invoiceRoutes);

// Test endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Hotel Booking Backend is running!' });
});

// Test database connection
app.get('/api/db-test', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS solution');
    res.json({ status: 'ok', message: 'Database connected successfully!', data: rows[0] });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ status: 'error', message: 'Database connection failed', error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

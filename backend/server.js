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
const amenityRoutes = require('./routes/amenities');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const invoiceRoutes = require('./routes/invoices');
const customerRoutes = require('./routes/customers');
const dashboardRoutes = require('./routes/dashboard');
const serviceRoutes = require('./routes/services');
const bookingService = require('./services/bookingService');
const ensureOperationalSchema = require('./ensure-operational-schema');

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/amenities', amenityRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/services', serviceRoutes);

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

setInterval(() => {
  bookingService.expireUnpaidBookingHolds().catch((error) => {
    console.error('Expire booking holds error:', error);
  });
}, 60 * 1000);

setInterval(() => {
  bookingService.processNoShows().catch((error) => {
    console.error('Process no-show bookings error:', error);
  });
}, 60 * 60 * 1000);

bookingService.processNoShows().catch((error) => {
  console.error('Initial no-show processing error:', error);
});

// Start server
ensureOperationalSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to ensure operational schema:', error);
    process.exit(1);
  });

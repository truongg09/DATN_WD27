const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve ảnh đã upload (vd: đánh giá) qua URL tĩnh, ví dụ:
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const amenityRoutes = require('./routes/amenities');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const invoiceRoutes = require('./routes/invoices');
const customerRoutes = require('./routes/customers');
const dashboardRoutes = require('./routes/dashboard');
const serviceRoutes = require('./routes/services');
const roomItemRoutes = require('./routes/roomItems');
const damageReportRoutes = require('./routes/damageReports');
const bookingServiceRoutes = require('./routes/bookingServices');
const serviceRequestRoutes = require('./routes/serviceRequests');
const bookingService = require('./services/bookingService');
const reviewRoutes = require('./routes/reviews');
const voucherRoutes = require('./routes/vouchers');
const settingsRoutes = require('./routes/settings');
const refundRoutes = require('./routes/refunds');
const walletRoutes = require('./routes/wallet');
const reportRoutes = require('./routes/reports');
const uploadRoutes = require('./routes/upload');
const employeeRoutes = require('./routes/employees');
const holidayRoutes = require('./routes/holidays');
const notificationRoutes = require('./routes/notifications');

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/amenities', amenityRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/room-items', roomItemRoutes);
app.use('/api/damage-reports', damageReportRoutes);
app.use('/api/booking-services', bookingServiceRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/holidays', holidayRoutes);

// Test endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Máy chủ đặt phòng khách sạn đang hoạt động!' });
});

// Test database connection
app.get('/api/db-test', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS solution');
    res.json({ status: 'ok', message: 'Kết nối cơ sở dữ liệu thành công!', data: rows[0] });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ status: 'error', message: 'Kết nối cơ sở dữ liệu thất bại', error: error.message });
  }
});

setInterval(() => {
  bookingService.expireUnpaidBookingHolds().catch((error) => {
    console.error('Expire booking holds error:', error);
  });
}, 30 * 1000);

setInterval(() => {
  bookingService.processOverdueCheckIns().catch((error) => {
    console.error('Process overdue check-ins error:', error);
  });
}, 30 * 60 * 1000);

const ensureOperationalSchema = require('./ensure-operational-schema');

ensureOperationalSchema().then(() => {
  console.log('Database operational schema sync finished.');
  bookingService.processOverdueCheckIns().catch((error) => {
    console.error('Initial overdue check-ins processing error:', error);
  });
}).catch((error) => {
  console.error('Operational schema sync error:', error);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
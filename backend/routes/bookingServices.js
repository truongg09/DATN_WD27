const express = require('express');
const db = require('../config/db');

const router = express.Router();

// Read-only overview of services attached to bookings.
// Services are added to bookings through the booking flow
// (POST /api/bookings/:id/services), which also recalculates payments,
// so this endpoint only exposes a consolidated listing for management.
router.get('/', async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT bs.id, bs.bookingId, bs.roomId, bs.serviceId, bs.quantity,
             COALESCE(bs.unitPrice, s.price) AS unitPrice, bs.totalPrice,
             COALESCE(bs.status, 'used') AS status, bs.usedAt, bs.createdAt,
             s.serviceName,
             COALESCE(b.guest_name, c.fullName) AS bookingCustomer,
             r.roomNumber, b.status AS bookingStatus
      FROM booking_services bs
      LEFT JOIN services s ON s.id = bs.serviceId
      LEFT JOIN bookings b ON b.id = bs.bookingId
      LEFT JOIN customers c ON c.id = b.customerId
      LEFT JOIN rooms r ON r.id = COALESCE(bs.roomId, b.room_id)
      ORDER BY bs.id DESC
    `);
    res.json({ data: rows });
  } catch (error) {
    console.error('List booking services error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

module.exports = router;

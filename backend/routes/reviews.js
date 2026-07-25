const express = require('express');
const db = require('../config/db');

const router = express.Router();

// Get all reviews with customer name and booking details
router.get('/', async (req, res) => {
  try {
    const [reviews] = await db.query(`
      SELECT 
        r.id,
        r.bookingId,
        r.customerId,
        r.rating,
        r.comment,
        r.createdAt,
        COALESCE(c.fullName, a.email) AS customerName,
        bk.status AS bookingStatus,
        bd.roomId,
        rm.roomTypeId
      FROM reviews r
      LEFT JOIN customers c ON r.customerId = c.id
      LEFT JOIN accounts a ON c.accountId = a.id
      LEFT JOIN bookings bk ON r.bookingId = bk.id
      LEFT JOIN booking_details bd ON bd.bookingId = bk.id
      LEFT JOIN rooms rm ON bd.roomId = rm.id
      ORDER BY r.createdAt DESC
    `);
    res.json({ data: reviews });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Create a review
router.post('/', async (req, res) => {
  try {
    const { bookingId, customerId, rating, comment } = req.body;

    if (!bookingId || !rating) {
      return res.status(400).json({ message: 'Vui lòng cung cấp bookingId và rating' });
    }

    if (Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ message: 'Rating phải từ 1 đến 5' });
    }

    const [bookings] = await db.query(
      'SELECT id, customerId, status FROM bookings WHERE id = ?',
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đặt phòng' });
    }

    const booking = bookings[0];

    if (booking.status !== 'checked_out') {
      return res.status(400).json({ message: 'Chỉ có thể đánh giá sau khi trả phòng' });
    }

    const [existing] = await db.query(
      'SELECT id FROM reviews WHERE bookingId = ?',
      [bookingId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: 'Đặt phòng này đã được đánh giá' });
    }

    const reviewCustomerId = customerId || booking.customerId;

    const [result] = await db.query(`
      INSERT INTO reviews (bookingId, customerId, rating, comment, createdAt)
      VALUES (?, ?, ?, ?, NOW())
    `, [bookingId, reviewCustomerId, rating, comment || '']);

    res.status(201).json({
      message: 'Tạo đánh giá thành công',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Delete a review
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM reviews WHERE id = ?', [id]);
    res.json({ message: 'Xóa đánh giá thành công' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

module.exports = router;

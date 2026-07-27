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
        COALESCE(bd.roomId, bk.room_id) AS roomId,
        rm.roomNumber AS roomNumber,
        rt.id AS roomTypeId,
        rt.typeName AS roomTypeName
      FROM reviews r
      LEFT JOIN customers c ON r.customerId = c.id
      LEFT JOIN accounts a ON c.accountId = a.id
      LEFT JOIN bookings bk ON r.bookingId = bk.id
      LEFT JOIN booking_details bd ON bd.bookingId = bk.id
      LEFT JOIN rooms rm ON rm.id = COALESCE(bd.roomId, bk.room_id)
      LEFT JOIN room_types rt ON rt.id = rm.roomTypeId
      ORDER BY r.createdAt DESC
    `);
    res.json({ data: reviews });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ', error: error.message });
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
      `SELECT bk.id, bk.customerId, bk.status,
              COALESCE(bd.roomId, bk.room_id) AS roomId,
              rm.roomNumber, rt.id AS roomTypeId, rt.typeName AS roomTypeName
       FROM bookings bk
       LEFT JOIN booking_details bd ON bd.bookingId = bk.id
       LEFT JOIN rooms rm ON rm.id = COALESCE(bd.roomId, bk.room_id)
       LEFT JOIN room_types rt ON rt.id = rm.roomTypeId
       WHERE bk.id = ?`,
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
      data: {
        id: result.insertId,
        bookingId: booking.id,
        roomId: booking.roomId,
        roomNumber: booking.roomNumber,
        roomTypeId: booking.roomTypeId,
        roomTypeName: booking.roomTypeName
      }
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ', error: error.message });
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
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ', error: error.message });
  }
});

module.exports = router;

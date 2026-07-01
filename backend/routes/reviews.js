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
        bk.status AS bookingStatus
      FROM reviews r
      LEFT JOIN customers c ON r.customerId = c.id
      LEFT JOIN accounts a ON c.accountId = a.id
      LEFT JOIN bookings bk ON r.bookingId = bk.id
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
    
    if (!bookingId || !customerId || !rating) {
      return res.status(400).json({ message: 'Vui lòng cung cấp bookingId, customerId và rating' });
    }

    const [result] = await db.query(`
      INSERT INTO reviews (bookingId, customerId, rating, comment, createdAt)
      VALUES (?, ?, ?, ?, NOW())
    `, [bookingId, customerId, rating, comment || '']);

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

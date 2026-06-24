const express = require('express');
const db = require('../config/db');

const router = express.Router();

// GET /api/reviews
router.get('/', async (req, res) => {
  try {
    const [reviews] = await db.query(`
      SELECT
        r.id,
        r.bookingId,
        r.customerId,
        c.fullName,
        r.rating,
        r.comment,
        r.status,
        r.adminReply,
        r.repliedAt,
        r.createdAt
      FROM reviews r
      LEFT JOIN customers c ON r.customerId = c.id
      ORDER BY r.createdAt DESC
    `);

    res.json({ data: reviews });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/reviews/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [reviews] = await db.query(`
      SELECT
        r.id,
        r.bookingId,
        r.customerId,
        c.fullName,
        r.rating,
        r.comment,
        r.status,
        r.adminReply,
        r.repliedAt,
        r.createdAt
      FROM reviews r
      LEFT JOIN customers c ON r.customerId = c.id
      WHERE r.id = ?
    `, [id]);

    if (reviews.length === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({ data: reviews[0] });
  } catch (error) {
    console.error('Get review detail error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/reviews/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatus = ['pending', 'approved', 'rejected'];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({
        message: 'Status must be pending, approved or rejected'
      });
    }

    const [result] = await db.query(
      'UPDATE reviews SET status = ? WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({ message: 'Update review status successfully' });
  } catch (error) {
    console.error('Update review status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/reviews/:id/reply
router.patch('/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminReply } = req.body;

    if (!adminReply || !adminReply.trim()) {
      return res.status(400).json({
        message: 'Admin reply is required'
      });
    }

    const [result] = await db.query(
      `
      UPDATE reviews
      SET adminReply = ?, repliedAt = NOW()
      WHERE id = ?
      `,
      [adminReply.trim(), id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({ message: 'Reply review successfully' });
  } catch (error) {
    console.error('Reply review error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/reviews/:id/reply
router.delete('/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      `
      UPDATE reviews
      SET adminReply = NULL, repliedAt = NULL
      WHERE id = ?
      `,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({ message: 'Delete review reply successfully' });
  } catch (error) {
    console.error('Delete review reply error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/reviews/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      'DELETE FROM reviews WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({ message: 'Delete review successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
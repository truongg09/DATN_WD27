const express = require('express');
const db = require('../config/db');

const router = express.Router();

const REPORT_SELECT = `
  SELECT
    dr.id,
    dr.bookingId,
    dr.roomItemId,
    dr.description,
    dr.compensationFee,
    dr.reportDate,
    b.bookingCode AS booking_code,
    ri.itemName AS item_name,
    r.roomNumber AS room_number
  FROM damage_reports dr
  LEFT JOIN bookings b ON b.id = dr.bookingId
  LEFT JOIN room_items ri ON ri.id = dr.roomItemId
  LEFT JOIN rooms r ON r.id = ri.roomId
`;

// Lấy danh sách báo hỏng (lọc theo bookingId nếu có)
router.get('/', async (req, res) => {
  try {
    const { bookingId } = req.query;
    const conditions = [];
    const values = [];
    if (bookingId) {
      conditions.push('dr.bookingId = ?');
      values.push(bookingId);
    }
    const [rows] = await db.query(
      `${REPORT_SELECT} ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY dr.id DESC`,
      values
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('Get damage reports error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Lấy 1 báo hỏng
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`${REPORT_SELECT} WHERE dr.id = ?`, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Damage report not found' });
    }
    res.json({ data: rows[0] });
  } catch (error) {
    console.error('Get damage report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Thêm báo hỏng
router.post('/', async (req, res) => {
  try {
    const { bookingId, roomItemId, description, compensationFee } = req.body;
    if (!roomItemId) {
      return res.status(400).json({ message: 'Vui lòng chọn vật dụng bị hỏng' });
    }
    const [result] = await db.query(
      'INSERT INTO damage_reports (bookingId, roomItemId, description, compensationFee) VALUES (?, ?, ?, ?)',
      [bookingId || null, roomItemId, description || null, compensationFee ?? 0]
    );
    res.status(201).json({
      message: 'Damage report created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Create damage report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Cập nhật báo hỏng
router.put('/:id', async (req, res) => {
  try {
    const { bookingId, roomItemId, description, compensationFee } = req.body;
    const [result] = await db.query(
      'UPDATE damage_reports SET bookingId = ?, roomItemId = ?, description = ?, compensationFee = ? WHERE id = ?',
      [bookingId || null, roomItemId, description || null, compensationFee ?? 0, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Damage report not found' });
    }
    res.json({ message: 'Damage report updated successfully' });
  } catch (error) {
    console.error('Update damage report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Xóa báo hỏng
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM damage_reports WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Damage report not found' });
    }
    res.json({ message: 'Damage report deleted successfully' });
  } catch (error) {
    console.error('Delete damage report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

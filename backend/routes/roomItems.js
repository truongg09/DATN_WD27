const express = require('express');
const db = require('../config/db');

const router = express.Router();

const ITEM_SELECT = `
  SELECT
    ri.id,
    ri.roomId,
    ri.itemName,
    ri.quantity,
    ri.status,
    r.roomNumber AS room_number
  FROM room_items ri
  LEFT JOIN rooms r ON r.id = ri.roomId
`;

// Lấy danh sách vật dụng (lọc theo roomId nếu có)
router.get('/', async (req, res) => {
  try {
    const { roomId } = req.query;
    const conditions = [];
    const values = [];
    if (roomId) {
      conditions.push('ri.roomId = ?');
      values.push(roomId);
    }
    const [items] = await db.query(
      `${ITEM_SELECT} ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY ri.id DESC`,
      values
    );
    res.json({ data: items });
  } catch (error) {
    console.error('Get room items error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Lấy 1 vật dụng
router.get('/:id', async (req, res) => {
  try {
    const [items] = await db.query(`${ITEM_SELECT} WHERE ri.id = ?`, [req.params.id]);
    if (items.length === 0) {
      return res.status(404).json({ message: 'Room item not found' });
    }
    res.json({ data: items[0] });
  } catch (error) {
    console.error('Get room item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Thêm vật dụng
router.post('/', async (req, res) => {
  try {
    const { roomId, itemName, quantity, status } = req.body;
    if (!roomId || !itemName) {
      return res.status(400).json({ message: 'Vui lòng chọn phòng và nhập tên vật dụng' });
    }
    const [result] = await db.query(
      'INSERT INTO room_items (roomId, itemName, quantity, status) VALUES (?, ?, ?, ?)',
      [roomId, itemName, quantity ?? 1, status || 'normal']
    );
    res.status(201).json({
      message: 'Room item created successfully',
      data: { id: result.insertId, roomId, itemName, quantity, status }
    });
  } catch (error) {
    console.error('Create room item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Cập nhật vật dụng
router.put('/:id', async (req, res) => {
  try {
    const { roomId, itemName, quantity, status } = req.body;
    const [result] = await db.query(
      'UPDATE room_items SET roomId = ?, itemName = ?, quantity = ?, status = ? WHERE id = ?',
      [roomId, itemName, quantity ?? 1, status || 'normal', req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Room item not found' });
    }
    res.json({ message: 'Room item updated successfully' });
  } catch (error) {
    console.error('Update room item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Xóa vật dụng
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM room_items WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Room item not found' });
    }
    res.json({ message: 'Room item deleted successfully' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ message: 'Không thể xóa: vật dụng đang có trong báo hỏng' });
    }
    console.error('Delete room item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

const express = require('express');
const db = require('../config/db');

const router = express.Router();

const VALID_STATUS = ['normal', 'damaged', 'lost', 'maintenance'];

const parseId = (id) => {
  const value = Number(id);
  return Number.isInteger(value) && value > 0 ? value : null;
};

const normalizePayload = (body) => {
  const itemName = typeof body.itemName === 'string' ? body.itemName.trim() : '';
  const roomId = parseId(body.roomId);
  const quantity = Number(body.quantity);
  const status =
    typeof body.status === 'string' && VALID_STATUS.includes(body.status)
      ? body.status
      : 'normal';

  if (!itemName) {
    return { error: 'Vui lòng nhập tên vật dụng' };
  }
  if (!roomId) {
    return { error: 'Vui lòng chọn phòng' };
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { error: 'Số lượng không hợp lệ' };
  }

  return { itemName, roomId, quantity, status };
};

const ITEM_SELECT = `
  SELECT ri.id, ri.roomId, ri.itemName, ri.quantity, ri.status, r.roomNumber
  FROM room_items ri
  LEFT JOIN rooms r ON r.id = ri.roomId
`;

// List all room items
router.get('/', async (_req, res) => {
  try {
    const [items] = await db.query(`${ITEM_SELECT} ORDER BY ri.id ASC`);
    res.json({ data: items });
  } catch (error) {
    console.error('List room items error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get a single room item
router.get('/:id', async (req, res) => {
  const itemId = parseId(req.params.id);
  if (!itemId) {
    return res.status(400).json({ message: 'ID vật dụng không hợp lệ' });
  }
  try {
    const [items] = await db.query(`${ITEM_SELECT} WHERE ri.id = ?`, [itemId]);
    if (items.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy vật dụng' });
    }
    res.json({ data: items[0] });
  } catch (error) {
    console.error('Get room item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create a room item
router.post('/', async (req, res) => {
  const { itemName, roomId, quantity, status, error } = normalizePayload(req.body);
  if (error) {
    return res.status(400).json({ message: error });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO room_items (roomId, itemName, quantity, status) VALUES (?, ?, ?, ?)',
      [roomId, itemName, quantity, status]
    );
    res
      .status(201)
      .json({ data: { id: result.insertId }, message: 'Thêm vật dụng thành công' });
  } catch (error) {
    console.error('Create room item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update a room item
router.put('/:id', async (req, res) => {
  const itemId = parseId(req.params.id);
  if (!itemId) {
    return res.status(400).json({ message: 'ID vật dụng không hợp lệ' });
  }
  const { itemName, roomId, quantity, status, error } = normalizePayload(req.body);
  if (error) {
    return res.status(400).json({ message: error });
  }
  try {
    const [result] = await db.query(
      'UPDATE room_items SET roomId = ?, itemName = ?, quantity = ?, status = ? WHERE id = ?',
      [roomId, itemName, quantity, status, itemId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy vật dụng' });
    }
    res.json({ message: 'Cập nhật vật dụng thành công' });
  } catch (error) {
    console.error('Update room item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a room item
router.delete('/:id', async (req, res) => {
  const itemId = parseId(req.params.id);
  if (!itemId) {
    return res.status(400).json({ message: 'ID vật dụng không hợp lệ' });
  }
  try {
    const [used] = await db.query(
      'SELECT COUNT(*) AS count FROM damage_reports WHERE roomItemId = ?',
      [itemId]
    );
    if (used[0].count > 0) {
      return res.status(400).json({
        message: 'Không thể xóa: vật dụng đang có trong báo hỏng',
      });
    }

    const [result] = await db.query('DELETE FROM room_items WHERE id = ?', [itemId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy vật dụng' });
    }
    res.json({ message: 'Xóa vật dụng thành công' });
  } catch (error) {
    console.error('Delete room item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

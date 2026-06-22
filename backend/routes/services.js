const express = require('express');
const db = require('../config/db');

const router = express.Router();

// Lấy danh sách dịch vụ
router.get('/', async (req, res) => {
  try {
    const [services] = await db.query(
      'SELECT id, serviceName, price, description FROM services ORDER BY id DESC'
    );
    res.json({ data: services });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Lấy 1 dịch vụ
router.get('/:id', async (req, res) => {
  try {
    const [services] = await db.query(
      'SELECT id, serviceName, price, description FROM services WHERE id = ?',
      [req.params.id]
    );
    if (services.length === 0) {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.json({ data: services[0] });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Thêm dịch vụ
router.post('/', async (req, res) => {
  try {
    const { serviceName, price, description } = req.body;
    if (!serviceName || price === undefined || price === null) {
      return res.status(400).json({ message: 'Vui lòng nhập tên dịch vụ và giá' });
    }
    const [result] = await db.query(
      'INSERT INTO services (serviceName, price, description) VALUES (?, ?, ?)',
      [serviceName, price, description || null]
    );
    res.status(201).json({
      message: 'Service created successfully',
      data: { id: result.insertId, serviceName, price, description }
    });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Cập nhật dịch vụ
router.put('/:id', async (req, res) => {
  try {
    const { serviceName, price, description } = req.body;
    const [result] = await db.query(
      'UPDATE services SET serviceName = ?, price = ?, description = ? WHERE id = ?',
      [serviceName, price, description || null, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.json({ message: 'Service updated successfully' });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Xóa dịch vụ
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM services WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ message: 'Không thể xóa: dịch vụ đang được dùng trong đơn đặt phòng' });
    }
    console.error('Delete service error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

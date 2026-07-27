const express = require('express');
const db = require('../config/db');

const router = express.Router();

const parseServiceId = (id) => {
  const serviceId = Number(id);
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    return null;
  }
  return serviceId;
};

const normalizePayload = (body) => {
  const name = typeof body.serviceName === 'string' ? body.serviceName.trim() : '';
  const numericPrice = Number(body.price);
  const description =
    typeof body.description === 'string' && body.description.trim() !== ''
      ? body.description.trim()
      : null;

  if (!name) {
    return { error: 'Vui lòng nhập tên dịch vụ' };
  }
  if (!Number.isFinite(numericPrice) || numericPrice < 0) {
    return { error: 'Giá dịch vụ không hợp lệ' };
  }

  return { name, numericPrice, description };
};

// List all services
router.get('/', async (_req, res) => {
  try {
    const [services] = await db.query(
      'SELECT id, serviceName, price, description FROM services ORDER BY id ASC'
    );
    res.json({ data: services });
  } catch (error) {
    console.error('List services error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Get a single service
router.get('/:id', async (req, res) => {
  const serviceId = parseServiceId(req.params.id);
  if (!serviceId) {
    return res.status(400).json({ message: 'ID dịch vụ không hợp lệ' });
  }
  try {
    const [services] = await db.query(
      'SELECT id, serviceName, price, description FROM services WHERE id = ?',
      [serviceId]
    );
    if (services.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });
    }
    res.json({ data: services[0] });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Create a service
router.post('/', async (req, res) => {
  const { name, numericPrice, description, error } = normalizePayload(req.body);
  if (error) {
    return res.status(400).json({ message: error });
  }
  try {
    const [existing] = await db.query('SELECT id FROM services WHERE serviceName = ?', [name]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Tên dịch vụ này đã tồn tại!' });
    }

    const [result] = await db.query(
      'INSERT INTO services (serviceName, price, description) VALUES (?, ?, ?)',
      [name, numericPrice, description]
    );
    res
      .status(201)
      .json({ data: { id: result.insertId }, message: 'Thêm dịch vụ thành công' });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Update a service
router.put('/:id', async (req, res) => {
  const serviceId = parseServiceId(req.params.id);
  if (!serviceId) {
    return res.status(400).json({ message: 'ID dịch vụ không hợp lệ' });
  }

  const { name, numericPrice, description, error } = normalizePayload(req.body);
  if (error) {
    return res.status(400).json({ message: error });
  }
  try {
    const [existing] = await db.query(
      'SELECT id FROM services WHERE serviceName = ? AND id != ?',
      [name, serviceId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Tên dịch vụ này đã tồn tại!' });
    }

    const [result] = await db.query(
      'UPDATE services SET serviceName = ?, price = ?, description = ? WHERE id = ?',
      [name, numericPrice, description, serviceId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });
    }
    res.json({ message: 'Cập nhật dịch vụ thành công' });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Delete a service
router.delete('/:id', async (req, res) => {
  const serviceId = parseServiceId(req.params.id);
  if (!serviceId) {
    return res.status(400).json({ message: 'ID dịch vụ không hợp lệ' });
  }
  try {
    // Prevent deleting a service that is already attached to bookings
    const [used] = await db.query(
      'SELECT COUNT(*) AS count FROM booking_services WHERE serviceId = ?',
      [serviceId]
    );
    if (used[0].count > 0) {
      return res.status(400).json({
        message: 'Không thể xóa: dịch vụ đang được sử dụng trong đơn đặt phòng',
      });
    }

    const [result] = await db.query('DELETE FROM services WHERE id = ?', [serviceId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });
    }
    res.json({ message: 'Xóa dịch vụ thành công' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

module.exports = router;

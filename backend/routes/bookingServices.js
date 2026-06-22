const express = require('express');
const db = require('../config/db');

const router = express.Router();

const BS_SELECT = `
  SELECT
    bs.id,
    bs.bookingId,
    bs.serviceId,
    bs.quantity,
    bs.totalPrice,
    s.serviceName,
    s.price AS unit_price,
    b.bookingCode AS booking_code
  FROM booking_services bs
  LEFT JOIN services s ON s.id = bs.serviceId
  LEFT JOIN bookings b ON b.id = bs.bookingId
`;

// Tính tổng tiền theo giá dịch vụ * số lượng
const getServicePrice = async (serviceId) => {
  const [rows] = await db.query('SELECT price FROM services WHERE id = ?', [serviceId]);
  return rows.length ? Number(rows[0].price) : 0;
};

// Lấy danh sách dịch vụ phát sinh (lọc theo bookingId nếu có)
router.get('/', async (req, res) => {
  try {
    const { bookingId } = req.query;
    const conditions = [];
    const values = [];
    if (bookingId) {
      conditions.push('bs.bookingId = ?');
      values.push(bookingId);
    }
    const [rows] = await db.query(
      `${BS_SELECT} ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY bs.id DESC`,
      values
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('Get booking services error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Lấy 1 bản ghi
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`${BS_SELECT} WHERE bs.id = ?`, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Booking service not found' });
    }
    res.json({ data: rows[0] });
  } catch (error) {
    console.error('Get booking service error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Thêm dịch vụ vào đơn
router.post('/', async (req, res) => {
  try {
    const { bookingId, serviceId, quantity } = req.body;
    if (!bookingId || !serviceId) {
      return res.status(400).json({ message: 'Vui lòng chọn đơn đặt phòng và dịch vụ' });
    }
    const qty = quantity ?? 1;
    const totalPrice = (await getServicePrice(serviceId)) * qty;
    const [result] = await db.query(
      'INSERT INTO booking_services (bookingId, serviceId, quantity, totalPrice) VALUES (?, ?, ?, ?)',
      [bookingId, serviceId, qty, totalPrice]
    );
    res.status(201).json({
      message: 'Booking service created successfully',
      data: { id: result.insertId, bookingId, serviceId, quantity: qty, totalPrice }
    });
  } catch (error) {
    console.error('Create booking service error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Cập nhật
router.put('/:id', async (req, res) => {
  try {
    const { bookingId, serviceId, quantity } = req.body;
    const qty = quantity ?? 1;
    const totalPrice = (await getServicePrice(serviceId)) * qty;
    const [result] = await db.query(
      'UPDATE booking_services SET bookingId = ?, serviceId = ?, quantity = ?, totalPrice = ? WHERE id = ?',
      [bookingId, serviceId, qty, totalPrice, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Booking service not found' });
    }
    res.json({ message: 'Booking service updated successfully' });
  } catch (error) {
    console.error('Update booking service error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Xóa
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM booking_services WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Booking service not found' });
    }
    res.json({ message: 'Booking service deleted successfully' });
  } catch (error) {
    console.error('Delete booking service error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

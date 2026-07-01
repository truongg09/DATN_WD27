const express = require('express');
const db = require('../config/db');

const router = express.Router();

// Get all vouchers
router.get('/', async (req, res) => {
  try {
    const [vouchers] = await db.query('SELECT * FROM vouchers ORDER BY id DESC');
    res.json({ data: vouchers });
  } catch (error) {
    console.error('Get vouchers error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Create a voucher
router.post('/', async (req, res) => {
  try {
    const { 
      code, 
      discountType, 
      discountValue, 
      maxDiscount, 
      minBookingAmount, 
      quantity, 
      startDate, 
      endDate, 
      status 
    } = req.body;

    if (!code || !discountType || !discountValue) {
      return res.status(400).json({ message: 'Vui lòng điền mã code, loại giảm giá và giá trị giảm giá!' });
    }

    const [existing] = await db.query('SELECT id FROM vouchers WHERE code = ?', [code]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Mã giảm giá này đã tồn tại!' });
    }

    const [result] = await db.query(`
      INSERT INTO vouchers (
        code, discountType, discountValue, maxDiscount, minBookingAmount, quantity, startDate, endDate, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      code, 
      discountType, 
      discountValue, 
      maxDiscount || 0, 
      minBookingAmount || 0, 
      quantity || 0, 
      startDate || null, 
      endDate || null, 
      status || 'active'
    ]);

    res.status(201).json({
      message: 'Tạo voucher thành công',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Create voucher error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Update a voucher
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      code, 
      discountType, 
      discountValue, 
      maxDiscount, 
      minBookingAmount, 
      quantity, 
      startDate, 
      endDate, 
      status 
    } = req.body;

    const [existing] = await db.query('SELECT id FROM vouchers WHERE code = ? AND id != ?', [code, id]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Mã giảm giá này đã được sử dụng bởi voucher khác!' });
    }

    await db.query(`
      UPDATE vouchers SET 
        code = ?, 
        discountType = ?, 
        discountValue = ?, 
        maxDiscount = ?, 
        minBookingAmount = ?, 
        quantity = ?, 
        startDate = ?, 
        endDate = ?, 
        status = ?
      WHERE id = ?
    `, [
      code, 
      discountType, 
      discountValue, 
      maxDiscount, 
      minBookingAmount, 
      quantity, 
      startDate, 
      endDate, 
      status, 
      id
    ]);

    res.json({ message: 'Cập nhật voucher thành công' });
  } catch (error) {
    console.error('Update voucher error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Delete a voucher
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM vouchers WHERE id = ?', [id]);
    res.json({ message: 'Xóa voucher thành công' });
  } catch (error) {
    console.error('Delete voucher error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

module.exports = router;

const express = require('express');
const db = require('../config/db');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const [vouchers] = await db.query(
      `SELECT
         id,
         code,
         discountType,
         discountValue,
         maxDiscount,
         minBookingAmount,
         quantity,
         startDate,
         endDate,
         status
       FROM vouchers
       ORDER BY id DESC`
    );
    res.json({ data: vouchers });
  } catch (error) {
    console.error('List vouchers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { code, discountType, discountValue, maxDiscount, minBookingAmount, quantity, startDate, endDate, status = 'active' } = req.body;

    if (!code || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ message: 'Thiếu thông tin voucher' });
    }

    const [result] = await db.query(
      `INSERT INTO vouchers (code, discountType, discountValue, maxDiscount, minBookingAmount, quantity, startDate, endDate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, discountType, discountValue, maxDiscount || null, minBookingAmount || null, quantity || 1, startDate, endDate, status]
    );

    res.status(201).json({ data: { id: result.insertId }, message: 'Tạo voucher thành công' });
  } catch (error) {
    console.error('Create voucher error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Mã voucher đã tồn tại' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const voucherId = Number(req.params.id);
    const { code, discountType, discountValue, maxDiscount, minBookingAmount, quantity, startDate, endDate, status } = req.body;

    if (!voucherId || !code || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ message: 'Thiếu thông tin voucher' });
    }

    await db.query(
      `UPDATE vouchers
       SET code = ?, discountType = ?, discountValue = ?, maxDiscount = ?, minBookingAmount = ?, quantity = ?, startDate = ?, endDate = ?, status = ?
       WHERE id = ?`,
      [code, discountType, discountValue, maxDiscount || null, minBookingAmount || null, quantity || 1, startDate, endDate, status || 'active', voucherId]
    );

    res.json({ message: 'Cập nhật voucher thành công' });
  } catch (error) {
    console.error('Update voucher error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Mã voucher đã tồn tại' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const voucherId = Number(req.params.id);
    if (!voucherId) {
      return res.status(400).json({ message: 'ID voucher không hợp lệ' });
    }

    await db.query('DELETE FROM vouchers WHERE id = ?', [voucherId]);
    res.json({ message: 'Xóa voucher thành công' });
  } catch (error) {
    console.error('Delete voucher error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
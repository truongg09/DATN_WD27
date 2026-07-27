const express = require('express');
const db = require('../config/db');

const router = express.Router();

const normalizeVoucherPayload = (body) => {
  const discountType = body.discountType === 'percent' ? 'percentage' : body.discountType;
  const discountValue = Number(body.discountValue);
  const maxDiscount = Number(body.maxDiscount || 0);
  const minBookingAmount = Number(body.minBookingAmount || 0);
  const quantity = Number(body.quantity || 1);

  if (!['percentage', 'fixed'].includes(discountType)) return { error: 'Loại giảm giá không hợp lệ' };
  if (!Number.isFinite(discountValue) || discountValue <= 0) return { error: 'Giá trị giảm giá phải lớn hơn 0' };
  if (discountType === 'percentage' && discountValue > 100) return { error: 'Giảm giá phần trăm phải từ 0 đến 100%' };
  if (!Number.isFinite(maxDiscount) || maxDiscount < 0) return { error: 'Mức giảm tối đa không hợp lệ' };
  if (!Number.isFinite(minBookingAmount) || minBookingAmount < 0) return { error: 'Giá trị đơn tối thiểu không hợp lệ' };
  if (!Number.isInteger(quantity) || quantity < 1) return { error: 'Số lượng voucher phải là số nguyên dương' };
  if (body.endDate < body.startDate) return { error: 'Ngày kết thúc phải sau ngày bắt đầu' };

  return {
    data: {
      ...body,
      code: String(body.code || '').trim().toUpperCase(),
      discountType,
      discountValue,
      maxDiscount: maxDiscount || null,
      minBookingAmount: minBookingAmount || null,
      quantity,
    },
  };
};

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
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

router.post('/', async (req, res) => {
  try {
    const normalized = normalizeVoucherPayload(req.body);
    if (normalized.error) return res.status(400).json({ message: normalized.error });
    const { code, discountType, discountValue, maxDiscount, minBookingAmount, quantity, startDate, endDate, status = 'active' } = normalized.data;

    if (!code || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ message: 'Thiếu thông tin voucher' });
    }

    const [result] = await db.query(
      `INSERT INTO vouchers (code, discountType, discountValue, maxDiscount, minBookingAmount, quantity, startDate, endDate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, discountType, discountValue, maxDiscount, minBookingAmount, quantity, startDate, endDate, status]
    );

    res.status(201).json({ data: { id: result.insertId }, message: 'Tạo voucher thành công' });
  } catch (error) {
    console.error('Create voucher error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Mã voucher đã tồn tại' });
    }
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const voucherId = Number(req.params.id);
    const normalized = normalizeVoucherPayload(req.body);
    if (normalized.error) return res.status(400).json({ message: normalized.error });
    const { code, discountType, discountValue, maxDiscount, minBookingAmount, quantity, startDate, endDate, status } = normalized.data;

    if (!voucherId || !code || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ message: 'Thiếu thông tin voucher' });
    }

    await db.query(
      `UPDATE vouchers
       SET code = ?, discountType = ?, discountValue = ?, maxDiscount = ?, minBookingAmount = ?, quantity = ?, startDate = ?, endDate = ?, status = ?
       WHERE id = ?`,
      [code, discountType, discountValue, maxDiscount, minBookingAmount, quantity, startDate, endDate, status || 'active', voucherId]
    );

    res.json({ message: 'Cập nhật voucher thành công' });
  } catch (error) {
    console.error('Update voucher error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Mã voucher đã tồn tại' });
    }
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
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
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

module.exports = router;

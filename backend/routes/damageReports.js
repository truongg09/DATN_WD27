const express = require('express');
const db = require('../config/db');

const { requireAuth, requireStaff } = require('../middleware/auth');

const router = express.Router();

const parseId = (id) => {
  const value = Number(id);
  return Number.isInteger(value) && value > 0 ? value : null;
};

const normalizePayload = (body) => {
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const roomItemId = parseId(body.roomItemId);
  const bookingId = parseId(body.bookingId);
  const compensationFee = Number(body.compensationFee);
  const reportDate =
    typeof body.reportDate === 'string' && body.reportDate.trim() !== ''
      ? body.reportDate.trim()
      : null;

  if (!description) {
    return { error: 'Vui lòng nhập mô tả hư hỏng' };
  }
  if (!roomItemId) {
    return { error: 'Vui lòng chọn vật dụng bị hỏng' };
  }
  if (!Number.isFinite(compensationFee) || compensationFee < 0) {
    return { error: 'Phí bồi thường không hợp lệ' };
  }

  // bookingId is optional (a damage may be reported outside a booking)
  return { description, roomItemId, bookingId, compensationFee, reportDate };
};

const REPORT_SELECT = `
  SELECT dr.id, dr.bookingId, dr.roomItemId, dr.description, dr.compensationFee, dr.reportDate,
         ri.itemName, ri.roomId, r.roomNumber,
         COALESCE(b.guest_name, c.fullName) AS bookingCustomer
  FROM damage_reports dr
  LEFT JOIN room_items ri ON ri.id = dr.roomItemId
  LEFT JOIN rooms r ON r.id = ri.roomId
  LEFT JOIN bookings b ON b.id = dr.bookingId
  LEFT JOIN customers c ON c.id = b.customerId
`;

// List all damage reports
router.get('/', requireAuth, requireStaff, async (_req, res) => {
  try {
    const [reports] = await db.query(`${REPORT_SELECT} ORDER BY dr.id DESC`);
    res.json({ data: reports });
  } catch (error) {
    console.error('List damage reports error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Get a single damage report
router.get('/:id', requireAuth, requireStaff, async (req, res) => {
  const reportId = parseId(req.params.id);
  if (!reportId) {
    return res.status(400).json({ message: 'ID báo hỏng không hợp lệ' });
  }
  try {
    const [reports] = await db.query(`${REPORT_SELECT} WHERE dr.id = ?`, [reportId]);
    if (reports.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy báo hỏng' });
    }
    res.json({ data: reports[0] });
  } catch (error) {
    console.error('Get damage report error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Create a damage report
router.post('/', requireAuth, requireStaff, async (req, res) => {
  const { description, roomItemId, bookingId, compensationFee, reportDate, error } =
    normalizePayload(req.body);
  if (error) {
    return res.status(400).json({ message: error });
  }
  try {
    const [result] = await db.query(
      `INSERT INTO damage_reports (bookingId, roomItemId, description, compensationFee, reportDate)
       VALUES (?, ?, ?, ?, COALESCE(?, NOW()))`,
      [bookingId, roomItemId, description, compensationFee, reportDate]
    );
    res
      .status(201)
      .json({ data: { id: result.insertId }, message: 'Tạo báo hỏng thành công' });
  } catch (error) {
    console.error('Create damage report error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Update a damage report
router.put('/:id', requireAuth, requireStaff, async (req, res) => {
  const reportId = parseId(req.params.id);
  if (!reportId) {
    return res.status(400).json({ message: 'ID báo hỏng không hợp lệ' });
  }
  const { description, roomItemId, bookingId, compensationFee, reportDate, error } =
    normalizePayload(req.body);
  if (error) {
    return res.status(400).json({ message: error });
  }
  try {
    const [result] = await db.query(
      `UPDATE damage_reports
       SET bookingId = ?, roomItemId = ?, description = ?, compensationFee = ?, reportDate = COALESCE(?, reportDate)
       WHERE id = ?`,
      [bookingId, roomItemId, description, compensationFee, reportDate, reportId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy báo hỏng' });
    }
    res.json({ message: 'Cập nhật báo hỏng thành công' });
  } catch (error) {
    console.error('Update damage report error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Delete a damage report
router.delete('/:id', requireAuth, requireStaff, async (req, res) => {
  const reportId = parseId(req.params.id);
  if (!reportId) {
    return res.status(400).json({ message: 'ID báo hỏng không hợp lệ' });
  }
  try {
    const [result] = await db.query('DELETE FROM damage_reports WHERE id = ?', [reportId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy báo hỏng' });
    }
    res.json({ message: 'Xóa báo hỏng thành công' });
  } catch (error) {
    console.error('Delete damage report error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

module.exports = router;

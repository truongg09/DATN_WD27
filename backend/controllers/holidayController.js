const db = require('../config/db');

// Lấy danh sách ngày lễ (hỗ trợ filter theo year, status, calendarType)
const getHolidays = async (req, res) => {
  try {
    const { year, status, calendarType } = req.query;
    let query = 'SELECT * FROM holidays WHERE 1=1';
    const params = [];

    if (year) {
      query += ' AND (year = ? OR calendarType = "solar" OR isRecurring = 1)';
      params.push(Number(year));
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (calendarType) {
      query += ' AND calendarType = ?';
      params.push(calendarType);
    }

    query += ' ORDER BY startDate ASC, id ASC';

    const [rows] = await db.query(query, params);
    return res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách ngày lễ:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tải danh sách ngày lễ' });
  }
};

// Lấy chi tiết 1 ngày lễ
const getHolidayById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM holidays WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin ngày lễ' });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết ngày lễ:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// Thêm mới ngày lễ
const createHoliday = async (req, res) => {
  try {
    const { name, calendarType, year, startDate, endDate, surchargePercent, isRecurring, description, status } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ tên và khoảng thời gian ngày lễ' });
    }

    const type = calendarType || 'solar';
    const percent = surchargePercent != null ? Number(surchargePercent) : 10.0;
    const recurring = isRecurring ? 1 : 0;
    const itemStatus = status || 'active';
    const holidayYear = year ? Number(year) : (startDate ? Number(startDate.slice(0, 4)) : null);

    const [result] = await db.query(
      `INSERT INTO holidays (name, calendarType, year, startDate, endDate, surchargePercent, isRecurring, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), type, holidayYear, startDate, endDate, percent, recurring, description || null, itemStatus]
    );

    const [created] = await db.query('SELECT * FROM holidays WHERE id = ?', [result.insertId]);
    return res.status(201).json({
      success: true,
      message: 'Thêm ngày lễ thành công',
      data: created[0]
    });
  } catch (error) {
    console.error('Lỗi khi thêm ngày lễ:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi thêm ngày lễ' });
  }
};

// Cập nhật ngày lễ
const updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, calendarType, year, startDate, endDate, surchargePercent, isRecurring, description, status } = req.body;

    const [existing] = await db.query('SELECT * FROM holidays WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ngày lễ cần sửa' });
    }

    const fields = [];
    const params = [];

    if (name !== undefined) { fields.push('name = ?'); params.push(name.trim()); }
    if (calendarType !== undefined) { fields.push('calendarType = ?'); params.push(calendarType); }
    if (year !== undefined) { fields.push('year = ?'); params.push(year ? Number(year) : null); }
    if (startDate !== undefined) { fields.push('startDate = ?'); params.push(startDate); }
    if (endDate !== undefined) { fields.push('endDate = ?'); params.push(endDate); }
    if (surchargePercent !== undefined) { fields.push('surchargePercent = ?'); params.push(Number(surchargePercent)); }
    if (isRecurring !== undefined) { fields.push('isRecurring = ?'); params.push(isRecurring ? 1 : 0); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }
    if (status !== undefined) { fields.push('status = ?'); params.push(status); }

    if (fields.length === 0) {
      return res.json({ success: true, data: existing[0] });
    }

    params.push(id);
    await db.query(`UPDATE holidays SET ${fields.join(', ')} WHERE id = ?`, params);

    const [updated] = await db.query('SELECT * FROM holidays WHERE id = ?', [id]);
    return res.json({
      success: true,
      message: 'Cập nhật ngày lễ thành công',
      data: updated[0]
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật ngày lễ:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật ngày lễ' });
  }
};

// Xóa ngày lễ
const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.query('SELECT * FROM holidays WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ngày lễ' });
    }

    await db.query('DELETE FROM holidays WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Xóa ngày lễ thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa ngày lễ:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa ngày lễ' });
  }
};

module.exports = {
  getHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday
};

const db = require('../config/db');
const moment = require('moment');

// Tự động quét & thêm các ngày lễ diễn ra trong vòng N ngày tới (mặc định 90 ngày) nếu chưa có trong DB
const autoSyncUpcomingHolidays = async (daysAhead = 90) => {
  try {
    const today = moment().startOf('day');
    const futureLimit = moment().add(daysAhead, 'days').endOf('day');

    const defaultHolidays = [
      { name: 'Tết Dương Lịch', mmddStart: '01-01', mmddEnd: '01-01', percent: 10.0, desc: '🎆 Tết Dương Lịch – ngày nghỉ lễ chính thức' },
      { name: 'Giỗ tổ Hùng Vương (10/3 Âm lịch)', mmddStart: '04-07', mmddEnd: '04-07', percent: 10.0, desc: 'Giỗ tổ Hùng Vương' },
      { name: 'Giải phóng miền Nam (30/4)', mmddStart: '04-30', mmddEnd: '04-30', percent: 10.0, desc: '🌸 Ngày Giải phóng miền Nam (30/4)' },
      { name: 'Quốc tế Lao động (1/5)', mmddStart: '05-01', mmddEnd: '05-01', percent: 10.0, desc: '💼 Ngày Quốc tế Lao động (1/5)' },
      { name: 'Quốc khánh Việt Nam (2/9)', mmddStart: '09-02', mmddEnd: '09-02', percent: 10.0, desc: '🇻🇳 Quốc khánh Việt Nam – ngày nghỉ lễ chính thức' },
      { name: 'Lễ Giáng Sinh (25/12)', mmddStart: '12-25', mmddEnd: '12-25', percent: 10.0, desc: '🎄 Lễ Giáng Sinh (Noel)' },
    ];

    const currentYear = today.year();
    const nextYear = currentYear + 1;
    const yearsToCheck = [currentYear, nextYear];

    let addedCount = 0;

    for (const y of yearsToCheck) {
      for (const h of defaultHolidays) {
        const startDateStr = `${y}-${h.mmddStart}`;
        const endDateStr = `${y}-${h.mmddEnd}`;
        const startDate = moment(startDateStr, 'YYYY-MM-DD');
        const endDate = moment(endDateStr, 'YYYY-MM-DD');

        // Kiểm tra nếu ngày lễ nằm trong khoảng N ngày tới từ hôm nay
        const startDiff = startDate.diff(today, 'days');
        const endDiff = endDate.diff(today, 'days');
        const isUpcoming = (startDiff >= 0 && startDiff <= daysAhead) ||
                          (endDiff >= 0 && endDiff <= daysAhead) ||
                          (today.isAfter(startDate) && today.isBefore(endDate));

        if (isUpcoming) {
          const [exists] = await db.query(
            'SELECT id FROM holidays WHERE (name = ? OR startDate = ?) AND year = ?',
            [h.name, startDateStr, y]
          );

          if (exists.length === 0) {
            await db.query(
              `INSERT INTO holidays (name, calendarType, year, startDate, endDate, surchargePercent, isRecurring, description, status)
               VALUES (?, 'solar', ?, ?, ?, ?, 1, ?, 'active')`,
              [h.name, y, startDateStr, endDateStr, h.percent, h.desc || 'Tự động cập nhật ngày lễ cận kề']
            );
            addedCount++;
          }
        }
      }
    }

    return addedCount;
  } catch (error) {
    console.error('Lỗi khi tự động đồng bộ ngày lễ:', error);
    return 0;
  }
};

// Lấy danh sách ngày lễ (hỗ trợ filter theo year, status, calendarType)
const getHolidays = async (req, res) => {
  try {
    const daysAhead = req.query.daysAhead ? Number(req.query.daysAhead) : 90;
    // Tự động kiểm tra và thêm các ngày lễ diễn ra trong khoảng daysAhead ngày tới
    await autoSyncUpcomingHolidays(daysAhead);

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

// API quét và tự động cập nhật ngày lễ trong 30 ngày tới
const syncUpcomingHolidays = async (req, res) => {
  try {
    const days = req.body?.days ? Number(req.body.days) : 30;
    const addedCount = await autoSyncUpcomingHolidays(days);
    return res.json({
      success: true,
      message: `Đã kiểm tra và tự động cập nhật ${addedCount} ngày lễ mới trong vòng ${days} ngày tới.`,
      addedCount
    });
  } catch (error) {
    console.error('Lỗi khi đồng bộ ngày lễ:', error);
    return res.status(500).json({ success: false, message: 'Lỗi khi đồng bộ ngày lễ 30 ngày tới' });
  }
};

module.exports = {
  getHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  syncUpcomingHolidays
};

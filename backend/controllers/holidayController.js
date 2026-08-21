const db = require('../config/db');
const moment = require('moment');

// Tự động quét & thêm các ngày lễ diễn ra trong vòng N ngày tới (mặc định 90 ngày) nếu chưa có trong DB
const autoSyncUpcomingHolidays = async (daysAhead = 90) => {
  try {
    const today = moment().startOf('day');
    const futureLimit = moment().add(daysAhead, 'days').endOf('day');

    const defaultHolidays = [
      { name: 'Tết Dương Lịch', mmddStart: '01-01', mmddEnd: '01-02', percent: 10.0, desc: '🎆 Tết Dương Lịch – ngày nghỉ lễ chính thức' },
      { name: 'Giỗ tổ Hùng Vương (10/3 Âm lịch)', mmddStart: '04-07', mmddEnd: '04-07', percent: 10.0, desc: 'Giỗ tổ Hùng Vương' },
      { name: 'Giải phóng miền Nam (30/4) & Quốc tế Lao động (1/5)', mmddStart: '04-30', mmddEnd: '05-01', percent: 10.0, desc: '🌸 Nghỉ lễ 30/4 và 1/5' },
      { name: 'Quốc khánh Việt Nam (2/9)', mmddStart: '09-01', mmddEnd: '09-03', percent: 10.0, desc: '🇻🇳 Quốc khánh Việt Nam – ngày nghỉ lễ chính thức' },
      { name: 'Ngày thành lập Mặt trận Tổ quốc Việt Nam', mmddStart: '09-10', mmddEnd: '09-10', percent: 5.0, desc: 'Ngày thành lập Mặt trận Tổ quốc Việt Nam' },
      { name: 'Ngày Quốc tế Dân chủ', mmddStart: '09-15', mmddEnd: '09-15', percent: 5.0, desc: 'Ngày Quốc tế Dân chủ' },
      { name: 'Ngày Quốc tế Bảo vệ tầng ôzôn', mmddStart: '09-16', mmddEnd: '09-16', percent: 5.0, desc: 'Ngày Quốc tế Bảo vệ tầng ôzôn' },
      { name: 'Ngày Quốc tế Hòa bình', mmddStart: '09-21', mmddEnd: '09-21', percent: 5.0, desc: 'Ngày Quốc tế Hòa bình' },
      { name: 'Tết Trung Thu (15/8 âm lịch)', mmddStart: '09-25', mmddEnd: '09-25', percent: 10.0, desc: '🌕 Tết Trung Thu – 15/8 âm lịch' },
      { name: 'Ngày Quốc tế Người cao tuổi', mmddStart: '10-01', mmddEnd: '10-01', percent: 5.0, desc: 'Ngày Quốc tế Người cao tuổi' },
      { name: 'Ngày Quốc tế Bất bạo động', mmddStart: '10-02', mmddEnd: '10-02', percent: 5.0, desc: 'Ngày Quốc tế Bất bạo động' },
      { name: 'Ngày Động vật Thế giới', mmddStart: '10-04', mmddEnd: '10-04', percent: 5.0, desc: 'Ngày Động vật Thế giới' },
      { name: 'Ngày Nhà giáo Thế giới', mmddStart: '10-05', mmddEnd: '10-05', percent: 5.0, desc: 'Ngày Nhà giáo Thế giới' },
      { name: 'Ngày Bưu chính Thế giới', mmddStart: '10-09', mmddEnd: '10-09', percent: 5.0, desc: 'Ngày Bưu chính Thế giới' },
      { name: 'Ngày Giải phóng Thủ đô', mmddStart: '10-10', mmddEnd: '10-10', percent: 10.0, desc: '🇻🇳 Ngày Giải phóng Thủ đô' },
      { name: 'Ngày Doanh nhân Việt Nam', mmddStart: '10-13', mmddEnd: '10-13', percent: 5.0, desc: '💼 Ngày Doanh nhân Việt Nam' },
      { name: 'Ngày Phụ nữ Việt Nam (20/10)', mmddStart: '10-20', mmddEnd: '10-20', percent: 10.0, desc: '💐 Ngày Phụ nữ Việt Nam' },
      { name: 'Lễ hội Halloween', mmddStart: '10-31', mmddEnd: '10-31', percent: 10.0, desc: '🎃 Halloween' },
      { name: 'Ngày Pháp luật Việt Nam', mmddStart: '11-09', mmddEnd: '11-09', percent: 5.0, desc: '⚖️ Ngày Pháp luật Việt Nam' },
      { name: 'Ngày truyền thống MTTQ Việt Nam', mmddStart: '11-18', mmddEnd: '11-18', percent: 5.0, desc: '🇻🇳 Ngày truyền thống MTTQ Việt Nam' },
      { name: 'Ngày Nhà giáo Việt Nam (20/11)', mmddStart: '11-20', mmddEnd: '11-20', percent: 10.0, desc: '👨‍🏫 Ngày Nhà giáo Việt Nam' },
      { name: 'Lễ Giáng Sinh (24-25/12)', mmddStart: '12-24', mmddEnd: '12-25', percent: 10.0, desc: '🎄 Lễ Giáng Sinh' },
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

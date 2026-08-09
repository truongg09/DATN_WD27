const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const PAYMENT_SETTING_KEY = 'payment_account';

const DEFAULT_PAYMENT_SETTINGS = {
  bankBin: '970422',
  bankCode: 'MB',
  bankName: 'MB Bank (Ngân hàng Quân đội)',
  accountNumber: '0000000000',
  accountName: 'KHACH SAN HOTELHUB',
  transferPrefix: 'HB'
};

const readSetting = async (key) => {
  const [rows] = await db.query(
    'SELECT settingValue FROM app_settings WHERE settingKey = ?',
    [key]
  );
  if (rows.length === 0) return null;
  try {
    return JSON.parse(rows[0].settingValue);
  } catch {
    return null;
  }
};

const writeSetting = async (key, value) => {
  await db.query(
    `
      INSERT INTO app_settings (settingKey, settingValue)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue)
    `,
    [key, JSON.stringify(value)]
  );
};

// Public: trang thanh toán của khách cần thông tin này để dựng mã VietQR
router.get('/payment', async (_req, res) => {
  try {
    const saved = await readSetting(PAYMENT_SETTING_KEY);
    res.json({ data: { ...DEFAULT_PAYMENT_SETTINGS, ...(saved || {}) } });
  } catch (error) {
    console.error('Get payment settings error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Admin: cập nhật tài khoản nhận tiền
router.put('/payment', requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Chỉ admin được phép thay đổi cài đặt thanh toán' });
    }

    const { bankBin, bankCode, bankName, accountNumber, accountName, transferPrefix } = req.body || {};

    if (!/^\d{6}$/.test(String(bankBin || ''))) {
      return res.status(400).json({ message: 'Mã BIN ngân hàng không hợp lệ (6 chữ số)' });
    }

    const normalizedAccount = String(accountNumber || '').replace(/\s+/g, '');
    if (!/^[A-Za-z0-9]{4,19}$/.test(normalizedAccount)) {
      return res.status(400).json({ message: 'Số tài khoản không hợp lệ (4-19 ký tự chữ/số)' });
    }

    const normalizedName = String(accountName || '').trim().toUpperCase();
    if (normalizedName.length < 3 || normalizedName.length > 50) {
      return res.status(400).json({ message: 'Tên chủ tài khoản phải từ 3-50 ký tự' });
    }

    const settings = {
      bankBin: String(bankBin),
      bankCode: String(bankCode || '').toUpperCase().slice(0, 20),
      bankName: String(bankName || '').slice(0, 100),
      accountNumber: normalizedAccount,
      accountName: normalizedName,
      transferPrefix: String(transferPrefix || 'HB').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'HB'
    };

    await writeSetting(PAYMENT_SETTING_KEY, settings);
    res.json({ data: settings, message: 'Đã lưu cài đặt tài khoản nhận tiền' });
  } catch (error) {
    console.error('Update payment settings error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

const CHILDREN_POLICY_KEY = 'children_policy';

const DEFAULT_CHILDREN_POLICY = {
  freeMaxAge: 5,
  childMaxAge: 11,
  surchargePerNight: 200000
};

// Public: trang đặt phòng cần biết chính sách phụ thu trẻ em
router.get('/children-policy', async (_req, res) => {
  try {
    const saved = await readSetting(CHILDREN_POLICY_KEY);
    res.json({ data: { ...DEFAULT_CHILDREN_POLICY, ...(saved || {}) } });
  } catch (error) {
    console.error('Get children policy error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Admin: cập nhật chính sách phụ thu trẻ em
router.put('/children-policy', requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Chỉ admin được phép thay đổi chính sách phụ thu' });
    }

    const freeMaxAge = Number(req.body?.freeMaxAge);
    const childMaxAge = Number(req.body?.childMaxAge);
    const surchargePerNight = Number(req.body?.surchargePerNight);

    if (!Number.isInteger(freeMaxAge) || freeMaxAge < 0 || freeMaxAge > 17) {
      return res.status(400).json({ message: 'Tuổi miễn phí tối đa phải từ 0-17' });
    }
    if (!Number.isInteger(childMaxAge) || childMaxAge <= freeMaxAge || childMaxAge > 17) {
      return res.status(400).json({ message: 'Tuổi phụ thu tối đa phải lớn hơn tuổi miễn phí và không quá 17' });
    }
    if (!Number.isFinite(surchargePerNight) || surchargePerNight < 0) {
      return res.status(400).json({ message: 'Phụ thu mỗi đêm không hợp lệ' });
    }

    const policy = { freeMaxAge, childMaxAge, surchargePerNight: Math.round(surchargePerNight) };
    await writeSetting(CHILDREN_POLICY_KEY, policy);
    res.json({ data: policy, message: 'Đã lưu chính sách phụ thu trẻ em' });
  } catch (error) {
    console.error('Update children policy error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Thêm vào cuối file, trước module.exports

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
const normalizeTime = (value, fallback) => {
  if (!TIME_REGEX.test(String(value || ''))) return fallback;
  return String(value).length === 5 ? `${value}:00` : String(value);
};

// Public: trang đặt phòng / trang chi tiết cần hiển thị giờ nhận-trả phòng
// và chính sách hoàn tiền khi hủy. Gộp từ 2 bảng: checkout_late_fee_tiers
// (nguồn "sống" cho giờ chuẩn, được checkOut()/checkIn() dùng để tính phí
// trễ giờ) và cancellation_policies (nguồn cho % hoàn tiền khi hủy).
router.get('/policies', async (_req, res) => {
  try {
    const [[cancellation]] = await db.query('SELECT * FROM cancellation_policies WHERE id = 1');
    const [[tiers]] = await db.query('SELECT * FROM checkout_late_fee_tiers WHERE id = 1');

    res.json({
      data: {
        checkInTime: tiers?.standardCheckInTime || cancellation?.standardCheckInTime || '14:00:00',
        checkOutTime: tiers?.standardCheckOutTime || cancellation?.standardCheckOutTime || '12:00:00',
        nearTierMaxDays: cancellation?.nearTierMaxDays ?? 3,
        nearTierPercent: Number(cancellation?.nearTierPercent ?? 100),
        midTierMaxDays: cancellation?.midTierMaxDays ?? 7,
        midTierPercent: Number(cancellation?.midTierPercent ?? 50),
        farTierPercent: Number(cancellation?.farTierPercent ?? 0)
      }
    });
  } catch (error) {
    console.error('Get policies error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});


router.put('/policies', requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Chỉ admin được phép thay đổi chính sách' });
    }

    const {
      checkInTime,
      checkOutTime,
      nearTierMaxDays,
      nearTierPercent,
      midTierMaxDays,
      midTierPercent,
      farTierPercent
    } = req.body || {};

    const normalizedCheckIn = normalizeTime(checkInTime, '14:00:00');
    const normalizedCheckOut = normalizeTime(checkOutTime, '12:00:00');

    const near = Number(nearTierMaxDays);
    const mid = Number(midTierMaxDays);
    const nearPct = Number(nearTierPercent);
    const midPct = Number(midTierPercent);
    const farPct = Number(farTierPercent);

    if (!Number.isInteger(near) || near < 0) {
      return res.status(400).json({ message: 'Số ngày mốc gần không hợp lệ' });
    }
    if (!Number.isInteger(mid) || mid <= near) {
      return res.status(400).json({ message: 'Số ngày mốc xa phải lớn hơn mốc gần' });
    }
    for (const [label, pct] of [['nearTierPercent', nearPct], ['midTierPercent', midPct], ['farTierPercent', farPct]]) {
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ message: `${label} phải từ 0-100` });
      }
    }

    await db.query(
      `UPDATE cancellation_policies
       SET nearTierMaxDays = ?, nearTierPercent = ?, midTierMaxDays = ?, midTierPercent = ?,
           farTierPercent = ?, standardCheckInTime = ?, standardCheckOutTime = ?
       WHERE id = 1`,
      [near, nearPct, mid, midPct, farPct, normalizedCheckIn, normalizedCheckOut]
    );
    await db.query(
      `UPDATE checkout_late_fee_tiers
       SET standardCheckInTime = ?, standardCheckOutTime = ?
       WHERE id = 1`,
      [normalizedCheckIn, normalizedCheckOut]
    );

    res.json({
      data: {
        checkInTime: normalizedCheckIn,
        checkOutTime: normalizedCheckOut,
        nearTierMaxDays: near,
        nearTierPercent: nearPct,
        midTierMaxDays: mid,
        midTierPercent: midPct,
        farTierPercent: farPct
      },
      message: 'Đã lưu chính sách hủy phòng và giờ nhận/trả phòng'
    });
  } catch (error) {
    console.error('Update policies error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

module.exports = router;

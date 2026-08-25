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

    const earlyTier1Hours = Number(tiers?.earlyTier1Hours ?? 8.0);
    const earlyTier1Percent = Number(tiers?.earlyTier1Percent ?? 100.0);
    const earlyTier2Hours = Number(tiers?.earlyTier2Hours ?? 5.0);
    const earlyTier2Percent = Number(tiers?.earlyTier2Percent ?? 50.0);
    const earlyTier3Hours = Number(tiers?.earlyTier3Hours ?? 2.0);
    const earlyTier3Percent = Number(tiers?.earlyTier3Percent ?? 30.0);

    res.json({
      data: {
        checkInTime: tiers?.standardCheckInTime || cancellation?.standardCheckInTime || '14:00:00',
        checkOutTime: tiers?.standardCheckOutTime || cancellation?.standardCheckOutTime || '12:00:00',
        nearTierMaxDays: cancellation?.nearTierMaxDays ?? 3,
        nearTierPercent: Number(cancellation?.nearTierPercent ?? 100),
        midTierMaxDays: cancellation?.midTierMaxDays ?? 7,
        midTierPercent: Number(cancellation?.midTierPercent ?? 50),
        farTierPercent: Number(cancellation?.farTierPercent ?? 0),
        earlyTier1Hours,
        earlyTier1Percent,
        earlyTier2Hours,
        earlyTier2Percent,
        earlyTier3Hours,
        earlyTier3Percent,
        earlyCheckInPolicy: {
          tier1Hours: earlyTier1Hours,
          tier1Percent: earlyTier1Percent,
          tier2Hours: earlyTier2Hours,
          tier2Percent: earlyTier2Percent,
          tier3Hours: earlyTier3Hours,
          tier3Percent: earlyTier3Percent
        }
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

// GET /api/settings/late-checkout-tiers
router.get('/late-checkout-tiers', async (_req, res) => {
  try {
    const [[tiers]] = await db.query('SELECT * FROM checkout_late_fee_tiers WHERE id = 1');
    res.json({
      data: tiers || {
        id: 1,
        graceMinutes: 60,
        tier1MaxHours: 3.0,
        tier1Percent: 30.0,
        tier2MaxHours: 6.0,
        tier2Percent: 50.0,
        tier3Percent: 100.0,
        standardCheckOutTime: '12:00:00',
        standardCheckInTime: '14:00:00',
        housekeepingBufferMinutes: 60,
        absoluteMaxLateHours: 6.0,
        earlyTier1Hours: 8.0,
        earlyTier1Percent: 100.0,
        earlyTier2Hours: 5.0,
        earlyTier2Percent: 50.0,
        earlyTier3Hours: 2.0,
        earlyTier3Percent: 30.0
      }
    });
  } catch (error) {
    console.error('Get late checkout tiers error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// PUT /api/settings/late-checkout-tiers (Admin)
router.put('/late-checkout-tiers', requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Chỉ admin được phép thay đổi cấu hình phí trễ giờ' });
    }

    const {
      graceMinutes,
      tier1MaxHours,
      tier1Percent,
      tier2MaxHours,
      tier2Percent,
      tier3Percent,
      standardCheckInTime,
      standardCheckOutTime,
      housekeepingBufferMinutes,
      absoluteMaxLateHours,
      earlyTier1Hours,
      earlyTier1Percent,
      earlyTier2Hours,
      earlyTier2Percent,
      earlyTier3Hours,
      earlyTier3Percent
    } = req.body || {};

    const normalizedCheckIn = normalizeTime(standardCheckInTime, '14:00:00');
    const normalizedCheckOut = normalizeTime(standardCheckOutTime, '12:00:00');

    const grace = Number(graceMinutes ?? 60);
    const t1Max = Number(tier1MaxHours ?? 3.0);
    const t1Pct = Number(tier1Percent ?? 30.0);
    const t2Max = Number(tier2MaxHours ?? 6.0);
    const t2Pct = Number(tier2Percent ?? 50.0);
    const t3Pct = Number(tier3Percent ?? 100.0);
    const hkBuffer = Number(housekeepingBufferMinutes ?? 60);
    const absMax = Number(absoluteMaxLateHours ?? 6.0);

    const e1Hours = Number(earlyTier1Hours ?? 8.0);
    const e1Pct = Number(earlyTier1Percent ?? 100.0);
    const e2Hours = Number(earlyTier2Hours ?? 5.0);
    const e2Pct = Number(earlyTier2Percent ?? 50.0);
    const e3Hours = Number(earlyTier3Hours ?? 2.0);
    const e3Pct = Number(earlyTier3Percent ?? 30.0);

    if (!Number.isFinite(e1Hours) || !Number.isFinite(e2Hours) || !Number.isFinite(e3Hours)) {
      return res.status(400).json({ message: 'Số giờ các mốc nhận phòng sớm phải là số hợp lệ' });
    }
    if (e3Hours <= 0 || e2Hours <= e3Hours || e1Hours <= e2Hours) {
      return res.status(400).json({ message: 'Các mốc giờ nhận phòng sớm phải giảm dần và lớn hơn 0 (Mức 1 > Mức 2 > Mức 3 > 0)' });
    }
    for (const [label, pct] of [['Mức 1', e1Pct], ['Mức 2', e2Pct], ['Mức 3', e3Pct]]) {
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ message: `Phụ thu nhận phòng sớm ${label} phải từ 0% đến 100%` });
      }
    }

    await db.query(
      `INSERT INTO checkout_late_fee_tiers
         (id, graceMinutes, tier1MaxHours, tier1Percent, tier2MaxHours, tier2Percent, tier3Percent,
          standardCheckOutTime, standardCheckInTime, housekeepingBufferMinutes, absoluteMaxLateHours,
          earlyTier1Hours, earlyTier1Percent, earlyTier2Hours, earlyTier2Percent, earlyTier3Hours, earlyTier3Percent)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         graceMinutes = VALUES(graceMinutes),
         tier1MaxHours = VALUES(tier1MaxHours),
         tier1Percent = VALUES(tier1Percent),
         tier2MaxHours = VALUES(tier2MaxHours),
         tier2Percent = VALUES(tier2Percent),
         tier3Percent = VALUES(tier3Percent),
         standardCheckOutTime = VALUES(standardCheckOutTime),
         standardCheckInTime = VALUES(standardCheckInTime),
         housekeepingBufferMinutes = VALUES(housekeepingBufferMinutes),
         absoluteMaxLateHours = VALUES(absoluteMaxLateHours),
         earlyTier1Hours = VALUES(earlyTier1Hours),
         earlyTier1Percent = VALUES(earlyTier1Percent),
         earlyTier2Hours = VALUES(earlyTier2Hours),
         earlyTier2Percent = VALUES(earlyTier2Percent),
         earlyTier3Hours = VALUES(earlyTier3Hours),
         earlyTier3Percent = VALUES(earlyTier3Percent)`,
      [
        grace, t1Max, t1Pct, t2Max, t2Pct, t3Pct,
        normalizedCheckOut, normalizedCheckIn, hkBuffer, absMax,
        e1Hours, e1Pct, e2Hours, e2Pct, e3Hours, e3Pct
      ]
    );

    // Đồng bộ lại giờ chuẩn vào bảng cancellation_policies
    await db.query(
      `UPDATE cancellation_policies
       SET standardCheckInTime = ?, standardCheckOutTime = ?
       WHERE id = 1`,
      [normalizedCheckIn, normalizedCheckOut]
    );

    res.json({
      data: {
        graceMinutes: grace,
        tier1MaxHours: t1Max,
        tier1Percent: t1Pct,
        tier2MaxHours: t2Max,
        tier2Percent: t2Pct,
        tier3Percent: t3Pct,
        standardCheckInTime: normalizedCheckIn,
        standardCheckOutTime: normalizedCheckOut,
        housekeepingBufferMinutes: hkBuffer,
        absoluteMaxLateHours: absMax,
        earlyTier1Hours: e1Hours,
        earlyTier1Percent: e1Pct,
        earlyTier2Hours: e2Hours,
        earlyTier2Percent: e2Pct,
        earlyTier3Hours: e3Hours,
        earlyTier3Percent: e3Pct,
        earlyCheckInPolicy: {
          tier1Hours: e1Hours,
          tier1Percent: e1Pct,
          tier2Hours: e2Hours,
          tier2Percent: e2Pct,
          tier3Hours: e3Hours,
          tier3Percent: e3Pct
        }
      },
      message: 'Đã lưu cấu hình phí trễ giờ, nhận phòng sớm và giờ chuẩn'
    });
  } catch (error) {
    console.error('Update late checkout tiers error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

module.exports = router;


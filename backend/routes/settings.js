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
    res.status(500).json({ message: 'Internal server error' });
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
    res.status(500).json({ message: 'Internal server error' });
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
    res.status(500).json({ message: 'Internal server error' });
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
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

const crypto = require('crypto');
const HttpError = require('../utils/httpError');

const VNPAY_URL = process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const ZALOPAY_URL = process.env.ZALOPAY_URL || 'https://sb-openapi.zalopay.vn/v2/create';
const ZALOPAY_QUERY_URL = process.env.ZALOPAY_QUERY_URL || 'https://sb-openapi.zalopay.vn/v2/query';
const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

const hmac = (algorithm, secret, value) => crypto.createHmac(algorithm, secret).update(value, 'utf8').digest('hex');

// VNPay signs the *encoded* parameters in alphabetical order. Do not use a
// generic URL builder here: its escaping rules can differ from the gateway's
// reference implementation (notably for spaces), which results in its generic
// Transaction/Error.html page.
const vnpayQueryString = (params) => Object.keys(params)
  .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
  .sort()
  .map((key) => {
    const encodedKey = encodeURIComponent(key);
    const encodedValue = encodeURIComponent(String(params[key])).replace(/%20/g, '+');
    return `${encodedKey}=${encodedValue}`;
  })
  .join('&');

// Express returns ::1 when the frontend is running locally over IPv6, whereas
// VNPay expects an IPv4 address in vnp_IpAddr.
const normalizeVnpayIp = (ipAddress) => {
  const ip = String(ipAddress || '').split(',')[0].trim().replace(/^::ffff:/, '');
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip) ? ip : '127.0.0.1';
};
const requireEnv = (keys, provider) => {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length) throw new HttpError(503, `${provider} Sandbox thiếu cấu hình: ${missing.join(', ')}`);
};

const createVnpayUrl = ({ orderId, amount, orderInfo, ipAddress, expiresAt }) => {
  requireEnv(['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET'], 'VNPay');
  const stamp = (date) => date.toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }).replace(/[-: ]/g, '').slice(0, 14);
  const params = {
    vnp_Amount: Math.round(amount * 100), vnp_Command: 'pay', vnp_CreateDate: stamp(new Date()),
    vnp_CurrCode: 'VND', vnp_ExpireDate: stamp(new Date(expiresAt)),
    vnp_IpAddr: normalizeVnpayIp(ipAddress), vnp_Locale: 'vn', vnp_OrderInfo: orderInfo,
    vnp_OrderType: 'other', vnp_ReturnUrl: `${API_BASE_URL}/api/payments/gateway/vnpay/return`,
    vnp_TmnCode: process.env.VNPAY_TMN_CODE, vnp_TxnRef: orderId, vnp_Version: '2.1.0'
  };
  const query = vnpayQueryString(params);
  return `${VNPAY_URL}?${query}&vnp_SecureHash=${hmac('sha512', process.env.VNPAY_HASH_SECRET, query)}`;
};

const verifyVnpay = (query) => {
  requireEnv(['VNPAY_HASH_SECRET'], 'VNPay');
  const { vnp_SecureHash: signature, vnp_SecureHashType: _ignored, ...params } = query;
  if (!signature) return false;
  const expected = hmac('sha512', process.env.VNPAY_HASH_SECRET, vnpayQueryString(params)).toLowerCase();
  const received = String(signature).trim().toLowerCase();
  return expected.length === received.length
    && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
};

const createZalopayPayment = async ({ orderId, bookingId, amount, orderInfo, expiresAt }) => {
  requireEnv(['ZALOPAY_APP_ID', 'ZALOPAY_KEY1'], 'ZaloPay');
  const appId = Number(process.env.ZALOPAY_APP_ID);
  if (!Number.isInteger(appId) || appId <= 0) {
    throw new HttpError(503, 'ZALOPAY_APP_ID phải là AppID Sandbox hợp lệ');
  }
  // App 554 is the public credential of ZaloPay's legacy v1 documentation and
  // cannot open an order on the current v2 QC Gateway. Keep local development
  // usable through the project's simulator. Real Merchant v2 credentials
  // continue through the official API below.
  if (appId === 554) {
    return `${FRONTEND_URL}/booking/${bookingId}/payment/sandbox?method=zalopay&amount=${encodeURIComponent(Math.round(amount))}&txn=${encodeURIComponent(orderId)}`;
  }
  const appTime = Date.now();
  const expireDurationSeconds = Math.floor((new Date(expiresAt).getTime() - appTime) / 1000);
  if (expireDurationSeconds < 300) {
    throw new HttpError(409, 'ZaloPay yêu cầu còn ít nhất 5 phút để tạo giao dịch');
  }
  const appUser = process.env.ZALOPAY_APP_USER || 'HotelBooking';
  const embedData = JSON.stringify({
    preferred_payment_method: ['zalopay_wallet'],
    redirecturl: `${API_BASE_URL}/api/payments/gateway/zalopay/return`
  });
  const item = '[]';
  const roundedAmount = Math.round(amount);
  const macInput = [
    appId,
    orderId,
    appUser,
    roundedAmount,
    appTime,
    embedData,
    item
  ].join('|');
  const body = {
    app_id: appId,
    app_user: appUser,
    app_trans_id: orderId,
    app_time: appTime,
    expire_duration_seconds: expireDurationSeconds,
    amount: roundedAmount,
    description: orderInfo,
    callback_url: `${API_BASE_URL}/api/payments/gateway/zalopay/callback`,
    item,
    embed_data: embedData,
    bank_code: '',
    mac: hmac('sha256', process.env.ZALOPAY_KEY1, macInput)
  };
  const response = await fetch(ZALOPAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok || Number(data.return_code) !== 1 || !data.order_url) {
    throw new HttpError(502, data.return_message || 'Không thể tạo thanh toán ZaloPay Sandbox');
  }
  return data.order_url;
};

const verifyZalopayCallback = (payload) => {
  requireEnv(['ZALOPAY_KEY2'], 'ZaloPay');
  if (!payload?.data || !payload?.mac) return false;
  const expected = hmac('sha256', process.env.ZALOPAY_KEY2, payload.data);
  const received = String(payload.mac).trim().toLowerCase();
  return expected.length === received.length
    && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
};

const queryZalopayOrder = async (orderId) => {
  requireEnv(['ZALOPAY_APP_ID', 'ZALOPAY_KEY1'], 'ZaloPay');
  const appId = Number(process.env.ZALOPAY_APP_ID);
  const macInput = `${appId}|${orderId}|${process.env.ZALOPAY_KEY1}`;
  const response = await fetch(ZALOPAY_QUERY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      app_id: appId,
      app_trans_id: orderId,
      mac: hmac('sha256', process.env.ZALOPAY_KEY1, macInput)
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new HttpError(502, data.return_message || 'Không thể truy vấn trạng thái ZaloPay');
  }
  return data;
};

module.exports = {
  createVnpayUrl,
  verifyVnpay,
  createZalopayPayment,
  verifyZalopayCallback,
  queryZalopayOrder,
  FRONTEND_URL
};

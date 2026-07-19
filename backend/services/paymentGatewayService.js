const crypto = require('crypto');
const HttpError = require('../utils/httpError');

const VNPAY_URL = process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const MOMO_URL = process.env.MOMO_URL || 'https://test-payment.momo.vn/v2/gateway/api/create';
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

const createVnpayUrl = ({ orderId, amount, orderInfo, ipAddress }) => {
  requireEnv(['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET'], 'VNPay');
  const stamp = (date) => date.toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }).replace(/[-: ]/g, '').slice(0, 14);
  const params = {
    vnp_Amount: Math.round(amount * 100), vnp_Command: 'pay', vnp_CreateDate: stamp(new Date()),
    vnp_CurrCode: 'VND', vnp_ExpireDate: stamp(new Date(Date.now() + 15 * 60 * 1000)),
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
  const expected = hmac('sha512', process.env.VNPAY_HASH_SECRET, vnpayQueryString(params));
  return expected.length === String(signature).length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
};

const createMomoPayment = async ({ orderId, bookingId, amount, orderInfo }) => {
  requireEnv(['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY'], 'MoMo');
  const requestId = `${orderId}-${Date.now()}`;
  const redirectUrl = `${FRONTEND_URL}/booking/${bookingId}?gateway=momo`;
  const ipnUrl = `${API_BASE_URL}/api/payments/gateway/momo/ipn`;
  const requestType = 'payWithMethod';
  const raw = `accessKey=${process.env.MOMO_ACCESS_KEY}&amount=${Math.round(amount)}&extraData=&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${process.env.MOMO_PARTNER_CODE}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
  const body = { partnerCode: process.env.MOMO_PARTNER_CODE, partnerName: process.env.MOMO_PARTNER_NAME || 'Hotel Booking', storeId: process.env.MOMO_STORE_ID || 'HotelBooking', requestId, amount: String(Math.round(amount)), orderId, orderInfo, redirectUrl, ipnUrl, lang: 'vi', requestType, autoCapture: true, extraData: '', signature: hmac('sha256', process.env.MOMO_SECRET_KEY, raw) };
  const response = await fetch(MOMO_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok || data.resultCode !== 0 || !data.payUrl) throw new HttpError(502, data.message || 'Không thể tạo thanh toán MoMo Sandbox');
  return data.payUrl;
};

const verifyMomo = (payload) => {
  requireEnv(['MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY'], 'MoMo');
  const raw = `accessKey=${process.env.MOMO_ACCESS_KEY}&amount=${payload.amount}&extraData=${payload.extraData || ''}&message=${payload.message}&orderId=${payload.orderId}&orderInfo=${payload.orderInfo}&orderType=${payload.orderType}&partnerCode=${payload.partnerCode}&payType=${payload.payType}&requestId=${payload.requestId}&responseTime=${payload.responseTime}&resultCode=${payload.resultCode}&transId=${payload.transId}`;
  const expected = hmac('sha256', process.env.MOMO_SECRET_KEY, raw);
  return payload.signature && expected.length === String(payload.signature).length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(payload.signature)));
};

module.exports = { createVnpayUrl, verifyVnpay, createMomoPayment, verifyMomo, FRONTEND_URL };

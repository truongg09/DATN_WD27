/**
 * Giới hạn tần suất gọi API (chống dò mật khẩu, spam đặt phòng, spam email...).
 *
 * Dùng bộ nhớ tiến trình chứ không cài thêm gói: backend chạy một tiến trình
 * duy nhất nên một Map là đủ. Nếu sau này chạy nhiều tiến trình (pm2 cluster)
 * thì phải chuyển sang Redis, vì mỗi tiến trình sẽ có bộ đếm riêng.
 *
 * Thuật toán là cửa sổ trượt: giữ lại mốc thời gian của các lần gọi còn nằm
 * trong cửa sổ, vượt ngưỡng thì trả 429.
 */

const buckets = new Map();

// Dọn định kỳ để bộ nhớ không phình theo số IP đã từng gọi.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now - entry.lastSeen > CLEANUP_INTERVAL_MS) {
      buckets.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);
// Đừng giữ tiến trình sống chỉ vì bộ đếm này.
if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

/**
 * @param {object} options
 * @param {number} options.windowMs  Độ dài cửa sổ, tính bằng mili giây
 * @param {number} options.max       Số lần gọi tối đa trong cửa sổ
 * @param {function} [options.keyBy] Cách nhóm: mặc định theo IP
 * @param {string} [options.message] Thông báo trả về khi bị chặn
 * @param {string} [options.scope]   Gộp nhiều route vào chung một hạn mức
 */
const rateLimit = ({ windowMs, max, keyBy, message, scope }) => (req, res, next) => {
  const who = keyBy ? keyBy(req) : clientIp(req);
  const key = `${scope || req.baseUrl + req.path}|${who}`;
  const now = Date.now();

  const entry = buckets.get(key) || { hits: [], lastSeen: now };
  entry.hits = entry.hits.filter((t) => now - t < windowMs);

  if (entry.hits.length >= max) {
    entry.lastSeen = now;
    buckets.set(key, entry);
    const retryAfterSec = Math.ceil((windowMs - (now - entry.hits[0])) / 1000);
    res.set('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      message: message || 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.',
      retryAfterSeconds: retryAfterSec
    });
  }

  entry.hits.push(now);
  entry.lastSeen = now;
  buckets.set(key, entry);
  return next();
};

// Khóa theo tài khoản đang đăng nhập, không theo IP: nhiều người dùng chung
// một mạng (ký túc xá, văn phòng) thì không làm nhau bị chặn oan.
const byUser = (req) => `user:${req.user?.userId || clientIp(req)}`;

// Khóa theo email được gửi lên KÈM IP: chặn được cả kiểu dò một tài khoản từ
// nhiều IP lẫn kiểu dò nhiều tài khoản từ một IP.
const byEmailAndIp = (req) =>
  `${String(req.body?.email || '').trim().toLowerCase()}|${clientIp(req)}`;

module.exports = { rateLimit, byUser, byEmailAndIp, clientIp };

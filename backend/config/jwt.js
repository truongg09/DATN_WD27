const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Trước đây secret được hardcode trong mã nguồn ('your-secret-key-change-this-...')
// nên bất kỳ ai đọc repo cũng tự ký được token role='admin'. Nay secret lấy từ
// biến môi trường; nếu chưa có thì sinh ngẫu nhiên một lần và lưu vào
// backend/.jwt-secret (đã bị .gitignore bỏ qua) để môi trường dev vẫn chạy được
// mà không dùng chung một chuỗi công khai.
const SECRET_FILE = path.join(__dirname, '..', '.jwt-secret');

const loadOrCreateSecret = () => {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 32) {
    return fromEnv;
  }

  if (fromEnv) {
    console.warn('JWT_SECRET quá ngắn (cần >= 32 ký tự), hệ thống sẽ dùng secret sinh tự động.');
  }

  try {
    if (fs.existsSync(SECRET_FILE)) {
      const saved = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (saved.length >= 32) {
        return saved;
      }
    }
  } catch (error) {
    console.warn('Không đọc được file secret:', error.message);
  }

  const generated = crypto.randomBytes(48).toString('hex');
  try {
    fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
    console.warn(
      'Chưa cấu hình JWT_SECRET. Đã sinh secret ngẫu nhiên và lưu tại backend/.jwt-secret. ' +
        'Khi triển khai thật, hãy đặt JWT_SECRET trong file .env.'
    );
  } catch (error) {
    console.warn('Không ghi được file secret, secret chỉ tồn tại trong bộ nhớ:', error.message);
  }
  return generated;
};

const JWT_SECRET = loadOrCreateSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

module.exports = { JWT_SECRET, JWT_EXPIRES_IN };

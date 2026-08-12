const bcrypt = require('bcrypt');
const db = require('./config/db');

async function run() {
  try {
    console.log('Đang đọc các tài khoản từ database...');
    const [accounts] = await db.query('SELECT id, email, password FROM accounts');
    
    for (const account of accounts) {
      const isHashed = account.password && account.password.startsWith('$2b$');
      if (!isHashed) {
        console.log(`Đang băm mật khẩu cho tài khoản: ${account.email}`);
        const hashedPassword = await bcrypt.hash(account.password || '123456', 10);
        await db.query('UPDATE accounts SET password = ? WHERE id = ?', [hashedPassword, account.id]);
        console.log(`Đã cập nhật tài khoản: ${account.email}`);
      }
    }
    console.log('Hoàn thành cập nhật mật khẩu cho tất cả tài khoản!');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi cập nhật mật khẩu:', error);
    process.exit(1);
  }
}

run();

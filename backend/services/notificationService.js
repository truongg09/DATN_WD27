const db = require('../config/db');

const run = (connection) => connection || db;

/**
 * Tạo thông báo cho toàn bộ khách hàng (customer) hợp lệ / active.
 * KHÔNG gửi cho admin / staff.
 * Tránh duplicate nếu cùng referenceType và referenceId đã được gửi trước đó.
 */
const createNotificationForCustomers = async ({
  type = 'voucher',
  title,
  content,
  referenceType = 'voucher',
  referenceId
}, connection) => {
  const conn = run(connection);

  // Lấy tất cả tài khoản role 'customer' đang active
  const [customers] = await conn.query(
    "SELECT id FROM accounts WHERE role = 'customer' AND status = 'active'"
  );

  if (!customers || customers.length === 0) return 0;

  // Lấy danh sách accountId đã nhận notification này rồi (nếu có) để không gửi trùng lặp
  let existingAccountIds = new Set();
  if (referenceType && referenceId) {
    const [existing] = await conn.query(
      'SELECT accountId FROM notifications WHERE referenceType = ? AND referenceId = ? AND type = ?',
      [referenceType, referenceId, type]
    );
    existing.forEach((r) => existingAccountIds.add(r.accountId));
  }

  const eligibleCustomers = customers.filter((c) => !existingAccountIds.has(c.id));
  if (eligibleCustomers.length === 0) return 0;

  const values = eligibleCustomers.map((c) => [
    c.id,
    type,
    title,
    content,
    referenceType || null,
    referenceId || null,
    0,
    new Date()
  ]);

  await conn.query(
    `INSERT INTO notifications (accountId, type, title, content, referenceType, referenceId, isRead, createdAt)
     VALUES ?`,
    [values]
  );

  return eligibleCustomers.length;
};

/**
 * Lấy danh sách thông báo của tài khoản đang đăng nhập
 */
const getUserNotifications = async (accountId, { limit = 20, offset = 0 } = {}) => {
  const [rows] = await db.query(
    `SELECT id, accountId, type, title, content, referenceType, referenceId, isRead, createdAt
     FROM notifications
     WHERE accountId = ?
     ORDER BY createdAt DESC, id DESC
     LIMIT ? OFFSET ?`,
    [accountId, Number(limit), Number(offset)]
  );

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS unreadCount
     FROM notifications
     WHERE accountId = ? AND isRead = 0`,
    [accountId]
  );

  return {
    data: rows,
    unreadCount: Number(countRows[0]?.unreadCount || 0)
  };
};

/**
 * Đánh dấu 1 thông báo là đã đọc (bảo mật: kiểm tra đúng accountId của user)
 */
const markNotificationAsRead = async (notificationId, accountId) => {
  const [rows] = await db.query(
    'SELECT id, accountId FROM notifications WHERE id = ?',
    [notificationId]
  );

  if (rows.length === 0) {
    return { notFound: true };
  }

  if (Number(rows[0].accountId) !== Number(accountId)) {
    return { forbidden: true };
  }

  await db.query(
    'UPDATE notifications SET isRead = 1 WHERE id = ? AND accountId = ?',
    [notificationId, accountId]
  );

  return { success: true };
};

/**
 * Đánh dấu toàn bộ thông báo của user là đã đọc
 */
const markAllNotificationsAsRead = async (accountId) => {
  const [result] = await db.query(
    'UPDATE notifications SET isRead = 1 WHERE accountId = ? AND isRead = 0',
    [accountId]
  );
  return { affectedRows: result.affectedRows };
};

module.exports = {
  createNotificationForCustomers,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
};

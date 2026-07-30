const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

// Danh sách vai trò nhân sự dùng chung cho toàn hệ thống. Trước đây mỗi file
// tự khai báo một danh sách khác nhau ('admin','staff' ở refunds/dashboard vs
// 'admin','employee','staff' ở payments) nên nhân viên thật (role='employee')
// bị chặn ở một số màn hình.
const STAFF_ROLES = ['admin', 'employee', 'staff'];

const optionalAuth = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next();
  }

  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
  } catch (_error) {
    req.user = null;
  }

  return next();
};

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục' });
  }

  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    return next();
  } catch (_error) {
    return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
  }
};

const isStaff = (user) => STAFF_ROLES.includes(user?.role);

const requireStaff = (req, res, next) => {
  if (!isStaff(req.user)) {
    return res.status(403).json({ message: 'Chỉ nhân viên hoặc quản trị viên được thực hiện thao tác này' });
  }
  return next();
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Chỉ quản trị viên được thực hiện thao tác này' });
  }
  return next();
};

module.exports = {
  STAFF_ROLES,
  isStaff,
  optionalAuth,
  requireAuth,
  requireStaff,
  requireAdmin
};

const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { requireAuth, requireStaff, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Quản lý nhân viên dựa thẳng trên bảng accounts.
//
// Bản cũ đọc ghi bảng `employees`, nhưng bảng đó bị DROP ngay lúc khởi động
// (xem ensure-operational-schema.js) vì nhân viên đã được quản lý bằng
// accounts.role. Router lại chưa từng được mount nên cả mảng này là code chết:
// gọi vào chỉ nhận 404, còn nếu mount lên thì mọi truy vấn đều lỗi vì bảng
// không tồn tại. Viết lại theo đúng mô hình đang dùng.
//
// accounts đã có sẵn full_name, phone, role, status nên không cần thêm bảng phụ.
// `position` suy ra từ role để giao diện cũ vẫn hiển thị được cột Chức vụ.

const STAFF_ROLES_SQL = "('admin', 'staff', 'employee')";

const POSITION_BY_ROLE = {
  admin: 'Quản trị viên',
  staff: 'Nhân viên',
  employee: 'Nhân viên'
};

const EMPLOYEE_SELECT = `
  SELECT
    a.id,
    a.id AS accountId,
    COALESCE(a.full_name, '') AS fullName,
    a.email,
    COALESCE(a.phone, '') AS phone,
    a.role,
    a.status,
    a.created_at
  FROM accounts a
  WHERE a.role IN ${STAFF_ROLES_SQL}
`;

const formatEmployee = (row) => ({
  ...row,
  position: POSITION_BY_ROLE[row.role] || row.role
});

// Chỉ nhận hai vai trò này khi tạo hoặc sửa, tránh việc vô tình nâng một tài
// khoản khách lên quyền quản trị qua màn hình nhân viên.
const normalizeRole = (value) => (value === 'admin' ? 'admin' : 'staff');

router.get('/', requireAuth, requireStaff, async (_req, res) => {
  try {
    const [rows] = await db.query(`${EMPLOYEE_SELECT} ORDER BY a.id ASC`);
    res.json({ data: rows.map(formatEmployee) });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

router.get('/:id', requireAuth, requireStaff, async (req, res) => {
  try {
    const [rows] = await db.query(`${EMPLOYEE_SELECT} AND a.id = ?`, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }
    res.json({ data: formatEmployee(rows[0]) });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { fullName, email, phone, password, role } = req.body;

    if (!email || !password || !String(fullName || '').trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập họ tên, email và mật khẩu' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    const [existing] = await db.query('SELECT id FROM accounts WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email đã tồn tại' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const [result] = await db.query(
      `INSERT INTO accounts (full_name, email, phone, password, role, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [String(fullName).trim(), email, phone || null, hashedPassword, normalizeRole(role)]
    );

    const [rows] = await db.query(`${EMPLOYEE_SELECT} AND a.id = ?`, [result.insertId]);
    res.status(201).json({
      message: 'Thêm nhân viên thành công',
      data: formatEmployee(rows[0])
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { fullName, email, phone, password, role, status } = req.body;
    const employeeId = req.params.id;

    const [existing] = await db.query(
      `SELECT id, role FROM accounts WHERE id = ? AND role IN ${STAFF_ROLES_SQL}`,
      [employeeId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }

    if (email) {
      const [duplicate] = await db.query(
        'SELECT id FROM accounts WHERE email = ? AND id <> ?',
        [email, employeeId]
      );
      if (duplicate.length > 0) {
        return res.status(400).json({ message: 'Email đã được tài khoản khác sử dụng' });
      }
    }

    // Không cho quản trị viên tự hạ quyền chính mình, nếu không sẽ mất lối vào
    // khu quản trị mà không có cách khôi phục từ giao diện.
    const nextRole = role ? normalizeRole(role) : existing[0].role;
    if (Number(employeeId) === Number(req.user.userId) && nextRole !== existing[0].role) {
      return res.status(400).json({ message: 'Không thể tự thay đổi quyền của chính mình' });
    }

    const fields = [];
    const values = [];
    if (fullName !== undefined) {
      fields.push('full_name = ?');
      values.push(String(fullName).trim());
    }
    if (email !== undefined) {
      fields.push('email = ?');
      values.push(email);
    }
    if (phone !== undefined) {
      fields.push('phone = ?');
      values.push(phone || null);
    }
    if (role !== undefined) {
      fields.push('role = ?');
      values.push(nextRole);
    }
    if (status !== undefined) {
      fields.push('status = ?');
      values.push(status === 'locked' ? 'locked' : 'active');
    }
    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
      }
      fields.push('password = ?');
      values.push(await bcrypt.hash(String(password), 10));
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Không có thông tin nào để cập nhật' });
    }

    values.push(employeeId);
    await db.query(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`, values);

    const [rows] = await db.query(`${EMPLOYEE_SELECT} AND a.id = ?`, [employeeId]);
    res.json({ message: 'Cập nhật nhân viên thành công', data: formatEmployee(rows[0]) });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const employeeId = req.params.id;

    if (Number(employeeId) === Number(req.user.userId)) {
      return res.status(400).json({ message: 'Không thể xóa tài khoản của chính mình' });
    }

    const [existing] = await db.query(
      `SELECT id, role FROM accounts WHERE id = ? AND role IN ${STAFF_ROLES_SQL}`,
      [employeeId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }

    // Giữ lại ít nhất một quản trị viên để hệ thống không bao giờ rơi vào cảnh
    // không ai vào được khu quản trị.
    if (existing[0].role === 'admin') {
      const [[{ total }]] = await db.query(
        "SELECT COUNT(*) AS total FROM accounts WHERE role = 'admin' AND status = 'active'"
      );
      if (total <= 1) {
        return res.status(400).json({ message: 'Phải còn ít nhất một quản trị viên hoạt động' });
      }
    }

    // Khóa thay vì xóa hẳn: lịch sử thao tác trong booking_history còn tham chiếu
    // tới tài khoản này, xóa đi là mất dấu vết ai đã làm gì.
    await db.query("UPDATE accounts SET status = 'locked' WHERE id = ?", [employeeId]);
    res.json({ message: 'Đã khóa tài khoản nhân viên' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

module.exports = router;

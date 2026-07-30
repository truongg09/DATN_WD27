const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { requireAuth, requireStaff, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all employees
router.get('/', requireAuth, requireStaff, async (req, res) => {
  try {
    const [employees] = await db.query(`
      SELECT 
        e.*,
        a.email,
        a.status,
        a.created_at
      FROM employees e
      JOIN accounts a ON e.accountId = a.id
    `);
    res.json({ data: employees });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Get employee by id
router.get('/:id', requireAuth, requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const [employees] = await db.query(`
      SELECT 
        e.*,
        a.email,
        a.status,
        a.created_at
      FROM employees e
      JOIN accounts a ON e.accountId = a.id
      WHERE e.id = ?
    `, [id]);
    
    if (employees.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }
    
    res.json({ data: employees[0] });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Create employee
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { fullName, email, phone, password, position, salary, hireDate } = req.body;
    
    // Check if email exists
    const [existingUsers] = await db.query(
      'SELECT id FROM accounts WHERE email = ?',
      [email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Email đã tồn tại' });
    }
    
    if (!email || !password || !String(fullName || '').trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập họ tên, email và mật khẩu' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo tài khoản và hồ sơ nhân viên trong cùng một transaction. Trước đây hai
    // lệnh INSERT chạy rời nhau nên khi lệnh thứ hai lỗi (thiếu trường), tài
    // khoản 'employee' đã tạo vẫn còn lại và đăng nhập được dù không có hồ sơ.
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [accountResult] = await connection.query(`
        INSERT INTO accounts (email, phone, password, role, status)
        VALUES ( ?, ?, ?, 'employee', 'active')
      `, [email, phone || null, hashedPassword]);

      const [employeeResult] = await connection.query(`
        INSERT INTO employees (accountId, fullName, phone, position, salary, hireDate)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        accountResult.insertId,
        fullName || null,
        phone || null,
        position || null,
        salary ?? null,
        hireDate || null
      ]);

      const [createdEmployee] = await connection.query(`
        SELECT
          e.*,
          a.email,
          a.status,
          a.created_at
        FROM employees e
        JOIN accounts a ON e.accountId = a.id
        WHERE e.id = ?
      `, [employeeResult.insertId]);

      await connection.commit();

      res.status(201).json({
        message: 'Thêm nhân viên thành công',
        data: createdEmployee[0]
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Update employee
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, password, status, position, salary, hireDate } = req.body;
    
    // First get the accountId for this employee
    const [empResult] = await db.query(
      'SELECT accountId FROM employees WHERE id = ?',
      [id]
    );
    
    if (empResult.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }
    
    const accountId = empResult[0].accountId;
    
    // Update accounts table first
    const updateAccountFields = [];
    const updateAccountValues = [];

    if (email) {
      updateAccountFields.push('email = ?');
      updateAccountValues.push(email);
    }
    if (phone) {
      updateAccountFields.push('phone = ?');
      updateAccountValues.push(phone);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateAccountFields.push('password = ?');
      updateAccountValues.push(hashedPassword);
    }
    if (status) {
      updateAccountFields.push('status = ?');
      updateAccountValues.push(status);
    }
    
    if (updateAccountFields.length > 0) {
      updateAccountValues.push(accountId);
      await db.query(
        `UPDATE accounts SET ${updateAccountFields.join(', ')} WHERE id = ?`,
        updateAccountValues
      );
    }
    
    // Update employees table
    const updateEmpFields = [];
    const updateEmpValues = [];
    
    if (fullName) {
      updateEmpFields.push('fullName = ?');
      updateEmpValues.push(fullName);
    }
    if (phone) {
      updateEmpFields.push('phone = ?');
      updateEmpValues.push(phone);
    }
    if (position) {
      updateEmpFields.push('position = ?');
      updateEmpValues.push(position);
    }
    if (salary) {
      updateEmpFields.push('salary = ?');
      updateEmpValues.push(salary);
    }
    if (hireDate) {
      updateEmpFields.push('hireDate = ?');
      updateEmpValues.push(hireDate);
    }
    
    if (updateEmpFields.length > 0) {
      updateEmpValues.push(id);
      await db.query(
        `UPDATE employees SET ${updateEmpFields.join(', ')} WHERE id = ?`,
        updateEmpValues
      );
    }
    
    res.json({ message: 'Cập nhật nhân viên thành công' });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Delete employee
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  console.log('=== DELETE /employees/:id hit!');
  console.log('req.params:', req.params);
  try {
    const { id } = req.params;
    
    // Get the accountId first
    const [empResult] = await db.query(
      'SELECT accountId FROM employees WHERE id = ?',
      [id]
    );
    
    if (empResult.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }
    
    const accountId = empResult[0].accountId;
    
    // Delete employee record first
    await db.query('DELETE FROM employees WHERE id = ?', [id]);
    
    // Then delete the account
    await db.query('DELETE FROM accounts WHERE id = ?', [accountId]);
    
    res.json({ message: 'Xóa nhân viên thành công' });
  } catch (error) {
    console.error('Delete employee error details:', error);
    console.error('Error code:', error.code);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ', error: error.message });
  }
});

module.exports = router;

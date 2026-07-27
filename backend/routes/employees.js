const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const router = express.Router();

// Get all employees
router.get('/', async (req, res) => {
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
router.get('/:id', async (req, res) => {
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
router.post('/', async (req, res) => {
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
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // First create the account
    const [accountResult] = await db.query(`
      INSERT INTO accounts (email, phone, password, role, status) 
      VALUES ( ?, ?, ?, 'employee', 'active')
    `, [email, phone, hashedPassword]);
    
    // Then create the employee record linked to the account
    await db.query(`
      INSERT INTO employees (accountId, fullName, phone, position, salary, hireDate) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [accountResult.insertId, fullName, phone, position, salary, hireDate]);
    
    // Get the created employee with all details
    const [createdEmployee] = await db.query(`
      SELECT 
        e.*,
        a.email,
        a.status,
        a.created_at
      FROM employees e
      JOIN accounts a ON e.accountId = a.id
      WHERE e.id = LAST_INSERT_ID()
    `);
    
    res.status(201).json({
      message: 'Thêm nhân viên thành công',
      data: createdEmployee[0]
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Update employee
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
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

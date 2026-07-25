const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function addSampleEmployees() {
  let connection;
  try {
    console.log('=== Connecting to database...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    console.log('✅ Connected to database');

    // Sample employees data
    const employees = [
      {
        fullName: 'Nguyễn Văn A',
        email: 'a.nguyen@hotel.com',
        phone: '0901234561',
        password: '123456',
        position: 'Receptionist',
        salary: 5000000,
        hireDate: '2024-01-01'
      },
      {
        fullName: 'Trần Thị B',
        email: 'b.tran@hotel.com',
        phone: '0901234562',
        password: '123456',
        position: 'Housekeeping',
        salary: 4500000,
        hireDate: '2024-03-15'
      },
      {
        fullName: 'Lê Văn C',
        email: 'c.le@hotel.com',
        phone: '0901234563',
        password: '123456',
        position: 'Manager',
        salary: 15000000,
        hireDate: '2023-06-01'
      }
    ];

    for (const emp of employees) {
      // Check if email exists
      const [existingUsers] = await connection.query(
        'SELECT id FROM accounts WHERE email = ?',
        [emp.email]
      );
      
      if (existingUsers.length > 0) {
        console.log(`⚠️ Email ${emp.email} already exists, skipping...`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(emp.password, 10);

      // Insert into accounts
      const [accountResult] = await connection.query(
        'INSERT INTO accounts (full_name, email, phone, password, role, status) VALUES (?, ?, ?, ?, ?, ?)',
        [emp.fullName, emp.email, emp.phone, hashedPassword, 'employee', 'active']
      );

      // Insert into employees
      await connection.query(
        'INSERT INTO employees (accountId, fullName, phone, position, salary, hireDate) VALUES (?, ?, ?, ?, ?, ?)',
        [accountResult.insertId, emp.fullName, emp.phone, emp.position, emp.salary, emp.hireDate]
      );

      console.log(`✅ Added employee: ${emp.fullName}`);
    }

    console.log('✅ All sample employees added successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addSampleEmployees();

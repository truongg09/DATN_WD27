const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function addAdmin() {
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

    const adminEmail = 'admin@hotel.com';
    const adminPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    console.log('=== Checking if admin already exists...');
    const [existingUsers] = await connection.query(
      'SELECT id FROM accounts WHERE email = ?',
      [adminEmail]
    );

    if (existingUsers.length > 0) {
      console.log('⚠️ Admin user already exists!');
    } else {
      console.log('=== Inserting admin user...');
      await connection.query(
        `INSERT INTO accounts (full_name, email, phone, password, role, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['Admin', adminEmail, '0901234567', hashedPassword, 'admin', 'active']
      );
      console.log('✅ Admin user created successfully!');
      console.log('📧 Email: admin@hotel.com');
      console.log('🔑 Password: admin123');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('❌ Error stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addAdmin();

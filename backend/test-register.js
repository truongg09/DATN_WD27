const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function testRegister() {
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

    // Check if accounts table exists
    console.log('=== Checking accounts table...');
    const [tables] = await connection.query('SHOW TABLES LIKE "accounts"');
    console.log('Tables result:', tables);
    if (tables.length === 0) {
      console.error('❌ accounts table does not exist!');
      return;
    }
    console.log('✅ accounts table exists');

    // Try to insert test user
    const testFullName = 'Test User';
    const testEmail = 'test' + Date.now() + '@example.com';
    const testPhone = '0123456789';
    const testPassword = 'password123';

    console.log('=== Hashing password...');
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    console.log('=== Inserting test user...');
    const [result] = await connection.query(
      'INSERT INTO accounts (full_name, email, phone, password) VALUES (?, ?, ?, ?)',
      [testFullName, testEmail, testPhone, hashedPassword]
    );
    console.log('✅ Insert successful! Result:', result);

    // Verify user exists
    console.log('=== Verifying user...');
    const [users] = await connection.query('SELECT * FROM accounts WHERE email = ?', [testEmail]);
    console.log('✅ User found:', users[0]);

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('❌ Error stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testRegister();

const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAdmin() {
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

    console.log('=== Querying accounts table...');
    const [users] = await connection.query('SELECT id, full_name, email, role FROM accounts');
    console.log('Users in database:');
    users.forEach(u => {
      console.log(`- ID: ${u.id}, Name: ${u.full_name}, Email: ${u.email}, Role: ${u.role}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkAdmin();

const mysql = require('mysql2/promise');
require('dotenv').config();

const checkDB = async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'hotelbookingdb'
    });

    console.log('Connected to database');

    // Check accounts
    const [accounts] = await connection.query('SELECT id, full_name, email, phone, role FROM accounts');
    console.log('Accounts in database:', accounts.length > 0 ? accounts : 'No accounts found');

    process.exit(0);
  } catch (error) {
    console.error('Error checking database:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

checkDB();

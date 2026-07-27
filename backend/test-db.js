const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'datn'
    });
    console.log('Connected to MySQL datn!');
    
    const [tables] = await connection.query('SHOW TABLES');
    console.log('Tables:', tables);

    try {
      const [columns] = await connection.query('DESCRIBE room_types');
      console.log('room_types columns:', columns.map(c => ({ Field: c.Field, Type: c.Type })));
    } catch (e) {
      console.error('Error describing room_types:', e.message);
    }

    try {
      const [rows] = await connection.query('SELECT * FROM room_types LIMIT 3');
      console.log('room_types samples:', rows);
    } catch (e) {
      console.error('Error selecting from room_types:', e.message);
    }

    await connection.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

testConnection();

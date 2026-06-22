const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAmenitiesTable() {
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

    const [columns] = await connection.query('DESCRIBE amenities');
    console.log('Amenities table columns:', columns);

    const [data] = await connection.query('SELECT * FROM amenities');
    console.log('Current amenities data:', data);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkAmenitiesTable();

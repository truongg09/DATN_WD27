const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    });
    console.log('Connected to MySQL!');
    
    // Check if database exists
    const [databases] = await connection.query('SHOW DATABASES');
    console.log('Databases:', databases.map(d => d.Database));
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

testConnection();

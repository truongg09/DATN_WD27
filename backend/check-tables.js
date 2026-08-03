const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTables() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('=== accounts table structure ===');
    const [accounts] = await connection.query('DESCRIBE accounts');
    console.table(accounts);

    console.log('\n=== employees table structure ===');
    const [employees] = await connection.query('DESCRIBE employees');
    console.table(employees);

    console.log('\n=== Sample data from accounts ===');
    const [accData] = await connection.query('SELECT * FROM accounts LIMIT 5');
    console.table(accData);

    console.log('\n=== Sample data from employees ===');
    const [empData] = await connection.query('SELECT * FROM employees LIMIT 5');
    console.table(empData);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkTables();

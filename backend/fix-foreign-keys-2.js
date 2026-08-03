const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixForeignKeys() {
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

    // Disable foreign key checks temporarily
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // Drop and recreate foreign keys with ON DELETE CASCADE for all tables referencing accounts
    // Table: customers
    console.log('=== Fixing customers table...');
    await connection.query(`
      ALTER TABLE customers 
      DROP FOREIGN KEY customers_ibfk_1,
      ADD CONSTRAINT customers_ibfk_1 
      FOREIGN KEY (accountId) REFERENCES accounts (id) ON DELETE CASCADE
    `);

    // Table: employees
    console.log('=== Fixing employees table...');
    await connection.query(`
      ALTER TABLE employees 
      DROP FOREIGN KEY employees_ibfk_1,
      ADD CONSTRAINT employees_ibfk_1 
      FOREIGN KEY (accountId) REFERENCES accounts (id) ON DELETE CASCADE
    `);

    // Table: notifications
    console.log('=== Fixing notifications table...');
    await connection.query(`
      ALTER TABLE notifications 
      DROP FOREIGN KEY notifications_ibfk_1,
      ADD CONSTRAINT notifications_ibfk_1 
      FOREIGN KEY (accountId) REFERENCES accounts (id) ON DELETE CASCADE
    `);

    // Table: booking_status_logs (changedBy)
    console.log('=== Fixing booking_status_logs table...');
    await connection.query(`
      ALTER TABLE booking_status_logs 
      DROP FOREIGN KEY booking_status_logs_ibfk_2,
      ADD CONSTRAINT booking_status_logs_ibfk_2 
      FOREIGN KEY (changedBy) REFERENCES accounts (id) ON DELETE SET NULL
    `);

    // Table: payment_status_logs (changedBy)
    console.log('=== Fixing payment_status_logs table...');
    await connection.query(`
      ALTER TABLE payment_status_logs 
      DROP FOREIGN KEY payment_status_logs_ibfk_2,
      ADD CONSTRAINT payment_status_logs_ibfk_2 
      FOREIGN KEY (changedBy) REFERENCES accounts (id) ON DELETE SET NULL
    `);

    // Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('✅ All foreign keys fixed!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixForeignKeys();

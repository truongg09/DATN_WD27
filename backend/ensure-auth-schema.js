const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'hotelbookingdb';

const columnExists = (columns, name) => {
  return columns.some((column) => column.Field === name);
};

async function ensureAuthSchema() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: DB_NAME
    });

    const [tables] = await connection.query('SHOW TABLES LIKE "accounts"');
    if (tables.length === 0) {
      throw new Error('Table accounts does not exist. Run node init-db.js first.');
    }

    const [columns] = await connection.query('DESCRIBE accounts');
    const alters = [];

    if (!columnExists(columns, 'full_name')) {
      alters.push('ADD COLUMN full_name VARCHAR(255) NULL AFTER id');
    }

    if (!columnExists(columns, 'phone')) {
      alters.push('ADD COLUMN phone VARCHAR(20) NULL AFTER email');
    }

    if (!columnExists(columns, 'created_at')) {
      alters.push('ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    }

    if (!columnExists(columns, 'updated_at')) {
      alters.push('ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    }

    if (alters.length > 0) {
      await connection.query(`ALTER TABLE accounts ${alters.join(', ')}`);
    }

    await connection.query("ALTER TABLE accounts MODIFY COLUMN role VARCHAR(50) DEFAULT 'customer'");
    await connection.query("ALTER TABLE accounts MODIFY COLUMN status VARCHAR(50) DEFAULT 'active'");
    await connection.query("UPDATE accounts SET role = 'customer' WHERE role IS NULL OR role = ''");
    await connection.query("UPDATE accounts SET status = 'active' WHERE status IS NULL OR status = ''");
    await connection.query("UPDATE accounts SET full_name = email WHERE full_name IS NULL OR full_name = ''");

    console.log('Auth schema is ready.');
  } catch (error) {
    console.error('Failed to ensure auth schema:', error);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

ensureAuthSchema();

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

    // Let's get all tables to see what we're working with
    console.log('=== Checking tables...');
    const [tables] = await connection.query('SHOW TABLES');
    console.log('Tables:', tables);

    // For each table, check foreign keys to accounts and update them
    // First, let's check the existing structure of customers/employees/other tables
    for (const tbl of tables) {
      const tableName = Object.values(tbl)[0];
      console.log(`\n=== Checking table ${tableName}...`);
      const [createTable] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
      console.log(createTable[0]['Create Table']);
    }

    // Now, let's fix the foreign keys - first, let's check if we need to drop and recreate them
    // Let's try to alter any tables that reference accounts.id to use ON DELETE CASCADE

    // Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixForeignKeys();

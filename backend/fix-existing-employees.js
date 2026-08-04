const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixExistingEmployees() {
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

    // Get all employee accounts
    const [employeeAccounts] = await connection.query(
      'SELECT id, full_name, phone FROM accounts WHERE role = ?',
      ['employee']
    );

    console.log('Found', employeeAccounts.length, 'employee accounts');

    for (const acc of employeeAccounts) {
      // Check if they have an entry in employees table
      const [existingEmployees] = await connection.query(
        'SELECT id FROM employees WHERE accountId = ?',
        [acc.id]
      );

      if (existingEmployees.length === 0) {
        // Add entry to employees table
        await connection.query(
          'INSERT INTO employees (accountId, fullName, phone, position, salary, hireDate) VALUES (?, ?, ?, ?, ?, ?)',
          [
            acc.id,
            acc.full_name,
            acc.phone,
            'Staff',
            5000000,
            '2024-01-01'
          ]
        );
        console.log(`✅ Added employee entry for ${acc.full_name}`);
      } else {
        console.log(`✅ Employee entry already exists for ${acc.full_name}`);
      }
    }

    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixExistingEmployees();

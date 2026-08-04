const db = require('./config/db');

async function run() {
  try {
    console.log('Adding maintenance columns to rooms table...');
    
    // Check if columns exist
    const [columns] = await db.query('DESCRIBE rooms');
    const fields = columns.map(c => c.Field);
    
    if (!fields.includes('maintenanceNote')) {
      await db.query('ALTER TABLE rooms ADD COLUMN maintenanceNote VARCHAR(255) DEFAULT NULL');
      console.log('Added maintenanceNote column');
    } else {
      console.log('maintenanceNote column already exists');
    }

    if (!fields.includes('maintenanceExpectedCompletion')) {
      await db.query('ALTER TABLE rooms ADD COLUMN maintenanceExpectedCompletion DATE DEFAULT NULL');
      console.log('Added maintenanceExpectedCompletion column');
    } else {
      console.log('maintenanceExpectedCompletion column already exists');
    }

    console.log('Database migration done successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error migrating database:', error);
    process.exit(1);
  }
}

run();

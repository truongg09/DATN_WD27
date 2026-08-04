const db = require('./config/db');

async function run() {
  try {
    console.log('Starting migration to Soft Delete...');

    // 1. Add isDeleted columns
    const [roomsCols] = await db.query('DESCRIBE rooms');
    const roomsFields = roomsCols.map(c => c.Field);
    if (!roomsFields.includes('isDeleted')) {
      await db.query('ALTER TABLE rooms ADD COLUMN isDeleted TINYINT(1) DEFAULT 0');
      console.log('Added isDeleted column to rooms table');
    } else {
      console.log('isDeleted column already exists in rooms table');
    }

    const [typesCols] = await db.query('DESCRIBE room_types');
    const typesFields = typesCols.map(c => c.Field);
    if (!typesFields.includes('isDeleted')) {
      await db.query('ALTER TABLE room_types ADD COLUMN isDeleted TINYINT(1) DEFAULT 0');
      console.log('Added isDeleted column to room_types table');
    } else {
      console.log('isDeleted column already exists in room_types table');
    }

    // 2. Drop UNIQUE index of room_number
    console.log('Checking unique constraints on rooms table...');
    const [indexes] = await db.query("SHOW INDEX FROM rooms WHERE Non_unique = 0 AND Key_name != 'PRIMARY'");
    for (const idx of indexes) {
      if (idx.Column_name === 'room_number' || idx.Column_name === 'roomNumber') {
        console.log(`Dropping unique index ${idx.Key_name}...`);
        try {
          await db.query(`ALTER TABLE rooms DROP INDEX ${idx.Key_name}`);
          console.log(`Dropped index ${idx.Key_name} successfully`);
        } catch (e) {
          console.log(`Error dropping index ${idx.Key_name}: ${e.message}. It might have been dropped already.`);
        }
      }
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

run();

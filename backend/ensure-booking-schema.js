const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'hotelbookingdb';

const hasColumn = (columns, name) => columns.some((column) => column.Field === name);
const addColumn = (columns, name, definition) =>
  hasColumn(columns, name) ? null : `ADD COLUMN ${name} ${definition}`;

async function ensureBookingSchema() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: DB_NAME
    });

    const [bookingTables] = await connection.query('SHOW TABLES LIKE "bookings"');
    if (bookingTables.length === 0) {
      throw new Error('Table bookings does not exist. Import schema.sql or run your database setup first.');
    }

    const [bookingColumns] = await connection.query('DESCRIBE bookings');
    const bookingAlters = [
      addColumn(bookingColumns, 'user_id', 'INT NULL AFTER id'),
      addColumn(bookingColumns, 'room_id', 'INT NULL AFTER user_id'),
      addColumn(bookingColumns, 'check_in', 'DATE NULL AFTER room_id'),
      addColumn(bookingColumns, 'check_out', 'DATE NULL AFTER check_in'),
      addColumn(bookingColumns, 'total_price', 'DECIMAL(15,2) NULL AFTER check_out'),
      addColumn(bookingColumns, 'status', "VARCHAR(50) NULL DEFAULT 'pending' AFTER total_price"),
      addColumn(bookingColumns, 'notes', 'TEXT NULL AFTER status'),
      addColumn(bookingColumns, 'guest_name', 'VARCHAR(255) NULL AFTER notes'),
      addColumn(bookingColumns, 'guest_email', 'VARCHAR(255) NULL AFTER guest_name'),
      addColumn(bookingColumns, 'guest_phone', 'VARCHAR(20) NULL AFTER guest_email'),
      addColumn(bookingColumns, 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    ].filter(Boolean);

    if (bookingAlters.length > 0) {
      await connection.query(`ALTER TABLE bookings ${bookingAlters.join(', ')}`);
    }

    await connection.query(`
      UPDATE bookings
      SET
        status = COALESCE(status, bookingStatus, 'pending'),
        total_price = COALESCE(total_price, totalAmount),
        created_at = COALESCE(created_at, createdAt)
    `);

    const [detailTables] = await connection.query('SHOW TABLES LIKE "booking_details"');
    if (detailTables.length === 0) {
      await connection.query(`
        CREATE TABLE booking_details (
          id INT AUTO_INCREMENT PRIMARY KEY,
          bookingId INT NULL,
          roomId INT NULL,
          checkInDate DATE NULL,
          checkOutDate DATE NULL,
          adults INT NULL,
          children INT NULL,
          roomPrice DECIMAL(15,2) NULL
        )
      `);
    }

    const [paymentTables] = await connection.query('SHOW TABLES LIKE "payments"');
    if (paymentTables.length === 0) {
      await connection.query(`
        CREATE TABLE payments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          bookingId INT NULL,
          roomAmount DECIMAL(15,2) NULL,
          serviceAmount DECIMAL(15,2) NULL,
          surchargeAmount DECIMAL(15,2) NULL,
          discountAmount DECIMAL(15,2) NULL,
          depositAmount DECIMAL(15,2) NULL,
          paidAmount DECIMAL(15,2) NULL,
          remainingAmount DECIMAL(15,2) NULL,
          totalAmount DECIMAL(15,2) NULL,
          paymentMethod VARCHAR(50) NULL,
          paymentStatus VARCHAR(50) NULL,
          transactionCode VARCHAR(255) NULL,
          paymentDate DATETIME NULL
        )
      `);
    }

    console.log('Booking schema is ready.');
  } catch (error) {
    console.error('Failed to ensure booking schema:', error);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

ensureBookingSchema();

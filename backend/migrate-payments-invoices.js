const mysql = require('mysql2/promise');
require('dotenv').config();

const migrate = async () => {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'hotelbookingdb',
      multipleStatements: true
    });

    console.log('Running payments & invoices migration...');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        room_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        service_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        surcharge_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        deposit_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        remaining_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(50),
        payment_status ENUM('unpaid', 'paid', 'refunded') DEFAULT 'unpaid',
        transaction_code VARCHAR(255),
        payment_date TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
      )
    `);

    const [paymentColumns] = await connection.query('SHOW COLUMNS FROM payments');
    const columnNames = paymentColumns.map((column) => column.Field);

    if (columnNames.includes('amount') && !columnNames.includes('total_amount')) {
      console.log('Upgrading legacy payments table...');
      await connection.query(`
        ALTER TABLE payments
          ADD COLUMN room_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER booking_id,
          ADD COLUMN service_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER room_amount,
          ADD COLUMN surcharge_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER service_amount,
          ADD COLUMN discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER surcharge_amount,
          ADD COLUMN deposit_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER discount_amount,
          ADD COLUMN paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER deposit_amount,
          ADD COLUMN remaining_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER paid_amount,
          ADD COLUMN total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER remaining_amount,
          ADD COLUMN payment_status ENUM('unpaid', 'paid', 'refunded') DEFAULT 'unpaid' AFTER payment_method,
          ADD COLUMN transaction_code VARCHAR(255) AFTER payment_status,
          ADD COLUMN payment_date TIMESTAMP NULL AFTER transaction_code,
          ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at
      `);

      await connection.query(`
        UPDATE payments p
        JOIN bookings b ON b.id = p.booking_id
        SET
          p.room_amount = COALESCE(b.total_price, p.amount),
          p.total_amount = COALESCE(p.amount, b.total_price),
          p.remaining_amount = CASE
            WHEN p.status = 'completed' THEN 0
            ELSE COALESCE(p.amount, b.total_price)
          END,
          p.paid_amount = CASE
            WHEN p.status = 'completed' THEN COALESCE(p.amount, b.total_price)
            ELSE 0
          END,
          p.payment_status = CASE
            WHEN p.status = 'completed' THEN 'paid'
            WHEN p.status = 'failed' THEN 'unpaid'
            ELSE 'unpaid'
          END,
          p.transaction_code = p.transaction_id
      `);
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_number VARCHAR(50) NOT NULL UNIQUE,
        booking_id INT NOT NULL,
        payment_id INT NULL,
        user_id INT NOT NULL,
        room_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        service_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(10, 2) NOT NULL,
        status ENUM('draft', 'issued', 'cancelled') DEFAULT 'issued',
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

migrate();

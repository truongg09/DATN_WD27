const db = require('./config/db');

const ensureOperationalSchema = async () => {
  // The surcharge for guests (for example, chargeable children) is stored on
  // the booking detail. It must not be merged into the accommodation amount.
  const [bookingDetailTables] = await db.query('SHOW TABLES LIKE "booking_details"');
  if (bookingDetailTables.length > 0) {
    const [bookingDetailColumns] = await db.query('DESCRIBE booking_details');
    if (!bookingDetailColumns.some((column) => column.Field === 'occupancySurcharge')) {
      await db.query(
        'ALTER TABLE booking_details ADD COLUMN occupancySurcharge DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER roomPrice'
      );
    }
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS booking_guests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bookingId INT NOT NULL,
      fullName VARCHAR(255) NOT NULL,
      identityNumber VARCHAR(50) NOT NULL,
      phone VARCHAR(30) NULL,
      note TEXT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE
    )
  `);

  const [invoiceTables] = await db.query('SHOW TABLES LIKE "invoices"');
  if (invoiceTables.length > 0) {
    const [invoiceColumns] = await db.query('DESCRIBE invoices');
    if (!invoiceColumns.some((column) => column.Field === 'roomAmount')) {
      await db.query('ALTER TABLE invoices ADD COLUMN roomAmount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER invoiceCode');
    }
    if (!invoiceColumns.some((column) => column.Field === 'serviceAmount')) {
      await db.query('ALTER TABLE invoices ADD COLUMN serviceAmount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER roomAmount');
    }
    if (!invoiceColumns.some((column) => column.Field === 'surchargeAmount')) {
      await db.query('ALTER TABLE invoices ADD COLUMN surchargeAmount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER serviceAmount');
    }
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS booking_room_transfers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bookingId INT NOT NULL,
      fromRoomId INT NOT NULL,
      toRoomId INT NOT NULL,
      fromDate DATE NOT NULL,
      toDate DATE NOT NULL,
      pricePerNight DECIMAL(15,2) NOT NULL DEFAULT 0,
      reason TEXT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE,
      FOREIGN KEY (fromRoomId) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (toRoomId) REFERENCES rooms(id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS booking_damage_charges (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bookingId INT NOT NULL,
      roomId INT NOT NULL,
      itemName VARCHAR(255) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      unitPrice DECIMAL(15,2) NOT NULL DEFAULT 0,
      totalPrice DECIMAL(15,2) NOT NULL DEFAULT 0,
      note TEXT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE,
      FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE
    )
  `);

  // Service requests made by the customer at booking time.
  // These are NOT charged until an admin confirms them (status -> confirmed),
  // at which point the service is copied into booking_services and the bill
  // is recalculated. Kept separate so pending requests never affect payments.
  await db.query(`
    CREATE TABLE IF NOT EXISTS booking_service_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bookingId INT NOT NULL,
      serviceId INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      note TEXT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE,
      FOREIGN KEY (serviceId) REFERENCES services(id) ON DELETE CASCADE
    )
  `);

  // Refund requests created when a customer cancels a paid booking.
  // Admin reviews them (pending -> approved/rejected); approving marks the payment refunded.
  await db.query(`
    CREATE TABLE IF NOT EXISTS payment_refunds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      paymentId INT NOT NULL,
      bookingId INT NOT NULL,
      amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      refundRate DECIMAL(4,2) NOT NULL DEFAULT 0,
      paidAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
      refundMethod ENUM('cash', 'bank_transfer') NOT NULL DEFAULT 'bank_transfer',
      bankBin VARCHAR(10) NULL,
      bankName VARCHAR(100) NULL,
      accountNumber VARCHAR(30) NULL,
      accountName VARCHAR(100) NULL,
      status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
      note TEXT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      processedAt DATETIME NULL,
      FOREIGN KEY (paymentId) REFERENCES payments(id) ON DELETE CASCADE,
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE
    )
  `);

  // A customer declaring a bank transfer is not proof of payment. Keep the
  // request separate from payments until a receptionist/admin verifies it.
  await db.query(`
    CREATE TABLE IF NOT EXISTS payment_confirmation_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      paymentId INT NOT NULL UNIQUE,
      bookingId INT NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      paymentMethod VARCHAR(30) NOT NULL DEFAULT 'bank_transfer',
      status ENUM('pending', 'confirmed', 'rejected') NOT NULL DEFAULT 'pending',
      note VARCHAR(500) NULL,
      submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmedBy INT NULL,
      confirmedAt DATETIME NULL,
      FOREIGN KEY (paymentId) REFERENCES payments(id) ON DELETE CASCADE,
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE,
      FOREIGN KEY (confirmedBy) REFERENCES accounts(id) ON DELETE SET NULL
    )
  `);

  // Ví của khách: tiền hoàn được cộng vào ví (refund_credit), khách rút ra (withdrawal).
  // Số dư khả dụng = tổng credit approved - tổng withdrawal (pending + approved).
  await db.query(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL,
      refundId INT NULL,
      bookingId INT NULL,
      type ENUM('refund_credit', 'withdrawal') NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved',
      refundMethod ENUM('cash', 'bank_transfer') NULL,
      bankBin VARCHAR(10) NULL,
      bankName VARCHAR(100) NULL,
      accountNumber VARCHAR(30) NULL,
      accountName VARCHAR(100) NULL,
      note TEXT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      processedAt DATETIME NULL,
      FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
    )
  `);

  // Key-value store for admin-configurable settings (e.g. payment receiving account).
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      settingKey VARCHAR(100) PRIMARY KEY,
      settingValue TEXT NOT NULL,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Vouchers granted to a specific customer (e.g. no-show compensation).
  await db.query(`
    CREATE TABLE IF NOT EXISTS customer_vouchers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      voucherId INT NOT NULL,
      bookingId INT NULL,
      source VARCHAR(30) NOT NULL DEFAULT 'no_show',
      isUsed TINYINT(1) NOT NULL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (voucherId) REFERENCES vouchers(id) ON DELETE CASCADE,
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE SET NULL
    )
  `);

  // Invoices issued when a payment is fully completed (see invoiceService).
  await db.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bookingId INT NOT NULL,
      paymentId INT NULL,
      invoiceCode VARCHAR(50) NOT NULL UNIQUE,
      roomAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
      serviceAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
      surchargeAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
      subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
      discountAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
      taxAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
      totalAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
      status ENUM('draft', 'issued', 'cancelled') DEFAULT 'issued',
      invoiceDate DATETIME DEFAULT CURRENT_TIMESTAMP,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE,
      FOREIGN KEY (paymentId) REFERENCES payments(id) ON DELETE SET NULL
    )
  `);

  // Normalize legacy partial payments. Previously they were saved as "unpaid"
  // even when a customer had already paid a deposit.
  await db.query(`
    UPDATE payments
    SET paymentStatus = 'deposit_paid'
    WHERE COALESCE(paidAmount, 0) > 0
      AND COALESCE(remainingAmount, 0) > 0
      AND COALESCE(paymentStatus, 'unpaid') = 'unpaid'
  `);
};

module.exports = ensureOperationalSchema;

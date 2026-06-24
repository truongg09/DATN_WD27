const db = require('./config/db');

const ensureOperationalSchema = async () => {
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

  await db.query(`
    CREATE TABLE IF NOT EXISTS vouchers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      discount_percentage DECIMAL(5, 2) NOT NULL,
      valid_from DATE NOT NULL,
      valid_until DATE NOT NULL,
      usage_limit INT DEFAULT 1,
      times_used INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS customer_vouchers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      voucherId INT NOT NULL,
      bookingId INT NULL,
      source VARCHAR(50) DEFAULT 'no_show',
      isUsed TINYINT(1) DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (voucherId) REFERENCES vouchers(id) ON DELETE CASCADE,
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE SET NULL
    )
  `);
};

module.exports = ensureOperationalSchema;

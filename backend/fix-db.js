const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixDB() {
  let connection;
  try {
    console.log('=== Connecting to database...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'hotelbookingdb'
    });
    console.log('✅ Connected to database');

    // Disable foreign key checks temporarily
    console.log('=== Disabling foreign key checks...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('✅ Foreign key checks disabled');

    // Drop old tables that might reference accounts
    console.log('=== Dropping dependent tables...');
    await connection.query('DROP TABLE IF EXISTS reviews');
    await connection.query('DROP TABLE IF EXISTS room_availability');
    await connection.query('DROP TABLE IF EXISTS booking_details');
    await connection.query('DROP TABLE IF EXISTS bookings');
    await connection.query('DROP TABLE IF EXISTS accounts');
    console.log('✅ Old tables dropped');

    // Re-enable foreign key checks
    console.log('=== Re-enabling foreign key checks...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ Foreign key checks re-enabled');

    // Create new accounts table with correct columns
    console.log('=== Creating new accounts table...');
    await connection.query(`
      CREATE TABLE accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'employee', 'customer') DEFAULT 'customer',
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ New accounts table created successfully!');

    // Recreate other tables
    console.log('=== Recreating other tables...');
    // Room types
    await connection.query(`
      CREATE TABLE IF NOT EXISTS room_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price_per_night DECIMAL(10, 2) NOT NULL,
        capacity INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    // Rooms
    await connection.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_number VARCHAR(50) UNIQUE NOT NULL,
        room_type_id INT NOT NULL,
        floor INT,
        status ENUM('available', 'occupied', 'maintenance') DEFAULT 'available',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE CASCADE
      )
    `);
    // Bookings
    await connection.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        room_id INT NOT NULL,
        check_in DATE NOT NULL,
        check_out DATE NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        status ENUM('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled') DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      )
    `);
    // Booking details
    await connection.query(`
      CREATE TABLE IF NOT EXISTS booking_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        room_id INT NOT NULL,
        check_in_date DATE NOT NULL,
        check_out_date DATE NOT NULL,
        adults INT NOT NULL DEFAULT 1,
        children INT NOT NULL DEFAULT 0,
        room_price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      )
    `);
    // Room availability
    await connection.query(`
      CREATE TABLE IF NOT EXISTS room_availability (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        booking_id INT NULL,
        date DATE NOT NULL,
        status ENUM('available', 'booked') DEFAULT 'available',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_room_date (room_id, date),
        INDEX idx_room_availability_lookup (room_id, date, status),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
      )
    `);
    // Reviews
    await connection.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        room_id INT NOT NULL,
        rating INT CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      )
    `);

    // Insert sample data if needed
    const [roomTypes] = await connection.query('SELECT id FROM room_types LIMIT 1');
    if (roomTypes.length === 0) {
      console.log('=== Inserting sample room types...');
      await connection.query(`
        INSERT INTO room_types (name, description, price_per_night, capacity) VALUES
        ('Standard Single', 'Phòng đơn tiêu chuẩn với giường đơn', 500000, 1),
        ('Standard Double', 'Phòng đôi tiêu chuẩn với giường đôi', 800000, 2),
        ('Deluxe Twin', 'Phòng cao cấp với 2 giường đơn', 1200000, 2),
        ('Deluxe King', 'Phòng cao cấp với giường king size', 1500000, 2),
        ('Suite', 'Phòng suite sang trọng với khu vực sinh hoạt riêng', 2500000, 4)
      `);
    }
    const [rooms] = await connection.query('SELECT id FROM rooms LIMIT 1');
    if (rooms.length === 0) {
      console.log('=== Inserting sample rooms...');
      const [roomTypeIds] = await connection.query('SELECT id FROM room_types');
      const typeIds = roomTypeIds.map((rt) => rt.id);
      await connection.query(`
        INSERT INTO rooms (room_number, room_type_id, floor, status, description) VALUES
        ('101', ${typeIds[0]}, 1, 'available', 'Phòng đơn trên tầng 1'),
        ('102', ${typeIds[1]}, 1, 'available', 'Phòng đôi trên tầng 1'),
        ('201', ${typeIds[2]}, 2, 'available', 'Phòng twin trên tầng 2'),
        ('202', ${typeIds[3]}, 2, 'available', 'Phòng king trên tầng 2'),
        ('301', ${typeIds[4]}, 3, 'available', 'Phòng suite trên tầng 3')
      `);
    }

    console.log('✅ Database fixed successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('❌ Error stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixDB();

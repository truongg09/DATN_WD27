const bcrypt = require('bcrypt');
const db = require('./config/db');

// Các bản database mẫu lưu mật khẩu dạng chữ thường ('123456'). Từ khi đăng
// nhập chỉ chấp nhận bcrypt, những tài khoản đó phải được băm lại để vẫn đăng
// nhập được bằng đúng mật khẩu cũ mà không còn lộ mật khẩu trong database.
const hashLegacyPlaintextPasswords = async () => {
  const [rows] = await db.query(
    `SELECT id, password FROM accounts
     WHERE password IS NOT NULL AND password <> '' AND password NOT LIKE '$2%'`
  );

  for (const row of rows) {
    const hashed = await bcrypt.hash(row.password, 10);
    await db.query('UPDATE accounts SET password = ? WHERE id = ?', [hashed, row.id]);
  }

  if (rows.length > 0) {
    console.warn(
      `Đã băm lại ${rows.length} mật khẩu đang lưu dạng chữ thường. ` +
        'Hãy đổi mật khẩu mặc định của tài khoản quản trị.'
    );
  }
};

const ensureOperationalSchema = async () => {
  await hashLegacyPlaintextPasswords();
  try {
    await db.query('DROP TABLE IF EXISTS employees');
  } catch (err) {
    console.error('Lỗi khi xóa bảng employees:', err.message);
  }

  const [bookingColumns] = await db.query('DESCRIBE bookings');
  if (!bookingColumns.some((column) => column.Field === 'cancellation_reason')) {
    await db.query('ALTER TABLE bookings ADD COLUMN cancellation_reason TEXT NULL AFTER notes');
  }
  await db.query(
    `UPDATE vouchers SET discountType = 'percentage' WHERE discountType = 'percent'`
  );

  // Luôn có dịch vụ giường phụ để khách có thể chọn ngay trên trang đặt phòng.
  const [extraBeds] = await db.query(
    `SELECT id FROM services
     WHERE LOWER(serviceName) IN ('extra bed', 'kê thêm giường', 'giường phụ')
     LIMIT 1`
  );
  if (extraBeds.length === 0) {
    await db.query(
      `INSERT INTO services (serviceName, price, description)
       VALUES ('Kê thêm giường', 250000, 'Tối đa 1 giường phụ/phòng; đăng ký trước 18:00 ngày nhận phòng.')`
    );
  }
  // Việt hóa dữ liệu dịch vụ mẫu đã tồn tại trong các bản database cũ.
  await db.query(`
    UPDATE services
    SET
      description = CASE LOWER(TRIM(serviceName))
        WHEN 'breakfast' THEN 'Buffet sáng phục vụ từ 06:30 đến 10:00.'
        WHEN 'laundry' THEN 'Dịch vụ giặt và ủi quần áo.'
        WHEN 'spa' THEN 'Dịch vụ chăm sóc và thư giãn tại spa.'
        WHEN 'airport pickup' THEN 'Xe đưa đón giữa khách sạn và sân bay.'
        WHEN 'room service' THEN 'Phục vụ đồ ăn và thức uống tại phòng.'
        WHEN 'dinner buffet' THEN 'Buffet tối phục vụ từ 18:00 đến 21:30.'
        WHEN 'massage' THEN 'Dịch vụ massage thư giãn.'
        WHEN 'bicycle rental' THEN 'Thuê xe đạp sử dụng trong ngày.'
        WHEN 'mini bar' THEN 'Đồ ăn nhẹ và nước uống trong minibar.'
        WHEN 'extra bed' THEN 'Tối đa 1 giường phụ mỗi phòng; đăng ký trước 18:00 ngày nhận phòng.'
        ELSE description
      END,
      serviceName = CASE LOWER(TRIM(serviceName))
        WHEN 'breakfast' THEN 'Buffet sáng'
        WHEN 'laundry' THEN 'Giặt ủi'
        WHEN 'spa' THEN 'Spa thư giãn'
        WHEN 'airport pickup' THEN 'Đưa đón sân bay'
        WHEN 'room service' THEN 'Phục vụ tại phòng'
        WHEN 'dinner buffet' THEN 'Buffet tối'
        WHEN 'massage' THEN 'Massage'
        WHEN 'bicycle rental' THEN 'Thuê xe đạp'
        WHEN 'mini bar' THEN 'Đồ uống minibar'
        WHEN 'extra bed' THEN 'Kê thêm giường'
        ELSE serviceName
      END
    WHERE LOWER(TRIM(serviceName)) IN (
      'breakfast', 'laundry', 'spa', 'airport pickup', 'room service',
      'dinner buffet', 'massage', 'bicycle rental', 'mini bar', 'extra bed'
    )
  `);

  // Room APIs use soft deletion. Older database dumps do not contain these
  // columns, which makes GET /api/rooms and /api/rooms/types fail with 500.
  const [roomColumns] = await db.query('DESCRIBE rooms');
  if (!roomColumns.some((column) => column.Field === 'isDeleted')) {
    await db.query(
      'ALTER TABLE rooms ADD COLUMN isDeleted TINYINT(1) NOT NULL DEFAULT 0'
    );
  }

  // Danh sách phòng truy vấn các cột bảo trì. Bản database dump không có chúng
  // nên GET /api/rooms trả 500 và toàn bộ trang quản lý phòng không tải được.
  if (!roomColumns.some((column) => column.Field === 'maintenanceNote')) {
    await db.query('ALTER TABLE rooms ADD COLUMN maintenanceNote VARCHAR(255) DEFAULT NULL');
  }
  if (!roomColumns.some((column) => column.Field === 'maintenanceExpectedCompletion')) {
    await db.query('ALTER TABLE rooms ADD COLUMN maintenanceExpectedCompletion DATE DEFAULT NULL');
  }

  const [roomTypeColumns] = await db.query('DESCRIBE room_types');
  if (!roomTypeColumns.some((column) => column.Field === 'isDeleted')) {
    await db.query(
      'ALTER TABLE room_types ADD COLUMN isDeleted TINYINT(1) NOT NULL DEFAULT 0'
    );
  }
  if (!roomTypeColumns.some((column) => column.Field === 'status')) {
    await db.query(
      "ALTER TABLE room_types ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active'"
    );
  }

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

  // Chức năng đánh giá dùng các cột kiểm duyệt và phản hồi, nhưng bản database
  // dump chỉ có id/bookingId/customerId/rating/comment/createdAt nên mọi API
  // đánh giá đều trả 500.
  const [reviewTables] = await db.query('SHOW TABLES LIKE "reviews"');
  if (reviewTables.length > 0) {
    const [reviewColumns] = await db.query('DESCRIBE reviews');
    const hasReviewColumn = (name) => reviewColumns.some((column) => column.Field === name);

    if (!hasReviewColumn('status')) {
      await db.query(
        "ALTER TABLE reviews ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'approved'"
      );
    }
    if (!hasReviewColumn('images')) {
      await db.query('ALTER TABLE reviews ADD COLUMN images TEXT NULL');
    }
    if (!hasReviewColumn('adminReply')) {
      await db.query('ALTER TABLE reviews ADD COLUMN adminReply TEXT NULL');
    }
    if (!hasReviewColumn('repliedAt')) {
      await db.query('ALTER TABLE reviews ADD COLUMN repliedAt DATETIME NULL');
    }
    // Lý do quản trị viên ẩn đánh giá, hiển thị lại cho khách trong thông báo.
    if (!hasReviewColumn('hideReason')) {
      await db.query('ALTER TABLE reviews ADD COLUMN hideReason TEXT NULL');
    }
  }

  // Giá từng đêm được CHỐT tại thời điểm đặt. Nếu không lưu lại, các thao tác
  // sau này (chuyển phòng) sẽ tra lại room_prices hiện hành và tính lại cả
  // những đêm khách đã ở theo bảng giá mới.
  await db.query(`
    CREATE TABLE IF NOT EXISTS booking_nightly_prices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bookingId INT NOT NULL,
      stayDate DATE NOT NULL,
      price DECIMAL(15,2) NOT NULL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_booking_night (bookingId, stayDate),
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE
    )
  `);

  // Dấu vết lịch sử thao tác trên từng đặt phòng: ai làm gì, lúc nào.
  // Mọi hành động (đặt, gia hạn, chuyển phòng, thêm dịch vụ, check-in/out,
  // thanh toán, hoàn tiền...) đều được ghi lại kèm người thực hiện và thời điểm.
  await db.query(`
    CREATE TABLE IF NOT EXISTS booking_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bookingId INT NOT NULL,
      action VARCHAR(50) NOT NULL,
      description TEXT NULL,
      oldValue TEXT NULL,
      newValue TEXT NULL,
      amount DECIMAL(15,2) NULL,
      performedBy INT NULL,
      performedByName VARCHAR(255) NULL,
      performedByRole VARCHAR(30) NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_booking_history_booking (bookingId),
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE
    )
  `);

  // Dịch vụ phát sinh cần biết được thêm vào lúc nào để hiển thị trong
  // bảng chi tiết. Database dump cũ chưa có cột createdAt.
  const [bookingServiceColumns] = await db.query('DESCRIBE booking_services');
  if (!bookingServiceColumns.some((column) => column.Field === 'createdAt')) {
    await db.query(
      'ALTER TABLE booking_services ADD COLUMN createdAt DATETIME NULL DEFAULT CURRENT_TIMESTAMP'
    );
  }

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

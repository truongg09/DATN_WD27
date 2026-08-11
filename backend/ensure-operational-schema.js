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
  if (!bookingColumns.some((column) => column.Field === 'actualCheckOutTime')) {
    await db.query('ALTER TABLE bookings ADD COLUMN actualCheckOutTime DATETIME NULL DEFAULT NULL AFTER check_out');
    // Refresh column list
    const [updatedColumns] = await db.query('DESCRIBE bookings');
    bookingColumns.length = 0;
    bookingColumns.push(...updatedColumns);
  }

  if (!bookingColumns.some((column) => column.Field === 'cancellation_reason')) {
    await db.query('ALTER TABLE bookings ADD COLUMN cancellation_reason TEXT NULL AFTER notes');
  }

  // Thời hạn giữ phòng là dữ liệu nghiệp vụ phía server, không suy ra ở trình duyệt.
  if (!bookingColumns.some((column) => column.Field === 'holdExpiresAt')) {
    await db.query('ALTER TABLE bookings ADD COLUMN holdExpiresAt DATETIME NULL AFTER created_at');
    await db.query(`
      UPDATE bookings b
      LEFT JOIN payments p ON p.id = (
        SELECT p2.id FROM payments p2 WHERE p2.bookingId = b.id ORDER BY p2.id DESC LIMIT 1
      )
      SET b.holdExpiresAt = DATE_ADD(b.created_at, INTERVAL 15 MINUTE)
      WHERE b.holdExpiresAt IS NULL
        AND b.status IN ('pending', 'confirmed')
        AND COALESCE(p.paymentStatus, 'unpaid') = 'unpaid'
        AND COALESCE(p.paidAmount, 0) = 0
    `);
  }

  // Giờ khách mong muốn nhận/trả phòng (khai lúc đặt) + giờ khách thực sự
  // nhận phòng (ghi lúc check-in, đối xứng với actualCheckOutTime đã có).
  // Cần cho tính năng phân loại check-in sớm/đúng giờ/muộn.
  if (!bookingColumns.some((column) => column.Field === 'requestedCheckInTime')) {
    await db.query(
      'ALTER TABLE bookings ADD COLUMN requestedCheckInTime TIME NULL DEFAULT NULL AFTER actualCheckOutTime'
    );
  }
  if (!bookingColumns.some((column) => column.Field === 'requestedCheckOutTime')) {
    await db.query(
      'ALTER TABLE bookings ADD COLUMN requestedCheckOutTime TIME NULL DEFAULT NULL AFTER requestedCheckInTime'
    );
  }
  if (!bookingColumns.some((column) => column.Field === 'actualCheckInTime')) {
    await db.query(
      'ALTER TABLE bookings ADD COLUMN actualCheckInTime DATETIME NULL DEFAULT NULL AFTER requestedCheckOutTime'
    );
  }
  if (!bookingColumns.some((column) => column.Field === 'requestedCheckInDayOffset')) {
    await db.query(
      'ALTER TABLE bookings ADD COLUMN requestedCheckInDayOffset INT NOT NULL DEFAULT 0 AFTER requestedCheckInTime'
    );
  }
  if (!bookingColumns.some((column) => column.Field === 'extraGuestSnapshot')) {
    await db.query(
      'ALTER TABLE bookings ADD COLUMN extraGuestSnapshot JSON NULL AFTER notes'
    );
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
  if (!roomTypeColumns.some((column) => column.Field === 'adultCapacity')) {
    await db.query(
      'ALTER TABLE room_types ADD COLUMN adultCapacity INT NOT NULL DEFAULT 2 AFTER capacity'
    );
  }
  if (!roomTypeColumns.some((column) => column.Field === 'childCapacity')) {
    await db.query(
      'ALTER TABLE room_types ADD COLUMN childCapacity INT NOT NULL DEFAULT 1 AFTER adultCapacity'
    );
  }
  if (!roomTypeColumns.some((column) => column.Field === 'maxOccupancy')) {
    await db.query(
      'ALTER TABLE room_types ADD COLUMN maxOccupancy INT NOT NULL DEFAULT 3 AFTER childCapacity'
    );
  }
  if (!roomTypeColumns.some((column) => column.Field === 'extraAdultFee')) {
    await db.query(
      'ALTER TABLE room_types ADD COLUMN extraAdultFee DECIMAL(15,2) NOT NULL DEFAULT 200000.00 AFTER maxOccupancy'
    );
  }
  if (!roomTypeColumns.some((column) => column.Field === 'extraChildFee')) {
    await db.query(
      'ALTER TABLE room_types ADD COLUMN extraChildFee DECIMAL(15,2) NOT NULL DEFAULT 100000.00 AFTER extraAdultFee'
    );
  }

  // Đảm bảo maxOccupancy tối thiểu bằng capacity đối với các dữ liệu hiện có
  await db.query(
    'UPDATE room_types SET maxOccupancy = GREATEST(COALESCE(maxOccupancy, 0), COALESCE(capacity, 0)) WHERE capacity IS NOT NULL AND maxOccupancy < capacity'
  );


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
    // Giờ khách mong muốn nhận/trả phòng, khai lúc đặt phòng. Đây là bản ghi
    // "sống" ở booking_details (giống checkInDate/checkOutDate); bookings có
    // cột cùng tên để dự phòng cho các booking không có booking_details.
    if (!bookingDetailColumns.some((column) => column.Field === 'requestedCheckInTime')) {
      await db.query(
        'ALTER TABLE booking_details ADD COLUMN requestedCheckInTime TIME NULL DEFAULT NULL AFTER checkOutDate'
      );
    }
    if (!bookingDetailColumns.some((column) => column.Field === 'requestedCheckOutTime')) {
      await db.query(
        'ALTER TABLE booking_details ADD COLUMN requestedCheckOutTime TIME NULL DEFAULT NULL AFTER requestedCheckInTime'
      );
    }
    if (!bookingDetailColumns.some((column) => column.Field === 'requestedCheckInDayOffset')) {
      await db.query(
        'ALTER TABLE booking_details ADD COLUMN requestedCheckInDayOffset INT NOT NULL DEFAULT 0 AFTER requestedCheckOutTime'
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
      chargeType ENUM('damage', 'extra_fee', 'other') NOT NULL DEFAULT 'damage',
      itemName VARCHAR(255) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      unitPrice DECIMAL(15,2) NOT NULL DEFAULT 0,
      totalPrice DECIMAL(15,2) NOT NULL DEFAULT 0,
      status ENUM('unused', 'used', 'cancelled') NOT NULL DEFAULT 'used',
      note TEXT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE,
      FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE
    )
  `);

  const [bdcColumns] = await db.query('DESCRIBE booking_damage_charges');
  if (!bdcColumns.some((column) => column.Field === 'bookingDetailId')) {
    await db.query(
      'ALTER TABLE booking_damage_charges ADD COLUMN bookingDetailId INT NULL AFTER bookingId'
    );
  }
  if (!bdcColumns.some((column) => column.Field === 'chargeType')) {
    await db.query(
      "ALTER TABLE booking_damage_charges ADD COLUMN chargeType ENUM('damage', 'extra_fee', 'other') NOT NULL DEFAULT 'damage' AFTER roomId"
    );
  }
  if (!bdcColumns.some((column) => column.Field === 'status')) {
    await db.query(
      "ALTER TABLE booking_damage_charges ADD COLUMN status ENUM('unused', 'used', 'cancelled') NOT NULL DEFAULT 'used' AFTER totalPrice"
    );
  }
  const [bdcDetailFkRows] = await db.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking_damage_charges' AND COLUMN_NAME = 'bookingDetailId' AND REFERENCED_TABLE_NAME = 'booking_details'`
  );
  if (bdcDetailFkRows.length === 0) {
    try {
      await db.query(
        'ALTER TABLE booking_damage_charges ADD CONSTRAINT fk_booking_damage_charges_detail FOREIGN KEY (bookingDetailId) REFERENCES booking_details(id) ON DELETE SET NULL'
      );
    } catch (err) {
      console.warn('Không thể thêm FK fk_booking_damage_charges_detail:', err.message);
    }
  }
  await db.query(`
    UPDATE booking_damage_charges
    SET chargeType = 'damage'
    WHERE chargeType IS NULL OR chargeType = ''
  `);
  await db.query(`
    UPDATE booking_damage_charges
    SET status = 'used'
    WHERE status IS NULL OR status = ''
  `);

  // Service requests made by the customer at booking time.
  // When a request is confirmed by an admin, its status changes to 'confirmed',
  // at which point the service is copied into booking_services and the bill
  // is updated.
  await db.query(`
    CREATE TABLE IF NOT EXISTS booking_service_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bookingId INT NOT NULL,
      bookingDetailId INT NULL,
      roomId INT NULL,
      serviceId INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      note TEXT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE,
      FOREIGN KEY (bookingDetailId) REFERENCES booking_details(id) ON DELETE SET NULL,
      FOREIGN KEY (serviceId) REFERENCES services(id) ON DELETE CASCADE,
      FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE SET NULL
    )
  `);

  const [bsrColumns] = await db.query('DESCRIBE booking_service_requests');
  if (!bsrColumns.some((column) => column.Field === 'bookingDetailId')) {
    await db.query(
      'ALTER TABLE booking_service_requests ADD COLUMN bookingDetailId INT NULL AFTER bookingId'
    );
  }
  if (!bsrColumns.some((column) => column.Field === 'roomId')) {
    await db.query(
      'ALTER TABLE booking_service_requests ADD COLUMN roomId INT NULL AFTER bookingId'
    );
  }
  const [bsrDetailFkRows] = await db.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking_service_requests' AND COLUMN_NAME = 'bookingDetailId' AND REFERENCED_TABLE_NAME = 'booking_details'`
  );
  if (bsrDetailFkRows.length === 0) {
    try {
      await db.query(
        'ALTER TABLE booking_service_requests ADD CONSTRAINT fk_booking_service_requests_detail FOREIGN KEY (bookingDetailId) REFERENCES booking_details(id) ON DELETE SET NULL'
      );
    } catch (err) {
      console.warn('Không thể thêm FK fk_booking_service_requests_detail:', err.message);
    }
  }
  const [bsrFkRows] = await db.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking_service_requests' AND COLUMN_NAME = 'roomId' AND REFERENCED_TABLE_NAME = 'rooms'`
  );
  if (bsrFkRows.length === 0) {
    try {
      await db.query(
        'ALTER TABLE booking_service_requests ADD CONSTRAINT fk_booking_service_requests_room FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE SET NULL'
      );
    } catch (err) {
      console.warn('Không thể thêm FK fk_booking_service_requests_room:', err.message);
    }
  }

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

  // Mỗi lần chuyển sang VNPay/ZaloPay có một hạn dùng đồng bộ với hạn giữ phòng.
  // Bảng riêng giúp callback idempotent và cho tác vụ hết hạn nhận biết giao dịch
  // đang chờ kết quả từ cổng mà không phải thêm trạng thái booking mới.
  await db.query(`
    CREATE TABLE IF NOT EXISTS payment_gateway_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      paymentId INT NOT NULL,
      bookingId INT NOT NULL,
      provider ENUM('vnpay', 'zalopay') NOT NULL,
      orderId VARCHAR(100) NOT NULL UNIQUE,
      amount DECIMAL(15,2) NOT NULL,
      status ENUM('created', 'paid', 'expired', 'failed', 'cancelled') NOT NULL DEFAULT 'created',
      expiresAt DATETIME NOT NULL,
      paidAt DATETIME NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_gateway_orders_expiry (status, expiresAt),
      FOREIGN KEY (paymentId) REFERENCES payments(id) ON DELETE CASCADE,
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE
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

  // Dịch vụ phát sinh cần biết phòng nào dùng, đơn giá lúc gọi, trạng thái sử dụng, thời gian dùng.
  const [bookingServiceColumns] = await db.query('DESCRIBE booking_services');
  if (!bookingServiceColumns.some((column) => column.Field === 'bookingDetailId')) {
    await db.query(
      'ALTER TABLE booking_services ADD COLUMN bookingDetailId INT NULL AFTER bookingId'
    );
  }
  if (!bookingServiceColumns.some((column) => column.Field === 'roomId')) {
    await db.query(
      'ALTER TABLE booking_services ADD COLUMN roomId INT NULL AFTER bookingId'
    );
  }
  if (!bookingServiceColumns.some((column) => column.Field === 'unitPrice')) {
    await db.query(
      'ALTER TABLE booking_services ADD COLUMN unitPrice DECIMAL(15,2) NULL AFTER serviceId'
    );
  }
  if (!bookingServiceColumns.some((column) => column.Field === 'status')) {
    await db.query(
      "ALTER TABLE booking_services ADD COLUMN status ENUM('unused', 'used', 'cancelled') NOT NULL DEFAULT 'used' AFTER quantity"
    );
  }
  const usedAtCol = bookingServiceColumns.find((column) => column.Field === 'usedAt');
  if (!usedAtCol) {
    await db.query(
      'ALTER TABLE booking_services ADD COLUMN usedAt DATETIME NULL DEFAULT NULL AFTER status'
    );
  } else if (usedAtCol.Default !== null) {
    await db.query(
      'ALTER TABLE booking_services MODIFY COLUMN usedAt DATETIME NULL DEFAULT NULL'
    );
  }
  if (!bookingServiceColumns.some((column) => column.Field === 'createdAt')) {
    await db.query(
      'ALTER TABLE booking_services ADD COLUMN createdAt DATETIME NULL DEFAULT CURRENT_TIMESTAMP'
    );
  }

  const [bsDetailFkRows] = await db.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking_services' AND COLUMN_NAME = 'bookingDetailId' AND REFERENCED_TABLE_NAME = 'booking_details'`
  );
  if (bsDetailFkRows.length === 0) {
    try {
      await db.query(
        'ALTER TABLE booking_services ADD CONSTRAINT fk_booking_services_detail FOREIGN KEY (bookingDetailId) REFERENCES booking_details(id) ON DELETE SET NULL'
      );
    } catch (err) {
      console.warn('Không thể thêm FK fk_booking_services_detail:', err.message);
    }
  }

  const [bsFkRows] = await db.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking_services' AND COLUMN_NAME = 'roomId' AND REFERENCED_TABLE_NAME = 'rooms'`
  );
  if (bsFkRows.length === 0) {
    try {
      await db.query(
        'ALTER TABLE booking_services ADD CONSTRAINT fk_booking_services_room FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE SET NULL'
      );
    } catch (err) {
      console.warn('Không thể thêm FK fk_booking_services_room:', err.message);
    }
  }

  // Backfill dữ liệu lịch sử an toàn cho bookingDetailId khi match không bị nhầm lẫn
  try {
    await db.query(`
      UPDATE booking_service_requests bsr
      INNER JOIN (
        SELECT bookingId, roomId, MIN(id) AS detailId, COUNT(*) AS cnt
        FROM booking_details
        GROUP BY bookingId, roomId
        HAVING cnt = 1
      ) bd ON bd.bookingId = bsr.bookingId AND bd.roomId = bsr.roomId
      SET bsr.bookingDetailId = bd.detailId
      WHERE bsr.bookingDetailId IS NULL AND bsr.roomId IS NOT NULL
    `);
    await db.query(`
      UPDATE booking_services bs
      INNER JOIN (
        SELECT bookingId, roomId, MIN(id) AS detailId, COUNT(*) AS cnt
        FROM booking_details
        GROUP BY bookingId, roomId
        HAVING cnt = 1
      ) bd ON bd.bookingId = bs.bookingId AND bd.roomId = bs.roomId
      SET bs.bookingDetailId = bd.detailId
      WHERE bs.bookingDetailId IS NULL AND bs.roomId IS NOT NULL
    `);
    await db.query(`
      UPDATE booking_damage_charges bdc
      INNER JOIN (
        SELECT bookingId, roomId, MIN(id) AS detailId, COUNT(*) AS cnt
        FROM booking_details
        GROUP BY bookingId, roomId
        HAVING cnt = 1
      ) bd ON bd.bookingId = bdc.bookingId AND bd.roomId = bdc.roomId
      SET bdc.bookingDetailId = bd.detailId
      WHERE bdc.bookingDetailId IS NULL AND bdc.roomId IS NOT NULL
    `);
  } catch (err) {
    console.warn('Backfill bookingDetailId warning:', err.message);
  }

  // Backfill dữ liệu lịch sử an toàn cho booking_services
  await db.query(`
    UPDATE booking_services
    SET unitPrice = ROUND(totalPrice / quantity, 2)
    WHERE (unitPrice IS NULL OR unitPrice = 0)
      AND quantity > 0
      AND totalPrice > 0
  `);
  await db.query(`
    UPDATE booking_services
    SET status = 'used'
    WHERE status IS NULL OR status = ''
  `);
  await db.query(`
    UPDATE booking_services
    SET usedAt = createdAt
    WHERE status = 'used' AND usedAt IS NULL AND createdAt IS NOT NULL
  `);

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS checkout_late_fee_tiers (
        id INT NOT NULL PRIMARY KEY,
        graceMinutes INT NOT NULL DEFAULT 60,
        tier1MaxHours DECIMAL(4,1) NOT NULL DEFAULT 3.0,
        tier1Percent DECIMAL(5,2) NOT NULL DEFAULT 30.00,
        tier2MaxHours DECIMAL(4,1) NOT NULL DEFAULT 6.0,
        tier2Percent DECIMAL(5,2) NOT NULL DEFAULT 50.00,
        tier3Percent DECIMAL(5,2) NOT NULL DEFAULT 100.00,
        updatedAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        standardCheckOutTime TIME NOT NULL DEFAULT '12:00:00',
        standardCheckInTime TIME NOT NULL DEFAULT '14:00:00',
        housekeepingBufferMinutes INT NOT NULL DEFAULT 60,
        absoluteMaxLateHours DECIMAL(4,1) NOT NULL DEFAULT 6.0
      )
    `);
    const [lateFeeTierRows] = await db.query('SELECT id FROM checkout_late_fee_tiers WHERE id = 1');
    if (lateFeeTierRows.length === 0) {
      await db.query(
        `INSERT INTO checkout_late_fee_tiers
          (id, graceMinutes, tier1MaxHours, tier1Percent, tier2MaxHours, tier2Percent, tier3Percent,
           standardCheckOutTime, standardCheckInTime, housekeepingBufferMinutes, absoluteMaxLateHours)
         VALUES (1, 60, 3.0, 30.00, 6.0, 50.00, 100.00, '12:00:00', '14:00:00', 60, 6.0)`
      );
    }
  } catch (err) {
    console.error('Lỗi khi khởi tạo checkout_late_fee_tiers:', err.message);
  }

  // cancellation_policies cũng là bảng cấu hình 1 dòng (id=1), dùng cho % hoàn
  // tiền khi hủy phòng và hiển thị giờ nhận/trả phòng chuẩn cho khách. Cùng lý
  // do như trên: tạo bảng + seed mặc định nếu thiếu, tránh phụ thuộc vào việc
  // import đúng file SQL dump có sẵn data.
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS cancellation_policies (
        id INT NOT NULL PRIMARY KEY,
        nearTierMaxDays INT NOT NULL DEFAULT 3,
        nearTierPercent DECIMAL(5,2) NOT NULL DEFAULT 100.00,
        midTierMaxDays INT NOT NULL DEFAULT 7,
        midTierPercent DECIMAL(5,2) NOT NULL DEFAULT 50.00,
        farTierPercent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        noShowGraceHours INT NOT NULL DEFAULT 6,
        noShowVoucherPercent DECIMAL(5,2) NOT NULL DEFAULT 10.00,
        hotelCancelRefundPercent DECIMAL(5,2) NOT NULL DEFAULT 100.00,
        updatedAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        standardCheckInTime TIME NOT NULL DEFAULT '14:00:00',
        standardCheckOutTime TIME NOT NULL DEFAULT '12:00:00'
      )
    `);
    const [cancellationPolicyRows] = await db.query('SELECT id FROM cancellation_policies WHERE id = 1');
    if (cancellationPolicyRows.length === 0) {
      await db.query(
        `INSERT INTO cancellation_policies
          (id, nearTierMaxDays, nearTierPercent, midTierMaxDays, midTierPercent, farTierPercent,
           noShowGraceHours, noShowVoucherPercent, hotelCancelRefundPercent, standardCheckInTime, standardCheckOutTime)
         VALUES (1, 3, 100.00, 7, 50.00, 0.00, 6, 10.00, 100.00, '14:00:00', '12:00:00')`
      );
    }
  } catch (err) {
    console.error('Lỗi khi khởi tạo cancellation_policies:', err.message);
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

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS booking_late_checkout_charges (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        bookingId INT NOT NULL,
        lateMinutes INT NOT NULL,
        tierPercent DECIMAL(5,2) NOT NULL,
        nightlyRate DECIMAL(15,2) NOT NULL,
        totalPrice DECIMAL(15,2) NOT NULL,
        note VARCHAR(255) DEFAULT NULL,
        createdAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
  } catch (err) {
    console.error('Lỗi khi khởi tạo booking_late_checkout_charges:', err.message);
  }
};

module.exports = ensureOperationalSchema;

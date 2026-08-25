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
  if (!bookingColumns.some((column) => column.Field === 'hold_expires_at')) {
    await db.query(
      'ALTER TABLE bookings ADD COLUMN hold_expires_at DATETIME NULL DEFAULT NULL AFTER check_out'
    );
  }
  if (!bookingColumns.some((column) => column.Field === 'hold_reset_count')) {
    await db.query(
      'ALTER TABLE bookings ADD COLUMN hold_reset_count INT NOT NULL DEFAULT 0 AFTER hold_expires_at'
    );
  }
  if (!bookingColumns.some((column) => column.Field === 'last_hold_reset_at')) {
    await db.query(
      'ALTER TABLE bookings ADD COLUMN last_hold_reset_at DATETIME NULL DEFAULT NULL AFTER hold_reset_count'
    );
  }
  if (!bookingColumns.some((column) => column.Field === 'lateArrivalConfirmed')) {
    await db.query(
      'ALTER TABLE bookings ADD COLUMN lateArrivalConfirmed TINYINT(1) NOT NULL DEFAULT 0 AFTER actualCheckInTime'
    );
  }
  if (!bookingColumns.some((column) => column.Field === 'lateArrivalNote')) {
    await db.query(
      'ALTER TABLE bookings ADD COLUMN lateArrivalNote TEXT NULL AFTER lateArrivalConfirmed'
    );
  }
  if (!bookingColumns.some((column) => column.Field === 'lateArrivalConfirmedAt')) {
    await db.query(
      'ALTER TABLE bookings ADD COLUMN lateArrivalConfirmedAt DATETIME NULL DEFAULT NULL AFTER lateArrivalNote'
    );
  }
  if (!bookingColumns.some((column) => column.Field === 'lateArrivalConfirmedBy')) {
    await db.query(
      'ALTER TABLE bookings ADD COLUMN lateArrivalConfirmedBy INT NULL DEFAULT NULL AFTER lateArrivalConfirmedAt'
    );
  }
  if (!bookingColumns.some((column) => column.Field === 'contactResult')) {
    await db.query(
      'ALTER TABLE bookings ADD COLUMN contactResult VARCHAR(50) NULL DEFAULT NULL AFTER lateArrivalConfirmedBy'
    );
  }
  // Khởi tạo hold_expires_at cho các đơn cũ chưa có giá trị
  await db.query(`
    UPDATE bookings
    SET hold_expires_at = DATE_ADD(created_at, INTERVAL 15 MINUTE)
    WHERE hold_expires_at IS NULL AND created_at IS NOT NULL
  `);

  await db.query(
    `UPDATE vouchers SET discountType = 'percentage' WHERE discountType = 'percent'`
  );

  const [notifCols] = await db.query('DESCRIBE notifications');
  if (!notifCols.some((c) => c.Field === 'type')) {
    await db.query("ALTER TABLE notifications ADD COLUMN type VARCHAR(50) DEFAULT 'general' AFTER accountId");
  }
  if (!notifCols.some((c) => c.Field === 'referenceType')) {
    await db.query("ALTER TABLE notifications ADD COLUMN referenceType VARCHAR(50) NULL DEFAULT NULL AFTER content");
  }
  if (!notifCols.some((c) => c.Field === 'referenceId')) {
    await db.query("ALTER TABLE notifications ADD COLUMN referenceId INT NULL DEFAULT NULL AFTER referenceType");
  }

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

  // Lưu dấu vết các thay đổi quan trọng trên phòng, kể cả khi phòng đã bị xóa mềm.
  await db.query(`
    CREATE TABLE IF NOT EXISTS room_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      roomId INT NOT NULL,
      roomNumber VARCHAR(50) NOT NULL,
      action VARCHAR(50) NOT NULL,
      oldValue JSON NULL,
      newValue JSON NULL,
      performedBy INT NULL,
      performedByName VARCHAR(255) NULL,
      performedByRole VARCHAR(50) NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_room_audit_room_created (roomId, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

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
    if (!bookingDetailColumns.some((column) => column.Field === 'childrenAges')) {
      await db.query(
        'ALTER TABLE booking_details ADD COLUMN childrenAges JSON NULL AFTER children'
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
    // Hạng phòng của từng dòng, cần cho đơn đặt nhiều hạng khác nhau. Câu truy
    // vấn danh sách đặt phòng đọc cột này (BOOKING_SELECT), nên thiếu nó là
    // GET /api/bookings trả 500 và cả trang quản lý đặt phòng trắng xóa. Bản
    // hotelbookingdb.sql chưa có cột này nên máy nào import mới cũng dính.
    // Tên gợi nhớ khách tự đặt cho từng phòng lúc đặt online ("Phòng bố mẹ").
    // Khách chưa biết số phòng thật nên với các phòng cùng hạng đây là cách duy
    // nhất để phân biệt khi gán dịch vụ, và để lễ tân biết mang đồ tới phòng nào.
    if (!bookingDetailColumns.some((column) => column.Field === 'roomLabel')) {
      await db.query(
        'ALTER TABLE booking_details ADD COLUMN roomLabel VARCHAR(60) NULL DEFAULT NULL AFTER roomId'
      );
    }
    if (!bookingDetailColumns.some((column) => column.Field === 'roomTypeId')) {
      await db.query(
        'ALTER TABLE booking_details ADD COLUMN roomTypeId INT NULL DEFAULT NULL AFTER roomId'
      );
      // Suy ngược hạng phòng cho dữ liệu cũ từ chính phòng đã xếp.
      await db.query(`
        UPDATE booking_details bd
        JOIN rooms r ON r.id = bd.roomId
        SET bd.roomTypeId = r.roomTypeId
        WHERE bd.roomTypeId IS NULL
      `);
    }
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS booking_guests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bookingId INT NOT NULL,
      fullName VARCHAR(255) NOT NULL,
      identityNumber VARCHAR(50) NULL,
      phone VARCHAR(30) NULL,
      note TEXT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE
    )
  `);

  // Luồng check-in nhanh cho phép khai báo CCCD sau. Validator và model đều
  // đã dùng NULL khi chưa có CCCD, nên schema cũ NOT NULL làm API check-in trả
  // 500 dù dữ liệu nghiệp vụ hợp lệ.
  const [bookingGuestColumns] = await db.query('DESCRIBE booking_guests');
  const identityColumn = bookingGuestColumns.find((column) => column.Field === 'identityNumber');
  if (identityColumn && identityColumn.Null === 'NO') {
    await db.query('ALTER TABLE booking_guests MODIFY identityNumber VARCHAR(50) NULL');
  }

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
    WHERE status IS NULL OR status = '' OR status = 'unused'
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
      INDEX idx_gateway_orders_payment (paymentId, status),
      INDEX idx_gateway_orders_expiry (status, expiresAt),
      FOREIGN KEY (paymentId) REFERENCES payments(id) ON DELETE CASCADE,
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE
    )
  `);

  // Ví của khách: tiền hoàn được cộng vào ví (refund_credit), khách rút ra
  // (withdrawal) hoặc dùng để thanh toán booking (booking_payment).
  // Số dư khả dụng = credit approved - withdrawal pending/approved - booking_payment approved.
  await db.query(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL,
      refundId INT NULL,
      bookingId INT NULL,
      paymentId INT NULL,
      type ENUM('refund_credit', 'withdrawal', 'booking_payment') NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved',
      idempotencyKey VARCHAR(100) NULL,
      refundMethod ENUM('cash', 'bank_transfer') NULL,
      bankBin VARCHAR(10) NULL,
      bankName VARCHAR(100) NULL,
      accountNumber VARCHAR(30) NULL,
      accountName VARCHAR(100) NULL,
      note TEXT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      processedAt DATETIME NULL,
      UNIQUE KEY uq_wallet_idempotency (customerId, idempotencyKey),
      INDEX idx_wallet_customer_created (customerId, createdAt, id),
      INDEX idx_wallet_payment (paymentId, type),
      FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
    )
  `);

  // CREATE TABLE IF NOT EXISTS không nâng cấp database đã có. Bổ sung từng
  // cột/index để các bản dữ liệu cũ cũng thanh toán ví an toàn.
  const [walletColumns] = await db.query('DESCRIBE wallet_transactions');
  const walletTypeColumn = walletColumns.find((column) => column.Field === 'type');
  if (!String(walletTypeColumn?.Type || '').includes("'booking_payment'")) {
    await db.query(
      "ALTER TABLE wallet_transactions MODIFY COLUMN type ENUM('refund_credit', 'withdrawal', 'booking_payment') NOT NULL"
    );
  }
  if (!walletColumns.some((column) => column.Field === 'paymentId')) {
    await db.query(
      'ALTER TABLE wallet_transactions ADD COLUMN paymentId INT NULL AFTER bookingId'
    );
  }
  if (!walletColumns.some((column) => column.Field === 'idempotencyKey')) {
    await db.query(
      'ALTER TABLE wallet_transactions ADD COLUMN idempotencyKey VARCHAR(100) NULL AFTER status'
    );
  }

  const [walletIndexes] = await db.query('SHOW INDEX FROM wallet_transactions');
  const hasWalletIndex = (name) => walletIndexes.some((index) => index.Key_name === name);
  const walletIdempotencyColumns = walletIndexes
    .filter((index) => index.Key_name === 'uq_wallet_idempotency')
    .sort((first, second) => Number(first.Seq_in_index) - Number(second.Seq_in_index))
    .map((index) => index.Column_name);
  if (
    walletIdempotencyColumns.length > 0
    && (
      walletIdempotencyColumns.length !== 2
      || walletIdempotencyColumns[0] !== 'customerId'
      || walletIdempotencyColumns[1] !== 'idempotencyKey'
    )
  ) {
    await db.query('ALTER TABLE wallet_transactions DROP INDEX uq_wallet_idempotency');
  }
  if (
    walletIdempotencyColumns.length === 0
    || walletIdempotencyColumns.length !== 2
    || walletIdempotencyColumns[0] !== 'customerId'
    || walletIdempotencyColumns[1] !== 'idempotencyKey'
  ) {
    await db.query(
      'ALTER TABLE wallet_transactions ADD UNIQUE KEY uq_wallet_idempotency (customerId, idempotencyKey)'
    );
  }
  if (!hasWalletIndex('idx_wallet_customer_created')) {
    await db.query(
      'ALTER TABLE wallet_transactions ADD INDEX idx_wallet_customer_created (customerId, createdAt, id)'
    );
  }
  if (!hasWalletIndex('idx_wallet_payment')) {
    await db.query(
      'ALTER TABLE wallet_transactions ADD INDEX idx_wallet_payment (paymentId, type)'
    );
  }

  // Key-value store for admin-configurable settings (e.g. payment receiving account).
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      settingKey VARCHAR(100) PRIMARY KEY,
      settingValue TEXT NOT NULL,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Giới hạn voucher theo hạng phòng. Không có dòng nào cho một voucher nghĩa
  // là voucher đó dùng được cho mọi hạng phòng, nên các voucher cũ giữ nguyên
  // hành vi sau khi nâng cấp.
  await db.query(`
    CREATE TABLE IF NOT EXISTS voucher_room_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      voucherId INT NOT NULL,
      roomTypeId INT NOT NULL,
      UNIQUE KEY uniq_voucher_room_type (voucherId, roomTypeId),
      FOREIGN KEY (voucherId) REFERENCES vouchers(id) ON DELETE CASCADE,
      FOREIGN KEY (roomTypeId) REFERENCES room_types(id) ON DELETE CASCADE
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

  // Bảng giá phòng theo ngày lễ, cuối tuần / chủ nhật và ngày thường
  await db.query(`
    CREATE TABLE IF NOT EXISTS room_prices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      roomTypeId INT NULL,
      startDate DATE NOT NULL,
      endDate DATE NOT NULL,
      price DECIMAL(15,2) NOT NULL,
      priceType VARCHAR(50) NOT NULL DEFAULT 'normal',
      note VARCHAR(255) NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (roomTypeId) REFERENCES room_types(id) ON DELETE CASCADE
    )
  `);

  const [rpColumns] = await db.query('DESCRIBE room_prices');
  if (!rpColumns.some((col) => col.Field === 'note')) {
    await db.query('ALTER TABLE room_prices ADD COLUMN note VARCHAR(255) NULL AFTER priceType');
  }

  // Giá từng đêm được CHỐT tại thời điểm đặt. Lưu kèm loại giá (ngày lễ, chủ nhật...) và phòng tương ứng.
  await db.query(`
    CREATE TABLE IF NOT EXISTS booking_nightly_prices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bookingId INT NOT NULL,
      stayDate DATE NOT NULL,
      price DECIMAL(15,2) NOT NULL DEFAULT 0,
      priceType VARCHAR(50) NOT NULL DEFAULT 'normal',
      note VARCHAR(255) NULL,
      roomId INT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_booking_night (bookingId, stayDate),
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE
    )
  `);

  const [bnpColumns] = await db.query('DESCRIBE booking_nightly_prices');
  if (!bnpColumns.some((col) => col.Field === 'priceType')) {
    await db.query("ALTER TABLE booking_nightly_prices ADD COLUMN priceType VARCHAR(50) NOT NULL DEFAULT 'normal' AFTER price");
  }
  if (!bnpColumns.some((col) => col.Field === 'note')) {
    await db.query('ALTER TABLE booking_nightly_prices ADD COLUMN note VARCHAR(255) NULL AFTER priceType');
  }
  if (!bnpColumns.some((col) => col.Field === 'roomId')) {
    await db.query('ALTER TABLE booking_nightly_prices ADD COLUMN roomId INT NULL AFTER note');
  }

  // Tự động đồng bộ / tạo bảng giá từng đêm cho các đơn đặt phòng cũ chưa có
  try {
    const [missingNightlyBookings] = await db.query(`
      SELECT b.id, b.room_id, b.check_in, b.check_out, b.total_price,
             COALESCE(MAX(bd.roomPrice), MAX(rt.defaultPrice), 0) AS room_price,
             COALESCE(MAX(r.roomTypeId), MAX(rt.id)) AS roomTypeId,
             MAX(rt.defaultPrice) AS defaultPrice
      FROM bookings b
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      LEFT JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
      LEFT JOIN room_types rt ON rt.id = r.roomTypeId
      WHERE b.check_in IS NOT NULL AND b.check_out IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM booking_nightly_prices bnp WHERE bnp.bookingId = b.id)
      GROUP BY b.id, b.room_id, b.check_in, b.check_out, b.total_price
    `);

    if (missingNightlyBookings.length > 0) {
      const bookingService = require('./services/bookingService');
      const bookingModel = require('./models/bookingModel');
      for (const mb of missingNightlyBookings) {
        try {
          const checkInStr = mb.check_in instanceof Date ? mb.check_in.toISOString().slice(0, 10) : String(mb.check_in).slice(0, 10);
          const checkOutStr = mb.check_out instanceof Date ? mb.check_out.toISOString().slice(0, 10) : String(mb.check_out).slice(0, 10);
          const calc = await bookingService.calcNightlyPrices(
            mb.roomTypeId,
            Number(mb.room_price || mb.defaultPrice || 0),
            checkInStr,
            checkOutStr,
            db,
            mb.room_id
          );
          if (calc.prices && calc.prices.length > 0) {
            await bookingModel.saveNightlyPrices(mb.id, calc.prices, db);
          }
        } catch (itemErr) {
          console.warn(`Backfill nightly prices for booking #${mb.id} warning:`, itemErr.message);
        }
      }
      console.log(`Đã đồng bộ biểu giá từng đêm cho ${missingNightlyBookings.length} đơn đặt phòng cũ.`);
    }
  } catch (syncErr) {
    console.warn('Backfill missing nightly prices error:', syncErr.message);
  }

  // Dấu vết lịch sử thao tác trên từng đặt phòng: ai làm gì, lúc nào.
  // Mọi hành động (đặt, gia hạn, chuyển phòng, thêm dịch vụ, check-in/out,
  // thanh toán, hoàn tiền...) đều được ghi lại kèm người thực hiện và thời điểm.
  await db.query(`
    CREATE TABLE IF NOT EXISTS booking_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bookingId INT NOT NULL,
      action VARCHAR(50) NOT NULL,
      entityType VARCHAR(30) NOT NULL DEFAULT 'booking',
      entityId INT NULL,
      entityLabel VARCHAR(255) NULL,
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

  // Liên kết mỗi mốc lịch sử với đối tượng bị tác động. Khối này
  // phải chạy sau CREATE TABLE để cả database cũ lẫn database tạo mới đều có
  // đủ cột ngay trong lần khởi động đầu tiên.
  const [historyColumns] = await db.query('DESCRIBE booking_history');
  const hasHistoryColumn = (name) => historyColumns.some((column) => column.Field === name);
  if (!hasHistoryColumn('entityType')) {
    await db.query(
      "ALTER TABLE booking_history ADD COLUMN entityType VARCHAR(30) NOT NULL DEFAULT 'booking' AFTER action"
    );
  }
  if (!hasHistoryColumn('entityId')) {
    await db.query('ALTER TABLE booking_history ADD COLUMN entityId INT NULL AFTER entityType');
  }
  if (!hasHistoryColumn('entityLabel')) {
    await db.query('ALTER TABLE booking_history ADD COLUMN entityLabel VARCHAR(255) NULL AFTER entityId');
  }

  // Các dòng legacy được thêm trước khi có entityType đều mang giá trị
  // mặc định "booking". Phân loại lại theo action, nhưng không ghi đè những
  // dòng đã được gán nhóm cụ thể bởi code mới.
  await db.query(`
    UPDATE booking_history
    SET entityType = 'booking'
    WHERE entityType IS NULL OR TRIM(entityType) = ''
  `);
  await db.query(`
    UPDATE booking_history
    SET entityType = CASE
      WHEN action IN (
        'payment', 'payment_requested', 'transfer_confirmation', 'voucher_applied',
        'refund', 'refund_approved', 'refund_rejected'
      ) THEN 'payment'
      WHEN action IN (
        'service_added', 'service_updated', 'service_status_updated', 'service_removed'
      ) THEN 'service'
      WHEN action IN (
        'damage_added', 'damage_updated', 'damage_status_updated', 'damage_removed'
      ) THEN 'damage'
      WHEN action IN (
        'checked_in', 'checked_out', 'extended', 'shortened', 'stay_updated',
        'extended_and_transferred', 'late_checkout_fee', 'late_checkout_fee_waived',
        'late_checkout_over_limit'
      ) THEN 'stay'
      WHEN action IN ('room_reassigned', 'room_transferred') THEN 'room'
      ELSE entityType
    END
    WHERE entityType = 'booking'
      AND action IN (
        'payment', 'payment_requested', 'transfer_confirmation', 'voucher_applied',
        'refund', 'refund_approved', 'refund_rejected',
        'service_added', 'service_updated', 'service_status_updated', 'service_removed',
        'damage_added', 'damage_updated', 'damage_status_updated', 'damage_removed',
        'checked_in', 'checked_out', 'extended', 'shortened', 'stay_updated',
        'extended_and_transferred', 'late_checkout_fee', 'late_checkout_fee_waived',
        'late_checkout_over_limit', 'room_reassigned', 'room_transferred'
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
        absoluteMaxLateHours DECIMAL(4,1) NOT NULL DEFAULT 6.0,
        earlyTier1Hours DECIMAL(4,1) NOT NULL DEFAULT 8.0,
        earlyTier1Percent DECIMAL(5,2) NOT NULL DEFAULT 100.00,
        earlyTier2Hours DECIMAL(4,1) NOT NULL DEFAULT 5.0,
        earlyTier2Percent DECIMAL(5,2) NOT NULL DEFAULT 50.00,
        earlyTier3Hours DECIMAL(4,1) NOT NULL DEFAULT 2.0,
        earlyTier3Percent DECIMAL(5,2) NOT NULL DEFAULT 30.00
      )
    `);
    const [lateFeeTierRows] = await db.query('SELECT id FROM checkout_late_fee_tiers WHERE id = 1');
    if (lateFeeTierRows.length === 0) {
      await db.query(
        `INSERT INTO checkout_late_fee_tiers
          (id, graceMinutes, tier1MaxHours, tier1Percent, tier2MaxHours, tier2Percent, tier3Percent,
           standardCheckOutTime, standardCheckInTime, housekeepingBufferMinutes, absoluteMaxLateHours,
           earlyTier1Hours, earlyTier1Percent, earlyTier2Hours, earlyTier2Percent, earlyTier3Hours, earlyTier3Percent)
         VALUES (1, 60, 3.0, 30.00, 6.0, 50.00, 100.00, '12:00:00', '14:00:00', 60, 6.0, 8.0, 100.00, 5.0, 50.00, 2.0, 30.00)`
      );
    } else {
      const [cols] = await db.query('SHOW COLUMNS FROM checkout_late_fee_tiers');
      const colNames = cols.map(c => c.Field);
      if (!colNames.includes('earlyTier1Hours')) {
        await db.query('ALTER TABLE checkout_late_fee_tiers ADD COLUMN earlyTier1Hours DECIMAL(4,1) NOT NULL DEFAULT 8.0 AFTER absoluteMaxLateHours');
      }
      if (!colNames.includes('earlyTier1Percent')) {
        await db.query('ALTER TABLE checkout_late_fee_tiers ADD COLUMN earlyTier1Percent DECIMAL(5,2) NOT NULL DEFAULT 100.00 AFTER earlyTier1Hours');
      }
      if (!colNames.includes('earlyTier2Hours')) {
        await db.query('ALTER TABLE checkout_late_fee_tiers ADD COLUMN earlyTier2Hours DECIMAL(4,1) NOT NULL DEFAULT 5.0 AFTER earlyTier1Percent');
      }
      if (!colNames.includes('earlyTier2Percent')) {
        await db.query('ALTER TABLE checkout_late_fee_tiers ADD COLUMN earlyTier2Percent DECIMAL(5,2) NOT NULL DEFAULT 50.00 AFTER earlyTier2Hours');
      }
      if (!colNames.includes('earlyTier3Hours')) {
        await db.query('ALTER TABLE checkout_late_fee_tiers ADD COLUMN earlyTier3Hours DECIMAL(4,1) NOT NULL DEFAULT 2.0 AFTER earlyTier2Percent');
      }
      if (!colNames.includes('earlyTier3Percent')) {
        await db.query('ALTER TABLE checkout_late_fee_tiers ADD COLUMN earlyTier3Percent DECIMAL(5,2) NOT NULL DEFAULT 30.00 AFTER earlyTier3Hours');
      }
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

  // Lưu yêu cầu đặt lại mật khẩu. Chỉ giữ bản băm của token để người đọc được
  // cơ sở dữ liệu cũng không chiếm được tài khoản.
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        accountId INT NOT NULL,
        tokenHash CHAR(64) NOT NULL,
        expiresAt DATETIME NOT NULL,
        usedAt DATETIME DEFAULT NULL,
        createdAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_reset_token (tokenHash),
        KEY idx_reset_account (accountId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
  } catch (err) {
    console.error('Lỗi khi khởi tạo password_reset_tokens:', err.message);
  }

  // Đồng bộ hai cột trạng thái của đơn đặt phòng.
  //
  // bookings có cả `status` lẫn `bookingStatus`. Mã nguồn luôn ghi cùng lúc cùng
  // giá trị vào cả hai (xem updateBookingStatus), nên chỗ nào lệch nhau đều là
  // dữ liệu cũ. Lệch thì mỗi màn hình đọc một cột sẽ cho ra con số khác nhau:
  // ô "Booking chờ xác nhận" ở Bảng điều khiển đếm theo bookingStatus, còn bảng
  // danh sách đọc theo status. Ngoài ra dữ liệu cũ còn lẫn giá trị sai chính tả
  // 'checkout' bên cạnh 'checked_out' chuẩn.
  try {
    await db.query(`
      UPDATE bookings
      SET bookingStatus = CASE bookingStatus
            WHEN 'checkout' THEN 'checked_out'
            WHEN 'checkin' THEN 'checked_in'
            WHEN 'no-show' THEN 'no_show'
            ELSE bookingStatus END,
          status = CASE status
            WHEN 'checkout' THEN 'checked_out'
            WHEN 'checkin' THEN 'checked_in'
            WHEN 'no-show' THEN 'no_show'
            ELSE status END
      WHERE status IN ('checkout', 'checkin', 'no-show')
         OR bookingStatus IN ('checkout', 'checkin', 'no-show')
    `);

    // Còn lệch thì lấy giai đoạn muộn hơn trong vòng đời: đơn đã trả phòng không
    // thể quay ngược về chờ xác nhận.
    const [conflicts] = await db.query(`
      SELECT id, status, bookingStatus
      FROM bookings
      WHERE bookingStatus IS NOT NULL AND bookingStatus <> status
    `);

    const stage = {
      pending: 0,
      confirmed: 1,
      checked_in: 2,
      checked_out: 3,
      no_show: 4,
      cancelled: 5
    };

    for (const row of conflicts) {
      const winner =
        (stage[row.bookingStatus] ?? -1) >= (stage[row.status] ?? -1)
          ? row.bookingStatus
          : row.status;
      await db.query('UPDATE bookings SET status = ?, bookingStatus = ? WHERE id = ?', [
        winner,
        winner,
        row.id
      ]);
    }

    if (conflicts.length > 0) {
      console.log(`Đã đồng bộ trạng thái cho ${conflicts.length} đơn có hai cột lệch nhau.`);
    }
  } catch (err) {
    console.error('Lỗi khi đồng bộ trạng thái đơn đặt phòng:', err.message);
  }

  // Sửa các đơn bị đánh No-show oan.
  //
  // Job quét đơn quá hạn từng không xét thời điểm đặt, nên đơn đặt trong ngày
  // nhận phòng mà sau giờ chốt check-in muộn (VD đặt 20:11 khi hạn là 20:00) bị
  // đánh no-show chỉ vài giây sau khi tạo, trước cả lúc khách kịp trả tiền.
  // Chỉ mở lại những đơn chắc chắn sai: đã trả đủ tiền VÀ ngày trả phòng chưa
  // tới. Theo đúng luật của chính đoạn mã đó, đơn trả đủ tiền chỉ được chuyển
  // no-show sau khi hết hạn trả phòng, nên các đơn này không thể đúng được.
  try {
    // Ngày trả phòng thật nằm ở booking_details; cột bookings.check_out có thể
    // NULL. Phải lấy từ booking_details trước, và đơn nào không tra ra được ngày
    // thì bỏ qua chứ không đoán là hôm nay — đoán sai sẽ mở lại cả những đơn
    // no-show hoàn toàn đúng của các kỳ nghỉ đã kết thúc từ lâu.
    const [wrongNoShow] = await db.query(`
      SELECT b.id
      FROM bookings b
      JOIN payments p ON p.id = (SELECT MAX(p2.id) FROM payments p2 WHERE p2.bookingId = b.id)
      WHERE COALESCE(b.bookingStatus, b.status) = 'no_show'
        AND b.actualCheckInTime IS NULL
        AND COALESCE(p.paidAmount, 0) > 0
        AND COALESCE(p.remainingAmount, 0) <= 0
        AND p.paymentStatus = 'paid'
        AND COALESCE(
              (SELECT MAX(DATE(bd.checkOutDate)) FROM booking_details bd WHERE bd.bookingId = b.id),
              DATE(b.check_out)
            ) >= CURDATE()
    `);

    for (const row of wrongNoShow) {
      await db.query(
        "UPDATE bookings SET status = 'confirmed', bookingStatus = 'confirmed' WHERE id = ?",
        [row.id]
      );
      await db.query(
        `INSERT INTO booking_history
           (bookingId, action, description, oldValue, newValue, performedByName, performedByRole)
         VALUES (?, 'status_change', ?, ?, ?, 'system', 'system')`,
        [
          row.id,
          'Đơn đã thanh toán đủ và chưa tới ngày trả phòng nhưng bị đánh là khách không đến do lỗi quét đơn quá hạn. Hệ thống trả lại trạng thái đã xác nhận.',
          JSON.stringify({ status: 'no_show' }),
          JSON.stringify({ status: 'confirmed' })
        ]
      );
    }

    if (wrongNoShow.length > 0) {
      console.log(`Đã trả lại trạng thái cho ${wrongNoShow.length} đơn bị đánh No-show oan.`);
    }
  } catch (err) {
    console.error('Lỗi khi sửa các đơn bị đánh No-show oan:', err.message);
  }

  // Dọn dẹp các đơn checked_in cũ đã quá ngày trả phòng (hoặc phòng đã được trả/trống)
  try {
    const [staleCheckedIn] = await db.query(`
      SELECT b.id
      FROM bookings b
      WHERE b.status = 'checked_in'
        AND (
          COALESCE(
            (SELECT MAX(DATE(bd.checkOutDate)) FROM booking_details bd WHERE bd.bookingId = b.id),
            DATE(b.check_out)
          ) < CURDATE()
          OR NOT EXISTS (
            SELECT 1 FROM rooms r
            LEFT JOIN booking_details bd2 ON bd2.roomId = r.id
            WHERE COALESCE(bd2.roomId, b.room_id) = r.id AND r.status = 'occupied'
          )
        )
    `);

    for (const row of staleCheckedIn) {
      await db.query(
        "UPDATE bookings SET status = 'checked_out', bookingStatus = 'checked_out' WHERE id = ?",
        [row.id]
      );
    }

    if (staleCheckedIn.length > 0) {
      console.log(`Đã tự động cập nhật trạng thái trả phòng cho ${staleCheckedIn.length} đơn cũ quá hạn.`);
    }
  } catch (err) {
    console.error('Lỗi khi tự động dọn dẹp các đơn checked_in cũ quá hạn:', err.message);
  }

  // Trước đây không nơi nào ghi bookingCode nên toàn bộ đơn cũ đang để trống.
  // Điền lại theo id để hóa đơn và các màn hình tra cứu có mã hiển thị.
  try {
    await db.query(`
      UPDATE bookings
      SET bookingCode = CONCAT('BK', LPAD(id, 6, '0'))
      WHERE bookingCode IS NULL OR bookingCode = ''
    `);
  } catch (err) {
    console.error('Lỗi khi điền bookingCode cho đơn cũ:', err.message);
  }

  // ── Dịch vụ phát sinh: Cột customerId & guestName ──
  try {
    const [bsCols] = await db.query('DESCRIBE booking_services');
    if (!bsCols.some((col) => col.Field === 'customerId')) {
      await db.query('ALTER TABLE booking_services ADD COLUMN customerId INT NULL AFTER roomId');
    }
    if (!bsCols.some((col) => col.Field === 'guestName')) {
      await db.query('ALTER TABLE booking_services ADD COLUMN guestName VARCHAR(255) NULL AFTER customerId');
    }
  } catch (err) {
    console.warn('Lỗi bổ sung cột customerId/guestName cho booking_services:', err.message);
  }

  // ── Vật dụng hỏng: Bổ sung compensationPrice cho bảng amenities ──
  try {
    const [amenityCols] = await db.query('DESCRIBE amenities');
    if (!amenityCols.some((col) => col.Field === 'compensationPrice')) {
      await db.query('ALTER TABLE amenities ADD COLUMN compensationPrice DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER icon');
    }

    // Nạp giá bồi thường đề xuất mặc định cho một số vật dụng phổ biến
    const defaultPrices = [
      { name: 'TV', price: 3000000 },
      { name: 'Tivi', price: 3000000 },
      { name: 'Tủ lạnh', price: 2500000 },
      { name: 'Máy sấy tóc', price: 300000 },
      { name: 'Ấm siêu tốc', price: 250000 },
      { name: 'Điều hòa', price: 1500000 },
      { name: 'Remote điều hòa', price: 200000 },
      { name: 'Ly thủy tinh', price: 50000 },
      { name: 'Khăn tắm', price: 150000 },
      { name: 'Chăn ga gối', price: 350000 },
      { name: 'Bình hoa', price: 100000 },
      { name: 'Khóa cửa', price: 500000 }
    ];

    for (const item of defaultPrices) {
      await db.query(
        'UPDATE amenities SET compensationPrice = ? WHERE LOWER(name) LIKE ? AND (compensationPrice = 0 OR compensationPrice IS NULL)',
        [item.price, `%${item.name.toLowerCase()}%`]
      );
    }
  } catch (err) {
    console.warn('Lỗi nâng cấp giá đền bù cho amenities:', err.message);
  }

  // Giá bồi thường của từng vật dụng thực tế trong phòng.
  try {
    const [roomItemTables] = await db.query("SHOW TABLES LIKE 'room_items'");
    if (roomItemTables.length > 0) {
      const [roomItemColumns] = await db.query('DESCRIBE room_items');
      if (!roomItemColumns.some((column) => column.Field === 'compensationPrice')) {
        await db.query(
          'ALTER TABLE room_items ADD COLUMN compensationPrice DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER quantity'
        );
      }

      const defaultItemPrices = [
        ['TV', 3000000],
        ['Tivi', 3000000],
        ['Remote', 200000],
        ['Điều khiển từ xa', 200000],
        ['Hair Dryer', 300000],
        ['Máy sấy tóc', 300000],
        ['Mini Bar', 2500000],
        ['Tủ lạnh minibar', 2500000],
        ['Kettle', 250000],
        ['Ấm siêu tốc', 250000],
        ['Wardrobe', 2000000],
        ['Tủ quần áo', 2000000],
        ['Air Conditioner', 1500000],
        ['Điều hòa', 1500000],
        ['Mirror', 500000],
        ['Gương', 500000],
        ['Desk Lamp', 250000],
        ['Đèn bàn', 250000],
        ['Chăn', 500000],
        ['Ga giường', 300000],
        ['Gối', 200000],
        ['Đệm', 5000000]
      ];
      for (const [itemName, price] of defaultItemPrices) {
        await db.query(
          `UPDATE room_items SET compensationPrice = ?
           WHERE LOWER(TRIM(itemName)) = LOWER(?)
             AND (compensationPrice IS NULL OR compensationPrice = 0)`,
          [price, itemName]
        );
      }

      const vietnameseItemNames = [
        ['TV', 'Tivi'],
        ['Remote', 'Điều khiển từ xa'],
        ['Hair Dryer', 'Máy sấy tóc'],
        ['Mini Bar', 'Tủ lạnh minibar'],
        ['Kettle', 'Ấm siêu tốc'],
        ['Wardrobe', 'Tủ quần áo'],
        ['Air Conditioner', 'Điều hòa'],
        ['Mirror', 'Gương'],
        ['Desk Lamp', 'Đèn bàn']
      ];
      for (const [englishName, vietnameseName] of vietnameseItemNames) {
        await db.query(
          'UPDATE room_items SET itemName = ? WHERE LOWER(TRIM(itemName)) = LOWER(?)',
          [vietnameseName, englishName]
        );
      }

      // Every active room receives the complete standard equipment list.
      const standardRoomItems = [
        ['Tivi', 3000000],
        ['Điều khiển từ xa', 200000],
        ['Máy sấy tóc', 300000],
        ['Tủ lạnh minibar', 2500000],
        ['Ấm siêu tốc', 250000],
        ['Tủ quần áo', 2000000],
        ['Điều hòa', 1500000],
        ['Gương', 500000],
        ['Đèn bàn', 250000],
        ['Chăn', 500000],
        ['Ga giường', 300000],
        ['Gối', 200000],
        ['Đệm', 5000000]
      ];
      for (const [itemName, compensationPrice] of standardRoomItems) {
        await db.query(
          `INSERT INTO room_items (roomId, itemName, quantity, compensationPrice, status)
           SELECT r.id, ?, 1, ?, 'normal'
           FROM rooms r
           WHERE COALESCE(r.isDeleted, 0) = 0
             AND NOT EXISTS (
               SELECT 1 FROM room_items ri
               WHERE ri.roomId = r.id
                 AND LOWER(TRIM(ri.itemName)) = LOWER(?)
             )`,
          [itemName, compensationPrice, itemName]
        );
      }

      // Tách danh mục chăn ga gối đệm cũ thành từng vật dụng.
      // Bản ghi đã có báo hỏng được giữ lại để không làm mất lịch sử.
      const legacyBeddingName = 'Chăn ga gối đệm';
      const [damageReportTables] = await db.query("SHOW TABLES LIKE 'damage_reports'");
      if (damageReportTables.length > 0) {
        await db.query(
          `UPDATE room_items ri
           SET ri.itemName = 'Chăn ga gối đệm (dữ liệu cũ)',
               ri.quantity = 0,
               ri.status = 'maintenance'
           WHERE LOWER(TRIM(ri.itemName)) = LOWER(?)
             AND EXISTS (
               SELECT 1 FROM damage_reports dr WHERE dr.roomItemId = ri.id
             )`,
          [legacyBeddingName]
        );
        await db.query(
          `DELETE ri FROM room_items ri
           WHERE LOWER(TRIM(ri.itemName)) = LOWER(?)
             AND NOT EXISTS (
               SELECT 1 FROM damage_reports dr WHERE dr.roomItemId = ri.id
             )`,
          [legacyBeddingName]
        );
      } else {
        await db.query(
          'DELETE FROM room_items WHERE LOWER(TRIM(itemName)) = LOWER(?)',
          [legacyBeddingName]
        );
      }
    }
  } catch (err) {
    console.warn('Lỗi nâng cấp giá bồi thường cho room_items:', err.message);
  }

  // ── Bảng thông báo khách hàng (Notifications) ──
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        accountId INT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'info',
        title VARCHAR(255) NOT NULL,
        content TEXT NULL,
        referenceType VARCHAR(50) NULL DEFAULT NULL,
        referenceId INT NULL DEFAULT NULL,
        isRead TINYINT(1) NOT NULL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notifications_account (accountId),
        INDEX idx_notifications_reference (referenceType, referenceId)
      )
    `);
  } catch (err) {
    console.warn('Lỗi tạo bảng notifications:', err.message);
  }

  // ── Lịch các ngày lễ & Tết ──
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        calendarType ENUM('solar', 'lunar_variable', 'custom') NOT NULL DEFAULT 'solar',
        year INT NULL,
        startDate DATE NOT NULL,
        endDate DATE NOT NULL,
        surchargePercent DECIMAL(5,2) NOT NULL DEFAULT 10.00,
        isRecurring BOOLEAN DEFAULT FALSE,
        description TEXT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    const [existingHolidays] = await db.query('SELECT COUNT(*) AS count FROM holidays');
    if (existingHolidays[0].count === 0) {
      const initialHolidays = [
        // Lễ cố định hàng năm
        { name: 'Tết Dương Lịch', type: 'solar', year: null, start: '2026-01-01', end: '2026-01-01', percent: 10.0, recurring: 1, desc: 'Tết Dương Lịch hàng năm' },
        { name: 'Kỳ nghỉ 30/4 - 1/5', type: 'solar', year: null, start: '2026-04-30', end: '2026-05-01', percent: 10.0, recurring: 1, desc: 'Ngày Giải phóng & Quốc tế Lao động' },
        { name: 'Quốc khánh 2/9', type: 'solar', year: null, start: '2026-09-02', end: '2026-09-02', percent: 10.0, recurring: 1, desc: 'Kỳ nghỉ Quốc khánh 2/9' },

        // Tết Âm lịch 2025
        { name: 'Tết Nguyên Đán 2025 (Ất Tỵ)', type: 'lunar_variable', year: 2025, start: '2025-01-27', end: '2025-02-02', percent: 10.0, recurring: 0, desc: 'Tết Âm lịch (từ 28 Tết đến Mùng 5 Tết)' },
        { name: 'Giỗ tổ Hùng Vương 2025', type: 'lunar_variable', year: 2025, start: '2025-04-07', end: '2025-04-07', percent: 10.0, recurring: 0, desc: '10/3 Âm lịch' },

        // Tết Âm lịch 2026
        { name: 'Tết Nguyên Đán 2026 (Bính Ngọ)', type: 'lunar_variable', year: 2026, start: '2026-02-15', end: '2026-02-22', percent: 10.0, recurring: 0, desc: 'Tết Âm lịch (từ 28 Tết đến Mùng 5 Tết)' },
        { name: 'Giỗ tổ Hùng Vương 2026', type: 'lunar_variable', year: 2026, start: '2026-04-26', end: '2026-04-26', percent: 10.0, recurring: 0, desc: '10/3 Âm lịch' },

        // Tết Âm lịch 2027
        { name: 'Tết Nguyên Đán 2027 (Đinh Mùi)', type: 'lunar_variable', year: 2027, start: '2027-02-05', end: '2027-02-12', percent: 10.0, recurring: 0, desc: 'Tết Âm lịch (từ 28 Tết đến Mùng 5 Tết)' },
        { name: 'Giỗ tổ Hùng Vương 2027', type: 'lunar_variable', year: 2027, start: '2027-04-15', end: '2027-04-15', percent: 10.0, recurring: 0, desc: '10/3 Âm lịch' },

        // Tết Âm lịch 2028
        { name: 'Tết Nguyên Đán 2028 (Mậu Thân)', type: 'lunar_variable', year: 2028, start: '2028-01-25', end: '2028-02-01', percent: 10.0, recurring: 0, desc: 'Tết Âm lịch' },

        // Tết Âm lịch 2029
        { name: 'Tết Nguyên Đán 2029 (Kỷ Dậu)', type: 'lunar_variable', year: 2029, start: '2029-02-12', end: '2029-02-19', percent: 10.0, recurring: 0, desc: 'Tết Âm lịch' },

        // Tết Âm lịch 2030
        { name: 'Tết Nguyên Đán 2030 (Canh Tuất)', type: 'lunar_variable', year: 2030, start: '2030-02-01', end: '2030-02-08', percent: 10.0, recurring: 0, desc: 'Tết Âm lịch' }
      ];

      for (const h of initialHolidays) {
        await db.query(
          `INSERT INTO holidays (name, calendarType, year, startDate, endDate, surchargePercent, isRecurring, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [h.name, h.type, h.year, h.start, h.end, h.percent, h.recurring, h.desc]
        );
      }
      console.log('Đã tạo danh mục Lịch các ngày lễ & Tết Âm lịch mặc định.');
    }
  } catch (err) {
    console.error('Lỗi khi tạo bảng hoặc nạp lịch ngày lễ:', err.message);
  }
};

module.exports = ensureOperationalSchema;

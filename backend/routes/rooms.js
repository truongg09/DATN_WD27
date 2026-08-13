const express = require('express');
const db = require('../config/db');
const roomTypeService = require('../services/roomTypeService');

const { requireAuth, requireStaff } = require('../middleware/auth');

const router = express.Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Các đơn còn ràng buộc với một phòng: đơn chưa kết thúc, hoặc đơn đang có
// phiên thanh toán mở ở cổng (khách đang đứng ở màn hình trả tiền).
// Dùng COALESCE(bd.roomId, b.room_id) để không bỏ sót đơn cũ chưa có dòng
// booking_details, và LEFT JOIN để một đơn nhiều phòng vẫn được nhận diện.
const ACTIVE_BOOKING_FOR_ROOM_SQL = `
  SELECT
    b.id,
    b.status,
    b.holdExpiresAt,
    COALESCE(b.guest_name, c.fullName) AS customerName,
    COALESCE(p.paidAmount, 0) AS paidAmount,
    COALESCE(p.paymentStatus, 'unpaid') AS paymentStatus,
    EXISTS (
      SELECT 1 FROM payment_gateway_orders pgo
      WHERE pgo.bookingId = b.id AND pgo.status = 'created' AND pgo.expiresAt > NOW()
    ) AS hasOpenGatewayOrder
  FROM bookings b
  LEFT JOIN booking_details bd ON bd.bookingId = b.id
  LEFT JOIN customers c ON c.id = b.customerId
  LEFT JOIN payments p ON p.id = (
    SELECT p2.id FROM payments p2 WHERE p2.bookingId = b.id ORDER BY p2.id DESC LIMIT 1
  )
  WHERE COALESCE(bd.roomId, b.room_id) = ?
    AND b.status NOT IN ('cancelled', 'checked_out', 'no_show')
  GROUP BY b.id
`;

// Mô tả ngắn gọn vì sao phòng đang bị khoá, để lễ tân biết vướng đơn nào.
const describeBlockingBookings = (bookings) => {
  const paying = bookings.filter(
    (item) => Number(item.hasOpenGatewayOrder) === 1 || Number(item.paidAmount) > 0
  );
  const detail = bookings
    .slice(0, 3)
    .map((item) => `#${item.id}${item.customerName ? ` (${item.customerName})` : ''}`)
    .join(', ');
  const more = bookings.length > 3 ? ` và ${bookings.length - 3} đơn khác` : '';

  if (paying.length > 0) {
    return `Khách đang thanh toán cho phòng này (đơn ${detail}${more}). Vui lòng đợi khách hoàn tất hoặc hủy đơn trước.`;
  }
  return `Phòng đang có đơn đặt chưa hoàn tất: ${detail}${more}. Hãy xử lý các đơn này trước.`;
};

// Chỉ nhận cặp ngày hợp lệ; thiếu hoặc sai định dạng thì coi như tìm không kèm ngày
const parseDateRangeQuery = (query) => {
  const { checkIn, checkOut } = query;
  if (!checkIn || !checkOut) return {};
  if (!DATE_PATTERN.test(checkIn) || !DATE_PATTERN.test(checkOut) || checkOut <= checkIn) {
    return null;
  }
  return { checkIn, checkOut };
};

const ROOM_SELECT = `
  SELECT 
    r.id, 
    r.roomTypeId AS room_type_id, 
    r.roomTypeId AS roomTypeId, 
    r.roomNumber,
    r.floor,
    r.area,
    r.status,
    r.maintenanceNote,
    r.maintenanceExpectedCompletion,
    rt.typeName AS room_type_name,
    rt.typeName AS typeName,
    rt.defaultPrice AS price_per_night,
    rt.defaultPrice AS defaultPrice,
    rt.capacity,
    rt.adultCapacity,
    rt.childCapacity,
    rt.maxOccupancy,
    rt.extraAdultFee,
    rt.extraChildFee,
    rt.description AS room_type_description,
    rt.description AS description
  FROM rooms r 
  JOIN room_types rt ON rt.id = r.roomTypeId
`;

const parseRoomId = (id) => {
  const roomId = Number(id);
  if (!Number.isInteger(roomId) || roomId <= 0) {
    return null;
  }
  return roomId;
};

router.get('/', async (req, res) => {
  try {
    console.log('=== GET ROOMS CALLED ===');
    const [rooms] = await db.query(`${ROOM_SELECT} WHERE r.isDeleted = 0 ORDER BY r.id ASC`);
    console.log('=== GET ROOMS SUCCESS ===');
    console.log('Found', rooms.length, 'rooms');
    res.json({ data: rooms });
  } catch (error) {
    console.error('=== GET ROOMS ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      message: 'Lỗi máy chủ nội bộ',
      details: error.message,
      code: error.code
    });
  }
});

router.get('/types', async (req, res) => {
  try {
    console.log('=== GET ROOM TYPES CALLED ===');
    const [roomTypes] = await db.query(`
      SELECT 
        rt.*, 
        COUNT(DISTINCT r.id) AS roomCount, 
        COUNT(DISTINCT CASE WHEN r.status = 'available' THEN r.id END) AS availableCount,
        COUNT(DISTINCT CASE WHEN r.status = 'occupied' THEN r.id END) AS occupiedCount,
        COUNT(DISTINCT CASE WHEN r.status = 'maintenance' THEN r.id END) AS maintenanceCount,
        COUNT(DISTINCT CASE WHEN r.status = 'reserved' THEN r.id END) AS reservedCount,
        GROUP_CONCAT(DISTINCT r.roomNumber ORDER BY r.roomNumber ASC SEPARATOR ', ') AS roomNumbers,
        GROUP_CONCAT(DISTINCT rta.amenityId) AS amenityIds
      FROM room_types rt 
      LEFT JOIN rooms r ON r.roomTypeId = rt.id AND r.isDeleted = 0
      LEFT JOIN room_type_amenities rta ON rta.roomTypeId = rt.id
      WHERE rt.isDeleted = 0
      GROUP BY rt.id 
      ORDER BY rt.id ASC
    `);
    console.log('=== GET ROOM TYPES SUCCESS ===');
    console.log('Found', roomTypes.length, 'room types');
    res.json({ data: roomTypes });
  } catch (error) {
    console.error('=== GET ROOM TYPES ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      message: 'Lỗi máy chủ nội bộ',
      details: error.message,
      code: error.code
    });
  }
});

// Tìm hạng phòng cho khách: ảnh, tiện nghi, đánh giá, số phòng trống + tổng giá theo khoảng ngày
router.get('/types/search', async (req, res) => {
  try {
    const dateRange = parseDateRangeQuery(req.query);
    if (dateRange === null) {
      return res.status(400).json({ message: 'checkIn/checkOut phải theo định dạng YYYY-MM-DD và checkOut sau checkIn' });
    }
    const data = await roomTypeService.searchRoomTypes({
      ...dateRange,
      guests: req.query.guests
    });
    res.json({ data });
  } catch (error) {
    console.error('Search room types error:', error);
    res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : 'Lỗi máy chủ nội bộ'
    });
  }
});

// Chi tiết một hạng phòng (gallery, tiện nghi, đánh giá, phòng trống theo ngày nếu có)
router.get('/types/:id', async (req, res) => {
  try {
    const roomTypeId = parseRoomId(req.params.id);
    if (!roomTypeId) {
      return res.status(400).json({ message: 'Mã hạng phòng không hợp lệ' });
    }
    const dateRange = parseDateRangeQuery(req.query);
    if (dateRange === null) {
      return res.status(400).json({ message: 'checkIn/checkOut phải theo định dạng YYYY-MM-DD và checkOut sau checkIn' });
    }
    const data = await roomTypeService.getRoomTypeDetail(roomTypeId, dateRange);
    res.json({ data });
  } catch (error) {
    console.error('Get room type detail error:', error);
    res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : 'Lỗi máy chủ nội bộ'
    });
  }
});

const validateCapacityFields = (body) => {
  const adultCap = Number(body.adultCapacity);
  const childCap = Number(body.childCapacity);
  const maxOcc = Number(body.maxOccupancy);
  const exAdultFee = Number(body.extraAdultFee);
  const exChildFee = Number(body.extraChildFee);

  if (!Number.isInteger(adultCap) || adultCap < 1) {
    return 'Sức chứa người lớn tiêu chuẩn (adultCapacity) phải là số nguyên lớn hơn hoặc bằng 1';
  }
  if (!Number.isInteger(childCap) || childCap < 0) {
    return 'Sức chứa trẻ em tiêu chuẩn (childCapacity) phải là số nguyên lớn hơn hoặc bằng 0';
  }
  if (!Number.isInteger(maxOcc) || maxOcc < (adultCap + childCap)) {
    return `Tổng sức chứa tối đa (${maxOcc}) phải lớn hơn hoặc bằng sức chứa tiêu chuẩn (${adultCap + childCap})`;
  }
  if (!Number.isFinite(exAdultFee) || exAdultFee < 0) {
    return 'Đơn giá phụ thu người lớn (extraAdultFee) phải lớn hơn hoặc bằng 0';
  }
  if (!Number.isFinite(exChildFee) || exChildFee < 0) {
    return 'Đơn giá phụ thu trẻ em (extraChildFee) phải lớn hơn hoặc bằng 0';
  }
  return null;
};

// Create new room type
router.post('/types', requireAuth, requireStaff, async (req, res) => {
  try {
    const { typeName, defaultPrice, description, status, amenityIds } = req.body;

    const adultCap = req.body.adultCapacity !== undefined ? Number(req.body.adultCapacity) : 2;
    const childCap = req.body.childCapacity !== undefined ? Number(req.body.childCapacity) : 1;
    const maxOcc = req.body.maxOccupancy !== undefined ? Number(req.body.maxOccupancy) : (adultCap + childCap);
    const exAdultFee = req.body.extraAdultFee !== undefined ? Number(req.body.extraAdultFee) : 200000;
    const exChildFee = req.body.extraChildFee !== undefined ? Number(req.body.extraChildFee) : 100000;
    const cap = req.body.capacity !== undefined ? Number(req.body.capacity) : maxOcc;

    const validationError = validateCapacityFields({
      adultCapacity: adultCap,
      childCapacity: childCap,
      maxOccupancy: maxOcc,
      extraAdultFee: exAdultFee,
      extraChildFee: exChildFee
    });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const [result] = await db.query(
      `INSERT INTO room_types (typeName, capacity, adultCapacity, childCapacity, maxOccupancy, extraAdultFee, extraChildFee, defaultPrice, description, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [typeName, cap, adultCap, childCap, maxOcc, exAdultFee, exChildFee, defaultPrice, description, status || 'active']
    );

    // Save amenities
    if (Array.isArray(amenityIds) && amenityIds.length > 0) {
      const values = amenityIds.map(amenityId => [result.insertId, amenityId]);
      await db.query('INSERT INTO room_type_amenities (roomTypeId, amenityId) VALUES ?', [values]);
    }

    res.status(201).json({ data: { id: result.insertId }, message: 'Thêm hạng phòng thành công' });
  } catch (error) {
    console.error('Create room type error:', error);
    res.status(500).json({ message: 'Internal server error', details: error.message });
  }
});

// Update room type
router.put('/types/:id', requireAuth, requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const { typeName, defaultPrice, description, status, amenityIds } = req.body;

    const adultCap = req.body.adultCapacity !== undefined ? Number(req.body.adultCapacity) : 2;
    const childCap = req.body.childCapacity !== undefined ? Number(req.body.childCapacity) : 1;
    const maxOcc = req.body.maxOccupancy !== undefined ? Number(req.body.maxOccupancy) : (adultCap + childCap);
    const exAdultFee = req.body.extraAdultFee !== undefined ? Number(req.body.extraAdultFee) : 200000;
    const exChildFee = req.body.extraChildFee !== undefined ? Number(req.body.extraChildFee) : 100000;
    const cap = req.body.capacity !== undefined ? Number(req.body.capacity) : maxOcc;

    const validationError = validateCapacityFields({
      adultCapacity: adultCap,
      childCapacity: childCap,
      maxOccupancy: maxOcc,
      extraAdultFee: exAdultFee,
      extraChildFee: exChildFee
    });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    await db.query(
      `UPDATE room_types 
       SET typeName = ?, capacity = ?, adultCapacity = ?, childCapacity = ?, maxOccupancy = ?, extraAdultFee = ?, extraChildFee = ?, defaultPrice = ?, description = ?, status = ? 
       WHERE id = ?`,
      [typeName, cap, adultCap, childCap, maxOcc, exAdultFee, exChildFee, defaultPrice, description, status, id]
    );

    // Update amenities
    await db.query('DELETE FROM room_type_amenities WHERE roomTypeId = ?', [id]);
    if (Array.isArray(amenityIds) && amenityIds.length > 0) {
      const values = amenityIds.map(amenityId => [id, amenityId]);
      await db.query('INSERT INTO room_type_amenities (roomTypeId, amenityId) VALUES ?', [values]);
    }

    res.json({ message: 'Cập nhật hạng phòng thành công' });
  } catch (error) {
    console.error('Update room type error:', error);
    res.status(500).json({ message: 'Internal server error', details: error.message });
  }
});

// Delete room type
router.delete('/types/:id', requireAuth, requireStaff, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if there are rooms belonging to this room type
    const [rooms] = await db.query('SELECT id FROM rooms WHERE roomTypeId = ? AND isDeleted = 0', [id]);
    if (rooms.length > 0) {
      return res.status(400).json({ 
        message: `Không thể xóa hạng phòng này vì đang có ${rooms.length} phòng hoạt động thuộc hạng này!` 
      });
    }

    // Now soft delete the room type
    await db.query('UPDATE room_types SET isDeleted = 1 WHERE id = ?', [id]);
    res.json({ message: 'Xóa hạng phòng thành công' });
  } catch (error) {
    console.error('Delete room type error:', error);
    res.status(500).json({ message: 'Lỗi khi xóa hạng phòng', details: error.message });
  }
});

// Get room by id
router.get('/:id', async (req, res) => {
  try {
    console.log('=== GET ROOM BY ID CALLED, id:', req.params.id);
    const { id } = req.params;
    console.log('1. Executing room query');
    const [rooms] = await db.query(`
      SELECT r.id, r.roomNumber, r.floor, r.area, r.status, r.roomTypeId,
             rt.typeName as room_type_name, rt.description as room_type_description, 
             rt.capacity, rt.adultCapacity, rt.childCapacity, rt.maxOccupancy, rt.extraAdultFee, rt.extraChildFee, rt.defaultPrice as price_per_night,
             (SELECT imageUrl FROM room_images WHERE roomTypeId = rt.id LIMIT 1) AS imageUrl
      FROM rooms r
      JOIN room_types rt ON r.roomTypeId = rt.id
      WHERE r.id = ? AND r.isDeleted = 0
    `, [id]);
    console.log('2. Room query result:', rooms);

    if (rooms.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy phòng' });
    }

    console.log('3. Executing images query');
    // Get all images for this room type
    const [images] = await db.query('SELECT imageUrl FROM room_images WHERE roomTypeId = ?', [rooms[0].roomTypeId]);
    rooms[0].images = images.map(img => img.imageUrl);
    console.log('4. Images query result:', images);

    console.log('5. Executing amenities query');
    // Get all amenities for this room type
    const [amenities] = await db.query(`
      SELECT a.name, a.icon
      FROM amenities a
      JOIN room_type_amenities rta ON a.id = rta.amenityId
      WHERE rta.roomTypeId = ?
    `, [rooms[0].roomTypeId]);
    rooms[0].db_amenities = amenities;
    console.log('6. Amenities query result:', amenities);

    console.log('7. Executing reviews query');
    // Get all reviews for this room
    const [reviews] = await db.query(`
      SELECT rev.id, rev.rating, rev.comment, rev.createdAt AS createdAt, a.email AS customerName
      FROM reviews rev
      JOIN customers c ON c.id = rev.customerId
      JOIN accounts a ON a.id = c.accountId
      JOIN bookings b ON b.id = rev.bookingId
      JOIN booking_details bd ON bd.bookingId = b.id
      WHERE bd.roomId = ?
      ORDER BY rev.createdAt DESC
    `, [id]);
    rooms[0].db_reviews = reviews;
    console.log('8. Reviews query result:', reviews);

    console.log('9. Sending response');
    res.json({ data: rooms[0] });
  } catch (error) {
    console.error('=== GET ROOM ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('SQL:', error.sql);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      message: 'Lỗi máy chủ nội bộ',
      details: error.message,
      code: error.code
    });
  }
});

// Create rooms in bulk
router.post('/bulk', requireAuth, requireStaff, async (req, res) => {
  try {
    const { rooms } = req.body;
    
    if (!Array.isArray(rooms) || rooms.length === 0) {
      return res.status(400).json({ message: 'Danh sách phòng không hợp lệ!' });
    }

    const roomNumbers = rooms.map(r => String(r.roomNumber).trim());
    const [existing] = await db.query('SELECT roomNumber FROM rooms WHERE roomNumber IN (?) AND isDeleted = 0', [roomNumbers]);
    
    if (existing.length > 0) {
      const existingNumbers = existing.map(e => e.roomNumber).join(', ');
      return res.status(400).json({ 
        message: `Các số phòng sau đã tồn tại trong hệ thống: ${existingNumbers}` 
      });
    }

    const values = rooms.map(r => [
      String(r.roomNumber).trim(),
      r.roomTypeId,
      r.floor,
      r.area || 0,
      r.status || 'available'
    ]);

    await db.query(
      'INSERT INTO rooms (roomNumber, roomTypeId, floor, area, status) VALUES ?',
      [values]
    );

    res.status(201).json({ message: `Đã tạo thành công ${rooms.length} phòng mới hàng loạt!` });
  } catch (error) {
    console.error('Bulk create rooms error:', error);
    res.status(500).json({ message: 'Lỗi khi tạo phòng hàng loạt', details: error.message });
  }
});

// Create new room
router.post('/', requireAuth, requireStaff, async (req, res) => {
  try {
    const { roomNumber, roomTypeId, floor, area, status, maintenanceNote, maintenanceExpectedCompletion } = req.body;
    
    // Check if room number already exists
    const [existing] = await db.query('SELECT id FROM rooms WHERE roomNumber = ? AND isDeleted = 0', [roomNumber]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Số phòng này đã tồn tại!' });
    }

    const [result] = await db.query(
      'INSERT INTO rooms (roomNumber, roomTypeId, floor, area, status, maintenanceNote, maintenanceExpectedCompletion) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [roomNumber, roomTypeId, floor, area, status || 'available', maintenanceNote || null, maintenanceExpectedCompletion || null]
    );
    res.status(201).json({ data: { id: result.insertId }, message: 'Tạo phòng mới thành công' });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Update room
router.put('/:id', requireAuth, requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const { roomNumber, roomTypeId, floor, area, status, maintenanceNote, maintenanceExpectedCompletion } = req.body;

    // Check if room number already exists for another room
    const [existing] = await db.query('SELECT id FROM rooms WHERE roomNumber = ? AND id != ? AND isDeleted = 0', [roomNumber, id]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Số phòng này đã tồn tại!' });
    }

    await db.query(
      'UPDATE rooms SET roomNumber = ?, roomTypeId = ?, floor = ?, area = ?, status = ?, maintenanceNote = ?, maintenanceExpectedCompletion = ? WHERE id = ?',
      [roomNumber, roomTypeId, floor, area, status, maintenanceNote !== undefined ? maintenanceNote : null, maintenanceExpectedCompletion !== undefined ? maintenanceExpectedCompletion : null, id]
    );
    res.json({ message: 'Cập nhật phòng thành công' });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

// Delete room
router.delete('/:id', requireAuth, requireStaff, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { id } = req.params;

    // Kiểm tra và xóa phải nằm trong cùng một giao dịch, có khóa dòng phòng.
    // Nếu tách rời, khách vẫn kịp thanh toán xong trong khoảng thời gian giữa
    // lúc kiểm tra và lúc ghi isDeleted = 1, dẫn tới khách trả tiền cho phòng
    // vừa bị gỡ khỏi hệ thống.
    await connection.beginTransaction();

    const [rooms] = await connection.query(
      'SELECT status, roomNumber FROM rooms WHERE id = ? AND isDeleted = 0 FOR UPDATE',
      [id]
    );
    if (rooms.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy phòng!' });
    }

    if (rooms[0].status === 'occupied') {
      await connection.rollback();
      return res.status(400).json({ message: 'Không thể xóa phòng đang có khách ở!' });
    }

    const [activeBookings] = await connection.query(ACTIVE_BOOKING_FOR_ROOM_SQL, [id]);

    if (activeBookings.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: describeBlockingBookings(activeBookings),
        details: {
          roomNumber: rooms[0].roomNumber,
          blockingBookings: activeBookings.map((item) => ({
            id: item.id,
            status: item.status,
            customerName: item.customerName,
            isPaying: Number(item.hasOpenGatewayOrder) === 1 || Number(item.paidAmount) > 0
          }))
        }
      });
    }

    await connection.query('UPDATE rooms SET isDeleted = 1 WHERE id = ?', [id]);
    await connection.commit();

    res.json({ message: 'Xóa phòng thành công' });
  } catch (error) {
    await connection.rollback();
    console.error('Delete room error:', error);
    res.status(500).json({
      message: 'Lỗi khi xóa phòng',
      details: error.message
    });
  } finally {
    connection.release();
  }
});

module.exports = router;

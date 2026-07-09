const express = require('express');
const db = require('../config/db');
const roomTypeService = require('../services/roomTypeService');

const router = express.Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
    rt.typeName AS room_type_name,
    rt.typeName AS typeName,
    rt.defaultPrice AS price_per_night,
    rt.defaultPrice AS defaultPrice,
    rt.capacity,
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
    const [rooms] = await db.query(`${ROOM_SELECT} ORDER BY r.id ASC`);
    console.log('=== GET ROOMS SUCCESS ===');
    console.log('Found', rooms.length, 'rooms');
    res.json({ data: rooms });
  } catch (error) {
    console.error('=== GET ROOMS ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      message: 'Internal server error', 
      details: error.message,
      code: error.code
    });
  }
});

router.get('/types', async (req, res) => {
  try {
    console.log('=== GET ROOM TYPES CALLED ===');
    const [roomTypes] = await db.query('SELECT * FROM room_types ORDER BY id ASC');
    console.log('=== GET ROOM TYPES SUCCESS ===');
    console.log('Found', roomTypes.length, 'room types');
    res.json({ data: roomTypes });
  } catch (error) {
    console.error('=== GET ROOM TYPES ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      message: 'Internal server error', 
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
      message: error.statusCode ? error.message : 'Internal server error'
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
      message: error.statusCode ? error.message : 'Internal server error'
    });
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
             rt.capacity, rt.defaultPrice as price_per_night,
             (SELECT imageUrl FROM room_images WHERE roomTypeId = rt.id LIMIT 1) AS imageUrl
      FROM rooms r
      JOIN room_types rt ON r.roomTypeId = rt.id
      WHERE r.id = ?
    `, [id]);
    console.log('2. Room query result:', rooms);

    if (rooms.length === 0) {
      return res.status(404).json({ message: 'Room not found' });
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
      message: 'Internal server error', 
      details: error.message,
      code: error.code
    });
  }
});

// Create new room
router.post('/', async (req, res) => {
  try {
    const { roomNumber, roomTypeId, floor, area, status } = req.body;
    
    // Check if room number already exists
    const [existing] = await db.query('SELECT id FROM rooms WHERE roomNumber = ?', [roomNumber]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Số phòng này đã tồn tại!' });
    }

    const [result] = await db.query(
      'INSERT INTO rooms (roomNumber, roomTypeId, floor, area, status) VALUES (?, ?, ?, ?, ?)',
      [roomNumber, roomTypeId, floor, area, status || 'available']
    );
    res.status(201).json({ data: { id: result.insertId }, message: 'Tạo phòng mới thành công' });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update room
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { roomNumber, roomTypeId, floor, area, status } = req.body;

    // Check if room number already exists for another room
    const [existing] = await db.query('SELECT id FROM rooms WHERE roomNumber = ? AND id != ?', [roomNumber, id]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Số phòng này đã tồn tại!' });
    }

    await db.query(
      'UPDATE rooms SET roomNumber = ?, roomTypeId = ?, floor = ?, area = ?, status = ? WHERE id = ?',
      [roomNumber, roomTypeId, floor, area, status, id]
    );
    res.json({ message: 'Cập nhật phòng thành công' });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete room
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First delete all records from tables that reference this room (to avoid foreign key errors)
    await db.query('DELETE FROM booking_details WHERE roomId = ?', [id]);
    await db.query('DELETE FROM room_items WHERE roomId = ?', [id]);

    // Now delete the room
    await db.query('DELETE FROM rooms WHERE id = ?', [id]);

    res.json({ message: 'Xóa phòng thành công' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ 
      message: 'Lỗi khi xóa phòng', 
      details: error.message 
    });
  }
});

module.exports = router;

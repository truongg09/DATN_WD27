const express = require('express');
const db = require('../config/db');

const router = express.Router();

const ROOM_SELECT = `
  SELECT
    r.id,
    r.roomTypeId AS room_type_id,
    r.roomNumber AS room_number,
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
    const [rooms] = await db.query(`${ROOM_SELECT} ORDER BY r.id ASC`);
    res.json({ data: rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const roomId = parseRoomId(req.params.id);
    if (!roomId) {
      return res.status(400).json({ message: 'Invalid room id' });
    }

    const [rooms] = await db.query(`${ROOM_SELECT} WHERE r.id = ?`, [roomId]);

    if (rooms.length === 0) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json({ data: rooms[0] });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

const express = require('express');
const db = require('../config/db');
const router = express.Router();

// Get all rooms
router.get('/', async (req, res) => {
  try {
    const [rooms] = await db.query(`
      SELECT r.*, rt.name as room_type_name, rt.price_per_night, rt.capacity, rt.description as room_type_description
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
    `);
    res.json({ data: rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get room by id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rooms] = await db.query(`
      SELECT r.*, rt.name as room_type_name, rt.price_per_night, rt.capacity, rt.description as room_type_description
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE r.id = ?
    `, [id]);

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
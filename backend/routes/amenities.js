const express = require('express');
const db = require('../config/db');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [amenities] = await db.query('SELECT * FROM amenities');
    res.json({ data: amenities });
  } catch (error) {
    console.error('Get amenities error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
});

module.exports = router;

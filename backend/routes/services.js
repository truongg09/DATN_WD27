const express = require('express');
const db = require('../config/db');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const [services] = await db.query(
      'SELECT id, serviceName, price, description FROM services ORDER BY id ASC'
    );
    res.json({ data: services });
  } catch (error) {
    console.error('List services error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

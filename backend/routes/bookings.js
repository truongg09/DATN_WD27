const express = require('express');
const bookingController = require('../controllers/bookingController');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/check-availability', bookingController.checkAvailability);
router.post('/', optionalAuth, bookingController.createBooking);
router.get('/', bookingController.listBookings);
router.get('/:id', bookingController.getBookingById);
router.patch('/:id/cancel', bookingController.cancelBooking);
router.patch('/:id/check-in', bookingController.checkIn);
router.patch('/:id/check-out', bookingController.checkOut);

module.exports = router;

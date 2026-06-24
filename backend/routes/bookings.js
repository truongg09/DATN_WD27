const express = require('express');
const bookingController = require('../controllers/bookingController');
const { optionalAuth, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/check-availability', bookingController.checkAvailability);
router.post('/check-type-availability', bookingController.checkTypeAvailability);
router.post('/', optionalAuth, bookingController.createBooking);
router.get('/me', requireAuth, bookingController.listMyBookings);
router.get('/', bookingController.listBookings);
router.get('/:id', optionalAuth, bookingController.getBookingById);
router.patch('/:id/cancel', optionalAuth, bookingController.cancelBooking);
router.post('/:id/guests', bookingController.saveGuestIdentities);
router.post('/:id/services', bookingController.addServiceCharge);
router.post('/:id/damages', bookingController.addDamageCharge);
router.patch('/:id/extend', bookingController.extendStay);
router.patch('/:id/transfer-room', bookingController.transferRoom);
router.patch('/:id/check-in', bookingController.checkIn);
router.patch('/:id/check-out', bookingController.checkOut);
router.patch('/:id/no-show', bookingController.markNoShow);

module.exports = router;

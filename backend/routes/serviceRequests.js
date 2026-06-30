const express = require('express');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

// Service requests made by customers at booking time.
// GET    /api/service-requests           -> list (optional ?status=pending|confirmed|rejected)
// PATCH  /api/service-requests/:id/confirm -> charge the service to the booking & recalc payment
// PATCH  /api/service-requests/:id/reject  -> mark the request as rejected
router.get('/', bookingController.listServiceRequests);
router.patch('/:id/confirm', bookingController.confirmServiceRequest);
router.patch('/:id/reject', bookingController.rejectServiceRequest);

module.exports = router;

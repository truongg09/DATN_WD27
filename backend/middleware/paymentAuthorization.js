const db = require('../config/db');

const STAFF_ROLES = new Set(['admin', 'employee', 'staff']);

const requireStaff = (req, res, next) => {
  if (!STAFF_ROLES.has(req.user?.role)) {
    return res.status(403).json({ message: 'Admin or receptionist permission required' });
  }

  return next();
};

const requirePaymentAccess = async (req, res, next) => {
  if (STAFF_ROLES.has(req.user?.role)) {
    return next();
  }

  try {
    const paymentId = Number(req.params.id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return res.status(400).json({ message: 'Invalid payment id' });
    }

    const [rows] = await db.query(
      `SELECT b.user_id
       FROM payments p
       JOIN bookings b ON b.id = p.bookingId
       WHERE p.id = ?
       LIMIT 1`,
      [paymentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (Number(rows[0].user_id) !== Number(req.user?.userId)) {
      return res.status(403).json({ message: 'Cannot access another customer payment' });
    }

    return next();
  } catch (error) {
    console.error('Payment authorization error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const requireBookingPaymentAccess = async (req, res, next) => {
  if (STAFF_ROLES.has(req.user?.role)) {
    return next();
  }

  try {
    const bookingId = Number(req.params.bookingId);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: 'Invalid booking id' });
    }

    const [rows] = await db.query(
      'SELECT user_id FROM bookings WHERE id = ? LIMIT 1',
      [bookingId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (Number(rows[0].user_id) !== Number(req.user?.userId)) {
      return res.status(403).json({ message: 'Cannot access another customer booking payment' });
    }

    return next();
  } catch (error) {
    console.error('Booking payment authorization error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  requireStaff,
  requirePaymentAccess,
  requireBookingPaymentAccess
};

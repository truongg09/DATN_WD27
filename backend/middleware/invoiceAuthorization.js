const db = require('../config/db');

const STAFF_ROLES = new Set(['admin', 'employee', 'staff']);

const requireInvoiceAccess = async (req, res, next) => {
  if (STAFF_ROLES.has(req.user?.role)) return next();

  try {
    const invoiceId = Number(req.params.id);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return res.status(400).json({ message: 'Invalid invoice id' });
    }
    const [rows] = await db.query(
      `SELECT b.user_id FROM invoices i
       JOIN bookings b ON b.id = i.bookingId
       WHERE i.id = ? LIMIT 1`,
      [invoiceId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Invoice not found' });
    if (Number(rows[0].user_id) !== Number(req.user?.userId)) {
      return res.status(403).json({ message: 'Cannot access another customer invoice' });
    }
    return next();
  } catch (error) {
    console.error('Invoice authorization error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { requireInvoiceAccess };

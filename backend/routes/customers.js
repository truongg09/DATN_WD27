const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');

const router = express.Router();

function mapAccountStatus(status) {
  return status === 'active' ? 'active' : 'locked';
}

function formatCustomerRow(row) {
  return {
    id: row.id,
    accountId: row.accountId,
    fullName: row.fullName || '',
    email: row.email || '',
    phone: row.phone || '',
    address: row.address || '',
    status: mapAccountStatus(row.accountStatus),
    registeredAt: row.registeredAt,
    totalBookings: Number(row.totalBookings) || 0,
    gender: row.gender || undefined,
    dateOfBirth: row.dateOfBirth || undefined,
    citizenId: row.citizenId || undefined,
    nationality: row.nationality || undefined
  };
}

const CUSTOMER_SELECT = `
  SELECT
    c.id,
    c.accountId,
    COALESCE(c.fullName, a.email) AS fullName,
    COALESCE(c.phone, a.phone) AS phone,
    c.gender,
    c.dateOfBirth,
    c.citizenId,
    c.nationality,
    c.address,
    a.email,
    a.status AS accountStatus,
    COALESCE(a.created_at, a.createdAt) AS registeredAt,
    (
      SELECT COUNT(*)
      FROM bookings b
      WHERE b.user_id = c.accountId OR b.customerId = c.id
    ) AS totalBookings
  FROM customers c
  JOIN accounts a ON a.id = c.accountId
  WHERE a.role = 'customer'
`;

async function getCustomerContext(customerId) {
  const [rows] = await db.query(
    `
      SELECT c.id, c.accountId
      FROM customers c
      JOIN accounts a ON a.id = c.accountId
      WHERE c.id = ? AND a.role = 'customer'
    `,
    [customerId]
  );
  return rows[0] || null;
}

// GET /api/customers?page=0&limit=10&search=&status=all
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 0, 0);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const search = (req.query.search || '').trim();
    const status = req.query.status || 'all';

    const conditions = [];
    const values = [];

    if (search) {
      conditions.push(
        '(c.fullName LIKE ? OR a.email LIKE ? OR c.phone LIKE ? OR a.phone LIKE ?)'
      );
      const pattern = `%${search}%`;
      values.push(pattern, pattern, pattern, pattern);
    }

    if (status === 'active') {
      conditions.push("a.status = 'active'");
    } else if (status === 'locked') {
      conditions.push("a.status <> 'active'");
    }

    const whereClause = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    const [countRows] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM customers c
        JOIN accounts a ON a.id = c.accountId
        WHERE a.role = 'customer'
        ${whereClause}
      `,
      values
    );

    const total = countRows[0]?.total || 0;

    const [rows] = await db.query(
      `
        ${CUSTOMER_SELECT}
        ${whereClause}
        ORDER BY COALESCE(a.created_at, a.createdAt) DESC
        LIMIT ? OFFSET ?
      `,
      [...values, limit, page * limit]
    );

    res.json({
      ok: true,
      data: rows.map(formatCustomerRow),
      total,
      page,
      pageSize: limit
    });
  } catch (error) {
    console.error('List customers error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// GET /api/customers-detail?id=
router.get('/detail', async (req, res) => {
  try {
    const customerId = parseInt(req.query.id, 10);
    if (!customerId) {
      return res.status(400).json({ ok: false, error: 'Invalid customer ID' });
    }

    const [rows] = await db.query(
      `
        ${CUSTOMER_SELECT}
        AND c.id = ?
      `,
      [customerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Customer not found' });
    }

    const customer = formatCustomerRow(rows[0]);
    const ctx = await getCustomerContext(customerId);

    const [spentRows] = await db.query(
      `
        SELECT COALESCE(SUM(p.paidAmount), 0) AS totalSpent
        FROM payments p
        JOIN bookings b ON b.id = p.bookingId
        WHERE (b.user_id = ? OR b.customerId = ?)
          AND p.paymentStatus = 'paid'
      `,
      [ctx.accountId, customerId]
    );

    res.json({
      ok: true,
      data: {
        ...customer,
        totalSpent: Number(spentRows[0]?.totalSpent) || 0
      }
    });
  } catch (error) {
    console.error('Customer detail error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// GET /api/customers-bookings?id=&page=0&limit=10
router.get('/bookings', async (req, res) => {
  try {
    const customerId = parseInt(req.query.id, 10);
    const page = Math.max(parseInt(req.query.page, 10) || 0, 0);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

    if (!customerId) {
      return res.status(400).json({ ok: false, error: 'Invalid customer ID' });
    }

    const ctx = await getCustomerContext(customerId);
    if (!ctx) {
      return res.status(404).json({ ok: false, error: 'Customer not found' });
    }

    const filterValues = [ctx.accountId, customerId];

    const [countRows] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM bookings b
        WHERE b.user_id = ? OR b.customerId = ?
      `,
      filterValues
    );

    const [rows] = await db.query(
      `
        SELECT
          b.id,
          COALESCE(b.bookingCode, CONCAT('BK', LPAD(b.id, 6, '0'))) AS bookingCode,
          COALESCE(bd.checkInDate, b.check_in) AS checkInDate,
          COALESCE(bd.checkOutDate, b.check_out) AS checkOutDate,
          COALESCE(b.totalAmount, b.total_price, 0) AS totalAmount,
          COALESCE(b.bookingStatus, b.status) AS bookingStatus,
          rt.typeName AS roomType
        FROM bookings b
        LEFT JOIN booking_details bd ON bd.bookingId = b.id
        LEFT JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
        LEFT JOIN room_types rt ON rt.id = r.roomTypeId
        WHERE b.user_id = ? OR b.customerId = ?
        ORDER BY b.created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...filterValues, limit, page * limit]
    );

    res.json({
      ok: true,
      data: rows,
      total: countRows[0]?.total || 0,
      page,
      pageSize: limit
    });
  } catch (error) {
    console.error('Customer bookings error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// GET /api/customers-payments?id=
router.get('/payments', async (req, res) => {
  try {
    const customerId = parseInt(req.query.id, 10);
    if (!customerId) {
      return res.status(400).json({ ok: false, error: 'Invalid customer ID' });
    }

    const ctx = await getCustomerContext(customerId);
    if (!ctx) {
      return res.status(404).json({ ok: false, error: 'Customer not found' });
    }

    const [rows] = await db.query(
      `
        SELECT
          p.id,
          COALESCE(b.bookingCode, CONCAT('BK', LPAD(b.id, 6, '0'))) AS bookingCode,
          p.paidAmount,
          p.paymentMethod,
          p.paymentStatus,
          p.paymentDate
        FROM payments p
        JOIN bookings b ON b.id = p.bookingId
        WHERE b.user_id = ? OR b.customerId = ?
        ORDER BY p.paymentDate DESC, p.id DESC
      `,
      [ctx.accountId, customerId]
    );

    res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Customer payments error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// GET /api/customers-reviews?id=
router.get('/reviews', async (req, res) => {
  try {
    const customerId = parseInt(req.query.id, 10);
    if (!customerId) {
      return res.status(400).json({ ok: false, error: 'Invalid customer ID' });
    }

    const ctx = await getCustomerContext(customerId);
    if (!ctx) {
      return res.status(404).json({ ok: false, error: 'Customer not found' });
    }

    const [rows] = await db.query(
      `
        SELECT
          rev.id,
          COALESCE(b.bookingCode, CONCAT('BK', LPAD(b.id, 6, '0'))) AS bookingCode,
          rt.typeName AS roomType,
          rev.rating,
          rev.comment,
          rev.createdAt
        FROM reviews rev
        LEFT JOIN bookings b ON b.id = rev.bookingId
        LEFT JOIN booking_details bd ON bd.bookingId = b.id
        LEFT JOIN rooms r ON r.id = bd.roomId
        LEFT JOIN room_types rt ON rt.id = r.roomTypeId
        WHERE rev.customerId = ?
        ORDER BY rev.createdAt DESC
      `,
      [customerId]
    );

    res.json({ ok: true, data: rows });
  } catch (error) {
    console.error('Customer reviews error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/customers-create
router.post('/create', async (req, res) => {
  try {
    const {
      email,
      password,
      fullName,
      phone,
      gender,
      dateOfBirth,
      citizenId,
      nationality,
      address,
      status = 'active'
    } = req.body;

    if (!email || !password || !fullName || !phone) {
      return res.status(400).json({ ok: false, error: 'Thiếu thông tin bắt buộc' });
    }

    const [existing] = await db.query('SELECT id FROM accounts WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ ok: false, error: 'Email đã tồn tại' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const accountStatus = status === 'locked' ? 'inactive' : 'active';

    const [accountResult] = await db.query(
      `
        INSERT INTO accounts (email, phone, password, role, status)
        VALUES (?, ?, ?, 'customer', ?)
      `,
      [email, phone, hashedPassword, accountStatus]
    );

    const [customerResult] = await db.query(
      `
        INSERT INTO customers (accountId, fullName, phone, gender, dateOfBirth, citizenId, nationality, address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        accountResult.insertId,
        fullName,
        phone,
        gender || null,
        dateOfBirth || null,
        citizenId || null,
        nationality || null,
        address || null
      ]
    );

    const [rows] = await db.query(
      `${CUSTOMER_SELECT} AND c.id = ?`,
      [customerResult.insertId]
    );

    res.status(201).json({ ok: true, data: formatCustomerRow(rows[0]) });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/customers-update
router.post('/update', async (req, res) => {
  try {
    const {
      id,
      email,
      fullName,
      phone,
      gender,
      dateOfBirth,
      citizenId,
      nationality,
      address,
      status
    } = req.body;

    if (!id) {
      return res.status(400).json({ ok: false, error: 'Invalid customer ID' });
    }

    const ctx = await getCustomerContext(id);
    if (!ctx) {
      return res.status(404).json({ ok: false, error: 'Customer not found' });
    }

    if (email) {
      const [duplicate] = await db.query(
        'SELECT id FROM accounts WHERE email = ? AND id <> ?',
        [email, ctx.accountId]
      );
      if (duplicate.length > 0) {
        return res.status(400).json({ ok: false, error: 'Email đã tồn tại' });
      }
    }

    const accountFields = [];
    const accountValues = [];

    if (email) {
      accountFields.push('email = ?');
      accountValues.push(email);
    }
    if (phone) {
      accountFields.push('phone = ?');
      accountValues.push(phone);
    }
    if (status) {
      accountFields.push('status = ?');
      accountValues.push(status === 'locked' ? 'inactive' : 'active');
    }

    if (accountFields.length > 0) {
      await db.query(
        `UPDATE accounts SET ${accountFields.join(', ')} WHERE id = ?`,
        [...accountValues, ctx.accountId]
      );
    }

    await db.query(
      `
        UPDATE customers
        SET fullName = COALESCE(?, fullName),
            phone = COALESCE(?, phone),
            gender = ?,
            dateOfBirth = ?,
            citizenId = ?,
            nationality = ?,
            address = COALESCE(?, address)
        WHERE id = ?
      `,
      [
        fullName || null,
        phone || null,
        gender || null,
        dateOfBirth || null,
        citizenId || null,
        nationality || null,
        address || null,
        id
      ]
    );

    const [rows] = await db.query(`${CUSTOMER_SELECT} AND c.id = ?`, [id]);
    res.json({ ok: true, data: formatCustomerRow(rows[0]) });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/customers-delete
router.post('/delete', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ ok: false, error: 'Invalid customer ID' });
    }

    const ctx = await getCustomerContext(id);
    if (!ctx) {
      return res.status(404).json({ ok: false, error: 'Customer not found' });
    }

    await db.query('DELETE FROM customers WHERE id = ?', [id]);
    await db.query('DELETE FROM accounts WHERE id = ?', [ctx.accountId]);

    res.json({ ok: true });
  } catch (error) {
    console.error('Delete customer error:', error);
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({
        ok: false,
        error: 'Không thể xóa khách hàng đang có booking liên quan'
      });
    }
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/customers-lock?id=
router.post('/lock', async (req, res) => {
  try {
    const customerId = parseInt(req.query.id, 10);
    if (!customerId) {
      return res.status(400).json({ ok: false, error: 'Invalid customer ID' });
    }

    const ctx = await getCustomerContext(customerId);
    if (!ctx) {
      return res.status(404).json({ ok: false, error: 'Customer not found' });
    }

    const [statusRows] = await db.query('SELECT status FROM accounts WHERE id = ?', [
      ctx.accountId
    ]);
    const currentStatus = statusRows[0]?.status;
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';

    await db.query('UPDATE accounts SET status = ? WHERE id = ?', [
      nextStatus,
      ctx.accountId
    ]);

    res.json({
      ok: true,
      data: { status: mapAccountStatus(nextStatus), reason: req.body.reason || null }
    });
  } catch (error) {
    console.error('Lock customer error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

module.exports = router;

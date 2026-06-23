const express = require('express');
const db = require('../config/db');

const router = express.Router();

function formatLocalDateTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getDateRange(mode) {
  const now = new Date();
  let from;
  let to;

  if (mode === 'year') {
    from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return { from: formatLocalDateTime(from), to: formatLocalDateTime(to), fromDate: from, toDate: to };
}

function daysInRange(fromDate, toDate) {
  const ms = toDate.getTime() - fromDate.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1);
}

function buildCategories(mode, fromDate, toDate) {
  const categories = [];

  if (mode === 'year') {
    for (let m = 0; m < 12; m += 1) {
      categories.push(`T${m + 1}`);
    }
    return categories;
  }

  }
  return categories;
}

function mapSeriesRows(rows, mode, categories) {
  const data = categories.map(() => 0);

  rows.forEach((row) => {
    const bucket = Number(row.bucket);
    const idx = mode === 'year' ? bucket - 1 : bucket - 1;
    if (idx >= 0 && idx < data.length) {
      data[idx] = Number(row.total) || 0;
    }
  });

  return data;
}

router.get('/', async (req, res) => {
  try {
    const mode = req.query.mode === 'year' ? 'year' : 'month';
    const { from, to, fromDate, toDate } = getDateRange(mode);
    const categories = buildCategories(mode, fromDate, toDate);
    const periodDays = daysInRange(fromDate, toDate);

    const revenueGroupExpr =
      mode === 'year'
        ? 'MONTH(p.paymentDate)'
        : 'DAY(p.paymentDate)';

    const bookingGroupExpr =
      mode === 'year'
        ? 'MONTH(COALESCE(b.created_at, b.createdAt))'
        : 'DAY(COALESCE(b.created_at, b.createdAt))';

    const [[revenueKpi]] = await db.query(
      `
        SELECT COALESCE(SUM(p.paidAmount), 0) AS total
        FROM payments p
        WHERE p.paymentStatus = 'paid'
          AND p.paymentDate >= ?
          AND p.paymentDate <= ?
      `,
      [from, to]
    );

    const [[bookingKpi]] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM bookings b
        WHERE COALESCE(b.created_at, b.createdAt) >= ?
          AND COALESCE(b.created_at, b.createdAt) <= ?
      `,
      [from, to]
    );

    const [[customerKpi]] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM accounts a
        WHERE a.role = 'customer'
          AND COALESCE(a.created_at, a.createdAt) >= ?
          AND COALESCE(a.created_at, a.createdAt) <= ?
      `,
      [from, to]
    );

    const [[roomKpi]] = await db.query('SELECT COUNT(*) AS total FROM rooms');
    const totalRooms = Number(roomKpi?.total) || 0;

    const [[bookedNightsRow]] = await db.query(
      `
        SELECT COALESCE(SUM(
          GREATEST(
            0,
            DATEDIFF(
              LEAST(COALESCE(bd.checkOutDate, b.check_out), DATE(?)),
              GREATEST(COALESCE(bd.checkInDate, b.check_in), DATE(?))
            )
          )
        ), 0) AS bookedNights
        FROM bookings b
        LEFT JOIN booking_details bd ON bd.bookingId = b.id
        WHERE COALESCE(b.bookingStatus, b.status) NOT IN ('cancelled')
          AND COALESCE(bd.checkInDate, b.check_in) <= DATE(?)
          AND COALESCE(bd.checkOutDate, b.check_out) >= DATE(?)
      `,
      [to, from, to, from]
    );

    const bookedNights = Number(bookedNightsRow?.bookedNights) || 0;
    const maxNights = totalRooms * periodDays;
    const occupancyRate = maxNights > 0 ? Math.round((bookedNights / maxNights) * 100) : 0;

    const [revenueRows] = await db.query(
      `
        SELECT ${revenueGroupExpr} AS bucket, COALESCE(SUM(p.paidAmount), 0) AS total
        FROM payments p
        WHERE p.paymentStatus = 'paid'
          AND p.paymentDate >= ?
          AND p.paymentDate <= ?
        GROUP BY bucket
        ORDER BY bucket
      `,
      [from, to]
    );

    const [bookingRows] = await db.query(
      `
        SELECT ${bookingGroupExpr} AS bucket, COUNT(*) AS total
        FROM bookings b
        WHERE COALESCE(b.created_at, b.createdAt) >= ?
          AND COALESCE(b.created_at, b.createdAt) <= ?
        GROUP BY bucket
        ORDER BY bucket
      `,
      [from, to]
    );

    const [paymentMethodRows] = await db.query(
      `
        SELECT
          COALESCE(NULLIF(TRIM(p.paymentMethod), ''), 'Khác') AS label,
          COUNT(*) AS total
        FROM payments p
        WHERE p.paymentDate >= ?
          AND p.paymentDate <= ?
        GROUP BY label
        ORDER BY total DESC
      `,
      [from, to]
    );

    const [topRoomTypeRows] = await db.query(
      `
        SELECT
          COALESCE(rt.typeName, 'Không rõ') AS label,
          COUNT(*) AS total
        FROM bookings b
        LEFT JOIN booking_details bd ON bd.bookingId = b.id
        LEFT JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
        LEFT JOIN room_types rt ON rt.id = r.roomTypeId
        WHERE COALESCE(b.created_at, b.createdAt) >= ?
          AND COALESCE(b.created_at, b.createdAt) <= ?
        GROUP BY label
        ORDER BY total DESC
        LIMIT 5
      `,
      [from, to]
    );

    res.json({
      ok: true,
      range: { from, to },
      mode,
      kpis: {
        revenueTotal: Number(revenueKpi?.total) || 0,
        bookingsTotal: Number(bookingKpi?.total) || 0,
        newCustomers: Number(customerKpi?.total) || 0,
        occupancyRate
      },
      revenueSeries: {
        categories,
        data: mapSeriesRows(revenueRows, mode, categories)
      },
      bookingSeries: {
        categories,
        data: mapSeriesRows(bookingRows, mode, categories)
      },
      paymentMethodDonut: {
        labels: paymentMethodRows.map((row) => row.label),
        data: paymentMethodRows.map((row) => Number(row.total) || 0)
      },
      topRoomTypes: {
        labels: topRoomTypeRows.map((row) => row.label),
        data: topRoomTypeRows.map((row) => Number(row.total) || 0)
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

module.exports = router;

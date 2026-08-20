const db = require('../config/db');

const run = (connection) => connection || db;
const {
  LATE_CHECKIN_GRACE_HOUR,
  HOLD_MINUTES,
  HOLD_RESET_MINUTES,
  MAX_HOLD_RESETS,
  MIN_RESET_COOLDOWN_SECONDS,
  MAX_TOTAL_HOLD_MINUTES
} = require('../utils/bookingPolicy');

const BOOKING_SELECT = `
  SELECT
    b.id,
    b.bookingCode AS booking_code,
    b.voucherId AS voucher_id,
    b.user_id,
    b.status,
    b.total_price,
    b.totalAmount AS booking_total_amount,
    COALESCE(
      (
        SELECT p.totalAmount
        FROM payments p
        WHERE p.bookingId = b.id
        ORDER BY p.id DESC
        LIMIT 1
      ),
      b.total_price,
      0
    ) AS payable_total,
    b.created_at,
    b.hold_expires_at,
    b.hold_reset_count,
    b.last_hold_reset_at,
    b.notes,
    b.extraGuestSnapshot AS extra_guest_snapshot,
    b.cancellation_reason,
    MIN(bd.id) AS detail_id,
    MIN(bd.roomId) AS room_id,
    DATE(COALESCE(MIN(bd.checkInDate), b.check_in)) AS check_in,
    DATE(COALESCE(MAX(bd.checkOutDate), b.check_out)) AS check_out,
    CAST(SUM(bd.adults) AS SIGNED) AS adults,
    CAST(SUM(bd.children) AS SIGNED) AS children,
    SUM(bd.roomPrice) AS room_price,
    COALESCE(SUM(bd.occupancySurcharge), 0) AS occupancy_surcharge,
    COALESCE(MIN(bd.requestedCheckInTime), b.requestedCheckInTime) AS requested_check_in_time,
    COALESCE(MAX(bd.requestedCheckOutTime), b.requestedCheckOutTime) AS requested_check_out_time,
    COALESCE(MIN(bd.requestedCheckInDayOffset), b.requestedCheckInDayOffset, 0) AS requested_check_in_day_offset,
    b.actualCheckInTime AS actual_check_in_time,
    b.actualCheckOutTime AS actual_check_out_time,
    COALESCE(b.guest_name, MAX(c.fullName)) AS customer_name,
    COALESCE(b.guest_email, MAX(a.email)) AS customer_email,
    COALESCE(b.guest_phone, MAX(c.phone), MAX(a.phone)) AS customer_phone,
    GROUP_CONCAT(DISTINCT r.roomNumber ORDER BY r.roomNumber SEPARATOR ', ') AS room_number,
    MIN(r.floor) AS room_floor,
    MIN(r.area) AS room_area,
    MIN(r.status) AS room_status,
    COALESCE(MIN(bd.roomTypeId), MIN(r.roomTypeId), MIN(rt.id)) AS room_type_id,
    COALESCE(GROUP_CONCAT(DISTINCT rt.typeName SEPARATOR ', '), 'Đặt phòng') AS room_type_name,
    MIN(rt.defaultPrice) AS price_per_night,
    MIN(rt.capacity) AS room_capacity
  FROM bookings b
  LEFT JOIN booking_details bd ON bd.bookingId = b.id
  LEFT JOIN customers c ON c.accountId = b.user_id
  LEFT JOIN accounts a ON a.id = b.user_id
  LEFT JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
  LEFT JOIN room_types rt ON rt.id = r.roomTypeId
`;

const getAccountById = async (userId, connection) => {
  const [rows] = await run(connection).query(
    'SELECT id, email, phone FROM accounts WHERE id = ?',
    [userId]
  );
  return rows[0] || null;
};

const getOrCreateCustomerId = async (accountId, connection) => {
  const [existing] = await run(connection).query(
    'SELECT id FROM customers WHERE accountId = ?',
    [accountId]
  );

  if (existing.length > 0) {
    return existing[0].id;
  }

  const account = await getAccountById(accountId, connection);
  if (!account) {
    return null;
  }

  const [result] = await run(connection).query(
    'INSERT INTO customers (accountId, fullName, phone) VALUES (?, ?, ?)',
    [accountId, account.email, account.phone]
  );

  return result.insertId;
};

const getRoomWithType = async (roomId, connection, lock = false) => {
  const [rows] = await run(connection).query(
    `
      SELECT
        r.id,
        r.roomTypeId,
        r.roomNumber,
        r.floor,
        r.area,
        r.status,
        rt.typeName AS room_type_name,
        rt.defaultPrice AS price_per_night,
        rt.capacity,
        rt.adultCapacity,
        rt.childCapacity,
        rt.maxOccupancy,
        rt.extraAdultFee,
        rt.extraChildFee
      FROM rooms r
      JOIN room_types rt ON rt.id = r.roomTypeId
      WHERE r.id = ?
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [roomId]
  );
  return rows[0] || null;
};

/**
 * Tự động quét và giải phóng các phòng đang giữ chỗ nhưng đã quá hạn thanh toán.
 * Đơn đặt phòng chuyển sang 'cancelled' và phòng được mở lại ngay cho khách khác đặt.
 */
const expireUnpaidBookingHolds = async (connection) => {
  await run(connection).query(
    `UPDATE payment_gateway_orders SET status = 'expired'
      WHERE status = 'created' AND DATE_ADD(expiresAt, INTERVAL 60 SECOND) <= NOW()`
  );
  await run(connection).query(
    `
      UPDATE bookings b
      JOIN payments p ON p.bookingId = b.id
      SET b.status = 'cancelled',
          b.bookingStatus = 'cancelled',
          b.cancellation_reason = COALESCE(b.cancellation_reason, 'Hết thời gian giữ phòng (quá hạn thanh toán)')
      WHERE b.status IN ('pending', 'confirmed')
        AND p.paymentStatus = 'unpaid'
        AND COALESCE(p.paidAmount, 0) <= 0
        AND (
          (b.hold_expires_at IS NOT NULL AND b.hold_expires_at < NOW())
          OR (b.hold_expires_at IS NULL AND b.created_at < DATE_SUB(NOW(), INTERVAL ${HOLD_MINUTES} MINUTE))
        )
        AND NOT EXISTS (
          SELECT 1 FROM payment_gateway_orders pgo
           WHERE pgo.bookingId = b.id AND pgo.status = 'created'
             AND DATE_ADD(pgo.expiresAt, INTERVAL 60 SECOND) > NOW()
        )
    `
  );
};

const getSecuredConflictingBookings = async (
  roomId,
  checkIn,
  checkOut,
  connection,
  lock = false,
  { excludeBookingId } = {}
) => {
  const values = [roomId, checkOut, checkIn];
  const excludeClause = excludeBookingId ? 'AND b.id != ?' : '';
  if (excludeBookingId) {
    values.push(excludeBookingId);
  }

  const [rows] = await run(connection).query(
    `
      SELECT b.id, b.status, COALESCE(bd.checkInDate, b.check_in) AS checkInDate,
             COALESCE(bd.checkOutDate, b.check_out) AS checkOutDate,
             b.created_at,
             COALESCE(p.paymentStatus, 'unpaid') AS paymentStatus,
             COALESCE(p.paidAmount, 0) AS paidAmount
      FROM bookings b
      LEFT JOIN (
        SELECT
          bookingId,
          MIN(roomId) AS roomId,
          MIN(checkInDate) AS checkInDate,
          MAX(checkOutDate) AS checkOutDate,
          MIN(requestedCheckInTime) AS requestedCheckInTime,
          MIN(requestedCheckOutTime) AS requestedCheckOutTime,
          MIN(requestedCheckInDayOffset) AS requestedCheckInDayOffset
        FROM booking_details
        GROUP BY bookingId
      ) bd ON bd.bookingId = b.id
      LEFT JOIN payments p ON p.id = (
        SELECT p2.id
        FROM payments p2
        WHERE p2.bookingId = b.id
        ORDER BY p2.id DESC
        LIMIT 1
      )
      WHERE COALESCE(bd.roomId, b.room_id) = ?
        AND b.status IN ('pending', 'confirmed', 'checked_in')
        AND DATE(COALESCE(bd.checkInDate, b.check_in)) < ?
        AND DATE(COALESCE(bd.checkOutDate, b.check_out)) > ?
        ${excludeClause}
        AND (
          b.status = 'checked_in'
          OR p.paymentStatus = 'paid'
          OR COALESCE(p.paidAmount, 0) > 0
        )
      ${lock ? 'FOR UPDATE' : ''}
    `,
    values
  );
  return rows;
};

const getConflictingBookings = async (
  roomId,
  checkIn,
  checkOut,
  connection,
  lock = false,
  { excludeBookingId } = {}
) => {
  const values = [roomId, checkOut, checkIn];
  const excludeClause = excludeBookingId ? 'AND b.id != ?' : '';
  if (excludeBookingId) {
    values.push(excludeBookingId);
  }

  const [rows] = await run(connection).query(
    `
      SELECT b.id, b.status, COALESCE(bd.checkInDate, b.check_in) AS checkInDate,
             COALESCE(bd.checkOutDate, b.check_out) AS checkOutDate,
             b.created_at,
             COALESCE(p.paymentStatus, 'unpaid') AS paymentStatus
      FROM bookings b
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      LEFT JOIN payments p ON p.id = (
        SELECT p2.id
        FROM payments p2
        WHERE p2.bookingId = b.id
        ORDER BY p2.id DESC
        LIMIT 1
      )
      WHERE COALESCE(bd.roomId, b.room_id) = ?
        AND b.status IN ('pending', 'confirmed', 'checked_in')
        AND DATE(COALESCE(bd.checkInDate, b.check_in)) < ?
        AND DATE(COALESCE(bd.checkOutDate, b.check_out)) > ?
        ${excludeClause}
        AND (
          b.status = 'checked_in'
          OR p.paymentStatus = 'paid'
          OR COALESCE(p.paidAmount, 0) > 0
          OR (
            COALESCE(p.paymentStatus, 'unpaid') = 'unpaid'
            AND COALESCE(p.paidAmount, 0) <= 0
            AND (
              (b.hold_expires_at IS NOT NULL AND b.hold_expires_at >= NOW())
              OR (b.hold_expires_at IS NULL AND b.created_at >= DATE_SUB(NOW(), INTERVAL ${HOLD_MINUTES} MINUTE))
            )
          )
        )
      ${lock ? 'FOR UPDATE' : ''}
    `,
    values
  );
  return rows;
};

const getBookingRoomStays = async (bookingId, connection, lock = false) => {
  const [rows] = await run(connection).query(
    `SELECT roomId, DATE(checkInDate) AS checkIn, DATE(checkOutDate) AS checkOut
       FROM booking_details WHERE bookingId = ? ${lock ? 'FOR UPDATE' : ''}`,
    [bookingId]
  );
  if (rows.length) return rows;
  const [fallback] = await run(connection).query(
    `SELECT room_id AS roomId, DATE(check_in) AS checkIn, DATE(check_out) AS checkOut
       FROM bookings WHERE id = ? ${lock ? 'FOR UPDATE' : ''}`,
    [bookingId]
  );
  return fallback.filter((row) => row.roomId);
};

const cancelCompetingUnpaidBookings = async (
  roomId,
  checkIn,
  checkOut,
  excludeBookingId,
  connection
) => {
  await run(connection).query(
    `
      UPDATE bookings b
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      JOIN payments p ON p.bookingId = b.id
      SET b.status = 'cancelled',
          b.bookingStatus = 'cancelled'
      WHERE COALESCE(bd.roomId, b.room_id) = ?
        AND b.id != ?
        AND b.status IN ('pending', 'confirmed')
        AND DATE(COALESCE(bd.checkInDate, b.check_in)) < ?
        AND DATE(COALESCE(bd.checkOutDate, b.check_out)) > ?
        AND p.paymentStatus = 'unpaid'
        AND COALESCE(p.paidAmount, 0) <= 0
    `,
    [roomId, excludeBookingId, checkOut, checkIn]
  );
};

const listAvailableRoomsByType = async (roomTypeId, checkIn, checkOut, connection, lock = false) => {
  await expireUnpaidBookingHolds(connection);

  const [rooms] = await run(connection).query(
    `
      SELECT
        r.id,
        r.roomNumber,
        r.roomTypeId,
        rt.typeName AS room_type_name,
        rt.defaultPrice AS price_per_night,
        rt.capacity
      FROM rooms r
      JOIN room_types rt ON rt.id = r.roomTypeId
      WHERE r.roomTypeId = ?
        AND r.status != 'maintenance'
        AND NOT EXISTS (
          SELECT 1
          FROM bookings b
          LEFT JOIN booking_details bd ON bd.bookingId = b.id
          LEFT JOIN payments p ON p.id = (
            SELECT p2.id
            FROM payments p2
            WHERE p2.bookingId = b.id
            ORDER BY p2.id DESC
            LIMIT 1
          )
          WHERE COALESCE(bd.roomId, b.room_id) = r.id
            AND b.status IN ('pending', 'confirmed', 'checked_in')
            AND DATE(COALESCE(bd.checkInDate, b.check_in)) < ?
            AND DATE(COALESCE(bd.checkOutDate, b.check_out)) > ?
            AND (
              b.status = 'checked_in'
              OR p.paymentStatus = 'paid'
              OR COALESCE(p.paidAmount, 0) > 0
              OR (
                COALESCE(p.paymentStatus, 'unpaid') = 'unpaid'
                AND COALESCE(p.paidAmount, 0) <= 0
                AND (
                  (b.hold_expires_at IS NOT NULL AND b.hold_expires_at >= NOW())
                  OR (b.hold_expires_at IS NULL AND b.created_at >= DATE_SUB(NOW(), INTERVAL ${HOLD_MINUTES} MINUTE))
                )
              )
            )
        )
      ORDER BY r.id ASC
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [roomTypeId, checkOut, checkIn]
  );

  return rooms;
};

const listRoomTypeAvailability = async (checkIn, checkOut, connection) => {
  await expireUnpaidBookingHolds(connection);

  const [roomTypes] = await run(connection).query(
    `
      SELECT id, typeName AS room_type_name, defaultPrice AS price_per_night, capacity
      FROM room_types
      ORDER BY id ASC
    `
  );

  const result = [];
  for (const roomType of roomTypes) {
    const rooms = await listAvailableRoomsByType(roomType.id, checkIn, checkOut, connection);
    result.push({
      ...roomType,
      availableRooms: rooms.length,
      roomIds: rooms.map((room) => room.id)
    });
  }

  return result;
};

const getBookedAvailabilityRows = async () => [];

const createBooking = async (payload, totalPrice, connection, extraGuestSnapshot = null) => {
  const account = await getAccountById(payload.userId, connection);
  if (!account) {
    throw new Error('Customer not found');
  }

  const customerId = await getOrCreateCustomerId(payload.userId, connection);

  const bookingStatus = payload.status === 'pending' ? 'pending' : 'confirmed';
  const snapshotJson = (extraGuestSnapshot || payload.extraGuestSnapshot)
    ? JSON.stringify(extraGuestSnapshot || payload.extraGuestSnapshot)
    : null;

  const [result] = await run(connection).query(
    `
      INSERT INTO bookings (
        user_id, customerId, room_id, check_in, check_out, total_price, totalAmount,
        status, bookingStatus, notes, extraGuestSnapshot, guest_name, guest_email, guest_phone,
        requestedCheckInTime, requestedCheckOutTime, hold_expires_at, hold_reset_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ${HOLD_MINUTES} MINUTE), 0)
    `,
    [
      payload.userId,
      customerId,
      payload.roomId,
      payload.checkIn,
      payload.checkOut,
      totalPrice,
      totalPrice,
      bookingStatus,
      bookingStatus,
      payload.notes || null,
      snapshotJson,
      payload.guestName || null,
      payload.guestEmail || null,
      payload.guestPhone || null,
      payload.requestedCheckInTime || null,
      payload.requestedCheckOutTime || null
    ]
  );

  // Sinh mã đơn ngay sau khi có id. Cột bookingCode có sẵn trong bảng và được
  // hiển thị khắp nơi (hóa đơn, email, tra cứu) nhưng chưa chỗ nào ghi vào, nên
  // mọi đơn đều mang mã rỗng. Dựa vào id nên chắc chắn không trùng.
  await run(connection).query(
    "UPDATE bookings SET bookingCode = CONCAT('BK', LPAD(?, 6, '0')) WHERE id = ?",
    [result.insertId, result.insertId]
  );

  return result.insertId;
};

const updateBookingHold = async (bookingId, { holdExpiresAt, holdResetCount, lastHoldResetAt }, connection) => {
  await run(connection).query(
    `
      UPDATE bookings
      SET hold_expires_at = ?,
          hold_reset_count = ?,
          last_hold_reset_at = ?
      WHERE id = ?
    `,
    [holdExpiresAt, holdResetCount, lastHoldResetAt, bookingId]
  );
};

const createBookingDetail = async (bookingId, payload, roomPrice, occupancySurcharge = 0, connection) => {
  const [result] = await run(connection).query(
    `
      INSERT INTO booking_details
        (bookingId, roomId, roomLabel, roomTypeId, checkInDate, checkOutDate, adults, children, roomPrice, occupancySurcharge,
         requestedCheckInTime, requestedCheckOutTime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      bookingId,
      payload.roomId,
      payload.roomLabel || null,
      payload.roomTypeId || null,
      payload.checkIn,
      payload.checkOut,
      payload.adults,
      payload.children,
      roomPrice,
      occupancySurcharge,
      payload.requestedCheckInTime || null,
      payload.requestedCheckOutTime || null
    ]
  );
  return { id: result.insertId, roomId: payload.roomId };
};

const getServiceById = async (serviceId, connection) => {
  const [rows] = await run(connection).query(
    'SELECT id, serviceName, price FROM services WHERE id = ?',
    [serviceId]
  );
  return rows[0] || null;
};

const validateRoomInBooking = async (bookingId, roomId, connection) => {
  if (!roomId) return true;
  const [rows] = await run(connection).query(
    `SELECT 1 FROM booking_details WHERE bookingId = ? AND roomId = ?
     UNION
     SELECT 1 FROM bookings WHERE id = ? AND room_id = ?`,
    [Number(bookingId), Number(roomId), Number(bookingId), Number(roomId)]
  );
  return rows.length > 0;
};

const addBookingService = async (bookingId, service, quantity, connection, options = {}) => {
  const roomId = options.roomId ? Number(options.roomId) : null;
  const bookingDetailId = options.bookingDetailId ? Number(options.bookingDetailId) : null;
  const customerId = options.customerId ? Number(options.customerId) : null;
  const guestName = options.guestName ? options.guestName.trim() : null;
  const status = options.status || 'used';
  const unitPrice = Number(service.price || 0);
  const totalPrice = unitPrice * Number(quantity);
  const usedAt = status === 'used' ? new Date() : null;

  const [result] = await run(connection).query(
    `
      INSERT INTO booking_services (bookingId, bookingDetailId, roomId, customerId, guestName, serviceId, unitPrice, quantity, status, usedAt, totalPrice)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [bookingId, bookingDetailId, roomId, customerId, guestName, service.id, unitPrice, quantity, status, usedAt, totalPrice]
  );

  return {
    id: result.insertId,
    bookingId,
    bookingDetailId,
    roomId,
    customerId,
    guestName,
    serviceId: service.id,
    serviceName: service.serviceName,
    unitPrice,
    quantity,
    status,
    usedAt,
    totalPrice
  };
};

const getBookingServiceChargeById = async (svcId, connection) => {
  const [rows] = await run(connection).query(
    `SELECT bs.id, bs.bookingId, bs.roomId, r.roomNumber, bs.customerId, bs.guestName,
            COALESCE(NULLIF(c.fullName, ''), a.email, bs.guestName) AS customerName,
            bs.serviceId, s.serviceName,
            COALESCE(bs.unitPrice, s.price) AS unitPrice, bs.quantity, bs.totalPrice,
            COALESCE(bs.status, 'used') AS status, bs.usedAt, bs.createdAt
     FROM booking_services bs
     LEFT JOIN services s ON s.id = bs.serviceId
     LEFT JOIN bookings b ON b.id = bs.bookingId
     LEFT JOIN rooms r ON r.id = COALESCE(bs.roomId, b.room_id)
     LEFT JOIN accounts a ON a.id = bs.customerId
     LEFT JOIN customers c ON c.accountId = a.id
     WHERE bs.id = ?`,
    [Number(svcId)]
  );
  return rows[0] || null;
};

const getBookingServicesByBookingId = async (bookingId, connection) => {
  const [rows] = await run(connection).query(
    `SELECT bs.id, bs.bookingId, bs.roomId, r.roomNumber, bs.customerId, bs.guestName,
            COALESCE(NULLIF(c.fullName, ''), a.email, bs.guestName) AS customerName,
            bs.serviceId, s.serviceName, s.description,
            COALESCE(bs.unitPrice, s.price) AS unitPrice, bs.quantity, bs.totalPrice,
            COALESCE(bs.status, 'used') AS status, bs.usedAt, bs.createdAt
     FROM booking_services bs
     LEFT JOIN services s ON s.id = bs.serviceId
     LEFT JOIN bookings b ON b.id = bs.bookingId
     LEFT JOIN rooms r ON r.id = COALESCE(bs.roomId, b.room_id)
     LEFT JOIN accounts a ON a.id = bs.customerId
     LEFT JOIN customers c ON c.accountId = a.id
     WHERE bs.bookingId = ?
     ORDER BY bs.id ASC`,
    [Number(bookingId)]
  );
  return rows;
};

const updateBookingServiceCharge = async (svcId, payload, connection) => {
  const current = await getBookingServiceChargeById(svcId, connection);
  if (!current) return 0;

  const fields = [];
  const params = [];

  if (payload.roomId !== undefined) {
    fields.push('roomId = ?');
    params.push(payload.roomId ? Number(payload.roomId) : null);
  }
  if (payload.customerId !== undefined) {
    fields.push('customerId = ?');
    params.push(payload.customerId ? Number(payload.customerId) : null);
  }
  if (payload.guestName !== undefined) {
    fields.push('guestName = ?');
    params.push(payload.guestName ? payload.guestName.trim() : null);
  }
  if (payload.quantity != null) {
    const unitPrice = Number(current.unitPrice || 0);
    const quantity = Number(payload.quantity);
    const totalPrice = unitPrice * quantity;
    fields.push('quantity = ?');
    params.push(quantity);
    fields.push('totalPrice = ?');
    params.push(totalPrice);
  }
  if (payload.status) {
    fields.push('status = ?');
    params.push(payload.status);
    if (payload.status === 'used' && !current.usedAt) {
      fields.push('usedAt = ?');
      params.push(new Date());
    } else if (payload.status === 'unused') {
      fields.push('usedAt = NULL');
    }
  }

  if (fields.length === 0) return 0;
  params.push(Number(svcId));
  const [result] = await run(connection).query(
    `UPDATE booking_services SET ${fields.join(', ')} WHERE id = ?`,
    params
  );
  return result.affectedRows || 0;
};

const updateBookingServiceStatus = async (svcId, newStatus, connection) => {
  const current = await getBookingServiceChargeById(svcId, connection);
  if (!current) return 0;

  const fields = ['status = ?'];
  const params = [newStatus];

  if (newStatus === 'used') {
    if (!current.usedAt) {
      fields.push('usedAt = ?');
      params.push(new Date());
    }
  } else if (newStatus === 'unused') {
    fields.push('usedAt = NULL');
  }

  params.push(Number(svcId));
  const [result] = await run(connection).query(
    `UPDATE booking_services SET ${fields.join(', ')} WHERE id = ?`,
    params
  );
  return result.affectedRows || 0;
};

const deleteBookingServiceCharge = async (svcId, connection) => {
  const [result] = await run(connection).query(
    "UPDATE booking_services SET status = 'cancelled' WHERE id = ?",
    [Number(svcId)]
  );
  return result.affectedRows || 0;
};

const sumBookingServices = async (bookingId, connection) => {
  const [[row]] = await run(connection).query(
    "SELECT COALESCE(SUM(totalPrice), 0) AS total FROM booking_services WHERE bookingId = ? AND status = 'used'",
    [bookingId]
  );
  return Number(row?.total || 0);
};

const createCustomerNotification = async (accountId, title, content, connection) => {
  if (!accountId) return null;

  const [result] = await run(connection).query(
    `
      INSERT INTO notifications (accountId, title, content, isRead)
      VALUES (?, ?, ?, 0)
    `,
    [accountId, title, content]
  );
  return result.insertId;
};

const replaceBookingGuests = async (bookingId, guests, connection) => {
  await run(connection).query('DELETE FROM booking_guests WHERE bookingId = ?', [bookingId]);

  for (const guest of guests) {
    await run(connection).query(
      `
        INSERT INTO booking_guests (bookingId, fullName, identityNumber, phone, note)
        VALUES (?, ?, ?, ?, ?)
      `,
      [bookingId, guest.fullName, guest.identityNumber || null, guest.phone || null, guest.note || null]
    );
  }
};

const addDamageCharge = async (bookingId, roomId, payload, connection) => {
  const chargeType = payload.chargeType || 'damage';
  const status = payload.status || 'used';
  const quantity = Number(payload.quantity || 1);
  const unitPrice = Number(payload.unitPrice || 0);
  const totalPrice = quantity * unitPrice;

  const [result] = await run(connection).query(
    `
      INSERT INTO booking_damage_charges
        (bookingId, roomId, chargeType, itemName, quantity, unitPrice, totalPrice, status, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      bookingId,
      roomId,
      chargeType,
      payload.itemName,
      quantity,
      unitPrice,
      totalPrice,
      status,
      payload.note || null
    ]
  );

  return { id: result.insertId, chargeType, totalPrice, status };
};

const getDamageChargeById = async (chargeId, connection) => {
  const [rows] = await run(connection).query(
    `SELECT bdc.id, bdc.bookingId, bdc.roomId, r.roomNumber,
            COALESCE(bdc.chargeType, 'damage') AS chargeType,
            bdc.itemName, bdc.quantity, bdc.unitPrice, bdc.totalPrice,
            COALESCE(bdc.status, 'used') AS status, bdc.note, bdc.createdAt
     FROM booking_damage_charges bdc
     LEFT JOIN rooms r ON r.id = bdc.roomId
     WHERE bdc.id = ?`,
    [Number(chargeId)]
  );
  return rows[0] || null;
};

const getDamageChargesByBookingId = async (bookingId, connection) => {
  const [rows] = await run(connection).query(
    `SELECT bdc.id, bdc.bookingId, bdc.roomId, r.roomNumber,
            COALESCE(bdc.chargeType, 'damage') AS chargeType,
            bdc.itemName, bdc.quantity, bdc.unitPrice, bdc.totalPrice,
            COALESCE(bdc.status, 'used') AS status, bdc.note, bdc.createdAt
     FROM booking_damage_charges bdc
     LEFT JOIN rooms r ON r.id = bdc.roomId
     WHERE bdc.bookingId = ?
     ORDER BY bdc.id ASC`,
    [Number(bookingId)]
  );
  return rows;
};

const updateDamageCharge = async (chargeId, payload, connection) => {
  const current = await getDamageChargeById(chargeId, connection);
  if (!current) return 0;

  const fields = [];
  const params = [];

  if (payload.roomId !== undefined) {
    fields.push('roomId = ?');
    params.push(payload.roomId ? Number(payload.roomId) : null);
  }
  if (payload.chargeType) {
    fields.push('chargeType = ?');
    params.push(payload.chargeType);
  }
  if (payload.itemName !== undefined) {
    fields.push('itemName = ?');
    params.push(String(payload.itemName).trim());
  }
  if (payload.quantity != null || payload.unitPrice != null) {
    const quantity = payload.quantity != null ? Number(payload.quantity) : Number(current.quantity);
    const unitPrice = payload.unitPrice != null ? Number(payload.unitPrice) : Number(current.unitPrice);
    const totalPrice = quantity * unitPrice;
    fields.push('quantity = ?');
    params.push(quantity);
    fields.push('unitPrice = ?');
    params.push(unitPrice);
    fields.push('totalPrice = ?');
    params.push(totalPrice);
  }
  if (payload.status) {
    fields.push('status = ?');
    params.push(payload.status);
  }
  if (payload.note !== undefined) {
    fields.push('note = ?');
    params.push(payload.note ? String(payload.note).trim() : null);
  }

  if (fields.length === 0) return 0;
  params.push(Number(chargeId));
  const [result] = await run(connection).query(
    `UPDATE booking_damage_charges SET ${fields.join(', ')} WHERE id = ?`,
    params
  );
  return result.affectedRows || 0;
};

const updateDamageChargeStatus = async (chargeId, newStatus, connection) => {
  const [result] = await run(connection).query(
    'UPDATE booking_damage_charges SET status = ? WHERE id = ?',
    [newStatus, Number(chargeId)]
  );
  return result.affectedRows || 0;
};

const deleteDamageCharge = async (chargeId, connection) => {
  const [result] = await run(connection).query(
    "UPDATE booking_damage_charges SET status = 'cancelled' WHERE id = ?",
    [Number(chargeId)]
  );
  return result.affectedRows || 0;
};

const sumDamageCharges = async (bookingId, connection) => {
  const [[row]] = await run(connection).query(
    "SELECT COALESCE(SUM(totalPrice), 0) AS total FROM booking_damage_charges WHERE bookingId = ? AND status = 'used'",
    [bookingId]
  );
  return Number(row?.total || 0);
};

const updateBookingStay = async (bookingId, checkOut, totalPrice, connection, occupancySurcharge = null, perDetailSurcharges = null) => {
  const serviceAmount = await sumBookingServices(bookingId, connection);

  await run(connection).query(
    'UPDATE bookings SET check_out = ?, total_price = ?, totalAmount = ? WHERE id = ?',
    [checkOut, totalPrice, Number(totalPrice) + serviceAmount, bookingId]
  );

  await run(connection).query(
    'UPDATE booking_details SET checkOutDate = ? WHERE bookingId = ?',
    [checkOut, bookingId]
  );

  if (Array.isArray(perDetailSurcharges) && perDetailSurcharges.length > 0) {
    for (const item of perDetailSurcharges) {
      if (item.id) {
        await run(connection).query(
          'UPDATE booking_details SET occupancySurcharge = ? WHERE id = ?',
          [item.occupancySurcharge || 0, item.id]
        );
      }
    }
  } else if (occupancySurcharge != null) {
    const [details] = await run(connection).query(
      'SELECT id, occupancySurcharge FROM booking_details WHERE bookingId = ? ORDER BY id ASC',
      [bookingId]
    );
    const currentSum = details.reduce((sum, d) => sum + Number(d.occupancySurcharge || 0), 0);
    if (currentSum > 0 && details.length > 0) {
      let allocated = 0;
      for (let i = 0; i < details.length; i++) {
        const d = details[i];
        let newSur = 0;
        if (i === details.length - 1) {
          newSur = Math.max(0, occupancySurcharge - allocated);
        } else {
          newSur = Math.round((Number(d.occupancySurcharge) / currentSum) * occupancySurcharge);
          allocated += newSur;
        }
        await run(connection).query(
          'UPDATE booking_details SET occupancySurcharge = ? WHERE id = ?',
          [newSur, d.id]
        );
      }
    } else if (details.length > 0) {
      await run(connection).query(
        'UPDATE booking_details SET occupancySurcharge = 0 WHERE bookingId = ?',
        [bookingId]
      );
      if (occupancySurcharge > 0) {
        await run(connection).query(
          'UPDATE booking_details SET occupancySurcharge = ? WHERE id = ?',
          [occupancySurcharge, details[0].id]
        );
      }
    }
  }
};

// Cập nhật FULL đặt phòng (ngày nhận, ngày trả, phòng vật lý, tiền phòng, phụ thu).
// Dùng cho việc cập nhật tự do check-in/check-out/hạng phòng của booking chưa check-in.
const updateBookingStayFull = async (bookingId, payload, connection) => {
  const serviceAmount = await sumBookingServices(bookingId, connection);
  const totalAmount = Number(payload.totalPrice || 0) + Number(serviceAmount || 0);

  const snapshotJson = payload.extraGuestSnapshot
    ? JSON.stringify(payload.extraGuestSnapshot)
    : null;

  await run(connection).query(
    `UPDATE bookings
     SET check_in = ?,
         check_out = ?,
         room_id = ?,
         total_price = ?,
         totalAmount = ?,
         extraGuestSnapshot = COALESCE(?, extraGuestSnapshot)
     WHERE id = ?`,
    [
      payload.checkIn,
      payload.checkOut,
      payload.roomId,
      payload.totalPrice,
      totalAmount,
      snapshotJson,
      bookingId,
    ]
  );

  // Update checkInDate, checkOutDate, roomId for all details of this booking
  await run(connection).query(
    `UPDATE booking_details
     SET checkInDate = ?,
         checkOutDate = ?,
         roomId = ?,
         roomPrice = ?
     WHERE bookingId = ?`,
    [
      payload.checkIn,
      payload.checkOut,
      payload.roomId,
      payload.roomPrice,
      bookingId,
    ]
  );

  // Reset occupancySurcharge = 0 for all details of this booking
  await run(connection).query(
    `UPDATE booking_details SET occupancySurcharge = 0 WHERE bookingId = ?`,
    [bookingId]
  );

  // Set occupancySurcharge only on the first detail row
  if (payload.occupancySurcharge != null && payload.occupancySurcharge > 0) {
    const [details] = await run(connection).query(
      `SELECT id FROM booking_details WHERE bookingId = ? ORDER BY id ASC LIMIT 1`,
      [bookingId]
    );
    if (details.length > 0) {
      await run(connection).query(
        `UPDATE booking_details SET occupancySurcharge = ? WHERE id = ?`,
        [payload.occupancySurcharge, details[0].id]
      );
    }
  }
};

const transferBookingRoom = async (booking, toRoom, payload, connection, sourceDetail = null) => {
  const fromRoomId = sourceDetail?.roomId || payload.fromRoomId || booking.room_id;

  await run(connection).query(
    `
      INSERT INTO booking_room_transfers
        (bookingId, fromRoomId, toRoomId, fromDate, toDate, pricePerNight, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      booking.id,
      fromRoomId,
      toRoom.id,
      payload.fromDate,
      payload.toDate,
      Number(toRoom.price_per_night || 0),
      payload.reason || null
    ]
  );

  if (Number(booking.room_id) === Number(fromRoomId)) {
    await run(connection).query(
      'UPDATE bookings SET room_id = ? WHERE id = ?',
      [toRoom.id, booking.id]
    );
  }

  if (sourceDetail && sourceDetail.id) {
    await run(connection).query(
      'UPDATE booking_details SET roomId = ?, roomTypeId = ?, roomPrice = ? WHERE id = ? AND bookingId = ?',
      [toRoom.id, toRoom.roomTypeId, Number(toRoom.price_per_night || 0), sourceDetail.id, booking.id]
    );
  } else if (fromRoomId) {
    await run(connection).query(
      'UPDATE booking_details SET roomId = ?, roomTypeId = ?, roomPrice = ? WHERE bookingId = ? AND roomId = ? LIMIT 1',
      [toRoom.id, toRoom.roomTypeId, Number(toRoom.price_per_night || 0), booking.id, fromRoomId]
    );
  } else {
    await run(connection).query(
      'UPDATE booking_details SET roomId = ?, roomTypeId = ?, roomPrice = ? WHERE bookingId = ? LIMIT 1',
      [toRoom.id, toRoom.roomTypeId, Number(toRoom.price_per_night || 0), booking.id]
    );
  }
};

// Các khoảng giá theo mùa/thời điểm/ngày lễ/cuối tuần của một loại phòng (bảng room_prices)
const listRoomPriceRanges = async (roomTypeId, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT id, roomTypeId, startDate, endDate, price, priceType, note
      FROM room_prices
      WHERE roomTypeId = ? OR roomTypeId IS NULL
      ORDER BY (roomTypeId IS NOT NULL) DESC, id DESC
    `,
    [roomTypeId]
  );
  return rows;
};

const listAllRoomPrices = async (filters = {}, connection) => {
  const conditions = [];
  const values = [];

  if (filters.roomTypeId) {
    conditions.push('(rp.roomTypeId = ? OR rp.roomTypeId IS NULL)');
    values.push(filters.roomTypeId);
  }
  if (filters.priceType) {
    conditions.push('rp.priceType = ?');
    values.push(filters.priceType);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await run(connection).query(
    `
      SELECT rp.id, rp.roomTypeId, rp.startDate, rp.endDate, rp.price, rp.priceType, rp.note,
             rt.typeName AS roomTypeName, rt.defaultPrice AS roomTypeDefaultPrice
      FROM room_prices rp
      LEFT JOIN room_types rt ON rt.id = rp.roomTypeId
      ${whereClause}
      ORDER BY rp.startDate DESC, rp.id DESC
    `,
    values
  );
  return rows;
};

const getRoomPriceById = async (id, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT rp.id, rp.roomTypeId, rp.startDate, rp.endDate, rp.price, rp.priceType, rp.note,
             rt.typeName AS roomTypeName
      FROM room_prices rp
      LEFT JOIN room_types rt ON rt.id = rp.roomTypeId
      WHERE rp.id = ?
    `,
    [id]
  );
  return rows[0] || null;
};

const createRoomPrice = async (data, connection) => {
  const [result] = await run(connection).query(
    `
      INSERT INTO room_prices (roomTypeId, startDate, endDate, price, priceType, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      data.roomTypeId || null,
      data.startDate,
      data.endDate,
      Number(data.price),
      data.priceType || 'normal',
      data.note || null
    ]
  );
  return result.insertId;
};

const updateRoomPrice = async (id, data, connection) => {
  await run(connection).query(
    `
      UPDATE room_prices
      SET roomTypeId = ?, startDate = ?, endDate = ?, price = ?, priceType = ?, note = ?
      WHERE id = ?
    `,
    [
      data.roomTypeId || null,
      data.startDate,
      data.endDate,
      Number(data.price),
      data.priceType || 'normal',
      data.note || null,
      id
    ]
  );
};

const deleteRoomPrice = async (id, connection) => {
  await run(connection).query('DELETE FROM room_prices WHERE id = ?', [id]);
};

const getBookingById = async (bookingId, connection, lock = false) => {
  const [rows] = await run(connection).query(
    `${BOOKING_SELECT} WHERE b.id = ? GROUP BY b.id ${lock ? 'FOR UPDATE' : ''}`,
    [bookingId]
  );
  return rows[0] || null;
};

const listBookings = async ({ userId, status } = {}) => {
  const conditions = [];
  const values = [];

  if (userId) {
    conditions.push('b.user_id = ?');
    values.push(userId);
  }

  if (status) {
    conditions.push('b.status = ?');
    values.push(status);
  }

  const [rows] = await db.query(
    `
      ${BOOKING_SELECT}
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `,
    values
  );
  return rows;
};

const updateBookingStatus = async (bookingId, status, connection) => {
  await run(connection).query(
    'UPDATE bookings SET status = ?, bookingStatus = ? WHERE id = ?',
    [status, status, bookingId]
  );
};

const releaseAvailabilityByBooking = async () => {};

const updateRoomStatus = async (roomId, status, connection) => {
  await run(connection).query(
    'UPDATE rooms SET status = ? WHERE id = ?',
    [status, roomId]
  );
};

// Lưu giá đã chốt của từng đêm (kèm loại giá, ghi chú và phòng). Gọi lúc đặt phòng, gia hạn và chuyển phòng.
const saveNightlyPrices = async (bookingId, prices, connection) => {
  if (!Array.isArray(prices) || prices.length === 0) return;

  const values = prices.map((item) => [
    bookingId,
    item.date || item.stayDate,
    Number(item.price || 0),
    item.priceType || 'normal',
    item.note || null,
    item.roomId || null
  ]);

  await run(connection).query(
    `INSERT INTO booking_nightly_prices (bookingId, stayDate, price, priceType, note, roomId)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       price = VALUES(price),
       priceType = VALUES(priceType),
       note = VALUES(note),
       roomId = VALUES(roomId)`,
    [values]
  );
};

// Giá đã chốt của các đêm trong khoảng [from, to) hoặc toàn bộ đặt phòng.
const listNightlyPrices = async (bookingId, from, to, connection) => {
  const conditions = ['bnp.bookingId = ?'];
  const params = [bookingId];

  if (from) {
    conditions.push('bnp.stayDate >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('bnp.stayDate < ?');
    params.push(to);
  }

  const [rows] = await run(connection).query(
    `SELECT bnp.id, DATE_FORMAT(bnp.stayDate, '%Y-%m-%d') AS stayDate, bnp.price,
            COALESCE(bnp.priceType, 'normal') AS priceType, bnp.note, bnp.roomId,
            r.roomNumber
     FROM booking_nightly_prices bnp
     LEFT JOIN rooms r ON r.id = bnp.roomId
     WHERE ${conditions.join(' AND ')}
     ORDER BY bnp.stayDate ASC`,
    params
  );
  return rows;
};

// Ghi một dòng dấu vết vào lịch sử thao tác của đặt phòng.
// entry: { action, description, oldValue, newValue, amount, actorId, actorName, actorRole }
// Loại đối tượng mà một mốc lịch sử gắn vào. 'booking' là mặc định cho các
// thao tác tác động lên cả đơn (tạo đơn, hủy, gia hạn...).
const HISTORY_ENTITY_TYPES = ['booking', 'room', 'service', 'damage', 'payment', 'stay'];

const addBookingHistory = async (bookingId, entry, connection) => {
  const entityType = HISTORY_ENTITY_TYPES.includes(entry.entityType)
    ? entry.entityType
    : 'booking';

  const [result] = await run(connection).query(
    `
      INSERT INTO booking_history
        (bookingId, action, entityType, entityId, entityLabel, description, oldValue, newValue,
         amount, performedBy, performedByName, performedByRole)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      bookingId,
      entry.action,
      entityType,
      entry.entityId != null ? entry.entityId : null,
      entry.entityLabel || null,
      entry.description || null,
      entry.oldValue != null ? JSON.stringify(entry.oldValue) : null,
      entry.newValue != null ? JSON.stringify(entry.newValue) : null,
      entry.amount != null ? entry.amount : null,
      entry.actorId || null,
      entry.actorName || null,
      entry.actorRole || 'system'
    ]
  );
  return result.insertId;
};

const parseHistoryRow = (row) => {
  let oldValue = null;
  let newValue = null;
  try { oldValue = row.oldValue ? JSON.parse(row.oldValue) : null; } catch { oldValue = row.oldValue; }
  try { newValue = row.newValue ? JSON.parse(row.newValue) : null; } catch { newValue = row.newValue; }
  return { ...row, oldValue, newValue };
};

// Lịch sử thao tác trên một phòng, gộp từ mọi đơn đã từng dùng phòng đó.
const listRoomHistory = async (roomId, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT h.id, h.bookingId, h.action, h.entityType, h.entityId, h.entityLabel,
             h.description, h.oldValue, h.newValue, h.amount, h.performedBy,
             COALESCE(NULLIF(h.performedByName, ''), NULLIF(c.fullName, ''),
                      NULLIF(a.full_name, ''), a.email) AS performedByName,
             COALESCE(NULLIF(h.performedByRole, ''), a.role, 'system') AS performedByRole,
             a.email AS performedByEmail, h.createdAt
      FROM booking_history h
      LEFT JOIN accounts a ON a.id = h.performedBy
      LEFT JOIN customers c ON c.accountId = a.id
      WHERE (h.entityType = 'room' AND h.entityId = ?)
         OR h.bookingId IN (
           SELECT DISTINCT b.id
           FROM bookings b
           LEFT JOIN booking_details bd ON bd.bookingId = b.id
           WHERE COALESCE(bd.roomId, b.room_id) = ?
         )
      ORDER BY h.createdAt DESC, h.id DESC
      LIMIT 200
    `,
    [roomId, roomId]
  );
  return rows.map(parseHistoryRow);
};

const listBookingHistory = async (bookingId, connection, { entityType } = {}) => {
  const conditions = ['h.bookingId = ?'];
  const values = [bookingId];
  if (entityType) {
    conditions.push('h.entityType = ?');
    values.push(entityType);
  }

  const [rows] = await run(connection).query(
    `
      SELECT h.id, h.bookingId, h.action, h.entityType, h.entityId, h.entityLabel,
             h.description, h.oldValue, h.newValue, h.amount, h.performedBy,
             COALESCE(NULLIF(h.performedByName, ''), NULLIF(c.fullName, ''),
                      NULLIF(a.full_name, ''), a.email) AS performedByName,
             COALESCE(NULLIF(h.performedByRole, ''), a.role, 'system') AS performedByRole,
             a.email AS performedByEmail, h.createdAt
      FROM booking_history h
      LEFT JOIN accounts a ON a.id = h.performedBy
      LEFT JOIN customers c ON c.accountId = a.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY h.createdAt DESC, h.id DESC
    `,
    values
  );
  return rows.map(parseHistoryRow);
};

// Lấy tên hiển thị của người thực hiện thao tác từ tài khoản.
const getActorDisplayName = async (accountId, connection) => {
  if (!accountId) return null;
  const [rows] = await run(connection).query(
    `
      SELECT COALESCE(NULLIF(c.fullName, ''), NULLIF(a.full_name, ''), a.email) AS name
      FROM accounts a
      LEFT JOIN customers c ON c.accountId = a.id
      WHERE a.id = ?
      LIMIT 1
    `,
    [accountId]
  );
  return rows[0]?.name || null;
};

const listEligibleNoShowBookings = async (connection) => {
  return getOverdueCheckInCandidates(connection);
};

const getOverdueCheckInCandidates = async (connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT
        b.id,
        b.user_id,
        COALESCE(bd.roomId, b.room_id) AS room_id,
        b.status,
        b.bookingStatus,
        DATE(COALESCE(bd.checkInDate, b.check_in)) AS check_in,
        DATE(COALESCE(bd.checkOutDate, b.check_out)) AS check_out,
        COALESCE(bd.requestedCheckInTime, b.requestedCheckInTime) AS requested_check_in_time,
        COALESCE(bd.requestedCheckOutTime, b.requestedCheckOutTime) AS requested_check_out_time,
        COALESCE(bd.requestedCheckInDayOffset, b.requestedCheckInDayOffset, 0) AS requested_check_in_day_offset,
        b.actualCheckInTime AS actual_check_in_time,
        b.created_at,
        b.hold_expires_at,
        COALESCE(b.totalAmount, b.total_price, 0) AS total_amount,
        COALESCE(p.paidAmount, 0) AS paid_amount,
        COALESCE(p.remainingAmount, 0) AS remaining_amount,
        COALESCE(p.totalAmount, b.totalAmount, b.total_price, 0) AS payment_total_amount,
        COALESCE(p.paymentStatus, 'unpaid') AS payment_status
      FROM bookings b
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      LEFT JOIN payments p ON p.id = (
        SELECT p2.id
        FROM payments p2
        WHERE p2.bookingId = b.id
        ORDER BY p2.id DESC
        LIMIT 1
      )
      WHERE b.actualCheckInTime IS NULL
        AND COALESCE(b.bookingStatus, b.status) IN ('pending', 'confirmed')
    `
  );
  return rows;
};

// Chỉ một tiến trình được phép chuyển đơn sang no-show. Điều kiện trong câu
// UPDATE ngăn nhiều lịch quét đồng thời cùng ghi một thao tác vào lịch sử.
const markBookingNoShowIfEligible = async (bookingId, connection) => {
  const [result] = await run(connection).query(
    `UPDATE bookings
     SET status = 'no_show', bookingStatus = 'no_show'
     WHERE id = ?
       AND actualCheckInTime IS NULL
       AND COALESCE(bookingStatus, status) IN ('pending', 'confirmed')`,
    [bookingId]
  );
  return result.affectedRows > 0;
};

const updateRequestedCheckInTime = async (bookingId, requestedCheckInTime, dayOffset = 0, connection) => {
  await run(connection).query(
    'UPDATE bookings SET requestedCheckInTime = ?, requestedCheckInDayOffset = ? WHERE id = ?',
    [requestedCheckInTime, dayOffset, bookingId]
  );
  const [bd] = await run(connection).query(
    'SELECT id FROM booking_details WHERE bookingId = ?',
    [bookingId]
  );
  if (bd.length > 0) {
    await run(connection).query(
      'UPDATE booking_details SET requestedCheckInTime = ?, requestedCheckInDayOffset = ? WHERE bookingId = ?',
      [requestedCheckInTime, dayOffset, bookingId]
    );
  }
};

const DEFAULT_CHECKOUT_LATE_FEE_TIERS = {
  graceMinutes: 60,
  tier1MaxHours: 3.0,
  tier1Percent: 30.00,
  tier2MaxHours: 6.0,
  tier2Percent: 50.00,
  tier3Percent: 100.00,
  standardCheckOutTime: '12:00:00',
  standardCheckInTime: '14:00:00',
  housekeepingBufferMinutes: 60,
  absoluteMaxLateHours: 6.0
};

const notifyStaffAndAdmins = async (title, content, connection) => {
  const [staffAccounts] = await run(connection).query(
    `SELECT id FROM accounts WHERE role IN ('admin', 'staff', 'employee') AND status = 'active'`
  );
  for (const account of staffAccounts) {
    await createCustomerNotification(account.id, title, content, connection);
  }
};

const reassignRoomForBooking = async (bookingId, newRoomId, connection) => {
  await run(connection).query('UPDATE bookings SET room_id = ? WHERE id = ?', [newRoomId, bookingId]);
  await run(connection).query('UPDATE booking_details SET roomId = ? WHERE bookingId = ?', [newRoomId, bookingId]);
};

const getCheckoutLateFeeTiers = async (connection) => {
  const [rows] = await run(connection).query('SELECT * FROM checkout_late_fee_tiers WHERE id = 1');
  // Luôn trả về object hợp lệ — giống mẫu getPaymentAccountSettings/getChildrenPolicy,
  // để checkOut() không bao giờ âm thầm bỏ qua tính phí trễ giờ vì thiếu cấu hình.
  return rows[0] ? { ...DEFAULT_CHECKOUT_LATE_FEE_TIERS, ...rows[0] } : { ...DEFAULT_CHECKOUT_LATE_FEE_TIERS };
};

// Các cột *Percent là PHÍ PHẠT giữ lại, không phải phần trăm được hoàn:
// phạt 100% nghĩa là hoàn 0%. Xem nhãn ở màn hình Cài đặt & Chính sách.
const DEFAULT_CANCELLATION_POLICY = {
  nearTierMaxDays: 3,
  nearTierPercent: 100.0,
  midTierMaxDays: 7,
  midTierPercent: 50.0,
  farTierPercent: 0.0
};

const getCancellationPolicy = async (connection) => {
  try {
    const [rows] = await run(connection).query('SELECT * FROM cancellation_policies WHERE id = 1');
    return rows[0]
      ? { ...DEFAULT_CANCELLATION_POLICY, ...rows[0] }
      : { ...DEFAULT_CANCELLATION_POLICY };
  } catch (error) {
    // Thiếu bảng cấu hình thì vẫn hoàn tiền theo mức mặc định, không để hỏng
    // luồng hủy đơn của khách.
    console.error('Không đọc được cancellation_policies:', error.message);
    return { ...DEFAULT_CANCELLATION_POLICY };
  }
};

// Booking gần nhất nhận phòng TỪ ngày checkout của booking hiện tại trở đi, cùng phòng.
const findNextBookingForRoom = async (roomId, fromDate, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT b.id, DATE(COALESCE(bd.checkInDate, b.check_in)) AS checkInDate
      FROM bookings b
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      WHERE COALESCE(bd.roomId, b.room_id) = ?
        AND b.status IN ('pending', 'confirmed', 'checked_in')
        AND DATE(COALESCE(bd.checkInDate, b.check_in)) >= ?
      ORDER BY DATE(COALESCE(bd.checkInDate, b.check_in)) ASC
      LIMIT 1
    `,
    [roomId, fromDate]
  );
  return rows[0] || null;
};

const findAdjacentBookingsForRoom = async (roomId, checkInDate, checkOutDate, excludeBookingId, connection) => {
  const [previousRows] = await run(connection).query(
    `
      SELECT b.id, b.status, b.actualCheckOutTime,
             COALESCE(bd.requestedCheckOutTime, b.requestedCheckOutTime) AS requestedCheckOutTime
      FROM bookings b
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      WHERE COALESCE(bd.roomId, b.room_id) = ?
        AND b.id != ?
        AND b.status IN ('confirmed', 'checked_in', 'checked_out')
        AND DATE(COALESCE(bd.checkOutDate, b.check_out)) = ?
      ORDER BY b.id DESC
      LIMIT 1
    `,
    [roomId, excludeBookingId, checkInDate]
  );

  const [nextRows] = await run(connection).query(
    `
      SELECT b.id, b.status,
             COALESCE(bd.requestedCheckInTime, b.requestedCheckInTime) AS requestedCheckInTime
      FROM bookings b
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      WHERE COALESCE(bd.roomId, b.room_id) = ?
        AND b.id != ?
        AND b.status IN ('pending', 'confirmed')
        AND DATE(COALESCE(bd.checkInDate, b.check_in)) = ?
      ORDER BY b.id ASC
      LIMIT 1
    `,
    [roomId, excludeBookingId, checkOutDate]
  );

  return {
    previousBooking: previousRows[0] || null,
    nextBooking: nextRows[0] || null
  };
};

const findActiveCheckedInBooking = async (roomId, excludeBookingId, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT b.id
      FROM bookings b
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      WHERE COALESCE(bd.roomId, b.room_id) = ?
        AND b.status = 'checked_in'
        AND b.id != ?
      LIMIT 1
    `,
    [roomId, excludeBookingId]
  );
  return rows[0] || null;
};

// Mỗi đơn chỉ có đúng một lần trả phòng nên cũng chỉ có một khoản phí trễ giờ.
// Trước đây hàm này INSERT thẳng, nên lễ tân bấm "Trả phòng" lần thứ hai là
// thêm một dòng nữa và tiền phí nhân lên theo số lần bấm.
const addLateCheckoutCharge = async (bookingId, payload, connection) => {
  const values = [
    payload.lateMinutes,
    payload.tierPercent,
    payload.nightlyRate,
    payload.totalPrice,
    payload.note || null,
  ];

  const [existing] = await run(connection).query(
    'SELECT id FROM booking_late_checkout_charges WHERE bookingId = ? ORDER BY id LIMIT 1',
    [bookingId]
  );

  if (existing.length > 0) {
    const chargeId = existing[0].id;
    await run(connection).query(
      `
        UPDATE booking_late_checkout_charges
        SET lateMinutes = ?, tierPercent = ?, nightlyRate = ?, totalPrice = ?, note = ?
        WHERE id = ?
      `,
      [...values, chargeId]
    );
    // Dọn các dòng thừa do lần bấm trước sinh ra, nếu có.
    await run(connection).query(
      'DELETE FROM booking_late_checkout_charges WHERE bookingId = ? AND id <> ?',
      [bookingId, chargeId]
    );
    return { id: chargeId, totalPrice: payload.totalPrice };
  }

  const [result] = await run(connection).query(
    `
      INSERT INTO booking_late_checkout_charges
        (bookingId, lateMinutes, tierPercent, nightlyRate, totalPrice, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [bookingId, ...values]
  );
  return { id: result.insertId, totalPrice: payload.totalPrice };
};

const sumLateCheckoutCharges = async (bookingId, connection) => {
  const [[row]] = await run(connection).query(
    'SELECT COALESCE(SUM(totalPrice), 0) AS total FROM booking_late_checkout_charges WHERE bookingId = ?',
    [bookingId]
  );
  return Number(row?.total || 0);
};

const updateActualCheckOutTime = async (bookingId, time, connection) => {
  await run(connection).query('UPDATE bookings SET actualCheckOutTime = ? WHERE id = ?', [time, bookingId]);
};

// Đối xứng với updateActualCheckOutTime — ghi lại thời điểm khách thực sự nhận
// phòng (không phải giờ khách yêu cầu lúc đặt) để đối chiếu/thống kê sau này.
const updateActualCheckInTime = async (bookingId, time, connection) => {
  await run(connection).query('UPDATE bookings SET actualCheckInTime = ? WHERE id = ?', [time, bookingId]);
};

const getBookingDetailsWithRoomInfo = async (bookingId, connection) => {
  const [rows] = await run(connection).query(
    `SELECT bd.*, r.roomNumber AS room_number, COALESCE(bd.roomTypeId, r.roomTypeId, rt.id) AS room_type_id, rt.typeName AS room_type_name, rt.capacity AS room_capacity, rt.defaultPrice AS default_price
     FROM booking_details bd
     LEFT JOIN rooms r ON bd.roomId = r.id
     LEFT JOIN room_types rt ON bd.roomTypeId = rt.id OR r.roomTypeId = rt.id
     WHERE bd.bookingId = ?`,
    [bookingId]
  );
  return rows;
};

const replaceBookingDetails = async (bookingId, detailsList, connection) => {
  const runner = run(connection);
  const [existingDetails] = await runner.query(
    'SELECT id, roomId, roomTypeId FROM booking_details WHERE bookingId = ?',
    [bookingId]
  );
  const existingMap = new Map(existingDetails.map((d) => [d.id, d]));
  const preservedDetailIds = new Set();

  for (const detail of detailsList) {
    const detailId = Number(detail.bookingDetailId || detail.id || 0);
    if (detailId > 0 && existingMap.has(detailId)) {
      preservedDetailIds.add(detailId);
      await runner.query(
        `UPDATE booking_details
         SET roomId = ?, roomTypeId = ?, checkInDate = ?, checkOutDate = ?,
             adults = ?, children = ?, roomPrice = ?, occupancySurcharge = ?,
             requestedCheckInTime = ?, requestedCheckOutTime = ?, requestedCheckInDayOffset = ?
         WHERE id = ? AND bookingId = ?`,
        [
          detail.roomId || null,
          detail.roomTypeId || null,
          detail.checkInDate,
          detail.checkOutDate,
          detail.adults || 1,
          detail.children || 0,
          detail.roomPrice || 0,
          detail.occupancySurcharge || 0,
          detail.requestedCheckInTime || null,
          detail.requestedCheckOutTime || null,
          detail.requestedCheckInDayOffset || 0,
          detailId,
          bookingId
        ]
      );
    } else {
      const [insertRes] = await runner.query(
        `INSERT INTO booking_details (bookingId, roomId, roomTypeId, checkInDate, checkOutDate, adults, children, roomPrice, occupancySurcharge, requestedCheckInTime, requestedCheckOutTime, requestedCheckInDayOffset)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bookingId,
          detail.roomId || null,
          detail.roomTypeId || null,
          detail.checkInDate,
          detail.checkOutDate,
          detail.adults || 1,
          detail.children || 0,
          detail.roomPrice || 0,
          detail.occupancySurcharge || 0,
          detail.requestedCheckInTime || null,
          detail.requestedCheckOutTime || null,
          detail.requestedCheckInDayOffset || 0
        ]
      );
      preservedDetailIds.add(insertRes.insertId);
    }
  }

  const toDelete = existingDetails.filter((d) => !preservedDetailIds.has(d.id));
  if (toDelete.length > 0) {
    const idsToDelete = toDelete.map((d) => d.id);
    await runner.query(
      `DELETE FROM booking_details WHERE id IN (${idsToDelete.map(() => '?').join(',')}) AND bookingId = ?`,
      [...idsToDelete, bookingId]
    );
  }
};

const listAvailableRoomsIgnoringBooking = async (checkIn, checkOut, ignoreBookingId, connection) => {
  const [rows] = await run(connection).query(
    `SELECT r.*, rt.typeName AS room_type_name, rt.capacity AS room_capacity, rt.defaultPrice AS default_price
     FROM rooms r
     JOIN room_types rt ON r.roomTypeId = rt.id
     WHERE r.status != 'maintenance'
     AND r.id NOT IN (
       SELECT bd.roomId
       FROM booking_details bd
       JOIN bookings b ON b.id = bd.bookingId
       WHERE b.id != ?
       AND b.status NOT IN ('cancelled', 'completed', 'checked_out')
       AND bd.roomId IS NOT NULL
       AND bd.checkInDate < ?
       AND bd.checkOutDate > ?
     )
     ORDER BY r.roomNumber ASC`,
    [ignoreBookingId || 0, checkOut, checkIn]
  );
  return rows;
};

module.exports = {
  getAccountById,
  getOrCreateCustomerId,
  getRoomWithType,
  expireUnpaidBookingHolds,
  getSecuredConflictingBookings,
  getConflictingBookings,
  getBookingRoomStays,
  cancelCompetingUnpaidBookings,
  getBookingDetailsWithRoomInfo,
  replaceBookingDetails,
  listAvailableRoomsIgnoringBooking,
  listAvailableRoomsByType,
  listRoomTypeAvailability,
  listRoomPriceRanges,
  getBookedAvailabilityRows,
  createBooking,
  createBookingDetail,
  getServiceById,
  validateRoomInBooking,
  addBookingService,
  getBookingServiceChargeById,
  getBookingServicesByBookingId,
  updateBookingServiceCharge,
  updateBookingServiceStatus,
  deleteBookingServiceCharge,
  sumBookingServices,
  createCustomerNotification,
  replaceBookingGuests,
  addDamageCharge,
  getDamageChargeById,
  getDamageChargesByBookingId,
  updateDamageCharge,
  updateDamageChargeStatus,
  deleteDamageCharge,
  sumDamageCharges,
  updateBookingStay,
  updateBookingStayFull,
  transferBookingRoom,
  saveNightlyPrices,
  listNightlyPrices,
  addBookingHistory,
  listRoomHistory,
  HISTORY_ENTITY_TYPES,
  listBookingHistory,
  getActorDisplayName,
  getBookingById,
  listBookings,
  updateBookingStatus,
  releaseAvailabilityByBooking,
  updateRoomStatus,
  listEligibleNoShowBookings,
  getOverdueCheckInCandidates,
  markBookingNoShowIfEligible,
  updateRequestedCheckInTime,
  getCheckoutLateFeeTiers,
  getCancellationPolicy,
  findNextBookingForRoom,
  findAdjacentBookingsForRoom,
  addLateCheckoutCharge,
  sumLateCheckoutCharges,
  updateActualCheckOutTime,
  updateActualCheckInTime,
  notifyStaffAndAdmins,
  reassignRoomForBooking,
  findActiveCheckedInBooking,
  listAllRoomPrices,
  getRoomPriceById,
  createRoomPrice,
  updateRoomPrice,
  deleteRoomPrice,
  updateBookingHold
};

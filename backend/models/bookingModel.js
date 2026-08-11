const db = require('../config/db');

const run = (connection) => connection || db;
const HOLD_MINUTES = 15;
const { LATE_CHECKIN_GRACE_HOUR } = require('../utils/bookingPolicy');

const BOOKING_SELECT = `
  SELECT
    b.id,
    b.bookingCode AS booking_code,
    b.voucherId AS voucher_id,
    b.user_id,
    b.status,
    COALESCE(b.totalAmount, b.total_price, 0) AS total_price,
    COALESCE(b.total_price, 0) AS room_total_price,
    COALESCE(b.totalAmount, b.total_price, 0) AS booking_total_amount,
    COALESCE(
      (
        SELECT p.totalAmount
        FROM payments p
        WHERE p.bookingId = b.id
        ORDER BY p.id DESC
        LIMIT 1
      ),
      b.totalAmount,
      b.total_price,
      0
    ) AS payable_total,
    b.created_at,
    b.notes,
    b.extraGuestSnapshot AS extra_guest_snapshot,
    b.cancellation_reason,
    MIN(bd.id) AS detail_id,
    COALESCE(MIN(bd.roomId), b.room_id) AS room_id,
    DATE(COALESCE(MIN(bd.checkInDate), b.check_in)) AS check_in,
    DATE(COALESCE(MIN(bd.checkOutDate), b.check_out)) AS check_out,
    SUM(COALESCE(bd.adults, 0)) AS adults,
    SUM(COALESCE(bd.children, 0)) AS children,
    GREATEST(COUNT(DISTINCT bd.id), 1) AS room_quantity,
    MIN(bd.roomPrice) AS room_price,
    SUM(COALESCE(bd.occupancySurcharge, 0)) AS occupancy_surcharge,
    COALESCE(MIN(bd.requestedCheckInTime), b.requestedCheckInTime) AS requested_check_in_time,
    COALESCE(MIN(bd.requestedCheckOutTime), b.requestedCheckOutTime) AS requested_check_out_time,
    COALESCE(MIN(bd.requestedCheckInDayOffset), b.requestedCheckInDayOffset, 0) AS requested_check_in_day_offset,
    b.actualCheckInTime AS actual_check_in_time,
    b.actualCheckOutTime AS actual_check_out_time,
    COALESCE(b.guest_name, MAX(c.fullName)) AS customer_name,
    COALESCE(b.guest_email, MAX(a.email)) AS customer_email,
    COALESCE(b.guest_phone, MAX(c.phone), MAX(a.phone)) AS customer_phone,
    MIN(r.roomNumber) AS room_number,
    MIN(r.floor) AS room_floor,
    MIN(r.area) AS room_area,
    MIN(r.status) AS room_status,
    COALESCE(MIN(rt.typeName), 'Đặt phòng') AS room_type_name,
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

const expireUnpaidBookingHolds = async (connection) => {
  await run(connection).query(
    `
      UPDATE bookings b
      JOIN payments p ON p.bookingId = b.id
      SET b.status = 'cancelled',
          b.bookingStatus = 'cancelled'
      WHERE b.status IN ('pending', 'confirmed')
        AND p.paymentStatus = 'unpaid'
        AND COALESCE(p.paidAmount, 0) <= 0
        AND b.created_at < DATE_SUB(NOW(), INTERVAL ${HOLD_MINUTES} MINUTE)
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
            AND b.created_at >= DATE_SUB(NOW(), INTERVAL ${HOLD_MINUTES} MINUTE)
          )
        )
      ${lock ? 'FOR UPDATE' : ''}
    `,
    values
  );
  return rows;
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
                AND b.created_at >= DATE_SUB(NOW(), INTERVAL ${HOLD_MINUTES} MINUTE)
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
        requestedCheckInTime, requestedCheckOutTime
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  return result.insertId;
};

const createBookingDetail = async (bookingId, payload, roomPrice, occupancySurcharge = 0, connection) => {
  const [result] = await run(connection).query(
    `
      INSERT INTO booking_details
        (bookingId, roomId, checkInDate, checkOutDate, adults, children, roomPrice, occupancySurcharge,
         requestedCheckInTime, requestedCheckOutTime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      bookingId,
      payload.roomId,
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

const upsertAvailabilityRows = async () => {};

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
  const status = options.status || 'used';
  const unitPrice = Number(service.price || 0);
  const totalPrice = unitPrice * Number(quantity);
  const usedAt = status === 'used' ? new Date() : null;

  const [result] = await run(connection).query(
    `
      INSERT INTO booking_services (bookingId, bookingDetailId, roomId, serviceId, unitPrice, quantity, status, usedAt, totalPrice)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [bookingId, bookingDetailId, roomId, service.id, unitPrice, quantity, status, usedAt, totalPrice]
  );

  return {
    id: result.insertId,
    bookingId,
    bookingDetailId,
    roomId,
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
    `SELECT bs.id, bs.bookingId, bs.roomId, r.roomNumber, bs.serviceId, s.serviceName,
            COALESCE(bs.unitPrice, s.price) AS unitPrice, bs.quantity, bs.totalPrice,
            COALESCE(bs.status, 'used') AS status, bs.usedAt, bs.createdAt
     FROM booking_services bs
     LEFT JOIN services s ON s.id = bs.serviceId
     LEFT JOIN bookings b ON b.id = bs.bookingId
     LEFT JOIN rooms r ON r.id = COALESCE(bs.roomId, b.room_id)
     WHERE bs.id = ?`,
    [Number(svcId)]
  );
  return rows[0] || null;
};

const getBookingServicesByBookingId = async (bookingId, connection) => {
  const [rows] = await run(connection).query(
    `SELECT bs.id, bs.bookingId, bs.roomId, r.roomNumber, bs.serviceId, s.serviceName, s.description,
            COALESCE(bs.unitPrice, s.price) AS unitPrice, bs.quantity, bs.totalPrice,
            COALESCE(bs.status, 'used') AS status, bs.usedAt, bs.createdAt
     FROM booking_services bs
     LEFT JOIN services s ON s.id = bs.serviceId
     LEFT JOIN bookings b ON b.id = bs.bookingId
     LEFT JOIN rooms r ON r.id = COALESCE(bs.roomId, b.room_id)
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
      [bookingId, guest.fullName, guest.identityNumber, guest.phone || null, guest.note || null]
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

const updateBookingStay = async (bookingId, checkOut, totalPrice, connection, occupancySurcharge = null) => {

  const serviceAmount = await sumBookingServices(bookingId, connection);

  await run(connection).query(
    'UPDATE bookings SET check_out = ?, total_price = ?, totalAmount = ? WHERE id = ?',
    [checkOut, totalPrice, Number(totalPrice) + serviceAmount, bookingId]
  );

  if (occupancySurcharge != null) {
    await run(connection).query(
      'UPDATE booking_details SET checkOutDate = ?, occupancySurcharge = ? WHERE bookingId = ?',
      [checkOut, occupancySurcharge, bookingId]
    );
    return;
  }

  await run(connection).query(
    'UPDATE booking_details SET checkOutDate = ? WHERE bookingId = ?',
    [checkOut, bookingId]
  );
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

const transferBookingRoom = async (booking, toRoom, payload, connection) => {
  await run(connection).query(
    `
      INSERT INTO booking_room_transfers
        (bookingId, fromRoomId, toRoomId, fromDate, toDate, pricePerNight, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      booking.id,
      booking.room_id,
      toRoom.id,
      payload.fromDate,
      payload.toDate,
      Number(toRoom.price_per_night || 0),
      payload.reason || null
    ]
  );

  await run(connection).query(
    'UPDATE bookings SET room_id = ? WHERE id = ?',
    [toRoom.id, booking.id]
  );

  await run(connection).query(
    'UPDATE booking_details SET roomId = ?, roomPrice = ? WHERE bookingId = ?',
    [toRoom.id, Number(toRoom.price_per_night || 0), booking.id]
  );
};

// Các khoảng giá theo mùa/thời điểm của một loại phòng (bảng room_prices)
const listRoomPriceRanges = async (roomTypeId, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT startDate, endDate, price, priceType
      FROM room_prices
      WHERE roomTypeId = ?
      ORDER BY DATEDIFF(endDate, startDate) ASC, id DESC
    `,
    [roomTypeId]
  );
  return rows;
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

// Lưu giá đã chốt của từng đêm. Gọi lúc đặt phòng và khi gia hạn thêm đêm.
const saveNightlyPrices = async (bookingId, prices, connection) => {
  if (!Array.isArray(prices) || prices.length === 0) return;

  const values = prices.map((item) => [bookingId, item.date, item.price]);
  await run(connection).query(
    `INSERT INTO booking_nightly_prices (bookingId, stayDate, price)
     VALUES ?
     ON DUPLICATE KEY UPDATE price = VALUES(price)`,
    [values]
  );
};

// Giá đã chốt của các đêm trong khoảng [from, to). Trả mảng rỗng với những
// booking tạo trước khi có bảng này để nơi gọi tự tính lại như cũ.
const listNightlyPrices = async (bookingId, from, to, connection) => {
  const [rows] = await run(connection).query(
    `SELECT stayDate, price
     FROM booking_nightly_prices
     WHERE bookingId = ? AND stayDate >= ? AND stayDate < ?
     ORDER BY stayDate ASC`,
    [bookingId, from, to]
  );
  return rows;
};

// Ghi một dòng dấu vết vào lịch sử thao tác của đặt phòng.
// entry: { action, description, oldValue, newValue, amount, actorId, actorName, actorRole }
const addBookingHistory = async (bookingId, entry, connection) => {
  const [result] = await run(connection).query(
    `
      INSERT INTO booking_history
        (bookingId, action, description, oldValue, newValue, amount, performedBy, performedByName, performedByRole)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      bookingId,
      entry.action,
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

const listBookingHistory = async (bookingId, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT id, bookingId, action, description, oldValue, newValue, amount,
             performedBy, performedByName, performedByRole, createdAt
      FROM booking_history
      WHERE bookingId = ?
      ORDER BY createdAt DESC, id DESC
    `,
    [bookingId]
  );
  return rows.map((row) => {
    let oldValue = null;
    let newValue = null;
    try { oldValue = row.oldValue ? JSON.parse(row.oldValue) : null; } catch { oldValue = row.oldValue; }
    try { newValue = row.newValue ? JSON.parse(row.newValue) : null; } catch { newValue = row.newValue; }
    return { ...row, oldValue, newValue };
  });
};

// Lấy tên hiển thị của người thực hiện thao tác từ tài khoản.
const getActorDisplayName = async (accountId, connection) => {
  if (!accountId) return null;
  try {
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
  } catch (err) {
    console.error('getActorDisplayName error:', err.message);
    return null;
  }
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

const addLateCheckoutCharge = async (bookingId, payload, connection) => {
  const [existing] = await run(connection).query(
    'SELECT id FROM booking_late_checkout_charges WHERE bookingId = ? ORDER BY id ASC LIMIT 1',
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
      [payload.lateMinutes, payload.tierPercent, payload.nightlyRate, payload.totalPrice, payload.note || null, chargeId]
    );
    await run(connection).query(
      'DELETE FROM booking_late_checkout_charges WHERE bookingId = ? AND id != ?',
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
    [bookingId, payload.lateMinutes, payload.tierPercent, payload.nightlyRate, payload.totalPrice, payload.note || null]
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

module.exports = {
  getAccountById,
  getOrCreateCustomerId,
  getRoomWithType,
  expireUnpaidBookingHolds,
  getSecuredConflictingBookings,
  getConflictingBookings,
  cancelCompetingUnpaidBookings,
  listAvailableRoomsByType,
  listRoomTypeAvailability,
  listRoomPriceRanges,
  getBookedAvailabilityRows,
  createBooking,
  createBookingDetail,
  upsertAvailabilityRows,
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
  listBookingHistory,
  getActorDisplayName,
  getBookingById,
  listBookings,
  updateBookingStatus,
  releaseAvailabilityByBooking,
  updateRoomStatus,
  listEligibleNoShowBookings,
  getOverdueCheckInCandidates,
  updateRequestedCheckInTime,
  getCheckoutLateFeeTiers,
  findNextBookingForRoom,
  findAdjacentBookingsForRoom,
  addLateCheckoutCharge,
  sumLateCheckoutCharges,
  updateActualCheckOutTime,
  updateActualCheckInTime,
  notifyStaffAndAdmins,
  reassignRoomForBooking,
  findActiveCheckedInBooking
};
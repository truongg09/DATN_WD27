const db = require('../config/db');
const bookingModel = require('../models/bookingModel');
const paymentService = require('./paymentService');
const emailService = require('./emailService');
const voucherService = require('./voucherService');
const HttpError = require('../utils/httpError');
const {
  dayString,
  isWithinLateCheckInWindow,
  isLateCheckIn,
  isPastNoShowDeadline,
  getLateCheckInDeadline,
  LATE_CHECKIN_GRACE_HOUR
} = require('../utils/bookingPolicy');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HOLD_MINUTES = 15;
const bookingStatusLabel = (status) => ({
  pending: 'chờ xác nhận',
  confirmed: 'đã xác nhận',
  checked_in: 'đang lưu trú',
  checked_out: 'đã trả phòng',
  cancelled: 'đã hủy',
  no_show: 'khách không đến'
}[status] || status);

const dateToUtc = (date) => new Date(`${date}T00:00:00.000Z`);

const actorRoleLabel = (role) => ({
  admin: 'Quản trị viên',
  employee: 'Nhân viên',
  staff: 'Nhân viên',
  customer: 'Khách hàng',
  system: 'Hệ thống'
}[role] || role || 'Hệ thống');

// Chuẩn hóa người thực hiện thao tác từ req.user (JWT: { userId, email, role })
// thành { actorId, actorName, actorRole } để ghi vào booking_history.
const resolveActor = async (actor, connection) => {
  if (!actor || !actor.userId) {
    return { actorId: null, actorName: null, actorRole: 'system' };
  }
  let name = null;
  try {
    name = await bookingModel.getActorDisplayName(actor.userId, connection);
  } catch {
    name = null;
  }
  return {
    actorId: actor.userId,
    actorName: name || actor.email || null,
    actorRole: actor.role || 'system'
  };
};

const displayDate = (date) => {
  const [year, month, day] = dayString(date).split('-');
  return `${day}/${month}/${year}`;
};

const displayMoney = (amount) => `${Number(amount || 0).toLocaleString('vi-VN')}₫`;

// Ghi dấu vết lịch sử cho đặt phòng. Gọi bên trong transaction của thao tác
// để lịch sử luôn nhất quán với dữ liệu (rollback thì log cũng rollback).
const logHistory = async (bookingId, action, description, extra, actor, connection) => {
  const resolved = await resolveActor(actor, connection);
  await bookingModel.addBookingHistory(
    bookingId,
    {
      action,
      description,
      oldValue: extra?.oldValue,
      newValue: extra?.newValue,
      amount: extra?.amount,
      ...resolved
    },
    connection
  );
};

const getNightCount = (checkIn, checkOut) => {
  return Math.round((dateToUtc(checkOut) - dateToUtc(checkIn)) / MS_PER_DAY);
};

const getStayDates = (checkIn, checkOut) => {
  const dates = [];
  const cursor = dateToUtc(checkIn);
  const end = dateToUtc(checkOut);

  while (cursor < end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

// Giá từng đêm: ưu tiên khoảng giá trong room_prices (khoảng hẹp hơn thắng),
// đêm nào không có khoảng giá thì dùng giá mặc định của loại phòng.
const calcNightlyPrices = async (roomTypeId, fallbackPrice, checkIn, checkOut, connection) => {
  const nights = getStayDates(dayString(checkIn), dayString(checkOut));
  const ranges = roomTypeId
    ? await bookingModel.listRoomPriceRanges(roomTypeId, connection)
    : [];

  const prices = nights.map((night) => {
    const range = ranges.find(
      (item) => dayString(item.startDate) <= night && night <= dayString(item.endDate)
    );
    return {
      date: night,
      price: range ? Number(range.price) : Number(fallbackPrice || 0)
    };
  });

  return {
    nights: prices.length,
    prices,
    total: prices.reduce((sum, item) => sum + item.price, 0)
  };
};

// Chính sách phụ thu trẻ em (admin cấu hình trong app_settings, key children_policy)
const DEFAULT_CHILDREN_POLICY = {
  freeMaxAge: 5, // 0-5 tuổi miễn phí
  childMaxAge: 11, // 6-11 tuổi tính phụ thu; >= 12 tính như người lớn
  surchargePerNight: 200000
};

// Tài khoản nhận tiền của khách sạn (admin cấu hình ở trang Cài đặt thanh toán).
// Giữ đúng key và giá trị mặc định như routes/settings.js để hai nơi không lệch.
const DEFAULT_PAYMENT_ACCOUNT = {
  bankBin: '970422',
  bankCode: 'MB',
  bankName: 'MB Bank (Ngân hàng Quân đội)',
  accountNumber: '0000000000',
  accountName: 'KHACH SAN HOTELHUB',
  transferPrefix: 'HB'
};

const getPaymentAccountSettings = async (connection) => {
  try {
    const [rows] = await (connection || db).query(
      "SELECT settingValue FROM app_settings WHERE settingKey = 'payment_account'"
    );
    if (rows.length === 0) return { ...DEFAULT_PAYMENT_ACCOUNT };
    return { ...DEFAULT_PAYMENT_ACCOUNT, ...JSON.parse(rows[0].settingValue) };
  } catch {
    return { ...DEFAULT_PAYMENT_ACCOUNT };
  }
};

const getChildrenPolicy = async (connection) => {
  try {
    const [rows] = await (connection || db).query(
      "SELECT settingValue FROM app_settings WHERE settingKey = 'children_policy'"
    );
    if (rows.length === 0) return { ...DEFAULT_CHILDREN_POLICY };
    return { ...DEFAULT_CHILDREN_POLICY, ...JSON.parse(rows[0].settingValue) };
  } catch {
    return { ...DEFAULT_CHILDREN_POLICY };
  }
};

// Phụ thu trẻ em = số trẻ trong độ tuổi phụ thu x phụ thu/đêm x số đêm
const calcChildSurcharge = (childrenAges, nights, policy) => {
  const ages = Array.isArray(childrenAges) ? childrenAges : [];
  const chargeableChildren = ages.filter(
    (age) => Number(age) > policy.freeMaxAge && Number(age) <= policy.childMaxAge
  ).length;
  const adultsFromChildren = ages.filter((age) => Number(age) > policy.childMaxAge).length;

  return {
    chargeableChildren,
    adultsFromChildren,
    surchargePerNight: policy.surchargePerNight,
    amount: chargeableChildren * policy.surchargePerNight * nights
  };
};

const ensureBookable = async (payload, connection, lock = false) => {
  await bookingModel.expireUnpaidBookingHolds(connection);

  const customer = await bookingModel.getAccountById(payload.userId, connection);
  const room = await bookingModel.getRoomWithType(payload.roomId, connection, lock);

  if (!customer) {
    throw new HttpError(404, 'Không tìm thấy khách hàng');
  }

  if (!room) {
    throw new HttpError(404, 'Không tìm thấy phòng');
  }

  if (room.status === 'maintenance') {
    throw new HttpError(409, 'Phòng đang được bảo trì');
  }

  const childrenPolicy = await getChildrenPolicy(connection);
  const childAges = Array.isArray(payload.childrenAges) ? payload.childrenAges : [];
  const adultsFromChildren = childAges.length === payload.children
    ? childAges.filter((age) => Number(age) > childrenPolicy.childMaxAge).length
    : payload.children;

  if (payload.adults + adultsFromChildren > room.capacity) {
    throw new HttpError(400, `Số khách vượt quá sức chứa phòng (${room.capacity} người)`);
  }

  const bookingConflicts = await bookingModel.getConflictingBookings(
    payload.roomId,
    payload.checkIn,
    payload.checkOut,
    connection,
    lock
  );
  const availabilityConflicts = await bookingModel.getBookedAvailabilityRows(
    payload.roomId,
    payload.checkIn,
    payload.checkOut,
    connection,
    lock
  );

  if (bookingConflicts.length > 0 || availabilityConflicts.length > 0) {
    throw new HttpError(409, 'Phòng không còn trống trong khoảng ngày đã chọn', {
      conflictingBookingIds: bookingConflicts.map((booking) => booking.id)
    });
  }

  return { customer, room };
};

const ensureRoomAvailable = async (payload, connection, lock = false) => {
  await bookingModel.expireUnpaidBookingHolds(connection);

  const room = await bookingModel.getRoomWithType(payload.roomId, connection, lock);

  if (!room) {
    throw new HttpError(404, 'Không tìm thấy phòng');
  }

  if (room.status === 'maintenance') {
    throw new HttpError(409, 'Phòng đang được bảo trì');
  }

  const bookingConflicts = await bookingModel.getConflictingBookings(
    payload.roomId,
    payload.checkIn,
    payload.checkOut,
    connection,
    lock
  );
  const availabilityConflicts = await bookingModel.getBookedAvailabilityRows(
    payload.roomId,
    payload.checkIn,
    payload.checkOut,
    connection,
    lock
  );

  return {
    room,
    bookingConflicts,
    availabilityConflicts,
    available: bookingConflicts.length === 0 && availabilityConflicts.length === 0
  };
};

// Báo giá + kiểm tra phòng trống theo HẠNG PHÒNG (khách không chọn phòng cụ thể).
// Giá tính từ room_prices/defaultPrice của loại phòng nên không cần phòng vật lý.
const checkTypeQuote = async (payload) => {
  await bookingModel.expireUnpaidBookingHolds();

  const [types] = await db.query(
    'SELECT id, typeName, description, capacity, defaultPrice FROM room_types WHERE id = ?',
    [payload.roomTypeId]
  );
  if (types.length === 0) {
    throw new HttpError(404, 'Không tìm thấy hạng phòng');
  }
  const roomType = types[0];

  const rooms = await bookingModel.listAvailableRoomsByType(
    payload.roomTypeId,
    payload.checkIn,
    payload.checkOut
  );

  const nightly = await calcNightlyPrices(
    payload.roomTypeId,
    roomType.defaultPrice,
    payload.checkIn,
    payload.checkOut
  );
  const childrenPolicy = await getChildrenPolicy();
  const childSurcharge = calcChildSurcharge(payload.childrenAges, nightly.nights, childrenPolicy);

  return {
    available: rooms.length > 0,
    roomTypeId: payload.roomTypeId,
    roomTypeName: roomType.typeName,
    capacity: Number(roomType.capacity),
    availableRooms: rooms.length,
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    nights: nightly.nights,
    pricePerNight: Number(roomType.defaultPrice),
    nightlyPrices: nightly.prices,
    stayAmount: nightly.total,
    childSurcharge,
    childrenPolicy,
    totalAmount: nightly.total + childSurcharge.amount,
    holdMinutes: HOLD_MINUTES,
    conflictingBookingIds: []
  };
};

const checkAvailability = async (payload) => {
  if (!payload.roomId && payload.roomTypeId) {
    return checkTypeQuote(payload);
  }

  const { room, bookingConflicts, available } = await ensureRoomAvailable(payload);

  // Giá theo từng đêm (mùa cao điểm/lễ có thể khác nhau) + phụ thu trẻ em
  const nightly = await calcNightlyPrices(
    room.roomTypeId,
    room.price_per_night,
    payload.checkIn,
    payload.checkOut
  );
  const childrenPolicy = await getChildrenPolicy();
  const childSurcharge = calcChildSurcharge(payload.childrenAges, nightly.nights, childrenPolicy);

  return {
    available,
    roomId: payload.roomId,
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    nights: nightly.nights,
    pricePerNight: Number(room.price_per_night),
    nightlyPrices: nightly.prices,
    stayAmount: nightly.total,
    childSurcharge,
    childrenPolicy,
    totalAmount: nightly.total + childSurcharge.amount,
    holdMinutes: HOLD_MINUTES,
    conflictingBookingIds: bookingConflicts.map((booking) => booking.id)
  };
};

const checkTypeAvailability = async (payload) => {
  await bookingModel.expireUnpaidBookingHolds();

  const allTypes = await bookingModel.listRoomTypeAvailability(payload.checkIn, payload.checkOut);
  const requested = payload.rooms.map((item) => {
    const type = allTypes.find((roomType) => Number(roomType.id) === Number(item.roomTypeId));
    const availableRooms = Number(type?.availableRooms || 0);
    const shortage = Math.max(item.quantity - availableRooms, 0);

    return {
      roomTypeId: item.roomTypeId,
      roomTypeName: type?.room_type_name || `Loại phòng #${item.roomTypeId}`,
      requestedQuantity: item.quantity,
      availableRooms,
      canBookQuantity: Math.min(item.quantity, availableRooms),
      shortage,
      enough: shortage === 0,
      roomIds: (type?.roomIds || []).slice(0, item.quantity)
    };
  });

  const totalShortage = requested.reduce((sum, item) => sum + item.shortage, 0);
  const requestedTypeIds = new Set(payload.rooms.map((item) => Number(item.roomTypeId)));
  const suggestions = allTypes
    .filter((roomType) => !requestedTypeIds.has(Number(roomType.id)) && Number(roomType.availableRooms) > 0)
    .map((roomType) => ({
      roomTypeId: roomType.id,
      roomTypeName: roomType.room_type_name,
      availableRooms: Number(roomType.availableRooms),
      pricePerNight: Number(roomType.price_per_night),
      capacity: Number(roomType.capacity)
    }));

  return {
    available: totalShortage === 0,
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    requested,
    suggestions,
    message:
      totalShortage === 0
        ? 'Đủ phòng theo yêu cầu'
        : 'Không đủ số lượng phòng theo yêu cầu, vui lòng giảm số lượng hoặc chọn thêm loại phòng khác'
  };
};

const expireUnpaidBookingHolds = () => bookingModel.expireUnpaidBookingHolds();

const getRefundPolicy = (checkIn, paidAmount = 0) => {
  // Cả hai mốc phải cùng một hệ quy chiếu. Trước đây `today` là nửa đêm giờ địa
  // phương còn `checkInDate` là nửa đêm UTC, nên trên máy chủ VN (UTC+7) số ngày
  // luôn lệch: hủy 2 ngày trước khi nhận phòng bị tính thành 3 (hoàn 50% thay vì
  // 100%), còn hủy sau ngày nhận phòng lại ra 0 ngày và được hoàn 100%.
  const today = dateToUtc(dayString(new Date()));
  const checkInDate = dateToUtc(dayString(checkIn));
  const daysBeforeCheckIn = Math.round((checkInDate - today) / MS_PER_DAY);
  const rate = daysBeforeCheckIn < 0
    ? 0
    : daysBeforeCheckIn < 3
      ? 1
      : daysBeforeCheckIn <= 7
        ? 0.5
        : 0;

  return {
    daysBeforeCheckIn,
    refundRate: rate,
    refundableAmount: Math.round(Number(paidAmount || 0) * rate)
  };
};

const createBooking = async (payload, actor) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Đặt theo hạng phòng: hệ thống tự gán phòng trống đầu tiên (khóa FOR UPDATE
    // để hai khách đặt cùng lúc không bị gán trùng một phòng).
    if (!payload.roomId && payload.roomTypeId) {
      const availableRooms = await bookingModel.listAvailableRoomsByType(
        payload.roomTypeId,
        payload.checkIn,
        payload.checkOut,
        connection,
        true
      );
      if (availableRooms.length === 0) {
        throw new HttpError(409, 'Hạng phòng này đã hết phòng trống trong khoảng ngày đã chọn');
      }
      payload.roomId = availableRooms[0].id;
    }

    const { room } = await ensureBookable(payload, connection, true);
    const roomPrice = Number(room.price_per_night);
    const dates = getStayDates(payload.checkIn, payload.checkOut);

    // Tổng tiền = giá từng đêm (theo room_prices) + phụ thu trẻ em.
    // Giá được chốt tại thời điểm đặt (khóa giá) - đổi giá sau này không ảnh hưởng booking cũ.
    const nightly = await calcNightlyPrices(
      room.roomTypeId,
      roomPrice,
      payload.checkIn,
      payload.checkOut,
      connection
    );
    const childrenPolicy = await getChildrenPolicy(connection);
    const childSurcharge = calcChildSurcharge(payload.childrenAges, nightly.nights, childrenPolicy);
    const totalPrice = nightly.total + childSurcharge.amount;

    const bookingId = await bookingModel.createBooking(payload, totalPrice, connection);
    // Keep the guest surcharge on the booking detail so payments can always
    // display accommodation, guest surcharge, and extra services separately.
    await bookingModel.createBookingDetail(
      bookingId,
      payload,
      roomPrice,
      childSurcharge.amount,
      connection
    );
    await bookingModel.upsertAvailabilityRows(payload.roomId, bookingId, dates, connection);
    // Chốt giá từng đêm để thao tác về sau không tính lại theo bảng giá mới.
    await bookingModel.saveNightlyPrices(bookingId, nightly.prices, connection);

    let serviceAmount = 0;
    // Dịch vụ khách chủ động chọn khi đặt được xác nhận và tính vào payment ngay.
    if (Array.isArray(payload.serviceRequests) && payload.serviceRequests.length > 0) {
      for (const request of payload.serviceRequests) {
        const service = await bookingModel.getServiceById(request.serviceId, connection);
        if (!service) {
          throw new HttpError(404, `Không tìm thấy dịch vụ (${request.serviceId})`);
        }
        const serviceName = String(service.serviceName || '').toLowerCase();
        if (
          request.quantity > 1 &&
          (serviceName.includes('extra bed') || serviceName.includes('giường'))
        ) {
          throw new HttpError(400, 'Mỗi phòng chỉ được kê tối đa 1 giường phụ');
        }
        await bookingModel.addBookingService(bookingId, service, request.quantity, connection);
        serviceAmount += Number(service.price) * request.quantity;
        await connection.query(
          `INSERT INTO booking_service_requests (bookingId, serviceId, quantity, status) VALUES (?, ?, ?, 'confirmed')`,
          [bookingId, request.serviceId, request.quantity]
        );
      }
    }
    await connection.query(
      'UPDATE bookings SET totalAmount = ? WHERE id = ?',
      [totalPrice + serviceAmount, bookingId]
    );

    const payment = await paymentService.createPaymentForBooking(
      bookingId,
      { serviceAmount },
      connection
    );

    await logHistory(
      bookingId,
      'created',
      `Tạo đặt phòng ${room.roomNumber ? `phòng ${room.roomNumber}` : ''} từ ${displayDate(payload.checkIn)} đến ${displayDate(payload.checkOut)} (${nightly.nights} đêm), tổng tiền ${displayMoney(totalPrice + serviceAmount)}`,
      {
        newValue: {
          roomId: payload.roomId,
          checkIn: dayString(payload.checkIn),
          checkOut: dayString(payload.checkOut),
          totalPrice: totalPrice + serviceAmount
        },
        amount: totalPrice + serviceAmount
      },
      actor || { userId: payload.userId, role: 'customer' },
      connection
    );

    await connection.commit();

    const booking = await bookingModel.getBookingById(bookingId);
    void emailService.sendBookingConfirmation(booking);
    return { ...booking, payment };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const listBookings = (filters) => bookingModel.listBookings(filters);

const getBookingById = async (bookingId) => {
  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) {
    throw new HttpError(404, 'Không tìm thấy đặt phòng');
  }
  const [services] = await db.query(
    `SELECT bs.id, bs.serviceId, bs.quantity, bs.totalPrice, bs.createdAt,
            s.serviceName, s.description, s.price AS unitPrice
     FROM booking_services bs
     JOIN services s ON s.id = bs.serviceId
     WHERE bs.bookingId = ?
     ORDER BY bs.id ASC`,
    [bookingId]
  );
  const [guests] = await db.query(
    `SELECT id, fullName, identityNumber, phone, note
     FROM booking_guests
     WHERE bookingId = ?
     ORDER BY id ASC`,
    [bookingId]
  );
  const [vouchers] = booking.voucher_id
    ? await db.query(
        `SELECT id, code, discountType, discountValue, maxDiscount
         FROM vouchers WHERE id = ?`,
        [booking.voucher_id]
      )
    : [[]];
  const [refunds] = await db.query(
    `SELECT id, amount, refundRate, refundMethod, status, note, createdAt, processedAt
     FROM payment_refunds
     WHERE bookingId = ?
     ORDER BY id DESC`,
    [bookingId]
  );
  const [damages] = await db.query(
    `SELECT id, itemName, quantity, unitPrice, totalPrice, note, createdAt
     FROM booking_damage_charges
     WHERE bookingId = ?
     ORDER BY id ASC`,
    [bookingId]
  );
  const [transfers] = await db.query(
    `SELECT t.id, t.fromRoomId, t.toRoomId, t.fromDate, t.toDate, t.pricePerNight, t.reason, t.createdAt,
            fr.roomNumber AS fromRoomNumber, tr.roomNumber AS toRoomNumber
     FROM booking_room_transfers t
     LEFT JOIN rooms fr ON fr.id = t.fromRoomId
     LEFT JOIN rooms tr ON tr.id = t.toRoomId
     WHERE t.bookingId = ?
     ORDER BY t.id ASC`,
    [bookingId]
  );
  const [payments] = await db.query(
    `SELECT id, roomAmount, serviceAmount, surchargeAmount, discountAmount, depositAmount,
            paidAmount, remainingAmount, totalAmount, paymentMethod, paymentStatus,
            transactionCode, paymentDate
     FROM payments
     WHERE bookingId = ?
     ORDER BY id DESC`,
    [bookingId]
  );
  const history = await bookingModel.listBookingHistory(bookingId);
  return {
    ...booking,
    services,
    guests,
    voucher: vouchers[0] || null,
    refund: refunds[0] || null,
    refunds,
    damages,
    transfers,
    payments,
    payment: payments[0] || null,
    history,
  };
};

const getBookingHistory = async (bookingId) => {
  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) {
    throw new HttpError(404, 'Không tìm thấy đặt phòng');
  }
  return bookingModel.listBookingHistory(bookingId);
};

// Bảng kê số tiền khách còn phải trả khi trả phòng, kèm thông tin dựng mã QR.
// Dùng cho màn hình thu tiền của lễ tân và cho trang thanh toán của khách.
const getPaymentSummary = async (bookingId) => {
  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) {
    throw new HttpError(404, 'Không tìm thấy đặt phòng');
  }

  let payment = null;
  try {
    payment = await paymentService.getPaymentByBookingId(bookingId);
  } catch {
    payment = null;
  }

  const [services] = await db.query(
    `SELECT bs.quantity, bs.totalPrice, bs.createdAt, s.serviceName
     FROM booking_services bs
     JOIN services s ON s.id = bs.serviceId
     WHERE bs.bookingId = ?
     ORDER BY bs.id ASC`,
    [bookingId]
  );
  const [damages] = await db.query(
    `SELECT itemName, quantity, totalPrice, note, createdAt
     FROM booking_damage_charges
     WHERE bookingId = ?
     ORDER BY id ASC`,
    [bookingId]
  );

  const paymentSettings = await getPaymentAccountSettings();
  const remainingAmount = Math.max(Number(payment?.remainingAmount || 0), 0);

  return {
    bookingId,
    bookingStatus: booking.status,
    customerName: booking.customer_name,
    roomNumber: booking.room_number,
    paymentId: payment?.id || null,
    totalAmount: Number(payment?.totalAmount || 0),
    paidAmount: Number(payment?.paidAmount || 0),
    remainingAmount,
    // Phần phát sinh trong lúc lưu trú - đây mới là thứ khách thường phải trả
    // thêm lúc trả phòng, tách riêng để lễ tân giải thích cho khách.
    serviceAmount: services.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0),
    damageAmount: damages.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0),
    services,
    damages,
    canCheckOut: remainingAmount <= 0,
    // Nội dung chuyển khoản phải chứa mã đặt phòng để đối soát sao kê.
    transferContent: `${paymentSettings.transferPrefix || 'HB'}${bookingId}`,
    bankAccount: {
      bankBin: paymentSettings.bankBin,
      bankName: paymentSettings.bankName,
      bankCode: paymentSettings.bankCode,
      accountNumber: paymentSettings.accountNumber,
      accountName: paymentSettings.accountName
    }
  };
};

// Lễ tân bấm "gửi yêu cầu thanh toán": báo cho khách qua thông báo trong app và
// ghi dấu vết. Không tự động ghi nhận tiền - tiền chỉ vào khi có người xác nhận.
const requestOutstandingPayment = async (bookingId, actor = null) => {
  const summary = await getPaymentSummary(bookingId);

  if (summary.remainingAmount <= 0) {
    throw new HttpError(409, 'Đặt phòng này đã thanh toán đủ, không còn khoản nào cần thu');
  }

  const booking = await bookingModel.getBookingById(bookingId);
  await bookingModel.createCustomerNotification(
    booking.user_id,
    'Cần thanh toán chi phí phát sinh',
    `Đặt phòng #${bookingId} (phòng ${summary.roomNumber || ''}) còn ${displayMoney(summary.remainingAmount)} chưa thanh toán` +
      `${summary.serviceAmount > 0 ? `, gồm dịch vụ phát sinh ${displayMoney(summary.serviceAmount)}` : ''}` +
      `${summary.damageAmount > 0 ? `, phí hư hỏng ${displayMoney(summary.damageAmount)}` : ''}` +
      `. Bạn có thể quét mã QR tại quầy hoặc thanh toán trong ứng dụng trước khi trả phòng.`
  );

  await logHistory(
    bookingId,
    'payment_requested',
    `Yêu cầu khách thanh toán ${displayMoney(summary.remainingAmount)} chi phí còn thiếu (đã xuất mã QR và gửi thông báo cho khách)`,
    { amount: summary.remainingAmount },
    actor
  );

  return summary;
};

const getRefundPreview = async (bookingId) => {
  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) {
    throw new HttpError(404, 'Không tìm thấy đặt phòng');
  }

  let payment = null;
  try {
    payment = await paymentService.getPaymentByBookingId(bookingId);
  } catch {
    payment = null;
  }

  return {
    bookingId,
    canCancel: ['pending', 'confirmed'].includes(booking.status),
    bookingStatus: booking.status,
    paymentId: payment?.id || null,
    ...getRefundPolicy(booking.check_in, payment?.paidAmount || 0)
  };
};

const normalizeRefundRequest = (refundRequest) => {
  if (!refundRequest || typeof refundRequest !== 'object' || !refundRequest.refundMethod) {
    return null;
  }

  const method = refundRequest.refundMethod === 'cash' ? 'cash' : 'bank_transfer';

  if (method === 'bank_transfer') {
    const accountNumber = String(refundRequest.accountNumber || '').replace(/\s+/g, '');
    const accountName = String(refundRequest.accountName || '').trim().toUpperCase();
    const bankName = String(refundRequest.bankName || '').trim();

    if (!/^[A-Za-z0-9]{4,30}$/.test(accountNumber)) {
      throw new HttpError(400, 'Số tài khoản nhận hoàn tiền không hợp lệ (4-30 ký tự chữ/số)');
    }
    if (accountName.length < 3) {
      throw new HttpError(400, 'Vui lòng nhập tên chủ tài khoản nhận hoàn tiền');
    }
    if (!bankName) {
      throw new HttpError(400, 'Vui lòng chọn ngân hàng nhận hoàn tiền');
    }

    return {
      refundMethod: 'bank_transfer',
      bankBin: String(refundRequest.bankBin || '').slice(0, 10) || null,
      bankName: bankName.slice(0, 100),
      accountNumber,
      accountName: accountName.slice(0, 100)
    };
  }

  return {
    refundMethod: 'cash',
    bankBin: null,
    bankName: null,
    accountNumber: null,
    accountName: null
  };
};

const cancelBooking = async (bookingId, refundRequest = null, reasonValue = null, actor = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Không tìm thấy đặt phòng');
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw new HttpError(409, `Không thể hủy đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`);
    }
    const cancellationReason = String(reasonValue || '').trim();
    if (cancellationReason.length < 5) {
      throw new HttpError(400, 'Vui lòng nhập lý do hủy phòng (ít nhất 5 ký tự)');
    }
    if (cancellationReason.length > 500) {
      throw new HttpError(400, 'Lý do hủy phòng không được vượt quá 500 ký tự');
    }

    let payment = null;
    try {
      payment = await paymentService.getPaymentByBookingId(bookingId);
    } catch {
      payment = null;
    }

    const refundPolicy = getRefundPolicy(booking.check_in, payment?.paidAmount || 0);

    await bookingModel.updateBookingStatus(bookingId, 'cancelled', connection);
    await connection.query(
      'UPDATE bookings SET cancellation_reason = ? WHERE id = ?',
      [cancellationReason, bookingId]
    );

    // Khách đã trả tiền và còn được hoàn -> luôn tạo yêu cầu hoàn tiền chờ admin duyệt.
    // Không có thông tin nhận tiền (VD: admin hủy hộ) -> mặc định nhận tại quầy.
    let refund = null;
    if (payment && refundPolicy.refundableAmount > 0) {
      const providedRequest = normalizeRefundRequest(refundRequest);
      const normalizedRequest = providedRequest || {
        refundMethod: 'cash',
        bankBin: null,
        bankName: null,
        accountNumber: null,
        accountName: null
      };
      const autoNote = providedRequest
        ? null
        : 'Tạo tự động khi hủy. Khách nhận tiền tại quầy hoặc khách sạn sẽ liên hệ.';

      const [result] = await connection.query(
        `
          INSERT INTO payment_refunds
            (paymentId, bookingId, amount, refundRate, paidAmount, refundMethod, bankBin, bankName, accountNumber, accountName, status, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `,
        [
          payment.id,
          bookingId,
          refundPolicy.refundableAmount,
          refundPolicy.refundRate,
          payment.paidAmount,
          normalizedRequest.refundMethod,
          normalizedRequest.bankBin,
          normalizedRequest.bankName,
          normalizedRequest.accountNumber,
          normalizedRequest.accountName,
          autoNote
        ]
      );

      refund = {
        id: result.insertId,
        amount: refundPolicy.refundableAmount,
        refundMethod: normalizedRequest.refundMethod,
        status: 'pending'
      };
    }

    await logHistory(
      bookingId,
      'cancelled',
      `Hủy đặt phòng. Lý do: ${cancellationReason}${refund ? `. Tạo yêu cầu hoàn ${displayMoney(refund.amount)} (${Math.round(refundPolicy.refundRate * 100)}%) chờ duyệt` : ''}`,
      {
        oldValue: { status: booking.status },
        newValue: { status: 'cancelled', reason: cancellationReason },
        amount: refund ? refund.amount : null
      },
      actor,
      connection
    );

    await connection.commit();
    return {
      ...(await bookingModel.getBookingById(bookingId)),
      refundPolicy,
      refund
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const saveGuestIdentities = async (bookingId, payload, actor = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Không tìm thấy đặt phòng');
    }

    await bookingModel.replaceBookingGuests(bookingId, payload.guests, connection);

    await logHistory(
      bookingId,
      'guests_updated',
      `Cập nhật danh sách khách lưu trú (${payload.guests.length} người): ${payload.guests.map((guest) => guest.fullName).join(', ')}`,
      { newValue: { guests: payload.guests.map((guest) => guest.fullName) } },
      actor,
      connection
    );

    await connection.commit();
    return bookingModel.getBookingById(bookingId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const addServiceCharge = async (bookingId, payload, actor = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Không tìm thấy đặt phòng');
    }

    if (!['confirmed', 'checked_in'].includes(booking.status)) {
      throw new HttpError(409, `Không thể thêm phí dịch vụ khi đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`);
    }

    const service = await bookingModel.getServiceById(payload.serviceId, connection);
    if (!service) {
      throw new HttpError(404, 'Không tìm thấy dịch vụ');
    }

    await bookingModel.addBookingService(bookingId, service, payload.quantity, connection);
    const payment = await paymentService.recalculatePaymentForBooking(bookingId, connection);
    const addedAmount = Number(service.price) * payload.quantity;

    await logHistory(
      bookingId,
      'service_added',
      `Thêm dịch vụ phát sinh: ${service.serviceName} x${payload.quantity} = ${displayMoney(addedAmount)}`,
      {
        newValue: {
          serviceId: service.id,
          serviceName: service.serviceName,
          quantity: payload.quantity,
          unitPrice: Number(service.price)
        },
        amount: addedAmount
      },
      actor,
      connection
    );

    if (payment && Number(payment.remainingAmount) > 0) {
      await bookingModel.createCustomerNotification(
        booking.user_id,
        'Thanh toán dịch vụ phát sinh',
        `Dịch vụ ${service.serviceName} đã được thêm vào đặt phòng #${bookingId} với số tiền ${addedAmount.toLocaleString('vi-VN')} VNĐ. Số tiền còn phải thanh toán là ${Number(payment.remainingAmount).toLocaleString('vi-VN')} VNĐ.`,
        connection
      );
    }

    await connection.commit();
    return {
      booking: await bookingModel.getBookingById(bookingId),
      service: {
        id: service.id,
        serviceName: service.serviceName,
        quantity: payload.quantity,
        totalPrice: addedAmount
      },
      payment
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const addDamageCharge = async (bookingId, payload, actor = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Không tìm thấy đặt phòng');
    }

    if (!['checked_in'].includes(booking.status)) {
      throw new HttpError(409, `Không thể thêm phí hư hỏng khi đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`);
    }

    const damage = await bookingModel.addDamageCharge(bookingId, booking.room_id, payload, connection);
    const payment = await paymentService.recalculatePaymentForBooking(bookingId, connection);

    await logHistory(
      bookingId,
      'damage_added',
      `Ghi nhận phí hư hỏng/mất vật dụng: ${payload.itemName} x${payload.quantity} = ${displayMoney(damage.totalPrice)}${payload.note ? ` (${payload.note})` : ''}`,
      {
        newValue: {
          itemName: payload.itemName,
          quantity: payload.quantity,
          unitPrice: payload.unitPrice
        },
        amount: damage.totalPrice
      },
      actor,
      connection
    );

    await connection.commit();
    return { damage, payment };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const extendStay = async (bookingId, payload, actor = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Không tìm thấy đặt phòng');
    }

    if (!['confirmed', 'checked_in'].includes(booking.status)) {
      throw new HttpError(409, `Không thể gia hạn đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`);
    }

    const currentCheckOut = dayString(booking.check_out);
    if (dateToUtc(payload.checkOut) <= dateToUtc(currentCheckOut)) {
      throw new HttpError(400, 'Ngày trả phòng mới phải sau ngày trả phòng hiện tại');
    }

    const conflicts = await bookingModel.getConflictingBookings(
      booking.room_id,
      currentCheckOut,
      payload.checkOut,
      connection,
      true,
      { excludeBookingId: bookingId }
    );

    if (conflicts.length > 0) {
      throw new HttpError(409, 'Không thể gia hạn vì phòng đã có khách khác đặt sau ngày trả hiện tại', {
        conflictingBookingIds: conflicts.map((item) => item.id)
      });
    }

    // Tính tiền các đêm gia hạn theo giá từng đêm (room_prices)
    const currentRoom = await bookingModel.getRoomWithType(booking.room_id, connection);
    const addedNightly = await calcNightlyPrices(
      currentRoom?.roomTypeId,
      booking.room_price || booking.price_per_night || currentRoom?.price_per_night || 0,
      currentCheckOut,
      payload.checkOut,
      connection
    );
    const addedNights = addedNightly.nights;

    // Phụ thu trẻ em tính theo từng đêm nên các đêm gia hạn cũng phải chịu phụ
    // thu. Số trẻ chịu phí không được lưu riêng, nên suy ra phụ thu mỗi đêm từ
    // tổng phụ thu đã chốt lúc đặt chia cho số đêm ban đầu.
    const originalNights = getNightCount(dayString(booking.check_in), currentCheckOut);
    const currentSurcharge = Number(booking.occupancy_surcharge || 0);
    const surchargePerNight = originalNights > 0 ? currentSurcharge / originalNights : 0;
    const addedSurcharge = Math.round(surchargePerNight * addedNights);
    const newSurcharge = currentSurcharge + addedSurcharge;

    const addedAmount = addedNightly.total + addedSurcharge;
    const newTotalPrice = Number(booking.total_price || 0) + addedAmount;

    await bookingModel.saveNightlyPrices(bookingId, addedNightly.prices, connection);
    await bookingModel.updateBookingStay(
      bookingId,
      payload.checkOut,
      newTotalPrice,
      connection,
      newSurcharge
    );
    const payment = await paymentService.recalculatePaymentForBooking(bookingId, connection);

    await logHistory(
      bookingId,
      'extended',
      `Gia hạn ngày ở: trả phòng từ ${displayDate(currentCheckOut)} chuyển thành ${displayDate(payload.checkOut)} (+${addedNights} đêm, +${displayMoney(addedAmount)}${addedSurcharge > 0 ? ` gồm phụ thu khách ${displayMoney(addedSurcharge)}` : ''})`,
      {
        oldValue: { checkOut: currentCheckOut, totalPrice: Number(booking.total_price || 0) },
        newValue: {
          checkOut: dayString(payload.checkOut),
          totalPrice: newTotalPrice,
          addedNights,
          addedSurcharge
        },
        amount: addedAmount
      },
      actor,
      connection
    );

    await connection.commit();
    return {
      booking: await bookingModel.getBookingById(bookingId),
      addedNights,
      addedAmount,
      addedSurcharge,
      payment
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const transferRoom = async (bookingId, payload, actor = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Không tìm thấy đặt phòng');
    }

    if (booking.status !== 'checked_in') {
      throw new HttpError(409, `Không thể chuyển phòng khi đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`);
    }

    const toRoom = await bookingModel.getRoomWithType(payload.toRoomId, connection, true);
    if (!toRoom) {
      throw new HttpError(404, 'Không tìm thấy phòng muốn chuyển đến');
    }

    if (toRoom.status === 'maintenance') {
      throw new HttpError(409, 'Phòng muốn chuyển đến đang được bảo trì');
    }

    // Sau khi chuyển, booking chiếm phòng mới cho tới hết ngày trả phòng chứ
    // không chỉ tới toDate do client gửi. Vì vậy phải kiểm tra trùng lịch trên
    // đúng khoảng splitDate → check_out, nếu không hai booking đã trả tiền có
    // thể cùng nằm trong một phòng.
    const stayStart = dayString(booking.check_in);
    const stayEnd = dayString(booking.check_out);
    const splitDate =
      dayString(payload.fromDate) < stayStart
        ? stayStart
        : dayString(payload.fromDate) > stayEnd
          ? stayEnd
          : dayString(payload.fromDate);

    const conflicts = await bookingModel.getConflictingBookings(
      toRoom.id,
      splitDate,
      stayEnd,
      connection,
      true,
      { excludeBookingId: bookingId }
    );

    if (conflicts.length > 0) {
      throw new HttpError(409, 'Phòng chuyển đến không còn trống trong giai đoạn này', {
        conflictingBookingIds: conflicts.map((item) => item.id)
      });
    }

    const fromRoom = await bookingModel.getRoomWithType(booking.room_id, connection);

    await bookingModel.transferBookingRoom(booking, toRoom, payload, connection);
    await bookingModel.updateRoomStatus(booking.room_id, 'available', connection);
    await bookingModel.updateRoomStatus(toRoom.id, 'occupied', connection);

    // Tính riêng từng giai đoạn: các đêm đã ở phòng cũ giữ giá cũ,
    // các đêm từ ngày chuyển trở đi tính theo giá phòng mới.
    // Các đêm khách ĐÃ Ở phải giữ nguyên giá đã chốt lúc đặt. Tra lại
    // room_prices ở đây sẽ tính lại chúng theo bảng giá hiện hành, khiến tiền
    // của giai đoạn đã qua thay đổi mỗi khi khách sạn đổi giá.
    const lockedOldNights = await bookingModel.listNightlyPrices(
      bookingId,
      stayStart,
      splitDate,
      connection
    );
    const oldStage = lockedOldNights.length > 0
      ? {
          nights: lockedOldNights.length,
          total: lockedOldNights.reduce((sum, night) => sum + Number(night.price), 0)
        }
      : await calcNightlyPrices(
          fromRoom?.roomTypeId,
          booking.room_price || fromRoom?.price_per_night || 0,
          stayStart,
          splitDate,
          connection
        );
    const newStage = await calcNightlyPrices(
      toRoom.roomTypeId,
      toRoom.price_per_night,
      splitDate,
      stayEnd,
      connection
    );
    // total_price gồm cả phụ thu khách (trẻ em) đã chốt lúc đặt. Nếu chỉ cộng
    // tiền phòng hai giai đoạn thì phụ thu biến mất khỏi tổng tiền và
    // recalculatePaymentForBooking sẽ trừ tiếp một lần nữa.
    const occupancySurcharge = Number(booking.occupancy_surcharge || 0);
    const newTotalPrice = oldStage.total + newStage.total + occupancySurcharge;

    // Chốt lại giá các đêm ở phòng mới để lần chuyển phòng kế tiếp không tính lại.
    await bookingModel.saveNightlyPrices(bookingId, newStage.prices, connection);

    await bookingModel.updateBookingStay(bookingId, stayEnd, newTotalPrice, connection);
    const payment = await paymentService.recalculatePaymentForBooking(bookingId, connection);

    await logHistory(
      bookingId,
      'room_transferred',
      `Chuyển phòng từ ${fromRoom?.roomNumber || booking.room_id} sang ${toRoom.roomNumber} kể từ ngày ${displayDate(splitDate)}${payload.reason ? `. Lý do: ${payload.reason}` : ''}. Tổng tiền phòng mới: ${displayMoney(newTotalPrice)}`,
      {
        oldValue: { roomId: booking.room_id, roomNumber: fromRoom?.roomNumber, totalPrice: Number(booking.total_price || 0) },
        newValue: { roomId: toRoom.id, roomNumber: toRoom.roomNumber, fromDate: dayString(splitDate), totalPrice: newTotalPrice }
      },
      actor,
      connection
    );

    await connection.commit();
    return {
      booking: await bookingModel.getBookingById(bookingId),
      priceBreakdown: {
        oldRoom: {
          roomNumber: fromRoom?.roomNumber,
          from: stayStart,
          to: splitDate,
          nights: oldStage.nights,
          amount: oldStage.total
        },
        newRoom: {
          roomNumber: toRoom.roomNumber,
          from: splitDate,
          to: stayEnd,
          nights: newStage.nights,
          amount: newStage.total
        },
        totalPrice: newTotalPrice
      },
      payment
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const checkIn = async (bookingId, payload = {}, actor = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Không tìm thấy đặt phòng');
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw new HttpError(409, `Không thể nhận phòng khi đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`);
    }

    const payment = await paymentService.getPaymentByBookingId(bookingId);
    if (!payment || Number(payment.paidAmount || 0) <= 0) {
      throw new HttpError(409, 'Vui lòng thanh toán trước khi check-in');
    }

    if (payment.remainingAmount > 0 || payment.paymentStatus !== 'paid') {
      throw new HttpError(409, 'Vui lòng thanh toán đủ số tiền còn lại trước khi check-in');
    }

    const now = new Date();
    if (!isWithinLateCheckInWindow(booking.check_in, now)) {
      const checkInDay = new Date(`${dayString(booking.check_in)}T00:00:00`);
      if (now < checkInDay) {
        throw new HttpError(409, 'Chưa đến ngày nhận phòng');
      }
      throw new HttpError(
        409,
        `Đã quá thời gian check-in muộn (trước ${LATE_CHECKIN_GRACE_HOUR}:00 ngày hôm sau). Vui lòng liên hệ lễ tân.`
      );
    }

    if (Array.isArray(payload.guests) && payload.guests.length > 0) {
      await bookingModel.replaceBookingGuests(bookingId, payload.guests, connection);
    }

    await bookingModel.updateBookingStatus(bookingId, 'checked_in', connection);
    await bookingModel.updateRoomStatus(booking.room_id, 'occupied', connection);

    const wasLate = isLateCheckIn(booking.check_in, now);
    await logHistory(
      bookingId,
      'checked_in',
      `Khách nhận phòng${wasLate ? ' (check-in muộn)' : ''}${Array.isArray(payload.guests) && payload.guests.length > 0 ? `. Khách lưu trú: ${payload.guests.map((guest) => guest.fullName).join(', ')}` : ''}`,
      {
        oldValue: { status: booking.status },
        newValue: { status: 'checked_in', lateCheckIn: wasLate }
      },
      actor,
      connection
    );

    await connection.commit();

    const updatedBooking = await bookingModel.getBookingById(bookingId);
    const lateCheckIn = wasLate;

    return {
      ...updatedBooking,
      lateCheckIn,
      message: lateCheckIn
        ? 'Check-in muộn thành công. Phòng vẫn được giữ theo cam kết vì khách đã thanh toán.'
        : 'Check-in thành công'
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const markNoShow = async (bookingId, { allowBeforeDeadline = false, connection: externalConnection, actor = null } = {}) => {
  const ownsConnection = !externalConnection;
  const connection = externalConnection || (await db.getConnection());

  try {
    if (ownsConnection) {
      await connection.beginTransaction();
    }

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Không tìm thấy đặt phòng');
    }

    if (booking.status === 'no_show') {
      throw new HttpError(409, 'Đặt phòng đã được đánh dấu khách không đến');
    }

    if (!['confirmed', 'pending'].includes(booking.status)) {
      throw new HttpError(409, `Không thể đánh dấu khách không đến khi đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`);
    }

    const paymentRow = await paymentService.getPaymentByBookingId(bookingId);
    if (!paymentRow || Number(paymentRow.paidAmount || 0) <= 0) {
      throw new HttpError(409, 'Chỉ có thể đánh dấu khách không đến đối với đặt phòng đã thanh toán');
    }

    if (!allowBeforeDeadline && !isPastNoShowDeadline(booking.check_in)) {
      const deadline = getLateCheckInDeadline(booking.check_in);
      throw new HttpError(
        409,
        `Chưa đến thời điểm xử lý no-show. Hệ thống sẽ tự động xử lý sau ${deadline.toLocaleString('vi-VN')}`
      );
    }

    await bookingModel.updateBookingStatus(bookingId, 'no_show', connection);
    await bookingModel.updateRoomStatus(booking.room_id, 'available', connection);

    const voucher = await voucherService.createNoShowCompensationVoucher(
      booking.user_id,
      bookingId,
      connection
    );

    await logHistory(
      bookingId,
      'no_show',
      `Đánh dấu khách không đến (no-show). Không hoàn tiền theo chính sách, tặng voucher ${voucher.code} giảm ${Number(voucher.discountPercentage)}% cho lần đặt sau`,
      {
        oldValue: { status: booking.status },
        newValue: { status: 'no_show', voucherCode: voucher.code }
      },
      actor,
      connection
    );

    if (ownsConnection) {
      await connection.commit();
    }

    return {
      booking: await bookingModel.getBookingById(bookingId, ownsConnection ? undefined : connection),
      voucher: {
        code: voucher.code,
        discountPercentage: Number(voucher.discountPercentage),
        validFrom: voucher.validFrom,
        validUntil: voucher.validUntil,
        message: `Đã tặng voucher giảm ${voucherService.NO_SHOW_DISCOUNT_PERCENT}% cho lần đặt phòng tiếp theo`
      },
      refundPolicy: {
        refunded: false,
        message: 'Không hoàn tiền theo chính sách no-show'
      }
    };
  } catch (error) {
    if (ownsConnection) {
      await connection.rollback();
    }
    throw error;
  } finally {
    if (ownsConnection) {
      connection.release();
    }
  }
};

const processNoShows = async () => {
  const connection = await db.getConnection();
  const results = [];

  try {
    await connection.beginTransaction();
    const candidates = await bookingModel.listEligibleNoShowBookings(connection);

    for (const candidate of candidates) {
      try {
        const result = await markNoShow(candidate.id, {
          allowBeforeDeadline: true,
          connection
        });
        results.push({ bookingId: candidate.id, status: 'processed', voucherCode: result.voucher.code });
      } catch (error) {
        results.push({
          bookingId: candidate.id,
          status: 'skipped',
          reason: error.message
        });
      }
    }

    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const checkOut = async (bookingId, actor = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Không tìm thấy đặt phòng');
    }

    if (booking.status !== 'checked_in') {
      throw new HttpError(409, `Không thể trả phòng khi đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`);
    }

    const payment = await paymentService.getPaymentByBookingId(bookingId);
    if (!payment || payment.remainingAmount > 0 || payment.paymentStatus !== 'paid') {
      throw new HttpError(409, 'Vui lòng thanh toán toàn bộ tiền phòng và chi phí phát sinh trước khi check-out');
    }

    await bookingModel.updateBookingStatus(bookingId, 'checked_out', connection);
    await connection.query(
      "UPDATE rooms SET status = 'maintenance', maintenanceNote = 'Dọn dẹp sau check-out (Chờ dọn dẹp)', maintenanceExpectedCompletion = NULL WHERE id = ?",
      [booking.room_id]
    );

    // Check-out sớm: hoàn 50% tiền các đêm chưa ở (tạo yêu cầu hoàn chờ admin duyệt)
    let earlyCheckout = null;
    const today = dayString(new Date());
    const checkOutDay = dayString(booking.check_out);

    if (today < checkOutDay) {
      const room = await bookingModel.getRoomWithType(booking.room_id, connection);
      const unusedNightly = await calcNightlyPrices(
        room?.roomTypeId,
        booking.room_price || room?.price_per_night || 0,
        today,
        checkOutDay,
        connection
      );

      const refundAmount = Math.min(
        Math.round(unusedNightly.total * 0.5),
        Number(payment.paidAmount || 0)
      );

      if (refundAmount > 0) {
        const [result] = await connection.query(
          `
            INSERT INTO payment_refunds
              (paymentId, bookingId, amount, refundRate, paidAmount, refundMethod, status, note)
            VALUES (?, ?, ?, 0.5, ?, 'cash', 'pending', ?)
          `,
          [
            payment.id,
            bookingId,
            refundAmount,
            payment.paidAmount,
            `Check-out sớm: hoàn 50% của ${unusedNightly.nights} đêm chưa ở (${today} → ${checkOutDay})`
          ]
        );

        earlyCheckout = {
          refundId: result.insertId,
          unusedNights: unusedNightly.nights,
          unusedAmount: unusedNightly.total,
          refundRate: 0.5,
          refundAmount,
          status: 'pending',
          message: `Check-out sớm ${unusedNightly.nights} đêm. Hoàn 50% = ${refundAmount.toLocaleString('vi-VN')}₫, chờ khách sạn duyệt.`
        };
      }
    }

    await logHistory(
      bookingId,
      'checked_out',
      `Khách trả phòng${earlyCheckout ? ` sớm ${earlyCheckout.unusedNights} đêm (dự kiến ${displayDate(checkOutDay)}). Tạo yêu cầu hoàn 50% = ${displayMoney(earlyCheckout.refundAmount)} chờ duyệt` : ''}`,
      {
        oldValue: { status: 'checked_in', checkOut: checkOutDay },
        newValue: { status: 'checked_out', actualCheckOut: today },
        amount: earlyCheckout ? earlyCheckout.refundAmount : null
      },
      actor,
      connection
    );

    await connection.commit();
    return {
      ...(await bookingModel.getBookingById(bookingId)),
      earlyCheckout
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  calcNightlyPrices,
  checkAvailability,
  checkTypeAvailability,
  expireUnpaidBookingHolds,
  createBooking,
  listBookings,
  getBookingById,
  getBookingHistory,
  logHistory,
  getPaymentSummary,
  requestOutstandingPayment,
  getRefundPreview,
  cancelBooking,
  saveGuestIdentities,
  addServiceCharge,
  addDamageCharge,
  extendStay,
  transferRoom,
  checkIn,
  checkOut,
  markNoShow,
  processNoShows
};

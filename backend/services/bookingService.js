const db = require("../config/db");
const bookingModel = require("../models/bookingModel");
const paymentService = require("./paymentService");
const invoiceService = require("./invoiceService");
const emailService = require("./emailService");
const voucherService = require("./voucherService");
const HttpError = require("../utils/httpError");
const {
  dayString,
  isWithinLateCheckInWindow,
  isLateCheckIn,
  isPastNoShowDeadline,
  getLateCheckInDeadline,
  getCheckOutDeadline,
  combineDateTime,
  computeLateCheckoutFee,
  getMaxLateCheckoutTime,
  LATE_CHECKIN_GRACE_HOUR,
} = require("../utils/bookingPolicy");

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HOLD_MINUTES = 15;
const bookingStatusLabel = (status) =>
  ({
    pending: "chờ xác nhận",
    confirmed: "đã xác nhận",
    checked_in: "đang lưu trú",
    checked_out: "đã trả phòng",
    cancelled: "đã hủy",
    no_show: "khách không đến",
  })[status] || status;

const dateToUtc = (date) => new Date(`${date}T00:00:00.000Z`);

const actorRoleLabel = (role) =>
  ({
    admin: "Quản trị viên",
    employee: "Nhân viên",
    staff: "Nhân viên",
    customer: "Khách hàng",
    system: "Hệ thống",
  })[role] ||
  role ||
  "Hệ thống";

// Chuẩn hóa người thực hiện thao tác từ req.user (JWT: { userId, email, role })
// thành { actorId, actorName, actorRole } để ghi vào booking_history.
const resolveActor = async (actor, connection) => {
  if (!actor || !actor.userId) {
    return { actorId: null, actorName: null, actorRole: "system" };
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
    actorRole: actor.role || "system",
  };
};

const displayDate = (date) => {
  const [year, month, day] = dayString(date).split("-");
  return `${day}/${month}/${year}`;
};

const displayMoney = (amount) =>
  `${Number(amount || 0).toLocaleString("vi-VN")}₫`;

// Ghi dấu vết lịch sử cho đặt phòng. Gọi bên trong transaction của thao tác
// để lịch sử luôn nhất quán với dữ liệu (rollback thì log cũng rollback).
const logHistory = async (
  bookingId,
  action,
  description,
  extra,
  actor,
  connection,
) => {
  const resolved = await resolveActor(actor, connection);
  await bookingModel.addBookingHistory(
    bookingId,
    {
      action,
      description,
      oldValue: extra?.oldValue,
      newValue: extra?.newValue,
      amount: extra?.amount,
      ...resolved,
    },
    connection,
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
const calcNightlyPrices = async (
  roomTypeId,
  fallbackPrice,
  checkIn,
  checkOut,
  connection,
) => {
  const nights = getStayDates(dayString(checkIn), dayString(checkOut));
  const ranges = roomTypeId
    ? await bookingModel.listRoomPriceRanges(roomTypeId, connection)
    : [];

  const prices = nights.map((night) => {
    const range = ranges.find(
      (item) =>
        dayString(item.startDate) <= night && night <= dayString(item.endDate),
    );
    return {
      date: night,
      price: range ? Number(range.price) : Number(fallbackPrice || 0),
    };
  });

  return {
    nights: prices.length,
    prices,
    total: prices.reduce((sum, item) => sum + item.price, 0),
  };
};

// Chính sách phụ thu trẻ em (admin cấu hình trong app_settings, key children_policy)
const DEFAULT_CHILDREN_POLICY = {
  freeMaxAge: 5, // 0-5 tuổi miễn phí
  childMaxAge: 11, // 6-11 tuổi tính phụ thu; >= 12 tính như người lớn
  surchargePerNight: 200000,
};

// Tài khoản nhận tiền của khách sạn (admin cấu hình ở trang Cài đặt thanh toán).
// Giữ đúng key và giá trị mặc định như routes/settings.js để hai nơi không lệch.
const DEFAULT_PAYMENT_ACCOUNT = {
  bankBin: "970422",
  bankCode: "MB",
  bankName: "MB Bank (Ngân hàng Quân đội)",
  accountNumber: "0000000000",
  accountName: "KHACH SAN HOTELHUB",
  transferPrefix: "HB",
};

const getPaymentAccountSettings = async (connection) => {
  try {
    const [rows] = await (connection || db).query(
      "SELECT settingValue FROM app_settings WHERE settingKey = 'payment_account'",
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
      "SELECT settingValue FROM app_settings WHERE settingKey = 'children_policy'",
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
    (age) =>
      Number(age) > policy.freeMaxAge && Number(age) <= policy.childMaxAge,
  ).length;
  const adultsFromChildren = ages.filter(
    (age) => Number(age) > policy.childMaxAge,
  ).length;

  return {
    chargeableChildren,
    adultsFromChildren,
    surchargePerNight: policy.surchargePerNight,
    amount: chargeableChildren * policy.surchargePerNight * nights,
  };
};

// Phân bổ khách (adults, children) vào Q phòng sao cho:
// 1. SUM(adults) = total effectiveAdults
// 2. SUM(children) = total effectiveChildren
// 3. với mọi room: room.adults + room.children <= maxOccupancy
// 4. Phân bổ cân đối giữa Q phòng
const distributeGuestsAcrossRooms = (adults, children, roomQuantity, maxOccupancy) => {
  const q = Math.max(1, Number(roomQuantity) || 1);
  const maxOcc = Number(maxOccupancy) || 100;
  const totalGuests = adults + children;

  if (totalGuests > q * maxOcc) {
    throw new HttpError(
      400,
      `Tổng số khách (${totalGuests}) vượt quá sức chứa tối đa của ${q} phòng (${q * maxOcc} người). Vui lòng chọn thêm phòng.`
    );
  }

  const rooms = Array.from({ length: q }, () => ({ adults: 0, children: 0 }));

  // 1. Phân bổ adults đều vào Q phòng
  const baseAdults = Math.floor(adults / q);
  const remAdults = adults % q;
  for (let i = 0; i < q; i++) {
    rooms[i].adults = baseAdults + (i < remAdults ? 1 : 0);
  }

  // 2. Phân bổ children vào phòng có tổng khách nhỏ nhất và chưa vượt maxOccupancy
  let remainingChildren = children;
  while (remainingChildren > 0) {
    let targetIdx = -1;
    let minOcc = Infinity;

    for (let i = 0; i < q; i++) {
      const currentOcc = rooms[i].adults + rooms[i].children;
      if (currentOcc < maxOcc && currentOcc < minOcc) {
        minOcc = currentOcc;
        targetIdx = i;
      }
    }

    if (targetIdx === -1) {
      for (let i = 0; i < q; i++) {
        if (rooms[i].adults + rooms[i].children < maxOcc) {
          targetIdx = i;
          break;
        }
      }
    }

    if (targetIdx === -1) {
      throw new HttpError(400, 'Không thể phân bổ trẻ em vào danh sách phòng mà không vượt giới hạn maxOccupancy.');
    }

    rooms[targetIdx].children++;
    remainingChildren--;
  }

  return rooms;
};

const getRoomTypeById = async (roomTypeId, connection) => {
  const [rows] = await (connection || db).query(
    'SELECT id, typeName, defaultPrice, capacity, adultCapacity, childCapacity, maxOccupancy, extraAdultFee, extraChildFee FROM room_types WHERE id = ?',
    [roomTypeId]
  );
  return rows[0] || null;
};

// Tính toán phụ thu phát sinh & tạo extraGuestSnapshot
const calcExtraGuestSurcharge = (roomType, adults, children, childrenAges, roomQuantity, nights, childrenPolicy) => {
  const q = Math.max(1, Number(roomQuantity) || 1);
  const n = Math.max(1, Number(nights) || 1);

  const adultCap = Number(roomType?.adultCapacity ?? roomType?.capacity ?? 2);
  const childCap = Number(roomType?.childCapacity ?? 1);
  const maxOcc = Number(roomType?.maxOccupancy ?? (adultCap + childCap));
  const extraAdultFee = Number(roomType?.extraAdultFee ?? 200000);
  const extraChildFee = Number(roomType?.extraChildFee ?? 100000);

  const ages = Array.isArray(childrenAges) ? childrenAges : [];
  const freeMaxAge = childrenPolicy?.freeMaxAge ?? 5;
  const childMaxAge = childrenPolicy?.childMaxAge ?? 11;

  const adultsFromChildren = ages.filter((age) => Number(age) > childMaxAge).length;
  const chargeableChildrenAges = ages.filter(
    (age) => Number(age) > freeMaxAge && Number(age) <= childMaxAge
  ).length;

  const effectiveAdults = Number(adults || 0) + adultsFromChildren;
  const effectiveChildren = Math.max(0, Number(children || 0) - adultsFromChildren);

  const totalAdultCapacity = adultCap * q;
  const totalChildCapacity = childCap * q;
  const totalMaxOccupancy = maxOcc * q;
  const totalGuests = effectiveAdults + effectiveChildren;

  if (totalGuests > totalMaxOccupancy) {
    throw new HttpError(
      400,
      `Tổng số khách (${totalGuests}) vượt quá sức chứa tối đa của ${q} phòng (${totalMaxOccupancy} người). Vui lòng chọn thêm phòng.`
    );
  }

  const extraAdults = Math.max(0, effectiveAdults - totalAdultCapacity);
  const rawExtraChildren = Math.max(0, effectiveChildren - totalChildCapacity);

  // Giữ nguyên nguyên tắc "0-5 tuổi miễn phí": chỉ tính extraChildFee cho trẻ thuộc độ tuổi chịu phí (6-11)
  let extraChildren = rawExtraChildren;
  if (ages.length > 0) {
    extraChildren = Math.min(rawExtraChildren, chargeableChildrenAges);
  }

  const extraAdultAmount = extraAdults * extraAdultFee * n;
  const extraChildAmount = extraChildren * extraChildFee * n;
  const totalExtraGuestFee = extraAdultAmount + extraChildAmount;

  const distributedRooms = distributeGuestsAcrossRooms(effectiveAdults, effectiveChildren, q, maxOcc);

  const snapshot = {
    adultCapacity: adultCap,
    childCapacity: childCap,
    maxOccupancy: maxOcc,
    roomQuantity: q,
    totalAdultCapacity,
    totalChildCapacity,
    totalMaxOccupancy,
    adults: Number(adults || 0),
    children: Number(children || 0),
    childrenAges: ages,
    effectiveAdults,
    effectiveChildren,
    extraAdults,
    extraChildren,
    extraAdultFee,
    extraChildFee,
    nights: n,
    extraAdultAmount,
    extraChildAmount,
    totalExtraGuestFee
  };

  return {
    totalExtraGuestFee,
    extraAdults,
    extraChildren,
    extraAdultAmount,
    extraChildAmount,
    distributedRooms,
    snapshot
  };
};

const ensureBookable = async (payload, connection, lock = false) => {
  await bookingModel.expireUnpaidBookingHolds(connection);

  const customer = await bookingModel.getAccountById(
    payload.userId,
    connection,
  );
  const room = await bookingModel.getRoomWithType(
    payload.roomId,
    connection,
    lock,
  );

  if (!customer) {
    throw new HttpError(404, "Không tìm thấy khách hàng");
  }

  if (!room) {
    throw new HttpError(404, "Không tìm thấy phòng");
  }

  if (room.status === "maintenance") {
    throw new HttpError(409, "Phòng đang được bảo trì");
  }

  const childrenPolicy = await getChildrenPolicy(connection);
  const childAges = Array.isArray(payload.childrenAges)
    ? payload.childrenAges
    : [];
  const adultsFromChildren =
    childAges.length === payload.children
      ? childAges.filter((age) => Number(age) > childrenPolicy.childMaxAge)
          .length
      : payload.children;

  const maxOcc = Number(room.maxOccupancy ?? room.capacity);
  const roomQty = Math.max(1, payload.roomQuantity || 1);
  const totalGuests = (payload.adults || 0) + (payload.children || 0);

  if (totalGuests > maxOcc * roomQty) {
    throw new HttpError(
      400,
      `Số khách (${totalGuests}) vượt quá sức chứa tối đa của ${roomQty} phòng (${maxOcc * roomQty} người). Vui lòng chọn thêm phòng.`,
    );
  }

  const bookingConflicts = await bookingModel.getConflictingBookings(
    payload.roomId,
    payload.checkIn,
    payload.checkOut,
    connection,
    lock,
  );
  const availabilityConflicts = await bookingModel.getBookedAvailabilityRows(
    payload.roomId,
    payload.checkIn,
    payload.checkOut,
    connection,
    lock,
  );

  if (bookingConflicts.length > 0 || availabilityConflicts.length > 0) {
    throw new HttpError(
      409,
      "Phòng không còn trống trong khoảng ngày đã chọn",
      {
        conflictingBookingIds: bookingConflicts.map((booking) => booking.id),
      },
    );
  }

  return { customer, room };
};

const ensureRoomAvailable = async (payload, connection, lock = false) => {
  await bookingModel.expireUnpaidBookingHolds(connection);

  const room = await bookingModel.getRoomWithType(
    payload.roomId,
    connection,
    lock,
  );

  if (!room) {
    throw new HttpError(404, "Không tìm thấy phòng");
  }

  if (room.status === "maintenance") {
    throw new HttpError(409, "Phòng đang được bảo trì");
  }

  const bookingConflicts = await bookingModel.getConflictingBookings(
    payload.roomId,
    payload.checkIn,
    payload.checkOut,
    connection,
    lock,
  );
  const availabilityConflicts = await bookingModel.getBookedAvailabilityRows(
    payload.roomId,
    payload.checkIn,
    payload.checkOut,
    connection,
    lock,
  );

  return {
    room,
    bookingConflicts,
    availabilityConflicts,
    available:
      bookingConflicts.length === 0 && availabilityConflicts.length === 0,
  };
};

// Báo giá + kiểm tra phòng trống theo HẠNG PHÒNG (khách không chọn phòng cụ thể).
// Giá tính từ room_prices/defaultPrice của loại phòng nên không cần phòng vật lý.
const checkTypeQuote = async (payload) => {
  await bookingModel.expireUnpaidBookingHolds();

  const [types] = await db.query(
    "SELECT id, typeName, description, capacity, defaultPrice FROM room_types WHERE id = ?",
    [payload.roomTypeId],
  );
  if (types.length === 0) {
    throw new HttpError(404, "Không tìm thấy hạng phòng");
  }
  const roomType = types[0];

  const rooms = await bookingModel.listAvailableRoomsByType(
    payload.roomTypeId,
    payload.checkIn,
    payload.checkOut,
  );

  const nightly = await calcNightlyPrices(
    payload.roomTypeId,
    roomType.defaultPrice,
    payload.checkIn,
    payload.checkOut,
  );
  const childrenPolicy = await getChildrenPolicy();
  const childSurcharge = calcChildSurcharge(
    payload.childrenAges,
    nightly.nights,
    childrenPolicy,
  );

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
    conflictingBookingIds: [],
  };
};

const checkAvailability = async (payload) => {
  if (Array.isArray(payload.rooms) && payload.rooms.length > 0) {
    await bookingModel.expireUnpaidBookingHolds();
    let overallAvailable = true;
    let totalStayAmount = 0;
    let totalChildSurcharge = 0;
    const roomQuotes = [];
    const childrenPolicy = await getChildrenPolicy();
    const assignedRoomIds = new Set();
    let nights = 0;

    for (let i = 0; i < payload.rooms.length; i++) {
      const item = payload.rooms[i];
      const roomQuantity = Math.max(1, item.quantity || 1);
      
      let itemAvailable = false;
      let availableRoomsCount = 0;
      let roomPrice = 0;
      let roomTypeName = '';
      let capacity = 0;

      let matchedRoomType = null;
      let roomObj = null;

      if (!item.roomId && item.roomTypeId) {
        const [types] = await db.query(
          "SELECT id, typeName, defaultPrice, capacity, adultCapacity, childCapacity, maxOccupancy, extraAdultFee, extraChildFee FROM room_types WHERE id = ?",
          [item.roomTypeId]
        );
        if (types.length > 0) {
          matchedRoomType = types[0];
          roomPrice = Number(matchedRoomType.defaultPrice);
          roomTypeName = matchedRoomType.typeName;
          capacity = Number(matchedRoomType.capacity);

          const rooms = await bookingModel.listAvailableRoomsByType(
            item.roomTypeId,
            payload.checkIn,
            payload.checkOut
          );
          const filtered = rooms.filter(r => !assignedRoomIds.has(r.id));
          availableRoomsCount = filtered.length;
          itemAvailable = filtered.length >= roomQuantity;
          if (itemAvailable) {
            filtered.slice(0, roomQuantity).forEach(r => assignedRoomIds.add(r.id));
          }
        }
      } else if (item.roomId) {
        roomObj = await bookingModel.getRoomWithType(item.roomId);
        if (roomObj) {
          roomPrice = Number(roomObj.price_per_night);
          roomTypeName = roomObj.room_type_name;
          capacity = Number(roomObj.capacity);

          const { available } = await ensureRoomAvailable({
            roomId: item.roomId,
            checkIn: payload.checkIn,
            checkOut: payload.checkOut
          });
          itemAvailable = available && !assignedRoomIds.has(item.roomId);
          availableRoomsCount = itemAvailable ? 1 : 0;
          if (itemAvailable) {
            assignedRoomIds.add(item.roomId);
          }
        }
      }

      if (!itemAvailable) {
        overallAvailable = false;
      }

      const nightly = await calcNightlyPrices(
        item.roomTypeId || 1,
        roomPrice,
        payload.checkIn,
        payload.checkOut
      );
      nights = nightly.nights;

      const extraSurchargeResult = calcExtraGuestSurcharge(
        matchedRoomType || roomObj,
        item.adults,
        item.children,
        item.childrenAges || [],
        roomQuantity,
        nightly.nights,
        childrenPolicy
      );

      const itemStayAmount = nightly.total * roomQuantity;
      const itemChildSurcharge = extraSurchargeResult.totalExtraGuestFee;

      totalStayAmount += itemStayAmount;
      totalChildSurcharge += itemChildSurcharge;

      roomQuotes.push({
        roomTypeId: item.roomTypeId,
        roomId: item.roomId,
        roomTypeName,
        quantity: roomQuantity,
        available: itemAvailable,
        availableRooms: availableRoomsCount,
        stayAmount: itemStayAmount,
        childSurcharge: itemChildSurcharge,
        totalAmount: itemStayAmount + itemChildSurcharge
      });
    }

    return {
      available: overallAvailable,
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      nights,
      stayAmount: totalStayAmount,
      childSurcharge: { amount: totalChildSurcharge },
      childrenPolicy,
      totalAmount: totalStayAmount + totalChildSurcharge,
      holdMinutes: HOLD_MINUTES,
      rooms: roomQuotes
    };
  }

  if (!payload.roomId && payload.roomTypeId) {
    return checkTypeQuote(payload);
  }

  const { room, bookingConflicts, available } =
    await ensureRoomAvailable(payload);

  // Giá theo từng đêm (mùa cao điểm/lễ có thể khác nhau) + phụ thu trẻ em
  const nightly = await calcNightlyPrices(
    room.roomTypeId,
    room.price_per_night,
    payload.checkIn,
    payload.checkOut,
  );
  const childrenPolicy = await getChildrenPolicy();
  const childSurcharge = calcChildSurcharge(
    payload.childrenAges,
    nightly.nights,
    childrenPolicy,
  );

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
    conflictingBookingIds: bookingConflicts.map((booking) => booking.id),
  };
};

const checkTypeAvailability = async (payload) => {
  await bookingModel.expireUnpaidBookingHolds();

  const allTypes = await bookingModel.listRoomTypeAvailability(
    payload.checkIn,
    payload.checkOut,
  );
  const requested = payload.rooms.map((item) => {
    const type = allTypes.find(
      (roomType) => Number(roomType.id) === Number(item.roomTypeId),
    );
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
      roomIds: (type?.roomIds || []).slice(0, item.quantity),
    };
  });

  const totalShortage = requested.reduce((sum, item) => sum + item.shortage, 0);
  const requestedTypeIds = new Set(
    payload.rooms.map((item) => Number(item.roomTypeId)),
  );
  const suggestions = allTypes
    .filter(
      (roomType) =>
        !requestedTypeIds.has(Number(roomType.id)) &&
        Number(roomType.availableRooms) > 0,
    )
    .map((roomType) => ({
      roomTypeId: roomType.id,
      roomTypeName: roomType.room_type_name,
      availableRooms: Number(roomType.availableRooms),
      pricePerNight: Number(roomType.price_per_night),
      capacity: Number(roomType.capacity),
    }));

  return {
    available: totalShortage === 0,
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    requested,
    suggestions,
    message:
      totalShortage === 0
        ? "Đủ phòng theo yêu cầu"
        : "Không đủ số lượng phòng theo yêu cầu, vui lòng giảm số lượng hoặc chọn thêm loại phòng khác",
  };
};

const expireUnpaidBookingHolds = () => bookingModel.expireUnpaidBookingHolds();

const getRefundPolicy = (checkIn, paidAmount = 0, options = {}) => {
  const today = dateToUtc(dayString(new Date()));
  const checkInDate = dateToUtc(dayString(checkIn));
  const daysBeforeCheckIn = Math.round((checkInDate - today) / MS_PER_DAY);

  // Force 100% hoàn khi phòng không còn hợp lệ (admin override / lỗi hệ thống)
  // bất kể còn bao nhiêu ngày trước khi nhận phòng.
  if (options.forceFullRefund) {
    const paid = Number(paidAmount || 0);
    return {
      daysBeforeCheckIn,
      refundRate: 1,
      refundableAmount: Math.round(paid),
      paidAmount: paid,
      tierLabel: 'Hoàn 100%',
      tier: 'full_override',
      reason: options.overrideReason || 'Phòng không còn hợp lệ, khách sạn hoàn trả 100% số tiền đã thanh toán.',
      forceFullRefund: true,
    };
  }

  let refundRate;
  let tierLabel;
  let tier;
  let reason;

  if (daysBeforeCheckIn < 0) {
    // Đã quá ngày check-in (khách không đến / đã check-in): không hoàn
    refundRate = 0;
    tier = 'past_checkin';
    tierLabel = 'Hoàn 0%';
    reason = 'Đã qua ngày nhận phòng, theo chính sách không hoàn tiền.';
  } else if (daysBeforeCheckIn < 3) {
    // Dưới 3 ngày (0, 1, 2 ngày trước checkin): không hoàn
    refundRate = 0;
    tier = 'under_3_days';
    tierLabel = 'Hoàn 0%';
    reason = `Hủy phòng dưới 3 ngày trước khi nhận phòng (còn ${daysBeforeCheckIn} ngày) — theo chính sách không hoàn tiền.`;
  } else if (daysBeforeCheckIn < 7) {
    // Từ 3 đến dưới 7 ngày (3, 4, 5, 6 ngày): hoàn 50%
    refundRate = 0.5;
    tier = '3_to_7_days';
    tierLabel = 'Hoàn 50%';
    reason = `Hủy phòng trong khoảng 3–7 ngày trước khi nhận phòng (còn ${daysBeforeCheckIn} ngày) — hoàn 50% số tiền đã thanh toán.`;
  } else {
    // Từ 7 ngày trở lên (>= 7): hoàn 100%
    refundRate = 1;
    tier = 'over_7_days';
    tierLabel = 'Hoàn 100%';
    reason = `Hủy phòng trên 7 ngày trước khi nhận phòng (còn ${daysBeforeCheckIn} ngày) — hoàn 100% số tiền đã thanh toán.`;
  }

  const paid = Number(paidAmount || 0);
  return {
    daysBeforeCheckIn,
    refundRate,
    refundableAmount: Math.round(paid * refundRate),
    paidAmount: paid,
    tierLabel,
    tier,
    reason,
    forceFullRefund: false,
  };
};

const createBooking = async (payload, actor) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    let roomsToProcess = [];
    if (Array.isArray(payload.rooms) && payload.rooms.length > 0) {
      roomsToProcess = payload.rooms;
    } else {
      roomsToProcess = [
        {
          roomId: payload.roomId,
          roomTypeId: payload.roomTypeId,
          quantity: payload.roomQuantity || 1,
          adults: payload.adults,
          children: payload.children,
          childrenAges: payload.childrenAges || []
        }
      ];
    }

    if (payload.requestedCheckOutTime) {
      const tiersForRequest =
        await bookingModel.getCheckoutLateFeeTiers(connection);
      if (
        payload.requestedCheckOutTime > tiersForRequest.standardCheckOutTime
      ) {
        throw new HttpError(
          400,
          `Giờ trả phòng mong muốn không được muộn hơn giờ chuẩn (${tiersForRequest.standardCheckOutTime.slice(0, 5)}). Nếu cần trả phòng muộn, vui lòng liên hệ khách sạn gần ngày ở để được báo phí trả phòng muộn.`,
        );
      }
    }

    let totalBookingPrice = 0;
    const allAssignedRooms = [];
    const allNightlyPrices = {}; // date -> price
    const dates = getStayDates(payload.checkIn, payload.checkOut);
    const childrenPolicy = await getChildrenPolicy(connection);

    let firstRoomTypeId = null;
    let firstRoomId = null;

    // First pass: validate all selections and assign rooms
    for (let rIndex = 0; rIndex < roomsToProcess.length; rIndex++) {
      const roomItem = roomsToProcess[rIndex];
      const roomQuantity = Math.max(1, roomItem.quantity || 1);
      let assignedRooms = [];

      if (!roomItem.roomId && roomItem.roomTypeId) {
        const availableRooms = await bookingModel.listAvailableRoomsByType(
          roomItem.roomTypeId,
          payload.checkIn,
          payload.checkOut,
          connection,
          true,
        );
        const filteredAvailableRooms = availableRooms.filter(r => !allAssignedRooms.some(ar => ar.id === r.id));
        if (filteredAvailableRooms.length < roomQuantity) {
          throw new HttpError(
            409,
            `Hạng phòng này không đủ ${roomQuantity} phòng trống trong khoảng ngày đã chọn`,
          );
        }
        assignedRooms = filteredAvailableRooms.slice(0, roomQuantity);
      } else if (roomItem.roomId) {
        const singleRoom = await bookingModel.getRoomWithType(roomItem.roomId, connection, true);
        if (!singleRoom) {
          throw new HttpError(404, "Không tìm thấy phòng");
        }
        if (singleRoom.status === "maintenance") {
          throw new HttpError(409, `Phòng ${singleRoom.roomNumber} đang được bảo trì`);
        }
        if (allAssignedRooms.some(ar => ar.id === singleRoom.id)) {
          throw new HttpError(409, `Phòng ${singleRoom.roomNumber} đã được chọn trùng lặp`);
        }
        assignedRooms = [singleRoom];
      }

      if (assignedRooms.length === 0) {
        throw new HttpError(400, "Vui lòng chọn phòng hoặc hạng phòng");
      }

      if (!firstRoomTypeId) {
        firstRoomTypeId = assignedRooms[0].roomTypeId;
        firstRoomId = assignedRooms[0].id;
      }

      const roomType = await getRoomTypeById(assignedRooms[0].roomTypeId, connection);
      const roomPrice = Number(assignedRooms[0].price_per_night);

      const nightly = await calcNightlyPrices(
        assignedRooms[0].roomTypeId,
        roomPrice,
        payload.checkIn,
        payload.checkOut,
        connection,
      );

      // Accumulate nightly prices
      for (const np of nightly.prices) {
        allNightlyPrices[np.date] = (allNightlyPrices[np.date] || 0) + (np.price * roomQuantity);
      }

      const extraSurcharge = calcExtraGuestSurcharge(
        roomType || assignedRooms[0],
        roomItem.adults,
        roomItem.children,
        roomItem.childrenAges || [],
        roomQuantity,
        nightly.nights,
        childrenPolicy
      );

      const baseStayTotal = nightly.total * roomQuantity;
      const roomTotal = baseStayTotal + extraSurcharge.totalExtraGuestFee;
      totalBookingPrice += roomTotal;

      for (let i = 0; i < assignedRooms.length; i++) {
        allAssignedRooms.push({
          ...assignedRooms[i],
          roomPrice,
          extraSurchargeInfo: extraSurcharge,
          roomItemIndex: rIndex,
          roomIndexInGroup: i
        });
      }
    }

    const customer = await bookingModel.getAccountById(
      payload.userId,
      connection,
    );
    if (!customer) {
      throw new HttpError(404, "Không tìm thấy khách hàng");
    }

    // Create the main booking
    const mainPayload = {
      ...payload,
      roomId: firstRoomId,
      roomTypeId: firstRoomTypeId,
      roomQuantity: allAssignedRooms.length,
      adults: roomsToProcess.reduce((sum, r) => sum + (r.adults || 0), 0),
      children: roomsToProcess.reduce((sum, r) => sum + (r.children || 0), 0)
    };

    const bookingId = await bookingModel.createBooking(
      mainPayload,
      totalBookingPrice,
      connection,
      {} // snapshot
    );

    // Save nightly prices in unique records
    const finalNightlyPrices = Object.keys(allNightlyPrices).map(date => ({
      date,
      price: allNightlyPrices[date]
    }));
    await bookingModel.saveNightlyPrices(bookingId, finalNightlyPrices, connection);

    const createdBookingDetails = [];
    for (let i = 0; i < allAssignedRooms.length; i++) {
      const assigned = allAssignedRooms[i];
      const roomItem = roomsToProcess[assigned.roomItemIndex];
      const dist = assigned.extraSurchargeInfo.distributedRooms[assigned.roomIndexInGroup] || { adults: roomItem.adults, children: roomItem.children };
      const detailPayload = {
        ...payload,
        roomId: assigned.id,
        adults: dist.adults,
        children: dist.children
      };
      const detailSurcharge = assigned.roomIndexInGroup === 0 ? assigned.extraSurchargeInfo.totalExtraGuestFee : 0;
      const detail = await bookingModel.createBookingDetail(
        bookingId,
        detailPayload,
        assigned.roomPrice,
        detailSurcharge,
        connection
      );
      createdBookingDetails.push(detail);

      await bookingModel.upsertAvailabilityRows(
        assigned.id,
        bookingId,
        dates,
        connection
      );
    }

    let serviceAmount = 0;
    // Dịch vụ khách chủ động chọn khi đặt được xác nhận và tính vào payment ngay.
    if (
      Array.isArray(payload.serviceRequests) &&
      payload.serviceRequests.length > 0
    ) {
      for (const request of payload.serviceRequests) {
        let reqBookingDetailId = request.bookingDetailId || null;
        let reqRoomId = request.roomId || null;

        if (request.roomIndex) {
          if (request.roomIndex < 1 || request.roomIndex > createdBookingDetails.length) {
            throw new HttpError(400, `Phòng được chọn (${request.roomIndex}) không hợp lệ`);
          }
          const targetDetail = createdBookingDetails[request.roomIndex - 1];
          if (targetDetail) {
            reqBookingDetailId = targetDetail.id;
            reqRoomId = targetDetail.roomId;
          }
        } else if (reqBookingDetailId) {
          const isValidDetail = createdBookingDetails.some((d) => d.id === reqBookingDetailId);
          if (!isValidDetail) {
            throw new HttpError(400, "Phòng không thuộc đặt phòng này");
          }
        } else if (reqRoomId) {
          const isValidRoom = await bookingModel.validateRoomInBooking(
            bookingId,
            reqRoomId,
            connection,
          );
          if (!isValidRoom) {
            throw new HttpError(400, "Phòng không thuộc đặt phòng này");
          }
          const matchedDetail = createdBookingDetails.find((d) => d.roomId === reqRoomId);
          if (matchedDetail) {
            reqBookingDetailId = matchedDetail.id;
          }
        }

        const service = await bookingModel.getServiceById(
          request.serviceId,
          connection,
        );
        if (!service) {
          throw new HttpError(
            404,
            `Không tìm thấy dịch vụ (${request.serviceId})`,
          );
        }
        const serviceName = String(service.serviceName || "").toLowerCase();
        if (
          request.quantity > 1 &&
          (serviceName.includes("extra bed") || serviceName.includes("giường"))
        ) {
          throw new HttpError(400, "Mỗi phòng chỉ được kê tối đa 1 giường phụ");
        }
        await bookingModel.addBookingService(
          bookingId,
          service,
          request.quantity,
          connection,
          { roomId: reqRoomId, bookingDetailId: reqBookingDetailId },
        );
        serviceAmount += Number(service.price) * request.quantity;
        await connection.query(
          `INSERT INTO booking_service_requests (bookingId, bookingDetailId, roomId, serviceId, quantity, status) VALUES (?, ?, ?, ?, ?, 'confirmed')`,
          [bookingId, reqBookingDetailId, reqRoomId, request.serviceId, request.quantity],
        );
      }
    }
    await connection.query("UPDATE bookings SET totalAmount = ? WHERE id = ?", [
      totalBookingPrice + serviceAmount,
      bookingId,
    ]);

    const payment = await paymentService.createPaymentForBooking(
      bookingId,
      { serviceAmount },
      connection,
    );

    const roomNumbersStr = allAssignedRooms.map(r => r.roomNumber).filter(Boolean).join(', ');
    const stayNights = Math.max(1, Math.round((new Date(payload.checkOut) - new Date(payload.checkIn)) / (1000 * 60 * 60 * 24)));

    await logHistory(
      bookingId,
      "created",
      `Tạo đặt phòng ${roomNumbersStr ? `phòng ${roomNumbersStr}` : ""} từ ${displayDate(payload.checkIn)} đến ${displayDate(payload.checkOut)} (${stayNights} đêm), tổng tiền ${displayMoney(totalBookingPrice + serviceAmount)}`,
      {
        newValue: {
          roomId: payload.roomId,
          checkIn: dayString(payload.checkIn),
          checkOut: dayString(payload.checkOut),
          totalPrice: totalBookingPrice + serviceAmount,
        },
        amount: totalBookingPrice + serviceAmount,
      },
      actor || { userId: payload.userId, role: "customer" },
      connection,
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

const fetchMultiRoomTypeMetadata = async (bookingIds, connection) => {
  const ids = Array.isArray(bookingIds) ? bookingIds.map(Number).filter(Boolean) : [];
  if (ids.length === 0) return {};

  const [rows] = await (connection || db).query(
    `SELECT 
       bd.id AS bookingDetailId,
       bd.bookingId,
       bd.roomId,
       COALESCE(r.roomTypeId, 1) AS roomTypeId,
       bd.roomPrice,
       r.roomNumber,
       r.floor,
       r.area,
       r.status AS roomStatus,
       COALESCE(rt.typeName, 'Standard') AS typeName,
       COALESCE(rt.capacity, 2) AS capacity,
       COALESCE(rt.adultCapacity, 2) AS adultCapacity,
       COALESCE(rt.childCapacity, 0) AS childCapacity,
       COALESCE(rt.maxOccupancy, 3) AS maxOccupancy,
       COALESCE(rt.extraAdultFee, 200000) AS extraAdultFee,
       COALESCE(rt.extraChildFee, 100000) AS extraChildFee
     FROM booking_details bd
     LEFT JOIN rooms r ON r.id = bd.roomId
     LEFT JOIN room_types rt ON rt.id = r.roomTypeId
     WHERE bd.bookingId IN (?)
     ORDER BY bd.id ASC`,
    [ids]
  );

  const result = {};
  for (const id of ids) {
    result[id] = { roomTypesSummary: [], bookingRooms: [] };
  }

  const groupedByBooking = {};
  for (const row of rows) {
    if (!groupedByBooking[row.bookingId]) {
      groupedByBooking[row.bookingId] = [];
    }
    groupedByBooking[row.bookingId].push(row);
  }

  for (const id of ids) {
    const details = groupedByBooking[id] || [];
    const summaryMap = {};
    const bookingRooms = [];

    for (const d of details) {
      const typeId = d.roomTypeId || 1;
      if (!summaryMap[typeId]) {
        summaryMap[typeId] = {
          roomTypeId: typeId,
          typeName: d.typeName || 'Standard',
          quantity: 0,
          roomPrice: Number(d.roomPrice || 0),
          capacity: Number(d.capacity || 2),
          adultCapacity: Number(d.adultCapacity || 2),
          childCapacity: Number(d.childCapacity || 0),
          maxOccupancy: Number(d.maxOccupancy || 3),
          extraAdultFee: Number(d.extraAdultFee || 200000),
          extraChildFee: Number(d.extraChildFee || 100000)
        };
      }
      summaryMap[typeId].quantity += 1;

      if (d.roomId) {
        bookingRooms.push({
          bookingDetailId: d.bookingDetailId,
          id: d.roomId,
          number: d.roomNumber,
          floor: d.floor,
          area: d.area,
          roomTypeId: typeId,
          typeName: d.typeName || 'Standard'
        });
      }
    }

    result[id] = {
      roomTypesSummary: Object.values(summaryMap),
      bookingRooms
    };
  }

  return result;
};

const listBookings = async (filters) => {
  const result = await bookingModel.listBookings(filters);

  const enrichList = async (bookings) => {
    if (!Array.isArray(bookings) || bookings.length === 0) return bookings;
    const bookingIds = bookings.map((b) => b.id);
    const metadataMap = await fetchMultiRoomTypeMetadata(bookingIds);

    return bookings.map((b) => {
      const meta = metadataMap[b.id];
      const roomTypesSummary = (meta && meta.roomTypesSummary.length > 0)
        ? meta.roomTypesSummary
        : [
            {
              roomTypeId: b.room_type_id || b.roomTypeId || null,
              typeName: b.room_type_name || 'Đặt phòng',
              quantity: Number(b.room_quantity || 1),
              roomPrice: Number(b.room_price || b.price_per_night || 0)
            }
          ];
      const roomsForBooking = (meta && meta.bookingRooms.length > 0)
        ? meta.bookingRooms
        : b.room_id && b.room_number
          ? [{ id: b.room_id, number: b.room_number }]
          : [];
      return {
        ...b,
        roomTypesSummary,
        booking_rooms: roomsForBooking,
      };
    });
  };

  if (result && typeof result === 'object' && !Array.isArray(result) && Array.isArray(result.data)) {
    return {
      ...result,
      data: await enrichList(result.data),
    };
  }

  return await enrichList(Array.isArray(result) ? result : []);
};
// So giờ khách khai báo với booking liền kề cùng phòng để cảnh báo lễ tân.
// Chỉ tính khi booking chưa/đang lưu trú - booking đã checked_out/cancelled
// không còn ý nghĩa để cảnh báo bàn giao nữa.
const computeHandoverWarning = async (booking) => {
  if (
    !booking.room_id ||
    !["pending", "confirmed", "checked_in"].includes(booking.status)
  ) {
    return { hasWarning: false, warnings: [] };
  }

  const tiers = await bookingModel.getCheckoutLateFeeTiers();
  const bufferMinutes = Number(tiers.housekeepingBufferMinutes || 60);
  const checkInDay = dayString(booking.check_in);
  const checkOutDay = dayString(booking.check_out);

  const { previousBooking, nextBooking } =
    await bookingModel.findAdjacentBookingsForRoom(
      booking.room_id,
      checkInDay,
      checkOutDay,
      booking.id,
    );

  const warnings = [];

  if (previousBooking) {
    if (previousBooking.status === "checked_in") {
      // Khách trước còn đang lưu trú, chưa trả phòng - nghiêm trọng hơn việc
      // chỉ sát giờ dự kiến, cảnh báo bất kể khách hiện tại có khai giờ hay không.
      warnings.push({
        type: "previous_guest_still_in",
        relatedBookingId: previousBooking.id,
        message: `Phòng đang có khách khác lưu trú (đặt phòng #${previousBooking.id}), chưa trả phòng. Cần xử lý trước khi khách mới nhận phòng.`,
      });
    } else if (booking.requested_check_in_time) {
      const previousCheckOutRef = previousBooking.actualCheckOutTime
        ? new Date(previousBooking.actualCheckOutTime)
        : combineDateTime(
            checkInDay,
            previousBooking.requestedCheckOutTime || tiers.standardCheckOutTime,
          );
      const requestedCheckIn = combineDateTime(
        checkInDay,
        booking.requested_check_in_time,
      );
      const gapMinutes = Math.round(
        (requestedCheckIn - previousCheckOutRef) / 60000,
      );

      if (gapMinutes < bufferMinutes) {
        warnings.push({
          type: "check_in_too_close",
          relatedBookingId: previousBooking.id,
          gapMinutes,
          bufferMinutes,
          message: `Khách báo nhận phòng lúc ${booking.requested_check_in_time.slice(0, 5)}, sát giờ khách trước (#${previousBooking.id}) ${previousBooking.actualCheckOutTime ? "đã" : "dự kiến"} trả phòng. Cần kiểm tra phòng đã dọn kịp chưa.`,
        });
      }
    }
  }

  if (
    nextBooking &&
    booking.requested_check_out_time &&
    nextBooking.requestedCheckInTime
  ) {
    const requestedCheckOut = combineDateTime(
      checkOutDay,
      booking.requested_check_out_time,
    );
    const nextRequestedCheckIn = combineDateTime(
      checkOutDay,
      nextBooking.requestedCheckInTime,
    );
    const gapMinutes = Math.round(
      (nextRequestedCheckIn - requestedCheckOut) / 60000,
    );

    if (gapMinutes < bufferMinutes) {
      warnings.push({
        type: "check_out_too_close",
        relatedBookingId: nextBooking.id,
        gapMinutes,
        bufferMinutes,
        message: `Khách báo trả phòng lúc ${booking.requested_check_out_time.slice(0, 5)}, sát giờ khách sau (#${nextBooking.id}) báo nhận phòng lúc ${nextBooking.requestedCheckInTime.slice(0, 5)}. Cần nhắc khách trả đúng giờ hoặc dọn phòng gấp.`,
      });
    }
  }

  return { hasWarning: warnings.length > 0, warnings };
};
const getBookingById = async (bookingId) => {
  await bookingModel.expireUnpaidBookingHolds();
  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) {
    throw new HttpError(404, "Không tìm thấy đặt phòng");
  }
  const [services] = await db.query(
    `SELECT bs.id, bs.bookingId, bs.bookingDetailId, bs.roomId, r.roomNumber, bs.serviceId,
            s.serviceName, s.description,
            COALESCE(bs.unitPrice, s.price) AS unitPrice, bs.quantity, bs.totalPrice,
            COALESCE(bs.status, 'used') AS status, bs.usedAt, bs.createdAt
     FROM booking_services bs
     LEFT JOIN services s ON s.id = bs.serviceId
     LEFT JOIN bookings b ON b.id = bs.bookingId
     LEFT JOIN rooms r ON r.id = COALESCE(bs.roomId, b.room_id)
     WHERE bs.bookingId = ?
     ORDER BY bs.id ASC`,
    [bookingId],
  );
  const [guests] = await db.query(
    `SELECT id, fullName, identityNumber, phone, note
     FROM booking_guests
     WHERE bookingId = ?
     ORDER BY id ASC`,
    [bookingId],
  );
  const [vouchers] = booking.voucher_id
    ? await db.query(
        `SELECT id, code, discountType, discountValue, maxDiscount
         FROM vouchers WHERE id = ?`,
        [booking.voucher_id],
      )
    : [[]];
  const [refunds] = await db.query(
    `SELECT id, amount, refundRate, refundMethod, status, note, createdAt, processedAt
     FROM payment_refunds
     WHERE bookingId = ?
     ORDER BY id DESC`,
    [bookingId],
  );
  const [damages] = await db.query(
    `SELECT bdc.id, bdc.bookingId, bdc.bookingDetailId, bdc.roomId, r.roomNumber,
            COALESCE(bdc.chargeType, 'damage') AS chargeType,
            bdc.itemName, bdc.quantity, bdc.unitPrice, bdc.totalPrice,
            COALESCE(bdc.status, 'used') AS status, bdc.note, bdc.createdAt
     FROM booking_damage_charges bdc
     LEFT JOIN rooms r ON r.id = bdc.roomId
     WHERE bdc.bookingId = ?
     ORDER BY bdc.id ASC`,
    [bookingId],
  );
  const [transfers] = await db.query(
    `SELECT t.id, t.fromRoomId, t.toRoomId, t.fromDate, t.toDate, t.pricePerNight, t.reason, t.createdAt,
            fr.roomNumber AS fromRoomNumber, tr.roomNumber AS toRoomNumber
     FROM booking_room_transfers t
     LEFT JOIN rooms fr ON fr.id = t.fromRoomId
     LEFT JOIN rooms tr ON tr.id = t.toRoomId
     WHERE t.bookingId = ?
     ORDER BY t.id ASC`,
    [bookingId],
  );
  const [payments] = await db.query(
    `SELECT id, roomAmount, serviceAmount, surchargeAmount, discountAmount, depositAmount,
            paidAmount, remainingAmount, totalAmount, paymentMethod, paymentStatus,
            transactionCode, paymentDate
     FROM payments
     WHERE bookingId = ?
     ORDER BY id DESC`,
    [bookingId],
  );
  const history = await bookingModel.listBookingHistory(bookingId);
  const handoverWarning = await computeHandoverWarning(booking);

  // ── Multi-room source of truth: booking_details ──────────────────
  // Lấy tất cả phòng thuộc booking từ booking_details (thứ tự gán phòng bd.id ASC).
  const [details] = await db.query(
    `SELECT bd.id, bd.roomId, r.roomNumber
     FROM booking_details bd
     LEFT JOIN rooms r ON r.id = bd.roomId
     WHERE bd.bookingId = ?
     ORDER BY bd.id ASC`,
    [bookingId],
  );
  const [bdRooms] = await db.query(
    `SELECT DISTINCT bd.roomId AS id, r.roomNumber AS number
     FROM booking_details bd
     INNER JOIN rooms r ON r.id = bd.roomId
     WHERE bd.bookingId = ?
     ORDER BY r.roomNumber ASC`,
    [bookingId],
  );
  let bookingRooms = bdRooms;
  if (bookingRooms.length === 0 && booking.room_id) {
    // Legacy fallback: booking chỉ có room_id trên bảng bookings
    const [fallback] = await db.query(
      `SELECT r.id, r.roomNumber AS number FROM rooms r WHERE r.id = ?`,
      [booking.room_id],
    );
    bookingRooms = fallback;
  }

  const lateCheckoutSurcharge = await bookingModel.sumLateCheckoutCharges(bookingId);

  const metadataMap = await fetchMultiRoomTypeMetadata([bookingId]);
  const meta = metadataMap[bookingId];
  const roomTypesSummary = (meta && meta.roomTypesSummary.length > 0)
    ? meta.roomTypesSummary
    : [
        {
          roomTypeId: booking.room_type_id || booking.roomTypeId || null,
          typeName: booking.room_type_name || 'Đặt phòng',
          quantity: Number(booking.room_quantity || 1),
          roomPrice: Number(booking.room_price || booking.price_per_night || 0)
        }
      ];
  const enrichedBookingRooms = (meta && meta.bookingRooms.length > 0)
    ? meta.bookingRooms
    : bookingRooms;

  return {
    ...booking,
    roomTypesSummary,
    details,
    services,
    guests,
    voucher: vouchers[0] || null,
    refund: refunds[0] || null,
    refunds,
    damages,
    transfers,
    payments,
    payment: payments[0] || null,
    late_checkout_surcharge: lateCheckoutSurcharge,
    history,
    handoverWarning,
    booking_rooms: enrichedBookingRooms,
  };
};

const getBookingHistory = async (bookingId) => {
  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) {
    throw new HttpError(404, "Không tìm thấy đặt phòng");
  }
  return bookingModel.listBookingHistory(bookingId);
};

// Bảng kê số tiền khách còn phải trả khi trả phòng, kèm thông tin dựng mã QR.
// Dùng cho màn hình thu tiền của lễ tân và cho trang thanh toán của khách.
const getPaymentSummary = async (bookingId) => {
  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) {
    throw new HttpError(404, "Không tìm thấy đặt phòng");
  }

  let payment = null;
  try {
    payment = await paymentService.recalculatePaymentForBooking(bookingId);
  } catch {
    payment = null;
  }
  if (!payment) {
    try {
      payment = await paymentService.createPaymentForBooking(bookingId);
    } catch {
      payment = null;
    }
  }
  const tiers = await bookingModel.getCheckoutLateFeeTiers();

  let voucherCode = null;
  if (booking.voucher_id) {
    const [vouchers] = await db.query(
      "SELECT code FROM vouchers WHERE id = ?",
      [booking.voucher_id],
    );
    voucherCode = vouchers[0]?.code || null;
  }

  const [services] = await db.query(
    `SELECT bs.id, bs.roomId, r.roomNumber, bs.quantity, bs.totalPrice, bs.createdAt,
            COALESCE(bs.status, 'used') AS status, s.serviceName
     FROM booking_services bs
     LEFT JOIN services s ON s.id = bs.serviceId
     LEFT JOIN bookings b ON b.id = bs.bookingId
     LEFT JOIN rooms r ON r.id = COALESCE(bs.roomId, b.room_id)
     WHERE bs.bookingId = ?
     ORDER BY bs.id ASC`,
    [bookingId],
  );
  const [damages] = await db.query(
    `SELECT bdc.id, bdc.roomId, r.roomNumber,
            COALESCE(bdc.chargeType, 'damage') AS chargeType,
            bdc.itemName, bdc.quantity, bdc.totalPrice,
            COALESCE(bdc.status, 'used') AS status, bdc.note, bdc.createdAt
     FROM booking_damage_charges bdc
     LEFT JOIN rooms r ON r.id = bdc.roomId
     WHERE bdc.bookingId = ?
     ORDER BY bdc.id ASC`,
    [bookingId],
  );

  const paymentSettings = await getPaymentAccountSettings();
  const remainingAmount = Math.max(Number(payment?.remainingAmount || 0), 0);

  return {
    bookingId,
    bookingStatus: booking.status,
    customerName: booking.customer_name,
    roomNumber: booking.room_number,
    checkOut: booking.check_out,
    standardCheckOutTime: tiers.standardCheckOutTime,
    paymentId: payment?.id || null,
    totalAmount: Number(payment?.totalAmount || 0),
    paidAmount: Number(payment?.paidAmount || 0),
    remainingAmount,
    discountAmount: Number(payment?.discountAmount || 0),
    voucherCode,
    occupancySurcharge: Number(booking.occupancy_surcharge || 0),
    lateCheckoutSurcharge: await bookingModel.sumLateCheckoutCharges(bookingId),
    surchargeAmount: Number(
      payment?.surchargeAmount || booking.occupancy_surcharge || 0,
    ),
    serviceAmount: services
      .filter(item => (item.status || 'used') === 'used')
      .reduce((sum, item) => sum + Number(item.totalPrice || 0), 0),
    damageAmount: damages
      .filter(item => (item.status || 'used') === 'used')
      .reduce((sum, item) => sum + Number(item.totalPrice || 0), 0),
    services,
    damages,
    canCheckOut: remainingAmount <= 0,
    transferContent: `${paymentSettings.transferPrefix || "HB"}${bookingId}`,
    bankAccount: {
      bankBin: paymentSettings.bankBin,
      bankName: paymentSettings.bankName,
      bankCode: paymentSettings.bankCode,
      accountNumber: paymentSettings.accountNumber,
      accountName: paymentSettings.accountName,
    },
  };
};

// Lễ tân bấm "gửi yêu cầu thanh toán": báo cho khách qua thông báo trong app và
// ghi dấu vết. Không tự động ghi nhận tiền - tiền chỉ vào khi có người xác nhận.
const requestOutstandingPayment = async (bookingId, actor = null) => {
  const summary = await getPaymentSummary(bookingId);

  if (summary.remainingAmount <= 0) {
    throw new HttpError(
      409,
      "Đặt phòng này đã thanh toán đủ, không còn khoản nào cần thu",
    );
  }

  const booking = await bookingModel.getBookingById(bookingId);
  await bookingModel.createCustomerNotification(
    booking.user_id,
    "Cần thanh toán chi phí phát sinh",
    `Đặt phòng #${bookingId} (phòng ${summary.roomNumber || ""}) còn ${displayMoney(summary.remainingAmount)} chưa thanh toán` +
      `${summary.serviceAmount > 0 ? `, gồm dịch vụ phát sinh ${displayMoney(summary.serviceAmount)}` : ""}` +
      `${summary.damageAmount > 0 ? `, phí hư hỏng ${displayMoney(summary.damageAmount)}` : ""}` +
      `. Bạn có thể quét mã QR tại quầy hoặc thanh toán trong ứng dụng trước khi trả phòng.`,
  );

  await logHistory(
    bookingId,
    "payment_requested",
    `Yêu cầu khách thanh toán ${displayMoney(summary.remainingAmount)} chi phí còn thiếu (đã xuất mã QR và gửi thông báo cho khách)`,
    { amount: summary.remainingAmount },
    actor,
  );

  return summary;
};

const getRefundPreview = async (bookingId, options = {}) => {
  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) {
    throw new HttpError(404, "Không tìm thấy đặt phòng");
  }

  let payment = null;
  try {
    payment = await paymentService.getPaymentByBookingId(bookingId);
  } catch {
    payment = null;
  }

  // Phòng không hợp lệ sau khi thanh toán: đã thanh toán nhưng phòng đã bị xoá / bảo trì
  // -> mặc định hoàn 100% (override options.forceFullRefund nếu chưa có).
  let forceFullRefund = Boolean(options.forceFullRefund);
  let overrideReason = options.overrideReason || null;

  const paidAmount = Number(payment?.paidAmount || 0);
  const paidSuccess = paidAmount > 0;

  if (paidSuccess && !forceFullRefund) {
    const roomStatus = booking.room_status || booking.roomStatus;
    const roomDeleted = Boolean(booking.room_deleted || booking.isRoomDeleted);
    if (roomStatus === 'maintenance' || roomDeleted || !booking.room_id) {
      forceFullRefund = true;
      overrideReason = overrideReason || 'Phòng đặt trước không còn hợp lệ (bảo trì/ngừng hoạt động), khách sạn hoàn trả 100% số tiền đã thanh toán.';
    }
  }

  return {
    bookingId,
    canCancel: ["pending", "confirmed"].includes(booking.status),
    bookingStatus: booking.status,
    paymentId: payment?.id || null,
    ...getRefundPolicy(booking.check_in, paidAmount, {
      forceFullRefund,
      overrideReason,
    }),
  };
};

const normalizeRefundRequest = (refundRequest) => {
  if (
    !refundRequest ||
    typeof refundRequest !== "object" ||
    !refundRequest.refundMethod
  ) {
    return null;
  }

  const method =
    refundRequest.refundMethod === "cash" ? "cash" : "bank_transfer";

  if (method === "bank_transfer") {
    const accountNumber = String(refundRequest.accountNumber || "").replace(
      /\s+/g,
      "",
    );
    const accountName = String(refundRequest.accountName || "")
      .trim()
      .toUpperCase();
    const bankName = String(refundRequest.bankName || "").trim();

    if (!/^\d{4,30}$/.test(accountNumber)) {
      throw new HttpError(
        400,
        "Số tài khoản ngân hàng nhận hoàn tiền chỉ được bao gồm các chữ số (0-9)",
      );
    }
    if (accountName.length < 3) {
      throw new HttpError(
        400,
        "Vui lòng nhập tên chủ tài khoản nhận hoàn tiền",
      );
    }
    if (!bankName) {
      throw new HttpError(400, "Vui lòng chọn ngân hàng nhận hoàn tiền");
    }

    return {
      refundMethod: "bank_transfer",
      bankBin: String(refundRequest.bankBin || "").slice(0, 10) || null,
      bankName: bankName.slice(0, 100),
      accountNumber,
      accountName: accountName.slice(0, 100),
    };
  }

  return {
    refundMethod: "cash",
    bankBin: null,
    bankName: null,
    accountNumber: null,
    accountName: null,
  };
};

const cancelBooking = async (bookingId, refundRequest = null, reasonValue = null, actor = null, options = {}) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) {
      throw new HttpError(404, "Không tìm thấy đặt phòng");
    }

    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new HttpError(
        409,
        `Không thể hủy đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`,
      );
    }
    const cancellationReason = String(reasonValue || "").trim();
    if (cancellationReason.length < 5) {
      throw new HttpError(
        400,
        "Vui lòng nhập lý do hủy phòng (ít nhất 5 ký tự)",
      );
    }
    if (cancellationReason.length > 500) {
      throw new HttpError(400, "Lý do hủy phòng không được vượt quá 500 ký tự");
    }

    let payment = null;
    try {
      payment = await paymentService.getPaymentByBookingId(bookingId);
    } catch {
      payment = null;
    }

    // Tính forceFullRefund nếu admin override hoặc phòng không hợp lệ (đã thanh toán nhưng maintenance/deleted)
    let forceFullRefund = Boolean(options.forceFullRefund);
    let overrideReason = options.overrideReason || null;

    const paidAmount = Number(payment?.paidAmount || 0);
    const paidSuccess = paidAmount > 0;
    if (paidSuccess && !forceFullRefund) {
      const roomStatus = booking.room_status || booking.roomStatus;
      const roomDeleted = Boolean(booking.room_deleted || booking.isRoomDeleted);
      if (roomStatus === 'maintenance' || roomDeleted || !booking.room_id) {
        forceFullRefund = true;
        overrideReason = overrideReason || 'Phòng đặt trước không còn hợp lệ (bảo trì/ngừng hoạt động), khách sạn hoàn trả 100% số tiền đã thanh toán.';
      }
    }

    const refundPolicy = getRefundPolicy(booking.check_in, paidAmount, {
      forceFullRefund,
      overrideReason,
    });

    await bookingModel.updateBookingStatus(bookingId, "cancelled", connection);
    await connection.query(
      "UPDATE bookings SET cancellation_reason = ? WHERE id = ?",
      [cancellationReason, bookingId],
    );

    // Khách đã trả tiền và còn được hoàn -> luôn tạo yêu cầu hoàn tiền chờ admin duyệt.
    // Không có thông tin nhận tiền (VD: admin hủy hộ) -> mặc định nhận tại quầy.
    let refund = null;
    if (payment && refundPolicy.refundableAmount > 0) {
      const providedRequest = normalizeRefundRequest(refundRequest);
      const normalizedRequest = providedRequest || {
        refundMethod: "cash",
        bankBin: null,
        bankName: null,
        accountNumber: null,
        accountName: null,
      };
      const autoNote = providedRequest
        ? null
        : "Tạo tự động khi hủy. Khách nhận tiền tại quầy hoặc khách sạn sẽ liên hệ.";

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
          autoNote,
        ],
      );

      refund = {
        id: result.insertId,
        amount: refundPolicy.refundableAmount,
        refundMethod: normalizedRequest.refundMethod,
        status: "pending",
      };
    }

    await logHistory(
      bookingId,
      "cancelled",
      `Hủy đặt phòng. Lý do: ${cancellationReason}${refund ? `. Tạo yêu cầu hoàn ${displayMoney(refund.amount)} (${Math.round(refundPolicy.refundRate * 100)}%) chờ duyệt` : ""}`,
      {
        oldValue: { status: booking.status },
        newValue: { status: "cancelled", reason: cancellationReason },
        amount: refund ? refund.amount : null,
      },
      actor,
      connection,
    );

    await connection.commit();
    return {
      ...(await bookingModel.getBookingById(bookingId)),
      refundPolicy,
      refund,
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

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) {
      throw new HttpError(404, "Không tìm thấy đặt phòng");
    }

    await bookingModel.replaceBookingGuests(
      bookingId,
      payload.guests,
      connection,
    );

    await logHistory(
      bookingId,
      "guests_updated",
      `Cập nhật danh sách khách lưu trú (${payload.guests.length} người): ${payload.guests.map((guest) => guest.fullName).join(", ")}`,
      { newValue: { guests: payload.guests.map((guest) => guest.fullName) } },
      actor,
      connection,
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

const getBookingServices = async (bookingId) => {
  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) throw new HttpError(404, "Không tìm thấy đặt phòng");
  return bookingModel.getBookingServicesByBookingId(bookingId);
};

const addServiceCharge = async (bookingId, payload, actor = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) {
      throw new HttpError(404, "Không tìm thấy đặt phòng");
    }

    if (!["pending", "confirmed", "checked_in"].includes(booking.status)) {
      throw new HttpError(
        409,
        `Không thể thêm phí dịch vụ khi đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`,
      );
    }

    if (payload.roomId) {
      const isValidRoom = await bookingModel.validateRoomInBooking(
        bookingId,
        payload.roomId,
        connection,
      );
      if (!isValidRoom) {
        throw new HttpError(400, "Phòng không thuộc đặt phòng này");
      }
    }

    const service = await bookingModel.getServiceById(
      payload.serviceId,
      connection,
    );
    if (!service) {
      throw new HttpError(404, "Không tìm thấy dịch vụ");
    }

    const created = await bookingModel.addBookingService(
      bookingId,
      service,
      payload.quantity,
      connection,
      { roomId: payload.roomId, status: payload.status },
    );

    const payment = await paymentService.recalculatePaymentForBooking(
      bookingId,
      connection,
    );
    const addedAmount = Number(created.totalPrice || 0);

    await logHistory(
      bookingId,
      "service_added",
      `Thêm dịch vụ phát sinh: ${service.serviceName} x${payload.quantity} = ${displayMoney(addedAmount)}${created.status !== "used" ? ` (trạng thái: ${created.status})` : ""}`,
      {
        newValue: {
          id: created.id,
          roomId: payload.roomId || null,
          serviceId: service.id,
          serviceName: service.serviceName,
          quantity: payload.quantity,
          unitPrice: Number(service.price),
          status: created.status,
        },
        amount: created.status === "used" ? addedAmount : 0,
      },
      actor,
      connection,
    );

    if (payment && Number(payment.remainingAmount) > 0 && created.status === "used") {
      await bookingModel.createCustomerNotification(
        booking.user_id,
        "Thanh toán dịch vụ phát sinh",
        `Dịch vụ ${service.serviceName} đã được thêm vào đặt phòng #${bookingId} với số tiền ${addedAmount.toLocaleString("vi-VN")} VNĐ. Số tiền còn phải thanh toán là ${Number(payment.remainingAmount).toLocaleString("vi-VN")} VNĐ.`,
        connection,
      );
    }

    await connection.commit();
    return {
      booking: await bookingModel.getBookingById(bookingId),
      service: created,
      payment,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateServiceCharge = async (
  bookingId,
  serviceChargeId,
  payload,
  actor = null,
) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) throw new HttpError(404, "Không tìm thấy đặt phòng");
    if (!["pending", "confirmed", "checked_in"].includes(booking.status)) {
      throw new HttpError(
        409,
        `Không thể sửa dịch vụ khi đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`,
      );
    }

    const oldCharge = await bookingModel.getBookingServiceChargeById(
      serviceChargeId,
      connection,
    );
    if (!oldCharge) throw new HttpError(404, "Không tìm thấy dòng dịch vụ này");
    if (Number(oldCharge.bookingId) !== Number(bookingId)) {
      throw new HttpError(
        403,
        "Dòng dịch vụ này không thuộc đặt phòng đã chỉ định",
      );
    }

    if (payload.roomId) {
      const isValidRoom = await bookingModel.validateRoomInBooking(
        bookingId,
        payload.roomId,
        connection,
      );
      if (!isValidRoom) {
        throw new HttpError(400, "Phòng không thuộc đặt phòng này");
      }
    }

    const unitPrice = Number(oldCharge.unitPrice || 0);
    const oldQty = Number(oldCharge.quantity || 0);
    const oldTotal = Number(oldCharge.totalPrice || 0);
    const newQty = payload.quantity != null ? Number(payload.quantity) : oldQty;
    if (newQty < 1) {
      throw new HttpError(
        400,
        "Số lượng phải lớn hơn 0. Nếu muốn hủy dịch vụ hãy đổi trạng thái hoặc xóa.",
      );
    }
    const newTotal = Math.round(unitPrice * newQty);

    await bookingModel.updateBookingServiceCharge(
      serviceChargeId,
      payload,
      connection,
    );
    const payment = await paymentService.recalculatePaymentForBooking(
      bookingId,
      connection,
    );

    await logHistory(
      bookingId,
      "service_updated",
      `Sửa dịch vụ ${oldCharge.serviceName || "(dịch vụ)"}: x${oldQty} → x${newQty}`,
      {
        oldValue: {
          quantity: oldQty,
          totalPrice: oldTotal,
          serviceName: oldCharge.serviceName,
          unitPrice,
        },
        newValue: { quantity: newQty, totalPrice: newTotal },
      },
      actor,
      connection,
    );

    await connection.commit();
    return {
      booking: await bookingModel.getBookingById(bookingId),
      charge: await bookingModel.getBookingServiceChargeById(serviceChargeId),
      payment,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateServiceChargeStatus = async (
  bookingId,
  serviceChargeId,
  status,
  actor = null,
) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) throw new HttpError(404, "Không tìm thấy đặt phòng");

    const oldCharge = await bookingModel.getBookingServiceChargeById(
      serviceChargeId,
      connection,
    );
    if (!oldCharge) throw new HttpError(404, "Không tìm thấy dòng dịch vụ này");
    if (Number(oldCharge.bookingId) !== Number(bookingId)) {
      throw new HttpError(
        403,
        "Dòng dịch vụ này không thuộc đặt phòng đã chỉ định",
      );
    }

    await bookingModel.updateBookingServiceStatus(
      serviceChargeId,
      status,
      connection,
    );
    const payment = await paymentService.recalculatePaymentForBooking(
      bookingId,
      connection,
    );

    await logHistory(
      bookingId,
      "service_status_updated",
      `Đổi trạng thái dịch vụ ${oldCharge.serviceName || "(dịch vụ)"}: ${oldCharge.status} → ${status}`,
      {
        oldValue: { status: oldCharge.status },
        newValue: { status },
      },
      actor,
      connection,
    );

    await connection.commit();
    return {
      booking: await bookingModel.getBookingById(bookingId),
      charge: await bookingModel.getBookingServiceChargeById(serviceChargeId),
      payment,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteServiceCharge = async (
  bookingId,
  serviceChargeId,
  actor = null,
) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) throw new HttpError(404, "Không tìm thấy đặt phòng");

    const charge = await bookingModel.getBookingServiceChargeById(
      serviceChargeId,
      connection,
    );
    if (!charge) throw new HttpError(404, "Không tìm thấy dòng dịch vụ này");
    if (Number(charge.bookingId) !== Number(bookingId)) {
      throw new HttpError(
        403,
        "Dòng dịch vụ này không thuộc đặt phòng đã chỉ định",
      );
    }

    await bookingModel.deleteBookingServiceCharge(serviceChargeId, connection);
    const payment = await paymentService.recalculatePaymentForBooking(
      bookingId,
      connection,
    );

    await logHistory(
      bookingId,
      "service_removed",
      `Đã hủy dịch vụ ${charge.serviceName || "(dịch vụ)"} (x${charge.quantity})`,
      {
        oldValue: {
          id: serviceChargeId,
          serviceName: charge.serviceName,
          quantity: Number(charge.quantity),
          unitPrice: Number(charge.unitPrice || 0),
          status: charge.status,
        },
      },
      actor,
      connection,
    );

    await connection.commit();
    return {
      booking: await bookingModel.getBookingById(bookingId),
      removed: { id: serviceChargeId },
      payment,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getDamageCharges = async (bookingId) => {
  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) throw new HttpError(404, "Không tìm thấy đặt phòng");
  return bookingModel.getDamageChargesByBookingId(bookingId);
};

const addDamageCharge = async (bookingId, payload, actor = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) {
      throw new HttpError(404, "Không tìm thấy đặt phòng");
    }

    if (!["pending", "confirmed", "checked_in"].includes(booking.status)) {
      throw new HttpError(
        409,
        `Không thể thêm khoản phí khi đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`,
      );
    }

    const targetRoomId = payload.roomId || booking.room_id;
    if (targetRoomId) {
      const isValidRoom = await bookingModel.validateRoomInBooking(
        bookingId,
        targetRoomId,
        connection,
      );
      if (!isValidRoom) {
        throw new HttpError(400, "Phòng không thuộc đặt phòng này");
      }
    }

    const damage = await bookingModel.addDamageCharge(
      bookingId,
      targetRoomId,
      payload,
      connection,
    );
    const payment = await paymentService.recalculatePaymentForBooking(
      bookingId,
      connection,
    );

    await logHistory(
      bookingId,
      "damage_added",
      `Ghi nhận khoản phí/hư hỏng: ${payload.itemName} x${payload.quantity} = ${displayMoney(damage.totalPrice)}${payload.note ? ` (${payload.note})` : ""}`,
      {
        newValue: {
          itemName: payload.itemName,
          quantity: payload.quantity,
          unitPrice: payload.unitPrice,
          chargeType: payload.chargeType || 'damage',
          status: payload.status || 'used',
        },
        amount: damage.totalPrice,
      },
      actor,
      connection,
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

const updateDamageCharge = async (
  bookingId,
  chargeId,
  payload,
  actor = null,
) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) throw new HttpError(404, "Không tìm thấy đặt phòng");

    const current = await bookingModel.getDamageChargeById(
      chargeId,
      connection,
    );
    if (!current) throw new HttpError(404, "Không tìm thấy khoản phí này");
    if (Number(current.bookingId) !== Number(bookingId)) {
      throw new HttpError(
        403,
        "Khoản phí này không thuộc đặt phòng đã chỉ định",
      );
    }

    if (payload.roomId) {
      const isValidRoom = await bookingModel.validateRoomInBooking(
        bookingId,
        payload.roomId,
        connection,
      );
      if (!isValidRoom) {
        throw new HttpError(400, "Phòng không thuộc đặt phòng này");
      }
    }

    await bookingModel.updateDamageCharge(chargeId, payload, connection);
    const payment = await paymentService.recalculatePaymentForBooking(
      bookingId,
      connection,
    );

    await logHistory(
      bookingId,
      "damage_updated",
      `Sửa khoản phí/hư hỏng: ${current.itemName}`,
      {
        oldValue: current,
        newValue: payload,
      },
      actor,
      connection,
    );

    await connection.commit();
    return {
      booking: await bookingModel.getBookingById(bookingId),
      charge: await bookingModel.getDamageChargeById(chargeId),
      payment,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateDamageChargeStatus = async (
  bookingId,
  chargeId,
  status,
  actor = null,
) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) throw new HttpError(404, "Không tìm thấy đặt phòng");

    const current = await bookingModel.getDamageChargeById(
      chargeId,
      connection,
    );
    if (!current) throw new HttpError(404, "Không tìm thấy khoản phí này");
    if (Number(current.bookingId) !== Number(bookingId)) {
      throw new HttpError(
        403,
        "Khoản phí này không thuộc đặt phòng đã chỉ định",
      );
    }

    await bookingModel.updateDamageChargeStatus(chargeId, status, connection);
    const payment = await paymentService.recalculatePaymentForBooking(
      bookingId,
      connection,
    );

    await logHistory(
      bookingId,
      "damage_status_updated",
      `Đổi trạng thái khoản phí ${current.itemName}: ${current.status} → ${status}`,
      {
        oldValue: { status: current.status },
        newValue: { status },
      },
      actor,
      connection,
    );

    await connection.commit();
    return {
      booking: await bookingModel.getBookingById(bookingId),
      charge: await bookingModel.getDamageChargeById(chargeId),
      payment,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteDamageCharge = async (
  bookingId,
  chargeId,
  actor = null,
) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) throw new HttpError(404, "Không tìm thấy đặt phòng");

    const current = await bookingModel.getDamageChargeById(
      chargeId,
      connection,
    );
    if (!current) throw new HttpError(404, "Không tìm thấy khoản phí này");
    if (Number(current.bookingId) !== Number(bookingId)) {
      throw new HttpError(
        403,
        "Khoản phí này không thuộc đặt phòng đã chỉ định",
      );
    }

    await bookingModel.deleteDamageCharge(chargeId, connection);
    const payment = await paymentService.recalculatePaymentForBooking(
      bookingId,
      connection,
    );

    await logHistory(
      bookingId,
      "damage_removed",
      `Hủy khoản phí ${current.itemName}`,
      {
        oldValue: current,
      },
      actor,
      connection,
    );

    await connection.commit();
    return {
      booking: await bookingModel.getBookingById(bookingId),
      removed: { id: chargeId },
      payment,
    };
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

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) {
      throw new HttpError(404, "Không tìm thấy đặt phòng");
    }

    if (!["confirmed", "checked_in"].includes(booking.status)) {
      throw new HttpError(
        409,
        `Không thể gia hạn đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`,
      );
    }

    const currentCheckOut = dayString(booking.check_out);
    if (dateToUtc(payload.checkOut) <= dateToUtc(currentCheckOut)) {
      throw new HttpError(
        400,
        "Ngày trả phòng mới phải sau ngày trả phòng hiện tại",
      );
    }

    // Lấy tất cả roomId thuộc booking từ booking_details (multi-room source of truth).
    const [bdRoomRows] = await connection.query(
      'SELECT DISTINCT roomId FROM booking_details WHERE bookingId = ? AND roomId IS NOT NULL',
      [bookingId]
    );
    const allRoomIds = bdRoomRows.length > 0
      ? bdRoomRows.map((r) => r.roomId)
      : (booking.room_id ? [booking.room_id] : []);

    const firstRoomId = allRoomIds[0] || booking.room_id;
    const currentRoom = await bookingModel.getRoomWithType(
      firstRoomId,
      connection,
    );

    let conflicts = [];
    for (const rid of allRoomIds) {
      const roomConflicts = await bookingModel.getConflictingBookings(
        rid,
        currentCheckOut,
        payload.checkOut,
        connection,
        true,
        { excludeBookingId: bookingId },
      );
      if (roomConflicts.length > 0) {
        conflicts.push(...roomConflicts);
      }
    }

    if (conflicts.length > 0) {
      // Trước khi chặn hẳn: với từng đặt phòng đang xung đột, tìm phòng cùng
      // loại còn trống trong đúng khoảng ngày của họ, để admin có thể chủ
      // động chuyển khách đó sang thay vì phải từ chối gia hạn của khách hiện tại.
      const conflictDetails = [];
      for (const conflict of conflicts) {
        const altRooms = currentRoom
          ? (
              await bookingModel.listAvailableRoomsByType(
                currentRoom.roomTypeId,
                conflict.checkInDate,
                conflict.checkOutDate,
                connection,
              )
            ).filter((room) => !allRoomIds.map(Number).includes(Number(room.id)))
          : [];

        conflictDetails.push({
          bookingId: conflict.id,
          checkIn: dayString(conflict.checkInDate),
          checkOut: dayString(conflict.checkOutDate),
          suggestedRooms: altRooms.map((room) => ({
            id: room.id,
            roomNumber: room.roomNumber,
            pricePerNight: Number(room.price_per_night),
          })),
        });
      }

      const totalSuggestions = conflictDetails.reduce(
        (sum, item) => sum + item.suggestedRooms.length,
        0,
      );

      await bookingModel.notifyStaffAndAdmins(
        `Xung đột gia hạn đặt phòng #${bookingId}`,
        `Khách muốn gia hạn đến ${displayDate(payload.checkOut)}, nhưng phòng đã có ${conflicts.length} đặt phòng khác (${conflicts.map((c) => `#${c.id}`).join(", ")}) trong khoảng thời gian này.` +
          (totalSuggestions > 0
            ? ` Có ${totalSuggestions} phòng cùng loại còn trống có thể chuyển cho (các) khách đó — vào chi tiết đặt phòng tương ứng để xử lý.`
            : ` Hiện không còn phòng cùng loại trống để chuyển, cần xử lý thủ công.`),
      );

      throw new HttpError(
        409,
        "Không thể gia hạn vì phòng đã có khách khác đặt sau ngày trả hiện tại. Đã gửi cảnh báo cho quản trị viên kèm gợi ý phòng thay thế (nếu có).",
        {
          conflictingBookingIds: conflicts.map((item) => item.id),
          conflicts: conflictDetails,
        },
      );
    }

    // Lấy tất cả booking_details thuộc booking (multi-room-type financial source of truth).
    const [bdRows] = await connection.query(
      `SELECT bd.id, bd.bookingId, bd.roomId, bd.roomTypeId, bd.roomPrice,
              r.price_per_night, rt.defaultPrice
       FROM booking_details bd
       LEFT JOIN rooms r ON bd.roomId = r.id
       LEFT JOIN room_types rt ON bd.roomTypeId = rt.id
       WHERE bd.bookingId = ?`,
      [bookingId]
    );

    let totalAddedRoomStay = 0;
    let addedNights = 0;
    const allAddedNightlyPrices = [];

    if (bdRows.length > 0) {
      for (const bd of bdRows) {
        const detailPrice = Number(bd.roomPrice || bd.price_per_night || bd.defaultPrice || booking.room_price || 0);
        const detailNightly = await calcNightlyPrices(
          bd.roomTypeId || currentRoom?.roomTypeId || 1,
          detailPrice,
          currentCheckOut,
          payload.checkOut,
          connection,
        );
        totalAddedRoomStay += detailNightly.total;
        addedNights = detailNightly.nights;
        allAddedNightlyPrices.push(...detailNightly.prices);
      }
    } else {
      const fallbackPrice = Number(booking.room_price || currentRoom?.price_per_night || 0);
      const addedNightly = await calcNightlyPrices(
        currentRoom?.roomTypeId || 1,
        fallbackPrice,
        currentCheckOut,
        payload.checkOut,
        connection,
      );
      const roomCount = allRoomIds.length || 1;
      totalAddedRoomStay = addedNightly.total * roomCount;
      addedNights = addedNightly.nights;
      allAddedNightlyPrices.push(...addedNightly.prices);
    }

    // Phụ thu trẻ em tính theo từng đêm nên các đêm gia hạn cũng phải chịu phụ
    // thu. Số trẻ chịu phí không được lưu riêng, nên suy ra phụ thu mỗi đêm từ
    // tổng phụ thu đã chốt lúc đặt chia cho số đêm ban đầu.
    const originalNights = getNightCount(
      dayString(booking.check_in),
      currentCheckOut,
    );
    const currentSurcharge = Number(booking.occupancy_surcharge || 0);
    const surchargePerNight =
      originalNights > 0 ? currentSurcharge / originalNights : 0;
    const addedSurcharge = Math.round(surchargePerNight * addedNights);
    const newSurcharge = currentSurcharge + addedSurcharge;

    const addedAmount = totalAddedRoomStay + addedSurcharge;
    const newTotalPrice = Number(booking.total_price || 0) + addedAmount;

    await bookingModel.saveNightlyPrices(
      bookingId,
      allAddedNightlyPrices,
      connection,
    );
    await bookingModel.updateBookingStay(
      bookingId,
      payload.checkOut,
      newTotalPrice,
      connection,
      newSurcharge,
    );
    const payment = await paymentService.recalculatePaymentForBooking(
      bookingId,
      connection,
    );

    await logHistory(
      bookingId,
      "extended",
      `Gia hạn ngày ở: trả phòng từ ${displayDate(currentCheckOut)} chuyển thành ${displayDate(payload.checkOut)} (+${addedNights} đêm, +${displayMoney(addedAmount)}${addedSurcharge > 0 ? ` gồm phụ thu khách ${displayMoney(addedSurcharge)}` : ""})`,
      {
        oldValue: {
          checkOut: currentCheckOut,
          totalPrice: Number(booking.total_price || 0),
        },
        newValue: {
          checkOut: dayString(payload.checkOut),
          totalPrice: newTotalPrice,
          addedNights,
          addedSurcharge,
        },
        amount: addedAmount,
      },
      actor,
      connection,
    );

    await connection.commit();
    return {
      booking: await bookingModel.getBookingById(bookingId),
      addedNights,
      addedAmount,
      addedSurcharge,
      payment,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateStay = async (bookingId, payload, actor = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) {
      throw new HttpError(404, "Không tìm thấy đặt phòng");
    }

    // Chỉ cho phép cập nhật khi booking chưa check-in (pending/confirmed)
    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new HttpError(
        409,
        `Không thể cập nhật thời gian ở khi đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}. Hãy dùng API chuyển phòng / gia hạn thay thế.`,
      );
    }

    const oldCheckIn = dayString(booking.check_in);
    const oldCheckOut = dayString(booking.check_out);
    const newCheckIn = dayString(payload.checkIn);
    const newCheckOut = dayString(payload.checkOut);
    const newRoomTypeId =
      payload.roomTypeId != null ? Number(payload.roomTypeId) : null;

    const today = dayString(new Date());
    if (newCheckIn < today) {
      throw new HttpError(
        400,
        "Ngày nhận phòng mới không được sớm hơn hôm nay",
      );
    }

    // Query thủ công để lấy loại phòng hiện tại (BOOKING_SELECT không alias room_type_id)
    const oldRoomInfo = booking.room_id
      ? await bookingModel.getRoomWithType(booking.room_id, connection, false)
      : null;
    const oldRoomTypeId = oldRoomInfo ? Number(oldRoomInfo.roomTypeId) : null;
    const targetRoomTypeId = newRoomTypeId ?? oldRoomTypeId;
    if (!targetRoomTypeId) {
      throw new HttpError(400, "Không xác định được hạng phòng để cập nhật");
    }

    const availableRooms = await bookingModel.listAvailableRoomsByType(
      targetRoomTypeId,
      newCheckIn,
      newCheckOut,
      connection,
      true,
    );
    const conflictingExcludingSelf = (
      await bookingModel.getConflictingBookings(
        booking.room_id,
        newCheckIn,
        newCheckOut,
        connection,
        true,
        { excludeBookingId: bookingId },
      )
    ).length;

    let targetRoom = null;
    if (newRoomTypeId != null && newRoomTypeId !== oldRoomTypeId) {
      if (!Array.isArray(availableRooms) || availableRooms.length === 0) {
        throw new HttpError(
          409,
          "Không còn phòng trống thuộc hạng phòng này cho khoảng thời gian bạn chọn",
        );
      }
      targetRoom = availableRooms[0];
    } else {
      const keepOldRoom = conflictingExcludingSelf === 0 && booking.room_id;
      if (keepOldRoom) {
        targetRoom = await bookingModel.getRoomWithType(
          booking.room_id,
          connection,
          true,
        );
      } else if (Array.isArray(availableRooms) && availableRooms.length > 0) {
        targetRoom = availableRooms[0];
      } else {
        throw new HttpError(
          409,
          "Không còn phòng trống (kể cả phòng cũ) cho khoảng thời gian bạn chọn",
        );
      }
    }

    if (!targetRoom) {
      throw new HttpError(
        409,
        "Không xác định được phòng phù hợp để cập nhật",
      );
    }

    const targetRoomType = await (async () => {
      try {
        const [[row]] = await (connection || db).query(
          "SELECT id, typeName, capacity, defaultPrice, status, description FROM room_types WHERE id = ? LIMIT 1",
          [targetRoomTypeId],
        );
        return row || null;
      } catch {
        return null;
      }
    })();
    const basePricePerNight =
      Number(booking.room_price || 0) > 0
        ? booking.room_price
        : Number(
            targetRoom.price_per_night || targetRoomType?.defaultPrice || 0,
          );

    // Tính lại giá theo từng đêm (theo roomTypeId mới) cho toàn bộ khoảng thời gian mới
    const nightly = await calcNightlyPrices(
      targetRoomTypeId,
      basePricePerNight,
      newCheckIn,
      newCheckOut,
      connection,
    );
    const newNights = nightly.nights;
    const newStayAmount = nightly.total;

    // Tính lại phụ thu trẻ em: giữ nguyên phụ thu/đêm cũ, nhân với số đêm mới
    const originalNights = getNightCount(oldCheckIn, oldCheckOut);
    const currentSurcharge = Number(booking.occupancy_surcharge || 0);
    const surchargePerNight =
      originalNights > 0 ? currentSurcharge / originalNights : 0;
    const newSurcharge = Math.round(surchargePerNight * newNights);

    const newTotalPrice = newStayAmount + newSurcharge;

    // Xóa nightly prices cũ, lưu mới lại cho toàn bộ khoảng thời gian mới
    await (connection || db).query(
      "DELETE FROM booking_nightly_prices WHERE bookingId = ?",
      [bookingId],
    );
    await bookingModel.saveNightlyPrices(
      bookingId,
      nightly.prices,
      connection,
    );

    // Dùng helper đã viết theo đúng pattern run(connection).query + schema thật
    await bookingModel.updateBookingStayFull(
      bookingId,
      {
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        roomId: targetRoom.id,
        totalPrice: newTotalPrice,
        roomPrice: basePricePerNight,
        occupancySurcharge: newSurcharge,
      },
      connection,
    );

    const payment = await paymentService.recalculatePaymentForBooking(
      bookingId,
      connection,
    );

    const diffLines = [];
    if (oldCheckIn !== newCheckIn)
      diffLines.push(
        `nhận ${displayDate(oldCheckIn)} → ${displayDate(newCheckIn)}`,
      );
    if (oldCheckOut !== newCheckOut)
      diffLines.push(
        `trả ${displayDate(oldCheckOut)} → ${displayDate(newCheckOut)}`,
      );
    if (oldRoomTypeId !== Number(targetRoomTypeId)) {
      diffLines.push(
        `hạng phòng → ${targetRoomType?.typeName || targetRoomTypeId}`,
      );
    }
    if (Number(booking.room_id) !== Number(targetRoom.id)) {
      diffLines.push(
        `phòng ${booking.room_number} → ${targetRoom.roomNumber}`,
      );
    }
    const diffStr = diffLines.length
      ? diffLines.join(", ")
      : "Cập nhật thời gian ở";
    const diffTotal = newTotalPrice - Number(booking.total_price || 0);

    await logHistory(
      bookingId,
      "stay_updated",
      `Cập nhật đặt phòng: ${diffStr} (tổng tiền phòng ${diffTotal >= 0 ? "tăng" : "giảm"} ${displayMoney(Math.abs(diffTotal))})`,
      {
        oldValue: {
          checkIn: oldCheckIn,
          checkOut: oldCheckOut,
          roomId: booking.room_id,
          totalPrice: Number(booking.total_price || 0),
        },
        newValue: {
          checkIn: newCheckIn,
          checkOut: newCheckOut,
          roomTypeId: targetRoomTypeId,
          roomId: targetRoom.id,
          nights: newNights,
          totalPrice: newTotalPrice,
          occupancySurcharge: newSurcharge,
        },
        amount: diffTotal,
      },
      actor,
      connection,
    );

    await connection.commit();
    return {
      booking: await bookingModel.getBookingById(bookingId),
      nights: newNights,
      roomType: targetRoomType,
      room: targetRoom,
      stayAmount: newStayAmount,
      occupancySurcharge: newSurcharge,
      totalPrice: newTotalPrice,
      deltaTotal: diffTotal,
      payment,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const reassignConflictingBooking = async (bookingId, payload, actor = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) {
      throw new HttpError(404, "Không tìm thấy đặt phòng");
    }

    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new HttpError(
        409,
        `Chỉ có thể đổi phòng cho đặt phòng chưa nhận phòng (hiện đang ở trạng thái ${bookingStatusLabel(booking.status)})`,
      );
    }

    const newRoom = await bookingModel.getRoomWithType(
      payload.roomId,
      connection,
      true,
    );
    if (!newRoom) {
      throw new HttpError(404, "Không tìm thấy phòng muốn chuyển đến");
    }
    if (newRoom.status === "maintenance") {
      throw new HttpError(409, "Phòng muốn chuyển đến đang được bảo trì");
    }

    const currentRoom = await bookingModel.getRoomWithType(
      booking.room_id,
      connection,
    );
    if (
      currentRoom &&
      Number(newRoom.roomTypeId) !== Number(currentRoom.roomTypeId)
    ) {
      throw new HttpError(
        400,
        "Chỉ được chuyển sang phòng cùng loại để giữ đúng giá đã chốt với khách",
      );
    }

    const conflicts = await bookingModel.getConflictingBookings(
      newRoom.id,
      booking.check_in,
      booking.check_out,
      connection,
      true,
      { excludeBookingId: bookingId },
    );
    if (conflicts.length > 0) {
      throw new HttpError(
        409,
        "Phòng muốn chuyển đến không còn trống trong khoảng ngày của đặt phòng này",
        {
          conflictingBookingIds: conflicts.map((item) => item.id),
        },
      );
    }

    await bookingModel.reassignRoomForBooking(
      bookingId,
      newRoom.id,
      connection,
    );

    await logHistory(
      bookingId,
      "room_reassigned",
      `Đổi phòng từ ${currentRoom?.roomNumber || booking.room_id} sang ${newRoom.roomNumber} (đặt phòng chưa nhận phòng — xử lý do xung đột lịch với yêu cầu gia hạn của phòng cũ)`,
      {
        oldValue: {
          roomId: booking.room_id,
          roomNumber: currentRoom?.roomNumber,
        },
        newValue: { roomId: newRoom.id, roomNumber: newRoom.roomNumber },
      },
      actor,
      connection,
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

const transferRoom = async (bookingId, payload, actor = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) {
      throw new HttpError(404, "Không tìm thấy đặt phòng");
    }

    if (booking.status !== "checked_in") {
      throw new HttpError(
        409,
        `Không thể chuyển phòng khi đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`,
      );
    }

    const toRoom = await bookingModel.getRoomWithType(
      payload.toRoomId,
      connection,
      true,
    );
    if (!toRoom) {
      throw new HttpError(404, "Không tìm thấy phòng muốn chuyển đến");
    }

    if (toRoom.status === "maintenance") {
      throw new HttpError(409, "Phòng muốn chuyển đến đang được bảo trì");
    }

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
      { excludeBookingId: bookingId },
    );

    if (conflicts.length > 0) {
      throw new HttpError(
        409,
        "Phòng chuyển đến không còn trống trong giai đoạn này",
        {
          conflictingBookingIds: conflicts.map((item) => item.id),
        },
      );
    }

    const fromRoomId = payload.fromRoomId || payload.roomId || booking.room_id;
    const fromRoom = await bookingModel.getRoomWithType(
      fromRoomId,
      connection,
    );

    await bookingModel.transferBookingRoom(
      booking,
      toRoom,
      payload,
      connection,
    );
    if (fromRoomId) {
      await bookingModel.updateRoomStatus(
        fromRoomId,
        "available",
        connection,
      );
    }
    await bookingModel.updateRoomStatus(toRoom.id, "occupied", connection);

    const lockedOldNights = await bookingModel.listNightlyPrices(
      bookingId,
      stayStart,
      splitDate,
      connection,
    );
    const oldStage =
      lockedOldNights.length > 0
        ? {
            nights: lockedOldNights.length,
            total: lockedOldNights.reduce(
              (sum, night) => sum + Number(night.price),
              0,
            ),
          }
        : await calcNightlyPrices(
            fromRoom?.roomTypeId,
            booking.room_price || fromRoom?.price_per_night || 0,
            stayStart,
            splitDate,
            connection,
          );
    const newStage = await calcNightlyPrices(
      toRoom.roomTypeId,
      toRoom.price_per_night,
      splitDate,
      stayEnd,
      connection,
    );
    const occupancySurcharge = Number(booking.occupancy_surcharge || 0);
    const newTotalPrice = oldStage.total + newStage.total + occupancySurcharge;

    await bookingModel.saveNightlyPrices(
      bookingId,
      newStage.prices,
      connection,
    );

    await bookingModel.updateBookingStay(
      bookingId,
      stayEnd,
      newTotalPrice,
      connection,
    );
    const payment = await paymentService.recalculatePaymentForBooking(
      bookingId,
      connection,
    );

    await logHistory(
      bookingId,
      "room_transferred",
      `Chuyển phòng từ ${fromRoom?.roomNumber || booking.room_id} sang ${toRoom.roomNumber} kể từ ngày ${displayDate(splitDate)}${payload.reason ? `. Lý do: ${payload.reason}` : ""}. Tổng tiền phòng mới: ${displayMoney(newTotalPrice)}`,
      {
        oldValue: {
          roomId: booking.room_id,
          roomNumber: fromRoom?.roomNumber,
          totalPrice: Number(booking.total_price || 0),
        },
        newValue: {
          roomId: toRoom.id,
          roomNumber: toRoom.roomNumber,
          fromDate: dayString(splitDate),
          totalPrice: newTotalPrice,
        },
      },
      actor,
      connection,
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
          amount: oldStage.total,
        },
        newRoom: {
          roomNumber: toRoom.roomNumber,
          from: splitDate,
          to: stayEnd,
          nights: newStage.nights,
          amount: newStage.total,
        },
        totalPrice: newTotalPrice,
      },
      payment,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
const CHECK_IN_TIMING_LABEL = {
  early: "check-in sớm",
  on_time: "check-in đúng giờ",
  late: "check-in muộn (miễn phí)",
};

const checkIn = async (bookingId, payload = {}, actor = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) {
      throw new HttpError(404, "Không tìm thấy đặt phòng");
    }

    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new HttpError(
        409,
        `Không thể nhận phòng khi đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`,
      );
    }

    const tiers = await bookingModel.getCheckoutLateFeeTiers(connection);

    const payment = await paymentService.getPaymentByBookingId(bookingId, connection);
    if (!payment || Number(payment.paidAmount || 0) <= 0) {
      throw new HttpError(409, "Vui lòng thanh toán trước khi check-in");
    }
    if (payment.remainingAmount > 0 || payment.paymentStatus !== "paid") {
      throw new HttpError(
        409,
        "Vui lòng thanh toán đủ số tiền còn lại trước khi check-in",
      );
    }

    const now = new Date();
    if (!isWithinLateCheckInWindow(booking.check_in, booking.requested_check_in_time, now, booking.requested_check_in_day_offset)) {
      const checkInDay = new Date(`${dayString(booking.check_in)}T00:00:00`);
      if (now < checkInDay) {
        throw new HttpError(409, "Chưa đến ngày nhận phòng");
      }
      throw new HttpError(
        409,
        `Đã quá thời gian check-in muộn (trước ${LATE_CHECKIN_GRACE_HOUR}:00 ngày hôm sau). Vui lòng liên hệ lễ tân.`,
      );
    }

    const standardCheckIn = combineDateTime(
      booking.check_in,
      tiers.standardCheckInTime,
    );
    const checkInTiming =
      now < standardCheckIn
        ? "early"
        : now > standardCheckIn
          ? "late"
          : "on_time";

    // Lấy tất cả roomId thuộc booking từ booking_details (multi-room source of truth).
    // Fallback về scalar booking.room_id cho booking legacy không có booking_details.
    const [bdRoomRows] = await connection.query(
      'SELECT DISTINCT roomId FROM booking_details WHERE bookingId = ? AND roomId IS NOT NULL',
      [bookingId]
    );
    const allRoomIds = bdRoomRows.length > 0
      ? bdRoomRows.map((r) => r.roomId)
      : (booking.room_id ? [booking.room_id] : []);

    if (allRoomIds.length > 0) {
      const [maintenanceRooms] = await connection.query(
        `SELECT roomNumber FROM rooms WHERE id IN (${allRoomIds.map(() => '?').join(',')}) AND status = 'maintenance'`,
        allRoomIds
      );
      if (maintenanceRooms.length > 0) {
        const roomNums = maintenanceRooms.map((r) => r.roomNumber).filter(Boolean).join(', ');
        throw new HttpError(
          409,
          `Phòng ${roomNums ? `${roomNums} ` : ''}đang được dọn dẹp/bảo trì nên chưa thể nhận phòng. Vui lòng liên hệ lễ tân để được xếp phòng khác hoặc chờ dọn xong.`,
        );
      }

      for (const rid of allRoomIds) {
        const activeOccupant = await bookingModel.findActiveCheckedInBooking(
          rid,
          bookingId,
          connection,
        );
        if (activeOccupant) {
          throw new HttpError(
            409,
            `Phòng hiện đang có khách khác lưu trú (đặt phòng #${activeOccupant.id}) chưa trả phòng. Vui lòng liên hệ lễ tân để xử lý trước khi nhận phòng mới.`,
          );
        }
      }
    }

    if (Array.isArray(payload.guests) && payload.guests.length > 0) {
      await bookingModel.replaceBookingGuests(
        bookingId,
        payload.guests,
        connection,
      );
    }

    await bookingModel.updateBookingStatus(bookingId, "checked_in", connection);
    if (allRoomIds.length > 0) {
      await connection.query(
        `UPDATE rooms SET status = 'occupied' WHERE id IN (${allRoomIds.map(() => '?').join(',')})`,
        allRoomIds,
      );
    }
    await bookingModel.updateActualCheckInTime(bookingId, now, connection);

    const wasLate = checkInTiming === "late";
    const timingLabel = CHECK_IN_TIMING_LABEL[checkInTiming];
    await logHistory(
      bookingId,
      "checked_in",
      `Khách nhận phòng (${timingLabel})${Array.isArray(payload.guests) && payload.guests.length > 0 ? `. Khách lưu trú: ${payload.guests.map((g) => g.fullName).join(", ")}` : ""}`,
      {
        oldValue: { status: booking.status },
        newValue: { status: "checked_in", checkInTiming, lateCheckIn: wasLate },
      },
      actor,
      connection,
    );

    await connection.commit();

    const updatedBooking = await bookingModel.getBookingById(bookingId);
    return {
      ...updatedBooking,
      checkInTiming,
      lateCheckIn: wasLate,
      message:
        checkInTiming === "early"
          ? "Check-in sớm thành công. Phòng đã sẵn sàng đón khách."
          : checkInTiming === "late"
            ? "Check-in muộn thành công. Phòng vẫn được giữ theo cam kết vì khách đã thanh toán."
            : "Check-in thành công",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const markNoShow = async (
  bookingId,
  {
    allowBeforeDeadline = false,
    connection: externalConnection,
    actor = null,
  } = {},
) => {
  const ownsConnection = !externalConnection;
  const connection = externalConnection || (await db.getConnection());

  try {
    if (ownsConnection) {
      await connection.beginTransaction();
    }

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) {
      throw new HttpError(404, "Không tìm thấy đặt phòng");
    }

    if (booking.status === "no_show") {
      throw new HttpError(409, "Đặt phòng đã được đánh dấu khách không đến");
    }

    if (!["confirmed", "pending"].includes(booking.status)) {
      throw new HttpError(
        409,
        `Không thể đánh dấu khách không đến khi đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`,
      );
    }

    const paymentRow = await paymentService.getPaymentByBookingId(bookingId);
    if (!paymentRow || Number(paymentRow.paidAmount || 0) <= 0) {
      throw new HttpError(
        409,
        "Chỉ có thể đánh dấu khách không đến đối với đặt phòng đã thanh toán",
      );
    }

    if (!allowBeforeDeadline && !isPastNoShowDeadline(booking.check_in, booking.requested_check_in_time, new Date(), booking.requested_check_in_day_offset)) {
      const deadline = getLateCheckInDeadline(booking.check_in, booking.requested_check_in_time, LATE_CHECKIN_GRACE_HOUR, booking.requested_check_in_day_offset);
      throw new HttpError(
        409,
        `Chưa đến thời điểm xử lý no-show. Hệ thống sẽ tự động xử lý sau ${deadline.toLocaleString("vi-VN")}`,
      );
    }

    await bookingModel.updateBookingStatus(bookingId, "no_show", connection);
    await bookingModel.updateRoomStatus(
      booking.room_id,
      "available",
      connection,
    );

    const voucher = await voucherService.createNoShowCompensationVoucher(
      booking.user_id,
      bookingId,
      connection,
    );

    await logHistory(
      bookingId,
      "no_show",
      `Đánh dấu khách không đến (no-show). Không hoàn tiền theo chính sách, tặng voucher ${voucher.code} giảm ${Number(voucher.discountPercentage)}% cho lần đặt sau`,
      {
        oldValue: { status: booking.status },
        newValue: { status: "no_show", voucherCode: voucher.code },
      },
      actor,
      connection,
    );

    if (ownsConnection) {
      await connection.commit();
    }

    return {
      booking: await bookingModel.getBookingById(
        bookingId,
        ownsConnection ? undefined : connection,
      ),
      voucher: {
        code: voucher.code,
        discountPercentage: Number(voucher.discountPercentage),
        validFrom: voucher.validFrom,
        validUntil: voucher.validUntil,
        message: `Đã tặng voucher giảm ${voucherService.NO_SHOW_DISCOUNT_PERCENT}% cho lần đặt phòng tiếp theo`,
      },
      refundPolicy: {
        refunded: false,
        message: "Không hoàn tiền theo chính sách no-show",
      },
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

const processOverdueCheckIns = async () => {
  const connection = await db.getConnection();
  const results = [];
  const now = new Date();

  try {
    await connection.beginTransaction();
    const candidates = await bookingModel.getOverdueCheckInCandidates(connection);

    for (const candidate of candidates) {
      if (candidate.actual_check_in_time) {
        continue;
      }

      const checkInDate = candidate.check_in;
      const requestedCheckInTime = candidate.requested_check_in_time || '14:00:00';
      const requestedCheckInDayOffset = Number(candidate.requested_check_in_day_offset || 0);
      const checkOutDate = candidate.check_out;
      const requestedCheckOutTime = candidate.requested_check_out_time || '12:00:00';

      const lateCheckInDeadline = getLateCheckInDeadline(checkInDate, requestedCheckInTime, 6, requestedCheckInDayOffset);
      const checkOutDeadline = getCheckOutDeadline(checkOutDate, requestedCheckOutTime);

      const totalAmount = Number(candidate.payment_total_amount || candidate.total_amount || 0);
      const paidAmount = Number(candidate.paid_amount || 0);
      const remainingAmount = Number(candidate.remaining_amount || 0);
      const paymentStatus = candidate.payment_status;

      const isFullyPaid =
        paymentStatus === 'paid' ||
        (remainingAmount <= 0 && paidAmount > 0) ||
        (totalAmount > 0 && paidAmount / totalAmount >= 0.999);

      if (isFullyPaid) {
        if (now > checkOutDeadline) {
          await bookingModel.updateBookingStatus(candidate.id, 'no_show', connection);
          if (candidate.room_id) {
            await bookingModel.updateRoomStatus(candidate.room_id, 'available', connection);
          }
          await logHistory(
            candidate.id,
            'no_show',
            'Khách đã thanh toán 100% nhưng không đến trong suốt thời gian đặt phòng (đã qua thời gian checkout). Đặt phòng được chuyển sang No-show.',
            { oldValue: { status: candidate.status }, newValue: { status: 'no_show' } },
            { role: 'system' },
            connection
          );
          results.push({ bookingId: candidate.id, status: 'no_show', reason: '100% paid - past checkout deadline' });
        } else {
          results.push({ bookingId: candidate.id, status: 'held', reason: '100% paid - holding room' });
        }
      } else {
        if (now > lateCheckInDeadline) {
          await bookingModel.updateBookingStatus(candidate.id, 'no_show', connection);
          if (candidate.room_id) {
            await bookingModel.updateRoomStatus(candidate.room_id, 'available', connection);
          }
          await logHistory(
            candidate.id,
            'no_show',
            'Khách không đến trong thời hạn check-in cho phép. Booking được chuyển sang No-show. Tiền cọc không hoàn lại theo chính sách.',
            { oldValue: { status: candidate.status }, newValue: { status: 'no_show' } },
            { role: 'system' },
            connection
          );
          results.push({ bookingId: candidate.id, status: 'no_show', reason: '30% deposit - past check-in deadline' });
        } else {
          results.push({ bookingId: candidate.id, status: 'held', reason: 'Within late check-in window' });
        }
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

const updateBookingRequestedCheckInTime = async (
  bookingId,
  { requestedCheckInTime, requestedCheckInDayOffset, dayOffset, notes },
  actor = null
) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Không tìm thấy đặt phòng');
    }

    if (booking.actual_check_in_time) {
      throw new HttpError(400, 'Đặt phòng đã check-in, không thể cập nhật giờ đến');
    }

    const currentStatus = (booking.status || '').toLowerCase();
    if (['cancelled', 'no_show', 'checked_out'].includes(currentStatus)) {
      throw new HttpError(400, 'Chỉ có thể cập nhật giờ đến khi đặt phòng chưa check-in và chưa bị hủy/No-show');
    }

    let timeStr = requestedCheckInTime;
    let offset = Number(dayOffset !== undefined ? dayOffset : (requestedCheckInDayOffset || 0));

    if (timeStr && String(timeStr).includes('+1')) {
      timeStr = String(timeStr).replace('+1', '');
      offset = 1;
    }

    if (timeStr && timeStr.length === 5) {
      timeStr += ':00';
    }

    await bookingModel.updateRequestedCheckInTime(bookingId, timeStr, offset, connection);

    const offsetText = offset === 1 ? ' (ngày hôm sau)' : '';
    const descNote = notes ? `. Ghi chú: ${notes}` : '';
    await logHistory(
      bookingId,
      'update_arrival_time',
      `Cập nhật giờ check-in dự kiến mới: ${timeStr.slice(0, 5)}${offsetText}${descNote}`,
      {
        oldValue: {
          requestedCheckInTime: booking.requested_check_in_time,
          requestedCheckInDayOffset: booking.requested_check_in_day_offset
        },
        newValue: {
          requestedCheckInTime: timeStr,
          requestedCheckInDayOffset: offset,
          notes
        }
      },
      actor,
      connection
    );

    await connection.commit();
    const updated = await bookingModel.getBookingById(bookingId);
    const deadline = getLateCheckInDeadline(
      updated.check_in,
      updated.requested_check_in_time,
      6,
      updated.requested_check_in_day_offset || 0
    );
    return {
      booking: updated,
      lateCheckInDeadline: deadline
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateBookingRequestedCheckOutTime = async (
  bookingId,
  { requestedCheckOutTime, notes },
  actor = null
) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Không tìm thấy đặt phòng');
    }

    const currentStatus = (booking.status || '').toLowerCase();
    if (currentStatus !== 'checked_in') {
      throw new HttpError(400, 'Chỉ có thể cập nhật giờ trả phòng dự kiến khi đặt phòng đang check-in');
    }

    if (!requestedCheckOutTime) {
      throw new HttpError(400, 'Vui lòng cung cấp giờ trả phòng dự kiến');
    }

    // Normalize HH:MM → HH:MM:SS
    let timeStr = String(requestedCheckOutTime);
    if (timeStr.length === 5) timeStr += ':00';

    // Load policy tiers (standardCheckOutTime, housekeepingBufferMinutes, absoluteMaxLateHours, standardCheckInTime)
    const tiers = await bookingModel.getCheckoutLateFeeTiers(connection);

    const checkOutDay = dayString(booking.check_out);
    const standardCheckOut = combineDateTime(checkOutDay, tiers.standardCheckOutTime);
    const requestedCheckOutDt = combineDateTime(checkOutDay, timeStr);

    // Only run next-booking conflict check when requested time is later than standard checkout
    if (requestedCheckOutDt > standardCheckOut) {
      // Collect all physical rooms for this booking (multi-room safe)
      const [bdRows] = await connection.query(
        'SELECT DISTINCT roomId FROM booking_details WHERE bookingId = ? AND roomId IS NOT NULL',
        [bookingId]
      );
      const allRoomIds = bdRows.length > 0
        ? bdRows.map(r => r.roomId)
        : (booking.room_id ? [booking.room_id] : []);

      // Find the earliest next booking across all rooms (most restrictive constraint)
      let nextBooking = null;
      for (const rid of allRoomIds) {
        const nb = await bookingModel.findNextBookingForRoom(rid, checkOutDay, connection);
        if (nb && (!nextBooking || nb.checkInDate < nextBooking.checkInDate)) {
          nextBooking = nb;
        }
      }

      // Reuse the same cap logic as checkOut()
      const maxAllowed = getMaxLateCheckoutTime(
        standardCheckOut,
        nextBooking?.checkInDate || null,
        tiers
      );

      if (requestedCheckOutDt > maxAllowed) {
        const maxTimeLabel = [
          maxAllowed.getHours().toString().padStart(2, '0'),
          maxAllowed.getMinutes().toString().padStart(2, '0')
        ].join(':');
        throw new HttpError(
          409,
          nextBooking
            ? `Không thể cập nhật giờ trả phòng này vì phòng đã có khách tiếp theo. Giờ trả phòng muộn nhất có thể là ${maxTimeLabel}.`
            : `Đã vượt quá giờ trả phòng muộn tối đa (${maxTimeLabel}). Nếu cần ở thêm, vui lòng liên hệ khách sạn hoặc gia hạn thêm đêm.`
        );
      }
    }

    // Save booking-level requestedCheckOutTime only (not booking_details per task requirement)
    await bookingModel.updateRequestedCheckOutTime(bookingId, timeStr, connection);

    const descNote = notes ? `. Ghi chú: ${notes}` : '';
    await logHistory(
      bookingId,
      'update_departure_time',
      `Cập nhật giờ trả phòng dự kiến mới: ${timeStr.slice(0, 5)}${descNote}`,
      {
        oldValue: { requestedCheckOutTime: booking.requested_check_out_time },
        newValue: { requestedCheckOutTime: timeStr, notes }
      },
      actor,
      connection
    );

    await connection.commit();
    const updated = await bookingModel.getBookingById(bookingId);
    return { booking: updated };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const checkOut = async (bookingId, actualCheckOutTimeInput, actor = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const booking = await bookingModel.getBookingById(
      bookingId,
      connection,
      true,
    );
    if (!booking) {
      throw new HttpError(404, "Không tìm thấy đặt phòng");
    }

    if (booking.status !== "checked_in") {
      throw new HttpError(
        409,
        `Không thể trả phòng khi đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`,
      );
    }

    const actualCheckOutTime = actualCheckOutTimeInput
      ? new Date(actualCheckOutTimeInput)
      : new Date();
    await bookingModel.updateActualCheckOutTime(
      bookingId,
      actualCheckOutTime,
      connection,
    );

    // Lấy tất cả roomId thuộc booking từ booking_details (multi-room source of truth).
    // Fallback về scalar booking.room_id cho booking legacy không có booking_details.
    const [bdRoomRows] = await connection.query(
      'SELECT DISTINCT roomId FROM booking_details WHERE bookingId = ? AND roomId IS NOT NULL',
      [bookingId]
    );
    const allRoomIds = bdRoomRows.length > 0
      ? bdRoomRows.map((r) => r.roomId)
      : (booking.room_id ? [booking.room_id] : []);

    let lateCheckout = null;
    let recalculatedPayment = null;
    const tiers = await bookingModel.getCheckoutLateFeeTiers(connection);
    if (tiers) {
      const standardCheckOut = combineDateTime(
        booking.check_out,
        tiers.standardCheckOutTime,
      );

      if (actualCheckOutTime > standardCheckOut) {
        // Kiểm tra conflict cho TẤT CẢ phòng thuộc booking (multi-room safe).
        // Lấy nextBooking sớm nhất trong tất cả phòng để tính maxCheckoutTime.
        let nextBooking = null;
        for (const rid of allRoomIds) {
          const nb = await bookingModel.findNextBookingForRoom(
            rid,
            dayString(booking.check_out),
            connection,
          );
          if (nb && (!nextBooking || nb.checkInDate < nextBooking.checkInDate)) {
            nextBooking = nb;
          }
        }
        const maxCheckoutTime = getMaxLateCheckoutTime(
          standardCheckOut,
          nextBooking?.checkInDate || null,
          tiers,
        );

        if (actualCheckOutTime > maxCheckoutTime) {
          throw new HttpError(
            409,
            nextBooking
              ? `Không thể trả phòng muộn vì phòng đã có khách khác nhận phòng ngày ${displayDate(nextBooking.checkInDate)}. Vui lòng chuyển phòng cho khách sau hoặc xử lý thủ công.`
              : `Đã vượt quá thời gian trả phòng muộn tối đa (${tiers.absoluteMaxLateHours} giờ so với giờ chuẩn). Vui lòng lập gia hạn thêm đêm thay vì tính phí trễ giờ.`,
            { conflictingBookingId: nextBooking?.id || null },
          );
        }

        // Multi-room-type safe: Tính tổng giá đêm của tất cả booking_details làm nightlyRate cho booking
        const [bdRowsForRate] = await connection.query(
          `SELECT bd.id, bd.roomPrice, r.price_per_night, rt.defaultPrice
           FROM booking_details bd
           LEFT JOIN rooms r ON bd.roomId = r.id
           LEFT JOIN room_types rt ON bd.roomTypeId = rt.id
           WHERE bd.bookingId = ?`,
          [bookingId]
        );

        let totalBookingNightlyRate = 0;
        if (bdRowsForRate.length > 0) {
          totalBookingNightlyRate = bdRowsForRate.reduce((sum, row) => {
            return sum + Number(row.roomPrice || row.price_per_night || row.defaultPrice || 0);
          }, 0);
        }

        const nightlyRate = totalBookingNightlyRate > 0
          ? totalBookingNightlyRate
          : Number(booking.room_price || booking.price_per_night || 0);

        const result = computeLateCheckoutFee(
          tiers,
          standardCheckOut,
          actualCheckOutTime,
          nightlyRate,
        );

        if (result.status === "fee_applied" && result.feeAmount > 0) {
          await bookingModel.addLateCheckoutCharge(
            bookingId,
            {
              lateMinutes: result.lateMinutes,
              tierPercent: result.percent,
              nightlyRate,
              totalPrice: result.feeAmount,
              note: `Trả phòng muộn ${Math.round(result.lateHours * 10) / 10} giờ so với giờ chuẩn`,
            },
            connection,
          );

          recalculatedPayment =
            await paymentService.recalculatePaymentForBooking(
              bookingId,
              connection,
            );
          lateCheckout = { ...result };

          const existingHistory = await bookingModel.listBookingHistory(bookingId, connection);
          const hasIdenticalLateFeeLog = existingHistory.some(
            (h) => h.action === 'late_checkout_fee' && Number(h.amount) === Number(result.feeAmount)
          );

          if (!hasIdenticalLateFeeLog) {
            await logHistory(
              bookingId,
              "late_checkout_fee",
              `Phí trả phòng muộn: trễ ${result.lateMinutes} phút (${result.percent}% giá đêm) = ${displayMoney(result.feeAmount)}`,
              { amount: result.feeAmount },
              actor,
              connection,
            );
          }
        }
      }
    }

    const payment =
      recalculatedPayment ||
      (await paymentService.getPaymentByBookingId(bookingId));
    if (
      !payment ||
      payment.remainingAmount > 0 ||
      payment.paymentStatus !== "paid"
    ) {
      // Fee trả phòng muộn phải được lưu lại để lễ tân thu tiền ở màn hình
      // thanh toán; không rollback cùng lỗi check-out như các khoản nợ cũ.
      if (lateCheckout) {
        await connection.commit();
        return { requiresPayment: true, lateCheckout };
      }
      throw new HttpError(
        409,
        "Vui lòng thanh toán toàn bộ tiền phòng và chi phí phát sinh trước khi check-out",
      );
    }

    await bookingModel.updateBookingStatus(
      bookingId,
      "checked_out",
      connection,
    );
    // Release TẤT CẢ phòng thuộc booking về trạng thái maintenance (multi-room safe).
    if (allRoomIds.length > 0) {
      await connection.query(
        `UPDATE rooms SET status = 'maintenance', maintenanceNote = 'Dọn dẹp sau check-out (Chờ dọn dẹp)', maintenanceExpectedCompletion = NULL WHERE id IN (${allRoomIds.map(() => '?').join(',')})`,
        allRoomIds,
      );
    }

    let earlyCheckout = null;
    const today = dayString(new Date());
    const checkOutDay = dayString(booking.check_out);

    if (today < checkOutDay) {
      // Multi-room-type safe: Lấy tất cả booking_details để tính chính xác unused nightly total
      const [bdRowsForEarly] = await connection.query(
        `SELECT bd.id, bd.bookingId, bd.roomId, bd.roomTypeId, bd.roomPrice,
                r.price_per_night, rt.defaultPrice
         FROM booking_details bd
         LEFT JOIN rooms r ON bd.roomId = r.id
         LEFT JOIN room_types rt ON bd.roomTypeId = rt.id
         WHERE bd.bookingId = ?`,
        [bookingId]
      );

      let totalUnusedRoomStay = 0;
      let unusedNightsCount = 0;

      if (bdRowsForEarly.length > 0) {
        for (const bd of bdRowsForEarly) {
          const detailPrice = Number(bd.roomPrice || bd.price_per_night || bd.defaultPrice || booking.room_price || 0);
          const unusedNightly = await calcNightlyPrices(
            bd.roomTypeId || 1,
            detailPrice,
            today,
            checkOutDay,
            connection,
          );
          totalUnusedRoomStay += unusedNightly.total;
          unusedNightsCount = unusedNightly.nights;
        }
      } else {
        const firstRoomId = allRoomIds[0] || booking.room_id;
        const room = await bookingModel.getRoomWithType(
          firstRoomId,
          connection,
        );
        const unusedNightly = await calcNightlyPrices(
          room?.roomTypeId || 1,
          booking.room_price || room?.price_per_night || 0,
          today,
          checkOutDay,
          connection,
        );
        const roomCount = allRoomIds.length || 1;
        totalUnusedRoomStay = unusedNightly.total * roomCount;
        unusedNightsCount = unusedNightly.nights;
      }

      const refundAmount = Math.min(
        Math.round(totalUnusedRoomStay * 0.5),
        Number(payment.paidAmount || 0),
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
            `Check-out sớm: hoàn 50% của ${unusedNightsCount} đêm chưa ở (${today} → ${checkOutDay})`,
          ],
        );

        earlyCheckout = {
          refundId: result.insertId,
          unusedNights: unusedNightsCount,
          unusedAmount: totalUnusedRoomStay,
          refundRate: 0.5,
          refundAmount,
          status: "pending",
          message: `Check-out sớm ${unusedNightsCount} đêm. Hoàn 50% = ${refundAmount.toLocaleString("vi-VN")}₫, chờ khách sạn duyệt.`,
        };
      }
    }

    await logHistory(
      bookingId,
      "checked_out",
      `Khách trả phòng${earlyCheckout ? ` sớm ${earlyCheckout.unusedNights} đêm (dự kiến ${displayDate(checkOutDay)}). Tạo yêu cầu hoàn 50% = ${displayMoney(earlyCheckout.refundAmount)} chờ duyệt` : ""}`,
      {
        oldValue: { status: "checked_in", checkOut: checkOutDay },
        newValue: { status: "checked_out", actualCheckOut: today },
        amount: earlyCheckout ? earlyCheckout.refundAmount : null,
      },
      actor,
      connection,
    );

    await connection.commit();
    // Chỉ phát hành hóa đơn sau khi check-out, khi toàn bộ dịch vụ/phát sinh
    // đã được chốt và Payment đã thanh toán đủ.
    let invoice = null;
    try {
      invoice = await invoiceService.issueInvoiceForPayment(payment.id);
    } catch (error) {
      console.error(`Issue invoice for checkout booking #${bookingId} failed:`, error);
    }
    return {
      ...(await bookingModel.getBookingById(bookingId)),
      earlyCheckout,
      lateCheckout,
      invoice
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  distributeGuestsAcrossRooms,
  calcExtraGuestSurcharge,
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
  getBookingServices,
  addServiceCharge,
  updateServiceCharge,
  updateServiceChargeStatus,
  deleteServiceCharge,
  getDamageCharges,
  addDamageCharge,
  updateDamageCharge,
  updateDamageChargeStatus,
  deleteDamageCharge,
  extendStay,
  updateStay,
  transferRoom,
  checkIn,
  checkOut,
  markNoShow,
  processOverdueCheckIns,
  updateBookingRequestedCheckInTime,
  updateBookingRequestedCheckOutTime,
  reassignConflictingBooking,
};

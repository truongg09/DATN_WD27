const db = require("../config/db");
const dayjs = require("dayjs");
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
  HOLD_MINUTES,
  HOLD_RESET_MINUTES,
  MAX_HOLD_RESETS,
  MIN_RESET_COOLDOWN_SECONDS,
  MAX_TOTAL_HOLD_MINUTES
} = require("../utils/bookingPolicy");

const MS_PER_DAY = 24 * 60 * 60 * 1000;
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
      // Đối tượng bị tác động, để trang chi tiết lọc lịch sử theo từng mảng.
      entityType: extra?.entityType,
      entityId: extra?.entityId,
      entityLabel: extra?.entityLabel,
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

const DAY_NAMES_VI = [
  'Chủ nhật',
  'Thứ hai',
  'Thứ ba',
  'Thứ tư',
  'Thứ năm',
  'Thứ sáu',
  'Thứ bảy'
];

const getDayOfWeekInfo = (dateStr) => {
  const date = dateToUtc(dateStr);
  const day = date.getUTCDay(); // 0: Sunday, 1: Monday, ..., 6: Saturday
  const isSunday = day === 0;
  const isSaturday = day === 6;
  const isWeekend = isSunday || isSaturday;
  return {
    dayOfWeek: day,
    dayName: DAY_NAMES_VI[day] || '',
    isSunday,
    isSaturday,
    isWeekend
  };
};

/**
 * Nhận diện hạng phòng hạng sang:
 * Dựa vào tên hạng phòng (Suite, Deluxe, VIP, Luxury, Tổng thống, Penthouse, Executive, Cao cấp, Villa...)
 * hoặc giá phòng từ 1.000.000đ/đêm trở lên.
 */
const isLuxuryRoomType = (roomType, fallbackPrice) => {
  const name = String(roomType?.typeName || roomType?.name || '').toLowerCase();
  const desc = String(roomType?.description || '').toLowerCase();
  const price = Number(fallbackPrice || roomType?.defaultPrice || roomType?.price || 0);

  const luxuryKeywords = [
    'suite',
    'deluxe',
    'vip',
    'luxury',
    'sang',
    'hạng sang',
    'tổng thống',
    'tong thong',
    'president',
    'penthouse',
    'executive',
    'cao cấp',
    'villa'
  ];
  const hasKeyword = luxuryKeywords.some((kw) => name.includes(kw) || desc.includes(kw));
  return hasKeyword || price >= 1000000;
};

// Danh sách các ngày lễ dương lịch cố định hàng năm (MM-DD)
const FIXED_HOLIDAYS_VI = {
  '01-01': 'Tết Dương Lịch',
  '02-14': 'Lễ Tình nhân (Valentine)',
  '03-08': 'Quốc tế Phụ nữ (8/3)',
  '03-26': 'Ngày thành lập Đoàn TNCS Hồ Chí Minh (26/3)',
  '04-30': 'Giải phóng miền Nam (30/4)',
  '05-01': 'Quốc tế Lao động (1/5)',
  '06-01': 'Quốc tế Thiếu nhi (1/6)',
  '07-27': 'Ngày Thương binh Liệt sĩ (27/7)',
  '08-19': 'Cách mạng Tháng Tám (19/8)',
  '09-01': 'Nghỉ lễ Quốc khánh',
  '09-02': 'Quốc khánh (2/9)',
  '09-03': 'Nghỉ lễ Quốc khánh',
  '10-20': 'Ngày Phụ nữ Việt Nam (20/10)',
  '11-20': 'Ngày Nhà giáo Việt Nam (20/11)',
  '12-22': 'Ngày thành lập Quân đội Nhân dân Việt Nam (22/12)',
  '12-24': 'Lễ Giáng sinh (Đêm Noel)',
  '12-25': 'Lễ Giáng sinh (Noel)',
  '12-31': 'Đêm Giao thừa Dương lịch'
};

// Các khoảng ngày lễ âm lịch / biến đổi theo từng năm (YYYY-MM-DD)
const VARIABLE_HOLIDAYS_VI = [
  // Năm 2025
  { start: '2025-01-25', end: '2025-02-02', name: 'Tết Nguyên Đán 2025' },
  { start: '2025-04-06', end: '2025-04-07', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },
  { start: '2025-04-30', end: '2025-05-04', name: 'Kỳ nghỉ 30/4 - 1/5' },
  { start: '2025-08-30', end: '2025-09-03', name: 'Kỳ nghỉ Quốc khánh 2/9' },

  // Năm 2026
  { start: '2026-02-14', end: '2026-02-22', name: 'Tết Nguyên Đán 2026' },
  { start: '2026-04-25', end: '2026-04-26', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },
  { start: '2026-04-30', end: '2026-05-03', name: 'Kỳ nghỉ 30/4 - 1/5' },
  { start: '2026-08-29', end: '2026-09-02', name: 'Kỳ nghỉ Quốc khánh 2/9' },

  // Năm 2027
  { start: '2027-02-05', end: '2027-02-13', name: 'Tết Nguyên Đán 2027' },
  { start: '2027-04-15', end: '2027-04-16', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },
  { start: '2027-04-30', end: '2027-05-03', name: 'Kỳ nghỉ 30/4 - 1/5' },
  { start: '2027-09-01', end: '2027-09-05', name: 'Kỳ nghỉ Quốc khánh 2/9' },

  // Năm 2028
  { start: '2028-01-25', end: '2028-02-02', name: 'Tết Nguyên Đán 2028' },
  { start: '2028-04-04', end: '2028-04-05', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },
  { start: '2028-04-29', end: '2028-05-03', name: 'Kỳ nghỉ 30/4 - 1/5' },
  { start: '2028-09-01', end: '2028-09-04', name: 'Kỳ nghỉ Quốc khánh 2/9' },

  // Năm 2029
  { start: '2029-02-12', end: '2029-02-20', name: 'Tết Nguyên Đán 2029' },
  { start: '2029-04-22', end: '2029-04-23', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },
  { start: '2029-04-28', end: '2029-05-02', name: 'Kỳ nghỉ 30/4 - 1/5' },
  { start: '2029-08-31', end: '2029-09-03', name: 'Kỳ nghỉ Quốc khánh 2/9' },

  // Năm 2030
  { start: '2030-02-01', end: '2030-02-09', name: 'Tết Nguyên Đán 2030' },
  { start: '2030-04-11', end: '2030-04-12', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },
  { start: '2030-04-30', end: '2030-05-03', name: 'Kỳ nghỉ 30/4 - 1/5' },
  { start: '2030-08-31', end: '2030-09-03', name: 'Kỳ nghỉ Quốc khánh 2/9' }
];

const checkHolidayDate = (dateStr) => {
  const mmdd = dateStr.slice(5, 10);
  if (FIXED_HOLIDAYS_VI[mmdd]) {
    return { isHoliday: true, name: FIXED_HOLIDAYS_VI[mmdd] };
  }
  const variable = VARIABLE_HOLIDAYS_VI.find(
    (item) => item.start <= dateStr && dateStr <= item.end
  );
  if (variable) {
    return { isHoliday: true, name: variable.name };
  }
  return { isHoliday: false, name: '' };
};

/**
 * Tính giá phòng từng đêm theo quy tắc:
 * 1. Ngày lễ (Holiday): Đắt hơn 100.000đ/đêm (phòng thường) hoặc 200.000đ/đêm (phòng hạng sang)
 *    so với ngày thường (hoặc ưu tiên giá cụ thể nếu admin cấu hình trong room_prices).
 * 2. Ngày cuối tuần (Thứ 7 & Chủ nhật): Đắt hơn 100.000đ/đêm (phòng thường) hoặc 200.000đ/đêm (phòng hạng sang)
 *    so với ngày thường (hoặc ưu tiên giá cụ thể nếu admin cấu hình trong room_prices).
 * 3. Giá theo mùa / sự kiện (priceType = 'season' hoặc 'special'): nếu có bảng giá sự kiện.
 * 4. Giá ngày thường (priceType = 'normal'): nếu có bảng giá ngày thường riêng.
 * 5. Giá mặc định (fallbackPrice của loại phòng).
 */
const calcNightlyPrices = async (
  roomTypeId,
  fallbackPrice,
  checkIn,
  checkOut,
  connection,
  roomId = null
) => {
  const nights = getStayDates(dayString(checkIn), dayString(checkOut));
  const ranges = await bookingModel.listRoomPriceRanges(roomTypeId || null, connection);

  // Lấy thông tin hạng phòng để nhận diện hạng sang
  let roomTypeInfo = null;
  if (roomTypeId) {
    try {
      const [rows] = await (connection || db).query(
        'SELECT id, typeName, description, defaultPrice FROM room_types WHERE id = ? LIMIT 1',
        [roomTypeId]
      );
      if (rows && rows.length > 0) roomTypeInfo = rows[0];
    } catch {
      roomTypeInfo = null;
    }
  }

  // Nơi gọi không truyền giá gốc thì lấy giá niêm yết của hạng phòng. Thiếu bước
  // này, giá mỗi đêm chỉ còn đúng phần phụ thu (VD ngày lễ ra 100.000đ thay vì
  // giá phòng + 100.000đ).
  const basePriceValue = Number(fallbackPrice || 0) > 0
    ? Number(fallbackPrice)
    : Number(roomTypeInfo?.defaultPrice || 0);

  const isLuxury = isLuxuryRoomType(roomTypeInfo, basePriceValue);
  const weekendHolidaySurcharge = isLuxury ? 200000 : 100000;
  const surchargeLabel = isLuxury ? '+200.000đ (Hạng sang)' : '+100.000đ';

  const prices = nights.map((night) => {
    const dayInfo = getDayOfWeekInfo(night);
    const holidayCheck = checkHolidayDate(night);

    // 1. Ưu tiên cao nhất: Ngày lễ (Holiday)
    // 1a. Cấu hình ngày lễ riêng trong room_prices
    const holidayRange = ranges.find(
      (item) =>
        item.priceType === 'holiday' &&
        dayString(item.startDate) <= night &&
        night <= dayString(item.endDate)
    );
    if (holidayRange) {
      const explicitPrice = Number(holidayRange.price || 0);
      const price = explicitPrice > 0 ? explicitPrice : (basePriceValue + weekendHolidaySurcharge);
      return {
        date: night,
        stayDate: night,
        price,
        basePrice: basePriceValue,
        surcharge: Math.max(0, price - basePriceValue),
        priceType: 'holiday',
        note: holidayRange.note || `Giá ngày lễ (${surchargeLabel})`,
        dayOfWeek: dayInfo.dayOfWeek,
        dayName: dayInfo.dayName,
        isHoliday: true,
        isSunday: dayInfo.isSunday,
        isSaturday: dayInfo.isSaturday,
        isWeekend: dayInfo.isWeekend,
        roomId: roomId ? Number(roomId) : null
      };
    }

    // 1b. Ngày lễ theo lịch Việt Nam tự động
    if (holidayCheck.isHoliday) {
      const price = basePriceValue + weekendHolidaySurcharge;
      return {
        date: night,
        stayDate: night,
        price,
        basePrice: basePriceValue,
        surcharge: weekendHolidaySurcharge,
        priceType: 'holiday',
        note: `${holidayCheck.name} (${surchargeLabel})`,
        dayOfWeek: dayInfo.dayOfWeek,
        dayName: dayInfo.dayName,
        isHoliday: true,
        isSunday: dayInfo.isSunday,
        isSaturday: dayInfo.isSaturday,
        isWeekend: dayInfo.isWeekend,
        roomId: roomId ? Number(roomId) : null
      };
    }

    // 2. Ưu tiên thứ hai: Chủ nhật hoặc Cuối tuần (Sunday / Saturday / Weekend)
    if (dayInfo.isSunday) {
      const sundayRange = ranges.find(
        (item) =>
          item.priceType === 'sunday' &&
          dayString(item.startDate) <= night &&
          night <= dayString(item.endDate)
      );
      if (sundayRange && Number(sundayRange.price || 0) > 0) {
        const price = Number(sundayRange.price);
        return {
          date: night,
          stayDate: night,
          price,
          basePrice: basePriceValue,
          surcharge: Math.max(0, price - basePriceValue),
          priceType: 'sunday',
          note: sundayRange.note || `Giá Chủ nhật (${surchargeLabel})`,
          dayOfWeek: dayInfo.dayOfWeek,
          dayName: dayInfo.dayName,
          isHoliday: false,
          isSunday: true,
          isSaturday: false,
          isWeekend: true,
          roomId: roomId ? Number(roomId) : null
        };
      }

      const weekendRange = ranges.find(
        (item) =>
          item.priceType === 'weekend' &&
          dayString(item.startDate) <= night &&
          night <= dayString(item.endDate)
      );
      if (weekendRange && Number(weekendRange.price || 0) > 0) {
        const price = Number(weekendRange.price);
        return {
          date: night,
          stayDate: night,
          price,
          basePrice: basePriceValue,
          surcharge: Math.max(0, price - basePriceValue),
          priceType: 'sunday',
          note: weekendRange.note || `Giá cuối tuần - Chủ nhật (${surchargeLabel})`,
          dayOfWeek: dayInfo.dayOfWeek,
          dayName: dayInfo.dayName,
          isHoliday: false,
          isSunday: true,
          isSaturday: false,
          isWeekend: true,
          roomId: roomId ? Number(roomId) : null
        };
      }

      // Giá cuối tuần Chủ nhật mặc định (+100k phòng thường, +200k phòng hạng sang)
      const price = basePriceValue + weekendHolidaySurcharge;
      return {
        date: night,
        stayDate: night,
        price,
        basePrice: basePriceValue,
        surcharge: weekendHolidaySurcharge,
        priceType: 'sunday',
        note: `Giá cuối tuần (Chủ nhật) (${surchargeLabel})`,
        dayOfWeek: dayInfo.dayOfWeek,
        dayName: dayInfo.dayName,
        isHoliday: false,
        isSunday: true,
        isSaturday: false,
        isWeekend: true,
        roomId: roomId ? Number(roomId) : null
      };
    } else if (dayInfo.isSaturday) {
      const satRange = ranges.find(
        (item) =>
          (item.priceType === 'saturday' || item.priceType === 'weekend') &&
          dayString(item.startDate) <= night &&
          night <= dayString(item.endDate)
      );
      if (satRange && Number(satRange.price || 0) > 0) {
        const price = Number(satRange.price);
        return {
          date: night,
          stayDate: night,
          price,
          basePrice: basePriceValue,
          surcharge: Math.max(0, price - basePriceValue),
          priceType: 'weekend',
          note: satRange.note || `Giá Thứ 7 (${surchargeLabel})`,
          dayOfWeek: dayInfo.dayOfWeek,
          dayName: dayInfo.dayName,
          isHoliday: false,
          isSunday: false,
          isSaturday: true,
          isWeekend: true,
          roomId: roomId ? Number(roomId) : null
        };
      }

      // Giá cuối tuần Thứ 7 mặc định (+100k phòng thường, +200k phòng hạng sang)
      const price = basePriceValue + weekendHolidaySurcharge;
      return {
        date: night,
        stayDate: night,
        price,
        basePrice: basePriceValue,
        surcharge: weekendHolidaySurcharge,
        priceType: 'weekend',
        note: `Giá cuối tuần (Thứ 7) (${surchargeLabel})`,
        dayOfWeek: dayInfo.dayOfWeek,
        dayName: dayInfo.dayName,
        isHoliday: false,
        isSunday: false,
        isSaturday: true,
        isWeekend: true,
        roomId: roomId ? Number(roomId) : null
      };
    }

    // 3. Ưu tiên thứ ba: Giá theo mùa / sự kiện (Special / Season)
    const seasonRange = ranges.find(
      (item) =>
        ['season', 'special', 'event'].includes(item.priceType) &&
        dayString(item.startDate) <= night &&
        night <= dayString(item.endDate)
    );
    if (seasonRange) {
      const price = Number(seasonRange.price);
      return {
        date: night,
        stayDate: night,
        price,
        basePrice: basePriceValue,
        surcharge: Math.max(0, price - basePriceValue),
        priceType: seasonRange.priceType,
        note: seasonRange.note || 'Giá theo mùa/sự kiện',
        dayOfWeek: dayInfo.dayOfWeek,
        dayName: dayInfo.dayName,
        isHoliday: false,
        isSunday: dayInfo.isSunday,
        isSaturday: dayInfo.isSaturday,
        isWeekend: dayInfo.isWeekend,
        roomId: roomId ? Number(roomId) : null
      };
    }

    // 4. Ưu tiên thứ tư: Giá ngày thường trong room_prices (Normal)
    const normalRange = ranges.find(
      (item) =>
        item.priceType === 'normal' &&
        dayString(item.startDate) <= night &&
        night <= dayString(item.endDate)
    );
    if (normalRange) {
      const price = Number(normalRange.price);
      return {
        date: night,
        stayDate: night,
        price,
        basePrice: basePriceValue,
        surcharge: Math.max(0, price - basePriceValue),
        priceType: 'normal',
        note: normalRange.note || 'Giá ngày thường',
        dayOfWeek: dayInfo.dayOfWeek,
        dayName: dayInfo.dayName,
        isHoliday: false,
        isSunday: dayInfo.isSunday,
        isSaturday: dayInfo.isSaturday,
        isWeekend: dayInfo.isWeekend,
        roomId: roomId ? Number(roomId) : null
      };
    }

    // 5. Giá mặc định (Ngày thường tiêu chuẩn)
    return {
      date: night,
      stayDate: night,
      price: basePriceValue,
      basePrice: basePriceValue,
      surcharge: 0,
      priceType: 'normal',
      note: 'Giá ngày thường (tiêu chuẩn)',
      dayOfWeek: dayInfo.dayOfWeek,
      dayName: dayInfo.dayName,
      isHoliday: false,
      isSunday: false,
      isSaturday: false,
      isWeekend: false,
      roomId: roomId ? Number(roomId) : null
    };
  });

  const total = prices.reduce((sum, item) => sum + item.price, 0);
  const baseTotal = prices.reduce((sum, item) => sum + (item.basePrice || item.price), 0);
  const holidaySurcharge = prices
    .filter((p) => p.isHoliday)
    .reduce((sum, p) => sum + Math.max(0, p.price - (p.basePrice || p.price)), 0);
  const sundaySurcharge = prices
    .filter((p) => p.isSunday && !p.isHoliday)
    .reduce((sum, p) => sum + Math.max(0, p.price - (p.basePrice || p.price)), 0);
  const weekendSurcharge = prices
    .filter((p) => p.isSaturday && !p.isHoliday)
    .reduce((sum, p) => sum + Math.max(0, p.price - (p.basePrice || p.price)), 0);
  const holidayNightsCount = prices.filter((p) => p.isHoliday).length;
  const weekendNightsCount = prices.filter((p) => (p.isSunday || p.isSaturday) && !p.isHoliday).length;

  return {
    nights: prices.length,
    prices,
    baseTotal,
    holidaySurcharge,
    sundaySurcharge,
    weekendSurcharge,
    holidayNightsCount,
    weekendNightsCount,
    isLuxury,
    weekendHolidaySurcharge,
    total,
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
  const childFeePerNight = Number(childrenPolicy?.surchargePerNight ?? extraChildFee ?? 200000);

  // Cách 1: Chỉ tính phụ thu trẻ em khi số trẻ vượt quá tiêu chuẩn phòng (childCapacity)
  // và trẻ đó thuộc độ tuổi chịu phí (6-11 tuổi)
  const extraChildren = ages.length > 0
    ? Math.min(rawExtraChildren, chargeableChildrenAges)
    : rawExtraChildren;

  const extraAdultAmount = extraAdults * extraAdultFee * n;
  const extraChildAmount = extraChildren * childFeePerNight * n;
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

const getRefundPolicy = (checkIn, paidAmount = 0) => {
  // Cả hai mốc phải cùng một hệ quy chiếu. Trước đây `today` là nửa đêm giờ địa
  // phương còn `checkInDate` là nửa đêm UTC, nên trên máy chủ VN (UTC+7) số ngày
  // luôn lệch: hủy 2 ngày trước khi nhận phòng bị tính thành 3 (hoàn 50% thay vì
  // 100%), còn hủy sau ngày nhận phòng lại ra 0 ngày và được hoàn 100%.
  const today = dateToUtc(dayString(new Date()));
  const checkInDate = dateToUtc(dayString(checkIn));
  const daysBeforeCheckIn = Math.round((checkInDate - today) / MS_PER_DAY);
  const rate =
    daysBeforeCheckIn < 0
      ? 0
      : daysBeforeCheckIn < 3
        ? 1
        : daysBeforeCheckIn <= 7
          ? 0.5
          : 0;

  return {
    daysBeforeCheckIn,
    refundRate: rate,
    refundableAmount: Math.round(Number(paidAmount || 0) * rate),
  };
};

// Phân bổ khách vào danh sách phòng có sức chứa KHÁC NHAU: đổ lần lượt từng
// phòng tới trần của chính nó. Bản distributeGuestsAcrossRooms cũ giả định mọi
// phòng cùng một hạng nên không dùng được ở đây.
const distributeGuestsAcrossMixedRooms = (adults, children, roomSlots) => {
  const result = roomSlots.map(() => ({ adults: 0, children: 0 }));
  let remainingAdults = adults;
  let remainingChildren = children;

  roomSlots.forEach((slot, index) => {
    const cap = Math.max(1, Number(slot.maxOccupancy) || 2);
    const takeAdults = Math.min(remainingAdults, cap);
    result[index].adults = takeAdults;
    remainingAdults -= takeAdults;

    const left = cap - takeAdults;
    const takeChildren = Math.min(remainingChildren, left);
    result[index].children = takeChildren;
    remainingChildren -= takeChildren;
  });

  // Còn dư nghĩa là tổng sức chứa không đủ - đã chặn từ trước, đây chỉ là chốt an toàn.
  if (remainingAdults > 0 || remainingChildren > 0) {
    throw new HttpError(400, 'Tổng số khách vượt quá sức chứa của các phòng đã chọn');
  }
  return result;
};

// Đơn gồm NHIỀU HẠNG PHÒNG: mỗi hạng giữ giá riêng theo từng đêm, phụ thu khách
// tính trên tổng sức chứa của tất cả phòng. Phí khách vượt chuẩn lấy theo đơn
// giá của hạng phòng đầu tiên (hạng chính khách chọn).
const createMultiTypeBooking = async (payload, actor, connection) => {
  const customer = await bookingModel.getAccountById(payload.userId, connection);
  if (!customer) {
    throw new HttpError(404, "Không tìm thấy khách hàng");
  }

  await bookingModel.expireUnpaidBookingHolds(connection);

  const dates = getStayDates(payload.checkIn, payload.checkOut);
  const childrenPolicy = await getChildrenPolicy(connection);

  const groups = [];
  for (const group of payload.rooms) {
    const roomType = await getRoomTypeById(group.roomTypeId, connection);
    if (!roomType) {
      throw new HttpError(404, `Không tìm thấy hạng phòng (${group.roomTypeId})`);
    }

    const availableRooms = await bookingModel.listAvailableRoomsByType(
      group.roomTypeId,
      payload.checkIn,
      payload.checkOut,
      connection,
      true,
    );
    if (availableRooms.length < group.quantity) {
      throw new HttpError(
        409,
        `Hạng phòng ${roomType.typeName} không đủ ${group.quantity} phòng trống trong khoảng ngày đã chọn (chỉ còn ${availableRooms.length} phòng)`,
      );
    }

    const nightly = await calcNightlyPrices(
      group.roomTypeId,
      Number(roomType.defaultPrice || 0),
      payload.checkIn,
      payload.checkOut,
      connection,
    );

    groups.push({
      roomType,
      quantity: group.quantity,
      rooms: availableRooms.slice(0, group.quantity),
      nightly,
    });
  }

  if (payload.requestedCheckOutTime) {
    const tiersForRequest = await bookingModel.getCheckoutLateFeeTiers(connection);
    if (payload.requestedCheckOutTime > tiersForRequest.standardCheckOutTime) {
      throw new HttpError(
        400,
        `Giờ trả phòng mong muốn không được muộn hơn giờ chuẩn (${tiersForRequest.standardCheckOutTime.slice(0, 5)}). Nếu cần trả phòng muộn, vui lòng liên hệ khách sạn gần ngày ở để được báo phí trả phòng muộn.`,
      );
    }
  }

  // Sức chứa cộng gộp trên toàn bộ phòng thuộc mọi hạng
  const roomSlots = [];
  groups.forEach((group) => {
    for (let i = 0; i < group.quantity; i++) {
      const rt = group.roomType;
      roomSlots.push({
        adultCapacity: Number(rt.adultCapacity ?? rt.capacity ?? 2),
        childCapacity: Number(rt.childCapacity ?? 1),
        maxOccupancy: Number(rt.maxOccupancy ?? ((rt.adultCapacity ?? rt.capacity ?? 2) + (rt.childCapacity ?? 1))),
      });
    }
  });

  const ages = Array.isArray(payload.childrenAges) ? payload.childrenAges : [];
  const freeMaxAge = childrenPolicy?.freeMaxAge ?? 5;
  const childMaxAge = childrenPolicy?.childMaxAge ?? 11;
  const adultsFromChildren = ages.filter((age) => Number(age) > childMaxAge).length;
  const chargeableChildrenCount = ages.filter(
    (age) => Number(age) > freeMaxAge && Number(age) <= childMaxAge
  ).length;
  const effectiveAdults = Number(payload.adults || 0) + adultsFromChildren;
  const effectiveChildren = Math.max(0, Number(payload.children || 0) - adultsFromChildren);

  const totalAdultCapacity = roomSlots.reduce((sum, slot) => sum + slot.adultCapacity, 0);
  const totalChildCapacity = roomSlots.reduce((sum, slot) => sum + slot.childCapacity, 0);
  const totalMaxOccupancy = roomSlots.reduce((sum, slot) => sum + slot.maxOccupancy, 0);
  const totalGuests = effectiveAdults + effectiveChildren;

  if (totalGuests > totalMaxOccupancy) {
    throw new HttpError(
      400,
      `Tổng số khách (${totalGuests}) vượt quá sức chứa tối đa của ${roomSlots.length} phòng (${totalMaxOccupancy} người). Vui lòng chọn thêm phòng.`,
    );
  }

  const primaryType = groups[0].roomType;
  const nights = Math.max(1, groups[0].nightly.nights || 1);
  const extraAdults = Math.max(0, effectiveAdults - totalAdultCapacity);
  const rawExtraChildren = Math.max(0, effectiveChildren - totalChildCapacity);
  const extraChildren = ages.length > 0
    ? Math.min(rawExtraChildren, chargeableChildrenCount)
    : rawExtraChildren;
  const extraAdultFee = Number(primaryType.extraAdultFee ?? 200000);
  const childFeePerNight = Number(childrenPolicy?.surchargePerNight ?? primaryType.extraChildFee ?? 100000);
  const totalExtraGuestFee =
    extraAdults * extraAdultFee * nights + extraChildren * childFeePerNight * nights;

  const baseStayTotal = groups.reduce(
    (sum, group) => sum + group.nightly.total * group.quantity,
    0,
  );
  const totalPrice = baseStayTotal + totalExtraGuestFee;

  const distributed = distributeGuestsAcrossMixedRooms(
    effectiveAdults,
    effectiveChildren,
    roomSlots,
  );

  // bookings.room_id giữ phòng đầu tiên để tương thích các màn hình cũ
  payload.roomId = groups[0].rooms[0].id;
  payload.roomTypeId = groups[0].roomType.id;

  const surchargeSnapshot = {
    multiRoomType: true,
    roomGroups: groups.map((group) => ({
      roomTypeId: group.roomType.id,
      typeName: group.roomType.typeName,
      quantity: group.quantity,
      pricePerNight: Number(group.roomType.defaultPrice || 0),
      stayTotal: group.nightly.total * group.quantity,
    })),
    totalAdultCapacity,
    totalChildCapacity,
    totalMaxOccupancy,
    extraAdults,
    extraChildren,
    extraAdultFee,
    extraChildFee: childFeePerNight,
    totalExtraGuestFee,
  };

  const bookingId = await bookingModel.createBooking(
    payload,
    totalPrice,
    connection,
    surchargeSnapshot,
  );

  const createdBookingDetails = [];
  let slotIndex = 0;
  const combinedNightlyByDate = new Map();

  for (const group of groups) {
    for (const roomItem of group.rooms) {
      const dist = distributed[slotIndex] || { adults: 0, children: 0 };
      const detailPayload = {
        ...payload,
        roomId: roomItem.id,
        roomTypeId: group.roomType.id,
        adults: dist.adults,
        children: dist.children,
      };
      const detailSurcharge = slotIndex === 0 ? totalExtraGuestFee : 0;
      const detail = await bookingModel.createBookingDetail(
        bookingId,
        detailPayload,
        group.nightly.total / Math.max(1, group.nightly.nights),
        detailSurcharge,
        connection,
      );
      createdBookingDetails.push(detail);
      slotIndex += 1;
    }
    group.nightly.prices.forEach((night) => {
      combinedNightlyByDate.set(
        night.date,
        (combinedNightlyByDate.get(night.date) || 0) + night.price * group.quantity,
      );
    });
  }

  // Chốt tổng giá mỗi đêm của cả đơn (cộng mọi phòng) để về sau không tính lại
  await bookingModel.saveNightlyPrices(
    bookingId,
    [...combinedNightlyByDate.entries()].map(([date, price]) => ({ date, price })),
    connection,
  );

  let serviceAmount = 0;
  if (Array.isArray(payload.serviceRequests) && payload.serviceRequests.length > 0) {
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
      }

      const service = await bookingModel.getServiceById(request.serviceId, connection);
      if (!service) {
        throw new HttpError(404, `Không tìm thấy dịch vụ (${request.serviceId})`);
      }
      const serviceName = String(service.serviceName || "").toLowerCase();
      if (
        request.quantity > 1 &&
        (serviceName.includes("extra bed") || serviceName.includes("giường"))
      ) {
        throw new HttpError(400, "Mỗi phòng chỉ được kê tối đa 1 giường phụ");
      }
      await bookingModel.addBookingService(bookingId, service, request.quantity, connection, {
        roomId: reqRoomId,
        bookingDetailId: reqBookingDetailId,
      });
      serviceAmount += Number(service.price) * request.quantity;
      await connection.query(
        `INSERT INTO booking_service_requests (bookingId, bookingDetailId, roomId, serviceId, quantity, status) VALUES (?, ?, ?, ?, ?, 'confirmed')`,
        [bookingId, reqBookingDetailId, reqRoomId, request.serviceId, request.quantity],
      );
    }
  }

  await connection.query("UPDATE bookings SET totalAmount = ? WHERE id = ?", [
    totalPrice + serviceAmount,
    bookingId,
  ]);

  const payment = await paymentService.createPaymentForBooking(
    bookingId,
    { serviceAmount },
    connection,
  );

  const typeSummary = groups
    .map((group) => `${group.quantity} ${group.roomType.typeName}`)
    .join(" + ");
  await logHistory(
    bookingId,
    "created",
    `Tạo đặt phòng ${typeSummary} từ ${displayDate(payload.checkIn)} đến ${displayDate(payload.checkOut)} (${nights} đêm), tổng tiền ${displayMoney(totalPrice + serviceAmount)}`,
    {
      newValue: {
        rooms: surchargeSnapshot.roomGroups,
        checkIn: dayString(payload.checkIn),
        checkOut: dayString(payload.checkOut),
        totalPrice: totalPrice + serviceAmount,
      },
      amount: totalPrice + serviceAmount,
    },
    actor,
    connection,
  );

  await connection.commit();

  const booking = await bookingModel.getBookingById(bookingId);
  void emailService.sendBookingConfirmation(booking);
  return { ...booking, payment };
};

const createBooking = async (payload, actor) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const roomQuantity = Math.max(1, payload.roomQuantity || 1);
    let assignedRooms = [];

    // Đặt nhiều hạng phòng trong một đơn: gán phòng và tính giá theo từng hạng.
    const isMultiType =
      !payload.roomId && Array.isArray(payload.rooms) && payload.rooms.length > 1;

    if (isMultiType) {
      return await createMultiTypeBooking(payload, actor, connection);
    }

    if (!payload.roomId && payload.roomTypeId) {
      const availableRooms = await bookingModel.listAvailableRoomsByType(
        payload.roomTypeId,
        payload.checkIn,
        payload.checkOut,
        connection,
        true,
      );
      if (availableRooms.length < roomQuantity) {
        throw new HttpError(
          409,
          `Hạng phòng này không đủ ${roomQuantity} phòng trống trong khoảng ngày đã chọn (chỉ còn ${availableRooms.length} phòng)`,
        );
      }
      assignedRooms = availableRooms.slice(0, roomQuantity);
      payload.roomId = assignedRooms[0].id;
    } else if (payload.roomId) {
      const singleRoom = await bookingModel.getRoomWithType(payload.roomId, connection, true);
      if (!singleRoom) {
        throw new HttpError(404, "Không tìm thấy phòng");
      }
      assignedRooms = [singleRoom];
      payload.roomTypeId = singleRoom.roomTypeId;
    }

    const { room } = await ensureBookable(payload, connection, true);
    const roomType = await getRoomTypeById(room.roomTypeId, connection);

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

    const roomPrice = Number(room.price_per_night);
    const dates = getStayDates(payload.checkIn, payload.checkOut);

    const nightly = await calcNightlyPrices(
      room.roomTypeId,
      roomPrice,
      payload.checkIn,
      payload.checkOut,
      connection,
    );
    const childrenPolicy = await getChildrenPolicy(connection);
    const extraSurcharge = calcExtraGuestSurcharge(
      roomType || room,
      payload.adults,
      payload.children,
      payload.childrenAges,
      roomQuantity,
      nightly.nights,
      childrenPolicy
    );

    const baseStayTotal = nightly.total * roomQuantity;
    const totalPrice = baseStayTotal + extraSurcharge.totalExtraGuestFee;

    const bookingId = await bookingModel.createBooking(
      payload,
      totalPrice,
      connection,
      extraSurcharge.snapshot
    );

    const createdBookingDetails = [];
    for (let i = 0; i < assignedRooms.length; i++) {
      const roomItem = assignedRooms[i];
      const dist = extraSurcharge.distributedRooms[i] || { adults: payload.adults, children: payload.children };
      const detailPayload = {
        ...payload,
        roomId: roomItem.id,
        adults: dist.adults,
        children: dist.children
      };
      const detailSurcharge = i === 0 ? extraSurcharge.totalExtraGuestFee : 0;
      const detail = await bookingModel.createBookingDetail(
        bookingId,
        detailPayload,
        roomPrice,
        detailSurcharge,
        connection
      );
      createdBookingDetails.push(detail);
    }
    // Chốt giá từng đêm để thao tác về sau không tính lại theo bảng giá mới.
    await bookingModel.saveNightlyPrices(bookingId, nightly.prices, connection);

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
          if (request.roomIndex < 1 || request.roomIndex > roomQuantity) {
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
      totalPrice + serviceAmount,
      bookingId,
    ]);

    const payment = await paymentService.createPaymentForBooking(
      bookingId,
      { serviceAmount },
      connection,
    );

    await logHistory(
      bookingId,
      "created",
      `Tạo đặt phòng ${room.roomNumber ? `phòng ${room.roomNumber}` : ""} từ ${displayDate(payload.checkIn)} đến ${displayDate(payload.checkOut)} (${nightly.nights} đêm), tổng tiền ${displayMoney(totalPrice + serviceAmount)}`,
      {
        newValue: {
          roomId: payload.roomId,
          checkIn: dayString(payload.checkIn),
          checkOut: dayString(payload.checkOut),
          totalPrice: totalPrice + serviceAmount,
        },
        amount: totalPrice + serviceAmount,
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

const listBookings = (filters) => bookingModel.listBookings(filters);
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
  // Lấy tất cả phòng thuộc booking từ booking_details.
  // Fallback bookings.room_id cho legacy single-room booking.
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

  let [nightlyPrices] = await db.query(
    `SELECT bnp.id, DATE_FORMAT(bnp.stayDate, '%Y-%m-%d') AS stayDate, bnp.price,
            COALESCE(bnp.priceType, 'normal') AS priceType, bnp.note, bnp.roomId,
            r.roomNumber
     FROM booking_nightly_prices bnp
     LEFT JOIN rooms r ON r.id = bnp.roomId
     WHERE bnp.bookingId = ?
     ORDER BY bnp.stayDate ASC`,
    [bookingId],
  );

  const basePricePerNight = Number(booking.room_price || booking.price_per_night || 0);

  if (nightlyPrices.length === 0 && booking.check_in && booking.check_out) {
    try {
      const calcResult = await calcNightlyPrices(
        booking.room_type_id || booking.roomTypeId,
        basePricePerNight,
        dayString(booking.check_in),
        dayString(booking.check_out),
        null,
        booking.room_id
      );
      nightlyPrices = calcResult.prices.map((p) => ({
        id: null,
        stayDate: p.stayDate || p.date,
        price: p.price,
        priceType: p.priceType,
        note: p.note,
        roomId: booking.room_id,
        roomNumber: booking.room_number
      }));
    } catch (calcErr) {
      console.warn('Auto fallback calcNightlyPrices warning:', calcErr.message);
    }
  }

  const enrichedNightlyPrices = nightlyPrices.map((row) => {
    const dayInfo = getDayOfWeekInfo(row.stayDate);
    const rowPrice = Number(row.price || 0);
    const isHoliday = row.priceType === 'holiday';
    const isSunday = dayInfo.isSunday || row.priceType === 'sunday';
    const isSaturday = dayInfo.isSaturday || (row.priceType === 'weekend' && !isSunday);
    const surcharge = Math.max(0, rowPrice - basePricePerNight);

    return {
      ...row,
      price: rowPrice,
      basePrice: basePricePerNight,
      surcharge,
      dayOfWeek: dayInfo.dayOfWeek,
      dayName: dayInfo.dayName,
      isSunday,
      isSaturday,
      isWeekend: dayInfo.isWeekend,
      isHoliday
    };
  });

  const baseRoomAmount = enrichedNightlyPrices.length > 0
    ? enrichedNightlyPrices.length * basePricePerNight
    : Number(booking.room_price || 0) * Math.max(1, getStayDates(dayString(booking.check_in), dayString(booking.check_out)).length);

  const holidaySurcharge = enrichedNightlyPrices
    .filter((p) => p.isHoliday)
    .reduce((sum, p) => sum + Math.max(0, p.price - basePricePerNight), 0);

  const sundaySurcharge = enrichedNightlyPrices
    .filter((p) => p.isSunday && !p.isHoliday)
    .reduce((sum, p) => sum + Math.max(0, p.price - basePricePerNight), 0);

  const weekendSurcharge = enrichedNightlyPrices
    .filter((p) => p.isSaturday && !p.isHoliday)
    .reduce((sum, p) => sum + Math.max(0, p.price - basePricePerNight), 0);

  const occupancySurcharge = Number(booking.occupancy_surcharge || 0);
  const serviceAmount = services
    .filter((s) => s.status !== 'cancelled')
    .reduce((sum, s) => sum + Number(s.totalPrice || 0), 0);
  const damageAmount = damages
    .filter((d) => d.status !== 'cancelled')
    .reduce((sum, d) => sum + Number(d.totalPrice || 0), 0);

  const priceBreakdown = {
    baseRoomPrice: basePricePerNight,
    totalNights: enrichedNightlyPrices.length,
    baseRoomAmount,
    holidaySurcharge,
    sundaySurcharge,
    weekendSurcharge,
    occupancySurcharge,
    serviceAmount,
    damageAmount,
    totalPrice: Number(booking.total_price || 0)
  };

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
    handoverWarning,
    booking_rooms: bookingRooms,
    nightly_prices: enrichedNightlyPrices,
    price_breakdown: priceBreakdown,
  };
};

const getBookingHistory = async (bookingId, options = {}) => {
  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) {
    throw new HttpError(404, "Không tìm thấy đặt phòng");
  }
  return bookingModel.listBookingHistory(bookingId, undefined, {
    entityType: options.entityType,
  });
};

// Lịch sử thao tác của một phòng, gộp từ mọi đơn từng dùng phòng đó.
const getRoomHistory = async (roomId) => {
  const room = await bookingModel.getRoomWithType(roomId);
  if (!room) {
    throw new HttpError(404, "Không tìm thấy phòng");
  }
  return {
    room: { id: room.id, roomNumber: room.roomNumber, roomTypeName: room.room_type_name },
    history: await bookingModel.listRoomHistory(roomId),
  };
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
    surchargeAmount: Number(
      payment?.surchargeAmount || booking.occupancy_surcharge || 0,
    ),
    serviceAmount: services.reduce(
      (sum, item) => sum + Number(item.totalPrice || 0),
      0,
    ),
    damageAmount: damages.reduce(
      (sum, item) => sum + Number(item.totalPrice || 0),
      0,
    ),
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

const getRefundPreview = async (bookingId) => {
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

  return {
    bookingId,
    canCancel: ["pending", "confirmed"].includes(booking.status),
    bookingStatus: booking.status,
    paymentId: payment?.id || null,
    ...getRefundPolicy(booking.check_in, payment?.paidAmount || 0),
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

const cancelBooking = async (
  bookingId,
  refundRequest = null,
  reasonValue = null,
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

    const refundPolicy = getRefundPolicy(
      booking.check_in,
      payment?.paidAmount || 0,
    );

    await bookingModel.updateBookingStatus(bookingId, "cancelled", connection);
    await connection.query(
      "UPDATE bookings SET cancellation_reason = ?, hold_expires_at = NOW() WHERE id = ?",
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
        entityType: "service",
        entityId: created?.id ?? null,
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
        entityType: "service",
        entityId: serviceChargeId,
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
        entityType: "service",
        entityId: serviceChargeId,
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
        entityType: "service",
        entityId: serviceChargeId,
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
        entityType: "damage",
        entityId: damage?.id ?? null,
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
        entityType: "damage",
        entityId: chargeId,
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
        entityType: "damage",
        entityId: chargeId,
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
        entityType: "damage",
        entityId: chargeId,
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

    // Lấy trước để dùng chung: vừa tính giá gia hạn, vừa tìm phòng thay thế nếu có xung đột.
    const currentRoom = await bookingModel.getRoomWithType(
      booking.room_id,
      connection,
    );

    const conflicts = await bookingModel.getConflictingBookings(
      booking.room_id,
      currentCheckOut,
      payload.checkOut,
      connection,
      true,
      { excludeBookingId: bookingId },
    );

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
            ).filter((room) => Number(room.id) !== Number(booking.room_id))
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
        `Khách muốn gia hạn phòng ${currentRoom?.roomNumber || booking.room_id} đến ${displayDate(payload.checkOut)}, nhưng phòng đã có ${conflicts.length} đặt phòng khác (${conflicts.map((c) => `#${c.id}`).join(", ")}) trong khoảng thời gian này.` +
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

    const addedNightly = await calcNightlyPrices(
      currentRoom?.roomTypeId,
      booking.room_price ||
        booking.price_per_night ||
        currentRoom?.price_per_night ||
        0,
      currentCheckOut,
      payload.checkOut,
      connection,
    );
    const addedNights = addedNightly.nights;

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

    const addedAmount = addedNightly.total + addedSurcharge;
    const newTotalPrice = Number(booking.total_price || 0) + addedAmount;

    await bookingModel.saveNightlyPrices(
      bookingId,
      addedNightly.prices,
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
        entityType: "stay",
        entityId: null,
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
        entityType: "stay",
        entityId: null,
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
      holidayNightsCount: nightly.holidayNightsCount,
      weekendNightsCount: nightly.weekendNightsCount,
      isLuxury: nightly.isLuxury,
      nightlyPrices: nightly.prices,
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
        entityType: "room",
        entityId: booking.room_id,
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

    const fromRoom = await bookingModel.getRoomWithType(
      booking.room_id,
      connection,
    );

    await bookingModel.transferBookingRoom(
      booking,
      toRoom,
      payload,
      connection,
    );
    await bookingModel.updateRoomStatus(
      booking.room_id,
      "available",
      connection,
    );
    await bookingModel.updateRoomStatus(toRoom.id, "occupied", connection);

    // Xử lý ngày ở phòng cũ [stayStart, splitDate) và phòng mới [splitDate, stayEnd)
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
            prices: lockedOldNights.map((n) => ({
              date: dayString(n.stayDate),
              stayDate: dayString(n.stayDate),
              price: Number(n.price),
              priceType: n.priceType || 'normal',
              note: n.note || 'Phòng cũ',
              roomId: fromRoom?.id || booking.room_id,
              ...getDayOfWeekInfo(n.stayDate)
            })),
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
            fromRoom?.id || booking.room_id,
          );

    // Phòng mới tính theo bảng giá ngày lễ / chủ nhật / ngày thường của phòng mới
    const newStage = await calcNightlyPrices(
      toRoom.roomTypeId,
      toRoom.price_per_night,
      splitDate,
      stayEnd,
      connection,
      toRoom.id,
    );

    const occupancySurcharge = Number(booking.occupancy_surcharge || 0);
    const newTotalPrice = oldStage.total + newStage.total + occupancySurcharge;
    const previousTotal = Number(booking.total_price || 0);
    const priceDifference = newTotalPrice - previousTotal;

    // Cập nhật bảng booking_nightly_prices:
    // 1. Giữ các đêm trước splitDate (gán roomId phòng cũ nếu chưa có)
    await connection.query(
      `UPDATE booking_nightly_prices
       SET roomId = COALESCE(roomId, ?)
       WHERE bookingId = ? AND stayDate < ?`,
      [fromRoom?.id || booking.room_id, bookingId, splitDate]
    );
    // 2. Xóa các đêm cũ từ splitDate trở đi
    await connection.query(
      `DELETE FROM booking_nightly_prices WHERE bookingId = ? AND stayDate >= ?`,
      [bookingId, splitDate]
    );
    // 3. Lưu các đêm mới của toRoom
    await bookingModel.saveNightlyPrices(
      bookingId,
      newStage.prices,
      connection,
    );

    // Không còn bảng room_availability: tồn kho phòng được suy ra từ bookings và
    // booking_details. Khối cũ truy vấn thẳng vào bảng đã bỏ nên mọi lần chuyển
    // phòng đều dừng ở lỗi 500 trước khi kịp lưu gì.

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

    // Cập nhật hóa đơn nếu đã xuất
    try {
      if (payment) {
        await invoiceService.issueInvoiceForPayment(payment.id, connection);
      }
    } catch {
      // Bỏ qua nếu chưa có hóa đơn
    }

    const nightlyDetailNotes = newStage.prices
      .map((p) => `${displayDate(p.date)} (${p.dayName}${p.isHoliday ? ' - Lễ' : p.isSunday ? ' - Chủ nhật' : ''}): ${displayMoney(p.price)}`)
      .join('; ');

    await logHistory(
      bookingId,
      "room_transferred",
      `Chuyển phòng từ ${fromRoom?.roomNumber || booking.room_id} sang ${toRoom.roomNumber} kể từ ngày ${displayDate(splitDate)}${payload.reason ? `. Lý do: ${payload.reason}` : ""}. Chi tiết các đêm mới: ${nightlyDetailNotes}. ${priceDifference > 0 ? `Khách cần bù: ${displayMoney(priceDifference)}` : priceDifference < 0 ? `Giảm trừ: ${displayMoney(Math.abs(priceDifference))}` : 'Không đổi giá'}. Tổng tiền phòng mới: ${displayMoney(newTotalPrice)}`,
      {
        entityType: "room",
        entityId: toRoom.id,
        oldValue: {
          roomId: booking.room_id,
          roomNumber: fromRoom?.roomNumber,
          totalPrice: previousTotal,
        },
        newValue: {
          roomId: toRoom.id,
          roomNumber: toRoom.roomNumber,
          fromDate: dayString(splitDate),
          totalPrice: newTotalPrice,
          priceDifference,
          newStagePrices: newStage.prices,
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
          roomId: fromRoom?.id,
          roomNumber: fromRoom?.roomNumber,
          from: stayStart,
          to: splitDate,
          nights: oldStage.nights,
          amount: oldStage.total,
          nightlyPrices: oldStage.prices,
        },
        newRoom: {
          roomId: toRoom.id,
          roomNumber: toRoom.roomNumber,
          from: splitDate,
          to: stayEnd,
          nights: newStage.nights,
          amount: newStage.total,
          nightlyPrices: newStage.prices,
        },
        previousTotal,
        newTotalPrice,
        priceDifference,
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

// Nhãn mô tả cho từng nhánh check-in, dùng cả trong booking_history và trả về
// cho frontend hiển thị. Cả 3 nhánh đều KHÔNG thu phí (xem quyết định nghiệp
// vụ: sớm chỉ cần phòng sẵn sàng; muộn khách tự chịu thiệt thời gian lưu trú,
// khách sạn không phát sinh chi phí nên không cần tier phí như late-checkout).
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

    const payment = await paymentService.getPaymentByBookingId(bookingId);
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

    if (booking.room_status === "maintenance") {
      throw new HttpError(
        409,
        "Phòng đang được dọn dẹp/bảo trì nên chưa thể nhận phòng. Vui lòng liên hệ lễ tân để được xếp phòng khác hoặc chờ dọn xong.",
      );
    }

    const activeOccupant = await bookingModel.findActiveCheckedInBooking(
      booking.room_id,
      bookingId,
      connection,
    );
    if (activeOccupant) {
      throw new HttpError(
        409,
        `Phòng hiện đang có khách khác lưu trú (đặt phòng #${activeOccupant.id}) chưa trả phòng. Vui lòng liên hệ lễ tân để xử lý trước khi nhận phòng mới.`,
      );
    }

    if (Array.isArray(payload.guests) && payload.guests.length > 0) {
      await bookingModel.replaceBookingGuests(
        bookingId,
        payload.guests,
        connection,
      );
    }

    await bookingModel.updateBookingStatus(bookingId, "checked_in", connection);
    await bookingModel.updateRoomStatus(
      booking.room_id,
      "occupied",
      connection,
    );
    await bookingModel.updateActualCheckInTime(bookingId, now, connection);

    const wasLate = checkInTiming === "late";
    const timingLabel = CHECK_IN_TIMING_LABEL[checkInTiming];
    await logHistory(
      bookingId,
      "checked_in",
      `Khách nhận phòng (${timingLabel})${Array.isArray(payload.guests) && payload.guests.length > 0 ? `. Khách lưu trú: ${payload.guests.map((g) => g.fullName).join(", ")}` : ""}`,
      {
        entityType: "stay",
        entityId: booking.room_id,
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

    let lateCheckout = null;
    let recalculatedPayment = null;
    const tiers = await bookingModel.getCheckoutLateFeeTiers(connection);
    if (tiers) {
      const standardCheckOut = combineDateTime(
        booking.check_out,
        tiers.standardCheckOutTime,
      );

      if (actualCheckOutTime > standardCheckOut) {
        const nextBooking = await bookingModel.findNextBookingForRoom(
          booking.room_id,
          dayString(booking.check_out),
          connection,
        );
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

        const nightlyRate = Number(
          booking.room_price || booking.price_per_night || 0,
        );
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
    await connection.query(
      "UPDATE rooms SET status = 'maintenance', maintenanceNote = 'Dọn dẹp sau check-out (Chờ dọn dẹp)', maintenanceExpectedCompletion = NULL WHERE id = ?",
      [booking.room_id],
    );

    let earlyCheckout = null;
    const today = dayString(new Date());
    const checkOutDay = dayString(booking.check_out);

    if (today < checkOutDay) {
      const room = await bookingModel.getRoomWithType(
        booking.room_id,
        connection,
      );
      const unusedNightly = await calcNightlyPrices(
        room?.roomTypeId,
        booking.room_price || room?.price_per_night || 0,
        today,
        checkOutDay,
        connection,
      );

      const refundAmount = Math.min(
        Math.round(unusedNightly.total * 0.5),
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
            `Check-out sớm: hoàn 50% của ${unusedNightly.nights} đêm chưa ở (${today} → ${checkOutDay})`,
          ],
        );

        earlyCheckout = {
          refundId: result.insertId,
          unusedNights: unusedNightly.nights,
          unusedAmount: unusedNightly.total,
          refundRate: 0.5,
          refundAmount,
          status: "pending",
          message: `Check-out sớm ${unusedNightly.nights} đêm. Hoàn 50% = ${refundAmount.toLocaleString("vi-VN")}₫, chờ khách sạn duyệt.`,
        };
      }
    }

    await logHistory(
      bookingId,
      "checked_out",
      `Khách trả phòng${earlyCheckout ? ` sớm ${earlyCheckout.unusedNights} đêm (dự kiến ${displayDate(checkOutDay)}). Tạo yêu cầu hoàn 50% = ${displayMoney(earlyCheckout.refundAmount)} chờ duyệt` : ""}`,
      {
        entityType: "stay",
        entityId: booking.room_id,
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

const resetBookingHold = async (bookingId, actor) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    await bookingModel.expireUnpaidBookingHolds(connection);

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, "Không tìm thấy thông tin đặt phòng");
    }

    // Check authorization: only owner or staff/admin
    const isStaff = ["admin", "employee", "staff"].includes(actor?.role);
    const isOwner = actor && Number(booking.user_id) === Number(actor.userId);
    if (!isStaff && !isOwner) {
      throw new HttpError(403, "Bạn không có quyền thao tác trên đơn đặt phòng này");
    }

    // Requirement 3: Không reset khi khách hủy thanh toán / đơn đã hủy
    if (booking.status === "cancelled") {
      throw new HttpError(400, "Không thể gia hạn giữ phòng cho đơn đặt phòng đã hủy");
    }

    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new HttpError(
        400,
        `Không thể gia hạn giữ phòng cho đơn ở trạng thái ${bookingStatusLabel(booking.status)}`
      );
    }

    // Payment check: if already paid or has deposit, hold timer is no longer needed
    const payment = await paymentService.getPaymentByBookingId(bookingId);
    if (payment && (payment.paymentStatus === "paid" || Number(payment.paidAmount) > 0)) {
      throw new HttpError(
        400,
        "Đơn đặt phòng đã được thanh toán hoặc đặt cọc, không cần gia hạn giữ phòng"
      );
    }

    // Requirement 1: Giới hạn số lần reset thời gian giữ phòng
    const currentResetCount = Number(booking.hold_reset_count || 0);
    if (currentResetCount >= MAX_HOLD_RESETS) {
      throw new HttpError(
        400,
        `Đã đạt giới hạn tối đa ${MAX_HOLD_RESETS} lần gia hạn giữ phòng. Vui lòng hoàn tất thanh toán hoặc thực hiện đặt phòng mới.`
      );
    }

    // Requirement 2: Kiểm tra khoảng thời gian giữa các lần reset (cooldown)
    if (booking.last_hold_reset_at) {
      const elapsedSinceLastResetMs = Date.now() - new Date(booking.last_hold_reset_at).getTime();
      const minIntervalMs = MIN_RESET_COOLDOWN_SECONDS * 1000;
      if (elapsedSinceLastResetMs < minIntervalMs) {
        const remainingCooldownSec = Math.ceil((minIntervalMs - elapsedSinceLastResetMs) / 1000);
        throw new HttpError(
          429,
          `Vui lòng đợi ${remainingCooldownSec} giây trước khi thực hiện lần gia hạn tiếp theo.`
        );
      }
    }

    // Requirement 4: Không cho lợi dụng reset để giữ phòng vô thời hạn
    const createdAtMs = new Date(booking.created_at).getTime();
    const maxAllowedExpiresMs = createdAtMs + MAX_TOTAL_HOLD_MINUTES * 60 * 1000;
    const nowMs = Date.now();

    if (nowMs >= maxAllowedExpiresMs) {
      throw new HttpError(
        400,
        `Đã vượt quá tổng thời gian giữ phòng tối đa (${MAX_TOTAL_HOLD_MINUTES} phút) tính từ thời điểm đặt phòng.`
      );
    }

    // Re-check room availability before resetting hold to prevent conflicts
    const conflicts = await bookingModel.getConflictingBookings(
      booking.room_id,
      booking.check_in,
      booking.check_out,
      connection,
      true,
      { excludeBookingId: booking.id }
    );
    if (conflicts.length > 0) {
      await bookingModel.updateBookingStatus(booking.id, "cancelled", connection);
      await connection.commit();
      throw new HttpError(
        409,
        "Phòng vừa được đặt bởi khách khác do phiên giữ chỗ trước đó đã hết hạn. Vui lòng chọn phòng khác."
      );
    }

    const proposedExpiresMs = nowMs + HOLD_RESET_MINUTES * 60 * 1000;
    const newExpiresMs = Math.min(proposedExpiresMs, maxAllowedExpiresMs);
    const newExpiresAt = new Date(newExpiresMs);
    const newResetCount = currentResetCount + 1;
    const now = new Date();

    await bookingModel.updateBookingHold(
      booking.id,
      {
        holdExpiresAt: newExpiresAt,
        holdResetCount: newResetCount,
        lastHoldResetAt: now
      },
      connection
    );

    const remainingResets = MAX_HOLD_RESETS - newResetCount;
    const holdRemainingSeconds = Math.max(0, Math.floor((newExpiresMs - nowMs) / 1000));

    await logHistory(
      booking.id,
      "hold_reset",
      `Gia hạn thời gian giữ phòng lần ${newResetCount}/${MAX_HOLD_RESETS} (+${HOLD_RESET_MINUTES} phút, còn ${remainingResets} lần gia hạn)`,
      {
        entityType: "booking",
        entityId: null, hold_reset_count: newResetCount, hold_expires_at: newExpiresAt },
      actor,
      connection
    );

    await connection.commit();

    return {
      bookingId: booking.id,
      holdExpiresAt: newExpiresAt,
      hold_expires_at: newExpiresAt,
      holdResetCount: newResetCount,
      hold_reset_count: newResetCount,
      maxHoldResets: MAX_HOLD_RESETS,
      max_hold_resets: MAX_HOLD_RESETS,
      remainingResets,
      holdRemainingSeconds,
      canResetHold: remainingResets > 0,
      message: `Gia hạn thời gian giữ phòng thành công! Thời gian giữ phòng mới đến ${newExpiresAt.toLocaleTimeString('vi-VN')} (còn ${remainingResets} lần gia hạn)`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const adminCheckAvailabilityForBooking = async (bookingId, payload) => {
  const checkIn = dayString(payload.checkIn);
  const checkOut = dayString(payload.checkOut);
  if (!checkIn || !checkOut || checkIn >= checkOut) {
    throw new HttpError(400, "Ngày nhận phòng và trả phòng không hợp lệ");
  }

  const connection = await db.getConnection();
  try {
    const availableRooms = await bookingModel.listAvailableRoomsIgnoringBooking(
      checkIn,
      checkOut,
      bookingId,
      connection
    );

    const roomTypeMap = new Map();
    for (const r of availableRooms) {
      const typeId = r.roomTypeId;
      if (!roomTypeMap.has(typeId)) {
        roomTypeMap.set(typeId, {
          roomTypeId: typeId,
          typeName: r.room_type_name,
          capacity: r.room_capacity,
          defaultPrice: Number(r.default_price || 0),
          availableCount: 0,
          rooms: []
        });
      }
      const entry = roomTypeMap.get(typeId);
      entry.availableCount += 1;
      entry.rooms.push({
        id: r.id,
        roomNumber: r.roomNumber,
        floor: r.floor,
        area: r.area,
        status: r.status
      });
    }

    return {
      checkIn,
      checkOut,
      nights: dayjs(checkOut).diff(dayjs(checkIn), "day"),
      availableRooms,
      roomTypes: Array.from(roomTypeMap.values())
    };
  } finally {
    connection.release();
  }
};

const adminPreviewModifyBooking = async (bookingId, payload) => {
  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) {
    throw new HttpError(404, "Không tìm thấy thông tin đặt phòng");
  }

  const checkIn = dayString(payload.checkIn || booking.check_in);
  const checkOut = dayString(payload.checkOut || booking.check_out);
  const nights = Math.max(1, dayjs(checkOut).diff(dayjs(checkIn), "day"));

  const proposedRooms = Array.isArray(payload.rooms) && payload.rooms.length > 0
    ? payload.rooms
    : [{ roomId: booking.room_id, adults: booking.adults || 1, children: booking.children || 0 }];

  const childrenPolicy = await getChildrenPolicy();
  let newRoomTotal = 0;
  let newSurchargeTotal = 0;
  const processedRooms = [];

  for (const r of proposedRooms) {
    let roomPrice = 0;
    let typeName = "";
    let roomNumber = "";
    let roomTypeId = r.roomTypeId;

    if (r.roomId) {
      const [roomRows] = await db.query(
        `SELECT r.*, rt.typeName, rt.defaultPrice FROM rooms r JOIN room_types rt ON r.roomTypeId = rt.id WHERE r.id = ?`,
        [r.roomId]
      );
      if (roomRows[0]) {
        roomPrice = Number(roomRows[0].defaultPrice || 0);
        typeName = roomRows[0].typeName;
        roomNumber = roomRows[0].roomNumber;
        roomTypeId = roomRows[0].roomTypeId;
      }
    } else if (r.roomTypeId) {
      const [typeRows] = await db.query(`SELECT * FROM room_types WHERE id = ?`, [r.roomTypeId]);
      if (typeRows[0]) {
        roomPrice = Number(typeRows[0].defaultPrice || 0);
        typeName = typeRows[0].typeName;
      }
    }

    const nightlyCalc = await calcNightlyPrices(roomTypeId || 0, checkIn, checkOut);
    const roomStayAmount = nightlyCalc.stayAmount > 0 ? nightlyCalc.stayAmount : roomPrice * nights;
    
    const [roomTypeRows] = await db.query(
      `SELECT * FROM room_types WHERE id = ?`,
      [roomTypeId || 1]
    );
    const roomTypeObj = roomTypeRows[0] || {};

    const extraSurchargeResult = calcExtraGuestSurcharge(
      roomTypeObj,
      r.adults,
      r.children,
      r.childrenAges || [],
      1,
      nights,
      childrenPolicy
    );

    const itemSurcharge = extraSurchargeResult.totalExtraGuestFee;
    const itemTotal = roomStayAmount + itemSurcharge;

    newRoomTotal += roomStayAmount;
    newSurchargeTotal += itemSurcharge;

    processedRooms.push({
      roomId: r.roomId || null,
      roomTypeId: roomTypeId || null,
      roomNumber,
      typeName,
      adults: Number(r.adults || 1),
      children: Number(r.children || 0),
      roomPrice,
      roomStayAmount,
      childSurchargeAmount: itemSurcharge,
      itemTotal
    });
  }

  const servicesSum = await bookingModel.sumBookingServices(bookingId);
  const serviceAmount = Number(servicesSum?.totalConfirmed || 0);
  
  const damageSum = await bookingModel.sumDamageCharges(bookingId);
  const damageAmount = Number(damageSum?.totalConfirmed || 0);

  const oldTotalAmount = Number(booking.booking_total_amount || booking.payable_total || booking.total_price || 0);
  const newTotalAmount = newRoomTotal + newSurchargeTotal + serviceAmount + damageAmount;
  const priceDifference = newTotalAmount - oldTotalAmount;

  const [payments] = await db.query(`SELECT * FROM payments WHERE bookingId = ? ORDER BY id DESC LIMIT 1`, [bookingId]);
  const currentPayment = payments[0] || {};
  const depositAmount = Number(currentPayment.depositAmount || 0);
  const paidAmount = Number(currentPayment.paidAmount || 0);
  const newRemainingAmount = Math.max(0, newTotalAmount - depositAmount - paidAmount);

  return {
    bookingId,
    checkIn,
    checkOut,
    nights,
    oldTotalAmount,
    newTotalAmount,
    priceDifference,
    depositAmount,
    paidAmount,
    newRemainingAmount,
    rooms: processedRooms
  };
};

const adminModifyBooking = async (bookingId, payload, actor) => {
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const preview = await adminPreviewModifyBooking(bookingId, payload);
    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, "Không tìm thấy đặt phòng");
    }

    const checkIn = preview.checkIn;
    const checkOut = preview.checkOut;
    
    for (const r of preview.rooms) {
      if (r.roomId) {
        const [conflict] = await connection.query(
          `SELECT bd.id FROM booking_details bd
           JOIN bookings b ON b.id = bd.bookingId
           WHERE bd.roomId = ? AND b.id != ?
           AND b.status NOT IN ('cancelled', 'completed', 'checked_out')
           AND bd.checkInDate < ? AND bd.checkOutDate > ?`,
          [r.roomId, bookingId, checkOut, checkIn]
        );
        if (conflict.length > 0) {
          throw new HttpError(400, `Phòng ${r.roomNumber || r.roomId} đã có người đặt trong khoảng thời gian này.`);
        }
      }
    }

    const firstRoomId = preview.rooms.find(r => r.roomId)?.roomId || booking.room_id;
    await connection.query(
      `UPDATE bookings SET check_in = ?, check_out = ?, totalAmount = ?, total_price = ?, room_id = ? WHERE id = ?`,
      [checkIn, checkOut, preview.newTotalAmount, preview.newTotalAmount, firstRoomId, bookingId]
    );

    const newDetails = preview.rooms.map(r => ({
      bookingId,
      roomId: r.roomId,
      roomTypeId: r.roomTypeId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adults: r.adults,
      children: r.children,
      roomPrice: r.roomPrice,
      occupancySurcharge: r.childSurchargeAmount
    }));

    await bookingModel.replaceBookingDetails(bookingId, newDetails, connection);

    await connection.query(
      `UPDATE payments SET roomAmount = ?, surchargeAmount = ?, totalAmount = ?, remainingAmount = ? WHERE bookingId = ?`,
      [
        preview.newTotalAmount - preview.newRemainingAmount,
        preview.rooms.reduce((s, r) => s + r.childSurchargeAmount, 0),
        preview.newTotalAmount,
        preview.newRemainingAmount,
        bookingId
      ]
    );

    const roomNumbersStr = preview.rooms.map(r => r.roomNumber || r.typeName).filter(Boolean).join(", ");
    await logHistory(
      bookingId,
      "updated",
      `Admin chỉnh sửa đặt phòng (${roomNumbersStr}): tổng bill từ ${displayMoney(preview.oldTotalAmount)} sang ${displayMoney(preview.newTotalAmount)} (Chênh lệch: ${preview.priceDifference >= 0 ? "+" : ""}${displayMoney(preview.priceDifference)})`,
      {
        newValue: {
          checkIn,
          checkOut,
          newTotalAmount: preview.newTotalAmount,
          priceDifference: preview.priceDifference,
          newRemainingAmount: preview.newRemainingAmount,
          rooms: preview.rooms
        }
      },
      actor || { role: "admin" },
      connection
    );

    await connection.commit();

    return {
      success: true,
      message: "Cập nhật đặt phòng thành công",
      data: preview
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  adminCheckAvailabilityForBooking,
  adminPreviewModifyBooking,
  adminModifyBooking,
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
  getRoomHistory,
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
  reassignConflictingBooking,
  resetBookingHold,
};

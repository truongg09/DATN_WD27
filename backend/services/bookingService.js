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
  isPastNoShowDeadline,
  getLateNoShowDeadline,
  getLateCheckInDeadline,
  getCheckOutDeadline,
  combineDateTime,
  computeLateCheckoutFee,
  getMaxLateCheckoutTime,
  DEFAULT_ROOM_HOLD_HOURS,
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
    unused: "chưa sử dụng",
    used: "đang sử dụng",
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
  '04-30': 'Giải phóng miền Nam (30/4)',
  '05-01': 'Quốc tế Lao động (1/5)',
  '09-02': 'Quốc khánh (2/9)',
  '12-25': 'Lễ Giáng sinh (Noel)'
};

// Các khoảng ngày lễ âm lịch / biến đổi theo từng năm (YYYY-MM-DD)
const VARIABLE_HOLIDAYS_VI = [
  // Năm 2025
  { start: '2025-01-29', end: '2025-02-02', name: 'Tết Nguyên Đán 2025' },
  { start: '2025-04-07', end: '2025-04-07', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },

  // Năm 2026
  { start: '2026-02-17', end: '2026-02-21', name: 'Tết Nguyên Đán 2026' },
  { start: '2026-04-26', end: '2026-04-26', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },

  // Năm 2027
  { start: '2027-02-06', end: '2027-02-10', name: 'Tết Nguyên Đán 2027' },
  { start: '2027-04-16', end: '2027-04-16', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },

  // Năm 2028
  { start: '2028-01-26', end: '2028-01-30', name: 'Tết Nguyên Đán 2028' },
  { start: '2028-04-05', end: '2028-04-05', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },

  // Năm 2029
  { start: '2029-02-13', end: '2029-02-17', name: 'Tết Nguyên Đán 2029' },
  { start: '2029-04-23', end: '2029-04-23', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },

  // Năm 2030
  { start: '2030-02-03', end: '2030-02-07', name: 'Tết Nguyên Đán 2030' },
  { start: '2030-04-12', end: '2030-04-12', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },

  // Năm 2031
  { start: '2031-01-23', end: '2031-01-27', name: 'Tết Nguyên Đán 2031' },
  { start: '2031-04-02', end: '2031-04-02', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },

  // Năm 2032
  { start: '2032-02-11', end: '2032-02-15', name: 'Tết Nguyên Đán 2032' },
  { start: '2032-04-20', end: '2032-04-20', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },

  // Năm 2033
  { start: '2033-01-31', end: '2033-02-04', name: 'Tết Nguyên Đán 2033' },
  { start: '2033-04-09', end: '2033-04-09', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },

  // Năm 2034
  { start: '2034-02-19', end: '2034-02-23', name: 'Tết Nguyên Đán 2034' },
  { start: '2034-04-28', end: '2034-04-28', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },

  // Năm 2035
  { start: '2035-02-08', end: '2035-02-12', name: 'Tết Nguyên Đán 2035' },
  { start: '2035-04-17', end: '2035-04-17', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' }
];

// Năm cuối cùng có dữ liệu lễ âm lịch. Qua mốc này mà chưa bổ sung thì Tết
// Nguyên Đán sẽ lặng lẽ bán theo giá ngày thường, nên phải cảnh báo ra log.
const LAST_VARIABLE_HOLIDAY_YEAR = Math.max(
  ...VARIABLE_HOLIDAYS_VI.map((item) => Number(item.start.slice(0, 4)))
);
const warnedMissingHolidayYears = new Set();

const checkHolidayDate = (dateStr) => {
  // Xét các dịp theo từng năm TRƯỚC. Nếu tra bảng dương lịch cố định trước thì
  // mùng 1 Tết 2026 (14/02) bị gắn nhãn "Lễ Tình nhân" thay vì "Tết Nguyên Đán".
  const variable = VARIABLE_HOLIDAYS_VI.find(
    (item) => item.start <= dateStr && dateStr <= item.end
  );
  if (variable) {
    return { isHoliday: true, name: variable.name };
  }

  const year = Number(dateStr.slice(0, 4));
  if (year > LAST_VARIABLE_HOLIDAY_YEAR && !warnedMissingHolidayYears.has(year)) {
    warnedMissingHolidayYears.add(year);
    console.warn(
      `[gia-phong] Chưa khai ngày lễ âm lịch cho năm ${year} (mới có tới ${LAST_VARIABLE_HOLIDAY_YEAR}). ` +
        'Tết Nguyên Đán và Giỗ tổ Hùng Vương năm này đang được tính như ngày thường.'
    );
  }

  const mmdd = dateStr.slice(5, 10);
  if (FIXED_HOLIDAYS_VI[mmdd]) {
    return { isHoliday: true, name: FIXED_HOLIDAYS_VI[mmdd] };
  }
  return { isHoliday: false, name: '' };
};

/**
 * Tính giá phòng từng đêm theo quy tắc:
 * 1. Ngày lễ (Holiday): Tăng 20% so với giá phòng bình thường (+20% basePrice).
 *    (hoặc ưu tiên giá cụ thể nếu admin cấu hình trong room_prices).
 * 2. Ngày cuối tuần (Thứ 7 & Chủ nhật): Tăng 10% so với giá phòng bình thường (+10% basePrice).
 *    (hoặc ưu tiên giá cụ thể nếu admin cấu hình trong room_prices).
 * 3. Nếu ngày lễ trùng Thứ 7 hoặc Chủ nhật: Chỉ tính +20% ngày lễ, không cộng thêm +10%.
 * 4. Giá theo mùa / sự kiện (priceType = 'season' hoặc 'special'): nếu có bảng giá sự kiện.
 * 5. Giá ngày thường (priceType = 'normal'): nếu có bảng giá ngày thường riêng.
 * 6. Giá mặc định (fallbackPrice / defaultPrice của loại phòng).
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

  // Lấy danh sách Lịch ngày lễ từ cơ sở dữ liệu
  let dbHolidays = [];
  try {
    const [hRows] = await (connection || db).query(
      "SELECT * FROM holidays WHERE status = 'active'"
    );
    dbHolidays = hRows || [];
  } catch (err) {
    dbHolidays = [];
  }

  // Lấy thông tin hạng phòng để nhận diện hạng sang / giá niêm yết
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

  const basePriceValue = Number(fallbackPrice || 0) > 0
    ? Number(fallbackPrice)
    : Number(roomTypeInfo?.defaultPrice || 0);

  const weekendSurchargeAmount = Math.round(basePriceValue * 0.05); // +5%
  const defaultHolidaySurchargeAmount = Math.round(basePriceValue * 0.10); // +10%

  const prices = nights.map((night) => {
    const dayInfo = getDayOfWeekInfo(night);
    const holidayCheck = checkHolidayDate(night);

    // Tìm trong bảng holidays động
    const mmdd = night.slice(5, 10);
    const matchedDbHoliday = dbHolidays.find((h) => {
      const start = dayString(h.startDate);
      const end = dayString(h.endDate);
      if (start <= night && night <= end) return true;
      if (h.isRecurring && h.calendarType === 'solar') {
        const hStartMMDD = start.slice(5, 10);
        const hEndMMDD = end.slice(5, 10);
        if (hStartMMDD <= hEndMMDD) {
          return hStartMMDD <= mmdd && mmdd <= hEndMMDD;
        }
      }
      return false;
    });

    const isHoliday = !!matchedDbHoliday || holidayCheck.isHoliday;
    const holidayName = matchedDbHoliday?.name || holidayCheck.name || 'Ngày lễ';
    const holidayPercent = matchedDbHoliday ? Number(matchedDbHoliday.surchargePercent || 10) : 10;
    const holidaySurchargeAmount = Math.round(basePriceValue * (holidayPercent / 100));

    // 1. Ưu tiên cao nhất: Ngày lễ (Holiday) (+10%)
    const holidayRange = ranges.find(
      (item) =>
        item.priceType === 'holiday' &&
        dayString(item.startDate) <= night &&
        night <= dayString(item.endDate)
    );
    if (holidayRange) {
      const explicitPrice = Number(holidayRange.price || 0);
      const price = explicitPrice > 0 ? explicitPrice : (basePriceValue + holidaySurchargeAmount);
      const surcharge = Math.max(0, price - basePriceValue);
      return {
        date: night,
        stayDate: night,
        price,
        basePrice: basePriceValue,
        surcharge,
        surchargePercent: basePriceValue > 0 ? Math.round((surcharge / basePriceValue) * 100) : holidayPercent,
        priceType: 'holiday',
        note: holidayRange.note || `Giá ngày lễ (+${holidayPercent}%)`,
        holidayName,
        dayOfWeek: dayInfo.dayOfWeek,
        dayName: dayInfo.dayName,
        isHoliday: true,
        isSunday: dayInfo.isSunday,
        isSaturday: dayInfo.isSaturday,
        isWeekend: dayInfo.isWeekend,
        roomId: roomId ? Number(roomId) : null
      };
    }

    if (isHoliday) {
      const price = basePriceValue + holidaySurchargeAmount;
      return {
        date: night,
        stayDate: night,
        price,
        basePrice: basePriceValue,
        surcharge: holidaySurchargeAmount,
        surchargePercent: holidayPercent,
        priceType: 'holiday',
        note: `${holidayName} (+${holidayPercent}%)`,
        holidayName,
        dayOfWeek: dayInfo.dayOfWeek,
        dayName: dayInfo.dayName,
        isHoliday: true,
        isSunday: dayInfo.isSunday,
        isSaturday: dayInfo.isSaturday,
        isWeekend: dayInfo.isWeekend,
        roomId: roomId ? Number(roomId) : null
      };
    }

    // Quy tắc giá theo mùa / sự kiện tra trước nhánh cuối tuần
    const seasonRange = ranges.find(
      (item) =>
        ['season', 'special', 'event'].includes(item.priceType) &&
        dayString(item.startDate) <= night &&
        night <= dayString(item.endDate)
    );
    const seasonPrice = seasonRange ? Number(seasonRange.price || 0) : 0;

    const withSeasonFloor = (result) => {
      if (seasonPrice <= result.price) {
        return result;
      }
      return {
        ...result,
        price: seasonPrice,
        surcharge: Math.max(0, seasonPrice - basePriceValue),
        surchargePercent: basePriceValue > 0 ? Math.round((Math.max(0, seasonPrice - basePriceValue) / basePriceValue) * 100) : 0,
        note: seasonRange.note
          ? `${seasonRange.note} (áp cho ${result.isSaturday ? 'Thứ 7' : 'Chủ nhật'})`
          : `Giá theo mùa/sự kiện (áp cho ${result.isSaturday ? 'Thứ 7' : 'Chủ nhật'})`
      };
    };

    // 2. Ưu tiên thứ hai: Cuối tuần (Chủ nhật hoặc Thứ 7) (+10%)
    if (dayInfo.isSunday) {
      const sundayRange = ranges.find(
        (item) =>
          item.priceType === 'sunday' &&
          dayString(item.startDate) <= night &&
          night <= dayString(item.endDate)
      );
      if (sundayRange && Number(sundayRange.price || 0) > 0) {
        const price = Number(sundayRange.price);
        const surcharge = Math.max(0, price - basePriceValue);
        return withSeasonFloor({
          date: night,
          stayDate: night,
          price,
          basePrice: basePriceValue,
          surcharge,
          surchargePercent: basePriceValue > 0 ? Math.round((surcharge / basePriceValue) * 100) : 10,
          priceType: 'sunday',
          note: sundayRange.note || `Giá Chủ nhật (+10%)`,
          holidayName: '',
          dayOfWeek: dayInfo.dayOfWeek,
          dayName: dayInfo.dayName,
          isHoliday: false,
          isSunday: true,
          isSaturday: false,
          isWeekend: true,
          roomId: roomId ? Number(roomId) : null
        });
      }

      const weekendRange = ranges.find(
        (item) =>
          item.priceType === 'weekend' &&
          dayString(item.startDate) <= night &&
          night <= dayString(item.endDate)
      );
      if (weekendRange && Number(weekendRange.price || 0) > 0) {
        const price = Number(weekendRange.price);
        const surcharge = Math.max(0, price - basePriceValue);
        return withSeasonFloor({
          date: night,
          stayDate: night,
          price,
          basePrice: basePriceValue,
          surcharge,
          surchargePercent: basePriceValue > 0 ? Math.round((surcharge / basePriceValue) * 100) : 10,
          priceType: 'sunday',
          note: weekendRange.note || `Giá cuối tuần - Chủ nhật (+10%)`,
          holidayName: '',
          dayOfWeek: dayInfo.dayOfWeek,
          dayName: dayInfo.dayName,
          isHoliday: false,
          isSunday: true,
          isSaturday: false,
          isWeekend: true,
          roomId: roomId ? Number(roomId) : null
        });
      }

      // Giá cuối tuần Chủ nhật mặc định (+5%)
      const price = basePriceValue + weekendSurchargeAmount;
      return withSeasonFloor({
        date: night,
        stayDate: night,
        price,
        basePrice: basePriceValue,
        surcharge: weekendSurchargeAmount,
        surchargePercent: 5,
        priceType: 'sunday',
        note: `Cuối tuần (Chủ nhật) (+5%)`,
        holidayName: '',
        dayOfWeek: dayInfo.dayOfWeek,
        dayName: dayInfo.dayName,
        isHoliday: false,
        isSunday: true,
        isSaturday: false,
        isWeekend: true,
        roomId: roomId ? Number(roomId) : null
      });
    } else if (dayInfo.isSaturday) {
      const satRange = ranges.find(
        (item) =>
          (item.priceType === 'saturday' || item.priceType === 'weekend') &&
          dayString(item.startDate) <= night &&
          night <= dayString(item.endDate)
      );
      if (satRange && Number(satRange.price || 0) > 0) {
        const price = Number(satRange.price);
        const surcharge = Math.max(0, price - basePriceValue);
        return withSeasonFloor({
          date: night,
          stayDate: night,
          price,
          basePrice: basePriceValue,
          surcharge,
          surchargePercent: basePriceValue > 0 ? Math.round((surcharge / basePriceValue) * 100) : 5,
          priceType: 'weekend',
          note: satRange.note || `Giá Thứ 7 (+5%)`,
          holidayName: '',
          dayOfWeek: dayInfo.dayOfWeek,
          dayName: dayInfo.dayName,
          isHoliday: false,
          isSunday: false,
          isSaturday: true,
          isWeekend: true,
          roomId: roomId ? Number(roomId) : null
        });
      }

      // Giá cuối tuần Thứ 7 mặc định (+5%)
      const price = basePriceValue + weekendSurchargeAmount;
      return withSeasonFloor({
        date: night,
        stayDate: night,
        price,
        basePrice: basePriceValue,
        surcharge: weekendSurchargeAmount,
        surchargePercent: 5,
        priceType: 'weekend',
        note: `Cuối tuần (Thứ 7) (+5%)`,
        holidayName: '',
        dayOfWeek: dayInfo.dayOfWeek,
        dayName: dayInfo.dayName,
        isHoliday: false,
        isSunday: false,
        isSaturday: true,
        isWeekend: true,
        roomId: roomId ? Number(roomId) : null
      });
    }

    // 3. Ưu tiên thứ ba: Giá theo mùa / sự kiện (Special / Season)
    if (seasonRange) {
      const price = Number(seasonRange.price);
      const surcharge = Math.max(0, price - basePriceValue);
      return {
        date: night,
        stayDate: night,
        price,
        basePrice: basePriceValue,
        surcharge,
        surchargePercent: basePriceValue > 0 ? Math.round((surcharge / basePriceValue) * 100) : 0,
        priceType: seasonRange.priceType,
        note: seasonRange.note || 'Giá theo mùa/sự kiện',
        holidayName: '',
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
      const surcharge = Math.max(0, price - basePriceValue);
      return {
        date: night,
        stayDate: night,
        price,
        basePrice: basePriceValue,
        surcharge,
        surchargePercent: basePriceValue > 0 ? Math.round((surcharge / basePriceValue) * 100) : 0,
        priceType: 'normal',
        note: normalRange.note || 'Giá ngày thường',
        holidayName: '',
        dayOfWeek: dayInfo.dayOfWeek,
        dayName: dayInfo.dayName,
        isHoliday: false,
        isSunday: dayInfo.isSunday,
        isSaturday: dayInfo.isSaturday,
        isWeekend: dayInfo.isWeekend,
        roomId: roomId ? Number(roomId) : null
      };
    }

    // 5. Giá mặc định (Ngày thường tiêu chuẩn: Thứ 2 - Thứ 6)
    return {
      date: night,
      stayDate: night,
      price: basePriceValue,
      basePrice: basePriceValue,
      surcharge: 0,
      surchargePercent: 0,
      priceType: 'normal',
      note: 'Giá ngày thường',
      holidayName: '',
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
  // Phụ thu ngày lễ giờ tính theo từng dịp (mỗi dịp một mức % riêng trong bảng
  // holidays), nên biến này chỉ còn khai được BÊN TRONG vòng lặp từng đêm. Trả
  // thẳng nó ra ngoài như trước là ReferenceError, làm chết luôn API tìm phòng
  // theo hạng. Lấy lại từ chính các đêm đã tính.
  const holidaySurchargeAmount = prices.find((p) => p.isHoliday)?.surcharge || 0;

  return {
    nights: prices.length,
    prices,
    baseTotal,
    holidaySurcharge,
    sundaySurcharge,
    weekendSurcharge,
    holidayNightsCount,
    weekendNightsCount,
    weekendSurchargeAmount,
    holidaySurchargeAmount,
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
  const unusedAdultSlots = Math.max(0, totalAdultCapacity - effectiveAdults);
  const remainingChildren = Math.max(0, effectiveChildren - unusedAdultSlots);
  const rawExtraChildren = Math.max(0, remainingChildren - totalChildCapacity);
  const childFeePerNight = Number(childrenPolicy?.surchargePerNight ?? extraChildFee ?? 200000);

  // Chỉ tính phụ thu trẻ em khi số trẻ vượt quá tiêu chuẩn phòng (adult + child capacity)
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

const attributeExtraGuestSurchargeToRooms = (rooms, totalExtraGuestFee, extraAdults, extraChildren, nights, childrenPolicy) => {
  if (!Array.isArray(rooms) || rooms.length === 0 || !totalExtraGuestFee || totalExtraGuestFee <= 0) {
    return rooms.map(() => 0);
  }

  const n = Math.max(1, Number(nights) || 1);
  const childFeePerNight = Number(childrenPolicy?.surchargePerNight ?? 100000);

  let remainingExtraAdults = extraAdults;
  let remainingExtraChildren = extraChildren;
  const surcharges = new Array(rooms.length).fill(0);

  // 1. Gán extra adults cho các phòng có adults > adultCapacity
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    const adultCap = Number(r.adultCapacity ?? r.capacity ?? 2);
    const extraFee = Number(r.extraAdultFee ?? 200000);
    const roomAdults = Number(r.adults || 0);

    if (roomAdults > adultCap && remainingExtraAdults > 0) {
      const extraInRoom = Math.min(roomAdults - adultCap, remainingExtraAdults);
      const adultSurcharge = extraInRoom * extraFee * n;
      surcharges[i] += adultSurcharge;
      remainingExtraAdults -= extraInRoom;
    }
  }

  // 2. Gán extra children cho các phòng có trẻ em và vượt tiêu chuẩn phòng
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    const adultCap = Number(r.adultCapacity ?? r.capacity ?? 2);
    const roomAdults = Number(r.adults || 0);
    const roomChildren = Number(r.children || 0);
    const extraFee = Number(r.extraChildFee ?? childFeePerNight);

    if (roomChildren > 0 && remainingExtraChildren > 0) {
      const roomTotal = roomAdults + roomChildren;
      const childOverflow = Math.max(0, roomTotal - adultCap);
      const extraChildInRoom = Math.min(childOverflow || roomChildren, remainingExtraChildren);
      const childSurcharge = extraChildInRoom * extraFee * n;
      surcharges[i] += childSurcharge;
      remainingExtraChildren -= extraChildInRoom;
    }
  }

  // 3. Invariant check: đảm bảo tổng surcharge các phòng bằng đúng totalExtraGuestFee
  const currentTotal = surcharges.reduce((sum, s) => sum + s, 0);
  const diff = totalExtraGuestFee - currentTotal;
  if (diff !== 0) {
    let maxIdx = 0;
    let maxVal = -1;
    for (let i = 0; i < surcharges.length; i++) {
      if (surcharges[i] > maxVal) {
        maxVal = surcharges[i];
        maxIdx = i;
      }
    }
    surcharges[maxIdx] = Math.max(0, surcharges[maxIdx] + diff);
  }

  return surcharges;
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

const calculateRefundRateByPolicy = (daysBeforeCheckIn) => {
  if (daysBeforeCheckIn < 3) return 0;
  if (daysBeforeCheckIn <= 7) return 0.5;
  return 1.0;
};

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

const getRefundPolicy = (checkIn, paidAmount = 0, policy = null) => {
  // Cả hai mốc phải cùng một hệ quy chiếu. Trước đây `today` là nửa đêm giờ địa
  // phương còn `checkInDate` là nửa đêm UTC, nên trên máy chủ VN (UTC+7) số ngày
  // luôn lệch: hủy 2 ngày trước khi nhận phòng bị tính thành 3 (hoàn 50% thay vì
  // 100%), còn hủy sau ngày nhận phòng lại ra 0 ngày và được hoàn 100%.
  const today = dateToUtc(dayString(new Date()));
  const checkInDate = dateToUtc(dayString(checkIn));
  const daysBeforeCheckIn = Math.round((checkInDate - today) / MS_PER_DAY);

  // Mốc và mức phạt lấy từ bảng cancellation_policies để admin sửa trong màn
  // hình Cài đặt là có tác dụng thật. Trước đây các con số 3/7/50/100 nằm cứng
  // trong hàm này, nên chỉnh chính sách xong tiền hoàn vẫn y nguyên.
  // Lưu ý: *TierPercent là PHÍ PHẠT giữ lại, tỉ lệ hoàn = 100 − phạt.
  const nearMaxDays = Number(policy?.nearTierMaxDays ?? 3);
  const midMaxDays = Number(policy?.midTierMaxDays ?? 7);
  const nearPenalty = Number(policy?.nearTierPercent ?? 100);
  const midPenalty = Number(policy?.midTierPercent ?? 50);
  const farPenalty = Number(policy?.farTierPercent ?? 0);

  const penaltyPercent =
    daysBeforeCheckIn < 0
      ? 100
      : daysBeforeCheckIn < nearMaxDays
        ? nearPenalty
        : daysBeforeCheckIn <= midMaxDays
          ? midPenalty
          : farPenalty;

  // Chia sau khi trừ để tránh sai số dấu phẩy động: 1 - 80/100 ra
  // 0.19999999999999996, hiển thị lên màn hình thành "hoàn 19,999...%".
  const rate = Math.min(Math.max(100 - penaltyPercent, 0), 100) / 100;

  return {
    daysBeforeCheckIn,
    refundRate: rate,
    refundableAmount: Math.round(Number(paidAmount || 0) * rate),
  };
};

// Phân bổ khách vào danh sách phòng có sức chứa KHÁC NHAU:
// PHASE 1 — STANDARD CAPACITY FIRST:
//   Đổ lần lượt từng phòng tới sức chứa chuẩn (adultCapacity / childCapacity) của nó.
// PHASE 2 — EXTRA CAPACITY:
//   Chỉ khi tổng khách vượt quá tổng sức chứa chuẩn của tất cả các phòng,
//   số khách dôi dư mới được phân bổ vào khoảng phụ thu (maxOccupancy - standard).
const distributeGuestsAcrossMixedRooms = (adults, children, roomSlots) => {
  const result = roomSlots.map(() => ({ adults: 0, children: 0 }));
  let remainingAdults = Math.max(0, Number(adults || 0));
  let remainingChildren = Math.max(0, Number(children || 0));

  // --- PHASE 1: STANDARD CAPACITY ---
  // 1.1 Người lớn vào adultCapacity
  roomSlots.forEach((slot, index) => {
    const adultCap = Math.max(1, Number(slot.adultCapacity ?? slot.capacity ?? 2));
    const takeAdults = Math.min(remainingAdults, adultCap);
    result[index].adults = takeAdults;
    remainingAdults -= takeAdults;
  });

  // 1.2 Trẻ em vào childCapacity (hoặc khoảng trống chuẩn còn lại)
  roomSlots.forEach((slot, index) => {
    const adultCap = Math.max(1, Number(slot.adultCapacity ?? slot.capacity ?? 2));
    const childCap = Number(slot.childCapacity ?? 0);
    const standardTotal = adultCap + childCap;
    const standardSpaceLeft = Math.max(0, standardTotal - result[index].adults);
    const takeChildren = Math.min(remainingChildren, childCap > 0 ? childCap : standardSpaceLeft);
    result[index].children += takeChildren;
    remainingChildren -= takeChildren;
  });

  // --- PHASE 2: EXTRA CAPACITY (tới maxOccupancy của từng phòng) ---
  // 2.1 Người lớn dôi dư
  if (remainingAdults > 0) {
    roomSlots.forEach((slot, index) => {
      if (remainingAdults <= 0) return;
      const maxOcc = Math.max(1, Number(slot.maxOccupancy ?? (slot.adultCapacity || 2)));
      const currentOcc = result[index].adults + result[index].children;
      const extraSpace = Math.max(0, maxOcc - currentOcc);
      const takeAdults = Math.min(remainingAdults, extraSpace);
      result[index].adults += takeAdults;
      remainingAdults -= takeAdults;
    });
  }

  // 2.2 Trẻ em dôi dư
  if (remainingChildren > 0) {
    roomSlots.forEach((slot, index) => {
      if (remainingChildren <= 0) return;
      const maxOcc = Math.max(1, Number(slot.maxOccupancy ?? (slot.adultCapacity || 2)));
      const currentOcc = result[index].adults + result[index].children;
      const extraSpace = Math.max(0, maxOcc - currentOcc);
      const takeChildren = Math.min(remainingChildren, extraSpace);
      result[index].children += takeChildren;
      remainingChildren -= takeChildren;
    });
  }

  // Còn dư nghĩa là tổng sức chứa không đủ - đã chặn từ trước, đây chỉ là chốt an toàn.
  if (remainingAdults > 0 || remainingChildren > 0) {
    throw new HttpError(400, 'Tổng số khách vượt quá sức chứa tối đa của các phòng đã chọn');
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
      // Giữ lựa chọn khách gắn với chính roomTypeId, không ghép lại bằng
      // vị trí mảng vì danh sách phòng trống có thể được sắp xếp khác.
      guestSelection: {
        adults: Number(group.adults || 0),
        children: Number(group.children || 0),
        childrenAges: Array.isArray(group.childrenAges) ? group.childrenAges : [],
      },
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
  const rawAdults = payload.adults !== undefined
    ? Number(payload.adults || 0)
    : payload.rooms.reduce((sum, r) => sum + (Number(r.adults) || 0), 0);
  const rawChildren = payload.children !== undefined
    ? Number(payload.children || 0)
    : payload.rooms.reduce((sum, r) => sum + (Number(r.children) || 0), 0);

  const effectiveAdults = rawAdults + adultsFromChildren;
  const effectiveChildren = Math.max(0, rawChildren - adultsFromChildren);

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
  const unusedAdultSlots = Math.max(0, totalAdultCapacity - effectiveAdults);
  const remainingChildren = Math.max(0, effectiveChildren - unusedAdultSlots);
  const rawExtraChildren = Math.max(0, remainingChildren - totalChildCapacity);
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

  // Nếu payload có cung cấp adults/children riêng cho từng room group và hợp lệ:
  // Tôn trọng chính xác lựa chọn của người dùng, không tự động phân bổ lại.
  const hasExplicitPerGroupGuests =
    Array.isArray(payload.rooms) &&
    payload.rooms.length > 0 &&
    payload.rooms.every((r) => r.adults !== undefined && Number(r.adults) >= 0);

  let distributed = [];
  if (hasExplicitPerGroupGuests) {
    let slotOffset = 0;
    groups.forEach((resolvedGroup) => {
      const selection = resolvedGroup.guestSelection;
      const q = Math.max(1, Number(resolvedGroup.quantity) || 1);
      const groupSlots = roomSlots.slice(slotOffset, slotOffset + q);
      const groupAges = selection.childrenAges;
      const groupAdultsFromChildren = groupAges.filter(
        (age) => Number(age) > childMaxAge,
      ).length;
      const groupAdults = selection.adults + groupAdultsFromChildren;
      const groupChildren = Math.max(0, selection.children - groupAdultsFromChildren);
      const effectiveChildAges = groupAges.filter((age) => Number(age) <= childMaxAge);
      if (q === 1) {
        distributed.push({ adults: groupAdults, children: groupChildren, childrenAges: effectiveChildAges });
      } else {
        const subDist = distributeGuestsAcrossMixedRooms(groupAdults, groupChildren, groupSlots);
        let ageOffset = 0;
        distributed.push(...subDist.map((roomGuests) => {
          const roomAges = effectiveChildAges.slice(ageOffset, ageOffset + roomGuests.children);
          ageOffset += roomGuests.children;
          return { ...roomGuests, childrenAges: roomAges };
        }));
      }
      slotOffset += q;
    });
  } else {
    distributed = distributeGuestsAcrossMixedRooms(
      effectiveAdults,
      effectiveChildren,
      roomSlots,
    );
    const effectiveChildAges = ages.filter((age) => Number(age) <= childMaxAge);
    let ageOffset = 0;
    distributed = distributed.map((roomGuests) => {
      const roomAges = effectiveChildAges.slice(ageOffset, ageOffset + roomGuests.children);
      ageOffset += roomGuests.children;
      return { ...roomGuests, childrenAges: roomAges };
    });
  }

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
      adults: group.guestSelection.adults,
      children: group.guestSelection.children,
      childrenAges: group.guestSelection.childrenAges,
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

  const allSlotRooms = [];
  let sIndex = 0;
  for (const group of groups) {
    for (const roomItem of group.rooms) {
      const dist = distributed[sIndex] || { adults: 0, children: 0 };
      allSlotRooms.push({
        ...roomItem,
        adults: dist.adults,
        children: dist.children,
        childrenAges: dist.childrenAges || [],
        adultCapacity: Number(group.roomType.adultCapacity ?? group.roomType.capacity ?? 2),
        childCapacity: Number(group.roomType.childCapacity ?? 1),
        maxOccupancy: Number(group.roomType.maxOccupancy ?? 3),
        extraAdultFee: Number(group.roomType.extraAdultFee ?? 200000),
        extraChildFee: Number(group.roomType.extraChildFee ?? childFeePerNight),
      });
      sIndex++;
    }
  }

  const multiAttributedSurcharges = attributeExtraGuestSurchargeToRooms(
    allSlotRooms,
    totalExtraGuestFee,
    extraAdults,
    extraChildren,
    groups[0]?.nightly?.nights || 1,
    childrenPolicy
  );

  for (const group of groups) {
    for (const roomItem of group.rooms) {
      const dist = distributed[slotIndex] || { adults: 0, children: 0 };
      const detailPayload = {
        ...payload,
        roomId: roomItem.id,
        roomTypeId: group.roomType.id,
        // slotIndex chạy đúng thứ tự mà roomIndex của dịch vụ tham chiếu tới,
        // nên tên khách đặt cho phòng thứ N khớp với phòng thứ N ở đây.
        roomLabel: Array.isArray(payload.roomLabels)
          ? String(payload.roomLabels[slotIndex] || '').trim() || null
          : null,
        adults: dist.adults,
        children: dist.children,
      };
      const detailSurcharge = multiAttributedSurcharges[slotIndex] || 0;
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
  return { ...booking, payment };
};

// Số đơn CHƯA thanh toán mà một tài khoản được phép giữ cùng lúc.
//
// Đơn vừa tạo đã giữ phòng 15 phút dù chưa trả đồng nào, và phòng đang giữ bị
// loại khỏi danh sách còn trống. Không chặn thì một tài khoản tạo vài chục đơn
// là cả website hiện "hết phòng", lặp lại mãi — mất doanh thu đúng dịp cao điểm
// mà không cần kỹ thuật gì.
const MAX_ACTIVE_UNPAID_BOOKINGS_PER_USER = 3;

const assertUnpaidBookingQuota = async (userId, connection) => {
  if (!userId) return;
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM bookings b
     LEFT JOIN payments p ON p.id = (
       SELECT p2.id FROM payments p2 WHERE p2.bookingId = b.id ORDER BY p2.id DESC LIMIT 1
     )
     WHERE b.user_id = ?
       AND COALESCE(b.bookingStatus, b.status) IN ('pending', 'confirmed')
       AND COALESCE(p.paidAmount, 0) <= 0
       AND b.hold_expires_at IS NOT NULL
       AND b.hold_expires_at > NOW()`,
    [userId]
  );

  if (Number(row?.total || 0) >= MAX_ACTIVE_UNPAID_BOOKINGS_PER_USER) {
    throw new HttpError(
      429,
      `Bạn đang có ${MAX_ACTIVE_UNPAID_BOOKINGS_PER_USER} đơn chờ thanh toán. Vui lòng thanh toán hoặc hủy bớt trước khi đặt thêm.`
    );
  }
};

const createBooking = async (payload, actor) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Dọn các đơn hết hạn giữ chỗ trước khi đếm, để khách không bị chặn oan vì
    // những đơn cũ đã quá hạn thanh toán.
    await bookingModel.expireUnpaidBookingHolds(connection);
    await assertUnpaidBookingQuota(payload.userId, connection);

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

    const allSingleSlotRooms = assignedRooms.map((roomItem, idx) => {
      const dist = extraSurcharge.distributedRooms[idx] || { adults: payload.adults, children: payload.children };
      return {
        ...roomItem,
        adults: dist.adults,
        children: dist.children,
        adultCapacity: Number(roomType?.adultCapacity ?? roomType?.capacity ?? 2),
        childCapacity: Number(roomType?.childCapacity ?? 1),
        maxOccupancy: Number(roomType?.maxOccupancy ?? 3),
        extraAdultFee: Number(roomType?.extraAdultFee ?? 200000),
        extraChildFee: Number(roomType?.extraChildFee ?? 100000),
      };
    });

    const singleAttributedSurcharges = attributeExtraGuestSurchargeToRooms(
      allSingleSlotRooms,
      extraSurcharge.totalExtraGuestFee,
      extraSurcharge.extraAdults,
      extraSurcharge.extraChildren,
      nightly.nights,
      childrenPolicy
    );

    const createdBookingDetails = [];
    for (let i = 0; i < assignedRooms.length; i++) {
      const roomItem = assignedRooms[i];
      const dist = extraSurcharge.distributedRooms[i] || { adults: payload.adults, children: payload.children };
      const detailPayload = {
        ...payload,
        roomId: roomItem.id,
        // i chạy đúng thứ tự mà roomIndex của dịch vụ tham chiếu tới.
        roomLabel: Array.isArray(payload.roomLabels)
          ? String(payload.roomLabels[i] || '').trim() || null
          : null,
        adults: dist.adults,
        children: dist.children
      };
      const detailSurcharge = singleAttributedSurcharges[i] || 0;
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
  // Lấy tất cả phòng và chi tiết phòng thuộc booking từ booking_details.
  // Fallback bookings.room_id cho legacy single-room booking.
  const [detailsRows] = await db.query(
    `SELECT bd.id, bd.id AS bookingDetailId, bd.bookingId, bd.roomId,
            COALESCE(bd.roomTypeId, r.roomTypeId) AS roomTypeId,
            DATE_FORMAT(bd.checkInDate, '%Y-%m-%d') AS checkInDate,
            DATE_FORMAT(bd.checkOutDate, '%Y-%m-%d') AS checkOutDate,
            bd.adults, bd.children, bd.childrenAges, bd.roomPrice, bd.occupancySurcharge,
            bd.requestedCheckInTime, bd.requestedCheckOutTime, bd.requestedCheckInDayOffset,
            r.roomNumber, r.floor AS roomFloor, r.area AS roomArea,
            rt.typeName, rt.defaultPrice
     FROM booking_details bd
     LEFT JOIN rooms r ON r.id = bd.roomId
     LEFT JOIN room_types rt ON rt.id = COALESCE(bd.roomTypeId, r.roomTypeId)
     WHERE bd.bookingId = ?
     ORDER BY bd.id ASC`,
    [bookingId]
  );

  const bookingDetails = detailsRows.length > 0
    ? detailsRows
    : [
        {
          id: booking.detail_id || 1,
          bookingDetailId: booking.detail_id || 1,
          bookingId,
          roomId: booking.room_id || null,
          roomTypeId: booking.room_type_id || null,
          checkInDate: dayString(booking.check_in),
          checkOutDate: dayString(booking.check_out),
          adults: Number(booking.adults || 1),
          children: Number(booking.children || 0),
          roomPrice: Number(booking.room_price || booking.price_per_night || 0),
          occupancySurcharge: Number(booking.occupancy_surcharge || 0),
          roomNumber: booking.room_number,
          typeName: booking.room_type_name
        }
      ];

  const [bdRooms] = await db.query(
    `SELECT bd.roomId AS id, bd.id AS bookingDetailId, r.roomNumber AS number,
            COALESCE(bd.roomTypeId, r.roomTypeId) AS roomTypeId, rt.typeName AS roomTypeName
     FROM booking_details bd
     INNER JOIN rooms r ON r.id = bd.roomId
     LEFT JOIN room_types rt ON rt.id = COALESCE(bd.roomTypeId, r.roomTypeId)
     WHERE bd.bookingId = ?
     ORDER BY bd.id ASC`,
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
  // Chỉ cộng dòng đang ở trạng thái 'used', giống sumBookingServices và
  // sumDamageCharges bên model. Lọc theo "khác cancelled" thì các dòng chờ xác
  // nhận hoặc bị từ chối vẫn lọt vào, khiến số tiền hiện trên màn hình thanh
  // toán không khớp số thật sự phải trả.
  const serviceAmount = services
    .filter((s) => s.status === 'used')
    .reduce((sum, s) => sum + Number(s.totalPrice || 0), 0);
  const damageAmount = damages
    .filter((d) => d.status === 'used')
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
    details: bookingDetails,
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
    // bd.roomLabel là tên khách tự đặt cho phòng lúc đặt online. Lấy theo
    // bookingDetailId trước, vì đó mới là dòng phòng mà khách chỉ định.
    `SELECT bs.id, bs.roomId, r.roomNumber, bs.quantity, bs.totalPrice, bs.createdAt,
            COALESCE(bs.status, 'used') AS status, s.serviceName,
            COALESCE(bd.roomLabel, bd2.roomLabel) AS roomLabel
     FROM booking_services bs
     LEFT JOIN services s ON s.id = bs.serviceId
     LEFT JOIN bookings b ON b.id = bs.bookingId
     LEFT JOIN rooms r ON r.id = COALESCE(bs.roomId, b.room_id)
     LEFT JOIN booking_details bd ON bd.id = bs.bookingDetailId
     LEFT JOIN booking_details bd2 ON bd2.bookingId = bs.bookingId AND bd2.roomId = bs.roomId
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
    // Chỉ cộng dòng 'used' cho khớp sumBookingServices / sumDamageCharges — hai
    // hàm quyết định số tiền thật sự phải trả. Trước đây cộng hết mọi dòng nên
    // dịch vụ đã hủy hoặc còn chờ duyệt vẫn hiện vào tổng, khiến con số trên màn
    // hình trả phòng lệch với số tiền in trên mã QR.
    serviceAmount: services
      .filter((item) => item.status === 'used')
      .reduce((sum, item) => sum + Number(item.totalPrice || 0), 0),
    damageAmount: damages
      .filter((item) => item.status === 'used')
      .reduce((sum, item) => sum + Number(item.totalPrice || 0), 0),
    // Vẫn trả về đủ danh sách kèm status để màn hình hiển thị được cả dòng đã hủy.
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
    { entityType: "payment", amount: summary.remainingAmount },
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
    ...getRefundPolicy(
      booking.check_in,
      payment?.paidAmount || 0,
      await bookingModel.getCancellationPolicy(),
    ),
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
      await bookingModel.getCancellationPolicy(connection),
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

    let targetRoomId = payload.roomId ? Number(payload.roomId) : null;
    let targetBookingDetailId = payload.bookingDetailId
      ? Number(payload.bookingDetailId)
      : null;

    if (targetBookingDetailId) {
      const [detailRows] = await connection.query(
        `SELECT id, roomId FROM booking_details
         WHERE id = ? AND bookingId = ? FOR UPDATE`,
        [targetBookingDetailId, bookingId]
      );
      const detail = detailRows[0];
      if (!detail) {
        throw new HttpError(400, "Phòng đã chọn không thuộc đặt phòng này");
      }
      if (targetRoomId && Number(detail.roomId) !== targetRoomId) {
        throw new HttpError(400, "Thông tin phòng đã chọn không khớp");
      }
      targetRoomId = detail.roomId ? Number(detail.roomId) : null;
    } else if (targetRoomId) {
      const [detailRows] = await connection.query(
        `SELECT id FROM booking_details
         WHERE bookingId = ? AND roomId = ? ORDER BY id LIMIT 1 FOR UPDATE`,
        [bookingId, targetRoomId]
      );
      targetBookingDetailId = detailRows[0]?.id
        ? Number(detailRows[0].id)
        : null;
    }

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
      {
        roomId: targetRoomId,
        bookingDetailId: targetBookingDetailId,
        customerId: payload.customerId,
        guestName: payload.guestName,
        status: payload.status
      },
    );

    const payment = await paymentService.recalculatePaymentForBooking(
      bookingId,
      connection,
    );
    const addedAmount = Number(created.totalPrice || 0);

    await logHistory(
      bookingId,
      "service_added",
      `Thêm dịch vụ phát sinh: ${service.serviceName} x${payload.quantity} = ${displayMoney(addedAmount)}${created.status !== "used" ? ` (trạng thái: ${bookingStatusLabel(created.status)})` : ""}`,
      {
        entityType: "service",
        entityId: created?.id ?? null,
        newValue: {
          id: created.id,
          roomId: targetRoomId,
          bookingDetailId: targetBookingDetailId,
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
      `Đổi trạng thái dịch vụ ${oldCharge.serviceName || "(dịch vụ)"}: ${bookingStatusLabel(oldCharge.status)} → ${bookingStatusLabel(status)}`,
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

    let targetRoomId = payload.roomId ? Number(payload.roomId) : null;
    let targetBookingDetailId = payload.bookingDetailId
      ? Number(payload.bookingDetailId)
      : null;
    if (targetBookingDetailId) {
      const [detailRows] = await connection.query(
        `SELECT id, roomId FROM booking_details
         WHERE id = ? AND bookingId = ? FOR UPDATE`,
        [targetBookingDetailId, bookingId]
      );
      const detail = detailRows[0];
      if (!detail) {
        throw new HttpError(400, "Phòng phát sinh không thuộc đặt phòng này");
      }
      if (targetRoomId && Number(detail.roomId) !== targetRoomId) {
        throw new HttpError(400, "Vật dụng không thuộc phòng đã chọn");
      }
      targetRoomId = detail.roomId ? Number(detail.roomId) : null;
    } else {
      targetRoomId = targetRoomId || booking.room_id;
      if (targetRoomId) {
        const [detailRows] = await connection.query(
          `SELECT id FROM booking_details
           WHERE bookingId = ? AND roomId = ? ORDER BY id LIMIT 1 FOR UPDATE`,
          [bookingId, targetRoomId]
        );
        targetBookingDetailId = detailRows[0]?.id
          ? Number(detailRows[0].id)
          : null;
      }
    }
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

    if (payload.chargeType === 'damage' && targetRoomId) {
      let itemRow = null;
      if (payload.roomItemId) {
        const [rows] = await connection.query(
          `SELECT id, roomId, itemName, quantity, compensationPrice, status
           FROM room_items WHERE id = ? AND roomId = ?`,
          [Number(payload.roomItemId), targetRoomId]
        );
        itemRow = rows[0];
        if (!itemRow) {
          throw new HttpError(400, "Vật dụng không thuộc phòng đã chọn");
        }
      } else if (payload.itemName) {
        const [rows] = await connection.query(
          `SELECT id, roomId, itemName, quantity, compensationPrice, status
           FROM room_items WHERE roomId = ? AND LOWER(TRIM(itemName)) = LOWER(?) LIMIT 1`,
          [targetRoomId, payload.itemName.trim()]
        );
        itemRow = rows[0];
      }
      if (itemRow) {
        if (itemRow.compensationPrice != null && Number(itemRow.compensationPrice) > 0) {
          payload.unitPrice = Number(itemRow.compensationPrice);
        }
        if (itemRow.quantity != null && Number(payload.quantity) > Number(itemRow.quantity)) {
          throw new HttpError(400, `Số lượng hư hỏng/mất vượt quá số lượng vật dụng trong phòng (${itemRow.quantity})`);
        }
      }
    }

    payload.bookingDetailId = targetBookingDetailId;
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
          roomId: targetRoomId,
          bookingDetailId: targetBookingDetailId,
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

    if (current.status === 'cancelled') {
      throw new HttpError(409, "Khoản phí đã hủy, không thể chỉnh sửa");
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
      `Đổi trạng thái khoản phí ${current.itemName}: ${bookingStatusLabel(current.status)} → ${bookingStatusLabel(status)}`,
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

    // 1. Load ALL booking_details for this booking
    const [details] = await connection.query(
      `SELECT bd.*, r.roomNumber, r.status AS roomStatus, rt.typeName AS roomTypeName, rt.defaultPrice
       FROM booking_details bd
       LEFT JOIN rooms r ON r.id = bd.roomId
       LEFT JOIN room_types rt ON rt.id = COALESCE(bd.roomTypeId, r.roomTypeId)
       WHERE bd.bookingId = ?
       ORDER BY bd.id ASC FOR UPDATE`,
      [bookingId]
    );

    const roomDetails = details.length > 0
      ? details
      : [{
          id: null,
          bookingId,
          roomId: booking.room_id,
          roomTypeId: booking.room_type_id,
          roomPrice: booking.price_per_night || 0,
          occupancySurcharge: booking.occupancy_surcharge || 0
        }];

    // 2. Check conflicts for ALL physical rooms in this booking
    for (const d of roomDetails) {
      if (!d.roomId) continue;

      const conflicts = await bookingModel.getConflictingBookings(
        d.roomId,
        currentCheckOut,
        payload.checkOut,
        connection,
        true,
        { excludeBookingId: bookingId },
      );

      if (conflicts.length > 0) {
        throw new HttpError(
          409,
          `Không thể gia hạn vì phòng ${d.roomNumber || d.roomId} đã có khách khác đặt trong giai đoạn gia hạn.`,
          {
            conflictingRoomId: d.roomId,
            conflictingRoomNumber: d.roomNumber,
            conflictingBookingIds: conflicts.map((item) => item.id),
          },
        );
      }
    }

    // 3. Calculate nightly price for each booking_detail independently
    let totalAddedRoomAmount = 0;
    let addedNights = 0;
    const allAddedNightlyPrices = [];

    for (const d of roomDetails) {
      const roomPrice = Number(d.roomPrice || d.defaultPrice || 0);
      const nightlyCalc = await calcNightlyPrices(
        d.roomTypeId,
        roomPrice,
        currentCheckOut,
        payload.checkOut,
        connection,
        d.roomId,
      );

      addedNights = nightlyCalc.nights;
      totalAddedRoomAmount += Number(nightlyCalc.total || 0);

      // Collect nightly prices for saving
      for (const p of nightlyCalc.prices) {
        allAddedNightlyPrices.push({
          ...p,
          roomId: d.roomId,
        });
      }
    }

    // 4. Calculate added surcharge based on original nights
    const originalNights = getNightCount(
      dayString(booking.check_in),
      currentCheckOut,
    );
    const currentSurcharge = Number(booking.occupancy_surcharge || 0);
    const surchargePerNight =
      originalNights > 0 ? currentSurcharge / originalNights : 0;
    const addedSurcharge = Math.round(surchargePerNight * addedNights);
    const newSurcharge = currentSurcharge + addedSurcharge;

    const perDetailSurcharges = roomDetails.map((d) => {
      const dSurcharge = Number(d.occupancySurcharge || 0);
      const dSurchargePerNight = originalNights > 0 ? dSurcharge / originalNights : 0;
      const dAddedSurcharge = Math.round(dSurchargePerNight * addedNights);
      return {
        id: d.id,
        occupancySurcharge: dSurcharge + dAddedSurcharge,
      };
    });

    const addedAmount = totalAddedRoomAmount + addedSurcharge;
    const newTotalPrice = Number(booking.total_price || 0) + addedAmount;

    // 5. Save nightly prices and update booking stay
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
      perDetailSurcharges,
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
      newTotalPrice,
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

    // 1. Lấy danh sách booking_details của đơn này để xác định đúng logical room
    const [details] = await connection.query(
      `SELECT id, roomId, roomTypeId, checkInDate, checkOutDate
       FROM booking_details
       WHERE bookingId = ?
       ORDER BY id ASC`,
      [bookingId]
    );

    let targetDetail = null;
    if (payload.bookingDetailId) {
      targetDetail = details.find((d) => Number(d.id) === Number(payload.bookingDetailId));
      if (!targetDetail) {
        throw new HttpError(404, `Không tìm thấy chi tiết đặt phòng #${payload.bookingDetailId}`);
      }
    } else if (details.length === 1) {
      targetDetail = details[0];
    } else if (details.length > 1) {
      if (payload.sourceRoomId) {
        targetDetail = details.find((d) => Number(d.roomId) === Number(payload.sourceRoomId));
      }
      if (!targetDetail) {
        targetDetail = details[0];
      }
    }

    const sourceRoomId = targetDetail?.roomId || booking.room_id;
    const targetCheckIn = targetDetail?.checkInDate || booking.check_in;
    const targetCheckOut = targetDetail?.checkOutDate || booking.check_out;

    // 2. Validate Target Room
    const newRoom = await bookingModel.getRoomWithType(
      payload.roomId,
      connection,
      true,
    );
    if (!newRoom) {
      throw new HttpError(404, "Không tìm thấy phòng muốn chuyển đến");
    }

    // Không được chuyển sang chính source room hiện tại
    if (sourceRoomId && Number(newRoom.id) === Number(sourceRoomId)) {
      throw new HttpError(400, "Phòng chuyển đến không được trùng với phòng hiện tại");
    }

    // Không được chuyển sang phòng khác đang thuộc cùng booking multi-room
    if (details.length > 1) {
      const otherAssignedRoomIds = details
        .filter((d) => targetDetail && Number(d.id) !== Number(targetDetail.id))
        .map((d) => Number(d.roomId))
        .filter(Boolean);
      if (otherAssignedRoomIds.includes(Number(newRoom.id))) {
        throw new HttpError(409, `Phòng ${newRoom.roomNumber} đã được gán cho phòng khác trong cùng đơn đặt phòng này`);
      }
    }

    // Chặn phòng đang bảo trì
    if (newRoom.status === "maintenance") {
      throw new HttpError(409, `Phòng ${newRoom.roomNumber} đang được bảo trì / sửa chữa`);
    }

    // Chặn phòng đang có khách lưu trú
    if (newRoom.status === "occupied") {
      throw new HttpError(409, `Phòng ${newRoom.roomNumber} hiện đang có khách lưu trú`);
    }

    // Chặn phòng không ở trạng thái available
    if (newRoom.status !== "available") {
      throw new HttpError(409, `Phòng ${newRoom.roomNumber} hiện không sẵn sàng đón khách (trạng thái: ${newRoom.status})`);
    }

    // Kiểm tra cùng hạng phòng
    const expectedRoomTypeId = targetDetail?.roomTypeId || booking.room_type_id;
    if (
      expectedRoomTypeId &&
      Number(newRoom.roomTypeId) !== Number(expectedRoomTypeId)
    ) {
      throw new HttpError(
        400,
        "Chỉ được chuyển sang phòng cùng loại để giữ đúng giá đã chốt với khách",
      );
    }

    // 3. Kiểm tra xung đột lịch với các booking khác trong khoảng [targetCheckIn, targetCheckOut)
    const conflicts = await bookingModel.getConflictingBookings(
      newRoom.id,
      targetCheckIn,
      targetCheckOut,
      connection,
      true,
      { excludeBookingId: bookingId },
    );
    if (conflicts.length > 0) {
      throw new HttpError(
        409,
        `Phòng ${newRoom.roomNumber} đã có người đặt trong khoảng thời gian này`,
        {
          conflictingBookingIds: conflicts.map((item) => item.id),
        },
      );
    }

    const currentRoom = sourceRoomId
      ? await bookingModel.getRoomWithType(sourceRoomId, connection)
      : null;

    // 4. Update chính xác logical room (targetDetail.id)
    await bookingModel.reassignRoomForBooking(
      bookingId,
      newRoom.id,
      connection,
      targetDetail ? targetDetail.id : null
    );

    await logHistory(
      bookingId,
      "room_reassigned",
      `Đổi phòng từ ${currentRoom?.roomNumber || sourceRoomId || 'Chưa gán'} sang ${newRoom.roomNumber}${targetDetail ? ` (Phòng #${targetDetail.id})` : ''}`,
      {
        entityType: "room",
        entityId: sourceRoomId,
        bookingDetailId: targetDetail?.id || null,
        oldValue: {
          roomId: sourceRoomId,
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

    if (toRoom.status === "occupied") {
      throw new HttpError(409, "Phòng muốn chuyển đến hiện đang có khách ở (occupied)");
    }

    // Xác định logical room nguồn từ booking_details
    const [details] = await connection.query(
      `SELECT bd.*, r.roomNumber, r.status AS roomStatus, rt.typeName AS roomTypeName, rt.defaultPrice
       FROM booking_details bd
       LEFT JOIN rooms r ON r.id = bd.roomId
       LEFT JOIN room_types rt ON rt.id = COALESCE(bd.roomTypeId, r.roomTypeId)
       WHERE bd.bookingId = ?
       ORDER BY bd.id ASC FOR UPDATE`,
      [bookingId]
    );

    const isAlreadyAssigned = (details || []).some((d) => Number(d.roomId) === Number(toRoom.id));
    if (isAlreadyAssigned) {
      throw new HttpError(409, "Không thể chuyển sang phòng đang thuộc cùng đơn đặt phòng");
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

    let sourceDetail = null;
    if (payload.bookingDetailId) {
      sourceDetail = details.find((d) => Number(d.id) === Number(payload.bookingDetailId));
    } else if (payload.fromRoomId) {
      sourceDetail = details.find((d) => Number(d.roomId) === Number(payload.fromRoomId));
    } else if (details.length === 1) {
      sourceDetail = details[0];
    } else {
      sourceDetail = details.find((d) => Number(d.roomId) === Number(booking.room_id)) || details[0];
    }

    if (!sourceDetail && details.length > 0) {
      throw new HttpError(400, "Vui lòng chọn phòng cần chuyển");
    }

    const fromRoomId = sourceDetail?.roomId || payload.fromRoomId || booking.room_id;
    const fromRoom = await bookingModel.getRoomWithType(
      fromRoomId,
      connection,
    );
    if (!fromRoom) {
      throw new HttpError(404, "Không tìm thấy thông tin phòng muốn chuyển");
    }

    await bookingModel.transferBookingRoom(
      booking,
      toRoom,
      payload,
      connection,
      sourceDetail,
    );
    await bookingModel.updateRoomStatus(
      fromRoomId,
      "available",
      connection,
    );
    await bookingModel.updateRoomStatus(toRoom.id, "occupied", connection);

    // Tính giá phòng cũ và phòng mới CHỈ cho phòng chuyển [splitDate, stayEnd)
    const oldPricePerNight = Number(sourceDetail?.roomPrice || fromRoom?.price_per_night || fromRoom?.defaultPrice || 0);
    const oldPastStage = await calcNightlyPrices(
      fromRoom.roomTypeId,
      oldPricePerNight,
      stayStart,
      splitDate,
      connection,
      fromRoom.id,
    );
    const oldRemainingStage = await calcNightlyPrices(
      fromRoom.roomTypeId,
      oldPricePerNight,
      splitDate,
      stayEnd,
      connection,
      fromRoom.id,
    );

    // Phòng mới tính theo bảng giá ngày lễ / chủ nhật / ngày thường của phòng mới
    const newStage = await calcNightlyPrices(
      toRoom.roomTypeId,
      Number(toRoom.price_per_night || toRoom.defaultPrice || 0),
      splitDate,
      stayEnd,
      connection,
      toRoom.id,
    );

    const priceDifference = Number(newStage.total || 0) - Number(oldRemainingStage.total || 0);
    const previousTotal = Number(booking.total_price || 0);
    const newTotalPrice = previousTotal + priceDifference;

    // Cập nhật bảng booking_nightly_prices:
    // 1. Gán roomId cho các đêm cũ trước splitDate nếu chưa có
    await connection.query(
      `UPDATE booking_nightly_prices
       SET roomId = COALESCE(roomId, ?)
       WHERE bookingId = ? AND stayDate < ?`,
      [fromRoomId, bookingId, splitDate]
    );
    // 2. Xóa các đêm cũ của đúng phòng chuyển từ splitDate trở đi
    await connection.query(
      `DELETE FROM booking_nightly_prices WHERE bookingId = ? AND stayDate >= ? AND (roomId = ? OR ? IS NULL)`,
      [bookingId, splitDate, fromRoomId, fromRoomId]
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
          nights: oldPastStage.nights,
          amount: oldPastStage.total,
          nightlyPrices: oldPastStage.prices,
          remainingNights: oldRemainingStage.nights,
          remainingAmount: oldRemainingStage.total,
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
  early: "nhận phòng sớm",
  on_time: "nhận phòng đúng giờ",
  late: "nhận phòng muộn (miễn phí)",
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

    // Không bắt buộc thanh toán 100% khi Check-in. Ghi nhận thông tin thanh toán để thu trước/khi Check-out.
    const payment = await paymentService.getPaymentByBookingId(bookingId);
    const paidAmount = Number(payment?.paidAmount || 0);
    const remainingAmount = Number(payment?.remainingAmount || 0);
    const hasUnpaidDebt = remainingAmount > 0;

    const now = new Date();
    const standardCheckInTime = tiers?.standardCheckInTime || '14:00:00';
    const standardCheckOutTime = tiers?.standardCheckOutTime || '12:00:00';
    const isLateConfirmed = Boolean(booking.late_arrival_confirmed || booking.lateArrivalConfirmed);

    const checkInDay = new Date(`${dayString(booking.check_in)}T00:00:00`);
    if (now < checkInDay) {
      throw new HttpError(409, "Chưa đến ngày nhận phòng");
    }

    if (!isWithinLateCheckInWindow(booking.check_in, standardCheckInTime, now, isLateConfirmed, booking.check_out, standardCheckOutTime)) {
      throw new HttpError(
        409,
        `Đã quá thời hạn nhận phòng (hạn giữ phòng mặc định 24 giờ tính từ giờ nhận phòng chuẩn hoặc đến hết kỳ lưu trú). Vui lòng liên hệ lễ tân.`,
      );
    }

    const standardCheckIn = combineDateTime(
      booking.check_in,
      standardCheckInTime,
    );
    const checkInTiming =
      now < standardCheckIn
        ? "early"
        : now > standardCheckIn
          ? "late"
          : "on_time";

    // Lấy tất cả phòng vật lý từ booking_details (source of truth), fallback sang booking.room_id cho đơn cũ
    const [details] = await connection.query(
      `SELECT bd.id AS bookingDetailId, bd.roomId, r.roomNumber, r.status AS roomStatus
       FROM booking_details bd
       LEFT JOIN rooms r ON r.id = bd.roomId
       WHERE bd.bookingId = ?
       ORDER BY bd.id ASC FOR UPDATE`,
      [bookingId],
    );

    const roomIds = details.length > 0
      ? [...new Set(details.map((d) => d.roomId).filter(Boolean))]
      : (booking.room_id ? [booking.room_id] : []);

    if (roomIds.length === 0) {
      throw new HttpError(400, "Đơn đặt phòng chưa được gán phòng vật lý để nhận phòng");
    }

    // Validate toàn bộ phòng TRƯỚC KHI thực hiện bất kỳ mutation nào
    for (const rId of roomIds) {
      const [roomRows] = await connection.query(
        `SELECT id, roomNumber, status FROM rooms WHERE id = ? FOR UPDATE`,
        [rId],
      );
      const room = roomRows[0];
      if (!room) {
        throw new HttpError(404, `Không tìm thấy phòng (#${rId})`);
      }
      if (room.status === "maintenance") {
        throw new HttpError(
          409,
          `Phòng ${room.roomNumber || rId} đang được dọn dẹp/bảo trì nên chưa thể nhận phòng. Vui lòng liên hệ lễ tân để được xếp phòng khác hoặc chờ dọn xong.`,
        );
      }
      const activeOccupant = await bookingModel.findActiveCheckedInBooking(
        rId,
        bookingId,
        connection,
      );
      if (activeOccupant) {
        throw new HttpError(
          409,
          `Phòng ${room.roomNumber || rId} hiện đang có khách khác lưu trú (đặt phòng #${activeOccupant.id}) chưa trả phòng. Vui lòng liên hệ lễ tân để xử lý trước khi nhận phòng mới.`,
        );
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
    for (const rId of roomIds) {
      await bookingModel.updateRoomStatus(
        rId,
        "occupied",
        connection,
      );
    }
    await bookingModel.updateActualCheckInTime(bookingId, now, connection);

    let earlySurchargeRecord = null;
    if (payload.applyEarlySurcharge && Number(payload.earlySurchargeAmount || 0) > 0) {
      const surchargeAmt = Number(payload.earlySurchargeAmount);
      const timeLabel = payload.earlyTimeLabel ? ` (${payload.earlyTimeLabel})` : '';
      const [svcRes] = await connection.query(
        `INSERT INTO booking_services (bookingId, roomId, serviceId, unitPrice, quantity, totalPrice, status, usedAt)
         VALUES (?, ?, NULL, ?, 1, ?, 'used', ?)`,
        [bookingId, roomIds[0] || null, surchargeAmt, surchargeAmt, now]
      );
      earlySurchargeRecord = { id: svcRes.insertId, amount: surchargeAmt };
    }

    const wasLate = checkInTiming === "late";
    const timingLabel = CHECK_IN_TIMING_LABEL[checkInTiming];
    const roomNumbersStr = details.length > 0
      ? details.map((d) => d.roomNumber || d.roomId).filter(Boolean).join(", ")
      : (booking.room_number || booking.room_id || "");

    const paymentNote = hasUnpaidDebt
      ? ` (Đã thanh toán: ${displayMoney(paidAmount)}, còn lại: ${displayMoney(remainingAmount + (earlySurchargeRecord?.amount || 0))})`
      : earlySurchargeRecord
        ? ` (Đã thanh toán: ${displayMoney(paidAmount)}, phụ thu nhận phòng sớm: +${displayMoney(earlySurchargeRecord.amount)})`
        : ` (Đã thanh toán đủ: ${displayMoney(paidAmount)})`;

    await logHistory(
      bookingId,
      "checked_in",
      `Khách nhận phòng (${timingLabel})${roomNumbersStr ? ` - Phòng: ${roomNumbersStr}` : ""}${paymentNote}${Array.isArray(payload.guests) && payload.guests.length > 0 ? `. Khách lưu trú: ${payload.guests.map((g) => g.fullName).join(", ")}` : ""}`,
      {
        entityType: "stay",
        entityId: booking.room_id,
        oldValue: { status: booking.status },
        newValue: { status: "checked_in", checkInTiming, lateCheckIn: wasLate, roomIds, paidAmount, remainingAmount },
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
      paidAmount,
      remainingAmount: remainingAmount + (earlySurchargeRecord?.amount || 0),
      hasUnpaidDebt: (remainingAmount + (earlySurchargeRecord?.amount || 0)) > 0,
      earlySurcharge: earlySurchargeRecord,
      message:
        checkInTiming === "early"
          ? (earlySurchargeRecord ? `Check-in sớm thành công (+${displayMoney(earlySurchargeRecord.amount)} phụ thu). Phòng đã sẵn sàng đón khách.` : "Check-in sớm thành công. Phòng đã sẵn sàng đón khách.")
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

const markRoomCleaned = async (roomId, actor = null) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [roomRows] = await connection.query(`SELECT id, roomNumber, status FROM rooms WHERE id = ? FOR UPDATE`, [roomId]);
    const room = roomRows[0];
    if (!room) {
      throw new HttpError(404, "Không tìm thấy phòng");
    }
    await bookingModel.updateRoomStatus(roomId, "available", connection);
    await connection.commit();
    return {
      success: true,
      message: `Phòng ${room.roomNumber || roomId} đã được chuyển sang trạng thái Sẵn sàng`,
      room: { id: Number(roomId), roomNumber: room.roomNumber, status: "available" }
    };
  } catch (err) {
    await connection.rollback();
    throw err;
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
    const paidAmount = Number(paymentRow?.paidAmount || 0);

    const tiers = await bookingModel.getCheckoutLateFeeTiers(connection);
    const standardCheckInTime = tiers?.standardCheckInTime || '14:00:00';
    const standardCheckOutTime = tiers?.standardCheckOutTime || '12:00:00';
    const isLateConfirmed = Boolean(booking.late_arrival_confirmed || booking.lateArrivalConfirmed);

    if (!allowBeforeDeadline && !isPastNoShowDeadline(booking.check_in, standardCheckInTime, new Date(), isLateConfirmed, booking.check_out, standardCheckOutTime)) {
      const deadline = isLateConfirmed && booking.check_out
        ? getCheckOutDeadline(booking.check_out, standardCheckOutTime)
        : getLateNoShowDeadline(booking.check_in, standardCheckInTime, DEFAULT_ROOM_HOLD_HOURS);
      throw new HttpError(
        409,
        `Chưa đến thời điểm xử lý no-show. Hệ thống sẽ tự động xử lý sau ${deadline.toLocaleString("vi-VN")}`,
      );
    }

    await bookingModel.updateBookingStatus(bookingId, "no_show", connection);

    // Release TOÀN BỘ phòng cho đơn multi-room
    const [details] = await connection.query(
      `SELECT DISTINCT roomId FROM booking_details WHERE bookingId = ? AND roomId IS NOT NULL`,
      [bookingId]
    );
    const roomIds = details.length > 0
      ? details.map((d) => d.roomId).filter(Boolean)
      : (booking.room_id ? [booking.room_id] : []);

    for (const rId of roomIds) {
      await bookingModel.updateRoomStatus(
        rId,
        "available",
        connection,
      );
    }

    let voucher = null;
    if (paidAmount > 0 && booking.user_id) {
      voucher = await voucherService.createNoShowCompensationVoucher(
        booking.user_id,
        bookingId,
        connection,
      );
    }

    await logHistory(
      bookingId,
      "no_show",
      voucher
        ? `Đánh dấu khách không đến. Không hoàn tiền theo chính sách, tặng mã ưu đãi ${voucher.code} giảm ${Number(voucher.discountPercentage)}% cho lần lưu trú tiếp theo.`
        : `Đánh dấu khách không đến. Không hoàn tiền theo chính sách`,
      {
        oldValue: { status: booking.status },
        newValue: { status: "no_show", voucherCode: voucher?.code || null },
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
      voucher: voucher
        ? {
            code: voucher.code,
            discountPercentage: Number(voucher.discountPercentage),
            validFrom: voucher.validFrom,
            validUntil: voucher.validUntil,
            message: `Đã tặng voucher ${voucher.code} giảm ${voucher.discountPercentage}% cho lần lưu trú tiếp theo`,
          }
        : null,
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
    const tiers = await bookingModel.getCheckoutLateFeeTiers(connection);
    const standardCheckInTime = tiers?.standardCheckInTime || '14:00:00';
    const standardCheckOutTime = tiers?.standardCheckOutTime || '12:00:00';

    for (const candidate of candidates) {
      if (candidate.actual_check_in_time) {
        continue;
      }

      // Đơn còn trong thời gian giữ chỗ chờ thanh toán thuộc luồng hết hạn giữ phòng (sẽ tự hủy), không phải khách không đến.
      const holdExpiresAt = candidate.hold_expires_at ? new Date(candidate.hold_expires_at) : null;
      if (holdExpiresAt && holdExpiresAt > now && Number(candidate.paid_amount || 0) <= 0) {
        results.push({ bookingId: candidate.id, status: 'held', reason: 'Còn trong thời gian giữ chỗ chờ thanh toán' });
        continue;
      }

      const checkInDate = candidate.check_in;
      const checkOutDate = candidate.check_out;
      const lateArrivalConfirmed = Boolean(candidate.late_arrival_confirmed || candidate.lateArrivalConfirmed);

      const default24hDeadline = getLateNoShowDeadline(checkInDate, standardCheckInTime, DEFAULT_ROOM_HOLD_HOURS);
      const checkOutDeadline = getCheckOutDeadline(checkOutDate, candidate.requested_check_out_time || standardCheckOutTime);

      if (lateArrivalConfirmed) {
        // CASE B: Khách đã xác nhận sẽ đến muộn -> Bỏ qua deadline +24h, giữ phòng tối đa đến hết kỳ lưu trú (checkOutDeadline).
        if (now > checkOutDeadline) {
          const changed = await bookingModel.markBookingNoShowIfEligible(candidate.id, connection);
          if (!changed) continue;

          // Multi-room release: lấy TOÀN BỘ roomId từ booking_details
          const [details] = await connection.query(
            `SELECT DISTINCT roomId FROM booking_details WHERE bookingId = ? AND roomId IS NOT NULL`,
            [candidate.id]
          );
          const roomIds = details.length > 0
            ? details.map((d) => d.roomId).filter(Boolean)
            : (candidate.room_id ? [candidate.room_id] : []);

          for (const rId of roomIds) {
            await bookingModel.updateRoomStatus(rId, 'available', connection);
          }

          const candidatePaidAmount = Number(candidate.paid_amount || 0);
          let voucher = null;
          if (candidatePaidAmount > 0 && candidate.user_id) {
            voucher = await voucherService.createNoShowCompensationVoucher(
              candidate.user_id,
              candidate.id,
              connection
            );
          }

          await logHistory(
            candidate.id,
            'no_show',
            voucher
              ? `Khách đã xác nhận đến muộn nhưng không đến trong toàn bộ kỳ lưu trú. Đơn đặt phòng được chuyển sang trạng thái khách không đến (No-show), tặng voucher ${voucher.code} giảm ${Number(voucher.discountPercentage)}% cho lần lưu trú tiếp theo.`
              : 'Khách đã xác nhận đến muộn nhưng không đến trong toàn bộ kỳ lưu trú. Đơn đặt phòng được chuyển sang trạng thái khách không đến (No-show).',
            { oldValue: { status: candidate.status }, newValue: { status: 'no_show', reason: 'confirmed_late_past_checkout', voucherCode: voucher?.code || null } },
            { role: 'system' },
            connection
          );
          results.push({ bookingId: candidate.id, status: 'no_show', reason: 'Confirmed late arrival - past checkout deadline' });
        } else {
          results.push({ bookingId: candidate.id, status: 'held', reason: 'Confirmed late arrival - holding room until checkout' });
        }
      } else {
        // CASE A: Khách chưa xác nhận đến muộn -> Giữ phòng mặc định 24 giờ tính từ giờ check-in chuẩn.
        // Áp dụng GIỐNG NHAU cho cả khách đặt cọc và khách thanh toán full 100%.
        if (now > default24hDeadline) {
          const changed = await bookingModel.markBookingNoShowIfEligible(candidate.id, connection);
          if (!changed) continue;

          // Multi-room release: lấy TOÀN BỘ roomId từ booking_details
          const [details] = await connection.query(
            `SELECT DISTINCT roomId FROM booking_details WHERE bookingId = ? AND roomId IS NOT NULL`,
            [candidate.id]
          );
          const roomIds = details.length > 0
            ? details.map((d) => d.roomId).filter(Boolean)
            : (candidate.room_id ? [candidate.room_id] : []);

          for (const rId of roomIds) {
            await bookingModel.updateRoomStatus(rId, 'available', connection);
          }

          const candidatePaidAmount = Number(candidate.paid_amount || 0);
          let voucher = null;
          if (candidatePaidAmount > 0 && candidate.user_id) {
            voucher = await voucherService.createNoShowCompensationVoucher(
              candidate.user_id,
              candidate.id,
              connection
            );
          }

          await logHistory(
            candidate.id,
            'no_show',
            voucher
              ? `Quá thời hạn giữ phòng mặc định 24 giờ tính từ giờ nhận phòng chuẩn và không có xác nhận đến muộn. Đơn đặt phòng được chuyển sang trạng thái khách không đến (No-show), tặng voucher ${voucher.code} giảm ${Number(voucher.discountPercentage)}% cho lần lưu trú tiếp theo.`
              : 'Quá thời hạn giữ phòng mặc định 24 giờ tính từ giờ nhận phòng chuẩn và không có xác nhận đến muộn. Đơn đặt phòng được chuyển sang trạng thái khách không đến (No-show).',
            { oldValue: { status: candidate.status }, newValue: { status: 'no_show', reason: 'unconfirmed_past_24h_hold', voucherCode: voucher?.code || null } },
            { role: 'system' },
            connection
          );
          results.push({ bookingId: candidate.id, status: 'no_show', reason: 'Unconfirmed - past 24h hold deadline' });
        } else {
          results.push({ bookingId: candidate.id, status: 'held', reason: 'Within default 24h hold window' });
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

const recordCustomerContact = async (
  bookingId,
  { action, note = '' } = {},
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
      throw new HttpError(400, 'Đặt phòng đã nhận phòng (Check-in), không thể cập nhật trạng thái liên hệ');
    }

    const currentStatus = (booking.status || '').toLowerCase();
    if (['cancelled', 'no_show', 'checked_out'].includes(currentStatus)) {
      throw new HttpError(400, `Không thể cập nhật trạng thái liên hệ cho đơn ở trạng thái ${bookingStatusLabel(booking.status)}`);
    }

    const now = new Date();
    const actorId = actor?.userId || null;
    const trimmedNote = (note || '').trim();

    if (action === 'will_arrive_late') {
      if (!trimmedNote) {
        throw new HttpError(400, 'Vui lòng nhập lý do / ghi chú khi xác nhận khách sẽ đến muộn');
      }

      await bookingModel.updateLateArrivalContact(
        bookingId,
        {
          lateArrivalConfirmed: true,
          lateArrivalNote: trimmedNote,
          lateArrivalConfirmedAt: now,
          lateArrivalConfirmedBy: actorId,
          contactResult: 'will_arrive_late'
        },
        connection
      );

      await logHistory(
        bookingId,
        'late_arrival_confirmed',
        `Xác nhận khách sẽ đến muộn. Lý do: ${trimmedNote}. Tiếp tục giữ phòng cho khách đến hết kỳ lưu trú.`,
        {
          contactResult: 'will_arrive_late',
          lateArrivalConfirmed: true,
          note: trimmedNote
        },
        actor,
        connection
      );

      await connection.commit();
      const updated = await bookingModel.getBookingById(bookingId);
      return {
        success: true,
        message: 'Đã xác nhận khách sẽ đến muộn. Phòng sẽ được giữ đến hết kỳ lưu trú.',
        booking: updated
      };
    }

    if (action === 'unreachable') {
      await bookingModel.updateLateArrivalContact(
        bookingId,
        {
          lateArrivalConfirmed: false,
          lateArrivalNote: trimmedNote || null,
          lateArrivalConfirmedAt: now,
          lateArrivalConfirmedBy: actorId,
          contactResult: 'unreachable'
        },
        connection
      );

      await logHistory(
        bookingId,
        'contact_unreachable',
        `Đã liên hệ khách nhưng không liên lạc được${trimmedNote ? `. Ghi chú: ${trimmedNote}` : ''}. Tiếp tục giữ phòng theo hạn 24 giờ mặc định.`,
        {
          contactResult: 'unreachable',
          lateArrivalConfirmed: false,
          note: trimmedNote
        },
        actor,
        connection
      );

      await connection.commit();
      const updated = await bookingModel.getBookingById(bookingId);
      return {
        success: true,
        message: 'Đã ghi nhận không liên hệ được. Phòng được giữ theo hạn 24 giờ mặc định.',
        booking: updated
      };
    }

    if (action === 'callback_later') {
      await bookingModel.updateLateArrivalContact(
        bookingId,
        {
          lateArrivalConfirmed: false,
          lateArrivalNote: trimmedNote || null,
          lateArrivalConfirmedAt: now,
          lateArrivalConfirmedBy: actorId,
          contactResult: 'callback_later'
        },
        connection
      );

      await logHistory(
        bookingId,
        'contact_callback_later',
        `Đã liên hệ khách — cần liên hệ lại sau${trimmedNote ? `. Ghi chú: ${trimmedNote}` : ''}. Phòng được giữ theo hạn 24 giờ mặc định.`,
        {
          contactResult: 'callback_later',
          lateArrivalConfirmed: false,
          note: trimmedNote
        },
        actor,
        connection
      );

      await connection.commit();
      const updated = await bookingModel.getBookingById(bookingId);
      return {
        success: true,
        message: 'Đã ghi nhận cần liên hệ lại sau. Phòng được giữ theo hạn 24 giờ mặc định.',
        booking: updated
      };
    }

    if (action === 'not_coming') {
      await bookingModel.updateLateArrivalContact(
        bookingId,
        {
          lateArrivalConfirmed: false,
          lateArrivalNote: trimmedNote || null,
          lateArrivalConfirmedAt: now,
          lateArrivalConfirmedBy: actorId,
          contactResult: 'not_coming'
        },
        connection
      );

      // Chuyển sang no-show ngay và giải phóng toàn bộ phòng
      const noShowResult = await markNoShow(bookingId, {
        allowBeforeDeadline: true,
        connection,
        actor,
        note: trimmedNote
      });

      await logHistory(
        bookingId,
        'customer_confirmed_not_coming',
        `Khách xác nhận không đến qua liên hệ trực tiếp${trimmedNote ? `. Lý do: ${trimmedNote}` : ''}. Đã chuyển sang No-show và giải phóng phòng.`,
        {
          contactResult: 'not_coming',
          note: trimmedNote
        },
        actor,
        connection
      );

      await connection.commit();
      const updated = await bookingModel.getBookingById(bookingId);
      return {
        success: true,
        message: 'Đã ghi nhận khách xác nhận không đến. Đặt phòng đã chuyển sang No-show và giải phóng phòng.',
        booking: updated,
        voucher: noShowResult.voucher,
        refundPolicy: noShowResult.refundPolicy
      };
    }

    throw new HttpError(400, `Hành động liên hệ không hợp lệ: ${action}`);
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
      `Cập nhật giờ nhận phòng dự kiến mới: ${timeStr.slice(0, 5)}${offsetText}${descNote}`,
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

const extendRoomHoldDeadline = async (
  bookingId,
  { additionalHours = 2, note = '' } = {},
  actor = null
) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Không tìm thấy đặt phòng');
    }
    if (['cancelled', 'no_show', 'checked_out', 'checked_in'].includes(booking.status)) {
      throw new HttpError(400, `Không thể gia hạn giữ phòng cho đơn ở trạng thái ${booking.status}`);
    }

    const now = new Date();
    const hours = Math.max(1, Math.min(24, Number(additionalHours || 2)));
    const targetTime = new Date(now.getTime() + hours * 3600000);
    const pad = (n) => String(n).padStart(2, '0');
    const newTimeStr = `${pad(targetTime.getHours())}:${pad(targetTime.getMinutes())}:00`;
    const isNextDay = targetTime.getDate() !== now.getDate() ? 1 : 0;

    await bookingModel.updateRequestedCheckInTime(bookingId, newTimeStr, isNextDay, connection);

    const reasonNote = note ? ` (Lý do: ${note})` : '';
    await logHistory(
      bookingId,
      'hold_extended',
      `Gia hạn thời gian giữ phòng thêm ${hours} giờ (Hẹn đến mới: ${newTimeStr.slice(0, 5)}${isNextDay ? ' ngày hôm sau' : ''})${reasonNote}`,
      {
        oldValue: { requestedCheckInTime: booking.requested_check_in_time, offset: booking.requested_check_in_day_offset },
        newValue: { requestedCheckInTime: newTimeStr, offset: isNextDay, hours }
      },
      actor,
      connection
    );

    await connection.commit();
    const updated = await bookingModel.getBookingById(bookingId);
    return {
      success: true,
      message: `Đã gia hạn giữ phòng thêm ${hours} giờ thành công`,
      booking: updated
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/* Phiên bản cũ chỉ xử lý bookings.room_id nên không an toàn cho booking nhiều phòng.
const reactivateNoShowBookingLegacy = async (
  bookingId,
  { targetRoomId = null, note = '' } = {},
  actor = null
) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, 'Không tìm thấy đặt phòng');
    }
    if (booking.status !== 'no_show') {
      throw new HttpError(400, 'Chỉ có thể khôi phục đơn đặt phòng đang ở trạng thái No-show');
    }

    let assignedRoomId = targetRoomId ? Number(targetRoomId) : booking.room_id;
    let roomRows = [];

    if (assignedRoomId) {
      const [rows] = await connection.query(
        `SELECT id, roomNumber, status, roomTypeId FROM rooms WHERE id = ? FOR UPDATE`,
        [assignedRoomId]
      );
      roomRows = rows;
    }

    let allocatedRoom = roomRows[0];
    if (!allocatedRoom || allocatedRoom.status !== 'available') {
      // Tìm phòng cùng hạng đang available
      const [availRows] = await connection.query(
        `SELECT id, roomNumber, status, roomTypeId FROM rooms WHERE roomTypeId = ? AND status = 'available' LIMIT 1 FOR UPDATE`,
        [booking.room_type_id]
      );
      if (availRows.length > 0) {
        allocatedRoom = availRows[0];
        assignedRoomId = allocatedRoom.id;
      } else {
        throw new HttpError(
          409,
          `Phòng cũ (P.${booking.room_number}) hiện không còn trống và không còn phòng cùng hạng nào khác. Vui lòng chọn đổi sang hạng phòng khác trước khi khôi phục.`
        );
      }
    }

    // Nếu gán phòng khác phòng cũ trong booking
    if (assignedRoomId !== booking.room_id) {
      await connection.query(
        `UPDATE bookings SET room_id = ? WHERE id = ?`,
        [assignedRoomId, bookingId]
      );
      await connection.query(
        `UPDATE booking_details SET room_id = ? WHERE booking_id = ?`,
        [assignedRoomId, bookingId]
      );
    }

    // Đổi trạng thái phòng sang occupied và booking sang checked_in
    const now = new Date();
    await bookingModel.updateRoomStatus(assignedRoomId, 'occupied', connection);
    await bookingModel.updateBookingStatus(bookingId, 'checked_in', connection);
    await bookingModel.updateActualCheckInTime(bookingId, now, connection);

    const reasonNote = note ? ` Ghi chú: ${note}.` : '';
    await logHistory(
      bookingId,
      'reactivated_from_no_show',
      `Khôi phục đơn đặt phòng sau No-show và thực hiện nhận phòng ngay (Phòng: ${allocatedRoom.roomNumber}).${reasonNote}`,
      {
        oldValue: { status: 'no_show', room_id: booking.room_id },
        newValue: { status: 'checked_in', room_id: assignedRoomId, actual_check_in_time: now }
      },
      actor,
      connection
    );

    await connection.commit();
    const updated = await bookingModel.getBookingById(bookingId);
    return {
      success: true,
      message: `Đã khôi phục và check-in thành công cho khách vào phòng ${allocatedRoom.roomNumber}`,
      booking: updated
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

*/
const reactivateNoShowBooking = async (
  bookingId,
  { targetRoomId = null, note = '' } = {},
  actor = null
) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) throw new HttpError(404, 'Không tìm thấy đặt phòng');
    if (booking.status !== 'no_show') {
      throw new HttpError(409, 'Chỉ có thể khôi phục đơn đang ở trạng thái No-show');
    }
    const checkoutDeadline = new Date(booking.check_out);
    if (!Number.isNaN(checkoutDeadline.getTime()) && new Date() >= checkoutDeadline) {
      throw new HttpError(
        409,
        'Đơn đã quá thời gian trả phòng nên không thể check-in muộn. Vui lòng tạo booking mới.'
      );
    }

    const [details] = await connection.query(
      `SELECT bd.id, bd.roomId, COALESCE(bd.roomTypeId, r.roomTypeId) AS roomTypeId,
              r.roomNumber AS originalRoomNumber, rt.typeName AS roomTypeName
       FROM booking_details bd
       LEFT JOIN rooms r ON r.id = bd.roomId
       LEFT JOIN room_types rt ON rt.id = COALESCE(bd.roomTypeId, r.roomTypeId)
       WHERE bd.bookingId = ?
       ORDER BY bd.id
       FOR UPDATE`,
      [bookingId]
    );
    const roomDetails = details.length > 0 ? details : [{
      id: null,
      roomId: booking.room_id,
      roomTypeId: booking.room_type_id,
      originalRoomNumber: booking.room_number,
      roomTypeName: booking.room_type_name
    }];
    const usedRoomIds = new Set();
    const allocations = [];

    for (let index = 0; index < roomDetails.length; index += 1) {
      const detail = roomDetails[index];
      const preferredRoomId = index === 0 && targetRoomId
        ? Number(targetRoomId)
        : Number(detail.roomId || 0);
      let allocatedRoom = null;

      if (preferredRoomId && !usedRoomIds.has(preferredRoomId)) {
        const [preferredRows] = await connection.query(
          `SELECT id, roomNumber, status, roomTypeId FROM rooms
           WHERE id = ? AND COALESCE(isDeleted, 0) = 0
             AND NOT EXISTS (
               SELECT 1 FROM booking_details obd
               JOIN bookings ob ON ob.id = obd.bookingId
               WHERE obd.roomId = rooms.id AND ob.id <> ?
                 AND ob.status NOT IN ('cancelled', 'checked_out', 'no_show')
                 AND NOW() >= ob.check_in AND NOW() < ob.check_out
             )
           FOR UPDATE`,
          [preferredRoomId, bookingId]
        );
        const preferred = preferredRows[0];
        if (preferred && preferred.status === 'available'
          && Number(preferred.roomTypeId) === Number(detail.roomTypeId)) {
          allocatedRoom = preferred;
        }
      }

      if (!allocatedRoom) {
        const excludedIds = [...usedRoomIds];
        const exclusionSql = excludedIds.length
          ? `AND id NOT IN (${excludedIds.map(() => '?').join(', ')})`
          : '';
        const [availableRows] = await connection.query(
          `SELECT id, roomNumber, status, roomTypeId FROM rooms
           WHERE roomTypeId = ? AND status = 'available'
             AND COALESCE(isDeleted, 0) = 0
             AND NOT EXISTS (
               SELECT 1 FROM booking_details obd
               JOIN bookings ob ON ob.id = obd.bookingId
               WHERE obd.roomId = rooms.id AND ob.id <> ?
                 AND ob.status NOT IN ('cancelled', 'checked_out', 'no_show')
                 AND NOW() >= ob.check_in AND NOW() < ob.check_out
             )
             ${exclusionSql}
           ORDER BY id LIMIT 1 FOR UPDATE`,
          [detail.roomTypeId, bookingId, ...excludedIds]
        );
        allocatedRoom = availableRows[0] || null;
      }

      if (!allocatedRoom) {
        throw new HttpError(
          409,
          `Không còn phòng trống cho hạng ${detail.roomTypeName || detail.roomTypeId}`
          + ` (phòng gốc: ${detail.originalRoomNumber || 'chưa gán'}).`
        );
      }
      usedRoomIds.add(Number(allocatedRoom.id));
      allocations.push({ detail, room: allocatedRoom });
    }

    for (const { detail, room } of allocations) {
      if (detail.id && Number(detail.roomId) !== Number(room.id)) {
        await connection.query(
          'UPDATE booking_details SET roomId = ?, roomTypeId = ? WHERE id = ? AND bookingId = ?',
          [room.id, room.roomTypeId, detail.id, bookingId]
        );
      }
      await bookingModel.updateRoomStatus(room.id, 'occupied', connection);
    }

    const primaryRoom = allocations[0].room;
    const roomNumbers = allocations.map(({ room }) => room.roomNumber);
    const now = new Date();
    await connection.query('UPDATE bookings SET room_id = ? WHERE id = ?', [primaryRoom.id, bookingId]);
    await bookingModel.updateBookingStatus(bookingId, 'checked_in', connection);
    await bookingModel.updateActualCheckInTime(bookingId, now, connection);

    const reasonNote = note ? ` Ghi chú: ${note}.` : '';
    await logHistory(
      bookingId,
      'reactivated_from_no_show',
      `Khôi phục đơn khách không đến và nhận phòng ngay (Phòng: ${roomNumbers.join(', ')}).${reasonNote}`,
      {
        oldValue: { status: 'no_show', room_id: booking.room_id },
        newValue: {
          status: 'checked_in',
          room_id: primaryRoom.id,
          room_ids: allocations.map(({ room }) => room.id),
          actual_check_in_time: now
        }
      },
      actor,
      connection
    );

    await connection.commit();
    return {
      success: true,
      message: `Đã khôi phục và check-in thành công phòng ${roomNumbers.join(', ')}`,
      booking: await bookingModel.getBookingById(bookingId)
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const checkOut = async (
  bookingId,
  actualCheckOutTimeInput,
  actor = null,
  { waiveLateFee = false } = {},
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
    let lateCheckoutWarning = null;
    let conflictingBookingId = null;
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

        // Quá mốc trả phòng muộn tối đa thì CẢNH BÁO chứ không chặn.
        //
        // Chặn ở đây là bế tắc: khách đang đứng ở quầy, tiền đã thu đủ, mà lễ
        // tân không bấm trả phòng được. Phòng kẹt mãi ở trạng thái đang có
        // khách, nên khách kế tiếp cũng không nhận phòng được — hỏng cả hai
        // đơn thay vì một. Việc cần làm là thu phí bậc cao nhất rồi báo lễ tân
        // xếp lại phòng cho khách sau.
        if (actualCheckOutTime > maxCheckoutTime) {
          lateCheckoutWarning = nextBooking
            ? `Phòng đã có khách khác nhận phòng ngày ${displayDate(nextBooking.checkInDate)}. Vui lòng dọn phòng gấp hoặc chuyển phòng cho khách đó.`
            : `Khách trả phòng muộn quá ${tiers.absoluteMaxLateHours} giờ so với giờ chuẩn. Cân nhắc lập gia hạn thêm đêm thay vì chỉ thu phí trễ giờ.`;
          conflictingBookingId = nextBooking?.id || null;
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
          if (!waiveLateFee) {
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
              { entityType: "stay", amount: result.feeAmount },
              actor,
              connection,
            );
          } else {
            await logHistory(
              bookingId,
              "late_checkout_fee_waived",
              `Miễn phí phụ thu trả phòng muộn (${result.percent}% giá đêm = ${displayMoney(result.feeAmount)}) cho khách hàng`,
              {
                entityType: "stay",
                amount: result.feeAmount,
                newValue: { waivedAmount: result.feeAmount },
              },
              actor,
              connection,
            );
          }
        }

        // Ghi lại để sau này còn truy được vì sao phòng bị trả trễ quá mốc.
        if (lateCheckoutWarning) {
          await logHistory(
            bookingId,
            "late_checkout_over_limit",
            `Trả phòng muộn vượt mốc cho phép. ${lateCheckoutWarning}`,
            {
              entityType: "stay",
              newValue: { conflictingBookingId },
            },
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
        return { requiresPayment: true, lateCheckout, lateCheckoutWarning, conflictingBookingId };
      }
      throw new HttpError(
        409,
        "Vui lòng thanh toán toàn bộ tiền phòng và chi phí phát sinh trước khi check-out",
      );
    }

    // Lấy tất cả phòng vật lý từ booking_details (source of truth), fallback sang booking.room_id cho đơn cũ
    const [details] = await connection.query(
      `SELECT bd.id AS bookingDetailId, bd.roomId, r.roomNumber, r.status AS roomStatus
       FROM booking_details bd
       LEFT JOIN rooms r ON r.id = bd.roomId
       WHERE bd.bookingId = ?
       ORDER BY bd.id ASC FOR UPDATE`,
      [bookingId],
    );

    const roomIds = details.length > 0
      ? [...new Set(details.map((d) => d.roomId).filter(Boolean))]
      : (booking.room_id ? [booking.room_id] : []);

    await bookingModel.updateBookingStatus(
      bookingId,
      "checked_out",
      connection,
    );
    for (const rId of roomIds) {
      await connection.query(
        "UPDATE rooms SET status = 'maintenance', maintenanceNote = 'Dọn dẹp sau check-out (Chờ dọn dẹp)', maintenanceExpectedCompletion = NULL WHERE id = ?",
        [rId],
      );
    }

    let earlyCheckout = null;
    const today = dayString(new Date());
    const checkOutDay = dayString(booking.check_out);

    if (today < checkOutDay) {
      // Lấy danh sách booking_details để tính tiền các đêm chưa ở cho từng phòng
      const [detailRows] = await connection.query(
        `SELECT bd.id, bd.roomId, bd.roomTypeId, bd.roomPrice, r.roomTypeId AS actualRoomTypeId, rt.defaultPrice
         FROM booking_details bd
         LEFT JOIN rooms r ON r.id = bd.roomId
         LEFT JOIN room_types rt ON rt.id = COALESCE(bd.roomTypeId, r.roomTypeId)
         WHERE bd.bookingId = ?
         ORDER BY bd.id ASC`,
        [bookingId],
      );

      let totalUnusedAmount = 0;
      let totalUnusedNights = 0;
      const detailsToProcess = detailRows.length > 0
        ? detailRows
        : [{
            roomId: booking.room_id,
            roomTypeId: booking.roomTypeId,
            roomPrice: booking.price_per_night || 0,
          }];

      for (const d of detailsToProcess) {
        const effectiveRoomTypeId = d.roomTypeId || d.actualRoomTypeId || booking.roomTypeId || 1;
        const basePrice = Number(d.roomPrice || d.defaultPrice || 0);

        const unusedNightly = await calcNightlyPrices(
          effectiveRoomTypeId,
          basePrice,
          today,
          checkOutDay,
          connection,
          d.roomId || null,
        );

        totalUnusedAmount += Number(unusedNightly.total || 0);
        totalUnusedNights = Math.max(totalUnusedNights, Number(unusedNightly.nights || 0));
      }

      const refundAmount = Math.min(
        Math.round(totalUnusedAmount * 0.5),
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
            `Check-out sớm: hoàn 50% của ${totalUnusedNights} đêm chưa ở (${today} → ${checkOutDay})`,
          ],
        );

        earlyCheckout = {
          refundId: result.insertId,
          unusedNights: totalUnusedNights,
          unusedAmount: totalUnusedAmount,
          refundRate: 0.5,
          refundAmount,
          status: "pending",
          message: `Check-out sớm ${totalUnusedNights} đêm. Hoàn 50% = ${refundAmount.toLocaleString("vi-VN")}₫, chờ khách sạn duyệt.`,
        };
      }
    }

    const roomNumbersStr = details.length > 0
      ? details.map((d) => d.roomNumber || d.roomId).filter(Boolean).join(", ")
      : (booking.room_number || booking.room_id || "");

    await logHistory(
      bookingId,
      "checked_out",
      `Khách trả phòng${roomNumbersStr ? ` (Phòng: ${roomNumbersStr})` : ""}${earlyCheckout ? ` sớm ${earlyCheckout.unusedNights} đêm (dự kiến ${displayDate(checkOutDay)}). Tạo yêu cầu hoàn 50% = ${displayMoney(earlyCheckout.refundAmount)} chờ duyệt` : ""}`,
      {
        entityType: "stay",
        entityId: booking.room_id,
        oldValue: { status: "checked_in", checkOut: checkOutDay },
        newValue: { status: "checked_out", actualCheckOut: today, roomIds },
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
    const completedBooking = await bookingModel.getBookingById(bookingId);
    const bookingServices = await bookingModel.getBookingServicesByBookingId(bookingId);
    void emailService.sendCheckoutThankYou(
      { ...completedBooking, services: bookingServices },
      payment,
    );
    return {
      ...completedBooking,
      earlyCheckout,
      lateCheckout,
      // Trả phòng vẫn thành công, nhưng lễ tân cần biết phòng này đang kẹt lịch
      // với khách kế tiếp để còn dọn gấp hoặc xếp lại phòng.
      lateCheckoutWarning,
      conflictingBookingId,
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

    // Requirement 1: Giới hạn số lần reset thời gian giữ phòng (tối đa 1 lần, +5 phút)
    const currentResetCount = Number(booking.hold_reset_count || 0);
    if (currentResetCount >= MAX_HOLD_RESETS) {
      throw new HttpError(
        400,
        `Đã đạt giới hạn tối đa ${MAX_HOLD_RESETS} lần gia hạn giữ phòng (+${HOLD_RESET_MINUTES} phút). Vui lòng hoàn tất thanh toán hoặc thực hiện đặt phòng mới.`
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

    // Gia hạn nghĩa là cộng thêm vào thời hạn đang chạy, không đặt lại bộ đếm
    // thành đúng 5 phút kể từ lúc bấm. Ví dụ còn 8 phút thì sau khi gia hạn sẽ
    // còn khoảng 13 phút (vẫn bị giới hạn bởi trần 20 phút từ lúc tạo đơn).
    const currentExpiresMs = booking.hold_expires_at
      ? new Date(booking.hold_expires_at).getTime()
      : createdAtMs + HOLD_MINUTES * 60 * 1000;
    const proposedExpiresMs = Math.max(currentExpiresMs, nowMs)
      + HOLD_RESET_MINUTES * 60 * 1000;
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
        entityId: null,
        newValue: {
          holdResetCount: newResetCount,
          holdExpiresAt: newExpiresAt,
        },
      },
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

  const [existingDetails] = await db.query(
    `SELECT id, roomId, roomTypeId, roomPrice, occupancySurcharge
     FROM booking_details
     WHERE bookingId = ?
     ORDER BY id ASC`,
    [bookingId]
  );

  // Guard: Không cho phép đổi physical room hoặc thêm/bớt phòng đối với đơn đã checked_in
  if (booking.status === "checked_in") {
    if (existingDetails.length > 0 && proposedRooms.length !== existingDetails.length) {
      throw new HttpError(
        409,
        "Đơn đặt phòng đã nhận phòng (checked-in). Không thể thêm hoặc bớt số lượng phòng qua Chỉnh sửa đơn. Vui lòng sử dụng các chức năng nghiệp vụ chuyên biệt."
      );
    }

    for (let i = 0; i < proposedRooms.length; i++) {
      const incoming = proposedRooms[i];
      const matched = (existingDetails || []).find(
        (d) => (incoming.bookingDetailId && d.id === incoming.bookingDetailId) || (incoming.id && d.id === incoming.id)
      ) || existingDetails[i];

      if (matched && incoming.roomId && Number(incoming.roomId) !== Number(matched.roomId)) {
        throw new HttpError(
          409,
          "Đơn đặt phòng đã nhận phòng (checked-in). Không thể thay đổi gán phòng vật lý qua Chỉnh sửa đơn. Vui lòng sử dụng chức năng Chuyển phòng."
        );
      }
    }
  }

  const childrenPolicy = await getChildrenPolicy();
  let newRoomTotal = 0;
  const processedRooms = [];
  const roomSlots = [];
  const allChildrenAges = [];
  let totalEffectiveAdults = 0;
  let totalEffectiveChildren = 0;

  for (const r of proposedRooms) {
    let roomPrice = 0;
    let typeName = "";
    let roomNumber = "";
    let roomTypeId = r.roomTypeId;
    let roomTypeObj = null;

    if (r.roomId) {
      const [roomRows] = await db.query(
        `SELECT r.*, rt.typeName, rt.defaultPrice, rt.capacity, rt.adultCapacity, rt.childCapacity, rt.maxOccupancy, rt.extraAdultFee, rt.extraChildFee
         FROM rooms r
         JOIN room_types rt ON r.roomTypeId = rt.id
         WHERE r.id = ?`,
        [r.roomId]
      );
      if (roomRows[0]) {
        typeName = roomRows[0].typeName;
        roomNumber = roomRows[0].roomNumber;
        roomTypeId = roomRows[0].roomTypeId;
        roomTypeObj = roomRows[0];
      }
    }
    if (!roomTypeObj && roomTypeId) {
      const [typeRows] = await db.query(`SELECT * FROM room_types WHERE id = ?`, [roomTypeId]);
      if (typeRows[0]) {
        typeName = typeRows[0].typeName;
        roomTypeObj = typeRows[0];
      }
    }
    if (!roomTypeObj) {
      roomTypeObj = { id: 1, typeName: "Standard", defaultPrice: 500000, capacity: 2, adultCapacity: 2, childCapacity: 1, maxOccupancy: 3, extraAdultFee: 200000, extraChildFee: 100000 };
    }

    // Xác định roomPrice: ưu tiên snapshot từ existing booking_detail nếu cùng roomTypeId, ngược lại lấy defaultPrice
    const matchedDetail = (existingDetails || []).find(
      (d) => (r.bookingDetailId && d.id === r.bookingDetailId) || (r.id && d.id === r.id) || (r.roomId && d.roomId === r.roomId)
    );
    if (matchedDetail && Number(matchedDetail.roomTypeId) === Number(roomTypeId) && Number(matchedDetail.roomPrice) > 0) {
      roomPrice = Number(matchedDetail.roomPrice);
    } else if (Number(r.roomPrice) > 0) {
      roomPrice = Number(r.roomPrice);
    } else {
      roomPrice = Number(roomTypeObj.defaultPrice || 0);
    }

    const adultCap = Number(roomTypeObj.adultCapacity ?? roomTypeObj.capacity ?? 2);
    const childCap = Number(roomTypeObj.childCapacity ?? 1);
    const maxOcc = Number(roomTypeObj.maxOccupancy ?? (adultCap + childCap));
    const extraAdultFee = Number(roomTypeObj.extraAdultFee ?? 200000);
    const extraChildFee = Number(roomTypeObj.extraChildFee ?? 100000);

    roomSlots.push({
      adultCapacity: adultCap,
      childCapacity: childCap,
      maxOccupancy: maxOcc,
      extraAdultFee,
      extraChildFee
    });

    const nightlyCalc = await calcNightlyPrices(
      roomTypeId || roomTypeObj.id || 0,
      roomPrice,
      checkIn,
      checkOut,
      null,
      r.roomId || null
    );
    const roomStayAmount = Number(nightlyCalc?.total ?? (roomPrice * nights));
    newRoomTotal += roomStayAmount;

    const rAges = Array.isArray(r.childrenAges) ? r.childrenAges : [];
    allChildrenAges.push(...rAges);
    totalEffectiveAdults += Number(r.adults || 0);
    totalEffectiveChildren += Number(r.children || 0);

    processedRooms.push({
      bookingDetailId: r.bookingDetailId || r.id || null,
      roomId: r.roomId || null,
      roomTypeId: roomTypeId || null,
      roomNumber,
      typeName,
      adults: Number(r.adults || 1),
      children: Number(r.children || 0),
      childrenAges: rAges,
      roomPrice,
      roomStayAmount,
      childSurchargeAmount: 0,
      itemTotal: roomStayAmount
    });
  }

  // Tính phụ thu phát sinh theo toàn bộ sức chứa của đơn (đồng nhất với createBooking / createMultiTypeBooking)
  const freeMaxAge = childrenPolicy?.freeMaxAge ?? 5;
  const childMaxAge = childrenPolicy?.childMaxAge ?? 11;
  const adultsFromChildren = allChildrenAges.filter((age) => Number(age) > childMaxAge).length;
  const chargeableChildrenCount = allChildrenAges.filter(
    (age) => Number(age) > freeMaxAge && Number(age) <= childMaxAge
  ).length;

  const effectiveAdults = totalEffectiveAdults + adultsFromChildren;
  const effectiveChildren = Math.max(0, totalEffectiveChildren - adultsFromChildren);

  const totalAdultCapacity = roomSlots.reduce((sum, slot) => sum + slot.adultCapacity, 0);
  const totalChildCapacity = roomSlots.reduce((sum, slot) => sum + slot.childCapacity, 0);
  const totalMaxOccupancy = roomSlots.reduce((sum, slot) => sum + slot.maxOccupancy, 0);
  const totalGuests = effectiveAdults + effectiveChildren;

  if (totalGuests > totalMaxOccupancy) {
    throw new HttpError(
      400,
      `Tổng số khách (${totalGuests}) vượt quá sức chứa tối đa của ${roomSlots.length} phòng (${totalMaxOccupancy} người). Vui lòng chọn thêm phòng.`
    );
  }

  const primarySlot = roomSlots[0] || {};
  const extraAdults = Math.max(0, effectiveAdults - totalAdultCapacity);
  const unusedAdultSlots = Math.max(0, totalAdultCapacity - effectiveAdults);
  const remainingChildren = Math.max(0, effectiveChildren - unusedAdultSlots);
  const rawExtraChildren = Math.max(0, remainingChildren - totalChildCapacity);
  const extraChildren = allChildrenAges.length > 0
    ? Math.min(rawExtraChildren, chargeableChildrenCount)
    : rawExtraChildren;

  const extraAdultFee = Number(primarySlot.extraAdultFee ?? 200000);
  const childFeePerNight = Number(childrenPolicy?.surchargePerNight ?? primarySlot.extraChildFee ?? 100000);
  const newSurchargeTotal =
    extraAdults * extraAdultFee * nights + extraChildren * childFeePerNight * nights;

  const attributedModifySurcharges = attributeExtraGuestSurchargeToRooms(
    processedRooms.map((r, idx) => ({
      ...r,
      adultCapacity: roomSlots[idx]?.adultCapacity ?? 2,
      childCapacity: roomSlots[idx]?.childCapacity ?? 1,
      maxOccupancy: roomSlots[idx]?.maxOccupancy ?? 3,
      extraAdultFee: roomSlots[idx]?.extraAdultFee ?? 200000,
      extraChildFee: roomSlots[idx]?.extraChildFee ?? 100000,
    })),
    newSurchargeTotal,
    extraAdults,
    extraChildren,
    nights,
    childrenPolicy
  );

  for (let i = 0; i < processedRooms.length; i++) {
    processedRooms[i].childSurchargeAmount = attributedModifySurcharges[i] || 0;
    processedRooms[i].itemTotal += processedRooms[i].childSurchargeAmount;
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
    
    const assignedRoomIds = preview.rooms.map(r => r.roomId).filter(Boolean);
    const uniqueRoomIds = new Set(assignedRoomIds.map(Number));
    if (uniqueRoomIds.size < assignedRoomIds.length) {
      throw new HttpError(400, "Một phòng không thể gán cho nhiều phòng khác nhau trong cùng một đơn đặt phòng");
    }

    for (const r of preview.rooms) {
      if (r.roomId) {
        const [roomRows] = await connection.query('SELECT status, roomTypeId, roomNumber FROM rooms WHERE id = ?', [r.roomId]);
        if (!roomRows || roomRows.length === 0) {
          throw new HttpError(404, `Không tìm thấy phòng #${r.roomId}`);
        }
        const roomRow = roomRows[0];
        if (roomRow.status === 'maintenance') {
          throw new HttpError(409, `Phòng ${roomRow.roomNumber} đang được bảo trì / sửa chữa`);
        }
        if (roomRow.status === 'occupied') {
          throw new HttpError(409, `Phòng ${roomRow.roomNumber} hiện đang có khách lưu trú`);
        }
        if (roomRow.status !== 'available') {
          throw new HttpError(409, `Phòng ${roomRow.roomNumber} hiện không sẵn sàng đón khách (trạng thái: ${roomRow.status})`);
        }
        if (r.roomTypeId && Number(roomRow.roomTypeId) !== Number(r.roomTypeId)) {
          throw new HttpError(400, `Phòng ${roomRow.roomNumber} không thuộc hạng phòng đã chọn`);
        }

        const [conflict] = await connection.query(
          `SELECT bd.id FROM booking_details bd
           JOIN bookings b ON b.id = bd.bookingId
           WHERE bd.roomId = ? AND b.id != ?
           AND b.status NOT IN ('cancelled', 'completed', 'checked_out', 'no_show')
           AND bd.checkInDate < ? AND bd.checkOutDate > ?`,
          [r.roomId, bookingId, checkOut, checkIn]
        );
        if (conflict.length > 0) {
          throw new HttpError(409, `Phòng ${roomRow.roomNumber || r.roomId} đã có người đặt trong khoảng thời gian này.`);
        }
      }
    }

    const firstRoomId = preview.rooms.find(r => r.roomId)?.roomId || booking.room_id;
    const newStayAmount = preview.rooms.reduce((s, r) => s + Number(r.roomStayAmount || 0), 0);
    const newOccupancySurcharge = preview.rooms.reduce((s, r) => s + Number(r.childSurchargeAmount || 0), 0);
    const newBookingTotalPrice = newStayAmount + newOccupancySurcharge;

    await connection.query(
      `UPDATE bookings SET check_in = ?, check_out = ?, totalAmount = ?, total_price = ?, room_id = ? WHERE id = ?`,
      [checkIn, checkOut, preview.newTotalAmount, newBookingTotalPrice, firstRoomId, bookingId]
    );

    const newDetails = preview.rooms.map(r => ({
      id: r.bookingDetailId || r.id || null,
      bookingDetailId: r.bookingDetailId || r.id || null,
      bookingId,
      roomId: r.roomId || null,
      roomTypeId: r.roomTypeId || null,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adults: r.adults,
      children: r.children,
      roomPrice: r.roomPrice,
      occupancySurcharge: r.childSurchargeAmount
    }));

    await bookingModel.replaceBookingDetails(bookingId, newDetails, connection);

    // Chuẩn hoá tài chính & hóa đơn: sử dụng recalculatePaymentForBooking chuẩn
    await paymentService.recalculatePaymentForBooking(bookingId, connection);

    const roomNumbersStr = preview.rooms.map(r => r.roomNumber || r.typeName).filter(Boolean).join(", ");
    await logHistory(
      bookingId,
      "updated",
      `Quản trị viên chỉnh sửa đặt phòng (${roomNumbersStr}): tổng hóa đơn từ ${displayMoney(preview.oldTotalAmount)} sang ${displayMoney(preview.newTotalAmount)} (Chênh lệch: ${preview.priceDifference >= 0 ? "+" : ""}${displayMoney(preview.priceDifference)})`,
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

/**
 * Xem trước chi phí gia hạn thời gian ở, chuyển/nâng cấp phòng hoặc đồng thời cả hai.
 * Payload:
 * - checkOut: string (YYYY-MM-DD, ngày trả phòng mới nếu gia hạn)
 * - toRoomId: number (ID phòng mới nếu chuyển/nâng cấp)
 * - fromDate: string (YYYY-MM-DD, ngày bắt đầu chuyển phòng, mặc định hôm nay / splitDate)
 * - bookingDetailId: number (ID chi tiết đặt phòng cần chuyển)
 */
const previewBookingChange = async (bookingId, payload = {}) => {
  const booking = await bookingModel.getBookingById(bookingId);
  if (!booking) {
    throw new HttpError(404, "Không tìm thấy thông tin đặt phòng");
  }

  if (!["pending", "confirmed", "checked_in"].includes(booking.status)) {
    throw new HttpError(
      409,
      `Không thể thay đổi đặt phòng ở trạng thái ${bookingStatusLabel(booking.status)}`
    );
  }

  const [details] = await db.query(
    `SELECT bd.*, r.roomNumber, r.status AS roomStatus, rt.typeName AS roomTypeName, rt.defaultPrice,
            rt.adultCapacity, rt.childCapacity, rt.maxOccupancy, rt.extraAdultFee, rt.extraChildFee
     FROM booking_details bd
     LEFT JOIN rooms r ON r.id = bd.roomId
     LEFT JOIN room_types rt ON rt.id = COALESCE(bd.roomTypeId, r.roomTypeId)
     WHERE bd.bookingId = ?
     ORDER BY bd.id ASC`,
    [bookingId]
  );

  const mainDetail = details.length > 0 ? details[0] : null;
  const currentCheckIn = dayString(booking.check_in);
  const currentCheckOut = dayString(booking.check_out);
  const targetCheckOut = payload.checkOut ? dayString(payload.checkOut) : currentCheckOut;
  const today = dayString(new Date());
  if (booking.status === 'checked_in' && targetCheckOut < today) {
    throw new HttpError(400, `Khách đang lưu trú tại khách sạn, ngày trả phòng mới không thể nhỏ hơn ngày hôm nay (${displayDate(today)})`);
  }
  if (targetCheckOut <= currentCheckIn) {
    throw new HttpError(400, "Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm");
  }

  const isExtending = targetCheckOut > currentCheckOut;
  const isShortening = targetCheckOut < currentCheckOut;
  const toRoomId = payload.toRoomId ? Number(payload.toRoomId) : null;
  
  // Xác định bookingDetail được chuyển
  let sourceDetail = null;
  if (payload.bookingDetailId) {
    sourceDetail = details.find((d) => Number(d.id) === Number(payload.bookingDetailId));
  } else if (payload.fromRoomId) {
    sourceDetail = details.find((d) => Number(d.roomId) === Number(payload.fromRoomId));
  } else {
    sourceDetail = mainDetail;
  }

  const currentRoomId = sourceDetail?.roomId ? Number(sourceDetail.roomId) : (booking.room_id ? Number(booking.room_id) : null);
  const isTransferring = Boolean(toRoomId && toRoomId !== currentRoomId);

  // Xác định ngày chuyển phòng (splitDate)
  let splitDate = currentCheckIn;
  if (isTransferring) {
    if (payload.fromDate) {
      splitDate = dayString(payload.fromDate);
    } else if (booking.status === 'checked_in') {
      splitDate = today > currentCheckIn && today < targetCheckOut ? today : currentCheckIn;
    } else {
      splitDate = currentCheckIn;
    }
    if (splitDate < currentCheckIn) splitDate = currentCheckIn;
    if (splitDate > targetCheckOut) splitDate = targetCheckOut;
  }

  let targetRoom = null;
  if (isTransferring) {
    targetRoom = await bookingModel.getRoomWithType(toRoomId, db, false);
    if (!targetRoom) {
      throw new HttpError(404, "Không tìm thấy phòng muốn chuyển đến");
    }
    if (targetRoom.status === 'maintenance') {
      throw new HttpError(409, `Phòng ${targetRoom.roomNumber} đang được bảo trì.`);
    }
  }

  // 1. Kiểm tra xung đột phòng
  const conflicts = [];
  if (isTransferring && targetRoom) {
    // Check conflict for target room from splitDate to targetCheckOut
    const toRoomConflicts = await bookingModel.getConflictingBookings(
      targetRoom.id,
      splitDate,
      targetCheckOut,
      db,
      true,
      { excludeBookingId: bookingId }
    );
    if (toRoomConflicts.length > 0) {
      conflicts.push({
        type: 'transfer_room_conflict',
        roomId: targetRoom.id,
        roomNumber: targetRoom.roomNumber,
        conflictingBookingIds: toRoomConflicts.map(c => c.id),
        message: `Phòng ${targetRoom.roomNumber} đã có người đặt trong giai đoạn ${displayDate(splitDate)} → ${displayDate(targetCheckOut)}.`
      });
    }
  } else if (isExtending && currentRoomId) {
    // Check conflict for current room for extended period
    const extConflicts = await bookingModel.getConflictingBookings(
      currentRoomId,
      currentCheckOut,
      targetCheckOut,
      db,
      true,
      { excludeBookingId: bookingId }
    );
    if (extConflicts.length > 0) {
      const roomNum = sourceDetail?.roomNumber || currentRoomId;
      conflicts.push({
        type: 'extend_stay_conflict',
        roomId: currentRoomId,
        roomNumber: roomNum,
        conflictingBookingIds: extConflicts.map(c => c.id),
        message: `Phòng ${roomNum} đã có người đặt trong giai đoạn gia hạn ${displayDate(currentCheckOut)} → ${displayDate(targetCheckOut)}.`
      });
    }
  }

  // 2. Tính toán biểu giá chi tiết cho từng giai đoạn và từng đêm
  const currentRoomTypeId = sourceDetail?.roomTypeId || booking.room_type_id;
  const currentRoomPrice = Number(sourceDetail?.roomPrice || booking.room_price || sourceDetail?.defaultPrice || 500000);
  
  const targetRoomTypeId = isTransferring ? (targetRoom.roomTypeId || targetRoom.room_type_id) : currentRoomTypeId;
  const targetRoomPrice = isTransferring ? Number(targetRoom.defaultPrice || targetRoom.price_per_night || 0) : currentRoomPrice;

  // Tính nightly prices:
  // - Giai đoạn 1 (trước splitDate): Phòng cũ
  // - Giai đoạn 2 (từ splitDate trở đi): Phòng mới (hoặc phòng cũ nếu không đổi phòng)
  const pastCalc = await calcNightlyPrices(
    currentRoomTypeId,
    currentRoomPrice,
    currentCheckIn,
    splitDate,
    db,
    currentRoomId
  );

  const futureCalc = await calcNightlyPrices(
    targetRoomTypeId,
    targetRoomPrice,
    splitDate,
    targetCheckOut,
    db,
    isTransferring ? targetRoom.id : currentRoomId
  );

  // Phân tích chi tiết từng đêm
  const combinedNightlyPrices = [
    ...pastCalc.prices.map(p => ({
      ...p,
      isNewRoom: false,
      roomNumber: sourceDetail?.roomNumber,
      typeName: sourceDetail?.roomTypeName
    })),
    ...futureCalc.prices.map(p => ({
      ...p,
      isNewRoom: isTransferring,
      roomNumber: isTransferring ? targetRoom?.roomNumber : sourceDetail?.roomNumber,
      typeName: isTransferring ? targetRoom?.typeName : sourceDetail?.roomTypeName
    }))
  ];

  // Tính các khoản tài chính & cảnh báo
  let baseRoomAmount = 0;
  let holidaySurcharge = 0;
  let weekendSurcharge = 0;
  let upgradeFee = 0;
  const warnings = [];

  for (const night of combinedNightlyPrices) {
    baseRoomAmount += Number(night.basePrice || 0);
    if (night.isHoliday) {
      holidaySurcharge += Number(night.surcharge || 0);
      warnings.push(`⚠️ Ngày ${dayjs(night.date).format('DD/MM/YYYY')} (${night.dayName}) là ngày lễ: ${night.holidayName || 'Ngày lễ'} (phụ thu +20%: +${displayMoney(night.surcharge)})`);
    } else if (night.isWeekend) {
      weekendSurcharge += Number(night.surcharge || 0);
      warnings.push(`⚠️ Ngày ${dayjs(night.date).format('DD/MM/YYYY')} là ${night.dayName}: phụ thu cuối tuần +10% (+${displayMoney(night.surcharge)})`);
    }
  }

  // Tính upgrade fee nếu có chuyển phòng
  if (isTransferring) {
    const transferNights = futureCalc.prices.length;
    const baseDiffPerNight = Math.max(0, targetRoomPrice - currentRoomPrice);
    upgradeFee = baseDiffPerNight * transferNights;
  }

  // Tổng tiền phòng mới
  const newStayAmount = pastCalc.total + futureCalc.total;

  // Tính phụ thu khách/trẻ em phát sinh nếu gia hạn/rút ngắn đêm
  const originalNights = Math.max(1, dayjs(currentCheckOut).diff(dayjs(currentCheckIn), 'day'));
  const totalNewNights = Math.max(1, dayjs(targetCheckOut).diff(dayjs(currentCheckIn), 'day'));
  const addedNights = Math.max(0, totalNewNights - originalNights);
  const reducedNights = Math.max(0, originalNights - totalNewNights);

  const currentOccupancySurcharge = Number(booking.occupancy_surcharge || sourceDetail?.occupancySurcharge || 0);
  const occSurchargePerNight = originalNights > 0 ? (currentOccupancySurcharge / originalNights) : 0;
  let extraOccupancySurcharge = 0;
  if (isExtending) {
    extraOccupancySurcharge = Math.round(occSurchargePerNight * addedNights);
  } else if (isShortening) {
    extraOccupancySurcharge = -Math.round(occSurchargePerNight * reducedNights);
  }
  const newOccupancySurcharge = Math.max(0, currentOccupancySurcharge + extraOccupancySurcharge);

  // Tính chi tiết các đêm bị cắt giảm nếu là rút ngắn ngày
  let reducedNightlyPrices = [];
  let reducedStayAmount = 0;
  if (isShortening) {
    const reducedCalc = await calcNightlyPrices(
      currentRoomTypeId,
      currentRoomPrice,
      targetCheckOut,
      currentCheckOut,
      db,
      currentRoomId
    );
    reducedNightlyPrices = reducedCalc.prices || [];
    reducedStayAmount = reducedCalc.total || 0;
  }

  // Tổng các chi phí dịch vụ / thiệt hại đã có
  const servicesSum = await bookingModel.sumBookingServices(bookingId);
  const serviceAmount = Number(servicesSum?.totalConfirmed || 0);
  const damageSum = await bookingModel.sumDamageCharges(bookingId);
  const damageAmount = Number(damageSum?.totalConfirmed || 0);

  const oldTotalAmount = Number(booking.totalAmount || booking.total_price || 0);
  const newTotalAmount = newStayAmount + newOccupancySurcharge + serviceAmount + damageAmount;
  const priceDifference = newTotalAmount - oldTotalAmount;

  if (isShortening) {
    warnings.push(`ℹ️ Rút ngắn thời gian ở: Giảm ${reducedNights} đêm (từ ${dayjs(targetCheckOut).format('DD/MM/YYYY')} đến ${dayjs(currentCheckOut).format('DD/MM/YYYY')}), tiền phòng giảm: -${displayMoney(Math.abs(priceDifference))}`);
  }

  // Thanh toán & Hoàn tiền
  const [payments] = await db.query(`SELECT * FROM payments WHERE bookingId = ? ORDER BY id DESC LIMIT 1`, [bookingId]);
  const currentPayment = payments[0] || {};
  const depositAmount = Number(currentPayment.depositAmount || 0);
  const paidAmount = Number(currentPayment.paidAmount || 0);
  const paidTotal = depositAmount + paidAmount;
  const refundableExcessAmount = Math.max(0, paidTotal - newTotalAmount);
  const newRemainingAmount = Math.max(0, newTotalAmount - paidTotal);

  return {
    bookingId,
    status: booking.status,
    currentCheckIn,
    currentCheckOut,
    targetCheckOut,
    splitDate,
    isExtending,
    isShortening,
    isTransferring,
    addedNights,
    reducedNights,
    totalNights: totalNewNights,
    fromRoom: {
      id: currentRoomId,
      roomNumber: sourceDetail?.roomNumber,
      roomTypeId: currentRoomTypeId,
      typeName: sourceDetail?.roomTypeName,
      price: currentRoomPrice
    },
    toRoom: targetRoom ? {
      id: targetRoom.id,
      roomNumber: targetRoom.roomNumber,
      roomTypeId: targetRoom.roomTypeId || targetRoom.room_type_id,
      typeName: targetRoom.typeName,
      price: targetRoomPrice
    } : null,
    financialBreakdown: {
      baseRoomAmount,
      holidaySurcharge,
      weekendSurcharge,
      upgradeFee,
      extraGuestSurcharge: extraOccupancySurcharge,
      priceDifference,
      oldTotalAmount,
      newTotalAmount,
      depositAmount,
      paidAmount,
      paidTotal,
      refundableExcessAmount,
      newRemainingAmount,
      isShortening,
      isExtending,
      reducedNights,
      reducedStayAmount,
      reducedNightlyPrices
    },
    warnings,
    nightlyPrices: combinedNightlyPrices,
    conflicts,
    available: conflicts.length === 0
  };
};

/**
 * Thực thi gia hạn thời gian ở, chuyển/nâng cấp phòng hoặc cả hai.
 */
const executeBookingChange = async (bookingId, payload = {}, actor = null) => {
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const preview = await previewBookingChange(bookingId, payload);
    if (!preview.available) {
      const conflictMsg = preview.conflicts.map(c => c.message).join(" ");
      throw new HttpError(409, conflictMsg || "Phòng được chọn không còn trống trong thời gian này.", {
        conflicts: preview.conflicts
      });
    }

    const booking = await bookingModel.getBookingById(bookingId, connection, true);
    if (!booking) {
      throw new HttpError(404, "Không tìm thấy thông tin đặt phòng");
    }

    const targetCheckOut = preview.targetCheckOut;
    const splitDate = preview.splitDate;
    const isTransferring = preview.isTransferring;
    const isExtending = preview.isExtending;
    const isShortening = preview.isShortening;

    // 1. Cập nhật chuyển phòng vật lý (nếu có)
    if (isTransferring && preview.toRoom) {
      const toRoom = await bookingModel.getRoomWithType(preview.toRoom.id, connection, true);
      const fromRoomId = preview.fromRoom.id;

      // Ghi log chuyển phòng vào booking_room_transfers
      await connection.query(
        `INSERT INTO booking_room_transfers (bookingId, fromRoomId, toRoomId, fromDate, toDate, pricePerNight, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          bookingId,
          fromRoomId,
          toRoom.id,
          splitDate,
          targetCheckOut,
          preview.toRoom.price,
          payload.reason || "Khách yêu cầu chuyển/nâng cấp phòng"
        ]
      );

      // Cập nhật trạng thái phòng vật lý
      const today = dayString(new Date());
      if (splitDate <= today) {
        if (fromRoomId) await bookingModel.updateRoomStatus(fromRoomId, "available", connection);
        await bookingModel.updateRoomStatus(toRoom.id, "occupied", connection);
      }

      // Cập nhật booking_details
      const [bDetails] = await connection.query(
        `SELECT id FROM booking_details WHERE bookingId = ? ORDER BY id ASC LIMIT 1`,
        [bookingId]
      );
      const targetDetailId = payload.bookingDetailId || bDetails[0]?.id;

      if (targetDetailId) {
        await connection.query(
          `UPDATE booking_details
           SET roomId = ?, roomTypeId = ?, roomPrice = ?, checkOutDate = ?
           WHERE id = ?`,
          [toRoom.id, toRoom.roomTypeId || toRoom.room_type_id, preview.toRoom.price, targetCheckOut, targetDetailId]
        );
      }

      // Cập nhật phòng chính trên booking nếu là phòng chính
      await connection.query(
        `UPDATE bookings SET room_id = ? WHERE id = ?`,
        [toRoom.id, bookingId]
      );
    } else if (isExtending || isShortening) {
      // Cập nhật checkOutDate trên booking_details
      await connection.query(
        `UPDATE booking_details SET checkOutDate = ? WHERE bookingId = ?`,
        [targetCheckOut, bookingId]
      );
    }

    // 2. Cập nhật booking_nightly_prices
    if (isTransferring) {
      await connection.query(
        `DELETE FROM booking_nightly_prices WHERE bookingId = ? AND stayDate >= ?`,
        [bookingId, splitDate]
      );
      const newFuturePrices = preview.nightlyPrices.filter(p => p.stayDate >= splitDate);
      await bookingModel.saveNightlyPrices(bookingId, newFuturePrices, connection);
    } else if (isExtending) {
      const addedPrices = preview.nightlyPrices.filter(p => p.stayDate >= preview.currentCheckOut);
      await bookingModel.saveNightlyPrices(bookingId, addedPrices, connection);
    } else if (isShortening) {
      // Xóa các đêm vượt quá ngày check-out mới
      await connection.query(
        `DELETE FROM booking_nightly_prices WHERE bookingId = ? AND stayDate >= ?`,
        [bookingId, targetCheckOut]
      );
    }

    // 3. Cập nhật thông tin lưu trú và tổng tiền trên bookings
    const newStayAmount = preview.nightlyPrices.reduce((sum, p) => sum + Number(p.price || 0), 0);
    const newOccupancySurcharge = Math.max(0, Number(booking.occupancy_surcharge || 0) + preview.financialBreakdown.extraGuestSurcharge);
    const newBookingTotalPrice = newStayAmount + newOccupancySurcharge;

    await connection.query(
      `UPDATE bookings
       SET check_out = ?, totalAmount = ?, total_price = ?, occupancy_surcharge = ?
       WHERE id = ?`,
      [targetCheckOut, preview.financialBreakdown.newTotalAmount, newBookingTotalPrice, newOccupancySurcharge, bookingId]
    );

    // 4. Đồng bộ thanh toán & hóa đơn
    const payment = await paymentService.recalculatePaymentForBooking(bookingId, connection);
    try {
      if (payment) {
        await invoiceService.issueInvoiceForPayment(payment.id, connection);
      }
    } catch {
      // Bỏ qua nếu chưa xuất hóa đơn
    }

    // 4.1. Tạo phiếu yêu cầu hoàn tiền nếu phát sinh hoàn tiền thừa
    let refundRecord = null;
    const [payments] = await connection.query(`SELECT * FROM payments WHERE bookingId = ? ORDER BY id DESC LIMIT 1`, [bookingId]);
    const currentPayment = payments[0] || {};
    const paidTotal = Number(currentPayment.depositAmount || 0) + Number(currentPayment.paidAmount || 0);

    if (preview.financialBreakdown.refundableExcessAmount > 0 && payload.refundRequest) {
      const normRefund = normalizeRefundRequest(payload.refundRequest);
      if (normRefund) {
        // Một đơn chỉ được có một phiếu hoàn đang chờ duyệt. Số tiền đã trả chỉ
        // bị trừ khi admin duyệt, nên nếu cho tạo nhiều phiếu trên cùng khoản
        // tiền thì duyệt hết là hoàn trùng — mất tiền thật của khách sạn.
        const [pendingRefunds] = await connection.query(
          "SELECT id FROM payment_refunds WHERE bookingId = ? AND status = 'pending' LIMIT 1",
          [bookingId]
        );
        if (pendingRefunds.length > 0) {
          throw new HttpError(
            409,
            'Đơn này đã có một yêu cầu hoàn tiền đang chờ duyệt. Vui lòng xử lý yêu cầu đó trước.'
          );
        }

        const isAutoApproved = Boolean(payload.isStaffOrAdmin || payload.autoApproveRefund);
        const [refundRes] = await connection.query(
          `INSERT INTO payment_refunds
             (paymentId, bookingId, amount, refundRate, paidAmount, refundMethod, bankBin, bankName, accountNumber, accountName, status, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            payment?.id || currentPayment.id || 0,
            bookingId,
            preview.financialBreakdown.refundableExcessAmount,
            1.00,
            paidTotal,
            normRefund.refundMethod,
            normRefund.bankBin,
            normRefund.bankName,
            normRefund.accountNumber,
            normRefund.accountName,
            isAutoApproved ? 'approved' : 'pending',
            `Hoàn tiền do rút ngắn thời gian ở (${preview.reducedNights} đêm: ${displayDate(targetCheckOut)} → ${displayDate(preview.currentCheckOut)}). ${payload.reason ? `Lý do: ${payload.reason}` : ''}`
          ]
        );
        refundRecord = {
          id: refundRes.insertId,
          amount: preview.financialBreakdown.refundableExcessAmount,
          status: isAutoApproved ? 'approved' : 'pending',
          refundMethod: normRefund.refundMethod
        };
      }
    }

    // 5. Ghi nhật ký booking_history
    const actionType = (isExtending && isTransferring)
      ? "extended_and_transferred"
      : isTransferring
        ? "room_transferred"
        : isExtending
          ? "extended"
          : "shortened";

    const changeDescription = (isExtending && isTransferring)
      ? `Gia hạn trả phòng đến ${displayDate(targetCheckOut)} và chuyển sang phòng ${preview.toRoom?.roomNumber} (${preview.toRoom?.typeName}). ${preview.financialBreakdown.priceDifference > 0 ? `Phát sinh thêm: +${displayMoney(preview.financialBreakdown.priceDifference)}` : 'Không đổi tiền'}. Lý do: ${payload.reason || 'Khách yêu cầu'}`
      : isTransferring
        ? `Chuyển phòng từ ${preview.fromRoom.roomNumber || preview.fromRoom.id} sang ${preview.toRoom?.roomNumber} (${preview.toRoom?.typeName}) từ ${displayDate(splitDate)}. ${preview.financialBreakdown.priceDifference > 0 ? `Phát sinh: +${displayMoney(preview.financialBreakdown.priceDifference)}` : 'Không đổi tiền'}. Lý do: ${payload.reason || 'Khách yêu cầu'}`
        : isExtending
          ? `Gia hạn ngày ở: trả phòng chuyển từ ${displayDate(preview.currentCheckOut)} thành ${displayDate(targetCheckOut)} (+${preview.addedNights} đêm, +${displayMoney(preview.financialBreakdown.priceDifference)})`
          : `Rút ngắn ngày ở: trả phòng sớm từ ${displayDate(preview.currentCheckOut)} thành ${displayDate(targetCheckOut)} (giảm ${preview.reducedNights} đêm, giảm trừ -${displayMoney(Math.abs(preview.financialBreakdown.priceDifference))}${refundRecord ? `, tạo yêu cầu hoàn ${displayMoney(refundRecord.amount)}` : ''})`;

    await logHistory(
      bookingId,
      actionType,
      changeDescription,
      {
        entityType: "stay",
        entityId: preview.toRoom?.id || null,
        oldValue: {
          checkOut: preview.currentCheckOut,
          roomId: preview.fromRoom.id,
          roomNumber: preview.fromRoom.roomNumber,
          totalPrice: preview.financialBreakdown.oldTotalAmount
        },
        newValue: {
          checkOut: targetCheckOut,
          roomId: preview.toRoom?.id || preview.fromRoom.id,
          roomNumber: preview.toRoom?.roomNumber || preview.fromRoom.roomNumber,
          totalPrice: preview.financialBreakdown.newTotalAmount,
          priceDifference: preview.financialBreakdown.priceDifference,
          financialBreakdown: preview.financialBreakdown,
          warnings: preview.warnings
        }
      },
      actor,
      connection
    );

    await connection.commit();

    return {
      success: true,
      message: "Cập nhật ngày ở và phòng thành công",
      data: {
        bookingId,
        booking: await bookingModel.getBookingById(bookingId),
        preview
      }
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
  distributeGuestsAcrossMixedRooms,
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
  previewBookingChange,
  executeBookingChange,
  checkIn,
  checkOut,
  markNoShow,
  markRoomCleaned,
  extendRoomHoldDeadline,
  reactivateNoShowBooking,
  processOverdueCheckIns,
  recordCustomerContact,
  updateBookingRequestedCheckInTime,
  reassignConflictingBooking,
  resetBookingHold,
};


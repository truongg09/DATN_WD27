/**
 * Chính sách thời gian giữ phòng (Anti-Abuse Hold Policy):
 * - Thời gian giữ phòng ban đầu: 15 phút
 * - Tối đa 1 lần gia hạn: +5 phút
 * - Trần tổng thời gian giữ phòng tối đa: 20 phút kể từ lúc tạo đơn
 * - Cooldown tối thiểu giữa các lần bấm: 60 giây
 */
const DEFAULT_ROOM_HOLD_HOURS = 24;
const HOLD_MINUTES = 15;
const HOLD_RESET_MINUTES = 5;
const MAX_HOLD_RESETS = 1;
const MIN_RESET_COOLDOWN_SECONDS = 60;
const MAX_TOTAL_HOLD_MINUTES = 20;

const dayString = (value) => {
  if (value instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return String(value).slice(0, 10);
};

const combineDateTime = (dateInput, timeStr, dayOffset = 0) => {
  const day = dayString(dateInput);
  const baseDate = new Date(`${day}T${timeStr}+07:00`);
  if (dayOffset) {
    baseDate.setDate(baseDate.getDate() + Number(dayOffset));
  }
  return baseDate;
};

const DEFAULT_STANDARD_CHECKIN_TIME = '14:00:00';
const DEFAULT_STANDARD_CHECKOUT_TIME = '12:00:00';

/**
 * Mốc giữ phòng mặc định mới:
 * lateNoShowDeadline = checkInDate + standardCheckInTime + 24 giờ.
 * Ví dụ: Check-in 24/08/2026 14:00 -> Deadline: 25/08/2026 14:00.
 */
const getLateNoShowDeadline = (
  checkInDate,
  standardCheckInTime = DEFAULT_STANDARD_CHECKIN_TIME,
  holdHours = DEFAULT_ROOM_HOLD_HOURS
) => {
  const timeStr = standardCheckInTime || DEFAULT_STANDARD_CHECKIN_TIME;
  const baseDateTime = combineDateTime(checkInDate, timeStr, 0);
  return new Date(baseDateTime.getTime() + Number(holdHours) * 3600000);
};

const getLateCheckInDeadline = (
  checkInDate,
  standardCheckInTime = DEFAULT_STANDARD_CHECKIN_TIME,
  holdHours = DEFAULT_ROOM_HOLD_HOURS
) => {
  return getLateNoShowDeadline(checkInDate, standardCheckInTime, holdHours);
};

const getCheckOutDeadline = (checkOutDate, requestedCheckOutTime = DEFAULT_STANDARD_CHECKOUT_TIME) => {
  const timeStr = requestedCheckOutTime || DEFAULT_STANDARD_CHECKOUT_TIME;
  return combineDateTime(checkOutDate, timeStr, 0);
};

const getCheckInDayStart = (checkInDate) =>
  new Date(`${dayString(checkInDate)}T00:00:00`);

const isWithinLateCheckInWindow = (
  checkInDate,
  standardCheckInTime = DEFAULT_STANDARD_CHECKIN_TIME,
  now = new Date(),
  lateArrivalConfirmed = false,
  checkOutDate = null,
  standardCheckOutTime = DEFAULT_STANDARD_CHECKOUT_TIME
) => {
  if (lateArrivalConfirmed && checkOutDate) {
    const finalDeadline = getCheckOutDeadline(checkOutDate, standardCheckOutTime);
    return now <= finalDeadline;
  }
  const defaultDeadline = getLateNoShowDeadline(checkInDate, standardCheckInTime, DEFAULT_ROOM_HOLD_HOURS);
  return now <= defaultDeadline;
};

const isPastNoShowDeadline = (
  checkInDate,
  standardCheckInTime = DEFAULT_STANDARD_CHECKIN_TIME,
  now = new Date(),
  lateArrivalConfirmed = false,
  checkOutDate = null,
  standardCheckOutTime = DEFAULT_STANDARD_CHECKOUT_TIME
) => {
  return !isWithinLateCheckInWindow(
    checkInDate,
    standardCheckInTime,
    now,
    lateArrivalConfirmed,
    checkOutDate,
    standardCheckOutTime
  );
};

/**
 * Tính phí trễ giờ trả phòng (Late Check-out) theo 3 bậc thang chính sách:
 * - Trong thời gian ân hạn (graceMinutes, mặc định 15p): Miễn phí (0đ)
 * - Mốc 1 (trễ đến 3 tiếng): Phụ thu 30% giá phòng 1 đêm
 * - Mốc 2 (trễ từ 3 đến 6 tiếng): Phụ thu 50% giá phòng 1 đêm
 * - Mốc 3 (trễ trên 6 tiếng): Phụ thu 100% giá phòng 1 đêm
 */
const computeLateCheckoutFee = (tiers, standardCheckOut, actualCheckOutTime, nightlyRate) => {
  const lateMinutesRaw = Math.round((actualCheckOutTime - standardCheckOut) / 60000);
  if (lateMinutesRaw <= 0) {
    return { status: 'on_time', feeAmount: 0, lateMinutes: 0, percent: 0 };
  }

  const lateMinutes = Math.max(0, lateMinutesRaw - Number(tiers.graceMinutes));
  if (lateMinutes === 0) {
    return { status: 'within_grace', feeAmount: 0, lateMinutes: 0, percent: 0 };
  }

  const lateHours = lateMinutes / 60;
  let percent;
  if (lateHours <= Number(tiers.tier1MaxHours)) percent = Number(tiers.tier1Percent);
  else if (lateHours <= Number(tiers.tier2MaxHours)) percent = Number(tiers.tier2Percent);
  else percent = Number(tiers.tier3Percent);

  const feeAmount = Math.round(nightlyRate * (percent / 100));
  return { status: 'fee_applied', feeAmount, lateMinutes, percent, lateHours };
};

const getMaxLateCheckoutTime = (standardCheckOut, nextBookingCheckInDate, tiers) => {
  const staticCap = new Date(standardCheckOut.getTime() + Number(tiers.absoluteMaxLateHours) * 3600000);
  if (!nextBookingCheckInDate) return staticCap;

  const dynamicCap = new Date(
    combineDateTime(nextBookingCheckInDate, tiers.standardCheckInTime).getTime()
      - Number(tiers.housekeepingBufferMinutes) * 60000
  );

  return staticCap < dynamicCap ? staticCap : dynamicCap;
};

/**
 * Tính phụ thu Check-in sớm theo chuẩn ngành khách sạn:
 * - Trước 06:00: Phụ thu 100% giá 1 đêm
 * - 06:00 - 09:00: Phụ thu 50% giá 1 đêm
 * - 09:00 - 12:00: Phụ thu 30% giá 1 đêm
 * - 12:00 - 14:00 (hoặc giờ chuẩn): Miễn phí (0%)
 */
const computeEarlyCheckInSurcharge = (now = new Date(), standardCheckInTime = '14:00:00', nightlyRate = 0) => {
  const hour = now.getHours() + (now.getMinutes() / 60);
  const stdParts = (standardCheckInTime || '14:00:00').split(':');
  const stdHour = parseInt(stdParts[0] || '14', 10) + (parseInt(stdParts[1] || '0', 10) / 60);

  if (hour >= stdHour) {
    return {
      isEarly: false,
      percent: 0,
      surchargeAmount: 0,
      timeWindowLabel: 'Đúng giờ',
      isFree: true,
      description: 'Check-in đúng giờ tiêu chuẩn'
    };
  }

  let percent = 0;
  let timeWindowLabel = '';
  let description = '';

  if (hour < 6) {
    percent = 100;
    timeWindowLabel = 'Trước 06:00 (Sáng sớm)';
    description = 'Phụ thu 100% giá phòng 1 đêm do nhận phòng trước 06:00 sáng';
  } else if (hour < 9) {
    percent = 50;
    timeWindowLabel = '06:00 - 09:00 (Sáng)';
    description = 'Phụ thu 50% giá phòng 1 đêm do nhận phòng từ 06:00 đến 09:00';
  } else if (hour < 12) {
    percent = 30;
    timeWindowLabel = '09:00 - 12:00 (Trưa)';
    description = 'Phụ thu 30% giá phòng 1 đêm do nhận phòng từ 09:00 đến 12:00';
  } else {
    percent = 0;
    timeWindowLabel = '12:00 - 14:00 (Miễn phí)';
    description = 'Miễn phí nhận phòng sớm (từ 12:00 đến 14:00)';
  }

  const surchargeAmount = Math.round((Number(nightlyRate || 0) * percent) / 100);

  return {
    isEarly: true,
    percent,
    surchargeAmount,
    timeWindowLabel,
    isFree: percent === 0,
    description
  };
};

module.exports = {
  DEFAULT_ROOM_HOLD_HOURS,
  HOLD_MINUTES,
  HOLD_RESET_MINUTES,
  MAX_HOLD_RESETS,
  MIN_RESET_COOLDOWN_SECONDS,
  MAX_TOTAL_HOLD_MINUTES,
  dayString,
  getLateNoShowDeadline,
  getLateCheckInDeadline,
  getCheckOutDeadline,
  isWithinLateCheckInWindow,
  isPastNoShowDeadline,
  combineDateTime,
  computeLateCheckoutFee,
  computeEarlyCheckInSurcharge,
  getMaxLateCheckoutTime
}; 
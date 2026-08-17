const LATE_CHECKIN_GRACE_HOUR = 6;
const HOLD_MINUTES = 15;
const HOLD_RESET_MINUTES = 15;
const MAX_HOLD_RESETS = 2;
const MIN_RESET_COOLDOWN_SECONDS = 60;
const MAX_TOTAL_HOLD_MINUTES = 45;

const dayString = (value) => {
  if (value instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return String(value).slice(0, 10);
};

// Chuyển lên trước isLateCheckIn vì giờ được dùng làm nền tính giờ chuẩn check-in.
const combineDateTime = (dateInput, timeStr, dayOffset = 0) => {
  const day = dayString(dateInput);
  const baseDate = new Date(`${day}T${timeStr}+07:00`);
  if (dayOffset) {
    baseDate.setDate(baseDate.getDate() + Number(dayOffset));
  }
  return baseDate;
};

const DEFAULT_STANDARD_CHECKIN_TIME = '14:00:00';

const getLateCheckInDeadline = (checkInDate, requestedCheckInTime = DEFAULT_STANDARD_CHECKIN_TIME, graceHours = LATE_CHECKIN_GRACE_HOUR, dayOffset = 0) => {
  const timeStr = requestedCheckInTime || DEFAULT_STANDARD_CHECKIN_TIME;
  const baseDateTime = combineDateTime(checkInDate, timeStr, dayOffset);
  return new Date(baseDateTime.getTime() + Number(graceHours) * 3600000);
};

const getCheckOutDeadline = (checkOutDate, requestedCheckOutTime = '12:00:00') => {
  const timeStr = requestedCheckOutTime || '12:00:00';
  return combineDateTime(checkOutDate, timeStr, 0);
};

const getCheckInDayStart = (checkInDate) =>
  new Date(`${dayString(checkInDate)}T00:00:00`);

const isWithinLateCheckInWindow = (checkInDate, requestedCheckInTime = DEFAULT_STANDARD_CHECKIN_TIME, now = new Date(), dayOffset = 0) => {
  const deadline = getLateCheckInDeadline(checkInDate, requestedCheckInTime, LATE_CHECKIN_GRACE_HOUR, dayOffset);
  return now <= deadline;
};

const isLateCheckIn = (checkInDate, requestedCheckInTime = DEFAULT_STANDARD_CHECKIN_TIME, now = new Date(), dayOffset = 0) => {
  const checkInStartHour = (requestedCheckInTime && requestedCheckInTime < DEFAULT_STANDARD_CHECKIN_TIME) ? requestedCheckInTime : DEFAULT_STANDARD_CHECKIN_TIME;
  const requestedCheckIn = combineDateTime(checkInDate, checkInStartHour, dayOffset);
  const deadline = getLateCheckInDeadline(checkInDate, requestedCheckInTime, LATE_CHECKIN_GRACE_HOUR, dayOffset);
  return now > requestedCheckIn && now <= deadline;
};

const isPastNoShowDeadline = (checkInDate, requestedCheckInTime = DEFAULT_STANDARD_CHECKIN_TIME, now = new Date(), dayOffset = 0) =>
  now > getLateCheckInDeadline(checkInDate, requestedCheckInTime, LATE_CHECKIN_GRACE_HOUR, dayOffset);

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
  LATE_CHECKIN_GRACE_HOUR,
  HOLD_MINUTES,
  HOLD_RESET_MINUTES,
  MAX_HOLD_RESETS,
  MIN_RESET_COOLDOWN_SECONDS,
  MAX_TOTAL_HOLD_MINUTES,
  dayString,
  getLateCheckInDeadline,
  getCheckOutDeadline,
  isWithinLateCheckInWindow,
  isLateCheckIn,
  isPastNoShowDeadline,
  combineDateTime,
  computeLateCheckoutFee,
  computeEarlyCheckInSurcharge,
  getMaxLateCheckoutTime
}; 
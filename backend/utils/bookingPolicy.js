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

const formatDecimalHourToHHmm = (h) => {
  const norm = Math.max(0, h);
  const totalMinutes = Math.round(norm * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Tính phụ thu Check-in sớm theo cấu hình policy động:
 * Dựa trên SỐ GIỜ SỚM HƠN GIỜ CHECK-IN CHUẨN (hoursEarly = standardCheckInTime - now):
 * - hoursEarly >= tier1Hours (mặc định 8h): tier1Percent (mặc định 100%)
 * - hoursEarly >= tier2Hours (mặc định 5h): tier2Percent (mặc định 50%)
 * - hoursEarly >= tier3Hours (mặc định 2h): tier3Percent (mặc định 30%)
 * - hoursEarly < tier3Hours: Miễn phí (0%)
 */
const computeEarlyCheckInSurcharge = (
  now = new Date(),
  standardCheckInOrPolicy = '14:00:00',
  nightlyRate = 0,
  policyConfig = null
) => {
  let standardCheckInTime = '14:00:00';
  let tier1Hours = 8.0;
  let tier1Percent = 100.0;
  let tier2Hours = 5.0;
  let tier2Percent = 50.0;
  let tier3Hours = 2.0;
  let tier3Percent = 30.0;

  const extractFromObject = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    if (obj.standardCheckInTime) standardCheckInTime = String(obj.standardCheckInTime);
    if (obj.checkInTime) standardCheckInTime = String(obj.checkInTime);
    if (obj.earlyCheckInPolicy) {
      extractFromObject(obj.earlyCheckInPolicy);
    }
    if (obj.tier1Hours !== undefined) tier1Hours = Number(obj.tier1Hours);
    if (obj.earlyTier1Hours !== undefined) tier1Hours = Number(obj.earlyTier1Hours);
    if (obj.tier1Percent !== undefined) tier1Percent = Number(obj.tier1Percent);
    if (obj.earlyTier1Percent !== undefined) tier1Percent = Number(obj.earlyTier1Percent);

    if (obj.tier2Hours !== undefined) tier2Hours = Number(obj.tier2Hours);
    if (obj.earlyTier2Hours !== undefined) tier2Hours = Number(obj.earlyTier2Hours);
    if (obj.tier2Percent !== undefined) tier2Percent = Number(obj.tier2Percent);
    if (obj.earlyTier2Percent !== undefined) tier2Percent = Number(obj.earlyTier2Percent);

    if (obj.tier3Hours !== undefined) tier3Hours = Number(obj.tier3Hours);
    if (obj.earlyTier3Hours !== undefined) tier3Hours = Number(obj.earlyTier3Hours);
    if (obj.tier3Percent !== undefined) tier3Percent = Number(obj.tier3Percent);
    if (obj.earlyTier3Percent !== undefined) tier3Percent = Number(obj.earlyTier3Percent);
  };

  if (typeof standardCheckInOrPolicy === 'object' && standardCheckInOrPolicy !== null) {
    extractFromObject(standardCheckInOrPolicy);
  } else if (typeof standardCheckInOrPolicy === 'string') {
    standardCheckInTime = standardCheckInOrPolicy;
  }
  if (policyConfig && typeof policyConfig === 'object') {
    extractFromObject(policyConfig);
  }

  const nowDate = now instanceof Date ? now : new Date(now);
  const nowHour = nowDate.getHours() + (nowDate.getMinutes() / 60) + (nowDate.getSeconds() / 3600);

  const stdParts = (standardCheckInTime || '14:00:00').split(':');
  const stdHour = parseInt(stdParts[0] || '14', 10) + (parseInt(stdParts[1] || '0', 10) / 60) + ((parseInt(stdParts[2] || '0', 10) || 0) / 3600);
  const stdLabel = (standardCheckInTime || '14:00:00').slice(0, 5);

  if (nowHour >= stdHour) {
    return {
      isEarly: false,
      percent: 0,
      surchargeAmount: 0,
      hoursEarly: 0,
      timeWindowLabel: 'Đúng giờ',
      isFree: true,
      description: 'Check-in đúng giờ tiêu chuẩn'
    };
  }

  const hoursEarly = Math.round((stdHour - nowHour) * 10000) / 10000;
  const displayHoursEarly = Math.round(hoursEarly * 10) / 10;

  const t1TimeStr = formatDecimalHourToHHmm(stdHour - tier1Hours);
  const t2TimeStr = formatDecimalHourToHHmm(stdHour - tier2Hours);
  const t3TimeStr = formatDecimalHourToHHmm(stdHour - tier3Hours);

  let percent = 0;
  let timeWindowLabel = '';
  let description = '';

  if (hoursEarly >= tier1Hours) {
    percent = tier1Percent;
    timeWindowLabel = `Trước ${t1TimeStr} (Sáng sớm)`;
    description = `Phụ thu ${tier1Percent}% giá phòng 1 đêm do nhận phòng trước ${t1TimeStr} (sớm ${displayHoursEarly} tiếng, từ ${tier1Hours}h trở lên)`;
  } else if (hoursEarly >= tier2Hours) {
    percent = tier2Percent;
    timeWindowLabel = `${t1TimeStr} - ${t2TimeStr} (Sáng)`;
    description = `Phụ thu ${tier2Percent}% giá phòng 1 đêm do nhận phòng từ ${t1TimeStr} đến ${t2TimeStr} (sớm ${displayHoursEarly} tiếng, từ ${tier2Hours}h đến ${tier1Hours}h)`;
  } else if (hoursEarly >= tier3Hours) {
    percent = tier3Percent;
    timeWindowLabel = `${t2TimeStr} - ${t3TimeStr} (Trưa)`;
    description = `Phụ thu ${tier3Percent}% giá phòng 1 đêm do nhận phòng từ ${t2TimeStr} đến ${t3TimeStr} (sớm ${displayHoursEarly} tiếng, từ ${tier3Hours}h đến ${tier2Hours}h)`;
  } else {
    percent = 0;
    timeWindowLabel = `${t3TimeStr} - ${stdLabel} (Miễn phí)`;
    description = `Miễn phí nhận phòng sớm (từ ${t3TimeStr} đến ${stdLabel}, sớm dưới ${tier3Hours} tiếng)`;
  }

  const surchargeAmount = Math.round((Number(nightlyRate || 0) * percent) / 100);

  return {
    isEarly: true,
    percent,
    surchargeAmount,
    hoursEarly: displayHoursEarly,
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
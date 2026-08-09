const LATE_CHECKIN_GRACE_HOUR = 6;

const dayString = (value) => {
  if (value instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return String(value).slice(0, 10);
};

// Chuyển lên trước isLateCheckIn vì giờ được dùng làm nền tính giờ chuẩn check-in.
const combineDateTime = (dateInput, timeStr) => {
  const day = dayString(dateInput);
  return new Date(`${day}T${timeStr}+07:00`);
};

const DEFAULT_STANDARD_CHECKIN_TIME = '14:00:00';

const getLateCheckInDeadline = (checkInDate) => {
  const deadline = new Date(`${dayString(checkInDate)}T00:00:00`);
  deadline.setDate(deadline.getDate() + 1);
  deadline.setHours(LATE_CHECKIN_GRACE_HOUR, 0, 0, 0);
  return deadline;
};

const getCheckInDayStart = (checkInDate) =>
  new Date(`${dayString(checkInDate)}T00:00:00`);

const isWithinLateCheckInWindow = (checkInDate, now = new Date()) => {
  const start = getCheckInDayStart(checkInDate);
  const deadline = getLateCheckInDeadline(checkInDate);
  return now >= start && now <= deadline;
};

// standardCheckInTime giờ lấy từ checkout_late_fee_tiers (DB), không hardcode nữa.
// Vẫn có default '14:00:00' để tương thích ngược nếu nơi gọi cũ chưa truyền.
const isLateCheckIn = (checkInDate, now = new Date(), standardCheckInTime = DEFAULT_STANDARD_CHECKIN_TIME) => {
  const standardCheckIn = combineDateTime(checkInDate, standardCheckInTime);
  return now > standardCheckIn && isWithinLateCheckInWindow(checkInDate, now);
};

const isPastNoShowDeadline = (checkInDate, now = new Date()) =>
  now > getLateCheckInDeadline(checkInDate);

// Tính phí trễ giờ theo 3 tier. Trả về status để nơi gọi biết cần làm gì tiếp.
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

module.exports = {
  LATE_CHECKIN_GRACE_HOUR,
  dayString,
  getLateCheckInDeadline,
  isWithinLateCheckInWindow,
  isLateCheckIn,
  isPastNoShowDeadline,
  combineDateTime,
  computeLateCheckoutFee,
  getMaxLateCheckoutTime
}; 
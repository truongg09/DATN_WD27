const LATE_CHECKIN_GRACE_HOUR = 6;

const dayString = (value) => {
  if (value instanceof Date) {
    // mysql2 trả cột DATE/DATETIME về Date theo giờ địa phương;
    // dùng toISOString() (UTC) sẽ bị lùi 1 ngày với múi giờ dương (VN = UTC+7).
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return String(value).slice(0, 10);
};

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

const isLateCheckIn = (checkInDate, now = new Date()) => {
  const standardCheckIn = new Date(`${dayString(checkInDate)}T14:00:00`);
  return now > standardCheckIn && isWithinLateCheckInWindow(checkInDate, now);
};

const isPastNoShowDeadline = (checkInDate, now = new Date()) =>
  now > getLateCheckInDeadline(checkInDate);

module.exports = {
  LATE_CHECKIN_GRACE_HOUR,
  dayString,
  getLateCheckInDeadline,
  isWithinLateCheckInWindow,
  isLateCheckIn,
  isPastNoShowDeadline
};
const HttpError = require('../utils/httpError');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toPositiveInt = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    throw new HttpError(400, `${fieldName} is required`);
  }

  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new HttpError(400, `${fieldName} must be a positive integer`);
  }
  return number;
};

const toNonNegativeInt = (value, fieldName, defaultValue = 0) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new HttpError(400, `${fieldName} must be a non-negative integer`);
  }
  return number;
};

const normalizeDate = (value, fieldName) => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new HttpError(400, `${fieldName} must use YYYY-MM-DD format`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `${fieldName} is not a valid date`);
  }

  return value;
};

const assertDateRange = (checkIn, checkOut) => {
  const checkInDate = new Date(`${checkIn}T00:00:00.000Z`);
  const checkOutDate = new Date(`${checkOut}T00:00:00.000Z`);

  if (checkOutDate <= checkInDate) {
    throw new HttpError(400, 'checkOut must be after checkIn');
  }
};

const normalizeBookingPayload = (body, userFromToken) => {
  const userId = body.userId ?? body.customerId ?? userFromToken;
  const roomId = body.roomId ?? body.room_id;
  const checkIn = body.checkIn ?? body.checkInDate ?? body.check_in;
  const checkOut = body.checkOut ?? body.checkOutDate ?? body.check_out;

  const payload = {
    userId: toPositiveInt(userId, 'userId'),
    roomId: toPositiveInt(roomId, 'roomId'),
    checkIn: normalizeDate(checkIn, 'checkIn'),
    checkOut: normalizeDate(checkOut, 'checkOut'),
    adults: toNonNegativeInt(body.adults, 'adults', 1),
    children: toNonNegativeInt(body.children, 'children', 0),
    notes: body.notes ?? body.specialRequests ?? null,
    status: body.status || 'confirmed'
  };

  if (!['pending', 'confirmed'].includes(payload.status)) {
    throw new HttpError(400, 'status must be pending or confirmed');
  }

  if (payload.adults + payload.children <= 0) {
    throw new HttpError(400, 'booking must have at least one guest');
  }

  assertDateRange(payload.checkIn, payload.checkOut);
  return payload;
};

const normalizeAvailabilityPayload = (body) => {
  const roomId = body.roomId ?? body.room_id;
  const checkIn = body.checkIn ?? body.checkInDate ?? body.check_in;
  const checkOut = body.checkOut ?? body.checkOutDate ?? body.check_out;

  const payload = {
    roomId: toPositiveInt(roomId, 'roomId'),
    checkIn: normalizeDate(checkIn, 'checkIn'),
    checkOut: normalizeDate(checkOut, 'checkOut')
  };

  assertDateRange(payload.checkIn, payload.checkOut);
  return payload;
};

const normalizeIdParam = (id, fieldName = 'id') => toPositiveInt(id, fieldName);

module.exports = {
  normalizeBookingPayload,
  normalizeAvailabilityPayload,
  normalizeIdParam
};

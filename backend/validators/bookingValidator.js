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

const normalizeServiceRequestsPayload = (value) => {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'serviceRequests must be an array');
  }

  return value
    .map((item, index) => ({
      serviceId: toPositiveInt(item.serviceId ?? item.service_id, `serviceRequests[${index}].serviceId`),
      quantity: toPositiveInt(item.quantity ?? 1, `serviceRequests[${index}].quantity`)
    }))
    .filter((item) => item.quantity > 0);
};

// Tuổi từng trẻ em (0-17) dùng để tính phụ thu
const normalizeChildrenAges = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((age) => Number(age))
    .filter((age) => Number.isInteger(age) && age >= 0 && age <= 17);
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
    childrenAges: normalizeChildrenAges(body.childrenAges ?? body.children_ages),
    notes: body.notes ?? body.specialRequests ?? null,
    guestName: body.guestName ?? body.guest_name ?? null,
    guestEmail: body.guestEmail ?? body.guest_email ?? null,
    guestPhone: body.guestPhone ?? body.guest_phone ?? null,
    serviceRequests: normalizeServiceRequestsPayload(body.serviceRequests ?? body.service_requests),
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
    checkOut: normalizeDate(checkOut, 'checkOut'),
    childrenAges: normalizeChildrenAges(body.childrenAges ?? body.children_ages)
  };

  assertDateRange(payload.checkIn, payload.checkOut);
  return payload;
};

const normalizeTypeAvailabilityPayload = (body) => {
  const checkIn = body.checkIn ?? body.checkInDate ?? body.check_in;
  const checkOut = body.checkOut ?? body.checkOutDate ?? body.check_out;
  const rooms = Array.isArray(body.rooms) ? body.rooms : [];

  if (rooms.length === 0) {
    throw new HttpError(400, 'rooms must be a non-empty array');
  }

  const payload = {
    checkIn: normalizeDate(checkIn, 'checkIn'),
    checkOut: normalizeDate(checkOut, 'checkOut'),
    rooms: rooms.map((item, index) => ({
      roomTypeId: toPositiveInt(item.roomTypeId ?? item.room_type_id, `rooms[${index}].roomTypeId`),
      quantity: toPositiveInt(item.quantity, `rooms[${index}].quantity`)
    }))
  };

  assertDateRange(payload.checkIn, payload.checkOut);
  return payload;
};

const normalizeServiceChargePayload = (body) => ({
  serviceId: toPositiveInt(body.serviceId ?? body.service_id, 'serviceId'),
  quantity: toPositiveInt(body.quantity ?? 1, 'quantity')
});

const normalizeExtendStayPayload = (body) => ({
  checkOut: normalizeDate(body.checkOut ?? body.checkOutDate ?? body.check_out, 'checkOut')
});

const normalizeGuestIdentitiesPayload = (body) => {
  const guests = Array.isArray(body.guests) ? body.guests : [];
  if (guests.length === 0) {
    throw new HttpError(400, 'guests must be a non-empty array');
  }

  return {
    guests: guests.map((guest, index) => {
      const fullName = String(guest.fullName ?? guest.full_name ?? '').trim();
      const identityNumber = String(guest.identityNumber ?? guest.cccd ?? guest.identity_number ?? '').trim();

      if (!fullName) {
        throw new HttpError(400, `guests[${index}].fullName is required`);
      }
      if (!identityNumber) {
        throw new HttpError(400, `guests[${index}].identityNumber is required`);
      }

      return {
        fullName,
        identityNumber,
        phone: guest.phone ? String(guest.phone).trim() : null,
        note: guest.note ? String(guest.note).trim() : null
      };
    })
  };
};

const normalizeDamageChargePayload = (body) => {
  const itemName = String(body.itemName ?? body.item_name ?? '').trim();
  if (!itemName) {
    throw new HttpError(400, 'itemName is required');
  }

  const unitPrice = Number(body.unitPrice ?? body.unit_price);
  if (Number.isNaN(unitPrice) || unitPrice < 0) {
    throw new HttpError(400, 'unitPrice must be a non-negative number');
  }

  return {
    itemName,
    quantity: toPositiveInt(body.quantity ?? 1, 'quantity'),
    unitPrice,
    note: body.note ? String(body.note).trim() : null
  };
};

const normalizeTransferRoomPayload = (body) => ({
  toRoomId: toPositiveInt(body.toRoomId ?? body.to_room_id, 'toRoomId'),
  fromDate: normalizeDate(body.fromDate ?? body.from_date, 'fromDate'),
  toDate: normalizeDate(body.toDate ?? body.to_date, 'toDate'),
  reason: body.reason ? String(body.reason).trim() : null
});

const normalizeIdParam = (id, fieldName = 'id') => toPositiveInt(id, fieldName);

module.exports = {
  normalizeBookingPayload,
  normalizeAvailabilityPayload,
  normalizeTypeAvailabilityPayload,
  normalizeServiceChargePayload,
  normalizeExtendStayPayload,
  normalizeGuestIdentitiesPayload,
  normalizeDamageChargePayload,
  normalizeTransferRoomPayload,
  normalizeIdParam
};

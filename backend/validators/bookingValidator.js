const HttpError = require('../utils/httpError');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toPositiveInt = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    throw new HttpError(400, `Thiếu trường bắt buộc: ${fieldName}`);
  }

  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new HttpError(400, `${fieldName} phải là số nguyên dương`);
  }
  return number;
};

const toNonNegativeInt = (value, fieldName, defaultValue = 0) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new HttpError(400, `${fieldName} phải là số nguyên không âm`);
  }
  return number;
};

const normalizeDate = (value, fieldName) => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new HttpError(400, `${fieldName} phải có định dạng YYYY-MM-DD`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `${fieldName} không phải ngày hợp lệ`);
  }

  return value;
};

// Giờ khách mong muốn nhận/trả phòng khi đặt phòng - tùy chọn, chỉ để lễ tân
// chủ động chuẩn bị, không ảnh hưởng đến việc tính phí hay chặn đặt phòng.
// Lưu dưới dạng HH:mm:ss cho khớp kiểu cột TIME của MySQL.
const normalizeOptionalTime = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const str = String(value).trim();
  if (!TIME_PATTERN.test(str)) {
    throw new HttpError(400, `${fieldName} phải có định dạng HH:mm`);
  }

  return `${str}:00`;
};

const assertDateRange = (checkIn, checkOut) => {
  const checkInDate = new Date(`${checkIn}T00:00:00.000Z`);
  const checkOutDate = new Date(`${checkOut}T00:00:00.000Z`);

  if (checkOutDate <= checkInDate) {
    throw new HttpError(400, 'Ngày trả phòng phải sau ngày nhận phòng');
  }
};

const normalizeServiceRequestsPayload = (value) => {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'Danh sách dịch vụ phải là một mảng');
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
  const roomTypeId = body.roomTypeId ?? body.room_type_id;
  const checkIn = body.checkIn ?? body.checkInDate ?? body.check_in;
  const checkOut = body.checkOut ?? body.checkOutDate ?? body.check_out;

  // Khách đặt theo hạng phòng (roomTypeId) - hệ thống tự gán phòng trống;
  // roomId chỉ dùng khi lễ tân/admin chỉ định phòng cụ thể.
  if (!roomId && !roomTypeId) {
    throw new HttpError(400, 'Vui lòng chọn phòng hoặc hạng phòng');
  }

  if (Array.isArray(body.rooms) && body.rooms.length > 1) {
    const uniqueTypeIds = new Set(
      body.rooms.map((r) => r.roomTypeId ?? r.room_type_id).filter(Boolean)
    );
    if (uniqueTypeIds.size > 1) {
      throw new HttpError(400, 'Một booking chỉ được đặt các phòng thuộc cùng một hạng phòng');
    }
  }

  const payload = {
    userId: toPositiveInt(userId, 'userId'),
    roomId: roomId ? toPositiveInt(roomId, 'roomId') : null,
    roomTypeId: roomTypeId ? toPositiveInt(roomTypeId, 'roomTypeId') : null,
    roomQuantity: toPositiveInt(body.roomQuantity ?? body.room_quantity ?? 1, 'roomQuantity'),
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
    requestedCheckInTime: normalizeOptionalTime(
      body.requestedCheckInTime ?? body.requested_check_in_time,
      'requestedCheckInTime'
    ),
    requestedCheckOutTime: normalizeOptionalTime(
      body.requestedCheckOutTime ?? body.requested_check_out_time,
      'requestedCheckOutTime'
    ),
    status: body.status || 'confirmed'
  };

  if (!['pending', 'confirmed'].includes(payload.status)) {
    throw new HttpError(400, 'Trạng thái phải là chờ xác nhận hoặc đã xác nhận');
  }

  if (payload.adults + payload.children <= 0) {
    throw new HttpError(400, 'Đặt phòng phải có ít nhất một khách');
  }

  // Phụ thu trẻ em tính theo tuổi từng bé. Nếu không bắt buộc khai đủ tuổi,
  // khách chỉ cần gửi childrenAges rỗng là né được toàn bộ phụ thu.
  if (payload.children > 0 && payload.childrenAges.length !== payload.children) {
    throw new HttpError(400, 'Vui lòng khai báo tuổi của từng trẻ em đi cùng');
  }

  assertDateRange(payload.checkIn, payload.checkOut);
  return payload;
};

const normalizeAvailabilityPayload = (body) => {
  const roomId = body.roomId ?? body.room_id;
  const roomTypeId = body.roomTypeId ?? body.room_type_id;
  const checkIn = body.checkIn ?? body.checkInDate ?? body.check_in;
  const checkOut = body.checkOut ?? body.checkOutDate ?? body.check_out;

  if (!roomId && !roomTypeId) {
    throw new HttpError(400, 'Vui lòng chọn phòng hoặc hạng phòng');
  }

  const payload = {
    roomId: roomId ? toPositiveInt(roomId, 'roomId') : null,
    roomTypeId: roomTypeId ? toPositiveInt(roomTypeId, 'roomTypeId') : null,
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
    throw new HttpError(400, 'Danh sách phòng không được để trống');
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

const ALLOWED_SERVICE_STATUSES = ['unused', 'used', 'cancelled'];
const ALLOWED_CHARGE_TYPES = ['damage', 'extra_fee', 'other'];

const normalizeServiceChargePayload = (body) => {
  const roomId = body.roomId ?? body.room_id;
  const status = body.status ? String(body.status).trim().toLowerCase() : 'used';
  if (body.status && !ALLOWED_SERVICE_STATUSES.includes(status)) {
    throw new HttpError(400, `Trạng thái không hợp lệ (${ALLOWED_SERVICE_STATUSES.join(', ')})`);
  }

  return {
    roomId: roomId != null ? toPositiveInt(roomId, 'roomId') : null,
    serviceId: toPositiveInt(body.serviceId ?? body.service_id, 'serviceId'),
    quantity: toPositiveInt(body.quantity ?? 1, 'quantity'),
    status
  };
};

const normalizeUpdateServiceChargePayload = (body) => {
  const payload = {};

  if (body.roomId !== undefined) {
    payload.roomId = body.roomId != null ? toPositiveInt(body.roomId, 'roomId') : null;
  }
  if (body.quantity !== undefined && body.quantity !== null) {
    payload.quantity = toPositiveInt(body.quantity, 'quantity');
  }
  if (body.status !== undefined && body.status !== null) {
    const status = String(body.status).trim().toLowerCase();
    if (!ALLOWED_SERVICE_STATUSES.includes(status)) {
      throw new HttpError(400, `Trạng thái không hợp lệ (${ALLOWED_SERVICE_STATUSES.join(', ')})`);
    }
    payload.status = status;
  }

  if (Object.keys(payload).length === 0) {
    throw new HttpError(400, 'Không có thông tin nào để cập nhật');
  }

  return payload;
};

const normalizeStatusPayload = (body) => {
  const status = body.status ? String(body.status).trim().toLowerCase() : '';
  if (!ALLOWED_SERVICE_STATUSES.includes(status)) {
    throw new HttpError(400, `Trạng thái không hợp lệ (${ALLOWED_SERVICE_STATUSES.join(', ')})`);
  }
  return { status };
};

const normalizeDamageChargePayload = (body) => {
  const itemName = String(body.itemName ?? body.item_name ?? '').trim();
  if (!itemName) {
    throw new HttpError(400, 'Vui lòng nhập tên khoản phí / vật dụng');
  }

  const unitPrice = Number(body.unitPrice ?? body.unit_price);
  if (Number.isNaN(unitPrice) || unitPrice < 0) {
    throw new HttpError(400, 'Đơn giá phải là số không âm');
  }

  const chargeType = body.chargeType ? String(body.chargeType).trim().toLowerCase() : 'damage';
  if (body.chargeType && !ALLOWED_CHARGE_TYPES.includes(chargeType)) {
    throw new HttpError(400, `Loại khoản phí không hợp lệ (${ALLOWED_CHARGE_TYPES.join(', ')})`);
  }

  const status = body.status ? String(body.status).trim().toLowerCase() : 'used';
  if (body.status && !ALLOWED_SERVICE_STATUSES.includes(status)) {
    throw new HttpError(400, `Trạng thái không hợp lệ (${ALLOWED_SERVICE_STATUSES.join(', ')})`);
  }

  const roomId = body.roomId ?? body.room_id;

  return {
    roomId: roomId != null ? toPositiveInt(roomId, 'roomId') : null,
    chargeType,
    itemName,
    quantity: toPositiveInt(body.quantity ?? 1, 'quantity'),
    unitPrice,
    status,
    note: body.note ? String(body.note).trim() : null
  };
};

const normalizeUpdateDamageChargePayload = (body) => {
  const payload = {};

  if (body.roomId !== undefined) {
    payload.roomId = body.roomId != null ? toPositiveInt(body.roomId, 'roomId') : null;
  }
  if (body.chargeType !== undefined && body.chargeType !== null) {
    const chargeType = String(body.chargeType).trim().toLowerCase();
    if (!ALLOWED_CHARGE_TYPES.includes(chargeType)) {
      throw new HttpError(400, `Loại khoản phí không hợp lệ (${ALLOWED_CHARGE_TYPES.join(', ')})`);
    }
    payload.chargeType = chargeType;
  }
  if (body.itemName !== undefined && body.itemName !== null) {
    const itemName = String(body.itemName).trim();
    if (!itemName) {
      throw new HttpError(400, 'Tên khoản phí / vật dụng không được để trống');
    }
    payload.itemName = itemName;
  }
  if (body.quantity !== undefined && body.quantity !== null) {
    payload.quantity = toPositiveInt(body.quantity, 'quantity');
  }
  if (body.unitPrice !== undefined && body.unitPrice !== null) {
    const unitPrice = Number(body.unitPrice);
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      throw new HttpError(400, 'Đơn giá phải là số không âm');
    }
    payload.unitPrice = unitPrice;
  }
  if (body.status !== undefined && body.status !== null) {
    const status = String(body.status).trim().toLowerCase();
    if (!ALLOWED_SERVICE_STATUSES.includes(status)) {
      throw new HttpError(400, `Trạng thái không hợp lệ (${ALLOWED_SERVICE_STATUSES.join(', ')})`);
    }
    payload.status = status;
  }
  if (body.note !== undefined) {
    payload.note = body.note ? String(body.note).trim() : null;
  }

  if (Object.keys(payload).length === 0) {
    throw new HttpError(400, 'Không có thông tin nào để cập nhật');
  }

  return payload;
};

const normalizeTransferRoomPayload = (body) => {
  const payload = {
    toRoomId: toPositiveInt(body.toRoomId ?? body.to_room_id, 'toRoomId'),
    fromDate: normalizeDate(body.fromDate ?? body.from_date, 'fromDate'),
    toDate: normalizeDate(body.toDate ?? body.to_date, 'toDate'),
    reason: body.reason ? String(body.reason).trim() : null
  };

  if (payload.fromDate >= payload.toDate) {
    throw new HttpError(400, 'Ngày bắt đầu chuyển phòng phải trước ngày kết thúc');
  }

  return payload;
};

const normalizeIdParam = (id, fieldName = 'id') => toPositiveInt(id, fieldName);

const normalizeReassignRoomPayload = (body) => ({
  roomId: toPositiveInt(body.roomId ?? body.room_id, 'roomId')
});
module.exports = {
  normalizeBookingPayload,
  normalizeAvailabilityPayload,
  normalizeTypeAvailabilityPayload,
  normalizeServiceChargePayload,
  normalizeUpdateServiceChargePayload,
  normalizeStatusPayload,
  normalizeExtendStayPayload,
  normalizeUpdateStayPayload,
  normalizeGuestIdentitiesPayload,
  normalizeDamageChargePayload,
  normalizeUpdateDamageChargePayload,
  normalizeTransferRoomPayload,
  normalizeIdParam,
  normalizeReassignRoomPayload
};
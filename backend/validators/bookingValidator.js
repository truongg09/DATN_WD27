const HttpError = require('../utils/httpError');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

  const payload = {
    userId: toPositiveInt(userId, 'userId'),
    roomId: roomId ? toPositiveInt(roomId, 'roomId') : null,
    roomTypeId: roomTypeId ? toPositiveInt(roomTypeId, 'roomTypeId') : null,
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

const normalizeServiceChargePayload = (body) => ({
  serviceId: toPositiveInt(body.serviceId ?? body.service_id, 'serviceId'),
  quantity: toPositiveInt(body.quantity ?? 1, 'quantity')
});

const normalizeUpdateServiceChargePayload = (body) => {
  if (body.quantity === undefined || body.quantity === null) {
    throw new HttpError(400, 'quantity là bắt buộc khi cập nhật dịch vụ');
  }
  return {
    quantity: toPositiveInt(body.quantity, 'quantity'),
  };
};

const normalizeExtendStayPayload = (body) => ({
  checkOut: normalizeDate(body.checkOut ?? body.checkOutDate ?? body.check_out, 'checkOut')
});

const normalizeUpdateStayPayload = (body) => {
  const checkIn = normalizeDate(
    body.checkIn ?? body.checkInDate ?? body.check_in,
    'checkIn'
  );
  const checkOut = normalizeDate(
    body.checkOut ?? body.checkOutDate ?? body.check_out,
    'checkOut'
  );
  // Chuỗi ngày ISO YYYY-MM-DD có thể so sánh trực tiếp bằng toán tử chuỗi
  // (không cần thêm dayjs plugin isSameOrBefore, tránh lỗi TypeError)
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    throw new HttpError(400, 'Ngày trả phòng phải sau ngày nhận phòng');
  }
  const roomTypeId = body.roomTypeId ?? body.room_type_id;
  if (roomTypeId !== undefined && roomTypeId !== null && !Number.isInteger(Number(roomTypeId))) {
    throw new HttpError(400, 'roomTypeId phải là số nguyên');
  }
  return {
    checkIn,
    checkOut,
    roomTypeId: roomTypeId != null ? Number(roomTypeId) : null,
  };
};

const normalizeGuestIdentitiesPayload = (body) => {
  const guests = Array.isArray(body.guests) ? body.guests : [];
  if (guests.length === 0) {
    throw new HttpError(400, 'Danh sách khách lưu trú không được để trống');
  }

  return {
    guests: guests.map((guest, index) => {
      const fullName = String(guest.fullName ?? guest.full_name ?? '').trim();
      const identityNumber = String(guest.identityNumber ?? guest.cccd ?? guest.identity_number ?? '').trim();

      if (!fullName) {
        throw new HttpError(400, `Vui lòng nhập họ tên khách thứ ${index + 1}`);
      }
      if (!identityNumber) {
        throw new HttpError(400, `Vui lòng nhập giấy tờ tùy thân của khách thứ ${index + 1}`);
      }
      if (!/^\d{12}$/.test(identityNumber)) {
        throw new HttpError(400, `Số CCCD của khách thứ ${index + 1} (${fullName}) phải bao gồm đúng 12 chữ số (không chứa chữ cái hoặc ký hiệu)`);
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
    throw new HttpError(400, 'Vui lòng nhập tên vật dụng');
  }

  const unitPrice = Number(body.unitPrice ?? body.unit_price);
  if (Number.isNaN(unitPrice) || unitPrice < 0) {
    throw new HttpError(400, 'Đơn giá phải là số không âm');
  }

  return {
    itemName,
    quantity: toPositiveInt(body.quantity ?? 1, 'quantity'),
    unitPrice,
    note: body.note ? String(body.note).trim() : null
  };
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

module.exports = {
  normalizeBookingPayload,
  normalizeAvailabilityPayload,
  normalizeTypeAvailabilityPayload,
  normalizeServiceChargePayload,
  normalizeUpdateServiceChargePayload,
  normalizeExtendStayPayload,
  normalizeUpdateStayPayload,
  normalizeGuestIdentitiesPayload,
  normalizeDamageChargePayload,
  normalizeTransferRoomPayload,
  normalizeIdParam
};

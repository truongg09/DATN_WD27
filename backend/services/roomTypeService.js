const db = require('../config/db');
const bookingModel = require('../models/bookingModel');
const bookingService = require('./bookingService');
const HttpError = require('../utils/httpError');

const TYPE_SELECT = `
  SELECT
    rt.id,
    rt.typeName,
    rt.description,
    rt.capacity,
    rt.defaultPrice,
    COUNT(r.id) AS totalRooms,
    MIN(r.area) AS minArea,
    MAX(r.area) AS maxArea
  FROM room_types rt
  LEFT JOIN rooms r ON r.roomTypeId = rt.id AND r.status != 'maintenance'
`;

const groupBy = (rows, key) => {
  const map = new Map();
  for (const row of rows) {
    const id = Number(row[key]);
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }
  return map;
};

const loadTypeExtras = async (roomTypeIds) => {
  if (roomTypeIds.length === 0) {
    return { imagesByType: new Map(), amenitiesByType: new Map(), ratingsByType: new Map() };
  }

  const [images] = await db.query(
    'SELECT roomTypeId, imageUrl FROM room_images WHERE roomTypeId IN (?) ORDER BY id ASC',
    [roomTypeIds]
  );
  const [amenities] = await db.query(
    `SELECT rta.roomTypeId, a.name, a.icon
     FROM room_type_amenities rta
     JOIN amenities a ON a.id = rta.amenityId
     WHERE rta.roomTypeId IN (?)
     ORDER BY rta.roomTypeId ASC, a.id ASC`,
    [roomTypeIds]
  );
  // Đánh giá gom theo hạng phòng (review gắn với booking -> phòng -> loại phòng)
  const [ratings] = await db.query(
    `SELECT r.roomTypeId, ROUND(AVG(rev.rating), 1) AS avgRating, COUNT(rev.id) AS reviewCount
     FROM reviews rev
     JOIN bookings b ON b.id = rev.bookingId
     LEFT JOIN booking_details bd ON bd.bookingId = b.id
     JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
     WHERE r.roomTypeId IN (?)
     GROUP BY r.roomTypeId`,
    [roomTypeIds]
  );

  return {
    imagesByType: groupBy(images, 'roomTypeId'),
    amenitiesByType: groupBy(amenities, 'roomTypeId'),
    ratingsByType: new Map(ratings.map((row) => [Number(row.roomTypeId), row]))
  };
};

const buildTypeEntry = (type, extras) => {
  const rating = extras.ratingsByType.get(Number(type.id));
  return {
    id: type.id,
    typeName: type.typeName,
    description: type.description,
    capacity: Number(type.capacity || 0),
    defaultPrice: Number(type.defaultPrice || 0),
    totalRooms: Number(type.totalRooms || 0),
    minArea: type.minArea === null ? null : Number(type.minArea),
    maxArea: type.maxArea === null ? null : Number(type.maxArea),
    images: (extras.imagesByType.get(Number(type.id)) || []).map((row) => row.imageUrl),
    amenities: (extras.amenitiesByType.get(Number(type.id)) || []).map((row) => ({
      name: row.name,
      icon: row.icon
    })),
    avgRating: rating ? Number(rating.avgRating) : null,
    reviewCount: rating ? Number(rating.reviewCount) : 0
  };
};

// Danh sách hạng phòng cho trang tìm kiếm. Có ngày -> kèm số phòng trống
// và tổng giá cho cả kỳ nghỉ (giá theo mùa từ room_prices).
const searchRoomTypes = async ({ checkIn, checkOut, guests } = {}) => {
  const [types] = await db.query(`${TYPE_SELECT} GROUP BY rt.id ORDER BY rt.defaultPrice ASC, rt.id ASC`);
  const extras = await loadTypeExtras(types.map((type) => type.id));

  let availabilityByType = null;
  if (checkIn && checkOut) {
    const rows = await bookingModel.listRoomTypeAvailability(checkIn, checkOut);
    availabilityByType = new Map(rows.map((row) => [Number(row.id), row]));
  }

  const guestCount = Number(guests) || 0;
  const result = [];
  for (const type of types) {
    const entry = buildTypeEntry(type, extras);
    entry.fitsGuests = guestCount <= 0 || entry.capacity >= guestCount;

    if (availabilityByType) {
      const availability = availabilityByType.get(Number(type.id));
      entry.availableRooms = availability ? Number(availability.availableRooms) : 0;
      const nightly = await bookingService.calcNightlyPrices(
        type.id,
        type.defaultPrice,
        checkIn,
        checkOut
      );
      entry.nights = nightly.nights;
      entry.stayAmount = nightly.total;
      entry.nightlyPrices = nightly.prices;
    }

    result.push(entry);
  }

  return result;
};

const getRoomTypeDetail = async (roomTypeId, { checkIn, checkOut } = {}) => {
  const [types] = await db.query(`${TYPE_SELECT} WHERE rt.id = ? GROUP BY rt.id`, [roomTypeId]);
  if (types.length === 0) {
    throw new HttpError(404, 'Room type not found');
  }

  const extras = await loadTypeExtras([roomTypeId]);
  const entry = buildTypeEntry(types[0], extras);

  const [reviews] = await db.query(
    `SELECT rev.id, rev.rating, rev.comment, rev.createdAt,
            COALESCE(NULLIF(c.fullName, ''), a.email) AS customerName
     FROM reviews rev
     JOIN customers c ON c.id = rev.customerId
     JOIN accounts a ON a.id = c.accountId
     JOIN bookings b ON b.id = rev.bookingId
     LEFT JOIN booking_details bd ON bd.bookingId = b.id
     JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
     WHERE r.roomTypeId = ?
     ORDER BY rev.createdAt DESC
     LIMIT 50`,
    [roomTypeId]
  );
  entry.reviews = reviews;

  if (checkIn && checkOut) {
    const rooms = await bookingModel.listAvailableRoomsByType(roomTypeId, checkIn, checkOut);
    entry.availableRooms = rooms.length;
    const nightly = await bookingService.calcNightlyPrices(
      roomTypeId,
      types[0].defaultPrice,
      checkIn,
      checkOut
    );
    entry.nights = nightly.nights;
    entry.stayAmount = nightly.total;
    entry.nightlyPrices = nightly.prices;
  }

  return entry;
};

module.exports = {
  searchRoomTypes,
  getRoomTypeDetail
};

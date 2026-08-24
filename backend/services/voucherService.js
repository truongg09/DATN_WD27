const voucherModel = require('../models/voucherModel');
const db = require('../config/db');
const HttpError = require('../utils/httpError');

const NO_SHOW_DISCOUNT_PERCENT = 10;
const NO_SHOW_VOUCHER_VALID_DAYS = 90;

const { dayString } = require('../utils/bookingPolicy');

const run = (connection) => connection || db;
const money = (amount) => `${Number(amount || 0).toLocaleString('vi-VN')}₫`;

// Các hạng phòng thuộc một đơn, dùng để đối chiếu điều kiện áp dụng của voucher.
const listBookingRoomTypeIds = async (bookingId, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT DISTINCT r.roomTypeId, rt.typeName
      FROM bookings b
      LEFT JOIN booking_details bd ON bd.bookingId = b.id
      JOIN rooms r ON r.id = COALESCE(bd.roomId, b.room_id)
      JOIN room_types rt ON rt.id = r.roomTypeId
      WHERE b.id = ?
    `,
    [bookingId]
  );
  return rows;
};

// Danh sách hạng phòng mà voucher giới hạn. Rỗng nghĩa là áp cho mọi hạng.
const listVoucherRoomTypes = async (voucherId, connection) => {
  const [rows] = await run(connection).query(
    `
      SELECT vrt.roomTypeId, rt.typeName
      FROM voucher_room_types vrt
      JOIN room_types rt ON rt.id = vrt.roomTypeId
      WHERE vrt.voucherId = ?
    `,
    [voucherId]
  );
  return rows;
};

// Số tiền được giảm theo mức giảm và trần giảm của voucher.
// Không bao giờ vượt quá số tiền khách còn phải trả: voucher chỉ để bớt tiền
// phải thanh toán, không phải để hoàn tiền ngược lại cho khách.
const calculateDiscount = (voucher, subtotal, payableCeiling) => {
  const rawDiscount = voucher.discountType === 'percentage'
    ? Math.round((subtotal * Number(voucher.discountValue)) / 100)
    : Math.round(Number(voucher.discountValue));

  const maxDiscount = Number(voucher.maxDiscount || 0);
  const cappedByVoucher = maxDiscount > 0 ? Math.min(rawDiscount, maxDiscount) : rawDiscount;
  const ceiling = Math.max(Math.min(payableCeiling ?? subtotal, subtotal), 0);

  return {
    rawDiscount,
    discountAmount: Math.min(Math.max(cappedByVoucher, 0), ceiling),
    cappedByMaxDiscount: maxDiscount > 0 && rawDiscount > maxDiscount,
    cappedByPayable: cappedByVoucher > ceiling
  };
};

// Kiểm tra toàn bộ điều kiện của voucher với một đơn cụ thể.
// Dùng chung cho cả API xem trước lẫn lúc áp thật để hai nơi không lệch luật.
const evaluateVoucherForBooking = async (
  { code, booking, subtotal, payableCeiling, userId },
  connection
) => {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) {
    throw new HttpError(400, 'Vui lòng nhập mã voucher');
  }

  const [voucherRows] = await run(connection).query(
    'SELECT * FROM vouchers WHERE UPPER(code) = ?',
    [normalizedCode]
  );
  const voucher = voucherRows[0];
  if (!voucher) {
    throw new HttpError(404, 'Mã voucher không tồn tại');
  }

  if (voucher.status !== 'active') {
    throw new HttpError(409, 'Voucher này đang tạm ngừng sử dụng');
  }

  const today = dayString(new Date());
  if (voucher.startDate && dayString(voucher.startDate) > today) {
    throw new HttpError(409, `Voucher chỉ có hiệu lực từ ngày ${dayString(voucher.startDate)}`);
  }
  if (voucher.endDate && dayString(voucher.endDate) < today) {
    throw new HttpError(409, `Voucher đã hết hạn từ ngày ${dayString(voucher.endDate)}`);
  }
  if (Number(voucher.quantity) <= 0) {
    throw new HttpError(409, 'Voucher đã hết lượt sử dụng');
  }

  // Voucher tặng riêng cho một khách (VD đền bù no-show) thì người khác không dùng được.
  const [assignmentRows] = await run(connection).query(
    'SELECT id, userId, isUsed FROM customer_vouchers WHERE voucherId = ?',
    [voucher.id]
  );
  const customerVoucher = assignmentRows.find((row) => Number(row.userId) === Number(userId));
  if (assignmentRows.length > 0 && !customerVoucher) {
    throw new HttpError(403, 'Voucher này dành riêng cho khách hàng khác');
  }
  if (customerVoucher?.isUsed) {
    throw new HttpError(409, 'Bạn đã sử dụng voucher này rồi');
  }

  // Điều kiện hạng phòng
  const allowedRoomTypes = await listVoucherRoomTypes(voucher.id, connection);
  if (allowedRoomTypes.length > 0) {
    const bookingRoomTypes = await listBookingRoomTypeIds(booking.id, connection);
    const allowedIds = new Set(allowedRoomTypes.map((item) => Number(item.roomTypeId)));
    const matched = bookingRoomTypes.some((item) => allowedIds.has(Number(item.roomTypeId)));
    if (!matched) {
      throw new HttpError(
        409,
        `Voucher này chỉ áp dụng cho hạng phòng: ${allowedRoomTypes.map((item) => item.typeName).join(', ')}`
      );
    }
  }

  const minBookingAmount = Number(voucher.minBookingAmount || 0);
  if (subtotal < minBookingAmount) {
    throw new HttpError(400, `Đơn phải từ ${money(minBookingAmount)} trở lên mới dùng được voucher này`);
  }

  const breakdown = calculateDiscount(voucher, subtotal, payableCeiling);
  if (breakdown.discountAmount <= 0) {
    throw new HttpError(409, 'Voucher không giảm được thêm cho đơn này');
  }

  return {
    voucher,
    customerVoucher: customerVoucher || null,
    allowedRoomTypes,
    ...breakdown
  };
};

const notificationService = require('./notificationService');

const formatDate = (date) => dayString(date);

const createNoShowCompensationVoucher = async (userId, bookingId, connection) => {
  const code = voucherModel.generateNoShowCode(bookingId);

  // 1. Kiểm tra xem booking đã có voucher no_show trong customer_vouchers chưa
  let voucherData = await voucherModel.getVoucherByBookingId(bookingId, 'no_show', connection);

  if (!voucherData) {
    // 2. Kiểm tra xem mã voucher này đã tồn tại trong bảng vouchers chưa (tránh trùng UNIQUE code)
    const existingVoucherRow = await voucherModel.getVoucherByCode(code, connection);
    let voucherId;

    if (existingVoucherRow) {
      voucherId = existingVoucherRow.id;
    } else {
      const validFrom = formatDate(new Date());
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + NO_SHOW_VOUCHER_VALID_DAYS);
      const validUntil = formatDate(validUntilDate);

      voucherId = await voucherModel.createVoucher(
        {
          code,
          discountPercentage: NO_SHOW_DISCOUNT_PERCENT,
          validFrom,
          validUntil,
          usageLimit: 1
        },
        connection
      );
    }

    // 3. Gán voucher riêng cho khách hàng nếu có userId
    if (userId && voucherId) {
      const [existingAssignment] = await run(connection).query(
        'SELECT id FROM customer_vouchers WHERE voucherId = ? AND userId = ? AND bookingId = ?',
        [voucherId, userId, bookingId]
      );
      if (existingAssignment.length === 0) {
        await voucherModel.assignVoucherToUser(
          {
            userId,
            voucherId,
            bookingId,
            source: 'no_show'
          },
          connection
        );
      }
    }

    voucherData = await voucherModel.getVoucherByBookingId(bookingId, 'no_show', connection);
  }

  // 4. Gửi thông báo RIÊNG cho đúng khách hàng của booking (tự động chặn duplicate nếu đã gửi)
  if (userId && voucherData) {
    const vId = voucherData.voucherId || voucherData.id;
    const notifTitle = 'Bạn nhận được voucher ưu đãi';
    const notifContent = `Bạn được tặng voucher ${code} giảm ${NO_SHOW_DISCOUNT_PERCENT}% cho lần lưu trú tiếp theo.`;

    await notificationService.createNotificationForUser(
      {
        accountId: userId,
        type: 'voucher',
        title: notifTitle,
        content: notifContent,
        referenceType: 'voucher',
        referenceId: vId
      },
      connection
    );
  }

  return voucherData;
};

module.exports = {
  NO_SHOW_DISCOUNT_PERCENT,
  NO_SHOW_VOUCHER_VALID_DAYS,
  createNoShowCompensationVoucher,
  evaluateVoucherForBooking,
  calculateDiscount,
  listVoucherRoomTypes,
  listBookingRoomTypeIds
};

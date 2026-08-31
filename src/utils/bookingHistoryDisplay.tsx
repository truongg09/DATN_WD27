import type { ReactNode } from 'react';
import dayjs from 'dayjs';

const money = (value: unknown) =>
  `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))}₫`;

export const bookingHistoryActionText: Record<string, string> = {
  created: 'Tạo đơn đặt phòng',
  updated: 'Cập nhật đơn đặt phòng',
  status_change: 'Thay đổi trạng thái đơn',
  cancelled: 'Hủy đơn đặt phòng',
  no_show: 'Ghi nhận khách không đến',
  reactivated: 'Khôi phục đơn đặt phòng',
  reactivated_from_no_show: 'Khôi phục đơn sau khi khách không đến',
  reactivation_reverted: 'Hoàn tác khôi phục đơn',
  payment: 'Ghi nhận thanh toán',
  payment_requested: 'Yêu cầu thanh toán',
  transfer_confirmation: 'Khách xác nhận đã chuyển khoản',
  voucher_applied: 'Áp dụng mã ưu đãi',
  refund: 'Tạo giao dịch hoàn tiền',
  refund_approved: 'Duyệt hoàn tiền',
  refund_rejected: 'Từ chối hoàn tiền',
  service_added: 'Thêm dịch vụ',
  service_updated: 'Cập nhật dịch vụ',
  service_status_updated: 'Thay đổi trạng thái dịch vụ',
  service_removed: 'Hủy dịch vụ',
  damage_added: 'Thêm khoản phát sinh hoặc hư hỏng',
  damage_updated: 'Cập nhật khoản phát sinh hoặc hư hỏng',
  damage_status_updated: 'Thay đổi trạng thái khoản phát sinh',
  damage_removed: 'Hủy khoản phát sinh',
  checked_in: 'Nhận phòng',
  checked_out: 'Trả phòng',
  guests_updated: 'Cập nhật khách lưu trú',
  extended: 'Gia hạn thời gian lưu trú',
  shortened: 'Rút ngắn thời gian lưu trú',
  stay_updated: 'Cập nhật thời gian lưu trú',
  extended_and_transferred: 'Gia hạn và chuyển phòng',
  room_transferred: 'Chuyển phòng',
  room_reassigned: 'Đổi phòng',
  room_removed: 'Gỡ phòng khỏi đơn',
  room_cleaned: 'Xác nhận phòng đã dọn',
  update_arrival_time: 'Cập nhật giờ khách đến',
  hold_extended: 'Gia hạn thời gian giữ phòng',
  hold_reset: 'Gia hạn lại thời gian giữ phòng',
  early_checkin_fee: 'Thu phí nhận phòng sớm',
  late_checkout_fee: 'Thu phí trả phòng muộn',
  late_checkout_fee_waived: 'Miễn phí trả phòng muộn',
  late_checkout_over_limit: 'Trả phòng muộn quá giới hạn',
  room_deleted: 'Xóa phòng',
};

export const getBookingHistoryActionLabel = (action?: string | null) =>
  bookingHistoryActionText[String(action || '').toLowerCase()] || 'Thao tác hệ thống';

const roleText: Record<string, string> = {
  admin: 'Quản trị viên',
  employee: 'Nhân viên',
  staff: 'Nhân viên',
  manager: 'Quản lý',
  receptionist: 'Lễ tân',
  customer: 'Khách hàng',
  user: 'Khách hàng',
  system: 'Hệ thống',
};

export const getBookingHistoryRoleLabel = (role?: string | null) =>
  roleText[String(role || 'system').toLowerCase()] || 'Người dùng hệ thống';

export const getBookingHistoryActorName = (
  name?: string | null,
  role?: string | null,
) => {
  const cleanedName = String(name || '').trim();
  const normalizedName = cleanedName.toLowerCase();
  if (!cleanedName) return role ? getBookingHistoryRoleLabel(role) : 'Hệ thống tự động';
  if (roleText[normalizedName]) return roleText[normalizedName];
  return cleanedName;
};

const entityText: Record<string, string> = {
  booking: 'Đơn đặt phòng',
  stay: 'Thời gian lưu trú',
  room: 'Phòng',
  service: 'Dịch vụ',
  damage: 'Phát sinh và hư hỏng',
  payment: 'Thanh toán',
};

export const getBookingHistoryEntityLabel = (entity?: string | null) =>
  entityText[String(entity || 'booking').toLowerCase()] || 'Đơn đặt phòng';

const historyFieldText: Record<string, string> = {
  id: 'Mã bản ghi',
  bookingId: 'Mã đặt phòng',
  booking_id: 'Mã đặt phòng',
  bookingDetailId: 'Mã chi tiết phòng nội bộ',
  booking_detail_id: 'Mã chi tiết phòng nội bộ',
  status: 'Trạng thái',
  bookingStatus: 'Trạng thái đặt phòng',
  booking_status: 'Trạng thái đặt phòng',
  paymentStatus: 'Trạng thái thanh toán',
  payment_status: 'Trạng thái thanh toán',
  refundStatus: 'Trạng thái hoàn tiền',
  roomId: 'Mã phòng nội bộ',
  room_id: 'Mã phòng nội bộ',
  roomIds: 'Danh sách mã phòng nội bộ',
  room_ids: 'Danh sách mã phòng nội bộ',
  roomNumber: 'Số phòng',
  room_number: 'Số phòng',
  roomTypeId: 'Mã hạng phòng nội bộ',
  room_type_id: 'Mã hạng phòng nội bộ',
  roomTypeName: 'Hạng phòng',
  room_type_name: 'Hạng phòng',
  typeName: 'Hạng phòng',
  firstRoom: 'Phòng thứ nhất',
  secondRoom: 'Phòng thứ hai',
  fromRoom: 'Phòng cũ',
  toRoom: 'Phòng mới',
  checkIn: 'Ngày nhận phòng',
  check_in: 'Ngày nhận phòng',
  checkOut: 'Ngày trả phòng',
  check_out: 'Ngày trả phòng',
  checkInDate: 'Ngày nhận phòng',
  checkOutDate: 'Ngày trả phòng',
  actualCheckIn: 'Giờ nhận phòng thực tế',
  actual_check_in_time: 'Giờ nhận phòng thực tế',
  actualCheckOut: 'Giờ trả phòng thực tế',
  actual_check_out_time: 'Giờ trả phòng thực tế',
  requestedCheckInTime: 'Giờ nhận phòng dự kiến',
  requested_check_in_time: 'Giờ nhận phòng dự kiến',
  requestedCheckOutTime: 'Giờ trả phòng dự kiến',
  requested_check_out_time: 'Giờ trả phòng dự kiến',
  requestedCheckInDayOffset: 'Ngày nhận phòng dự kiến',
  requested_check_in_day_offset: 'Ngày nhận phòng dự kiến',
  offset: 'Ngày nhận phòng dự kiến',
  hours: 'Số giờ gia hạn',
  checkInTiming: 'Thời điểm nhận phòng',
  lateCheckIn: 'Nhận phòng muộn',
  fromDate: 'Từ ngày',
  toDate: 'Đến ngày',
  splitDate: 'Ngày bắt đầu thay đổi',
  date: 'Ngày',
  stayDate: 'Ngày lưu trú',
  createdAt: 'Thời điểm tạo',
  updatedAt: 'Thời điểm cập nhật',
  processedAt: 'Thời điểm xử lý',
  holdUntil: 'Giữ phòng đến',
  previousHoldUntil: 'Thời hạn giữ phòng cũ',
  newHoldUntil: 'Thời hạn giữ phòng mới',
  hold_reset_count: 'Số lần gia hạn giữ phòng',
  holdExpiresAt: 'Thời hạn giữ phòng',
  hold_expires_at: 'Thời hạn giữ phòng',
  totalPrice: 'Tổng tiền',
  totalAmount: 'Tổng tiền hóa đơn',
  oldTotalAmount: 'Tổng tiền cũ',
  newTotalAmount: 'Tổng tiền mới',
  priceDifference: 'Chênh lệch giá',
  basePrice: 'Giá cơ bản',
  baseRoomPrice: 'Giá phòng cơ bản mỗi đêm',
  roomPrice: 'Tiền phòng',
  pricePerNight: 'Giá mỗi đêm',
  roomStayAmount: 'Tiền lưu trú',
  stayTotal: 'Tổng tiền lưu trú',
  itemTotal: 'Thành tiền',
  unitPrice: 'Đơn giá',
  price: 'Giá',
  amount: 'Số tiền',
  depositAmount: 'Tiền cọc',
  paidAmount: 'Đã thanh toán',
  remainingAmount: 'Còn phải thanh toán',
  newRemainingAmount: 'Số tiền còn lại mới',
  serviceAmount: 'Tiền dịch vụ',
  damageAmount: 'Tiền phát sinh',
  surcharge: 'Phụ thu',
  surchargeAmount: 'Tiền phụ thu',
  addedSurcharge: 'Phụ thu tăng thêm',
  occupancySurcharge: 'Phụ thu theo số khách',
  baseRoomAmount: 'Tiền phòng cơ bản',
  holidaySurcharge: 'Phụ thu ngày lễ',
  sundaySurcharge: 'Phụ thu chủ nhật',
  weekendSurcharge: 'Phụ thu cuối tuần',
  upgradeFee: 'Phí nâng hạng phòng',
  extraGuestSurcharge: 'Phụ thu khách thêm',
  childSurchargeAmount: 'Phụ thu trẻ em',
  discountAmount: 'Số tiền giảm',
  refundAmount: 'Số tiền hoàn',
  refundableExcessAmount: 'Số tiền thừa được hoàn',
  waivedAmount: 'Số tiền được miễn',
  feeAmount: 'Tiền phí',
  paidTotal: 'Tổng tiền đã thanh toán',
  reducedStayAmount: 'Tiền lưu trú được giảm',
  paymentMethod: 'Phương thức thanh toán',
  refundMethod: 'Phương thức hoàn tiền',
  transactionCode: 'Mã giao dịch',
  walletTransactionId: 'Mã giao dịch ví',
  quantity: 'Số lượng',
  serviceId: 'Mã dịch vụ',
  serviceName: 'Tên dịch vụ',
  itemName: 'Tên khoản phí hoặc vật dụng',
  chargeType: 'Loại khoản phí',
  voucherCode: 'Mã ưu đãi',
  reason: 'Lý do',
  note: 'Ghi chú',
  notes: 'Ghi chú',
  description: 'Mô tả',
  warnings: 'Cảnh báo',
  rooms: 'Danh sách phòng',
  roomList: 'Danh sách phòng',
  guests: 'Danh sách khách lưu trú',
  guestName: 'Tên khách',
  fullName: 'Họ và tên',
  newStagePrices: 'Chi tiết giá từng đêm mới',
  stagePrices: 'Chi tiết giá từng đêm',
  nightlyPrices: 'Chi tiết giá từng đêm',
  financialBreakdown: 'Chi tiết tiền',
  reducedNightlyPrices: 'Chi tiết giá các đêm được giảm',
  adults: 'Người lớn',
  children: 'Trẻ em',
  childrenAges: 'Độ tuổi trẻ em',
  addedNights: 'Số đêm tăng thêm',
  totalNights: 'Tổng số đêm',
  reducedNights: 'Số đêm giảm',
  unusedNights: 'Số đêm không sử dụng',
  nights: 'Số đêm',
  dayName: 'Thứ',
  dayOfWeek: 'Ngày trong tuần',
  isHoliday: 'Ngày lễ',
  isSaturday: 'Thứ bảy',
  isSunday: 'Chủ nhật',
  isWeekend: 'Cuối tuần',
  holidayName: 'Tên ngày lễ',
  priceType: 'Loại giá',
  surchargePercent: 'Tỷ lệ phụ thu',
  percent: 'Tỷ lệ',
  refundRate: 'Tỷ lệ hoàn tiền',
  lateMinutes: 'Số phút trả muộn',
  holdResetCount: 'Số lần gia hạn giữ phòng',
  remainingResets: 'Số lần gia hạn còn lại',
  isShortening: 'Rút ngắn kỳ lưu trú',
  isExtending: 'Gia hạn kỳ lưu trú',
  isTransferring: 'Chuyển phòng',
  isNewRoom: 'Phòng mới',
  isDeleted: 'Đã xóa',
  conflictingBookingId: 'Mã đơn đặt phòng bị trùng',
  room103: 'Phòng 103',
  room301: 'Phòng 301',
  room502: 'Phòng 502',
};

export const getBookingHistoryFieldLabel = (key: string) => {
  if (historyFieldText[key]) return historyFieldText[key];
  const roomMatch = key.match(/^room[_-]?(\d+)$/i);
  if (roomMatch) return `Phòng ${roomMatch[1]}`;
  return 'Thông tin bổ sung';
};

const historyValueText: Record<string, string> = {
  pending: 'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  checked_in: 'Đang lưu trú',
  checked_out: 'Đã trả phòng',
  checkin: 'Đang lưu trú',
  checkout: 'Đã trả phòng',
  cancelled: 'Đã hủy',
  no_show: 'Khách không đến',
  unpaid: 'Chưa thanh toán',
  deposit_paid: 'Đã thanh toán tiền cọc',
  paid: 'Đã thanh toán đủ',
  refunded: 'Đã hoàn tiền',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
  processing: 'Đang xử lý',
  completed: 'Đã hoàn tất',
  failed: 'Thất bại',
  expired: 'Hết hạn',
  used: 'Đang sử dụng',
  unused: 'Chưa sử dụng',
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản ngân hàng',
  credit_card: 'Thẻ tín dụng',
  wallet: 'Ví khách hàng',
  zalopay: 'ZaloPay',
  vnpay: 'VNPay',
  damage: 'Hư hỏng hoặc mất đồ',
  extra_fee: 'Phụ phí',
  other: 'Khoản khác',
  active: 'Đang hoạt động',
  inactive: 'Ngừng hoạt động',
  available: 'Phòng trống',
  occupied: 'Đang có khách',
  maintenance: 'Đang bảo trì',
  cleaning: 'Đang dọn phòng',
  reserved: 'Đã giữ phòng',
  normal: 'Giá ngày thường',
  weekday: 'Giá ngày thường',
  saturday: 'Giá thứ bảy',
  sunday: 'Giá chủ nhật',
  weekend: 'Giá cuối tuần',
  holiday: 'Giá ngày lễ',
  season: 'Giá theo mùa',
  special: 'Giá đặc biệt',
  event: 'Giá sự kiện',
  early: 'Sớm',
  on_time: 'Đúng giờ',
  late: 'Muộn',
  admin: 'Quản trị viên',
  employee: 'Nhân viên',
  staff: 'Nhân viên',
  manager: 'Quản lý',
  receptionist: 'Lễ tân',
  customer: 'Khách hàng',
  system: 'Hệ thống',
  standard: 'Tiêu chuẩn',
  superior: 'Cao cấp',
  deluxe: 'Hạng sang',
  suite: 'Phòng thượng hạng',
  family: 'Phòng gia đình',
  monday: 'Thứ hai',
  tuesday: 'Thứ ba',
  wednesday: 'Thứ tư',
  thursday: 'Thứ năm',
  friday: 'Thứ sáu',
  saturday_day: 'Thứ bảy',
  sunday_day: 'Chủ nhật',
  true: 'Có',
  false: 'Không',
};

const moneyFieldPattern = /amount|price|fee|total|difference|surcharge/i;
const dateFieldPattern = /date|time|checkin|checkout|createdat|updatedat|processedat|holduntil|expires/i;
const percentFieldPattern = /percent|rate/i;

const tryParseStructuredString = (value: string): unknown => {
  const trimmed = value.trim();
  if (!trimmed || !['{', '['].includes(trimmed[0])) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const formatScalar = (key: string, value: string | number | boolean): ReactNode => {
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (key === 'dayOfWeek' && Number.isInteger(Number(value))) {
    return ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][Number(value)] || String(value);
  }
  const raw = String(value).trim();
  const normalizedKey = key.toLowerCase();
  const normalizedValue = raw.toLowerCase();
  if (key === 'dayName') {
    const dayText: Record<string, string> = {
      sunday: 'Chủ nhật', monday: 'Thứ hai', tuesday: 'Thứ ba',
      wednesday: 'Thứ tư', thursday: 'Thứ năm', friday: 'Thứ sáu', saturday: 'Thứ bảy',
    };
    return dayText[normalizedValue] || raw;
  }
  if (normalizedKey.includes('time')) {
    const timeMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (timeMatch) return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
  }
  if (
    normalizedKey === 'requestedcheckindayoffset'
    || normalizedKey === 'requested_check_in_day_offset'
    || normalizedKey === 'offset'
  ) {
    if (Number(value) === 0) return 'Cùng ngày nhận phòng';
    if (Number(value) === 1) return 'Ngày hôm sau';
    if (Number.isFinite(Number(value))) return `${value} ngày sau`;
  }
  if (normalizedKey === 'paymentstatus' || normalizedKey === 'payment_status') {
    if (normalizedValue === 'pending') return 'Chờ thanh toán';
  }
  if (normalizedKey === 'refundstatus' && normalizedValue === 'pending') return 'Chờ duyệt';
  if (normalizedKey === 'status' && normalizedValue === 'normal') return 'Bình thường';
  if (key === 'childrenAges' && Number.isFinite(Number(value))) return `${value} tuổi`;
  if (percentFieldPattern.test(key) && Number.isFinite(Number(value))) {
    const numeric = Number(value);
    return `${key.toLowerCase().includes('rate') && Math.abs(numeric) <= 1 ? numeric * 100 : numeric}%`;
  }
  if (moneyFieldPattern.test(key) && Number.isFinite(Number(value))) return money(value);
  if (dateFieldPattern.test(key) && dayjs(raw).isValid()) {
    const parsed = dayjs(raw);
    return /t|\s\d{1,2}:\d{2}/i.test(raw)
      ? parsed.format('HH:mm — DD/MM/YYYY')
      : parsed.format('DD/MM/YYYY');
  }
  const translated = historyValueText[raw.toLowerCase()];
  return translated || raw;
};

export const renderBookingHistoryValue = (
  key: string,
  rawValue: unknown,
  depth = 0,
): ReactNode => {
  if (rawValue == null || rawValue === '') return 'Không có';

  const value = typeof rawValue === 'string' ? tryParseStructuredString(rawValue) : rawValue;
  if (value !== rawValue) return renderBookingHistoryValue(key, value, depth);

  if (Array.isArray(value)) {
    if (value.length === 0) return 'Không có';
    const containsObject = value.some((item) => item != null && typeof item === 'object');
    if (!containsObject) {
      return value.map((item) => formatScalar(key, item as string | number | boolean)).join(', ');
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        {value.map((item, index) => (
          <div key={`${key}-${index}`} style={{ padding: '7px 9px', border: '1px solid #e3e3e3', borderRadius: 7, background: '#fff' }}>
            <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 700, marginBottom: 3 }}>Mục {index + 1}</div>
            {renderBookingHistoryValue(key, item, depth + 1)}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return 'Không có';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: depth > 0 ? 3 : 2, marginTop: depth > 0 ? 3 : 0 }}>
        {entries.map(([childKey, childValue], index) => (
          <div
            key={`${childKey}-${index}`}
            style={{
              display: 'grid',
              gridTemplateColumns: depth > 1 ? 'minmax(105px, 0.7fr) minmax(120px, 1.3fr)' : 'minmax(135px, 0.8fr) minmax(140px, 1.2fr)',
              gap: 8,
              alignItems: 'start',
              padding: '2px 0',
            }}
          >
            <span style={{ color: '#555', fontWeight: 600 }}>{getBookingHistoryFieldLabel(childKey)}:</span>
            <span style={{ color: '#222', minWidth: 0, overflowWrap: 'anywhere' }}>
              {renderBookingHistoryValue(childKey, childValue, depth + 1)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return formatScalar(key, value as string | number | boolean);
};

export const renderBookingHistoryValueBox = (
  title: string,
  value: unknown,
  background: string,
) => {
  if (value == null) return null;
  return (
    <div style={{ flex: 1, minWidth: 260, background, padding: '10px 12px', borderRadius: 8, border: '1px solid #e8e8e8' }}>
      <div style={{ fontSize: 13, color: '#444', fontWeight: 700, marginBottom: 5 }}>{title}</div>
      {renderBookingHistoryValue('', value)}
    </div>
  );
};

export const localizeBookingHistoryDescription = (
  description?: string | null,
  action?: string | null,
) => {
  const source = description || 'Không có mô tả';
  // Một số bản ghi cũ đã mất dấu tiếng Việt ngay từ lúc lưu và chứa ký tự
  // thay thế. Không phỏng đoán nội dung sai; dùng đúng tên thao tác đã chuẩn hóa.
  if (/[?�]/.test(source)) {
    return action ? `${getBookingHistoryActionLabel(action)}.` : 'Thao tác đã được ghi nhận.';
  }
  return source
    .replace(/\bBooking\b/gi, 'đơn đặt phòng')
    .replace(/\bNo[-_ ]?show\b/gi, 'khách không đến')
    .replace(/check[- ]?in/gi, 'nhận phòng')
    .replace(/check[- ]?out|checkout/gi, 'trả phòng')
    .replace(/\bAdmin\b/gi, 'Quản trị viên')
    .replace(/\bbill\b/gi, 'hóa đơn')
    .replace(/\bvoucher\b/gi, 'mã ưu đãi')
    .replace(/\bpayment\b/gi, 'thanh toán')
    .replace(/\bstatus\b/gi, 'trạng thái')
    .replace(/\broom\b/gi, 'phòng')
    .replace(/\bservice\b/gi, 'dịch vụ')
    .replace(/\bdamage\b/gi, 'hư hỏng')
    .replace(/\bHair Dryer\b/gi, 'Máy sấy tóc')
    .replace(/\bAir Conditioner\b/gi, 'Điều hòa')
    .replace(/\bMini Bar\b/gi, 'Tủ lạnh minibar')
    .replace(/\bDesk Lamp\b/gi, 'Đèn bàn')
    .replace(/\bRemote\b/gi, 'Điều khiển từ xa')
    .replace(/\bKettle\b/gi, 'Ấm siêu tốc')
    .replace(/\bWardrobe\b/gi, 'Tủ quần áo')
    .replace(/\bMirror\b/gi, 'Gương')
    .replace(/\bTV\b/gi, 'Tivi')
    .replace(/\bStandard\b/gi, 'Tiêu chuẩn')
    .replace(/\bSuperior\b/gi, 'Cao cấp')
    .replace(/\bDeluxe\b/gi, 'Hạng sang')
    .replace(/\bSuite\b/gi, 'Phòng thượng hạng')
    .replace(/\bFamily\b/gi, 'Phòng gia đình')
    .replace(/\bbank_transfer\b/gi, 'chuyển khoản ngân hàng')
    .replace(/\bcredit_card\b/gi, 'thẻ tín dụng')
    .replace(/\bcash\b/gi, 'tiền mặt')
    .replace(/\bwallet\b/gi, 'ví khách hàng')
    .replace(/\bdeposit_paid\b/gi, 'đã thanh toán tiền cọc')
    .replace(/\bconfirmed\b/gi, 'đã xác nhận')
    .replace(/\bchecked_in\b/gi, 'đang lưu trú')
    .replace(/\bchecked_out\b/gi, 'đã trả phòng')
    .replace(/\brefunded\b/gi, 'đã hoàn tiền')
    .replace(/\bpending\b/gi, 'đang chờ xử lý')
    .replace(/\bcancelled\b/gi, 'đã hủy')
    .replace(/\bunused\b/gi, 'chưa sử dụng')
    .replace(/\bused\b/gi, 'đang sử dụng');
};

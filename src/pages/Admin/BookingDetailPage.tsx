import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Alert, Breadcrumb, Button, Card, Checkbox, Col, Descriptions, Empty, Form, Input, InputNumber, Modal,
  Popconfirm, Row, Select, Skeleton, Space, Table, Tag, Timeline, Typography, message,
} from 'antd';
import {
  ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
  DeleteOutlined, EditOutlined, LoginOutlined, LogoutOutlined, PhoneOutlined,
  PlusOutlined, ReloadOutlined, UserOutlined,
} from '@ant-design/icons';
import {
  addBookingDamageCharge, addBookingServiceCharge,
  deleteBookingDamageCharge, deleteBookingServiceCharge,
  updateBookingDamageCharge,
  updateBookingServiceCharge,
  recordCustomerContact,
} from '../../services/bookingService';
import type { CustomerContactAction } from '../../services/bookingService';
import { getPolicies, type PoliciesInfo } from '../../services/settingsService';
import dayjs from 'dayjs';
import api from '../../services/api';
import {
  getBookingHistoryActionLabel,
  getBookingHistoryActorName,
  getBookingHistoryEntityLabel,
  getBookingHistoryRoleLabel,
  localizeBookingHistoryDescription,
} from '../../utils/bookingHistoryDisplay';
import CheckoutPaymentModal from './CheckoutPaymentModal';

const money = (value?: string | number | null) =>
  new Intl.NumberFormat('vi-VN').format(Number(value || 0)) + '₫';

const day = (value?: string | null) => {
  if (!value) return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('DD/MM/YYYY') : '—';
};

const dateTime = (value?: string | null) => {
  if (!value) return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('HH:mm — DD/MM/YYYY') : '—';
};

// Số đêm lưu trú tính theo ngày, không phụ thuộc giờ nhận/trả cụ thể.
const countNights = (checkIn?: string | null, checkOut?: string | null) => {
  if (!checkIn || !checkOut) return 0;
  const from = dayjs(checkIn).startOf('day');
  const to = dayjs(checkOut).startOf('day');
  return Math.max(to.diff(from, 'day'), 0);
};

// Trạng thái đơn dùng chung cho cả trang.
export const bookingStatusText: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  checked_in: 'Đang lưu trú',
  checked_out: 'Đã trả phòng',
  cancelled: 'Đã hủy',
  no_show: 'Khách không đến',
};

export const bookingStatusColor: Record<string, string> = {
  pending: 'orange',
  confirmed: 'blue',
  checked_in: 'green',
  checked_out: 'default',
  cancelled: 'red',
  no_show: 'volcano',
};

interface ServiceCharge {
  id: number;
  serviceId: number;
  serviceName: string;
  roomId?: number | null;
  roomNumber?: string | null;
  roomTypeName?: string | null;
  unitPrice: string | number;
  quantity: number;
  totalPrice: string | number;
  status: string;
  createdAt?: string | null;
}

interface InventoryItem {
  id: number;
  roomId: number;
  roomNumber?: string;
  itemName: string;
  quantity: number;
  status: string;
  compensationPrice?: string | number;
}

interface BookingRoomOption {
  id: number;
  bookingDetailId: number;
  roomNumber: string;
  roomTypeName: string;
}

// Trạng thái một dòng dịch vụ / khoản phí. Phải khớp đúng danh sách backend
// chấp nhận (ALLOWED_SERVICE_STATUSES), nếu không thao tác sẽ bị từ chối.
const chargeStatusMeta: Record<string, { label: string; color: string }> = {
  unused: { label: 'Đang sử dụng', color: 'green' },
  used: { label: 'Đang sử dụng', color: 'green' },
  cancelled: { label: 'Đã hủy', color: 'red' },
};

// Loại khoản phí phát sinh ngoài dịch vụ.
interface HistoryEntry {
  id: number;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  entityLabel?: string | null;
  description?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  amount?: string | number | null;
  performedBy?: number | null;
  performedByName?: string | null;
  performedByRole?: string | null;
  performedByEmail?: string | null;
  createdAt: string;
}

// Nhóm lịch sử theo đối tượng bị tác động, khớp entityType của máy chủ.
const historyGroups: { key: string; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'booking', label: 'Đơn đặt phòng' },
  { key: 'stay', label: 'Nhận / trả phòng' },
  { key: 'room', label: 'Phòng' },
  { key: 'service', label: 'Dịch vụ' },
  { key: 'damage', label: 'Phát sinh' },
  { key: 'payment', label: 'Thanh toán' },
];

const paymentStatusText: Record<string, string> = {
  unpaid: 'Chưa thanh toán',
  deposit_paid: 'Đã đặt cọc',
  paid: 'Đã thanh toán đủ',
  refunded: 'Đã hoàn tiền',
};

const chargeTypeMeta: Record<string, string> = {
  damage: 'Hư hỏng / mất đồ',
  extra_fee: 'Phụ phí',
  other: 'Khoản khác',
};

interface PaymentSnapshot {
  id?: number;
  roomAmount?: string | number;
  serviceAmount?: string | number;
  surchargeAmount?: string | number;
  discountAmount?: string | number;
  totalAmount?: string | number;
  paidAmount?: string | number;
  remainingAmount?: string | number;
  paymentStatus?: string;
}

interface DamageCharge {
  id: number;
  chargeType: string;
  itemName: string;
  roomId?: number | null;
  roomNumber?: string | null;
  roomTypeName?: string | null;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  status: string;
  note?: string | null;
  createdAt?: string | null;
}

export interface BookingDetailData {
  id: number;
  booking_code?: string | null;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  check_in: string | null;
  check_out: string | null;
  adults: number | null;
  children: number | null;
  room_number: string | null;
  room_type_name: string | null;
  room_capacity?: number | null;
  room_floor?: number | null;
  room_area?: string | number | null;
  room_price?: string | number | null;
  room_quantity?: number | null;
  room_total_price?: string | number | null;
  occupancy_surcharge?: string | number | null;
  payable_total?: string | number | null;
  notes?: string | null;
  cancellation_reason?: string | null;
  late_arrival_confirmed?: boolean | number | null;
  late_arrival_note?: string | null;
  late_arrival_confirmed_at?: string | null;
  late_arrival_confirmed_by?: number | null;
  late_arrival_confirmed_by_name?: string | null;
  contact_result?: string | null;
  created_at?: string | null;
  actual_check_in_time?: string | null;
  actual_check_out_time?: string | null;
  services?: Record<string, unknown>[];
  damages?: Record<string, unknown>[];
  late_checkout_charges?: Record<string, unknown>[];
  lateCheckoutCharge?: Record<string, unknown> | null;
  guests?: Record<string, unknown>[];
  transfers?: Record<string, unknown>[];
  payments?: PaymentSnapshot[];
  payment?: PaymentSnapshot | null;
  booking_rooms?: Array<Record<string, unknown>>;
  details?: Array<Record<string, unknown>>;
  nightly_prices?: Array<{
    stayDate: string;
    price: number;
    priceType: string;
    dayName: string;
    isHoliday: boolean;
    isWeekend: boolean;
    surcharge: number;
  }>;
  price_breakdown?: {
    basePricePerNight: number;
    baseRoomAmount: number;
    holidaySurcharge: number;
    weekendSurcharge: number;
    sundaySurcharge: number;
    occupancySurcharge: number;
    serviceAmount: number;
    damageAmount: number;
    totalPrice: number;
  };
}

/**
 * Trang chi tiết đặt phòng dành cho quản trị/lễ tân.
 * Tách hẳn thành trang riêng thay vì popup để chứa đủ thông tin và cho phép
 * thao tác trực tiếp: dịch vụ, phát sinh, hư hỏng, nhận phòng, trả phòng.
 */
function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const bookingId = Number(id);
  const areaPrefix = location.pathname.startsWith('/staff') ? '/staff' : '/admin';

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBooking = useCallback(
    async (silent = false) => {
      if (!Number.isInteger(bookingId) || bookingId <= 0) {
        setError('Mã đặt phòng không hợp lệ');
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const response = await api.get(`/bookings/${bookingId}`);
        setBooking((response as unknown as { data: BookingDetailData }).data);
        setError(null);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
        if (!silent) {
          setError(msg || 'Không tải được chi tiết đặt phòng');
          setBooking(null);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [bookingId]
  );

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  // ─── Dịch vụ & Vật tư ───────────────────────────────────────────
  const [services, setServices] = useState<{ id: number; serviceName: string; price: number }[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<ServiceCharge | null>(null);
  const [serviceForm] = Form.useForm();
  const [working, setWorking] = useState(false);
  const [checkoutPaymentOpen, setCheckoutPaymentOpen] = useState(false);
  const [policies, setPolicies] = useState<PoliciesInfo | null>(null);
  const [earlyCheckInModalOpen, setEarlyCheckInModalOpen] = useState(false);
  const [waiveEarlySurcharge, setWaiveEarlySurcharge] = useState(false);
  const [waiveReason, setWaiveReason] = useState('');

  useEffect(() => {
    getPolicies()
      .then((res) => {
        if (res?.data) setPolicies(res.data);
      })
      .catch((err) => console.warn('Lỗi lấy chính sách giờ nhận phòng:', err));
  }, []);

  useEffect(() => {
    api
      .get('/services')
      .then((res) => {
        const list = (res as unknown as { data?: { id: number; serviceName: string; price: number }[] }).data || [];
        setServices(list);
      })
      .catch(() => setServices([]));

    api
      .get('/room-items')
      .then((res: any) => {
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setInventoryItems(list);
      })
      .catch(() => setInventoryItems([]));
  }, []);

  const showApiError = (err: unknown, fallback: string) => {
    const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
    message.error(msg || fallback);
  };

  const openServiceModal = (charge?: ServiceCharge) => {
    setEditingCharge(charge || null);
    serviceForm.resetFields();
    if (charge) {
      serviceForm.setFieldsValue({
        quantity: charge.quantity,
        roomId: charge.roomId ?? null,
      });
    } else {
      serviceForm.setFieldsValue({ quantity: 1 });
    }
    setServiceModalOpen(true);
  };

  const bookingRooms: BookingRoomOption[] = useMemo(() => {
    const rawList = (booking?.details && booking.details.length > 0)
      ? booking.details
      : (booking?.booking_rooms && booking.booking_rooms.length > 0)
      ? booking.booking_rooms
      : [];

    return rawList.map((r: any) => {
      const rec = r as Record<string, unknown>;
      return {
        id: Number(rec.roomId || rec.room_id || rec.id || 0),
        bookingDetailId: Number(rec.bookingDetailId || rec.booking_detail_id || rec.id || 0),
        roomNumber: String(rec.roomNumber || rec.number || rec.room_number || ''),
        roomTypeName: String(rec.typeName || rec.room_type_name || rec.roomTypeName || ''),
      };
    }).filter((r) => r.id > 0);
  }, [booking]);

  const roomInfoMap = useMemo(() => {
    const map = new Map<number, { roomNumber: string; roomTypeName: string }>();
    bookingRooms.forEach((r) => map.set(r.id, { roomNumber: r.roomNumber, roomTypeName: r.roomTypeName }));
    return map;
  }, [bookingRooms]);

  const formatRoomLabel = (
    roomId: number | null | undefined,
    roomNumberFallback?: string | null,
    roomTypeNameFallback?: string | null,
  ) => {
    const info = roomId ? roomInfoMap.get(Number(roomId)) : undefined;
    const roomNumber = info?.roomNumber || String(roomNumberFallback || '');
    const roomTypeName = info?.roomTypeName || String(roomTypeNameFallback || '');
    const parts = [roomTypeName, roomNumber].filter(Boolean);
    return parts.length > 0 ? parts.join(' - ') : '—';
  };

  const submitService = async () => {
    const values = await serviceForm.validateFields();
    setWorking(true);
    try {
      if (editingCharge) {
        await updateBookingServiceCharge(bookingId, editingCharge.id, {
          quantity: values.quantity,
          roomId: values.roomId ?? null,
        });
        message.success('Đã cập nhật dịch vụ');
      } else {
        const selectedRoom = bookingRooms.find(
          (room) => room.id === Number(values.roomId),
        );
        await addBookingServiceCharge(bookingId, {
          serviceId: values.serviceId,
          quantity: values.quantity,
          roomId: values.roomId ?? null,
          bookingDetailId: selectedRoom?.bookingDetailId || null,
          status: 'used',
        });
        message.success('Đã thêm dịch vụ vào đơn');
      }
      setServiceModalOpen(false);
      await loadBooking(true);
      await loadHistory(historyGroup);
    } catch (err) {
      showApiError(err, 'Không lưu được dịch vụ');
    } finally {
      setWorking(false);
    }
  };

  // ─── Lịch sử thao tác ───────────────────────────────────────────
  const [historyGroup, setHistoryGroup] = useState('all');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = useCallback(
    async (group: string) => {
      if (!Number.isInteger(bookingId) || bookingId <= 0) return;
      setHistoryLoading(true);
      try {
        const query = group === 'all' ? '' : `?entityType=${group}`;
        const response = await api.get(`/bookings/${bookingId}/history${query}`);
        setHistory((response as unknown as { data: HistoryEntry[] }).data || []);
      } catch {
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    },
    [bookingId]
  );

  useEffect(() => {
    void loadHistory(historyGroup);
  }, [loadHistory, historyGroup]);

  // ─── Nhận phòng / trả phòng ─────────────────────────────────────
  const computeEarlyCheckInInfo = (b: BookingDetailData | null, checkInTimeStr = '14:00') => {
    if (!b?.check_in) {
      return { isEarly: false, percent: 0, surchargeAmount: 0, timeWindowLabel: 'Đúng giờ', hoursEarly: 0, description: '' };
    }
    const now = dayjs();
    const checkInDate = dayjs(b.check_in).startOf('day');
    const isToday = now.isSame(checkInDate, 'day');
    if (!isToday) {
      return { isEarly: false, percent: 0, surchargeAmount: 0, timeWindowLabel: 'Đúng giờ', hoursEarly: 0, description: '' };
    }

    const stdTime = checkInTimeStr || '14:00';
    const [stdH, stdM] = stdTime.split(':').map((v) => parseInt(v, 10) || 0);
    const standardCheckIn = checkInDate.hour(stdH).minute(stdM).second(0);

    if (!now.isBefore(standardCheckIn)) {
      return { isEarly: false, percent: 0, surchargeAmount: 0, timeWindowLabel: 'Đúng giờ', hoursEarly: 0, description: 'Check-in đúng giờ tiêu chuẩn' };
    }

    const t1H = Number(policies?.earlyCheckInPolicy?.tier1Hours ?? policies?.earlyTier1Hours ?? 8.0);
    const t1P = Number(policies?.earlyCheckInPolicy?.tier1Percent ?? policies?.earlyTier1Percent ?? 100.0);
    const t2H = Number(policies?.earlyCheckInPolicy?.tier2Hours ?? policies?.earlyTier2Hours ?? 5.0);
    const t2P = Number(policies?.earlyCheckInPolicy?.tier2Percent ?? policies?.earlyTier2Percent ?? 50.0);
    const t3H = Number(policies?.earlyCheckInPolicy?.tier3Hours ?? policies?.earlyTier3Hours ?? 2.0);
    const t3P = Number(policies?.earlyCheckInPolicy?.tier3Percent ?? policies?.earlyTier3Percent ?? 30.0);

    const diffMinutes = Math.max(0, standardCheckIn.diff(now, 'minute'));
    const hoursEarly = Math.round((diffMinutes / 60) * 10000) / 10000;
    const displayHoursEarly = Math.round(hoursEarly * 10) / 10;

    const stdDecimal = stdH + (stdM / 60);

    const formatDec = (h: number) => {
      const norm = Math.max(0, h);
      const totalMins = Math.round(norm * 60);
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    const t1TimeStr = formatDec(stdDecimal - t1H);
    const t2TimeStr = formatDec(stdDecimal - t2H);
    const t3TimeStr = formatDec(stdDecimal - t3H);
    const stdLabel = stdTime.slice(0, 5);

    let percent = 0;
    let timeWindowLabel = '';
    let description = '';

    if (hoursEarly >= t1H) {
      percent = t1P;
      timeWindowLabel = `Trước ${t1TimeStr} (Sáng sớm)`;
      description = `Phụ thu ${t1P}% giá 1 đêm do nhận phòng trước ${t1TimeStr} (sớm ${displayHoursEarly} tiếng, từ ${t1H}h trở lên)`;
    } else if (hoursEarly >= t2H) {
      percent = t2P;
      timeWindowLabel = `${t1TimeStr} - ${t2TimeStr} (Sáng)`;
      description = `Phụ thu ${t2P}% giá 1 đêm do nhận phòng từ ${t1TimeStr} đến ${t2TimeStr} (sớm ${displayHoursEarly} tiếng, từ ${t2H}h đến ${t1H}h)`;
    } else if (hoursEarly >= t3H) {
      percent = t3P;
      timeWindowLabel = `${t2TimeStr} - ${t3TimeStr} (Trưa)`;
      description = `Phụ thu ${t3P}% giá 1 đêm do nhận phòng từ ${t2TimeStr} đến ${t3TimeStr} (sớm ${displayHoursEarly} tiếng, từ ${t3H}h đến ${t2H}h)`;
    } else {
      percent = 0;
      timeWindowLabel = `${t3TimeStr} - ${stdLabel} (Miễn phí)`;
      description = `Miễn phí nhận phòng sớm (từ ${t3TimeStr} đến ${stdLabel}, sớm dưới ${t3H} tiếng)`;
    }

    const nightlyRate = Array.isArray(b.details) && b.details.length > 0
      ? b.details.reduce((sum: number, d: any) => sum + Number(d.roomPrice || d.price || 0), 0)
      : Number((b as any).room_price || (b as any).price_per_night || 0);
    const surchargeAmount = Math.round((nightlyRate * percent) / 100);

    return {
      isEarly: true,
      percent,
      surchargeAmount,
      timeWindowLabel,
      hoursEarly: displayHoursEarly,
      description
    };
  };

  const handleCheckInClick = () => {
    if (!booking) return;
    const earlyInfo = computeEarlyCheckInInfo(booking, policies?.checkInTime || '14:00');
    if (earlyInfo.isEarly) {
      setWaiveEarlySurcharge(false);
      setWaiveReason('');
      setEarlyCheckInModalOpen(true);
    } else {
      Modal.confirm({
        title: 'Xác nhận nhận phòng',
        content: `Xác nhận cho khách "${booking.customer_name || 'Khách'}" nhận phòng #${booking.room_number || (booking as any).room_id || ''}?`,
        okText: 'Nhận phòng',
        cancelText: 'Hủy',
        onOk: () => executeCheckIn({ waiveEarlySurcharge: false }),
      });
    }
  };

  const executeCheckIn = async (opts: { waiveEarlySurcharge?: boolean; waiveReason?: string } = {}) => {
    setWorking(true);
    try {
      const response = await api.patch(`/bookings/${bookingId}/check-in`, {
        waiveEarlySurcharge: Boolean(opts.waiveEarlySurcharge),
        waiveReason: opts.waiveReason || undefined,
      }, { skipMutationConfirm: true });
      const resData = (response as any)?.data || response;
      const msg = resData?.message || (response as unknown as { message?: string }).message;
      message.success(msg || 'Đã nhận phòng thành công');
      setEarlyCheckInModalOpen(false);
      await loadBooking(true);
      await loadHistory(historyGroup);
    } catch (err) {
      showApiError(err, 'Không thể nhận phòng');
    } finally {
      setWorking(false);
    }
  };

  const handleContactAction = (action: CustomerContactAction) => {
    if (!bookingId || !booking) return;

    if (action === 'will_arrive_late') {
      let noteValue = '';
      Modal.confirm({
        title: '✅ Xác nhận khách sẽ đến muộn',
        width: 520,
        content: (
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8, fontSize: 13, color: '#475569' }}>
              Nhập lý do khách thông báo đến muộn / giờ dự kiến đến mới:
            </div>
            <Input.TextArea
              rows={3}
              placeholder="VD: Chuyến bay bị delay, khách thông báo sẽ nhận phòng lúc 22:30..."
              onChange={(e) => {
                noteValue = e.target.value;
              }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#16a34a' }}>
              🛡️ Hệ thống sẽ tiếp tục giữ phòng cho khách đến hết kỳ lưu trú (12:00 ngày {day(booking.check_out)}).
            </div>
          </div>
        ),
        okText: 'Xác nhận giữ phòng',
        cancelText: 'Hủy',
        okButtonProps: { style: { backgroundColor: '#16a34a', borderColor: '#16a34a' } },
        onOk: async () => {
          if (!noteValue.trim()) {
            message.error('Vui lòng nhập lý do / ghi chú khi xác nhận khách sẽ đến muộn');
            return Promise.reject();
          }
          try {
            await recordCustomerContact(bookingId, { action: 'will_arrive_late', note: noteValue.trim() });
            message.success('Đã xác nhận khách sẽ đến muộn. Tiếp tục giữ phòng đến hết kỳ lưu trú.');
            await loadBooking(true);
            await loadHistory(historyGroup);
          } catch (err: unknown) {
            showApiError(err, 'Không thể cập nhật trạng thái liên hệ');
          }
        },
      });
      return;
    }

    if (action === 'unreachable') {
      let noteValue = '';
      Modal.confirm({
        title: '📞 Đã liên hệ — Không liên lạc được',
        width: 500,
        content: (
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8, fontSize: 13, color: '#475569' }}>
              Ghi chú thêm về cuộc gọi (tùy chọn):
            </div>
            <Input.TextArea
              rows={2}
              placeholder="VD: Đã gọi 2 lần không nghe máy, gửi tin nhắn SMS..."
              onChange={(e) => {
                noteValue = e.target.value;
              }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#d97706' }}>
              ⏳ Phòng sẽ tiếp tục được giữ theo hạn 24 giờ mặc định tính từ giờ nhận phòng chuẩn.
            </div>
          </div>
        ),
        okText: 'Lưu trạng thái',
        cancelText: 'Hủy',
        onOk: async () => {
          try {
            await recordCustomerContact(bookingId, { action: 'unreachable', note: noteValue.trim() });
            message.success('Đã ghi nhận không liên hệ được.');
            await loadBooking(true);
            await loadHistory(historyGroup);
          } catch (err: unknown) {
            showApiError(err, 'Không thể cập nhật trạng thái liên hệ');
          }
        },
      });
      return;
    }

    if (action === 'callback_later') {
      let noteValue = '';
      Modal.confirm({
        title: '🕒 Đã liên hệ — Cần liên hệ lại sau',
        width: 500,
        content: (
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8, fontSize: 13, color: '#475569' }}>
              Ghi chú liên hệ lại:
            </div>
            <Input.TextArea
              rows={2}
              placeholder="VD: Khách bận họp, hẹn gọi lại lúc 17:00..."
              onChange={(e) => {
                noteValue = e.target.value;
              }}
            />
          </div>
        ),
        okText: 'Lưu trạng thái',
        cancelText: 'Hủy',
        onOk: async () => {
          try {
            await recordCustomerContact(bookingId, { action: 'callback_later', note: noteValue.trim() });
            message.success('Đã ghi nhận cần liên hệ lại sau.');
            await loadBooking(true);
            await loadHistory(historyGroup);
          } catch (err: unknown) {
            showApiError(err, 'Không thể cập nhật trạng thái liên hệ');
          }
        },
      });
      return;
    }

    if (action === 'not_coming') {
      let noteValue = '';
      Modal.confirm({
        title: '❌ Khách xác nhận không đến (Chuyển No-show)',
        width: 520,
        content: (
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8, fontSize: 13, color: '#b91c1c', fontWeight: 500 }}>
              Khách thông báo sẽ hủy chuyến đi / không đến nhận phòng. Đơn đặt phòng sẽ chuyển sang trạng thái "Khách không đến" (No-show) và toàn bộ phòng sẽ được giải phóng ngay lập tức.
            </div>
            <Input.TextArea
              rows={2}
              placeholder="Lý do khách không đến..."
              onChange={(e) => {
                noteValue = e.target.value;
              }}
            />
          </div>
        ),
        okText: 'Xác nhận No-show & Trả phòng',
        okButtonProps: { danger: true },
        cancelText: 'Đóng',
        onOk: async () => {
          try {
            await recordCustomerContact(bookingId, { action: 'not_coming', note: noteValue.trim() });
            message.success('Đã chuyển đơn sang No-show và giải phóng phòng thành công.');
            await loadBooking(true);
            await loadHistory(historyGroup);
          } catch (err: unknown) {
            showApiError(err, 'Không thể thực hiện chuyển No-show');
          }
        },
      });
      return;
    }
  };

  // ─── Phí phát sinh / hư hỏng ────────────────────────────────────
  const [damageModalOpen, setDamageModalOpen] = useState(false);
  const [editingDamage, setEditingDamage] = useState<DamageCharge | null>(null);
  const [damageForm] = Form.useForm();
  const selectedDamageChargeType = Form.useWatch('chargeType', damageForm);
  const selectedDamageBookingDetailId = Form.useWatch('damageBookingDetailId', damageForm);
  const selectedDamageRoomItemId = Form.useWatch('roomItemId', damageForm);

  const selectedDamageDetail = useMemo(() => {
    return bookingRooms.find(
      (room) => Number(room.bookingDetailId || room.id) === Number(selectedDamageBookingDetailId),
    );
  }, [bookingRooms, selectedDamageBookingDetailId]);

  const damageRoomInventory = useMemo(() => {
    return selectedDamageDetail
      ? inventoryItems.filter(
          (item) => Number(item.roomId) === Number(selectedDamageDetail.id)
            && Number(item.quantity) > 0
            && item.status === 'normal',
        )
      : [];
  }, [selectedDamageDetail, inventoryItems]);

  const selectedDamageInventoryItem = useMemo(() => {
    return damageRoomInventory.find(
      (item) => item.id === Number(selectedDamageRoomItemId),
    );
  }, [damageRoomInventory, selectedDamageRoomItemId]);

  const openDamageModal = (charge?: DamageCharge) => {
    setEditingDamage(charge || null);
    damageForm.resetFields();
    if (charge) {
      const matchingRoom = bookingRooms.find((r) => Number(r.id) === Number(charge.roomId));
      damageForm.setFieldsValue({
        chargeType: charge.chargeType || 'damage',
        itemName: charge.itemName,
        quantity: charge.quantity,
        unitPrice: Number(charge.unitPrice),
        note: charge.note,
        damageBookingDetailId: matchingRoom ? Number(matchingRoom.bookingDetailId || matchingRoom.id) : undefined,
      });
    } else {
      const defaultRoom = bookingRooms.length === 1 ? Number(bookingRooms[0].bookingDetailId || bookingRooms[0].id) : undefined;
      damageForm.setFieldsValue({
        chargeType: 'damage',
        damageBookingDetailId: defaultRoom,
        quantity: 1,
      });
    }
    setDamageModalOpen(true);
  };

  const submitDamage = async () => {
    const values = await damageForm.validateFields();
    setWorking(true);
    try {
      const chargeType = values.chargeType || 'damage';
      const selectedDetail = bookingRooms.find(
        (r) => Number(r.bookingDetailId || r.id) === Number(values.damageBookingDetailId),
      );

      let itemName = values.itemName;
      let roomId = selectedDetail?.id ?? null;
      let bookingDetailId = selectedDetail?.bookingDetailId ?? null;

      if (chargeType === 'damage') {
        const selectedItem = inventoryItems.find(
          (item) => item.id === Number(values.roomItemId),
        );
        if (!editingDamage) {
          if (!selectedDetail || !selectedItem || Number(selectedItem.roomId) !== Number(selectedDetail.id)) {
            message.error('Vui lòng chọn đúng vật dụng thuộc phòng');
            setWorking(false);
            return;
          }
          itemName = selectedItem.itemName;
        } else {
          itemName = selectedItem ? selectedItem.itemName : values.itemName;
        }
      }

      const payload = {
        chargeType,
        itemName,
        quantity: values.quantity,
        unitPrice: values.unitPrice,
        note: values.note,
        roomId: roomId ? Number(roomId) : null,
        bookingDetailId: bookingDetailId ? Number(bookingDetailId) : null,
        roomItemId: values.roomItemId ? Number(values.roomItemId) : undefined,
        ...(editingDamage ? {} : { status: 'used' }),
      };

      if (editingDamage) {
        await updateBookingDamageCharge(bookingId, editingDamage.id, payload);
        message.success('Đã cập nhật khoản phí');
      } else {
        await addBookingDamageCharge(bookingId, payload);
        message.success(chargeType === 'damage' ? 'Đã thêm phí hư hỏng vật dụng' : 'Đã thêm khoản phí vào đơn');
      }
      setDamageModalOpen(false);
      await loadBooking(true);
      await loadHistory(historyGroup);
    } catch (err) {
      showApiError(err, 'Không lưu được khoản phí');
    } finally {
      setWorking(false);
    }
  };

  const removeDamage = async (charge: DamageCharge) => {
    try {
      await deleteBookingDamageCharge(bookingId, charge.id);
      message.success('Đã hủy khoản phí');
      await loadBooking(true);
      await loadHistory(historyGroup);
    } catch (err) {
      showApiError(err, 'Không hủy được khoản phí');
    }
  };

  const removeService = async (charge: ServiceCharge) => {
    try {
      await deleteBookingServiceCharge(bookingId, charge.id);
      message.success('Đã xóa dịch vụ khỏi đơn');
      await loadBooking(true);
      await loadHistory(historyGroup);
    } catch (err) {
      showApiError(err, 'Không xóa được dịch vụ');
    }
  };

  const serviceCharges = (booking?.services || []).map((raw) => {
    const item = raw as unknown as Record<string, unknown>;
    return {
      ...item,
      roomNumber: String(item.roomNumber ?? item.room_number ?? ''),
      roomTypeName: String(item.roomTypeName ?? item.room_type_name ?? ''),
    } as unknown as ServiceCharge;
  });
  // Chỉ dịch vụ đã sử dụng mới được tính vào hóa đơn.
  const serviceTotal = serviceCharges
    .filter((item) => (item.status || 'used') === 'used')
    .reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const damageCharges = (booking?.damages || []).map((raw) => {
    const item = raw as unknown as Record<string, unknown>;
    return {
      ...item,
      roomNumber: String(item.roomNumber ?? item.room_number ?? ''),
      roomTypeName: String(item.roomTypeName ?? item.room_type_name ?? ''),
    } as unknown as DamageCharge;
  });
  // Khoản đã hủy vẫn được giữ lại làm lịch sử nhưng không tính vào hóa đơn.
  const damageTotal = damageCharges
    .filter((item) => (item.status || 'used') === 'used')
    .reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const mainPayment: PaymentSnapshot | undefined = booking?.payment || booking?.payments?.[0];
  const remainingAmount = Number(mainPayment?.remainingAmount || 0);
  const paymentStatus = String(mainPayment?.paymentStatus || '');
  // Chỉ cho thêm / sửa dịch vụ và khoản phí SAU khi đã check-in khách vào phòng.
  const canEditCharges = !!booking && booking.status === 'checked_in';

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          showIcon
          message="Không mở được đặt phòng"
          description={error || 'Đặt phòng không tồn tại hoặc đã bị xóa.'}
          action={
            <Button onClick={() => navigate(`${areaPrefix}/bookings`)}>Về danh sách đặt phòng</Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          { title: <a onClick={() => navigate(areaPrefix)}>Trang quản trị</a> },
          { title: <a onClick={() => navigate(`${areaPrefix}/bookings`)}>Đặt phòng</a> },
          { title: `Đơn #${booking.id}` },
        ]}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Space align="center" wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`${areaPrefix}/bookings`)}>
            Quay lại
          </Button>
          <h2 style={{ margin: 0 }}>
            Đơn đặt phòng #{booking.id}
            {booking.booking_code ? ` — ${booking.booking_code}` : ''}
          </h2>
          <Tag color={bookingStatusColor[booking.status] || 'default'}>
            {bookingStatusText[booking.status] || booking.status}
          </Tag>
        </Space>

        <Button icon={<ReloadOutlined />} onClick={() => loadBooking()}>
          Làm mới
        </Button>
      </div>

      {!booking.actual_check_in_time && ['pending', 'confirmed'].includes(booking.status) && (
        <Card
          size="small"
          style={{
            marginBottom: 16,
            borderColor: booking.late_arrival_confirmed ? '#86efac' : '#fed7aa',
            background: booking.late_arrival_confirmed ? '#f0fdf4' : '#fffbeb'
          }}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>
                📞 Thông tin liên hệ khách & Trạng thái nhận phòng
              </span>
              <Tag color={booking.late_arrival_confirmed ? 'cyan' : booking.contact_result === 'unreachable' ? 'orange' : booking.contact_result === 'callback_later' ? 'purple' : 'volcano'}>
                {booking.late_arrival_confirmed
                  ? 'ĐÃ LIÊN HỆ — TIẾP TỤC GIỮ PHÒNG'
                  : booking.contact_result === 'unreachable'
                    ? 'Không liên hệ được'
                    : booking.contact_result === 'callback_later'
                      ? 'Cần liên hệ lại'
                      : 'Khách chưa đến'}
              </Tag>
            </div>
          }
        >
          <Row gutter={[16, 12]} style={{ marginBottom: 12 }}>
            <Col xs={24} sm={8}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Họ tên khách:</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{booking.customer_name || '—'}</div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Số điện thoại:</div>
              <div>
                {booking.customer_phone ? (
                  <a href={`tel:${booking.customer_phone}`} style={{ fontWeight: 600, color: '#2563eb' }}>
                    📞 {booking.customer_phone}
                  </a>
                ) : '—'}
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Email:</div>
              <div>
                {booking.customer_email ? (
                  <a href={`mailto:${booking.customer_email}`} style={{ color: '#2563eb' }}>
                    ✉️ {booking.customer_email}
                  </a>
                ) : '—'}
              </div>
            </Col>
          </Row>

          <div style={{ padding: '8px 12px', background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 12, fontSize: 13 }}>
            <div>
              Hạn giữ phòng mặc định: <strong>14:00 ngày {dayjs(booking.check_in).add(1, 'day').format('DD/MM/YYYY')}</strong> (24 giờ tính từ giờ check-in chuẩn).
            </div>
            {booking.late_arrival_confirmed ? (
              <div style={{ color: '#15803d', marginTop: 4 }}>
                ✓ Đã xác nhận giữ phòng đến hết kỳ lưu trú (12:00 ngày {day(booking.check_out)})
                {booking.late_arrival_note && <span> · Lý do: <em>"{booking.late_arrival_note}"</em></span>}
                {booking.late_arrival_confirmed_by_name && <span> · Người xác nhận: <strong>{booking.late_arrival_confirmed_by_name}</strong></span>}
                {booking.late_arrival_confirmed_at && <span> · Lúc: {dateTime(booking.late_arrival_confirmed_at)}</span>}
              </div>
            ) : booking.contact_result === 'unreachable' ? (
              <div style={{ color: '#c2410c', marginTop: 4 }}>
                ⚠️ Đã liên hệ nhưng không liên lạc được{booking.late_arrival_note ? ` (Ghi chú: ${booking.late_arrival_note})` : ''}. Phòng tiếp tục được giữ đến hạn 24h mặc định.
              </div>
            ) : booking.contact_result === 'callback_later' ? (
              <div style={{ color: '#7e22ce', marginTop: 4 }}>
                ℹ️ Cần liên hệ lại sau{booking.late_arrival_note ? ` (Ghi chú: ${booking.late_arrival_note})` : ''}.
              </div>
            ) : (
              <div style={{ color: '#b91c1c', marginTop: 4 }}>
                ⚠️ Đến giờ nhận phòng mà khách chưa đến. Lễ tân chủ động liên hệ theo số điện thoại trên để xác nhận nhu cầu giữ phòng.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button
              type="primary"
              style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
              icon={<CheckCircleOutlined />}
              onClick={() => handleContactAction('will_arrive_late')}
            >
              Khách sẽ đến muộn
            </Button>
            <Button
              style={{ color: '#ea580c', borderColor: '#fdba74' }}
              icon={<PhoneOutlined />}
              onClick={() => handleContactAction('unreachable')}
            >
              Không liên hệ được
            </Button>
            <Button
              icon={<ClockCircleOutlined />}
              onClick={() => handleContactAction('callback_later')}
            >
              Chưa rõ / Liên hệ lại
            </Button>
            <Button
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => handleContactAction('not_coming')}
            >
              Khách xác nhận không đến
            </Button>
          </div>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Thông tin đặt phòng" size="small">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Mã đơn">
                #{booking.id}
                {booking.booking_code ? ` (${booking.booking_code})` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={bookingStatusColor[booking.status] || 'default'}>
                  {bookingStatusText[booking.status] || booking.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Thời điểm đặt">{dateTime(booking.created_at)}</Descriptions.Item>
              <Descriptions.Item label="Ghi chú của khách">{booking.notes || '—'}</Descriptions.Item>
              {booking.cancellation_reason && (
                <Descriptions.Item label="Lý do hủy">{booking.cancellation_reason}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Khách hàng" size="small">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Họ tên">{booking.customer_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">{booking.customer_phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{booking.customer_email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Số khách">
                {booking.adults ?? 0} người lớn, {booking.children ?? 0} trẻ em
              </Descriptions.Item>
              <Descriptions.Item label="Khách lưu trú đã khai">
                {(booking.guests?.length || 0) > 0
                  ? `${booking.guests?.length} người`
                  : 'Chưa khai báo'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Thời gian lưu trú" size="small">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Ngày nhận phòng">{day(booking.check_in)}</Descriptions.Item>
              <Descriptions.Item label="Ngày trả phòng">{day(booking.check_out)}</Descriptions.Item>
              <Descriptions.Item label="Số đêm">
                <strong>{countNights(booking.check_in, booking.check_out)} đêm</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Giờ nhận thực tế">
                {dateTime(booking.actual_check_in_time)}
              </Descriptions.Item>
              <Descriptions.Item label="Giờ trả thực tế">
                {dateTime(booking.actual_check_out_time)}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Phòng và sức chứa" size="small">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Phòng">
                {booking.room_number || '—'}
                {(booking.room_quantity || 1) > 1 && ` (${booking.room_quantity} phòng)`}
              </Descriptions.Item>
              <Descriptions.Item label="Hạng phòng">{booking.room_type_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Tầng / Diện tích">
                {booking.room_floor ?? '—'} / {booking.room_area ? `${booking.room_area}m²` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Sức chứa">
                {booking.room_capacity ? `${booking.room_capacity} khách/phòng` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Tổng tiền phòng cơ bản">{money(booking.room_price)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginTop: 16 }} title="Thanh toán">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Tiền phòng">{money(mainPayment?.roomAmount)}</Descriptions.Item>
              <Descriptions.Item label="Phụ thu khách">{money(mainPayment?.surchargeAmount)}</Descriptions.Item>
              <Descriptions.Item label="Dịch vụ">{money(serviceTotal)}</Descriptions.Item>
              <Descriptions.Item label="Phát sinh / hư hỏng">{money(damageTotal)}</Descriptions.Item>
              <Descriptions.Item label="Giảm giá">
                {Number(mainPayment?.discountAmount || 0) > 0
                  ? `− ${money(mainPayment?.discountAmount)}`
                  : money(0)}
              </Descriptions.Item>
              <Descriptions.Item label="Tổng hóa đơn">
                <strong>{money(mainPayment?.totalAmount ?? booking.payable_total)}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Đã thanh toán">
                <span style={{ color: '#389e0d' }}>{money(mainPayment?.paidAmount)}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Còn phải trả">
                <strong style={{ color: remainingAmount > 0 ? '#cf1322' : '#389e0d' }}>
                  {money(remainingAmount)}
                </strong>
              </Descriptions.Item>
            </Descriptions>
          </Col>

          <Col xs={24} lg={10}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                Trạng thái thanh toán:{' '}
                <Tag color={paymentStatus === 'paid' ? 'green' : paymentStatus === 'refunded' ? 'red' : 'orange'}>
                  {paymentStatusText[paymentStatus] || 'Chưa có giao dịch'}
                </Tag>
              </div>

              {remainingAmount > 0 && booking.status === 'checked_in' && (
                <Alert
                  type="warning"
                  showIcon
                  message={`Khách còn nợ ${money(remainingAmount)}`}
                  description="Cần thu đủ trước khi trả phòng."
                />
              )}

              <Space wrap>
                {['pending', 'confirmed'].includes(booking.status) && (
                  <Button
                    type="primary"
                    icon={<LoginOutlined />}
                    loading={working}
                    onClick={handleCheckInClick}
                  >
                    Nhận phòng
                  </Button>
                )}

                {booking.status === 'checked_in' && (
                  <Button
                    type="primary"
                    icon={<LogoutOutlined />}
                    loading={working}
                    onClick={() => setCheckoutPaymentOpen(true)}
                  >
                    Trả phòng
                  </Button>
                )}

                <Button onClick={() => navigate(`${areaPrefix}/payments?bookingId=${booking.id}`)}>
                  Xem giao dịch
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card
        size="small"
        style={{ marginTop: 16 }}
        title={`Dịch vụ đã dùng (${serviceCharges.length})`}
        extra={
          canEditCharges && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openServiceModal()}>
              Thêm dịch vụ
            </Button>
          )
        }
      >
        <Table<ServiceCharge>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={serviceCharges}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dịch vụ nào" /> }}
          scroll={{ x: 760 }}
          columns={[
            { title: 'Dịch vụ', dataIndex: 'serviceName' },
            { title: 'Phòng', render: (_, row: ServiceCharge) => formatRoomLabel(row.roomId, row.roomNumber, row.roomTypeName) },
            { title: 'Đơn giá', dataIndex: 'unitPrice', align: 'right', render: money },
            { title: 'SL', dataIndex: 'quantity', align: 'center', width: 60 },
            {
              title: 'Thành tiền',
              dataIndex: 'totalPrice',
              align: 'right',
              render: (v: string | number) => <strong>{money(v)}</strong>,
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              render: (value: string) => {
                const status = value || 'unused';
                const meta = chargeStatusMeta[status] || { label: status, color: 'default' };
                return <Tag color={meta.color} style={{ fontWeight: 600 }}>{meta.label}</Tag>;
              },
            },
            { title: 'Thời điểm', dataIndex: 'createdAt', render: dateTime },
            {
              title: '',
              key: 'actions',
              width: 90,
              render: (_: unknown, row) => {
                if (row.status === 'cancelled') return null;
                return canEditCharges && (
                  <Space size={4}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openServiceModal(row)} />
                    <Popconfirm
                      title="Xóa dịch vụ này khỏi đơn?"
                      okText="Xóa"
                      cancelText="Thôi"
                      onConfirm={() => removeService(row)}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                );
              },
            },
          ]}
          summary={() =>
            serviceCharges.length > 0 ? (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4}>
                  <strong>Tổng tiền dịch vụ</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <strong>{money(serviceTotal)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} colSpan={3} />
              </Table.Summary.Row>
            ) : null
          }
        />
      </Card>

      <Card
        size="small"
        style={{ marginTop: 16 }}
        title={`Phát sinh và hư hỏng (${damageCharges.length})`}
        extra={
          canEditCharges && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openDamageModal()}>
              Thêm khoản phí
            </Button>
          )
        }
      >
        <Table<DamageCharge>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={damageCharges}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có khoản phát sinh nào" /> }}
          scroll={{ x: 900 }}
          columns={[
            { title: 'Khoản mục', dataIndex: 'itemName' },
            {
              title: 'Loại',
              dataIndex: 'chargeType',
              render: (value: string) => <Tag>{chargeTypeMeta[value] || value}</Tag>,
            },
            { title: 'Phòng', render: (_, row: DamageCharge) => formatRoomLabel(row.roomId, row.roomNumber, row.roomTypeName) },
            { title: 'Đơn giá', dataIndex: 'unitPrice', align: 'right', render: money },
            { title: 'SL', dataIndex: 'quantity', align: 'center', width: 60 },
            {
              title: 'Thành tiền',
              dataIndex: 'totalPrice',
              align: 'right',
              render: (v: string | number) => <strong>{money(v)}</strong>,
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              render: (value: string) => {
                const fixedStatus = value === 'cancelled' ? 'cancelled' : 'used';
                const meta = chargeStatusMeta[fixedStatus];
                return <Tag color={meta.color} style={{ fontWeight: 600 }}>{meta.label}</Tag>;
              },
            },
            { title: 'Ghi chú', dataIndex: 'note', render: (v?: string | null) => v || '—' },
            { title: 'Thời điểm', dataIndex: 'createdAt', render: dateTime },
            {
              title: '',
              key: 'actions',
              width: 90,
              render: (_: unknown, row) => {
                if (row.status === 'cancelled') return null;
                return canEditCharges && (
                  <Space size={4}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openDamageModal(row)} />
                    <Popconfirm
                      title="Hủy khoản phí này?"
                      description="Khoản phí vẫn được giữ trong lịch sử và không còn tính vào hóa đơn."
                      okText="Hủy khoản phí"
                      cancelText="Thôi"
                      onConfirm={() => removeDamage(row)}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                );
              },
            },
          ]}
          summary={() =>
            damageCharges.length > 0 ? (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5}>
                  <strong>Tổng phát sinh</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <strong>{money(damageTotal)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} colSpan={4} />
              </Table.Summary.Row>
            ) : null
          }
        />
      </Card>

      {booking?.late_checkout_charges && (booking.late_checkout_charges as any[]).length > 0 && (
        <Card
          size="small"
          style={{ marginTop: 16 }}
          title={`Phụ thu trả phòng muộn (${(booking.late_checkout_charges as any[]).length})`}
        >
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={booking.late_checkout_charges as any[]}
            columns={[
              {
                title: 'Khoản mục',
                dataIndex: 'note',
                render: (note: string, r: any) => (
                  <span>
                    <Tag color="gold" style={{ fontWeight: 600, marginRight: 8 }}>Phụ thu trễ giờ</Tag>
                    {note || `Trễ ${r.lateMinutes} phút`}
                  </span>
                ),
              },
              {
                title: 'Tỷ lệ áp dụng',
                dataIndex: 'tierPercent',
                align: 'center',
                render: (pct: number) => <Tag color="blue">{pct}%</Tag>,
              },
              {
                title: 'Giá đêm cơ sở',
                dataIndex: 'nightlyRate',
                align: 'right',
                render: (nr: number) => money(nr),
              },
              {
                title: 'Thành tiền',
                dataIndex: 'totalPrice',
                align: 'right',
                render: (tp: number) => <strong style={{ color: '#d97706' }}>{money(tp)}</strong>,
              },
              {
                title: 'Thời điểm',
                dataIndex: 'createdAt',
                render: dateTime,
              },
            ]}
          />
        </Card>
      )}

      <Card
        size="small"
        style={{ marginTop: 16 }}
        title={`Lịch sử thao tác (${history.length})`}
        extra={
          <Select
            size="small"
            value={historyGroup}
            onChange={(value) => setHistoryGroup(String(value))}
            style={{ width: 190 }}
            aria-label="Lọc lịch sử thao tác"
            options={historyGroups.map((group) => ({ value: group.key, label: group.label }))}
          />
        }
      >
        {historyLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : history.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Chưa ghi nhận thao tác nào trong nhóm này"
          />
        ) : (
          <Timeline
            items={history.map((entry) => {
              const color =
                entry.entityType === 'payment'
                  ? 'green'
                  : entry.entityType === 'service'
                    ? 'cyan'
                    : entry.entityType === 'damage'
                      ? 'orange'
                      : entry.entityType === 'room' || entry.entityType === 'stay'
                        ? 'blue'
                        : 'gray';
              const actionLabel = getBookingHistoryActionLabel(entry.action);
              const description = localizeBookingHistoryDescription(entry.description, entry.action);
              const normalizeText = (value: string) => value.replace(/[.\s]/g, '').toLocaleLowerCase('vi');
              const showDescription = description !== 'Không có mô tả'
                && normalizeText(description) !== normalizeText(actionLabel);

              return {
                color,
                children: (
                  <div style={{ padding: '1px 0 14px', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <Space wrap size={7}>
                        <strong style={{ fontSize: 15, color: '#1f2937' }}>{actionLabel}</strong>
                        <Tag color={color === 'gray' ? 'default' : color} style={{ marginInlineEnd: 0 }}>
                          {entry.entityLabel || getBookingHistoryEntityLabel(entry.entityType)}
                        </Tag>
                      </Space>
                      <span style={{ color: '#8c8c8c', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {dateTime(entry.createdAt)}
                      </span>
                    </div>

                    {showDescription && (
                      <Typography.Paragraph
                        ellipsis={{ rows: 2, expandable: true, symbol: 'Xem thêm' }}
                        style={{ margin: '6px 0 8px', color: '#595959', lineHeight: 1.55 }}
                      >
                        {description}
                      </Typography.Paragraph>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: showDescription ? 0 : 8 }}>
                      <Space size={6} wrap>
                        <UserOutlined style={{ color: '#8c6d4a' }} />
                        <strong style={{ color: '#434343', fontSize: 14 }}>
                          {getBookingHistoryActorName(entry.performedByName, entry.performedByRole)}
                        </strong>
                        <Tag
                          color={entry.performedByRole === 'admin' ? 'red' : entry.performedByRole === 'customer' ? 'blue' : 'gold'}
                          style={{ marginInlineEnd: 0 }}
                        >
                          {getBookingHistoryRoleLabel(entry.performedByRole)}
                        </Tag>
                      </Space>
                      {entry.amount != null && Number(entry.amount) !== 0 && (
                        <Tag color="green" style={{ marginInlineEnd: 0, fontWeight: 600 }}>
                          {money(entry.amount)}
                        </Tag>
                      )}
                    </div>
                  </div>
                ),
              };
            })}
          />
        )}
      </Card>

      <Modal
        title={
          editingDamage
            ? (selectedDamageChargeType === 'damage' ? 'Sửa phí hư hỏng / mất đồ' : 'Sửa khoản phí phát sinh')
            : (selectedDamageChargeType === 'damage' ? 'Thêm phí hư hỏng/mất vật dụng' : 'Thêm khoản phí phát sinh')
        }
        open={damageModalOpen}
        onCancel={() => setDamageModalOpen(false)}
        onOk={submitDamage}
        confirmLoading={working}
        okText="Lưu"
        cancelText="Đóng"
        destroyOnHidden
      >
        <Form form={damageForm} layout="vertical">
          <Form.Item name="chargeType" label="Loại khoản phí" initialValue="damage" rules={[{ required: true }]}>
            <Select
              options={Object.entries(chargeTypeMeta).map(([value, label]) => ({ value, label }))}
              onChange={() => {
                damageForm.setFieldsValue({
                  roomItemId: undefined,
                  quantity: 1,
                  unitPrice: undefined,
                  itemName: undefined,
                });
              }}
            />
          </Form.Item>

          {(!selectedDamageChargeType || selectedDamageChargeType === 'damage') ? (
            <>
              <Form.Item
                name="damageBookingDetailId"
                label="Phòng phát sinh hư hỏng"
                rules={[{ required: true, message: 'Chọn phòng' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn phòng"
                  onChange={() => {
                    damageForm.setFieldsValue({
                      roomItemId: undefined,
                      quantity: 1,
                      unitPrice: undefined,
                    });
                  }}
                  options={bookingRooms.map((room) => ({
                    value: Number(room.bookingDetailId || room.id),
                    label: `Phòng ${room.roomNumber}${room.roomTypeName ? ` - ${room.roomTypeName}` : ''}`,
                  }))}
                />
              </Form.Item>

              {!editingDamage ? (
                <Form.Item
                  name="roomItemId"
                  label="Vật dụng hư hỏng/mất"
                  rules={[{ required: true, message: 'Chọn vật dụng' }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder={selectedDamageDetail ? 'Chọn vật dụng trong phòng' : 'Chọn phòng trước'}
                    disabled={!selectedDamageDetail}
                    notFoundContent={selectedDamageDetail ? 'Phòng này chưa khai báo vật dụng' : null}
                    onChange={(itemId) => {
                      const item = damageRoomInventory.find((entry) => entry.id === Number(itemId));
                      damageForm.setFieldsValue({
                        quantity: 1,
                        unitPrice: Number(item?.compensationPrice || 0),
                      });
                    }}
                    options={damageRoomInventory.map((item) => ({
                      value: item.id,
                      label: `${item.itemName} - ${money(item.compensationPrice || 0)}`,
                    }))}
                  />
                </Form.Item>
              ) : (
                <Form.Item
                  name="itemName"
                  label="Vật dụng hư hỏng/mất"
                  rules={[{ required: true, message: 'Nhập tên vật dụng' }]}
                >
                  <Input />
                </Form.Item>
              )}

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="quantity"
                    label="Số lượng"
                    initialValue={1}
                    rules={[{ required: true, message: 'Nhập số lượng' }]}
                  >
                    <InputNumber
                      min={1}
                      max={selectedDamageInventoryItem?.quantity}
                      disabled={!selectedDamageInventoryItem && !editingDamage}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="unitPrice"
                    label="Đơn giá bồi thường"
                    rules={[{ required: true, message: 'Nhập đơn giá' }]}
                  >
                    <InputNumber min={0} step={10000} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </>
          ) : (
            <>
              <Form.Item
                name="itemName"
                label="Tên khoản phí"
                rules={[{ required: true, message: 'Nhập tên khoản phí' }]}
              >
                <Input placeholder="Ví dụ: Phụ phí dọn phòng trễ, giặt là đặc biệt..." />
              </Form.Item>

              <Form.Item
                name="damageBookingDetailId"
                label="Phòng phát sinh"
                rules={[{ required: bookingRooms.length > 0, message: 'Chọn phòng' }]}
              >
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder={bookingRooms.length > 0 ? 'Chọn phòng' : 'Chưa có phòng vật lý'}
                  options={bookingRooms.map((room) => ({
                    value: Number(room.bookingDetailId || room.id),
                    label: `Phòng ${room.roomNumber}${room.roomTypeName ? ` - ${room.roomTypeName}` : ''}`,
                  }))}
                />
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="quantity"
                    label="Số lượng"
                    initialValue={1}
                    rules={[{ required: true, message: 'Nhập số lượng' }]}
                  >
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="unitPrice"
                    label="Đơn giá"
                    rules={[{ required: true, message: 'Nhập đơn giá' }]}
                  >
                    <InputNumber min={0} step={10000} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={3} placeholder="Mô tả tình trạng, lý do..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingCharge ? 'Sửa dịch vụ' : 'Thêm dịch vụ cho khách'}
        open={serviceModalOpen}
        onCancel={() => setServiceModalOpen(false)}
        onOk={submitService}
        confirmLoading={working}
        okText="Lưu"
        cancelText="Đóng"
        destroyOnHidden
      >
        <Form form={serviceForm} layout="vertical">
          {!editingCharge && (
            <Form.Item name="serviceId" label="Dịch vụ" rules={[{ required: true, message: 'Chọn dịch vụ' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Chọn dịch vụ"
                options={services.map((item) => ({
                  value: item.id,
                  label: `${item.serviceName} — ${money(item.price)}`,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item name="roomId" label="Áp dụng cho phòng" rules={[{ required: bookingRooms.length > 0, message: 'Chọn phòng' }]}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={bookingRooms.length > 0 ? 'Chọn phòng' : 'Chưa có phòng vật lý (chưa xếp phòng)'}
              disabled={bookingRooms.length === 0}
              options={bookingRooms.map((r) => {
                const parts = [r.roomTypeName, r.roomNumber].filter(Boolean);
                return {
                  value: r.id,
                  label: parts.length > 0 ? `Phòng ${parts.join(' - ')}` : 'Chưa có số phòng',
                };
              })}
            />
          </Form.Item>
          <Form.Item name="quantity" label="Số lượng" rules={[{ required: true, message: 'Nhập số lượng' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal xác nhận Check-in sớm */}
      <Modal
        title={
          <Space>
            <span style={{ fontWeight: 600 }}>Xác nhận Check-in sớm</span>
          </Space>
        }
        open={earlyCheckInModalOpen}
        onCancel={() => setEarlyCheckInModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setEarlyCheckInModalOpen(false)} disabled={working}>
            Hủy
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={working}
            onClick={() => executeCheckIn({ waiveEarlySurcharge, waiveReason: waiveReason.trim() })}
            style={{ backgroundColor: '#2563eb', borderColor: '#2563eb' }}
          >
            Xác nhận nhận phòng
          </Button>,
        ]}
        width={560}
      >
        {(() => {
          const earlyInfo = computeEarlyCheckInInfo(booking, policies?.checkInTime || '14:00');
          return (
            <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 8 }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: '#1e40af', fontSize: 14 }}>
                    Khách nhận phòng SỚM (trước giờ chuẩn {(policies?.checkInTime || '14:00').slice(0, 5)})
                  </span>
                  <Tag color="blue">Đến sớm {earlyInfo.hoursEarly} tiếng</Tag>
                </div>
                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                  <div>Khung giờ: <strong>{earlyInfo.timeWindowLabel}</strong></div>
                  <div>Quy định: {earlyInfo.description}</div>
                  {earlyInfo.surchargeAmount > 0 && (
                    <div style={{ marginTop: 6, fontSize: 14 }}>
                      Mức phụ thu dự kiến: <strong style={{ color: '#b91c1c', fontSize: 15 }}>+{money(earlyInfo.surchargeAmount)}</strong> ({earlyInfo.percent}% giá đêm đầu)
                    </div>
                  )}
                  {earlyInfo.percent === 0 && (
                    <div style={{ marginTop: 6, color: '#15803d', fontWeight: 500 }}>
                      ✅ Khung giờ nhận phòng sớm được miễn phí phụ thu (0%).
                    </div>
                  )}
                </div>

                {earlyInfo.surchargeAmount > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #93c5fd' }}>
                    <Checkbox
                      checked={waiveEarlySurcharge}
                      onChange={(e) => setWaiveEarlySurcharge(e.target.checked)}
                    >
                      <span style={{ fontWeight: 500, color: '#1e3a8a' }}>
                        🎁 Miễn phí phụ thu check-in sớm cho khách (Hỗ trợ khách hàng / Khách VIP)
                      </span>
                    </Checkbox>

                    {waiveEarlySurcharge && (
                      <div style={{ marginTop: 8, paddingLeft: 24 }}>
                        <Input
                          placeholder="Lý do miễn phụ thu (VD: Khách quen VIP, sự cố phòng...)"
                          value={waiveReason}
                          onChange={(e) => setWaiveReason(e.target.value)}
                          maxLength={100}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
                * Khoản phụ thu chính thức được máy chủ tự động tính toán theo giá phòng đêm đầu tiên và ghi nhận trực tiếp vào hóa đơn/dịch vụ.
              </div>
            </Space>
          );
        })()}
      </Modal>

      <CheckoutPaymentModal
        bookingId={checkoutPaymentOpen ? bookingId : null}
        open={checkoutPaymentOpen}
        onClose={() => setCheckoutPaymentOpen(false)}
        onCheckedOut={() => {
          void loadBooking(true);
          void loadHistory(historyGroup);
        }}
      />
    </div>
  );
}

export default BookingDetailPage;

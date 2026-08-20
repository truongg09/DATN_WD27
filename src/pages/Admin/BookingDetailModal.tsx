import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Descriptions, Divider, Dropdown, Empty, Form, Input, InputNumber,
  message, Modal, Popconfirm, Select, Space, Spin, Table, Tabs, Tag, Timeline, Tooltip,
} from 'antd';
import {
  ClockCircleOutlined,
  DeleteOutlined,
  DollarOutlined,
  DownOutlined,
  EditOutlined,
  HomeOutlined,
  IdcardOutlined,
  PlusCircleOutlined,
  QrcodeOutlined,
  RollbackOutlined,
  SwapOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';
import AdminBookingModifyModal from './AdminBookingModifyModal';
import {
  addBookingServiceCharge,
  addBookingDamageCharge,
  updateBookingServiceCharge,
  updateBookingServiceChargeStatus,
  deleteBookingServiceCharge,
  updateBookingDamageCharge,
  updateBookingDamageChargeStatus,
  deleteBookingDamageCharge,
} from '../../services/bookingService';
import { getServices } from '../../services/serviceService';
import type { Service } from '../../types/service';

export interface BookingHistoryEntry {
  id: number;
  action: string;
  description: string | null;
  amount: string | number | null;
  performedBy: number | null;
  performedByName: string | null;
  performedByRole: string | null;
  performedByEmail: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  createdAt: string;
}

interface ServiceRow {
  id: number;
  bookingId?: number;
  roomId?: number | null;
  roomNumber?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  guestName?: string | null;
  serviceId?: number;
  serviceName: string;
  description?: string | null;
  unitPrice: string | number;
  quantity: number;
  totalPrice: string | number;
  status?: string | null;
  usedAt?: string | null;
  createdAt?: string | null;
}

interface DamageRow {
  id: number;
  bookingId?: number;
  roomId?: number | null;
  roomNumber?: string | null;
  chargeType?: string | null;
  itemName: string;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  status?: string | null;
  note?: string | null;
  createdAt?: string | null;
}

interface GuestRow {
  id: number;
  fullName: string;
  identityNumber: string;
  phone?: string | null;
  note?: string | null;
}

interface TransferRow {
  id: number;
  fromRoomId?: number | null;
  toRoomId?: number | null;
  fromRoomNumber?: string | null;
  toRoomNumber?: string | null;
  fromDate: string;
  toDate: string;
  pricePerNight: string | number;
  reason?: string | null;
  createdAt?: string | null;
}

interface PaymentRow {
  id: number;
  roomAmount: string | number;
  serviceAmount: string | number;
  surchargeAmount: string | number;
  discountAmount: string | number;
  depositAmount?: string | number;
  paidAmount: string | number;
  remainingAmount: string | number;
  totalAmount: string | number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  transactionCode?: string | null;
  paymentDate?: string | null;
}

interface RefundRow {
  id: number;
  amount: string | number;
  refundRate: string | number;
  refundMethod: string;
  status: string;
  note?: string | null;
  createdAt?: string | null;
  processedAt?: string | null;
}

interface BookingDetail {
  id: number;
  booking_code?: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  room_id?: number | null;
  room_number: string | null;
  room_type_name: string | null;
  room_floor?: number | null;
  room_area?: string | number | null;
  room_capacity?: number | null;
  room_status?: string | null;
  room_price?: string | number | null;
  check_in: string | null;
  check_out: string | null;
  status: string;
  adults: number | null;
  children: number | null;
  total_price: string | number | null;
  payable_total?: string | number | null;
  occupancy_surcharge?: string | number | null;
  notes?: string | null;
  cancellation_reason?: string | null;
  requested_check_in_time?: string | null;
  requested_check_in_day_offset?: number | null;
  created_at?: string | null;
  actual_check_in_time?: string | null;
  actual_check_out_time?: string | null;
  voucher?: { id: number; code: string; discountType: string; discountValue: string | number } | null;
  services?: ServiceRow[];
  damages?: DamageRow[];
  guests?: GuestRow[];
  transfers?: TransferRow[];
  payments?: PaymentRow[];
  refunds?: RefundRow[];
  history?: BookingHistoryEntry[];
  booking_rooms?: { id: number; number: string }[];
  nightly_prices?: Array<{
    id?: number;
    stayDate: string;
    price: number;
    priceType?: string;
    note?: string | null;
    roomId?: number | null;
    roomNumber?: string | null;
    dayOfWeek?: number;
    dayName?: string;
    isHoliday?: boolean;
    isSunday?: boolean;
    isSaturday?: boolean;
    isWeekend?: boolean;
  }>;
  price_breakdown?: {
    baseRoomPrice?: number;
    totalNights?: number;
    baseRoomAmount?: number;
    holidaySurcharge?: number;
    sundaySurcharge?: number;
    weekendSurcharge?: number;
    occupancySurcharge?: number;
    serviceAmount?: number;
    damageAmount?: number;
    totalPrice?: number;
  };
}

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

const roomStatusText: Record<string, string> = {
  vacant: 'Còn trống',
  occupied: 'Đang có khách',
  reserved: 'Đã đặt trước',
  dirty: 'Bẩn (chưa dọn)',
  clean: 'Sạch',
  maintenance: 'Bảo trì / Sửa chữa',
  out_of_service: 'Ngừng sử dụng',
  housekeeping: 'Đang dọn phòng',
};

const formatRoomStatus = (status?: string | null) => {
  if (!status) return '—';
  const key = String(status).trim().toLowerCase();
  return roomStatusText[key] || status;
};

const statusText: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  checked_in: 'Đang lưu trú',
  checked_out: 'Đã trả phòng',
  cancelled: 'Đã hủy',
  no_show: 'Khách không đến',
};

const statusColor: Record<string, string> = {
  pending: 'orange',
  confirmed: 'blue',
  checked_in: 'green',
  checked_out: 'default',
  cancelled: 'red',
  no_show: 'volcano',
};

const paymentStatusText: Record<string, string> = {
  unpaid: 'Chưa thanh toán',
  deposit_paid: 'Đã đặt cọc',
  paid: 'Đã thanh toán đủ',
  refunded: 'Đã hoàn tiền',
};

const paymentMethodText: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  vnpay: 'VNPay',
  zalopay: 'ZaloPay',
  credit_card: 'Thẻ tín dụng',
};

const refundStatusText: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
};

// Mỗi loại thao tác có màu và biểu tượng riêng để đọc nhanh dòng thời gian.
const actionMeta: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  created: { label: 'Tạo đặt phòng', color: 'blue', icon: <PlusCircleOutlined /> },
  payment: { label: 'Thanh toán', color: 'green', icon: <DollarOutlined /> },
  voucher_applied: { label: 'Áp voucher', color: 'purple', icon: <DollarOutlined /> },
  service_added: { label: 'Thêm dịch vụ', color: 'cyan', icon: <PlusCircleOutlined /> },
  damage_added: { label: 'Phí hư hỏng', color: 'orange', icon: <ToolOutlined /> },
  extended: { label: 'Gia hạn ngày ở', color: 'geekblue', icon: <ClockCircleOutlined /> },
  room_transferred: { label: 'Chuyển phòng', color: 'purple', icon: <SwapOutlined /> },
  checked_in: { label: 'Nhận phòng', color: 'green', icon: <HomeOutlined /> },
  checked_out: { label: 'Trả phòng', color: 'gray', icon: <HomeOutlined /> },
  guests_updated: { label: 'Khai báo khách', color: 'blue', icon: <IdcardOutlined /> },
  cancelled: { label: 'Hủy đặt phòng', color: 'red', icon: <RollbackOutlined /> },
  no_show: { label: 'Khách không đến', color: 'volcano', icon: <RollbackOutlined /> },
  payment_requested: { label: 'Yêu cầu thanh toán', color: 'gold', icon: <QrcodeOutlined /> },
  transfer_confirmation: { label: 'Khách báo đã chuyển khoản', color: 'gold', icon: <QrcodeOutlined /> },
  refund: { label: 'Hoàn tiền', color: 'red', icon: <RollbackOutlined /> },
  refund_approved: { label: 'Duyệt hoàn tiền', color: 'green', icon: <RollbackOutlined /> },
  refund_rejected: { label: 'Từ chối hoàn tiền', color: 'red', icon: <RollbackOutlined /> },
  service_updated: { label: 'Sửa dịch vụ', color: 'cyan', icon: <EditOutlined /> },
  service_removed: { label: 'Xóa dịch vụ', color: 'red', icon: <DeleteOutlined /> },
  damage_updated: { label: 'Sửa phí phát sinh', color: 'orange', icon: <EditOutlined /> },
  status_change: { label: 'Đổi trạng thái', color: 'blue', icon: <ClockCircleOutlined /> },
  update_arrival_time: { label: 'Cập nhật giờ nhận phòng', color: 'blue', icon: <ClockCircleOutlined /> },
  room_reassigned: { label: 'Đổi phòng', color: 'purple', icon: <SwapOutlined /> },
  room_cleaned: { label: 'Xác nhận phòng đã dọn', color: 'green', icon: <HomeOutlined /> },
};

const roleText: Record<string, string> = {
  admin: 'Quản trị viên',
  employee: 'Nhân viên',
  staff: 'Nhân viên',
  customer: 'Khách hàng',
  system: 'Hệ thống',
};

const historyFieldText: Record<string, string> = {
  status: 'Trạng thái',
  bookingStatus: 'Trạng thái đặt phòng',
  roomId: 'Mã phòng',
  roomNumber: 'Số phòng',
  roomTypeId: 'Mã hạng phòng',
  checkIn: 'Ngày nhận phòng',
  checkOut: 'Ngày trả phòng',
  checkInDate: 'Ngày nhận phòng',
  checkOutDate: 'Ngày trả phòng',
  fromDate: 'Từ ngày',
  toDate: 'Đến ngày',
  totalPrice: 'Tổng tiền',
  totalAmount: 'Tổng tiền bill',
  newTotalAmount: 'Tổng bill mới',
  oldTotalAmount: 'Tổng bill cũ',
  priceDifference: 'Chênh lệch giá',
  newRemainingAmount: 'Còn lại thu/trả',
  depositAmount: 'Tiền cọc',
  paidAmount: 'Đã thanh toán',
  remainingAmount: 'Còn phải thanh toán',
  amount: 'Số tiền',
  paymentStatus: 'Trạng thái thanh toán',
  paymentMethod: 'Phương thức thanh toán',
  transactionCode: 'Mã giao dịch',
  quantity: 'Số lượng',
  serviceId: 'Mã dịch vụ',
  voucherCode: 'Mã ưu đãi',
  reason: 'Lý do',
  notes: 'Ghi chú',
  rooms: 'Danh sách phòng',
  newStagePrices: 'Chi tiết giá từng đêm mới',
  stagePrices: 'Chi tiết giá từng đêm',
  nightlyPrices: 'Chi tiết giá từng đêm',
  adults: 'Người lớn',
  children: 'Trẻ em',
  childrenAges: 'Độ tuổi trẻ em',
  roomPrice: 'Đơn giá phòng',
  roomStayAmount: 'Tiền ở phòng',
  childSurchargeAmount: 'Phụ thu trẻ em',
  itemTotal: 'Thành tiền phòng',
  surcharge: 'Phụ thu',
};

const historyValueText: Record<string, string> = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', checked_in: 'Đang lưu trú', checked_out: 'Đã trả phòng',
  cancelled: 'Đã hủy', no_show: 'Khách không đến', unpaid: 'Chưa thanh toán', deposit_paid: 'Đã đặt cọc',
  paid: 'Đã thanh toán đủ', refunded: 'Đã hoàn tiền', cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản ngân hàng',
  available: 'Phòng trống', occupied: 'Đang có khách', maintenance: 'Đang dọn hoặc bảo trì', true: 'Có', false: 'Không',
};

const formatHistoryVal = (key: string, value: unknown): React.ReactNode => {
  if (value == null || value === '') return 'Không có';

  if ((key === 'rooms' || key === 'roomList') && Array.isArray(value)) {
    return (
      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {value.map((r: any, i: number) => (
          <div key={i} style={{ background: '#fff', padding: '6px 10px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 13 }}>
            <strong>• {r.typeName || 'Phòng'} {r.roomNumber ? `(Phòng ${r.roomNumber})` : ''}</strong>: {r.adults ?? 0} người lớn, {r.children ?? 0} trẻ em
            {r.itemTotal || r.roomStayAmount ? <span style={{ color: '#0f172a', fontWeight: 600, marginLeft: 6 }}>— {money(Number(r.itemTotal || r.roomStayAmount))}</span> : null}
          </div>
        ))}
      </div>
    );
  }

  if ((key === 'newStagePrices' || key === 'nightlyPrices' || key === 'stagePrices') && Array.isArray(value)) {
    return (
      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {value.map((np: any, i: number) => (
          <div key={i} style={{ background: '#fff', padding: '4px 8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 12 }}>
            <strong>{dayjs(np.date || np.stayDate).format('DD/MM/YYYY')}</strong> ({np.dayName || ''}): <span style={{ fontWeight: 600, color: '#d97706' }}>{money(Number(np.price || 0))}</span> {np.note ? <span style={{ color: '#666' }}>({np.note})</span> : ''}
          </div>
        ))}
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return 'Không có';
    if (typeof value[0] !== 'object') return value.join(', ');
    return JSON.stringify(value);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  const raw = String(value);
  if (historyValueText[raw.toLowerCase()]) return historyValueText[raw.toLowerCase()];
  if (/amount|price|fee|total|difference/i.test(key) && Number.isFinite(Number(value))) return money(Number(value));
  if (/date|checkin|checkout|createdat|updatedat/i.test(key) && dayjs(raw).isValid()) return dateTime(raw);
  return raw;
};

const renderHistoryValue = (title: string, value: unknown, background: string) => {
  if (value == null) return null;
  const entries = typeof value === 'object' && !Array.isArray(value)
    ? Object.entries(value as Record<string, unknown>) : [['', value] as [string, unknown]];
  return <div style={{ flex: 1, minWidth: 220, background, padding: '10px 12px', borderRadius: 8, border: '1px solid #e8e8e8' }}>
    <strong style={{ fontSize: 13, color: '#444' }}>{title}</strong>
    {entries.map(([key, val]) => (
      <div key={key || title} style={{ fontSize: 14, lineHeight: 1.7, color: '#262626' }}>
        {key && <span style={{ fontWeight: 600, color: '#555' }}>{historyFieldText[key] || key}: </span>}{formatHistoryVal(key, val)}
      </div>
    ))}
  </div>;
};

const vietnameseDescription = (value?: string | null) => (value || 'Không có mô tả')
  .replace(/\bBooking\b/gi, 'Đơn đặt phòng').replace(/\bNo-show\b/gi, 'khách không đến')
  .replace(/check-in/gi, 'nhận phòng').replace(/check-out|checkout/gi, 'trả phòng');

const emptyBox = (text: string) => ({
  emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text} />,
});

interface Props {
  bookingId: number | null;
  open: boolean;
  onClose: () => void;
}

const BookingDetailModal: React.FC<Props> = ({ bookingId, open, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminModifyModalOpen, setAdminModifyModalOpen] = useState(false);
  const [detail, setDetail] = useState<BookingDetail | null>(null);

  // silent = true dùng cho vòng tự làm mới: không bật spinner để nội dung đang
  // đọc không bị nháy mỗi 10 giây.
  const fetchDetail = useCallback(async (silent = false) => {
    if (!bookingId) return;
    if (!silent) setLoading(true);
    try {
      const response = await api.get(`/bookings/${bookingId}`);
      setDetail((response as unknown as { data: BookingDetail }).data);
      setError(null);
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (!silent) {
        setError(errMsg || 'Không thể tải chi tiết đặt phòng');
        setDetail(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (!open || !bookingId) {
      setDetail(null);
      setError(null);
      return;
    }

    fetchDetail();
    // Tự làm mới trong lúc modal đang mở: lễ tân thêm dịch vụ hoặc thu tiền ở
    // máy khác thì số liệu và lịch sử ở đây cập nhật theo, không phải F5.
    const timer = window.setInterval(() => fetchDetail(true), 10000);
    return () => window.clearInterval(timer);
  }, [open, bookingId, fetchDetail]);

  const services = detail?.services || [];
  const damages = detail?.damages || [];
  const guests = detail?.guests || [];
  const transfers = detail?.transfers || [];
  const payments = detail?.payments || [];
  const refunds = detail?.refunds || [];
  const history = detail?.history || [];

  const serviceTotal = services.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const damageTotal = damages
    .filter((d) => (d.status || 'used') === 'used')
    .reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);

  const mainPayment = payments[0];
  const nights =
    detail?.check_in && detail?.check_out
      ? Math.max(dayjs(detail.check_out).startOf('day').diff(dayjs(detail.check_in).startOf('day'), 'day'), 0)
      : 0;
  const roomOnlyAmount = Number(detail?.total_price || 0) - Number(detail?.occupancy_surcharge || 0);
  const paidAmount = Number(mainPayment?.paidAmount || 0);
  const remainingAmount = Number(mainPayment?.remainingAmount || 0);
  const discountAmount = Number(mainPayment?.discountAmount || 0);

  // ─── Service tab: state & helpers ───────────────────────────────
  const [addServiceForm] = Form.useForm();
  const [editServiceForm] = Form.useForm();
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [addingService, setAddingService] = useState(false);
  const [editingService, setEditingService] = useState<ServiceRow | null>(null);
  const [savingService, setSavingService] = useState(false);

  // ─── Damage tab: state & helpers ────────────────────────────────
  const [addDamageForm] = Form.useForm();
  const [editDamageForm] = Form.useForm();
  const [allAmenities, setAllAmenities] = useState<{ id: number; name: string; compensationPrice?: number }[]>([]);
  const [addingDamage, setAddingDamage] = useState(false);
  const [editingDamage, setEditingDamage] = useState<DamageRow | null>(null);
  const [savingDamage, setSavingDamage] = useState(false);

  // Load danh sách dịch vụ và tiện nghi khách sạn khi modal mở.
  useEffect(() => {
    if (!open) return;
    getServices()
      .then(setAllServices)
      .catch(() => setAllServices([]));

    api.get('/amenities')
      .then((res: any) => setAllAmenities(res?.data || []))
      .catch(() => setAllAmenities([]));
  }, [open]);

  // Danh sách phòng thuộc booking: source of truth = booking_details (API trả booking_rooms).
  // Fallback bookings.room_id cho legacy single-room booking.
  const bookingRooms = useMemo(() => {
    if (detail?.booking_rooms && detail.booking_rooms.length > 0) {
      return detail.booking_rooms;
    }
    // Legacy fallback: booking chỉ có room_id trên bảng bookings
    if (detail?.room_id && detail?.room_number) {
      return [{ id: detail.room_id, number: detail.room_number }];
    }
    return [];
  }, [detail]);

  const svcStatusLabel: Record<string, string> = {
    used: 'Đã sử dụng',
    unused: 'Chưa sử dụng',
    cancelled: 'Đã hủy',
  };
  const svcStatusColor: Record<string, string> = {
    used: 'green',
    unused: 'orange',
    cancelled: 'default',
  };

  // Charge type / status mappings for damages tab
  const chargeTypeLabel: Record<string, string> = {
    damage: 'Hư hỏng',
    extra_fee: 'Phí phát sinh',
    other: 'Khoản thu khác',
  };
  const chargeTypeColor: Record<string, string> = {
    damage: 'red',
    extra_fee: 'orange',
    other: 'blue',
  };
  const chargeStatusLabel: Record<string, string> = {
    used: 'Đã xác nhận',
    unused: 'Chưa xác nhận',
    cancelled: 'Đã hủy',
  };
  const chargeStatusColor: Record<string, string> = {
    used: 'green',
    unused: 'orange',
    cancelled: 'default',
  };

  // Group services theo roomNumber.
  const servicesByRoom = useMemo(() => {
    const groups = new Map<string, ServiceRow[]>();
    for (const svc of services) {
      const key = svc.roomNumber || '__unknown__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(svc);
    }
    return groups;
  }, [services]);

  // Group damages/charges theo roomNumber.
  const damagesByRoom = useMemo(() => {
    const groups = new Map<string, DamageRow[]>();
    for (const dmg of damages) {
      const key = dmg.roomNumber || '__unknown__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(dmg);
    }
    return groups;
  }, [damages]);

  const handleAddService = async () => {
    try {
      const values = await addServiceForm.validateFields();
      if (!bookingId) return;
      setAddingService(true);
      await addBookingServiceCharge(bookingId, {
        serviceId: values.serviceId,
        quantity: values.quantity,
        roomId: values.roomId ?? null,
        guestName: values.guestName || null,
        status: values.status || 'used',
      });
      message.success('Đã thêm dịch vụ');
      addServiceForm.resetFields();
      fetchDetail();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (errMsg) message.error(errMsg);
    } finally {
      setAddingService(false);
    }
  };

  const openEditService = (row: ServiceRow) => {
    setEditingService(row);
    editServiceForm.setFieldsValue({
      roomId: row.roomId ?? undefined,
      quantity: row.quantity,
    });
  };

  const handleEditService = async () => {
    if (!bookingId || !editingService) return;
    try {
      const values = await editServiceForm.validateFields();
      setSavingService(true);
      await updateBookingServiceCharge(bookingId, editingService.id, {
        quantity: values.quantity,
        roomId: values.roomId ?? null,
      });
      message.success('Đã cập nhật dịch vụ');
      setEditingService(null);
      fetchDetail();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (errMsg) message.error(errMsg);
    } finally {
      setSavingService(false);
    }
  };

  const handleStatusChange = async (row: ServiceRow, newStatus: string) => {
    if (!bookingId) return;
    try {
      await updateBookingServiceChargeStatus(bookingId, row.id, newStatus);
      message.success(`Đã chuyển trạng thái → ${svcStatusLabel[newStatus] || newStatus}`);
      fetchDetail();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (errMsg) message.error(errMsg);
    }
  };

  const handleCancelService = async (row: ServiceRow) => {
    if (!bookingId) return;
    try {
      await deleteBookingServiceCharge(bookingId, row.id);
      message.success('Đã hủy dịch vụ');
      fetchDetail();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (errMsg) message.error(errMsg);
    }
  };

  const handleAddDamage = async () => {
    try {
      const values = await addDamageForm.validateFields();
      if (!bookingId) return;
      setAddingDamage(true);
      await addBookingDamageCharge(bookingId, {
        roomId: values.roomId ?? null,
        chargeType: values.chargeType || 'damage',
        itemName: values.itemName,
        quantity: values.quantity,
        unitPrice: values.unitPrice,
        status: values.status || 'used',
        note: values.note || null,
      });
      message.success('Đã thêm khoản phát sinh');
      addDamageForm.resetFields();
      fetchDetail();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (errMsg) message.error(errMsg);
    } finally {
      setAddingDamage(false);
    }
  };

  const openEditDamage = (row: DamageRow) => {
    setEditingDamage(row);
    editDamageForm.setFieldsValue({
      roomId: row.roomId ?? undefined,
      chargeType: row.chargeType || 'damage',
      itemName: row.itemName,
      quantity: row.quantity,
      unitPrice: Number(row.unitPrice || 0),
      note: row.note || '',
    });
  };

  const handleEditDamage = async () => {
    if (!bookingId || !editingDamage) return;
    try {
      const values = await editDamageForm.validateFields();
      setSavingDamage(true);
      await updateBookingDamageCharge(bookingId, editingDamage.id, {
        roomId: values.roomId ?? null,
        chargeType: values.chargeType,
        itemName: values.itemName,
        quantity: values.quantity,
        unitPrice: values.unitPrice,
        note: values.note || null,
      });
      message.success('Đã cập nhật khoản phát sinh');
      setEditingDamage(null);
      fetchDetail();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (errMsg) message.error(errMsg);
    } finally {
      setSavingDamage(false);
    }
  };

  const handleDamageStatusChange = async (row: DamageRow, newStatus: string) => {
    if (!bookingId) return;
    try {
      await updateBookingDamageChargeStatus(bookingId, row.id, newStatus);
      message.success(`Đã chuyển trạng thái → ${chargeStatusLabel[newStatus] || newStatus}`);
      fetchDetail();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (errMsg) message.error(errMsg);
    }
  };

  const handleCancelDamage = async (row: DamageRow) => {
    if (!bookingId) return;
    try {
      await deleteBookingDamageCharge(bookingId, row.id);
      message.success('Đã hủy khoản');
      fetchDetail();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (errMsg) message.error(errMsg);
    }
  };

  const getBookingDisplayTag = (b: any) => {
    if (!b) return { label: '—', color: 'default' };
    const normStatus = String(b.status || 'pending').toLowerCase();
    if (
      ['pending', 'confirmed'].includes(normStatus) &&
      !b.actual_check_in_time &&
      b.check_in
    ) {
      const checkInStr = dayjs(b.check_in).format('YYYY-MM-DD');
      const reqTime = b.requested_check_in_time || '14:00:00';
      const offset = Number(b.requested_check_in_day_offset || 0);
      const requestedDateTime = dayjs(`${checkInStr} ${reqTime}`).add(offset, 'day');
      const lateDeadline = requestedDateTime.add(6, 'hour');
      const now = dayjs();

      if (now.isAfter(requestedDateTime) && (now.isBefore(lateDeadline) || now.isSame(lateDeadline))) {
        return { label: 'Check-in muộn', color: 'orange' };
      }
    }
    return {
      label: statusText[normStatus] || normStatus,
      color: statusColor[normStatus] || 'default'
    };
  };

  const overviewTab = detail && (
    <>
      <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }} title="Thông tin khách và phòng">
        <Descriptions.Item label="Mã đặt phòng">
          #{detail.id}
          {detail.booking_code ? ` (${detail.booking_code})` : ''}
        </Descriptions.Item>
        <Descriptions.Item label="Trạng thái">
          {(() => {
            const tag = getBookingDisplayTag(detail);
            return <Tag color={tag.color}>{tag.label}</Tag>;
          })()}
        </Descriptions.Item>
        <Descriptions.Item label="Khách hàng">{detail.customer_name || '—'}</Descriptions.Item>
        <Descriptions.Item label="Số điện thoại">{detail.customer_phone || '—'}</Descriptions.Item>
        <Descriptions.Item label="Email" span={2}>{detail.customer_email || '—'}</Descriptions.Item>
        <Descriptions.Item label="Phòng">
          {detail.room_number ? `Phòng ${detail.room_number}` : '—'}
          {detail.room_type_name ? ` (${detail.room_type_name})` : ''}
        </Descriptions.Item>
        <Descriptions.Item label="Tầng / Diện tích / Sức chứa">
          {detail.room_floor ?? '—'} / {detail.room_area ? `${detail.room_area}m²` : '—'} /{' '}
          {detail.room_capacity ? `${detail.room_capacity} khách` : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Ngày nhận phòng">
          <div>{day(detail.check_in)}</div>
          {detail.actual_check_in_time && (
            <div style={{ fontSize: 12, color: '#16a34a', marginTop: 2 }}>
              ✓ Thực tế nhận: <strong>{dateTime(detail.actual_check_in_time)}</strong>
            </div>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Ngày trả phòng">
          <div>{day(detail.check_out)} (Trước 12:00)</div>
          {detail.actual_check_out_time && (
            <div style={{ fontSize: 12, color: '#2563eb', marginTop: 2 }}>
              ✓ Thực tế trả: <strong>{dateTime(detail.actual_check_out_time)}</strong>
            </div>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Số đêm lưu trú">{nights} đêm</Descriptions.Item>
        <Descriptions.Item label="Số khách">
          {detail.adults ?? 0} người lớn, {detail.children ?? 0} trẻ em
        </Descriptions.Item>
        <Descriptions.Item label="Thời điểm đặt">{dateTime(detail.created_at)}</Descriptions.Item>
        <Descriptions.Item label="Trạng thái phòng hiện tại">{formatRoomStatus(detail.room_status)}</Descriptions.Item>
        <Descriptions.Item label="Ghi chú của khách" span={2}>{detail.notes || '—'}</Descriptions.Item>
        {detail.cancellation_reason && (
          <Descriptions.Item label="Lý do hủy" span={2}>{detail.cancellation_reason}</Descriptions.Item>
        )}
      </Descriptions>

      <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }} title="Tổng hợp chi phí">
        <Descriptions.Item label="Tiền phòng tiêu chuẩn">
          {money(detail.price_breakdown?.baseRoomAmount ?? roomOnlyAmount)}
          {detail.price_breakdown?.totalNights ? (
            <span style={{ color: '#888' }}>
              {' '}
              ({detail.price_breakdown.totalNights} đêm × {money(detail.price_breakdown.baseRoomPrice || detail.room_price)})
            </span>
          ) : nights > 0 ? (
            <span style={{ color: '#888' }}> ({nights} đêm × {money(detail.room_price)})</span>
          ) : null}
        </Descriptions.Item>

        <Descriptions.Item label="Phụ thu giá ngày lễ">
          {detail.price_breakdown && (detail.price_breakdown.holidaySurcharge ?? 0) > 0 ? (
            <strong style={{ color: '#cf1322' }}>+{money(detail.price_breakdown.holidaySurcharge)}</strong>
          ) : (
            <span style={{ color: '#888' }}>0₫</span>
          )}
        </Descriptions.Item>

        <Descriptions.Item label="Phụ thu Chủ nhật / Cuối tuần">
          {detail.price_breakdown && ((detail.price_breakdown.sundaySurcharge ?? 0) > 0 || (detail.price_breakdown.weekendSurcharge ?? 0) > 0) ? (
            <strong style={{ color: '#d46b08' }}>
              +{money((detail.price_breakdown.sundaySurcharge ?? 0) + (detail.price_breakdown.weekendSurcharge ?? 0))}
            </strong>
          ) : (
            <span style={{ color: '#888' }}>0₫</span>
          )}
        </Descriptions.Item>

        <Descriptions.Item label="Phụ thu khách (trẻ em)">{money(detail.occupancy_surcharge)}</Descriptions.Item>
        <Descriptions.Item label="Dịch vụ phát sinh">
          {money(serviceTotal)} <span style={{ color: '#888' }}>({services.length} mục)</span>
        </Descriptions.Item>
        <Descriptions.Item label="Phí hư hỏng / phát sinh">
          {money(damageTotal)} <span style={{ color: '#888' }}>({damages.length} mục)</span>
        </Descriptions.Item>
        <Descriptions.Item label="Giảm giá (voucher)">
          {discountAmount > 0 ? `− ${money(discountAmount)}` : money(0)}
          {detail.voucher?.code && <Tag color="purple" style={{ marginLeft: 6 }}>{detail.voucher.code}</Tag>}
        </Descriptions.Item>
        <Descriptions.Item label="Tổng phải thanh toán">
          <strong style={{ fontSize: 16 }}>{money(detail.payable_total ?? detail.total_price)}</strong>
        </Descriptions.Item>
      </Descriptions>

      <Descriptions bordered size="small" column={2} title="Tình trạng thanh toán">
        <Descriptions.Item label="Đã thanh toán">
          <strong style={{ color: '#389e0d' }}>{money(paidAmount)}</strong>
        </Descriptions.Item>
        <Descriptions.Item label="Còn phải trả">
          <strong style={{ color: remainingAmount > 0 ? '#cf1322' : '#389e0d' }}>{money(remainingAmount)}</strong>
        </Descriptions.Item>
        <Descriptions.Item label="Tiền đặt cọc">{money(mainPayment?.depositAmount)}</Descriptions.Item>
        <Descriptions.Item label="Hình thức thanh toán">
          {mainPayment?.paymentMethod ? paymentMethodText[mainPayment.paymentMethod] || mainPayment.paymentMethod : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Trạng thái thanh toán">
          <Tag color={
            mainPayment?.paymentStatus === 'paid' ? 'green'
              : mainPayment?.paymentStatus === 'refunded' ? 'red' : 'orange'
          }>
            {paymentStatusText[mainPayment?.paymentStatus || ''] || 'Chưa có giao dịch'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Thời điểm thanh toán">{dateTime(mainPayment?.paymentDate)}</Descriptions.Item>
        <Descriptions.Item label="Mã giao dịch" span={2}>{mainPayment?.transactionCode || '—'}</Descriptions.Item>
        {refunds.length > 0 && (
          <Descriptions.Item label="Hoàn tiền" span={2}>
            {refunds.map((refund) => (
              <Tag key={refund.id} color={refund.status === 'approved' ? 'green' : refund.status === 'rejected' ? 'red' : 'orange'}>
                {money(refund.amount)} — {refundStatusText[refund.status] || refund.status}
              </Tag>
            ))}
          </Descriptions.Item>
        )}
      </Descriptions>
    </>
  );

  const svcColumns = [
    {
      title: 'Dịch vụ', dataIndex: 'serviceName', render: (value: string, row: ServiceRow) => (
        <div>
          <strong>{value}</strong>
          {row.description && <div style={{ fontSize: 12, color: '#888' }}>{row.description}</div>}
        </div>
      ),
    },
    {
      title: 'Khách sử dụng',
      key: 'customerName',
      render: (_: unknown, row: ServiceRow) => (
        <span>{row.customerName || row.guestName || detail?.customer_name || 'Khách ở'}</span>
      )
    },
    { title: 'Đơn giá', dataIndex: 'unitPrice', align: 'right' as const, render: money },
    { title: 'SL', dataIndex: 'quantity', align: 'center' as const, width: 60 },
    { title: 'Thành tiền', dataIndex: 'totalPrice', align: 'right' as const, render: (v: string | number) => <strong>{money(v)}</strong> },
    {
      title: 'Trạng thái', dataIndex: 'status', width: 130,
      render: (v?: string | null) => {
        const s = v || 'used';
        return <Tag color={svcStatusColor[s] || 'default'}>{svcStatusLabel[s] || s}</Tag>;
      },
    },
    { title: 'Thời điểm', dataIndex: 'createdAt', render: dateTime },
    {
      title: 'Thao tác', width: 180, align: 'center' as const,
      render: (_: unknown, row: ServiceRow) => {
        const s = (row.status || 'used').toLowerCase();
        if (s === 'cancelled') return <Tag>Đã hủy</Tag>;

        // Status transition actions
        const statusItems: { key: string; label: string }[] = [];
        if (s === 'unused') {
          statusItems.push({ key: 'used', label: 'Xác nhận đã sử dụng' });
        }
        if (s === 'used') {
          statusItems.push({ key: 'unused', label: 'Chuyển về chưa sử dụng' });
        }

        return (
          <Space size={4}>
            <Tooltip title="Sửa">
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditService(row)} />
            </Tooltip>
            {statusItems.length > 0 && (
              <Dropdown
                menu={{
                  items: statusItems,
                  onClick: ({ key }) => handleStatusChange(row, key),
                }}
              >
                <Button type="link" size="small">
                  Trạng thái <DownOutlined />
                </Button>
              </Dropdown>
            )}
            <Popconfirm
              title="Hủy dịch vụ này?"
              description="Dịch vụ sẽ chuyển sang trạng thái Đã hủy và không tính tiền."
              onConfirm={() => handleCancelService(row)}
              okText="Hủy dịch vụ"
              cancelText="Không"
            >
              <Tooltip title="Hủy dịch vụ">
                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const servicesTab = (
    <>
      {/* ── Danh sách theo phòng ── */}
      {services.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dịch vụ phát sinh nào" />}

      {Array.from(servicesByRoom.entries()).map(([roomKey, rows]) => (
        <div key={roomKey} style={{ marginBottom: 16 }}>
          <Divider titlePlacement="left" style={{ margin: '8px 0' }}>
            {roomKey === '__unknown__' ? 'Dữ liệu cũ / Không xác định phòng' : `Phòng ${roomKey}`}
          </Divider>
          <Table<ServiceRow>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={rows}
            columns={svcColumns}
          />
        </div>
      ))}

      {/* Tổng cộng */}
      {services.length > 0 && (
        <div style={{ textAlign: 'right', padding: '8px 0', fontWeight: 600 }}>
          Tổng dịch vụ: {money(serviceTotal)}
        </div>
      )}

      {/* ── Form thêm dịch vụ ── */}
      <Divider titlePlacement="left" style={{ margin: '16px 0 8px' }}>Thêm dịch vụ</Divider>
      <Form form={addServiceForm} layout="inline" style={{ flexWrap: 'wrap', gap: 8 }}>
        <Form.Item name="roomId" label="Phòng">
          <Select
            placeholder="Chọn phòng"
            allowClear
            style={{ width: 130 }}
            options={bookingRooms.map((r) => ({ value: r.id, label: `P.${r.number}` }))}
          />
        </Form.Item>
        <Form.Item name="guestName" label="Khách sử dụng">
          <Select
            placeholder="Chọn / Nhập tên khách"
            showSearch
            allowClear
            style={{ width: 180 }}
            options={[
              ...(detail?.customer_name ? [{ value: detail.customer_name, label: `${detail.customer_name} (Chủ đơn)` }] : []),
              ...guests.map((g) => ({ value: g.fullName, label: `${g.fullName} (Khách ở)` }))
            ]}
          />
        </Form.Item>
        <Form.Item name="serviceId" label="Dịch vụ" rules={[{ required: true, message: 'Chọn dịch vụ' }]}>
          <Select
            placeholder="Chọn dịch vụ"
            showSearch
            optionFilterProp="label"
            style={{ width: 200 }}
            options={allServices.map((s) => ({ value: s.id, label: `${s.serviceName} (${money(s.price)})` }))}
          />
        </Form.Item>
        <Form.Item name="quantity" label="SL" initialValue={1} rules={[{ required: true, message: 'Nhập SL' }]}>
          <InputNumber min={1} max={100} style={{ width: 70 }} />
        </Form.Item>
        <Form.Item name="status" label="Trạng thái" initialValue="used">
          <Select style={{ width: 150 }} options={[
            { value: 'used', label: 'Đã sử dụng' },
            { value: 'unused', label: 'Chưa sử dụng' },
          ]} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" loading={addingService} onClick={handleAddService}>
            Thêm
          </Button>
        </Form.Item>
      </Form>
      {/* ── Modal sửa dịch vụ ── */}
      <Modal
        title={editingService ? `Sửa: ${editingService.serviceName}` : 'Sửa dịch vụ'}
        open={!!editingService}
        onCancel={() => setEditingService(null)}
        onOk={handleEditService}
        confirmLoading={savingService}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnHidden
        width={450}
      >
        <Form form={editServiceForm} layout="vertical">
          <Form.Item name="roomId" label="Phòng">
            <Select
              placeholder="Chọn phòng"
              allowClear
              options={bookingRooms.map((r) => ({ value: r.id, label: `P.${r.number}` }))}
            />
          </Form.Item>
          <Form.Item name="quantity" label="Số lượng" rules={[{ required: true, message: 'Nhập số lượng' }]}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          {editingService && (
            <div style={{ color: '#888', fontSize: 12 }}>
              Đơn giá snapshot: {money(editingService.unitPrice)} — Thành tiền sẽ được backend tính lại.
            </div>
          )}
        </Form>
      </Modal>
    </>
  );

  const dmgColumns = [
    {
      title: 'Nội dung phát sinh / Hư hỏng', dataIndex: 'itemName', render: (value: string, row: DamageRow) => (
        <div>
          <strong>{value}</strong>
          {row.chargeType && (
            <Tag color={chargeTypeColor[row.chargeType] || 'default'} style={{ marginLeft: 8 }}>
              {chargeTypeLabel[row.chargeType] || row.chargeType}
            </Tag>
          )}
        </div>
      ),
    },
    { title: 'Đơn giá', dataIndex: 'unitPrice', align: 'right' as const, render: money },
    { title: 'SL', dataIndex: 'quantity', align: 'center' as const, width: 60 },
    { title: 'Thành tiền', dataIndex: 'totalPrice', align: 'right' as const, render: (v: string | number) => <strong>{money(v)}</strong> },
    {
      title: 'Trạng thái', dataIndex: 'status', width: 130,
      render: (v?: string | null) => {
        const s = v || 'used';
        return <Tag color={chargeStatusColor[s] || 'default'}>{chargeStatusLabel[s] || s}</Tag>;
      },
    },
    { title: 'Ghi chú', dataIndex: 'note', render: (v?: string | null) => v || '—' },
    { title: 'Thời điểm', dataIndex: 'createdAt', render: dateTime },
    {
      title: 'Thao tác', width: 180, align: 'center' as const,
      render: (_: unknown, row: DamageRow) => {
        const s = (row.status || 'used').toLowerCase();
        if (s === 'cancelled') return <Tag>Đã hủy</Tag>;

        const statusItems: { key: string; label: string }[] = [];
        if (s === 'unused') {
          statusItems.push({ key: 'used', label: 'Xác nhận' });
          statusItems.push({ key: 'cancelled', label: 'Hủy' });
        }
        if (s === 'used') {
          statusItems.push({ key: 'unused', label: 'Chuyển về chưa xác nhận' });
          statusItems.push({ key: 'cancelled', label: 'Hủy' });
        }

        return (
          <Space size={4}>
            <Tooltip title="Sửa">
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditDamage(row)} />
            </Tooltip>
            {statusItems.length > 0 && (
              <Dropdown
                menu={{
                  items: statusItems,
                  onClick: ({ key }) => handleDamageStatusChange(row, key),
                }}
              >
                <Button type="link" size="small">
                  Trạng thái <DownOutlined />
                </Button>
              </Dropdown>
            )}
            <Popconfirm
              title="Hủy khoản này?"
              description="Khoản phát sinh sẽ chuyển sang trạng thái Đã hủy và không tính tiền."
              onConfirm={() => handleCancelDamage(row)}
              okText="Hủy khoản"
              cancelText="Không"
            >
              <Tooltip title="Hủy khoản">
                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const damagesTab = (
    <>
      {damages.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có phí hư hỏng / phát sinh nào" />}

      {Array.from(damagesByRoom.entries()).map(([roomKey, rows]) => (
        <div key={roomKey} style={{ marginBottom: 16 }}>
          <Divider titlePlacement="left" style={{ margin: '8px 0' }}>
            {roomKey === '__unknown__' ? 'Không xác định phòng / Dữ liệu cũ' : `Phòng ${roomKey}`}
          </Divider>
          <Table<DamageRow>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={rows}
            columns={dmgColumns}
          />
        </div>
      ))}

      {damages.length > 0 && (
        <div style={{ textAlign: 'right', padding: '8px 0', fontWeight: 600 }}>
          Tổng (đã xác nhận): {money(damageTotal)}
        </div>
      )}

      {/* ── Form thêm khoản phát sinh / hỏng hóc ── */}
      <Divider titlePlacement="left" style={{ margin: '16px 0 8px' }}>Thêm khoản phát sinh / hỏng hóc</Divider>
      <Form form={addDamageForm} layout="inline" style={{ flexWrap: 'wrap', gap: 8 }}>
        <Form.Item name="roomId" label="Phòng">
          <Select
            placeholder="Chọn phòng"
            allowClear
            style={{ width: 130 }}
            options={bookingRooms.map((r) => ({ value: r.id, label: `P.${r.number}` }))}
          />
        </Form.Item>
        <Form.Item name="chargeType" label="Loại" initialValue="damage" rules={[{ required: true, message: 'Chọn loại' }]}>
          <Select style={{ width: 130 }} options={[
            { value: 'damage', label: 'Hư hỏng' },
            { value: 'extra_fee', label: 'Phí phát sinh' },
            { value: 'other', label: 'Khoản thu khác' },
          ]} />
        </Form.Item>
        <Form.Item label="Vật dụng">
          <Select
            placeholder="Chọn từ danh mục tiện nghi"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 220 }}
            onChange={(val) => {
              if (val === 'custom') {
                addDamageForm.setFieldsValue({ itemName: '', unitPrice: 0 });
              } else {
                const item = allAmenities.find((a) => a.id === val);
                if (item) {
                  addDamageForm.setFieldsValue({
                    itemName: item.name,
                    unitPrice: Number(item.compensationPrice || 0)
                  });
                }
              }
            }}
            options={[
              ...allAmenities.map((a) => ({
                value: a.id,
                label: `${a.name} ${a.compensationPrice ? `(${Number(a.compensationPrice).toLocaleString('vi-VN')}đ)` : ''}`
              })),
              { value: 'custom', label: '➕ Khác (Vật dụng ngoài danh mục)' }
            ]}
          />
        </Form.Item>
        <Form.Item name="itemName" label="Nội dung" rules={[{ required: true, message: 'Nhập nội dung' }]}>
          <Input placeholder="Ví dụ: Vỡ ly thủy tinh..." style={{ width: 180 }} />
        </Form.Item>
        <Form.Item name="quantity" label="SL" initialValue={1} rules={[{ required: true, message: 'Nhập SL' }]}>
          <InputNumber min={1} max={100} style={{ width: 70 }} />
        </Form.Item>
        <Form.Item name="unitPrice" label="Đơn giá" initialValue={0} rules={[{ required: true, message: 'Nhập giá' }]}>
          <InputNumber min={0} style={{ width: 130 }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => Number((v || '').replace(/,/g, '')) as unknown as 0} />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú">
          <Input placeholder="Tùy chọn" style={{ width: 140 }} />
        </Form.Item>
        <Form.Item name="status" label="Trạng thái" initialValue="used">
          <Select style={{ width: 130 }} options={[
            { value: 'used', label: 'Đã xác nhận' },
            { value: 'unused', label: 'Chưa xác nhận' },
          ]} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" loading={addingDamage} onClick={handleAddDamage}>
            Thêm
          </Button>
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.quantity !== cur.quantity || prev.unitPrice !== cur.unitPrice}>
          {() => {
            const qty = addDamageForm.getFieldValue('quantity') || 0;
            const price = addDamageForm.getFieldValue('unitPrice') || 0;
            const preview = qty * price;
            return preview > 0 ? (
              <div style={{ lineHeight: '32px', color: '#888', fontSize: 13 }}>
                Preview: <strong>{money(preview)}</strong>
              </div>
            ) : null;
          }}
        </Form.Item>
      </Form>
      {/* ── Modal sửa khoản phát sinh ── */}
      <Modal
        title={editingDamage ? `Sửa: ${editingDamage.itemName}` : 'Sửa khoản phát sinh'}
        open={!!editingDamage}
        onCancel={() => setEditingDamage(null)}
        onOk={handleEditDamage}
        confirmLoading={savingDamage}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnHidden
        width={480}
      >
        <Form form={editDamageForm} layout="vertical">
          <Form.Item name="roomId" label="Phòng">
            <Select
              placeholder="Chọn phòng"
              allowClear
              options={bookingRooms.map((r) => ({ value: r.id, label: `P.${r.number}` }))}
            />
          </Form.Item>
          <Form.Item name="chargeType" label="Loại" rules={[{ required: true, message: 'Chọn loại' }]}>
            <Select options={[
              { value: 'damage', label: 'Hư hỏng' },
              { value: 'extra_fee', label: 'Phí phát sinh' },
              { value: 'other', label: 'Khoản thu khác' },
            ]} />
          </Form.Item>
          <Form.Item name="itemName" label="Nội dung" rules={[{ required: true, message: 'Nhập nội dung' }]}>
            <Input placeholder="Ví dụ: Vỡ bình hoa" />
          </Form.Item>
          <Form.Item name="quantity" label="Số lượng" rules={[{ required: true, message: 'Nhập số lượng' }]}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unitPrice" label="Đơn giá" rules={[{ required: true, message: 'Nhập đơn giá' }]}>
            <InputNumber min={0} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => Number((v || '').replace(/,/g, '')) as unknown as 0} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input placeholder="Tùy chọn" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.quantity !== cur.quantity || prev.unitPrice !== cur.unitPrice}>
            {() => {
              const qty = editDamageForm.getFieldValue('quantity') || 0;
              const price = editDamageForm.getFieldValue('unitPrice') || 0;
              const preview = qty * price;
              return preview > 0 ? (
                <div style={{ color: '#888', fontSize: 12 }}>
                  Thành tiền (preview): <strong>{money(preview)}</strong> — Backend sẽ tính lại.
                </div>
              ) : null;
            }}
          </Form.Item>
        </Form>
      </Modal>
    </>
  );

  const guestsTab = (
    <Table<GuestRow>
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={guests}
      locale={emptyBox('Chưa khai báo khách lưu trú')}
      columns={[
        { title: 'Họ và tên', dataIndex: 'fullName' },
        { title: 'CCCD/CMND', dataIndex: 'identityNumber' },
        { title: 'Số điện thoại', dataIndex: 'phone', render: (value?: string | null) => value || '—' },
        { title: 'Ghi chú', dataIndex: 'note', render: (value?: string | null) => value || '—' },
      ]}
    />
  );

  const transfersTab = (
    <Table<TransferRow>
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={transfers}
      locale={emptyBox('Đặt phòng này chưa từng chuyển phòng')}
      columns={[
        {
          title: 'Chuyển phòng',
          render: (_: unknown, row) => (
            <span>
              <Tag>{row.fromRoomNumber || '?'}</Tag>
              <SwapOutlined style={{ margin: '0 4px' }} />
              <Tag color="blue">{row.toRoomNumber || '?'}</Tag>
            </span>
          ),
        },
        { title: 'Từ ngày', dataIndex: 'fromDate', render: day },
        { title: 'Đến ngày', dataIndex: 'toDate', render: day },
        { title: 'Giá phòng mới/đêm', dataIndex: 'pricePerNight', align: 'right', render: money },
        { title: 'Lý do', dataIndex: 'reason', render: (value?: string | null) => value || '—' },
        { title: 'Thời điểm thực hiện', dataIndex: 'createdAt', render: dateTime },
      ]}
    />
  );

  const paymentsTab = (
    <>
      <h4 style={{ margin: '0 0 8px' }}>Giao dịch thanh toán</h4>
      <Table<PaymentRow>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={payments}
        locale={emptyBox('Chưa có giao dịch thanh toán')}
        style={{ marginBottom: 24 }}
        columns={[
          { title: 'Mã GD', dataIndex: 'id', render: (value: number) => `#${value}` },
          { title: 'Tiền phòng', dataIndex: 'roomAmount', align: 'right', render: money },
          { title: 'Dịch vụ', dataIndex: 'serviceAmount', align: 'right', render: money },
          { title: 'Phụ thu', dataIndex: 'surchargeAmount', align: 'right', render: money },
          { title: 'Giảm giá', dataIndex: 'discountAmount', align: 'right', render: money },
          { title: 'Tổng', dataIndex: 'totalAmount', align: 'right', render: (value: string | number) => <strong>{money(value)}</strong> },
          { title: 'Đã trả', dataIndex: 'paidAmount', align: 'right', render: money },
          { title: 'Còn lại', dataIndex: 'remainingAmount', align: 'right', render: (value: string | number) => (
            <span style={{ color: Number(value) > 0 ? '#cf1322' : '#389e0d' }}>{money(value)}</span>
          ) },
          { title: 'Hình thức', dataIndex: 'paymentMethod', render: (value?: string | null) => (value ? paymentMethodText[value] || value : '—') },
          { title: 'Trạng thái', dataIndex: 'paymentStatus', render: (value?: string | null) => (
            <Tag color={value === 'paid' ? 'green' : value === 'refunded' ? 'red' : 'orange'}>
              {paymentStatusText[value || ''] || value || '—'}
            </Tag>
          ) },
          { title: 'Thời điểm', dataIndex: 'paymentDate', render: dateTime },
        ]}
        scroll={{ x: 1100 }}
      />

      <h4 style={{ margin: '0 0 8px' }}>Yêu cầu hoàn tiền</h4>
      <Table<RefundRow>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={refunds}
        locale={emptyBox('Không có yêu cầu hoàn tiền')}
        columns={[
          { title: 'Số tiền hoàn', dataIndex: 'amount', align: 'right', render: (value: string | number) => <strong>{money(value)}</strong> },
          { title: 'Tỷ lệ', dataIndex: 'refundRate', render: (value: string | number) => `${Math.round(Number(value || 0) * 100)}%` },
          { title: 'Hình thức', dataIndex: 'refundMethod', render: (value: string) => (value === 'cash' ? 'Nhận tại quầy' : 'Chuyển khoản') },
          { title: 'Trạng thái', dataIndex: 'status', render: (value: string) => (
            <Tag color={value === 'approved' ? 'green' : value === 'rejected' ? 'red' : 'orange'}>
              {refundStatusText[value] || value}
            </Tag>
          ) },
          { title: 'Ghi chú', dataIndex: 'note', render: (value?: string | null) => value || '—' },
          { title: 'Tạo lúc', dataIndex: 'createdAt', render: dateTime },
          { title: 'Xử lý lúc', dataIndex: 'processedAt', render: dateTime },
        ]}
        scroll={{ x: 900 }}
      />
    </>
  );

  const nightlyPrices = detail?.nightly_prices || [];

  const nightlyPricesTab = (
    <Table
      rowKey={(r: any) => `${r.stayDate}-${r.roomId || '0'}`}
      size="small"
      pagination={false}
      dataSource={nightlyPrices}
      locale={emptyBox('Chưa có thông tin bảng giá chi tiết')}
      columns={[
        {
          title: 'Ngày lưu trú',
          dataIndex: 'stayDate',
          render: (value: string, row: any) => (
            <span>
              <strong>{day(value)}</strong> ({row.dayName || ''})
            </span>
          ),
        },
        {
          title: 'Phân loại ngày',
          dataIndex: 'priceType',
          render: (type: string, row: any) => {
            if (row.isHoliday || type === 'holiday') return <Tag color="red">Dịp lễ</Tag>;
            if (row.isSunday || type === 'sunday') return <Tag color="orange">Chủ nhật</Tag>;
            if (row.isSaturday || type === 'weekend') return <Tag color="purple">Thứ 7 / Cuối tuần</Tag>;
            return <Tag color="blue">Ngày thường</Tag>;
          },
        },
        {
          title: 'Phòng áp dụng',
          render: (_: unknown, row: any) => (
            row.roomNumber ? <Tag color="cyan">P.{row.roomNumber}</Tag> : <Tag color="default">Phòng #{row.roomId || detail?.room_number || '—'}</Tag>
          ),
        },
        {
          title: 'Đơn giá đêm',
          dataIndex: 'price',
          align: 'right',
          render: (val: number) => <strong style={{ color: '#047857' }}>{money(val)}</strong>,
        },
        {
          title: 'Ghi chú / Dịp áp dụng',
          dataIndex: 'note',
          render: (value?: string | null) => value || '—',
        },
      ]}
    />
  );

  const historyTab =
    history.length === 0 ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa ghi nhận thao tác nào cho đặt phòng này" />
    ) : (
      <Timeline
        mode="left"
        items={history.map((entry) => {
          const meta = actionMeta[entry.action] || { label: entry.action, color: 'gray', icon: <ClockCircleOutlined /> };
          return {
            color: meta.color,
            dot: meta.icon,
            children: (
              <div>
                <div style={{ marginBottom: 6 }}>
                  <Tag color={meta.color} style={{ fontSize: 14, fontWeight: 600, padding: '3px 9px' }}>{meta.label}</Tag>
                  <Tooltip title="Thời điểm thực hiện">
                    <span style={{ color: '#595959', fontSize: 13, fontWeight: 500 }}>{dateTime(entry.createdAt)}</span>
                  </Tooltip>
                  {entry.amount != null && Number(entry.amount) !== 0 && (
                    <strong style={{ marginLeft: 8 }}>{money(entry.amount)}</strong>
                  )}
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.65, color: '#262626' }}>{vietnameseDescription(entry.description)}</div>
                {(entry.oldValue != null || entry.newValue != null) && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
                    {renderHistoryValue('Trước thay đổi', entry.oldValue, '#fff1f0')}
                    {renderHistoryValue('Sau thay đổi', entry.newValue, '#f6ffed')}
                  </div>
                )}
                <div style={{ marginTop: 10, padding: '11px 13px', borderRadius: 9, background: '#f7f5f2', border: '1px solid #ddd4c9' }}>
                  <Space size={8} align="start">
                    <UserOutlined style={{ color: '#8c6d4a', marginTop: 3 }} />
                    <div>
                      <div style={{ fontSize: 13, color: '#666', fontWeight: 600, marginBottom: 3 }}>Người thực hiện</div>
                      <Space size={6} wrap>
                        <strong style={{ fontSize: 15, color: '#262626' }}>{entry.performedByName || 'Hệ thống tự động'}</strong>
                        <Tag color={entry.performedByRole === 'admin' ? 'red' : entry.performedByRole === 'customer' ? 'blue' : 'gold'}>
                          {roleText[entry.performedByRole || 'system'] || entry.performedByRole || 'Hệ thống'}
                        </Tag>
                      </Space>
                      {(entry.performedByEmail || entry.performedBy) && (
                        <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                          {entry.performedByEmail || 'Không có email'}
                          {entry.performedBy ? ` · ID tài khoản: ${entry.performedBy}` : ''}
                        </div>
                      )}
                    </div>
                  </Space>
                </div>
              </div>
            ),
          };
        })}
      />
    );

  return (
    <Modal
      title={
        <span>
          {detail ? `Chi tiết đặt phòng #${detail.id}` : 'Chi tiết đặt phòng'}
          {detail && (
            <Tag color={statusColor[detail.status] || 'default'} style={{ marginLeft: 10 }}>
              {statusText[detail.status] || detail.status}
            </Tag>
          )}
          {detail && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              size="small"
              onClick={() => setAdminModifyModalOpen(true)}
              style={{ marginLeft: 12 }}
            >
              Chỉnh sửa Booking
            </Button>
          )}
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={1100}
      // Đẩy modal lên sát mép trên và cho phần thân tự cuộn, để cửa sổ cao gần
      // hết màn hình thay vì bị cắt cụt ở đáy như trước.
      style={{ top: 24, paddingBottom: 24 }}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 150px)',
          overflowY: 'auto',
          paddingRight: 8,
        },
      }}
      destroyOnHidden
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin tip="Đang tải chi tiết..." />
        </div>
      )}

      {!loading && error && <Alert type="error" message={error} showIcon />}

      {!loading && !error && detail && (
        <Tabs
          defaultActiveKey="overview"
          items={[
            { key: 'overview', label: 'Tổng quan', children: overviewTab },
            { key: 'nightlyPrices', label: `Bảng giá từng đêm (${nightlyPrices.length})`, children: nightlyPricesTab },
            { key: 'services', label: `Dịch vụ phát sinh (${services.length})`, children: servicesTab },
            { key: 'damages', label: `Phí phát sinh / Hư hỏng (${damages.length})`, children: damagesTab },
            { key: 'guests', label: `Khách lưu trú (${guests.length})`, children: guestsTab },
            { key: 'transfers', label: `Chuyển phòng (${transfers.length})`, children: transfersTab },
            { key: 'payments', label: 'Thanh toán & hoàn tiền', children: paymentsTab },
            { key: 'history', label: `Lịch sử thao tác (${history.length})`, children: historyTab },
          ]}
        />
      )}

      <AdminBookingModifyModal
        open={adminModifyModalOpen}
        bookingId={bookingId}
        onClose={() => setAdminModifyModalOpen(false)}
        onSuccess={() => {
          fetchDetail();
        }}
      />
    </Modal>
  );
};

export default BookingDetailModal;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Divider, Empty, Form, Input, InputNumber,
  message, Modal, Popconfirm, Row, Select, Space, Spin, Table, Tabs, Tag, Timeline, Tooltip, Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DollarOutlined,
  EditOutlined,
  HomeOutlined,
  IdcardOutlined,
  PhoneOutlined,
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
  deleteBookingServiceCharge,
  updateBookingDamageCharge,
  deleteBookingDamageCharge,
  recordCustomerContact,
} from '../../services/bookingService';
import type { CustomerContactAction } from '../../services/bookingService';
import { getServices } from '../../services/serviceService';
import type { Service } from '../../types/service';
import {
  getBookingHistoryActionLabel,
  getBookingHistoryActorName,
  getBookingHistoryEntityLabel,
  getBookingHistoryRoleLabel,
  localizeBookingHistoryDescription,
} from '../../utils/bookingHistoryDisplay';

export interface BookingHistoryEntry {
  id: number;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  entityLabel?: string | null;
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
  number: string;
  roomTypeName: string;
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
  late_arrival_confirmed?: boolean | number | null;
  late_arrival_note?: string | null;
  late_arrival_confirmed_at?: string | null;
  late_arrival_confirmed_by?: number | null;
  late_arrival_confirmed_by_name?: string | null;
  contact_result?: string | null;
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
  wallet: 'Ví số dư HotelHub',
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

  const serviceTotal = services
    .filter((item) => (item.status || 'used') === 'used')
    .reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
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
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [addingDamage, setAddingDamage] = useState(false);
  const [editingDamage, setEditingDamage] = useState<DamageRow | null>(null);
  const [savingDamage, setSavingDamage] = useState(false);

  const selectedAddDamageChargeType = Form.useWatch('chargeType', addDamageForm);
  const selectedAddDamageRoomId = Form.useWatch('roomId', addDamageForm);
  const selectedAddDamageRoomItemId = Form.useWatch('roomItemId', addDamageForm);

  // Load danh sách dịch vụ và vật dụng phòng khi modal mở.
  useEffect(() => {
    if (!open) return;
    getServices()
      .then(setAllServices)
      .catch(() => setAllServices([]));

    api.get('/room-items')
      .then((res: any) => {
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setInventoryItems(list);
      })
      .catch(() => setInventoryItems([]));
  }, [open]);

  // Danh sách phòng thuộc booking: source of truth = booking_details (API trả booking_rooms).
  // Fallback bookings.room_id cho legacy single-room booking.
  const bookingRooms: BookingRoomOption[] = useMemo(() => {
    const rawList = ((detail as any)?.details && (detail as any).details.length > 0)
      ? (detail as any).details
      : (detail?.booking_rooms && detail.booking_rooms.length > 0)
      ? detail.booking_rooms
      : detail?.room_id && detail?.room_number
      ? [{ id: detail.room_id, number: detail.room_number, bookingDetailId: (detail as any)?.detail_id || 1 }]
      : [];

    return rawList.map((r: any) => ({
      id: Number(r.roomId || r.room_id || r.id || 0),
      bookingDetailId: Number(r.bookingDetailId || r.booking_detail_id || r.id || 0),
      number: String(r.roomNumber || r.number || r.room_number || ''),
      roomTypeName: String(r.typeName || r.room_type_name || r.roomTypeName || ''),
    })).filter((r: any) => r.id > 0);
  }, [detail]);

  const selectedAddDamageDetail = useMemo(() => {
    return bookingRooms.find((r) => Number(r.id) === Number(selectedAddDamageRoomId));
  }, [bookingRooms, selectedAddDamageRoomId]);

  const addDamageRoomInventory = useMemo(() => {
    return selectedAddDamageDetail
      ? inventoryItems.filter(
          (item) => Number(item.roomId) === Number(selectedAddDamageDetail.id)
            && Number(item.quantity) > 0
            && item.status === 'normal',
        )
      : [];
  }, [selectedAddDamageDetail, inventoryItems]);

  const selectedAddDamageInventoryItem = useMemo(() => {
    return addDamageRoomInventory.find((item) => item.id === Number(selectedAddDamageRoomItemId));
  }, [addDamageRoomInventory, selectedAddDamageRoomItemId]);

  const svcStatusLabel: Record<string, string> = {
    used: 'Đang sử dụng',
    unused: 'Đang sử dụng',
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
    used: 'Đang sử dụng',
    unused: 'Đang sử dụng',
    cancelled: 'Đã hủy',
  };
  const chargeStatusColor: Record<string, string> = {
    used: 'green',
    unused: 'green',
    cancelled: 'red',
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
      const chargeType = values.chargeType || 'damage';
      const selectedDetail = bookingRooms.find((r) => Number(r.id) === Number(values.roomId));

      let itemName = values.itemName;
      if (chargeType === 'damage') {
        const selectedItem = inventoryItems.find((item) => item.id === Number(values.roomItemId));
        if (!selectedDetail || !selectedItem || Number(selectedItem.roomId) !== Number(selectedDetail.id)) {
          message.error('Vui lòng chọn đúng vật dụng thuộc phòng');
          return;
        }
        itemName = selectedItem.itemName;
      }

      setAddingDamage(true);
      await addBookingDamageCharge(bookingId, {
        roomId: selectedDetail ? selectedDetail.id : (values.roomId ?? null),
        bookingDetailId: selectedDetail ? selectedDetail.bookingDetailId : null,
        chargeType,
        itemName,
        quantity: values.quantity,
        unitPrice: values.unitPrice,
        roomItemId: values.roomItemId ? Number(values.roomItemId) : undefined,
        status: 'used',
        note: values.note || null,
      });
      message.success(chargeType === 'damage' ? 'Đã thêm phí hư hỏng vật dụng' : 'Đã thêm khoản phát sinh');
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

  const handleContactAction = (action: CustomerContactAction) => {
    if (!bookingId || !detail) return;

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
              🛡️ Hệ thống sẽ tiếp tục giữ phòng cho khách đến hết kỳ lưu trú (12:00 ngày {day(detail.check_out)}).
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
            fetchDetail();
          } catch (err: unknown) {
            const errMsg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
            message.error(errMsg || 'Không thể cập nhật trạng thái liên hệ');
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
            fetchDetail();
          } catch (err: unknown) {
            const errMsg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
            message.error(errMsg || 'Không thể cập nhật trạng thái liên hệ');
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
            fetchDetail();
          } catch (err: unknown) {
            const errMsg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
            message.error(errMsg || 'Không thể cập nhật trạng thái liên hệ');
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
            fetchDetail();
          } catch (err: unknown) {
            const errMsg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
            message.error(errMsg || 'Không thể thực hiện chuyển No-show');
          }
        },
      });
      return;
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
      const standardTime = (b.requested_check_in_time || '14:00:00').slice(0, 8);
      const standardDateTime = dayjs(`${checkInStr}T${standardTime}`);
      const now = dayjs();

      if (now.isAfter(standardDateTime) || now.isSame(standardDateTime)) {
        if (b.late_arrival_confirmed) {
          return { label: 'Đã liên hệ - giữ phòng', color: 'cyan' };
        }
        if (b.contact_result === 'unreachable') {
          return { label: 'Không liên hệ được', color: 'orange' };
        }
        if (b.contact_result === 'callback_later') {
          return { label: 'Cần liên hệ lại', color: 'purple' };
        }
        if (b.contact_result === 'not_coming') {
          return { label: 'Khách báo không đến', color: 'volcano' };
        }
        return { label: 'Khách chưa đến', color: 'volcano' };
      }
    }
    return {
      label: statusText[normStatus] || normStatus,
      color: statusColor[normStatus] || 'default'
    };
  };

  const overviewTab = detail && (
    <>
      {!detail.actual_check_in_time && ['pending', 'confirmed'].includes(detail.status) && (
        <Card
          size="small"
          style={{
            marginBottom: 16,
            borderColor: detail.late_arrival_confirmed ? '#86efac' : '#fed7aa',
            background: detail.late_arrival_confirmed ? '#f0fdf4' : '#fffbeb'
          }}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>
                📞 Thông tin liên hệ khách & Trạng thái nhận phòng
              </span>
              <Tag color={detail.late_arrival_confirmed ? 'cyan' : detail.contact_result === 'unreachable' ? 'orange' : detail.contact_result === 'callback_later' ? 'purple' : 'volcano'}>
                {detail.late_arrival_confirmed
                  ? 'ĐÃ LIÊN HỆ — TIẾP TỤC GIỮ PHÒNG'
                  : detail.contact_result === 'unreachable'
                    ? 'Không liên hệ được'
                    : detail.contact_result === 'callback_later'
                      ? 'Cần liên hệ lại'
                      : 'Khách chưa đến'}
              </Tag>
            </div>
          }
        >
          <Row gutter={[16, 12]} style={{ marginBottom: 12 }}>
            <Col xs={24} sm={8}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Họ tên khách:</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{detail.customer_name || '—'}</div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Số điện thoại:</div>
              <div>
                {detail.customer_phone ? (
                  <a href={`tel:${detail.customer_phone}`} style={{ fontWeight: 600, color: '#2563eb' }}>
                    📞 {detail.customer_phone}
                  </a>
                ) : '—'}
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Email:</div>
              <div>
                {detail.customer_email ? (
                  <a href={`mailto:${detail.customer_email}`} style={{ color: '#2563eb' }}>
                    ✉️ {detail.customer_email}
                  </a>
                ) : '—'}
              </div>
            </Col>
          </Row>

          <div style={{ padding: '8px 12px', background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 12, fontSize: 13 }}>
            <div>
              Hạn giữ phòng mặc định: <strong>14:00 ngày {dayjs(detail.check_in).add(1, 'day').format('DD/MM/YYYY')}</strong> (24 giờ tính từ giờ check-in chuẩn).
            </div>
            {detail.late_arrival_confirmed ? (
              <div style={{ color: '#15803d', marginTop: 4 }}>
                ✓ Đã xác nhận giữ phòng đến hết kỳ lưu trú (12:00 ngày {day(detail.check_out)})
                {detail.late_arrival_note && <span> · Lý do: <em>"{detail.late_arrival_note}"</em></span>}
                {detail.late_arrival_confirmed_by_name && <span> · Người xác nhận: <strong>{detail.late_arrival_confirmed_by_name}</strong></span>}
                {detail.late_arrival_confirmed_at && <span> · Lúc: {dateTime(detail.late_arrival_confirmed_at)}</span>}
              </div>
            ) : detail.contact_result === 'unreachable' ? (
              <div style={{ color: '#c2410c', marginTop: 4 }}>
                ⚠️ Đã liên hệ nhưng không liên lạc được{detail.late_arrival_note ? ` (Ghi chú: ${detail.late_arrival_note})` : ''}. Phòng tiếp tục được giữ đến hạn 24h mặc định.
              </div>
            ) : detail.contact_result === 'callback_later' ? (
              <div style={{ color: '#7e22ce', marginTop: 4 }}>
                ℹ️ Cần liên hệ lại sau{detail.late_arrival_note ? ` (Ghi chú: ${detail.late_arrival_note})` : ''}.
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

        return (
          <Space size={4}>
            <Tooltip title="Sửa">
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditService(row)} />
            </Tooltip>
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
        const fixedStatus = v === 'cancelled' ? 'cancelled' : 'used';
        return <Tag color={chargeStatusColor[fixedStatus]}>{chargeStatusLabel[fixedStatus]}</Tag>;
      },
    },
    { title: 'Ghi chú', dataIndex: 'note', render: (v?: string | null) => v || '—' },
    { title: 'Thời điểm', dataIndex: 'createdAt', render: dateTime },
    {
      title: 'Thao tác', width: 180, align: 'center' as const,
      render: (_: unknown, row: DamageRow) => {
        const s = (row.status || 'used').toLowerCase();
        if (s === 'cancelled') return null;

        return (
          <Space size={4}>
            <Tooltip title="Sửa">
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditDamage(row)} />
            </Tooltip>
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
      <Divider titlePlacement="left" style={{ margin: '16px 0 8px' }}>
        {(!selectedAddDamageChargeType || selectedAddDamageChargeType === 'damage')
          ? 'Thêm phí hư hỏng/mất vật dụng'
          : 'Thêm khoản phí phát sinh'}
      </Divider>
      <Form form={addDamageForm} layout="inline" style={{ flexWrap: 'wrap', gap: 8 }}>
        <Form.Item name="chargeType" label="Loại" initialValue="damage" rules={[{ required: true, message: 'Chọn loại' }]}>
          <Select
            style={{ width: 140 }}
            onChange={() => {
              addDamageForm.setFieldsValue({
                roomItemId: undefined,
                quantity: 1,
                unitPrice: undefined,
                itemName: undefined,
              });
            }}
            options={[
              { value: 'damage', label: 'Hư hỏng / mất đồ' },
              { value: 'extra_fee', label: 'Phí phát sinh' },
              { value: 'other', label: 'Khoản thu khác' },
            ]}
          />
        </Form.Item>

        {(!selectedAddDamageChargeType || selectedAddDamageChargeType === 'damage') ? (
          <>
            <Form.Item name="roomId" label="Phòng" rules={[{ required: true, message: 'Chọn phòng' }]}>
              <Select
                placeholder="Chọn phòng"
                showSearch
                optionFilterProp="label"
                style={{ width: 160 }}
                onChange={() => {
                  addDamageForm.setFieldsValue({
                    roomItemId: undefined,
                    quantity: 1,
                    unitPrice: undefined,
                  });
                }}
                options={bookingRooms.map((r) => ({
                  value: r.id,
                  label: `Phòng ${r.number}${r.roomTypeName ? ` - ${r.roomTypeName}` : ''}`,
                }))}
              />
            </Form.Item>
            <Form.Item name="roomItemId" label="Vật dụng" rules={[{ required: true, message: 'Chọn vật dụng' }]}>
              <Select
                placeholder={selectedAddDamageDetail ? 'Chọn vật dụng trong phòng' : 'Chọn phòng trước'}
                disabled={!selectedAddDamageDetail}
                showSearch
                optionFilterProp="label"
                notFoundContent={selectedAddDamageDetail ? 'Phòng này chưa khai báo vật dụng' : null}
                style={{ width: 240 }}
                onChange={(val) => {
                  const item = addDamageRoomInventory.find((a) => a.id === Number(val));
                  if (item) {
                    addDamageForm.setFieldsValue({
                      quantity: 1,
                      unitPrice: Number(item.compensationPrice || 0),
                    });
                  }
                }}
                options={addDamageRoomInventory.map((a) => ({
                  value: a.id,
                  label: `${a.itemName} - ${money(a.compensationPrice || 0)}`,
                }))}
              />
            </Form.Item>
            <Form.Item name="quantity" label="SL" initialValue={1} rules={[{ required: true, message: 'Nhập SL' }]}>
              <InputNumber
                min={1}
                max={selectedAddDamageInventoryItem?.quantity}
                disabled={!selectedAddDamageInventoryItem}
                style={{ width: 70 }}
              />
            </Form.Item>
            <Form.Item name="unitPrice" label="Đơn giá" initialValue={0} rules={[{ required: true, message: 'Nhập giá' }]}>
              <InputNumber min={0} style={{ width: 130 }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => Number((v || '').replace(/,/g, '')) as unknown as 0} />
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item name="itemName" label="Tên khoản phí" rules={[{ required: true, message: 'Nhập tên khoản phí' }]}>
              <Input placeholder="Ví dụ: Phụ phí dọn phòng..." style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="roomId" label="Phòng">
              <Select
                placeholder="Chọn phòng"
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ width: 160 }}
                options={bookingRooms.map((r) => ({
                  value: r.id,
                  label: `Phòng ${r.number}${r.roomTypeName ? ` - ${r.roomTypeName}` : ''}`,
                }))}
              />
            </Form.Item>
            <Form.Item name="quantity" label="SL" initialValue={1} rules={[{ required: true, message: 'Nhập SL' }]}>
              <InputNumber min={1} max={100} style={{ width: 70 }} />
            </Form.Item>
            <Form.Item name="unitPrice" label="Đơn giá" initialValue={0} rules={[{ required: true, message: 'Nhập giá' }]}>
              <InputNumber min={0} style={{ width: 130 }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => Number((v || '').replace(/,/g, '')) as unknown as 0} />
            </Form.Item>
          </>
        )}

        <Form.Item name="note" label="Ghi chú">
          <Input placeholder="Tùy chọn" style={{ width: 140 }} />
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
        items={history.map((entry) => {
          const meta = actionMeta[entry.action] || { label: 'Thao tác hệ thống', color: 'gray', icon: <ClockCircleOutlined /> };
          const actionLabel = getBookingHistoryActionLabel(entry.action);
          const description = localizeBookingHistoryDescription(entry.description, entry.action);
          const normalizeText = (value: string) => value.replace(/[.\s]/g, '').toLocaleLowerCase('vi');
          const showDescription = description !== 'Không có mô tả'
            && normalizeText(description) !== normalizeText(actionLabel);
          return {
            color: meta.color,
            dot: meta.icon,
            children: (
              <div style={{ padding: '1px 0 14px', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <Space wrap size={7}>
                    <strong style={{ fontSize: 15, color: '#1f2937' }}>{actionLabel}</strong>
                    <Tag color={meta.color === 'gray' ? 'default' : meta.color} style={{ marginInlineEnd: 0 }}>
                      {entry.entityLabel || getBookingHistoryEntityLabel(entry.entityType)}
                    </Tag>
                  </Space>
                  <Tooltip title="Thời điểm thực hiện">
                    <span style={{ color: '#8c8c8c', fontSize: 13, whiteSpace: 'nowrap' }}>{dateTime(entry.createdAt)}</span>
                  </Tooltip>
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
            ...(history.length > 0
              ? [{ key: 'history', label: `Lịch sử thao tác (${history.length})`, children: historyTab }]
              : []),
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

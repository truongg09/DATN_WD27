import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  InputNumber,
  Input,
  Modal,
  Popconfirm,
  Select,
  Tabs,
  Tooltip,
  message,
  Radio,
  Rate,
  Row,
  Col,
  Space,
  Spin,
  Table,
  Tag,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import {
  CalendarOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  StarOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  addBookingServiceCharge,
  cancelBooking,
  previewBookingChange,
  executeBookingChange,
  updateBookingServiceCharge,
  deleteBookingServiceCharge,
  getBookings,
  getRefundPreview,
  type RefundPreview,
} from '../../services/bookingService';
import { getPaymentByBookingId } from '../../services/paymentService';
import { createReview, getReviews, updateReview } from '../../services/reviewService';
import { getServices } from '../../services/serviceService';
import { getMyRefunds, type RefundRow } from '../../services/refundService';
import { getRooms, getRoomTypes } from '../../services/roomService';
import { VIETQR_BANKS } from '../../utils/vietqr';
import { useAuth } from '../../contexts/AuthContext';
import { unwrapList } from '../../utils/unwrapList';
import type { Payment } from '../../types/payment';
import type { Service } from '../../types/service';
import api from '../../services/api';
import BookingDetailModal from '../Admin/BookingDetailModal';
import { BOOKING_STATUS_META } from '../../constants/bookingStatus';
import './BookingHistory.css';

const MAX_REVIEW_IMAGES = 5;
const MAX_IMAGE_SIZE_MB = 5;

// Upload 1 ảnh lên server ngay khi người dùng chọn, dùng chung API
// POST /upload/review-images (multer, trả về { data: { urls: string[] } }).
const uploadReviewImage: UploadProps['customRequest'] = async (options) => {
  const { file, onSuccess, onError } = options;
  try {
    const formData = new FormData();
    formData.append('images', file as File);
    const res = await api.post('/upload/review-images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const body = (res as unknown as { data?: unknown })?.data ?? res;
    const url =
      (body as { data?: { urls?: string[] } })?.data?.urls?.[0] ??
      (body as { urls?: string[] })?.urls?.[0];
    if (!url) throw new Error('Không nhận được URL ảnh');
    onSuccess?.({ url }, new XMLHttpRequest());
  } catch (error) {
    console.error('Upload review image error:', error);
    message.error('Tải ảnh lên thất bại, vui lòng thử lại');
    onError?.(error as Error);
  }
};

const beforeUploadReviewImage = (file: File) => {
  const isImage = file.type.startsWith('image/');
  if (!isImage) {
    message.error('Chỉ được chọn file ảnh');
    return Upload.LIST_IGNORE;
  }
  const isUnderLimit = file.size / 1024 / 1024 < MAX_IMAGE_SIZE_MB;
  if (!isUnderLimit) {
    message.error(`Ảnh phải nhỏ hơn ${MAX_IMAGE_SIZE_MB}MB`);
    return Upload.LIST_IGNORE;
  }
  return true;
};

const imageUrlsToFileList = (urls?: string[]): UploadFile[] =>
  (urls || []).map((url, index) => ({
    uid: `existing-${index}-${url}`,
    name: url.split('/').pop() || `image-${index}`,
    status: 'done',
    url,
  }));

const fileListToImageUrls = (fileList: UploadFile[]): string[] =>
  fileList
    .map((file) => file.url || (file.response as { url?: string } | undefined)?.url)
    .filter((url): url is string => Boolean(url));

interface BookingRow {
  id: number;
  room_number?: string;
  room_type_name?: string;
  check_in: string;
  check_out: string;
  total_price: number | string;
  payable_total?: number | string;
  status: string;
  created_at?: string;
  hold_expires_at?: string;
  hold_reset_count?: number;
  last_hold_reset_at?: string;
}

interface ReviewRow {
  id: number;
  bookingId: number;
  rating: number;
  comment: string;
  status?: string;
  adminReply?: string | null;
  hideReason?: string | null;
  images?: string[];
}

interface ReviewInfo {
  id: number;
  rating: number;
  comment: string;
  status?: string;
  adminReply?: string | null;
  hideReason?: string | null;
  images?: string[];
}

type PaymentByBooking = Record<number, Payment | null>;
type ReviewsByBooking = Record<number, ReviewInfo>;

const HOLD_MINUTES = 15;

const formatPrice = (price: number | string) =>
  new Intl.NumberFormat('vi-VN').format(Number(price || 0)) + 'đ';

const formatDate = (date?: string) => {
  if (!date) return '-';
  return dayjs(date).format('DD/MM/YYYY');
};

const getHoldRemainingMs = (holdExpiresAt?: string, createdAt?: string) => {
  if (holdExpiresAt) {
    return Math.max(dayjs(holdExpiresAt).diff(dayjs()), 0);
  }
  if (createdAt) {
    return Math.max(dayjs(createdAt).add(HOLD_MINUTES, 'minute').diff(dayjs()), 0);
  }
  return 0;
};

const formatHoldTime = (milliseconds: number) => {
  const totalSeconds = Math.max(Math.floor(milliseconds / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Dùng chung bảng nhãn ở constants/bookingStatus để không sót trạng thái no_show.
const bookingStatusMap = BOOKING_STATUS_META;

const paymentStatusMap: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Chưa thanh toán', color: 'orange' },
  deposit_paid: { label: 'Đã đặt cọc', color: 'blue' },
  paid: { label: 'Đã thanh toán', color: 'green' },
  refunded: { label: 'Đã hoàn tiền', color: 'red' },
};

// Nhãn/màu cho trạng thái kiểm duyệt của đánh giá (review), khác với
// trạng thái booking ở trên nên đặt tên map riêng để tránh nhầm lẫn.
const reviewStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Đang chờ duyệt', color: 'gold' },
  approved: { label: 'Đã duyệt', color: 'green' },
  hidden: { label: 'Bị từ chối/ẩn', color: 'red' },
};

const activeStatuses = ['pending', 'confirmed', 'checked_in'];

const BookingHistory: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [payments, setPayments] = useState<PaymentByBooking>({});
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(0);
  const [reviewBooking, setReviewBooking] = useState<BookingRow | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [reviewImageFileList, setReviewImageFileList] = useState<UploadFile[]>([]);
  const [reviewsByBooking, setReviewsByBooking] = useState<ReviewsByBooking>({});
  const [refundsByBooking, setRefundsByBooking] = useState<Record<number, RefundRow>>({});
  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null);
  const [cancelPreview, setCancelPreview] = useState<RefundPreview | null>(null);
  const [cancelPreviewLoading, setCancelPreviewLoading] = useState(false);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'bank_transfer'>('bank_transfer');
  const [refundBankBin, setRefundBankBin] = useState<string | undefined>(undefined);
  const [refundAccountNumber, setRefundAccountNumber] = useState('');
  const [refundAccountName, setRefundAccountName] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewBookingId, setViewBookingId] = useState<number | null>(null);

  // Modal chỉnh sửa đặt phòng
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editBookingId, setEditBookingId] = useState<number | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editDetail, setEditDetail] = useState<any>(null);
  const [allRoomTypes, setAllRoomTypes] = useState<any[]>([]);
  const [allRooms, setAllRooms] = useState<any[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [editTab, setEditTab] = useState('info');
  const [savingEdit, setSavingEdit] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [changePreviewData, setChangePreviewData] = useState<any>(null);

  // Form values
  const [editStayRange, setEditStayRange] = useState<[any, any] | null>(null);
  const [editRoomTypeId, setEditRoomTypeId] = useState<number | null>(null);
  const [editTargetRoomId, setEditTargetRoomId] = useState<number | null>(null);
  const [newServiceId, setNewServiceId] = useState<number | null>(null);
  const [newServiceQty, setNewServiceQty] = useState<number>(1);
  const [savingServiceAction, setSavingServiceAction] = useState<number | string | null>(null);
  const [editRefundMethod, setEditRefundMethod] = useState<'cash' | 'bank_transfer'>('bank_transfer');
  const [editRefundBankBin, setEditRefundBankBin] = useState<string | undefined>(undefined);
  const [editRefundAccountNumber, setEditRefundAccountNumber] = useState('');
  const [editRefundAccountName, setEditRefundAccountName] = useState('');
  const [editGuests, setEditGuests] = useState<Array<{ fullName: string; identityNumber: string; phone?: string; note?: string }>>([]);

  // Modal sửa số lượng dịch vụ
  const [editSvcModalOpen, setEditSvcModalOpen] = useState(false);
  const [editSvcRow, setEditSvcRow] = useState<any>(null);
  const [editSvcQty, setEditSvcQty] = useState(1);
  const [editingSvcSaving, setEditingSvcSaving] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        setBookings([]);
        setPayments({});
        return;
      }

      const bookingsRes = await getBookings({ userId: user.id });
      const bookingRows = unwrapList<BookingRow>(bookingsRes);
      setBookings(bookingRows);

      const paymentEntries = await Promise.all(
        bookingRows.map(async (booking) => {
          try {
            const paymentRes = await getPaymentByBookingId(booking.id);
            return [booking.id, paymentRes.data] as const;
          } catch {
            return [booking.id, null] as const;
          }
        })
      );

      setPayments(Object.fromEntries(paymentEntries));

      try {
        const bookingIds = bookingRows.map((b) => b.id).join(',');
        if (bookingIds) {
          const reviewsRes = await getReviews({ bookingIds });
          const reviewRows = unwrapList<ReviewRow>(reviewsRes);
          setReviewsByBooking(
            Object.fromEntries(
              reviewRows.map((r) => [
                r.bookingId,
                {
                  id: r.id,
                  rating: r.rating,
                  comment: r.comment,
                  status: r.status,
                  adminReply: r.adminReply,
                  hideReason: r.hideReason,
                  images: r.images,
                },
              ])
            )
          );
        } else {
          setReviewsByBooking({});
        }
      } catch {
        // Không chặn trang nếu tải danh sách đánh giá thất bại
      }

      try {
        const refundsRes = await getMyRefunds();
        const refundRows = unwrapList<RefundRow>(refundsRes);
        setRefundsByBooking(
          Object.fromEntries(refundRows.map((refund) => [refund.bookingId, refund]))
        );
      } catch {
        // Không chặn trang nếu tải danh sách hoàn tiền thất bại
      }
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } } };
      if (err.response?.status === 401) {
        message.warning('Vui lòng đăng nhập để xem lịch sử đặt phòng');
        navigate('/login');
        return;
      }

      message.error(err.response?.data?.message || 'Không thể tải lịch sử đặt phòng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      message.warning('Vui lòng đăng nhập để xem lịch sử đặt phòng');
      navigate('/login');
      return;
    }

    loadHistory();
  }, [isAuthenticated, navigate, user?.id]);

  const stats = useMemo(() => {
    const activeBookings = bookings.filter((booking) => activeStatuses.includes(booking.status)).length;
    const unpaidBookings = bookings.filter((booking) => {
      const payment = payments[booking.id];
      return (!payment || payment.paymentStatus === 'unpaid') && booking.status !== 'cancelled';
    }).length;

    return [
      { label: 'Tổng đặt phòng', value: bookings.length },
      { label: 'Đang hiệu lực', value: activeBookings },
      { label: 'Chưa thanh toán', value: unpaidBookings },
    ];
  }, [bookings, payments]);

  const openEditModal = async (record: BookingRow) => {
    setEditBookingId(record.id);
    setEditModalOpen(true);
    setEditLoading(true);
    setEditDetail(null);
    setAvailabilityError(null);
    setChangePreviewData(null);
    setEditTab('info');
    setNewServiceId(null);
    setNewServiceQty(1);
    setEditRefundMethod('bank_transfer');
    setEditRefundBankBin(undefined);
    setEditRefundAccountNumber('');
    setEditRefundAccountName('');
    try {
      const [detailRes, rtRes, roomsRes, servicesRes] = await Promise.all([
        api.get(`/bookings/${record.id}`),
        getRoomTypes(),
        getRooms(),
        getServices(),
      ]);
      const detail = (detailRes as any).data || detailRes;
      const rTypes = unwrapList<any>(rtRes);
      const rooms = unwrapList<any>(roomsRes);
      setEditDetail(detail);
      setAllRoomTypes(rTypes);
      setAllRooms(rooms);
      setAllServices(servicesRes);
      const existingGuests = Array.isArray(detail.guests) && detail.guests.length > 0
        ? detail.guests.map((g: any) => ({
            fullName: g.fullName || g.full_name || '',
            identityNumber: g.identityNumber || g.identity_number || '',
            phone: g.phone || '',
            note: g.note || '',
          }))
        : [
            {
              fullName: detail.customer_name || user?.fullName || '',
              identityNumber: '',
              phone: detail.customer_phone || user?.phone || '',
              note: '',
            },
          ];
      setEditGuests(existingGuests);
      setEditStayRange(
        detail.check_in && detail.check_out
          ? [dayjs(detail.check_in), dayjs(detail.check_out)]
          : null
      );
      const currentType = rTypes.find(
        (rt: any) => rt.typeName === detail.room_type_name || rt.id === detail.room_type_id
      );
      setEditRoomTypeId(currentType?.id ?? detail.room_type_id ?? null);
      setEditTargetRoomId(detail.room_id ? Number(detail.room_id) : null);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tải chi tiết đặt phòng để chỉnh sửa');
    } finally {
      setEditLoading(false);
    }
  };

  const runAvailabilityCheck = async (opts?: {
    overrideRange?: [any, any] | null;
    overrideRoomTypeId?: number | null;
    overrideTargetRoomId?: number | null;
  }) => {
    const range = opts?.overrideRange ?? editStayRange;
    const rtId = opts?.overrideRoomTypeId ?? editRoomTypeId;
    const targetRoomId = opts?.overrideTargetRoomId ?? editTargetRoomId;
    const ci = range?.[0];
    const co = range?.[1];
    if (!range || !ci || !co || !ci.isValid() || !co.isValid() || !co.isAfter(ci)) {
      setAvailabilityError('Vui lòng chọn khoảng thời gian hợp lệ (ngày trả phải sau ngày nhận)');
      setChangePreviewData(null);
      return;
    }
    if (!rtId) {
      setAvailabilityError('Vui lòng chọn hạng phòng');
      setChangePreviewData(null);
      return;
    }
    setAvailabilityLoading(true);
    setAvailabilityError(null);
    setChangePreviewData(null);
    try {
      let chosenRoomId = targetRoomId;
      if (!chosenRoomId && rtId) {
        const currentRoomId = editDetail?.room_id ? Number(editDetail.room_id) : null;
        const currentRtId = editDetail?.room_type_id ? Number(editDetail.room_type_id) : null;
        if (Number(rtId) !== currentRtId) {
          const matchingRoom = allRooms.find(
            (r: any) => (r.roomTypeId === Number(rtId) || r.room_type_id === Number(rtId)) && r.id !== currentRoomId && (r.status === 'available' || !r.status)
          );
          if (matchingRoom) {
            chosenRoomId = matchingRoom.id;
          }
        }
      }

      const previewRes = await previewBookingChange(editBookingId!, {
        checkOut: co.format('YYYY-MM-DD'),
        toRoomId: chosenRoomId || undefined,
      });

      const previewBody = (previewRes as any).data || previewRes;
      if (previewBody?.available) {
        setChangePreviewData(previewBody);
      } else {
        const conflictMsg =
          previewBody?.conflicts?.map((c: any) => c.message).join(' ') ||
          'Phòng được chọn không còn trống cho khoảng thời gian này. Vui lòng thử ngày khác hoặc hạng phòng khác.';
        setAvailabilityError(conflictMsg);
        setChangePreviewData(null);
      }
    } catch (err: any) {
      setAvailabilityError(err.response?.data?.message || 'Kiểm tra phòng trống & tính giá thất bại');
      setChangePreviewData(null);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const saveInfoChanges = async () => {
    if (!editBookingId || !editDetail) return;
    setSavingEdit(true);
    try {
      const [newCheckIn, newCheckOut] = editStayRange ?? [null, null];
      if (!newCheckIn || !newCheckOut || !newCheckIn.isValid() || !newCheckOut.isValid()) {
        message.warning('Vui lòng chọn khoảng thời gian hợp lệ');
        setSavingEdit(false);
        return;
      }

      const currentCheckOut = dayjs(editDetail.check_out);
      const currentRT = editDetail.room_type_id ?? editDetail.roomType?.id;
      const diffCheckOut = !newCheckOut.isSame(currentCheckOut, 'day');
      const diffRoomType = editRoomTypeId && Number(editRoomTypeId) !== Number(currentRT);
      const diffRoom = editTargetRoomId && Number(editTargetRoomId) !== Number(editDetail.room_id);

      if (!diffCheckOut && !diffRoomType && !diffRoom) {
        message.info('Không có thay đổi nào để lưu');
        setSavingEdit(false);
        return;
      }

      let chosenRoomId = editTargetRoomId;
      if (diffRoomType && !chosenRoomId) {
        const currentRoomId = editDetail?.room_id ? Number(editDetail.room_id) : null;
        const matchingRoom = allRooms.find(
          (r: any) => (r.roomTypeId === Number(editRoomTypeId) || r.room_type_id === Number(editRoomTypeId)) && r.id !== currentRoomId && (r.status === 'available' || !r.status)
        );
        if (matchingRoom) chosenRoomId = matchingRoom.id;
      }

      const fbPreview = changePreviewData?.financialBreakdown;
      const payload: any = {
        checkOut: newCheckOut.format('YYYY-MM-DD'),
        toRoomId: chosenRoomId || undefined,
        reason: 'Khách yêu cầu gia hạn / đổi lịch / chuyển phòng'
      };

      if (fbPreview?.refundableExcessAmount > 0) {
        if (editRefundMethod === 'bank_transfer') {
          if (!editRefundAccountNumber.trim() || !editRefundAccountName.trim() || !editRefundBankBin) {
            message.warning('Vui lòng điền đầy đủ thông tin tài khoản ngân hàng để nhận tiền hoàn');
            setSavingEdit(false);
            return;
          }
        }
        const bankObj = VIETQR_BANKS.find(b => b.bin === editRefundBankBin);
        payload.refundRequest = {
          refundMethod: editRefundMethod,
          bankBin: editRefundBankBin,
          bankName: bankObj?.shortName || bankObj?.name || '',
          accountNumber: editRefundAccountNumber.trim(),
          accountName: editRefundAccountName.trim().toUpperCase()
        };
      }

      const executeChange = async () => {
        setSavingEdit(true);
        try {
          const res = await executeBookingChange(editBookingId, payload);
          const result = (res as any).data || res;
          const preview = result?.preview || changePreviewData;
          const fb = preview?.financialBreakdown;
          const priceDiff = fb?.priceDifference ?? 0;
          const isShortening = Boolean(preview?.isShortening || fb?.isShortening);

          const nightlyPrices = preview?.nightlyPrices || [];
          const holidayNights = nightlyPrices.filter((n: any) => n.isHoliday);
          const weekendNights = nightlyPrices.filter((n: any) => !n.isHoliday && (n.isSaturday || n.isSunday));

          setEditModalOpen(false);
          await loadHistory();

          Modal.success({
            title: isShortening ? 'Rút ngắn thời gian ở thành công' : 'Cập nhật thời gian ở & phòng thành công',
            width: 580,
            content: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <p style={{ margin: 0 }}>
                  Đặt phòng <strong>#{editDetail.booking_code || editBookingId}</strong> đã được cập nhật thành công:
                </p>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: 8, fontSize: 13 }}>
                  <div><strong>Nhận phòng:</strong> {newCheckIn.format('DD/MM/YYYY')}</div>
                  <div>
                    <strong>Trả phòng mới:</strong> {newCheckOut.format('DD/MM/YYYY')} ({preview?.totalNights || 0} đêm)
                    {isShortening && (
                      <Tag color="orange" style={{ marginLeft: 6 }}>
                        Rút ngắn {preview?.reducedNights || fb?.reducedNights || 0} đêm
                      </Tag>
                    )}
                  </div>
                  {preview?.toRoom && (
                    <div style={{ color: '#0958d9', marginTop: 4 }}>
                      🏨 <strong>Phòng mới:</strong> Phòng {preview.toRoom.roomNumber} ({preview.toRoom.typeName})
                    </div>
                  )}
                  {fb?.upgradeFee > 0 && (
                    <div style={{ color: '#0958d9', marginTop: 4 }}>
                      💎 <strong>Phí nâng cấp phòng:</strong> +{formatPrice(fb.upgradeFee)}
                    </div>
                  )}

                  {/* Chi tiết danh sách ngày lễ */}
                  {holidayNights.length > 0 && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 6 }}>
                      <div style={{ color: '#cf1322', fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                        <span>🎉 Phụ thu ngày lễ (+20%):</span>
                        <strong>+{formatPrice(fb?.holidaySurcharge || 0)}</strong>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                        {holidayNights.map((n: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#434343' }}>
                            <span>
                              • <strong>{dayjs(n.date || n.stayDate).format('DD/MM/YYYY')}</strong> ({n.dayName || ''}): {n.holidayName || n.note || 'Ngày lễ'}
                            </span>
                            <span style={{ fontWeight: 600, color: '#cf1322' }}>
                              +{formatPrice(n.surcharge || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chi tiết danh sách Thứ 7 & Chủ nhật */}
                  {weekendNights.length > 0 && (
                    <div style={{ marginTop: 6, padding: '8px 12px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6 }}>
                      <div style={{ color: '#d46b08', fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                        <span>📅 Phụ thu cuối tuần (+10%):</span>
                        <strong>+{formatPrice(fb?.weekendSurcharge || 0)}</strong>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                        {weekendNights.map((n: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#434343' }}>
                            <span>
                              • <strong>{dayjs(n.date || n.stayDate).format('DD/MM/YYYY')}</strong> ({n.dayName || (n.isSaturday ? 'Thứ bảy' : 'Chủ nhật')}): Phụ thu cuối tuần
                            </span>
                            <span style={{ fontWeight: 600, color: '#d46b08' }}>
                              +{formatPrice(n.surcharge || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {priceDiff !== 0 && (
                  <div style={{ padding: '10px 14px', background: priceDiff > 0 ? '#fffbe6' : '#f6ffed', border: `1px solid ${priceDiff > 0 ? '#ffe58f' : '#b7eb8f'}`, borderRadius: 6 }}>
                    {priceDiff > 0 ? (
                      <div>
                        <strong style={{ color: '#d46b08' }}>Tổng tiền phát sinh thêm: +{formatPrice(priceDiff)}</strong>
                        <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>
                          Số tiền này đã được <strong>tự động cộng thêm vào hóa đơn thanh toán</strong> của bạn.
                        </div>
                      </div>
                    ) : (
                      <div>
                        <strong style={{ color: '#389e0d' }}>Tiền phòng giảm trừ: -{formatPrice(Math.abs(priceDiff))}</strong>
                        {fb?.refundableExcessAmount > 0 ? (
                          <div style={{ fontSize: 12, color: '#27272a', marginTop: 4 }}>
                            💸 Phiếu yêu cầu hoàn tiền <strong>+{formatPrice(fb.refundableExcessAmount)}</strong> ({editRefundMethod === 'bank_transfer' ? 'Chuyển khoản' : 'Tiền mặt'}) đã được gửi tới khách sạn xử lý.
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>
                            Khoản tiền chênh lệch giảm đã được cập nhật trực tiếp vào hóa đơn thanh toán của bạn.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {fb?.newTotalAmount && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontWeight: 600 }}>
                    <span>Tổng tiền thanh toán mới:</span>
                    <span style={{ color: '#cf1322', fontSize: 16 }}>
                      {formatPrice(fb.newTotalAmount)}
                    </span>
                  </div>
                )}
              </div>
            )
          });
        } catch (err: any) {
          message.error(err.response?.data?.message || 'Cập nhật đặt phòng thất bại');
        } finally {
          setSavingEdit(false);
        }
      };

      if (changePreviewData && changePreviewData.warnings?.length > 0) {
        Modal.confirm({
          title: 'Xác nhận thay đổi đặt phòng',
          width: 520,
          content: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <p style={{ margin: 0 }}>
                Thời gian / phòng bạn chọn có các đêm áp dụng biểu giá đặc biệt:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {changePreviewData.warnings.map((w: string, idx: number) => (
                  <div key={idx} style={{ background: '#fffbe6', border: '1px solid #ffe58f', padding: '8px 12px', borderRadius: 6, fontSize: 13, color: '#d46b08' }}>
                    {w}
                  </div>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 13 }}>
                Bạn có chắc chắn muốn xác nhận thay đổi này không?
              </p>
            </div>
          ),
          okText: 'Xác nhận thay đổi',
          cancelText: 'Hủy bỏ',
          onOk: () => executeChange(),
          onCancel: () => setSavingEdit(false)
        });
        return;
      }

      await executeChange();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lưu thay đổi thất bại');
      setSavingEdit(false);
    }
  };

  const addServiceToBooking = async () => {
    if (!editBookingId || !newServiceId) return;
    setSavingEdit(true);
    try {
      const res = await addBookingServiceCharge(editBookingId, {
        serviceId: Number(newServiceId),
        quantity: Number(newServiceQty || 1),
      });
      const result = (res as any).data ?? res;
      const serviceName = allServices.find((s) => s.id === Number(newServiceId))?.serviceName || 'Dịch vụ';
      const svc = result?.service;
      const pm = result?.payment;
      Modal.success({
        title: 'Đã cộng dịch vụ',
        content: (
          <div>
            <p>
              <strong>{serviceName}</strong> × {newServiceQty} đã được cộng thêm{' '}
              <strong>
                {new Intl.NumberFormat('vi-VN').format(
                  Number(svc?.totalPrice ?? 0)
                )}
                đ
              </strong>
              .
            </p>
            {pm && (
              <p>
                Số tiền khách còn phải thanh toán:{' '}
                <strong style={{ color: '#cf1322' }}>
                  {new Intl.NumberFormat('vi-VN').format(
                    Number(pm.remainingAmount ?? 0)
                  )}
                  đ
                </strong>
              </p>
            )}
          </div>
        ),
        onOk: async () => {
          if (editBookingId) {
            const detailRes = await api.get(`/bookings/${editBookingId}`);
            const detail = (detailRes as any).data || detailRes;
            setEditDetail(detail);
          }
          setNewServiceId(null);
          setNewServiceQty(1);
          await loadHistory();
        },
      });
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể cộng dịch vụ');
    } finally {
      setSavingEdit(false);
    }
  };

  const saveGuestChanges = async () => {
    if (!editBookingId || !editDetail) return;
    for (let i = 0; i < editGuests.length; i++) {
      const g = editGuests[i];
      if (!g.fullName.trim()) {
        message.warning(`Vui lòng nhập họ tên khách thứ ${i + 1}`);
        return;
      }
      const idNum = String(g.identityNumber || '').trim();
      if (idNum && !/^\d{12}$/.test(idNum)) {
        message.warning(`Số CCCD của khách "${g.fullName}" phải gồm đúng 12 chữ số`);
        return;
      }
    }

    setSavingEdit(true);
    try {
      await api.post(`/bookings/${editBookingId}/guests`, {
        guests: editGuests.map((g) => ({
          fullName: g.fullName.trim(),
          identityNumber: g.identityNumber ? g.identityNumber.trim() : null,
          phone: g.phone ? g.phone.trim() : null,
          note: g.note ? g.note.trim() : null,
        })),
      });
      message.success('Đã lưu thông tin khách lưu trú thành công!');
      loadHistory();
      const updatedRes = await api.get(`/bookings/${editBookingId}`);
      const updatedDetail = (updatedRes as any).data || updatedRes;
      if (updatedDetail) {
        setEditDetail(updatedDetail);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể lưu thông tin khách lưu trú');
    } finally {
      setSavingEdit(false);
    }
  };

  const openEditServiceQty = (row: any) => {
    setEditSvcRow(row);
    setEditSvcQty(Number(row?.quantity || 1));
    setEditSvcModalOpen(true);
  };

  const saveEditServiceQty = async () => {
    if (!editBookingId || !editSvcRow) return;
    setEditingSvcSaving(true);
    try {
      const res = await updateBookingServiceCharge(editBookingId, Number(editSvcRow.id), {
        quantity: Number(editSvcQty || 1),
      });
      const result = (res as any).data ?? res;
      const delta = Number(result?.charge?.delta ?? 0);
      const pm = result?.payment;
      Modal.success({
        title: 'Đã cập nhật số lượng dịch vụ',
        content: (
          <div>
            <p>
              Dịch vụ <strong>{editSvcRow.serviceName || editSvcRow.name || ' '}</strong> đã được cập nhật.
              {delta !== 0 && (
                <span>
                  {' '}Tổng tiền dịch vụ{' '}
                  <strong style={{ color: delta > 0 ? '#cf1322' : '#3f8600' }}>
                    {delta > 0 ? 'tăng thêm ' : 'giảm bớt '}
                    {new Intl.NumberFormat('vi-VN').format(Math.abs(delta))}đ
                  </strong>
                  .
                </span>
              )}
            </p>
            {pm && (
              <p>
                Số tiền còn phải thanh toán:{' '}
                <strong style={{ color: '#cf1322' }}>
                  {new Intl.NumberFormat('vi-VN').format(Number(pm.remainingAmount ?? 0))}đ
                </strong>
              </p>
            )}
          </div>
        ),
        onOk: async () => {
          if (editBookingId) {
            const detailRes = await api.get(`/bookings/${editBookingId}`);
            setEditDetail((detailRes as any).data || detailRes);
          }
          setEditSvcModalOpen(false);
          setEditSvcRow(null);
          await loadHistory();
        },
      });
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể cập nhật dịch vụ');
    } finally {
      setEditingSvcSaving(false);
    }
  };

  const removeServiceCharge = async (row: any) => {
    if (!editBookingId) return;
    setSavingServiceAction?.(`del-${row.id}`);
    try {
      const res = await deleteBookingServiceCharge(editBookingId, Number(row.id));
      const result = (res as any).data ?? res;
      const removed = Number(result?.removed?.totalPrice ?? 0);
      const pm = result?.payment;
      Modal.success({
        title: 'Đã xóa dịch vụ',
        content: (
          <div>
            <p>
              Đã xóa <strong>{row.serviceName || row.name || 'dịch vụ'}</strong> khỏi đơn, hoàn lại{' '}
              <strong style={{ color: '#3f8600' }}>
                {new Intl.NumberFormat('vi-VN').format(Math.abs(removed))}đ
              </strong>
              .
            </p>
            {pm && (
              <p>
                Số tiền còn phải thanh toán:{' '}
                <strong style={{ color: '#cf1322' }}>
                  {new Intl.NumberFormat('vi-VN').format(Number(pm.remainingAmount ?? 0))}đ
                </strong>
              </p>
            )}
          </div>
        ),
        onOk: async () => {
          if (editBookingId) {
            const detailRes = await api.get(`/bookings/${editBookingId}`);
            setEditDetail((detailRes as any).data || detailRes);
          }
          await loadHistory();
        },
      });
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể xóa dịch vụ');
    } finally {
      setSavingServiceAction?.(null);
    }
  };

  const openCancelModal = async (record: BookingRow) => {
    setCancelTarget(record);
    setCancelPreview(null);
    setRefundMethod('bank_transfer');
    setRefundBankBin(undefined);
    setRefundAccountNumber('');
    setRefundAccountName('');
    setCancellationReason('');

    setCancelPreviewLoading(true);
    try {
      const previewRes = await getRefundPreview(record.id);
      setCancelPreview(previewRes.data);
    } catch {
      message.error('Không thể tải thông tin hoàn tiền');
      setCancelTarget(null);
    } finally {
      setCancelPreviewLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    if (cancellationReason.trim().length < 5) {
      message.error('Vui lòng nhập lý do hủy phòng (ít nhất 5 ký tự)');
      return;
    }

    const refundable = cancelPreview?.refundableAmount ?? 0;

    // Có tiền hoàn -> bắt buộc đủ thông tin nhận tiền
    if (refundable > 0 && refundMethod === 'bank_transfer') {
      if (!refundBankBin) {
        message.error('Vui lòng chọn ngân hàng nhận tiền hoàn');
        return;
      }
      if (!/^\d{4,30}$/.test(refundAccountNumber.replace(/\s+/g, ''))) {
        message.error('Số tài khoản ngân hàng chỉ được bao gồm các chữ số (0-9)');
        return;
      }
      if (refundAccountName.trim().length < 3) {
        message.error('Vui lòng nhập tên chủ tài khoản');
        return;
      }
    }

    const bank = VIETQR_BANKS.find((item) => item.bin === refundBankBin);
    const refundPayload =
      refundable > 0
        ? refundMethod === 'bank_transfer'
          ? {
              refundMethod: 'bank_transfer' as const,
              bankBin: refundBankBin,
              bankName: bank?.shortName || '',
              accountNumber: refundAccountNumber.replace(/\s+/g, ''),
              accountName: refundAccountName.trim().toUpperCase(),
            }
          : { refundMethod: 'cash' as const }
        : undefined;

    setCancellingId(cancelTarget.id);
    try {
      await cancelBooking(cancelTarget.id, cancellationReason.trim(), refundPayload);
      if (refundable > 0) {
        message.success(
          `Đã hủy đặt phòng. Yêu cầu hoàn ${formatPrice(refundable)} đang chờ khách sạn duyệt.`
        );
      } else {
        message.success('Đã hủy đặt phòng');
      }
      setCancelTarget(null);
      await loadHistory();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể hủy đặt phòng này');
    } finally {
      setCancellingId(null);
    }
  };

  const openReviewModal = (record: BookingRow) => {
    setReviewBooking(record);
    const existing = reviewsByBooking[record.id];
    if (existing) {
      setEditingReviewId(existing.id);
      setReviewRating(existing.rating);
      setReviewComment(existing.comment);
      setReviewImageFileList(imageUrlsToFileList(existing.images));
    } else {
      setEditingReviewId(null);
      setReviewRating(5);
      setReviewComment('');
      setReviewImageFileList([]);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewBooking) return;

    // Còn ảnh đang upload dở dang -> chặn submit để tránh lưu thiếu ảnh
    if (reviewImageFileList.some((file) => file.status === 'uploading')) {
      message.warning('Vui lòng đợi ảnh tải lên xong');
      return;
    }

    const reviewImages = fileListToImageUrls(reviewImageFileList);

    setSubmittingReview(true);
    try {
      if (editingReviewId) {
        const wasHidden = reviewsByBooking[reviewBooking.id]?.status === 'hidden';
        await updateReview(editingReviewId, {
          rating: reviewRating,
          comment: reviewComment.trim(),
          images: reviewImages,
        });
        message.success(
          wasHidden ? 'Đã cập nhật đánh giá, đang chờ duyệt lại!' : 'Đã cập nhật đánh giá!',
        );
        setReviewsByBooking((prev) => ({
          ...prev,
          [reviewBooking.id]: {
            ...prev[reviewBooking.id],
            id: editingReviewId,
            rating: reviewRating,
            comment: reviewComment.trim(),
            images: reviewImages,
            // Nếu review trước đó bị ẩn/từ chối và nội dung vừa đổi, backend sẽ
            // đưa về "pending" để duyệt lại; phản ánh ngay trên UI cho khớp.
            status: wasHidden ? 'pending' : prev[reviewBooking.id]?.status,
            hideReason: wasHidden ? null : prev[reviewBooking.id]?.hideReason,
          },
        }));
      } else {
        const res = await createReview({
          bookingId: reviewBooking.id,
          rating: reviewRating,
          comment: reviewComment.trim(),
          images: reviewImages,
        });
        message.success('Cảm ơn bạn đã đánh giá! Đánh giá của bạn đang chờ duyệt.');
        const createBody = (res as unknown as { data?: unknown })?.data ?? res;
        const newId =
          (createBody as { data?: { id?: number } })?.data?.id ??
          (createBody as { id?: number })?.id ??
          0;
        setReviewsByBooking((prev) => ({
          ...prev,
          [reviewBooking.id]: {
            id: newId,
            rating: reviewRating,
            comment: reviewComment.trim(),
            status: 'pending',
            images: reviewImages,
          },
        }));
      }
      setReviewBooking(null);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể lưu đánh giá');
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderPaymentStatus = (record: BookingRow) => {
    const payment = payments[record.id];
    const isUnpaid = !payment || payment.paymentStatus === 'unpaid';
    const hasDeposit = Number(payment?.paidAmount || 0) > 0;
    const holdRemainingMs = isUnpaid && !hasDeposit ? getHoldRemainingMs(record.hold_expires_at, record.created_at) : 0;
    const isHoldExpired = isUnpaid && !hasDeposit && holdRemainingMs <= 0 && record.status !== 'cancelled';

    if (!payment) {
      return (
        <div className="history-payment-cell">
          <Tag className="history-status-tag" color="orange">
            Chưa thanh toán
          </Tag>
          <span className={`history-hold-time ${isHoldExpired ? 'expired' : ''}`}>
            {isHoldExpired ? 'Hết thời gian giữ chỗ' : `Còn ${formatHoldTime(holdRemainingMs)}`}
          </span>
        </div>
      );
    }

    const refund = refundsByBooking[record.id];

    return (
      <div className="history-payment-cell">
        <Tag className="history-status-tag" color={paymentStatusMap[payment.paymentStatus]?.color || 'default'}>
          {paymentStatusMap[payment.paymentStatus]?.label || payment.paymentStatus}
        </Tag>
        {/* {payment.verificationStatus === 'pending' && (
          <Tag className="history-status-tag" color="gold">Chờ đối soát chuyển khoản</Tag>
        )} */}
        {/* {(payment.paymentStatus === 'unpaid' || payment.paymentStatus === 'deposit_paid') && (
          <span className={`history-hold-time ${isHoldExpired ? 'expired' : ''}`}>
            {hasDeposit
              ? 'Đã cọc, cần thanh toán phần còn lại'
              : isHoldExpired
                ? 'Hết thời gian giữ chỗ'
                : `Còn ${formatHoldTime(holdRemainingMs)}`}
          </span>
        )} */}
        {refund && (
          <Tag
            className="history-status-tag"
            color={refund.status === 'pending' ? 'gold' : refund.status === 'approved' ? 'green' : 'red'}
          >
            {refund.status === 'pending'
              ? `Chờ hoàn ${formatPrice(Number(refund.amount))}`
              : refund.status === 'approved'
                ? `Đã hoàn ${formatPrice(Number(refund.amount))}`
                : 'Từ chối hoàn tiền'}
          </Tag>
        )}
      </div>
    );
  };

  const columns = useMemo<ColumnsType<BookingRow>>(
    () => [
      {
        title: 'Đặt phòng',
        key: 'booking',
        width: 220,
        render: (_, record) => (
          <div className="history-booking-cell">
            <span className="history-booking-code">#{record.id}</span>
            <span className="history-room-line">
              <HomeOutlined />
              {record.status === 'checked_in' && record.room_number
                ? `Phòng ${record.room_number} · ${record.room_type_name || ''}`
                : record.room_type_name || 'Đặt phòng'}
            </span>
          </div>
        ),
      },
      {
        title: 'Thời gian lưu trú',
        key: 'dates',
        width: 230,
        render: (_, record) => (
          <div className="history-date-cell">
            <CalendarOutlined />
            <span>
              {formatDate(record.check_in)} - {formatDate(record.check_out)}
            </span>
          </div>
        ),
      },
      {
        title: 'Tổng tiền',
        key: 'payable_total',
        align: 'right',
        width: 150,
        render: (_, record) => {
          const payment = payments[record.id];
          const total =
            payment?.totalAmount ??
            Number(record.payable_total ?? record.total_price ?? 0);

          return (
            <div>
              <strong className="history-price">{formatPrice(total)}</strong>
              {/* {Number(payment?.serviceAmount || 0) > 0 && (
                <div className="history-price-note">
                  Đã gồm {formatPrice(payment?.serviceAmount || 0)} dịch vụ
                </div>
              )} */}
            </div>
          );
        },
      },
      {
        title: 'Trạng thái',
        dataIndex: 'status',
        key: 'status',
        width: 150,
        render: (status: string) => (
          <Tag className="history-status-tag" color={bookingStatusMap[status]?.color || 'default'}>
            {bookingStatusMap[status]?.label || status}
          </Tag>
        ),
      },
      {
        title: 'Thanh toán',
        key: 'payment',
        width: 170,
        render: (_, record) => renderPaymentStatus(record),
      },
      {
        title: 'Thao tác',
        key: 'actions',
        fixed: 'right',
        width: 250,
        render: (_, record) => {
          const payment = payments[record.id];
          const hasDeposit = Number(payment?.paidAmount || 0) > 0;
          const holdRemainingMs = getHoldRemainingMs(record.hold_expires_at, record.created_at);
          const isHoldExpired =
            (!payment || ['unpaid', 'deposit_paid'].includes(payment.paymentStatus)) &&
            !hasDeposit &&
            holdRemainingMs <= 0 &&
            record.status !== 'cancelled';
          const canCancel = ['pending', 'confirmed'].includes(record.status);
          const canPay =
            (!payment || ['unpaid', 'deposit_paid'].includes(payment.paymentStatus)) &&
            !isHoldExpired &&
            record.status !== 'cancelled';
          const existingReview = reviewsByBooking[record.id];

          return (
            <Space className="history-actions" size="small" wrap>
              <Tooltip title="Xem chi tiết đặt phòng">
                <Button
                  type="primary"
                  icon={<EyeOutlined style={{ color: 'white' }} />}
                  size="small"
                  onClick={() => {
                    setViewBookingId(record.id);
                    setViewModalVisible(true);
                  }}
                ></Button>
              </Tooltip>

              {['pending', 'confirmed', 'checked_in'].includes(record.status) && (
                <Tooltip title="Chỉnh sửa đặt phòng (ngày, hạng phòng, dịch vụ)">
                  <Button
                    type="primary"
                    icon={<EditOutlined style={{ color: 'white' }} />}
                    size="small"
                    onClick={() => openEditModal(record)}
                  ></Button>
                </Tooltip>
              )}

              {canPay && (
                <Tooltip title="Thanh toán đặt phòng">
                  <Link to={`/booking/${record.id}/payment`}>
                    <Button className="history-pay-btn" type="primary" icon={<CreditCardOutlined />} size="small"></Button>
                  </Link>
                </Tooltip>
              )}

              {canCancel && (
                <Tooltip title="Hủy đặt phòng">
                  <Button
                    type="primary"
                    danger
                    icon={<StopOutlined />}
                    size="small"
                    loading={cancellingId === record.id}
                    onClick={() => openCancelModal(record)}
                  ></Button>
                </Tooltip>
              )}

              {record.status === 'checked_out' && (
                <Space size={4} wrap>
                  <Tooltip title={existingReview ? 'Xem/Sửa đánh giá' : 'Đánh giá phòng'}>
                    <Button type="primary" icon={<StarOutlined />} size="small" onClick={() => openReviewModal(record)}></Button>
                  </Tooltip>
                  {existingReview?.status && existingReview.status !== 'approved' && (
                    <Tag color={reviewStatusMap[existingReview.status]?.color || 'default'}>
                      {reviewStatusMap[existingReview.status]?.label || existingReview.status}
                    </Tag>
                  )}
                </Space>
              )}
            </Space>
          );
        },
      },
    ],
    [cancellingId, payments, nowTick, reviewsByBooking, refundsByBooking]
  );

  return (
    <main className="booking-history-page">
      <section className="booking-history-shell">
        <div className="booking-history-hero">
          <div>
            <h1>Lịch sử đặt phòng</h1>
            <p>Theo dõi đặt phòng, thanh toán và thao tác hủy phòng của bạn tại một nơi.</p>
          </div>

          <div className="booking-history-toolbar">
            <Button icon={<ReloadOutlined />} onClick={loadHistory} loading={loading}>
              Làm mới
            </Button>
            <Link to="/rooms">
              <Button type="primary" className="history-primary-btn">
                Đặt phòng mới
              </Button>
            </Link>
          </div>
        </div>

        <div className="history-stats">
          {stats.map((item) => (
            <div className="history-stat-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        <div className="history-table-panel">
          <Spin spinning={loading}>
            {bookings.length === 0 && !loading ? (
              <Empty
                className="history-empty"
                description="Bạn chưa có đặt phòng nào"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Link to="/rooms">
                  <Button type="primary" className="history-primary-btn">
                    Chọn phòng
                  </Button>
                </Link>
              </Empty>
            ) : (
              <Table
                className="history-table"
                rowKey="id"
                columns={columns}
                dataSource={bookings}
                childrenColumnName="_rowChildren"
                pagination={{
                  pageSize: 6,
                  showSizeChanger: false,
                }}
                scroll={{ x: 1160 }}
              />
            )}
          </Spin>
        </div>
      </section>

      <Modal
        open={!!cancelTarget}
        title={cancelTarget ? `Hủy đặt phòng #${cancelTarget.id}` : ''}
        okText="Xác nhận hủy phòng"
        okButtonProps={{ danger: true }}
        cancelText="Đóng"
        confirmLoading={cancellingId === cancelTarget?.id}
        onOk={handleConfirmCancel}
        onCancel={() => cancellingId === null && setCancelTarget(null)}
        destroyOnHidden
        centered
      >
        {cancelPreviewLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Spin />
          </div>
        ) : cancelPreview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <strong>Lý do hủy phòng <span style={{ color: '#ff4d4f' }}>*</span></strong>
              <Input.TextArea
                rows={3}
                maxLength={500}
                showCount
                value={cancellationReason}
                onChange={(event) => setCancellationReason(event.target.value)}
                placeholder="Ví dụ: Thay đổi lịch trình, vấn đề sức khỏe..."
                style={{ marginTop: 8 }}
              />
            </div>
            {cancelPreview.refundableAmount > 0 ? (
              <>
                <Alert
                  type="info"
                  showIcon
                  message={
                    <>
                      Bạn sẽ được hoàn <strong>{formatPrice(cancelPreview.refundableAmount)}</strong>{' '}
                      ({Math.round(Number(cancelPreview.refundRate) * 100)}% số tiền đã thanh toán) —
                      còn {cancelPreview.daysBeforeCheckIn} ngày trước nhận phòng.
                    </>
                  }
                  description="Yêu cầu hoàn tiền sẽ được gửi đến khách sạn để duyệt. Vui lòng chọn cách nhận tiền."
                />

                <Radio.Group
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                  options={[
                    { value: 'bank_transfer', label: 'Chuyển khoản ngân hàng' },
                    { value: 'cash', label: 'Nhận tiền mặt tại quầy' },
                  ]}
                />

                {refundMethod === 'bank_transfer' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Select
                      showSearch
                      placeholder="Chọn ngân hàng nhận tiền"
                      optionFilterProp="label"
                      value={refundBankBin}
                      onChange={setRefundBankBin}
                      options={VIETQR_BANKS.map((bank) => ({
                        value: bank.bin,
                        label: `${bank.shortName} — ${bank.name}`,
                      }))}
                    />
                    <Input
                      placeholder="Số tài khoản nhận tiền (chỉ nhập số 0-9)"
                      maxLength={30}
                      value={refundAccountNumber}
                      onChange={(e) => setRefundAccountNumber(e.target.value.replace(/\D/g, ''))}
                    />
                    <Input
                      placeholder="Tên chủ tài khoản (VD: NGUYEN VAN A)"
                      maxLength={50}
                      value={refundAccountName}
                      onChange={(e) => setRefundAccountName(e.target.value)}
                    />
                  </div>
                )}

                {refundMethod === 'cash' && (
                  <Alert
                    type="warning"
                    showIcon
                    message="Bạn sẽ nhận tiền mặt trực tiếp tại quầy lễ tân, vui lòng mang theo giấy tờ tùy thân."
                  />
                )}
              </>
            ) : (
              <Alert
                type="warning"
                showIcon
                message="Hủy đặt phòng này sẽ không được hoàn tiền"
                description={
                  Number(cancelPreview.refundRate) === 0 && cancelPreview.daysBeforeCheckIn >= 0
                    ? `Còn ${cancelPreview.daysBeforeCheckIn} ngày trước nhận phòng (trên 7 ngày) hoặc bạn chưa thanh toán khoản nào.`
                    : 'Bạn chưa thanh toán khoản nào cho đặt phòng này.'
                }
              />
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!reviewBooking}
        title={
          reviewBooking
            ? `${editingReviewId ? 'Sửa đánh giá' : 'Đánh giá'} ${reviewBooking.room_number ? `phòng ${reviewBooking.room_number} – ` : ''}${reviewBooking.room_type_name || 'Đặt phòng'}`
            : ''
        }
        okText={editingReviewId ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
        cancelText="Đóng"
        confirmLoading={submittingReview}
        okButtonProps={{
          disabled:
            !!editingReviewId &&
            reviewBooking !== null &&
            reviewsByBooking[reviewBooking.id]?.status === 'hidden' &&
            reviewRating === reviewsByBooking[reviewBooking.id]?.rating &&
            reviewComment.trim().toLowerCase() ===
              (reviewsByBooking[reviewBooking.id]?.comment || '').trim().toLowerCase(),
        }}
        onOk={handleSubmitReview}
        onCancel={() => !submittingReview && setReviewBooking(null)}
        destroyOnHidden
        centered
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            {editingReviewId && reviewBooking && (
              <>
                {reviewsByBooking[reviewBooking.id]?.status === 'pending' && (
                  <Alert
                    type="info"
                    showIcon
                    message="Đánh giá của bạn đang chờ duyệt. Sau khi được quản trị viên duyệt, đánh giá sẽ hiển thị công khai."
                    style={{ marginBottom: 12 }}
                  />
                )}
                {reviewsByBooking[reviewBooking.id]?.status === 'hidden' && (
                  <Alert
                    type="warning"
                    showIcon
                    message={`Đánh giá đang bị ẩn/từ chối${
                      reviewsByBooking[reviewBooking.id]?.hideReason
                        ? ': ' + reviewsByBooking[reviewBooking.id]?.hideReason
                        : ''
                    }. Vui lòng chỉnh sửa nội dung trước khi gửi lại.`}
                    style={{ marginBottom: 12 }}
                  />
                )}
                {reviewsByBooking[reviewBooking.id]?.adminReply && (
                  <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 8, marginBottom: 12 }}>
                    <strong>Phản hồi của khách sạn:</strong>
                    <p style={{ margin: '4px 0 0' }}>{reviewsByBooking[reviewBooking.id]?.adminReply}</p>
                  </div>
                )}
              </>
            )}
            <p style={{ marginBottom: 4 }}>Chất lượng kỳ nghỉ của bạn:</p>
            <Rate value={reviewRating} onChange={setReviewRating} />
          </div>
          <Input.TextArea
            rows={4}
            maxLength={500}
            showCount
            placeholder="Chia sẻ trải nghiệm của bạn về phòng và dịch vụ..."
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
          />
          <div>
            <p style={{ marginBottom: 8 }}>Ảnh thực tế (không bắt buộc, tối đa {MAX_REVIEW_IMAGES} ảnh):</p>
            <Upload
              listType="picture-card"
              fileList={reviewImageFileList}
              customRequest={uploadReviewImage}
              beforeUpload={beforeUploadReviewImage}
              onChange={({ fileList }) => setReviewImageFileList(fileList)}
              maxCount={MAX_REVIEW_IMAGES}
              multiple
              accept="image/*"
            >
              {reviewImageFileList.length >= MAX_REVIEW_IMAGES ? null : (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>Thêm ảnh</div>
                </div>
              )}
            </Upload>
          </div>
        </div>
      </Modal>

      <Modal
        title={
          <Space>
            <span>Chỉnh sửa đặt phòng #{editBookingId}</span>
            {editDetail?.status && (
              <Tag color={bookingStatusMap[editDetail.status]?.color || 'default'}>
                {bookingStatusMap[editDetail.status]?.label || editDetail.status}
              </Tag>
            )}
          </Space>
        }
        open={editModalOpen}
        onCancel={() => !savingEdit && setEditModalOpen(false)}
        okText={
          editTab === 'info'
            ? 'Lưu thay đổi ngày/phòng'
            : editTab === 'guests'
              ? 'Lưu thông tin khách'
              : 'Cộng dịch vụ'
        }
        cancelText="Đóng"
        confirmLoading={savingEdit}
        onOk={() => {
          if (editTab === 'info') saveInfoChanges();
          else if (editTab === 'guests') saveGuestChanges();
          else addServiceToBooking();
        }}
        okButtonProps={
          editTab === 'services'
            ? {
                disabled:
                  !newServiceId ||
                  !(newServiceQty > 0) ||
                  !['pending', 'confirmed', 'checked_in'].includes(
                    editDetail?.status ?? ''
                  ),
              }
            : undefined
        }
        width={1080}
        style={{ top: 24 }}
        styles={{
          body: {
            maxHeight: 'calc(100vh - 160px)',
            overflowY: 'auto',
            paddingRight: 8,
          },
        }}
        destroyOnHidden
      >
        {editLoading && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin tip="Đang tải dữ liệu chỉnh sửa..." />
          </div>
        )}
        {!editLoading && !editDetail && (
          <Alert type="error" message="Không thể tải chi tiết đặt phòng. Vui lòng thử lại." showIcon />
        )}
        {!editLoading && editDetail && (
          <Tabs
            activeKey={editTab}
            onChange={setEditTab}
            items={[
              {
                key: 'info',
                label: 'Ngày & Hạng phòng',
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <Descriptions bordered size="small" column={2} title="Thông tin hiện tại">
                      <Descriptions.Item label="Mã đặt phòng">#{editDetail.id}</Descriptions.Item>
                      <Descriptions.Item label="Hạng phòng">
                        {editDetail.status === 'checked_in' && editDetail.room_number
                          ? `Phòng ${editDetail.room_number} (${editDetail.room_type_name || '?'})`
                          : `${editDetail.room_type_name || '—'} (Số phòng phân bố khi nhận phòng)`}
                      </Descriptions.Item>
                      <Descriptions.Item label="Ngày nhận (hiện tại)">
                        {dayjs(editDetail.check_in).format('DD/MM/YYYY')}
                      </Descriptions.Item>
                      <Descriptions.Item label="Ngày trả (hiện tại)">
                        {dayjs(editDetail.check_out).format('DD/MM/YYYY')}
                      </Descriptions.Item>
                      <Descriptions.Item label="Số đêm">
                        {Math.max(
                          dayjs(editDetail.check_out)
                            .startOf('day')
                            .diff(dayjs(editDetail.check_in).startOf('day'), 'day'),
                          0
                        )}{' '}
                        đêm
                      </Descriptions.Item>
                      <Descriptions.Item label="Số khách">
                        {editDetail.adults ?? 0} người lớn, {editDetail.children ?? 0} trẻ em
                      </Descriptions.Item>
                    </Descriptions>

                    <Form layout="vertical">
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: 16 }}>
                        <Form.Item label="Thời gian (nhận — trả)" required style={{ marginBottom: 0 }}>
                          <DatePicker.RangePicker
                            style={{ width: '100%' }}
                            format="DD/MM/YYYY"
                            value={editStayRange}
                            disabledDate={(d) => d.isBefore(dayjs().subtract(1, 'day').endOf('day'))}
                            onChange={(val) => {
                              setEditStayRange(val as [any, any] | null);
                              setAvailabilityError(null);
                              setChangePreviewData(null);
                            }}
                          />
                        </Form.Item>
                        <Form.Item label="Hạng phòng (Chuyển/Nâng cấp)" required style={{ marginBottom: 0 }}>
                          <Select
                            placeholder="Chọn hạng phòng"
                            value={editRoomTypeId ?? undefined}
                            onChange={(val) => {
                              setEditRoomTypeId(val ?? null);
                              setEditTargetRoomId(null);
                              setAvailabilityError(null);
                              setChangePreviewData(null);
                            }}
                            options={allRoomTypes.map((rt: any) => ({
                              value: rt.id,
                              label: `${rt.typeName} · ${formatPrice(Number(rt.defaultPrice || 0))}/đêm`,
                            }))}
                          />
                        </Form.Item>
                      </div>

                      {editRoomTypeId && (
                        <div style={{ marginTop: 12 }}>
                          <Form.Item label="Phòng vật lý chuyển đến (Tùy chọn chọn phòng cụ thể hoặc để hệ thống tự động gán)" style={{ marginBottom: 0 }}>
                            <Select
                              allowClear
                              placeholder="Hệ thống tự động gán phòng trống phù hợp"
                              value={editTargetRoomId ?? undefined}
                              onChange={(val) => {
                                setEditTargetRoomId(val ?? null);
                                setAvailabilityError(null);
                                setChangePreviewData(null);
                              }}
                              options={allRooms
                                .filter((r: any) => (r.roomTypeId === Number(editRoomTypeId) || r.room_type_id === Number(editRoomTypeId)) && (r.status === 'available' || !r.status || r.id === editDetail?.room_id))
                                .map((r: any) => ({
                                  value: r.id,
                                  label: `Phòng ${r.roomNumber || r.room_number} (${r.typeName || r.room_type_name || ''}) ${r.id === editDetail?.room_id ? '— (Phòng hiện tại)' : ''}`,
                                }))}
                            />
                          </Form.Item>
                        </div>
                      )}

                      <Space style={{ margin: '14px 0 8px' }}>
                        <Button
                          type="primary"
                          icon={availabilityLoading ? <Spin size="small" /> : <ReloadOutlined />}
                          disabled={availabilityLoading}
                          onClick={() => runAvailabilityCheck()}
                        >
                          Kiểm tra phòng trống & tính giá
                        </Button>
                        <Button
                          onClick={() => {
                            setAvailabilityError(null);
                            setChangePreviewData(null);
                          }}
                        >
                          Xem lại
                        </Button>
                      </Space>

                      {availabilityError && (
                        <Alert type="error" showIcon message={availabilityError} style={{ marginTop: 8 }} />
                      )}
                      {availabilityLoading && (
                        <div style={{ textAlign: 'center', padding: 24 }}>
                          <Spin tip="Đang kiểm tra phòng trống & tính toán biểu giá..." />
                        </div>
                      )}
                      {!availabilityLoading && changePreviewData && (() => {
                        const fb = changePreviewData.financialBreakdown || {};
                        const nightsList = changePreviewData.nightlyPrices || [];
                        const reducedNightsList = fb.reducedNightlyPrices || [];
                        const isShortening = Boolean(changePreviewData.isShortening || fb.isShortening);

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                            {/* Thông báo rút ngắn thời gian ở */}
                            {isShortening && (
                              <Alert
                                type="info"
                                showIcon
                                message={`Rút ngắn thời gian ở: Giảm ${fb.reducedNights || changePreviewData.reducedNights || 0} đêm`}
                                description={`Ngày trả phòng mới: ${dayjs(changePreviewData.targetCheckOut).format('DD/MM/YYYY')} (trước đây: ${dayjs(changePreviewData.currentCheckOut).format('DD/MM/YYYY')}). Tiền phòng được giảm trừ: -${formatPrice(Math.abs(fb.priceDifference || 0))}.`}
                              />
                            )}

                            {/* Hiển thị cảnh báo từng ngày lễ (+20%) và thứ 7, CN (+10%) */}
                            {changePreviewData.warnings && changePreviewData.warnings.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {changePreviewData.warnings.map((w: string, idx: number) => (
                                  <Alert
                                    key={idx}
                                    type="warning"
                                    showIcon
                                    message={w}
                                  />
                                ))}
                              </div>
                            )}

                            {/* Bảng tóm tắt tài chính phát sinh đúng chuẩn */}
                            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: '14px 18px' }}>
                              <h4 style={{ margin: '0 0 10px', color: '#0f172a', fontSize: 14 }}>
                                Bảng tổng hợp chi phí thay đổi:
                              </h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Tiền phòng lưu trú mới ({changePreviewData.totalNights || nightsList.length} đêm):</span>
                                  <strong>{formatPrice(fb.baseRoomAmount || 0)}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Phụ thu ngày lễ (+20%):</span>
                                  <strong style={{ color: fb.holidaySurcharge > 0 ? '#cf1322' : '#64748b' }}>
                                    {fb.holidaySurcharge > 0 ? `+${formatPrice(fb.holidaySurcharge)}` : '0đ'}
                                  </strong>
                                </div>
                                {fb.holidaySurcharge > 0 && (
                                  <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', padding: '6px 10px', borderRadius: 6, fontSize: 12, margin: '2px 0 4px' }}>
                                    <div style={{ fontWeight: 600, color: '#cf1322', marginBottom: 2 }}>Chi tiết các ngày lễ (+20%):</div>
                                    {nightsList.filter((n: any) => n.isHoliday).map((n: any, idx: number) => (
                                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#595959' }}>
                                        <span>• {dayjs(n.date || n.stayDate).format('DD/MM/YYYY')} ({n.dayName || ''}): {n.holidayName || n.note || 'Ngày lễ'}</span>
                                        <span style={{ fontWeight: 600, color: '#cf1322' }}>+{formatPrice(n.surcharge || 0)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Phụ thu cuối tuần (+10%):</span>
                                  <strong style={{ color: fb.weekendSurcharge > 0 ? '#d46b08' : '#64748b' }}>
                                    {fb.weekendSurcharge > 0 ? `+${formatPrice(fb.weekendSurcharge)}` : '0đ'}
                                  </strong>
                                </div>
                                {fb.weekendSurcharge > 0 && (
                                  <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', padding: '6px 10px', borderRadius: 6, fontSize: 12, margin: '2px 0 4px' }}>
                                    <div style={{ fontWeight: 600, color: '#d46b08', marginBottom: 2 }}>Chi tiết các ngày Thứ 7 & Chủ nhật (+10%):</div>
                                    {nightsList.filter((n: any) => !n.isHoliday && (n.isSaturday || n.isSunday)).map((n: any, idx: number) => (
                                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#595959' }}>
                                        <span>• {dayjs(n.date || n.stayDate).format('DD/MM/YYYY')} ({n.dayName || (n.isSaturday ? 'Thứ bảy' : 'Chủ nhật')}): Phụ thu cuối tuần</span>
                                        <span style={{ fontWeight: 600, color: '#d46b08' }}>+{formatPrice(n.surcharge || 0)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Phí nâng cấp phòng:</span>
                                  <strong style={{ color: fb.upgradeFee > 0 ? '#0958d9' : '#64748b' }}>
                                    {fb.upgradeFee > 0 ? `+${formatPrice(fb.upgradeFee)}` : '0đ'}
                                  </strong>
                                </div>
                                {fb.extraGuestSurcharge !== 0 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{fb.extraGuestSurcharge > 0 ? 'Phụ thu khách/trẻ em thêm đêm:' : 'Giảm phụ thu khách/trẻ em:'}</span>
                                    <strong style={{ color: fb.extraGuestSurcharge > 0 ? '#0958d9' : '#389e0d' }}>
                                      {fb.extraGuestSurcharge > 0 ? `+${formatPrice(fb.extraGuestSurcharge)}` : `-${formatPrice(Math.abs(fb.extraGuestSurcharge))}`}
                                    </strong>
                                  </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: '1px solid #cbd5e1', fontSize: 14 }}>
                                  <strong>{fb.priceDifference >= 0 ? 'Tổng tiền phát sinh:' : 'Tổng tiền giảm trừ:'}</strong>
                                  <strong style={{ color: fb.priceDifference > 0 ? '#cf1322' : fb.priceDifference < 0 ? '#389e0d' : '#0f172a', fontSize: 15 }}>
                                    {fb.priceDifference > 0 ? `+${formatPrice(fb.priceDifference)}` : fb.priceDifference < 0 ? `-${formatPrice(Math.abs(fb.priceDifference))}` : '0đ'}
                                  </strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569' }}>
                                  <span>Tổng tiền thanh toán mới của đơn:</span>
                                  <strong style={{ color: '#0f172a' }}>{formatPrice(fb.newTotalAmount || 0)}</strong>
                                </div>
                              </div>
                            </div>

                            {/* Danh sách các đêm bị cắt giảm */}
                            {isShortening && reducedNightsList.length > 0 && (
                              <div style={{ padding: '10px 14px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8 }}>
                                <div style={{ fontWeight: 600, color: '#d46b08', marginBottom: 6, fontSize: 13 }}>
                                  ✂️ Chi tiết các đêm được cắt giảm ({reducedNightsList.length} đêm):
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                                  {reducedNightsList.map((night: any, idx: number) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#595959', fontSize: 12, background: '#fff', padding: '4px 8px', borderRadius: 4 }}>
                                      <span>
                                        • <strong>{dayjs(night.date || night.stayDate).format('DD/MM/YYYY')}</strong> ({night.dayName || ''})
                                        {night.isHoliday && <Tag color="red" style={{ marginLeft: 4 }}>Ngày lễ (+20%)</Tag>}
                                        {night.isSunday && <Tag color="orange" style={{ marginLeft: 4 }}>Chủ nhật (+10%)</Tag>}
                                        {night.isSaturday && <Tag color="purple" style={{ marginLeft: 4 }}>Thứ 7 (+10%)</Tag>}
                                      </span>
                                      <span style={{ fontWeight: 600, color: '#389e0d' }}>
                                        -{formatPrice(night.price)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Chi tiết từng đêm lưu trú mới */}
                            {nightsList.length > 0 && (
                              <div style={{ padding: '10px 14px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8 }}>
                                <div style={{ fontWeight: 600, color: '#262626', marginBottom: 8, fontSize: 13 }}>
                                  Chi tiết giá từng đêm lưu trú mới ({nightsList.length} đêm):
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                                  {nightsList.map((night: any, idx: number) => {
                                    return (
                                      <div
                                        key={idx}
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          fontSize: 13,
                                          background: '#fff',
                                          padding: '6px 10px',
                                          borderRadius: 6,
                                          border: '1px solid #f0f0f0'
                                        }}
                                      >
                                        <span>
                                          <strong>{dayjs(night.date || night.stayDate).format('DD/MM/YYYY')}</strong> ({night.dayName || ''})
                                          {night.isHoliday && <Tag color="red" style={{ marginLeft: 6 }}>Ngày lễ (+20%)</Tag>}
                                          {night.isSunday && <Tag color="orange" style={{ marginLeft: 6 }}>Chủ nhật (+10%)</Tag>}
                                          {night.isSaturday && <Tag color="purple" style={{ marginLeft: 6 }}>Thứ 7 (+10%)</Tag>}
                                          {!night.isHoliday && !night.isSunday && !night.isSaturday && <Tag color="blue" style={{ marginLeft: 6 }}>Ngày thường</Tag>}
                                          {night.isNewRoom && <Tag color="cyan" style={{ marginLeft: 4 }}>Phòng mới: {night.roomNumber}</Tag>}
                                          {night.note && <span style={{ color: '#8c8c8c', fontSize: 12, marginLeft: 4 }}>({night.note})</span>}
                                        </span>
                                        <span style={{ fontWeight: 600, color: night.isHoliday || night.isWeekend ? '#cf1322' : '#0f172a' }}>
                                          {formatPrice(night.price)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Form hoàn tiền nếu phát sinh số tiền thừa cần hoàn */}
                            {fb.refundableExcessAmount > 0 && (
                              <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '14px 16px' }}>
                                <div style={{ fontWeight: 600, color: '#389e0d', fontSize: 14, marginBottom: 4 }}>
                                  💰 Tiền thừa được hoàn lại: +{formatPrice(fb.refundableExcessAmount)}
                                </div>
                                <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>
                                  Tổng số tiền bạn đã thanh toán ({formatPrice(fb.paidTotal || 0)}) lớn hơn tổng tiền mới ({formatPrice(fb.newTotalAmount || 0)}). Khách sạn sẽ hoàn trả khoản tiền chênh lệch này cho bạn:
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  <div>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                                      Phương thức nhận hoàn tiền:
                                    </label>
                                    <Radio.Group value={editRefundMethod} onChange={e => setEditRefundMethod(e.target.value)}>
                                      <Radio value="bank_transfer">Chuyển khoản ngân hàng</Radio>
                                      <Radio value="cash">Tiền mặt tại quầy lễ tân</Radio>
                                    </Radio.Group>
                                  </div>

                                  {editRefundMethod === 'bank_transfer' && (
                                    <Row gutter={[10, 10]}>
                                      <Col span={24}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 3, color: '#334155' }}>
                                          Ngân hàng thụ hưởng <span style={{ color: '#cf1322' }}>*</span>
                                        </label>
                                        <Select
                                          showSearch
                                          placeholder="Chọn ngân hàng của bạn"
                                          style={{ width: '100%' }}
                                          value={editRefundBankBin}
                                          onChange={val => setEditRefundBankBin(val)}
                                          options={VIETQR_BANKS.map(b => ({
                                            value: b.bin,
                                            label: `${b.shortName} — ${b.name}`
                                          }))}
                                          filterOption={(input, opt) => (opt?.label as string || '').toLowerCase().includes(input.toLowerCase())}
                                        />
                                      </Col>
                                      <Col span={12}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 3, color: '#334155' }}>
                                          Số tài khoản <span style={{ color: '#cf1322' }}>*</span>
                                        </label>
                                        <Input
                                          placeholder="Ví dụ: 0123456789"
                                          value={editRefundAccountNumber}
                                          onChange={e => setEditRefundAccountNumber(e.target.value)}
                                        />
                                      </Col>
                                      <Col span={12}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 3, color: '#334155' }}>
                                          Tên chủ tài khoản <span style={{ color: '#cf1322' }}>*</span>
                                        </label>
                                        <Input
                                          placeholder="NGUYEN VAN A"
                                          value={editRefundAccountName}
                                          onChange={e => setEditRefundAccountName(e.target.value.toUpperCase())}
                                        />
                                      </Col>
                                    </Row>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </Form>
                  </div>
                ),
              },
              {
                key: 'guests',
                label: `Khách lưu trú & CCCD (${editGuests.length})`,
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Alert
                      type="info"
                      showIcon
                      message="Khai báo thông tin khách lưu trú và số CCCD"
                      description="Bạn có thể bổ sung hoặc cập nhật thông tin họ tên, CCCD/CMND của bạn và các thành viên lưu trú cùng phòng."
                    />
                    {editGuests.map((guest, index) => (
                      <Card
                        key={index}
                        size="small"
                        title={<span style={{ fontWeight: 600, fontSize: 13 }}>Khách {index + 1} {index === 0 ? '(Người đại diện đặt)' : ''}</span>}
                        extra={
                          editGuests.length > 1 ? (
                            <Button
                              danger
                              type="text"
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => {
                                setEditGuests(prev => prev.filter((_, i) => i !== index));
                              }}
                            >
                              Xóa
                            </Button>
                          ) : null
                        }
                        style={{ borderRadius: 8 }}
                      >
                        <Row gutter={[12, 12]}>
                          <Col xs={24} sm={8}>
                            <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Họ và tên *</div>
                            <Input
                              placeholder="Họ và tên người ở"
                              value={guest.fullName}
                              onChange={e => {
                                const val = e.target.value;
                                setEditGuests(prev => {
                                  const next = [...prev];
                                  next[index] = { ...next[index], fullName: val };
                                  return next;
                                });
                              }}
                            />
                          </Col>
                          <Col xs={24} sm={8}>
                            <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Số CCCD / CMND (Tùy chọn)</div>
                            <Input
                              placeholder="CCCD (12 chữ số)"
                              maxLength={12}
                              value={guest.identityNumber}
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                                setEditGuests(prev => {
                                  const next = [...prev];
                                  next[index] = { ...next[index], identityNumber: val };
                                  return next;
                                });
                              }}
                            />
                          </Col>
                          <Col xs={24} sm={8}>
                            <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Số điện thoại (Tùy chọn)</div>
                            <Input
                              placeholder="Số điện thoại"
                              value={guest.phone || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setEditGuests(prev => {
                                  const next = [...prev];
                                  next[index] = { ...next[index], phone: val };
                                  return next;
                                });
                              }}
                            />
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditGuests(prev => [...prev, { fullName: '', identityNumber: '', phone: '', note: '' }]);
                      }}
                      style={{ borderRadius: 8, height: 40 }}
                    >
                      Thêm người ở cùng phòng
                    </Button>
                  </div>
                ),
              },
              {
                key: 'services',
                label: 'Dịch vụ',
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                      <h4 style={{ margin: '0 0 8px' }}>Dịch vụ đã cộng trong đặt phòng</h4>
                      <Table
                        size="small"
                        rowKey="id"
                        pagination={false}
                        dataSource={editDetail.services || []}
                        locale={{
                          emptyText: (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description="Chưa có dịch vụ phát sinh nào"
                            />
                          ),
                        }}
                        columns={[
                          {
                            title: 'Dịch vụ',
                            dataIndex: 'serviceName',
                            render: (v: string, row: any) => (
                              <div>
                                <strong>{v}</strong>
                                {row.description && (
                                  <div style={{ fontSize: 12, color: '#666' }}>
                                    {row.description}
                                  </div>
                                )}
                              </div>
                            ),
                          },
                          {
                            title: 'Đơn giá',
                            dataIndex: 'unitPrice',
                            align: 'right',
                            render: (v: any) =>
                              new Intl.NumberFormat('vi-VN').format(Number(v || 0)) + 'đ',
                          },
                          { title: 'SL', dataIndex: 'quantity', align: 'center' },
                          {
                            title: 'Thành tiền',
                            dataIndex: 'totalPrice',
                            align: 'right',
                            render: (v: any) => (
                              <strong>
                                {new Intl.NumberFormat('vi-VN').format(Number(v || 0))}đ
                              </strong>
                            ),
                          },
                          {
                            title: 'Ghi chú',
                            dataIndex: 'createdAt',
                            render: (v: any) =>
                              v
                                ? dayjs(v).format('HH:mm DD/MM/YYYY')
                                : '—',
                          },
                          ...(
                            ['pending', 'confirmed', 'checked_in'].includes(
                              (editDetail.status as string) ?? ''
                            )
                              ? [
                                  {
                                    title: 'Thao tác',
                                    key: 'action',
                                    align: 'center',
                                    width: 128,
                                    render: (_v: any, row: any) => (
                                      <Space size={4}>
                                        <Tooltip title="Sửa số lượng dịch vụ">
                                          <Button
                                            type="link"
                                            size="small"
                                            icon={<EditOutlined />}
                                            onClick={() => openEditServiceQty(row)}
                                            disabled={
                                              savingServiceAction === `edit-${row.id}`
                                            }
                                          />
                                        </Tooltip>
                                        <Popconfirm
                                          title="Xóa dịch vụ này?"
                                          description={
                                            <>
                                              Xóa{' '}
                                              <strong>
                                                {row.serviceName || row.name} (x
                                                {row.quantity})
                                              </strong>{' '}
                                              khỏi đơn, hoàn lại{' '}
                                              <strong style={{ color: '#3f8600' }}>
                                                {new Intl.NumberFormat('vi-VN').format(
                                                  Number(row.totalPrice || 0)
                                                )}
                                                đ
                                              </strong>
                                              ?
                                            </>
                                          }
                                          okText="Xóa"
                                          cancelText="Hủy"
                                          okButtonProps={{
                                            danger: true,
                                            loading: savingServiceAction === `del-${row.id}`,
                                          }}
                                          onConfirm={() => removeServiceCharge(row)}
                                        >
                                          <Tooltip title="Xóa dịch vụ khỏi đơn">
                                            <Button
                                              type="link"
                                              size="small"
                                              danger
                                              icon={<DeleteOutlined />}
                                            />
                                          </Tooltip>
                                        </Popconfirm>
                                      </Space>
                                    ),
                                  } as any,
                                ]
                              : []
                          ),
                        ]}
                        summary={() => {
                          const rows = editDetail.services || [];
                          if (rows.length === 0) return null;
                          const total = rows.reduce(
                            (s: number, r: any) => s + Number(r.totalPrice || 0),
                            0
                          );
                          // Lưu ý index của Table.Summary.Cell: colSpan=3 ở cột đầu tiên để che 3 cột (Dịch vụ + Đơn giá + SL), sau đó cột "Thành tiền" có index=3 đúng.
                          return (
                            <Table.Summary.Row>
                              <Table.Summary.Cell index={0} colSpan={3}>
                                <strong>Tổng dịch vụ đã cộng</strong>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={3} align="right">
                                <strong>
                                  {new Intl.NumberFormat('vi-VN').format(total)}đ
                                </strong>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={4} />
                            </Table.Summary.Row>
                          );
                        }}
                      />
                    </div>

                    <Modal
                      title={
                        <span>
                          Sửa số lượng <strong>{editSvcRow?.serviceName || editSvcRow?.name || ''}</strong>
                        </span>
                      }
                      open={editSvcModalOpen}
                      onOk={saveEditServiceQty}
                      confirmLoading={editingSvcSaving}
                      onCancel={() => !editingSvcSaving && setEditSvcModalOpen(false)}
                      okText="Lưu"
                      cancelText="Hủy"
                      width={520}
                    >
                      <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <Alert
                          type="info"
                          showIcon
                          message="Đơn giá không thay đổi khi sửa số lượng"
                          description={
                            <div>
                              <p style={{ margin: '4px 0 0' }}>
                                Đơn giá hiện tại:{' '}
                                <strong>
                                  {new Intl.NumberFormat('vi-VN').format(
                                    Number(editSvcRow?.unitPrice || 0) ||
                                      Math.round(
                                        Number(editSvcRow?.totalPrice || 0) /
                                          Math.max(1, Number(editSvcRow?.quantity || 1))
                                      )
                                  )}
                                  đ
                                </strong>
                              </p>
                            </div>
                          }
                        />
                        <Form layout="vertical">
                          <Form.Item label="Số lượng mới" required>
                            <InputNumber
                              min={1}
                              max={999}
                              style={{ width: '100%' }}
                              value={editSvcQty}
                              onChange={(v) => setEditSvcQty(Number(v || 1))}
                            />
                          </Form.Item>
                          <Alert
                            type="success"
                            showIcon
                            message="Tạm tính"
                            description={
                              <strong style={{ color: '#b45309' }}>
                                {new Intl.NumberFormat('vi-VN').format(
                                  editSvcQty *
                                    (Number(editSvcRow?.unitPrice || 0) ||
                                      Math.round(
                                        Number(editSvcRow?.totalPrice || 0) /
                                          Math.max(1, Number(editSvcRow?.quantity || 1))
                                      ))
                                )}
                                đ
                              </strong>
                            }
                          />
                        </Form>
                      </div>
                    </Modal>

                    <div
                      style={{
                        border: '1px dashed #d9d9d9',
                        borderRadius: 12,
                        padding: 16,
                        background: '#fafafa',
                      }}
                    >
                      <h4 style={{ margin: '0 0 12px' }}>Cộng thêm dịch vụ mới</h4>
                      {!['pending', 'confirmed', 'checked_in'].includes(
                        editDetail.status ?? ''
                      ) && (
                        <Alert
                          style={{ marginBottom: 12 }}
                          type="warning"
                          showIcon
                          message="Trạng thái đặt phòng này không cho phép cộng thêm dịch vụ. (Chỉ cho phép: chờ xác nhận / đã xác nhận / đang ở)."
                        />
                      )}
                      <Form layout="vertical">
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                          <Form.Item label="Chọn dịch vụ" required>
                            <Select
                              allowClear
                              showSearch
                              placeholder="Chọn một dịch vụ..."
                              value={newServiceId ?? undefined}
                              optionFilterProp="label"
                              onChange={(val) => setNewServiceId(val ?? null)}
                              options={allServices.map((s: Service) => ({
                                value: s.id,
                                label: `${s.serviceName} — ${new Intl.NumberFormat('vi-VN').format(
                                  Number(s.price || 0)
                                )}đ`,
                                description: s.description,
                              }))}
                            />
                          </Form.Item>
                          <Form.Item label="Số lượng" required>
                            <InputNumber
                              min={1}
                              style={{ width: '100%' }}
                              value={newServiceQty}
                              onChange={(v) => setNewServiceQty(Number(v || 1))}
                            />
                          </Form.Item>
                        </div>
                        {newServiceId && newServiceQty > 0 && (
                          <Alert
                            type="info"
                            showIcon
                            message={`Thành tiền tạm tính: ${new Intl.NumberFormat('vi-VN').format(
                              Number(
                                allServices.find((s) => s.id === Number(newServiceId))?.price ??
                                  0
                              ) * Number(newServiceQty)
                            )}đ. Sau khi xác nhận, hệ thống sẽ cộng vào hóa đơn và thông báo số tiền còn lại cần thanh toán.`}
                          />
                        )}
                      </Form>
                    </div>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Modal>

      <BookingDetailModal
        bookingId={viewModalVisible ? viewBookingId : null}
        open={viewModalVisible}
        onClose={() => setViewModalVisible(false)}
      />
    </main>
  );
};

export default BookingHistory;
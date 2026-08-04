import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Empty, Input, Modal, message, Radio, Rate, Select, Space, Spin, Table, Tag, Upload } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import {
  CalendarOutlined,
  CreditCardOutlined,
  EyeOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  StarOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  cancelBooking,
  getBookings,
  getRefundPreview,
  type RefundPreview,
} from '../../services/bookingService';
import { getPaymentByBookingId } from '../../services/paymentService';
import { createReview, getReviews, updateReview } from '../../services/reviewService';
import { getMyRefunds, type RefundRow } from '../../services/refundService';
import { VIETQR_BANKS } from '../../utils/vietqr';
import { useAuth } from '../../contexts/AuthContext';
import { unwrapList } from '../../utils/unwrapList';
import type { Payment } from '../../types/payment';
import api from '../../services/api';
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

const getHoldRemainingMs = (createdAt?: string) => {
  if (!createdAt) return 0;
  return Math.max(dayjs(createdAt).add(HOLD_MINUTES, 'minute').diff(dayjs()), 0);
};

const formatHoldTime = (milliseconds: number) => {
  const totalSeconds = Math.max(Math.floor(milliseconds / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const bookingStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ xác nhận', color: 'gold' },
  confirmed: { label: 'Đã xác nhận', color: 'blue' },
  checked_in: { label: 'Đang ở', color: 'green' },
  checked_out: { label: 'Đã trả phòng', color: 'default' },
  cancelled: { label: 'Đã hủy', color: 'red' },
};

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
    const holdRemainingMs = isUnpaid && !hasDeposit ? getHoldRemainingMs(record.created_at) : 0;
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
        {payment.verificationStatus === 'pending' && (
          <Tag className="history-status-tag" color="gold">Chờ đối soát chuyển khoản</Tag>
        )}
        {(payment.paymentStatus === 'unpaid' || payment.paymentStatus === 'deposit_paid') && (
          <span className={`history-hold-time ${isHoldExpired ? 'expired' : ''}`}>
            {hasDeposit
              ? 'Đã cọc, cần thanh toán phần còn lại'
              : isHoldExpired
                ? 'Hết thời gian giữ chỗ'
                : `Còn ${formatHoldTime(holdRemainingMs)}`}
          </span>
        )}
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
              {record.room_number || '-'} · {record.room_type_name || 'Chưa có loại phòng'}
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
              {Number(payment?.serviceAmount || 0) > 0 && (
                <div className="history-price-note">
                  Đã gồm {formatPrice(payment?.serviceAmount || 0)} dịch vụ
                </div>
              )}
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
          const holdRemainingMs = getHoldRemainingMs(record.created_at);
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
            <Space className="history-actions" wrap>
              <Link to={`/booking/${record.id}`}>
                <Button icon={<EyeOutlined />}>Chi tiết</Button>
              </Link>

              {canPay && (
                <Link to={`/booking/${record.id}/payment`}>
                  <Button className="history-pay-btn" type="primary" icon={<CreditCardOutlined />}>
                    Thanh toán
                  </Button>
                </Link>
              )}

              {canCancel && (
                <Button
                  danger
                  icon={<StopOutlined />}
                  loading={cancellingId === record.id}
                  onClick={() => openCancelModal(record)}
                >
                  Hủy
                </Button>
              )}

              {record.status === 'checked_out' && (
                <Space size={4} wrap>
                  <Button icon={<StarOutlined />} onClick={() => openReviewModal(record)}>
                    {existingReview ? 'Xem/Sửa đánh giá' : 'Đánh giá'}
                  </Button>
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
            <span className="booking-history-eyebrow">HotelHub</span>
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
            ? `${editingReviewId ? 'Sửa đánh giá' : 'Đánh giá'} phòng ${reviewBooking.room_number || '-'} – ${reviewBooking.room_type_name || 'Chưa xác định'}`
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
    </main>
  );
};

export default BookingHistory;
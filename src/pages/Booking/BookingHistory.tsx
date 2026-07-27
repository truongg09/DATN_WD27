import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Empty, Input, Modal, message, Radio, Rate, Select, Space, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CalendarOutlined,
  CreditCardOutlined,
  EyeOutlined,
  HomeOutlined,
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
import { createReview, getReviews } from '../../services/reviewService';
import { getMyRefunds, type RefundRow } from '../../services/refundService';
import { VIETQR_BANKS } from '../../utils/vietqr';
import { useAuth } from '../../contexts/AuthContext';
import { unwrapList } from '../../utils/unwrapList';
import type { Payment } from '../../types/payment';
import './BookingHistory.css';

interface BookingRow {
  id: number;
  room_number?: string;
  room_type_name?: string;
  check_in: string;
  check_out: string;
  total_price: number | string;
  status: string;
  created_at?: string;
}

type PaymentByBooking = Record<number, Payment | null>;

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
  paid: { label: 'Đã thanh toán', color: 'green' },
  refunded: { label: 'Đã hoàn tiền', color: 'red' },
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
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<number>>(new Set());
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
        const reviewsRes = await getReviews();
        const reviewRows = unwrapList<{ bookingId: number }>(reviewsRes);
        setReviewedBookingIds(new Set(reviewRows.map((review) => review.bookingId)));
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
      if (!/^[A-Za-z0-9]{4,30}$/.test(refundAccountNumber.replace(/\s+/g, ''))) {
        message.error('Số tài khoản không hợp lệ (4-30 ký tự chữ/số)');
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
    setReviewRating(5);
    setReviewComment('');
  };

  const handleSubmitReview = async () => {
    if (!reviewBooking) return;

    setSubmittingReview(true);
    try {
      await createReview({
        bookingId: reviewBooking.id,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      message.success('Cảm ơn bạn đã đánh giá!');
      setReviewedBookingIds((prev) => new Set(prev).add(reviewBooking.id));
      setReviewBooking(null);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể gửi đánh giá');
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
        {payment.paymentStatus === 'unpaid' && (
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
        dataIndex: 'total_price',
        key: 'total_price',
        align: 'right',
        width: 150,
        render: (price: number | string) => <strong className="history-price">{formatPrice(price)}</strong>,
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
            (!payment || payment.paymentStatus === 'unpaid') &&
            !hasDeposit &&
            holdRemainingMs <= 0 &&
            record.status !== 'cancelled';
          const canCancel = ['pending', 'confirmed'].includes(record.status);
          const canPay =
            (!payment || payment.paymentStatus === 'unpaid') &&
            !isHoldExpired &&
            record.status !== 'cancelled';

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
                <Button
                  icon={<StarOutlined />}
                  disabled={reviewedBookingIds.has(record.id)}
                  onClick={() => openReviewModal(record)}
                >
                  {reviewedBookingIds.has(record.id) ? 'Đã đánh giá' : 'Đánh giá'}
                </Button>
              )}
            </Space>
          );
        },
      },
    ],
    [cancellingId, payments, nowTick, reviewedBookingIds, refundsByBooking]
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
                      placeholder="Số tài khoản nhận tiền"
                      maxLength={30}
                      value={refundAccountNumber}
                      onChange={(e) => setRefundAccountNumber(e.target.value)}
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
                    ? `Còn ${cancelPreview.daysBeforeCheckIn} ngày trước nhận phòng (dưới 3 ngày) hoặc bạn chưa thanh toán khoản nào.`
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
            ? `Đánh giá phòng ${reviewBooking.room_number || '-'} – ${reviewBooking.room_type_name || 'Chưa xác định'}`
            : ''
        }
        okText="Gửi đánh giá"
        cancelText="Đóng"
        confirmLoading={submittingReview}
        onOk={handleSubmitReview}
        onCancel={() => !submittingReview && setReviewBooking(null)}
        destroyOnHidden
        centered
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
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
        </div>
      </Modal>
    </main>
  );
};

export default BookingHistory;

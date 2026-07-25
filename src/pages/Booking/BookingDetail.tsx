import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Spin, message, Divider, Rate, Input } from 'antd';
import { FileTextOutlined, CreditCardOutlined, StarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getBookingDetail } from '../../services/bookingService';
import { getPaymentByBookingId } from '../../services/paymentService';
import { getInvoiceByBookingId } from '../../services/invoiceService';
import { createReview, getReviews } from '../../services/reviewService';
import type { Payment } from '../../types/payment';
import type { Invoice } from '../../types/invoice';
import './BookingDetail.css';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('vi-VN').format(price) + '₫';

const formatDate = (date: string | Date) => {
  return dayjs(date).format('DD/MM/YYYY');
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

const BookingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = Number(id);
  const isValidBookingId = Number.isInteger(bookingId) && bookingId > 0;

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [existingReview, setExistingReview] = useState<{ rating: number; comment?: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const handledPaymentCallbackRef = useRef('');

  useEffect(() => {
    if (!isValidBookingId) {
      message.error('Mã đặt phòng không hợp lệ');
      navigate('/booking/history');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const bookingRes = await getBookingDetail(bookingId);
        setBooking(bookingRes.data as Record<string, unknown>);

        try {
          const paymentRes = await getPaymentByBookingId(bookingId);
          setPayment(paymentRes.data);

          if (paymentRes.data.paymentStatus === 'paid') {
            try {
              const invoiceRes = await getInvoiceByBookingId(bookingId);
              setInvoice(invoiceRes.data);
            } catch {
              setInvoice(null);
            }
          }
        } catch {
          setPayment(null);
        }
      } catch {
        message.error('Không tìm thấy đặt phòng');
        navigate('/booking/history');
      } finally {
        setLoading(false);
      }

      try {
        const reviewsRes = await getReviews();
        const rows = ((reviewsRes as { data?: { bookingId: number; rating: number; comment?: string }[] }).data) || [];
        const mine = rows.find((row) => Number(row.bookingId) === bookingId);
        setExistingReview(mine ? { rating: mine.rating, comment: mine.comment } : null);
      } catch {
        // Không chặn trang nếu tải đánh giá thất bại
      }
    };

    fetchData();
    window.scrollTo(0, 0);
  }, [bookingId, isValidBookingId, navigate]);

  useEffect(() => {
    const gateway = searchParams.get('gateway');
    const paymentResult = searchParams.get('payment');
    const callbackStatus = searchParams.get('status');
    if (!paymentResult || !payment) return;

    const callbackKey = `${gateway || ''}:${paymentResult || ''}:${callbackStatus || ''}`;
    if (handledPaymentCallbackRef.current === callbackKey) return;
    handledPaymentCallbackRef.current = callbackKey;

    const gatewayReportedSuccess = paymentResult === 'success';
    const isGatewayReturn = gatewayReportedSuccess || gateway === 'momo';
    const isSettled = payment?.paymentStatus === 'paid' || payment?.paymentStatus === 'deposit_paid';
    const callbackMatchesPayment =
      callbackStatus === 'paid'
        ? payment?.paymentStatus === 'paid'
        : callbackStatus === 'deposit_paid'
          ? payment?.paymentStatus === 'deposit_paid'
          : false;

    // Never trust a gateway query parameter alone. The success notice is shown
    // only after the backend has verified the callback and updated the payment.
    if (isGatewayReturn && isSettled && callbackMatchesPayment) {
      const isFullyPaid = payment?.paymentStatus === 'paid';
      message.success({
        content: isFullyPaid
          ? 'Thanh toán thành công! Đơn đặt phòng đã được thanh toán đầy đủ.'
          : `Đặt cọc thành công! Hệ thống đã ghi nhận khoản cọc. Số tiền còn lại: ${formatPrice(payment?.remainingAmount ?? 0)}.`,
        duration: 6,
      });
      navigate(`/booking/${bookingId}`, { replace: true });
      return;
    }

    if (gatewayReportedSuccess && callbackStatus && !callbackMatchesPayment) {
      message.warning({
        content: 'Giao dịch chưa được hệ thống ghi nhận đầy đủ. Vui lòng kiểm tra lại hoặc thử thanh toán lại.',
        duration: 7,
      });
      navigate(`/booking/${bookingId}`, { replace: true });
      return;
    }

    if (paymentResult === 'failed') {
      message.error({
        content: 'Thanh toán chưa thành công hoặc giao dịch đã bị hủy. Vui lòng thử lại.',
        duration: 6,
      });
      navigate(`/booking/${bookingId}`, { replace: true });
    }
  }, [bookingId, navigate, payment?.paymentStatus, searchParams]);

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    try {
      await createReview({
        bookingId,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      message.success('Cảm ơn bạn đã đánh giá!');
      setExistingReview({ rating: reviewRating, comment: reviewComment.trim() });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể gửi đánh giá');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="booking-detail-page loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!booking) return null;

  const status = String(booking.status);

  return (
    <div className="booking-detail-page">
      <div className="detail-hero">
        <h1>Chi tiết đặt phòng #{bookingId}</h1>
        <Tag color={bookingStatusMap[status]?.color}>
          {bookingStatusMap[status]?.label || status}
        </Tag>
      </div>

      <div className="detail-container">
        <Card title="Thông tin đặt phòng">
          <Descriptions column={{ xs: 1, sm: 2 }} bordered>
            <Descriptions.Item label="Khách hàng">{String(booking.customer_name)}</Descriptions.Item>
            <Descriptions.Item label="Email">{String(booking.customer_email)}</Descriptions.Item>
            <Descriptions.Item label="SĐT">{String(booking.customer_phone || '-')}</Descriptions.Item>
            <Descriptions.Item label="Phòng">
              {String(booking.room_number)} - {String(booking.room_type_name)}
            </Descriptions.Item>
            <Descriptions.Item label="Nhận phòng">{formatDate(String(booking.check_in))}</Descriptions.Item>
            <Descriptions.Item label="Trả phòng">{formatDate(String(booking.check_out))}</Descriptions.Item>
            <Descriptions.Item label="Người lớn">{String(booking.adults || '-')}</Descriptions.Item>
            <Descriptions.Item label="Trẻ em">{String(booking.children || 0)}</Descriptions.Item>
            <Descriptions.Item label="Tổng tiền" span={{ xs: 1, sm: 2 }}>
              <strong>{formatPrice(Number(booking.total_price))}</strong>
            </Descriptions.Item>
            {booking.notes ? (
              <Descriptions.Item label="Ghi chú" span={{ xs: 1, sm: 2 }}>
                {String(booking.notes)}
              </Descriptions.Item>
            ) : null}
          </Descriptions>
        </Card>

        {payment && (
          <Card
            title="Thanh toán"
            extra={
              ['unpaid', 'deposit_paid'].includes(payment.paymentStatus) ? (
                <Button
                  type="primary"
                  icon={<CreditCardOutlined />}
                  onClick={() => navigate(`/booking/${bookingId}/payment`)}
                >
                  Thanh toán ngay
                </Button>
              ) : null
            }
          >
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Trạng thái">
                <Tag color={paymentStatusMap[payment.paymentStatus]?.color}>
                  {paymentStatusMap[payment.paymentStatus]?.label}
                </Tag>
              </Descriptions.Item>
              {payment.verificationStatus === 'pending' && (
                <Descriptions.Item label="Đối soát chuyển khoản">
                  <Tag color="gold">Chờ khách sạn xác nhận</Tag>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Phương thức">
                {payment.paymentMethod === 'bank_transfer'
                  ? 'Chuyển khoản QR'
                  : payment.paymentMethod === 'cash'
                    ? 'Tiền mặt'
                    : payment.paymentMethod?.toUpperCase() || 'Chưa chọn'}
              </Descriptions.Item>
              <Descriptions.Item label="Tổng">{formatPrice(payment.totalAmount)}</Descriptions.Item>
              <Descriptions.Item label="Đã trả">{formatPrice(payment.paidAmount)}</Descriptions.Item>
              {payment.remainingAmount > 0 && (
                <Descriptions.Item label="Còn phải thanh toán">
                  <strong>{formatPrice(payment.remainingAmount)}</strong>
                </Descriptions.Item>
              )}
              {payment.transactionCode && (
                <Descriptions.Item label="Mã GD">
                  {payment.transactionCode}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        )}

        <Card title="Hủy phòng sát giờ nhận phòng" className="cancellation-policy-card">
          <div className="cancellation-policy">
            <div className="policy-row header-row">
              <span>Thời gian hủy</span>
              <span>Hoàn tiền</span>
            </div>
            <div className="policy-row">
              <span>{'> 7 ngày'}</span>
              <span>100%</span>
            </div>
            <div className="policy-row">
              <span>3–7 ngày</span>
              <span>50%</span>
            </div>
            <div className="policy-row">
              <span>{'< 3 ngày'}</span>
              <span>0%</span>
            </div>
          </div>
        </Card>

        {invoice && (
          <Card title="Hóa đơn" className="invoice-card">
            <div className="invoice-header">
              <FileTextOutlined className="invoice-icon" />
              <div>
                <h3>{invoice.invoiceNumber}</h3>
                <p>Ngày phát hành: {new Date(invoice.issuedAt).toLocaleDateString('vi-VN')}</p>
              </div>
              <Tag color="green">Đã phát hành</Tag>
            </div>

            <Divider />

            <div className="invoice-body">
              <div className="invoice-row">
                <span>Tiền phòng</span>
                <span>{formatPrice(invoice.roomAmount)}</span>
              </div>
              {invoice.serviceAmount > 0 && (
                <div className="invoice-row">
                  <span>Dịch vụ</span>
                  <span>{formatPrice(invoice.serviceAmount)}</span>
                </div>
              )}
              {invoice.discountAmount > 0 && (
                <div className="invoice-row">
                  <span>Giảm giá</span>
                  <span>-{formatPrice(invoice.discountAmount)}</span>
                </div>
              )}
              <div className="invoice-row total">
                <span>Tổng thanh toán</span>
                <span>{formatPrice(invoice.totalAmount)}</span>
              </div>
            </div>
          </Card>
        )}

        {status === 'checked_out' && (
          <Card
            title={
              <>
                <StarOutlined style={{ color: '#faad14', marginRight: 8 }} />
                Đánh giá kỳ nghỉ của bạn
              </>
            }
          >
            {existingReview ? (
              <div>
                <Rate disabled value={existingReview.rating} />
                {existingReview.comment && (
                  <p style={{ marginTop: 10, color: '#4b5563' }}>“{existingReview.comment}”</p>
                )}
                <Tag color="green" style={{ marginTop: 8 }}>Bạn đã đánh giá chuyến đi này</Tag>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
                <p style={{ margin: 0, color: '#6b7280' }}>
                  Chuyến đi đã hoàn thành — chia sẻ trải nghiệm để giúp khách sau lựa chọn nhé!
                </p>
                <Rate value={reviewRating} onChange={setReviewRating} />
                <Input.TextArea
                  rows={3}
                  maxLength={500}
                  showCount
                  placeholder="Cảm nhận về phòng, dịch vụ, nhân viên..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
                <Button
                  type="primary"
                  loading={submittingReview}
                  style={{ alignSelf: 'flex-start' }}
                  onClick={handleSubmitReview}
                >
                  Gửi đánh giá
                </Button>
              </div>
            )}
          </Card>
        )}

        <div className="detail-actions">
          <Link to="/booking/history">
            <Button size="large">Quay lại lịch sử</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BookingDetail;

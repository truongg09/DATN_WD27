import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card, Radio, Button, Spin, message, Descriptions, Tag, Alert } from 'antd';
import { CreditCardOutlined, WalletOutlined, DollarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getBookingDetail } from '../../services/bookingService';
import { getPaymentByBookingId, processPayment } from '../../services/paymentService';
import type { Payment, PaymentMethod } from '../../types/payment';
import './Payment.css';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('vi-VN').format(price) + '₫';

const formatDate = (date: string | Date) => {
  return dayjs(date).format('DD/MM/YYYY');
};

const HOLD_MINUTES = 15;
const HOLD_DURATION_MS = HOLD_MINUTES * 60 * 1000;

const getHoldRemainingMs = (createdAt?: unknown) => {
  if (!createdAt) return 0;
  return Math.max(dayjs(String(createdAt)).add(HOLD_MINUTES, 'minute').diff(dayjs()), 0);
};

const formatHoldTime = (milliseconds: number) => {
  const totalSeconds = Math.max(Math.floor(milliseconds / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const statusLabels: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Chưa thanh toán', color: 'orange' },
  paid: { label: 'Đã thanh toán', color: 'green' },
  refunded: { label: 'Đã hoàn tiền', color: 'red' },
};

const PaymentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bookingId = Number(id);
  const isValidBookingId = Number.isInteger(bookingId) && bookingId > 0;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentAmountMode, setPaymentAmountMode] = useState<'deposit' | 'full'>('deposit');
  const [holdRemainingMs, setHoldRemainingMs] = useState(0);
  const [roomTakenError, setRoomTakenError] = useState(false);

  useEffect(() => {
    if (!isValidBookingId) {
      message.error('Mã đặt phòng không hợp lệ');
      navigate('/booking/history');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [bookingRes, paymentRes] = await Promise.all([
          getBookingDetail(bookingId),
          getPaymentByBookingId(bookingId),
        ]);
        setBooking(bookingRes.data as Record<string, unknown>);
        setPayment(paymentRes.data);
      } catch {
        message.error('Không thể tải thông tin thanh toán');
        navigate('/booking/history');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    window.scrollTo(0, 0);
  }, [bookingId, isValidBookingId, navigate]);

  useEffect(() => {
    if (!booking || payment?.paymentStatus !== 'unpaid') {
      setHoldRemainingMs(0);
      return;
    }

    const updateRemaining = () => {
      setHoldRemainingMs(getHoldRemainingMs(booking.created_at));
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);

    return () => window.clearInterval(timer);
  }, [booking, payment?.paymentStatus]);

  const handlePay = async () => {
    if (!payment) return;

    const hasDeposit = payment.paidAmount > 0;
    const requiredDepositAmount = Math.min(Math.ceil(payment.totalAmount * 0.3), payment.remainingAmount);
    const amount =
      paymentAmountMode === 'deposit' && !hasDeposit
        ? requiredDepositAmount
        : payment.remainingAmount;

    setSubmitting(true);
    setRoomTakenError(false);
    try {
      const result = await processPayment(payment.id, { paymentMethod, amount });

      if (result.data.redirectUrl && paymentMethod !== 'cash') {
        message.info('Đang chuyển hướng đến cổng thanh toán...');
        window.open(result.data.redirectUrl, '_blank');
      }

      message.success('Thanh toán thành công!');
      navigate(`/booking/${bookingId}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const errorMessage =
        err.response?.data?.message || 'Thanh toán thất bại';
      const isRoomTaken = errorMessage.includes('Phòng vừa được đặt bởi khách khác');
      setRoomTakenError(isRoomTaken);
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="payment-page loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!booking || !payment) {
    return null;
  }

  const isPaid = payment.paymentStatus === 'paid';
  const hasDeposit = payment.paidAmount > 0;
  const requiredDepositAmount = Math.min(Math.ceil(payment.totalAmount * 0.3), payment.remainingAmount);
  const paymentAmount =
    paymentAmountMode === 'deposit' && !hasDeposit
      ? requiredDepositAmount
      : payment.remainingAmount;
  const isHoldExpired = payment.paymentStatus === 'unpaid' && !hasDeposit && holdRemainingMs <= 0;
  const holdPercent = Math.max(Math.min((holdRemainingMs / HOLD_DURATION_MS) * 100, 100), 0);

  return (
    <div className="payment-page">
      <div className="payment-hero">
        <h1>Thanh toán đặt phòng</h1>
        <p>Hoàn tất thanh toán để xác nhận đặt phòng #{bookingId}</p>
      </div>

      <div className="payment-container">
        {roomTakenError && (
          <Alert
            type="error"
            showIcon
            message="Phòng vừa được đặt bởi khách khác"
            description="Khách hàng khác đã thanh toán trước. Vui lòng chọn phòng khác để tiếp tục đặt."
            action={
              <Button size="small" type="primary" onClick={() => navigate('/booking')}>
                Đặt phòng khác
              </Button>
            }
          />
        )}
        {!isPaid && !hasDeposit && (
          <Card className={`payment-card hold-countdown-card ${isHoldExpired ? 'expired' : ''}`}>
            <div className="hold-countdown-top">
              <div>
                <span className="hold-label">Thời gian giữ phòng</span>
                <strong>{isHoldExpired ? 'Đã hết thời gian giữ chỗ' : formatHoldTime(holdRemainingMs)}</strong>
              </div>
              <Tag color={isHoldExpired ? 'red' : 'orange'}>
                {isHoldExpired ? 'Cần đặt lại' : `Giữ tạm ${HOLD_MINUTES} phút`}
              </Tag>
            </div>
            <div className="hold-progress">
              <span style={{ width: `${holdPercent}%` }} />
            </div>
            <p>
              {isHoldExpired
                ? 'Phiên giữ phòng đã hết hạn. Bạn vui lòng đặt lại để kiểm tra phòng trống mới nhất.'
                : 'Phòng đang được giữ tạm cho bạn. Hoàn tất thanh toán trước khi hết giờ để xác nhận đặt phòng.'}
            </p>
          </Card>
        )}
        {!isPaid && hasDeposit && (
          <Card className="payment-card hold-countdown-card deposit-secured">
            <div className="hold-countdown-top">
              <div>
                <span className="hold-label">Đã thanh toán cọc</span>
                <strong>Phòng đã được giữ</strong>
              </div>
              <Tag color="green">Còn lại {formatPrice(payment.remainingAmount)}</Tag>
            </div>
            <p>
              Bạn đã đặt cọc thành công. Vui lòng thanh toán số tiền còn lại trước khi check-in.
            </p>
          </Card>
        )}
        <Card title="Thông tin đặt phòng" className="payment-card">
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Phòng">
              {String(booking.room_number)} - {String(booking.room_type_name)}
            </Descriptions.Item>
            <Descriptions.Item label="Khách hàng">{String(booking.customer_name)}</Descriptions.Item>
            <Descriptions.Item label="Nhận phòng">{formatDate(String(booking.check_in))}</Descriptions.Item>
            <Descriptions.Item label="Trả phòng">{formatDate(String(booking.check_out))}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái thanh toán">
              <Tag color={statusLabels[payment.paymentStatus]?.color}>
                {statusLabels[payment.paymentStatus]?.label}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="Chi tiết thanh toán" className="payment-card">
          <div className="payment-summary">
            <div className="payment-row">
              <span>Tiền phòng</span>
              <span>{formatPrice(payment.roomAmount)}</span>
            </div>
            {payment.serviceAmount > 0 && (
              <div className="payment-row">
                <span>Dịch vụ</span>
                <span>{formatPrice(payment.serviceAmount)}</span>
              </div>
            )}
            {payment.discountAmount > 0 && (
              <div className="payment-row discount">
                <span>Giảm giá</span>
                <span>-{formatPrice(payment.discountAmount)}</span>
              </div>
            )}
            <div className="payment-row total">
              <span>Tổng cộng</span>
              <span>{formatPrice(payment.totalAmount)}</span>
            </div>
            {payment.paidAmount > 0 && (
              <div className="payment-row">
                <span>Đã thanh toán</span>
                <span>{formatPrice(payment.paidAmount)}</span>
              </div>
            )}
            {!isPaid && (
              <div className="payment-row remaining">
                <span>Còn lại</span>
                <span>{formatPrice(payment.remainingAmount)}</span>
              </div>
            )}
          </div>
        </Card>

        {!isPaid ? (
          <Card title="Phương thức thanh toán" className="payment-card">
            {!hasDeposit && (
              <div className="payment-amount-options">
                <Radio.Group
                  value={paymentAmountMode}
                  onChange={(e) => setPaymentAmountMode(e.target.value)}
                >
                  <Radio.Button value="deposit">
                    Cọc 30% ({formatPrice(requiredDepositAmount)})
                  </Radio.Button>
                  <Radio.Button value="full">
                    Thanh toán toàn bộ ({formatPrice(payment.remainingAmount)})
                  </Radio.Button>
                </Radio.Group>
                <Alert
                  style={{ marginTop: 12 }}
                  type="warning"
                  showIcon
                  message="Quy tắc cọc"
                  description="Sau khi thanh toán cọc, phòng được giữ cho bạn. Phần còn lại cần thanh toán trước khi check-in."
                />
              </div>
            )}

            <Radio.Group
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="payment-methods"
            >
              <Radio.Button value="cash">
                <DollarOutlined /> Tiền mặt
              </Radio.Button>
              <Radio.Button value="momo">
                <WalletOutlined /> MoMo
              </Radio.Button>
              <Radio.Button value="vnpay">
                <CreditCardOutlined /> VNPay
              </Radio.Button>
            </Radio.Group>

            {paymentMethod !== 'cash' && (
              <Alert
                style={{ marginTop: 16 }}
                type="info"
                showIcon
                message="Bạn sẽ được chuyển đến cổng thanh toán để hoàn tất giao dịch."
              />
            )}

            <div className="payment-actions">
              <Button
                type="primary"
                size="large"
                loading={submitting}
                disabled={isHoldExpired}
                onClick={handlePay}
              >
                Thanh toán {formatPrice(paymentAmount)}
              </Button>
              <Link to={`/booking/${bookingId}`}>
                <Button size="large">Xem chi tiết đặt phòng</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <Card className="payment-card">
            <Alert
              type="success"
              showIcon
              message="Đã thanh toán thành công"
              description={
                payment.transactionCode
                  ? `Mã giao dịch: ${payment.transactionCode}`
                  : undefined
              }
            />
            <div className="payment-actions">
              <Button type="primary" size="large" onClick={() => navigate(`/booking/${bookingId}`)}>
                Xem hóa đơn & chi tiết
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PaymentPage;

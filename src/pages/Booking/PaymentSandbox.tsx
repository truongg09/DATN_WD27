import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Spin, message, Descriptions, Alert } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ArrowLeftOutlined, QrcodeOutlined, SafetyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getBookingDetail } from '../../services/bookingService';
import { getPaymentByBookingId, confirmPayment } from '../../services/paymentService';
import type { Payment } from '../../types/payment';
import './PaymentSandbox.css';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('vi-VN').format(price) + '₫';

const formatDate = (date: string | Date) => {
  return dayjs(date).format('DD/MM/YYYY');
};

const PaymentSandbox: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = Number(id);
  const isValidBookingId = Number.isInteger(bookingId) && bookingId > 0;

  const method = searchParams.get('method') || 'vnpay';
  const amountStr = searchParams.get('amount') || '0';
  const txn = searchParams.get('txn') || '';
  const amount = Number(amountStr);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [countdown, setCountdown] = useState(0);

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
        const bookingData = bookingRes.data as Record<string, unknown>;
        setBooking(bookingData);
        setPayment(paymentRes.data);
        const expiresAt = dayjs(String(bookingData.hold_expires_at));
        const serverNow = dayjs(String(bookingData.server_now));
        setCountdown(expiresAt.isValid() && serverNow.isValid()
          ? Math.max(expiresAt.diff(serverNow, 'second'), 0)
          : 0);
      } catch {
        message.error('Không thể tải thông tin thanh toán');
        navigate('/booking/history');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [bookingId, isValidBookingId, navigate]);

  useEffect(() => {
    if (loading || !booking) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          message.error('Giao dịch đã hết hạn thanh toán!');
          navigate(`/booking/${bookingId}/payment`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, booking, bookingId, navigate]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleConfirm = async () => {
    if (!payment) return;
    setSubmitting(true);
    try {
      const response = await confirmPayment(payment.id, {
        amount,
        transactionCode: txn,
        gatewayOrderId: txn,
      });
      const status = response.data.payment.paymentStatus;
      navigate(
        `/booking/${bookingId}?gateway=${method.toLowerCase()}&payment=success&status=${encodeURIComponent(status)}`
      );
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể xác nhận thanh toán');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    message.warning('Giao dịch thanh toán đã bị hủy.');
    navigate(`/booking/${bookingId}/payment`);
  };

  if (loading) {
    return (
      <div className="sandbox-loading">
        <Spin size="large" tip="Đang tải cổng thanh toán..." />
      </div>
    );
  }

  if (!booking || !payment) {
    return null;
  }

  const isZalopay = method.toLowerCase() === 'zalopay';
  const themeClass = isZalopay ? 'zalopay-theme' : 'vnpay-theme';
  const qrData = isZalopay
    ? `zalopay://pay?txn=${txn}&amount=${amount}`
    : `vnpay://payment?txn=${txn}&amount=${amount}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

  return (
    <div className={`sandbox-container ${themeClass}`}>
      <div className="sandbox-wrapper">
        <div className="sandbox-header">
          <div className="gateway-logo">
            {isZalopay ? (
              <span className="logo-text zalopay">ZaloPay</span>
            ) : (
              <span className="logo-text vnpay">VNPAY<span className="qr-tag">QR</span></span>
            )}
          </div>
          <div className="sandbox-badge">Môi trường thử nghiệm</div>
        </div>

        <div className="sandbox-body">
          <div className="sandbox-sidebar">
            <Card title="Thông tin giao dịch" bordered={false} className="info-card">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Đơn vị chấp nhận">HotelHub Booking</Descriptions.Item>
                <Descriptions.Item label="Mã đặt phòng">#{bookingId}</Descriptions.Item>
                <Descriptions.Item label="Hạng phòng">
                  {String(booking.room_type_name || 'Đặt phòng')}
                </Descriptions.Item>
                <Descriptions.Item label="Khách hàng">{String(booking.customer_name)}</Descriptions.Item>
                <Descriptions.Item label="Thời gian nhận">{formatDate(String(booking.check_in))}</Descriptions.Item>
                <Descriptions.Item label="Thời gian trả">{formatDate(String(booking.check_out))}</Descriptions.Item>
                <Descriptions.Item label="Mã giao dịch">
                  <span className="txn-code">{txn}</span>
                </Descriptions.Item>
                <Descriptions.Item label="Số tiền thanh toán">
                  <strong className="payment-amount">{formatPrice(amount)}</strong>
                </Descriptions.Item>
              </Descriptions>
              <div className="secure-badge">
                <SafetyOutlined /> Kết nối SSL 256-bit bảo mật
              </div>
            </Card>
          </div>

          <div className="sandbox-qr-section">
            <Card className="qr-card" bordered={false}>
              <div className="timer-wrapper">
                Thanh toán hết hạn sau: <span className="timer">{formatCountdown(countdown)}</span>
              </div>

              <div className="qr-box">
                <div className="qr-border">
                  <img src={qrUrl} alt="Payment QR Code" className="qr-image" />
                  <div className="qr-scanner-line" />
                </div>
                <p className="qr-instruction">
                  <QrcodeOutlined /> Quét mã để thanh toán bằng ứng dụng {isZalopay ? 'ZaloPay' : 'Ngân hàng / Ví VNPAY'}
                </p>
              </div>

              <Alert
                message="Đây là trang thanh toán giả lập dành cho môi trường thử nghiệm (Sandbox)."
                description="Bạn không cần chuyển tiền thật. Hãy bấm nút 'Xác nhận đã thanh toán' phía dưới để mô phỏng giao dịch thành công."
                type="info"
                showIcon
                className="sandbox-alert"
              />

              <div className="sandbox-actions">
                <Button
                  type="primary"
                  size="large"
                  icon={<CheckCircleOutlined />}
                  loading={submitting}
                  onClick={handleConfirm}
                  className="btn-confirm"
                >
                  Xác nhận đã thanh toán
                </Button>
                <Button
                  size="large"
                  icon={<CloseCircleOutlined />}
                  disabled={submitting}
                  onClick={handleCancel}
                  className="btn-cancel"
                >
                  Hủy giao dịch
                </Button>
              </div>
            </Card>
          </div>
        </div>

        <div className="sandbox-footer">
          <p>© 2026 HotelHub & {isZalopay ? 'Ví điện tử ZaloPay' : 'Cổng thanh toán VNPAY'}. Tất cả quyền được bảo lưu.</p>
          <div className="sandbox-back-link">
            <Button type="link" icon={<ArrowLeftOutlined />} onClick={handleCancel}>
              Quay lại trang chọn phương thức
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSandbox;

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card, Radio, Button, Spin, message, Descriptions, Tag, Alert } from 'antd';
import { CreditCardOutlined, WalletOutlined, DollarOutlined } from '@ant-design/icons';
import { getBookingDetail } from '../../services/bookingService';
import { getPaymentByBookingId, processPayment } from '../../services/paymentService';
import type { Payment, PaymentMethod } from '../../types/payment';
import './Payment.css';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('vi-VN').format(price) + '₫';

const statusLabels: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Chưa thanh toán', color: 'orange' },
  paid: { label: 'Đã thanh toán', color: 'green' },
  refunded: { label: 'Đã hoàn tiền', color: 'red' },
};

const PaymentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bookingId = Number(id);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  useEffect(() => {
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

    if (bookingId) {
      fetchData();
    }
  }, [bookingId, navigate]);

  const handlePay = async () => {
    if (!payment) return;

    setSubmitting(true);
    try {
      const result = await processPayment(payment.id, { paymentMethod });

      if (result.data.redirectUrl && paymentMethod !== 'cash') {
        message.info('Đang chuyển hướng đến cổng thanh toán...');
        window.open(result.data.redirectUrl, '_blank');
      }

      message.success('Thanh toán thành công!');
      navigate(`/booking/${bookingId}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Thanh toán thất bại');
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

  return (
    <div className="payment-page">
      <div className="payment-hero">
        <h1>Thanh toán đặt phòng</h1>
        <p>Hoàn tất thanh toán để xác nhận đặt phòng #{bookingId}</p>
      </div>

      <div className="payment-container">
        <Card title="Thông tin đặt phòng" className="payment-card">
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Phòng">
              {String(booking.room_number)} - {String(booking.room_type_name)}
            </Descriptions.Item>
            <Descriptions.Item label="Khách hàng">{String(booking.customer_name)}</Descriptions.Item>
            <Descriptions.Item label="Nhận phòng">{String(booking.check_in)}</Descriptions.Item>
            <Descriptions.Item label="Trả phòng">{String(booking.check_out)}</Descriptions.Item>
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
              <Button type="primary" size="large" loading={submitting} onClick={handlePay}>
                Thanh toán {formatPrice(payment.remainingAmount)}
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

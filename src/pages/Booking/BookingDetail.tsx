import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Spin, message, Divider } from 'antd';
import { FileTextOutlined, CreditCardOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getBookingDetail } from '../../services/bookingService';
import { getPaymentByBookingId } from '../../services/paymentService';
import { getInvoiceByBookingId } from '../../services/invoiceService';
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
  paid: { label: 'Đã thanh toán', color: 'green' },
  refunded: { label: 'Đã hoàn tiền', color: 'red' },
};

const BookingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bookingId = Number(id);
  const isValidBookingId = Number.isInteger(bookingId) && bookingId > 0;

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

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
    };

    fetchData();
    window.scrollTo(0, 0);
  }, [bookingId, isValidBookingId, navigate]);

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
            <Descriptions.Item label="Tổng tiền" span={2}>
              <strong>{formatPrice(Number(booking.total_price))}</strong>
            </Descriptions.Item>
            {booking.notes ? (
              <Descriptions.Item label="Ghi chú" span={2}>
                {String(booking.notes)}
              </Descriptions.Item>
            ) : null}
          </Descriptions>
        </Card>

        {payment && (
          <Card
            title="Thanh toán"
            extra={
              payment.paymentStatus === 'unpaid' ? (
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
            <Descriptions column={{ xs: 1, sm: 2 }} bordered>
              <Descriptions.Item label="Trạng thái">
                <Tag color={paymentStatusMap[payment.paymentStatus]?.color}>
                  {paymentStatusMap[payment.paymentStatus]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Phương thức">
                {payment.paymentMethod?.toUpperCase() || 'Chưa chọn'}
              </Descriptions.Item>
              <Descriptions.Item label="Tổng">{formatPrice(payment.totalAmount)}</Descriptions.Item>
              <Descriptions.Item label="Đã trả">{formatPrice(payment.paidAmount)}</Descriptions.Item>
              {payment.transactionCode && (
                <Descriptions.Item label="Mã GD" span={2}>
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

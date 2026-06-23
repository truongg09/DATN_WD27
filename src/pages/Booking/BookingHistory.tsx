import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Table, Tag, Button, Card, message, Space } from 'antd';
import { EyeOutlined, CreditCardOutlined } from '@ant-design/icons';
import { getBookings } from '../../services/bookingService';
import { getPayments } from '../../services/paymentService';
import { useAuth } from '../../contexts/AuthContext';
import { unwrapList } from '../../utils/unwrapList';
import type { Payment } from '../../types/payment';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('vi-VN').format(price) + '₫';

interface BookingRow {
  id: number;
  room_number: string;
  room_type_name: string;
  check_in: string;
  check_out: string;
  total_price: number;
  status: string;
  customer_name: string;
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ xác nhận', color: 'gold' },
  confirmed: { label: 'Đã xác nhận', color: 'blue' },
  checkin: { label: 'Đang ở', color: 'green' },
  checkout: { label: 'Đã trả phòng', color: 'default' },
  checked_in: { label: 'Đang ở', color: 'green' },
  checked_out: { label: 'Đã trả phòng', color: 'default' },
  cancelled: { label: 'Đã hủy', color: 'red' },
};

const paymentStatusMap: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Chưa TT', color: 'orange' },
  paid: { label: 'Đã TT', color: 'green' },
  refunded: { label: 'Hoàn tiền', color: 'red' },
};

const BookingHistory: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      message.warning('Vui lòng đăng nhập để xem lịch sử đặt phòng');
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [bookingsRes, paymentsRes] = await Promise.all([
          getBookings(user ? { userId: user.id } : undefined),
          getPayments(),
        ]);

        setBookings(unwrapList<BookingRow>(bookingsRes));
        setPayments(unwrapList<Payment>(paymentsRes));
      } catch {
        message.error('Không thể tải lịch sử đặt phòng');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, navigate, user]);

  const getPaymentForBooking = (bookingId: number) =>
    payments.find((p) => p.bookingId === bookingId);

  const columns = [
    {
      title: 'Mã',
      dataIndex: 'id',
      key: 'id',
      width: 70,
    },
    {
      title: 'Phòng',
      key: 'room',
      render: (_: unknown, record: BookingRow) =>
        `${record.room_number} - ${record.room_type_name}`,
    },
    {
      title: 'Nhận / Trả phòng',
      key: 'dates',
      render: (_: unknown, record: BookingRow) =>
        `${record.check_in} → ${record.check_out}`,
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'total_price',
      key: 'total_price',
      render: (price: number) => formatPrice(Number(price)),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusMap[status]?.color}>{statusMap[status]?.label || status}</Tag>
      ),
    },
    {
      title: 'Thanh toán',
      key: 'payment',
      render: (_: unknown, record: BookingRow) => {
        const payment = getPaymentForBooking(record.id);
        if (!payment) return <Tag>Không có</Tag>;
        return (
          <Tag color={paymentStatusMap[payment.paymentStatus]?.color}>
            {paymentStatusMap[payment.paymentStatus]?.label}
          </Tag>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: unknown, record: BookingRow) => {
        const payment = getPaymentForBooking(record.id);
        return (
          <Space>
            <Link to={`/booking/${record.id}`}>
              <Button size="small" icon={<EyeOutlined />}>
                Chi tiết
              </Button>
            </Link>
            {payment?.paymentStatus === 'unpaid' && (
              <Link to={`/booking/${record.id}/payment`}>
                <Button size="small" type="primary" icon={<CreditCardOutlined />}>
                  Thanh toán
                </Button>
              </Link>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <Card title="Lịch sử đặt phòng">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={bookings}
          childrenColumnName="_rowChildren"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'Chưa có đặt phòng nào' }}
        />
      </Card>
    </div>
  );
};

export default BookingHistory;

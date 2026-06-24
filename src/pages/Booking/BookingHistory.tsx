import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Empty, message, Popconfirm, Space, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CalendarOutlined,
  CreditCardOutlined,
  EyeOutlined,
  HomeOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { cancelBooking, getBookings } from '../../services/bookingService';
import { getPaymentByBookingId } from '../../services/paymentService';
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
  no_show: { label: 'Không đến (No-show)', color: 'volcano' },
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

  const handleCancel = async (bookingId: number) => {
    setCancellingId(bookingId);
    try {
      await cancelBooking(bookingId);
      message.success('Đã hủy đặt phòng');
      await loadHistory();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể hủy đặt phòng này');
    } finally {
      setCancellingId(null);
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
                <Popconfirm
                  title="Hủy đặt phòng?"
                  description="Bạn có chắc muốn hủy đặt phòng này không?"
                  okText="Hủy phòng"
                  cancelText="Đóng"
                  onConfirm={() => handleCancel(record.id)}
                >
                  <Button danger icon={<StopOutlined />} loading={cancellingId === record.id}>
                    Hủy
                  </Button>
                </Popconfirm>
              )}
            </Space>
          );
        },
      },
    ],
    [cancellingId, payments, nowTick]
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
    </main>
  );
};

export default BookingHistory;

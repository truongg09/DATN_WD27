import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Breadcrumb, Button, Card, Skeleton, Space, Tag } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../services/api';

// Trạng thái đơn dùng chung cho cả trang.
export const bookingStatusText: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  checked_in: 'Đang lưu trú',
  checked_out: 'Đã trả phòng',
  cancelled: 'Đã hủy',
  no_show: 'Khách không đến',
};

export const bookingStatusColor: Record<string, string> = {
  pending: 'orange',
  confirmed: 'blue',
  checked_in: 'green',
  checked_out: 'default',
  cancelled: 'red',
  no_show: 'volcano',
};

export interface BookingDetailData {
  id: number;
  booking_code?: string | null;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  check_in: string | null;
  check_out: string | null;
  adults: number | null;
  children: number | null;
  room_number: string | null;
  room_type_name: string | null;
  room_capacity?: number | null;
  room_floor?: number | null;
  room_area?: string | number | null;
  room_price?: string | number | null;
  room_quantity?: number | null;
  room_total_price?: string | number | null;
  occupancy_surcharge?: string | number | null;
  payable_total?: string | number | null;
  notes?: string | null;
  cancellation_reason?: string | null;
  created_at?: string | null;
  actual_check_in_time?: string | null;
  actual_check_out_time?: string | null;
  services?: Record<string, unknown>[];
  damages?: Record<string, unknown>[];
  guests?: Record<string, unknown>[];
  transfers?: Record<string, unknown>[];
  payments?: Record<string, unknown>[];
  payment?: Record<string, unknown> | null;
  booking_rooms?: Record<string, unknown>[];
  history?: Record<string, unknown>[];
}

/**
 * Trang chi tiết đặt phòng dành cho quản trị/lễ tân.
 * Tách hẳn thành trang riêng thay vì popup để chứa đủ thông tin và cho phép
 * thao tác trực tiếp: dịch vụ, phát sinh, hư hỏng, nhận phòng, trả phòng.
 */
function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bookingId = Number(id);

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBooking = useCallback(
    async (silent = false) => {
      if (!Number.isInteger(bookingId) || bookingId <= 0) {
        setError('Mã đặt phòng không hợp lệ');
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const response = await api.get(`/bookings/${bookingId}`);
        setBooking((response as unknown as { data: BookingDetailData }).data);
        setError(null);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
        if (!silent) {
          setError(msg || 'Không tải được chi tiết đặt phòng');
          setBooking(null);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [bookingId]
  );

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          showIcon
          message="Không mở được đặt phòng"
          description={error || 'Đặt phòng không tồn tại hoặc đã bị xóa.'}
          action={
            <Button onClick={() => navigate('/admin/bookings')}>Về danh sách đặt phòng</Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          { title: <a onClick={() => navigate('/admin')}>Trang quản trị</a> },
          { title: <a onClick={() => navigate('/admin/bookings')}>Đặt phòng</a> },
          { title: `Đơn #${booking.id}` },
        ]}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Space align="center" wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/bookings')}>
            Quay lại
          </Button>
          <h2 style={{ margin: 0 }}>
            Đơn đặt phòng #{booking.id}
            {booking.booking_code ? ` — ${booking.booking_code}` : ''}
          </h2>
          <Tag color={bookingStatusColor[booking.status] || 'default'}>
            {bookingStatusText[booking.status] || booking.status}
          </Tag>
        </Space>

        <Button icon={<ReloadOutlined />} onClick={() => loadBooking()}>
          Làm mới
        </Button>
      </div>

      <Card>
        <p style={{ margin: 0, color: '#888' }}>
          Khách: {booking.customer_name || '—'} · Phòng {booking.room_number || '—'}
        </p>
      </Card>
    </div>
  );
}

export default BookingDetailPage;

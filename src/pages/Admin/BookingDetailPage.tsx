import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Breadcrumb, Button, Card, Col, Descriptions, Row, Skeleton, Space, Tag } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';

const money = (value?: string | number | null) =>
  new Intl.NumberFormat('vi-VN').format(Number(value || 0)) + '₫';

const day = (value?: string | null) => {
  if (!value) return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('DD/MM/YYYY') : '—';
};

const dateTime = (value?: string | null) => {
  if (!value) return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('HH:mm — DD/MM/YYYY') : '—';
};

// Số đêm lưu trú tính theo ngày, không phụ thuộc giờ nhận/trả cụ thể.
const countNights = (checkIn?: string | null, checkOut?: string | null) => {
  if (!checkIn || !checkOut) return 0;
  const from = dayjs(checkIn).startOf('day');
  const to = dayjs(checkOut).startOf('day');
  return Math.max(to.diff(from, 'day'), 0);
};

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

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Thông tin đặt phòng" size="small">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Mã đơn">
                #{booking.id}
                {booking.booking_code ? ` (${booking.booking_code})` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={bookingStatusColor[booking.status] || 'default'}>
                  {bookingStatusText[booking.status] || booking.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Thời điểm đặt">{dateTime(booking.created_at)}</Descriptions.Item>
              <Descriptions.Item label="Ghi chú của khách">{booking.notes || '—'}</Descriptions.Item>
              {booking.cancellation_reason && (
                <Descriptions.Item label="Lý do hủy">{booking.cancellation_reason}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Khách hàng" size="small">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Họ tên">{booking.customer_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">{booking.customer_phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{booking.customer_email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Số khách">
                {booking.adults ?? 0} người lớn, {booking.children ?? 0} trẻ em
              </Descriptions.Item>
              <Descriptions.Item label="Khách lưu trú đã khai">
                {(booking.guests?.length || 0) > 0
                  ? `${booking.guests?.length} người`
                  : 'Chưa khai báo'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Thời gian lưu trú" size="small">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Ngày nhận phòng">{day(booking.check_in)}</Descriptions.Item>
              <Descriptions.Item label="Ngày trả phòng">{day(booking.check_out)}</Descriptions.Item>
              <Descriptions.Item label="Số đêm">
                <strong>{countNights(booking.check_in, booking.check_out)} đêm</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Giờ nhận thực tế">
                {dateTime(booking.actual_check_in_time)}
              </Descriptions.Item>
              <Descriptions.Item label="Giờ trả thực tế">
                {dateTime(booking.actual_check_out_time)}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Phòng và sức chứa" size="small">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Phòng">
                {booking.room_number || '—'}
                {(booking.room_quantity || 1) > 1 && ` (${booking.room_quantity} phòng)`}
              </Descriptions.Item>
              <Descriptions.Item label="Hạng phòng">{booking.room_type_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Tầng / Diện tích">
                {booking.room_floor ?? '—'} / {booking.room_area ? `${booking.room_area}m²` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Sức chứa">
                {booking.room_capacity ? `${booking.room_capacity} khách/phòng` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Giá phòng mỗi đêm">{money(booking.room_price)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default BookingDetailPage;

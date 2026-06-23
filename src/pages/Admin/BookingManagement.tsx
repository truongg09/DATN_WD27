import React, { useEffect, useState } from 'react';
import { Button, message, Tag, Space, Modal, Descriptions } from 'antd';
import {
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  LogoutOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import api from '../../services/api';
import dayjs from 'dayjs';

interface Booking {
  id: number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  room_number: string | null;
  room_type_name: string | null;
  check_in: string | null;
  check_out: string | null;
  status: string;
  total_price: string | number | null;
  adults: number | null;
  children: number | null;
  notes?: string | null;
  created_at: string | null;
}

function BookingManagement() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const normalizeStatus = (status: string | null): string => {
    const s = (status || '').toLowerCase();

    if (['checkout', 'check_out', 'checkedout'].includes(s)) return 'checked_out';
    if (['checkin', 'check_in', 'checkedin'].includes(s)) return 'checked_in';

    return s || 'pending';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const d = dayjs(dateStr);
    return d.isValid() ? d.format('DD/MM/YYYY') : 'N/A';
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const d = dayjs(dateStr);
    return d.isValid() ? d.format('DD/MM/YYYY HH:mm') : 'N/A';
  };

  const formatPrice = (price: string | number | null) => {
    if (price === null || price === undefined) return 'N/A';

    const numPrice =
      typeof price === 'number' ? price : parseFloat(price || '0') || 0;

    return new Intl.NumberFormat('vi-VN').format(numPrice) + ' VNĐ';
  };

  const fetchBookings = async () => {
    setLoading(true);

    try {
      const response = await api.get('/bookings');

      const rawData = response.data;

      const data: any[] = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.data)
          ? rawData.data
          : Array.isArray(rawData?.bookings)
            ? rawData.bookings
            : [];

      const normalized: Booking[] = data
        .map((b: any) => ({
          ...b,
          status: normalizeStatus(b.status),
          adults: b.adults ?? 0,
          children: b.children ?? 0,
        }))
        .filter((b: Booking) => b.check_in && b.check_out);

      setBookings(normalized);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      message.error('Lỗi khi tải danh sách đặt phòng');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'orange';
      case 'confirmed':
        return 'blue';
      case 'checked_in':
        return 'green';
      case 'checked_out':
        return 'gray';
      case 'cancelled':
        return 'red';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Chờ xác nhận';
      case 'confirmed':
        return 'Đã xác nhận';
      case 'checked_in':
        return 'Đã check-in';
      case 'checked_out':
        return 'Đã check-out';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return status || 'N/A';
    }
  };

  const handleCancel = async (id: number) => {
    Modal.confirm({
      title: 'Xác nhận hủy đặt phòng',
      content: 'Bạn có chắc muốn hủy đặt phòng này?',
      okText: 'Hủy đặt phòng',
      cancelText: 'Đóng',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.patch(`/bookings/${id}/cancel`);
          message.success('Hủy đặt phòng thành công');
          fetchBookings();
        } catch (error: any) {
          console.error('Error cancelling booking:', error);
          message.error(error.response?.data?.message || 'Lỗi khi hủy đặt phòng');
        }
      },
    });
  };

  const handleCheckIn = async (id: number) => {
    try {
      await api.patch(`/bookings/${id}/check-in`);
      message.success('Check-in thành công');
      fetchBookings();
    } catch (error: any) {
      console.error('Error checking in:', error);
      message.error(error.response?.data?.message || 'Lỗi khi check-in');
    }
  };

  const handleCheckOut = async (id: number) => {
    try {
      await api.patch(`/bookings/${id}/check-out`);
      message.success('Check-out thành công');
      fetchBookings();
    } catch (error: any) {
      console.error('Error checking out:', error);
      message.error(error.response?.data?.message || 'Lỗi khi check-out');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
          }}>
          <h2 style={{ margin: 0 }}>Quản Lý Đặt Phòng</h2>

          <Button icon={<ReloadOutlined />} onClick={fetchBookings} loading={loading}>
            Làm mới
          </Button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: '#fff',
            }}
          >
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={thStyle}>Mã</th>
                <th style={thStyle}>Khách hàng</th>
                <th style={thStyle}>Phòng</th>
                <th style={thStyle}>Thời gian</th>
                <th style={thStyle}>Số khách</th>
                <th style={thStyle}>Tổng tiền</th>
                <th style={thStyle}>Trạng thái</th>
                <th style={thStyle}>Hành động</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={emptyStyle}>
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={8} style={emptyStyle}>
                    Không có dữ liệu đặt phòng
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td style={tdStyle}>{booking.id}</td>

                    <td style={tdStyle}>
                      <strong>{booking.customer_name || 'N/A'}</strong>
                      {/* <div style={smallText}>{booking.customer_email || ''}</div> */}
                      <div style={smallText}>{booking.customer_phone || ''}</div>
                    </td>

                    <td style={tdStyle}>
                      <strong>
                        {booking.room_number
                          ? `Phòng ${booking.room_number}`
                          : 'N/A'}
                      </strong>
                      <div style={smallText}>{booking.room_type_name || ''}</div>
                    </td>

                    <td style={tdStyle}>
                      <div>Nhận: {formatDate(booking.check_in)}</div>
                      <div>Trả: {formatDate(booking.check_out)}</div>
                    </td>

                    <td style={tdStyle}>
                      {booking.adults ?? 0} người lớn, {booking.children ?? 0} trẻ em
                    </td>

                    <td style={tdStyle}>{formatPrice(booking.total_price)}</td>

                    <td style={tdStyle}>
                      <Tag color={getStatusColor(booking.status)}>
                        {getStatusText(booking.status)}
                      </Tag>
                    </td>

                    <td style={tdStyle}>
                      <Space size="small" wrap>
                        <Button
                          icon={<EyeOutlined />}
                          size="small"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setViewModalVisible(true);
                          }}
                        >
                          Xem
                        </Button>

                        {(booking.status === 'pending' ||
                          booking.status === 'confirmed') && (
                          <Button
                            icon={<CloseOutlined />}
                            size="small"
                            danger
                            onClick={() => handleCancel(booking.id)}
                          >
                            Hủy
                          </Button>
                        )}

                        {(booking.status === 'pending' ||
                          booking.status === 'confirmed') && (
                          <Button
                            icon={<CheckOutlined />}
                            size="small"
                            type="primary"
                            onClick={() => handleCheckIn(booking.id)}
                          >
                            Check-in
                          </Button>
                        )}

                        {booking.status === 'checked_in' && (
                          <Button
                            icon={<LogoutOutlined />}
                            size="small"
                            type="primary"
                            onClick={() => handleCheckOut(booking.id)}
                          >
                            Check-out
                          </Button>
                        )}
                      </Space>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        title="Chi Tiết Đặt Phòng"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            Đóng
          </Button>,
        ]}
      >
        {selectedBooking && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Mã Đặt Phòng">
              {selectedBooking.id}
            </Descriptions.Item>

            <Descriptions.Item label="Tên Khách Hàng">
              {selectedBooking.customer_name || 'N/A'}
            </Descriptions.Item>

            <Descriptions.Item label="Email">
              {selectedBooking.customer_email || 'N/A'}
            </Descriptions.Item>

            <Descriptions.Item label="Số Điện Thoại">
              {selectedBooking.customer_phone || 'N/A'}
            </Descriptions.Item>

            <Descriptions.Item label="Phòng">
              {selectedBooking.room_number
                ? `${selectedBooking.room_number} - ${
                    selectedBooking.room_type_name || 'N/A'
                  }`
                : 'N/A'}
            </Descriptions.Item>

            <Descriptions.Item label="Ngày Check-in">
              {formatDate(selectedBooking.check_in)}
            </Descriptions.Item>

            <Descriptions.Item label="Ngày Check-out">
              {formatDate(selectedBooking.check_out)}
            </Descriptions.Item>

            <Descriptions.Item label="Số Khách">
              {selectedBooking.adults ?? 0} người lớn,{' '}
              {selectedBooking.children ?? 0} trẻ em
            </Descriptions.Item>

            <Descriptions.Item label="Tổng Tiền">
              {formatPrice(selectedBooking.total_price)}
            </Descriptions.Item>

            <Descriptions.Item label="Trạng Thái">
              <Tag color={getStatusColor(selectedBooking.status)}>
                {getStatusText(selectedBooking.status)}
              </Tag>
            </Descriptions.Item>

            {selectedBooking.notes && (
              <Descriptions.Item label="Ghi Chú">
                {selectedBooking.notes}
              </Descriptions.Item>
            )}

            <Descriptions.Item label="Ngày Tạo">
              {formatDateTime(selectedBooking.created_at)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '14px 12px',
  borderBottom: '1px solid #eee',
  textAlign: 'left',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '14px 12px',
  borderBottom: '1px solid #eee',
  verticalAlign: 'middle',
};

const smallText: React.CSSProperties = {
  fontSize: 12,
  color: '#666',
  marginTop: 4,
};

const emptyStyle: React.CSSProperties = {
  padding: 32,
  textAlign: 'center',
  color: '#999',
};

export default BookingManagement;
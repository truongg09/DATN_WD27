
import React, { useEffect, useState } from 'react';
import { Table, Button, message, Tag, Space, Modal, Descriptions } from 'antd';
import { EyeOutlined, CheckOutlined, CloseOutlined, LogoutOutlined } from '@ant-design/icons';
import api from '../../services/api';
import dayjs from 'dayjs';

interface Booking {
  id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  room_number: string;
  room_type_name: string;
  check_in: string;
  check_out: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  total_price: string | number;
  adults: number;
  children: number;
  notes?: string;
  created_at: string;
}

function BookingManagement() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/bookings');
      setBookings(response.data || response);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      message.error('Lỗi khi tải danh sách đặt phòng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'confirmed': return 'blue';
      case 'checked_in': return 'green';
      case 'checked_out': return 'gray';
      case 'cancelled': return 'red';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Chờ xác nhận';
      case 'confirmed': return 'Đã xác nhận';
      case 'checked_in': return 'Đã check-in';
      case 'checked_out': return 'Đã check-out';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  };

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === 'number' ? price : parseFloat(price) || 0;
    return new Intl.NumberFormat('vi-VN').format(numPrice) + ' VNĐ';
  };

  const handleCancel = async (id: number) => {
    Modal.confirm({
      title: 'Xác nhận hủy đặt phòng',
      content: 'Bạn có chắc muốn hủy đặt phòng này?',
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

  const columns = [
    {
      title: 'Mã Đặt Phòng',
      dataIndex: 'id',
      key: 'id',
      width: 100,
    },
    {
      title: 'Khách Hàng',
      key: 'customer',
      render: (_: any, record: Booking) => (
        <div>
          <div><strong>{record.customer_name}</strong></div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.customer_email}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.customer_phone}</div>
        </div>
      ),
    },
    {
      title: 'Phòng',
      key: 'room',
      render: (_: any, record: Booking) => (
        <div>
          <div><strong>Phòng {record.room_number}</strong></div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.room_type_name}</div>
        </div>
      ),
    },
    {
      title: 'Thời Gian',
      key: 'dates',
      render: (_: any, record: Booking) => (
        <div>
          <div>Check-in: {dayjs(record.check_in).format('DD/MM/YYYY')}</div>
          <div>Check-out: {dayjs(record.check_out).format('DD/MM/YYYY')}</div>
        </div>
      ),
    },
    {
      title: 'Số Khách',
      key: 'guests',
      render: (_: any, record: Booking) => (
        <div>
          {record.adults} người lớn, {record.children} trẻ em
        </div>
      ),
    },
    {
      title: 'Tổng Tiền',
      dataIndex: 'total_price',
      key: 'total_price',
      render: formatPrice,
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
      filters: [
        { text: 'Chờ xác nhận', value: 'pending' },
        { text: 'Đã xác nhận', value: 'confirmed' },
        { text: 'Đã check-in', value: 'checked_in' },
        { text: 'Đã check-out', value: 'checked_out' },
        { text: 'Đã hủy', value: 'cancelled' },
      ],
      onFilter: (value: boolean | React.Key, record: Booking) => record.status === value,
    },
    {
      title: 'Hành Động',
      key: 'actions',
      render: (_: any, record: Booking) => (
        <Space size="small">
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => {
              setSelectedBooking(record);
              setViewModalVisible(true);
            }}
          >
            Xem
          </Button>

          {(record.status === 'pending' || record.status === 'confirmed') && (
            <Button
              icon={<CloseOutlined />}
              size="small"
              danger
              onClick={() => handleCancel(record.id)}
            >
              Hủy
            </Button>
          )}

          {(record.status === 'pending' || record.status === 'confirmed') && (
            <Button
              icon={<CheckOutlined />}
              size="small"
              type="primary"
              onClick={() => handleCheckIn(record.id)}
            >
              Check-in
            </Button>
          )}

          {record.status === 'checked_in' && (
            <Button
              icon={<LogoutOutlined />}
              size="small"
              type="primary"
              onClick={() => handleCheckOut(record.id)}
            >
              Check-out
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2>Quản Lý Đặt Phòng</h2>
      <Table
        columns={columns}
        dataSource={bookings}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

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
            <Descriptions.Item label="Mã Đặt Phòng">{selectedBooking.id}</Descriptions.Item>
            <Descriptions.Item label="Tên Khách Hàng">{selectedBooking.customer_name}</Descriptions.Item>
            <Descriptions.Item label="Email">{selectedBooking.customer_email}</Descriptions.Item>
            <Descriptions.Item label="Số Điện Thoại">{selectedBooking.customer_phone}</Descriptions.Item>
            <Descriptions.Item label="Phòng">{selectedBooking.room_number} - {selectedBooking.room_type_name}</Descriptions.Item>
            <Descriptions.Item label="Ngày Check-in">{dayjs(selectedBooking.check_in).format('DD/MM/YYYY')}</Descriptions.Item>
            <Descriptions.Item label="Ngày Check-out">{dayjs(selectedBooking.check_out).format('DD/MM/YYYY')}</Descriptions.Item>
            <Descriptions.Item label="Số Khách">{selectedBooking.adults} người lớn, {selectedBooking.children} trẻ em</Descriptions.Item>
            <Descriptions.Item label="Tổng Tiền">{formatPrice(selectedBooking.total_price)}</Descriptions.Item>
            <Descriptions.Item label="Trạng Thái">
              <Tag color={getStatusColor(selectedBooking.status)}>{getStatusText(selectedBooking.status)}</Tag>
            </Descriptions.Item>
            {selectedBooking.notes && (
              <Descriptions.Item label="Ghi Chú">{selectedBooking.notes}</Descriptions.Item>
            )}
            <Descriptions.Item label="Ngày Tạo">{dayjs(selectedBooking.created_at).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

export default BookingManagement;

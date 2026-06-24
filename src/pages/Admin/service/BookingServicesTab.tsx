import { useState, useEffect } from 'react';
import { Table, Button, Input, message, Space, Card, Tag, Statistic, Alert } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../../../services/api';
import { unwrapList } from '../../../utils/unwrapList';
import { formatPrice } from './helpers';

interface BookingServiceRow {
  id: number;
  bookingId: number | null;
  serviceId: number | null;
  quantity: number;
  totalPrice: string | number;
  serviceName: string | null;
  unitPrice: string | number | null;
  bookingCustomer: string | null;
  roomNumber: string | null;
  bookingStatus: string | null;
}

function BookingServicesTab() {
  const [rows, setRows] = useState<BookingServiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const fetchRows = async () => {
    setLoading(true);
    try {
      const response = await api.get('/booking-services');
      setRows(unwrapList<BookingServiceRow>(response));
    } catch (error) {
      console.error('Error fetching booking services:', error);
      message.error('Lỗi khi tải dịch vụ theo đơn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRows();
  }, []);

  const keyword = searchText.trim().toLowerCase();
  const filtered = keyword
    ? rows.filter(
        (r) =>
          (r.serviceName || '').toLowerCase().includes(keyword) ||
          (r.bookingCustomer || '').toLowerCase().includes(keyword) ||
          String(r.bookingId || '').includes(keyword)
      )
    : rows;

  const totalRevenue = filtered.reduce(
    (sum, r) => sum + (parseFloat(r.totalPrice as string) || 0),
    0
  );

  const columns = [
    {
      title: 'Đơn đặt phòng',
      key: 'booking',
      render: (_: unknown, record: BookingServiceRow) => (
        <span>
          #{record.bookingId}
          {record.bookingCustomer ? ` · ${record.bookingCustomer}` : ''}
          {record.roomNumber ? <Tag style={{ marginLeft: 8 }}>Phòng {record.roomNumber}</Tag> : null}
        </span>
      ),
    },
    {
      title: 'Dịch vụ',
      dataIndex: 'serviceName',
      key: 'serviceName',
      render: (text: string | null) => <strong>{text || '—'}</strong>,
    },
    {
      title: 'Đơn giá',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 150,
      render: (price: string | number | null) => formatPrice(price),
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
    },
    {
      title: 'Thành tiền',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 160,
      sorter: (a: BookingServiceRow, b: BookingServiceRow) =>
        (parseFloat(a.totalPrice as string) || 0) - (parseFloat(b.totalPrice as string) || 0),
      render: (price: string | number) => <Tag color="green">{formatPrice(price)}</Tag>,
    },
    {
      title: 'Trạng thái đơn',
      dataIndex: 'bookingStatus',
      key: 'bookingStatus',
      width: 140,
      render: (status: string | null) => (status ? <Tag>{status}</Tag> : '—'),
    },
  ];

  return (
    <Card
      title={<span style={{ fontWeight: 'bold' }}>Dịch vụ đã dùng theo đơn</span>}
      extra={
        <Space>
          <Input
            allowClear
            placeholder="Tìm theo dịch vụ / khách / mã đơn..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 260 }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchRows}>
            Làm mới
          </Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="Dịch vụ được thêm vào đơn ở màn hình Quản lý đặt phòng (kèm tính lại thanh toán). Tại đây chỉ tổng hợp để theo dõi."
      />
      <Statistic
        title="Tổng doanh thu dịch vụ (theo bộ lọc hiện tại)"
        value={totalRevenue}
        formatter={(value) => formatPrice(value as number)}
        style={{ marginBottom: 16 }}
      />
      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 8, showTotal: (total) => `Tổng ${total} dòng` }}
      />
    </Card>
  );
}

export default BookingServicesTab;

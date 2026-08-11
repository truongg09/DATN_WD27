import { useState, useEffect } from 'react';
import { Table, Button, Input, message, Space, Card, Tag, Statistic, Alert } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../../services/api';
import { unwrapList } from '../../../utils/unwrapList';
import { formatPrice } from './helpers';

interface BookingServiceRow {
  id: number;
  bookingId: number | null;
  bookingDetailId?: number | null;
  serviceId: number | null;
  quantity: number;
  totalPrice: string | number;
  serviceName: string | null;
  unitPrice: string | number | null;
  bookingCustomer: string | null;
  roomNumber: string | null;
  bookingStatus: string | null;
  status: string | null;
  usedAt?: string | null;
  createdAt?: string | null;
}

const formatDateTime = (val?: string | null) =>
  val && dayjs(val).isValid() ? dayjs(val).format('HH:mm DD/MM/YYYY') : '—';

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
          (r.roomNumber || '').toLowerCase().includes(keyword) ||
          String(r.bookingId || '').includes(keyword)
      )
    : rows;

  const totalRevenue = filtered
    .filter((r) => (r.status || 'used') === 'used')
    .reduce((sum, r) => sum + (parseFloat(r.totalPrice as string) || 0), 0);

  const columns = [
    {
      title: 'Đơn đặt phòng',
      key: 'booking',
      render: (_: unknown, record: BookingServiceRow) => (
        <span>
          #{record.bookingId}
          {record.bookingCustomer ? ` · ${record.bookingCustomer}` : ''}
        </span>
      ),
    },
    {
      title: 'Phòng',
      key: 'roomNumber',
      width: 170,
      render: (_: unknown, record: BookingServiceRow) =>
        record.roomNumber ? (
          <Tag color="blue">Phòng {record.roomNumber}</Tag>
        ) : (
          <Tag style={{ color: '#888' }}>Không xác định phòng / Dữ liệu cũ</Tag>
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
      width: 130,
      render: (price: string | number | null) => formatPrice(price),
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 90,
      align: 'center' as const,
    },
    {
      title: 'Thành tiền',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 140,
      sorter: (a: BookingServiceRow, b: BookingServiceRow) =>
        (parseFloat(a.totalPrice as string) || 0) - (parseFloat(b.totalPrice as string) || 0),
      render: (price: string | number) => <Tag color="green">{formatPrice(price)}</Tag>,
    },
    {
      title: 'Trạng thái DV',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      filters: [
        { text: 'Đã sử dụng', value: 'used' },
        { text: 'Chưa sử dụng', value: 'unused' },
        { text: 'Đã hủy', value: 'cancelled' },
      ],
      onFilter: (value: unknown, record: BookingServiceRow) => record.status === value,
      render: (status: string | null) => {
        const map: Record<string, { label: string; color: string }> = {
          used: { label: 'Đã sử dụng', color: 'green' },
          unused: { label: 'Chưa sử dụng', color: 'orange' },
          cancelled: { label: 'Đã hủy', color: 'default' },
        };
        const info = map[status || ''] || { label: status || '—', color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: 'Thời gian',
      key: 'time',
      width: 160,
      render: (_: unknown, record: BookingServiceRow) =>
        record.status === 'used' ? formatDateTime(record.usedAt || record.createdAt) : '—',
    },
    {
      title: 'Trạng thái đơn',
      dataIndex: 'bookingStatus',
      key: 'bookingStatus',
      width: 130,
      render: (status: string | null) => {
        if (!status) return '—';
        const map: Record<string, { label: string; color: string }> = {
          pending: { label: 'Chờ xác nhận', color: 'orange' },
          confirmed: { label: 'Đã xác nhận', color: 'blue' },
          checked_in: { label: 'Đã check-in', color: 'cyan' },
          checked_out: { label: 'Đã trả phòng', color: 'purple' },
          cancelled: { label: 'Đã hủy', color: 'red' },
          no_show: { label: 'No-show', color: 'default' },
        };
        const info = map[status] || { label: status, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
  ];

  return (
    <Card
      title={<span style={{ fontWeight: 'bold' }}>Dịch vụ đã dùng theo đơn</span>}
      extra={
        <Space>
          <Input
            allowClear
            placeholder="Tìm theo dịch vụ / phòng / khách / mã đơn..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 280 }}
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
        title="Tổng doanh thu dịch vụ đã sử dụng (theo bộ lọc)"
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

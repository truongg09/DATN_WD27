import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Space,
  Card
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { Option } = Select;

interface BookingServiceRow {
  id: number;
  bookingId: number;
  serviceId: number;
  quantity: number;
  totalPrice: number;
  serviceName?: string;
  unit_price?: number;
  booking_code?: string;
}

interface Service {
  id: number;
  serviceName: string;
  price: number;
}

interface Booking {
  id: number;
  booking_code?: string;
  customer_name?: string;
}

const formatVnd = (value: number) => Number(value || 0).toLocaleString('vi-VN') + ' ₫';

function BookingServiceManagement() {
  const [rows, setRows] = useState<BookingServiceRow[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<BookingServiceRow | null>(null);
  const [form] = Form.useForm();

  const fetchRows = async () => {
    setLoading(true);
    try {
      const res = await api.get('/booking-services');
      setRows(res.data);
    } catch {
      message.error('Lỗi khi tải danh sách dịch vụ phát sinh');
    } finally {
      setLoading(false);
    }
  };

  const fetchRefs = async () => {
    try {
      const [servicesRes, bookingsRes] = await Promise.all([
        api.get('/services'),
        api.get('/bookings')
      ]);
      setServices(servicesRes.data);
      setBookings(bookingsRes.data);
    } catch {
      message.error('Lỗi khi tải dữ liệu tham chiếu');
    }
  };

  useEffect(() => {
    fetchRows();
    fetchRefs();
  }, []);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ quantity: 1 });
    setModalVisible(true);
  };

  const handleEdit = (record: BookingServiceRow) => {
    setEditing(record);
    form.setFieldsValue({
      bookingId: record.bookingId,
      serviceId: record.serviceId,
      quantity: record.quantity
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/booking-services/${id}`);
      message.success('Xóa dịch vụ phát sinh thành công');
      fetchRows();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi xóa');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editing) {
        await api.put(`/booking-services/${editing.id}`, values);
        message.success('Cập nhật thành công');
      } else {
        await api.post('/booking-services', values);
        message.success('Thêm dịch vụ phát sinh thành công');
      }
      setModalVisible(false);
      fetchRows();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi lưu');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    {
      title: 'Đơn đặt phòng',
      dataIndex: 'booking_code',
      key: 'booking_code',
      render: (code: string, r: BookingServiceRow) => code || `#${r.bookingId}`
    },
    { title: 'Dịch vụ', dataIndex: 'serviceName', key: 'serviceName', render: (n: string) => n || '—' },
    {
      title: 'Đơn giá',
      dataIndex: 'unit_price',
      key: 'unit_price',
      render: (p: number) => formatVnd(p)
    },
    { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', width: 90 },
    {
      title: 'Thành tiền',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      render: (p: number) => <b style={{ color: '#ab8965' }}>{formatVnd(p)}</b>
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 130,
      render: (_: any, record: BookingServiceRow) => (
        <Space>
          <Button type="primary" icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button type="primary" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card
        title="Dịch vụ phát sinh theo đơn"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchRows} loading={loading}>
              Tải lại
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Thêm dịch vụ
            </Button>
          </Space>
        }
      >
        <Table columns={columns} dataSource={rows} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title={editing ? 'Sửa dịch vụ phát sinh' : 'Thêm dịch vụ phát sinh'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="bookingId"
            label="Đơn đặt phòng"
            rules={[{ required: true, message: 'Vui lòng chọn đơn đặt phòng' }]}
          >
            <Select placeholder="Chọn đơn đặt phòng" showSearch optionFilterProp="children">
              {bookings.map((b) => (
                <Option key={b.id} value={b.id}>
                  {b.booking_code || `#${b.id}`}
                  {b.customer_name ? ` - ${b.customer_name}` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="serviceId"
            label="Dịch vụ"
            rules={[{ required: true, message: 'Vui lòng chọn dịch vụ' }]}
          >
            <Select placeholder="Chọn dịch vụ" showSearch optionFilterProp="children">
              {services.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.serviceName} ({formatVnd(s.price)})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Số lượng"
            rules={[{ required: true, message: 'Vui lòng nhập số lượng' }]}
          >
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>

          <p style={{ color: '#888', marginTop: -8 }}>
            * Thành tiền = đơn giá dịch vụ × số lượng (tự động tính).
          </p>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editing ? 'Cập nhật' : 'Thêm'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>Hủy</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BookingServiceManagement;

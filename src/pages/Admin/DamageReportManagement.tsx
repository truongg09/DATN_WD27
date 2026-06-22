import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Space,
  Card
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';

const { Option } = Select;

interface DamageReport {
  id: number;
  bookingId: number | null;
  roomItemId: number;
  description: string | null;
  compensationFee: number;
  reportDate: string;
  booking_code?: string;
  item_name?: string;
  room_number?: string;
}

interface RoomItem {
  id: number;
  itemName: string;
  room_number?: string;
}

interface Booking {
  id: number;
  booking_code?: string;
  customer_name?: string;
}

const formatVnd = (value: number) => Number(value || 0).toLocaleString('vi-VN') + ' ₫';

function DamageReportManagement() {
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [roomItems, setRoomItems] = useState<RoomItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<DamageReport | null>(null);
  const [form] = Form.useForm();

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.get('/damage-reports');
      setReports(res.data);
    } catch {
      message.error('Lỗi khi tải danh sách báo hỏng');
    } finally {
      setLoading(false);
    }
  };

  const fetchRefs = async () => {
    try {
      const [itemsRes, bookingsRes] = await Promise.all([
        api.get('/room-items'),
        api.get('/bookings')
      ]);
      setRoomItems(itemsRes.data);
      setBookings(bookingsRes.data);
    } catch {
      message.error('Lỗi khi tải dữ liệu tham chiếu');
    }
  };

  useEffect(() => {
    fetchReports();
    fetchRefs();
  }, []);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ compensationFee: 0 });
    setModalVisible(true);
  };

  const handleEdit = (record: DamageReport) => {
    setEditing(record);
    form.setFieldsValue({
      bookingId: record.bookingId ?? undefined,
      roomItemId: record.roomItemId,
      description: record.description,
      compensationFee: Number(record.compensationFee)
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/damage-reports/${id}`);
      message.success('Xóa báo hỏng thành công');
      fetchReports();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi xóa báo hỏng');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editing) {
        await api.put(`/damage-reports/${editing.id}`, values);
        message.success('Cập nhật báo hỏng thành công');
      } else {
        await api.post('/damage-reports', values);
        message.success('Thêm báo hỏng thành công');
      }
      setModalVisible(false);
      fetchReports();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi lưu báo hỏng');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    {
      title: 'Đơn đặt phòng',
      dataIndex: 'booking_code',
      key: 'booking_code',
      render: (code: string, r: DamageReport) => code || (r.bookingId ? `#${r.bookingId}` : '—')
    },
    {
      title: 'Vật dụng',
      key: 'item',
      render: (_: any, r: DamageReport) =>
        r.item_name ? `${r.item_name}${r.room_number ? ` (P.${r.room_number})` : ''}` : '—'
    },
    { title: 'Mô tả', dataIndex: 'description', key: 'description' },
    {
      title: 'Phí đền bù',
      dataIndex: 'compensationFee',
      key: 'compensationFee',
      render: (fee: number) => formatVnd(fee)
    },
    {
      title: 'Ngày báo',
      dataIndex: 'reportDate',
      key: 'reportDate',
      render: (date: string) => (date ? dayjs(date).format('DD/MM/YYYY HH:mm') : '—')
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 130,
      render: (_: any, record: DamageReport) => (
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
        title="Báo hỏng tài sản"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchReports} loading={loading}>
              Tải lại
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Thêm báo hỏng
            </Button>
          </Space>
        }
      >
        <Table columns={columns} dataSource={reports} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title={editing ? 'Sửa báo hỏng' : 'Thêm báo hỏng'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="roomItemId"
            label="Vật dụng bị hỏng"
            rules={[{ required: true, message: 'Vui lòng chọn vật dụng' }]}
          >
            <Select placeholder="Chọn vật dụng" showSearch optionFilterProp="children">
              {roomItems.map((it) => (
                <Option key={it.id} value={it.id}>
                  {it.itemName}
                  {it.room_number ? ` (Phòng ${it.room_number})` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="bookingId" label="Đơn đặt phòng (nếu có)">
            <Select placeholder="Chọn đơn đặt phòng" allowClear showSearch optionFilterProp="children">
              {bookings.map((b) => (
                <Option key={b.id} value={b.id}>
                  {b.booking_code || `#${b.id}`}
                  {b.customer_name ? ` - ${b.customer_name}` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="description" label="Mô tả thiệt hại">
            <Input.TextArea rows={3} placeholder="Mô tả chi tiết hư hỏng" />
          </Form.Item>

          <Form.Item
            name="compensationFee"
            label="Phí đền bù (₫)"
            rules={[{ required: true, message: 'Vui lòng nhập phí đền bù' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as unknown as number}
            />
          </Form.Item>

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

export default DamageReportManagement;

import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  message,
  Popconfirm,
  Space,
  Card
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { Option } = Select;

interface RoomItem {
  id: number;
  roomId: number;
  itemName: string;
  quantity: number;
  status: string;
  room_number?: string;
}

interface Room {
  id: number;
  room_number: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  normal: { label: 'Bình thường', color: 'green' },
  damaged: { label: 'Hư hỏng', color: 'red' },
  lost: { label: 'Mất', color: 'volcano' },
  maintenance: { label: 'Bảo trì', color: 'orange' }
};

function RoomItemManagement() {
  const [items, setItems] = useState<RoomItem[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<RoomItem | null>(null);
  const [form] = Form.useForm();

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.get('/room-items');
      setItems(res.data);
    } catch {
      message.error('Lỗi khi tải danh sách vật dụng');
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await api.get('/rooms');
      setRooms(res.data);
    } catch {
      message.error('Lỗi khi tải danh sách phòng');
    }
  };

  useEffect(() => {
    fetchItems();
    fetchRooms();
  }, []);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ quantity: 1, status: 'normal' });
    setModalVisible(true);
  };

  const handleEdit = (record: RoomItem) => {
    setEditing(record);
    form.setFieldsValue({
      roomId: record.roomId,
      itemName: record.itemName,
      quantity: record.quantity,
      status: record.status
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/room-items/${id}`);
      message.success('Xóa vật dụng thành công');
      fetchItems();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi xóa vật dụng');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editing) {
        await api.put(`/room-items/${editing.id}`, values);
        message.success('Cập nhật vật dụng thành công');
      } else {
        await api.post('/room-items', values);
        message.success('Thêm vật dụng thành công');
      }
      setModalVisible(false);
      fetchItems();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi lưu vật dụng');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    {
      title: 'Phòng',
      dataIndex: 'room_number',
      key: 'room_number',
      render: (room: string) => room || '—'
    },
    { title: 'Tên vật dụng', dataIndex: 'itemName', key: 'itemName' },
    { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', width: 100 },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const s = STATUS_MAP[status] || { label: status, color: 'default' };
        return <Tag color={s.color}>{s.label}</Tag>;
      }
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 130,
      render: (_: any, record: RoomItem) => (
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
        title="Quản lý vật dụng phòng"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchItems} loading={loading}>
              Tải lại
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Thêm vật dụng
            </Button>
          </Space>
        }
      >
        <Table columns={columns} dataSource={items} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title={editing ? 'Sửa vật dụng' : 'Thêm vật dụng'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="roomId"
            label="Phòng"
            rules={[{ required: true, message: 'Vui lòng chọn phòng' }]}
          >
            <Select
              placeholder="Chọn phòng"
              showSearch
              optionFilterProp="children"
            >
              {rooms.map((r) => (
                <Option key={r.id} value={r.id}>
                  Phòng {r.room_number}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="itemName"
            label="Tên vật dụng"
            rules={[{ required: true, message: 'Vui lòng nhập tên vật dụng' }]}
          >
            <Input placeholder="VD: TV, Mini Bar, Máy sấy tóc..." />
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Số lượng"
            rules={[{ required: true, message: 'Vui lòng nhập số lượng' }]}
          >
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>

          <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
            <Select>
              {Object.entries(STATUS_MAP).map(([value, { label }]) => (
                <Option key={value} value={value}>
                  {label}
                </Option>
              ))}
            </Select>
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

export default RoomItemManagement;

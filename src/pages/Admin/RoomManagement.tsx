import { useState, useEffect, type Key } from 'react';
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
  Card,
  Tag
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import api from '../../services/api';

const { Option } = Select;

interface RoomType {
  id: number;
  typeName: string;
  description: string;
  capacity: number;
  defaultPrice: string | number;
}

interface Room {
  id: number;
  roomNumber: string;
  floor: number;
  area: string | number;
  status: 'available' | 'occupied' | 'maintenance';
  roomTypeId: number;
  room_type_name: string;
  room_type_description: string;
  capacity: number;
  price_per_night: string | number;
  imageUrl?: string;
}

function RoomManagement() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [form] = Form.useForm();

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const response = await api.get('/rooms');
      setRooms(response.data || response);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      message.error('Lỗi khi tải danh sách phòng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const response = await api.get('/rooms');
        setRooms(response.data || response);
      } catch (error) {
        console.error('Error fetching rooms:', error);
        message.error('Lỗi khi tải danh sách phòng');
      } finally {
        setLoading(false);
      }
    })();

    void (async () => {
      try {
        const response = await api.get('/rooms/types');
        setRoomTypes(response.data || response);
      } catch (error) {
        console.error('Error fetching room types:', error);
        message.error('Lỗi khi tải danh sách loại phòng');
      }
    })();
  }, []);

  const handleAdd = () => {
    setEditingRoom(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (room: Room) => {
    setEditingRoom(room);
    form.setFieldsValue({
      roomNumber: room.roomNumber,
      roomTypeId: room.roomTypeId,
      floor: room.floor,
      area: parseFloat(room.area as string) || room.area,
      status: room.status
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/rooms/${id}`);
      message.success('Xóa phòng thành công');
      fetchRooms();
    } catch (error: unknown) {
      console.error('Error deleting room:', error);
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      message.error(msg || 'Lỗi khi xóa phòng');
    }
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingRoom) {
        // Update
        await api.put(`/rooms/${editingRoom.id}`, values);
        message.success('Cập nhật phòng thành công');
      } else {
        // Create
        await api.post('/rooms', values);
        message.success('Thêm phòng mới thành công');
      }
      setModalVisible(false);
      fetchRooms();
    } catch (error: unknown) {
      console.error('Submit error:', error);
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      message.error(msg || 'Có lỗi xảy ra, vui lòng thử lại');
    }
  };

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === 'number' ? price : parseFloat(price) || 0;
    return new Intl.NumberFormat('vi-VN').format(numPrice) + ' VNĐ';
  };

  const columns = [
    {
      title: 'Số phòng',
      dataIndex: 'roomNumber',
      key: 'roomNumber',
      sorter: (a: Room, b: Room) => a.roomNumber.localeCompare(b.roomNumber),
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: 'Loại phòng',
      dataIndex: 'room_type_name',
      key: 'room_type_name',
      filters: roomTypes.map(t => ({ text: t.typeName, value: t.typeName })),
      onFilter: (value: boolean | Key, record: Room) => record.room_type_name === value,
    },
    {
      title: 'Tầng',
      dataIndex: 'floor',
      key: 'floor',
      sorter: (a: Room, b: Room) => a.floor - b.floor,
    },
    {
      title: 'Diện tích',
      dataIndex: 'area',
      key: 'area',
      render: (area: string | number) => `${area} m²`
    },
    {
      title: 'Giá/đêm',
      dataIndex: 'price_per_night',
      key: 'price_per_night',
      sorter: (a: Room, b: Room) => (parseFloat(a.price_per_night as string) || 0) - (parseFloat(b.price_per_night as string) || 0),
      render: (price: string | number) => formatPrice(price)
    },
    {
      title: 'Sức chứa',
      dataIndex: 'capacity',
      key: 'capacity',
      render: (capacity: number) => `${capacity} người`
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: 'Trống', value: 'available' },
        { text: 'Đang ở', value: 'occupied' },
        { text: 'Bảo trì', value: 'maintenance' }
      ],
      onFilter: (value: boolean | Key, record: Room) => record.status === value,
      render: (status: 'available' | 'occupied' | 'maintenance') => {
        let color = 'green';
        let text = 'Trống';
        if (status === 'occupied') {
          color = 'blue';
          text = 'Đang ở';
        } else if (status === 'maintenance') {
          color = 'red';
          text = 'Bảo trì';
        }
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_: unknown, record: Room) => (
        <Space size="middle">
          <Button 
            type="primary" 
            ghost
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          >
            Sửa
          </Button>
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa phòng này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button 
              type="primary" 
              danger 
              ghost
              icon={<DeleteOutlined />}
            >
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card 
        title={<span style={{ fontSize: '20px', fontWeight: 'bold' }}>Quản Lý Danh Sách Phòng</span>}
        extra={
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchRooms}
            >
              Làm mới
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleAdd}
            >
              Thêm phòng mới
            </Button>
          </Space>
        }
      >
        <Table 
          columns={columns} 
          dataSource={rooms} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
      </Card>

      <Modal
        title={editingRoom ? "Cập Nhật Thông Tin Phòng" : "Thêm Phòng Mới"}
        open={modalVisible}
        onOk={handleModalSubmit}
        onCancel={() => setModalVisible(false)}
        okText={editingRoom ? "Cập nhật" : "Thêm mới"}
        cancelText="Hủy"
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: '16px' }}
        >
          <Form.Item
            name="roomNumber"
            label="Số phòng"
            rules={[{ required: true, message: 'Vui lòng nhập số phòng!' }]}
          >
            <Input placeholder="Ví dụ: 101, 202..." />
          </Form.Item>

          <Form.Item
            name="roomTypeId"
            label="Loại phòng"
            rules={[{ required: true, message: 'Vui lòng chọn loại phòng!' }]}
          >
            <Select placeholder="Chọn loại phòng">
              {roomTypes.map(t => (
                <Option key={t.id} value={t.id}>
                  {t.typeName} ({formatPrice(t.defaultPrice)}/đêm)
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="floor"
            label="Tầng"
            rules={[{ required: true, message: 'Vui lòng nhập số tầng!' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="Nhập số tầng" />
          </Form.Item>

          <Form.Item
            name="area"
            label="Diện tích (m²)"
            rules={[{ required: true, message: 'Vui lòng nhập diện tích!' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="Nhập diện tích sử dụng" />
          </Form.Item>

          <Form.Item
            name="status"
            label="Trạng thái"
            initialValue="available"
            rules={[{ required: true, message: 'Vui lòng chọn trạng thái phòng!' }]}
          >
            <Select>
              <Option value="available">Trống (Sẵn sàng đón khách)</Option>
              <Option value="occupied">Đang có khách ở</Option>
              <Option value="maintenance">Đang bảo trì / dọn dẹp</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default RoomManagement;
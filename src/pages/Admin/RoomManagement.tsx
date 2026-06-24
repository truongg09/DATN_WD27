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
  Tag,
  Row,
  Col
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, DownOutlined } from '@ant-design/icons';
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
  const [searchText, setSearchText] = useState('');

  const totalRooms = rooms.length;
  const availableRooms = rooms.filter(r => r.status === 'available').length;
  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
  const maintenanceRooms = rooms.filter(r => r.status === 'maintenance').length;

  const filteredRooms = rooms.filter(room => {
    const searchLower = searchText.toLowerCase();
    return (
      room.roomNumber.toLowerCase().includes(searchLower) ||
      (room.room_type_name && room.room_type_name.toLowerCase().includes(searchLower)) ||
      String(room.floor).includes(searchLower)
    );
  });

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

  const handleQuickStatusChange = async (id: number, newStatus: 'available' | 'occupied' | 'maintenance', record: Room) => {
    try {
      const updatedValues = {
        roomNumber: record.roomNumber,
        roomTypeId: record.roomTypeId,
        floor: record.floor,
        area: parseFloat(record.area as string) || record.area,
        status: newStatus
      };
      
      await api.put(`/rooms/${id}`, updatedValues);
      message.success(`Đã chuyển trạng thái phòng ${record.roomNumber} thành công`);
      fetchRooms();
    } catch (error: unknown) {
      console.error('Quick status change error:', error);
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      message.error(msg || 'Lỗi khi cập nhật trạng thái phòng');
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
      render: (status: 'available' | 'occupied' | 'maintenance', record: Room) => {
        return (
          <Select
            value={status}
            onChange={(newStatus) => handleQuickStatusChange(record.id, newStatus, record)}
            style={{ width: 110 }}
            bordered={false}
            popupMatchSelectWidth={false}
            suffixIcon={<DownOutlined style={{ fontSize: '10px', color: '#bfbfbf' }} />}
          >
            <Option value="available">
              <Tag color="green" style={{ cursor: 'pointer', margin: 0 }}>Trống</Tag>
            </Option>
            <Option value="occupied">
              <Tag color="blue" style={{ cursor: 'pointer', margin: 0 }}>Đang ở</Tag>
            </Option>
            <Option value="maintenance">
              <Tag color="red" style={{ cursor: 'pointer', margin: 0 }}>Bảo trì</Tag>
            </Option>
          </Select>
        );
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
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ backgroundColor: '#f0f2f5', borderLeft: '5px solid #1890ff', borderRadius: '8px' }}>
                <div style={{ color: '#8c8c8c', fontSize: '14px' }}>Tổng số phòng</div>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#1890ff', marginTop: '4px' }}>{totalRooms}</div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ backgroundColor: '#f6ffed', borderLeft: '5px solid #52c41a', borderRadius: '8px' }}>
                <div style={{ color: '#8c8c8c', fontSize: '14px' }}>Đang trống</div>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#52c41a', marginTop: '4px' }}>{availableRooms}</div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ backgroundColor: '#e6f7ff', borderLeft: '5px solid #13c2c2', borderRadius: '8px' }}>
                <div style={{ color: '#8c8c8c', fontSize: '14px' }}>Đang ở</div>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#13c2c2', marginTop: '4px' }}>{occupiedRooms}</div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ backgroundColor: '#fff2e8', borderLeft: '5px solid #fa8c16', borderRadius: '8px' }}>
                <div style={{ color: '#8c8c8c', fontSize: '14px' }}>Bảo trì / Dọn dẹp</div>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#fa8c16', marginTop: '4px' }}>{maintenanceRooms}</div>
              </Card>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Input.Search
              placeholder="Tìm kiếm theo số phòng, loại phòng hoặc tầng..."
              allowClear
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 350 }}
            />
          </div>
          <Table 
            columns={columns} 
            dataSource={filteredRooms} 
            rowKey="id" 
            loading={loading}
            pagination={{ pageSize: 8 }}
          />
        </Space>
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
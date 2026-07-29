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
  Col,
  Descriptions,
  Radio,
  DatePicker,
  Tooltip
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  ReloadOutlined, 
  DownOutlined, 
  EyeOutlined,
  CalendarOutlined,
  UnorderedListOutlined,
  LeftOutlined,
  RightOutlined,
  ToolOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
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
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  roomTypeId: number;
  room_type_name: string;
  room_type_description: string;
  capacity: number;
  price_per_night: string | number;
  imageUrl?: string;
  maintenanceNote?: string | null;
  maintenanceExpectedCompletion?: string | null;
}

function RoomManagement() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');

  // Advanced filter states
  const [filterRoomTypeId, setFilterRoomTypeId] = useState<number | null>(null);
  const [filterFloor, setFilterFloor] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  
  // Quick View Booking states
  const [bookingDetailVisible, setBookingDetailVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);

  const handleShowBookingDetail = (booking: any) => {
    const targetId = booking.bookingId || booking.id;
    const fullBooking = bookings.find(b => b.id === targetId);
    setSelectedBooking(fullBooking || booking);
    setBookingDetailVisible(true);
  };

  const handleCalendarCheckIn = async (bookingId: number, customerName: string, customerPhone: string) => {
    try {
      await api.patch(`/bookings/${bookingId}/check-in`, {
        guests: [{
          fullName: customerName || 'Khách đặt phòng',
          identityNumber: '000000000000',
          phone: customerPhone || ''
        }]
      });
      message.success('Check-in thành công');
      fetchRooms();
      setBookingDetailVisible(false);
    } catch (error: any) {
      console.error('Calendar check-in error:', error);
      message.error(error.response?.data?.message || 'Lỗi khi check-in');
    }
  };

  const handleCalendarCheckOut = async (bookingId: number) => {
    try {
      await api.patch(`/bookings/${bookingId}/check-out`);
      message.success('Check-out thành công');
      fetchRooms();
      setBookingDetailVisible(false);
    } catch (error: any) {
      console.error('Calendar check-out error:', error);
      message.error(error.response?.data?.message || 'Lỗi khi check-out');
    }
  };

  // Room Items states
  const [roomItems, setRoomItems] = useState<any[]>([]);
  const [roomItemsModalVisible, setRoomItemsModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [itemForm] = Form.useForm();

  const fetchRoomItems = async (roomId: number) => {
    try {
      const response = await api.get('/room-items');
      const allItems = response.data || response;
      setRoomItems(allItems.filter((item: any) => item.roomId === roomId));
    } catch (error) {
      console.error('Error fetching room items:', error);
      message.error('Lỗi khi tải danh sách vật tư');
    }
  };

  const handleManageItems = (room: Room) => {
    setSelectedRoom(room);
    setRoomItems([]);
    setEditingItem(null);
    itemForm.resetFields();
    fetchRoomItems(room.id);
    setRoomItemsModalVisible(true);
  };

  const handleItemSubmit = async (values: any) => {
    if (!selectedRoom) return;
    try {
      if (editingItem) {
        // Update
        await api.put(`/room-items/${editingItem.id}`, {
          ...values,
          roomId: selectedRoom.id
        });
        message.success('Cập nhật vật tư thành công');
      } else {
        // Create
        await api.post('/room-items', {
          ...values,
          roomId: selectedRoom.id
        });
        message.success('Thêm vật tư thành công');
      }
      setEditingItem(null);
      itemForm.resetFields();
      fetchRoomItems(selectedRoom.id);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi lưu vật tư');
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!selectedRoom) return;
    try {
      await api.delete(`/room-items/${itemId}`);
      message.success('Xóa vật tư thành công');
      fetchRoomItems(selectedRoom.id);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Không thể xóa vật tư này');
    }
  };

  const handleEditItem = (item: any) => {
    setEditingItem(item);
    itemForm.setFieldsValue({
      itemName: item.itemName,
      quantity: item.quantity,
      status: item.status
    });
  };

  // Bulk Room Creation states
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [bulkPreviewRooms, setBulkPreviewRooms] = useState<any[]>([]);
  const [bulkForm] = Form.useForm();

  const handleOpenBulkModal = () => {
    setBulkPreviewRooms([]);
    bulkForm.resetFields();
    setBulkModalVisible(true);
  };

  const handleGeneratePreview = () => {
    const values = bulkForm.getFieldsValue();
    const startNum = parseInt(values.startRoomNumber, 10);
    const count = parseInt(values.count, 10);
    const floor = parseInt(values.floor, 10);
    const roomTypeId = values.roomTypeId;
    const area = values.area || 25;

    if (isNaN(startNum) || isNaN(count) || count <= 0) {
      message.error('Vui lòng nhập số phòng bắt đầu và số lượng hợp lệ!');
      return;
    }

    if (!roomTypeId) {
      message.error('Vui lòng chọn hạng phòng mặc định!');
      return;
    }

    const previewList = [];
    for (let i = 0; i < count; i++) {
      const roomNum = startNum + i;
      previewList.push({
        key: String(roomNum),
        roomNumber: String(roomNum),
        roomTypeId: roomTypeId,
        floor: floor || 1,
        area: area,
        status: 'available'
      });
    }
    setBulkPreviewRooms(previewList);
  };

  const handlePreviewRoomChange = (key: string, field: string, value: any) => {
    setBulkPreviewRooms(prev => prev.map(item => {
      if (item.key === key) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleBulkSubmit = async () => {
    if (bulkPreviewRooms.length === 0) {
      message.error('Vui lòng tạo bảng xem trước trước khi xác nhận!');
      return;
    }

    try {
      setLoading(true);
      await api.post('/rooms/bulk', { rooms: bulkPreviewRooms });
      message.success(`Đã tạo thành công ${bulkPreviewRooms.length} phòng mới!`);
      setBulkModalVisible(false);
      fetchRooms();
    } catch (error: any) {
      console.error('Bulk submit error:', error);
      message.error(error.response?.data?.message || 'Có lỗi xảy ra khi tạo phòng hàng loạt.');
    } finally {
      setLoading(false);
    }
  };

  // Calendar states
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarStartDate, setCalendarStartDate] = useState<dayjs.Dayjs>(dayjs());

  const totalRooms = rooms.length;
  const availableRooms = rooms.filter(r => r.status === 'available').length;
  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
  const maintenanceRooms = rooms.filter(r => r.status === 'maintenance').length;

  // Deriving unique floors list dynamically from rooms
  const floorsList = Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b);

  const filteredRooms = rooms.filter(room => {
    // 1. Search text check
    const searchLower = searchText.toLowerCase();
    const matchesSearch = 
      room.roomNumber.toLowerCase().includes(searchLower) ||
      (room.room_type_name && room.room_type_name.toLowerCase().includes(searchLower)) ||
      String(room.floor).includes(searchLower);

    // 2. Room type check
    const matchesType = filterRoomTypeId == null || room.roomTypeId === filterRoomTypeId;

    // 3. Floor check
    const matchesFloor = filterFloor == null || room.floor === filterFloor;

    // 4. Status check
    const matchesStatus = filterStatus == null || room.status === filterStatus;

    return matchesSearch && matchesType && matchesFloor && matchesStatus;
  });



  const fetchRooms = async () => {
    setLoading(true);
    try {
      const [roomsRes, bookingsRes] = await Promise.all([
        api.get('/rooms'),
        api.get('/bookings')
      ]);
      setRooms(roomsRes.data || roomsRes);
      setBookings(bookingsRes.data || bookingsRes);
    } catch (error) {
      console.error('Error fetching rooms and bookings:', error);
      message.error('Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  // Quick Maintenance setup states
  const [quickMaintModalVisible, setQuickMaintModalVisible] = useState(false);
  const [quickMaintRoom, setQuickMaintRoom] = useState<Room | null>(null);
  const [quickMaintForm] = Form.useForm();

  const handleQuickMaintSubmit = async () => {
    if (!quickMaintRoom) return;
    try {
      const values = await quickMaintForm.validateFields();
      const updatedValues = {
        roomNumber: quickMaintRoom.roomNumber,
        roomTypeId: quickMaintRoom.roomTypeId,
        floor: quickMaintRoom.floor,
        area: parseFloat(quickMaintRoom.area as string) || quickMaintRoom.area,
        status: 'maintenance' as const,
        maintenanceNote: values.maintenanceNote,
        maintenanceExpectedCompletion: values.maintenanceExpectedCompletion
          ? values.maintenanceExpectedCompletion.format('YYYY-MM-DD')
          : null
      };
      
      await api.put(`/rooms/${quickMaintRoom.id}`, updatedValues);
      message.success(`Đã chuyển phòng ${quickMaintRoom.roomNumber} sang bảo trì`);
      setQuickMaintModalVisible(false);
      fetchRooms();
    } catch (error: unknown) {
      console.error('Quick maintenance submit error:', error);
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      message.error(msg || 'Lỗi khi cập nhật trạng thái bảo trì');
    }
  };

  const handleQuickStatusChange = async (id: number, newStatus: 'available' | 'occupied' | 'maintenance' | 'reserved', record: Room) => {
    if (newStatus === 'maintenance') {
      setQuickMaintRoom(record);
      quickMaintForm.resetFields();
      quickMaintForm.setFieldsValue({
        maintenanceNote: record.maintenanceNote || '',
        maintenanceExpectedCompletion: record.maintenanceExpectedCompletion 
          ? dayjs(record.maintenanceExpectedCompletion) 
          : undefined
      });
      setQuickMaintModalVisible(true);
      return;
    }

    try {
      const updatedValues = {
        roomNumber: record.roomNumber,
        roomTypeId: record.roomTypeId,
        floor: record.floor,
        area: parseFloat(record.area as string) || record.area,
        status: newStatus,
        maintenanceNote: null,
        maintenanceExpectedCompletion: null
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
        const [roomsRes, bookingsRes] = await Promise.all([
          api.get('/rooms'),
          api.get('/bookings')
        ]);
        setRooms(roomsRes.data || roomsRes);
        setBookings(bookingsRes.data || bookingsRes);
      } catch (error) {
        console.error('Error fetching rooms/bookings:', error);
        message.error('Lỗi khi tải dữ liệu phòng');
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
      status: room.status,
      maintenanceNote: room.maintenanceNote || undefined,
      maintenanceExpectedCompletion: room.maintenanceExpectedCompletion
        ? dayjs(room.maintenanceExpectedCompletion)
        : undefined
    });
    setModalVisible(true);
  };

  const handleViewDetail = (room: Room) => {
    setSelectedRoom(room);
    setDetailModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    // Find room to check status
    const targetRoom = rooms.find(r => r.id === id);
    if (targetRoom && targetRoom.status === 'occupied') {
      message.error('Không thể xóa phòng đang có khách ở!');
      return;
    }

    // Check if room is in active bookings (status is not cancelled and not checked_out)
    const hasActiveBookings = Array.isArray(bookings) && bookings.some(b => {
      if (!b) return false;
      const status = b.status || b.bookingStatus;
      if (!status || status === 'cancelled' || status === 'checked_out') return false;
      const bRoomId = b.room_id || b.roomId;
      return bRoomId !== undefined && bRoomId !== null && Number(bRoomId) === id;
    });

    if (hasActiveBookings) {
      message.error('Không thể xóa phòng đang có đơn đặt phòng (hoặc đã cọc) chưa hoàn thành!');
      return;
    }

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
      const payload = {
        ...values,
        maintenanceExpectedCompletion: values.maintenanceExpectedCompletion
          ? values.maintenanceExpectedCompletion.format('YYYY-MM-DD')
          : null
      };
      if (editingRoom) {
        // Update
        await api.put(`/rooms/${editingRoom.id}`, payload);
        message.success('Cập nhật phòng thành công');
      } else {
        // Create
        await api.post('/rooms', payload);
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
        { text: 'Đã cọc', value: 'reserved' },
        { text: 'Đang ở', value: 'occupied' },
        { text: 'Bảo trì', value: 'maintenance' }
      ],
      onFilter: (value: boolean | Key, record: Room) => record.status === value,
      render: (status: 'available' | 'occupied' | 'maintenance' | 'reserved', record: Room) => {
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
              <Tag style={{ cursor: 'pointer', margin: 0, backgroundColor: '#bbf7d0', color: '#166534', borderColor: '#86efac' }}>Trống</Tag>
            </Option>
            <Option value="reserved">
              <Tag style={{ cursor: 'pointer', margin: 0, backgroundColor: '#fef3c7', color: '#d97706', borderColor: '#fde68a' }}>Đã cọc</Tag>
            </Option>
            <Option value="occupied">
              <Tag style={{ cursor: 'pointer', margin: 0, backgroundColor: '#bfdbfe', color: '#1e40af', borderColor: '#93c5fd' }}>Đang ở</Tag>
            </Option>
            <Option value="maintenance">
              <Tag style={{ cursor: 'pointer', margin: 0, backgroundColor: '#fecdd3', color: '#9f1239', borderColor: '#fda4af' }}>Bảo trì</Tag>
            </Option>
          </Select>
        );
      }
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_: unknown, record: Room) => (
        <Space>
          <Button
            type="primary"
            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            icon={<ToolOutlined />}
            size="small"
            onClick={() => handleManageItems(record)}
            title="Quản lý vật tư"
          >
          </Button>
          <Button
            type="primary"
            icon={<EyeOutlined style={{ color: 'white' }} />}
            size="small"
            onClick={() => handleViewDetail(record)}
          >
          </Button>
          <Button
            type="primary"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
          </Button>
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
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
              style={{ backgroundColor: '#ab8965', borderColor: '#ab8965' }}
              icon={<PlusOutlined />} 
              onClick={handleOpenBulkModal}
            >
              Thêm hàng loạt
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
        <Space orientation="vertical" style={{ width: '100%' }} size="large">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ backgroundColor: '#e2e8f0', borderLeft: '4px solid #334155', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <div style={{ color: '#334155', fontSize: '14px', fontWeight: '500' }}>Tổng số phòng</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>{totalRooms}</div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ backgroundColor: '#bbf7d0', borderLeft: '4px solid #15803d', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <div style={{ color: '#166534', fontSize: '14px', fontWeight: '500' }}>Đang trống</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#14532d', marginTop: '4px' }}>{availableRooms}</div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ backgroundColor: '#bfdbfe', borderLeft: '4px solid #1d4ed8', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <div style={{ color: '#1e40af', fontSize: '14px', fontWeight: '500' }}>Đang ở</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e3a8a', marginTop: '4px' }}>{occupiedRooms}</div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ backgroundColor: '#fecdd3', borderLeft: '4px solid #be123c', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <div style={{ color: '#9f1239', fontSize: '14px', fontWeight: '500' }}>Bảo trì / Dọn dẹp</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#881337', marginTop: '4px' }}>{maintenanceRooms}</div>
              </Card>
            </Col>
          </Row>

          <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #f0eae1', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} sm={12} md={6}>
                <span style={{ fontWeight: 500, display: 'block', marginBottom: 4, color: '#334155' }}>Tìm kiếm</span>
                <Input.Search
                  placeholder="Tìm số phòng, tầng..."
                  allowClear
                  onChange={e => setSearchText(e.target.value)}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <span style={{ fontWeight: 500, display: 'block', marginBottom: 4, color: '#334155' }}>Hạng phòng</span>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Tất cả hạng phòng"
                  allowClear
                  onChange={value => setFilterRoomTypeId(value)}
                >
                  {roomTypes.map(t => (
                    <Option key={t.id} value={t.id}>{t.typeName}</Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <span style={{ fontWeight: 500, display: 'block', marginBottom: 4, color: '#334155' }}>Tầng</span>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Tất cả tầng"
                  allowClear
                  onChange={value => setFilterFloor(value)}
                >
                  {floorsList.map(floor => (
                    <Option key={floor} value={floor}>Tầng {floor}</Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <span style={{ fontWeight: 500, display: 'block', marginBottom: 4, color: '#334155' }}>Trạng thái</span>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Tất cả trạng thái"
                  allowClear
                  onChange={value => setFilterStatus(value)}
                >
                  <Option value="available">Trống</Option>
                  <Option value="occupied">Đang ở</Option>
                  <Option value="reserved">Đã cọc</Option>
                  <Option value="maintenance">Bảo trì</Option>
                </Select>
              </Col>
            </Row>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <Radio.Group 
              value={viewMode} 
              onChange={e => setViewMode(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="list">
                <UnorderedListOutlined style={{ marginRight: '6px' }} />Danh sách
              </Radio.Button>
              <Radio.Button value="calendar">
                <CalendarOutlined style={{ marginRight: '6px' }} />Lịch phòng
              </Radio.Button>
            </Radio.Group>
          </div>

          {viewMode === 'calendar' ? (
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #f0eae1', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
              {/* Calendar Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <Space size="middle">
                  <Button 
                    icon={<LeftOutlined />} 
                    onClick={() => setCalendarStartDate(calendarStartDate.subtract(7, 'day'))}
                  />
                  <span style={{ fontSize: '16px', fontWeight: '700', color: '#ab8965' }}>
                    Từ {calendarStartDate.format('DD/MM/YYYY')} đến {calendarStartDate.add(6, 'day').format('DD/MM/YYYY')}
                  </span>
                  <Button 
                    icon={<RightOutlined />} 
                    onClick={() => setCalendarStartDate(calendarStartDate.add(7, 'day'))}
                  />
                  <Button type="primary" onClick={() => setCalendarStartDate(dayjs())} style={{ backgroundColor: '#ab8965', borderColor: '#ab8965' }}>Hôm nay</Button>
                </Space>
                <DatePicker 
                  value={calendarStartDate} 
                  onChange={(date) => date && setCalendarStartDate(date)} 
                  allowClear={false} 
                  style={{ width: '150px' }}
                />
              </div>

              {/* Grid Scroll Wrapper */}
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e8e0d5' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px', background: '#fff' }}>
                  <thead>
                    <tr>
                      <th style={{
                        padding: '12px 16px',
                        border: '1px solid #e8e0d5',
                        background: '#fbf9f6',
                        textAlign: 'left',
                        width: '180px',
                        fontWeight: '700',
                        color: '#ab8965'
                      }}>Phòng</th>
                      {Array.from({ length: 7 }).map((_, i) => {
                        const day = calendarStartDate.add(i, 'day');
                        const isToday = day.isSame(dayjs(), 'day');
                        return (
                          <th key={i} style={{
                            padding: '12px 10px',
                            border: '1px solid #e8e0d5',
                            background: isToday ? '#fffbeb' : '#fbf9f6',
                            textAlign: 'center',
                            fontWeight: '700',
                            minWidth: '100px',
                            color: isToday ? '#ab8965' : '#555'
                          }}>
                            <div style={{ fontSize: '13px', textTransform: 'capitalize' }}>
                              {day.format('dddd') === 'Sunday' ? 'Chủ nhật' : day.format('dddd').replace('Monday', 'Thứ hai').replace('Tuesday', 'Thứ ba').replace('Wednesday', 'Thứ tư').replace('Thursday', 'Thứ năm').replace('Friday', 'Thứ sáu').replace('Saturday', 'Thứ bảy')}
                            </div>
                            <div style={{ fontSize: '11px', color: isToday ? '#ab8965' : '#8c8c8c', marginTop: '2px' }}>{day.format('DD/MM')}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRooms.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#999' }}>Không tìm thấy phòng phù hợp</td>
                      </tr>
                    ) : (
                      filteredRooms.map(room => {
                        let skipCount = 0;
                        return (
                          <tr key={room.id} style={{ transition: 'background-color 0.2s' }}>
                            {/* Room Cell */}
                            <td style={{
                              padding: '14px 16px',
                              border: '1px solid #e8e0d5',
                              background: '#fff',
                              fontWeight: 'bold',
                              color: '#333'
                            }}>
                              <div style={{ fontSize: '15px' }}>Phòng {room.roomNumber}</div>
                              <div style={{ fontSize: '11px', color: '#ab8965', fontWeight: '500', marginTop: '2px' }}>{room.room_type_name}</div>
                            </td>

                            {/* Day Cells */}
                            {Array.from({ length: 7 }).map((_, i) => {
                              if (skipCount > 0) {
                                skipCount--;
                                return null;
                              }

                              const date = calendarStartDate.add(i, 'day');
                              const dateStr = date.format('YYYY-MM-DD');
                              
                               // Check for booking
                               const booking = bookings.find(b => {
                                 if (b.status === 'cancelled') return false;
                                 const bRoomId = b.room_id || b.roomId;
                                 if (Number(bRoomId) !== room.id) return false;
                                 
                                 const checkIn = dayjs(b.check_in).format('YYYY-MM-DD');
                                 const checkOut = dayjs(b.check_out).format('YYYY-MM-DD');
                                 return dateStr >= checkIn && dateStr < checkOut;
                               });

                               if (booking) {
                                 // Find ultimate checkout date for consecutive contiguous bookings of the same guest
                                 const getUltimateCheckOutDate = (startBooking: any) => {
                                   let currentCheckOut = dayjs(startBooking.check_out).format('YYYY-MM-DD');
                                   const customerName = startBooking.customer_name?.trim().toLowerCase();
                                   
                                   let foundNext = true;
                                   while (foundNext) {
                                     foundNext = false;
                                     for (const b of bookings) {
                                       if (b.status === 'cancelled') continue;
                                       if (b.detail_id === startBooking.detail_id) continue;
                                       const bRoomId = b.room_id || b.roomId;
                                       if (Number(bRoomId) !== room.id) continue;
                                       
                                       const bCheckIn = dayjs(b.check_in).format('YYYY-MM-DD');
                                       
                                       if (bCheckIn === currentCheckOut && b.customer_name?.trim().toLowerCase() === customerName) {
                                         currentCheckOut = dayjs(b.check_out).format('YYYY-MM-DD');
                                         foundNext = true;
                                         break;
                                       }
                                     }
                                   }
                                   return currentCheckOut;
                                 };

                                 const ultimateCheckOut = getUltimateCheckOutDate(booking);
                                 const totalBookingDays = dayjs(ultimateCheckOut).diff(date, 'day');
                                 const remainingDays = 7 - i;
                                 const colSpan = Math.max(1, Math.min(totalBookingDays, remainingDays));
                                 
                                 if (colSpan > 1) {
                                   skipCount = colSpan - 1;
                                 }

                                let bg = '#eff6ff';
                                let text = '#1e40af';
                                let borderLeft = '4px solid #3b82f6';
                                let statusText = 'Đã đặt';

                                if (booking.status === 'checked_in') {
                                  bg = '#f0fdf4';
                                  text = '#166534';
                                  borderLeft = '4px solid #22c55e';
                                  statusText = 'Đang ở';
                                } else if (booking.status === 'pending') {
                                  bg = '#fffbeb';
                                  text = '#854d0e';
                                  borderLeft = '4px solid #eab308';
                                  statusText = 'Chờ duyệt';
                                } else if (booking.status === 'checked_out') {
                                  bg = '#f8fafc';
                                  text = '#475569';
                                  borderLeft = '4px solid #94a3b8';
                                  statusText = 'Đã trả';
                                }

                                const tooltipTitle = (
                                  <div style={{ padding: '4px' }}>
                                    <div><strong>Khách:</strong> {booking.customer_name}</div>
                                    <div><strong>SĐT:</strong> {booking.customer_phone}</div>
                                    <div><strong>Thời gian:</strong> {dayjs(booking.check_in).format('DD/MM')} - {dayjs(booking.check_out).format('DD/MM')}</div>
                                    <div><strong>Trạng thái:</strong> {statusText}</div>
                                  </div>
                                );

                                return (
                                  <td key={i} colSpan={colSpan} onClick={() => handleShowBookingDetail(booking)} style={{
                                    border: '1px solid #e8e0d5',
                                    padding: '4px',
                                    background: bg,
                                    cursor: 'pointer'
                                  }}>
                                    <Tooltip title={tooltipTitle}>
                                      <div style={{
                                        borderLeft: borderLeft,
                                        padding: '6px 8px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        minHeight: '44px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center'
                                      }}>
                                        <strong style={{ color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {booking.customer_name}
                                        </strong>
                                        <span style={{ fontSize: '10px', color: text, fontWeight: '600', marginTop: '2px' }}>{statusText} ({colSpan} ngày)</span>
                                      </div>
                                    </Tooltip>
                                  </td>
                                );
                              }

                              // Under maintenance
                              if (room.status === 'maintenance') {
                                const hasExpectedDate = !!room.maintenanceExpectedCompletion;
                                const expectedEndStr = hasExpectedDate ? dayjs(room.maintenanceExpectedCompletion).format('YYYY-MM-DD') : null;
                                const isUnderMaintenanceNow = !expectedEndStr || dateStr <= expectedEndStr;

                                if (isUnderMaintenanceNow) {
                                  let colSpan = 1;
                                  if (expectedEndStr) {
                                    const maintenanceDays = dayjs(expectedEndStr).diff(date, 'day') + 1;
                                    colSpan = Math.max(1, Math.min(maintenanceDays, 7 - i));
                                  } else {
                                    colSpan = 7 - i;
                                  }

                                  if (colSpan > 1) {
                                    skipCount = colSpan - 1;
                                  }

                                  const maintenanceTooltip = (
                                    <div style={{ padding: '4px' }}>
                                      <div><strong>Trạng thái:</strong> Đang bảo trì</div>
                                      <div><strong>Lý do:</strong> {room.maintenanceNote || 'Không có ghi chú'}</div>
                                      <div><strong>Dự kiến xong:</strong> {room.maintenanceExpectedCompletion ? dayjs(room.maintenanceExpectedCompletion).format('DD/MM/YYYY') : 'Chưa xác định'}</div>
                                    </div>
                                  );
                                  return (
                                    <td key={i} colSpan={colSpan} style={{
                                      border: '1px solid #e8e0d5',
                                      padding: '4px',
                                      background: '#fff1f2',
                                      cursor: 'pointer'
                                    }}>
                                      <Tooltip title={maintenanceTooltip}>
                                        <div style={{
                                          borderLeft: '4px solid #f43f5e',
                                          padding: '6px 8px',
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          color: '#9f1239',
                                          minHeight: '44px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          justifyContent: 'center'
                                        }}>
                                          <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            Bảo trì: {room.maintenanceNote || 'Sửa chữa'}
                                          </strong>
                                          <span style={{ fontSize: '10px', color: '#be123c', marginTop: '2px' }}>
                                            {room.maintenanceExpectedCompletion ? `Đến ${dayjs(room.maintenanceExpectedCompletion).format('DD/MM')}` : 'Không khả dụng'}
                                          </span>
                                        </div>
                                      </Tooltip>
                                    </td>
                                  );
                                }
                              }

                              // Available (Trống)
                              return (
                                <td key={i} style={{
                                  border: '1px solid #e8e0d5',
                                  padding: '8px',
                                  background: '#f8fafc',
                                  textAlign: 'center',
                                  color: '#8c8c8c',
                                  fontSize: '13px',
                                  cursor: 'default'
                                }}>
                                  <span style={{ opacity: 0.6, fontWeight: '500' }}>Trống</span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <Table 
              columns={columns} 
              dataSource={filteredRooms} 
              rowKey="id" 
              loading={loading}
              pagination={{ pageSize: 8 }}
            />
          )}
        </Space>
      </Card>

      <Modal
        title={editingRoom ? "Cập Nhật Thông Tin Phòng" : "Thêm Phòng Mới"}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: '16px' }}
          onFinish={handleModalSubmit}
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
              <Option value="reserved">Đã đặt cọc</Option>
              <Option value="occupied">Đang có khách ở</Option>
              <Option value="maintenance">Đang bảo trì / dọn dẹp</Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle dependencies={['status']}>
            {({ getFieldValue }) => {
              const status = getFieldValue('status');
              if (status === 'maintenance') {
                return (
                  <>
                    <Form.Item
                      name="maintenanceNote"
                      label="Lý do bảo trì"
                      rules={[{ required: true, message: 'Vui lòng nhập lý do bảo trì!' }]}
                    >
                      <Input placeholder="Ví dụ: Hỏng vòi nước, bảo dưỡng điều hòa..." />
                    </Form.Item>
                    <Form.Item
                      name="maintenanceExpectedCompletion"
                      label="Dự kiến hoàn thành"
                    >
                      <DatePicker style={{ width: '100%' }} placeholder="Chọn ngày dự kiến hoàn thành" />
                    </Form.Item>
                  </>
                );
              }
              return null;
            }}
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" block>
                {editingRoom ? "Cập nhật" : "Thêm mới"}
              </Button>
              <Button onClick={() => setModalVisible(false)} block>
                Hủy
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title="Chi tiết phòng"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedRoom && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="ID">{selectedRoom.id}</Descriptions.Item>
            <Descriptions.Item label="Số phòng">{selectedRoom.roomNumber}</Descriptions.Item>
            <Descriptions.Item label="Loại phòng">{selectedRoom.room_type_name}</Descriptions.Item>
            <Descriptions.Item label="Mô tả">{selectedRoom.room_type_description || '—'}</Descriptions.Item>
            <Descriptions.Item label="Tầng">{selectedRoom.floor}</Descriptions.Item>
            <Descriptions.Item label="Diện tích">{selectedRoom.area} m²</Descriptions.Item>
            <Descriptions.Item label="Giá/đêm">{formatPrice(selectedRoom.price_per_night)}</Descriptions.Item>
            <Descriptions.Item label="Sức chứa">{selectedRoom.capacity} người</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              {(() => {
                const statusColors = {
                  available: 'green',
                  occupied: 'blue',
                  reserved: 'orange',
                  maintenance: 'red'
                };
                const statusTexts = {
                  available: 'Trống',
                  occupied: 'Đang ở',
                  reserved: 'Đã cọc',
                  maintenance: 'Bảo trì'
                };
                const status = selectedRoom.status;
                return (
                  <Tag color={statusColors[status] || 'default'}>
                    {statusTexts[status] || status}
                  </Tag>
                );
              })()}
            </Descriptions.Item>
            {selectedRoom.status === 'maintenance' && (
              <>
                <Descriptions.Item label="Lý do bảo trì">
                  {selectedRoom.maintenanceNote || 'Không có ghi chú'}
                </Descriptions.Item>
                <Descriptions.Item label="Dự kiến hoàn thành">
                  {selectedRoom.maintenanceExpectedCompletion
                    ? dayjs(selectedRoom.maintenanceExpectedCompletion).format('DD/MM/YYYY')
                    : 'Chưa xác định'}
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* Booking Detail Modal */}
      <Modal
        title="Chi tiết đơn đặt phòng"
        open={bookingDetailVisible}
        onCancel={() => setBookingDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedBooking && (
          <div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Mã đặt phòng"><strong>#{selectedBooking.id || selectedBooking.bookingId}</strong></Descriptions.Item>
              <Descriptions.Item label="Khách hàng">{selectedBooking.customer_name || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">{selectedBooking.customer_phone || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Email">{selectedBooking.customer_email || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Thời gian ở">
                <strong>{dayjs(selectedBooking.check_in).format('DD/MM/YYYY')}</strong> đến <strong>{dayjs(selectedBooking.check_out).format('DD/MM/YYYY')}</strong>
                {' '}({dayjs(selectedBooking.check_out).diff(dayjs(selectedBooking.check_in), 'day')} đêm)
              </Descriptions.Item>
              <Descriptions.Item label="Hạng phòng & Số phòng">
                {selectedBooking.room_type_name || 'N/A'} - <strong>Phòng {selectedBooking.room_number || 'N/A'}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Số khách">{selectedBooking.adults} người lớn{selectedBooking.children > 0 ? `, ${selectedBooking.children} trẻ em` : ''}</Descriptions.Item>
              <Descriptions.Item label="Tổng tiền phòng">{formatPrice(selectedBooking.total_price)}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={
                  selectedBooking.status === 'checked_in' ? 'green' :
                  selectedBooking.status === 'confirmed' ? 'blue' :
                  selectedBooking.status === 'pending' ? 'orange' :
                  selectedBooking.status === 'checked_out' ? 'default' : 'red'
                }>
                  {selectedBooking.status === 'checked_in' ? 'Đang ở' :
                   selectedBooking.status === 'confirmed' ? 'Đã xác nhận' :
                   selectedBooking.status === 'pending' ? 'Chờ duyệt' :
                   selectedBooking.status === 'checked_out' ? 'Đã trả phòng' : 'Đã hủy'}
                </Tag>
              </Descriptions.Item>
              {selectedBooking.notes && (
                <Descriptions.Item label="Ghi chú">{selectedBooking.notes}</Descriptions.Item>
              )}
            </Descriptions>

            {/* Quick Actions */}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {selectedBooking.status === 'confirmed' && (
                <Button 
                  type="primary" 
                  style={{ backgroundColor: '#22c55e', borderColor: '#22c55e' }}
                  onClick={() => handleCalendarCheckIn(selectedBooking.id, selectedBooking.customer_name, selectedBooking.customer_phone)}
                >
                  Check-in nhanh
                </Button>
              )}
              {selectedBooking.status === 'checked_in' && (
                <Button 
                  type="primary" 
                  danger
                  onClick={() => handleCalendarCheckOut(selectedBooking.id)}
                >
                  Check-out nhanh
                </Button>
              )}
              <Button onClick={() => setBookingDetailVisible(false)}>Đóng</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Room Items Modal */}
      <Modal
        title={selectedRoom ? `Quản lý vật tư - Phòng ${selectedRoom.roomNumber}` : 'Quản lý vật tư'}
        open={roomItemsModalVisible}
        onCancel={() => setRoomItemsModalVisible(false)}
        footer={null}
        width={700}
      >
        <div style={{ marginBottom: 20, padding: 16, background: '#fbf9f6', borderRadius: 8, border: '1px solid #e8e0d5' }}>
          <Form form={itemForm} layout="vertical" onFinish={handleItemSubmit}>
            <Row gutter={16} align="bottom">
              <Col xs={24} sm={10}>
                <Form.Item
                  name="itemName"
                  label="Tên vật tư"
                  rules={[{ required: true, message: 'Nhập tên vật tư!' }]}
                  style={{ marginBottom: 0 }}
                >
                  <Input placeholder="Ví dụ: Máy sấy, Két sắt, Gối..." />
                </Form.Item>
              </Col>
              <Col xs={24} sm={5}>
                <Form.Item
                  name="quantity"
                  label="Số lượng"
                  rules={[{ required: true, message: 'Nhập số lượng!' }]}
                  initialValue={1}
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={5}>
                <Form.Item
                  name="status"
                  label="Trạng thái"
                  initialValue="normal"
                  style={{ marginBottom: 0 }}
                >
                  <Select style={{ width: '100%' }}>
                    <Option value="normal">Tốt</Option>
                    <Option value="damaged">Hỏng</Option>
                    <Option value="lost">Mất</Option>
                    <Option value="maintenance">Bảo trì</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={4}>
                <Space>
                  <Button type="primary" htmlType="submit">
                    {editingItem ? 'Lưu' : 'Thêm'}
                  </Button>
                  {editingItem && (
                    <Button onClick={() => {
                      setEditingItem(null);
                      itemForm.resetFields();
                    }}>
                      Hủy
                    </Button>
                  )}
                </Space>
              </Col>
            </Row>
          </Form>
        </div>

        <Table
          dataSource={roomItems}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 5 }}
          columns={[
            {
              title: 'Tên vật tư',
              dataIndex: 'itemName',
              key: 'itemName',
              render: (text) => <strong>{text}</strong>
            },
            {
              title: 'Số lượng',
              dataIndex: 'quantity',
              key: 'quantity',
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              key: 'status',
              render: (status) => {
                const colors: Record<string, string> = {
                  normal: 'green',
                  damaged: 'red',
                  lost: 'volcano',
                  maintenance: 'orange'
                };
                const texts: Record<string, string> = {
                  normal: 'Tốt',
                  damaged: 'Hỏng',
                  lost: 'Mất',
                  maintenance: 'Bảo trì'
                };
                return <Tag color={colors[status] || 'default'}>{texts[status] || status}</Tag>;
              }
            },
            {
              title: 'Thao tác',
              key: 'action',
              render: (_, record) => (
                <Space>
                  <Button size="small" type="link" onClick={() => handleEditItem(record)}>Sửa</Button>
                  <Popconfirm
                    title="Bạn có chắc muốn xóa vật tư này?"
                    onConfirm={() => handleDeleteItem(record.id)}
                    okText="Xóa"
                    cancelText="Hủy"
                  >
                    <Button size="small" type="link" danger>Xóa</Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </Modal>

      {/* Bulk Room Creation Modal */}
      <Modal
        title="Thêm phòng hàng loạt (Xem trước & Tùy chỉnh)"
        open={bulkModalVisible}
        onCancel={() => setBulkModalVisible(false)}
        footer={[
          <Button key="back" onClick={() => setBulkModalVisible(false)}>
            Hủy
          </Button>,
          <Button key="submit" type="primary" onClick={handleBulkSubmit} loading={loading}>
            Xác nhận tạo phòng
          </Button>,
        ]}
        width={750}
      >
        <div style={{ padding: '12px 16px', background: '#fbf9f6', borderRadius: 8, border: '1px solid #e8e0d5', marginBottom: 16 }}>
          <Form form={bulkForm} layout="vertical">
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="startRoomNumber"
                  label="Số phòng bắt đầu"
                  rules={[{ required: true, message: 'Nhập số phòng bắt đầu!' }]}
                >
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="Ví dụ: 101" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="count"
                  label="Số lượng cần tạo"
                  rules={[{ required: true, message: 'Nhập số lượng phòng!' }]}
                  initialValue={5}
                >
                  <InputNumber min={1} max={50} style={{ width: '100%' }} placeholder="Ví dụ: 5" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="floor"
                  label="Tầng"
                  rules={[{ required: true, message: 'Nhập số tầng!' }]}
                  initialValue={1}
                >
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="Ví dụ: 1" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="roomTypeId"
                  label="Hạng phòng mặc định"
                  rules={[{ required: true, message: 'Chọn hạng phòng mặc định!' }]}
                >
                  <Select placeholder="Chọn hạng phòng mặc định">
                    {roomTypes.map(t => (
                      <Option key={t.id} value={t.id}>{t.typeName}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="area"
                  label="Diện tích mặc định (m²)"
                  initialValue={25}
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <div style={{ textAlign: 'right' }}>
              <Button type="dashed" onClick={handleGeneratePreview} style={{ borderColor: '#ab8965', color: '#ab8965' }}>
                Tạo bảng xem trước
              </Button>
            </div>
          </Form>
        </div>

        {bulkPreviewRooms.length > 0 && (
          <div>
            <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#ab8965' }}>
              Bảng xem trước ({bulkPreviewRooms.length} phòng) - Bạn có thể đổi hạng phòng/số phòng trực tiếp:
            </div>
            <Table
              dataSource={bulkPreviewRooms}
              rowKey="key"
              size="small"
              pagination={{ pageSize: 5 }}
              columns={[
                {
                  title: 'Số phòng',
                  dataIndex: 'roomNumber',
                  key: 'roomNumber',
                  render: (text: string, record: any) => (
                    <Input 
                      value={text} 
                      onChange={e => handlePreviewRoomChange(record.key, 'roomNumber', e.target.value)} 
                      style={{ width: 100 }}
                    />
                  )
                },
                {
                  title: 'Tầng',
                  dataIndex: 'floor',
                  key: 'floor',
                  render: (value: number, record: any) => (
                    <InputNumber 
                      min={1} 
                      value={value} 
                      onChange={val => handlePreviewRoomChange(record.key, 'floor', val)} 
                      style={{ width: 80 }}
                    />
                  )
                },
                {
                  title: 'Hạng phòng',
                  dataIndex: 'roomTypeId',
                  key: 'roomTypeId',
                  render: (value: number, record: any) => (
                    <Select 
                      value={value} 
                      onChange={val => handlePreviewRoomChange(record.key, 'roomTypeId', val)} 
                      style={{ width: 150 }}
                    >
                      {roomTypes.map(t => (
                        <Option key={t.id} value={t.id}>{t.typeName}</Option>
                      ))}
                    </Select>
                  )
                },
                {
                  title: 'Diện tích (m²)',
                  dataIndex: 'area',
                  key: 'area',
                  render: (value: number, record: any) => (
                    <InputNumber 
                      min={1} 
                      value={value} 
                      onChange={val => handlePreviewRoomChange(record.key, 'area', val)} 
                      style={{ width: 90 }}
                    />
                  )
                },
                {
                  title: 'Hành động',
                  key: 'action',
                  render: (_, record: any) => (
                    <Button 
                      type="link" 
                      danger 
                      onClick={() => setBulkPreviewRooms(prev => prev.filter(item => item.key !== record.key))}
                    >
                      Xóa
                    </Button>
                  )
                }
              ]}
            />
          </div>
        )}
      </Modal>

      {/* Quick Maintenance Setup Modal */}
      <Modal
        title={quickMaintRoom ? `Cài đặt bảo trì - Phòng ${quickMaintRoom.roomNumber}` : 'Cài đặt bảo trì'}
        open={quickMaintModalVisible}
        onCancel={() => setQuickMaintModalVisible(false)}
        onOk={handleQuickMaintSubmit}
        okText="Xác nhận bảo trì"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form form={quickMaintForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="maintenanceNote"
            label="Lý do bảo trì"
            rules={[{ required: true, message: 'Vui lòng nhập lý do bảo trì!' }]}
          >
            <Input placeholder="Ví dụ: Hỏng vòi nước, sửa tivi, vệ sinh điều hòa..." />
          </Form.Item>
          <Form.Item
            name="maintenanceExpectedCompletion"
            label="Ngày dự kiến hoàn thành"
          >
            <DatePicker style={{ width: '100%' }} placeholder="Chọn ngày hoàn thành dự kiến" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default RoomManagement;

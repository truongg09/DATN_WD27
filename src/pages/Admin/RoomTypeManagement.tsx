import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Space,
  Card,
  Select,
  Tag,
  Row,
  Col,
  Descriptions
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, DownOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
import api from '../../services/api';

const { TextArea } = Input;
const { Option } = Select;

interface RoomType {
  id: number;
  typeName: string;
  description: string;
  capacity: number;
  defaultPrice: string | number;
  roomCount?: number;
  availableCount?: number;
  occupiedCount?: number;
  maintenanceCount?: number;
  reservedCount?: number;
  roomNumbers?: string;
  amenityIds?: string;
  status: 'active' | 'inactive';
}

interface Amenity {
  id: number;
  name: string;
  icon?: string;
}

function RoomTypeManagement() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingType, setEditingType] = useState<RoomType | null>(null);
  const [selectedType, setSelectedType] = useState<RoomType | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');

  const totalTypes = roomTypes.length;
  const activeTypes = roomTypes.filter(t => t.status === 'active' || !t.status).length;
  const inactiveTypes = roomTypes.filter(t => t.status === 'inactive').length;

  const filteredRoomTypes = roomTypes.filter(type => {
    const searchLower = searchText.toLowerCase();
    return (
      type.typeName.toLowerCase().includes(searchLower) ||
      (type.description && type.description.toLowerCase().includes(searchLower))
    );
  });

  const groupAmenities = (items: Amenity[]) => {
    const groups: Record<string, Amenity[]> = {
      'Tiện nghi phòng (Room Amenities)': [],
      'Tiện ích khách sạn (Hotel Facilities)': [],
      'Dịch vụ đi kèm (Services & Benefits)': [],
      'Khác (Others)': []
    };

    items.forEach(item => {
      const name = item.name.toLowerCase();
      if (
        name.includes('wifi') || 
        name.includes('tv') || 
        name.includes('tivi') || 
        name.includes('air conditioner') || 
        name.includes('điều hòa') || 
        name.includes('bathtub') || 
        name.includes('bồn tắm') || 
        name.includes('balcony') || 
        name.includes('ban công') || 
        name.includes('minibar') ||
        name.includes('tủ lạnh')
      ) {
        groups['Tiện nghi phòng (Room Amenities)'].push(item);
      } else if (
        name.includes('pool') || 
        name.includes('bể bơi') || 
        name.includes('gym') || 
        name.includes('fitness') || 
        name.includes('parking') || 
        name.includes('đỗ xe') ||
        name.includes('bãi xe')
      ) {
        groups['Tiện ích khách sạn (Hotel Facilities)'].push(item);
      } else if (
        name.includes('buffet') || 
        name.includes('sáng') || 
        name.includes('breakfast') || 
        name.includes('ăn uống') ||
        name.includes('nhà hàng')
      ) {
        groups['Dịch vụ đi kèm (Services & Benefits)'].push(item);
      } else {
        groups['Khác (Others)'].push(item);
      }
    });

    return Object.entries(groups).filter(([_, list]) => list.length > 0);
  };

  const fetchRoomTypes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/rooms/types');
      setRoomTypes(response.data || response);
    } catch (error) {
      console.error('Error fetching room types:', error);
      message.error('Lỗi khi tải danh sách hạng phòng');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStatusChange = async (id: number, newStatus: 'active' | 'inactive', record: RoomType) => {
    try {
      const updatedValues = {
        typeName: record.typeName,
        capacity: record.capacity,
        defaultPrice: typeof record.defaultPrice === 'number' ? record.defaultPrice : parseFloat(record.defaultPrice) || 0,
        description: record.description,
        status: newStatus,
        // Backend xóa sạch tiện nghi rồi ghi lại theo amenityIds. Không gửi kèm
        // danh sách hiện tại thì chỉ đổi trạng thái cũng làm mất hết tiện nghi.
        amenityIds: record.amenityIds ? record.amenityIds.split(',').map(Number) : []
      };
      await api.put(`/rooms/types/${id}`, updatedValues);
      message.success(`Đã đổi trạng thái hạng phòng ${record.typeName} thành công`);
      fetchRoomTypes();
    } catch (error: unknown) {
      console.error('Quick status change error:', error);
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      message.error(msg || 'Lỗi khi cập nhật trạng thái hạng phòng');
    }
  };

  const fetchAmenities = async () => {
    try {
      const response = await api.get('/amenities');
      setAmenities(response.data || response);
    } catch (error) {
      console.error('Error fetching amenities:', error);
    }
  };

  useEffect(() => {
    fetchRoomTypes();
    fetchAmenities();
  }, []);

  const handleAdd = () => {
    setEditingType(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (type: RoomType) => {
    setEditingType(type);
    form.setFieldsValue({
      typeName: type.typeName,
      capacity: type.capacity,
      defaultPrice: typeof type.defaultPrice === 'number' ? type.defaultPrice : parseFloat(type.defaultPrice) || 0,
      description: type.description,
      status: type.status || 'active',
      amenityIds: type.amenityIds ? type.amenityIds.split(',').map(Number) : []
    });
    setModalVisible(true);
  };

  const handleViewDetail = (type: RoomType) => {
    setSelectedType(type);
    setDetailModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/rooms/types/${id}`);
      message.success('Xóa hạng phòng thành công');
      fetchRoomTypes();
    } catch (error: unknown) {
      console.error('Error deleting room type:', error);
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      message.error(msg || 'Lỗi khi xóa hạng phòng');
    }
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingType) {
        // Update
        await api.put(`/rooms/types/${editingType.id}`, values);
        message.success('Cập nhật hạng phòng thành công');
      } else {
        // Create
        await api.post('/rooms/types', values);
        message.success('Thêm hạng phòng mới thành công');
      }
      setModalVisible(false);
      fetchRoomTypes();
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
      title: 'Tên hạng phòng',
      dataIndex: 'typeName',
      key: 'typeName',
      sorter: (a: RoomType, b: RoomType) => a.typeName.localeCompare(b.typeName),
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: 'Sức chứa',
      dataIndex: 'capacity',
      key: 'capacity',
      sorter: (a: RoomType, b: RoomType) => a.capacity - b.capacity,
      render: (capacity: number) => `${capacity} người`
    },
    {
      title: 'Số lượng phòng',
      dataIndex: 'roomCount',
      key: 'roomCount',
      sorter: (a: RoomType, b: RoomType) => (a.roomCount || 0) - (b.roomCount || 0),
      render: (count: number, record: RoomType) => (
        <div>
          <div style={{ marginBottom: 4 }}><strong>{count || 0} phòng</strong></div>
          {count > 0 && (
            <Space size={4} wrap>
              {record.availableCount !== undefined && record.availableCount > 0 && (
                <Tag color="green" style={{ margin: 0, fontSize: '11px', padding: '0 4px' }}>
                  {record.availableCount} trống
                </Tag>
              )}
              {record.occupiedCount !== undefined && record.occupiedCount > 0 && (
                <Tag color="blue" style={{ margin: 0, fontSize: '11px', padding: '0 4px' }}>
                  {record.occupiedCount} ở
                </Tag>
              )}
              {record.reservedCount !== undefined && record.reservedCount > 0 && (
                <Tag color="orange" style={{ margin: 0, fontSize: '11px', padding: '0 4px' }}>
                  {record.reservedCount} cọc
                </Tag>
              )}
              {record.maintenanceCount !== undefined && record.maintenanceCount > 0 && (
                <Tag color="red" style={{ margin: 0, fontSize: '11px', padding: '0 4px' }}>
                  {record.maintenanceCount} bảo trì
                </Tag>
              )}
            </Space>
          )}
        </div>
      )
    },
    {
      title: 'Giá mặc định / đêm',
      dataIndex: 'defaultPrice',
      key: 'defaultPrice',
      sorter: (a: RoomType, b: RoomType) => (parseFloat(a.defaultPrice as string) || 0) - (parseFloat(b.defaultPrice as string) || 0),
      render: (price: string | number) => formatPrice(price)
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: 'active' | 'inactive', record: RoomType) => {
        return (
          <Select
            value={status || 'active'}
            onChange={(newStatus) => handleQuickStatusChange(record.id, newStatus, record)}
            style={{ width: 140 }}
            bordered={false}
            popupMatchSelectWidth={false}
            suffixIcon={<DownOutlined style={{ fontSize: '10px', color: '#bfbfbf' }} />}
          >
            <Option value="active">
              <Tag style={{ cursor: 'pointer', margin: 0, backgroundColor: '#bbf7d0', color: '#166534', borderColor: '#86efac' }}>Hoạt động</Tag>
            </Option>
            <Option value="inactive">
              <Tag style={{ cursor: 'pointer', margin: 0, backgroundColor: '#fecdd3', color: '#9f1239', borderColor: '#fda4af' }}>Ngừng hoạt động</Tag>
            </Option>
          </Select>
        );
      }
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: RoomType) => (
        <Space>
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
            description="Lưu ý: Chỉ xóa được hạng phòng khi không có phòng nào thuộc hạng này."
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
    }
  ];

  return (
    <Card
      title="Quản lý hạng phòng"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchRoomTypes} loading={loading}>
            Tải lại
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            Thêm hạng phòng
          </Button>
        </Space>
      }
      style={{ margin: 24 }}
    >
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card style={{ backgroundColor: '#e2e8f0', borderLeft: '4px solid #334155', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#334155', fontSize: '14px', fontWeight: '500' }}>Tổng số hạng phòng</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>{totalTypes}</div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={{ backgroundColor: '#bbf7d0', borderLeft: '4px solid #15803d', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#166534', fontSize: '14px', fontWeight: '500' }}>Hoạt động</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#14532d', marginTop: '4px' }}>{activeTypes}</div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={{ backgroundColor: '#fecdd3', borderLeft: '4px solid #be123c', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#9f1239', fontSize: '14px', fontWeight: '500' }}>Ngừng hoạt động</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#881337', marginTop: '4px' }}>{inactiveTypes}</div>
            </Card>
          </Col>
        </Row>

        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <Input.Search
            placeholder="Tìm kiếm theo tên hạng phòng hoặc mô tả..."
            allowClear
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 350 }}
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredRoomTypes}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Space>

      <Modal
        title={editingType ? 'Chỉnh sửa hạng phòng' : 'Thêm hạng phòng mới'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
          onFinish={handleModalSubmit}
        >
          <Form.Item
            name="typeName"
            label="Tên hạng phòng"
            rules={[{ required: true, message: 'Vui lòng nhập tên hạng phòng!' }]}
          >
            <Input placeholder="Ví dụ: Standard, Deluxe, Suite..." />
          </Form.Item>

          <Form.Item
            name="capacity"
            label="Sức chứa (người)"
            rules={[{ required: true, message: 'Vui lòng nhập sức chứa!' }]}
            initialValue={2}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="defaultPrice"
            label="Giá mặc định / đêm (VNĐ)"
            rules={[{ required: true, message: 'Vui lòng nhập giá mặc định!' }]}
            initialValue={500000}
          >
            <InputNumber
              min={0}
              style={{ width: '100%' }}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => (value ? value.replace(/\$\s?|(,*)/g, '') : '') as any}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Mô tả hạng phòng"
          >
            <TextArea rows={4} placeholder="Nhập mô tả chi tiết về dịch vụ, tiện nghi của hạng phòng..." />
          </Form.Item>

          <Form.Item
            name="amenityIds"
            label="Tiện nghi của hạng phòng"
          >
            <Select
              mode="multiple"
              placeholder="Chọn các tiện nghi (Wifi, Tivi, Điều hòa...)"
              allowClear
              optionFilterProp="label"
              style={{ width: '100%' }}
            >
              {groupAmenities(amenities).map(([groupName, groupItems]) => (
                <Select.OptGroup key={groupName} label={groupName}>
                  {groupItems.map(item => (
                    <Option key={item.id} value={item.id} label={item.name}>
                      {item.name}
                    </Option>
                  ))}
                </Select.OptGroup>
              ))}
            </Select>
          </Form.Item>



          <Form.Item
            name="status"
            label="Trạng thái"
            initialValue="active"
            rules={[{ required: true, message: 'Vui lòng chọn trạng thái!' }]}
          >
            <Select>
              <Option value="active">Hoạt động</Option>
              <Option value="inactive">Ngừng hoạt động</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" block>
                {editingType ? 'Cập nhật' : 'Thêm mới'}
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
        title="Chi tiết hạng phòng"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedType && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="ID">{selectedType.id}</Descriptions.Item>
            <Descriptions.Item label="Tên hạng phòng">{selectedType.typeName}</Descriptions.Item>
            <Descriptions.Item label="Sức chứa">{selectedType.capacity} người</Descriptions.Item>
            <Descriptions.Item label="Số lượng phòng">{selectedType.roomCount || 0} phòng</Descriptions.Item>
            <Descriptions.Item label="Danh sách số phòng">
              {selectedType.roomNumbers ? (
                selectedType.roomNumbers.split(', ').map(num => (
                  <Tag color="blue" key={num} style={{ margin: '2px' }}>{num}</Tag>
                ))
              ) : (
                <span style={{ color: '#ccc' }}>Không có phòng nào thuộc hạng này</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Giá mặc định">{formatPrice(selectedType.defaultPrice)}</Descriptions.Item>
            <Descriptions.Item label="Tiện nghi">
              {selectedType.amenityIds ? (
                selectedType.amenityIds.split(',').map(idStr => {
                  const amId = Number(idStr);
                  const found = amenities.find(a => a.id === amId);
                  return found ? (
                    <Tag color="purple" key={amId} style={{ margin: '2px' }}>{found.name}</Tag>
                  ) : null;
                })
              ) : (
                <span style={{ color: '#ccc' }}>Chưa thiết lập tiện nghi</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Mô tả">{selectedType.description || '—'}</Descriptions.Item>

            <Descriptions.Item label="Trạng thái">
              <Tag color={selectedType.status === 'active' ? 'green' : 'orange'}>
                {selectedType.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Card>
  );
}

export default RoomTypeManagement;

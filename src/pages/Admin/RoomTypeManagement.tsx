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
  Descriptions,
  Divider,
  DatePicker,
  Tooltip,
  Radio
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  DownOutlined,
  EyeOutlined,
  DollarCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';
import api from '../../services/api';
import {
  getRoomPrices,
  createRoomPrice,
  updateRoomPrice,
  deleteRoomPrice
} from '../../services/roomService';
import type { RoomPriceRule } from '../../services/roomService';

const { TextArea } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface RoomType {
  id: number;
  typeName: string;
  description: string;
  capacity: number;
  adultCapacity?: number;
  childCapacity?: number;
  maxOccupancy?: number;
  extraAdultFee?: number | string;
  extraChildFee?: number | string;
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

  // ── State quản lý giá theo ngày lễ / cuối tuần / ngày thường ──
  const [pricingModalVisible, setPricingModalVisible] = useState(false);
  const [priceRules, setPriceRules] = useState<RoomPriceRule[]>([]);
  const [priceLoading, setPriceLoading] = useState(false);
  const [selectedTypeIdForPrice, setSelectedTypeIdForPrice] = useState<number | null>(null);
  const [editingPriceRule, setEditingPriceRule] = useState<RoomPriceRule | null>(null);
  const [priceRuleFormVisible, setPriceRuleFormVisible] = useState(false);
  const [priceForm] = Form.useForm();

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
        adultCapacity: record.adultCapacity,
        childCapacity: record.childCapacity,
        maxOccupancy: record.maxOccupancy,
        extraAdultFee: typeof record.extraAdultFee === 'number' ? record.extraAdultFee : parseFloat(record.extraAdultFee as string) || 0,
        extraChildFee: typeof record.extraChildFee === 'number' ? record.extraChildFee : parseFloat(record.extraChildFee as string) || 0,
        defaultPrice: typeof record.defaultPrice === 'number' ? record.defaultPrice : parseFloat(record.defaultPrice) || 0,
        description: record.description,
        status: newStatus,
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

  const fetchPriceRules = async (typeId?: number | null) => {
    setPriceLoading(true);
    try {
      const res = await getRoomPrices(typeId ? { roomTypeId: typeId } : undefined);
      setPriceRules(res.data?.data || []);
    } catch {
      message.error('Không thể tải danh sách bảng giá');
    } finally {
      setPriceLoading(false);
    }
  };

  const handleOpenPricingModal = (typeRecord?: RoomType) => {
    const targetId = typeRecord ? typeRecord.id : null;
    setSelectedTypeIdForPrice(targetId);
    setPricingModalVisible(true);
    fetchPriceRules(targetId);
  };

  const handleOpenAddPriceRule = () => {
    setEditingPriceRule(null);
    priceForm.resetFields();
    priceForm.setFieldsValue({
      roomTypeId: selectedTypeIdForPrice || (roomTypes.length > 0 ? roomTypes[0].id : undefined),
      priceType: 'weekend',
      dateRange: [dayjs().startOf('year'), dayjs().endOf('year')],
      price: 600000,
      note: 'Giá cuối tuần (Thứ 7 & Chủ nhật)'
    });
    setPriceRuleFormVisible(true);
  };

  const handleOpenEditPriceRule = (rule: RoomPriceRule) => {
    setEditingPriceRule(rule);
    priceForm.setFieldsValue({
      roomTypeId: rule.roomTypeId,
      priceType: rule.priceType,
      dateRange: [dayjs(rule.startDate), dayjs(rule.endDate)],
      price: rule.price,
      note: rule.note
    });
    setPriceRuleFormVisible(true);
  };

  const handleSavePriceRule = async () => {
    try {
      const values = await priceForm.validateFields();
      const payload: Partial<RoomPriceRule> = {
        roomTypeId: values.roomTypeId || null,
        priceType: values.priceType,
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
        price: Number(values.price),
        note: values.note ? String(values.note).trim() : null
      };

      if (editingPriceRule) {
        await updateRoomPrice(editingPriceRule.id, payload);
        message.success('Cập nhật quy tắc giá thành công!');
      } else {
        await createRoomPrice(payload);
        message.success('Thêm quy tắc giá thành công!');
      }
      setPriceRuleFormVisible(false);
      fetchPriceRules(selectedTypeIdForPrice);
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Có lỗi xảy ra khi lưu bảng giá');
    }
  };

  const handleDeletePriceRule = async (id: number) => {
    try {
      await deleteRoomPrice(id);
      message.success('Đã xóa quy tắc giá');
      fetchPriceRules(selectedTypeIdForPrice);
    } catch {
      message.error('Không thể xóa quy tắc giá');
    }
  };

  const handleAdd = () => {
    setEditingType(null);
    form.resetFields();
    form.setFieldsValue({
      typeName: '',
      capacity: 2,
      adultCapacity: 2,
      childCapacity: 1,
      maxOccupancy: 3,
      extraAdultFee: 200000,
      extraChildFee: 100000,
      defaultPrice: 500000,
      status: 'active',
      description: '',
      amenityIds: []
    });
    setModalVisible(true);
  };

  const handleEdit = (type: RoomType) => {
    setEditingType(type);
    const parsedExtraAdult = typeof type.extraAdultFee === 'number' ? type.extraAdultFee : parseFloat(type.extraAdultFee as string);
    const parsedExtraChild = typeof type.extraChildFee === 'number' ? type.extraChildFee : parseFloat(type.extraChildFee as string);

    form.setFieldsValue({
      typeName: type.typeName,
      capacity: type.capacity,
      adultCapacity: type.adultCapacity ?? type.capacity ?? 2,
      childCapacity: type.childCapacity ?? 1,
      maxOccupancy: type.maxOccupancy ?? (type.adultCapacity ? (type.adultCapacity + (type.childCapacity || 0)) : type.capacity) ?? 3,
      extraAdultFee: !isNaN(parsedExtraAdult) ? parsedExtraAdult : 200000,
      extraChildFee: !isNaN(parsedExtraChild) ? parsedExtraChild : 100000,
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
      const payload = {
        ...values,
        capacity: values.maxOccupancy ?? values.capacity ?? values.adultCapacity ?? 2,
      };
      if (editingType) {
        // Update
        await api.put(`/rooms/types/${editingType.id}`, payload);
        message.success('Cập nhật hạng phòng thành công');
      } else {
        // Create
        await api.post('/rooms/types', payload);
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
      key: 'capacity',
      sorter: (a: RoomType, b: RoomType) => (a.maxOccupancy ?? a.capacity) - (b.maxOccupancy ?? b.capacity),
      render: (_: unknown, record: RoomType) => {
        const adult = record.adultCapacity ?? record.capacity ?? 2;
        const child = record.childCapacity ?? 0;
        const max = record.maxOccupancy ?? record.capacity ?? (adult + child);
        return (
          <div style={{ lineHeight: '1.4' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '12px' }}>Tiêu chuẩn: </span>
              <strong>{adult} NL{child > 0 ? ` + ${child} TE` : ''}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '12px' }}>Tối đa: </span>
              <Tag color="blue" style={{ margin: 0, fontSize: '11px', padding: '0 4px' }}>
                {max} khách
              </Tag>
            </div>
          </div>
        );
      }
    },
    {
      title: 'Phụ thu phát sinh',
      key: 'extraFees',
      render: (_: unknown, record: RoomType) => {
        const adultFee = typeof record.extraAdultFee === 'number' ? record.extraAdultFee : parseFloat(record.extraAdultFee as string) || 0;
        const childFee = typeof record.extraChildFee === 'number' ? record.extraChildFee : parseFloat(record.extraChildFee as string) || 0;
        return (
          <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
            <div><span style={{ color: '#475569' }}>NL:</span> <strong>{new Intl.NumberFormat('vi-VN').format(adultFee)}đ</strong></div>
            <div><span style={{ color: '#475569' }}>TE:</span> <strong>{new Intl.NumberFormat('vi-VN').format(childFee)}đ</strong></div>
            <div style={{ color: '#94a3b8', fontSize: '10px' }}>/người/đêm</div>
          </div>
        );
      }
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
      title: 'Thao tác',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: RoomType) => (
        <Space>
          <Tooltip title="Xem chi tiết hạng phòng">
            <Button
              type="primary"
              icon={<EyeOutlined style={{ color: 'white' }} />}
              size="small"
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          <Tooltip title="Cấu hình bảng giá (Lễ / Chủ nhật / Ngày thường)">
            <Button
              style={{ backgroundColor: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}
              icon={<DollarCircleOutlined />}
              size="small"
              onClick={() => handleOpenPricingModal(record)}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa hạng phòng">
            <Button
              type="primary"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
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
            />
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
          <Button
            style={{ backgroundColor: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}
            icon={<DollarCircleOutlined />}
            onClick={() => handleOpenPricingModal()}
          >
            Bảng giá Lễ & Chủ nhật
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
        width={650}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
          onFinish={handleModalSubmit}
        >
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="typeName"
                label="Tên hạng phòng"
                rules={[{ required: true, message: 'Vui lòng nhập tên hạng phòng!' }]}
              >
                <Input placeholder="Ví dụ: Standard, Deluxe, Suite..." />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="defaultPrice"
                label="Giá mặc định / đêm (VNĐ)"
                rules={[{ required: true, message: 'Vui lòng nhập giá mặc định!' }]}
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => (value ? value.replace(/\$\s?|(,*)/g, '') : '') as any}
                />
              </Form.Item>
            </Col>
          </Row>

          <Card type="inner" title="Thiết lập Sức chứa phòng" style={{ marginBottom: 16, backgroundColor: '#f8fafc' }}>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="adultCapacity"
                  label="NL tiêu chuẩn"
                  tooltip="Số người lớn mặc định cho 1 phòng"
                  rules={[
                    { required: true, message: 'Nhập số NL tiêu chuẩn!' },
                    { type: 'number', min: 1, message: 'Tối thiểu 1 người lớn!' }
                  ]}
                >
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="2" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="childCapacity"
                  label="TE tiêu chuẩn"
                  tooltip="Số trẻ em mặc định cho 1 phòng"
                  rules={[
                    { required: true, message: 'Nhập số TE tiêu chuẩn!' },
                    { type: 'number', min: 0, message: 'Không được nhỏ hơn 0!' }
                  ]}
                >
                  <InputNumber min={0} style={{ width: '100%' }} placeholder="1" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="maxOccupancy"
                  label="Sức chứa tối đa"
                  tooltip="Tổng số khách tối đa (NL+TE) cho 1 phòng"
                  rules={[
                    { required: true, message: 'Nhập tổng sức chứa tối đa!' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const adult = getFieldValue('adultCapacity') || 0;
                        const child = getFieldValue('childCapacity') || 0;
                        if (value !== undefined && value < adult + child) {
                          return Promise.reject(new Error(`Sức chứa tối đa (${value}) phải lớn hơn hoặc bằng tổng sức chứa tiêu chuẩn (${adult + child})`));
                        }
                        return Promise.resolve();
                      }
                    })
                  ]}
                >
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="3" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card type="inner" title="Đơn giá Phụ thu Khách phát sinh (/người/đêm)" style={{ marginBottom: 16, backgroundColor: '#f8fafc' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="extraAdultFee"
                  label="Phụ thu Người lớn"
                  rules={[
                    { required: true, message: 'Vui lòng nhập phụ thu người lớn!' },
                    { type: 'number', min: 0, message: 'Không được nhỏ hơn 0!' }
                  ]}
                >
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value) => (value ? value.replace(/\$\s?|(,*)/g, '') : '') as any}
                    addonAfter="VNĐ"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="extraChildFee"
                  label="Phụ thu Trẻ em"
                  rules={[
                    { required: true, message: 'Vui lòng nhập phụ thu trẻ em!' },
                    { type: 'number', min: 0, message: 'Không được nhỏ hơn 0!' }
                  ]}
                >
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value) => (value ? value.replace(/\$\s?|(,*)/g, '') : '') as any}
                    addonAfter="VNĐ"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Form.Item
            name="description"
            label="Mô tả hạng phòng"
          >
            <TextArea rows={3} placeholder="Nhập mô tả chi tiết về dịch vụ, tiện nghi của hạng phòng..." />
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
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalVisible(false)}>
                Hủy
              </Button>
              <Button type="primary" htmlType="submit">
                {editingType ? 'Cập nhật' : 'Thêm mới'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={null}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={860}
        styles={{ body: { maxHeight: '76vh', overflowY: 'auto', paddingTop: 8 } }}
      >
        {selectedType && (() => {
          const adult = selectedType.adultCapacity ?? selectedType.capacity ?? 2;
          const child = selectedType.childCapacity ?? 0;
          const standardTotal = adult + child;
          const maxOccupancy = selectedType.maxOccupancy ?? selectedType.capacity ?? standardTotal;
          const adultFee = selectedType.extraAdultFee !== undefined
            ? (typeof selectedType.extraAdultFee === 'number' ? selectedType.extraAdultFee : parseFloat(selectedType.extraAdultFee as string) || 0)
            : undefined;
          const childFee = selectedType.extraChildFee !== undefined
            ? (typeof selectedType.extraChildFee === 'number' ? selectedType.extraChildFee : parseFloat(selectedType.extraChildFee as string) || 0)
            : undefined;
          const roomNumberTags = selectedType.roomNumbers
            ? selectedType.roomNumbers.split(',').map(n => n.trim()).filter(Boolean)
            : [];
          const selectedAmenities = selectedType.amenityIds
            ? selectedType.amenityIds.split(',').map(idStr => amenities.find(a => a.id === Number(idStr))).filter(Boolean) as Amenity[]
            : [];

          return (
            <div>
              {/* HEADER */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{selectedType.typeName}</div>
                  <div style={{ fontSize: 13, color: '#8c8c8c', marginTop: 2 }}>ID #{selectedType.id}</div>
                </div>
                <Tag color={selectedType.status === 'active' ? 'green' : 'red'} style={{ fontSize: 13, padding: '4px 12px', fontWeight: 600 }}>
                  {selectedType.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động'}
                </Tag>
              </div>

              <Divider style={{ margin: '16px 0' }} />

              {/* A. THÔNG TIN CHUNG */}
              <div style={{ fontWeight: 700, color: '#ab8965', marginBottom: 10, letterSpacing: 0.3 }}>THÔNG TIN CHUNG</div>
              <Descriptions bordered column={2} size="small" style={{ marginBottom: 20 }}>
                <Descriptions.Item label="ID">{selectedType.id}</Descriptions.Item>
                <Descriptions.Item label="Tên hạng phòng"><strong>{selectedType.typeName}</strong></Descriptions.Item>
                <Descriptions.Item label="Trạng thái" span={2}>
                  <Tag color={selectedType.status === 'active' ? 'green' : 'red'} style={{ margin: 0 }}>
                    {selectedType.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>

              {selectedType.description && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, color: '#ab8965', marginBottom: 8, letterSpacing: 0.3 }}>MÔ TẢ</div>
                  <div style={{ background: '#fbf9f6', padding: '10px 14px', borderRadius: 8, border: '1px solid #e8e0d5', color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
                    {selectedType.description}
                  </div>
                </div>
              )}

              <Divider style={{ margin: '16px 0' }} />

              {/* B & C. GIÁ & SỨC CHỨA */}
              <div style={{ fontWeight: 700, color: '#ab8965', marginBottom: 10, letterSpacing: 0.3 }}>GIÁ &amp; SỨC CHỨA</div>
              <Row gutter={12} style={{ marginBottom: 20 }}>
                <Col xs={24} sm={24} md={8}>
                  <Card size="small" style={{ background: '#fbf9f6', border: '1px solid #e8e0d5', height: '100%' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Giá mặc định / đêm</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#ab8965', marginTop: 4 }}>
                      {formatPrice(selectedType.defaultPrice)}
                    </div>
                  </Card>
                </Col>
                <Col xs={12} sm={12} md={4}>
                  <Card size="small" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', height: '100%' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>NL tiêu chuẩn</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#334155', marginTop: 4 }}>{adult}</div>
                  </Card>
                </Col>
                <Col xs={12} sm={12} md={4}>
                  <Card size="small" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', height: '100%' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>TE tiêu chuẩn</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#334155', marginTop: 4 }}>{child}</div>
                  </Card>
                </Col>
                <Col xs={12} sm={12} md={4}>
                  <Card size="small" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', height: '100%' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Tổng tiêu chuẩn</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#334155', marginTop: 4 }}>{standardTotal} khách</div>
                  </Card>
                </Col>
                <Col xs={12} sm={12} md={4}>
                  <Card size="small" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', height: '100%' }}>
                    <div style={{ fontSize: 12, color: '#1e40af' }}>Sức chứa tối đa</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#1e3a8a', marginTop: 4 }}>{maxOccupancy} khách</div>
                  </Card>
                </Col>
              </Row>

              <Divider style={{ margin: '16px 0' }} />

              {/* D. PHỤ THU PHÁT SINH */}
              <div style={{ fontWeight: 700, color: '#ab8965', marginBottom: 10, letterSpacing: 0.3 }}>CHÍNH SÁCH PHỤ THU KHÁCH PHÁT SINH</div>
              <Row gutter={12} style={{ marginBottom: 20 }}>
                <Col xs={24} sm={12}>
                  <Card size="small" style={{ background: '#fff7ed', border: '1px solid #fed7aa', height: '100%' }}>
                    <div style={{ fontSize: 12, color: '#9a3412' }}>Phụ thu người lớn</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#7c2d12', marginTop: 4 }}>
                      {adultFee !== undefined ? formatPrice(adultFee) : 'Chưa thiết lập'}
                    </div>
                    <div style={{ fontSize: 11, color: '#9a3412', marginTop: 2 }}>/ người / đêm</div>
                  </Card>
                </Col>
                <Col xs={24} sm={12}>
                  <Card size="small" style={{ background: '#fff7ed', border: '1px solid #fed7aa', height: '100%' }}>
                    <div style={{ fontSize: 12, color: '#9a3412' }}>Phụ thu trẻ em</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#7c2d12', marginTop: 4 }}>
                      {childFee !== undefined ? formatPrice(childFee) : 'Chưa thiết lập'}
                    </div>
                    <div style={{ fontSize: 11, color: '#9a3412', marginTop: 2 }}>/ người / đêm</div>
                  </Card>
                </Col>
              </Row>

              <Divider style={{ margin: '16px 0' }} />

              {/* E. QUẢN LÝ PHÒNG */}
              <div style={{ fontWeight: 700, color: '#ab8965', marginBottom: 10, letterSpacing: 0.3 }}>QUẢN LÝ PHÒNG</div>
              <Row gutter={12} style={{ marginBottom: 12 }}>
                <Col xs={12} sm={6}>
                  <Card size="small" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Tổng số phòng</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{selectedType.roomCount || 0}</div>
                  </Card>
                </Col>
                {selectedType.availableCount !== undefined && (
                  <Col xs={12} sm={6}>
                    <Card size="small" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: '#166534' }}>Đang trống</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#14532d' }}>{selectedType.availableCount}</div>
                    </Card>
                  </Col>
                )}
                {selectedType.occupiedCount !== undefined && (
                  <Col xs={12} sm={6}>
                    <Card size="small" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: '#1e40af' }}>Đang ở</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#1e3a8a' }}>{selectedType.occupiedCount}</div>
                    </Card>
                  </Col>
                )}
                {selectedType.reservedCount !== undefined && selectedType.reservedCount > 0 && (
                  <Col xs={12} sm={6}>
                    <Card size="small" style={{ background: '#fffbeb', border: '1px solid #fde68a', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: '#92400e' }}>Đã cọc</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#78350f' }}>{selectedType.reservedCount}</div>
                    </Card>
                  </Col>
                )}
                {selectedType.maintenanceCount !== undefined && selectedType.maintenanceCount > 0 && (
                  <Col xs={12} sm={6}>
                    <Card size="small" style={{ background: '#fff1f2', border: '1px solid #fda4af', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: '#9f1239' }}>Bảo trì</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#881337' }}>{selectedType.maintenanceCount}</div>
                    </Card>
                  </Col>
                )}
              </Row>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Danh sách số phòng</div>
                {roomNumberTags.length > 0 ? (
                  <div>
                    {roomNumberTags.map(num => (
                      <Tag color="blue" key={num} style={{ margin: '2px' }}>{num}</Tag>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: '#ccc' }}>Không có phòng nào thuộc hạng này</span>
                )}
              </div>

              <Divider style={{ margin: '16px 0' }} />

              {/* F. TIỆN NGHI */}
              <div style={{ fontWeight: 700, color: '#ab8965', marginBottom: 10, letterSpacing: 0.3 }}>TIỆN NGHI</div>
              <div style={{ marginBottom: 4 }}>
                {selectedAmenities.length > 0 ? (
                  selectedAmenities.map(am => (
                    <Tag color="purple" key={am.id} style={{ margin: '2px' }}>{am.name}</Tag>
                  ))
                ) : (
                  <span style={{ color: '#ccc' }}>Chưa thiết lập tiện nghi</span>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── MODAL QUẢN LÝ BẢNG GIÁ THEO NGÀY LỄ / CHỦ NHẬT / NGÀY THƯỜNG ── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarCircleOutlined style={{ color: '#f59e0b', fontSize: 20 }} />
            <span>
              Cấu hình Bảng giá Ngày lễ, Chủ nhật & Ngày thường{' '}
              {selectedTypeIdForPrice
                ? `(Hạng phòng: ${roomTypes.find((t) => t.id === selectedTypeIdForPrice)?.typeName || ''})`
                : '(Tất cả hạng phòng)'}
            </span>
          </div>
        }
        open={pricingModalVisible}
        onCancel={() => setPricingModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPricingModalVisible(false)}>
            Đóng
          </Button>,
        ]}
        width={900}
        destroyOnHidden
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <span>Lọc theo hạng phòng:</span>
            <Select
              style={{ width: 220 }}
              value={selectedTypeIdForPrice}
              onChange={(val) => {
                setSelectedTypeIdForPrice(val);
                fetchPriceRules(val);
              }}
              allowClear
              placeholder="Tất cả hạng phòng"
            >
              {roomTypes.map((t) => (
                <Option key={t.id} value={t.id}>
                  {t.typeName} (Gốc: {formatPrice(t.defaultPrice)})
                </Option>
              ))}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={() => fetchPriceRules(selectedTypeIdForPrice)} loading={priceLoading}>
              Làm mới
            </Button>
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}
            onClick={handleOpenAddPriceRule}
          >
            Thêm quy tắc giá
          </Button>
        </div>

        <Table<RoomPriceRule>
          dataSource={priceRules}
          rowKey="id"
          loading={priceLoading}
          pagination={{ pageSize: 8 }}
          columns={[
            {
              title: 'Hạng phòng',
              dataIndex: 'roomTypeName',
              key: 'roomTypeName',
              render: (name: string, record) => (
                <strong>{name || (record.roomTypeId ? `Hạng #${record.roomTypeId}` : 'Tất cả hạng')}</strong>
              ),
            },
            {
              title: 'Loại áp dụng',
              dataIndex: 'priceType',
              key: 'priceType',
              render: (type: string) => {
                if (type === 'holiday') return <Tag color="red">Dịp lễ</Tag>;
                if (type === 'weekend') return <Tag color="purple">Cuối tuần (Thứ 7 & CN)</Tag>;
                if (type === 'saturday') return <Tag color="magenta">Thứ 7</Tag>;
                if (type === 'sunday') return <Tag color="orange">Chủ nhật</Tag>;
                if (type === 'season' || type === 'special') return <Tag color="cyan">Mùa / Sự kiện</Tag>;
                return <Tag color="blue">Ngày thường</Tag>;
              },
            },
            {
              title: 'Thời gian áp dụng',
              key: 'period',
              render: (_: unknown, row: RoomPriceRule) => (
                <span>
                  {dayjs(row.startDate).format('DD/MM/YYYY')} - {dayjs(row.endDate).format('DD/MM/YYYY')}
                </span>
              ),
            },
            {
              title: 'Đơn giá / đêm',
              dataIndex: 'price',
              key: 'price',
              render: (price: number) => <strong style={{ color: '#047857' }}>{formatPrice(price)}</strong>,
            },
            {
              title: 'Ghi chú',
              dataIndex: 'note',
              key: 'note',
              render: (note?: string | null) => note || <span style={{ color: '#aaa' }}>—</span>,
            },
            {
              title: 'Thao tác',
              key: 'action',
              width: 110,
              render: (_: unknown, row: RoomPriceRule) => (
                <Space size="small">
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenEditPriceRule(row)} />
                  <Popconfirm
                    title="Xác nhận xóa quy tắc giá này?"
                    onConfirm={() => handleDeletePriceRule(row.id)}
                    okText="Xóa"
                    cancelText="Hủy"
                  >
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Modal>

      {/* ── MODAL THÊM / SỬA QUY TẮC GIÁ ── */}
      <Modal
        title={editingPriceRule ? 'Sửa quy tắc giá' : 'Thêm quy tắc giá mới'}
        open={priceRuleFormVisible}
        onCancel={() => setPriceRuleFormVisible(false)}
        onOk={handleSavePriceRule}
        okText="Lưu quy tắc"
        cancelText="Hủy"
        destroyOnHidden
        width={550}
      >
        <Form form={priceForm} layout="vertical">
          <Form.Item
            name="roomTypeId"
            label="Hạng phòng áp dụng"
            rules={[{ required: true, message: 'Vui lòng chọn hạng phòng!' }]}
          >
            <Select placeholder="Chọn hạng phòng">
              {roomTypes.map((t) => (
                <Option key={t.id} value={t.id}>
                  {t.typeName} (Giá gốc: {formatPrice(t.defaultPrice)}/đêm)
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="priceType"
            label="Loại quy tắc giá"
            rules={[{ required: true, message: 'Vui lòng chọn loại giá!' }]}
          >
            <Radio.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Radio value="holiday">
                <Tag color="red">Dịp lễ</Tag> (Áp dụng ưu tiên cao nhất cho tất cả các ngày trong khoảng ngày lễ)
              </Radio>
              <Radio value="weekend">
                <Tag color="purple">Cuối tuần (Thứ 7 & Chủ nhật)</Tag> (Áp dụng cho cả đêm Thứ 7 và Chủ nhật)
              </Radio>
              <Radio value="saturday">
                <Tag color="magenta">Thứ 7</Tag> (Chỉ áp dụng riêng cho đêm Thứ 7)
              </Radio>
              <Radio value="sunday">
                <Tag color="orange">Chủ nhật</Tag> (Chỉ áp dụng riêng cho đêm Chủ nhật)
              </Radio>
              <Radio value="normal">
                <Tag color="blue">Ngày thường</Tag> (Áp dụng cho các ngày trong tuần từ Thứ 2 đến Thứ 6)
              </Radio>
              <Radio value="season">
                <Tag color="cyan">Mùa vụ / Sự kiện</Tag> (Áp dụng cho toàn bộ giai đoạn sự kiện)
              </Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="Khoảng thời gian hiệu lực"
            rules={[{ required: true, message: 'Vui lòng chọn khoảng thời gian!' }]}
          >
            <RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item
            name="price"
            label="Đơn giá áp dụng (VNĐ / đêm)"
            rules={[
              { required: true, message: 'Vui lòng nhập đơn giá!' },
              { type: 'number', min: 0, message: 'Giá không được nhỏ hơn 0!' },
            ]}
          >
            <InputNumber
              min={0}
              step={50000}
              style={{ width: '100%' }}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => (value ? value.replace(/\$\s?|(,*)/g, '') : '') as any}
              addonAfter="VNĐ"
            />
          </Form.Item>

          <Form.Item name="note" label="Ghi chú / Tên dịp (ví dụ: Dịp 30/4 - 1/5, Quốc khánh 2/9, Giá cuối tuần...)">
            <Input placeholder="Nhập ghi chú cho mức giá này" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

export default RoomTypeManagement;
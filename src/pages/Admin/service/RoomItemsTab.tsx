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
  Tooltip,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import api from '../../../services/api';
import { unwrapList } from '../../../utils/unwrapList';
import { ROOM_ITEM_STATUS, ROOM_ITEM_STATUS_OPTIONS } from './helpers';

interface RoomItem {
  id: number;
  roomId: number;
  itemName: string;
  quantity: number;
  compensationPrice: string | number;
  status: string;
  roomNumber: string | null;
}

interface RoomOption {
  id: number;
  roomNumber: string;
  room_type_name?: string;
}

interface RoomItemFormValues {
  roomId: number;
  itemName: string;
  quantity: number;
  compensationPrice: number;
  status: string;
}

function RoomItemsTab() {
  const [items, setItems] = useState<RoomItem[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<RoomItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<RoomItem | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm<RoomItemFormValues>();

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await api.get('/room-items');
      setItems(unwrapList<RoomItem>(response));
    } catch (error) {
      console.error('Error fetching room items:', error);
      message.error('Lỗi khi tải danh sách vật dụng');
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await api.get('/rooms');
      setRooms(unwrapList<RoomOption>(response));
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  useEffect(() => {
    void fetchItems();
    void fetchRooms();
  }, []);

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ quantity: 1, compensationPrice: 0, status: 'normal' });
    setModalVisible(true);
  };

  const handleEdit = (item: RoomItem) => {
    setEditingItem(item);
    form.setFieldsValue({
      roomId: item.roomId,
      itemName: item.itemName,
      quantity: item.quantity,
      compensationPrice: Number(item.compensationPrice || 0),
      status: item.status || 'normal',
    });
    setModalVisible(true);
  };

  const handleViewDetail = (item: RoomItem) => {
    setSelectedItem(item);
    setDetailVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/room-items/${id}`);
      message.success('Xóa vật dụng thành công');
      void fetchItems();
    } catch (error: unknown) {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      message.error(msg || 'Lỗi khi xóa vật dụng');
    }
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingItem) {
        await api.put(`/room-items/${editingItem.id}`, values);
        message.success('Cập nhật vật dụng thành công');
      } else {
        await api.post('/room-items', values);
        message.success('Thêm vật dụng thành công');
      }
      setModalVisible(false);
      void fetchItems();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        message.error(error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const keyword = searchText.trim().toLowerCase();
  const filtered = keyword
    ? items.filter(
        (i) =>
          i.itemName?.toLowerCase().includes(keyword) ||
          (i.roomNumber || '').toLowerCase().includes(keyword)
      )
    : items;

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70, sorter: (a: RoomItem, b: RoomItem) => a.id - b.id },
    {
      title: 'Phòng',
      dataIndex: 'roomNumber',
      key: 'roomNumber',
      width: 100,
      render: (text: string | null) => (text ? <strong>{text}</strong> : <span style={{ color: '#aaa' }}>—</span>),
    },
    {
      title: 'Tên vật dụng',
      dataIndex: 'itemName',
      key: 'itemName',
      sorter: (a: RoomItem, b: RoomItem) => (a.itemName || '').localeCompare(b.itemName || ''),
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      sorter: (a: RoomItem, b: RoomItem) => (a.quantity || 0) - (b.quantity || 0),
    },
    {
      title: 'Đơn giá bồi thường',
      dataIndex: 'compensationPrice',
      key: 'compensationPrice',
      width: 190,
      align: 'right' as const,
      sorter: (a: RoomItem, b: RoomItem) => Number(a.compensationPrice || 0) - Number(b.compensationPrice || 0),
      render: (value: string | number) => `${Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ`,
    },
    {
      title: 'Tình trạng',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      filters: ROOM_ITEM_STATUS_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
      onFilter: (value: boolean | Key, record: RoomItem) => record.status === value,
      render: (status: string) => {
        const meta = ROOM_ITEM_STATUS[status] || { label: status, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 200,
      // Cùng quy ước với các bảng khác: một nút chính tô đậm, thao tác phụ dùng
      // nút viền, thao tác xóa dùng tone đỏ.
      render: (_: unknown, record: RoomItem) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết vật dụng">
            <Button
              type="primary"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          <Tooltip title="Sửa vật dụng">
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Tooltip title="Xóa vật dụng">
              <Button danger icon={<DeleteOutlined />} size="small" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={<span style={{ fontWeight: 'bold' }}>Vật dụng trong phòng</span>}
      extra={
        <Space>
          <Input
            allowClear
            placeholder="Tìm theo tên / số phòng..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchItems}>
            Làm mới
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            Thêm vật dụng
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 8, showTotal: (total) => `Tổng ${total} vật dụng` }}
      />

      <Modal
        title={editingItem ? 'Cập Nhật Vật Dụng' : 'Thêm Vật Dụng Mới'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        forceRender
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} onFinish={handleModalSubmit}>
          <Form.Item name="roomId" label="Phòng" rules={[{ required: true, message: 'Vui lòng chọn phòng!' }]}>
            <Select
              showSearch
              placeholder="Chọn phòng"
              optionFilterProp="label"
              options={rooms.map((r) => ({
                value: r.id,
                label: `Phòng ${r.roomNumber}${r.room_type_name ? ` (${r.room_type_name})` : ''}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="itemName"
            label="Tên vật dụng"
            rules={[
              { required: true, message: 'Vui lòng nhập tên vật dụng!' },
              { whitespace: true, message: 'Tên vật dụng không được để trống!' },
            ]}
          >
            <Input placeholder="Ví dụ: TV, Điều hòa, Tủ lạnh..." />
          </Form.Item>

          <Form.Item name="quantity" label="Số lượng" rules={[{ required: true, message: 'Vui lòng nhập số lượng!' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Nhập số lượng" />
          </Form.Item>

          <Form.Item
            name="compensationPrice"
            label="Đơn giá bồi thường"
            rules={[{ required: true, message: 'Vui lòng nhập đơn giá!' }]}
          >
            <InputNumber
              min={0}
              step={10000}
              style={{ width: '100%' }}
              placeholder="Nhập đơn giá"
              formatter={(value) => `${value || 0}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
              parser={(value) => Number(String(value || '').replace(/\./g, '')) as 0}
              addonAfter="VNĐ"
            />
          </Form.Item>

          <Form.Item name="status" label="Tình trạng" rules={[{ required: true, message: 'Vui lòng chọn tình trạng!' }]}>
            <Select options={ROOM_ITEM_STATUS_OPTIONS} placeholder="Chọn tình trạng" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" block loading={submitting}>
                {editingItem ? 'Cập nhật' : 'Thêm mới'}
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
        title="Chi tiết vật dụng"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedItem && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="ID">{selectedItem.id}</Descriptions.Item>
            <Descriptions.Item label="Phòng">{selectedItem.roomNumber || '—'}</Descriptions.Item>
            <Descriptions.Item label="Tên vật dụng">{selectedItem.itemName}</Descriptions.Item>
            <Descriptions.Item label="Số lượng">{selectedItem.quantity}</Descriptions.Item>
            <Descriptions.Item label="Đơn giá bồi thường">
              {Number(selectedItem.compensationPrice || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ
            </Descriptions.Item>
            <Descriptions.Item label="Tình trạng">
              <Tag color={ROOM_ITEM_STATUS[selectedItem.status]?.color || 'default'}>
                {ROOM_ITEM_STATUS[selectedItem.status]?.label || selectedItem.status}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Card>
  );
}

export default RoomItemsTab;
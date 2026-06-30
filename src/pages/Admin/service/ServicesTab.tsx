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
  Tag,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import api from '../../../services/api';
import { unwrapList } from '../../../utils/unwrapList';
import type { Service } from '../../../types/service';
import { formatPrice } from './helpers';

const { TextArea } = Input;

interface ServiceFormValues {
  serviceName: string;
  price: number;
  description?: string;
}

function ServicesTab() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm<ServiceFormValues>();

  const fetchServices = async () => {
    setLoading(true);
    try {
      const response = await api.get('/services');
      setServices(unwrapList<Service>(response));
    } catch (error) {
      console.error('Error fetching services:', error);
      message.error('Lỗi khi tải danh sách dịch vụ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchServices();
  }, []);

  const handleAdd = () => {
    setEditingService(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    form.setFieldsValue({
      serviceName: service.serviceName,
      price: typeof service.price === 'number' ? service.price : parseFloat(service.price) || 0,
      description: service.description,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/services/${id}`);
      message.success('Xóa dịch vụ thành công');
      void fetchServices();
    } catch (error: unknown) {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      message.error(msg || 'Lỗi khi xóa dịch vụ');
    }
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingService) {
        await api.put(`/services/${editingService.id}`, values);
        message.success('Cập nhật dịch vụ thành công');
      } else {
        await api.post('/services', values);
        message.success('Thêm dịch vụ mới thành công');
      }
      setModalVisible(false);
      void fetchServices();
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
    ? services.filter(
        (s) =>
          s.serviceName?.toLowerCase().includes(keyword) ||
          s.description?.toLowerCase().includes(keyword)
      )
    : services;

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70, sorter: (a: Service, b: Service) => a.id - b.id },
    {
      title: 'Tên dịch vụ',
      dataIndex: 'serviceName',
      key: 'serviceName',
      sorter: (a: Service, b: Service) => (a.serviceName || '').localeCompare(b.serviceName || ''),
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Giá',
      dataIndex: 'price',
      key: 'price',
      width: 180,
      sorter: (a: Service, b: Service) =>
        (parseFloat(a.price as unknown as string) || 0) - (parseFloat(b.price as unknown as string) || 0),
      render: (price: string | number) => <Tag color="green">{formatPrice(price)}</Tag>,
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || <span style={{ color: '#aaa' }}>—</span>,
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 200,
      render: (_: unknown, record: Service) => (
        <Space size="middle">
          <Button type="primary" ghost icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            Sửa
          </Button>
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa dịch vụ này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button type="primary" danger ghost icon={<DeleteOutlined />}>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={<span style={{ fontWeight: 'bold' }}>Danh sách dịch vụ</span>}
      extra={
        <Space>
          <Input
            allowClear
            placeholder="Tìm theo tên / mô tả..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchServices}>
            Làm mới
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            Thêm dịch vụ
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 8, showTotal: (total) => `Tổng ${total} dịch vụ` }}
      />

      <Modal
        title={editingService ? 'Cập Nhật Dịch Vụ' : 'Thêm Dịch Vụ Mới'}
        open={modalVisible}
        onOk={handleModalSubmit}
        onCancel={() => setModalVisible(false)}
        okText={editingService ? 'Cập nhật' : 'Thêm mới'}
        cancelText="Hủy"
        confirmLoading={submitting}
        forceRender
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="serviceName"
            label="Tên dịch vụ"
            rules={[
              { required: true, message: 'Vui lòng nhập tên dịch vụ!' },
              { whitespace: true, message: 'Tên dịch vụ không được để trống!' },
            ]}
          >
            <Input placeholder="Ví dụ: Ăn sáng, Giặt là, Spa..." />
          </Form.Item>

          <Form.Item name="price" label="Giá (VNĐ)" rules={[{ required: true, message: 'Vui lòng nhập giá dịch vụ!' }]}>
            <InputNumber<number>
              min={0}
              step={1000}
              style={{ width: '100%' }}
              placeholder="Nhập giá dịch vụ"
              formatter={(value) => `${value ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => (value ? Number(value.replace(/,/g, '')) : 0)}
            />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <TextArea rows={3} placeholder="Mô tả chi tiết về dịch vụ (không bắt buộc)" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

export default ServicesTab;

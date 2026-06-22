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
  Card
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../services/api';

interface Service {
  id: number;
  serviceName: string;
  price: number;
  description: string | null;
}

const formatVnd = (value: number) => Number(value || 0).toLocaleString('vi-VN') + ' ₫';

function ServiceManagement() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form] = Form.useForm();

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/services');
      setServices(res.data);
    } catch {
      message.error('Lỗi khi tải danh sách dịch vụ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Service) => {
    setEditing(record);
    form.setFieldsValue({
      serviceName: record.serviceName,
      price: Number(record.price),
      description: record.description
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/services/${id}`);
      message.success('Xóa dịch vụ thành công');
      fetchServices();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi xóa dịch vụ');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editing) {
        await api.put(`/services/${editing.id}`, values);
        message.success('Cập nhật dịch vụ thành công');
      } else {
        await api.post('/services', values);
        message.success('Thêm dịch vụ thành công');
      }
      setModalVisible(false);
      fetchServices();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi khi lưu dịch vụ');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: 'Tên dịch vụ', dataIndex: 'serviceName', key: 'serviceName' },
    {
      title: 'Giá',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => formatVnd(price)
    },
    { title: 'Mô tả', dataIndex: 'description', key: 'description' },
    {
      title: 'Hành động',
      key: 'actions',
      width: 130,
      render: (_: any, record: Service) => (
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
        title="Quản lý dịch vụ"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchServices} loading={loading}>
              Tải lại
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Thêm dịch vụ
            </Button>
          </Space>
        }
      >
        <Table columns={columns} dataSource={services} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title={editing ? 'Sửa dịch vụ' : 'Thêm dịch vụ'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="serviceName"
            label="Tên dịch vụ"
            rules={[{ required: true, message: 'Vui lòng nhập tên dịch vụ' }]}
          >
            <Input placeholder="VD: Spa, Giặt ủi, Room Service..." />
          </Form.Item>

          <Form.Item
            name="price"
            label="Giá (₫)"
            rules={[{ required: true, message: 'Vui lòng nhập giá' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              placeholder="Nhập giá"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as unknown as number}
            />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả dịch vụ" />
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

export default ServiceManagement;

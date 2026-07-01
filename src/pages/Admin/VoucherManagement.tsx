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
  Card,
  Tag,
  DatePicker,
  Typography
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { Title } = Typography;

interface Voucher {
  id: number;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: string | number;
  maxDiscount: string | number;
  minBookingAmount: string | number;
  quantity: number;
  startDate: string | null;
  endDate: string | null;
  status: 'active' | 'inactive' | 'expired';
}

function VoucherManagement() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [form] = Form.useForm();

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/vouchers');
      const data = response.data || response;
      if (Array.isArray(data)) {
        setVouchers(data);
      } else if (data && Array.isArray(data.data)) {
        setVouchers(data.data);
      }
    } catch (error) {
      console.error('Error fetching vouchers:', error);
      message.error('Lỗi khi tải danh sách voucher');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const handleAdd = () => {
    setEditingVoucher(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (voucher: Voucher) => {
    setEditingVoucher(voucher);
    form.setFieldsValue({
      code: voucher.code,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue,
      maxDiscount: voucher.maxDiscount,
      minBookingAmount: voucher.minBookingAmount,
      quantity: voucher.quantity,
      dates: voucher.startDate && voucher.endDate ? [dayjs(voucher.startDate), dayjs(voucher.endDate)] : null,
      status: voucher.status
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/vouchers/${id}`);
      message.success('Xóa voucher thành công');
      fetchVouchers();
    } catch (error) {
      console.error('Error deleting voucher:', error);
      message.error('Lỗi khi xóa voucher');
    }
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      let startDate = null;
      let endDate = null;
      if (values.dates && values.dates.length === 2) {
        startDate = values.dates[0].format('YYYY-MM-DD');
        endDate = values.dates[1].format('YYYY-MM-DD');
      }

      const payload = {
        code: values.code,
        discountType: values.discountType,
        discountValue: values.discountValue,
        maxDiscount: values.maxDiscount,
        minBookingAmount: values.minBookingAmount,
        quantity: values.quantity,
        startDate,
        endDate,
        status: values.status
      };

      if (editingVoucher) {
        await api.put(`/vouchers/${editingVoucher.id}`, payload);
        message.success('Cập nhật voucher thành công');
      } else {
        await api.post('/vouchers', payload);
        message.success('Thêm voucher thành công');
      }
      setModalVisible(false);
      fetchVouchers();
    } catch (error: any) {
      console.error('Submit voucher error:', error);
      const msg = error.response?.data?.message || 'Có lỗi xảy ra khi lưu voucher';
      message.error(msg);
    }
  };

  const columns = [
    {
      title: 'Mã Code',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => <Tag color="blue" style={{ fontSize: '14px', padding: '4px 8px' }}>{text}</Tag>
    },
    {
      title: 'Loại giảm giá',
      dataIndex: 'discountType',
      key: 'discountType',
      render: (type: string) => type === 'percentage' ? 'Phần trăm (%)' : 'Số tiền cố định'
    },
    {
      title: 'Giá trị giảm',
      dataIndex: 'discountValue',
      key: 'discountValue',
      render: (val: number | string, record: Voucher) => {
        if (record.discountType === 'percentage') {
          return `${val}%`;
        }
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(val));
      }
    },
    {
      title: 'Giảm tối đa',
      dataIndex: 'maxDiscount',
      key: 'maxDiscount',
      render: (val: number | string) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(val))
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity'
    },
    {
      title: 'Thời hạn',
      key: 'dates',
      render: (_: any, record: Voucher) => {
        if (!record.startDate || !record.endDate) return 'Không giới hạn';
        return `${dayjs(record.startDate).format('DD/MM/YYYY')} - ${dayjs(record.endDate).format('DD/MM/YYYY')}`;
      }
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'green';
        let text = 'Hoạt động';
        if (status === 'inactive') {
          color = 'orange';
          text = 'Tạm ngưng';
        } else if (status === 'expired') {
          color = 'red';
          text = 'Hết hạn';
        }
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: any, record: Voucher) => (
        <Space size="middle">
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa voucher này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Có"
            cancelText="Không"
          >
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Title level={3} style={{ margin: 0 }}>Quản lý voucher khuyến mãi</Title>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchVouchers} />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Thêm Voucher
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={vouchers}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingVoucher ? 'Cập nhật voucher' : 'Thêm voucher mới'}
        open={modalVisible}
        onOk={handleModalSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ status: 'active', discountType: 'percentage' }}>
          <Form.Item
            name="code"
            label="Mã Code"
            rules={[{ required: true, message: 'Vui lòng nhập mã voucher!' }]}
          >
            <Input placeholder="Ví dụ: SUMMER2024" style={{ textTransform: 'uppercase' }} />
          </Form.Item>

          <Form.Item
            name="discountType"
            label="Loại giảm giá"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="percentage">Phần trăm (%)</Option>
              <Option value="fixed">Số tiền cố định (VNĐ)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="discountValue"
            label="Giá trị giảm"
            rules={[{ required: true, message: 'Vui lòng nhập giá trị giảm!' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="maxDiscount"
            label="Giảm tối đa (VNĐ)"
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="minBookingAmount"
            label="Giá trị đơn hàng tối thiểu (VNĐ)"
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Số lượng"
            rules={[{ required: true, message: 'Vui lòng nhập số lượng!' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="dates"
            label="Thời gian áp dụng"
          >
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="status"
            label="Trạng thái"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="active">Hoạt động</Option>
              <Option value="inactive">Tạm ngưng</Option>
              <Option value="expired">Hết hạn</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default VoucherManagement;
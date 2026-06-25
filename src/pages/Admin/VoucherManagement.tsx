import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, DatePicker, message, Space, Card, Tag, Popconfirm, Select } from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { getVouchers, createVoucher, updateVoucher, deleteVoucher } from '../../services/voucherService';

type AdminVoucher = {
  id: number;
  code: string;
  discountType: string;
  discountValue: number;
  maxDiscount: number | null;
  minBookingAmount: number | null;
  quantity: number;
  startDate: string;
  endDate: string;
  status: string;
};

type VoucherFormValues = {
  code: string;
  discountType: string;
  discountValue: number;
  maxDiscount?: number;
  minBookingAmount?: number;
  quantity: number;
  startDate: Dayjs;
  endDate: Dayjs;
  status: string;
};

function VoucherManagement() {
  const [vouchers, setVouchers] = useState<AdminVoucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<AdminVoucher | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [form] = Form.useForm<VoucherFormValues>();

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const response = await getVouchers();
      setVouchers(response.data || response);
    } catch (error: unknown) {
      console.error('Error fetching vouchers:', error);
      message.error('Lỗi khi tải danh sách voucher');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchVouchers();
  }, []);

  const openCreateModal = () => {
    setEditingVoucher(null);
    form.resetFields();
    setModalVisible(true);
  };

  const openEditModal = (voucher: AdminVoucher) => {
    setEditingVoucher(voucher);
    form.setFieldsValue({
      code: voucher.code,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue,
      maxDiscount: voucher.maxDiscount || undefined,
      minBookingAmount: voucher.minBookingAmount || undefined,
      quantity: voucher.quantity,
      startDate: dayjs(voucher.startDate),
      endDate: dayjs(voucher.endDate),
      status: voucher.status,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteVoucher(id);
      message.success('Xóa voucher thành công');
      fetchVouchers();
    } catch (error: unknown) {
      console.error('Error deleting voucher:', error);
      message.error('Lỗi khi xóa voucher');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitLoading(true);

      const payload = {
        code: values.code.trim(),
        discountType: values.discountType,
        discountValue: values.discountValue,
        maxDiscount: values.maxDiscount || null,
        minBookingAmount: values.minBookingAmount || null,
        quantity: values.quantity,
        startDate: values.startDate.format('YYYY-MM-DD'),
        endDate: values.endDate.format('YYYY-MM-DD'),
        status: values.status,
      };

      if (editingVoucher) {
        await updateVoucher(editingVoucher.id, payload);
        message.success('Cập nhật voucher thành công');
      } else {
        await createVoucher(payload);
        message.success('Tạo voucher thành công');
      }

      setModalVisible(false);
      fetchVouchers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Lỗi khi lưu voucher');
    } finally {
      setSubmitLoading(false);
    }
  };

  const columns = [
    {
      title: 'Mã voucher',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Loại giảm',
      dataIndex: 'discountType',
      key: 'discountType',
      render: (value: string) => (value === 'percentage' ? 'Phần trăm' : 'Cố định'),
    },
    {
      title: 'Giá trị giảm',
      dataIndex: 'discountValue',
      key: 'discountValue',
      render: (_: object, record: AdminVoucher) => 
        record.discountType === 'percentage' ? `${record.discountValue}%` : `${record.discountValue}đ`,
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: 'Bắt đầu',
      dataIndex: 'startDate',
      key: 'startDate',
    },
    {
      title: 'Kết thúc',
      dataIndex: 'endDate',
      key: 'endDate',
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_: object, record: AdminVoucher) => {
        const today = dayjs();
        const expired = dayjs(record.endDate).isBefore(today, 'day');
        const status = record.status === 'active' && !expired ? 'Hoạt động' : expired ? 'Hết hạn' : record.status === 'inactive' ? 'Tắt' : 'Hoạt động';
        const color = expired ? 'red' : record.status === 'inactive' ? 'orange' : 'green';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_: object, record: AdminVoucher) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            Sửa
          </Button>
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa voucher này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button danger icon={<DeleteOutlined />}>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="Quản lý Voucher"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchVouchers}>
              Làm mới
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              Thêm voucher
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={vouchers}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingVoucher ? 'Cập nhật voucher' : 'Thêm voucher'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitLoading}
        okText={editingVoucher ? 'Cập nhật' : 'Tạo'}
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="Mã voucher"
            rules={[{ required: true, message: 'Vui lòng nhập mã voucher' }]}
          >
            <Input placeholder="VD: SUMMER2026" />
          </Form.Item>

          <Form.Item
            name="discountType"
            label="Loại giảm"
            rules={[{ required: true, message: 'Vui lòng chọn loại giảm' }]}
          >
            <Select placeholder="Chọn loại giảm">
              <Select.Option value="percentage">Phần trăm (%)</Select.Option>
              <Select.Option value="fixed">Cố định (đ)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="discountValue"
            label="Giá trị giảm"
            rules={[{ required: true, message: 'Vui lòng nhập giá trị giảm' }]}
          >
            <InputNumber min={0.01} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="maxDiscount"
            label="Giảm tối đa (đ)"
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="minBookingAmount"
            label="Số tiền tối thiểu (đ)"
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Số lượng"
            rules={[{ required: true, message: 'Vui lòng nhập số lượng' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="startDate"
            label="Ngày bắt đầu"
            rules={[{ required: true, message: 'Vui lòng chọn ngày bắt đầu' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item
            name="endDate"
            label="Ngày kết thúc"
            rules={[{ required: true, message: 'Vui lòng chọn ngày kết thúc' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item
            name="status"
            label="Trạng thái"
            rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
          >
            <Select placeholder="Chọn trạng thái">
              <Select.Option value="active">Hoạt động</Select.Option>
              <Select.Option value="inactive">Tắt</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default VoucherManagement;

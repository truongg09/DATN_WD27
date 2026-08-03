import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ConfigProvider,
  Table,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  Segmented,
  message,
  Popconfirm,
  Space,
  Avatar,
  Dropdown,
  Empty
} from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  MoreOutlined,
  EyeOutlined,
  EditOutlined,
  LockOutlined,
  UnlockOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  fetchCustomers as fetchCustomersApi,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  lockCustomer
} from '../../services/customerService';

const { Option } = Select;
const { TextArea } = Input;

// Tông màu thương hiệu hiện có của hệ thống (đồng bộ với nút .ml-btn--primary #a78362)
const brand = {
  primary: '#a78362',
  primaryDark: '#8c6d4a',
  accent: '#c9a063',
  success: '#3f8f5f',
  successBg: '#eaf3ec',
  danger: '#bb4a3c',
  dangerBg: '#fbece9',
  page: '#f8f6f2',
  border: '#ece6db',
  textPrimary: '#2b2420',
  textSecondary: '#8d8478'
};

interface Customer {
  id: number;
  accountId: number;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  status: 'active' | 'locked';
  registeredAt: string;
  totalBookings: number;
  gender?: string;
  dateOfBirth?: string;
  citizenId?: string;
  nationality?: string;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function StatusPill({ status }: { status: 'active' | 'locked' }) {
  const active = status === 'active';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: active ? brand.success : brand.danger,
        background: active ? brand.successBg : brand.dangerBg
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: active ? brand.success : brand.danger
        }}
      />
      {active ? 'Hoạt động' : 'Đã khóa'}
    </span>
  );
}

function CustomerManagement() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'locked'>('all');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [form] = Form.useForm();

  const [lockModalVisible, setLockModalVisible] = useState(false);
  const [lockTarget, setLockTarget] = useState<Customer | null>(null);
  const [lockAction, setLockAction] = useState<'lock' | 'unlock'>('lock');
  const [lockReason, setLockReason] = useState('');
  const [lockLoading, setLockLoading] = useState(false);

  const fetchCustomers = async (page = currentPage, search = searchQuery, status = filterStatus) => {
    setLoading(true);
    try {
      const json = await fetchCustomersApi({
        page: page - 1,
        limit: pageSize,
        search,
        status
      });
      if (!json.ok) throw new Error('API error');

      setCustomers(json.data);
      setTotalCount(json.total);
    } catch (error) {
      console.error('Error fetching customers:', error);
      message.error('Lỗi khi tải danh sách khách hàng');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [currentPage, pageSize, searchQuery, filterStatus]);

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    form.setFieldsValue({
      email: customer.email,
      fullName: customer.fullName,
      phone: customer.phone,
      gender: customer.gender,
      dateOfBirth: customer.dateOfBirth ? dayjs(customer.dateOfBirth) : undefined,
      citizenId: customer.citizenId,
      nationality: customer.nationality,
      address: customer.address,
      status: customer.status
    });
    setModalVisible(true);
  };

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || customers.length === 0) return;

    const customer = customers.find((c) => c.id === Number(editId));
    if (customer) {
      handleEdit(customer);
      setSearchParams({});
    }
  }, [customers, searchParams]);

  const handleAdd = () => {
    setEditingCustomer(null);
    form.resetFields();
    form.setFieldsValue({ status: 'active' });
    setModalVisible(true);
  };

  const handleViewDetail = (id: number) => {
    navigate(`/admin/customers/${id}`);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCustomer(id);
      message.success('Xóa khách hàng thành công');
      fetchCustomers();
    } catch (error: any) {
      console.error('Error deleting customer:', error);
      message.error(error.message || 'Lỗi khi xóa khách hàng');
    }
  };

  const handleSubmit = async (values: any) => {
    setSubmitLoading(true);
    try {
      const submitValues = {
        ...values,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : null
      };

      if (editingCustomer) {
        await updateCustomer({ ...submitValues, id: editingCustomer.id });
      } else {
        await createCustomer(submitValues);
      }

      message.success(editingCustomer ? 'Cập nhật khách hàng thành công' : 'Thêm khách hàng thành công');
      setModalVisible(false);
      fetchCustomers();
    } catch (error: any) {
      console.error('Error submitting form:', error);
      message.error(error.message || 'Lỗi khi lưu thông tin');
    } finally {
      setSubmitLoading(false);
    }
  };

  const openLockModal = (customer: Customer) => {
    setLockTarget(customer);
    setLockAction(customer.status === 'active' ? 'lock' : 'unlock');
    setLockReason('');
    setLockModalVisible(true);
  };

  const handleConfirmLock = async () => {
    if (!lockTarget || !lockReason.trim()) {
      message.warning('Vui lòng nhập lý do');
      return;
    }

    setLockLoading(true);
    try {
      await lockCustomer(lockTarget.id, lockReason.trim());

      message.success(`${lockAction === 'lock' ? 'Khóa' : 'Mở khóa'} tài khoản thành công`);
      setLockModalVisible(false);
      fetchCustomers();
    } catch (error: any) {
      message.error(error.message || 'Không xác định');
    } finally {
      setLockLoading(false);
    }
  };

  // Menu phụ: chỉ còn hành động ít dùng / nguy hiểm (Khóa, Xóa).
  // Xem & Sửa đã chuyển ra thành nút icon hiện trực tiếp ở cột Hành động.
  const getRowMenu = (record: Customer): MenuProps['items'] => [
    {
      key: 'lock',
      label: record.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản',
      icon: record.status === 'active' ? <LockOutlined /> : <UnlockOutlined />,
      onClick: () => openLockModal(record)
    },
    { type: 'divider' },
    {
      key: 'delete',
      label: (
        <Popconfirm
          title="Xóa khách hàng này?"
          description="Hành động này không thể hoàn tác."
          onConfirm={() => handleDelete(record.id)}
          okText="Xóa"
          cancelText="Hủy"
        >
          <span style={{ color: brand.danger }}>Xóa khách hàng</span>
        </Popconfirm>
      ),
      icon: <DeleteOutlined style={{ color: brand.danger }} />
    }
  ];

  const columns = [
    {
      title: 'Khách hàng',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (_: string, record: Customer) => (
        <Space size={12}>
          <Avatar
            size={38}
            style={{
              background: brand.primary,
              fontWeight: 600,
              fontSize: 13
            }}
          >
            {initialsOf(record.fullName)}
          </Avatar>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600, color: brand.textPrimary }}>{record.fullName}</div>
            <div style={{ fontSize: 12.5, color: brand.textSecondary }}>{record.email}</div>
          </div>
        </Space>
      )
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      key: 'phone',
      width: 150
    },
    {
      title: 'Ngày sinh',
      dataIndex: 'dateOfBirth',
      key: 'dateOfBirth',
      render: (date: string) =>
        date ? dayjs(date.slice(0, 10), 'YYYY-MM-DD').format('DD/MM/YYYY') : ''
    },
    {
      title: 'Ngày đăng ký',
      dataIndex: 'registeredAt',
      key: 'registeredAt',
      width: 130,
      render: (date: string) => (date ? dayjs(date).format('DD/MM/YYYY') : '—')
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: 'active' | 'locked') => <StatusPill status={status} />
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 130,
      align: 'center' as const,
      render: (_: any, record: Customer) => (
        <Space
          size={6}
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', justifyContent: 'center' }}
        >
          <Button
            type="primary"
            icon={<EyeOutlined style={{ color: 'white' }} />}
            size="small"
            onClick={() => handleViewDetail(record.id)}
          />
          <Button
            type="primary"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          />
          <Dropdown menu={{ items: getRowMenu(record) }} trigger={['click']} placement="bottomRight">
            <Button
              type="primary"
              icon={<MoreOutlined />}
              size="small"
            />
          </Dropdown>
        </Space>
      )
    }
  ];

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: brand.primary,
          borderRadius: 10,
          colorSuccess: brand.success,
          colorError: brand.danger,
          fontSize: 14
        },
        components: {
          Button: { primaryShadow: 'none', controlHeight: 38 },
          Table: { headerBg: '#fbf9f6', headerColor: brand.textSecondary, borderColor: brand.border }
        }
      }}
    >
      <div
        style={{
          background: brand.page,
          minHeight: '100%',
          padding: 28,
          borderRadius: 16
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 24
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 700,
                color: brand.textPrimary
              }}
            >
              Quản lý khách hàng
            </h1>
            <p style={{ margin: '4px 0 0', color: brand.textSecondary, fontSize: 14 }}>
              Theo dõi và quản lý thông tin khách hàng
            </p>
          </div>

          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => fetchCustomers()} loading={loading}>
              Tải lại
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Thêm khách hàng
            </Button>
          </Space>
        </div>

        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            background: '#fff',
            border: `1px solid ${brand.border}`,
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 16
          }}
        >
          <Input
            placeholder="Tìm theo tên, email, số điện thoại..."
            prefix={<SearchOutlined style={{ color: brand.textSecondary }} />}
            allowClear
            style={{ width: 320 }}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />

          <Segmented
            value={filterStatus}
            onChange={(value) => {
              setFilterStatus(value as 'all' | 'active' | 'locked');
              setCurrentPage(1);
            }}
            options={[
              { label: 'Tất cả', value: 'all' },
              { label: 'Hoạt động', value: 'active' },
              { label: 'Đã khóa', value: 'locked' }
            ]}
          />
        </div>

        {/* Table */}
        <div
          style={{
            background: '#fff',
            border: `1px solid ${brand.border}`,
            borderRadius: 12,
            overflow: 'hidden'
          }}
        >
          <Table
            columns={columns}
            dataSource={customers}
            rowKey="id"
            loading={loading}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Không tìm thấy khách hàng phù hợp"
                  style={{ padding: '32px 0' }}
                />
              )
            }}
            onRow={(record) => ({
              onClick: () => handleViewDetail(record.id)
            })}
            pagination={{
              current: currentPage,
              pageSize,
              total: totalCount,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} khách hàng`,
              onChange: (page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              }
            }}
          />
        </div>
      </div>

      {/* Modal Thêm/Sửa */}
      <Modal
        title={editingCustomer ? 'Sửa khách hàng' : 'Thêm khách hàng'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không hợp lệ' }
            ]}
          >
            <Input placeholder="Nhập email" />
          </Form.Item>

          {!editingCustomer && (
            <Form.Item
              name="password"
              label="Mật khẩu"
              rules={[
                { required: true, message: 'Vui lòng nhập mật khẩu' },
                { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' }
              ]}
            >
              <Input.Password placeholder="Nhập mật khẩu" />
            </Form.Item>
          )}

          <Form.Item
            name="fullName"
            label="Họ tên"
            rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
          >
            <Input placeholder="Nhập họ tên" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Số điện thoại"
            rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
          >
            <Input placeholder="Nhập số điện thoại" />
          </Form.Item>

          <Form.Item name="gender" label="Giới tính">
            <Select placeholder="Chọn giới tính" allowClear>
              <Option value="male">Nam</Option>
              <Option value="female">Nữ</Option>
              <Option value="other">Khác</Option>
            </Select>
          </Form.Item>

          <Form.Item name="dateOfBirth" label="Ngày sinh">
            <DatePicker style={{ width: '100%' }} disabledDate={(d) => d && d.isAfter(dayjs())} />
          </Form.Item>

          <Form.Item name="citizenId" label="CCCD">
            <Input placeholder="Nhập số CCCD" />
          </Form.Item>

          <Form.Item name="nationality" label="Quốc tịch">
            <Input placeholder="Nhập quốc tịch" />
          </Form.Item>

          <Form.Item name="address" label="Địa chỉ">
            <Input placeholder="Nhập địa chỉ" />
          </Form.Item>

          {editingCustomer && (
            <Form.Item name="status" label="Trạng thái" initialValue="active">
              <Select>
                <Option value="active">Hoạt động</Option>
                <Option value="locked">Đã khóa</Option>
              </Select>
            </Form.Item>
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitLoading} block>
                {editingCustomer ? 'Cập nhật' : 'Thêm'}
              </Button>
              <Button onClick={() => setModalVisible(false)} block>
                Hủy
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Khóa/Mở khóa */}
      <Modal
        title={lockAction === 'lock' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
        open={lockModalVisible}
        onCancel={() => setLockModalVisible(false)}
        onOk={handleConfirmLock}
        confirmLoading={lockLoading}
        okText="Xác nhận"
        cancelText="Hủy"
        okButtonProps={{ danger: lockAction === 'lock' }}
      >
        <p>
          Khách hàng: <strong>{lockTarget?.fullName}</strong>
        </p>
        <TextArea
          rows={3}
          placeholder="Nhập lý do xử lý..."
          value={lockReason}
          onChange={(e) => setLockReason(e.target.value)}
        />
      </Modal>
    </ConfigProvider>
  );
}

export default CustomerManagement;

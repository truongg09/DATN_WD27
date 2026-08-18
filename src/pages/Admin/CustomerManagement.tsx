import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ConfigProvider,
  Table,
  Button,
  Modal,
  Input,
  Segmented,
  message,
  Space,
  Avatar,
  Tooltip,
  Empty
} from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
  LockOutlined,
  UnlockOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  fetchCustomers as fetchCustomersApi,
  lockCustomer
} from '../../services/customerService';

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

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'locked'>('all');

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

  const handleViewDetail = (id: number) => {
    navigate(`/admin/customers/${id}`);
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
      width: 110,
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
      title: 'Thao tác',
      key: 'actions',
      width: 130,
      align: 'center' as const,
      render: (_: any, record: Customer) => (
        <Space
          size={6}
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', justifyContent: 'center' }}
        >
          <Tooltip title="Xem chi tiết khách hàng">
            <Button
              type="primary"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => handleViewDetail(record.id)}
            />
          </Tooltip>
          <Tooltip title={record.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}>
            <Button
              danger={record.status === 'active'}
              icon={record.status === 'active' ? <LockOutlined /> : <UnlockOutlined />}
              size="small"
              onClick={() => openLockModal(record)}
            />
          </Tooltip>
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

          <Button icon={<ReloadOutlined />} onClick={() => fetchCustomers()} loading={loading}>
            Tải lại
          </Button>
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
              style: { cursor: 'pointer' },
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

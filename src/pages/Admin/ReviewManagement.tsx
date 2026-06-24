import { useEffect, useState } from 'react';
import {
  ConfigProvider,
  Table,
  Button,
  Modal,
  Input,
  Select,
  Segmented,
  message,
  Popconfirm,
  Space,
  Avatar,
  Empty,
  Rate,
  Dropdown
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  MessageOutlined,
  MoreOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  fetchReviews as fetchReviewsApi,
  fetchReviewDetail,
  updateReviewStatus,
  replyReview,
  deleteReviewReply,
  deleteReview
} from '../../services/reviewService';

const { TextArea } = Input;

const brand = {
  primary: '#a78362',
  primaryDark: '#8c6d4a',
  accent: '#c9a063',
  success: '#3f8f5f',
  successBg: '#eaf3ec',
  warning: '#b07d1e',
  warningBg: '#fef6e4',
  danger: '#bb4a3c',
  dangerBg: '#fbece9',
  page: '#f8f6f2',
  border: '#ece6db',
  textPrimary: '#2b2420',
  textSecondary: '#8d8478'
};

interface Review {
  id: number;
  bookingId: number;
  customerId: number;
  fullName: string;
  rating: number;
  comment: string;
  status: 'pending' | 'approved' | 'rejected';
  adminReply?: string | null;
  repliedAt?: string | null;
  createdAt: string;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function StatusPill({ status }: { status: Review['status'] }) {
  const config = {
    approved: { color: brand.success, bg: brand.successBg, label: 'Đã duyệt' },
    rejected: { color: brand.danger, bg: brand.dangerBg, label: 'Từ chối' },
    pending: { color: brand.warning, bg: brand.warningBg, label: 'Chờ duyệt' }
  }[status];

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
        color: config.color,
        background: config.bg
      }}
    >
      <span
        style={{ width: 6, height: 6, borderRadius: '50%', background: config.color }}
      />
      {config.label}
    </span>
  );
}

function ReviewManagement() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [filterRating, setFilterRating] = useState<number | 'all'>('all');

  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const res = await fetchReviewsApi();
      setReviews(res.data || []);
    } catch {
      message.error('Lỗi khi tải danh sách đánh giá');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const openDetail = async (id: number) => {
    try {
      const res = await fetchReviewDetail(id);
      setSelectedReview(res.data);
      setReplyText(res.data.adminReply || '');
      setDetailVisible(true);
    } catch {
      message.error('Không tải được chi tiết đánh giá');
    }
  };

  const handleUpdateStatus = async (id: number, status: Review['status']) => {
    try {
      await updateReviewStatus(id, status);
      message.success('Cập nhật trạng thái thành công');
      loadReviews();
      if (selectedReview?.id === id) {
        const res = await fetchReviewDetail(id);
        setSelectedReview(res.data);
      }
    } catch {
      message.error('Cập nhật trạng thái thất bại');
    }
  };

  const handleReply = async () => {
    if (!selectedReview) return;
    setReplyLoading(true);
    try {
      await replyReview(selectedReview.id, replyText);
      message.success('Phản hồi đánh giá thành công');
      loadReviews();
      const res = await fetchReviewDetail(selectedReview.id);
      setSelectedReview(res.data);
    } catch {
      message.error('Phản hồi thất bại');
    } finally {
      setReplyLoading(false);
    }
  };

  const handleDeleteReply = async () => {
    if (!selectedReview) return;
    try {
      await deleteReviewReply(selectedReview.id);
      message.success('Xóa phản hồi thành công');
      setReplyText('');
      loadReviews();
      const res = await fetchReviewDetail(selectedReview.id);
      setSelectedReview(res.data);
    } catch {
      message.error('Xóa phản hồi thất bại');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteReview(id);
      message.success('Xóa đánh giá thành công');
      setDetailVisible(false);
      loadReviews();
    } catch {
      message.error('Xóa đánh giá thất bại');
    }
  };

  const filteredReviews = reviews.filter((r) => {
    const keyword = searchQuery.toLowerCase();
    const matchSearch =
      r.fullName?.toLowerCase().includes(keyword) ||
      r.comment?.toLowerCase().includes(keyword) ||
      String(r.bookingId).includes(keyword);
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchRating = filterRating === 'all' || r.rating === filterRating;
    return matchSearch && matchStatus && matchRating;
  });

  const columns: ColumnsType<Review> = [
    {
      title: 'Khách hàng',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (_: string, record: Review) => (
        <Space size={12}>
          <Avatar
            size={38}
            style={{ background: brand.primary, fontWeight: 600, fontSize: 13 }}
          >
            {initialsOf(record.fullName || '?')}
          </Avatar>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600, color: brand.textPrimary }}>
              {record.fullName || 'Không xác định'}
            </div>
            <div style={{ fontSize: 12.5, color: brand.textSecondary }}>
              Booking #{record.bookingId}
            </div>
          </div>
        </Space>
      )
    },
    {
      title: 'Đánh giá',
      dataIndex: 'rating',
      key: 'rating',
      width: 160,
      render: (rating: number) => <Rate disabled value={rating} style={{ fontSize: 14 }} />
    },
    {
      title: 'Nội dung',
      dataIndex: 'comment',
      key: 'comment',
      ellipsis: true
    },
    {
      title: 'Ngày đánh giá',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      render: (date: string) => (date ? dayjs(date).format('DD/MM/YYYY') : '—')
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: Review['status']) => <StatusPill status={status} />
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 130,
      align: 'center' as const,
      render: (_: any, record: Review) => {
        const moreMenu: MenuProps['items'] = [
          ...(record.status !== 'approved'
            ? [{
                key: 'approve',
                label: 'Duyệt đánh giá',
                icon: <CheckOutlined />,
                onClick: () => handleUpdateStatus(record.id, 'approved')
              }]
            : []),
          ...(record.status !== 'rejected'
            ? [{
                key: 'reject',
                label: 'Từ chối đánh giá',
                icon: <CloseOutlined />,
                onClick: () => handleUpdateStatus(record.id, 'rejected')
              }]
            : []),
          { type: 'divider' as const },
          {
            key: 'delete',
            label: (
              <Popconfirm
                title="Xóa đánh giá này?"
                description="Hành động này không thể hoàn tác."
                onConfirm={() => handleDelete(record.id)}
                okText="Xóa"
                cancelText="Hủy"
              >
                <span style={{ color: brand.danger }}>Xóa đánh giá</span>
              </Popconfirm>
            ),
            icon: <DeleteOutlined style={{ color: brand.danger }} />
          }
        ];

        return (
          <Space
            size={6}
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', justifyContent: 'center' }}
          >
            <Button
              shape="circle"
              icon={<EyeOutlined />}
              onClick={() => openDetail(record.id)}
              title="Xem chi tiết"
              style={{ background: '#f1efe9', border: 'none', color: brand.textSecondary }}
            />
            <Button
              shape="circle"
              icon={<MessageOutlined />}
              onClick={() => openDetail(record.id)}
              title="Phản hồi"
              style={{ background: '#f4ece1', border: 'none', color: brand.primaryDark }}
            />
            <Dropdown menu={{ items: moreMenu }} trigger={['click']} placement="bottomRight">
              <Button
                shape="circle"
                icon={<MoreOutlined style={{ fontSize: 18 }} />}
                title="Thêm hành động"
                style={{ background: '#f1efe9', border: 'none', color: brand.textSecondary }}
              />
            </Dropdown>
          </Space>
        );
      }
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
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: brand.textPrimary }}>
              Quản lý đánh giá
            </h1>
            <p style={{ margin: '4px 0 0', color: brand.textSecondary, fontSize: 14 }}>
              Duyệt và phản hồi đánh giá từ khách hàng
            </p>
          </div>

          <Button icon={<ReloadOutlined />} onClick={loadReviews} loading={loading}>
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
            placeholder="Tìm theo tên, nội dung, mã booking..."
            prefix={<SearchOutlined style={{ color: brand.textSecondary }} />}
            allowClear
            style={{ width: 320 }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <Space size={10}>
            <Select
              value={filterRating}
              style={{ width: 130 }}
              onChange={setFilterRating}
              options={[
                { value: 'all', label: 'Tất cả sao' },
                { value: 5, label: '⭐ 5 sao' },
                { value: 4, label: '⭐ 4 sao' },
                { value: 3, label: '⭐ 3 sao' },
                { value: 2, label: '⭐ 2 sao' },
                { value: 1, label: '⭐ 1 sao' }
              ]}
            />

            <Segmented
              value={filterStatus}
              onChange={(value) => setFilterStatus(value as typeof filterStatus)}
              options={[
                { label: 'Tất cả', value: 'all' },
                { label: 'Chờ duyệt', value: 'pending' },
                { label: 'Đã duyệt', value: 'approved' },
                { label: 'Từ chối', value: 'rejected' }
              ]}
            />
          </Space>
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
            dataSource={filteredReviews}
            rowKey="id"
            loading={loading}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Không tìm thấy đánh giá phù hợp"
                  style={{ padding: '32px 0' }}
                />
              )
            }}
            onRow={(record) => ({
              style: { cursor: 'pointer' },
              onClick: () => openDetail(record.id)
            })}
            pagination={{
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} đánh giá`
            }}
          />
        </div>
      </div>

      {/* Modal Chi tiết */}
      <Modal
        title="Chi tiết đánh giá"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={620}
      >
        {selectedReview && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {/* Thông tin chính */}
            <div
              style={{
                background: brand.page,
                border: `1px solid ${brand.border}`,
                borderRadius: 10,
                padding: 16
              }}
            >
              <Space size={12} align="start">
                <Avatar
                  size={44}
                  style={{ background: brand.primary, fontWeight: 600, fontSize: 15, flexShrink: 0 }}
                >
                  {initialsOf(selectedReview.fullName || '?')}
                </Avatar>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: brand.textPrimary }}>
                    {selectedReview.fullName || 'Không xác định'}
                  </div>
                  <div style={{ fontSize: 13, color: brand.textSecondary, marginTop: 2 }}>
                    Booking #{selectedReview.bookingId} ·{' '}
                    {dayjs(selectedReview.createdAt).format('DD/MM/YYYY')}
                  </div>
                  <Rate
                    disabled
                    value={selectedReview.rating}
                    style={{ fontSize: 14, marginTop: 6 }}
                  />
                </div>
              </Space>

              <p
                style={{
                  marginTop: 12,
                  marginBottom: 0,
                  color: brand.textPrimary,
                  lineHeight: 1.6,
                  borderTop: `1px solid ${brand.border}`,
                  paddingTop: 12
                }}
              >
                {selectedReview.comment}
              </p>
            </div>

            {/* Trạng thái */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 600, color: brand.textPrimary, minWidth: 80 }}>
                Trạng thái:
              </span>
              <Select
                value={selectedReview.status}
                style={{ width: 160 }}
                onChange={(value) => handleUpdateStatus(selectedReview.id, value)}
                options={[
                  { value: 'pending', label: 'Chờ duyệt' },
                  { value: 'approved', label: 'Đã duyệt' },
                  { value: 'rejected', label: 'Từ chối' }
                ]}
              />
              <StatusPill status={selectedReview.status} />
            </div>

            {/* Phản hồi */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                  fontWeight: 600,
                  color: brand.textPrimary
                }}
              >
                <MessageOutlined style={{ color: brand.primary }} />
                Phản hồi từ khách sạn
              </div>
              <TextArea
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Nhập phản hồi..."
                style={{ borderColor: brand.border }}
              />
              <Space style={{ marginTop: 10 }}>
                <Button type="primary" onClick={handleReply} loading={replyLoading}>
                  Lưu phản hồi
                </Button>
                <Popconfirm title="Xóa phản hồi này?" onConfirm={handleDeleteReply} okText="Xóa" cancelText="Hủy">
                  <Button danger disabled={!selectedReview.adminReply}>
                    Xóa phản hồi
                  </Button>
                </Popconfirm>
              </Space>
            </div>

            {/* Vùng nguy hiểm */}
            <div
              style={{
                borderTop: `1px solid ${brand.border}`,
                paddingTop: 14,
                display: 'flex',
                justifyContent: 'flex-end'
              }}
            >
              <Popconfirm
                title="Xóa đánh giá này?"
                description="Hành động này không thể hoàn tác."
                onConfirm={() => handleDelete(selectedReview.id)}
                okText="Xóa"
                cancelText="Hủy"
              >
                <Button danger icon={<DeleteOutlined />}>
                  Xóa đánh giá
                </Button>
              </Popconfirm>
            </div>
          </Space>
        )}
      </Modal>
    </ConfigProvider>
  );
}

export default ReviewManagement;
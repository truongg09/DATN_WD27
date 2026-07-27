import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table,
  Button,
  message,
  Popconfirm,
  Rate,
  Typography,
  Select,
  Empty,
  Input,
  Modal,
  Form,
  Tag,
  Image,
  Space,
  Tooltip,
} from 'antd';
import {
  DeleteOutlined,
  ReloadOutlined,
  HomeOutlined,
  StarFilled,
  MessageOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../../services/api';
import dayjs from 'dayjs';
import './ReviewManagement.css';

const { Paragraph, Text } = Typography;
const { TextArea } = Input;

type ReviewStatus = 'approved' | 'hidden';

interface Review {
  id: number;
  bookingId: number;
  customerId: number;
  rating: number;
  comment: string;
  status: ReviewStatus;
  images?: string[];
  adminReply?: string | null;
  repliedAt?: string | null;
  createdAt: string;
  customerName: string;
  bookingStatus: string;
  roomId?: number;
  roomNumber?: string;
  roomTypeId?: number;
  roomTypeName?: string;
}

const STAR_OPTIONS = [5, 4, 3, 2, 1].map((star) => ({ value: star, label: `${star} sao` }));
const STATUS_OPTIONS = [
  { value: 'approved', label: 'Đang hiển thị' },
  { value: 'hidden', label: 'Đã ẩn' },
];

function ReviewManagement() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | null>(null);
  const [keyword, setKeyword] = useState('');

  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [activeReview, setActiveReview] = useState<Review | null>(null);
  const [replyForm] = Form.useForm();
  const [submittingReply, setSubmittingReply] = useState(false);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (ratingFilter) params.rating = ratingFilter;
      if (statusFilter) params.status = statusFilter;
      if (keyword.trim()) params.keyword = keyword.trim();

      const response = await api.get('/reviews', { params });
      const data = response.data || response;
      if (Array.isArray(data)) {
        setReviews(data);
      } else if (data && Array.isArray(data.data)) {
        setReviews(data.data);
      }
    } catch (error: any) {
      console.error('Error fetching reviews:', error);
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        message.error('Bạn không có quyền xem danh sách đánh giá');
      } else {
        message.error('Lỗi khi tải danh sách đánh giá');
      }
    } finally {
      setLoading(false);
    }
  }, [ratingFilter, statusFilter, keyword]);

  // debounce search 400ms
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReviews();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratingFilter, statusFilter, keyword]);

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/reviews/${id}`);
      message.success('Xóa đánh giá thành công');
      fetchReviews();
    } catch (error) {
      console.error('Error deleting review:', error);
      message.error('Lỗi khi xóa đánh giá');
    }
  };

  const handleToggleStatus = async (record: Review) => {
    const nextStatus: ReviewStatus = record.status === 'hidden' ? 'approved' : 'hidden';
    try {
      await api.patch(`/reviews/${record.id}/status`, { status: nextStatus });
      message.success(
        nextStatus === 'hidden' ? 'Đã ẩn đánh giá' : 'Đã hiển thị lại đánh giá',
      );
      setReviews((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, status: nextStatus } : r)),
      );
    } catch (error) {
      console.error('Error updating status:', error);
      message.error('Lỗi khi cập nhật trạng thái');
    }
  };

  const openReplyModal = (record: Review) => {
    setActiveReview(record);
    replyForm.setFieldsValue({ reply: record.adminReply || '' });
    setReplyModalOpen(true);
  };

  const closeReplyModal = () => {
    setReplyModalOpen(false);
    setActiveReview(null);
    replyForm.resetFields();
  };

  const handleSubmitReply = async () => {
    if (!activeReview) return;
    try {
      const values = await replyForm.validateFields();
      setSubmittingReply(true);
      await api.post(`/reviews/${activeReview.id}/reply`, { reply: values.reply });
      message.success('Gửi phản hồi thành công');
      setReviews((prev) =>
        prev.map((r) =>
          r.id === activeReview.id
            ? { ...r, adminReply: values.reply, repliedAt: new Date().toISOString() }
            : r,
        ),
      );
      closeReplyModal();
    } catch (error: any) {
      if (error?.errorFields) return; // lỗi validate form, không cần toast
      console.error('Error submitting reply:', error);
      message.error('Lỗi khi gửi phản hồi');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteReply = async (record: Review) => {
    try {
      await api.delete(`/reviews/${record.id}/reply`);
      message.success('Đã xóa phản hồi');
      setReviews((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, adminReply: null, repliedAt: null } : r)),
      );
    } catch (error) {
      console.error('Error deleting reply:', error);
      message.error('Lỗi khi xóa phản hồi');
    }
  };

  const stats = useMemo(() => {
    const total = reviews.length;
    const avgRating =
      total > 0 ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / total : 0;

    const distribution = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((r) => Number(r.rating) === star).length,
    }));

    const hiddenCount = reviews.filter((r) => r.status === 'hidden').length;

    return { total, avgRating, distribution, hiddenCount };
  }, [reviews]);

  const columns: ColumnsType<Review> = [
    {
      title: 'Khách hàng',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 160,
      render: (text: string) => <span className="review-customer-name">{text}</span>,
    },
    {
      title: 'Phòng',
      key: 'room',
      width: 150,
      render: (_, record) => (
        <div className="review-room-cell">
          {record.roomNumber ? (
            <span className="review-room-line">
              <HomeOutlined />
              Phòng {record.roomNumber}
            </span>
          ) : (
            <span className="review-room-line review-room-empty">
              <HomeOutlined />
              Chưa xác định
            </span>
          )}
          {record.roomTypeName && (
            <span className="review-room-type-tag">{record.roomTypeName}</span>
          )}
        </div>
      ),
    },
    {
      title: 'Số sao',
      dataIndex: 'rating',
      key: 'rating',
      width: 130,
      sorter: (a, b) => Number(a.rating) - Number(b.rating),
      render: (stars: number) => <Rate disabled defaultValue={stars} style={{ fontSize: 14 }} />,
    },
    {
      title: 'Nội dung đánh giá',
      dataIndex: 'comment',
      key: 'comment',
      render: (comment: string, record) => (
        <div>
          {comment ? (
            <Paragraph
              className="review-comment-text"
              ellipsis={{ rows: 2, expandable: true, symbol: 'Xem thêm' }}
            >
              {comment}
            </Paragraph>
          ) : (
            <span className="review-comment-empty">Không có bình luận</span>
          )}

          {record.images && record.images.length > 0 && (
            <div className="review-images-row">
              <Image.PreviewGroup>
                {record.images.slice(0, 4).map((src, idx) => (
                  <Image key={idx} src={src} width={48} height={48} className="review-thumb" />
                ))}
              </Image.PreviewGroup>
              {record.images.length > 4 && (
                <span className="review-images-more">+{record.images.length - 4}</span>
              )}
            </div>
          )}

          {record.adminReply && (
            <div className="review-admin-reply">
              <Text type="secondary" className="review-admin-reply-label">
                Phản hồi của khách sạn:
              </Text>
              <div>{record.adminReply}</div>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      filters: STATUS_OPTIONS.map((s) => ({ text: s.label, value: s.value })),
      onFilter: (value, record) => record.status === value,
      render: (status: ReviewStatus) =>
        status === 'hidden' ? (
          <Tag color="default">Đã ẩn</Tag>
        ) : (
          <Tag color="green">Đang hiển thị</Tag>
        ),
    },
    {
      title: 'Đặt phòng',
      dataIndex: 'bookingId',
      key: 'bookingId',
      width: 100,
      render: (id: number) => <span className="review-booking-tag">#{id}</span>,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      defaultSortOrder: 'descend',
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      render: (date: string) => (
        <span className="review-date-cell">{dayjs(date).format('DD/MM/YYYY HH:mm')}</span>
      ),
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={record.adminReply ? 'Sửa phản hồi' : 'Phản hồi'}>
            <Button
              icon={<MessageOutlined />}
              size="small"
              onClick={() => openReplyModal(record)}
            />
          </Tooltip>
          <Tooltip title={record.status === 'hidden' ? 'Hiển thị lại' : 'Ẩn đánh giá'}>
            <Button
              icon={record.status === 'hidden' ? <EyeOutlined /> : <EyeInvisibleOutlined />}
              size="small"
              onClick={() => handleToggleStatus(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Xóa đánh giá này?"
            description="Hành động này không thể hoàn tác."
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Xóa vĩnh viễn">
              <Button className="review-delete-btn" icon={<DeleteOutlined />} size="small" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <main className="review-mgmt-page">
      <section className="review-mgmt-shell">
        <div className="review-mgmt-hero">
          <div>
            <span className="review-mgmt-eyebrow">HotelHub · Admin</span>
            <h1>Quản lý đánh giá</h1>
            <p>Theo dõi phản hồi của khách hàng theo từng phòng và xử lý nội dung vi phạm.</p>
          </div>
          <div className="review-mgmt-toolbar">
            <Input
              allowClear
              placeholder="Tìm theo tên khách hoặc nội dung..."
              prefix={<SearchOutlined />}
              style={{ width: 240 }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Select
              allowClear
              placeholder="Lọc theo số sao"
              style={{ width: 150 }}
              value={ratingFilter ?? undefined}
              onChange={(value) => setRatingFilter(value ?? null)}
              options={STAR_OPTIONS}
            />
            <Select
              allowClear
              placeholder="Lọc theo trạng thái"
              style={{ width: 160 }}
              value={statusFilter ?? undefined}
              onChange={(value) => setStatusFilter(value ?? null)}
              options={STATUS_OPTIONS}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchReviews} loading={loading}>
              Làm mới
            </Button>
          </div>
        </div>

        <div className="review-mgmt-stats">
          <div className="review-stat-card">
            <span className="review-stat-label">Tổng số đánh giá</span>
            <div className="review-stat-value">{stats.total}</div>
          </div>

          <div className="review-stat-card">
            <span className="review-stat-label">Điểm trung bình</span>
            <div className="review-stat-value">
              <StarFilled className="star-icon" />
              {stats.avgRating.toFixed(1)}
              <span className="unit">/ 5</span>
            </div>
          </div>

          <div className="review-stat-card">
            <span className="review-stat-label">Đã ẩn</span>
            <div className="review-stat-value">{stats.hiddenCount}</div>
          </div>

          <div className="review-stat-card review-distribution-card">
            <span className="review-stat-label">Phân bố số sao</span>
            <div className="review-distribution-rows">
              {stats.distribution.map(({ star, count }) => (
                <div className="review-distribution-row" key={star}>
                  <span className="review-distribution-label">{star} sao</span>
                  <div className="review-distribution-track">
                    <div
                      className="review-distribution-fill"
                      style={{
                        width: stats.total > 0 ? `${(count / stats.total) * 100}%` : '0%',
                      }}
                    />
                  </div>
                  <span className="review-distribution-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="review-table-panel">
          <div className="review-table-header">
            <h2>Danh sách đánh giá</h2>
          </div>

          <Table
            className="review-mgmt-table"
            columns={columns}
            dataSource={reviews}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            locale={{
              emptyText: (
                <Empty
                  description={
                    ratingFilter || statusFilter || keyword
                      ? 'Không tìm thấy đánh giá phù hợp'
                      : 'Chưa có đánh giá nào'
                  }
                />
              ),
            }}
          />
        </div>
      </section>

      <Modal
        title={`Phản hồi đánh giá của ${activeReview?.customerName ?? ''}`}
        open={replyModalOpen}
        onCancel={closeReplyModal}
        onOk={handleSubmitReply}
        confirmLoading={submittingReply}
        okText={activeReview?.adminReply ? 'Cập nhật' : 'Gửi phản hồi'}
        cancelText="Hủy"
        destroyOnClose
        footer={[
          activeReview?.adminReply && (
            <Popconfirm
              key="delete-reply"
              title="Xóa phản hồi này?"
              onConfirm={() => {
                if (activeReview) handleDeleteReply(activeReview);
                closeReplyModal();
              }}
              okText="Xóa"
              cancelText="Hủy"
            >
              <Button danger>Xóa phản hồi</Button>
            </Popconfirm>
          ),
          <Button key="cancel" onClick={closeReplyModal}>
            Hủy
          </Button>,
          <Button key="submit" type="primary" loading={submittingReply} onClick={handleSubmitReply}>
            {activeReview?.adminReply ? 'Cập nhật' : 'Gửi phản hồi'}
          </Button>,
        ]}
      >
        {activeReview && (
          <div className="reply-modal-review-preview">
            <Rate disabled defaultValue={activeReview.rating} style={{ fontSize: 14 }} />
            <Paragraph type="secondary" className="reply-modal-comment">
              {activeReview.comment || 'Không có bình luận'}
            </Paragraph>
          </div>
        )}
        <Form form={replyForm} layout="vertical">
          <Form.Item
            name="reply"
            label="Nội dung phản hồi (hiển thị công khai)"
            rules={[
              { required: true, message: 'Vui lòng nhập nội dung phản hồi' },
              { max: 1000, message: 'Phản hồi tối đa 1000 ký tự' },
            ]}
          >
            <TextArea rows={4} placeholder="Cảm ơn quý khách đã đánh giá..." />
          </Form.Item>
        </Form>
      </Modal>
    </main>
  );
}

export default ReviewManagement;
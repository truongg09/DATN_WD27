import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  message,
  Popconfirm,
  Space,
  Card,
  Rate,
  Typography,
  Tag
} from 'antd';
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../services/api';
import dayjs from 'dayjs';

const { Title, Paragraph } = Typography;

interface Review {
  id: number;
  bookingId: number;
  customerId: number;
  rating: number;
  comment: string;
  createdAt: string;
  customerName: string;
  bookingStatus: string;
}

function ReviewManagement() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const response = await api.get('/reviews');
      const data = response.data || response;
      if (Array.isArray(data)) {
        setReviews(data);
      } else if (data && Array.isArray(data.data)) {
        setReviews(data.data);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      message.error('Lỗi khi tải danh sách đánh giá');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

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

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 70,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customerName',
      key: 'customerName',
      render: (text: string) => <strong>{text}</strong>,
      width: 200,
    },
    {
      title: 'Số sao',
      dataIndex: 'rating',
      key: 'rating',
      render: (stars: number) => <Rate disabled defaultValue={stars} style={{ fontSize: '14px' }} />,
      width: 150,
    },
    {
      title: 'Nội dung đánh giá',
      dataIndex: 'comment',
      key: 'comment',
      render: (comment: string) => <Paragraph ellipsis={{ rows: 2, expandable: true, symbol: 'Xem thêm' }}>{comment || 'Không có bình luận'}</Paragraph>
    },
    {
      title: 'Mã đặt phòng',
      dataIndex: 'bookingId',
      key: 'bookingId',
      render: (id: number) => <Tag color="blue">Booking #{id}</Tag>,
      width: 130,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
      width: 160,
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: any, record: Review) => (
        <Popconfirm
          title="Bạn có chắc muốn xóa đánh giá này?"
          onConfirm={() => handleDelete(record.id)}
          okText="Xóa"
          cancelText="Hủy"
        >
          <Button
            type="primary"
            danger
            icon={<DeleteOutlined />}
          />
        </Popconfirm>
      ),
      width: 100,
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Title level={3} style={{ margin: 0 }}>Quản lý đánh giá từ khách hàng</Title>
          <Button icon={<ReloadOutlined />} onClick={fetchReviews} />
        </div>

        <Table
          columns={columns}
          dataSource={reviews}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}

export default ReviewManagement;
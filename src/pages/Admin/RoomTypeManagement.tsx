import { useState, useEffect } from 'react';
import {
  Table,
  Card,
  message,
  Typography
} from 'antd';
import api from '../../services/api';

const { Title } = Typography;

interface RoomType {
  id: number;
  typeName: string;
  description: string;
  capacity: number;
  defaultPrice: string | number;
}

function RoomTypeManagement() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRoomTypes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/rooms/types');
      const data = response.data || response;
      if (Array.isArray(data)) {
        setRoomTypes(data);
      } else if (data && Array.isArray(data.data)) {
        setRoomTypes(data.data);
      }
    } catch (error) {
      console.error('Error fetching room types:', error);
      message.error('Lỗi khi tải danh sách loại phòng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomTypes();
  }, []);

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Tên loại phòng',
      dataIndex: 'typeName',
      key: 'typeName',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Sức chứa (người)',
      dataIndex: 'capacity',
      key: 'capacity',
      render: (capacity: number) => `${capacity} khách`,
    },
    {
      title: 'Giá mặc định / Đêm',
      dataIndex: 'defaultPrice',
      key: 'defaultPrice',
      render: (price: number | string) => {
        const val = typeof price === 'string' ? parseFloat(price) : price;
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
      },
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Title level={3} style={{ margin: 0 }}>Quản lý loại phòng</Title>
        </div>
        <Table
          columns={columns}
          dataSource={roomTypes}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}

export default RoomTypeManagement;
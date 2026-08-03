import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  message,
  Space,
  Card,
  Tag,
  Segmented,
  Popconfirm,
  Badge,
} from 'antd';
import { ReloadOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import axios from 'axios';
import api from '../../../services/api';
import { unwrapList } from '../../../utils/unwrapList';
import { formatPrice } from './helpers';

interface ServiceRequest {
  id: number;
  bookingId: number;
  serviceId: number;
  quantity: number;
  status: 'pending' | 'confirmed' | 'rejected';
  createdAt: string;
  serviceName: string | null;
  price: string | number | null;
  estimatedTotal: string | number | null;
  bookingStatus: string | null;
  roomNumber: string | null;
  bookingCustomer: string | null;
  bookingPhone: string | null;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ xác nhận', color: 'orange' },
  confirmed: { label: 'Đã xác nhận', color: 'green' },
  rejected: { label: 'Đã từ chối', color: 'red' },
};

type FilterValue = 'pending' | 'confirmed' | 'rejected' | 'all';

function ServiceRequestsTab() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterValue>('pending');
  const [pendingCount, setPendingCount] = useState(0);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === 'all' ? {} : { status: filter };
      const response = await api.get('/service-requests', { params });
      setRequests(unwrapList<ServiceRequest>(response));
    } catch (error) {
      console.error('Error fetching service requests:', error);
      message.error('Lỗi khi tải danh sách yêu cầu dịch vụ');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchPendingCount = useCallback(async () => {
    try {
      const response = await api.get('/service-requests', { params: { status: 'pending' } });
      setPendingCount(unwrapList<ServiceRequest>(response).length);
    } catch {
      // ignore badge errors
    }
  }, []);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    void fetchPendingCount();
  }, [fetchPendingCount, requests]);

  const handleConfirm = async (id: number) => {
    setProcessingId(id);
    try {
      const response = await api.patch(`/service-requests/${id}/confirm`);
      const result = (response as unknown as {
        data?: {
          service?: { totalPrice?: number };
          payment?: { remainingAmount?: number };
        };
      }).data;
      const service = result?.service;
      const payment = result?.payment;
      message.warning(
        `Đã cộng ${formatPrice(service?.totalPrice || 0)} tiền dịch vụ. Khách còn phải thanh toán ${formatPrice(payment?.remainingAmount || 0)}.`,
        7
      );
      void fetchRequests();
    } catch (error: unknown) {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      message.error(msg || 'Lỗi khi xác nhận yêu cầu');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: number) => {
    setProcessingId(id);
    try {
      await api.patch(`/service-requests/${id}/reject`);
      message.success('Đã từ chối yêu cầu');
      void fetchRequests();
    } catch (error: unknown) {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      message.error(msg || 'Lỗi khi từ chối yêu cầu');
    } finally {
      setProcessingId(null);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    {
      title: 'Đơn đặt phòng',
      key: 'booking',
      render: (_: unknown, r: ServiceRequest) => (
        <span>
          #{r.bookingId}
          {r.bookingCustomer ? ` · ${r.bookingCustomer}` : ''}
          {r.roomNumber ? <Tag style={{ marginLeft: 8 }}>Phòng {r.roomNumber}</Tag> : null}
          {r.bookingPhone ? <div style={{ fontSize: 12, color: '#888' }}>{r.bookingPhone}</div> : null}
        </span>
      ),
    },
    {
      title: 'Dịch vụ',
      dataIndex: 'serviceName',
      key: 'serviceName',
      render: (text: string | null) => <strong>{text || '—'}</strong>,
    },
    { title: 'SL', dataIndex: 'quantity', key: 'quantity', width: 70 },
    {
      title: 'Tạm tính',
      dataIndex: 'estimatedTotal',
      key: 'estimatedTotal',
      width: 150,
      render: (v: string | number | null) => formatPrice(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => {
        const meta = STATUS_META[status] || { label: status, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 230,
      render: (_: unknown, r: ServiceRequest) => {
        const canConfirm = ['confirmed', 'checked_in'].includes(r.bookingStatus || '');

        return r.status === 'pending' ? (
          <Space>
            <Popconfirm
              title="Bạn có chắc chắn muốn xác nhận?"
              onConfirm={() => handleConfirm(r.id)}
              okText="Xác nhận"
              cancelText="Hủy"
            >
              <Button
                type="primary"
                icon={<CheckOutlined />}
                size="small"
                loading={processingId === r.id}
                disabled={!canConfirm}
                title={!canConfirm
                  ? `Không thể xác nhận khi booking ở trạng thái ${r.bookingStatus || 'không xác định'}`
                  : undefined}
              />
            </Popconfirm>
            <Popconfirm
              title="Bạn có chắc chắn muốn từ chối?"
              onConfirm={() => handleReject(r.id)}
              okText="Từ chối"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="primary"
                danger
                icon={<CloseOutlined />}
                size="small"
                loading={processingId === r.id}
              />
            </Popconfirm>
          </Space>
        ) : (
          <span style={{ color: '#aaa' }}>Đã xử lý</span>
        );
      },
    },
  ];

  return (
    <Card
      title={
        <Space>
          <span style={{ fontWeight: 'bold' }}>Yêu cầu dịch vụ từ khách</span>
          <Badge count={pendingCount} />
        </Space>
      }
      extra={
        <Space>
          <Segmented
            value={filter}
            onChange={(value) => setFilter(value as FilterValue)}
            options={[
              { label: 'Chờ xác nhận', value: 'pending' },
              { label: 'Đã xác nhận', value: 'confirmed' },
              { label: 'Đã từ chối', value: 'rejected' },
              { label: 'Tất cả', value: 'all' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchRequests}>
            Làm mới
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={requests}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 8, showTotal: (total) => `Tổng ${total} yêu cầu` }}
      />
    </Card>
  );
}

export default ServiceRequestsTab;

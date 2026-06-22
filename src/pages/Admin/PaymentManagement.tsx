import React, { useEffect, useState } from 'react';
import {
  Table,
  Tag,
  Button,
  Card,
  message,
  Space,
  Select,
  Popconfirm,
  Modal,
  Descriptions,
} from 'antd';
import { ReloadOutlined, EyeOutlined, RollbackOutlined } from '@ant-design/icons';
import { getPayments, refundPayment } from '../../services/paymentService';
import { unwrapList } from '../../utils/unwrapList';
import type { Payment } from '../../types/payment';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('vi-VN').format(price) + '₫';

const statusMap: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Chưa thanh toán', color: 'orange' },
  paid: { label: 'Đã thanh toán', color: 'green' },
  refunded: { label: 'Đã hoàn tiền', color: 'red' },
};

const methodLabels: Record<string, string> = {
  cash: 'Tiền mặt',
  momo: 'MoMo',
  vnpay: 'VNPay',
};

function PaymentManagement() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? { paymentStatus: statusFilter } : undefined;
      const response = await getPayments(params);
      setPayments(unwrapList<Payment>(response));
    } catch {
      message.error('Lỗi khi tải danh sách thanh toán');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter]);

  const handleRefund = async (id: number) => {
    try {
      await refundPayment(id);
      message.success('Hoàn tiền thành công');
      fetchPayments();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Hoàn tiền thất bại');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'Booking', dataIndex: 'bookingId', key: 'bookingId', width: 80 },
    {
      title: 'Khách hàng',
      dataIndex: 'customerName',
      key: 'customerName',
    },
    {
      title: 'Phòng',
      dataIndex: 'roomNumber',
      key: 'roomNumber',
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: number) => formatPrice(amount),
    },
    {
      title: 'Đã trả',
      dataIndex: 'paidAmount',
      key: 'paidAmount',
      render: (amount: number) => formatPrice(amount),
    },
    {
      title: 'Phương thức',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (method: string) => methodLabels[method] || method || '-',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      render: (status: string) => (
        <Tag color={statusMap[status]?.color}>{statusMap[status]?.label || status}</Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: unknown, record: Payment) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedPayment(record);
              setDetailVisible(true);
            }}
          >
            Chi tiết
          </Button>
          {record.paymentStatus === 'paid' && (
            <Popconfirm
              title="Xác nhận hoàn tiền?"
              onConfirm={() => handleRefund(record.id)}
            >
              <Button size="small" danger icon={<RollbackOutlined />}>
                Hoàn tiền
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="Quản lý thanh toán"
        extra={
          <Space>
            <Select
              allowClear
              placeholder="Lọc trạng thái"
              style={{ width: 180 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'unpaid', label: 'Chưa thanh toán' },
                { value: 'paid', label: 'Đã thanh toán' },
                { value: 'refunded', label: 'Đã hoàn tiền' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchPayments}>
              Làm mới
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={payments}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="Chi tiết thanh toán"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedPayment && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Mã thanh toán">{selectedPayment.id}</Descriptions.Item>
            <Descriptions.Item label="Booking ID">{selectedPayment.bookingId}</Descriptions.Item>
            <Descriptions.Item label="Tiền phòng">
              {formatPrice(selectedPayment.roomAmount)}
            </Descriptions.Item>
            <Descriptions.Item label="Dịch vụ">
              {formatPrice(selectedPayment.serviceAmount)}
            </Descriptions.Item>
            <Descriptions.Item label="Giảm giá">
              {formatPrice(selectedPayment.discountAmount)}
            </Descriptions.Item>
            <Descriptions.Item label="Tổng cộng">
              {formatPrice(selectedPayment.totalAmount)}
            </Descriptions.Item>
            <Descriptions.Item label="Đã thanh toán">
              {formatPrice(selectedPayment.paidAmount)}
            </Descriptions.Item>
            <Descriptions.Item label="Còn lại">
              {formatPrice(selectedPayment.remainingAmount)}
            </Descriptions.Item>
            <Descriptions.Item label="Phương thức">
              {methodLabels[selectedPayment.paymentMethod || ''] || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={statusMap[selectedPayment.paymentStatus]?.color}>
                {statusMap[selectedPayment.paymentStatus]?.label}
              </Tag>
            </Descriptions.Item>
            {selectedPayment.transactionCode && (
              <Descriptions.Item label="Mã giao dịch">
                {selectedPayment.transactionCode}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

export default PaymentManagement;

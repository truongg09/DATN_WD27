import { useCallback, useEffect, useState } from 'react';
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
  Tabs,
  Badge,
  Input,
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  RollbackOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { confirmTransferPayment, getPayments, refundPayment } from '../../services/paymentService';
import {
  listRefunds,
  approveRefund,
  rejectRefund,
  type RefundRow,
} from '../../services/refundService';
import {
  listWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  type WalletTransaction,
} from '../../services/walletService';
import { unwrapList } from '../../utils/unwrapList';
import type { Payment } from '../../types/payment';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('vi-VN').format(price) + '₫';

const statusMap: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Chưa thanh toán', color: 'orange' },
  deposit_paid: { label: 'Đã đặt cọc', color: 'blue' },
  paid: { label: 'Đã thanh toán', color: 'green' },
  refunded: { label: 'Đã hoàn tiền', color: 'red' },
};

const bookingStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ xác nhận', color: 'gold' },
  confirmed: { label: 'Đã xác nhận', color: 'blue' },
  checked_in: { label: 'Đã check-in', color: 'cyan' },
  checked_out: { label: 'Đã check-out', color: 'green' },
  cancelled: { label: 'Đã hủy', color: 'red' },
};

const verificationStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ đối soát', color: 'gold' },
  confirmed: { label: 'Đã xác nhận', color: 'green' },
  rejected: { label: 'Từ chối', color: 'red' },
};

const methodLabels: Record<string, string> = {
  cash: 'Tiền mặt',
  zalopay: 'ZaloPay',
  vnpay: 'VNPay',
  bank_transfer: 'Chuyển khoản QR',
};

const refundStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ duyệt', color: 'gold' },
  approved: { label: 'Đã hoàn tiền', color: 'green' },
  rejected: { label: 'Đã từ chối', color: 'red' },
};

function PaymentManagement() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<number | null>(null);

  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [refundsLoading, setRefundsLoading] = useState(false);
  const [refundStatusFilter, setRefundStatusFilter] = useState<string | undefined>('pending');
  const [rejectTarget, setRejectTarget] = useState<RefundRow | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [processingRefundId, setProcessingRefundId] = useState<number | null>(null);

  const [withdrawals, setWithdrawals] = useState<WalletTransaction[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [withdrawStatusFilter, setWithdrawStatusFilter] = useState<string | undefined>('pending');
  const [rejectWithdrawTarget, setRejectWithdrawTarget] = useState<WalletTransaction | null>(null);
  const [rejectWithdrawNote, setRejectWithdrawNote] = useState('');
  const [processingWithdrawId, setProcessingWithdrawId] = useState<number | null>(null);

  const fetchPayments = useCallback(async () => {
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
  }, [statusFilter]);

  const fetchRefunds = useCallback(async () => {
    setRefundsLoading(true);
    try {
      const response = await listRefunds(
        refundStatusFilter ? { status: refundStatusFilter } : undefined
      );
      setRefunds(unwrapList<RefundRow>(response));
    } catch {
      message.error('Lỗi khi tải danh sách hoàn tiền');
    } finally {
      setRefundsLoading(false);
    }
  }, [refundStatusFilter]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    void fetchRefunds();
  }, [fetchRefunds]);

  const fetchWithdrawals = useCallback(async () => {
    setWithdrawalsLoading(true);
    try {
      const response = await listWithdrawals(
        withdrawStatusFilter ? { status: withdrawStatusFilter } : undefined
      );
      setWithdrawals(unwrapList<WalletTransaction>(response));
    } catch {
      message.error('Lỗi khi tải danh sách rút tiền');
    } finally {
      setWithdrawalsLoading(false);
    }
  }, [withdrawStatusFilter]);

  useEffect(() => {
    void fetchWithdrawals();
  }, [fetchWithdrawals]);

  const handleApproveWithdrawal = async (withdrawal: WalletTransaction) => {
    setProcessingWithdrawId(withdrawal.id);
    try {
      await approveWithdrawal(withdrawal.id);
      message.success(`Đã duyệt rút ${formatPrice(Number(withdrawal.amount))}`);
      fetchWithdrawals();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể duyệt lệnh rút');
    } finally {
      setProcessingWithdrawId(null);
    }
  };

  const handleRejectWithdrawal = async () => {
    if (!rejectWithdrawTarget) return;
    setProcessingWithdrawId(rejectWithdrawTarget.id);
    try {
      await rejectWithdrawal(rejectWithdrawTarget.id, rejectWithdrawNote.trim() || undefined);
      message.success('Đã từ chối lệnh rút, số dư trả lại ví khách');
      setRejectWithdrawTarget(null);
      setRejectWithdrawNote('');
      fetchWithdrawals();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể từ chối lệnh rút');
    } finally {
      setProcessingWithdrawId(null);
    }
  };

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

  const handleConfirmTransfer = async (payment: Payment) => {
    setConfirmingPaymentId(payment.id);
    try {
      await confirmTransferPayment(payment.id);
      message.success(`Đã xác nhận thanh toán cho booking #${payment.bookingId}`);
      fetchPayments();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể xác nhận thanh toán');
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  const handleApproveRefund = async (refund: RefundRow) => {
    setProcessingRefundId(refund.id);
    try {
      await approveRefund(refund.id);
      message.success(`Đã duyệt hoàn ${formatPrice(Number(refund.amount))} cho booking #${refund.bookingId}`);
      fetchRefunds();
      fetchPayments();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể duyệt hoàn tiền');
    } finally {
      setProcessingRefundId(null);
    }
  };

  const handleRejectRefund = async () => {
    if (!rejectTarget) return;
    setProcessingRefundId(rejectTarget.id);
    try {
      await rejectRefund(rejectTarget.id, rejectNote.trim() || undefined);
      message.success('Đã từ chối yêu cầu hoàn tiền');
      setRejectTarget(null);
      setRejectNote('');
      fetchRefunds();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể từ chối yêu cầu');
    } finally {
      setProcessingRefundId(null);
    }
  };

  const pendingCount = refunds.filter((refund) => refund.status === 'pending').length;
  const pendingWithdrawCount = withdrawals.filter((item) => item.status === 'pending').length;

  const withdrawalColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'Khách hàng', dataIndex: 'customer_name', key: 'customer_name' },
    { title: 'SĐT', dataIndex: 'customer_phone', key: 'customer_phone', width: 120 },
    {
      title: 'Số tiền rút',
      key: 'amount',
      render: (_: unknown, record: WalletTransaction) => (
        <strong style={{ color: '#b45309' }}>{formatPrice(Number(record.amount))}</strong>
      ),
    },
    {
      title: 'Nhận tiền',
      key: 'method',
      render: (_: unknown, record: WalletTransaction) =>
        record.refundMethod === 'cash' ? (
          <Tag>Tiền mặt tại quầy</Tag>
        ) : (
          <div style={{ fontSize: 13 }}>
            <div>
              <strong>{record.bankName || '-'}</strong>
            </div>
            <div>{record.accountNumber}</div>
            <div style={{ color: '#8a93a5' }}>{record.accountName}</div>
          </div>
        ),
    },
    {
      title: 'Ngày yêu cầu',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: WalletTransaction) => (
        <div>
          <Tag color={refundStatusMap[status]?.color}>
            {status === 'approved' ? 'Đã chi tiền' : refundStatusMap[status]?.label || status}
          </Tag>
          {record.note && <div style={{ fontSize: 12, color: '#8a93a5' }}>{record.note}</div>}
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: unknown, record: WalletTransaction) =>
        record.status === 'pending' ? (
          <Space>
            <Popconfirm
              title={`Duyệt rút ${formatPrice(Number(record.amount))}?`}
              description={
                record.refundMethod === 'cash'
                  ? 'Khách nhận tiền mặt tại quầy.'
                  : `Chuyển khoản tới ${record.bankName} - ${record.accountNumber}`
              }
              okText="Đã chi tiền"
              cancelText="Đóng"
              onConfirm={() => handleApproveWithdrawal(record)}
            >
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                loading={processingWithdrawId === record.id}
              >
                Duyệt
              </Button>
            </Popconfirm>
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => setRejectWithdrawTarget(record)}
            >
              Từ chối
            </Button>
          </Space>
        ) : (
          <span style={{ color: '#8a93a5', fontSize: 12 }}>
            {record.processedAt ? dayjs(record.processedAt).format('DD/MM/YYYY HH:mm') : '-'}
          </span>
        ),
    },
  ];

  const paymentColumns = [
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
      title: 'Trạng thái đặt phòng',
      dataIndex: 'bookingStatus',
      key: 'bookingStatus',
      render: (status: string) => (
        <Tag color={bookingStatusMap[status]?.color}>{bookingStatusMap[status]?.label || status || '-'}</Tag>
      ),
    },
    {
      title: 'Trạng thái thanh toán',
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
            type="primary"
            icon={<EyeOutlined style={{ color: 'white' }} />}
            size="small"
            onClick={() => {
              setSelectedPayment(record);
              setDetailVisible(true);
            }}
          />
          {record.verificationStatus === 'pending' && (
            <Popconfirm
              title={`Xác nhận đã nhận ${formatPrice(Number(record.verificationAmount || 0))}?`}
              description="Chỉ xác nhận sau khi đối soát giao dịch ngân hàng."
              onConfirm={() => handleConfirmTransfer(record)}
              okText="Xác nhận"
              cancelText="Hủy"
            >
              <Button
                type="primary"
                icon={<CheckOutlined />}
                size="small"
                loading={confirmingPaymentId === record.id}
              />
            </Popconfirm>
          )}
          {record.paymentStatus === 'paid' && (
            <Popconfirm
              title="Bạn có chắc chắn muốn hoàn tiền?"
              onConfirm={() => handleRefund(record.id)}
              okText="Hoàn tiền"
              cancelText="Hủy"
            >
              <Button
                type="primary"
                danger
                icon={<RollbackOutlined />}
                size="small"
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const refundColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'Booking', dataIndex: 'bookingId', key: 'bookingId', width: 80 },
    { title: 'Khách hàng', dataIndex: 'customer_name', key: 'customer_name' },
    { title: 'Phòng', dataIndex: 'room_number', key: 'room_number', width: 80 },
    {
      title: 'Số tiền hoàn',
      key: 'amount',
      render: (_: unknown, record: RefundRow) => (
        <div>
          <strong style={{ color: '#b45309' }}>{formatPrice(Number(record.amount))}</strong>
          <div style={{ fontSize: 12, color: '#8a93a5' }}>
            {Math.round(Number(record.refundRate) * 100)}% của {formatPrice(Number(record.paidAmount))}
          </div>
        </div>
      ),
    },
    {
      title: 'Nhận tiền',
      key: 'method',
      render: (_: unknown, record: RefundRow) =>
        record.refundMethod === 'cash' ? (
          <Tag>Tiền mặt tại quầy</Tag>
        ) : (
          <div style={{ fontSize: 13 }}>
            <div>
              <strong>{record.bankName || '-'}</strong>
            </div>
            <div>{record.accountNumber}</div>
            <div style={{ color: '#8a93a5' }}>{record.accountName}</div>
          </div>
        ),
    },
    {
      title: 'Ngày yêu cầu',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: RefundRow) => (
        <div>
          <Tag color={refundStatusMap[status]?.color}>{refundStatusMap[status]?.label || status}</Tag>
          {record.note && <div style={{ fontSize: 12, color: '#8a93a5' }}>{record.note}</div>}
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: unknown, record: RefundRow) =>
        record.status === 'pending' ? (
          <Space>
            <Popconfirm
              title={`Duyệt hoàn ${formatPrice(Number(record.amount))}?`}
              description={
                record.refundMethod === 'cash'
                  ? 'Khách nhận tiền mặt tại quầy.'
                  : `Chuyển khoản tới ${record.bankName} - ${record.accountNumber}`
              }
              okText="Duyệt hoàn tiền"
              cancelText="Đóng"
              onConfirm={() => handleApproveRefund(record)}
            >
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                loading={processingRefundId === record.id}
              >
                Duyệt
              </Button>
            </Popconfirm>
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => setRejectTarget(record)}
            >
              Từ chối
            </Button>
          </Space>
        ) : (
          <span style={{ color: '#8a93a5', fontSize: 12 }}>
            {record.processedAt ? dayjs(record.processedAt).format('DD/MM/YYYY HH:mm') : '-'}
          </span>
        ),
    },
  ];

  return (
    <div style={{ padding: '12px 8px 24px' }}>
      <Card styles={{ body: { padding: '16px 10px 20px' } }}>
        <Tabs
          defaultActiveKey="payments"
          items={[
            {
              key: 'payments',
              label: 'Quản lý thanh toán',
              children: (
                <>
                  <Space style={{ marginBottom: 16 }}>
                    <Select
                      allowClear
                      placeholder="Lọc trạng thái"
                      style={{ width: 180 }}
                      value={statusFilter}
                      onChange={setStatusFilter}
                      options={[
                        { value: 'unpaid', label: 'Chưa thanh toán' },
                        { value: 'deposit_paid', label: 'Đã đặt cọc' },
                        { value: 'paid', label: 'Đã thanh toán' },
                        { value: 'refunded', label: 'Đã hoàn tiền' },
                      ]}
                    />
                    <Button icon={<ReloadOutlined />} onClick={fetchPayments}>
                      Làm mới
                    </Button>
                  </Space>
                  <Table
                    style={{ width: '100%' }}
                    rowKey="id"
                    columns={paymentColumns}
                    dataSource={payments}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                  />
                </>
              ),
            },
            {
              key: 'refunds',
              label: (
                <Badge count={pendingCount} offset={[12, 0]} size="small">
                  Yêu cầu hoàn tiền
                </Badge>
              ),
              children: (
                <>
                  <Space style={{ marginBottom: 16 }}>
                    <Select
                      allowClear
                      placeholder="Lọc trạng thái"
                      style={{ width: 180 }}
                      value={refundStatusFilter}
                      onChange={setRefundStatusFilter}
                      options={[
                        { value: 'pending', label: 'Chờ duyệt' },
                        { value: 'approved', label: 'Đã hoàn tiền' },
                        { value: 'rejected', label: 'Đã từ chối' },
                      ]}
                    />
                    <Button icon={<ReloadOutlined />} onClick={fetchRefunds}>
                      Làm mới
                    </Button>
                  </Space>
                  <Table
                    rowKey="id"
                    columns={refundColumns}
                    dataSource={refunds}
                    loading={refundsLoading}
                    pagination={{ pageSize: 10 }}
                  />
                </>
              ),
            },
            {
              key: 'withdrawals',
              label: (
                <Badge count={pendingWithdrawCount} offset={[12, 0]} size="small">
                  Yêu cầu rút tiền
                </Badge>
              ),
              children: (
                <>
                  <Space style={{ marginBottom: 16 }}>
                    <Select
                      allowClear
                      placeholder="Lọc trạng thái"
                      style={{ width: 180 }}
                      value={withdrawStatusFilter}
                      onChange={setWithdrawStatusFilter}
                      options={[
                        { value: 'pending', label: 'Chờ duyệt' },
                        { value: 'approved', label: 'Đã chi tiền' },
                        { value: 'rejected', label: 'Đã từ chối' },
                      ]}
                    />
                    <Button icon={<ReloadOutlined />} onClick={fetchWithdrawals}>
                      Làm mới
                    </Button>
                  </Space>
                  <Table
                    rowKey="id"
                    columns={withdrawalColumns}
                    dataSource={withdrawals}
                    loading={withdrawalsLoading}
                    pagination={{ pageSize: 10 }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={rejectWithdrawTarget ? `Từ chối lệnh rút #${rejectWithdrawTarget.id}` : ''}
        open={!!rejectWithdrawTarget}
        okText="Từ chối lệnh rút"
        okButtonProps={{ danger: true, loading: processingWithdrawId === rejectWithdrawTarget?.id }}
        cancelText="Đóng"
        onOk={handleRejectWithdrawal}
        onCancel={() => setRejectWithdrawTarget(null)}
        destroyOnHidden
      >
        <p style={{ marginBottom: 8 }}>
          Số tiền sẽ được trả lại vào ví của khách. Khách thấy lý do bên dưới.
        </p>
        <Input.TextArea
          rows={3}
          maxLength={255}
          placeholder="Lý do từ chối (không bắt buộc)"
          value={rejectWithdrawNote}
          onChange={(e) => setRejectWithdrawNote(e.target.value)}
        />
      </Modal>

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
            <Descriptions.Item label="Trạng thái đặt phòng">
              <Tag color={bookingStatusMap[selectedPayment.bookingStatus || '']?.color}>
                {bookingStatusMap[selectedPayment.bookingStatus || '']?.label || selectedPayment.bookingStatus || '-'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Tiền phòng">
              {formatPrice(selectedPayment.roomAmount)}
            </Descriptions.Item>
            <Descriptions.Item label="Phụ thu người ở">
              {formatPrice(selectedPayment.surchargeAmount)}
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
            <Descriptions.Item label="Trạng thái thanh toán">
              <Tag color={statusMap[selectedPayment.paymentStatus]?.color}>
                {statusMap[selectedPayment.paymentStatus]?.label}
              </Tag>
            </Descriptions.Item>
            {selectedPayment.verificationStatus && (
              <Descriptions.Item label="Trạng thái đối soát">
                <Tag color={verificationStatusMap[selectedPayment.verificationStatus]?.color}>
                  {verificationStatusMap[selectedPayment.verificationStatus]?.label || selectedPayment.verificationStatus}
                </Tag>
              </Descriptions.Item>
            )}
            {selectedPayment.transactionCode && (
              <Descriptions.Item label="Mã giao dịch">
                {selectedPayment.transactionCode}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      <Modal
        title={rejectTarget ? `Từ chối hoàn tiền booking #${rejectTarget.bookingId}` : ''}
        open={!!rejectTarget}
        okText="Từ chối yêu cầu"
        okButtonProps={{ danger: true, loading: processingRefundId === rejectTarget?.id }}
        cancelText="Đóng"
        onOk={handleRejectRefund}
        onCancel={() => setRejectTarget(null)}
        destroyOnHidden
      >
        <p style={{ marginBottom: 8 }}>
          Khách sẽ thấy trạng thái "Từ chối hoàn tiền" kèm lý do bên dưới.
        </p>
        <Input.TextArea
          rows={3}
          maxLength={255}
          placeholder="Lý do từ chối (không bắt buộc)"
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}

export default PaymentManagement;

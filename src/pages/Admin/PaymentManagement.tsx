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
  Spin,
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  RollbackOutlined,
  CheckOutlined,
  CloseOutlined,
  PrinterOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';
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
import { renderRoomTypesSummaryText, getBookingTotalRoomCount } from '../../utils/bookingUtils';

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
  const [detailLoading, setDetailLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detailSummary, setDetailSummary] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detailBooking, setDetailBooking] = useState<any>(null);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<number | null>(null);

  useEffect(() => {
    if (detailVisible && selectedPayment) {
      let active = true;
      setDetailLoading(true);
      Promise.all([
        api.get(`/bookings/${selectedPayment.bookingId}/payment-summary`).catch(() => null),
        api.get(`/bookings/${selectedPayment.bookingId}`).catch(() => null),
      ]).then(([summaryRes, bookingRes]: [unknown, unknown]) => {
        if (!active) return;
        const sumObj = summaryRes as { data?: unknown } | null;
        const bookObj = bookingRes as { data?: unknown } | null;
        setDetailSummary(sumObj?.data || sumObj || null);
        setDetailBooking(bookObj?.data || bookObj || null);
      }).finally(() => {
        if (active) setDetailLoading(false);
      });
      return () => {
        active = false;
      };
    } else {
      setDetailSummary(null);
      setDetailBooking(null);
    }
  }, [detailVisible, selectedPayment]);

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
  const [selectedWithdrawalBill, setSelectedWithdrawalBill] = useState<WalletTransaction | null>(null);

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
      setSelectedWithdrawalBill({
        ...withdrawal,
        status: 'approved',
        processedAt: new Date().toISOString(),
      });
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
        ) : record.status === 'approved' ? (
          <Button
            type="default"
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => setSelectedWithdrawalBill(record)}
          >
            Xem Bill
          </Button>
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
      title: 'Hạng phòng / Phòng',
      key: 'room_number',
      render: (_: unknown, record: any) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1f1f1f' }}>
            {renderRoomTypesSummaryText(record)}
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
            {record.booking_rooms && record.booking_rooms.length > 0 ? (
              record.booking_rooms.map((r: any) => r.number).join(', ')
            ) : record.room_number ? (
              `Phòng ${record.room_number}`
            ) : (
              'Chưa xếp'
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: number) => <span style={{ whiteSpace: 'nowrap' }}>{formatPrice(amount)}</span>,
    },
    {
      title: 'Số tiền thanh toán',
      dataIndex: 'paidAmount',
      key: 'paidAmount',
      align: 'right' as const,
      render: (amount: number) => <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatPrice(amount)}</span>,
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
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined style={{ color: '#a78362' }} />
            <span>Chi tiết thanh toán — Booking #{selectedPayment?.bookingId}</span>
          </div>
        }
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            Đóng
          </Button>,
        ]}
        width={880}
        destroyOnHidden
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin tip="Đang tải chi tiết thanh toán..." />
          </div>
        ) : selectedPayment ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 1. THÔNG TIN ĐẶT PHÒNG */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10, color: '#2b2420', borderLeft: '3px solid #a78362', paddingLeft: 8 }}>
                Thông tin đặt phòng
              </div>
              <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
                <Descriptions.Item label="Mã đặt phòng">
                  <strong>#{selectedPayment.bookingId}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái đặt phòng">
                  {(() => {
                    const statusKey = detailBooking?.bookingStatus || detailBooking?.status || detailSummary?.bookingStatus || selectedPayment.bookingStatus || '';
                    const meta = bookingStatusMap[statusKey] || { label: statusKey || '—', color: 'default' };
                    return <Tag color={meta.color}>{meta.label}</Tag>;
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="Khách hàng">
                  <strong>{detailBooking?.customer_name || detailSummary?.customerName || selectedPayment.customerName || 'Khách lẻ'}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Email">
                  {detailBooking?.customer_email || 'Chưa cập nhật'}
                </Descriptions.Item>
                <Descriptions.Item label="Số điện thoại">
                  {detailBooking?.customer_phone || 'Chưa cập nhật'}
                </Descriptions.Item>
                <Descriptions.Item label="Hạng phòng">
                  {renderRoomTypesSummaryText(detailBooking || selectedPayment)}
                </Descriptions.Item>
                <Descriptions.Item label="Số phòng đã đặt">
                  {getBookingTotalRoomCount(detailBooking || selectedPayment)} phòng
                </Descriptions.Item>
                <Descriptions.Item label="Phòng thực tế" span={2}>
                  {(() => {
                    const target = detailBooking || selectedPayment;
                    const summaryList = (target?.roomTypesSummary && target.roomTypesSummary.length > 0)
                      ? target.roomTypesSummary
                      : [
                          {
                            typeName: target?.room_type_name || selectedPayment?.roomNumber || 'Standard',
                            quantity: getBookingTotalRoomCount(target),
                          }
                        ];

                    const roomsList = detailBooking?.booking_rooms || [];

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {summaryList.map((s: any, idx: number) => {
                          const matchingRooms = roomsList.filter(
                            (r: any) => (s.roomTypeId && Number(r.roomTypeId) === Number(s.roomTypeId)) || r.typeName === s.typeName
                          );
                          return (
                            <div key={s.roomTypeId || idx}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#1f1f1f' }}>
                                {s.typeName} ×{s.quantity} {s.roomPrice ? `(${formatPrice(s.roomPrice)}/đêm)` : ''}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                                {matchingRooms.length > 0 ? (
                                  matchingRooms.map((r: any, rIdx: number) => (
                                    <Tag key={r.id || rIdx} color="blue" style={{ margin: 0 }}>
                                      Phòng {r.number}
                                    </Tag>
                                  ))
                                ) : roomsList.length > 0 && idx === 0 ? (
                                  roomsList.map((r: any, rIdx: number) => (
                                    <Tag key={r.id || rIdx} color="blue" style={{ margin: 0 }}>
                                      Phòng {r.number}
                                    </Tag>
                                  ))
                                ) : (
                                  <span style={{ fontSize: 12, color: '#888' }}>Chưa xếp phòng</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian lưu trú">
                  {(() => {
                    const cIn = detailBooking?.check_in ? dayjs(detailBooking.check_in).format('DD/MM/YYYY') : '—';
                    const cOut = detailBooking?.check_out ? dayjs(detailBooking.check_out).format('DD/MM/YYYY') : '—';
                    const nights = detailBooking?.check_in && detailBooking?.check_out
                      ? Math.max(dayjs(detailBooking.check_out).diff(dayjs(detailBooking.check_in), 'day'), 1)
                      : 1;
                    return `${cIn} → ${cOut} (${nights} đêm)`;
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="Số khách">
                  {(() => {
                    const adults = Number(detailBooking?.num_adults || 0);
                    const children = Number(detailBooking?.num_children || 0);
                    if (adults > 0 || children > 0) {
                      return `${adults} người lớn${children > 0 ? `, ${children} trẻ em` : ''}`;
                    }
                    return 'Theo tiêu chuẩn hạng phòng';
                  })()}
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* 2. CHI TIẾT CHI PHÍ */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10, color: '#2b2420', borderLeft: '3px solid #a78362', paddingLeft: 8 }}>
                Chi tiết chi phí
              </div>
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                  <span>Tiền phòng</span>
                  <strong style={{ whiteSpace: 'nowrap' }}>{formatPrice(selectedPayment.roomAmount)}</strong>
                </div>
                {Number(detailSummary?.occupancySurcharge || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #f0f0f0' }}>
                    <span>Phụ thu người ở</span>
                    <strong style={{ whiteSpace: 'nowrap' }}>{formatPrice(Number(detailSummary.occupancySurcharge))}</strong>
                  </div>
                )}
                {Number(selectedPayment.serviceAmount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #f0f0f0' }}>
                    <span>Dịch vụ sử dụng</span>
                    <strong style={{ whiteSpace: 'nowrap' }}>{formatPrice(selectedPayment.serviceAmount)}</strong>
                  </div>
                )}
                {Number(detailSummary?.damageAmount || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #f0f0f0' }}>
                    <span>Phí phát sinh / Hư hỏng</span>
                    <strong style={{ whiteSpace: 'nowrap' }}>{formatPrice(Number(detailSummary.damageAmount))}</strong>
                  </div>
                )}
                {Number(detailSummary?.lateCheckoutSurcharge || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #f0f0f0' }}>
                    <span>Phí trả phòng muộn</span>
                    <strong style={{ whiteSpace: 'nowrap' }}>{formatPrice(Number(detailSummary.lateCheckoutSurcharge))}</strong>
                  </div>
                )}
                {Number(selectedPayment.discountAmount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #f0f0f0', color: '#52c41a' }}>
                    <span>Giảm giá (Voucher)</span>
                    <strong style={{ whiteSpace: 'nowrap' }}>-{formatPrice(selectedPayment.discountAmount)}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#f6ffed', color: '#1b5e20', fontSize: 16 }}>
                  <strong>Tổng cộng thanh toán</strong>
                  <strong style={{ whiteSpace: 'nowrap', fontSize: 17 }}>{formatPrice(selectedPayment.totalAmount)}</strong>
                </div>
              </div>
            </div>

            {/* 3. CHI TIẾT DỊCH VỤ (chỉ status = used) */}
            {(() => {
              const usedServices = (detailSummary?.services || []).filter((s: { status?: string }) => s.status === 'used');
              if (usedServices.length === 0) return null;
              return (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10, color: '#2b2420', borderLeft: '3px solid #a78362', paddingLeft: 8 }}>
                    Dịch vụ đã sử dụng
                  </div>
                  <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 16px', background: '#fafafa' }}>
                    {usedServices.map((s: { id: number; roomNumber?: string; serviceName: string; quantity: number; totalPrice: number | string }) => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #e8e8e8' }}>
                        <span>
                          {s.roomNumber ? <Tag color="blue" style={{ marginRight: 6 }}>Phòng {s.roomNumber}</Tag> : null}
                          <strong>{s.serviceName}</strong> × {s.quantity}
                        </span>
                        <strong style={{ whiteSpace: 'nowrap' }}>{formatPrice(Number(s.totalPrice))}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 4. PHÍ PHÁT SINH / HƯ HỎNG / TRẢ PHÒNG MUỘN (chỉ status = used) */}
            {(() => {
              const usedDamages = (detailSummary?.damages || []).filter((d: { status?: string }) => d.status === 'used');
              const lateFee = Number(detailSummary?.lateCheckoutSurcharge || 0);
              if (usedDamages.length === 0 && lateFee <= 0) return null;
              return (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10, color: '#2b2420', borderLeft: '3px solid #a78362', paddingLeft: 8 }}>
                    Chi tiết phụ thu / Báo hỏng
                  </div>
                  <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 16px', background: '#fff1f0' }}>
                    {lateFee > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #ffa39e' }}>
                        <span><Tag color="red" style={{ marginRight: 6 }}>Trễ giờ</Tag><strong>Phí trả phòng muộn</strong></span>
                        <strong style={{ whiteSpace: 'nowrap' }}>{formatPrice(lateFee)}</strong>
                      </div>
                    )}
                    {usedDamages.map((d: { id: number; roomNumber?: string; itemName: string; quantity: number; totalPrice: number | string; note?: string }) => (
                      <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #ffa39e' }}>
                        <span>
                          {d.roomNumber ? <Tag color="orange" style={{ marginRight: 6 }}>Phòng {d.roomNumber}</Tag> : null}
                          <strong>{d.itemName}</strong> {d.quantity > 1 ? `× ${d.quantity}` : ''} {d.note ? `(${d.note})` : ''}
                        </span>
                        <strong style={{ whiteSpace: 'nowrap' }}>{formatPrice(Number(d.totalPrice))}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 5. THÔNG TIN THANH TOÁN */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10, color: '#2b2420', borderLeft: '3px solid #a78362', paddingLeft: 8 }}>
                Thông tin thanh toán
              </div>
              <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
                <Descriptions.Item label="Mã thanh toán">
                  #{selectedPayment.id}
                </Descriptions.Item>
                <Descriptions.Item label="Phương thức">
                  <Tag color="blue">{methodLabels[selectedPayment.paymentMethod || ''] || selectedPayment.paymentMethod || 'Khác'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái thanh toán">
                  <Tag color={statusMap[selectedPayment.paymentStatus]?.color}>
                    {statusMap[selectedPayment.paymentStatus]?.label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Mã giao dịch">
                  {selectedPayment.transactionCode || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian thanh toán">
                  {selectedPayment.paymentDate ? dayjs(selectedPayment.paymentDate).format('DD/MM/YYYY HH:mm') : 'Chưa cập nhật'}
                </Descriptions.Item>
                <Descriptions.Item label="Đã thanh toán">
                  <strong style={{ color: '#389e0d', whiteSpace: 'nowrap' }}>{formatPrice(selectedPayment.paidAmount)}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Còn phải thanh toán">
                  <strong style={{ color: selectedPayment.remainingAmount > 0 ? '#cf1322' : '#595959', whiteSpace: 'nowrap' }}>
                    {formatPrice(selectedPayment.remainingAmount)}
                  </strong>
                </Descriptions.Item>
                {selectedPayment.paidAmount > selectedPayment.totalAmount && (
                  <Descriptions.Item label="Thanh toán thừa">
                    <Tag color="green" style={{ fontSize: 13, padding: '2px 8px' }}>
                      Thừa: {formatPrice(selectedPayment.paidAmount - selectedPayment.totalAmount)} (Cần hoàn)
                    </Tag>
                  </Descriptions.Item>
                )}
                {selectedPayment.verificationStatus && (
                  <Descriptions.Item label="Đối soát giao dịch">
                    <Tag color={verificationStatusMap[selectedPayment.verificationStatus]?.color}>
                      {verificationStatusMap[selectedPayment.verificationStatus]?.label || selectedPayment.verificationStatus}
                    </Tag>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>
          </div>
        ) : null}
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

      {/* MODAL BILL / PHIẾU CHI XÁC NHẬN RÚT TIỀN */}
      <Modal
        open={Boolean(selectedWithdrawalBill)}
        onCancel={() => setSelectedWithdrawalBill(null)}
        width={600}
        title={
          <span>
            <FileTextOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Phiếu chi — Xác nhận rút tiền ví
          </span>
        }
        footer={[
          <Button key="close" onClick={() => setSelectedWithdrawalBill(null)}>
            Đóng
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => window.print()}
          >
            In phiếu chi / Bill
          </Button>,
        ]}
        destroyOnHidden
        centered
      >
        <style>{`
          @media print {
            body * {
              visibility: hidden !important;
            }
            .withdrawal-bill-sheet,
            .withdrawal-bill-sheet * {
              visibility: visible !important;
            }
            .withdrawal-bill-sheet {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 30px !important;
              background: #ffffff !important;
              color: #000000 !important;
              z-index: 999999 !important;
            }
            .ant-modal-header,
            .ant-modal-footer,
            .ant-modal-close,
            .ant-modal-mask {
              display: none !important;
            }
            .ant-modal-wrap,
            .ant-modal-root,
            .ant-modal,
            .ant-modal-content,
            .ant-modal-body {
              position: static !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
            }
          }
        `}</style>
        {selectedWithdrawalBill && (
          <div className="withdrawal-bill-sheet" style={{ padding: '8px 4px' }}>
            <div style={{ textAlign: 'center', marginBottom: 20, borderBottom: '2px dashed #cbd5e1', paddingBottom: 16 }}>
              <h2 style={{ margin: 0, color: '#1e293b', fontSize: 20 }}>HotelHub — PHIẾU CHI TIỀN RÚT VÍ</h2>
              <p style={{ margin: '4px 0', color: '#64748b', fontSize: 13 }}>
                Xác nhận đã chi trả tiền cho khách hàng rút từ ví tích lũy
              </p>
              <Tag color="green" style={{ fontSize: 13, padding: '4px 12px', marginTop: 6 }}>
                Mã phiếu chi: BILL-RUT-{selectedWithdrawalBill.id}
              </Tag>
            </div>

            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Thời điểm chi tiền">
                <strong>
                  {selectedWithdrawalBill.processedAt
                    ? dayjs(selectedWithdrawalBill.processedAt).format('HH:mm - DD/MM/YYYY')
                    : dayjs().format('HH:mm - DD/MM/YYYY')}
                </strong>
              </Descriptions.Item>
              <Descriptions.Item label="Tên khách hàng">
                <strong>{selectedWithdrawalBill.customer_name || 'Khách hàng'}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">
                {selectedWithdrawalBill.customer_phone || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Email khách hàng">
                {selectedWithdrawalBill.customer_email || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Số tiền đã chi">
                <strong style={{ fontSize: 18, color: '#cf1322' }}>
                  {formatPrice(Number(selectedWithdrawalBill.amount))}
                </strong>
              </Descriptions.Item>
              <Descriptions.Item label="Hình thức nhận">
                {selectedWithdrawalBill.refundMethod === 'cash' ? (
                  <Tag color="orange">Nhận tiền mặt tại quầy lễ tân</Tag>
                ) : (
                  <Tag color="blue">Chuyển khoản ngân hàng</Tag>
                )}
              </Descriptions.Item>
              {selectedWithdrawalBill.refundMethod !== 'cash' && (
                <>
                  <Descriptions.Item label="Ngân hàng nhận">
                    <strong>{selectedWithdrawalBill.bankName || '—'}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="Số tài khoản">
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 14 }}>
                      {selectedWithdrawalBill.accountNumber || '—'}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="Chủ tài khoản">
                    <strong>{selectedWithdrawalBill.accountName || '—'}</strong>
                  </Descriptions.Item>
                </>
              )}
              <Descriptions.Item label="Ghi chú xác nhận">
                {selectedWithdrawalBill.note || 'Đã xác nhận chi tiền thành công cho khách hàng.'}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>Người lập phiếu / Lễ tân</p>
                <p style={{ margin: '40px 0 0', color: '#94a3b8', fontSize: 12 }}>(Ký và ghi rõ họ tên)</p>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>Khách hàng nhận tiền</p>
                <p style={{ margin: '40px 0 0', color: '#94a3b8', fontSize: 12 }}>(Ký và ghi rõ họ tên)</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PaymentManagement;

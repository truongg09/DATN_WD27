import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Descriptions,
  Divider,
  Modal,
  QRCode,
  Result,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd';
import {
  BellOutlined,
  CopyOutlined,
  DollarOutlined,
  LogoutOutlined,
  QrcodeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';
import { buildVietQrPayload, findBankByBin, toTransferText } from '../../utils/vietqr';

interface ChargeRow {
  serviceName?: string;
  itemName?: string;
  quantity: number;
  totalPrice: string | number;
  note?: string | null;
  createdAt?: string | null;
}

interface PaymentSummary {
  bookingId: number;
  bookingStatus: string;
  customerName: string | null;
  roomNumber: string | null;
  paymentId: number | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  serviceAmount: number;
  damageAmount: number;
  services: ChargeRow[];
  damages: ChargeRow[];
  canCheckOut: boolean;
  transferContent: string;
  bankAccount: {
    bankBin: string;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountName: string;
  };
}

const money = (value?: string | number | null) =>
  new Intl.NumberFormat('vi-VN').format(Number(value || 0)) + '₫';

const dateTime = (value?: string | null) =>
  value && dayjs(value).isValid() ? dayjs(value).format('HH:mm DD/MM/YYYY') : '—';

interface Props {
  bookingId: number | null;
  open: boolean;
  onClose: () => void;
  /** Gọi sau khi trả phòng thành công để danh sách ngoài tự làm mới */
  onCheckedOut: () => void;
}

const CheckoutPaymentModal: React.FC<Props> = ({ bookingId, open, onClose, onCheckedOut }) => {
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(
    async (silent = false) => {
      if (!bookingId) return null;
      if (!silent) setLoading(true);
      try {
        const response = await api.get(`/bookings/${bookingId}/payment-summary`);
        const data = (response as unknown as { data: PaymentSummary }).data;
        setSummary(data);
        setError(null);
        return data;
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
        if (!silent) {
          setError(msg || 'Không thể tải thông tin thanh toán');
          setSummary(null);
        }
        return null;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [bookingId]
  );

  useEffect(() => {
    if (!open || !bookingId) {
      setSummary(null);
      setError(null);
      return;
    }

    loadSummary();
    // Khách quét QR chuyển khoản xong, lễ tân không phải bấm gì: số tiền còn
    // thiếu tự cập nhật khi giao dịch được ghi nhận.
    const timer = window.setInterval(() => loadSummary(true), 8000);
    return () => window.clearInterval(timer);
  }, [open, bookingId, loadSummary]);

  const qrValue =
    summary && summary.remainingAmount > 0
      ? buildVietQrPayload({
          bankBin: summary.bankAccount.bankBin,
          accountNumber: summary.bankAccount.accountNumber,
          amount: summary.remainingAmount,
          addInfo: summary.transferContent,
        })
      : '';

  const bank = summary ? findBankByBin(summary.bankAccount.bankBin) : undefined;

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      message.success(`Đã sao chép ${label}`);
    } catch {
      message.warning('Trình duyệt không cho phép sao chép tự động');
    }
  };

  // Ghi nhận đã nhận tiền. Chỉ nhân viên gọi được API này — khách không thể tự
  // đánh dấu đã trả tiền.
  const recordPayment = async (paymentMethod: 'cash' | 'bank_transfer') => {
    if (!summary?.paymentId) return;
    setWorking(true);
    try {
      await api.post(`/payments/${summary.paymentId}/pay`, {
        paymentMethod,
        amount: summary.remainingAmount,
      });
      message.success(
        paymentMethod === 'cash'
          ? `Đã thu ${money(summary.remainingAmount)} tiền mặt`
          : `Đã ghi nhận ${money(summary.remainingAmount)} chuyển khoản`
      );
      await loadSummary();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      message.error(msg || 'Không ghi nhận được thanh toán');
    } finally {
      setWorking(false);
    }
  };

  const sendPaymentRequest = async () => {
    if (!bookingId) return;
    setWorking(true);
    try {
      await api.post(`/bookings/${bookingId}/payment-request`);
      message.success('Đã gửi yêu cầu thanh toán vào ứng dụng của khách');
      await loadSummary(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      message.error(msg || 'Không gửi được yêu cầu thanh toán');
    } finally {
      setWorking(false);
    }
  };

  const handleCheckOut = async () => {
    if (!bookingId) return;
    setWorking(true);
    try {
      await api.patch(`/bookings/${bookingId}/check-out`);
      message.success('Đã trả phòng thành công');
      onCheckedOut();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      message.error(msg || 'Không thể trả phòng');
      await loadSummary(true);
    } finally {
      setWorking(false);
    }
  };

  const chargeColumns = [
    { title: 'Khoản mục', key: 'name', render: (_: unknown, row: ChargeRow) => row.serviceName || row.itemName || '—' },
    { title: 'SL', dataIndex: 'quantity', align: 'center' as const, width: 60 },
    {
      title: 'Thành tiền',
      dataIndex: 'totalPrice',
      align: 'right' as const,
      render: (value: string | number) => <strong>{money(value)}</strong>,
    },
    { title: 'Thời điểm', dataIndex: 'createdAt', render: dateTime },
  ];

  return (
    <Modal
      title={
        <span>
          <DollarOutlined style={{ marginRight: 8 }} />
          Thu tiền & trả phòng
          {summary && <Tag style={{ marginLeft: 10 }}>Đơn #{summary.bookingId}</Tag>}
        </span>
      }
      open={open}
      onCancel={onClose}
      width={960}
      style={{ top: 24 }}
      styles={{ body: { maxHeight: 'calc(100vh - 170px)', overflowY: 'auto', paddingRight: 8 } }}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>Đóng</Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadSummary()} loading={loading}>
            Kiểm tra lại
          </Button>
          <Tooltip title={summary?.canCheckOut ? '' : 'Phải thu đủ tiền trước khi trả phòng'}>
            <Button
              type="primary"
              icon={<LogoutOutlined />}
              disabled={!summary?.canCheckOut}
              loading={working}
              onClick={handleCheckOut}
            >
              Trả phòng
            </Button>
          </Tooltip>
        </Space>
      }
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin tip="Đang tải công nợ..." />
        </div>
      )}

      {!loading && error && <Alert type="error" message={error} showIcon />}

      {!loading && !error && summary && (
        <>
          <Descriptions bordered size="small" column={3} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Khách hàng">{summary.customerName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Phòng">{summary.roomNumber || '—'}</Descriptions.Item>
            <Descriptions.Item label="Tổng hóa đơn">{money(summary.totalAmount)}</Descriptions.Item>
            <Descriptions.Item label="Đã thanh toán">
              <span style={{ color: '#389e0d' }}>{money(summary.paidAmount)}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Dịch vụ phát sinh">{money(summary.serviceAmount)}</Descriptions.Item>
            <Descriptions.Item label="Phí hư hỏng">{money(summary.damageAmount)}</Descriptions.Item>
          </Descriptions>

          {summary.remainingAmount <= 0 ? (
            <Result
              status="success"
              title="Khách đã thanh toán đủ"
              subTitle="Có thể bấm Trả phòng để hoàn tất thủ tục."
            />
          ) : (
            <>
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message={`Khách còn phải thanh toán ${money(summary.remainingAmount)}`}
                description="Đưa mã QR bên dưới cho khách quét bằng app ngân hàng, hoặc gửi yêu cầu để khách tự thanh toán trong ứng dụng. Sau khi tiền về, bấm ghi nhận rồi trả phòng."
              />

              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ padding: 12, background: '#fff', border: '1px solid #eee', borderRadius: 12 }}>
                    <QRCode value={qrValue || 'invalid'} size={220} errorLevel="M" bordered={false} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                    <QrcodeOutlined /> Quét bằng mọi app ngân hàng (VietQR)
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 300 }}>
                  <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="Ngân hàng">
                      {bank?.shortName || summary.bankAccount.bankName}
                    </Descriptions.Item>
                    <Descriptions.Item label="Số tài khoản">
                      {summary.bankAccount.accountNumber}
                      <Button
                        type="link"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => copy(summary.bankAccount.accountNumber, 'số tài khoản')}
                      />
                    </Descriptions.Item>
                    <Descriptions.Item label="Chủ tài khoản">{summary.bankAccount.accountName}</Descriptions.Item>
                    <Descriptions.Item label="Số tiền">
                      <strong style={{ color: '#cf1322', fontSize: 16 }}>{money(summary.remainingAmount)}</strong>
                      <Button
                        type="link"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => copy(String(summary.remainingAmount), 'số tiền')}
                      />
                    </Descriptions.Item>
                    <Descriptions.Item label="Nội dung chuyển khoản">
                      <strong>{toTransferText(summary.transferContent)}</strong>
                      <Button
                        type="link"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => copy(toTransferText(summary.transferContent), 'nội dung chuyển khoản')}
                      />
                      <div style={{ fontSize: 12, color: '#888' }}>
                        Giữ đúng nội dung này để đối soát sao kê theo mã đặt phòng.
                      </div>
                    </Descriptions.Item>
                  </Descriptions>

                  <Space wrap style={{ marginTop: 12 }}>
                    <Button icon={<BellOutlined />} onClick={sendPaymentRequest} loading={working}>
                      Gửi yêu cầu vào app của khách
                    </Button>
                    <Button type="primary" loading={working} onClick={() => recordPayment('bank_transfer')}>
                      Đã nhận chuyển khoản
                    </Button>
                    <Button loading={working} onClick={() => recordPayment('cash')}>
                      Thu tiền mặt
                    </Button>
                  </Space>
                </div>
              </div>
            </>
          )}

          {summary.services.length > 0 && (
            <>
              <Divider style={{ margin: '12px 0' }}>
                Dịch vụ đã dùng ({summary.services.length})
              </Divider>
              <Table
                rowKey={(row, index) => `${row.serviceName}-${index}`}
                size="small"
                pagination={false}
                dataSource={summary.services}
                columns={chargeColumns}
              />
            </>
          )}

          {summary.damages.length > 0 && (
            <>
              <Divider style={{ margin: '12px 0' }}>
                Phí hư hỏng ({summary.damages.length})
              </Divider>
              <Table
                rowKey={(row, index) => `${row.itemName}-${index}`}
                size="small"
                pagination={false}
                dataSource={summary.damages}
                columns={[
                  ...chargeColumns.slice(0, 3),
                  { title: 'Ghi chú', dataIndex: 'note', render: (v?: string | null) => v || '—' },
                  { title: 'Thời điểm', dataIndex: 'createdAt', render: dateTime },
                ]}
              />
            </>
          )}
        </>
      )}
    </Modal>
  );
};

export default CheckoutPaymentModal;

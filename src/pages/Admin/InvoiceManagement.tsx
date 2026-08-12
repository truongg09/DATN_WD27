import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, DatePicker, Descriptions, Empty, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import { EyeOutlined, PrinterOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { getInvoices } from '../../services/invoiceService';
import type { Invoice, InvoiceStatus } from '../../types/invoice';
import { unwrapList } from '../../utils/unwrapList';
import './InvoiceManagement.css';

const { RangePicker } = DatePicker;
const STATUS_META: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: 'Bản nháp', color: 'gold' },
  issued: { label: 'Đã phát hành', color: 'green' },
  cancelled: { label: 'Đã hủy', color: 'red' },
};
const formatCurrency = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
const formatDateTime = (value?: string) => value ? dayjs(value).format('DD/MM/YYYY HH:mm') : 'Chưa cập nhật';

function InvoiceManagement() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>();
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getInvoices(status ? { status } : undefined);
      setInvoices(unwrapList<Invoice>(response));
    } catch (requestError: unknown) {
      const apiError = requestError as { response?: { data?: { message?: string } } };
      const text = apiError.response?.data?.message || 'Không thể tải danh sách hóa đơn';
      setError(text);
      message.error(text);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    // Fetching is the external synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchInvoices();
  }, [fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi');
    return invoices.filter((invoice) => {
      const matchesQuery = !keyword || [invoice.invoiceNumber, invoice.customerName, invoice.customerEmail, invoice.customerPhone, invoice.roomNumber, invoice.bookingId]
        .some((value) => String(value || '').toLocaleLowerCase('vi').includes(keyword));
      const issuedDate = dayjs(invoice.issuedAt);
      return matchesQuery
        && (!dateRange?.[0] || !issuedDate.isBefore(dateRange[0], 'day'))
        && (!dateRange?.[1] || !issuedDate.isAfter(dateRange[1], 'day'));
    });
  }, [dateRange, invoices, query]);

  const columns = [
    { title: 'Mã hóa đơn', dataIndex: 'invoiceNumber', key: 'invoiceNumber', width: 175, render: (value: string) => <Typography.Text strong copyable>{value}</Typography.Text> },
    { title: 'Khách hàng', key: 'customer', render: (_: unknown, invoice: Invoice) => <div className="invoice-cell"><strong>{invoice.customerName || 'Khách lẻ'}</strong><span>{invoice.customerEmail || invoice.customerPhone || 'Chưa có liên hệ'}</span></div> },
    {
      title: 'Đặt phòng',
      key: 'booking',
      width: 175,
      render: (_: unknown, invoice: Invoice) => {
        const roomCount = invoice.booking_rooms?.length || invoice.roomQuantity || 1;
        const roomTypeName = invoice.roomTypeName || 'Chưa cập nhật';
        const typeSubtitle = `${roomTypeName} · ${roomCount} phòng`;
        return (
          <div className="invoice-cell">
            <strong>#{invoice.bookingId}</strong>
            <span style={{ fontSize: '12px', color: '#667085' }}>{typeSubtitle}</span>
            {invoice.booking_rooms && invoice.booking_rooms.length > 0 ? (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                {invoice.booking_rooms.map((r) => (
                  <Tag key={r.id || r.number} color="blue" style={{ margin: 0, fontSize: '11px', padding: '0 4px', lineHeight: '18px' }}>
                    {r.number}
                  </Tag>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '12px', color: '#667085' }}>Phòng {invoice.roomNumber || 'Chưa xếp'}</span>
            )}
          </div>
        );
      }
    },
    { title: 'Ngày phát hành', dataIndex: 'issuedAt', key: 'issuedAt', width: 165, sorter: (a: Invoice, b: Invoice) => dayjs(a.issuedAt).valueOf() - dayjs(b.issuedAt).valueOf(), render: formatDateTime },
    { title: 'Tổng tiền', dataIndex: 'totalAmount', key: 'totalAmount', width: 165, align: 'right' as const, sorter: (a: Invoice, b: Invoice) => a.totalAmount - b.totalAmount, render: (value: number) => <strong className="invoice-total">{formatCurrency(value)}</strong> },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 135, render: (value: InvoiceStatus) => { const meta = STATUS_META[value] || { label: value, color: 'default' }; return <Tag color={meta.color}>{meta.label}</Tag>; } },
    { title: 'Thao tác', key: 'actions', width: 115, fixed: 'right' as const, render: (_: unknown, invoice: Invoice) => <Button icon={<EyeOutlined />} onClick={() => setSelectedInvoice(invoice)}>Chi tiết</Button> },
  ];

  return <div className="invoice-management">
    <Card className="invoice-table-card" styles={{ body: { padding: '16px 10px 20px' } }}>
      <div className="invoice-section-title">Quản lý hóa đơn</div>
      <div className="invoice-filters">
        <Input allowClear prefix={<SearchOutlined />} placeholder="Tìm mã hóa đơn, khách hàng, booking, phòng" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Select allowClear placeholder="Trạng thái" value={status} onChange={setStatus} options={Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))} />
        <RangePicker value={dateRange} onChange={(value) => setDateRange(value)} format="DD/MM/YYYY" placeholder={['Từ ngày', 'Đến ngày']} />
        <Button icon={<ReloadOutlined />} onClick={() => void fetchInvoices()} loading={loading}>Làm mới</Button>
      </div>
      {error ? <Alert type="error" showIcon message="Không tải được dữ liệu hóa đơn" description={error} action={<Button onClick={() => void fetchInvoices()}>Thử lại</Button>} />
        : <Table rowKey="id" columns={columns} dataSource={filteredInvoices} loading={loading} scroll={{ x: 1050 }} locale={{ emptyText: <Empty description="Không tìm thấy hóa đơn phù hợp" /> }} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${total} hóa đơn` }} />}
    </Card>

    <Modal open={Boolean(selectedInvoice)} onCancel={() => setSelectedInvoice(null)} width={760} title={selectedInvoice ? `Hóa đơn ${selectedInvoice.invoiceNumber}` : 'Chi tiết hóa đơn'} footer={[<Button key="close" onClick={() => setSelectedInvoice(null)}>Đóng</Button>, <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>In hóa đơn</Button>]}>
      {selectedInvoice ? <InvoiceDetail invoice={selectedInvoice} /> : null}
    </Modal>
  </div>;
}

const PAYMENT_STATUS_META: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Chưa thanh toán', color: 'orange' },
  deposit_paid: { label: 'Đã đặt cọc', color: 'blue' },
  paid: { label: 'Đã thanh toán', color: 'green' },
  refunded: { label: 'Đã hoàn tiền', color: 'red' },
};

function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const status = STATUS_META[invoice.status] || { label: invoice.status, color: 'default' };
  const payMeta = invoice.paymentStatus ? PAYMENT_STATUS_META[invoice.paymentStatus] : null;
  const roomCount = invoice.booking_rooms?.length || invoice.roomQuantity || 1;
  const roomNumbers = invoice.booking_rooms && invoice.booking_rooms.length > 0
    ? invoice.booking_rooms.map((r) => r.number)
    : (invoice.roomNumber ? [invoice.roomNumber] : ['Chưa xếp']);

  const checkInDate = dayjs(invoice.checkIn);
  const checkOutDate = dayjs(invoice.checkOut);
  const nights = Math.max(checkOutDate.diff(checkInDate, 'day'), 1);

  const overpaid = Math.max((invoice.paidAmount || 0) - invoice.totalAmount, 0);

  return <div className="invoice-print-sheet">
    <div className="invoice-document-header">
      <div>
        <Typography.Title level={3}>HotelHub</Typography.Title>
        <Typography.Text type="secondary">Hóa đơn dịch vụ lưu trú</Typography.Text>
      </div>
      <div className="invoice-document-code">
        <strong>{invoice.invoiceNumber}</strong>
        <span>{formatDateTime(invoice.issuedAt)}</span>
        <div style={{ display: 'flex', gap: 6, marginTop: 4, justifyContent: 'flex-end' }}>
          <Tag color={status.color}>Hóa đơn: {status.label}</Tag>
          {payMeta && <Tag color={payMeta.color}>Thanh toán: {payMeta.label}</Tag>}
        </div>
      </div>
    </div>

    <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
      <Descriptions.Item label="Khách hàng">{invoice.customerName || 'Khách lẻ'}</Descriptions.Item>
      <Descriptions.Item label="Booking">#{invoice.bookingId}</Descriptions.Item>
      <Descriptions.Item label="Email">{invoice.customerEmail || 'Chưa cập nhật'}</Descriptions.Item>
      <Descriptions.Item label="Điện thoại">{invoice.customerPhone || 'Chưa cập nhật'}</Descriptions.Item>
      <Descriptions.Item label="Hạng phòng">{invoice.roomTypeName || 'Chưa cập nhật'} · {roomCount} phòng</Descriptions.Item>
      <Descriptions.Item label="Phòng thực tế">
        <Space size={[4, 4]} wrap>
          {roomNumbers.map((num) => (
            <Tag key={num} color="blue" style={{ margin: 0 }}>{num}</Tag>
          ))}
        </Space>
      </Descriptions.Item>
      <Descriptions.Item label="Thời gian lưu trú" span={2}>
        {checkInDate.format('DD/MM/YYYY')} đến {checkOutDate.format('DD/MM/YYYY')} ({nights} đêm)
      </Descriptions.Item>
    </Descriptions>

    <div className="invoice-amounts" style={{ marginTop: 16 }}>
      <AmountRow label="Tiền phòng" value={invoice.roomAmount} />

      {/* Dịch vụ */}
      {invoice.serviceAmount > 0 && (
        <>
          <AmountRow label="Tiền dịch vụ" value={invoice.serviceAmount} />
          {invoice.services && invoice.services.length > 0 && (
            <div style={{ paddingLeft: 16, marginBottom: 8 }}>
              {invoice.services.map((service) => (
                <div className="invoice-service-item" key={service.serviceId || service.serviceName}>
                  <span>• {service.serviceName} <small>({service.quantity} × {formatCurrency(service.unitPrice)})</small></span>
                  <strong>{formatCurrency(service.totalPrice)}</strong>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Phụ thu */}
      {invoice.surchargeAmount > 0 && (
        <>
          <AmountRow label="Phụ thu" value={invoice.surchargeAmount} />
          <div style={{ paddingLeft: 16, marginBottom: 8 }}>
            {Number(invoice.lateCheckoutSurcharge || 0) > 0 && (
              <div className="invoice-service-item">
                <span>• Phí trả phòng muộn</span>
                <strong>{formatCurrency(Number(invoice.lateCheckoutSurcharge))}</strong>
              </div>
            )}
            {Number(invoice.occupancySurcharge || 0) > 0 && (
              <div className="invoice-service-item">
                <span>• Phụ thu người ở / trẻ em</span>
                <strong>{formatCurrency(Number(invoice.occupancySurcharge))}</strong>
              </div>
            )}
            {invoice.damages && invoice.damages.length > 0 && invoice.damages.map((d) => (
              <div className="invoice-service-item" key={d.id || d.itemName}>
                <span>• {d.itemName} {d.quantity > 1 ? `(${d.quantity} × ${formatCurrency(d.unitPrice)})` : ''}</span>
                <strong>{formatCurrency(d.totalPrice)}</strong>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Giảm giá & Đặt cọc */}
      {invoice.discountAmount > 0 && <AmountRow label="Giảm giá (Voucher)" value={-invoice.discountAmount} />}
      {Number(invoice.depositAmount || 0) > 0 && <AmountRow label="Tiền cọc" value={invoice.depositAmount || 0} />}

      {/* Thông tin thanh toán tổng */}
      <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: 8, marginTop: 8 }}>
        <AmountRow label="Tổng thanh toán" value={invoice.totalAmount} total />
        <AmountRow label="Đã thanh toán" value={invoice.paidAmount || 0} />
        <AmountRow label="Còn phải thanh toán" value={invoice.remainingAmount || 0} />
        {overpaid > 0 && (
          <div className="invoice-amount-row" style={{ color: '#389e0d' }}>
            <span>Thanh toán thừa</span>
            <strong>{formatCurrency(overpaid)}</strong>
          </div>
        )}
      </div>
    </div>

    <p className="invoice-print-note" style={{ marginTop: 20 }}>Cảm ơn quý khách đã sử dụng dịch vụ của HotelHub.</p>
  </div>;
}

function AmountRow({ label, value, total = false }: { label: string; value: number; total?: boolean }) {
  return <div className={total ? 'invoice-amount-row invoice-amount-total' : 'invoice-amount-row'}><span>{label}</span><strong>{formatCurrency(value)}</strong></div>;
}

export default InvoiceManagement;

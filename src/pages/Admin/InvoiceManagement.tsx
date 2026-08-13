import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, DatePicker, Descriptions, Empty, Input, Modal, Select, Table, Tag, Typography, message } from 'antd';
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
    { title: 'Đặt phòng', key: 'booking', width: 145, render: (_: unknown, invoice: Invoice) => <div className="invoice-cell"><strong>#{invoice.bookingId}</strong><span>Phòng {invoice.roomNumber || 'Chưa xếp'}</span></div> },
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

function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const status = STATUS_META[invoice.status] || { label: invoice.status, color: 'default' };
  const breakdown = invoice.breakdown;
  const nightlyPrices = invoice.nightlyPrices || [];
  const transfers = invoice.transfers || [];
  const damages = invoice.damages || [];

  return (
    <div className="invoice-print-sheet">
      <div className="invoice-document-header">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            HotelHub
          </Typography.Title>
          <Typography.Text type="secondary">Hóa đơn dịch vụ lưu trú & Chi tiết thanh toán</Typography.Text>
        </div>
        <div className="invoice-document-code">
          <strong>{invoice.invoiceNumber}</strong>
          <span>{formatDateTime(invoice.issuedAt)}</span>
          <Tag color={status.color}>{status.label}</Tag>
        </div>
      </div>

      <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Khách hàng">{invoice.customerName || 'Khách lẻ'}</Descriptions.Item>
        <Descriptions.Item label="Mã Đặt phòng">#{invoice.bookingId}</Descriptions.Item>
        <Descriptions.Item label="Email">{invoice.customerEmail || 'Chưa cập nhật'}</Descriptions.Item>
        <Descriptions.Item label="Điện thoại">{invoice.customerPhone || 'Chưa cập nhật'}</Descriptions.Item>
        <Descriptions.Item label="Phòng">{invoice.roomNumber ? `Phòng ${invoice.roomNumber}` : 'Chưa xếp'} · {invoice.roomTypeName || 'Chưa cập nhật'}</Descriptions.Item>
        <Descriptions.Item label="Thời gian lưu trú">
          {dayjs(invoice.checkIn).format('DD/MM/YYYY')} đến {dayjs(invoice.checkOut).format('DD/MM/YYYY')}
        </Descriptions.Item>
      </Descriptions>

      {transfers.length > 0 && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}>
          <strong style={{ color: '#389e0d' }}>Thông tin chuyển phòng:</strong>
          {transfers.map((t) => (
            <div key={t.id} style={{ fontSize: 13, marginTop: 4 }}>
              • Chuyển từ <strong>Phòng {t.fromRoomNumber || t.fromRoomId}</strong> sang <strong>Phòng {t.toRoomNumber || t.toRoomId}</strong> kể từ ngày {dayjs(t.fromDate).format('DD/MM/YYYY')}
              {t.reason ? ` (Lý do: ${t.reason})` : ''}
            </div>
          ))}
        </div>
      )}

      {nightlyPrices.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 8, fontSize: 13 }}>
            Chi tiết giá phòng từng đêm lưu trú ({nightlyPrices.length} đêm):
          </div>
          <Table
            rowKey={(r: any) => `${r.stayDate}-${r.roomId || '0'}`}
            size="small"
            pagination={false}
            dataSource={nightlyPrices}
            columns={[
              {
                title: 'Ngày lưu trú',
                dataIndex: 'stayDate',
                render: (val: string, r: any) => (
                  <span>
                    <strong>{dayjs(val).format('DD/MM/YYYY')}</strong> ({r.dayName || ''})
                  </span>
                ),
              },
              {
                title: 'Phân loại ngày',
                dataIndex: 'priceType',
                render: (type: string, r: any) => {
                  if (r.isHoliday || type === 'holiday') return <Tag color="red">Dịp lễ</Tag>;
                  if (r.isSunday || type === 'sunday') return <Tag color="orange">Chủ nhật</Tag>;
                  if (r.isSaturday || type === 'weekend') return <Tag color="purple">Thứ 7 / Cuối tuần</Tag>;
                  return <Tag color="blue">Ngày thường</Tag>;
                },
              },
              {
                title: 'Phòng',
                dataIndex: 'roomNumber',
                render: (num?: string, r?: any) => (
                  <Tag color="cyan">P.{num || r?.roomId || invoice.roomNumber || '—'}</Tag>
                ),
              },
              {
                title: 'Đơn giá đêm',
                dataIndex: 'price',
                align: 'right' as const,
                render: (price: number) => <strong style={{ color: '#047857' }}>{formatCurrency(price)}</strong>,
              },
              {
                title: 'Ghi chú / Dịp',
                dataIndex: 'note',
                render: (note?: string) => note || '—',
              },
            ]}
          />
        </div>
      )}

      <div className="invoice-amounts">
        <AmountRow
          label={`Tiền phòng tiêu chuẩn ${breakdown?.totalNights ? `(${breakdown.totalNights} đêm)` : ''}`}
          value={breakdown?.baseRoomAmount ?? invoice.roomAmount}
        />

        {breakdown && breakdown.holidaySurcharge > 0 && (
          <div className="invoice-service-item" style={{ borderLeftColor: '#ff4d4f' }}>
            <span>
              <Tag color="red" style={{ marginRight: 4 }}>Dịp lễ</Tag>
              Phụ thu giá ngày lễ
            </span>
            <strong style={{ color: '#cf1322' }}>+{formatCurrency(breakdown.holidaySurcharge)}</strong>
          </div>
        )}

        {breakdown && breakdown.sundaySurcharge > 0 && (
          <div className="invoice-service-item" style={{ borderLeftColor: '#fa8c16' }}>
            <span>
              <Tag color="orange" style={{ marginRight: 4 }}>Chủ nhật</Tag>
              Phụ thu giá Chủ nhật
            </span>
            <strong style={{ color: '#d46b08' }}>+{formatCurrency(breakdown.sundaySurcharge)}</strong>
          </div>
        )}

        {breakdown && breakdown.weekendSurcharge > 0 && (
          <div className="invoice-service-item" style={{ borderLeftColor: '#722ed1' }}>
            <span>
              <Tag color="purple" style={{ marginRight: 4 }}>Thứ 7</Tag>
              Phụ thu giá cuối tuần
            </span>
            <strong style={{ color: '#531dab' }}>+{formatCurrency(breakdown.weekendSurcharge)}</strong>
          </div>
        )}

        {(invoice.occupancySurcharge ?? 0) > 0 && (
          <AmountRow label="Phụ thu người lớn / trẻ em" value={invoice.occupancySurcharge || 0} />
        )}

        {invoice.serviceAmount > 0 && (
          <>
            <AmountRow label="Tiền dịch vụ phát sinh" value={invoice.serviceAmount} />
            {invoice.services?.map((service) => (
              <div className="invoice-service-item" key={service.serviceId}>
                <span>
                  {service.serviceName}
                  <small>{service.quantity} × {formatCurrency(service.unitPrice)}</small>
                </span>
                <strong>{formatCurrency(service.totalPrice)}</strong>
              </div>
            ))}
          </>
        )}

        {damages.length > 0 && (
          <>
            <AmountRow label="Phí bồi thường / Khoản thu khác" value={damages.reduce((sum, d) => sum + d.totalPrice, 0)} />
            {damages.map((dmg) => (
              <div className="invoice-service-item" key={dmg.id} style={{ borderLeftColor: '#ff7875' }}>
                <span>
                  {dmg.itemName} {dmg.roomNumber ? `(P.${dmg.roomNumber})` : ''}
                  <small>{dmg.quantity} × {formatCurrency(dmg.unitPrice)}</small>
                </span>
                <strong>{formatCurrency(dmg.totalPrice)}</strong>
              </div>
            ))}
          </>
        )}

        {invoice.discountAmount > 0 && (
          <AmountRow label="Giảm giá (Voucher)" value={-invoice.discountAmount} />
        )}

        {(invoice.depositAmount ?? 0) > 0 && (
          <AmountRow label="Tiền đặt cọc" value={invoice.depositAmount || 0} />
        )}

        <AmountRow label="Đã thanh toán" value={invoice.paidAmount || 0} />
        <AmountRow label="Còn phải thanh toán" value={invoice.remainingAmount || 0} />
        <AmountRow label="Tổng thanh toán" value={invoice.totalAmount} total />
      </div>
      <p className="invoice-print-note">Cảm ơn quý khách đã sử dụng dịch vụ của HotelHub.</p>
    </div>
  );
}

function AmountRow({ label, value, total = false }: { label: string; value: number; total?: boolean }) {
  return (
    <div className={total ? 'invoice-amount-row invoice-amount-total' : 'invoice-amount-row'}>
      <span>{label}</span>
      <strong>{formatCurrency(value)}</strong>
    </div>
  );
}

export default InvoiceManagement;

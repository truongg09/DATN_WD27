import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Alert, Button, Card, DatePicker, Descriptions, Empty, Input, Modal, Select, Table, Tag, Tooltip, Typography, message } from 'antd';
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
  const navigate = useNavigate();
  const location = useLocation();
  const areaPrefix = location.pathname.startsWith('/staff') ? '/staff' : '/admin';

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
      const matchesQuery = !keyword || [
        invoice.invoiceNumber,
        invoice.customerName,
        invoice.customerEmail,
        invoice.customerPhone,
        invoice.roomNumber,
        invoice.bookingId,
        ...(invoice.rooms?.map((r) => r.roomNumber) || []),
        ...(invoice.rooms?.map((r) => r.typeName) || [])
      ].some((value) => String(value || '').toLocaleLowerCase('vi').includes(keyword));
      const issuedDate = dayjs(invoice.issuedAt);
      return matchesQuery
        && (!dateRange?.[0] || !issuedDate.isBefore(dateRange[0], 'day'))
        && (!dateRange?.[1] || !issuedDate.isAfter(dateRange[1], 'day'));
    });
  }, [dateRange, invoices, query]);

  const columns = [
    {
      title: 'Mã hóa đơn',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      width: 175,
      render: (value: string, invoice: Invoice) => (
        <Tooltip title="Xem chi tiết hóa đơn">
          <Button
            type="link"
            size="small"
            style={{
              padding: 0,
              height: 'auto',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedInvoice(invoice);
            }}
          >
            {value}
          </Button>
        </Tooltip>
      ),
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_: unknown, invoice: Invoice) => (
        <div className="invoice-cell">
          <strong>{invoice.customerName || 'Khách lẻ'}</strong>
          <span>{invoice.customerEmail || invoice.customerPhone || 'Chưa có liên hệ'}</span>
        </div>
      ),
    },
    {
      title: 'Đặt phòng',
      key: 'booking',
      width: 165,
      render: (_: unknown, invoice: Invoice) => {
        const roomList = invoice.rooms && invoice.rooms.length > 0
          ? invoice.rooms.map((r) => r.roomNumber).filter(Boolean)
          : (invoice.roomNumber ? [invoice.roomNumber] : []);
        return (
          <div className="invoice-cell">
            <Tooltip title="Xem chi tiết đặt phòng">
              <Button
                type="link"
                size="small"
                style={{
                  padding: 0,
                  height: 'auto',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'inline-block',
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(`${areaPrefix}/bookings/${invoice.bookingId}`);
                }}
              >
                #{invoice.bookingId}
              </Button>
            </Tooltip>
            <span>
              {roomList.length > 0 ? (
                roomList.length === 1 ? `Phòng ${roomList[0]}` : `Phòng: ${roomList.join(', ')} (${roomList.length} phòng)`
              ) : 'Chưa xếp'}
            </span>
          </div>
        );
      },
    },
    { title: 'Ngày phát hành', dataIndex: 'issuedAt', key: 'issuedAt', width: 165, sorter: (a: Invoice, b: Invoice) => dayjs(a.issuedAt).valueOf() - dayjs(b.issuedAt).valueOf(), render: formatDateTime },
    { title: 'Tổng tiền', dataIndex: 'totalAmount', key: 'totalAmount', width: 165, align: 'right' as const, sorter: (a: Invoice, b: Invoice) => a.totalAmount - b.totalAmount, render: (value: number) => <strong className="invoice-total">{formatCurrency(value)}</strong> },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 135, render: (value: InvoiceStatus) => { const meta = STATUS_META[value] || { label: value, color: 'default' }; return <Tag color={meta.color}>{meta.label}</Tag>; } },
    // Cùng quy ước với các bảng khác: nút xem chi tiết là nút chính tô đậm, cỡ nhỏ,
    // chỉ icon và mô tả nằm ở tooltip.
    { title: 'Thao tác', key: 'actions', width: 90, fixed: 'right' as const, render: (_: unknown, invoice: Invoice) => <Tooltip title="Xem chi tiết hóa đơn"><Button type="primary" size="small" icon={<EyeOutlined />} onClick={() => setSelectedInvoice(invoice)} /></Tooltip> },
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

    <Modal
      open={Boolean(selectedInvoice)}
      onCancel={() => setSelectedInvoice(null)}
      width={760}
      title={selectedInvoice ? `Hóa đơn ${selectedInvoice.invoiceNumber}` : 'Chi tiết hóa đơn'}
      footer={[
        <Button key="close" onClick={() => setSelectedInvoice(null)}>Đóng</Button>,
        <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>In hóa đơn</Button>
      ]}
    >
      {selectedInvoice ? (
        <InvoiceDetail
          invoice={selectedInvoice}
          onNavigateBooking={(bookingId) => {
            setSelectedInvoice(null);
            navigate(`${areaPrefix}/bookings/${bookingId}`);
          }}
        />
      ) : null}
    </Modal>
  </div>;
}

function InvoiceDetail({
  invoice,
  onNavigateBooking,
}: {
  invoice: Invoice;
  onNavigateBooking?: (bookingId: number) => void;
}) {
  const status = STATUS_META[invoice.status] || { label: invoice.status, color: 'default' };
  const breakdown = invoice.breakdown;
  const nightlyPrices = invoice.nightlyPrices || [];
  const transfers = invoice.transfers || [];
  const damages = invoice.damages || [];
  const lateCharges = invoice.lateCharges || [];
  const rooms = invoice.rooms || [];

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
        <Descriptions.Item label="Mã Đặt phòng">
          {invoice.bookingId ? (
            <Tooltip title="Xem chi tiết đặt phòng">
              <Button
                type="link"
                size="small"
                style={{
                  padding: 0,
                  height: 'auto',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  color: '#1677ff',
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onNavigateBooking?.(invoice.bookingId);
                }}
              >
                #{invoice.bookingId}
              </Button>
            </Tooltip>
          ) : (
            <span>Chưa có mã</span>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Email">{invoice.customerEmail || 'Chưa cập nhật'}</Descriptions.Item>
        <Descriptions.Item label="Điện thoại">{invoice.customerPhone || 'Chưa cập nhật'}</Descriptions.Item>
        <Descriptions.Item label="Thời gian lưu trú" span={2}>
          {dayjs(invoice.checkIn).format('DD/MM/YYYY')} đến {dayjs(invoice.checkOut).format('DD/MM/YYYY')}
        </Descriptions.Item>
      </Descriptions>

      {/* DANH SÁCH PHÒNG LƯU TRÚ (MULTI-ROOM SUPPORT) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 8, fontSize: 13 }}>
          Thông tin phòng lưu trú ({rooms.length > 0 ? `${rooms.length} phòng` : '1 phòng'}):
        </div>
        {rooms.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rooms.map((rm, idx) => (
              <div
                key={rm.bookingDetailId || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: '#f8fafc',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Tag color="cyan" style={{ fontWeight: 600, fontSize: 13, padding: '2px 8px' }}>
                    Phòng {rm.roomNumber || rm.roomId || 'Chưa xếp'}
                  </Tag>
                  <strong style={{ color: '#0f172a' }}>{rm.typeName || rm.roomTypeName || 'Chưa cập nhật'}</strong>
                  <span style={{ color: '#64748b', fontSize: 12 }}>
                    ({dayjs(rm.checkInDate || invoice.checkIn).format('DD/MM/YYYY')} – {dayjs(rm.checkOutDate || invoice.checkOut).format('DD/MM/YYYY')})
                  </span>
                  {(rm.adults || rm.children) ? (
                    <span style={{ color: '#8d8478', fontSize: 12 }}>
                      · {rm.adults || 1} người lớn{rm.children ? `, ${rm.children} trẻ em` : ''}
                    </span>
                  ) : null}
                </div>
                {rm.roomPrice > 0 && (
                  <div style={{ color: '#047857', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                    {formatCurrency(rm.roomPrice)}/đêm
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Tag color="cyan">Phòng {invoice.roomNumber || 'Chưa xếp'}</Tag>
            <strong>{invoice.roomTypeName || 'Chưa cập nhật'}</strong>
          </div>
        )}
      </div>

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

        {lateCharges.length > 0 && (
          <>
            <AmountRow label="Phụ thu trả phòng muộn" value={lateCharges.reduce((sum, l) => sum + l.totalPrice, 0)} />
            {lateCharges.map((lc) => (
              <div className="invoice-service-item" key={lc.id} style={{ borderLeftColor: '#faad14' }}>
                <span>
                  {lc.name} {lc.tierPercent ? `(${lc.tierPercent}%)` : ''}
                  <small>{lc.note || (lc.lateMinutes ? `Trễ ${lc.lateMinutes} phút` : 'Phụ thu trả phòng muộn')}</small>
                </span>
                <strong>{formatCurrency(lc.totalPrice)}</strong>
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

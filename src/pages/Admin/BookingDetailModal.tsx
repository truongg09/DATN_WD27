import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Descriptions, Empty, Modal, Spin, Table, Tabs, Tag, Timeline, Tooltip } from 'antd';
import {
  ClockCircleOutlined,
  DollarOutlined,
  HomeOutlined,
  IdcardOutlined,
  PlusCircleOutlined,
  QrcodeOutlined,
  RollbackOutlined,
  SwapOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';

export interface BookingHistoryEntry {
  id: number;
  action: string;
  description: string | null;
  amount: string | number | null;
  performedByName: string | null;
  performedByRole: string | null;
  createdAt: string;
}

interface ServiceRow {
  id: number;
  serviceName: string;
  description?: string | null;
  unitPrice: string | number;
  quantity: number;
  totalPrice: string | number;
  createdAt?: string | null;
}

interface DamageRow {
  id: number;
  itemName: string;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  note?: string | null;
  createdAt?: string | null;
}

interface GuestRow {
  id: number;
  fullName: string;
  identityNumber: string;
  phone?: string | null;
  note?: string | null;
}

interface TransferRow {
  id: number;
  fromRoomNumber?: string | null;
  toRoomNumber?: string | null;
  fromDate: string;
  toDate: string;
  pricePerNight: string | number;
  reason?: string | null;
  createdAt?: string | null;
}

interface PaymentRow {
  id: number;
  roomAmount: string | number;
  serviceAmount: string | number;
  surchargeAmount: string | number;
  discountAmount: string | number;
  depositAmount?: string | number;
  paidAmount: string | number;
  remainingAmount: string | number;
  totalAmount: string | number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  transactionCode?: string | null;
  paymentDate?: string | null;
}

interface RefundRow {
  id: number;
  amount: string | number;
  refundRate: string | number;
  refundMethod: string;
  status: string;
  note?: string | null;
  createdAt?: string | null;
  processedAt?: string | null;
}

interface BookingDetail {
  id: number;
  booking_code?: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  room_number: string | null;
  room_type_name: string | null;
  room_floor?: number | null;
  room_area?: string | number | null;
  room_capacity?: number | null;
  room_status?: string | null;
  room_price?: string | number | null;
  check_in: string | null;
  check_out: string | null;
  status: string;
  adults: number | null;
  children: number | null;
  total_price: string | number | null;
  payable_total?: string | number | null;
  occupancy_surcharge?: string | number | null;
  notes?: string | null;
  cancellation_reason?: string | null;
  requested_check_in_time?: string | null;
  requested_check_in_day_offset?: number | null;
  created_at?: string | null;
  voucher?: { id: number; code: string; discountType: string; discountValue: string | number } | null;
  services?: ServiceRow[];
  damages?: DamageRow[];
  guests?: GuestRow[];
  transfers?: TransferRow[];
  payments?: PaymentRow[];
  refunds?: RefundRow[];
  history?: BookingHistoryEntry[];
}

const money = (value?: string | number | null) =>
  new Intl.NumberFormat('vi-VN').format(Number(value || 0)) + '₫';

const day = (value?: string | null) => {
  if (!value) return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('DD/MM/YYYY') : '—';
};

const dateTime = (value?: string | null) => {
  if (!value) return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('HH:mm — DD/MM/YYYY') : '—';
};

const statusText: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  checked_in: 'Đang lưu trú',
  checked_out: 'Đã trả phòng',
  cancelled: 'Đã hủy',
  no_show: 'Khách không đến',
};

const statusColor: Record<string, string> = {
  pending: 'orange',
  confirmed: 'blue',
  checked_in: 'green',
  checked_out: 'default',
  cancelled: 'red',
  no_show: 'volcano',
};

const paymentStatusText: Record<string, string> = {
  unpaid: 'Chưa thanh toán',
  deposit_paid: 'Đã đặt cọc',
  paid: 'Đã thanh toán đủ',
  refunded: 'Đã hoàn tiền',
};

const paymentMethodText: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  vnpay: 'VNPay',
  zalopay: 'ZaloPay',
  credit_card: 'Thẻ tín dụng',
};

const refundStatusText: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
};

// Mỗi loại thao tác có màu và biểu tượng riêng để đọc nhanh dòng thời gian.
const actionMeta: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  created: { label: 'Tạo đặt phòng', color: 'blue', icon: <PlusCircleOutlined /> },
  payment: { label: 'Thanh toán', color: 'green', icon: <DollarOutlined /> },
  voucher_applied: { label: 'Áp voucher', color: 'purple', icon: <DollarOutlined /> },
  service_added: { label: 'Thêm dịch vụ', color: 'cyan', icon: <PlusCircleOutlined /> },
  damage_added: { label: 'Phí hư hỏng', color: 'orange', icon: <ToolOutlined /> },
  extended: { label: 'Gia hạn ngày ở', color: 'geekblue', icon: <ClockCircleOutlined /> },
  room_transferred: { label: 'Chuyển phòng', color: 'purple', icon: <SwapOutlined /> },
  checked_in: { label: 'Nhận phòng', color: 'green', icon: <HomeOutlined /> },
  checked_out: { label: 'Trả phòng', color: 'gray', icon: <HomeOutlined /> },
  guests_updated: { label: 'Khai báo khách', color: 'blue', icon: <IdcardOutlined /> },
  cancelled: { label: 'Hủy đặt phòng', color: 'red', icon: <RollbackOutlined /> },
  no_show: { label: 'Khách không đến', color: 'volcano', icon: <RollbackOutlined /> },
  payment_requested: { label: 'Yêu cầu thanh toán', color: 'gold', icon: <QrcodeOutlined /> },
  transfer_confirmation: { label: 'Khách báo đã chuyển khoản', color: 'gold', icon: <QrcodeOutlined /> },
  refund: { label: 'Hoàn tiền', color: 'red', icon: <RollbackOutlined /> },
  refund_approved: { label: 'Duyệt hoàn tiền', color: 'green', icon: <RollbackOutlined /> },
  refund_rejected: { label: 'Từ chối hoàn tiền', color: 'red', icon: <RollbackOutlined /> },
};

const roleText: Record<string, string> = {
  admin: 'Quản trị viên',
  employee: 'Nhân viên',
  staff: 'Nhân viên',
  customer: 'Khách hàng',
  system: 'Hệ thống',
};

const emptyBox = (text: string) => ({
  emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text} />,
});

interface Props {
  bookingId: number | null;
  open: boolean;
  onClose: () => void;
}

const BookingDetailModal: React.FC<Props> = ({ bookingId, open, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<BookingDetail | null>(null);

  // silent = true dùng cho vòng tự làm mới: không bật spinner để nội dung đang
  // đọc không bị nháy mỗi 10 giây.
  const fetchDetail = useCallback(async (silent = false) => {
    if (!bookingId) return;
    if (!silent) setLoading(true);
    try {
      const response = await api.get(`/bookings/${bookingId}`);
      setDetail((response as unknown as { data: BookingDetail }).data);
      setError(null);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (!silent) {
        setError(message || 'Không thể tải chi tiết đặt phòng');
        setDetail(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (!open || !bookingId) {
      setDetail(null);
      setError(null);
      return;
    }

    fetchDetail();
    // Tự làm mới trong lúc modal đang mở: lễ tân thêm dịch vụ hoặc thu tiền ở
    // máy khác thì số liệu và lịch sử ở đây cập nhật theo, không phải F5.
    const timer = window.setInterval(() => fetchDetail(true), 10000);
    return () => window.clearInterval(timer);
  }, [open, bookingId, fetchDetail]);

  const services = detail?.services || [];
  const damages = detail?.damages || [];
  const guests = detail?.guests || [];
  const transfers = detail?.transfers || [];
  const payments = detail?.payments || [];
  const refunds = detail?.refunds || [];
  const history = detail?.history || [];

  const serviceTotal = services.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const damageTotal = damages.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);

  const mainPayment = payments[0];
  const nights =
    detail?.check_in && detail?.check_out
      ? Math.max(dayjs(detail.check_out).startOf('day').diff(dayjs(detail.check_in).startOf('day'), 'day'), 0)
      : 0;
  const roomOnlyAmount = Number(detail?.total_price || 0) - Number(detail?.occupancy_surcharge || 0);
  const paidAmount = Number(mainPayment?.paidAmount || 0);
  const remainingAmount = Number(mainPayment?.remainingAmount || 0);
  const discountAmount = Number(mainPayment?.discountAmount || 0);

  const getBookingDisplayTag = (b: any) => {
    if (!b) return { label: '—', color: 'default' };
    const normStatus = String(b.status || 'pending').toLowerCase();
    if (
      ['pending', 'confirmed'].includes(normStatus) &&
      !b.actual_check_in_time &&
      b.check_in
    ) {
      const checkInStr = dayjs(b.check_in).format('YYYY-MM-DD');
      const reqTime = b.requested_check_in_time || '14:00:00';
      const offset = Number(b.requested_check_in_day_offset || 0);
      const requestedDateTime = dayjs(`${checkInStr} ${reqTime}`).add(offset, 'day');
      const lateDeadline = requestedDateTime.add(6, 'hour');
      const now = dayjs();

      if (now.isAfter(requestedDateTime) && (now.isBefore(lateDeadline) || now.isSame(lateDeadline))) {
        return { label: 'Check-in muộn', color: 'orange' };
      }
    }
    return {
      label: statusText[normStatus] || normStatus,
      color: statusColor[normStatus] || 'default'
    };
  };

  const overviewTab = detail && (
    <>
      <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }} title="Thông tin khách và phòng">
        <Descriptions.Item label="Mã đặt phòng">
          #{detail.id}
          {detail.booking_code ? ` (${detail.booking_code})` : ''}
        </Descriptions.Item>
        <Descriptions.Item label="Trạng thái">
          {(() => {
            const tag = getBookingDisplayTag(detail);
            return <Tag color={tag.color}>{tag.label}</Tag>;
          })()}
        </Descriptions.Item>
        <Descriptions.Item label="Khách hàng">{detail.customer_name || '—'}</Descriptions.Item>
        <Descriptions.Item label="Số điện thoại">{detail.customer_phone || '—'}</Descriptions.Item>
        <Descriptions.Item label="Email" span={2}>{detail.customer_email || '—'}</Descriptions.Item>
        <Descriptions.Item label="Phòng">
          {detail.room_number ? `Phòng ${detail.room_number}` : '—'}
          {detail.room_type_name ? ` (${detail.room_type_name})` : ''}
        </Descriptions.Item>
        <Descriptions.Item label="Tầng / Diện tích / Sức chứa">
          {detail.room_floor ?? '—'} / {detail.room_area ? `${detail.room_area}m²` : '—'} /{' '}
          {detail.room_capacity ? `${detail.room_capacity} khách` : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Ngày nhận phòng">{day(detail.check_in)}</Descriptions.Item>
        <Descriptions.Item label="Giờ check-in dự kiến">
          {detail.requested_check_in_time
            ? `${String(detail.requested_check_in_time).slice(0, 5)}${Number(detail.requested_check_in_day_offset || 0) === 1 ? ' (ngày hôm sau)' : ''}`
            : '14:00 (Chuẩn)'}
        </Descriptions.Item>
        <Descriptions.Item label="Ngày trả phòng">{day(detail.check_out)}</Descriptions.Item>
        <Descriptions.Item label="Số đêm lưu trú">{nights} đêm</Descriptions.Item>
        <Descriptions.Item label="Số khách">
          {detail.adults ?? 0} người lớn, {detail.children ?? 0} trẻ em
        </Descriptions.Item>
        <Descriptions.Item label="Thời điểm đặt">{dateTime(detail.created_at)}</Descriptions.Item>
        <Descriptions.Item label="Trạng thái phòng hiện tại">{detail.room_status || '—'}</Descriptions.Item>
        <Descriptions.Item label="Ghi chú của khách" span={2}>{detail.notes || '—'}</Descriptions.Item>
        {detail.cancellation_reason && (
          <Descriptions.Item label="Lý do hủy" span={2}>{detail.cancellation_reason}</Descriptions.Item>
        )}
      </Descriptions>

      <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }} title="Tổng hợp chi phí">
        <Descriptions.Item label="Tiền phòng">
          {money(roomOnlyAmount)}
          {nights > 0 && (
            <span style={{ color: '#888' }}> ({nights} đêm × {money(detail.room_price)})</span>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Phụ thu khách (trẻ em)">{money(detail.occupancy_surcharge)}</Descriptions.Item>
        <Descriptions.Item label="Dịch vụ phát sinh">
          {money(serviceTotal)} <span style={{ color: '#888' }}>({services.length} mục)</span>
        </Descriptions.Item>
        <Descriptions.Item label="Phí hư hỏng">
          {money(damageTotal)} <span style={{ color: '#888' }}>({damages.length} mục)</span>
        </Descriptions.Item>
        <Descriptions.Item label="Giảm giá (voucher)">
          {discountAmount > 0 ? `− ${money(discountAmount)}` : money(0)}
          {detail.voucher?.code && <Tag color="purple" style={{ marginLeft: 6 }}>{detail.voucher.code}</Tag>}
        </Descriptions.Item>
        <Descriptions.Item label="Tổng phải thanh toán">
          <strong style={{ fontSize: 16 }}>{money(detail.payable_total ?? detail.total_price)}</strong>
        </Descriptions.Item>
      </Descriptions>

      <Descriptions bordered size="small" column={2} title="Tình trạng thanh toán">
        <Descriptions.Item label="Đã thanh toán">
          <strong style={{ color: '#389e0d' }}>{money(paidAmount)}</strong>
        </Descriptions.Item>
        <Descriptions.Item label="Còn phải trả">
          <strong style={{ color: remainingAmount > 0 ? '#cf1322' : '#389e0d' }}>{money(remainingAmount)}</strong>
        </Descriptions.Item>
        <Descriptions.Item label="Tiền đặt cọc">{money(mainPayment?.depositAmount)}</Descriptions.Item>
        <Descriptions.Item label="Hình thức thanh toán">
          {mainPayment?.paymentMethod ? paymentMethodText[mainPayment.paymentMethod] || mainPayment.paymentMethod : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Trạng thái thanh toán">
          <Tag color={
            mainPayment?.paymentStatus === 'paid' ? 'green'
              : mainPayment?.paymentStatus === 'refunded' ? 'red' : 'orange'
          }>
            {paymentStatusText[mainPayment?.paymentStatus || ''] || 'Chưa có giao dịch'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Thời điểm thanh toán">{dateTime(mainPayment?.paymentDate)}</Descriptions.Item>
        <Descriptions.Item label="Mã giao dịch" span={2}>{mainPayment?.transactionCode || '—'}</Descriptions.Item>
        {refunds.length > 0 && (
          <Descriptions.Item label="Hoàn tiền" span={2}>
            {refunds.map((refund) => (
              <Tag key={refund.id} color={refund.status === 'approved' ? 'green' : refund.status === 'rejected' ? 'red' : 'orange'}>
                {money(refund.amount)} — {refundStatusText[refund.status] || refund.status}
              </Tag>
            ))}
          </Descriptions.Item>
        )}
      </Descriptions>
    </>
  );

  const servicesTab = (
    <Table<ServiceRow>
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={services}
      locale={emptyBox('Chưa có dịch vụ phát sinh nào')}
      columns={[
        { title: 'Dịch vụ', dataIndex: 'serviceName', render: (value: string, row) => (
          <div>
            <strong>{value}</strong>
            {row.description && <div style={{ fontSize: 12, color: '#888' }}>{row.description}</div>}
          </div>
        ) },
        { title: 'Đơn giá', dataIndex: 'unitPrice', align: 'right', render: money },
        { title: 'Số lượng', dataIndex: 'quantity', align: 'center' },
        { title: 'Thành tiền', dataIndex: 'totalPrice', align: 'right', render: (value: string | number) => <strong>{money(value)}</strong> },
        { title: 'Thời điểm phát sinh', dataIndex: 'createdAt', render: dateTime },
      ]}
      summary={() =>
        services.length > 0 ? (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={3}><strong>Tổng dịch vụ</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right"><strong>{money(serviceTotal)}</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={4} />
          </Table.Summary.Row>
        ) : null
      }
    />
  );

  const damagesTab = (
    <Table<DamageRow>
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={damages}
      locale={emptyBox('Không có phí hư hỏng nào')}
      columns={[
        { title: 'Vật dụng', dataIndex: 'itemName' },
        { title: 'Đơn giá', dataIndex: 'unitPrice', align: 'right', render: money },
        { title: 'Số lượng', dataIndex: 'quantity', align: 'center' },
        { title: 'Thành tiền', dataIndex: 'totalPrice', align: 'right', render: (value: string | number) => <strong>{money(value)}</strong> },
        { title: 'Ghi chú', dataIndex: 'note', render: (value?: string | null) => value || '—' },
        { title: 'Thời điểm ghi nhận', dataIndex: 'createdAt', render: dateTime },
      ]}
      summary={() =>
        damages.length > 0 ? (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={3}><strong>Tổng phí hư hỏng</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right"><strong>{money(damageTotal)}</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={4} colSpan={2} />
          </Table.Summary.Row>
        ) : null
      }
    />
  );

  const guestsTab = (
    <Table<GuestRow>
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={guests}
      locale={emptyBox('Chưa khai báo khách lưu trú')}
      columns={[
        { title: 'Họ và tên', dataIndex: 'fullName' },
        { title: 'CCCD/CMND', dataIndex: 'identityNumber' },
        { title: 'Số điện thoại', dataIndex: 'phone', render: (value?: string | null) => value || '—' },
        { title: 'Ghi chú', dataIndex: 'note', render: (value?: string | null) => value || '—' },
      ]}
    />
  );

  const transfersTab = (
    <Table<TransferRow>
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={transfers}
      locale={emptyBox('Đặt phòng này chưa từng chuyển phòng')}
      columns={[
        {
          title: 'Chuyển phòng',
          render: (_: unknown, row) => (
            <span>
              <Tag>{row.fromRoomNumber || '?'}</Tag>
              <SwapOutlined style={{ margin: '0 4px' }} />
              <Tag color="blue">{row.toRoomNumber || '?'}</Tag>
            </span>
          ),
        },
        { title: 'Từ ngày', dataIndex: 'fromDate', render: day },
        { title: 'Đến ngày', dataIndex: 'toDate', render: day },
        { title: 'Giá phòng mới/đêm', dataIndex: 'pricePerNight', align: 'right', render: money },
        { title: 'Lý do', dataIndex: 'reason', render: (value?: string | null) => value || '—' },
        { title: 'Thời điểm thực hiện', dataIndex: 'createdAt', render: dateTime },
      ]}
    />
  );

  const paymentsTab = (
    <>
      <h4 style={{ margin: '0 0 8px' }}>Giao dịch thanh toán</h4>
      <Table<PaymentRow>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={payments}
        locale={emptyBox('Chưa có giao dịch thanh toán')}
        style={{ marginBottom: 24 }}
        columns={[
          { title: 'Mã GD', dataIndex: 'id', render: (value: number) => `#${value}` },
          { title: 'Tiền phòng', dataIndex: 'roomAmount', align: 'right', render: money },
          { title: 'Dịch vụ', dataIndex: 'serviceAmount', align: 'right', render: money },
          { title: 'Phụ thu', dataIndex: 'surchargeAmount', align: 'right', render: money },
          { title: 'Giảm giá', dataIndex: 'discountAmount', align: 'right', render: money },
          { title: 'Tổng', dataIndex: 'totalAmount', align: 'right', render: (value: string | number) => <strong>{money(value)}</strong> },
          { title: 'Đã trả', dataIndex: 'paidAmount', align: 'right', render: money },
          { title: 'Còn lại', dataIndex: 'remainingAmount', align: 'right', render: (value: string | number) => (
            <span style={{ color: Number(value) > 0 ? '#cf1322' : '#389e0d' }}>{money(value)}</span>
          ) },
          { title: 'Hình thức', dataIndex: 'paymentMethod', render: (value?: string | null) => (value ? paymentMethodText[value] || value : '—') },
          { title: 'Trạng thái', dataIndex: 'paymentStatus', render: (value?: string | null) => (
            <Tag color={value === 'paid' ? 'green' : value === 'refunded' ? 'red' : 'orange'}>
              {paymentStatusText[value || ''] || value || '—'}
            </Tag>
          ) },
          { title: 'Thời điểm', dataIndex: 'paymentDate', render: dateTime },
        ]}
        scroll={{ x: 1100 }}
      />

      <h4 style={{ margin: '0 0 8px' }}>Yêu cầu hoàn tiền</h4>
      <Table<RefundRow>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={refunds}
        locale={emptyBox('Không có yêu cầu hoàn tiền')}
        columns={[
          { title: 'Số tiền hoàn', dataIndex: 'amount', align: 'right', render: (value: string | number) => <strong>{money(value)}</strong> },
          { title: 'Tỷ lệ', dataIndex: 'refundRate', render: (value: string | number) => `${Math.round(Number(value || 0) * 100)}%` },
          { title: 'Hình thức', dataIndex: 'refundMethod', render: (value: string) => (value === 'cash' ? 'Nhận tại quầy' : 'Chuyển khoản') },
          { title: 'Trạng thái', dataIndex: 'status', render: (value: string) => (
            <Tag color={value === 'approved' ? 'green' : value === 'rejected' ? 'red' : 'orange'}>
              {refundStatusText[value] || value}
            </Tag>
          ) },
          { title: 'Ghi chú', dataIndex: 'note', render: (value?: string | null) => value || '—' },
          { title: 'Tạo lúc', dataIndex: 'createdAt', render: dateTime },
          { title: 'Xử lý lúc', dataIndex: 'processedAt', render: dateTime },
        ]}
        scroll={{ x: 900 }}
      />
    </>
  );

  const historyTab =
    history.length === 0 ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa ghi nhận thao tác nào cho đặt phòng này" />
    ) : (
      <Timeline
        mode="left"
        items={history.map((entry) => {
          const meta = actionMeta[entry.action] || { label: entry.action, color: 'gray', icon: <ClockCircleOutlined /> };
          return {
            color: meta.color,
            dot: meta.icon,
            children: (
              <div>
                <div style={{ marginBottom: 2 }}>
                  <Tag color={meta.color}>{meta.label}</Tag>
                  <Tooltip title="Thời điểm thực hiện">
                    <span style={{ color: '#888', fontSize: 12 }}>{dateTime(entry.createdAt)}</span>
                  </Tooltip>
                  {entry.amount != null && Number(entry.amount) !== 0 && (
                    <strong style={{ marginLeft: 8 }}>{money(entry.amount)}</strong>
                  )}
                </div>
                <div>{entry.description || '—'}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                  Người thực hiện: {entry.performedByName || 'Hệ thống'}
                  {entry.performedByRole ? ` (${roleText[entry.performedByRole] || entry.performedByRole})` : ''}
                </div>
              </div>
            ),
          };
        })}
      />
    );

  return (
    <Modal
      title={
        <span>
          {detail ? `Chi tiết đặt phòng #${detail.id}` : 'Chi tiết đặt phòng'}
          {detail && (
            <Tag color={statusColor[detail.status] || 'default'} style={{ marginLeft: 10 }}>
              {statusText[detail.status] || detail.status}
            </Tag>
          )}
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={1100}
      // Đẩy modal lên sát mép trên và cho phần thân tự cuộn, để cửa sổ cao gần
      // hết màn hình thay vì bị cắt cụt ở đáy như trước.
      style={{ top: 24, paddingBottom: 24 }}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 150px)',
          overflowY: 'auto',
          paddingRight: 8,
        },
      }}
      destroyOnHidden
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin tip="Đang tải chi tiết..." />
        </div>
      )}

      {!loading && error && <Alert type="error" message={error} showIcon />}

      {!loading && !error && detail && (
        <Tabs
          defaultActiveKey="overview"
          items={[
            { key: 'overview', label: 'Tổng quan', children: overviewTab },
            { key: 'services', label: `Dịch vụ phát sinh (${services.length})`, children: servicesTab },
            { key: 'damages', label: `Phí hư hỏng (${damages.length})`, children: damagesTab },
            { key: 'guests', label: `Khách lưu trú (${guests.length})`, children: guestsTab },
            { key: 'transfers', label: `Chuyển phòng (${transfers.length})`, children: transfersTab },
            { key: 'payments', label: 'Thanh toán & hoàn tiền', children: paymentsTab },
            { key: 'history', label: `Lịch sử thao tác (${history.length})`, children: historyTab },
          ]}
        />
      )}
    </Modal>
  );
};

export default BookingDetailModal;

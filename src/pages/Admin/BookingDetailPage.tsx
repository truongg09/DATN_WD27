import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert, Breadcrumb, Button, Card, Col, Descriptions, Empty, Form, Input, InputNumber, Modal,
  Popconfirm, Row, Select, Skeleton, Space, Table, Tag, message,
} from 'antd';
import {
  ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined,
} from '@ant-design/icons';
import {
  addBookingDamageCharge, addBookingServiceCharge,
  deleteBookingDamageCharge, deleteBookingServiceCharge,
  updateBookingDamageCharge, updateBookingDamageChargeStatus,
  updateBookingServiceCharge, updateBookingServiceChargeStatus,
} from '../../services/bookingService';
import dayjs from 'dayjs';
import api from '../../services/api';

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

// Số đêm lưu trú tính theo ngày, không phụ thuộc giờ nhận/trả cụ thể.
const countNights = (checkIn?: string | null, checkOut?: string | null) => {
  if (!checkIn || !checkOut) return 0;
  const from = dayjs(checkIn).startOf('day');
  const to = dayjs(checkOut).startOf('day');
  return Math.max(to.diff(from, 'day'), 0);
};

// Trạng thái đơn dùng chung cho cả trang.
export const bookingStatusText: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  checked_in: 'Đang lưu trú',
  checked_out: 'Đã trả phòng',
  cancelled: 'Đã hủy',
  no_show: 'Khách không đến',
};

export const bookingStatusColor: Record<string, string> = {
  pending: 'orange',
  confirmed: 'blue',
  checked_in: 'green',
  checked_out: 'default',
  cancelled: 'red',
  no_show: 'volcano',
};

interface ServiceCharge {
  id: number;
  serviceId: number;
  serviceName: string;
  roomNumber?: string | null;
  unitPrice: string | number;
  quantity: number;
  totalPrice: string | number;
  status: string;
  createdAt?: string | null;
}

// Trạng thái một dòng dịch vụ / khoản phí. Phải khớp đúng danh sách backend
// chấp nhận (ALLOWED_SERVICE_STATUSES), nếu không thao tác sẽ bị từ chối.
const chargeStatusMeta: Record<string, { label: string; color: string }> = {
  unused: { label: 'Chưa sử dụng', color: 'orange' },
  used: { label: 'Đã sử dụng', color: 'green' },
  cancelled: { label: 'Đã hủy', color: 'red' },
};

const chargeStatusOptions = Object.entries(chargeStatusMeta).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

// Loại khoản phí phát sinh ngoài dịch vụ.
const chargeTypeMeta: Record<string, string> = {
  damage: 'Hư hỏng / mất đồ',
  extra_fee: 'Phụ phí',
  other: 'Khoản khác',
};

interface DamageCharge {
  id: number;
  chargeType: string;
  itemName: string;
  roomNumber?: string | null;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  status: string;
  note?: string | null;
  createdAt?: string | null;
}

export interface BookingDetailData {
  id: number;
  booking_code?: string | null;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  check_in: string | null;
  check_out: string | null;
  adults: number | null;
  children: number | null;
  room_number: string | null;
  room_type_name: string | null;
  room_capacity?: number | null;
  room_floor?: number | null;
  room_area?: string | number | null;
  room_price?: string | number | null;
  room_quantity?: number | null;
  room_total_price?: string | number | null;
  occupancy_surcharge?: string | number | null;
  payable_total?: string | number | null;
  notes?: string | null;
  cancellation_reason?: string | null;
  created_at?: string | null;
  actual_check_in_time?: string | null;
  actual_check_out_time?: string | null;
  services?: Record<string, unknown>[];
  damages?: Record<string, unknown>[];
  guests?: Record<string, unknown>[];
  transfers?: Record<string, unknown>[];
  payments?: Record<string, unknown>[];
  payment?: Record<string, unknown> | null;
  booking_rooms?: Record<string, unknown>[];
  history?: Record<string, unknown>[];
}

/**
 * Trang chi tiết đặt phòng dành cho quản trị/lễ tân.
 * Tách hẳn thành trang riêng thay vì popup để chứa đủ thông tin và cho phép
 * thao tác trực tiếp: dịch vụ, phát sinh, hư hỏng, nhận phòng, trả phòng.
 */
function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bookingId = Number(id);

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBooking = useCallback(
    async (silent = false) => {
      if (!Number.isInteger(bookingId) || bookingId <= 0) {
        setError('Mã đặt phòng không hợp lệ');
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const response = await api.get(`/bookings/${bookingId}`);
        setBooking((response as unknown as { data: BookingDetailData }).data);
        setError(null);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
        if (!silent) {
          setError(msg || 'Không tải được chi tiết đặt phòng');
          setBooking(null);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [bookingId]
  );

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  // ─── Dịch vụ ────────────────────────────────────────────────────
  const [services, setServices] = useState<{ id: number; serviceName: string; price: number }[]>([]);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<ServiceCharge | null>(null);
  const [serviceForm] = Form.useForm();
  const [working, setWorking] = useState(false);

  useEffect(() => {
    api
      .get('/services')
      .then((res) => {
        const list = (res as unknown as { data?: { id: number; serviceName: string; price: number }[] }).data || [];
        setServices(list);
      })
      .catch(() => setServices([]));
  }, []);

  const showApiError = (err: unknown, fallback: string) => {
    const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
    message.error(msg || fallback);
  };

  const openServiceModal = (charge?: ServiceCharge) => {
    setEditingCharge(charge || null);
    serviceForm.resetFields();
    if (charge) {
      serviceForm.setFieldsValue({ quantity: charge.quantity, status: charge.status });
    } else {
      serviceForm.setFieldsValue({ quantity: 1 });
    }
    setServiceModalOpen(true);
  };

  const submitService = async () => {
    const values = await serviceForm.validateFields();
    setWorking(true);
    try {
      if (editingCharge) {
        await updateBookingServiceCharge(bookingId, editingCharge.id, {
          quantity: values.quantity,
          status: values.status,
        });
        message.success('Đã cập nhật dịch vụ');
      } else {
        await addBookingServiceCharge(bookingId, {
          serviceId: values.serviceId,
          quantity: values.quantity,
        });
        message.success('Đã thêm dịch vụ vào đơn');
      }
      setServiceModalOpen(false);
      await loadBooking(true);
    } catch (err) {
      showApiError(err, 'Không lưu được dịch vụ');
    } finally {
      setWorking(false);
    }
  };

  const changeServiceStatus = async (charge: ServiceCharge, status: string) => {
    try {
      await updateBookingServiceChargeStatus(bookingId, charge.id, status);
      message.success('Đã đổi trạng thái dịch vụ');
      await loadBooking(true);
    } catch (err) {
      showApiError(err, 'Không đổi được trạng thái');
    }
  };

  // ─── Phí phát sinh / hư hỏng ────────────────────────────────────
  const [damageModalOpen, setDamageModalOpen] = useState(false);
  const [editingDamage, setEditingDamage] = useState<DamageCharge | null>(null);
  const [damageForm] = Form.useForm();

  const openDamageModal = (charge?: DamageCharge) => {
    setEditingDamage(charge || null);
    damageForm.resetFields();
    if (charge) {
      damageForm.setFieldsValue({
        chargeType: charge.chargeType,
        itemName: charge.itemName,
        quantity: charge.quantity,
        unitPrice: Number(charge.unitPrice),
        note: charge.note,
        status: charge.status,
      });
    } else {
      damageForm.setFieldsValue({ chargeType: 'damage', quantity: 1, status: 'used' });
    }
    setDamageModalOpen(true);
  };

  const submitDamage = async () => {
    const values = await damageForm.validateFields();
    setWorking(true);
    try {
      if (editingDamage) {
        await updateBookingDamageCharge(bookingId, editingDamage.id, values);
        message.success('Đã cập nhật khoản phí');
      } else {
        await addBookingDamageCharge(bookingId, values);
        message.success('Đã thêm khoản phí phát sinh');
      }
      setDamageModalOpen(false);
      await loadBooking(true);
    } catch (err) {
      showApiError(err, 'Không lưu được khoản phí');
    } finally {
      setWorking(false);
    }
  };

  const changeDamageStatus = async (charge: DamageCharge, status: string) => {
    try {
      await updateBookingDamageChargeStatus(bookingId, charge.id, status);
      message.success('Đã đổi trạng thái khoản phí');
      await loadBooking(true);
    } catch (err) {
      showApiError(err, 'Không đổi được trạng thái');
    }
  };

  const removeDamage = async (charge: DamageCharge) => {
    try {
      await deleteBookingDamageCharge(bookingId, charge.id);
      message.success('Đã xóa khoản phí');
      await loadBooking(true);
    } catch (err) {
      showApiError(err, 'Không xóa được khoản phí');
    }
  };

  const removeService = async (charge: ServiceCharge) => {
    try {
      await deleteBookingServiceCharge(bookingId, charge.id);
      message.success('Đã xóa dịch vụ khỏi đơn');
      await loadBooking(true);
    } catch (err) {
      showApiError(err, 'Không xóa được dịch vụ');
    }
  };

  const serviceCharges = (booking?.services || []) as unknown as ServiceCharge[];
  const serviceTotal = serviceCharges.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const damageCharges = (booking?.damages || []) as unknown as DamageCharge[];
  const damageTotal = damageCharges.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  // Đơn đã kết thúc thì khóa thao tác để không phát sinh thêm chi phí.
  const canEditCharges = !!booking && ['confirmed', 'checked_in'].includes(booking.status);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          showIcon
          message="Không mở được đặt phòng"
          description={error || 'Đặt phòng không tồn tại hoặc đã bị xóa.'}
          action={
            <Button onClick={() => navigate('/admin/bookings')}>Về danh sách đặt phòng</Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          { title: <a onClick={() => navigate('/admin')}>Trang quản trị</a> },
          { title: <a onClick={() => navigate('/admin/bookings')}>Đặt phòng</a> },
          { title: `Đơn #${booking.id}` },
        ]}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Space align="center" wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/bookings')}>
            Quay lại
          </Button>
          <h2 style={{ margin: 0 }}>
            Đơn đặt phòng #{booking.id}
            {booking.booking_code ? ` — ${booking.booking_code}` : ''}
          </h2>
          <Tag color={bookingStatusColor[booking.status] || 'default'}>
            {bookingStatusText[booking.status] || booking.status}
          </Tag>
        </Space>

        <Button icon={<ReloadOutlined />} onClick={() => loadBooking()}>
          Làm mới
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Thông tin đặt phòng" size="small">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Mã đơn">
                #{booking.id}
                {booking.booking_code ? ` (${booking.booking_code})` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={bookingStatusColor[booking.status] || 'default'}>
                  {bookingStatusText[booking.status] || booking.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Thời điểm đặt">{dateTime(booking.created_at)}</Descriptions.Item>
              <Descriptions.Item label="Ghi chú của khách">{booking.notes || '—'}</Descriptions.Item>
              {booking.cancellation_reason && (
                <Descriptions.Item label="Lý do hủy">{booking.cancellation_reason}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Khách hàng" size="small">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Họ tên">{booking.customer_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">{booking.customer_phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{booking.customer_email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Số khách">
                {booking.adults ?? 0} người lớn, {booking.children ?? 0} trẻ em
              </Descriptions.Item>
              <Descriptions.Item label="Khách lưu trú đã khai">
                {(booking.guests?.length || 0) > 0
                  ? `${booking.guests?.length} người`
                  : 'Chưa khai báo'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Thời gian lưu trú" size="small">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Ngày nhận phòng">{day(booking.check_in)}</Descriptions.Item>
              <Descriptions.Item label="Ngày trả phòng">{day(booking.check_out)}</Descriptions.Item>
              <Descriptions.Item label="Số đêm">
                <strong>{countNights(booking.check_in, booking.check_out)} đêm</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Giờ nhận thực tế">
                {dateTime(booking.actual_check_in_time)}
              </Descriptions.Item>
              <Descriptions.Item label="Giờ trả thực tế">
                {dateTime(booking.actual_check_out_time)}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Phòng và sức chứa" size="small">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Phòng">
                {booking.room_number || '—'}
                {(booking.room_quantity || 1) > 1 && ` (${booking.room_quantity} phòng)`}
              </Descriptions.Item>
              <Descriptions.Item label="Hạng phòng">{booking.room_type_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Tầng / Diện tích">
                {booking.room_floor ?? '—'} / {booking.room_area ? `${booking.room_area}m²` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Sức chứa">
                {booking.room_capacity ? `${booking.room_capacity} khách/phòng` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Giá phòng mỗi đêm">{money(booking.room_price)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        style={{ marginTop: 16 }}
        title={`Dịch vụ đã dùng (${serviceCharges.length})`}
        extra={
          canEditCharges && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openServiceModal()}>
              Thêm dịch vụ
            </Button>
          )
        }
      >
        <Table<ServiceCharge>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={serviceCharges}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dịch vụ nào" /> }}
          scroll={{ x: 760 }}
          columns={[
            { title: 'Dịch vụ', dataIndex: 'serviceName' },
            { title: 'Phòng', dataIndex: 'roomNumber', render: (v?: string | null) => v || '—' },
            { title: 'Đơn giá', dataIndex: 'unitPrice', align: 'right', render: money },
            { title: 'SL', dataIndex: 'quantity', align: 'center', width: 60 },
            {
              title: 'Thành tiền',
              dataIndex: 'totalPrice',
              align: 'right',
              render: (v: string | number) => <strong>{money(v)}</strong>,
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              render: (value: string, row) => (
                <Select
                  size="small"
                  value={value}
                  style={{ width: 140 }}
                  disabled={!canEditCharges}
                  onChange={(next) => changeServiceStatus(row, next)}
                  options={chargeStatusOptions}
                />
              ),
            },
            { title: 'Thời điểm', dataIndex: 'createdAt', render: dateTime },
            {
              title: '',
              key: 'actions',
              width: 90,
              render: (_: unknown, row) =>
                canEditCharges && (
                  <Space size={4}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openServiceModal(row)} />
                    <Popconfirm
                      title="Xóa dịch vụ này khỏi đơn?"
                      okText="Xóa"
                      cancelText="Thôi"
                      onConfirm={() => removeService(row)}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
            },
          ]}
          summary={() =>
            serviceCharges.length > 0 ? (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4}>
                  <strong>Tổng tiền dịch vụ</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <strong>{money(serviceTotal)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} colSpan={3} />
              </Table.Summary.Row>
            ) : null
          }
        />
      </Card>

      <Card
        size="small"
        style={{ marginTop: 16 }}
        title={`Phát sinh và hư hỏng (${damageCharges.length})`}
        extra={
          canEditCharges && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openDamageModal()}>
              Thêm khoản phí
            </Button>
          )
        }
      >
        <Table<DamageCharge>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={damageCharges}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có khoản phát sinh nào" /> }}
          scroll={{ x: 900 }}
          columns={[
            { title: 'Khoản mục', dataIndex: 'itemName' },
            {
              title: 'Loại',
              dataIndex: 'chargeType',
              render: (value: string) => <Tag>{chargeTypeMeta[value] || value}</Tag>,
            },
            { title: 'Phòng', dataIndex: 'roomNumber', render: (v?: string | null) => v || '—' },
            { title: 'Đơn giá', dataIndex: 'unitPrice', align: 'right', render: money },
            { title: 'SL', dataIndex: 'quantity', align: 'center', width: 60 },
            {
              title: 'Thành tiền',
              dataIndex: 'totalPrice',
              align: 'right',
              render: (v: string | number) => <strong>{money(v)}</strong>,
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              render: (value: string, row) => (
                <Select
                  size="small"
                  value={value}
                  style={{ width: 140 }}
                  disabled={!canEditCharges}
                  onChange={(next) => changeDamageStatus(row, next)}
                  options={chargeStatusOptions}
                />
              ),
            },
            { title: 'Ghi chú', dataIndex: 'note', render: (v?: string | null) => v || '—' },
            { title: 'Thời điểm', dataIndex: 'createdAt', render: dateTime },
            {
              title: '',
              key: 'actions',
              width: 90,
              render: (_: unknown, row) =>
                canEditCharges && (
                  <Space size={4}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openDamageModal(row)} />
                    <Popconfirm
                      title="Xóa khoản phí này?"
                      okText="Xóa"
                      cancelText="Thôi"
                      onConfirm={() => removeDamage(row)}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
            },
          ]}
          summary={() =>
            damageCharges.length > 0 ? (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5}>
                  <strong>Tổng phát sinh</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <strong>{money(damageTotal)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} colSpan={4} />
              </Table.Summary.Row>
            ) : null
          }
        />
      </Card>

      <Modal
        title={editingDamage ? 'Sửa khoản phí' : 'Thêm khoản phí phát sinh'}
        open={damageModalOpen}
        onCancel={() => setDamageModalOpen(false)}
        onOk={submitDamage}
        confirmLoading={working}
        okText="Lưu"
        cancelText="Đóng"
        destroyOnHidden
      >
        <Form form={damageForm} layout="vertical">
          <Form.Item name="chargeType" label="Loại khoản phí" rules={[{ required: true }]}>
            <Select
              options={Object.entries(chargeTypeMeta).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item
            name="itemName"
            label="Tên khoản phí / vật dụng"
            rules={[{ required: true, message: 'Nhập tên khoản phí' }]}
          >
            <Input placeholder="Ví dụ: Khăn tắm, điều khiển TV, phụ phí dọn phòng..." />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="quantity" label="Số lượng" rules={[{ required: true, message: 'Nhập số lượng' }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unitPrice" label="Đơn giá" rules={[{ required: true, message: 'Nhập đơn giá' }]}>
                <InputNumber min={0} step={10000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="status" label="Trạng thái">
            <Select options={chargeStatusOptions} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={3} placeholder="Mô tả tình trạng, lý do thu phí..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingCharge ? 'Sửa dịch vụ' : 'Thêm dịch vụ cho khách'}
        open={serviceModalOpen}
        onCancel={() => setServiceModalOpen(false)}
        onOk={submitService}
        confirmLoading={working}
        okText="Lưu"
        cancelText="Đóng"
        destroyOnHidden
      >
        <Form form={serviceForm} layout="vertical">
          {!editingCharge && (
            <Form.Item name="serviceId" label="Dịch vụ" rules={[{ required: true, message: 'Chọn dịch vụ' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Chọn dịch vụ"
                options={services.map((item) => ({
                  value: item.id,
                  label: `${item.serviceName} — ${money(item.price)}`,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item name="quantity" label="Số lượng" rules={[{ required: true, message: 'Nhập số lượng' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          {editingCharge && (
            <Form.Item name="status" label="Trạng thái">
              <Select options={chargeStatusOptions} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}

export default BookingDetailPage;

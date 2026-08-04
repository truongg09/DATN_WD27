import React, { useEffect, useState } from 'react';
import { Button, DatePicker, Form, Input, InputNumber, message, Modal, Select, Space, Tag, Tooltip } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  HomeOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  SwapOutlined,
  ToolOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';
import BookingDetailModal from './BookingDetailModal';
import CheckoutPaymentModal from './CheckoutPaymentModal';

interface Booking {
  id: number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  room_id?: number | null;
  room_number: string | null;
  room_type_name: string | null;
  check_in: string | null;
  check_out: string | null;
  status: string;
  total_price: string | number | null;
  payable_total?: string | number | null;
  adults: number | null;
  children: number | null;
  notes?: string | null;
  created_at: string | null;
}

interface ServiceItem {
  id: number;
  serviceName: string;
  price: string | number;
}

interface RoomItem {
  id: number;
  roomNumber: string;
  room_type_name?: string;
  status: string;
}

type Operation = 'guests' | 'declareGuests' | 'service' | 'damage' | 'extend' | 'transfer' | null;

const statusText: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  checked_in: 'Đã check-in',
  checked_out: 'Đã check-out',
  cancelled: 'Đã hủy',
  no_show: 'Không đến (No-show)',
};

const statusColor: Record<string, string> = {
  pending: 'orange',
  confirmed: 'blue',
  checked_in: 'green',
  checked_out: 'gray',
  cancelled: 'red',
  no_show: 'volcano',
};

const normalizeStatus = (status: string | null) => {
  const value = (status || '').toLowerCase();
  if (['checkout', 'check_out', 'checkedout'].includes(value)) return 'checked_out';
  if (['checkin', 'check_in', 'checkedin'].includes(value)) return 'checked_in';
  if (['no-show', 'noshow'].includes(value)) return 'no_show';
  return value || 'pending';
};

const formatDate = (date?: string | null) => {
  if (!date) return 'N/A';
  const value = dayjs(date);
  return value.isValid() ? value.format('DD/MM/YYYY') : 'N/A';
};

const formatPrice = (price?: string | number | null) => {
  const amount = Number(price || 0);
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
};

function BookingManagement() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [checkoutBookingId, setCheckoutBookingId] = useState<number | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [form] = Form.useForm();

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/bookings');
      const data = Array.isArray(response.data) ? response.data : [];
      setBookings(
        data
          .map((booking: Booking) => ({
            ...booking,
            status: normalizeStatus(booking.status),
            adults: booking.adults ?? 0,
            children: booking.children ?? 0,
          }))
          .filter((booking: Booking) => booking.check_in && booking.check_out)
      );
    } catch (error) {
      console.error('Error fetching bookings:', error);
      message.error('Lỗi khi tải danh sách đặt phòng');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupportData = async () => {
    try {
      const [serviceRes, roomRes] = await Promise.all([api.get('/services'), api.get('/rooms')]);
      setServices(Array.isArray(serviceRes.data) ? serviceRes.data : []);
      setRooms(Array.isArray(roomRes.data) ? roomRes.data : []);
    } catch {
      setServices([]);
      setRooms([]);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchSupportData();
  }, []);

  const openOperation = (type: Operation, booking: Booking) => {
    setOperation(type);
    setSelectedBooking(booking);
    form.resetFields();
    if (type === 'guests' || type === 'declareGuests') {
      form.setFieldsValue({
        guests: [
          {
            fullName: booking.customer_name || '',
            identityNumber: '',
            phone: booking.customer_phone || '',
          },
        ],
      });
    }
    if (type === 'extend') {
      form.setFieldsValue({ checkOut: booking.check_out ? dayjs(booking.check_out).add(1, 'day') : undefined });
    }
    if (type === 'transfer') {
      form.setFieldsValue({
        fromDate: dayjs(),
        toDate: booking.check_out ? dayjs(booking.check_out) : undefined,
      });
    }
  };

  const closeOperation = () => {
    setOperation(null);
    setSelectedBooking(null);
    form.resetFields();
  };

  const submitOperation = async () => {
    if (!selectedBooking || !operation) return;
    const values = await form.validateFields();

    try {
      if (operation === 'declareGuests' || operation === 'guests') {
        if (Array.isArray(values.guests)) {
          for (const g of values.guests) {
            const idNum = String(g?.identityNumber || '').trim();
            if (!/^\d{12}$/.test(idNum)) {
              message.error(`Số CCCD của "${g?.fullName || 'người ở'}" phải bao gồm đúng 12 chữ số (không chứa chữ cái hoặc ký hiệu)`);
              return;
            }
          }
        }
      }

      // Khách đã nhận phòng thì chỉ cập nhật danh sách người ở, không gọi lại
      // check-in (API check-in từ chối mọi trạng thái ngoài chờ/đã xác nhận).
      if (operation === 'declareGuests') {
        await api.post(`/bookings/${selectedBooking.id}/guests`, {
          guests: values.guests,
        });
        message.success('Đã lưu danh sách khách lưu trú');
      }

      if (operation === 'guests') {
        const response = await api.patch(`/bookings/${selectedBooking.id}/check-in`, {
          guests: values.guests,
        });
        const lateCheckIn = response.data?.lateCheckIn;
        message.success(
          lateCheckIn
            ? 'Check-in muộn thành công. Phòng vẫn được giữ vì khách đã thanh toán.'
            : response.data?.message || 'Check-in thành công'
        );
      }

      if (operation === 'service') {
        const response = await api.post(`/bookings/${selectedBooking.id}/services`, {
          serviceId: values.serviceId,
          quantity: values.quantity,
        });
        const result = (response as unknown as {
          data?: {
            service?: { serviceName?: string; totalPrice?: number };
            payment?: { remainingAmount?: number };
          };
        }).data;
        const service = result?.service;
        const payment = result?.payment;
        Modal.warning({
          title: 'Đã cộng dịch vụ — cần thanh toán thêm',
          content: (
            <div>
              <p>
                {service?.serviceName || 'Dịch vụ'} đã được cộng thêm{' '}
                <strong>{formatPrice(service?.totalPrice || 0)}</strong>.
              </p>
              <p>
                Số tiền khách còn phải thanh toán:{' '}
                 <strong>{formatPrice(payment?.remainingAmount || 0)}</strong>.
              </p>
            </div>
          ),
          okText: 'Đã hiểu',
        });
      }

      if (operation === 'damage') {
        await api.post(`/bookings/${selectedBooking.id}/damages`, {
          itemName: values.itemName,
          quantity: values.quantity,
          unitPrice: values.unitPrice,
          note: values.note,
        });
        message.success('Đã thêm phí hư hỏng vật dụng');
      }

      if (operation === 'extend') {
        await api.patch(`/bookings/${selectedBooking.id}/extend`, {
          checkOut: values.checkOut.format('YYYY-MM-DD'),
        });
        message.success('Đã gia hạn thời gian ở');
      }

      if (operation === 'transfer') {
        await api.patch(`/bookings/${selectedBooking.id}/transfer-room`, {
          toRoomId: values.toRoomId,
          fromDate: values.fromDate.format('YYYY-MM-DD'),
          toDate: values.toDate.format('YYYY-MM-DD'),
          reason: values.reason,
        });
        message.success('Đã chuyển phòng và lưu lịch sử');
      }

      closeOperation();
      fetchBookings();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Không thể xử lý thao tác này');
    }
  };

  // Backend bắt buộc lý do hủy tối thiểu 5 ký tự. Trước đây modal không có ô
  // nhập nên mọi lần hủy từ trang quản trị đều trả về lỗi 400.
  const handleCancel = async (id: number) => {
    let reason = '';

    Modal.confirm({
      title: 'Xác nhận hủy đặt phòng',
      width: 520,
      content: (
        <div>
          <p style={{ marginTop: 0 }}>
            Chính sách hoàn cọc: dưới 3 ngày hoàn 100%, từ 3-7 ngày hoàn 50%, trên 7 ngày không hoàn.
          </p>
          <Input.TextArea
            rows={3}
            maxLength={500}
            showCount
            placeholder="Nhập lý do hủy phòng (ít nhất 5 ký tự)"
            onChange={(event) => {
              reason = event.target.value;
            }}
          />
        </div>
      ),
      okText: 'Hủy đặt phòng',
      cancelText: 'Đóng',
      okButtonProps: { danger: true },
      onOk: async () => {
        const trimmedReason = reason.trim();
        if (trimmedReason.length < 5) {
          message.error('Vui lòng nhập lý do hủy phòng (ít nhất 5 ký tự)');
          return Promise.reject(new Error('missing-reason'));
        }

        try {
          const response = await api.patch(`/bookings/${id}/cancel`, { reason: trimmedReason });
          const policy = response.data?.refundPolicy;
          message.success(
            policy
              ? `Đã hủy. Số tiền dự kiến hoàn: ${formatPrice(policy.refundableAmount)}`
              : 'Hủy đặt phòng thành công'
          );
          fetchBookings();
        } catch (error: any) {
          message.error(error.response?.data?.message || 'Lỗi khi hủy đặt phòng');
        }
      },
    });
  };

  const handleCheckIn = (booking: Booking) => {
    openOperation('guests', booking);
  };

  // Trả phòng luôn đi qua màn hình thu tiền: nếu khách còn nợ dịch vụ/phí hư
  // hỏng thì lễ tân có sẵn mã QR để khách quét trả ngay tại quầy, thu đủ mới
  // cho trả phòng. Trước đây bấm trả phòng khi còn nợ chỉ báo lỗi cụt.
  const handleCheckOut = (id: number) => {
    setCheckoutBookingId(id);
  };

  const handleNoShow = (booking: Booking) => {
    Modal.confirm({
      title: 'Xác nhận No-show',
      content:
        'Khách không đến nhận phòng. Hệ thống sẽ không hoàn tiền và tự động tặng voucher giảm 10% cho lần đặt tiếp theo.',
      okText: 'Xác nhận No-show',
      cancelText: 'Đóng',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const response = await api.patch(`/bookings/${booking.id}/no-show`);
          const voucherCode = response.data?.voucher?.code;
          message.success(
            voucherCode
              ? `Đã ghi nhận no-show. Voucher: ${voucherCode}`
              : 'Đã ghi nhận no-show'
          );
          fetchBookings();
        } catch (error: any) {
          message.error(error.response?.data?.message || 'Không thể xử lý trường hợp khách không đến');
        }
      },
    });
  };

  const renderOperationForm = () => {
    if (operation === 'guests' || operation === 'declareGuests') {
      return (
        <Form.List name="guests">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field) => (
                <Space key={field.key} align="baseline" wrap>
                  <Form.Item {...field} name={[field.name, 'fullName']} rules={[{ required: true, message: 'Nhập họ tên' }]}>
                    <Input placeholder="Họ tên người ở" />
                  </Form.Item>
                  <Form.Item
                    {...field}
                    name={[field.name, 'identityNumber']}
                    rules={[
                      { required: true, message: 'Nhập CCCD' },
                      { pattern: /^\d{12}$/, message: 'Số CCCD phải bao gồm đúng 12 chữ số (không chứa chữ cái hoặc ký hiệu)' },
                    ]}
                  >
                    <Input
                      placeholder="CCCD/CMND (12 chữ số)"
                      maxLength={12}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                        const currentGuests = form.getFieldValue('guests') || [];
                        if (currentGuests[field.name]) {
                          currentGuests[field.name].identityNumber = val;
                          form.setFieldsValue({ guests: [...currentGuests] });
                        }
                      }}
                    />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'phone']}>
                    <Input placeholder="Số điện thoại" />
                  </Form.Item>
                  {fields.length > 1 && <Button danger onClick={() => remove(field.name)}>Xóa</Button>}
                </Space>
              ))}
              <Button icon={<PlusOutlined />} onClick={() => add()}>
                Thêm người ở
              </Button>
            </>
          )}
        </Form.List>
      );
    }

    if (operation === 'service') {
      return (
        <>
          <Form.Item name="serviceId" label="Dịch vụ" rules={[{ required: true, message: 'Chọn dịch vụ' }]}>
            <Select
              options={services.map((service) => ({
                value: service.id,
                label: `${service.serviceName} - ${formatPrice(service.price)}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="quantity" label="Số lượng" initialValue={1} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </>
      );
    }

    if (operation === 'damage') {
      return (
        <>
          <Form.Item name="itemName" label="Vật dụng hư hỏng/mất" rules={[{ required: true, message: 'Nhập tên vật dụng' }]}>
            <Input placeholder="Ví dụ: khăn tắm, điều khiển TV..." />
          </Form.Item>
          <Form.Item name="quantity" label="Số lượng" initialValue={1} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unitPrice" label="Đơn giá bồi thường" rules={[{ required: true, message: 'Nhập đơn giá' }]}>
            <InputNumber min={0} step={10000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={3} />
          </Form.Item>
        </>
      );
    }

    if (operation === 'extend') {
      return (
        <Form.Item name="checkOut" label="Ngày trả phòng mới" rules={[{ required: true, message: 'Chọn ngày trả mới' }]}>
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
        </Form.Item>
      );
    }

    if (operation === 'transfer') {
      return (
        <>
          <Form.Item name="toRoomId" label="Phòng chuyển đến" rules={[{ required: true, message: 'Chọn phòng' }]}>
            <Select
              showSearch
              options={rooms
                .filter((room) => room.id !== selectedBooking?.room_id)
                .map((room) => ({
                  value: room.id,
                  label: `Phòng ${room.roomNumber} - ${room.room_type_name || ''} (${room.status})`,
                }))}
            />
          </Form.Item>
          <Form.Item name="fromDate" label="Từ ngày" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="toDate" label="Đến ngày" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="reason" label="Lý do chuyển phòng">
            <Input.TextArea rows={3} />
          </Form.Item>
        </>
      );
    }

    return null;
  };

  const operationTitle: Record<Exclude<Operation, null>, string> = {
    guests: 'Xác minh CCCD và danh sách người ở',
    declareGuests: 'Khai báo khách lưu trú',
    service: 'Thêm dịch vụ phát sinh',
    damage: 'Thêm phí hư hỏng/mất vật dụng',
    extend: 'Gia hạn thời gian ở',
    transfer: 'Chuyển phòng giữa chừng',
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0 }}>Quản lý đặt phòng</h2>
          <Button icon={<ReloadOutlined />} onClick={fetchBookings} loading={loading}>
            Làm mới
          </Button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={thStyle}>Mã</th>
                <th style={thStyle}>Khách hàng</th>
                <th style={thStyle}>Phòng</th>
                <th style={thStyle}>Thời gian</th>
                <th style={thStyle}>Số khách</th>
                <th style={thStyle}>Tổng tiền</th>
                <th style={thStyle}>Trạng thái</th>
                <th style={thStyle}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={emptyStyle}>Đang tải dữ liệu...</td></tr>
              ) : bookings.length === 0 ? (
                <tr><td colSpan={8} style={emptyStyle}>Không có dữ liệu đặt phòng</td></tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td style={tdStyle}>#{booking.id}</td>
                    <td style={tdStyle}>
                      <strong>{booking.customer_name || 'N/A'}</strong>
                      <div style={smallText}>{booking.customer_phone || ''}</div>
                    </td>
                    <td style={tdStyle}>
                      <strong>{booking.room_number ? `Phòng ${booking.room_number}` : 'N/A'}</strong>
                      <div style={smallText}>{booking.room_type_name || ''}</div>
                    </td>
                    <td style={tdStyle}>
                      <div>Nhận: {formatDate(booking.check_in)}</div>
                      <div>Trả: {formatDate(booking.check_out)}</div>
                    </td>
                    <td style={tdStyle}>{booking.adults ?? 0} người lớn, {booking.children ?? 0} trẻ em</td>
                    <td style={tdStyle}>{formatPrice(booking.payable_total ?? booking.total_price)}</td>
                    <td style={tdStyle}>
                      <Tag color={statusColor[booking.status] || 'default'}>{statusText[booking.status] || booking.status}</Tag>
                    </td>
                    <td style={tdStyle}>
                      <Space size="small" wrap>
                        <Tooltip title="Xem chi tiết đặt phòng">
                          <Button type="primary" icon={<EyeOutlined style={{ color: 'white' }} />} size="small" onClick={() => { setSelectedBooking(booking); setViewModalVisible(true); }}></Button>
                        </Tooltip>
                        {['pending', 'confirmed'].includes(booking.status) && (
                          <Tooltip title="Hủy đặt phòng">
                            <Button type="primary" icon={<CloseOutlined />} size="small" danger onClick={() => handleCancel(booking.id)}></Button>
                          </Tooltip>
                        )}
                        {['pending', 'confirmed'].includes(booking.status) && (
                          <Tooltip title="Check-in (nhận phòng)">
                            <Button type="primary" icon={<CheckOutlined />} size="small" onClick={() => handleCheckIn(booking)}></Button>
                          </Tooltip>
                        )}
                        {['pending', 'confirmed'].includes(booking.status) && (
                          <Tooltip title="Đánh dấu khách không đến (không hoàn tiền, tặng voucher 10%)">
                            <Button type="primary" danger size="small" onClick={() => handleNoShow(booking)}>No-show</Button>
                          </Tooltip>
                        )}
                        {booking.status === 'checked_in' && (
                          <Tooltip title="Check-out (trả phòng)">
                            <Button type="primary" icon={<LogoutOutlined />} size="small" onClick={() => handleCheckOut(booking.id)}></Button>
                          </Tooltip>
                        )}
                        {booking.status === 'checked_in' && (
                          <Tooltip title="Thêm dịch vụ cho khách">
                            <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => openOperation('service', booking)}></Button>
                          </Tooltip>
                        )}
                        {booking.status === 'checked_in' && (
                          <Tooltip title="Ghi nhận hỏng hóc / đền bù">
                            <Button type="primary" icon={<ToolOutlined />} size="small" onClick={() => openOperation('damage', booking)}></Button>
                          </Tooltip>
                        )}
                        {['confirmed', 'checked_in'].includes(booking.status) && (
                          <Tooltip title="Gia hạn thời gian ở">
                            <Button type="primary" icon={<HomeOutlined />} size="small" onClick={() => openOperation('extend', booking)}></Button>
                          </Tooltip>
                        )}
                        {booking.status === 'checked_in' && (
                          <Tooltip title="Chuyển phòng">
                            <Button type="primary" icon={<SwapOutlined />} size="small" onClick={() => openOperation('transfer', booking)}></Button>
                          </Tooltip>
                        )}
                        {booking.status === 'checked_in' && (
                          <Tooltip title="Khai báo khách ở cùng">
                            <Button type="primary" icon={<UserAddOutlined />} size="small" onClick={() => openOperation('declareGuests', booking)}></Button>
                          </Tooltip>
                        )}
                      </Space>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BookingDetailModal
        bookingId={viewModalVisible ? selectedBooking?.id ?? null : null}
        open={viewModalVisible}
        onClose={() => setViewModalVisible(false)}
      />

      <CheckoutPaymentModal
        bookingId={checkoutBookingId}
        open={checkoutBookingId !== null}
        onClose={() => setCheckoutBookingId(null)}
        onCheckedOut={fetchBookings}
      />

      <Modal
        title={operation ? operationTitle[operation] : ''}
        open={Boolean(operation)}
        onCancel={closeOperation}
        onOk={submitOperation}
        okText="Lưu"
        cancelText="Đóng"
        width={operation === 'guests' || operation === 'declareGuests' ? 900 : 560}
      >
        <Form form={form} layout="vertical">
          {renderOperationForm()}
        </Form>
      </Modal>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '14px 12px',
  borderBottom: '1px solid #eee',
  textAlign: 'left',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '14px 12px',
  borderBottom: '1px solid #eee',
  verticalAlign: 'middle',
};

const smallText: React.CSSProperties = {
  fontSize: 12,
  color: '#666',
  marginTop: 4,
};

const emptyStyle: React.CSSProperties = {
  padding: 32,
  textAlign: 'center',
  color: '#999',
};

export default BookingManagement;

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, DatePicker, Form, Input, InputNumber, message, Modal, Pagination, Select, Space, Tag, Tooltip } from 'antd';
import {
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  EditOutlined,
  EyeOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  SwapOutlined,
  ToolOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';
import CheckoutPaymentModal from './CheckoutPaymentModal';
import AdminBookingModifyModal from './AdminBookingModifyModal';
import { getPolicies, type PoliciesInfo } from '../../services/settingsService';
import { previewRoomPrice, type NightlyPriceItem } from '../../services/roomService';


interface Booking {
  id: number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  room_id?: number | null;
  room_number: string | null;
  room_type_id?: number | null;
  room_type_name: string | null;
  room_status?: string | null;
  check_in: string | null;
  check_out: string | null;
  status: string;
  total_price: string | number | null;
  room_price?: string | number | null;
  payable_total?: string | number | null;
  adults: number | null;
  children: number | null;
  notes?: string | null;
  created_at: string | null;
  requested_check_in_time?: string | null;
  requested_check_in_day_offset?: number | null;
  actual_check_in_time?: string | null;
  details?: any[];
  detail_id?: number | null;
}

interface ServiceItem {
  id: number;
  serviceName: string;
  price: string | number;
}

interface RoomItem {
  id: number;
  roomNumber: string;
  room_type_id?: number;
  roomTypeId?: number;
  room_type_name?: string;
  price_per_night?: string | number;
  status: string;
}

type Operation = 'guests' | 'declareGuests' | 'service' | 'damage' | 'extend' | 'transfer' | null;

const TransferPricePreview: React.FC<{
  booking: Booking | null;
  rooms: RoomItem[];
  form: any;
}> = ({ booking, rooms, form }) => {
  const bookingDetailId = Form.useWatch('bookingDetailId', form);
  const toRoomId = Form.useWatch('toRoomId', form);
  const fromDate = Form.useWatch('fromDate', form);
  const toDate = Form.useWatch('toDate', form);
  const [loading, setLoading] = useState(false);
  const [targetPreview, setTargetPreview] = useState<{
    nights: number;
    prices: NightlyPriceItem[];
    total: number;
  } | null>(null);
  const [sourcePreview, setSourcePreview] = useState<{
    nights: number;
    prices: NightlyPriceItem[];
    total: number;
  } | null>(null);

  const selectedDetail = Array.isArray(booking?.details)
    ? booking?.details.find((d: any) => Number(d.bookingDetailId || d.id) === Number(bookingDetailId))
    : (booking?.details?.[0] || null);

  const sourceRoomId = selectedDetail?.roomId || selectedDetail?.room_id || booking?.room_id;
  const sourceRoom = rooms.find((r) => r.id === sourceRoomId);

  useEffect(() => {
    if (!toRoomId || !fromDate || !toDate || !dayjs.isDayjs(fromDate) || !dayjs.isDayjs(toDate)) {
      setTargetPreview(null);
      setSourcePreview(null);
      return;
    }
    const checkInStr = fromDate.format('YYYY-MM-DD');
    const checkOutStr = toDate.format('YYYY-MM-DD');
    if (checkOutStr <= checkInStr) {
      setTargetPreview(null);
      setSourcePreview(null);
      return;
    }

    const targetRoom = rooms.find((r) => r.id === toRoomId);
    if (!targetRoom) return;

    let cancelled = false;
    setLoading(true);

    const targetTypeId = targetRoom.room_type_id || targetRoom.roomTypeId;
    const sourceTypeId = sourceRoom?.room_type_id || sourceRoom?.roomTypeId || selectedDetail?.roomTypeId || selectedDetail?.room_type_id;
    const sourcePrice = Number(selectedDetail?.roomPrice || sourceRoom?.price_per_night || 0);

    Promise.all([
      previewRoomPrice({
        roomTypeId: targetTypeId ? Number(targetTypeId) : undefined,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        fallbackPrice: Number(targetRoom.price_per_night || 0),
      }),
      previewRoomPrice({
        roomTypeId: sourceTypeId ? Number(sourceTypeId) : undefined,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        fallbackPrice: sourcePrice,
      })
    ])
      .then(([targetRes, sourceRes]) => {
        if (!cancelled) {
          setTargetPreview(targetRes.data);
          setSourcePreview(sourceRes.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTargetPreview(null);
          setSourcePreview(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bookingDetailId, toRoomId, fromDate, toDate, rooms, sourceRoom, selectedDetail]);

  if (!toRoomId || !fromDate || !toDate) return null;
  if (loading) {
    return (
      <div style={{ marginTop: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, color: '#64748b', fontSize: 13 }}>
        Đang tính toán giá phòng mới và giá phòng hiện tại theo từng ngày...
      </div>
    );
  }
  if (!targetPreview || !sourcePreview) return null;

  const targetRoom = rooms.find((r) => r.id === toRoomId);
  const priceDifference = targetPreview.total - sourcePreview.total;

  return (
    <div style={{ marginTop: 14, padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
      <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Giá từng đêm phòng mới ({targetRoom?.roomNumber} - {targetPreview.nights} đêm):</span>
        <strong style={{ color: '#047857', fontSize: 15 }}>{new Intl.NumberFormat('vi-VN').format(targetPreview.total)}₫</strong>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
        {targetPreview.prices.map((night, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
              background: '#fff',
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #f1f5f9'
            }}
          >
            <span>
              <strong>{dayjs(night.date).format('DD/MM/YYYY')}</strong> ({night.dayName})
              {night.isHoliday && <Tag color="red" style={{ marginLeft: 6 }}>Dịp lễ</Tag>}
              {night.isSunday && <Tag color="orange" style={{ marginLeft: 6 }}>Chủ nhật</Tag>}
              {night.isSaturday && <Tag color="purple" style={{ marginLeft: 6 }}>Thứ 7</Tag>}
              {night.priceType === 'normal' && <Tag color="blue" style={{ marginLeft: 6 }}>Ngày thường</Tag>}
              {night.note && <span style={{ color: '#64748b', fontSize: 12, marginLeft: 4 }}>({night.note})</span>}
            </span>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>
              {new Intl.NumberFormat('vi-VN').format(night.price)}₫
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
        <span>Giá phòng hiện tại cho khoảng chuyển ({sourcePreview.nights} đêm):</span>
        <strong style={{ color: '#334155' }}>{new Intl.NumberFormat('vi-VN').format(sourcePreview.total)}₫</strong>
      </div>

      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
        <span>Ước tính chênh lệch so với phòng cũ ({targetPreview.nights} đêm):</span>
        {priceDifference > 0 ? (
          <strong style={{ color: '#cf1322' }}>
            Khách cần bù: +{new Intl.NumberFormat('vi-VN').format(priceDifference)}₫
          </strong>
        ) : priceDifference < 0 ? (
          <strong style={{ color: '#389e0d' }}>
            Giảm trừ: -{new Intl.NumberFormat('vi-VN').format(Math.abs(priceDifference))}₫
          </strong>
        ) : (
          <strong style={{ color: '#64748b' }}>Không thay đổi giá (0₫)</strong>
        )}
      </div>
    </div>
  );
};

const TransferFormContent: React.FC<{
  booking: Booking | null;
  rooms: RoomItem[];
  form: any;
}> = ({ booking, rooms, form }) => {
  const fromDate = Form.useWatch('fromDate', form);
  const toDate = Form.useWatch('toDate', form);
  const bookingDetailId = Form.useWatch('bookingDetailId', form);
  const toRoomId = Form.useWatch('toRoomId', form);
  const [availRooms, setAvailRooms] = useState<any[]>([]);
  const [loadingAvail, setLoadingAvail] = useState<boolean>(false);

  const detailsList = Array.isArray(booking?.details) && booking.details.length > 0
    ? booking.details
    : [{
        id: booking?.detail_id || 1,
        bookingDetailId: booking?.detail_id || 1,
        roomId: booking?.room_id,
        roomNumber: booking?.room_number,
        typeName: booking?.room_type_name,
        roomPrice: booking?.room_price
      }];

  const assignedRoomIds = detailsList.map((d: any) => Number(d.roomId || d.room_id)).filter(Boolean);

  useEffect(() => {
    if (!booking?.id || !fromDate || !toDate || !dayjs.isDayjs(fromDate) || !dayjs.isDayjs(toDate)) {
      setAvailRooms([]);
      return;
    }
    const checkInStr = fromDate.format('YYYY-MM-DD');
    const checkOutStr = toDate.format('YYYY-MM-DD');
    if (checkOutStr <= checkInStr) {
      setAvailRooms([]);
      return;
    }

    let cancelled = false;
    setLoadingAvail(true);

    api.post(`/bookings/${booking.id}/admin-check-availability`, {
      checkIn: checkInStr,
      checkOut: checkOutStr,
    })
      .then((res: any) => {
        if (cancelled) return;
        const data = res?.data || res || {};
        const rawList = Array.isArray(data.availableRooms) ? data.availableRooms : [];
        // Lọc bỏ:
        // 1. Các phòng đang thuộc đơn này (phòng nguồn và các phòng khác của booking)
        // 2. Các phòng có trạng thái hiện tại khác 'available' (occupied, maintenance)
        const validList = rawList.filter((r: any) => {
          const isNotAssigned = !assignedRoomIds.includes(Number(r.id));
          const isAvailableStatus = (r.status || 'available') === 'available';
          return isNotAssigned && isAvailableStatus;
        });
        setAvailRooms(validList);

        // Nếu phòng đang chọn không còn nằm trong danh sách khả dụng, clear lựa chọn
        if (toRoomId && !validList.some((r: any) => Number(r.id) === Number(toRoomId))) {
          form.setFieldsValue({ toRoomId: undefined });
        }
      })
      .catch(() => {
        if (!cancelled) setAvailRooms([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAvail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [booking?.id, fromDate, toDate, bookingDetailId]);

  return (
    <>
      <Form.Item name="bookingDetailId" label="Phòng đang chuyển" rules={[{ required: true, message: 'Chọn phòng cần chuyển' }]}>
        <Select
          options={detailsList.map((d: any) => ({
            value: d.bookingDetailId || d.id,
            label: `Phòng ${d.roomNumber || d.room_number || d.roomId} · ${d.typeName || d.room_type_name || ''} · ${formatPrice(Number(d.roomPrice || booking?.room_price || 0))}/đêm`,
          }))}
          onChange={() => form.setFieldsValue({ toRoomId: undefined })}
        />
      </Form.Item>
      <Form.Item name="toRoomId" label="Phòng chuyển đến" rules={[{ required: true, message: 'Chọn phòng chuyển đến' }]}>
        <Select
          showSearch
          loading={loadingAvail}
          placeholder={loadingAvail ? "Đang kiểm tra phòng trống..." : "Chọn phòng còn trống"}
          options={availRooms.map((room: any) => ({
            value: room.id,
            label: `Phòng ${room.roomNumber} · ${room.room_type_name || room.typeName || ''} · ${formatPrice(room.default_price || room.price_per_night || 0)}/đêm`,
          }))}
        />
      </Form.Item>
      <Form.Item name="fromDate" label="Từ ngày" rules={[{ required: true }]}>
        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
      </Form.Item>
      <Form.Item name="toDate" label="Đến ngày" rules={[{ required: true }]}>
        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
      </Form.Item>
      <TransferPricePreview booking={booking} rooms={rooms} form={form} />
      <Form.Item name="reason" label="Lý do chuyển phòng" style={{ marginTop: 14 }}>
        <Input.TextArea rows={3} placeholder="Ví dụ: Khách muốn đổi phòng view đẹp hơn, nâng cấp hạng phòng..." />
      </Form.Item>
    </>
  );
};

const ExtendPricePreview: React.FC<{
  booking: Booking | null;
  form: any;
}> = ({ booking, form }) => {
  const newCheckOut = Form.useWatch('checkOut', form);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    nights: number;
    prices: NightlyPriceItem[];
    total: number;
  } | null>(null);

  useEffect(() => {
    if (!booking?.check_out || !newCheckOut) {
      setPreviewData(null);
      return;
    }

    const currentCheckOutStr = dayjs(booking.check_out).format('YYYY-MM-DD');
    const newCheckOutStr = dayjs(newCheckOut).format('YYYY-MM-DD');

    if (newCheckOutStr <= currentCheckOutStr) {
      setPreviewData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const typeId = booking.room_type_id;
    previewRoomPrice({
      roomTypeId: typeId ? Number(typeId) : undefined,
      checkIn: currentCheckOutStr,
      checkOut: newCheckOutStr,
      fallbackPrice: Number(booking.room_price || 0),
    })
      .then((res) => {
        if (!cancelled) setPreviewData(res.data);
      })
      .catch(() => {
        if (!cancelled) setPreviewData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [booking, newCheckOut]);

  if (!booking?.check_out || !newCheckOut) return null;
  if (loading) {
    return (
      <div style={{ marginTop: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, color: '#64748b', fontSize: 13 }}>
        Đang tính toán giá các đêm gia hạn (Lễ / Cuối tuần / Ngày thường)...
      </div>
    );
  }
  if (!previewData || previewData.nights === 0) return null;

  return (
    <div style={{ marginTop: 14, padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
      <div style={{ fontWeight: 600, color: '#166534', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Chi tiết các đêm gia hạn thêm ({previewData.nights} đêm):</span>
        <strong style={{ color: '#15803d', fontSize: 15 }}>+{new Intl.NumberFormat('vi-VN').format(previewData.total)}₫</strong>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
        {previewData.prices.map((night, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
              background: '#fff',
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #dcfce7'
            }}
          >
            <span>
              <strong>{dayjs(night.date).format('DD/MM/YYYY')}</strong> ({night.dayName})
              {night.isHoliday && <Tag color="red" style={{ marginLeft: 6 }}>Dịp lễ</Tag>}
              {night.isSunday && <Tag color="orange" style={{ marginLeft: 6 }}>Chủ nhật</Tag>}
              {night.isSaturday && <Tag color="purple" style={{ marginLeft: 6 }}>Thứ 7</Tag>}
              {night.priceType === 'normal' && <Tag color="blue" style={{ marginLeft: 6 }}>Ngày thường</Tag>}
              {night.note && <span style={{ color: '#64748b', fontSize: 12, marginLeft: 4 }}>({night.note})</span>}
            </span>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>
              {new Intl.NumberFormat('vi-VN').format(night.price)}₫
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
        <span>Tổng tiền phòng dự kiến sau gia hạn:</span>
        <strong style={{ color: '#0f172a', fontSize: 14 }}>
          {new Intl.NumberFormat('vi-VN').format(Number(booking?.total_price || 0) + previewData.total)}₫
        </strong>
      </div>
    </div>
  );
};

const statusText: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  checked_in: 'Đã check-in',
  checked_out: 'Đã trả phòng',
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

const getBookingDisplayTag = (booking: Booking) => {
  const normStatus = normalizeStatus(booking.status);
  if (
    ['pending', 'confirmed'].includes(normStatus) &&
    !booking.actual_check_in_time &&
    booking.check_in
  ) {
    const checkInStr = dayjs(booking.check_in).format('YYYY-MM-DD');
    const reqTime = booking.requested_check_in_time || '14:00:00';
    const offset = Number(booking.requested_check_in_day_offset || 0);
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
  const navigate = useNavigate();
  // Phân trang phía giao diện: danh sách vẫn tải đủ để các thao tác khác dùng,
  // nhưng bảng chỉ hiển thị từng trang cho dễ đọc.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const location = useLocation();
  // Trang này dùng chung cho cả /admin lẫn /staff; điều hướng nội bộ phải giữ
  // đúng khu vực đang đứng, nếu không nhân viên bấm vào sẽ bị chặn bởi AdminRoute.
  const areaPrefix = location.pathname.startsWith('/staff') ? '/staff' : '/admin';
  // Bộ lọc nhận từ đường dẫn để các ô "Việc cần làm hôm nay" ở Bảng điều khiển
  // bấm vào là nhảy thẳng sang đúng nhóm đơn cần xử lý.
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || '';
  const dueFilter = searchParams.get('due') || '';
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkoutBookingId, setCheckoutBookingId] = useState<number | null>(null);

  const [adminModifyModalOpen, setAdminModifyModalOpen] = useState(false);
  const [adminModifyBookingId, setAdminModifyBookingId] = useState<number | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [policies, setPolicies] = useState<PoliciesInfo | null>(null);
  const [form] = Form.useForm();
  const [conflictData, setConflictData] = useState<any>(null);
  const [reassignLoading, setReassignLoading] = useState<Record<number, boolean>>({});
  const [extendingAfterConflict, setExtendingAfterConflict] = useState(false);

  // Trả về mảng booking vừa tải để nơi gọi (VD: sau khi chuyển phòng) có thể
  // lấy ngay bản ghi mới nhất mà không cần đọc lại state bất đồng bộ.
  const fetchBookings = async (): Promise<Booking[]> => {
    setLoading(true);
    try {
      const response = await api.get('/bookings');
      const data = Array.isArray(response.data) ? response.data : [];
      const mapped = data
        .map((booking: Booking) => ({
          ...booking,
          status: normalizeStatus(booking.status),
          adults: booking.adults ?? 0,
          children: booking.children ?? 0,
        }))
        .filter((booking: Booking) => booking.check_in && booking.check_out);
      setBookings(mapped);
      setPage((current: number) => {
        const maxPage = Math.max(1, Math.ceil(mapped.length / pageSize));
        return Math.min(current, maxPage);
      });
      return mapped;
    } catch (error) {
      console.error('Error fetching bookings:', error);
      message.error('Lỗi khi tải danh sách đặt phòng');
      setBookings([]);
      return [];
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
    // Chỉ dùng để phát hiện khách đến sớm hơn giờ chuẩn -> hỏi xác nhận
    // trước khi check-in, không hiển thị note nào khác trong màn hình này.
    getPolicies()
      .then((res) => setPolicies(res.data))
      .catch(() => setPolicies(null));
  }, []);

  // Có phải khách đang đến SỚM hơn giờ nhận phòng chuẩn không (so trên đúng
  // ngày check_in của booking). Chỉ true khi hôm nay là ngày nhận phòng và
  // giờ hiện tại còn trước giờ chuẩn; nếu quá ngày (khách đến muộn vài hôm)
  // thì không tính là "sớm" theo nghĩa cần xác nhận đặc biệt.
  const isEarlyCheckIn = (booking: Booking) => {
    if (!booking.check_in) return false;
    const standardTime = (policies?.checkInTime || '14:00:00').slice(0, 8);
    const standardCheckIn = dayjs(`${dayjs(booking.check_in).format('YYYY-MM-DD')}T${standardTime}`);
    return dayjs().isSame(dayjs(booking.check_in), 'day') && dayjs().isBefore(standardCheckIn);
  };

  // Phòng cùng hạng (so theo room_type_name) đang trống, khác phòng hiện tại
  // của booking — dùng để gợi ý chuyển khách khi phòng gốc đang bảo trì/dọn dẹp.
  const getSimilarAvailableRooms = (booking: Booking) =>
    rooms.filter(
      (room) =>
        room.status === 'available' &&
        room.id !== booking.room_id &&
        (room.room_type_name || '') === (booking.room_type_name || '')
    );

  const handleReassignSimilarRoom = async (roomId: number) => {
    if (!selectedBooking) return;
    setReassigning(true);
    try {
      await api.patch(`/bookings/${selectedBooking.id}/reassign-room`, { roomId });
      message.success('Đã chuyển khách sang phòng khác cùng hạng');
      const updatedList = await fetchBookings();
      const updated = updatedList.find((b) => b.id === selectedBooking.id);
      if (updated) {
        setSelectedBooking(updated);
      }
      await fetchSupportData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Không thể chuyển phòng lúc này');
    } finally {
      setReassigning(false);
    }
  };

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
      const initDetails = (b: any) => {
        const rawDetails = Array.isArray(b.details) && b.details.length > 0 ? b.details : [];
        const defaultDetail = rawDetails.length > 0 ? (rawDetails[0].bookingDetailId || rawDetails[0].id) : null;
        form.setFieldsValue({
          bookingDetailId: defaultDetail,
          fromDate: dayjs(),
          toDate: b.check_out ? dayjs(b.check_out) : undefined,
        });
      };

      if (!Array.isArray(booking.details) || booking.details.length === 0) {
        api.get(`/bookings/${booking.id}`).then((res: any) => {
          const fullBooking = res.data?.data || res.data || res;
          if (fullBooking) {
            setSelectedBooking(fullBooking);
            initDetails(fullBooking);
          }
        }).catch(() => {});
      } else {
        initDetails(booking);
      }
    }
  };

  const closeOperation = () => {
    setOperation(null);
    setSelectedBooking(null);
    form.resetFields();
  };

  const submitOperation = async () => {
    if (!selectedBooking || !operation) return;

    // Chặn ngay từ phía UI: phòng đang bảo trì thì không cho bấm Check-in,
    // tránh gọi API rồi mới nhận lỗi 409 cụt lủn. Lễ tân cần chuyển phòng
    // trước (dùng nút "Chuyển đến phòng ..." ở khối cảnh báo phía trên form).
    if (operation === 'guests' && (selectedBooking.room_status || 'available') === 'maintenance') {
      message.error('Phòng đang dọn dẹp/bảo trì, vui lòng chuyển khách sang phòng khác trước khi check-in');
      return;
    }

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
        try {
          await api.patch(`/bookings/${selectedBooking.id}/extend`, {
            checkOut: values.checkOut.format('YYYY-MM-DD'),
          });
          message.success('Đã gia hạn thời gian ở');
        } catch (err: any) {
          if (err.response?.status === 409 && err.response?.data?.details?.conflicts) {
            setConflictData({
              bookingId: selectedBooking.id,
              checkOutDate: values.checkOut.format('YYYY-MM-DD'),
              conflicts: err.response.data.details.conflicts,
            });
            return;
          }
          throw err;
        }
      }

      if (operation === 'transfer') {
        const response = await api.patch(`/bookings/${selectedBooking.id}/transfer-room`, {
          bookingDetailId: values.bookingDetailId,
          toRoomId: values.toRoomId,
          fromDate: values.fromDate.format('YYYY-MM-DD'),
          toDate: values.toDate.format('YYYY-MM-DD'),
          reason: values.reason,
        });
        const result = (response as any)?.data || response;
        const pb = result?.priceBreakdown;
        const newTotal = Number(pb?.newTotalPrice ?? result?.booking?.total_price ?? selectedBooking.total_price ?? 0);
        const priceDifference = Number(pb?.priceDifference ?? 0);
        const remainingAmount = Number(result?.payment?.remainingAmount ?? 0);

        Modal.info({
          title: 'Đã chuyển phòng thành công',
          okText: 'Đã hiểu',
          content: (
            <div>
              <p>
                Tổng tiền phòng sau khi chuyển: <strong>{formatPrice(newTotal)}</strong>.
              </p>
              {priceDifference > 0 ? (
                <p>
                  Phòng mới có giá cao hơn, khách cần thanh toán thêm:{' '}
                  <strong style={{ color: '#cf1322' }}>+{formatPrice(priceDifference)}</strong>.
                </p>
              ) : priceDifference < 0 ? (
                <p>
                  Phòng mới rẻ hơn, tiền phòng được giảm:{' '}
                  <strong style={{ color: '#389e0d' }}>-{formatPrice(Math.abs(priceDifference))}</strong>.
                </p>
              ) : (
                <p style={{ color: '#64748b' }}>Không thay đổi giá phòng (Chênh lệch: 0₫).</p>
              )}
              {priceDifference > 0 && (
                <p>
                  Số tiền khách còn phải thanh toán: <strong>{formatPrice(remainingAmount)}</strong>.
                </p>
              )}
            </div>
          ),
        });
      }

      closeOperation();
      fetchBookings();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Không thể xử lý thao tác này');
    }
  };

  const handleResolveConflict = async (conflictingBookingId: number, newRoomId: number, targetRoomNum: string) => {
    setReassignLoading(prev => ({ ...prev, [conflictingBookingId]: true }));
    try {
      await api.patch(`/bookings/${conflictingBookingId}/reassign-room`, {
        newRoomId,
      });
      message.success(`Đã chuyển đặt phòng #${conflictingBookingId} sang phòng ${targetRoomNum}`);
      
      setConflictData((prev: any) => {
        if (!prev) return null;
        const updatedConflicts = prev.conflicts.map((c: any) => {
          if (c.bookingId === conflictingBookingId) {
            return { ...c, isResolved: true, resolvedRoomNum: targetRoomNum };
          }
          return c;
        });
        return { ...prev, conflicts: updatedConflicts };
      });
    } catch (err: any) {
      message.error(err.response?.data?.message || `Không thể chuyển phòng cho đặt phòng #${conflictingBookingId}`);
    } finally {
      setReassignLoading(prev => ({ ...prev, [conflictingBookingId]: false }));
    }
  };

  const handleRetryExtendAfterConflict = async () => {
    if (!conflictData) return;
    setExtendingAfterConflict(true);
    try {
      await api.patch(`/bookings/${conflictData.bookingId}/extend`, {
        checkOut: conflictData.checkOutDate,
      });
      message.success('Đã gia hạn thời gian ở thành công!');
      setConflictData(null);
      closeOperation();
      fetchBookings();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể gia hạn. Vui lòng kiểm tra các xung đột chưa giải quyết.');
    } finally {
      setExtendingAfterConflict(false);
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
  if (isEarlyCheckIn(booking)) {
    const requestedNote = booking.requested_check_in_time
      ? ` Khách có báo trước giờ nhận phòng dự kiến ${booking.requested_check_in_time.slice(0, 5)}.`
      : '';
    Modal.confirm({
      title: 'Xác nhận check-in sớm?',
      content: `Khách đã đến trước giờ nhận phòng chuẩn (${(policies?.checkInTime || '14:00').slice(0, 5)}).${requestedNote} Xác nhận khách đã đến và cho nhận phòng sớm?`,
      okText: 'Xác nhận, khách đã đến',
      cancelText: 'Chưa, để sau',
      onOk: () => openOperation('guests', booking),
    });
    return;
  }
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

  // Cảnh báo trạng thái phòng ngay trong modal check-in, kèm hành động chuyển
  // phòng nếu phòng gốc đang bảo trì/dọn dẹp. Chỉ hiển thị cho operation
  // 'guests' (luồng check-in) — 'declareGuests' là khai báo sau khi đã nhận
  // phòng nên không còn ý nghĩa kiểm tra sẵn sàng.
  const renderRoomReadinessNote = () => {
    if (operation !== 'guests' || !selectedBooking) return null;

    const status = selectedBooking.room_status || 'available';

    if (status === 'maintenance') {
      const similarRooms = getSimilarAvailableRooms(selectedBooking);
      return (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="Phòng đang dọn dẹp / bảo trì"
          description={
            <div>
              <p style={{ marginBottom: 8 }}>
                Phòng {selectedBooking.room_number || ''} hiện chưa sẵn sàng đón khách. Vui lòng
                chuyển khách sang phòng cùng hạng còn trống trước khi check-in.
              </p>
              {similarRooms.length > 0 ? (
                <Space wrap>
                  {similarRooms.map((room) => (
                    <Button
                      key={room.id}
                      size="small"
                      loading={reassigning}
                      onClick={() => handleReassignSimilarRoom(room.id)}
                    >
                      Chuyển đến phòng {room.roomNumber}
                    </Button>
                  ))}
                </Space>
              ) : (
                <span style={{ color: '#cf1322' }}>
                  Hiện không còn phòng cùng hạng trống. Vui lòng đổi sang hạng phòng khác, thương
                  lượng với khách, hoặc chờ dọn xong rồi thử lại.
                </span>
              )}
            </div>
          }
        />
      );
    }

    if (status === 'available') {
      return (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          title={`Phòng ${selectedBooking.room_number || ''} đã sẵn sàng đón khách`}
        />
      );
    }

    // Trạng thái khác (VD: occupied) không nên xảy ra với booking pending/confirmed,
    // nhưng vẫn hiển thị để lễ tân chủ động kiểm tra thay vì im lặng bỏ qua.
    return (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={`Trạng thái phòng hiện tại: ${status}`}
      />
    );
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
        <>
          <div style={{ marginBottom: 14, padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#334155' }}>
            Phòng đang ở: <strong>Phòng {selectedBooking?.room_number}</strong> ({selectedBooking?.room_type_name}) · Trả phòng hiện tại: <strong>{formatDate(selectedBooking?.check_out)}</strong>
          </div>
          <Form.Item name="checkOut" label="Ngày trả phòng mới" rules={[{ required: true, message: 'Chọn ngày trả mới' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <ExtendPricePreview booking={selectedBooking} form={form} />
        </>
      );
    }

    if (operation === 'transfer') {
      return <TransferFormContent booking={selectedBooking} rooms={rooms} form={form} />;
    }

    return null;
  };

  // Lọc theo đúng ý nghĩa mà Bảng điều khiển đang đếm, để con số ở ô "Việc cần
  // làm hôm nay" khớp với số dòng hiện ra sau khi bấm vào.
  const hasFilter = Boolean(statusFilter || dueFilter);
  const today = dayjs().format('YYYY-MM-DD');
  const filteredBookings = bookings.filter((booking) => {
    const status = normalizeStatus(booking.status);
    if (statusFilter && status !== statusFilter) return false;
    if (dueFilter) {
      // Đơn đã hủy hoặc khách không đến thì không còn là việc phải xử lý hôm nay.
      if (['cancelled', 'no_show'].includes(status)) return false;
      const target = dueFilter === 'checkin' ? booking.check_in : booking.check_out;
      if (!target || dayjs(target).format('YYYY-MM-DD') !== today) return false;
    }
    return true;
  });

  const filterLabel = statusFilter
    ? `Trạng thái: ${statusText[statusFilter] || statusFilter}`
    : dueFilter === 'checkin'
      ? 'Khách nhận phòng hôm nay'
      : dueFilter === 'checkout'
        ? 'Khách trả phòng hôm nay'
        : '';

  const clearFilter = () => {
    setSearchParams({});
    setPage(1);
  };

  // Kẹp lại trang đang xem thay vì đặt lại bằng useEffect: lọc xong danh sách
  // ngắn đi thì trang cũ có thể vượt quá số trang mới và bảng hiện ra trống trơn.
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const currentPage = Math.min(page, totalPages);

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

        {hasFilter && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 16,
              padding: '10px 14px',
              background: '#fff7e6',
              border: '1px solid #ffe0b2',
              borderRadius: 10,
            }}
          >
            <span style={{ fontSize: 13, color: '#8c6d3f' }}>Đang lọc:</span>
            <Tag color="orange" style={{ margin: 0 }}>{filterLabel}</Tag>
            <span style={{ fontSize: 13, color: '#8c6d3f' }}>
              {filteredBookings.length} đơn
            </span>
            <Button size="small" onClick={clearFilter}>
              Xem tất cả đơn
            </Button>
          </div>
        )}

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
                <th style={thStyle}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={emptyStyle}>Đang tải dữ liệu...</td></tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} style={emptyStyle}>
                    {hasFilter
                      ? 'Không có đơn nào khớp bộ lọc đang chọn'
                      : 'Không có dữ liệu đặt phòng'}
                  </td>
                </tr>
              ) : (
                filteredBookings
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((booking) => (
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
                      {(() => {
                        const tag = getBookingDisplayTag(booking);
                        return <Tag color={tag.color}>{tag.label}</Tag>;
                      })()}
                    </td>
                    <td style={tdStyle}>
                      {/* Quy ước nút thao tác: mỗi dòng chỉ MỘT nút chính (xem
                          chi tiết) tô đậm; các thao tác nghiệp vụ dùng nút viền
                          trung tính; thao tác không hoàn tác được dùng tone đỏ.
                          Tất cả cùng cỡ nhỏ, chỉ icon, mô tả nằm ở tooltip. */}
                      <Space size={4} wrap>
                        <Tooltip title="Xem chi tiết đặt phòng">
                          <Button
                            type="primary"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => navigate(`${areaPrefix}/bookings/${booking.id}`)}
                          />
                        </Tooltip>

                        <Tooltip title="Chỉnh sửa đặt phòng (đổi phòng, đổi hạng, đổi ngày)">
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => {
                              setAdminModifyBookingId(booking.id);
                              setAdminModifyModalOpen(true);
                            }}
                          />
                        </Tooltip>

                        {['pending', 'confirmed'].includes(booking.status) && (
                          <Tooltip title="Nhận phòng cho khách">
                            <Button
                              size="small"
                              icon={<CheckOutlined />}
                              onClick={() => handleCheckIn(booking)}
                            />
                          </Tooltip>
                        )}

                        {booking.status === 'checked_in' && (
                          <Tooltip title="Trả phòng">
                            <Button
                              size="small"
                              icon={<LogoutOutlined />}
                              onClick={() => handleCheckOut(booking.id)}
                            />
                          </Tooltip>
                        )}

                        {booking.status === 'checked_in' && (
                          <Tooltip title="Thêm dịch vụ cho khách">
                            <Button
                              size="small"
                              icon={<PlusOutlined />}
                              onClick={() => openOperation('service', booking)}
                            />
                          </Tooltip>
                        )}

                        {booking.status === 'checked_in' && (
                          <Tooltip title="Ghi nhận hư hỏng / đền bù">
                            <Button
                              size="small"
                              icon={<ToolOutlined />}
                              onClick={() => openOperation('damage', booking)}
                            />
                          </Tooltip>
                        )}

                        {['confirmed', 'checked_in'].includes(booking.status) && (
                          <Tooltip title="Gia hạn thời gian ở">
                            <Button
                              size="small"
                              icon={<ClockCircleOutlined />}
                              onClick={() => openOperation('extend', booking)}
                            />
                          </Tooltip>
                        )}

                        {booking.status === 'checked_in' && (
                          <Tooltip title="Chuyển phòng">
                            <Button
                              size="small"
                              icon={<SwapOutlined />}
                              onClick={() => openOperation('transfer', booking)}
                            />
                          </Tooltip>
                        )}

                        {booking.status === 'checked_in' && (
                          <Tooltip title="Khai báo khách ở cùng">
                            <Button
                              size="small"
                              icon={<UserAddOutlined />}
                              onClick={() => openOperation('declareGuests', booking)}
                            />
                          </Tooltip>
                        )}

                        {['pending', 'confirmed'].includes(booking.status) && (
                          <Tooltip title="Đánh dấu khách không đến (không hoàn tiền, tặng voucher 10%)">
                            <Button
                              danger
                              size="small"
                              icon={<StopOutlined />}
                              onClick={() => handleNoShow(booking)}
                            />
                          </Tooltip>
                        )}

                        {['pending', 'confirmed'].includes(booking.status) && (
                          <Tooltip title="Hủy đặt phòng">
                            <Button
                              danger
                              size="small"
                              icon={<CloseOutlined />}
                              onClick={() => handleCancel(booking.id)}
                            />
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

        {filteredBookings.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filteredBookings.length}
              showSizeChanger
              pageSizeOptions={[10, 20, 50]}
              showTotal={(total, range) => `${range[0]}-${range[1]} / ${total} đơn`}
              onChange={(nextPage, nextSize) => {
                setPage(nextSize !== pageSize ? 1 : nextPage);
                setPageSize(nextSize);
              }}
            />
          </div>
        )}
      </div>

      {/* Trang này xem chi tiết bằng cách chuyển sang /bookings/:id, không dùng
          modal nữa. Khối BookingDetailModal cũ đã bị gỡ vì viewModalVisible chỉ
          từng được gán false nên modal không bao giờ mở được. Bản thân file
          BookingDetailModal vẫn giữ vì trang lịch sử đặt phòng còn dùng. */}

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
        {renderRoomReadinessNote()}
        <Form form={form} layout="vertical">
          {renderOperationForm()}
        </Form>
      </Modal>

      <Modal
        title="Giải quyết xung đột gia hạn phòng"
        open={Boolean(conflictData)}
        onCancel={() => setConflictData(null)}
        footer={[
          <Button key="cancel" onClick={() => setConflictData(null)}>
            Hủy bỏ
          </Button>,
          <Button
            key="retry"
            type="primary"
            loading={extendingAfterConflict}
            onClick={handleRetryExtendAfterConflict}
            disabled={conflictData?.conflicts?.some((c: any) => !c.isResolved)}
          >
            Hoàn tất gia hạn
          </Button>
        ]}
        width={650}
      >
        <Alert
          title="Xung đột lịch đặt phòng"
          description="Khách lưu trú muốn gia hạn thời gian ở, nhưng phòng này đã có các đặt phòng của khách khác trong khoảng thời gian gia hạn. Bạn có thể giải quyết nhanh bằng cách chuyển các đặt phòng đó sang phòng trống cùng hạng dưới đây:"
          type="warning"
          showIcon
          style={{ marginBottom: 20 }}
        />
        
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {conflictData?.conflicts?.map((conflict: any) => (
            <div
              key={conflict.bookingId}
              style={{
                padding: 16,
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                marginBottom: 16,
                background: conflict.isResolved ? '#f6ffed' : '#fff',
                borderColor: conflict.isResolved ? '#b7eb8f' : '#f0f0f0'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>Đặt phòng #{conflict.bookingId}</strong>
                <Tag color="blue">{formatDate(conflict.checkIn)} - {formatDate(conflict.checkOut)}</Tag>
              </div>
              
              {conflict.isResolved ? (
                <div style={{ color: '#52c41a', fontWeight: '500' }}>
                  ✓ Đã chuyển sang phòng {conflict.resolvedRoomNum} thành công.
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
                    Chọn phòng cùng hạng còn trống để chuyển sang:
                  </div>
                  {conflict.suggestedRooms && conflict.suggestedRooms.length > 0 ? (
                    <Space wrap>
                      {conflict.suggestedRooms.map((room: any) => (
                        <Button
                          key={room.id}
                          size="small"
                          icon={<SwapOutlined />}
                          loading={reassignLoading[conflict.bookingId]}
                          onClick={() => handleResolveConflict(conflict.bookingId, room.id, room.roomNumber)}
                        >
                          Phòng {room.roomNumber} ({formatPrice(room.pricePerNight)}/đêm)
                        </Button>
                      ))}
                    </Space>
                  ) : (
                    <div style={{ color: '#ff4d4f', fontSize: 13 }}>
                      Không có phòng cùng hạng nào trống trong khoảng thời gian này. Cần xử lý thủ công.
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Modal>

      <AdminBookingModifyModal
        open={adminModifyModalOpen}
        bookingId={adminModifyBookingId}
        onClose={() => {
          setAdminModifyModalOpen(false);
          setAdminModifyBookingId(null);
        }}
        onSuccess={() => {
          fetchBookings();
        }}
      />
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
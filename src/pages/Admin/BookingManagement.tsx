import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Checkbox, DatePicker, Form, Input, InputNumber, message, Modal, Pagination, Select, Space, Tag, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FieldTimeOutlined,
  InboxOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  RiseOutlined,
  StopOutlined,
  SwapOutlined,
  ToolOutlined,
  UndoOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';
import CheckoutPaymentModal from './CheckoutPaymentModal';
import AdminBookingModifyModal from './AdminBookingModifyModal';
import { getPolicies, type PoliciesInfo } from '../../services/settingsService';
import { previewBookingChange } from '../../services/bookingService';


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
  booking_code?: string | null;
  payment_status?: string | null;
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
  rooms?: RoomItem[];
  form: any;
}> = ({ booking, form }) => {
  const bookingDetailId = Form.useWatch('bookingDetailId', form);
  const toRoomId = Form.useWatch('toRoomId', form);
  const fromDate = Form.useWatch('fromDate', form);
  const toDate = Form.useWatch('toDate', form);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  useEffect(() => {
    if (!booking?.id || !toRoomId || !fromDate || !toDate || !dayjs.isDayjs(fromDate) || !dayjs.isDayjs(toDate)) {
      setPreviewData(null);
      return;
    }
    const fromStr = fromDate.format('YYYY-MM-DD');
    const toStr = toDate.format('YYYY-MM-DD');
    if (toStr <= fromStr) {
      setPreviewData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    previewBookingChange(booking.id, {
      toRoomId: Number(toRoomId),
      fromDate: fromStr,
      checkOut: toStr,
      bookingDetailId: bookingDetailId ? Number(bookingDetailId) : undefined,
    })
      .then((res: any) => {
        if (!cancelled) {
          const body = res?.data || res;
          setPreviewData(body);
        }
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
  }, [booking?.id, bookingDetailId, toRoomId, fromDate, toDate]);

  if (!toRoomId || !fromDate || !toDate) return null;
  if (loading) {
    return (
      <div style={{ marginTop: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, color: '#64748b', fontSize: 13 }}>
        Đang tính toán biểu giá phòng mới và kiểm tra phụ thu lễ/cuối tuần...
      </div>
    );
  }
  if (!previewData) return null;

  const fb = previewData.financialBreakdown || {};
  const nightsList = previewData.nightlyPrices || [];

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {previewData.warnings && previewData.warnings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {previewData.warnings.map((w: string, idx: number) => (
            <Alert key={idx} type="warning" showIcon message={w} />
          ))}
        </div>
      )}

      <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 8, fontSize: 14 }}>
          Tổng hợp chi phí chuyển phòng:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Tiền phòng:</span>
            <strong>{formatPrice(fb.baseRoomAmount || 0)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Phụ thu ngày lễ (+20%):</span>
            <strong style={{ color: fb.holidaySurcharge > 0 ? '#cf1322' : '#64748b' }}>
              {fb.holidaySurcharge > 0 ? `+${formatPrice(fb.holidaySurcharge)}` : '0 VNĐ'}
            </strong>
          </div>
          {fb.holidaySurcharge > 0 && (
            <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', padding: '6px 10px', borderRadius: 6, fontSize: 12, margin: '2px 0 4px' }}>
              <div style={{ fontWeight: 600, color: '#cf1322', marginBottom: 2 }}>Chi tiết các ngày lễ (+20%):</div>
              {nightsList.filter((n: any) => n.isHoliday).map((n: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#595959' }}>
                  <span>• {dayjs(n.date || n.stayDate).format('DD/MM/YYYY')} ({n.dayName || ''}): {n.holidayName || n.note || 'Ngày lễ'}</span>
                  <span style={{ fontWeight: 600, color: '#cf1322' }}>+{formatPrice(n.surcharge || 0)}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Phụ thu cuối tuần (+10%):</span>
            <strong style={{ color: fb.weekendSurcharge > 0 ? '#d46b08' : '#64748b' }}>
              {fb.weekendSurcharge > 0 ? `+${formatPrice(fb.weekendSurcharge)}` : '0 VNĐ'}
            </strong>
          </div>
          {fb.weekendSurcharge > 0 && (
            <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', padding: '6px 10px', borderRadius: 6, fontSize: 12, margin: '2px 0 4px' }}>
              <div style={{ fontWeight: 600, color: '#d46b08', marginBottom: 2 }}>Chi tiết các ngày Thứ 7 & Chủ nhật (+10%):</div>
              {nightsList.filter((n: any) => !n.isHoliday && (n.isSaturday || n.isSunday)).map((n: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#595959' }}>
                  <span>• {dayjs(n.date || n.stayDate).format('DD/MM/YYYY')} ({n.dayName || (n.isSaturday ? 'Thứ bảy' : 'Chủ nhật')}): Phụ thu cuối tuần</span>
                  <span style={{ fontWeight: 600, color: '#d46b08' }}>+{formatPrice(n.surcharge || 0)}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Phí nâng cấp phòng:</span>
            <strong style={{ color: fb.upgradeFee > 0 ? '#0958d9' : '#64748b' }}>
              {fb.upgradeFee > 0 ? `+${formatPrice(fb.upgradeFee)}` : '0 VNĐ'}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: '1px solid #cbd5e1', fontSize: 14 }}>
            <strong>{fb.priceDifference >= 0 ? 'Tổng tiền phát sinh:' : 'Tổng tiền giảm trừ:'}</strong>
            <strong style={{ color: fb.priceDifference > 0 ? '#cf1322' : fb.priceDifference < 0 ? '#389e0d' : '#0f172a', fontSize: 15 }}>
              {fb.priceDifference > 0 ? `+${formatPrice(fb.priceDifference)}` : fb.priceDifference < 0 ? `-${formatPrice(Math.abs(fb.priceDifference))}` : '0 VNĐ'}
            </strong>
          </div>
          {fb.refundableExcessAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#389e0d', background: '#f6ffed', padding: '6px 8px', borderRadius: 4, marginTop: 4 }}>
              <span>💰 Tiền thừa hoàn trả cho khách:</span>
              <strong>+{formatPrice(fb.refundableExcessAmount)}</strong>
            </div>
          )}
        </div>
      </div>

      {nightsList.length > 0 && (
        <div style={{ padding: '10px 14px', background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8 }}>
          <div style={{ fontWeight: 600, color: '#262626', marginBottom: 8, fontSize: 13 }}>
            Chi tiết từng đêm ({nightsList.length} đêm):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
            {nightsList.map((night: any, idx: number) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 13,
                  background: '#fafafa',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #f1f5f9'
                }}
              >
                <span>
                  <strong>{dayjs(night.date || night.stayDate).format('DD/MM/YYYY')}</strong> ({night.dayName || ''})
                  {night.isHoliday && <Tag color="red" style={{ marginLeft: 6 }}>Ngày lễ (+20%)</Tag>}
                  {night.isSunday && <Tag color="orange" style={{ marginLeft: 6 }}>Chủ nhật (+10%)</Tag>}
                  {night.isSaturday && <Tag color="purple" style={{ marginLeft: 6 }}>Thứ 7 (+10%)</Tag>}
                  {!night.isHoliday && !night.isSunday && !night.isSaturday && <Tag color="blue" style={{ marginLeft: 6 }}>Ngày thường</Tag>}
                  {night.isNewRoom && <Tag color="cyan" style={{ marginLeft: 4 }}>Phòng mới: {night.roomNumber}</Tag>}
                </span>
                <span style={{ fontWeight: 600, color: night.isHoliday || night.isWeekend ? '#cf1322' : '#0f172a' }}>
                  {formatPrice(night.price)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
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
  const [previewData, setPreviewData] = useState<any>(null);

  useEffect(() => {
    if (!booking?.id || !booking?.check_out || !newCheckOut) {
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

    previewBookingChange(booking.id, {
      checkOut: newCheckOutStr,
    })
      .then((res: any) => {
        if (!cancelled) {
          const body = res?.data || res;
          setPreviewData(body);
        }
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
  }, [booking?.id, booking?.check_out, newCheckOut]);

  if (!booking?.check_out || !newCheckOut) return null;
  if (loading) {
    return (
      <div style={{ marginTop: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, color: '#64748b', fontSize: 13 }}>
        Đang tính toán giá các đêm gia hạn (Lễ / Cuối tuần / Ngày thường)...
      </div>
    );
  }
  if (!previewData) return null;

  const fb = previewData.financialBreakdown || {};
  const nightsList = previewData.nightlyPrices || [];
  const reducedNightsList = fb.reducedNightlyPrices || [];
  const isShortening = Boolean(previewData.isShortening || fb.isShortening);

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {isShortening && (
        <Alert
          type="info"
          showIcon
          message={`Rút ngắn thời gian ở: Giảm ${fb.reducedNights || previewData.reducedNights || 0} đêm`}
          description={`Ngày trả phòng mới: ${dayjs(previewData.targetCheckOut).format('DD/MM/YYYY')} (trước đây: ${dayjs(previewData.currentCheckOut).format('DD/MM/YYYY')}). Tiền phòng được giảm trừ: -${formatPrice(Math.abs(fb.priceDifference || 0))}.`}
        />
      )}

      {previewData.warnings && previewData.warnings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {previewData.warnings.map((w: string, idx: number) => (
            <Alert key={idx} type="warning" showIcon message={w} />
          ))}
        </div>
      )}

      <div style={{ padding: '12px 14px', background: isShortening ? '#f8fafc' : '#f0fdf4', border: `1px solid ${isShortening ? '#cbd5e1' : '#bbf7d0'}`, borderRadius: 8 }}>
        <div style={{ fontWeight: 600, color: isShortening ? '#0f172a' : '#166534', marginBottom: 8, fontSize: 14 }}>
          {isShortening ? 'Chi tiết chi phí rút ngắn ngày ở:' : 'Chi tiết chi phí gia hạn:'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Tiền phòng lưu trú mới ({previewData.totalNights || nightsList.length} đêm):</span>
            <strong>{formatPrice(fb.baseRoomAmount || 0)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Phụ thu ngày lễ (+20%):</span>
            <strong style={{ color: fb.holidaySurcharge > 0 ? '#cf1322' : '#64748b' }}>
              {fb.holidaySurcharge > 0 ? `+${formatPrice(fb.holidaySurcharge)}` : '0 VNĐ'}
            </strong>
          </div>
          {fb.holidaySurcharge > 0 && (
            <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', padding: '6px 10px', borderRadius: 6, fontSize: 12, margin: '2px 0 4px' }}>
              <div style={{ fontWeight: 600, color: '#cf1322', marginBottom: 2 }}>Chi tiết các ngày lễ (+20%):</div>
              {nightsList.filter((n: any) => n.isHoliday).map((n: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#595959' }}>
                  <span>• {dayjs(n.date || n.stayDate).format('DD/MM/YYYY')} ({n.dayName || ''}): {n.holidayName || n.note || 'Ngày lễ'}</span>
                  <span style={{ fontWeight: 600, color: '#cf1322' }}>+{formatPrice(n.surcharge || 0)}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Phụ thu cuối tuần (+10%):</span>
            <strong style={{ color: fb.weekendSurcharge > 0 ? '#d46b08' : '#64748b' }}>
              {fb.weekendSurcharge > 0 ? `+${formatPrice(fb.weekendSurcharge)}` : '0 VNĐ'}
            </strong>
          </div>
          {fb.weekendSurcharge > 0 && (
            <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', padding: '6px 10px', borderRadius: 6, fontSize: 12, margin: '2px 0 4px' }}>
              <div style={{ fontWeight: 600, color: '#d46b08', marginBottom: 2 }}>Chi tiết các ngày Thứ 7 & Chủ nhật (+10%):</div>
              {nightsList.filter((n: any) => !n.isHoliday && (n.isSaturday || n.isSunday)).map((n: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#595959' }}>
                  <span>• {dayjs(n.date || n.stayDate).format('DD/MM/YYYY')} ({n.dayName || (n.isSaturday ? 'Thứ bảy' : 'Chủ nhật')}): Phụ thu cuối tuần</span>
                  <span style={{ fontWeight: 600, color: '#d46b08' }}>+{formatPrice(n.surcharge || 0)}</span>
                </div>
              ))}
            </div>
          )}
          {fb.extraGuestSurcharge !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{fb.extraGuestSurcharge > 0 ? 'Phụ thu khách/trẻ em thêm đêm:' : 'Giảm phụ thu khách/trẻ em:'}</span>
              <strong style={{ color: fb.extraGuestSurcharge > 0 ? '#0958d9' : '#15803d' }}>
                {fb.extraGuestSurcharge > 0 ? `+${formatPrice(fb.extraGuestSurcharge)}` : `-${formatPrice(Math.abs(fb.extraGuestSurcharge))}`}
              </strong>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: `1px dashed ${isShortening ? '#cbd5e1' : '#86efac'}`, fontSize: 14 }}>
            <strong>{fb.priceDifference >= 0 ? 'Tổng tiền phát sinh thêm:' : 'Tổng tiền giảm trừ:'}</strong>
            <strong style={{ color: fb.priceDifference > 0 ? '#15803d' : fb.priceDifference < 0 ? '#15803d' : '#0f172a', fontSize: 15 }}>
              {fb.priceDifference > 0 ? `+${formatPrice(fb.priceDifference)}` : fb.priceDifference < 0 ? `-${formatPrice(Math.abs(fb.priceDifference))}` : '0 VNĐ'}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#334155' }}>
            <span>Tổng tiền sau thay đổi:</span>
            <strong>{formatPrice(fb.newTotalAmount || 0)}</strong>
          </div>
          {fb.refundableExcessAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#15803d', background: '#f0fdf4', padding: '6px 8px', borderRadius: 4, marginTop: 4 }}>
              <span>💰 Tiền thừa hoàn trả cho khách:</span>
              <strong>+{formatPrice(fb.refundableExcessAmount)}</strong>
            </div>
          )}
        </div>
      </div>

      {isShortening && reducedNightsList.length > 0 && (
        <div style={{ padding: '10px 14px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8 }}>
          <div style={{ fontWeight: 600, color: '#d46b08', marginBottom: 6, fontSize: 13 }}>
            ✂️ Chi tiết các đêm được cắt giảm ({reducedNightsList.length} đêm):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 130, overflowY: 'auto' }}>
            {reducedNightsList.map((night: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#595959', fontSize: 12, background: '#fff', padding: '4px 8px', borderRadius: 4 }}>
                <span>
                  • <strong>{dayjs(night.date || night.stayDate).format('DD/MM/YYYY')}</strong> ({night.dayName || ''})
                  {night.isHoliday && <Tag color="red" style={{ marginLeft: 4 }}>Ngày lễ (+20%)</Tag>}
                  {night.isSunday && <Tag color="orange" style={{ marginLeft: 4 }}>Chủ nhật (+10%)</Tag>}
                  {night.isSaturday && <Tag color="purple" style={{ marginLeft: 4 }}>Thứ 7 (+10%)</Tag>}
                </span>
                <span style={{ fontWeight: 600, color: '#15803d' }}>
                  -{formatPrice(night.price)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {nightsList.length > 0 && (
        <div style={{ padding: '10px 14px', background: '#fff', border: '1px solid #dcfce7', borderRadius: 8 }}>
          <div style={{ fontWeight: 600, color: '#166534', marginBottom: 8, fontSize: 13 }}>
            Chi tiết các đêm lưu trú ({nightsList.length} đêm):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
            {nightsList.map((night: any, idx: number) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 13,
                  background: '#f0fdf4',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #dcfce7'
                }}
              >
                <span>
                  <strong>{dayjs(night.date || night.stayDate).format('DD/MM/YYYY')}</strong> ({night.dayName || ''})
                  {night.isHoliday && <Tag color="red" style={{ marginLeft: 6 }}>Ngày lễ (+20%)</Tag>}
                  {night.isSunday && <Tag color="orange" style={{ marginLeft: 6 }}>Chủ nhật (+10%)</Tag>}
                  {night.isSaturday && <Tag color="purple" style={{ marginLeft: 6 }}>Thứ 7 (+10%)</Tag>}
                  {!night.isHoliday && !night.isSunday && !night.isSaturday && <Tag color="blue" style={{ marginLeft: 6 }}>Ngày thường</Tag>}
                </span>
                <span style={{ fontWeight: 600, color: night.isHoliday || night.isWeekend ? '#cf1322' : '#0f172a' }}>
                  {formatPrice(night.price)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
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
  const [cleaningRoomLoading, setCleaningRoomLoading] = useState<Record<number, boolean>>({});
  const [waiveEarlySurcharge, setWaiveEarlySurcharge] = useState(false);

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
    getPolicies()
      .then((res) => setPolicies(res.data))
      .catch(() => setPolicies(null));
  }, []);

  const isEarlyCheckIn = (booking: Booking) => {
    if (!booking.check_in) return false;
    const standardTime = (policies?.checkInTime || '14:00:00').slice(0, 8);
    const standardCheckIn = dayjs(`${dayjs(booking.check_in).format('YYYY-MM-DD')}T${standardTime}`);
    return dayjs().isSame(dayjs(booking.check_in), 'day') && dayjs().isBefore(standardCheckIn);
  };

  // Tính chi tiết thời gian đến sớm và mức phụ thu gợi ý
  const computeEarlyCheckInInfo = (booking?: Booking | null) => {
    if (!booking || !booking.check_in) {
      return { isEarly: false, percent: 0, surchargeAmount: 0, timeWindowLabel: '', hoursEarly: 0, description: '' };
    }
    const standardTime = (policies?.checkInTime || '14:00:00').slice(0, 8);
    const standardCheckIn = dayjs(`${dayjs(booking.check_in).format('YYYY-MM-DD')}T${standardTime}`);
    const now = dayjs();
    const isEarly = now.isSame(dayjs(booking.check_in), 'day') && now.isBefore(standardCheckIn);
    if (!isEarly) {
      return { isEarly: false, percent: 0, surchargeAmount: 0, timeWindowLabel: 'Đúng giờ', hoursEarly: 0, description: '' };
    }

    const hour = now.hour() + now.minute() / 60;
    const diffMinutes = Math.max(0, standardCheckIn.diff(now, 'minute'));
    const hoursEarly = Math.round((diffMinutes / 60) * 10) / 10;
    let percent = 0;
    let timeWindowLabel = '';
    let description = '';

    if (hour < 6) {
      percent = 100;
      timeWindowLabel = 'Trước 06:00 (Sáng sớm)';
      description = 'Phụ thu 100% giá 1 đêm do nhận phòng trước 06:00 sáng';
    } else if (hour < 9) {
      percent = 50;
      timeWindowLabel = '06:00 - 09:00 (Sáng)';
      description = 'Phụ thu 50% giá 1 đêm do nhận phòng từ 06:00 đến 09:00';
    } else if (hour < 12) {
      percent = 30;
      timeWindowLabel = '09:00 - 12:00 (Trưa)';
      description = 'Phụ thu 30% giá 1 đêm do nhận phòng từ 09:00 đến 12:00';
    } else {
      percent = 0;
      timeWindowLabel = '12:00 - 14:00 (Miễn phí)';
      description = 'Miễn phí nhận phòng sớm (từ 12:00 đến 14:00)';
    }

    const nightlyRate = Number(booking.room_price || booking.total_price || 0);
    const surchargeAmount = Math.round((nightlyRate * percent) / 100);

    return {
      isEarly: true,
      percent,
      surchargeAmount,
      timeWindowLabel,
      hoursEarly,
      description
    };
  };

  // Phòng cùng hạng đang trống
  const getSimilarAvailableRooms = (booking: Booking) =>
    rooms.filter(
      (room) =>
        room.status === 'available' &&
        room.id !== booking.room_id &&
        (room.room_type_name || '') === (booking.room_type_name || '')
    );

  // Phòng hạng khác đang trống (có thể nâng cấp)
  const getUpgradableRooms = (booking: Booking) =>
    rooms.filter(
      (room) =>
        room.status === 'available' &&
        room.id !== booking.room_id &&
        (room.room_type_name || '') !== (booking.room_type_name || '')
    );

  const handleReassignSimilarRoom = async (roomId: number) => {
    if (!selectedBooking) return;
    setReassigning(true);
    try {
      await api.patch(`/bookings/${selectedBooking.id}/reassign-room`, { roomId });
      message.success('Đã chuyển khách sang phòng khác');
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

  const handleMarkRoomCleaned = async (roomId: number) => {
    setCleaningRoomLoading((prev) => ({ ...prev, [roomId]: true }));
    try {
      await api.patch(`/rooms/${roomId}/mark-cleaned`);
      message.success(`Phòng đã được chuyển sang trạng thái Sẵn sàng đón khách!`);
      const updatedList = await fetchBookings();
      const updated = updatedList.find((b) => b.id === selectedBooking?.id);
      if (updated) setSelectedBooking(updated);
      await fetchSupportData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể cập nhật trạng thái phòng');
    } finally {
      setCleaningRoomLoading((prev) => ({ ...prev, [roomId]: false }));
    }
  };

  const handleLuggageStorage = (booking: Booking) => {
    const tagCode = `HL-${booking.id}-${dayjs().format('HHmm')}`;
    Modal.info({
      title: '🏷️ Tiếp nhận Gửi Hành lý Tạm thời (Chờ nhận phòng)',
      width: 520,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <div style={{ padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <div style={{ marginBottom: 6 }}>
              Mã thẻ gửi hành lý: <strong style={{ fontSize: 16, color: '#1d4ed8' }}>{tagCode}</strong>
            </div>
            <div>Khách hàng: <strong>{booking.customer_name}</strong> · SĐT: {booking.customer_phone || '—'}</div>
            <div>Phòng dự kiến: <strong>Phòng {booking.room_number}</strong> ({booking.room_type_name})</div>
            <div>Thời gian tiếp nhận: <strong>{dayjs().format('HH:mm — DD/MM/YYYY')}</strong></div>
          </div>
          <Alert
            type="success"
            showIcon
            message="Đã lưu thông tin gửi hành lý tại quầy lễ tân"
            description="Khách có thể nghỉ ngơi tại sảnh hoặc đi ăn uống trong lúc buồng phòng dọn dẹp. Khi phòng sẵn sàng, lễ tân sẽ báo cho khách nhận phòng."
          />
        </div>
      ),
      okText: 'Đã hoàn tất tiếp nhận đồ',
    });
  };

  const getHoldPolicyInfo = (booking: Booking) => {
    if (!['confirmed', 'pending'].includes(booking.status)) return null;

    const isFullyPaid = booking.payment_status === 'paid';
    if (isFullyPaid) {
      return {
        type: 'fully_paid',
        color: 'green',
        label: '🛡️ Giữ phòng 100%',
        tooltip: `Cam kết giữ phòng suốt toàn bộ kỳ nghỉ (đến 12:00 ngày ${formatDate(booking.check_out)})`,
      };
    }

    const checkInDate = booking.check_in;
    if (!checkInDate) return null;

    const standardTime = (policies?.checkInTime || '14:00:00').slice(0, 8);
    const requestedTime = booking.requested_check_in_time ? booking.requested_check_in_time.slice(0, 8) : standardTime;
    const baseDate = dayjs(`${dayjs(checkInDate).format('YYYY-MM-DD')}T${requestedTime}`).add(booking.requested_check_in_day_offset || 0, 'day');
    const deadline = baseDate.add(6, 'hour');
    const now = dayjs();

    const isPast = now.isAfter(deadline);
    const diffHours = deadline.diff(now, 'minute') / 60;
    const isUrgent = !isPast && diffHours <= 2 && diffHours >= 0;

    return {
      type: 'deposit',
      deadline,
      isPast,
      isUrgent,
      color: isPast ? 'red' : isUrgent ? 'orange' : 'gold',
      label: isPast ? '⛔ Quá hạn giữ phòng' : isUrgent ? `⚠️ Sắp hết hạn (${Math.round(diffHours * 10) / 10}h)` : `⏳ Giữ đến ${deadline.format('HH:mm DD/MM')}`,
      tooltip: isPast
        ? `Đã quá thời hạn giữ phòng (${deadline.format('HH:mm DD/MM/YYYY')}). Lễ tân có thể đánh dấu No-show để giải phóng phòng hoặc gia hạn giữ phòng.`
        : `Hạn chót giữ phòng: ${deadline.format('HH:mm DD/MM/YYYY')} (Giờ hẹn + 6 tiếng ân hạn)`,
    };
  };

  const handleExtendHold = (booking: Booking) => {
    let selectedHours = 2;
    let noteText = '';

    Modal.confirm({
      title: '⏳ Gia hạn Thời gian Giữ phòng cho Khách',
      width: 520,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}>
            <div>Đơn đặt phòng: <strong>#{booking.booking_code || booking.id}</strong> (P.{booking.room_number})</div>
            <div>Khách hàng: <strong>{booking.customer_name}</strong> · {booking.customer_phone}</div>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
              Chọn thời gian gia hạn thêm:
            </label>
            <Select
              defaultValue={2}
              style={{ width: '100%' }}
              onChange={(val) => { selectedHours = val; }}
              options={[
                { value: 2, label: 'Gia hạn thêm 2 tiếng (Khách đang trên đường tới)' },
                { value: 4, label: 'Gia hạn thêm 4 tiếng (Khách kẹt xe / trễ chuyến)' },
                { value: 8, label: 'Gia hạn đến khuya / rạng sáng hôm sau' },
                { value: 12, label: 'Gia hạn đến sáng hôm sau (08:00)' },
              ]}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
              Ghi chú lý do (tùy chọn):
            </label>
            <Input
              placeholder="VD: Khách gọi báo delay chuyến bay đến 23:00..."
              onChange={(e) => { noteText = e.target.value; }}
            />
          </div>
        </div>
      ),
      okText: 'Xác nhận gia hạn',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await api.patch(`/bookings/${booking.id}/extend-hold`, {
            additionalHours: selectedHours,
            note: noteText.trim()
          });
          message.success(`Đã gia hạn giữ phòng thành công!`);
          fetchBookings();
        } catch (err: any) {
          message.error(err.response?.data?.message || 'Không thể gia hạn giữ phòng');
        }
      }
    });
  };

  const handleReactivateNoShow = (booking: Booking) => {
    Modal.confirm({
      title: '🔄 Khôi phục Đơn đặt phòng sau No-show',
      width: 520,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13 }}>
            <div>Khách hàng: <strong>{booking.customer_name}</strong> · #{booking.booking_code || booking.id}</div>
            <div>Hạng phòng: <strong>{booking.room_type_name}</strong> (Phòng gốc: P.{booking.room_number})</div>
          </div>
          <Alert
            type="info"
            showIcon
            message="Khách đến trễ và muốn tiếp tục nhận phòng"
            description="Hệ thống sẽ kiểm tra phòng gốc. Nếu phòng gốc vẫn trống sẽ gán lại và Check-in ngay; nếu phòng gốc đã có khách khác sẽ tự động xếp sang phòng cùng hạng còn trống."
          />
        </div>
      ),
      okText: 'Khôi phục & Check-in ngay',
      cancelText: 'Đóng',
      onOk: async () => {
        try {
          const res = await api.patch(`/bookings/${booking.id}/reactivate`);
          message.success(res.data?.message || 'Đã khôi phục và check-in thành công cho khách!');
          fetchBookings();
          fetchSupportData();
        } catch (err: any) {
          message.error(err.response?.data?.message || 'Không thể khôi phục đơn đặt phòng này');
        }
      }
    });
  };

  const openOperation = (type: Operation, booking: Booking) => {
    setOperation(type);
    setSelectedBooking(booking);
    form.resetFields();
    if (type === 'guests' || type === 'declareGuests') {
      const defaultGuests = [
        {
          fullName: booking.customer_name || '',
          identityNumber: '',
          phone: booking.customer_phone || '',
        },
      ];
      form.setFieldsValue({ guests: defaultGuests });

      // Nếu là khai báo khách hoặc đơn đã có thông tin chi tiết, tải danh sách khách đã lưu
      api.get(`/bookings/${booking.id}`).then((res: any) => {
        const fullBooking = res.data?.data || res.data || res;
        if (fullBooking) {
          setSelectedBooking(fullBooking);
          if (Array.isArray(fullBooking.guests) && fullBooking.guests.length > 0) {
            form.setFieldsValue({
              guests: fullBooking.guests.map((g: any) => ({
                fullName: g.fullName || g.full_name || '',
                identityNumber: g.identityNumber || g.identity_number || '',
                phone: g.phone || '',
              })),
            });
          }
        }
      }).catch(() => {});
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
            if (idNum && !/^\d{12}$/.test(idNum)) {
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
        const earlyInfo = computeEarlyCheckInInfo(selectedBooking);
        const shouldApplySurcharge = earlyInfo.isEarly && !waiveEarlySurcharge && earlyInfo.surchargeAmount > 0;

        const response = await api.patch(`/bookings/${selectedBooking.id}/check-in`, {
          guests: values.guests,
          applyEarlySurcharge: shouldApplySurcharge,
          earlySurchargeAmount: shouldApplySurcharge ? earlyInfo.surchargeAmount : 0,
          earlyTimeLabel: earlyInfo.timeWindowLabel,
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
      title: '⛔ Xác nhận Khách không đến (No-show)',
      width: 520,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13 }}>
            <div>Đơn đặt phòng: <strong>#{booking.booking_code || booking.id}</strong> (P.{booking.room_number})</div>
            <div>Khách hàng: <strong>{booking.customer_name}</strong> · {booking.customer_phone || '—'}</div>
          </div>
          <div style={{ fontSize: 13, color: '#475569' }}>
            Quy trình xử lý theo quy định khách sạn:
            <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
              <li><strong>Tài chính:</strong> Không hoàn trả tiền phòng/tiền cọc theo chính sách No-show.</li>
              <li><strong>Phòng:</strong> Phòng {booking.room_number} sẽ được giải phóng ngay sang trạng thái <strong>Sẵn sàng (Available)</strong> để đón khách khác.</li>
              <li><strong>Chăm sóc khách:</strong> Tự động cấp mã <strong>Voucher giảm giá 10%</strong> cho lần đặt sau.</li>
            </ul>
          </div>
        </div>
      ),
      okText: 'Xác nhận No-show & Giải phóng phòng',
      cancelText: 'Đóng',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const response = await api.patch(`/bookings/${booking.id}/no-show`);
          const voucherCode = response.data?.voucher?.code;
          message.success(
            voucherCode
              ? `Đã chuyển No-show và giải phóng phòng. Mã voucher: ${voucherCode}`
              : 'Đã chuyển No-show và giải phóng phòng'
          );
          fetchBookings();
          fetchSupportData();
        } catch (error: any) {
          message.error(error.response?.data?.message || 'Không thể xử lý trường hợp khách không đến');
        }
      },
    });
  };

  // Cảnh báo trạng thái phòng ngay trong modal check-in: xử lý 3 kịch bản:
  // 1. Phòng đang dọn dẹp/bảo trì (maintenance)
  // 2. Phòng đang có khách khác lưu trú (occupied)
  // 3. Phòng đã sẵn sàng đón khách (available)
  const renderRoomReadinessNote = () => {
    if (operation !== 'guests' || !selectedBooking) return null;

    const status = selectedBooking.room_status || 'available';
    const similarRooms = getSimilarAvailableRooms(selectedBooking);
    const upgradeRooms = getUpgradableRooms(selectedBooking);

    if (status === 'maintenance') {
      return (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={
            <span style={{ fontWeight: 600 }}>
              ⚠️ Phòng {selectedBooking.room_number || ''} chưa được dọn dẹp / đang bảo trì
            </span>
          }
          description={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#334155' }}>
                Phòng hiện chưa sẵn sàng đón khách. Lễ tân có thể chọn một trong các phương án xử lý nhanh dưới đây:
              </p>

              {similarRooms.length > 0 && (
                <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #fed7aa' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#ea580c', marginBottom: 6 }}>
                    ✓ Có {similarRooms.length} phòng cùng hạng ({selectedBooking.room_type_name}) đang SẴN SÀNG:
                  </div>
                  <Space wrap size="small">
                    {similarRooms.map((room) => (
                      <Button
                        key={room.id}
                        size="small"
                        type="primary"
                        ghost
                        icon={<SwapOutlined />}
                        loading={reassigning}
                        onClick={() => handleReassignSimilarRoom(room.id)}
                      >
                        Chuyển sang P.{room.roomNumber}
                      </Button>
                    ))}
                  </Space>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selectedBooking.room_id && (
                  <Button
                    size="small"
                    icon={<CheckCircleOutlined />}
                    loading={cleaningRoomLoading[selectedBooking.room_id]}
                    onClick={() => handleMarkRoomCleaned(selectedBooking.room_id!)}
                  >
                    Đã dọn xong, đổi sang Sẵn sàng
                  </Button>
                )}
                <Button
                  size="small"
                  icon={<InboxOutlined />}
                  onClick={() => handleLuggageStorage(selectedBooking)}
                >
                  Tiếp nhận gửi hành lý & Chờ dọn phòng
                </Button>
              </div>
            </div>
          }
        />
      );
    }

    if (status === 'occupied') {
      return (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title={
            <span style={{ fontWeight: 600 }}>
              ⛔ Phòng {selectedBooking.room_number || ''} hiện ĐANG CÓ KHÁCH LƯU TRÚ
            </span>
          }
          description={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#334155' }}>
                Khách của lượt trước chưa trả phòng. Để tránh gián đoạn, vui lòng chọn phòng trống khác để xếp cho khách:
              </p>

              {similarRooms.length > 0 ? (
                <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 6 }}>
                    ✓ Có {similarRooms.length} phòng cùng hạng ({selectedBooking.room_type_name}) đang TRỐNG:
                  </div>
                  <Space wrap size="small">
                    {similarRooms.map((room) => (
                      <Button
                        key={room.id}
                        size="small"
                        type="primary"
                        danger
                        ghost
                        icon={<SwapOutlined />}
                        loading={reassigning}
                        onClick={() => handleReassignSimilarRoom(room.id)}
                      >
                        Chuyển sang P.{room.roomNumber}
                      </Button>
                    ))}
                  </Space>
                </div>
              ) : upgradeRooms.length > 0 ? (
                <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8', marginBottom: 6 }}>
                    🚀 Hết phòng cùng hạng. Gợi ý phòng hạng khác có sẵn:
                  </div>
                  <Space wrap size="small">
                    {upgradeRooms.slice(0, 3).map((room) => (
                      <Button
                        key={room.id}
                        size="small"
                        icon={<RiseOutlined />}
                        loading={reassigning}
                        onClick={() => handleReassignSimilarRoom(room.id)}
                      >
                        Nâng lên P.{room.roomNumber} ({room.room_type_name})
                      </Button>
                    ))}
                  </Space>
                </div>
              ) : (
                <span style={{ color: '#cf1322' }}>
                  Hiện tại không còn phòng trống nào khác. Vui lòng hỗ trợ khách gửi hành lý chờ tại sảnh.
                </span>
              )}

              <Space wrap size="small">
                <Button
                  size="small"
                  icon={<InboxOutlined />}
                  onClick={() => handleLuggageStorage(selectedBooking)}
                >
                  Gửi hành lý tại quầy lễ tân
                </Button>
              </Space>
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
          title={`Phòng ${selectedBooking.room_number || ''} (${selectedBooking.room_type_name || ''}) đã sẵn sàng đón khách`}
        />
      );
    }

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
    if (operation === 'guests') {
      const isPaid = selectedBooking?.payment_status === 'paid';
      const hasDeposit = selectedBooking?.payment_status === 'deposit_paid';
      const earlyInfo = computeEarlyCheckInInfo(selectedBooking);

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card tóm tắt nhanh đơn đặt phòng */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                Đơn đặt phòng #{selectedBooking?.booking_code || selectedBooking?.id}
              </span>
              {isPaid ? (
                <Tag color="green">Đã thanh toán đủ (100%)</Tag>
              ) : hasDeposit ? (
                <Tag color="orange">Đã đặt cọc</Tag>
              ) : (
                <Tag color="volcano">Chưa thanh toán</Tag>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px 16px', fontSize: 13, color: '#334155' }}>
              <div><strong>Khách đặt:</strong> {selectedBooking?.customer_name || 'Khách vãng lai'}</div>
              <div><strong>SĐT:</strong> {selectedBooking?.customer_phone || '—'}</div>
              <div><strong>Phòng:</strong> Phòng {selectedBooking?.room_number} ({selectedBooking?.room_type_name})</div>
              <div><strong>Lưu trú:</strong> {formatDate(selectedBooking?.check_in)} → {formatDate(selectedBooking?.check_out)}</div>
            </div>
            {!isPaid && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, fontSize: 12, color: '#d46b08' }}>
                ℹ️ <strong>Lưu ý:</strong> Không bắt buộc thanh toán 100% khi nhận phòng. Khoản tiền còn lại có thể thu trước hoặc khi khách trả phòng (Check-out).
              </div>
            )}
          </div>

          {/* Khối xử lý Check-in sớm & Phụ thu */}
          {earlyInfo.isEarly && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: '#1e40af', fontSize: 13 }}>
                  🌅 Khách nhận phòng SỚM (trước giờ chuẩn {(policies?.checkInTime || '14:00').slice(0, 5)})
                </span>
                <Tag color="blue">Đến sớm {earlyInfo.hoursEarly} tiếng</Tag>
              </div>
              <div style={{ fontSize: 13, color: '#334155', marginBottom: 8 }}>
                <div>Khung giờ: <strong>{earlyInfo.timeWindowLabel}</strong></div>
                <div>Quy định: {earlyInfo.description}</div>
                {earlyInfo.surchargeAmount > 0 && (
                  <div style={{ marginTop: 4 }}>
                    Mức phụ thu tiêu chuẩn: <strong style={{ color: '#b91c1c' }}>+{formatPrice(earlyInfo.surchargeAmount)}</strong> ({earlyInfo.percent}%)
                  </div>
                )}
              </div>

              {earlyInfo.surchargeAmount > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #93c5fd' }}>
                  <Checkbox
                    checked={waiveEarlySurcharge}
                    onChange={(e) => setWaiveEarlySurcharge(e.target.checked)}
                  >
                    <span style={{ fontWeight: 500, color: '#1e3a8a' }}>
                      🎁 Miễn phí phụ thu check-in sớm cho khách (Hỗ trợ khách hàng / Khách VIP)
                    </span>
                  </Checkbox>
                </div>
              )}
            </div>
          )}

          <div>
            <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Thông tin khách lưu trú & CCCD (Tùy chọn):</span>
              <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}>Có thể bổ sung sau khi nhận phòng</span>
            </div>
            <Form.List name="guests">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <Space key={field.key} align="baseline" wrap style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'fullName']}
                        rules={[{ required: true, message: 'Nhập họ tên' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder={`Họ tên khách ${index + 1}`} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'identityNumber']}
                        rules={[
                          { pattern: /^\d{12}$/, message: 'Số CCCD phải gồm đúng 12 chữ số' },
                        ]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input
                          placeholder="CCCD/CMND (Tùy chọn)"
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
                      <Form.Item {...field} name={[field.name, 'phone']} style={{ marginBottom: 0 }}>
                        <Input placeholder="SĐT (Tùy chọn)" />
                      </Form.Item>
                      {fields.length > 1 && (
                        <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                      )}
                    </Space>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} style={{ width: '100%', marginTop: 6 }}>
                    Thêm người ở cùng
                  </Button>
                </>
              )}
            </Form.List>
          </div>
        </div>
      );
    }

    if (operation === 'declareGuests') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#334155' }}>
            Đặt phòng: <strong>#{selectedBooking?.booking_code || selectedBooking?.id}</strong> · Phòng: <strong>Phòng {selectedBooking?.room_number}</strong> ({selectedBooking?.room_type_name}) · Khách đặt: <strong>{selectedBooking?.customer_name}</strong>
          </div>
          <Alert
            type="info"
            showIcon
            message="Khai báo hoặc cập nhật CCCD của khách lưu trú trong phòng"
            description="Lễ tân có thể bổ sung hoặc chỉnh sửa số CCCD, họ tên, số điện thoại của người lưu trú bất kỳ lúc nào."
          />
          <Form.List name="guests">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Space key={field.key} align="baseline" wrap style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item
                      {...field}
                      name={[field.name, 'fullName']}
                      rules={[{ required: true, message: 'Nhập họ tên' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder={`Họ tên khách ${index + 1}`} />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'identityNumber']}
                      rules={[
                        { pattern: /^\d{12}$/, message: 'Số CCCD phải gồm đúng 12 chữ số' },
                      ]}
                      style={{ marginBottom: 0 }}
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
                    <Form.Item {...field} name={[field.name, 'phone']} style={{ marginBottom: 0 }}>
                      <Input placeholder="Số điện thoại" />
                    </Form.Item>
                    {fields.length > 1 && (
                      <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                    )}
                  </Space>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} style={{ width: '100%', marginTop: 6 }}>
                  Thêm người ở cùng
                </Button>
              </>
            )}
          </Form.List>
        </div>
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
    guests: 'Xác nhận nhận phòng (Check-in)',
    declareGuests: 'Khai báo / Cập nhật CCCD khách lưu trú',
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
                <th style={thStyle}>Tổng tiền</th>
                <th style={thStyle}>Trạng thái</th>
                <th style={thStyle}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={emptyStyle}>Đang tải dữ liệu...</td></tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} style={emptyStyle}>
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
                    <td style={tdStyle}>{formatPrice(booking.payable_total ?? booking.total_price)}</td>
                    <td style={tdStyle}>
                      {(() => {
                        const tag = getBookingDisplayTag(booking);
                        const holdInfo = getHoldPolicyInfo(booking);
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div><Tag color={tag.color}>{tag.label}</Tag></div>
                            {isEarlyCheckIn(booking) && ['pending', 'confirmed'].includes(booking.status) && (
                              <div><Tag color="cyan">🌅 Đến sớm</Tag></div>
                            )}
                            {holdInfo && (
                              <Tooltip title={holdInfo.tooltip}>
                                <div><Tag color={holdInfo.color} style={{ cursor: 'pointer' }}>{holdInfo.label}</Tag></div>
                              </Tooltip>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ ...tdStyle, minWidth: 135 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {/* Hàng 1: Thao tác chính (Xem chi tiết, Sửa đơn, Check-in / Trả phòng, Khôi phục) */}
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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
                            <Tooltip title={isEarlyCheckIn(booking) ? "Khách đến sớm — Nhận phòng & Phụ thu" : "Nhận phòng cho khách"}>
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

                          {['pending', 'confirmed'].includes(booking.status) && (
                            <Tooltip title="Gia hạn thời gian giữ phòng khi khách báo đến muộn">
                              <Button
                                size="small"
                                icon={<FieldTimeOutlined />}
                                onClick={() => handleExtendHold(booking)}
                              />
                            </Tooltip>
                          )}

                          {booking.status === 'no_show' && (
                            <Tooltip title="Khôi phục đặt phòng & Check-in cho khách đến trễ">
                              <Button
                                size="small"
                                type="primary"
                                ghost
                                icon={<UndoOutlined />}
                                onClick={() => handleReactivateNoShow(booking)}
                              />
                            </Tooltip>
                          )}
                        </div>

                        {/* Hàng 2: Thao tác mở rộng (Dịch vụ, Đền bù, Gia hạn ở, Chuyển phòng, Khai báo khách, No-show, Hủy) */}
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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
                            <Tooltip title="Đánh dấu khách không đến (không hoàn tiền, giải phóng phòng, tặng voucher 10%)">
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
                        </div>
                      </div>
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
        okText={
          operation === 'guests'
            ? 'Xác nhận nhận phòng'
            : operation === 'declareGuests'
              ? 'Lưu danh sách khách'
              : 'Lưu'
        }
        cancelText="Đóng"
        width={operation === 'guests' || operation === 'declareGuests' ? 820 : 560}
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
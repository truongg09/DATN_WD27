import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { DatePicker, Input, Select, message } from 'antd';
import { CalendarOutlined, UserOutlined, PhoneOutlined, MailOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBed, faUser, faCheck, faExpandArrowsAlt } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { createBooking, checkAvailability } from '../../services/bookingService';
import { getRoomById } from '../../services/roomService';
import './Booking.css';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

interface BookingFormData {
  roomId: number;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  adults: number;
  children: number;
  specialRequests: string;
}

interface SelectedRoom {
  id: number;
  name: string;
  image: string;
  price: number;
  beds: string;
  area: string;
  capacity: number;
}

const Booking: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState<SelectedRoom | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, setValue, watch, register, formState: { errors } } = useForm<BookingFormData>({
    defaultValues: {
      roomId: 0,
      adults: 2,
      children: 0,
      specialRequests: ''
    }
  });

  register('roomId', { valueAsNumber: true, required: true, min: 1 });

  const adults = watch('adults');
  const children = watch('children');

  useEffect(() => {
    const roomId = searchParams.get('id');
    if (!roomId) return;

    const loadRoom = async () => {
      const parsedId = parseInt(roomId, 10);
      if (Number.isNaN(parsedId)) {
        message.error('Mã phòng không hợp lệ');
        navigate('/rooms');
        return;
      }

      try {
        const response = await getRoomById(parsedId);
        const room = response.data as {
          id: number;
          room_type_name: string;
          price_per_night: number;
          capacity: number;
          area?: number;
          room_number?: string;
        };
        setSelectedRoom({
          id: room.id,
          name: room.room_type_name,
          image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600',
          price: Number(room.price_per_night),
          beds: `${room.capacity} khách`,
          area: room.area ? `${room.area}m²` : `Phòng ${room.room_number || room.id}`,
          capacity: room.capacity,
        });
        setValue('roomId', room.id, { shouldValidate: true });
      } catch (error: unknown) {
        const err = error as { response?: { status?: number; data?: { message?: string } } };
        const status = err.response?.status;
        const msg = err.response?.data?.message;

        if (status === 404) {
          message.error('Không tìm thấy phòng này');
        } else {
          message.error(msg || 'Không thể tải thông tin phòng. Vui lòng thử lại sau.');
        }
        navigate('/rooms');
      }
    };

    loadRoom();
  }, [searchParams, setValue, navigate]);

  const calculateNights = () => {
    if (!dateRange[0] || !dateRange[1]) return 0;
    return dateRange[1].diff(dateRange[0], 'day');
  };

  const nights = calculateNights();

  const calculateTotal = () => {
    if (!selectedRoom || nights === 0) return 0;
    return selectedRoom.price * nights;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + '₫';
  };

  const onSubmit = async (data: BookingFormData) => {
    if (!isAuthenticated || !user?.id) {
      message.warning('Vui lòng đăng nhập để đặt phòng');
      navigate('/login');
      return;
    }

    if (!selectedRoom) {
      message.error('Vui lòng chọn phòng trước khi đặt');
      return;
    }

    if (!dateRange[0] || !dateRange[1]) {
      message.error('Vui lòng chọn ngày nhận và trả phòng');
      return;
    }

    const roomId = selectedRoom.id;
    const checkIn = dateRange[0].format('YYYY-MM-DD');
    const checkOut = dateRange[1].format('YYYY-MM-DD');

    if (data.adults + data.children > selectedRoom.capacity) {
      message.error(`Số khách vượt quá sức chứa phòng (${selectedRoom.capacity} người)`);
      return;
    }

    setSubmitting(true);
    try {
      const availability = await checkAvailability({
        roomId,
        checkIn,
        checkOut,
      });

      if (!availability.data.available) {
        message.error('Phòng không còn trống trong khoảng thời gian đã chọn');
        return;
      }

      const result = await createBooking({
        userId: user.id,
        roomId,
        checkIn,
        checkOut,
        adults: data.adults,
        children: data.children,
        notes: data.specialRequests || null,
        status: 'confirmed',
      });

      const booking = result.data as { id: number };
      message.success('Đặt phòng thành công! Vui lòng thanh toán để hoàn tất.');
      navigate(`/booking/${booking.id}/payment`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const msg = err.response?.data?.message || 'Đặt phòng thất bại';
      const errorMap: Record<string, string> = {
        'roomId must be a positive integer': 'Mã phòng không hợp lệ',
        'userId must be a positive integer': 'Thông tin tài khoản không hợp lệ, vui lòng đăng nhập lại',
        'checkOut must be after checkIn': 'Ngày trả phòng phải sau ngày nhận phòng',
      };
      message.error(errorMap[msg] || msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="booking-page">
      <div className="booking-hero">
        <div className="booking-hero-content">
          <h1>Đặt phòng</h1>
          <p>Hoàn tất thông tin để đặt phòng của bạn</p>
        </div>
      </div>

      <div className="booking-container">
        <form onSubmit={handleSubmit(onSubmit)} className="booking-form-wrapper">
          <div className="booking-main">
            <div className="booking-section">
              <h2>Thông tin khách hàng</h2>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Họ và tên <span className="required">*</span></label>
                  <Controller
                    name="guestName"
                    control={control}
                    rules={{ required: 'Vui lòng nhập họ tên' }}
                    render={({ field }) => (
                      <Input 
                        {...field}
                        placeholder="Nhập họ và tên của bạn"
                        size="large"
                        prefix={<UserOutlined />}
                      />
                    )}
                  />
                  {errors.guestName && <span className="error-text">{errors.guestName.message}</span>}
                </div>
              </div>

              <div className="form-row two-col">
                <div className="form-group">
                  <label>Email <span className="required">*</span></label>
                  <Controller
                    name="guestEmail"
                    control={control}
                    rules={{ 
                      required: 'Vui lòng nhập email',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Email không hợp lệ'
                      }
                    }}
                    render={({ field }) => (
                      <Input 
                        {...field}
                        placeholder="email@example.com"
                        size="large"
                        prefix={<MailOutlined />}
                      />
                    )}
                  />
                  {errors.guestEmail && <span className="error-text">{errors.guestEmail.message}</span>}
                </div>
                <div className="form-group">
                  <label>Số điện thoại <span className="required">*</span></label>
                  <Controller
                    name="guestPhone"
                    control={control}
                    rules={{ required: 'Vui lòng nhập số điện thoại' }}
                    render={({ field }) => (
                      <Input 
                        {...field}
                        placeholder="0xxx xxx xxx"
                        size="large"
                        prefix={<PhoneOutlined />}
                      />
                    )}
                  />
                  {errors.guestPhone && <span className="error-text">{errors.guestPhone.message}</span>}
                </div>
              </div>
            </div>

            <div className="booking-section">
              <h2>Ngày lưu trú</h2>
              
              <div className="form-group">
                <label>Ngày nhận và trả phòng <span className="required">*</span></label>
                <RangePicker
                  style={{ width: '100%', height: '48px' }}
                  placeholder={['Ngày nhận phòng', 'Ngày trả phòng']}
                  format="DD/MM/YYYY"
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                  value={dateRange}
                  onChange={(dates) => {
                    setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null]);
                    if (dates) {
                      setValue('checkIn', dates[0]?.format('YYYY-MM-DD') || '');
                      setValue('checkOut', dates[1]?.format('YYYY-MM-DD') || '');
                    }
                  }}
                />
              </div>

              {nights > 0 && (
                <div className="nights-info">
                  <span className="nights-count">Số đêm: <strong>{nights}</strong> đêm</span>
                </div>
              )}

              <div className="form-row two-col">
                <div className="form-group">
                  <label>Người lớn</label>
                  <Select
                    value={adults}
                    onChange={(value) => setValue('adults', value)}
                    options={[
                      { value: 1, label: '1 người lớn' },
                      { value: 2, label: '2 người lớn' },
                      { value: 3, label: '3 người lớn' },
                      { value: 4, label: '4 người lớn' }
                    ]}
                    size="large"
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="form-group">
                  <label>Trẻ em</label>
                  <Select
                    value={children}
                    onChange={(value) => setValue('children', value)}
                    options={[
                      { value: 0, label: 'Không có trẻ em' },
                      { value: 1, label: '1 trẻ em' },
                      { value: 2, label: '2 trẻ em' },
                      { value: 3, label: '3 trẻ em' }
                    ]}
                    size="large"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>

            <div className="booking-section">
              <h2>Yêu cầu đặc biệt</h2>
              <div className="form-group">
                <label>Ghi chú (tùy chọn)</label>
                <Controller
                  name="specialRequests"
                  control={control}
                  render={({ field }) => (
                    <TextArea 
                      {...field}
                      placeholder="Nhập các yêu cầu đặc biệt như: giường phụ, thú cưng, dị ứng..."
                      rows={4}
                    />
                  )}
                />
              </div>
            </div>
          </div>

          <div className="booking-sidebar">
            <div className="booking-summary">
              <h3>Tóm tắt đặt phòng</h3>
              
              {selectedRoom ? (
                <>
                  <div className="selected-room">
                    <img src={selectedRoom.image} alt={selectedRoom.name} />
                    <div className="room-summary-info">
                      <h4>{selectedRoom.name}</h4>
                      <p><FontAwesomeIcon icon={faBed} /> {selectedRoom.beds}</p>
                      <p><FontAwesomeIcon icon={faExpandArrowsAlt} /> {selectedRoom.area}</p>
                    </div>
                  </div>

                  <div className="summary-details">
                    <div className="summary-row">
                      <span>Giá phòng</span>
                      <span>{formatPrice(selectedRoom.price)}/đêm</span>
                    </div>
                    <div className="summary-row">
                      <span>Số đêm</span>
                      <span>{nights > 0 ? `${nights} đêm` : '-'}</span>
                    </div>
                    {nights > 0 && (
                      <>
                        <div className="summary-row">
                          <span>Tạm tính</span>
                          <span>{formatPrice(calculateTotal())}</span>
                        </div>
                        <div className="summary-row total">
                          <span>Tổng cộng</span>
                          <span className="total-price">{formatPrice(calculateTotal())}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="booking-policies">
                    <h4>Chính sách</h4>
                    <ul>
                      <li><FontAwesomeIcon icon={faCheck} /> Miễn phí hủy phòng trước 48 giờ</li>
                      <li><FontAwesomeIcon icon={faCheck} /> Nhận phòng từ 14:00</li>
                      <li><FontAwesomeIcon icon={faCheck} /> Trả phòng trước 12:00</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="no-room-selected">
                  <p>Bạn chưa chọn phòng</p>
                  <Link to="/rooms" className="btn-select-room">
                    Chọn phòng ngay
                  </Link>
                </div>
              )}

              <button 
                type="submit" 
                className="btn-confirm-booking"
                disabled={!selectedRoom || nights === 0 || submitting}
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận đặt phòng'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Booking;

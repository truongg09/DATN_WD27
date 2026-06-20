import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { DatePicker, Input, Select, message } from 'antd';
import { CalendarOutlined, UserOutlined, PhoneOutlined, MailOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBed, faUser, faCheck, faExpandArrowsAlt } from '@fortawesome/free-solid-svg-icons';
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
}

const Booking: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedRoom, setSelectedRoom] = useState<SelectedRoom | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<BookingFormData>({
    defaultValues: {
      roomId: 0,
      adults: 2,
      children: 0,
      specialRequests: ''
    }
  });

  const adults = watch('adults');
  const children = watch('children');

  useEffect(() => {
    const roomId = searchParams.get('id');
    if (roomId) {
      const roomData: SelectedRoom = {
        id: parseInt(roomId),
        name: 'Phòng Deluxe',
        image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600',
        price: 1200000,
        beds: '2 giường đơn',
        area: '40m²'
      };
      setSelectedRoom(roomData);
      setValue('roomId', parseInt(roomId));
    }
  }, [searchParams, setValue]);

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

  const onSubmit = (data: BookingFormData) => {
    if (!dateRange[0] || !dateRange[1]) {
      message.error('Vui lòng chọn ngày nhận và trả phòng');
      return;
    }
    
    message.success('Đặt phòng thành công! Chúng tôi sẽ liên hệ với bạn sớm nhất.');
    setTimeout(() => {
      navigate('/booking/history');
    }, 1500);
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
                disabled={!selectedRoom || nights === 0}
              >
                Xác nhận đặt phòng
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Booking;

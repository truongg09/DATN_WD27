import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { DatePicker, Button, Popover, Typography, Select, message } from 'antd';
import { CalendarOutlined, UserOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import './searchform.css';

const { RangePicker } = DatePicker;
const { Text } = Typography;
const { Option } = Select;

interface SearchFormData {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
}

const SearchForm: React.FC = () => {
  const navigate = useNavigate();
  const { control, handleSubmit, setValue, watch } = useForm<SearchFormData>({
    defaultValues: {
      adults: 2,
      children: 0,
      rooms: 1,
    },
  });

  const [guestOpen, setGuestOpen] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [childAges, setChildAges] = useState<number[]>([]);

  const adults = watch('adults');
  const children = watch('children');
  const rooms = watch('rooms');

  const calculateNights = () => {
    if (!dateRange[0] || !dateRange[1]) return 0;
    return dateRange[1].diff(dateRange[0], 'day');
  };

  const nights = calculateNights();

  const onSubmit = (data: SearchFormData) => {
    if (!dateRange[0] || !dateRange[1]) {
      message.warning('Vui lòng chọn ngày nhận và trả phòng');
      return;
    }
    const queryParams = new URLSearchParams({
      checkIn: dateRange[0].format('YYYY-MM-DD'),
      checkOut: dateRange[1].format('YYYY-MM-DD'),
      adults: data.adults.toString(),
      children: data.children.toString(),
      rooms: data.rooms.toString(),
      childAges: childAges.join(','),
    });
    // Router giữ vị trí cuộn khi chuyển trang, nên chủ động đưa khách về đầu
    // danh sách kết quả ngay khi bắt đầu tìm phòng.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    navigate(`/rooms?${queryParams.toString()}`);
  };

  const handleDecreaseAdults = () => {
    if (adults <= 1) return;
    if (adults <= rooms) {
      message.warning("Số phòng không thể nhiều hơn số khách người lớn");
      return;
    }
    setValue('adults', adults - 1);
  };

  const handleIncreaseAdults = () => {
    setValue('adults', adults + 1);
  };

  const handleDecreaseChildren = () => {
    const newChildren = Math.max(0, children - 1);
    setValue('children', newChildren);
    setChildAges(childAges.slice(0, newChildren));
  };

  const handleIncreaseChildren = () => {
    if (children >= 6) {
      message.warning("Số lượng trẻ em tối đa là 6");
      return;
    }
    const newChildren = children + 1;
    setValue('children', newChildren);
    setChildAges([...childAges, 8]); // tuổi mặc định là 8
  };

  const handleDecreaseRooms = () => {
    setValue('rooms', Math.max(1, rooms - 1));
  };

  const handleIncreaseRooms = () => {
    if (rooms >= adults) {
      message.warning("Số phòng không thể nhiều hơn số khách người lớn");
      return;
    }
    setValue('rooms', rooms + 1);
  };

  const handleAgeChange = (index: number, val: number) => {
    const newAges = [...childAges];
    newAges[index] = val;
    setChildAges(newAges);
  };

  const guestContent = (
    <div style={{ padding: '16px', minWidth: '280px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text strong>Người lớn</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button 
            shape="circle" 
            onClick={handleDecreaseAdults}
            disabled={adults <= 1}
          >-</Button>
          <Text strong style={{ minWidth: '24px', textAlign: 'center' }}>{adults}</Text>
          <Button 
            shape="circle" 
            onClick={handleIncreaseAdults}
          >+</Button>
        </div>
      </div>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text strong>Trẻ em</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button 
            shape="circle" 
            onClick={handleDecreaseChildren}
            disabled={children <= 0}
          >-</Button>
          <Text strong style={{ minWidth: '24px', textAlign: 'center' }}>{children}</Text>
          <Button 
            shape="circle" 
            onClick={handleIncreaseChildren}
          >+</Button>
        </div>
      </div>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text strong>Phòng</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button 
            shape="circle" 
            onClick={handleDecreaseRooms}
            disabled={rooms <= 1}
          >-</Button>
          <Text strong style={{ minWidth: '24px', textAlign: 'center' }}>{rooms}</Text>
          <Button 
            shape="circle" 
            onClick={handleIncreaseRooms}
          >+</Button>
        </div>
      </div>

      {/* Renders children age selectors if children > 0 */}
      {children > 0 && (
        <div style={{ marginTop: '16px', borderTop: '1px solid #e8e8e8', paddingTop: '12px' }}>
          <Text strong style={{ display: 'block', marginBottom: '8px', color: '#ab8965' }}>Tuổi của trẻ em</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {childAges.map((age, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: '13px' }}>Trẻ em {index + 1}</Text>
                <Select
                  value={age}
                  style={{ width: '120px' }}
                  onChange={(val) => handleAgeChange(index, val)}
                  size="small"
                >
                  <Option value={4}>Dưới 5 tuổi</Option>
                  <Option value={8}>Từ 6-11 tuổi</Option>
                  <Option value={12}>Trên 11 tuổi</Option>
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="search-form-section">
      <div className="container">
        <h2>Tìm kiếm phòng</h2>
        <div className="search-form-wrapper">
          <form className="search-form" onSubmit={handleSubmit(onSubmit)}>
            {/* Date Picker */}
            <div className="search-field">
              <div className="field-label">
                <CalendarOutlined />
                <span>Ngày nhận phòng và trả phòng</span>
              </div>
              <Controller
                name="checkIn"
                control={control}
                render={() => (
                  <div>
                    <RangePicker
                      style={{ width: '100%' }}
                      placeholder={['Ngày đến', 'Ngày đi']}
                      minDate={dayjs()}
                      value={dateRange}
                      onChange={(dates) => {
                        setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null]);
                        if (dates) {
                          setValue('checkIn', dates[0]?.format('YYYY-MM-DD') || '');
                          setValue('checkOut', dates[1]?.format('YYYY-MM-DD') || '');
                        }
                      }}
                    />
                    {nights > 0 && (
                      <div className="nights-count">
                        {nights} {nights === 1 ? 'đêm' : 'đêm'}
                      </div>
                    )}
                  </div>
                )}
              />
            </div>

            {/* Guest Selector */}
            <div className="search-field">
              <div className="field-label">
                <UserOutlined />
                <span>Khách và Phòng</span>
              </div>
              <Popover
                content={guestContent}
                title="Chọn khách và phòng"
                trigger="click"
                open={guestOpen}
                onOpenChange={setGuestOpen}
                placement="bottomLeft"
              >
                <div className="guest-selector">
                  <span className="guest-text">
                    {adults} người lớn, {children} trẻ em, {rooms} phòng
                  </span>
                  <UserOutlined className="guest-icon" />
                </div>
              </Popover>
            </div>

            {/* Search Button */}
            <div className="search-button-wrapper">
              <button type="submit" className="custom-search-button">
                <SearchOutlined />
                <span>Tìm kiếm</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SearchForm;

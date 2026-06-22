import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { DatePicker, Button, Popover, Typography } from 'antd';
import { CalendarOutlined, UserOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import './searchform.css';

const { RangePicker } = DatePicker;
const { Text } = Typography;

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

  const adults = watch('adults');
  const children = watch('children');
  const rooms = watch('rooms');

  const calculateNights = () => {
    if (!dateRange[0] || !dateRange[1]) return 0;
    return dateRange[1].diff(dateRange[0], 'day');
  };

  const nights = calculateNights();

  const onSubmit = (data: SearchFormData) => {
    console.log('Search data:', data);
    navigate('/rooms');
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
            onClick={() => setValue('adults', Math.max(1, adults - 1))}
            disabled={adults <= 1}
          >-</Button>
          <Text strong style={{ minWidth: '24px', textAlign: 'center' }}>{adults}</Text>
          <Button 
            shape="circle" 
            onClick={() => setValue('adults', adults + 1)}
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
            onClick={() => setValue('children', Math.max(0, children - 1))}
            disabled={children <= 0}
          >-</Button>
          <Text strong style={{ minWidth: '24px', textAlign: 'center' }}>{children}</Text>
          <Button 
            shape="circle" 
            onClick={() => setValue('children', children + 1)}
          >+</Button>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text strong>Phòng</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button 
            shape="circle" 
            onClick={() => setValue('rooms', Math.max(1, rooms - 1))}
            disabled={rooms <= 1}
          >-</Button>
          <Text strong style={{ minWidth: '24px', textAlign: 'center' }}>{rooms}</Text>
          <Button 
            shape="circle" 
            onClick={() => setValue('rooms', rooms + 1)}
          >+</Button>
        </div>
      </div>
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
                rules={{ required: true }}
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

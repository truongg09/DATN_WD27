import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const BookingCalendar: React.FC = () => {
  return (
    <Card>
      <Title level={2}>Lịch đặt phòng</Title>
      <p>Trang quản lý lịch đặt phòng sẽ ở đây!</p>
    </Card>
  );
};

export default BookingCalendar;

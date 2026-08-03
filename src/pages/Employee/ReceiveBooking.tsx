import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const ReceiveBooking: React.FC = () => {
  return (
    <Card>
      <Title level={2}>Tiếp nhận đặt phòng</Title>
      <p>Trang tiếp nhận đặt phòng sẽ ở đây!</p>
    </Card>
  );
};

export default ReceiveBooking;

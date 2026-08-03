import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const CheckinCheckout: React.FC = () => {
  return (
    <Card>
      <Title level={2}>Check-in / Check-out</Title>
      <p>Trang Check-in / Check-out sẽ ở đây!</p>
    </Card>
  );
};

export default CheckinCheckout;

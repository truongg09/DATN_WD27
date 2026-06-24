import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const Payment: React.FC = () => {
  return (
    <Card>
      <Title level={2}>Thanh toán</Title>
      <p>Trang quản lý thanh toán sẽ ở đây!</p>
    </Card>
  );
};

export default Payment;

import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const Customers: React.FC = () => {
  return (
    <Card>
      <Title level={2}>Khách hàng</Title>
      <p>Trang quản lý khách hàng sẽ ở đây!</p>
    </Card>
  );
};

export default Customers;

import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const CustomerService: React.FC = () => {
  return (
    <Card>
      <Title level={2}>Dịch vụ khách hàng</Title>
      <p>Trang dịch vụ khách hàng sẽ ở đây!</p>
    </Card>
  );
};

export default CustomerService;

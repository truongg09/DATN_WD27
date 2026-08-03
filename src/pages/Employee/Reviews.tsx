import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const Reviews: React.FC = () => {
  return (
    <Card>
      <Title level={2}>Đánh giá</Title>
      <p>Trang quản lý đánh giá sẽ ở đây!</p>
    </Card>
  );
};

export default Reviews;

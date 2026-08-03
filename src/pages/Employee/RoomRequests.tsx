import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const RoomRequests: React.FC = () => {
  return (
    <Card>
      <Title level={2}>Yêu cầu phòng</Title>
      <p>Trang quản lý yêu cầu phòng sẽ ở đây!</p>
    </Card>
  );
};

export default RoomRequests;

import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const RoomStatus: React.FC = () => {
  return (
    <Card>
      <Title level={2}>Tình trạng phòng</Title>
      <p>Trang quản lý tình trạng phòng sẽ ở đây!</p>
    </Card>
  );
};

export default RoomStatus;

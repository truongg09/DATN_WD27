import { Tabs } from 'antd';
import {
  CustomerServiceOutlined,
  AppstoreOutlined,
  ToolOutlined,
  ProfileOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import ServicesTab from './service/ServicesTab';
import RoomItemsTab from './service/RoomItemsTab';
import DamageReportsTab from './service/DamageReportsTab';
import BookingServicesTab from './service/BookingServicesTab';
import ServiceRequestsTab from './service/ServiceRequestsTab';
import './service/service-management.css';

function ServiceManagement() {
  return (
    <div className="service-management" style={{ padding: '24px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
        Quản Lý Dịch Vụ &amp; Tài Sản Phòng
      </h1>
      <Tabs
        defaultActiveKey="services"
        type="card"
        items={[
          {
            key: 'services',
            label: (
              <span>
                <CustomerServiceOutlined /> Dịch vụ
              </span>
            ),
            children: <ServicesTab />,
          },
          {
            key: 'service-requests',
            label: (
              <span>
                <InboxOutlined /> Yêu cầu dịch vụ
              </span>
            ),
            children: <ServiceRequestsTab />,
          },
          {
            key: 'room-items',
            label: (
              <span>
                <AppstoreOutlined /> Vật dụng phòng
              </span>
            ),
            children: <RoomItemsTab />,
          },
          {
            key: 'damage-reports',
            label: (
              <span>
                <ToolOutlined /> Báo hỏng
              </span>
            ),
            children: <DamageReportsTab />,
          },
          {
            key: 'booking-services',
            label: (
              <span>
                <ProfileOutlined /> Dịch vụ theo đơn
              </span>
            ),
            children: <BookingServicesTab />,
          },
        ]}
      />
    </div>
  );
}

export default ServiceManagement;

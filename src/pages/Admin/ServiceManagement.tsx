import { Tabs, Button } from 'antd';
import {
  CustomerServiceOutlined,
  AppstoreOutlined,
  ToolOutlined,
  ProfileOutlined,
  InboxOutlined,
  CalendarOutlined,
  DollarCircleOutlined
} from '@ant-design/icons';
import ServicesTab from './service/ServicesTab';
import RoomItemsTab from './service/RoomItemsTab';
import DamageReportsTab from './service/DamageReportsTab';
import BookingServicesTab from './service/BookingServicesTab';
import ServiceRequestsTab from './service/ServiceRequestsTab';
import HolidayPriceManagementTab from './service/HolidayPriceManagementTab';
import { useUrlTab } from '../../hooks/useUrlTab';
import './service/service-management.css';

const SERVICE_TABS = [
  'services',
  'holiday-pricing',
  'service-requests',
  'room-items',
  'damage-reports',
  'booking-services',
] as const;

function ServiceManagement() {
  // Tab nằm trên URL để F5 không văng về "Dịch vụ" khi đang dở việc ở tab khác.
  const [activeTab, setActiveTab] = useUrlTab('tab', SERVICE_TABS, 'services');

  return (
    <div className="service-management" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>
          Quản Lý Dịch Vụ &amp; Bảng Giá Ngày Lễ
        </h1>
        <Button
          type="primary"
          icon={<DollarCircleOutlined />}
          style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', fontWeight: 600 }}
          onClick={() => setActiveTab('holiday-pricing')}
        >
          Bảng giá Lễ &amp; Chủ nhật
        </Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
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
            key: 'holiday-pricing',
            label: (
              <span>
                <CalendarOutlined /> Bảng giá Lễ &amp; Ngày tùy chọn
              </span>
            ),
            children: <HolidayPriceManagementTab />,
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

import { useCallback, useEffect, useState } from 'react';
import { Tabs, Button, Badge } from 'antd';
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
import api from '../../services/api';
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

  // Số yêu cầu dịch vụ khách gửi đang chờ duyệt. Menu bên trái đã có chấm đỏ,
  // nhưng vào trong trang thì phải chấm tiếp lên nhãn tab, nếu không lễ tân
  // vẫn phải mở từng tab để dò xem việc nằm ở đâu.
  const [pendingRequests, setPendingRequests] = useState(0);

  // Trang cha PHẢI tự đếm: Ant Design chỉ mount tab đang mở, nên nếu chờ
  // ServiceRequestsTab báo số thì mở trang (hoặc F5) ở tab khác là chấm đỏ mất,
  // phải bấm vào đúng tab đó mới hiện — tức là mất luôn tác dụng chỉ đường.
  useEffect(() => {
    // Cờ alive để không setState sau khi rời trang (cùng cách AdminLayout đang
    // poll bộ đếm này).
    let alive = true;

    const loadPendingCount = async () => {
      try {
        const res = (await api.get('/dashboard/pending-counts')) as {
          data?: { pendingServiceRequests?: number };
        };
        if (alive) {
          setPendingRequests(Number(res?.data?.pendingServiceRequests || 0));
        }
      } catch {
        // Lỗi mạng thì giữ nguyên số cũ, nhịp đếm sau sẽ cập nhật lại.
      }
    };

    loadPendingCount();
    // Nhiều máy lễ tân dùng cùng lúc: 10 giây một nhịp để người này duyệt xong
    // thì máy người kia thấy chấm đỏ giảm mà không cần F5.
    const timer = window.setInterval(loadPendingCount, 10000);
    window.addEventListener('focus', loadPendingCount);

    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', loadPendingCount);
    };
  }, []);

  // Tab con báo về sau mỗi lần duyệt/từ chối để chấm đỏ đổi ngay, không phải
  // đợi hết nhịp 10 giây.
  const handlePendingCountChange = useCallback((count: number) => {
    setPendingRequests(count);
  }, []);

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
              <Badge count={pendingRequests} size="small" offset={[10, -2]} overflowCount={99}>
                <span>
                  <InboxOutlined /> Yêu cầu dịch vụ
                </span>
              </Badge>
            ),
            children: <ServiceRequestsTab onPendingCountChange={handlePendingCountChange} />,
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

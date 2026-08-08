import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Badge, Tooltip } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './AdminLayout.css';

interface PendingCounts {
  pendingBookings: number;
  pendingServiceRequests: number;
  pendingRefunds: number;
  pendingWithdrawals: number;
  pendingTransferConfirmations: number;
  unpaidStays: number;
  total: number;
}

const EMPTY_COUNTS: PendingCounts = {
  pendingBookings: 0,
  pendingServiceRequests: 0,
  pendingRefunds: 0,
  pendingWithdrawals: 0,
  pendingTransferConfirmations: 0,
  unpaidStays: 0,
  total: 0,
};

// Badge đỏ tự cập nhật mỗi 8 giây, không cần F5
const POLL_INTERVAL_MS = 8000;

function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [counts, setCounts] = useState<PendingCounts>(EMPTY_COUNTS);

  useEffect(() => {
    let alive = true;

    const loadCounts = async () => {
      try {
        const response = (await api.get('/dashboard/pending-counts')) as { data: PendingCounts };
        if (alive && response?.data) {
          setCounts({ ...EMPTY_COUNTS, ...response.data });
        }
      } catch {
        // Bỏ qua lỗi mạng tạm thời, lần polling sau sẽ thử lại
      }
    };

    loadCounts();
    const timer = window.setInterval(loadCounts, POLL_INTERVAL_MS);
    // Đếm lại ngay khi quay lại tab hoặc vừa thao tác xong ở trang khác,
    // để số trên badge không bị cũ trong lúc chờ vòng polling kế tiếp.
    window.addEventListener('focus', loadCounts);

    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', loadCounts);
    };
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const withBadge = (label: string, count: number, tooltip?: string) => (
    <Tooltip title={count > 0 ? tooltip : undefined} placement="right">
      <Badge count={count} size="small" offset={[10, 0]} overflowCount={99}>
        <span style={{ color: 'inherit' }}>{label}</span>
      </Badge>
    </Tooltip>
  );

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <h2>
            HotelHub Admin
            {counts.total > 0 && (
              <Tooltip>
                <Badge
                  count={counts.total}
                  size="small"
                  overflowCount={99}
                  style={{ marginLeft: 8, verticalAlign: 'middle' }}
                />
              </Tooltip>
            )}
          </h2>
        </div>
        <nav className="admin-nav">
          <ul>
            <li><Link to="/admin">Dashboard</Link></li>
            <li><Link to="/admin/rooms">Quản lý phòng</Link></li>
            <li><Link to="/admin/room-types">Loại phòng</Link></li>
            <li>
              <Link to="/admin/bookings">
                {withBadge(
                  'Đặt phòng',
                  counts.pendingBookings + counts.unpaidStays,
                )}
              </Link>
            </li>
            <li><Link to="/admin/customers">Khách hàng</Link></li>
            <li>
              <Link to="/admin/services">
                {withBadge(
                  'Quản lý dịch vụ',
                  counts.pendingServiceRequests,
                )}
              </Link>
            </li>
            <li><Link to="/admin/vouchers">Voucher</Link></li>
            <li><Link to="/admin/reviews">Đánh giá</Link></li>
            <li><Link to="/admin/invoices">Quản lý hóa đơn</Link></li>
            <li>
              <Link to="/admin/payments">
                {withBadge(
                  'Thanh toán',
                  counts.pendingRefunds + counts.pendingWithdrawals + counts.pendingTransferConfirmations,
                )}
              </Link>
            </li>
            <li><Link to="/admin/payment-settings">Cài đặt thanh toán</Link></li>
            <li><Link to="/admin/reports">Báo cáo</Link></li>
          </ul>
        </nav>
        <div className="admin-user">
          <p>Xin chào, {user?.email}</p>
          <button className="btn-logout" onClick={handleLogout}>Đăng xuất</button>
        </div>
      </aside>
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;

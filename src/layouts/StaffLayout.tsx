import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Badge, Tooltip } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './StaffLayout.css';

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

const POLL_INTERVAL_MS = 8000;

function StaffLayout() {
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
      }
    };

    loadCounts();
    const timer = window.setInterval(loadCounts, POLL_INTERVAL_MS);
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
    <div className="staff-layout">
      <aside className="staff-sidebar">
        <div className="staff-logo">
          <h2>
            HotelHub Staff
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
        <nav className="staff-nav">
          <ul>
            <li><Link to="/staff">Dashboard</Link></li>
            <li><Link to="/staff/rooms">Quản lý phòng</Link></li>
            <li>
              <Link to="/staff/bookings">
                {withBadge(
                  'Đặt phòng',
                  counts.pendingBookings + counts.unpaidStays,
                )}
              </Link>
            </li>
            <li><Link to="/staff/customers">Khách hàng</Link></li>
            <li>
              <Link to="/staff/services">
                {withBadge(
                  'Quản lý dịch vụ',
                  counts.pendingServiceRequests
                )}
              </Link>
            </li>
            <li><Link to="/staff/invoices">Quản lý hóa đơn</Link></li>
            <li>
              <Link to="/staff/payments">
                {withBadge(
                  'Thanh toán',
                  counts.pendingRefunds + counts.pendingWithdrawals + counts.pendingTransferConfirmations,
                )}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="staff-user">
          <p>Xin chào, {user?.email}</p>
          <button className="staff-btn-logout" onClick={handleLogout}>Đăng xuất</button>
        </div>
      </aside>
      <main className="staff-content">
        <Outlet />
      </main>
    </div>
  );
}

export default StaffLayout;

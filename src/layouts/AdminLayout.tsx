import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './AdminLayout.css';

function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <h2>HotelHub Admin</h2>
        </div>
        <nav className="admin-nav">
          <ul>
            <li><Link to="/admin">Dashboard</Link></li>
            <li><Link to="/admin/rooms">Quản lý phòng</Link></li>
            <li><Link to="/admin/room-types">Loại phòng</Link></li>
            <li><Link to="/admin/bookings">Đặt phòng</Link></li>
            <li><Link to="/admin/customers">Khách hàng</Link></li>
            <li><Link to="/admin/employees">Nhân viên</Link></li>
            <li><Link to="/admin/services">Quản lý dịch vụ</Link></li>
            <li><Link to="/admin/vouchers">Voucher</Link></li>
            <li><Link to="/admin/reviews">Đánh giá</Link></li>
            <li><Link to="/admin/payments">Thanh toán</Link></li>
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
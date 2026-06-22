import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './EmployeeLayout.css';

function EmployeeLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="employee-layout">
      <aside className="employee-sidebar">
        <div className="employee-logo">
          <h2>HotelHub</h2>
        </div>
        <nav className="employee-nav">
          <ul>
            <li><Link to="/employee">Dashboard</Link></li>
            <li><Link to="/employee/booking-calendar">Lịch đặt phòng</Link></li>
            <li><Link to="/employee/receive-booking">Tiếp nhận đặt phòng</Link></li>
            <li><Link to="/employee/room-status">Tình trạng phòng</Link></li>
            <li><Link to="/employee/customers">Khách hàng</Link></li>
            <li><Link to="/employee/checkin-checkout">Check-in / Check-out</Link></li>
            <li><Link to="/employee/payment">Thanh toán</Link></li>
            <li><Link to="/employee/customer-service">Dịch vụ khách hàng</Link></li>
            <li><Link to="/employee/room-requests">Yêu cầu phòng</Link></li>
            <li><Link to="/employee/reviews">Đánh giá</Link></li>
          </ul>
        </nav>
        <div className="employee-user">
          <p>Xin chào, {user?.fullName}</p>
          <button className="employee-btn-logout" onClick={handleLogout}>Đăng xuất</button>
        </div>
      </aside>
      <main className="employee-content">
        <Outlet />
      </main>
    </div>
  );
}

export default EmployeeLayout;

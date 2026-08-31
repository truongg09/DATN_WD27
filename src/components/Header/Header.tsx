import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPhone, 
  faEnvelope,
  faUser,
  faBars,
  faTimes
} from '@fortawesome/free-solid-svg-icons';
import { 
  faFacebook, 
  faTwitter, 
  faInstagram 
} from '@fortawesome/free-brands-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { CustomerNotificationBell } from './CustomerNotificationBell';
import './header.css';

const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="header">
      <div className="header-top">
        <div className="container">
          <div className="contact-info">
            <span><FontAwesomeIcon icon={faPhone} /> +84 123 456 789</span>
            <span><FontAwesomeIcon icon={faEnvelope} /> info@hotelhub.com</span>
          </div>
          <div className="social-links">
            <a href="#"><FontAwesomeIcon icon={faFacebook} /></a>
            <a href="#"><FontAwesomeIcon icon={faTwitter} /></a>
            <a href="#"><FontAwesomeIcon icon={faInstagram} /></a>
          </div>
        </div>
      </div>

      <div className="header-main">
        <div className="container">
          <div className="logo">
            <Link to="/" style={{ textDecoration: 'none' }}>
              <h2>HotelHub</h2>
            </Link>
          </div>

          <button
            className="hamburger-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <FontAwesomeIcon icon={menuOpen ? faTimes : faBars} />
          </button>

          <nav className={`nav-menu${menuOpen ? ' open' : ''}`}>
            <ul>
              <li><Link to="/" onClick={closeMenu}>Trang chủ</Link></li>
              <li><Link to="/rooms" onClick={closeMenu}>Phòng</Link></li>
              <li><Link to="/booking" onClick={closeMenu}>Đặt phòng</Link></li>
              <li><Link to="/contact" onClick={closeMenu}>Liên hệ</Link></li>
              {isAuthenticated && user?.role === "admin" && (
                <li><Link to="/admin" onClick={closeMenu}>Trang quản lý</Link></li>
              )}
              {(isAuthenticated && (user?.role === 'staff' || user?.role === 'employee')) && (
                <li><Link to="/staff" onClick={closeMenu}>Trang quản lý</Link></li>
              )}
            </ul>
          </nav>

          <div className={`auth-buttons${menuOpen ? ' open' : ''}`}>
            {isAuthenticated && user ? (
              <div className="user-info">
                {user.role === 'customer' && <CustomerNotificationBell />}
                {user.role === 'customer' ? (
                  <Link to="/profile" style={{ textDecoration: 'none' }} onClick={closeMenu}>
                    <span className="user-greeting is-link">
                      <FontAwesomeIcon icon={faUser} />
                      <span>{user.email}</span>
                    </span>
                  </Link>
                ) : (
                  <span className="user-greeting">
                    <FontAwesomeIcon icon={faUser} />
                    <span>{user.email}</span>
                  </span>
                )}
                <button className="btn-logout" onClick={handleLogout}>Đăng xuất</button>
              </div>
            ) : (
              <>
                <Link to="/register" onClick={closeMenu}>
                  <button className="btn-register">Đăng ký</button>
                </Link>
                <Link to="/login" onClick={closeMenu}>
                  <button className="btn-login">Đăng nhập</button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
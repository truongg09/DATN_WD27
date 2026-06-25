import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPhone, 
  faEnvelope,
  faUser
} from '@fortawesome/free-solid-svg-icons';
import { 
  faFacebook, 
  faTwitter, 
  faInstagram 
} from '@fortawesome/free-brands-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import './header.css';

const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  
  console.log('Header - user:', user);
  console.log('Header - isAuthenticated:', isAuthenticated);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

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
          <nav className="nav-menu">
            <ul>
              <li><Link to="/">Trang chủ</Link></li>
              <li><Link to="/rooms">Phòng</Link></li>
              <li><Link to="/booking">Đặt phòng</Link></li>
              <li><Link to="/contact">Liên hệ</Link></li>
              {isAuthenticated && user?.role === "admin" && (
                <li><Link to="/admin">Admin</Link></li>
              )}
            </ul>
          </nav>
          <div className="auth-buttons">
            {isAuthenticated && user ? (
              <div className="user-info">
                <span className="user-greeting">
                  <FontAwesomeIcon icon={faUser} />
                  <span>{user.fullName}</span>
                </span>
                <button className="btn-logout" onClick={handleLogout}>Đăng xuất</button>
              </div>
            ) : (
              <>
                <Link to="/register">
                  <button className="btn-register">Đăng ký</button>
                </Link>
                <Link to="/login">
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

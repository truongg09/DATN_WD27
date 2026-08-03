import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMapMarkerAlt, 
  faPhone, 
  faEnvelope 
} from '@fortawesome/free-solid-svg-icons';
import { 
  faFacebook, 
  faTwitter, 
  faInstagram, 
  faYoutube 
} from '@fortawesome/free-brands-svg-icons';
import './footer.css';

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <h3>HotelHub</h3>
            <p>Khách sạn cao cấp với dịch vụ hoàn hảo, mang đến trải nghiệm nghỉ dưỡng đáng nhớ cho mỗi khách hàng.</p>
            <div className="social-links">
              <a href="#"><FontAwesomeIcon icon={faFacebook} /></a>
              <a href="#"><FontAwesomeIcon icon={faTwitter} /></a>
              <a href="#"><FontAwesomeIcon icon={faInstagram} /></a>
              <a href="#"><FontAwesomeIcon icon={faYoutube} /></a>
            </div>
          </div>
          <div className="footer-col">
            <h4>Đường dẫn nhanh</h4>
            <ul>
              <li><Link to="/">Trang chủ</Link></li>
              <li><Link to="/rooms">Phòng</Link></li>
              <li><Link to="/booking">Đặt phòng</Link></li>
              <li><Link to="/contact">Liên hệ</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Dịch vụ</h4>
            <ul>
              <li><Link to="/booking">Đặt phòng</Link></li>
              <li><a href="#">Spa & Massage</a></li>
              <li><a href="#">Nhà hàng</a></li>
              <li><a href="#">Hội nghị</a></li>
              <li><a href="#">Tiệc cưới</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Liên hệ</h4>
            <ul className="contact-list">
              <li><FontAwesomeIcon icon={faMapMarkerAlt} /> 123 Đường ABC, Quận 1, TP.HCM</li>
              <li><FontAwesomeIcon icon={faPhone} /> +84 123 456 789</li>
              <li><FontAwesomeIcon icon={faEnvelope} /> info@hotelhub.com</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 HotelHub. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

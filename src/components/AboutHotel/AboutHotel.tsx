import React from 'react';
import { Link } from 'react-router-dom';
import './abouthotel.css';

const AboutHotel: React.FC = () => {
  return (
    <div className="about-hotel">
      <div className="container">
        <div className="about-content">
          <div className="about-text">
            <span className="subtitle">Về chúng tôi</span>
            <h2>Khách sạn cao cấp với dịch vụ hoàn hảo</h2>
            <p>Moonlit Hotel tự hào mang đến trải nghiệm nghỉ dưỡng đẳng cấp với phòng khách sang trọng, dịch vụ chuyên nghiệp và tiện ích hiện đại. Chúng tôi cam kết làm cho mỗi kỳ nghỉ của bạn trở nên đáng nhớ.</p>
            <p>Với vị trí đắc địa, khách sạn của chúng tôi là điểm khởi đầu hoàn hảo để bạn khám phá vẻ đẹp của thành phố.</p>
            <Link to="/about">
              <button className="btn-about">Tìm hiểu thêm</button>
            </Link>
          </div>
          <div className="about-images">
            <Link to="/about" className="img-main">
              <img src="https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800" alt="Hotel Resort" />
            </Link>
            <Link to="/about" className="img-secondary">
              <img src="https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=500" alt="Hotel Room" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutHotel;

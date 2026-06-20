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
            <Link to="/">
              <button className="btn-about">Tìm hiểu thêm</button>
            </Link>
          </div>
          <div className="about-images">
            <div className="img-main">
              <img src="https://images.unsplash.com/photo-1561501900-3701fa6a0864?w=600" alt="Hotel" />
            </div>
            <div className="img-secondary">
              <img src="https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400" alt="Room" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutHotel;

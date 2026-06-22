import React from 'react';
import { Link } from 'react-router-dom';
import './herobanner.css';

const HeroBanner: React.FC = () => {
  return (
    <div className="hero-banner">
      <div className="hero-content">
        <h1>Chào mừng đến với HotelHub</h1>
        <p>Trải nghiệm sự sang trọng và thoải mái tại khách sạn của chúng tôi</p>
        <Link to="/rooms">
          <button className="btn-explore">Khám phá ngay</button>
        </Link>
      </div>
    </div>
  );
};

export default HeroBanner;

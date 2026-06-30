import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSwimmingPool,
  faSpa,
  faUtensils,
  faDumbbell,
  faWifi,
  faCar,
  faPlaneArrival,
  faSyncAlt
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { getAmenities } from '../../services/amenityService';
import type { Amenity } from '../../services/amenityService';
import './amenities.css';

const iconMap: Record<string, IconDefinition> = {
  faSwimmingPool,
  faSpa,
  faUtensils,
  faDumbbell,
  faWifi,
  faCar,
  faPlaneArrival,
  faSyncAlt,
  faTv,
  faSnowflake,
  faGlassWhiskey,
  faBath,
  faImage
};

const Amenities: React.FC = () => {
  const amenities = [
    { icon: faSwimmingPool, title: 'Hồ bơi', desc: 'Hồ bơi ngoài trời với tầm nhìn đẹp' },
    { icon: faSpa, title: 'Spa & Massage', desc: 'Thư giãn với các liệu trình chuyên nghiệp' },
    { icon: faUtensils, title: 'Nhà hàng', desc: 'Ẩm thực đa dạng và chất lượng' },
    { icon: faDumbbell, title: 'Phòng Gym', desc: 'Trang thiết bị hiện đại 24/7' },
    { icon: faWifi, title: 'Wifi miễn phí', desc: 'Kết nối tốc độ cao khắp mọi nơi' },
    { icon: faCar, title: 'Đậu xe', desc: 'Bãi đậu xe rộng rãi, an toàn' },
    { icon: faSyncAlt, title: 'Giặt sấy siêu tốc', desc: 'Dịch vụ giặt ủi nhanh chóng trong 2 giờ' },
    { icon: faPlaneArrival, title: 'Đưa đón sân bay', desc: 'Xe đưa đón tiện lợi 24/7' }
  ];

  return (
    <div className="amenities">
      <div className="container">
        <div className="section-title">
          <span className="subtitle">Tiện ích</span>
          <h2>Dịch vụ cao cấp</h2>
        </div>
        <div className="amenities-grid">
          {amenities.map((amenity) => (
            <div key={amenity.id} className="amenity-item">
              <FontAwesomeIcon icon={iconMap[amenity.icon] || faWifi} />
              <h3>{amenity.name}</h3>
              <p>{amenity.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Amenities;

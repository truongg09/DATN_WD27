import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBed, 
  faBath, 
  faExpandArrowsAlt 
} from '@fortawesome/free-solid-svg-icons';
import './featuredrooms.css';

import { roomsData } from '../../utils/mockRoomsData';

const FeaturedRooms: React.FC = () => {
  const featuredRooms = roomsData.filter(room => [3, 5, 7].includes(room.id));

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + '₫';
  };


  return (
    <div className="featured-rooms">
      <div className="container">
        <div className="section-title">
          <span className="subtitle">Phòng</span>
          <h2>Phòng nổi bật</h2>
        </div>
        <div className="rooms-grid">
          {featuredRooms.map(room => (
            <div key={room.id} className="room-card">
              <div className="room-img">
                <Link to={`/rooms/${room.id}`}>
                  <img src={room.image} alt={room.name} />
                </Link>
              </div>
              <div className="room-info">
                <Link to={`/rooms/${room.id}`}>
                  <h3>{room.name}</h3>
                </Link>
                <div className="room-features">
                  <span><FontAwesomeIcon icon={faBed} /> {room.beds}</span>
                  <span><FontAwesomeIcon icon={faBath} /> {room.baths}</span>
                  <span><FontAwesomeIcon icon={faExpandArrowsAlt} /> {room.area}</span>
                </div>
                <div className="room-footer">
                  <span className="price">{formatPrice(room.price)}<small>/đêm</small></span>
                  <Link to={`/booking?id=${room.id}`}>
                    <button className="btn-book-room">Đặt phòng</button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeaturedRooms;

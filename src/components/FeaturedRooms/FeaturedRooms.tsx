import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBed, 
  faBath, 
  faExpandArrowsAlt 
} from '@fortawesome/free-solid-svg-icons';
import './featuredrooms.css';

const FeaturedRooms: React.FC = () => {
  const rooms = [
    {
      id: 1,
      name: 'Phòng Deluxe',
      image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=500',
      beds: '2 giường',
      baths: '1 phòng tắm',
      area: '40m²',
      price: '1.200.000₫'
    },
    {
      id: 2,
      name: 'Phòng Suite',
      image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500',
      beds: '1 giường king',
      baths: '2 phòng tắm',
      area: '60m²',
      price: '2.500.000₫'
    },
    {
      id: 3,
      name: 'Presidential Suite',
      image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500',
      beds: '2 giường king',
      baths: '3 phòng tắm',
      area: '100m²',
      price: '5.000.000₫'
    }
  ];

  return (
    <div className="featured-rooms">
      <div className="container">
        <div className="section-title">
          <span className="subtitle">Phòng</span>
          <h2>Phòng nổi bật</h2>
        </div>
        <div className="rooms-grid">
          {rooms.map(room => (
            <div key={room.id} className="room-card">
              <div className="room-img">
                <img src={room.image} alt={room.name} />
              </div>
              <div className="room-info">
                <h3>{room.name}</h3>
                <div className="room-features">
                  <span><FontAwesomeIcon icon={faBed} /> {room.beds}</span>
                  <span><FontAwesomeIcon icon={faBath} /> {room.baths}</span>
                  <span><FontAwesomeIcon icon={faExpandArrowsAlt} /> {room.area}</span>
                </div>
                <div className="room-footer">
                  <span className="price">{room.price}<small>/đêm</small></span>
                  <Link to="/booking">
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

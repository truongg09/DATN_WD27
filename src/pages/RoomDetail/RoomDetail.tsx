import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBed, 
  faBath, 
  faExpandArrowsAlt,
  faCheck,
  faArrowLeft,
  faStar,
  faUser
} from '@fortawesome/free-solid-svg-icons';
import './RoomDetail.css';

import { roomsData } from '../../utils/mockRoomsData';

const RoomDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(0);

  const roomData = roomsData.find(room => room.id === Number(id));

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + '₫';
  };

  if (!roomData) {
    return (
      <div className="room-detail-page" style={{ padding: '120px 20px', textAlign: 'center' }}>
        <div className="room-detail-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '32px', color: '#333', marginBottom: '16px' }}>Không tìm thấy phòng nghỉ!</h2>
          <p style={{ margin: '20px 0 30px', color: '#666', fontSize: '16px' }}>
            Phòng nghỉ quý khách yêu cầu không tồn tại hoặc hệ thống đang cập nhật. Vui lòng quay lại danh sách để chọn phòng khác.
          </p>
          <Link to="/rooms" className="back-link" style={{ justifyContent: 'center', display: 'inline-flex', gap: '8px', color: '#ab8965', fontWeight: '600' }}>
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Quay lại danh sách phòng</span>
          </Link>
        </div>
      </div>
    );
  }


  const handleBooking = () => {
    navigate(`/booking?id=${id}`);
  };

  return (
    <div className="room-detail-page">
      <div className="room-detail-container">
        <div className="breadcrumb">
          <Link to="/rooms" className="back-link">
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Quay lại danh sách phòng</span>
          </Link>
        </div>

        <div className="room-detail-main">
          <div className="room-gallery">
            <div className="main-image">
              <img src={roomData.images[selectedImage]} alt={roomData.name} />
            </div>
            <div className="thumbnail-images">
              {roomData.images.map((img, index) => (
                <div 
                  key={index} 
                  className={`thumbnail ${selectedImage === index ? 'active' : ''}`}
                  onClick={() => setSelectedImage(index)}
                >
                  <img src={img} alt={`${roomData.name} ${index + 1}`} />
                </div>
              ))}
            </div>
          </div>

          <div className="room-info-section">
            <div className="room-header">
              <span className="room-type-tag">{roomData.type}</span>
              <div className="room-rating">
                <FontAwesomeIcon icon={faStar} className="star-icon" />
                <span>{roomData.rating}</span>
                <span className="review-count">({roomData.reviews} đánh giá)</span>
              </div>
            </div>
            <h1>{roomData.name}</h1>
            
            <div className="room-specs">
              <div className="spec-item">
                <FontAwesomeIcon icon={faBed} />
                <span>{roomData.beds}</span>
              </div>
              <div className="spec-item">
                <FontAwesomeIcon icon={faBath} />
                <span>{roomData.baths}</span>
              </div>
              <div className="spec-item">
                <FontAwesomeIcon icon={faExpandArrowsAlt} />
                <span>{roomData.area}</span>
              </div>
              <div className="spec-item">
                <FontAwesomeIcon icon={faUser} />
                <span>Tối đa {roomData.maxGuests} người</span>
              </div>
            </div>

            <div className="room-price-detail">
              <div className="price-row">
                <span className="current-price">{formatPrice(roomData.price)}</span>
                <span className="price-unit">/ đêm</span>
                {roomData.originalPrice && (
                  <span className="original-price">{formatPrice(roomData.originalPrice)}</span>
                )}
              </div>
            </div>

            <button className="btn-book-room" onClick={handleBooking}>
              Đặt phòng ngay
            </button>

            <div className="amenities-quick">
              <h3>Tiện nghi nổi bật</h3>
              <div className="amenities-grid">
                {roomData.amenities.slice(0, 6).map((amenity, index) => (
                  <div key={index} className="amenity-item">
                    <FontAwesomeIcon icon={faCheck} />
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="room-description-section">
          <h2>Mô tả phòng</h2>
          <p>{roomData.description}</p>
        </div>

        <div className="room-amenities-section">
          <h2>Tiện nghi đầy đủ</h2>
          <div className="amenities-full-list">
            {roomData.amenities.map((amenity, index) => (
              <div key={index} className="amenity-full-item">
                <FontAwesomeIcon icon={faCheck} />
                <span>{amenity}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="similar-rooms">
          <h2>Phòng liên quan</h2>
          <div className="similar-rooms-grid">
            <div className="similar-room-card">
              <img src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400" alt="Phòng Suite" />
              <div className="similar-room-info">
                <h4>Phòng Suite</h4>
                <span className="similar-price">2.500.000₫</span>
              </div>
            </div>
            <div className="similar-room-card">
              <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400" alt="Presidential Suite" />
              <div className="similar-room-info">
                <h4>Presidential Suite</h4>
                <span className="similar-price">5.000.000₫</span>
              </div>
            </div>
            <div className="similar-room-card">
              <img src="https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=400" alt="Phòng Family" />
              <div className="similar-room-info">
                <h4>Phòng Family</h4>
                <span className="similar-price">2.100.000₫</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomDetail;

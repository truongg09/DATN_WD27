import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserGroup,
  faExpandArrowsAlt,
  faStar
} from '@fortawesome/free-solid-svg-icons';
import './featuredrooms.css';
import { searchRoomTypes } from '../../services/roomService';
import type { RoomTypeSearchResult } from '../../services/roomService';
import { unwrapList } from '../../utils/unwrapList';
import { getRoomTypeCardImage, handleRoomImageError } from '../../utils/roomTypeImages';

const FeaturedRooms: React.FC = () => {
  const [roomTypes, setRoomTypes] = useState<RoomTypeSearchResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchRoomTypes = async () => {
      try {
        const response = await searchRoomTypes();
        const list = unwrapList<RoomTypeSearchResult>(response);
        // Nổi bật = 3 hạng phòng cao cấp nhất còn phòng hoạt động
        const featured = list
          .filter((type) => type.totalRooms > 0)
          .sort((a, b) => b.defaultPrice - a.defaultPrice)
          .slice(0, 3)
          .reverse();
        setRoomTypes(featured);
      } catch (error) {
        console.error('Error loading featured room types:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRoomTypes();
  }, []);

  const formatPrice = (price: number | string) => {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(price || 0)) + 'đ';
  };

  const formatArea = (type: RoomTypeSearchResult) => {
    if (type.minArea === null) return null;
    return type.minArea === type.maxArea ? `${type.minArea}m²` : `${type.minArea}–${type.maxArea}m²`;
  };

  if (loading) {
    return (
      <div className="featured-rooms" style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="featured-rooms">
      <div className="container">
        <div className="section-title">
          <span className="subtitle">Phòng</span>
          <h2>Hạng phòng nổi bật</h2>
        </div>
        <div className="rooms-grid">
          {roomTypes.map((type) => (
            <div key={type.id} className="room-card">
              <div className="room-img">
                <Link to={`/room-types/${type.id}`}>
                  <img
                    src={getRoomTypeCardImage(type.typeName, type.images)}
                    alt={`Phòng ${type.typeName}`}
                    onError={(e) => handleRoomImageError(e, type.typeName)}
                  />
                </Link>
              </div>
              <div className="room-info">
                <Link to={`/room-types/${type.id}`}>
                  <h3>Phòng {type.typeName}</h3>
                </Link>
                <div className="room-features">
                  <span><FontAwesomeIcon icon={faUserGroup} /> Tối đa {type.maxOccupancy ?? type.capacity} khách</span>
                  {formatArea(type) && (
                    <span><FontAwesomeIcon icon={faExpandArrowsAlt} /> {formatArea(type)}</span>
                  )}
                  {type.avgRating !== null && (
                    <span><FontAwesomeIcon icon={faStar} /> {type.avgRating.toFixed(1)}</span>
                  )}
                </div>
                <div className="room-footer">
                  <span className="price">{formatPrice(type.defaultPrice)}<small>/đêm</small></span>
                  <Link to={`/room-types/${type.id}`}>
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

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBed, 
  faBath, 
  faExpandArrowsAlt,
  faFilter
} from '@fortawesome/free-solid-svg-icons';
import './RoomList.css';

import { roomsData } from '../../utils/mockRoomsData';

const RoomList: React.FC = () => {
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('default');

  const rooms = roomsData;


  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + '₫';
  };

  const filteredRooms = rooms.filter(room => {
    if (filterType === 'all') return true;
    return room.type === filterType;
  });

  const sortedRooms = [...filteredRooms].sort((a, b) => {
    if (sortBy === 'price-low') return a.price - b.price;
    if (sortBy === 'price-high') return b.price - a.price;
    return 0;
  });

  return (
    <div className="rooms-page">
      <div className="rooms-hero">
        <div className="rooms-hero-content">
          <h1>Danh sách phòng</h1>
          <p>Chọn phòng phù hợp với nhu cầu của bạn</p>
        </div>
      </div>

      <div className="rooms-container">
        <div className="rooms-filter-bar">
          <div className="filter-group">
            <FontAwesomeIcon icon={faFilter} className="filter-icon" />
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tất cả loại phòng</option>
              <option value="standard">Phòng Standard</option>
              <option value="superior">Phòng Superior</option>
              <option value="deluxe">Phòng Deluxe</option>
              <option value="suite">Phòng Suite</option>
              <option value="family">Phòng Family</option>
              <option value="bungalow">Bungalow Hướng Biển</option>
              <option value="presidential">Presidential Suite</option>
            </select>
          </div>

          <div className="sort-group">
            <span className="sort-label">Sắp xếp:</span>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="default">Mặc định</option>
              <option value="price-low">Giá: Thấp đến cao</option>
              <option value="price-high">Giá: Cao đến thấp</option>
            </select>
          </div>
        </div>

        <div className="rooms-count">
          <p>Có {sortedRooms.length} phòng trống</p>
        </div>

        <div className="rooms-grid-list">
          {sortedRooms.map(room => (
            <div key={room.id} className="room-list-card">
              <div className="room-list-image">
                <img src={room.image} alt={room.name} />
                {room.originalPrice && (
                  <span className="discount-badge">Giảm giá</span>
                )}
              </div>
              <div className="room-list-info">
                <div className="room-type-badge">{room.type}</div>
                <h3>{room.name}</h3>
                <div className="room-features-list">
                  <span><FontAwesomeIcon icon={faBed} /> {room.beds}</span>
                  <span><FontAwesomeIcon icon={faBath} /> {room.baths}</span>
                  <span><FontAwesomeIcon icon={faExpandArrowsAlt} /> {room.area}</span>
                </div>
                <div className="room-description">
                  <p>
                    {room.type === 'presidential' && 'Phòng sang trọng nhất với đầy đủ tiện nghi, view tuyệt đẹp và dịch vụ VIP.'}
                    {room.type === 'suite' && 'Phòng rộng rãi với không gian riêng tư, phòng khách và tầm nhìn panorama.'}
                    {room.type === 'deluxe' && 'Phòng cao cấp với thiết kế hiện đại, đầy đủ tiện nghi cho kỳ nghỉ hoàn hảo.'}
                    {room.type === 'family' && 'Phòng lý tưởng cho gia đình với không gian rộng rãi và giường phụ nếu cần.'}
                    {room.type === 'superior' && 'Phòng tiện nghi với tầm nhìn đẹp, phù hợp cho cặp đôi hoặc du khách đơn.'}
                    {room.type === 'standard' && 'Phòng cơ bản đầy đủ tiện nghi, lựa chọn tiết kiệm cho du khách.'}
                  </p>
                </div>
                <div className="room-list-footer">
                  <div className="room-price-section">
                    <span className="room-price">{formatPrice(room.price)}</span>
                    <span className="room-price-unit">/đêm</span>
                    {room.originalPrice && (
                      <span className="room-original-price">
                        {formatPrice(room.originalPrice)}
                      </span>
                    )}
                  </div>
                  <div className="room-actions">
                    <Link to={`/rooms/${room.id}`}>
                      <button className="btn-detail">Xem chi tiết</button>
                    </Link>
                    <Link to={`/booking?id=${room.id}`}>
                      <button className="btn-book">Đặt phòng</button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoomList;

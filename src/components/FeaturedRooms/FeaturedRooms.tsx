import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBed, 
  faBath, 
  faExpandArrowsAlt 
} from '@fortawesome/free-solid-svg-icons';
import './featuredrooms.css';
import { getRooms } from '../../services/roomService';
import { unwrapList } from '../../utils/unwrapList';

interface RoomFromDB {
  id: number;
  roomNumber: string;
  room_type_name: string;
  room_type_description?: string;
  price_per_night: number | string;
  capacity: number;
  area: number;
  status: string;
}

const FeaturedRooms: React.FC = () => {
  const [rooms, setRooms] = useState<RoomFromDB[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await getRooms();
        const roomList = unwrapList<RoomFromDB>(response);
        
        // Chọn các phòng nổi bật thực tế từ database:
        // ID 9: Phòng Deluxe (301)
        // ID 17: Phòng Suite (501)
        // ID 13: Phòng Family (401)
        const selectedIds = [9, 13, 17];
        const filtered = roomList.filter(r => selectedIds.includes(r.id));
        
        // Sắp xếp theo thứ tự Deluxe -> Family -> Suite để đẹp mắt
        filtered.sort((a, b) => selectedIds.indexOf(a.id) - selectedIds.indexOf(b.id));
        setRooms(filtered);
      } catch (error) {
        console.error('Error loading featured rooms:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, []);

  const formatPrice = (price: number | string) => {
    return new Intl.NumberFormat('vi-VN').format(Number(price || 0)) + 'đ';
  };

  const getRoomImage = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('standard') || lowerType.includes('superior')) {
      return new URL('../../assets/rooms/standard/standard1.jpg', import.meta.url).href;
    }
    if (lowerType.includes('deluxe')) {
      return new URL('../../assets/rooms/deluxe/deluxe1.jpg', import.meta.url).href;
    }
    if (lowerType.includes('family')) {
      return new URL('../../assets/rooms/family/family1.jpg', import.meta.url).href;
    }
    return new URL('../../assets/rooms/luxury/luxury1.jpg', import.meta.url).href;
  };

  const getBedsInfo = (type: string) => {
    const lower = type.toLowerCase();
    if (lower.includes('standard')) return '1 giường đơn';
    if (lower.includes('superior')) return '1 giường đôi';
    if (lower.includes('deluxe')) return '2 giường đơn';
    if (lower.includes('family')) return '2 giường đôi';
    if (lower.includes('suite')) return '1 giường king';
    return '2 giường đôi lớn';
  };

  const getBathsInfo = (type: string) => {
    const lower = type.toLowerCase();
    if (lower.includes('suite') || lower.includes('family')) return '2 phòng tắm';
    return '1 phòng tắm';
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
          <h2>Phòng nổi bật</h2>
        </div>
        <div className="rooms-grid">
          {rooms.map(room => (
            <div key={room.id} className="room-card">
              <div className="room-img">
                <Link to={`/rooms/${room.id}`}>
                  <img src={getRoomImage(room.room_type_name)} alt={`Phòng ${room.roomNumber}`} />
                </Link>
              </div>
              <div className="room-info">
                <Link to={`/rooms/${room.id}`}>
                  <h3>Phòng {room.room_type_name} ({room.roomNumber})</h3>
                </Link>
                <div className="room-features">
                  <span><FontAwesomeIcon icon={faBed} /> {getBedsInfo(room.room_type_name)}</span>
                  <span><FontAwesomeIcon icon={faBath} /> {getBathsInfo(room.room_type_name)}</span>
                  <span><FontAwesomeIcon icon={faExpandArrowsAlt} /> {room.area}m²</span>
                </div>
                <div className="room-footer">
                  <span className="price">{formatPrice(room.price_per_night)}<small>/đêm</small></span>
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

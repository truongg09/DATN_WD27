import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBed, 
  faBath, 
  faExpandArrowsAlt,
  faFilter,
  faSearch
} from '@fortawesome/free-solid-svg-icons';
import { getRooms } from '../../services/roomService';
import './RoomList.css';

interface RoomFromDB {
  id: number;
  roomNumber: string;
  floor: number;
  area: string | number;
  status: string;
  roomTypeId: number;
  room_type_name: string;
  room_type_description: string;
  capacity: number;
  price_per_night: string | number;
  imageUrl?: string;
}

const RoomList: React.FC = () => {
  const [rooms, setRooms] = useState<RoomFromDB[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('default');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoading(true);
        const response = await getRooms();
        if (response && response.data) {
          setRooms(response.data);
        } else if (Array.isArray(response)) {
          setRooms(response);
        }
        setError(null);
      } catch (err) {
        console.error('Lỗi khi tải danh sách phòng:', err);
        setError('Không thể tải danh sách phòng. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + '₫';
  };

  const getRoomImage = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('standard')) {
      return 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600';
    }
    if (lowerType.includes('superior')) {
      return 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600';
    }
    if (lowerType.includes('deluxe')) {
      return 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600';
    }
    if (lowerType.includes('family')) {
      return 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=600';
    }
    if (lowerType.includes('suite')) {
      return 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600';
    }
    return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600';
  };

  const filteredRooms = rooms.filter(room => {
    const matchesType = filterType === 'all' || room.room_type_name.toLowerCase().includes(filterType.toLowerCase());
    
    const roomName = `Phòng ${room.roomNumber}`.toLowerCase();
    const roomTypeNameWithPrefix = `Phòng ${room.room_type_name}`.toLowerCase();
    const floorStr = `Tầng ${room.floor}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    
    const matchesSearch = searchQuery === '' || 
      room.roomNumber.toLowerCase().includes(query) ||
      room.room_type_name.toLowerCase().includes(query) ||
      roomName.includes(query) ||
      roomTypeNameWithPrefix.includes(query) ||
      room.floor.toString() === query ||
      floorStr.includes(query);
      
    return matchesType && matchesSearch;
  });

  const sortedRooms = [...filteredRooms].sort((a, b) => {
    const priceA = parseFloat(a.price_per_night as string) || 0;
    const priceB = parseFloat(b.price_per_night as string) || 0;
    if (sortBy === 'price-low') return priceA - priceB;
    if (sortBy === 'price-high') return priceB - priceA;
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
          <div className="search-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '400px', border: '2px solid #e8e0d5', borderRadius: '10px', padding: '2px 12px', background: '#fff' }}>
            <FontAwesomeIcon icon={faSearch} style={{ color: '#ab8965' }} />
            <input 
              type="text" 
              placeholder="Tìm số phòng hoặc tên phòng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', outline: 'none', width: '100%', padding: '8px 4px', fontSize: '15px', background: 'transparent' }}
            />
          </div>

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

        {loading ? (
          <div className="rooms-loading">
            <div className="spinner"></div>
            <p>Đang tải danh sách phòng...</p>
          </div>
        ) : error ? (
          <div className="rooms-error">
            <p>{error}</p>
          </div>
        ) : (
          <>
            <div className="rooms-count">
              <p>Có {sortedRooms.length} phòng trống</p>
            </div>

            <div className="rooms-grid-list">
              {sortedRooms.map(room => {
                const price = parseFloat(room.price_per_night as string) || 0;
                return (
                  <div key={room.id} className="room-list-card">
                    <div className="room-list-image">
                      <img src={getRoomImage(room.room_type_name)} alt={`Phòng ${room.roomNumber}`} />
                      {room.status !== 'available' && (
                        <span className="status-badge occupied">Hết phòng</span>
                      )}
                    </div>
                    <div className="room-list-info">
                      <div className="room-type-badge">{room.room_type_name}</div>
                      <h3>Phòng {room.roomNumber} (Tầng {room.floor})</h3>
                      <div className="room-features-list">
                        <span><FontAwesomeIcon icon={faBed} /> Tối đa {room.capacity} người</span>
                        <span><FontAwesomeIcon icon={faBath} /> 1 phòng tắm</span>
                        <span><FontAwesomeIcon icon={faExpandArrowsAlt} /> {room.area}m²</span>
                      </div>
                      <div className="room-description">
                        <p>{room.room_type_description || 'Phòng tiện nghi sạch sẽ, dịch vụ chu đáo.'}</p>
                      </div>
                      <div className="room-list-footer">
                        <div className="room-price-section">
                          <span className="room-price">{formatPrice(price)}</span>
                          <span className="room-price-unit">/đêm</span>
                        </div>
                        <div className="room-actions">
                          <Link to={`/rooms/${room.id}`}>
                            <button className="btn-detail">Xem chi tiết</button>
                          </Link>
                          {room.status === 'available' ? (
                            <Link to={`/booking?id=${room.id}`}>
                              <button className="btn-book">Đặt phòng</button>
                            </Link>
                          ) : (
                            <button className="btn-book disabled" disabled>Hết phòng</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RoomList;

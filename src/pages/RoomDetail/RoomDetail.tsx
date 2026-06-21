import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBed, 
  faBath, 
  faExpandArrowsAlt,
  faWifi,
  faSnowflake,
  faTv,
  faCoffee,
  faCheck,
  faArrowLeft,
  faStar,
  faUser
} from '@fortawesome/free-solid-svg-icons';
import { getRoomById } from '../../services/roomService';
import './RoomDetail.css';

interface RoomData {
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
  images: string[];
}

const RoomDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    const fetchRoomDetail = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const response = await getRoomById(Number(id));
        if (response && response.data) {
          const roomObj = response.data;
          
          // Map backend images or use high-quality Unsplash fallbacks
          if (!roomObj.images || roomObj.images.length === 0) {
            const typeName = (roomObj.room_type_name || '').toLowerCase();
            if (typeName.includes('standard')) {
              roomObj.images = [
                'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200',
                'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200'
              ];
            } else if (typeName.includes('superior')) {
              roomObj.images = [
                'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200',
                'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200'
              ];
            } else if (typeName.includes('deluxe')) {
              roomObj.images = [
                'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200',
                'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200'
              ];
            } else if (typeName.includes('family')) {
              roomObj.images = [
                'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=1200',
                'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200'
              ];
            } else {
              roomObj.images = [
                'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200',
                'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200'
              ];
            }
          }
          setRoom(roomObj);
        } else {
          setError('Không tìm thấy thông tin chi tiết phòng.');
        }
      } catch (err) {
        console.error('Lỗi khi tải chi tiết phòng:', err);
        setError('Không thể tải thông tin phòng. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };

    fetchRoomDetail();
  }, [id]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + '₫';
  };

  const handleBooking = () => {
    navigate(`/booking?id=${id}`);
  };

  if (loading) {
    return (
      <div className="room-detail-page">
        <div className="rooms-loading">
          <div className="spinner"></div>
          <p>Đang tải chi tiết phòng...</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="room-detail-page">
        <div className="room-detail-container">
          <div className="breadcrumb">
            <Link to="/rooms" className="back-link">
              <FontAwesomeIcon icon={faArrowLeft} />
              <span>Quay lại danh sách phòng</span>
            </Link>
          </div>
          <div className="rooms-error">
            <p>{error || 'Không tìm thấy thông tin phòng.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const price = parseFloat(room.price_per_night as string) || 0;
  const amenities = ['Wifi miễn phí', 'Điều hòa không khí', 'TV màn hình phẳng', 'Mini bar', 'Két sắt', 'Ấm đun nước', 'Máy sấy tóc'];

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
              <img src={room.images[selectedImage]} alt={`Phòng ${room.roomNumber}`} />
            </div>
            <div className="thumbnail-images">
              {room.images.map((img, index) => (
                <div 
                  key={index} 
                  className={`thumbnail ${selectedImage === index ? 'active' : ''}`}
                  onClick={() => setSelectedImage(index)}
                >
                  <img src={img} alt={`Ảnh ${index + 1}`} />
                </div>
              ))}
            </div>
          </div>

          <div className="room-info-section">
            <div className="room-header">
              <span className="room-type-tag">{room.room_type_name}</span>
              <div className="room-rating">
                <FontAwesomeIcon icon={faStar} className="star-icon" />
                <span>4.8</span>
                <span className="review-count">(96 đánh giá)</span>
              </div>
            </div>
            <h1>Phòng {room.roomNumber} (Tầng {room.floor})</h1>
            
            <div className="room-specs">
              <div className="spec-item">
                <FontAwesomeIcon icon={faBed} />
                <span>Phòng {room.room_type_name}</span>
              </div>
              <div className="spec-item">
                <FontAwesomeIcon icon={faBath} />
                <span>1 phòng tắm</span>
              </div>
              <div className="spec-item">
                <FontAwesomeIcon icon={faExpandArrowsAlt} />
                <span>{room.area}m²</span>
              </div>
              <div className="spec-item">
                <FontAwesomeIcon icon={faUser} />
                <span>Tối đa {room.capacity} người</span>
              </div>
            </div>

            <div className="room-price-detail">
              <div className="price-row">
                <span className="current-price">{formatPrice(price)}</span>
                <span className="price-unit">/ đêm</span>
              </div>
            </div>

            {room.status === 'available' ? (
              <button className="btn-book-room" onClick={handleBooking}>
                Đặt phòng ngay
              </button>
            ) : (
              <button className="btn-book-room disabled" disabled>
                Hết phòng
              </button>
            )}

            <div className="amenities-quick">
              <h3>Tiện nghi nổi bật</h3>
              <div className="amenities-grid">
                {amenities.slice(0, 6).map((amenity, index) => (
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
          <p>{room.room_type_description || 'Phòng nghỉ đầy đủ tiện nghi, được dọn dẹp sạch sẽ hàng ngày, không gian yên tĩnh thích hợp cho nghỉ dưỡng và làm việc.'}</p>
        </div>

        <div className="room-amenities-section">
          <h2>Tiện nghi đầy đủ</h2>
          <div className="amenities-full-list">
            {amenities.map((amenity, index) => (
              <div key={index} className="amenity-full-item">
                <FontAwesomeIcon icon={faCheck} />
                <span>{amenity}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="similar-rooms">
          <h2>Các phòng khác tại tầng {room.floor}</h2>
          <p className="similar-rooms-note">Bạn có thể tham khảo thêm các phòng khác có cùng diện tích và tầng để thuận tiện di chuyển.</p>
        </div>
      </div>
    </div>
  );
};

export default RoomDetail;

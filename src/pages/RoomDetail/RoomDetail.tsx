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
  db_amenities?: { name: string; icon?: string }[];
  db_reviews?: { id: number; rating: number; comment: string; createdAt: string; customerName: string }[];
}

const RoomDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);

  const mapImages = (images: string[], typeName: string): string[] => {
    if (!images || images.length === 0) return getDefaultImages(typeName);
    
    return images.map(img => {
      if (img.startsWith('http://') || img.startsWith('https://')) return img;
      
      const name = img.toLowerCase();
      if (name.includes('standard1')) return 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200';
      if (name.includes('standard2')) return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200';
      if (name.includes('superior1')) return 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200';
      if (name.includes('superior2')) return 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200';
      if (name.includes('deluxe1')) return 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200';
      if (name.includes('deluxe2')) return 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200';
      if (name.includes('family1')) return 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=1200';
      if (name.includes('family2')) return 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200';
      if (name.includes('suite1')) return 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200';
      if (name.includes('suite2')) return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200';
      
      return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200';
    });
  };

  const getDefaultImages = (typeName: string): string[] => {
    const name = typeName.toLowerCase();
    if (name.includes('standard')) {
      return [
        'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200',
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200'
      ];
    }
    if (name.includes('superior')) {
      return [
        'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200'
      ];
    }
    if (name.includes('deluxe')) {
      return [
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200'
      ];
    }
    if (name.includes('family')) {
      return [
        'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=1200',
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200'
      ];
    }
    return [
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200'
    ];
  };

  const getDetailedDescription = (typeName: string, dbDesc: string): string => {
    const name = typeName.toLowerCase();
    let baseDesc = dbDesc || '';
    if (baseDesc.length < 30) {
      if (name.includes('standard')) {
        baseDesc = 'Phòng nghỉ tiêu chuẩn với không gian ấm cúng, thiết kế hiện đại và đầy đủ tiện nghi thiết yếu. Đây là lựa chọn tối ưu và tiết kiệm nhất cho du khách đi công tác hoặc du lịch ngắn ngày.';
      } else if (name.includes('superior')) {
        baseDesc = 'Phòng Superior mang đến không gian rộng rãi hơn, cửa sổ lớn đón ánh sáng tự nhiên và tầm nhìn thoáng đãng. Nội thất được thiết kế tinh tế với khu vực làm việc riêng biệt và các tiện nghi cao cấp.';
      } else if (name.includes('deluxe')) {
        baseDesc = 'Phòng Deluxe sang trọng mang phong cách kiến trúc hiện đại, trang bị giường cỡ King êm ái cùng khu vực ban công riêng ngắm toàn cảnh thành phố. Thích hợp cho các cặp đôi tận hưởng kỳ nghỉ ngọt ngào.';
      } else if (name.includes('family')) {
        baseDesc = 'Thiết kế tối ưu dành riêng cho gia đình hoặc nhóm bạn, phòng Family cung cấp không gian sinh hoạt rộng rãi, hệ thống 2 giường đôi cao cấp và bồn tắm thư giãn riêng biệt sau ngày dài khám phá.';
      } else if (name.includes('suite')) {
        baseDesc = 'Hạng phòng Tổng thống sang trọng bậc nhất với phòng khách riêng biệt, quầy bar mini hiện đại và phòng ngủ hoàng gia. Dịch vụ chăm sóc khách hàng VIP riêng tư mang đến trải nghiệm nghỉ dưỡng hoàn hảo nhất.';
      }
    }
    return baseDesc + ' Trang thiết bị trong phòng bao gồm hệ thống điều hòa độc lập, kết nối internet tốc độ cao không giới hạn, két sắt an toàn, minibar đầy đủ đồ uống và trà/cà phê miễn phí hàng ngày. Phòng tắm được lát đá cẩm thạch sang trọng kèm theo đầy đủ vật dụng vệ sinh cá nhân cao cấp.';
  };

  useEffect(() => {
    const fetchRoomDetail = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const response = await getRoomById(Number(id));
        if (response && response.data) {
          const roomObj = response.data;
          
          // Map backend images or use high-quality Unsplash fallbacks
          roomObj.images = mapImages(roomObj.images, roomObj.room_type_name);
          // Set rich description
          roomObj.room_type_description = getDetailedDescription(roomObj.room_type_name, roomObj.room_type_description);
          
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
    window.scrollTo(0, 0);
  }, [id]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + ' VNĐ';
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
  
  // Use DB amenities or fallback static list
  const amenitiesList = room.db_amenities && room.db_amenities.length > 0 
    ? room.db_amenities.map(a => a.name)
    : ['Wifi miễn phí', 'Điều hòa không khí', 'TV màn hình phẳng', 'Mini bar', 'Két sắt', 'Ấm đun nước', 'Máy sấy tóc'];

  // Calculate average rating from DB reviews or default
  const reviewsList = room.db_reviews || [];
  const averageRating = reviewsList.length > 0
    ? (reviewsList.reduce((acc, curr) => acc + curr.rating, 0) / reviewsList.length).toFixed(1)
    : '4.8';

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
                <span>{averageRating}</span>
                <span className="review-count">({reviewsList.length > 0 ? reviewsList.length : '96'} đánh giá)</span>
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
                {amenitiesList.slice(0, 6).map((amenity, index) => (
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
            {amenitiesList.map((amenity, index) => (
              <div key={index} className="amenity-full-item">
                <FontAwesomeIcon icon={faCheck} />
                <span>{amenity}</span>
              </div>
            ))}
          </div>
        </div>

        {reviewsList.length > 0 && (
          <div className="room-reviews-section" style={{ marginTop: '40px' }}>
            <h2>Đánh giá từ khách hàng ({reviewsList.length})</h2>
            <div className="reviews-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
              {reviewsList.map((rev) => (
                <div key={rev.id} className="review-card" style={{ padding: '20px', border: '1px solid #eee', borderRadius: '8px', background: '#fafafa' }}>
                  <div className="review-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <strong style={{ fontSize: '16px' }}>{rev.customerName}</strong>
                    <span style={{ color: '#888', fontSize: '14px' }}>{new Date(rev.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <div className="review-rating" style={{ color: '#ffc107', marginBottom: '10px' }}>
                    {Array.from({ length: rev.rating }).map((_, i) => (
                      <FontAwesomeIcon key={i} icon={faStar} />
                    ))}
                  </div>
                  <p className="review-comment" style={{ margin: 0, color: '#555', fontStyle: 'italic' }}>"{rev.comment}"</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="similar-rooms">
          <h2>Các phòng khác tại tầng {room.floor}</h2>
          <p className="similar-rooms-note">Bạn có thể tham khảo thêm các phòng khác có cùng diện tích và tầng để thuận tiện di chuyển.</p>
        </div>
      </div>
    </div>
  );
};

export default RoomDetail;

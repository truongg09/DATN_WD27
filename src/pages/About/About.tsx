import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faStar, 
  faQuoteLeft 
} from '@fortawesome/free-solid-svg-icons';
import './About.css';

interface ServiceItem {
  title: string;
  image: string;
  description: string;
}

interface TestimonialItem {
  name: string;
  role: string;
  rating: number;
  comment: string;
  avatar: string;
}

const About: React.FC = () => {
  const services: ServiceItem[] = [
    {
      title: 'Nhà Hàng Ẩm Thực',
      image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600',
      description: 'Khám phá tinh hoa ẩm thực Á - Âu tinh tế được chế biến bởi các đầu bếp đẳng cấp 5 sao trong không gian nhà hàng lãng mạn hướng biển.'
    },
    {
      title: 'Spa & Trị Liệu',
      image: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=600',
      description: 'Phục hồi năng lượng và trẻ hóa cơ thể với các liệu trình massage thảo mộc tự nhiên, bể sục nóng Jacuzzi và xông hơi đá muối Himalaya.'
    },
    {
      title: 'Hồ Bơi Vô Cực',
      image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600',
      description: 'Đắm mình trong làn nước xanh mát của hồ bơi vô cực ngoài trời và chiêm ngưỡng khung cảnh hoàng hôn biển tuyệt mỹ trọn tầm mắt.'
    },
    {
      title: 'Phòng Gym Hiện Đại',
      image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600',
      description: 'Duy trì thói quen tập luyện rèn luyện sức khỏe với hệ thống máy chạy bộ, tạ nâng và các thiết bị cardio tối tân, hiện đại nhất.'
    }
  ];

  const testimonials: TestimonialItem[] = [
    {
      name: 'Nguyễn Văn Minh',
      role: 'Doanh nhân',
      rating: 5,
      comment: 'Kỳ nghỉ tuyệt vời cùng gia đình tại căn Penthouse VIP. Bể bơi riêng trên sân thượng có hướng nhìn ngắm trọn vẹn hoàng hôn biển rất ấn tượng. Quản gia riêng phục vụ chu đáo và vô cùng chuyên nghiệp.',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100'
    },
    {
      name: 'Trần Thị Thu Thủy',
      role: 'Nhà thiết kế thời trang',
      rating: 5,
      comment: 'Phòng Suite tại đây cực kỳ rộng rãi và mang ngôn ngữ thiết kế thanh lịch, trang nhã. Dịch vụ ẩm thực buffet sáng vô cùng phong phú, các món ăn chế biến tại chỗ tươi ngon, nóng sốt.',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100'
    },
    {
      name: 'Lê Hoàng Hải',
      role: 'Nhiếp ảnh gia',
      rating: 5,
      comment: 'Tôi rất ấn tượng với dịch vụ trị liệu Spa tại đây, mọi căng thẳng đều được xua tan nhanh chóng. Không gian Spa yên tĩnh, thoảng hương tinh dầu sả chanh rất thư thái và dễ chịu.',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100'
    }
  ];

  return (
    <div className="about-page">
      {/* About Hero Banner */}
      <div className="about-hero">
        <div className="about-hero-content">
          <h1>Về HotelHub</h1>
          <p>Nơi thiên nhiên giao hòa cùng kiến trúc sang trọng, mang lại những khoảnh khắc nghỉ dưỡng đẳng cấp và đáng nhớ</p>
        </div>
      </div>

      <div className="about-container">
        {/* Detail Overview Section */}
        <div className="about-overview-section">
          <div className="about-overview-text">
            <span className="about-tag">Hành trình của chúng tôi</span>
            <h2>Kiến tạo tiêu chuẩn nghỉ dưỡng mới</h2>
            <p>
              Được thành lập với tầm nhìn định hình lại trải nghiệm nghỉ dưỡng xa hoa, HotelHub là điểm đến hoàn hảo cho những ai tìm kiếm sự yên bình, dịch vụ chu đáo và sự sang trọng tuyệt đối. Mỗi không gian tại đây đều được thiết kế tỉ mỉ, tôn vinh nghệ thuật kiến trúc hiện đại hòa quyện cùng thiên nhiên.
            </p>
            <p>
              Chúng tôi tin rằng lòng hiếu khách chân thành là chìa khóa mở ra những kỳ nghỉ đáng nhớ. Với đội ngũ nhân viên chuyên nghiệp phục vụ bằng cả trái tim, HotelHub cam kết đem đến dịch vụ chất lượng chuẩn quốc tế kết hợp cùng sự ấm áp, thân thiện đặc trưng.
            </p>
            <div className="overview-stats">
              <div className="stat-item">
                <span className="stat-number">10+</span>
                <span className="stat-label">Năm kinh nghiệm</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">150+</span>
                <span className="stat-label">Phòng cao cấp</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">99%</span>
                <span className="stat-label">Khách hàng hài lòng</span>
              </div>
            </div>
          </div>
          <div className="about-overview-image">
            <img src="https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800" alt="Hotel Interior Hallway" />
          </div>
        </div>

        {/* Services Section */}
        <div className="about-services-section">
          <div className="about-section-header">
            <span className="about-tag">Tiện ích đẳng cấp</span>
            <h2>Dịch vụ & Tiện ích tiêu chuẩn 5 sao</h2>
          </div>
          <div className="about-services-grid">
            {services.map((service, index) => (
              <div key={index} className="about-service-card">
                <div className="service-card-img">
                  <img src={service.image} alt={service.title} />
                </div>
                <div className="service-card-info">
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Experiences Section */}
        <div className="about-testimonials-section">
          <div className="about-section-header">
            <span className="about-tag">Đánh giá thực tế</span>
            <h2>Trải nghiệm từ những vị khách quý</h2>
          </div>
          <div className="about-testimonials-grid">
            {testimonials.map((item, index) => (
              <div key={index} className="about-testimonial-card">
                <div className="testimonial-quote">
                  <FontAwesomeIcon icon={faQuoteLeft} />
                </div>
                <p className="testimonial-comment">"{item.comment}"</p>
                <div className="testimonial-user">
                  <img src={item.avatar} alt={item.name} className="testimonial-avatar" />
                  <div className="testimonial-meta">
                    <h4>{item.name}</h4>
                    <span>{item.role}</span>
                  </div>
                  <div className="testimonial-rating">
                    {[...Array(item.rating)].map((_, i) => (
                      <FontAwesomeIcon key={i} icon={faStar} className="star-icon" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Call To Action */}
        <div className="about-cta-card">
          <h2>Bắt đầu kỳ nghỉ dưỡng mơ ước của bạn ngay hôm nay</h2>
          <p>Hãy chọn lựa căn phòng phù hợp nhất và tận hưởng những ưu đãi đặc quyền chỉ có tại HotelHub.</p>
          <div className="about-cta-buttons">
            <Link to="/rooms">
              <button className="btn-cta-primary">Khám phá phòng</button>
            </Link>
            <Link to="/contact">
              <button className="btn-cta-secondary">Liên hệ chúng tôi</button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;

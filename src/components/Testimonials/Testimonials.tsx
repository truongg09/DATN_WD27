import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faStar, 
  faStarHalfAlt 
} from '@fortawesome/free-solid-svg-icons';
import './testimonials.css';

const Testimonials: React.FC = () => {
  const testimonials = [
    {
      id: 1,
      text: 'Trải nghiệm tuyệt vời! Phòng khách sạn rất sạch sẽ và tiện nghi. Đội ngũ nhân viên vô cùng nhiệt tình và chuyên nghiệp.',
      author: 'Nguyễn Văn A',
      location: 'Hà Nội',
      avatar: 'https://i.pravatar.cc/100?img=1',
      stars: 5
    },
    {
      id: 2,
      text: 'Vị trí trung tâm, dễ dàng di chuyển. Ẩm thực tại nhà hàng rất ngon. Tôi sẽ quay lại!',
      author: 'Trần Thị B',
      location: 'TP.HCM',
      avatar: 'https://i.pravatar.cc/100?img=5',
      stars: 5
    },
    {
      id: 3,
      text: 'Hồ bơi và spa tuyệt vời. Đây thật sự là nơi để thư giãn và nạp năng lượng.',
      author: 'Lê Văn C',
      location: 'Đà Nẵng',
      avatar: 'https://i.pravatar.cc/100?img=8',
      stars: 4.5
    }
  ];

  return (
    <div className="testimonials">
      <div className="container">
        <div className="section-title">
          <span className="subtitle">Đánh giá</span>
          <h2>Khách hàng nói gì</h2>
        </div>
        <div className="testimonials-grid">
          {testimonials.map(testimonial => (
            <div key={testimonial.id} className="testimonial-card">
              <div className="stars">
                {[...Array(5)].map((_, i) => (
                  <FontAwesomeIcon 
                    key={i} 
                    icon={i < Math.floor(testimonial.stars) ? faStar : (i < testimonial.stars ? faStarHalfAlt : faStar)} 
                  />
                ))}
              </div>
              <p className="testimonial-text">"{testimonial.text}"</p>
              <div className="testimonial-author">
                <img src={testimonial.avatar} alt={testimonial.author} />
                <div className="author-info">
                  <h4>{testimonial.author}</h4>
                  <span>{testimonial.location}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Testimonials;

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMapMarkerAlt, 
  faPhone, 
  faClock,
  faArrowRight
} from '@fortawesome/free-solid-svg-icons';
import './Contact.css';

interface ContactFormInput {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

const Contact: React.FC = () => {
  const { control, handleSubmit, reset, formState: { errors } } = useForm<ContactFormInput>({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: ''
    }
  });

  const onSubmit = (data: ContactFormInput) => {
    console.log('Contact Form Submitted:', data);
    // Simple response simulation
    alert('Cảm ơn bạn đã liên hệ với HotelHub. Chúng tôi đã tiếp nhận thông tin và sẽ phản hồi sớm nhất có thể!');
    reset();
  };

  return (
    <div className="contact-page">
      {/* Hero Banner Section */}
      <div className="contact-hero">
        <div className="contact-hero-content">
          <h1>Liên hệ</h1>
          <p>Chúng tôi luôn sẵn sàng lắng nghe, tư vấn và hỗ trợ quý khách hàng 24/7</p>
        </div>
      </div>

      <div className="contact-container">
        {/* Info Cards Grid (Bento style) */}
        <div className="contact-info-grid">
          {/* Card 1: Address */}
          <div className="contact-card">
            <div className="contact-card-icon">
              <FontAwesomeIcon icon={faMapMarkerAlt} />
            </div>
            <h3>Địa chỉ khách sạn</h3>
            <p>123 Đường ABC, Quận 1, Thành phố Hồ Chí Minh, Việt Nam</p>
            <a 
              href="https://maps.google.com/?q=123+Đường+ABC,+Quận+1,+TP.HCM" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="contact-card-link"
            >
              Chỉ đường trên Google Maps <FontAwesomeIcon icon={faArrowRight} />
            </a>
          </div>

          {/* Card 2: Contact Methods */}
          <div className="contact-card">
            <div className="contact-card-icon">
              <FontAwesomeIcon icon={faPhone} />
            </div>
            <h3>Liên hệ trực tiếp</h3>
            <p>
              Hotline: +84 123 456 789<br />
              Email: info@hotelhub.com
            </p>
            <a href="tel:+84123456789" className="contact-card-link">
              Gọi hotline ngay <FontAwesomeIcon icon={faArrowRight} />
            </a>
          </div>

          {/* Card 3: Hours */}
          <div className="contact-card">
            <div className="contact-card-icon">
              <FontAwesomeIcon icon={faClock} />
            </div>
            <h3>Giờ hoạt động</h3>
            <p>
              Lễ tân khách sạn: 24/7<br />
              Khu ẩm thực & Spa: 06:00 - 22:00
            </p>
              Mở cửa tất cả các ngày
            </span>
          </div>
        </div>

        {/* Form and Map Grid */}
        <div className="contact-main-grid">
          {/* Map Column */}
          <div className="contact-map-card">
            <h2>Vị trí của chúng tôi</h2>
            <div className="contact-map-container">
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.3202923235375!2d106.69621097499382!3d10.78655558936852!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752f378590e191%3A0xd63b8f75401b076b!2zVHLGsOG7nW5nIMSQ4bqhaSBo4buNYyBHaWEgTmd1eeG7hW4!5e0!3m2!1svi!2s!4v1718822300000!5m2!1svi!2s"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Vị trí khách sạn HotelHub"
              />
            </div>
          </div>

          {/* Form Column */}
          <div className="contact-form-wrapper">
            <h2>Gửi tin nhắn phản hồi</h2>
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Name field */}
              <div className="contact-form-group">
                <label htmlFor="name">Họ và tên *</label>
                <Controller
                  name="name"
                  control={control}
                  rules={{ required: 'Vui lòng nhập họ tên của bạn' }}
                  render={({ field }) => (
                    <input 
                      type="text" 
                      id="name" 
                      placeholder="Nhập họ và tên" 
                      className="contact-input" 
                      {...field} 
                    />
                  )}
                />
                {errors.name && <span className="error-message">{errors.name.message}</span>}
              </div>

              {/* Email and Phone row */}
              <div className="contact-form-row">
                {/* Email field */}
                <div className="contact-form-group">
                  <label htmlFor="email">Email *</label>
                  <Controller
                    name="email"
                    control={control}
                    rules={{ 
                      required: 'Vui lòng nhập email', 
                      pattern: { 
                        value: /^\S+@\S+$/i, 
                        message: 'Email không đúng định dạng' 
                      } 
                    }}
                    render={({ field }) => (
                      <input 
                        type="email" 
                        id="email" 
                        placeholder="example@mail.com" 
                        className="contact-input" 
                        {...field} 
                      />
                    )}
                  />
                  {errors.email && <span className="error-message">{errors.email.message}</span>}
                </div>

                {/* Phone field */}
                <div className="contact-form-group">
                  <label htmlFor="phone">Số điện thoại *</label>
                  <Controller
                    name="phone"
                    control={control}
                    rules={{ 
                      required: 'Vui lòng nhập số điện thoại',
                      pattern: {
                        value: /^[0-9+-\s]*$/i,
                        message: 'Số điện thoại không hợp lệ'
                      }
                    }}
                    render={({ field }) => (
                      <input 
                        type="tel" 
                        id="phone" 
                        placeholder="0123 456 789" 
                        className="contact-input" 
                        {...field} 
                      />
                    )}
                  />
                  {errors.phone && <span className="error-message">{errors.phone.message}</span>}
                </div>
              </div>

              {/* Subject field */}
              <div className="contact-form-group">
                <label htmlFor="subject">Chủ đề *</label>
                <Controller
                  name="subject"
                  control={control}
                  rules={{ required: 'Vui lòng nhập chủ đề liên hệ' }}
                  render={({ field }) => (
                    <input 
                      type="text" 
                      id="subject" 
                      placeholder="Ví dụ: Đặt câu hỏi, Góp ý dịch vụ,..." 
                      className="contact-input" 
                      {...field} 
                    />
                  )}
                />
                {errors.subject && <span className="error-message">{errors.subject.message}</span>}
              </div>

              {/* Message field */}
              <div className="contact-form-group">
                <label htmlFor="message">Nội dung tin nhắn *</label>
                <Controller
                  name="message"
                  control={control}
                  rules={{ required: 'Vui lòng nhập nội dung liên hệ' }}
                  render={({ field }) => (
                    <textarea 
                      id="message" 
                      rows={5} 
                      placeholder="Lời nhắn của bạn..." 
                      className="contact-textarea" 
                      {...field} 
                    />
                  )}
                />
                {errors.message && <span className="error-message">{errors.message.message}</span>}
              </div>

              <button type="submit" className="btn-contact-submit">
                Gửi liên hệ
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;

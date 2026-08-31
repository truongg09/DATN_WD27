import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMapMarkerAlt, 
  faPhone, 
  faEnvelope 
} from '@fortawesome/free-solid-svg-icons';
import './contactsection.css';

interface ContactForm {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const ContactSection: React.FC = () => {
  const { control, handleSubmit, formState: { errors } } = useForm<ContactForm>();

  const onSubmit = () => {
    alert('Tin nhắn đã được gửi!');
  };

  return (
    <div className="contact-section">
      <div className="container">
        <div className="contact-content">
          {/* Left side: Map + Hotel Info */}
          <div className="contact-left">
            <h2>Liên hệ với chúng tôi</h2>
            
            {/* Google Map iframe */}
            <div className="map-container">
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.3202923235375!2d106.69621097499382!3d10.78655558936852!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752f378590e191%3A0xd63b8f75401b076b!2zVHLGsOG7nW5nIMSQ4bqhaSBo4buNYyBHaWEgTmd1eeG7hW4!5e0!3m2!1svi!2s!4v1718822300000!5m2!1svi!2s"
                width="100%"
                height="300"
                style={{ border: 0, borderRadius: '10px' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Google Map"
              />
            </div>
            
            {/* Hotel info arranged horizontally */}
            <div className="hotel-info-horizontal">
              <div className="info-item">
                <FontAwesomeIcon icon={faMapMarkerAlt} />
                <div>
                  <h4>Địa chỉ</h4>
                  <p>123 Đường ABC, Quận 1, TP.HCM</p>
                </div>
              </div>
              <div className="info-item">
                <FontAwesomeIcon icon={faPhone} />
                <div>
                  <h4>Điện thoại</h4>
                  <p>+84 123 456 789</p>
                </div>
              </div>
              <div className="info-item">
                <FontAwesomeIcon icon={faEnvelope} />
                <div>
                  <h4>Email</h4>
                  <p>info@moonlithotel.com</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right side: Contact Form */}
          <div className="contact-form">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="form-row">
                <Controller
                  name="name"
                  control={control}
                  rules={{ required: 'Vui lòng nhập họ tên' }}
                  render={({ field }) => (
                    <input type="text" placeholder="Họ tên" required {...field} />
                  )}
                />
                {errors.name && <span style={{ color: 'red' }}>{errors.name.message}</span>}
                <Controller
                  name="email"
                  control={control}
                  rules={{ required: 'Vui lòng nhập email', pattern: { value: /^\S+@\S+$/i, message: 'Email không hợp lệ' } }}
                  render={({ field }) => (
                    <input type="email" placeholder="Email" required {...field} />
                  )}
                />
                {errors.email && <span style={{ color: 'red' }}>{errors.email.message}</span>}
              </div>
              <Controller
                name="subject"
                control={control}
                rules={{ required: 'Vui lòng nhập chủ đề' }}
                render={({ field }) => (
                  <input type="text" placeholder="Chủ đề" required {...field} />
                )}
              />
              {errors.subject && <span style={{ color: 'red' }}>{errors.subject.message}</span>}
              <Controller
                name="message"
                control={control}
                rules={{ required: 'Vui lòng nhập nội dung' }}
                render={({ field }) => (
                  <textarea placeholder="Nội dung" rows={5} required {...field} />
                )}
              />
              {errors.message && <span style={{ color: 'red' }}>{errors.message.message}</span>}
              <button type="submit" className="btn-send">Gửi tin nhắn</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactSection;

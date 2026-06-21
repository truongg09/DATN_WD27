import React from 'react';
import './gallery.css';

const Gallery: React.FC = () => {
  const images = [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500',
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=500',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500',
    'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=500',
    'https://images.unsplash.com/photo-1561501900-3701fa6a0864?w=500',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=500'
  ];

  return (
    <div className="gallery">
      <div className="container">
        <div className="section-title">
          <span className="subtitle">Thư viện</span>
          <h2>Ảnh khách sạn</h2>
        </div>
        <div className="gallery-grid">
          {images.map((image, index) => (
            <div key={index} className="gallery-item">
              <img src={image} alt={`Gallery ${index + 1}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Gallery;

import React from 'react';
import './gallery.css';

const Gallery: React.FC = () => {
  const images = [
    'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800', // Lobby
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800', // Pool
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800', // Restaurant (Fine Dining table)
    'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=800', // Spa (Massage room)
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800', // Sunset Resort
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800'  // Gym
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

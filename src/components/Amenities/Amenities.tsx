import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSwimmingPool,
  faSpa,
  faUtensils,
  faDumbbell,
  faWifi,
  faCar,
  faPlaneArrival,
  faSyncAlt,
  faTv,
  faSnowflake,
  faGlassWhiskey,
  faBath,
  faImage
} from '@fortawesome/free-solid-svg-icons';
import { getAmenities } from '../../services/amenityService';
import type { Amenity } from '../../services/amenityService';
import './amenities.css';

const iconMap: Record<string, any> = {
  faSwimmingPool,
  faSpa,
  faUtensils,
  faDumbbell,
  faWifi,
  faCar,
  faPlaneArrival,
  faSyncAlt,
  faTv,
  faSnowflake,
  faGlassWhiskey,
  faBath,
  faImage
};

const Amenities: React.FC = () => {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getAmenities();
        setAmenities(data);
      } catch (error) {
        console.error('Error fetching amenities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="amenities">
        <div className="container">
          <div className="section-title">
            <span className="subtitle">Tiện ích</span>
            <h2>Dịch vụ cao cấp</h2>
          </div>
          <div className="amenities-grid">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="amenity-item">
                <div style={{ fontSize: '48px', opacity: 0.3 }}>⟳</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="amenities">
      <div className="container">
        <div className="section-title">
          <span className="subtitle">Tiện ích</span>
          <h2>Dịch vụ cao cấp</h2>
        </div>
        <div className="amenities-grid">
          {amenities.map((amenity) => (
            <div key={amenity.id} className="amenity-item">
              <FontAwesomeIcon icon={iconMap[amenity.icon] || faWifi} />
              <h3>{amenity.name}</h3>
              <p>{amenity.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Amenities;
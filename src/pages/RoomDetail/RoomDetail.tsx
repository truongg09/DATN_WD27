import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
} from '@fortawesome/free-solid-svg-icons';
import { message } from 'antd';
import { getRoomById } from '../../services/roomService';
import './RoomDetail.css';

const RoomDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const redirectToRoomType = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const response = await getRoomById(Number(id));
        const room = response?.data as { roomTypeId?: number } | undefined;
        const roomTypeId = room?.roomTypeId;
        if (roomTypeId && roomTypeId > 0) {
          const forwardParams = new URLSearchParams(searchParams).toString();
          const target = `/room-types/${roomTypeId}${forwardParams ? `?${forwardParams}` : ''}`;
          message.info('Đang chuyển đến trang hạng phòng...');
          navigate(target, { replace: true });
          return;
        }
        setError('Không tìm thấy hạng phòng tương ứng.');
      } catch (err) {
        console.error('Lỗi khi chuyển hướng đến hạng phòng:', err);
        setError('Không thể chuyển đến trang hạng phòng. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };

    void redirectToRoomType();
    window.scrollTo(0, 0);
  }, [id, navigate, searchParams]);

  if (loading) {
    return (
      <div className="room-detail-page">
        <div className="rooms-loading">
          <div className="spinner"></div>
          <p>Đang chuyển đến trang hạng phòng...</p>
        </div>
      </div>
    );
  }

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
          <p>{error || 'Không thể hiển thị phòng này.'}</p>
          <Link to="/rooms" className="btn-book-room" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>
            Xem danh sách hạng phòng
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RoomDetail;

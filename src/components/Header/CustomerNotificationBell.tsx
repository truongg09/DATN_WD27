import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Button, Empty, Popover, Spin, Tag, Typography } from 'antd';
import { BellOutlined, GiftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { getMyNotifications, markNotificationRead, markAllNotificationsRead } from '../../services/notificationService';
import type { NotificationItem } from '../../types/notification';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Text } = Typography;

export const CustomerNotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getMyNotifications({ limit: 15 });
      setNotifications(res.data || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // Bỏ qua lỗi mạng nền
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();

    const interval = setInterval(() => {
      void fetchNotifications();
    }, 15000);

    const onFocus = () => {
      void fetchNotifications();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchNotifications]);

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await markNotificationRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: 1 } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Ignored
      }
    }

    setOpen(false);

    if (item.type === 'voucher' || item.referenceType === 'voucher') {
      navigate('/profile?tab=vouchers', { state: { tab: 'vouchers', voucherId: item.referenceId } });
    } else if (item.type === 'booking' || item.referenceType === 'booking') {
      if (item.referenceId) {
        navigate(`/booking/${item.referenceId}`);
      } else {
        navigate('/booking/history');
      }
    } else if (item.type === 'review' || item.referenceType === 'review') {
      navigate('/reviews');
    } else {
      navigate('/profile?tab=notifications', { state: { tab: 'notifications' } });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: 1 })));
      setUnreadCount(0);
    } catch {
      // Ignored
    }
  };

  const popoverContent = (
    <div style={{ width: 340, maxWidth: '90vw', maxHeight: 420, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
          Thông báo {unreadCount > 0 && <Tag color="blue">{unreadCount} mới</Tag>}
        </span>
        {unreadCount > 0 && (
          <Button
            type="link"
            size="small"
            onClick={handleMarkAllRead}
            style={{ padding: 0, fontSize: 12, height: 'auto' }}
          >
            Đánh dấu đã đọc
          </Button>
        )}
      </div>

      <div style={{ overflowY: 'auto', maxHeight: 340, padding: '4px 0' }}>
        {loading && notifications.length === 0 ? (
          <div style={{ padding: '30px 0', textAlign: 'center' }}>
            <Spin size="small" />
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '24px 12px' }}>
            <Empty description="Bạn chưa có thông báo nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          notifications.map((item) => {
            const isUnread = !item.isRead;
            const isVoucher = item.type === 'voucher' || item.referenceType === 'voucher';

            return (
              <div
                key={item.id}
                onClick={() => void handleNotificationClick(item)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 12px',
                  borderBottom: '1px solid #f5f5f5',
                  backgroundColor: isUnread ? '#f0f7ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isUnread ? '#e6f4ff' : '#fafafa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isUnread ? '#f0f7ff' : '#ffffff';
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: isVoucher ? '#fef3c7' : '#e0f2fe',
                    color: isVoucher ? '#d97706' : '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {isVoucher ? <GiftOutlined /> : <InfoCircleOutlined />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text
                      strong={isUnread}
                      style={{
                        fontSize: 13,
                        color: isUnread ? '#0f172a' : '#475467',
                        display: 'block',
                        marginBottom: 2,
                      }}
                      ellipsis
                    >
                      {item.title}
                    </Text>
                    {isUnread && (
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          backgroundColor: '#1677ff',
                          display: 'inline-block',
                          flexShrink: 0,
                          marginLeft: 6,
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#64748b',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.content}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    {dayjs(item.createdAt).fromNow()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div
        style={{
          padding: '8px 12px',
          textAlign: 'center',
          borderTop: '1px solid #f0f0f0',
          background: '#fafafa',
        }}
      >
        <Button
          type="link"
          size="small"
          onClick={() => {
            setOpen(false);
            navigate('/profile?tab=vouchers', { state: { tab: 'vouchers' } });
          }}
          style={{ fontSize: 12, padding: 0 }}
        >
          Xem tất cả khuyến mãi & ưu đãi
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      overlayInnerStyle={{ padding: 0, borderRadius: 10, overflow: 'hidden' }}
    >
      <div
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: '50%',
          backgroundColor: open ? '#f1f5f9' : 'transparent',
          transition: 'background 0.2s',
          marginRight: 8,
        }}
        title="Thông báo"
      >
        <Badge count={unreadCount} size="small" overflowCount={99}>
          <BellOutlined style={{ fontSize: 18, color: '#475467' }} />
        </Badge>
      </div>
    </Popover>
  );
};

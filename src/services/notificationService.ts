import api from './api';
import type { NotificationResponse } from '../types/notification';

export const getMyNotifications = async (params?: { limit?: number; offset?: number }): Promise<NotificationResponse> => {
  return api.get('/notifications/me', { params }) as Promise<NotificationResponse>;
};

export const markNotificationRead = async (id: number): Promise<{ message: string }> => {
  return api.patch(`/notifications/${id}/read`) as Promise<{ message: string }>;
};

export const markAllNotificationsRead = async (): Promise<{ message: string }> => {
  return api.patch('/notifications/read-all') as Promise<{ message: string }>;
};

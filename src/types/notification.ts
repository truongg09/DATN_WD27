export interface NotificationItem {
  id: number;
  accountId: number;
  type: string;
  title: string;
  content: string;
  referenceType?: string | null;
  referenceId?: number | null;
  isRead: number | boolean;
  createdAt: string;
}

export interface NotificationResponse {
  data: NotificationItem[];
  unreadCount: number;
}

import { API_URL } from "../../config/api";

const getToken = () => {
  const rawToken = localStorage.getItem('token');
  return rawToken ? rawToken.replace(/"/g, '') : '';
};

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

// ── Types ──

export interface NotificationItem {
  public_id: string;
  type: string;
  priority: string;
  title: string;
  body?: string;
  media_url?: string;
  action_url?: string;
  metadata?: Record<string, any>;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationAdminItem {
  public_id: string;
  type: string;
  priority: string;
  status: string;
  title_es: string;
  title_en: string;
  body_es?: string;
  body_en?: string;
  media_url?: string;
  action_url?: string;
  target_type: string;
  target_value?: string;
  metadata?: Record<string, any>;
  created_by_name?: string;
  read_count: number;
  total_recipients: number;
  scheduled_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface NotificationCreateData {
  type?: string;
  priority?: string;
  status?: string;
  title_es: string;
  title_en: string;
  body_es?: string;
  body_en?: string;
  media_url?: string;
  action_url?: string;
  target_type?: string;
  target_value?: string;
  metadata?: Record<string, any>;
  scheduled_at?: string;
  expires_at?: string;
}

export interface UserSearchResult {
  public_id: string;
  name: string;
  email: string;
  username?: string;
  user_type: string;
  preferred_language: string;
}

// ── User-facing API ──

export const notificationsApi = {
  getNotifications: async (limit = 30, offset = 0): Promise<NotificationItem[]> => {
    const response = await fetch(`${API_URL}/notifications?limit=${limit}&offset=${offset}`, {
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("Failed to fetch notifications");
    return response.json();
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await fetch(`${API_URL}/notifications/unread-count`, {
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("Failed to fetch unread count");
    const data = await response.json();
    return data.count;
  },

  markAsRead: async (publicId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/notifications/${publicId}/read`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("Failed to mark as read");
  },

  markAllAsRead: async (): Promise<void> => {
    const response = await fetch(`${API_URL}/notifications/read-all`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("Failed to mark all as read");
  },

  dismiss: async (publicId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/notifications/${publicId}/dismiss`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("Failed to dismiss notification");
  },
};

// ── Admin API ──

export const notificationsAdminApi = {
  list: async (filters?: { status?: string; type?: string; target?: string }): Promise<NotificationAdminItem[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.type) params.set('type', filters.type);
    if (filters?.target) params.set('target', filters.target);

    const response = await fetch(`${API_URL}/admin/notifications?${params.toString()}`, {
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("Failed to fetch notifications");
    return response.json();
  },

  create: async (data: NotificationCreateData): Promise<NotificationAdminItem> => {
    const response = await fetch(`${API_URL}/admin/notifications`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error("Failed to create notification");
    return response.json();
  },

  update: async (publicId: string, data: Partial<NotificationCreateData>): Promise<NotificationAdminItem> => {
    const response = await fetch(`${API_URL}/admin/notifications/${publicId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error("Failed to update notification");
    return response.json();
  },

  archive: async (publicId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/admin/notifications/${publicId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("Failed to archive notification");
  },

  searchUsers: async (query: string): Promise<UserSearchResult[]> => {
    if (!query || query.length < 2) return [];
    const response = await fetch(`${API_URL}/admin/notifications/users?q=${encodeURIComponent(query)}`, {
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("Failed to search users");
    return response.json();
  },
};

import { API_URL } from "../../config/api";
import { apiFetch } from "../apiClient";

const api = (url: string, options: RequestInit = {}) =>
  apiFetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) },
  });

export interface UserPublicProfile {
  public_id: string;
  username: string;
  name?: string;
  avatar_config?: any;
  lessons_completed: number;
  points_earned: number;
  current_streak: number;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  follow_status?: string;
}

export interface FollowRequest {
  public_id: string;
  username: string;
  name?: string;
  avatar_config?: any;
  requested_at: string;
}

export const socialApi = {
  searchUsers: async (query: string): Promise<UserPublicProfile[]> => {
    if (!query || query.length < 3) return [];
    const response = await api(`${API_URL}/social/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error("Search failed");
    return response.json();
  },

  getUserProfile: async (username: string): Promise<UserPublicProfile> => {
    // apiFetch includes auth header if token is in memory, otherwise works unauthenticated
    const response = await api(`${API_URL}/social/profile/${encodeURIComponent(username)}`);
    if (!response.ok) throw new Error("User not found");
    return response.json();
  },

  followUser: async (username: string) => {
    const response = await api(`${API_URL}/social/follow/${encodeURIComponent(username)}`, { method: 'POST' });
    if (!response.ok) throw new Error("Follow failed");
    return response.json();
  },

  unfollowUser: async (username: string) => {
    const response = await api(`${API_URL}/social/unfollow/${encodeURIComponent(username)}`, { method: 'POST' });
    if (!response.ok) throw new Error("Unfollow failed");
    return response.json();
  },

  getFollowers: async (): Promise<UserPublicProfile[]> => {
    const response = await api(`${API_URL}/social/followers`);
    if (!response.ok) throw new Error("Failed to fetch followers");
    return response.json();
  },

  getFollowing: async (): Promise<UserPublicProfile[]> => {
    const response = await api(`${API_URL}/social/following`);
    if (!response.ok) throw new Error("Failed to fetch following");
    return response.json();
  },

  getPendingRequests: async (): Promise<FollowRequest[]> => {
    const response = await api(`${API_URL}/social/requests/pending`);
    if (!response.ok) throw new Error("Failed to fetch requests");
    return response.json();
  },

  acceptRequest: async (username: string) => {
    const response = await api(`${API_URL}/social/requests/accept/${encodeURIComponent(username)}`, { method: 'POST' });
    if (!response.ok) throw new Error("Accept failed");
    return response.json();
  },

  rejectRequest: async (username: string) => {
    const response = await api(`${API_URL}/social/requests/reject/${encodeURIComponent(username)}`, { method: 'POST' });
    if (!response.ok) throw new Error("Reject failed");
    return response.json();
  }
};

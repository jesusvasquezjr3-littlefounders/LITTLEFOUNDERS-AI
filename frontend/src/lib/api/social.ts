import { API_URL } from "@/config/api";

const getToken = () => {
  const rawToken = localStorage.getItem('token');
  return rawToken ? rawToken.replace(/"/g, '') : '';
};

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
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
    const response = await fetch(`${API_URL}/social/search?q=${encodeURIComponent(query)}`, {
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("Search failed");
    return response.json();
  },

  getUserProfile: async (username: string): Promise<UserPublicProfile> => {
    const response = await fetch(`${API_URL}/social/profile/${encodeURIComponent(username)}`, {
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("User not found");
    return response.json();
  },

  followUser: async (username: string) => {
    const response = await fetch(`${API_URL}/social/follow/${encodeURIComponent(username)}`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("Follow failed");
    return response.json();
  },

  unfollowUser: async (username: string) => {
    const response = await fetch(`${API_URL}/social/unfollow/${encodeURIComponent(username)}`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("Unfollow failed");
    return response.json();
  },

  getFollowers: async (): Promise<UserPublicProfile[]> => {
    const response = await fetch(`${API_URL}/social/followers`, {
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("Failed to fetch followers");
    return response.json();
  },

  getFollowing: async (): Promise<UserPublicProfile[]> => {
    const response = await fetch(`${API_URL}/social/following`, {
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("Failed to fetch following");
    return response.json();
  },

  getPendingRequests: async (): Promise<FollowRequest[]> => {
    const response = await fetch(`${API_URL}/social/requests/pending`, {
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("Failed to fetch requests");
    return response.json();
  },

  acceptRequest: async (username: string) => {
    const response = await fetch(`${API_URL}/social/requests/accept/${encodeURIComponent(username)}`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("Accept failed");
    return response.json();
  },

  rejectRequest: async (username: string) => {
    const response = await fetch(`${API_URL}/social/requests/reject/${encodeURIComponent(username)}`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (!response.ok) throw new Error("Reject failed");
    return response.json();
  }
};

/**
 * useAdminStats Hook
 *
 * TanStack Query hooks for admin statistics and user management.
 * Includes queries for stats and user data, and mutations for user role changes.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/config/api';

// Types - RecentEdit from stats endpoint
export interface RecentEdit {
  id: string;
  editor_user_id: string;
  editor_name: string;
  entity_type: string;
  entity_id: string;
  action: string;
  field_changed: string;
  created_at: string;
  metadata?: Record<string, any>;
}

// AdminStats matches exact backend response
export interface AdminStats {
  total_lessons: number;
  total_exercises: number;
  total_characters: number;
  total_audio_segments: number;
  recent_edits: RecentEdit[];
  lessons_by_adventure: Record<number, number>;
}

// User from /admin/users endpoint (returned as array directly)
export interface User {
  id: string;
  name: string;
  email: string;
  user_type: string;
  is_active: boolean;
  created_at: string;
}

// ExerciseType from /admin/exercise-types endpoint
export interface ExerciseType {
  id?: string;
  name: string;
  [key: string]: any;
}

// RoleChangeResult matches `{message: "..."}` response
export interface RoleChangeResult {
  message: string;
}

// Helper function to get auth headers
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  if (token) {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }
  return { "Content-Type": "application/json" };
}

/**
 * Fetch admin statistics
 */
export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/admin/stats`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch admin stats: ${response.statusText}`);
      }

      const result: AdminStats = await response.json();
      return result;
    },
  });
}

/**
 * Fetch all users for admin management
 * Returns array directly (no wrapper object)
 */
export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/admin/users`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`);
      }

      const result: User[] = await response.json();
      return result;
    },
  });
}

/**
 * Promote a user to admin role
 * Returns {message: "..."}
 */
export function usePromoteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`${API_URL}/admin/users/${userId}/promote`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to promote user: ${response.statusText}`);
      }

      const result: RoleChangeResult = await response.json();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });
}

/**
 * Demote a user from admin role
 * Returns {message: "..."}
 */
export function useDemoteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`${API_URL}/admin/users/${userId}/demote`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to demote user: ${response.statusText}`);
      }

      const result: RoleChangeResult = await response.json();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });
}

/**
 * Fetch all exercise types
 * Returns {types: [...]}
 */
export function useExerciseTypes() {
  return useQuery({
    queryKey: ['admin-exercise-types'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/admin/exercise-types`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch exercise types: ${response.statusText}`);
      }

      const result: { types: ExerciseType[] } = await response.json();
      return result.types;
    },
  });
}

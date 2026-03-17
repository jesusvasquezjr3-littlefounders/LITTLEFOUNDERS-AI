/**
 * useAdminLessons Hook
 *
 * TanStack Query hooks for admin lesson management.
 * Includes queries and mutations for CRUD operations and lesson utilities.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/config/api';

// Types
export interface LessonFilters {
  adventure_level?: number;
  saga_level?: number;
  topic_level?: number;
  search?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

// From GET /admin/lessons endpoint
export interface LessonListItem {
  public_id: string;
  lesson_code: string;
  title_es: string;
  title_en: string;
  adventure_level: number;
  saga_level: number;
  topic_level: number;
  lesson_number: number;
  points_reward: number;
  duration: number;
  exercise_count_es: number;
  exercise_count_en: number;
  updated_at: string;
}

// From GET /admin/lessons/:id endpoint (returned directly, no wrapper)
export interface Lesson {
  public_id: string;
  lesson_code: string;
  title_es: string;
  title_en: string;
  description_es: string;
  description_en: string;
  duration: number;
  age_rate: string;
  points_reward: number;
  adventure_level: number;
  saga_level: number;
  topic_level: number;
  lesson_number: number;
  content_es: any;
  content_en: any;
  created_at: string;
  updated_at: string;
}

// Paginated response from GET /admin/lessons
export interface LessonsPaginatedResponse {
  items: LessonListItem[];
  total: number;
  page: number;
  page_size: number;
}

// POST/PUT response
export interface LessonResponse {
  public_id: string;
  lesson_code: string;
  message: string;
}

// DELETE response
export interface DeleteResponse {
  message: string;
}

// Validation response
export interface ValidationResult {
  is_valid: boolean;
  errors_es: string[];
  errors_en: string[];
  exercise_count_es: number;
  exercise_count_en: number;
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

// Helper function to build query string
function buildQueryString(filters: LessonFilters): string {
  const params = new URLSearchParams();

  if (filters.adventure_level !== undefined) {
    params.append('adventure_level', String(filters.adventure_level));
  }
  if (filters.saga_level !== undefined) {
    params.append('saga_level', String(filters.saga_level));
  }
  if (filters.topic_level !== undefined) {
    params.append('topic_level', String(filters.topic_level));
  }
  if (filters.search) {
    params.append('search', filters.search);
  }
  if (filters.page !== undefined) {
    params.append('page', String(filters.page));
  }
  if (filters.page_size !== undefined) {
    params.append('page_size', String(filters.page_size));
  }
  if (filters.sort_by) {
    params.append('sort_by', filters.sort_by);
  }
  if (filters.sort_dir) {
    params.append('sort_dir', filters.sort_dir);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Fetch admin lessons with filtering and pagination
 */
export function useAdminLessons(filters: LessonFilters = {}) {
  return useQuery({
    queryKey: ['admin-lessons', filters],
    queryFn: async () => {
      const queryString = buildQueryString(filters);
      const response = await fetch(`${API_URL}/admin/lessons${queryString}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch lessons: ${response.statusText}`);
      }

      const result: LessonsPaginatedResponse = await response.json();
      return result;
    },
  });
}

/**
 * Fetch a single lesson by ID
 * Returns lesson object directly (no wrapper)
 */
export function useAdminLesson(publicId: string) {
  return useQuery({
    queryKey: ['admin-lesson', publicId],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/admin/lessons/${publicId}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch lesson: ${response.statusText}`);
      }

      const result: Lesson = await response.json();
      return result;
    },
    enabled: !!publicId,
  });
}

/**
 * Create a new lesson
 * Returns {id, lesson_code, message}
 */
export function useCreateLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lesson: Omit<Lesson, 'public_id' | 'created_at' | 'updated_at'>) => {
      const response = await fetch(`${API_URL}/admin/lessons`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(lesson),
      });

      if (!response.ok) {
        throw new Error(`Failed to create lesson: ${response.statusText}`);
      }

      const result: LessonResponse = await response.json();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lessons'] });
    },
  });
}

/**
 * Update an existing lesson
 * Returns {id, lesson_code, message}
 */
export function useUpdateLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ publicId, lesson }: { publicId: string; lesson: Partial<Lesson> }) => {
      const response = await fetch(`${API_URL}/admin/lessons/${publicId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(lesson),
      });

      if (!response.ok) {
        throw new Error(`Failed to update lesson: ${response.statusText}`);
      }

      const result: LessonResponse = await response.json();
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['admin-lesson', data.public_id] });
    },
  });
}

/**
 * Delete a lesson
 * Returns {message}
 */
export function useDeleteLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (publicId: string) => {
      const response = await fetch(`${API_URL}/admin/lessons/${publicId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete lesson: ${response.statusText}`);
      }

      const result: DeleteResponse = await response.json();
      return { publicId, ...result };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-lessons'] });
      queryClient.removeQueries({ queryKey: ['admin-lesson', data.publicId] });
    },
  });
}

/**
 * Duplicate a lesson
 * Returns {id, lesson_code, message}
 */
export function useDuplicateLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (publicId: string) => {
      const response = await fetch(`${API_URL}/admin/lessons/${publicId}/duplicate`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to duplicate lesson: ${response.statusText}`);
      }

      const result: LessonResponse = await response.json();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lessons'] });
    },
  });
}

/**
 * Validate a lesson
 * Returns {is_valid, errors_es, errors_en, exercise_count_es, exercise_count_en}
 */
export function useValidateLesson() {
  return useMutation({
    mutationFn: async (publicId: string) => {
      const response = await fetch(`${API_URL}/admin/lessons/${publicId}/validate`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to validate lesson: ${response.statusText}`);
      }

      const result: ValidationResult = await response.json();
      return result;
    },
  });
}

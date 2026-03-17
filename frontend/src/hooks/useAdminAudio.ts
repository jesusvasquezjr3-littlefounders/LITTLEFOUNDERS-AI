/**
 * useAdminAudio Hook
 *
 * TanStack Query hooks for admin audio management.
 * Includes queries and mutations for audio file uploads, generation, and deletion.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/config/api';

// Types
export interface AudioFilters {
  character_id?: string;
  lesson_id?: string;
  page?: number;
  page_size?: number;
  search?: string;
  language_code?: string;
}

// From GET /admin/audio endpoint
export interface AudioFile {
  public_id: string;
  lesson_id: string;
  exercise_id: string;
  character_id: string;
  audio_url: string;
  transcript: string;
  emotion: string;
  language_code: string;
  source: string;
  tags: string[];
  is_active: boolean;
  duration_ms: number;
}

// Paginated response from GET /admin/audio
export interface AudioPaginatedResponse {
  items: AudioFile[];
  total: number;
  page: number;
  page_size: number;
}

// POST /admin/audio/upload response
export interface AudioUploadResponse {
  public_id: string;
  audio_url: string;
  message: string;
}

// POST /admin/audio/generate response
export interface AudioGenerateResponse {
  public_id: string;
  audio_url: string;
  message: string;
}

// DELETE /admin/audio/:id response
export interface AudioDeleteResponse {
  message: string;
}

export interface GenerateAudioPayload {
  text: string;
  character_id?: string;
  voice?: string;
  speed?: number;
}

// Helper function to get auth headers (without Content-Type for FormData)
function getAuthHeaders(includeContentType = true) {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

// Helper function to build query string
function buildQueryString(filters: AudioFilters): string {
  const params = new URLSearchParams();

  if (filters.character_id) {
    params.append('character_id', filters.character_id);
  }
  if (filters.lesson_id) {
    params.append('lesson_id', filters.lesson_id);
  }
  if (filters.page !== undefined) {
    params.append('page', String(filters.page));
  }
  if (filters.page_size !== undefined) {
    params.append('page_size', String(filters.page_size));
  }
  if (filters.search) {
    params.append('search', filters.search);
  }
  if (filters.language_code) {
    params.append('language_code', filters.language_code);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Fetch admin audio files with filtering and pagination
 */
export function useAdminAudio(filters: AudioFilters = {}) {
  return useQuery({
    queryKey: ['admin-audio', filters],
    queryFn: async () => {
      const queryString = buildQueryString(filters);
      const response = await fetch(`${API_URL}/admin/audio${queryString}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch audio files: ${response.statusText}`);
      }

      const result: AudioPaginatedResponse = await response.json();
      return result;
    },
  });
}

/**
 * Upload audio file
 * Returns {id, audio_url, message}
 */
export function useUploadAudio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`${API_URL}/admin/audio/upload`, {
        method: 'POST',
        // Don't set Content-Type, let the browser set it for FormData
        headers: getAuthHeaders(false),
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload audio: ${response.statusText}`);
      }

      const result: AudioUploadResponse = await response.json();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-audio'] });
    },
  });
}

/**
 * Generate audio from text
 * Returns {id, audio_url, message}
 */
export function useGenerateAudio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: GenerateAudioPayload) => {
      const response = await fetch(`${API_URL}/admin/audio/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate audio: ${response.statusText}`);
      }

      const result: AudioGenerateResponse = await response.json();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-audio'] });
    },
  });
}

/**
 * Delete an audio file
 * Returns {message}
 */
export function useDeleteAudio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (publicId: string) => {
      const response = await fetch(`${API_URL}/admin/audio/${publicId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete audio: ${response.statusText}`);
      }

      const result: AudioDeleteResponse = await response.json();
      return { publicId, ...result };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-audio'] });
      queryClient.removeQueries({ queryKey: ['admin-audio-detail', data.publicId] });
    },
  });
}

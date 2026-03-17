/**
 * useAdminCharacters Hook
 *
 * TanStack Query hooks for admin character management.
 * Includes queries and mutations for character CRUD operations and gesture management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/config/api';

// Types
export interface Gesture {
  id: string;
  gesture_code: string;
  animation_data: any;  // JSON field - can be object or null
  duration_ms: number;
}

// From GET /admin/characters endpoint (returned as array directly)
export interface Character {
  public_id: string;
  code: string;
  name: string;
  description: string;
  default_appearance: any;  // JSON field - can be object or null
  is_active: boolean;
  created_at: string;
  gestures: Gesture[];
}

// POST /admin/characters response
export interface CharacterCreateResponse {
  public_id: string;
  code: string;
  message: string;
}

// PUT /admin/characters/:id response
export interface CharacterUpdateResponse {
  message: string;
}

// POST /admin/characters/:id/gestures response
export interface GestureCreateResponse {
  id: string;
  message: string;
}

// PUT /admin/characters/:id/gestures/:id response
export interface GestureUpdateResponse {
  message: string;
}

// DELETE /admin/characters/:id/gestures/:id response
export interface GestureDeleteResponse {
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
 * Fetch all admin characters
 * Returns array directly (no wrapper)
 */
export function useAdminCharacters() {
  return useQuery({
    queryKey: ['admin-characters'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/admin/characters`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch characters: ${response.statusText}`);
      }

      const result: Character[] = await response.json();
      return result;
    },
  });
}

/**
 * Create a new character
 * Returns {id, code, message}
 */
export function useCreateCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (character: Omit<Character, 'public_id' | 'created_at' | 'gestures'>) => {
      const response = await fetch(`${API_URL}/admin/characters`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(character),
      });

      if (!response.ok) {
        throw new Error(`Failed to create character: ${response.statusText}`);
      }

      const result: CharacterCreateResponse = await response.json();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-characters'] });
    },
  });
}

/**
 * Update an existing character
 * Returns {message}
 */
export function useUpdateCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ publicId, character }: { publicId: string; character: Partial<Character> }) => {
      const response = await fetch(`${API_URL}/admin/characters/${publicId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(character),
      });

      if (!response.ok) {
        throw new Error(`Failed to update character: ${response.statusText}`);
      }

      const result: CharacterUpdateResponse = await response.json();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-characters'] });
    },
  });
}

/**
 * Create a new gesture for a character
 * Returns {id, message}
 */
export function useCreateGesture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ characterPublicId, gesture }: { characterPublicId: string; gesture: Omit<Gesture, 'id'> }) => {
      const response = await fetch(`${API_URL}/admin/characters/${characterPublicId}/gestures`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(gesture),
      });

      if (!response.ok) {
        throw new Error(`Failed to create gesture: ${response.statusText}`);
      }

      const result: GestureCreateResponse = await response.json();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-characters'] });
    },
  });
}

/**
 * Update a gesture
 * Returns {message}
 */
export function useUpdateGesture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      characterPublicId,
      gestureId,
      gesture,
    }: {
      characterPublicId: string;
      gestureId: string;
      gesture: Partial<Gesture>;
    }) => {
      const response = await fetch(`${API_URL}/admin/characters/${characterPublicId}/gestures/${gestureId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(gesture),
      });

      if (!response.ok) {
        throw new Error(`Failed to update gesture: ${response.statusText}`);
      }

      const result: GestureUpdateResponse = await response.json();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-characters'] });
    },
  });
}

/**
 * Delete a gesture
 * Returns {message}
 */
export function useDeleteGesture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      characterPublicId,
      gestureId,
    }: {
      characterPublicId: string;
      gestureId: string;
    }) => {
      const response = await fetch(`${API_URL}/admin/characters/${characterPublicId}/gestures/${gestureId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete gesture: ${response.statusText}`);
      }

      const result: GestureDeleteResponse = await response.json();
      return { characterPublicId, gestureId, ...result };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-characters'] });
    },
  });
}

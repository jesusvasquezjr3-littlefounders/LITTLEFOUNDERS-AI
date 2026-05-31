/**
 * useAdminHistory Hook
 *
 * TanStack Query hooks for admin history tracking.
 * Includes queries and mutations for viewing and rolling back entity changes.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/config/api';

// Types
export interface HistoryFilters {
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  action?: string;
  page?: number;
  page_size?: number;
  start_date?: string;
  end_date?: string;
}

// From GET /admin/history endpoint
export interface HistoryEntry {
  id: string;
  editor_user_id: string;
  editor_name: string;
  entity_type: string;
  entity_id: string;
  action: string;
  field_changed: string;
  previous_value: string;
  new_value: string;
  metadata: Record<string, any>;
  created_at: string;
}

// Paginated response from GET /admin/history
export interface HistoryPaginatedResponse {
  items: HistoryEntry[];
  total: number;
  page: number;
  page_size: number;
}

// GET /admin/history/entity/:type/:id returns array directly
export type EntityHistoryResponse = HistoryEntry[];

// POST /admin/history/:id/rollback response
export interface RollbackResult {
  message: string;
  entity_id: string;
}

// Helper function to get auth headers
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// Helper function to build query string
function buildQueryString(filters: HistoryFilters): string {
  const params = new URLSearchParams();

  if (filters.entity_type) {
    params.append('entity_type', filters.entity_type);
  }
  if (filters.entity_id) {
    params.append('entity_id', filters.entity_id);
  }
  if (filters.user_id) {
    params.append('user_id', filters.user_id);
  }
  if (filters.action) {
    params.append('action', filters.action);
  }
  if (filters.page !== undefined) {
    params.append('page', String(filters.page));
  }
  if (filters.page_size !== undefined) {
    params.append('page_size', String(filters.page_size));
  }
  if (filters.start_date) {
    params.append('start_date', filters.start_date);
  }
  if (filters.end_date) {
    params.append('end_date', filters.end_date);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Fetch admin history with filtering and pagination
 */
export function useAdminHistory(filters: HistoryFilters = {}) {
  return useQuery({
    queryKey: ['admin-history', filters],
    queryFn: async () => {
      const queryString = buildQueryString(filters);
      const response = await fetch(`${API_URL}/admin/history${queryString}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.statusText}`);
      }

      const result: HistoryPaginatedResponse = await response.json();
      return result;
    },
  });
}

/**
 * Fetch history for a specific entity
 * Returns array directly (no wrapper)
 */
export function useEntityHistory(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['admin-entity-history', entityType, entityId],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/admin/history/entity/${entityType}/${entityId}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch entity history: ${response.statusText}`);
      }

      const result: EntityHistoryResponse = await response.json();
      return result;
    },
    enabled: !!entityType && !!entityId,
  });
}

/**
 * Rollback an entity to a previous history entry
 */
export function useRollback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (historyId: string) => {
      const response = await fetch(`${API_URL}/admin/history/${historyId}/rollback`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to rollback: ${response.statusText}`);
      }

      const result: RollbackResult = await response.json();
      return result;
    },
    onSuccess: () => {
      // Invalidate both history queries
      queryClient.invalidateQueries({ queryKey: ['admin-history'] });
      queryClient.invalidateQueries({ queryKey: ['admin-entity-history'] });
      // Also invalidate related admin data that might have been affected
      queryClient.invalidateQueries({ queryKey: ['admin-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['admin-lesson'] });
      queryClient.invalidateQueries({ queryKey: ['admin-characters'] });
      queryClient.invalidateQueries({ queryKey: ['admin-character'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

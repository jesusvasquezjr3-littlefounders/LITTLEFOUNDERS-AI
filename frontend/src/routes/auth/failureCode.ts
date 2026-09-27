import type { ApiError } from '@/lib/api';

/*
 * The code a rebuilt identity screen shows for a failed request (W2S.3). The
 * API client reports a request that never reached Core as INTERNAL with the
 * message "Network error"; shown as "Something went wrong on our side", that
 * blames the server for the person's own connection. A request that failed
 * while the browser is offline, or never reached Core at all, is OFFLINE
 * ("No connection. Reconnect, then try again."). Every other code is Core's.
 */
export function failureCode(error: Pick<ApiError, 'code'> & { message?: string }, online = typeof navigator === 'undefined' || navigator.onLine !== false): string {
  if (!online) return 'OFFLINE';
  if (error.code === 'INTERNAL' && error.message === 'Network error') return 'OFFLINE';
  return error.code;
}

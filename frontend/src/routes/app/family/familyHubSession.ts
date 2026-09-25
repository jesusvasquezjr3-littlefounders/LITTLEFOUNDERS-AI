import { api } from '@/lib/api';
import type { Session, Transport } from '@/rebuild/family/familyHubApi';

/** Binds the rebuilt Family Hub API layer (which imports nothing legacy) to the shared Core client. */
const transport: Transport = (path, options) => api<unknown>(path, options);

export function hubSession(token: string | null): Session {
  return { token, transport };
}

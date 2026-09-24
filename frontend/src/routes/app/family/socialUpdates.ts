type Listener = () => void;
const scopes = new Map<string, Set<Listener>>();
const scope = (kidId: string, token: string | null) => JSON.stringify([kidId, token]);

/** In-memory invalidation only; no child identity or session token is persisted or broadcast. */
export function subscribeSocialUpdates(kidId: string, token: string | null, listener: Listener) {
  const key = scope(kidId, token);
  const listeners = scopes.get(key) ?? new Set<Listener>();
  listeners.add(listener); scopes.set(key, listeners);
  return () => { listeners.delete(listener); if (listeners.size === 0) scopes.delete(key); };
}
export function publishSocialUpdate(kidId: string, token: string | null) {
  for (const listener of [...(scopes.get(scope(kidId, token)) ?? [])]) listener();
}

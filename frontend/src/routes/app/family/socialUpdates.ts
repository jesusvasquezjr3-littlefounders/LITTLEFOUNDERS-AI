type Listener = () => void;
const scopes = new Map<string, Set<Listener>>();
const tokenScopes = new Map<string, Set<Listener>>();
const scope = (kidId: string, token: string | null) => JSON.stringify([kidId, token]);
const tokenScope = (token: string | null) => JSON.stringify([token]);

function add(map: Map<string, Set<Listener>>, key: string, listener: Listener) {
  const listeners = map.get(key) ?? new Set<Listener>();
  listeners.add(listener); map.set(key, listeners);
  return () => { listeners.delete(listener); if (listeners.size === 0) map.delete(key); };
}

/** In-memory invalidation only; no child identity or session token is persisted or broadcast. */
export function subscribeSocialUpdates(kidId: string, token: string | null, listener: Listener) {
  return add(scopes, scope(kidId, token), listener);
}
/** Every child of this session (the guardian's safety notices span all of them). */
export function subscribeTokenSocialUpdates(token: string | null, listener: Listener) {
  return add(tokenScopes, tokenScope(token), listener);
}
export function publishSocialUpdate(kidId: string, token: string | null) {
  for (const listener of [...(scopes.get(scope(kidId, token)) ?? [])]) listener();
  for (const listener of [...(tokenScopes.get(tokenScope(token)) ?? [])]) listener();
}

/*
 * The only origins the SPA will load KartRush from.
 *
 * Core hands the SPA a `game.url` with each session, but a URL that arrives over
 * the network is data, not authority: a compromised or misconfigured Core must
 * not be able to point the learner's browser (and the MessagePort that carries
 * their game saves) at an arbitrary site. So the list is hard-coded here, exact
 * origins only, and a URL outside it is refused before an iframe is ever built.
 * The game applies the mirror check to the SPA's origin (EMBED_ALLOWED_ORIGINS).
 *
 * The two localhost entries are the game's local dev and preview servers; the
 * 5174 entry is the game's Vite server. Production is the Railway service and
 * its custom domain (the owner's DNS action, design §8).
 */
export const KARTRUSH_ALLOWED_ORIGINS: readonly string[] = [
  'https://kartrush-production.up.railway.app',
  'https://game-b2c.littlefounders.ai',
  'http://localhost:4010',
  'http://127.0.0.1:4010',
  'http://localhost:5174',
];

export interface AcceptedGameUrl {
  /** The URL as Core gave it, normalised by the URL parser. */
  readonly href: string;
  /** The origin the handshake posts to; always an entry of the allow-list. */
  readonly origin: string;
}

/**
 * The URL when it is an absolute http(s) URL with no credentials whose origin is
 * on the allow-list; otherwise null. `new URL` resolves lookalikes before the
 * comparison (userinfo tricks, a trailing dot, an uppercase host), and the
 * comparison is on the parsed `origin`, never on a string prefix.
 */
export function acceptGameUrl(candidate: unknown, allowed: readonly string[] = KARTRUSH_ALLOWED_ORIGINS): AcceptedGameUrl | null {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username !== '' || url.password !== '') return null;
  return allowed.includes(url.origin) ? { href: url.href, origin: url.origin } : null;
}

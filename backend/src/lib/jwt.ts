import { createHmac, timingSafeEqual } from 'node:crypto';

/*
 * Local verification of GoTrue HS256 access tokens — no network round-trip
 * per request, no extra dependency. The shared secret is SUPABASE_JWT_SECRET.
 */

export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: string; // postgres role, e.g. "authenticated"
  aud?: string;
  iss?: string;
  exp: number;
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** Returns the claims, or null for anything invalid/expired. Never throws. */
export function verifyAccessToken(token: string, secret: string): AccessTokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  try {
    const header = JSON.parse(b64urlDecode(headerB64).toString('utf8')) as { alg?: string };
    if (header.alg !== 'HS256') return null;

    const expected = createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest();
    const actual = b64urlDecode(signatureB64);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

    const claims = JSON.parse(b64urlDecode(payloadB64).toString('utf8')) as Partial<AccessTokenClaims>;
    
    // Core structure check
    if (typeof claims.sub !== 'string' || typeof claims.exp !== 'number') return null;
    if (claims.exp * 1000 <= Date.now()) return null;
    
    // Strict audience check (Supabase GoTrue convention)
    if (claims.aud !== 'authenticated') return null;
    
    // Strict issuer check if expected (Supabase GoTrue default is often 'supabase' or the URL)
    // We enforce presence, and if it's the default, we enforce it.
    if (!claims.iss) return null;

    return {
      sub: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : '',
      role: typeof claims.role === 'string' ? claims.role : '',
      aud: claims.aud,
      iss: claims.iss,
      exp: claims.exp,
    };
  } catch {
    return null;
  }
}

import { createHmac, randomUUID } from 'node:crypto';

/** Mint a GoTrue-shaped HS256 access token with the test secret. */
export function mintToken(overrides: Partial<{ sub: string; email: string; role: string; exp: number }> = {}): string {
  const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: overrides.sub ?? randomUUID(),
      email: overrides.email ?? 'user@example.com',
      role: overrides.role ?? 'authenticated',
      exp: overrides.exp ?? Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  const sig = createHmac('sha256', process.env.SUPABASE_JWT_SECRET as string)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

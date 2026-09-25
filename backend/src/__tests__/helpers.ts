import { createHmac, randomUUID } from 'node:crypto';

/** Mint a GoTrue-shaped HS256 access token with the test secret. */
export function mintToken(
  overrides: Partial<{
    sub: string;
    email: string;
    role: string;
    exp: number;
    is_anonymous: boolean;
    amr: { method: string; timestamp: number }[];
  }> = {},
): string {
  const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: overrides.sub ?? randomUUID(),
      email: overrides.email ?? 'user@example.com',
      role: overrides.role ?? 'authenticated',
      aud: 'authenticated',
      iss: 'supabase',
      exp: overrides.exp ?? Math.floor(Date.now() / 1000) + 3600,
      ...(overrides.is_anonymous !== undefined ? { is_anonymous: overrides.is_anonymous } : {}),
      ...(overrides.amr !== undefined ? { amr: overrides.amr } : {}),
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

/**
 * E.6: answers the account-erasure calls (lifecycle RPCs, Oracle, Depot,
 * warehouse) for suites whose own stubs predate the erasure lifecycle. Returns
 * null for any other URL so the suite's stub keeps handling it. `coreFails`
 * makes the database erasure itself fail. The full lifecycle is exercised in
 * accountDeletion.test.ts and against PostgreSQL in the database verify script.
 */
export function erasureStubResponse(url: string, opts: { coreFails?: boolean; subject?: string } = {}): Response | null {
  const row = (status: string) => ({
    id: '99999999-9999-4999-8999-999999999999', subject_id: opts.subject ?? '22222222-2222-4222-8222-222222222222',
    population: 'kid', initiated_by: 'guardian', status, requested_at: '2026-09-24T00:00:00.000Z',
    scheduled_for: '2026-09-24T00:00:00.000Z', started_at: '2026-09-24T00:00:00.000Z', attempts: 1, held_reason: null,
    steps: status === 'processing' ? {} : { oracle: {}, core: {}, depot: {}, dataintel: {} }, depot_paths: [], anon_ids: [],
    last_error: null, cancelled_at: null, completed_at: status === 'completed' ? '2026-09-24T00:00:00.000Z' : null,
  });
  if (url.endsWith('/rpc/request_account_deletion')) return jsonResponse(200, row('pending'));
  if (url.endsWith('/rpc/claim_account_deletion')) return jsonResponse(200, row('processing'));
  if (url.endsWith('/rpc/erase_account_data')) return opts.coreFails ? jsonResponse(500, { message: 'down' }) : jsonResponse(200, { account: 1 });
  if (url.includes('/account_deletion_requests?id=eq.')) return jsonResponse(200, [{ ...row('processing'), steps: { oracle: {}, core: { account: 1 } } }]);
  if (url.endsWith('/rpc/record_account_deletion_step')) return jsonResponse(200, true);
  if (url.endsWith('/rpc/complete_account_deletion')) return jsonResponse(200, row('completed'));
  if (url.includes('/api/v1/tutor/erasure')) return jsonResponse(200, { data: { live: 0, parked: 0 }, error: null });
  if (url.includes('/api/v1/intel/erasure')) return jsonResponse(200, { data: {}, error: null });
  return null;
}

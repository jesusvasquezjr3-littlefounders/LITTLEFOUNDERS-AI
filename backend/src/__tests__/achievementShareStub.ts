import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import { jsonResponse } from './helpers.js';

/*
 * Synthetic transport for the OD-20 achievement-image route. Every request
 * Core makes is recorded, so a test can prove not only the response but
 * what did and did NOT reach PostgREST and Depot (no badge_shares write, no
 * stored Depot object, exactly the minimized renderer body).
 */

export const KID_ID = randomUUID();
export const PARENT_ID = randomUUID();
export const GOAL_ID = randomUUID();

/** A real 8-byte PNG signature plus a little payload — enough for Core's PNG check. */
export const FAKE_PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('IHDR-fake-image')]);

export interface AchievementStubOptions {
  roles?: string[];
  /** Latest parent_verifications row; null = none on file. */
  verification?: Record<string, unknown> | null;
  guardianLinked?: boolean;
  /** Linked on the first guardian read, unlinked on every later one (revoked mid-request). */
  guardianRevokedMidRequest?: boolean;
  displayName?: string | null;
  courseBadges?: { course_slug: string; course_title: Record<string, string>; badge_asset: string; completed_at: string }[];
  streakDays?: number;
  goal?: Record<string, unknown> | null;
  renderStatus?: number;
  renderContentType?: string;
  renderBody?: Buffer;
  initiationFails?: boolean;
}

export interface RecordedCall {
  method: string;
  url: string;
  body: string | undefined;
}

export function stubAchievementTransport(opts: AchievementStubOptions = {}): RecordedCall[] {
  const calls: RecordedCall[] = [];
  let guardianReads = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ method, url, body: typeof init?.body === 'string' ? init.body : undefined });

      if (url.includes('/parent_verifications?')) {
        const row = opts.verification === undefined ? { status: 'verified', method: 'local-ocr', birth_date: '1990-01-01' } : opts.verification;
        return Promise.resolve(jsonResponse(200, row === null ? [] : [row]));
      }
      if (url.includes('/rest/v1/user_roles?user_id=eq.')) {
        return Promise.resolve(jsonResponse(200, (opts.roles ?? ['parent']).map((role) => ({ role }))));
      }
      if (url.includes('/rest/v1/guardian_links?parent_user_id=eq.')) {
        guardianReads += 1;
        const linked = opts.guardianRevokedMidRequest ? guardianReads === 1 : opts.guardianLinked !== false;
        return Promise.resolve(jsonResponse(200, linked ? [{ parent_user_id: PARENT_ID, kid_user_id: KID_ID, verification_status: 'verified' }] : []));
      }
      if (url.includes('/rest/v1/profiles?user_id=')) {
        const displayName = opts.displayName === undefined ? 'Sofía García López' : opts.displayName;
        return Promise.resolve(jsonResponse(200, [{ user_id: KID_ID, display_name: displayName, username: 'sofia', birth_date: '2017-03-02' }]));
      }
      if (url.includes('/rpc/get_completed_course_badges')) {
        return Promise.resolve(jsonResponse(200, opts.courseBadges ?? []));
      }
      if (url.includes('/rest/v1/savings_goals?id=eq.')) {
        const rows = opts.goal === null ? [] : [opts.goal ?? { id: GOAL_ID, kid_user_id: KID_ID, title: 'A bike', target: 50, icon: 'bike', status: 'reached', created_at: '2026-09-01', reached_at: '2026-09-08' }];
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/learning_stats?user_id=eq.')) {
        return Promise.resolve(jsonResponse(200, [
          { user_id: KID_ID, xp_points: 100, lessons_completed: 5, streak_days: opts.streakDays ?? 7, longest_streak: 7, last_active_date: '2026-09-01' },
        ]));
      }
      if (url.includes(':4006/api/v1/badges/render')) {
        return Promise.resolve(new Response(new Uint8Array(opts.renderBody ?? FAKE_PNG), {
          status: opts.renderStatus ?? 200,
          headers: { 'content-type': opts.renderContentType ?? 'image/png' },
        }));
      }
      if (url.includes('/rest/v1/achievement_share_initiations')) {
        return Promise.resolve(opts.initiationFails ? jsonResponse(500, { message: 'down' }) : new Response(null, { status: 201 }));
      }
      return Promise.resolve(new Response(null, { status: 201 }));
    }),
  );
  return calls;
}

/** supertest body parser that keeps a binary (PNG) response as a Buffer. */
export function binaryParser(res: unknown, callback: (err: Error | null, body: Buffer) => void): void {
  const stream = res as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
}

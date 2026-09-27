import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';
import { binaryParser, FAKE_PNG, GOAL_ID, KID_ID, PARENT_ID, stubAchievementTransport } from './achievementShareStub.js';

/*
 * POST /api/v1/family/kids/:kidId/achievement-image — the OD-20 share
 * action (Product 10 F.1). The parent receives the rendered PNG in the
 * response and sends it themselves; nothing about the image is persisted.
 * The retired link issuer (POST .../badge) answers 410. Population and
 * standing-constraint coverage lives in achievementSharingConstraints.test.ts.
 */

afterEach(() => vi.unstubAllGlobals());

function post(body: unknown, sub = PARENT_ID) {
  return request(createApp())
    .post(`/api/v1/family/kids/${KID_ID}/achievement-image`)
    .set('Authorization', `Bearer ${mintToken({ sub })}`)
    .buffer(true)
    .parse(binaryParser)
    .send(body as string | object);
}

function jsonBody(res: request.Response): { data: unknown; error: { code: string } | null } {
  return JSON.parse((res.body as Buffer).toString('utf8')) as { data: unknown; error: { code: string } | null };
}

function rendererBody(calls: { url: string; body: string | undefined }[]): Record<string, unknown> {
  const call = calls.find((c) => c.url.includes('/api/v1/badges/render'));
  if (!call?.body) throw new Error('Depot renderer was not called');
  return JSON.parse(call.body) as Record<string, unknown>;
}

const COMPLETED = [
  { course_slug: 'financial-education', course_title: { 'en-US': 'Financial Education', 'es-MX': 'Educación Financiera' }, badge_asset: 'x.png', completed_at: '2026-09-01' },
];

describe('POST /api/v1/family/kids/:kidId/achievement-image', () => {
  it('hands the parent the PNG itself, private and uncacheable, with no link or token', async () => {
    stubAchievementTransport({ courseBadges: COMPLETED });
    const res = await post({ kind: 'course_badge', courseSlug: 'financial-education', locale: 'es-MX', handoff: 'share_sheet' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toBe('no-store, private');
    expect(res.headers['content-disposition']).toBe('attachment; filename="littlefounders-achievement.png"');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect((res.body as Buffer).equals(FAKE_PNG)).toBe(true);
    const text = (res.body as Buffer).toString('latin1');
    expect(text).not.toContain('/badge/');
    expect(text).not.toContain('utm_campaign');
  });

  it('localizes the server-derived label and passes the locale to the renderer', async () => {
    const calls = stubAchievementTransport({ courseBadges: COMPLETED });
    await post({ kind: 'course_badge', courseSlug: 'financial-education', locale: 'es-MX', handoff: 'download' });
    expect(rendererBody(calls)).toEqual({ kind: 'course_badge', label: 'Educación Financiera', firstName: 'Sofía', locale: 'es-MX' });
  });

  it('builds streak and goal labels server-side, in coins never money', async () => {
    let calls = stubAchievementTransport({ streakDays: 12 });
    expect((await post({ kind: 'streak', locale: 'pt-BR', handoff: 'download' })).status).toBe(200);
    expect(rendererBody(calls).label).toBe('Sequência de 12 dias');

    calls = stubAchievementTransport();
    expect((await post({ kind: 'goal_reached', goalId: GOAL_ID, locale: 'en-US', handoff: 'share_sheet' })).status).toBe(200);
    expect(rendererBody(calls).label).toBe('Saved 50 coins for "A bike"');

    calls = stubAchievementTransport();
    expect((await post({ kind: 'goal_reached', goalId: GOAL_ID, locale: 'es-MX', handoff: 'share_sheet' })).status).toBe(200);
    expect(rendererBody(calls).label).toBe('Ahorró 50 monedas para "A bike"');
  });

  it('shortens a label past the renderer ceiling instead of failing', async () => {
    const calls = stubAchievementTransport({
      goal: { id: GOAL_ID, kid_user_id: KID_ID, title: 'x'.repeat(60), target: 50, icon: 'bike', status: 'reached', created_at: '2026-09-01', reached_at: '2026-09-08' },
    });
    expect((await post({ kind: 'goal_reached', goalId: GOAL_ID, locale: 'en-US', handoff: 'download' })).status).toBe(200);
    expect((rendererBody(calls).label as string).length).toBe(80);
  });

  it('records one share initiated by hand-off and kind — no user, kid or image identifier', async () => {
    const calls = stubAchievementTransport({ streakDays: 7 });
    expect((await post({ kind: 'streak', locale: 'en-US', handoff: 'download' })).status).toBe(200);
    await vi.waitFor(() => expect(calls.some((c) => c.url.includes('/achievement_share_initiations'))).toBe(true));
    const write = calls.find((c) => c.url.includes('/achievement_share_initiations'));
    expect(write?.method).toBe('POST');
    expect(JSON.parse(write?.body ?? '{}')).toEqual({ achievement_kind: 'streak', handoff: 'download' });
  });

  it('OD-9 4.2: counts nothing for a migrated child without that consent, and still hands over the image', async () => {
    const calls = stubAchievementTransport({ streakDays: 7, practiceApplies: false });
    expect((await post({ kind: 'streak', locale: 'en-US', handoff: 'download' })).status).toBe(200);
    await vi.waitFor(() => expect(calls.some((c) => c.url.includes('/rpc/data_practice_applies'))).toBe(true));
    const asked = calls.find((c) => c.url.includes('/rpc/data_practice_applies'));
    expect(JSON.parse(asked?.body ?? '{}')).toEqual({ p_subject: KID_ID, p_practice: 'analytics.achievement_share_initiations' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls.some((c) => c.url.includes('/achievement_share_initiations'))).toBe(false);
  });

  it('still hands over the image when the metric write fails, and logs the gap', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubAchievementTransport({ streakDays: 7, initiationFails: true });
    expect((await post({ kind: 'streak', locale: 'en-US', handoff: 'share_sheet' })).status).toBe(200);
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith('[achievement-sharing] share initiation was not recorded'));
    error.mockRestore();
  });

  it('requires a declared hand-off and refuses unknown fields', async () => {
    stubAchievementTransport();
    for (const body of [
      { kind: 'streak', locale: 'en-US' },
      { kind: 'streak', locale: 'en-US', handoff: 'link' },
      { kind: 'streak', locale: 'en-US', handoff: 'download', label: 'Client label' },
      { kind: 'streak', locale: 'en-US', handoff: 'download', firstName: 'Sofía García' },
    ]) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(jsonBody(res).error?.code).toBe('VALIDATION_ERROR');
    }
  });

  it('refuses (never substitutes a placeholder) when Depot fails or answers something that is not our PNG', async () => {
    for (const opts of [
      { renderStatus: 502 },
      { renderContentType: 'text/html' },
      { renderBody: Buffer.from('<html>not a png</html>') },
    ]) {
      stubAchievementTransport({ streakDays: 7, ...opts });
      const res = await post({ kind: 'streak', locale: 'en-US', handoff: 'download' });
      expect(res.status, JSON.stringify(opts)).toBe(502);
      expect(jsonBody(res).error?.code).toBe('DATA_UNAVAILABLE');
    }
  });

  it('refuses a kid whose profile has no usable first name', async () => {
    stubAchievementTransport({ displayName: '   ' });
    const res = await post({ kind: 'streak', locale: 'en-US', handoff: 'download' });
    expect(res.status).toBe(502);
  });
});

describe('POST /api/v1/family/kids/:kidId/badge (retired link issuer)', () => {
  it('answers 410 before reading, rendering or storing anything', async () => {
    const calls = stubAchievementTransport({ courseBadges: COMPLETED });
    const res = await request(createApp())
      .post(`/api/v1/family/kids/${KID_ID}/badge`)
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT_ID })}`)
      .send({ kind: 'course_badge', courseSlug: 'financial-education' });
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('SHARE_LINKS_RETIRED');
    expect(calls.some((c) => c.url.includes(':4006/'))).toBe(false);
    expect(calls.some((c) => c.url.includes('/badge_shares'))).toBe(false);
    expect(calls.some((c) => c.url.includes('/profiles?') || c.url.includes('get_completed_course_badges'))).toBe(false);
  });
});

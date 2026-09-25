import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACHIEVEMENT_IMAGE_FILENAME,
  handOffAchievementImage,
  preferredHandoff,
  requestAchievementImage,
  shareAchievementImage,
} from './achievementImage';

/*
 * OD-20's client hand-off: the picture goes to the device share sheet when it
 * accepts image files, otherwise it downloads; a dismissed sheet is a
 * cancellation, never a failure and never an unasked-for download. No URL is
 * ever produced or shared.
 */

const png = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2])], { type: 'image/png' });

// jsdom has no object-URL API; the browser's is stood in for per test.
const objectUrls = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
function stubObjectUrl(value: string) {
  Object.assign(URL, { createObjectURL: vi.fn(() => value), revokeObjectURL: vi.fn() });
}
afterEach(() => {
  vi.restoreAllMocks();
  Object.assign(URL, { createObjectURL: objectUrls.create, revokeObjectURL: objectUrls.revoke });
});

function fakeDocument() {
  const clicks: { href: string; download: string }[] = [];
  const doc = {
    createElement: () => {
      const anchor = { href: '', download: '', rel: '', style: {} as Record<string, string>, click: () => clicks.push({ href: anchor.href, download: anchor.download }), remove: () => undefined };
      return anchor;
    },
    body: { append: () => undefined },
  } as unknown as Document;
  return { doc, clicks };
}

describe('preferredHandoff', () => {
  it('offers the share sheet only when it can take an image file', () => {
    expect(preferredHandoff({ share: vi.fn(), canShare: () => true })).toBe('share_sheet');
    expect(preferredHandoff({ share: vi.fn(), canShare: () => false })).toBe('download');
    expect(preferredHandoff({ share: vi.fn() })).toBe('download');
    expect(preferredHandoff({})).toBe('download');
    expect(preferredHandoff({ share: vi.fn(), canShare: () => { throw new Error('no'); } })).toBe('download');
  });
});

describe('requestAchievementImage', () => {
  it('posts the achievement and the declared hand-off to the guardian route with the session', async () => {
    const fetchImpl = vi.fn(async () => new Response(png(), { status: 200, headers: { 'content-type': 'image/png' } }));
    const result = await requestAchievementImage({
      baseUrl: 'https://core.test', token: 'session', kidId: 'kid-1', handoff: 'download',
      request: { kind: 'goal_reached', goalId: 'g-1', locale: 'es-MX' }, fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith('https://core.test/api/v1/family/kids/kid-1/achievement-image', {
      method: 'POST',
      headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'goal_reached', goalId: 'g-1', locale: 'es-MX', handoff: 'download' }),
    });
  });

  it('surfaces the server refusal code, and treats a non-PNG success as a failure', async () => {
    const refused = vi.fn(async () => new Response(JSON.stringify({ data: null, error: { code: 'FORBIDDEN' } }), { status: 403, headers: { 'content-type': 'application/json' } }));
    expect(await requestAchievementImage({ baseUrl: '', token: 't', kidId: 'k', handoff: 'download', request: { kind: 'streak', locale: 'en-US' }, fetchImpl: refused }))
      .toEqual({ ok: false, code: 'FORBIDDEN' });
    const html = vi.fn(async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    expect(await requestAchievementImage({ baseUrl: '', token: 't', kidId: 'k', handoff: 'download', request: { kind: 'streak', locale: 'en-US' }, fetchImpl: html }))
      .toEqual({ ok: false, code: 'INTERNAL' });
    const offline = vi.fn(async () => { throw new TypeError('offline'); });
    expect(await requestAchievementImage({ baseUrl: '', token: 't', kidId: 'k', handoff: 'download', request: { kind: 'streak', locale: 'en-US' }, fetchImpl: offline }))
      .toEqual({ ok: false, code: 'INTERNAL' });
  });
});

describe('handOffAchievementImage', () => {
  it('shares the picture as a PNG file, with no URL', async () => {
    const share = vi.fn(async (_data: ShareData) => undefined);
    const outcome = await handOffAchievementImage(png(), 'share_sheet', { title: 'Share achievement', nav: { share, canShare: () => true } });
    expect(outcome).toBe('shared');
    const data = share.mock.calls[0]![0];
    expect(data.url).toBeUndefined();
    expect(data.files).toHaveLength(1);
    expect(data.files![0]!.name).toBe(ACHIEVEMENT_IMAGE_FILENAME);
    expect(data.files![0]!.type).toBe('image/png');
  });

  it('treats a dismissed share sheet as cancelled and downloads nothing', async () => {
    const { doc, clicks } = fakeDocument();
    const share = vi.fn(async () => { throw new DOMException('dismissed', 'AbortError'); });
    expect(await handOffAchievementImage(png(), 'share_sheet', { title: 't', nav: { share }, doc })).toBe('cancelled');
    expect(clicks).toHaveLength(0);
  });

  it('falls back to a download when the share sheet refuses for another reason', async () => {
    const { doc, clicks } = fakeDocument();
    stubObjectUrl('blob:local-1');
    const share = vi.fn(async () => { throw new DOMException('no activation', 'NotAllowedError'); });
    expect(await handOffAchievementImage(png(), 'share_sheet', { title: 't', nav: { share }, doc })).toBe('downloaded');
    expect(clicks).toEqual([{ href: 'blob:local-1', download: ACHIEVEMENT_IMAGE_FILENAME }]);
  });

  it('downloads a local object URL — never a company-hosted one', async () => {
    const { doc, clicks } = fakeDocument();
    stubObjectUrl('blob:local-2');
    expect(await handOffAchievementImage(png(), 'download', { title: 't', nav: {}, doc })).toBe('downloaded');
    expect(clicks[0]!.href.startsWith('blob:')).toBe(true);
  });
});

describe('shareAchievementImage', () => {
  it('declares the hand-off the device offers, then hands over what Core rendered', async () => {
    const fetchImpl = vi.fn(async () => new Response(png(), { status: 200, headers: { 'content-type': 'image/png' } }));
    const share = vi.fn(async () => undefined);
    const outcome = await shareAchievementImage({
      baseUrl: '', token: 't', kidId: 'k', title: 'Share achievement', request: { kind: 'streak', locale: 'en-US' },
      fetchImpl, nav: { share, canShare: () => true },
    });
    expect(outcome).toBe('shared');
    expect(JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body)).handoff).toBe('share_sheet');
  });

  it('reports failure without touching the share sheet when Core refuses', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: null, error: { code: 'NOT_FOUND' } }), { status: 404 }));
    const share = vi.fn();
    expect(await shareAchievementImage({ baseUrl: '', token: 't', kidId: 'k', title: 't', request: { kind: 'streak', locale: 'en-US' }, fetchImpl, nav: { share, canShare: () => true } }))
      .toBe('failed');
    expect(share).not.toHaveBeenCalled();
  });
});

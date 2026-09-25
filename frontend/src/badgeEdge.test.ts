import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import badgeHandler, { BADGE_LINK_ROUTE_RETIRES_AT } from '../api/badge/[token]';

const token = 'a'.repeat(32);
const shell = '<html><head><title>LittleFounders</title><meta name="robots" content="noindex, follow" /></head><body><div id="root"></div></body></html>';

// Pinned inside the legacy window (after the OD-20 cutover, before the
// retirement date) so these cases do not change meaning on 24 October 2026.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T12:00:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stubBadge(status: number, data?: unknown) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    if (String(input).endsWith('/app-shell.html')) {
      return Promise.resolve(new Response(shell, { status: 200 }));
    }
    return Promise.resolve(new Response(data === undefined ? null : JSON.stringify({ data }), {
      status,
      headers: { 'content-type': 'application/json' },
    }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function expectPrivate(response: Response) {
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
}

describe('public badge edge response', () => {
  it('404s malformed tokens without looking up a child', async () => {
    const fetchMock = stubBadge(404);
    const response = await badgeHandler(new Request('https://littlefounders.ai/badge/short'));

    expect(response.status).toBe(404);
    expectPrivate(response);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await response.text()).not.toContain('og:image');
  });

  it('404s a removed share with no child Open Graph fields', async () => {
    stubBadge(404);
    const response = await badgeHandler(new Request(`https://littlefounders.ai/badge/${token}`));

    expect(response.status).toBe(404);
    expectPrivate(response);
    expect(await response.text()).not.toContain('og:image');
  });

  it('does not cache an active share or its lookup', async () => {
    const fetchMock = stubBadge(200, {
      firstName: 'Sofía',
      achievementKind: 'streak',
      achievementLabel: '7-day streak',
      imageUrl: 'https://media.example/badge.png',
    });
    const response = await badgeHandler(new Request(`https://littlefounders.ai/badge/${token}`));
    const html = await response.text();

    expect(response.status).toBe(200);
    expectPrivate(response);
    expect(html).toContain('<meta name="robots" content="noindex, follow" />');
    expect(html).toContain('Sofía');
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:4000/api/v1/badges/${token}`,
      { cache: 'no-store' },
    );
  });

  it('is retired from the dated removal: 410, private headers, and Core is never asked', async () => {
    vi.setSystemTime(new Date(BADGE_LINK_ROUTE_RETIRES_AT));
    const fetchMock = stubBadge(200, {
      firstName: 'Sofía',
      achievementKind: 'streak',
      achievementLabel: '7-day streak',
      imageUrl: 'https://media.example/badge.png',
    });
    const response = await badgeHandler(new Request(`https://littlefounders.ai/badge/${token}`));

    expect(response.status).toBe(410);
    expectPrivate(response);
    expect(await response.text()).not.toContain('Sofía');
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(['https://littlefounders.ai/app-shell.html']);
  });
});

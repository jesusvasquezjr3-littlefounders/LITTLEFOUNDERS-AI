import { afterEach, describe, expect, it, vi } from 'vitest';
import badgeHandler from '../api/badge/[token]';

const token = 'a'.repeat(32);
const shell = '<html><head><title>LittleFounders</title><meta name="robots" content="noindex, follow" /></head><body><div id="root"></div></body></html>';

afterEach(() => vi.unstubAllGlobals());

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
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import badgeHandler, { BADGE_LINK_ROUTE_RETIRES_AT, BADGE_UNFURL_COPY, badgeUnfurlCopy } from '../api/badge/[token]';

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

/*
 * GAP-FIX-R4 (Bible 02 section 1.2, rule 16): the unfurl is written in the
 * locale Core localized the label in, never fixed English, and with no em
 * dash in any locale.
 */
describe('badge unfurl copy', () => {
  const EM_DASH = String.fromCharCode(0x2014);
  const meta = (html: string, key: string) => new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`).exec(html)?.[1] ?? null;

  async function unfurl(locale: string | undefined, label: string) {
    stubBadge(200, { firstName: 'Sofía', achievementKind: 'streak', achievementLabel: label, imageUrl: 'https://media.example/badge.png', ...(locale ? { locale } : {}) });
    const response = await badgeHandler(new Request(`https://littlefounders.ai/badge/${token}`));
    return response.text();
  }

  it('every locale has a title and a description with no em dash', () => {
    expect(Object.keys(BADGE_UNFURL_COPY).sort()).toEqual(['en-US', 'es-MX', 'pt-BR']);
    for (const copy of Object.values(BADGE_UNFURL_COPY)) {
      for (const text of [copy.title('Ana', 'X'), copy.description('Ana', 'X')]) {
        expect(text).not.toContain(EM_DASH);
        expect(text).toContain('Ana');
        expect(text).toContain('X');
      }
    }
  });

  it.each([
    ['es-MX', 'Racha de 7 días', 'es_MX', 'acaba de lograr Racha de 7 días en LittleFounders'],
    ['pt-BR', 'Sequência de 7 dias', 'pt_BR', 'acabou de conquistar Sequência de 7 dias no LittleFounders'],
    ['en-US', '7-day streak', 'en_US', 'just earned 7-day streak on LittleFounders'],
  ])('writes the %s unfurl in its own language', async (locale, label, ogLocale, phrase) => {
    const html = await unfurl(locale, label);
    expect(meta(html, 'og:description')).toContain(phrase);
    expect(meta(html, 'twitter:description')).toBe(meta(html, 'og:description'));
    expect(meta(html, 'og:title')).toBe(`Sofía: ${label} · LittleFounders`);
    expect(meta(html, 'og:locale')).toBe(ogLocale);
    expect(html).not.toContain(EM_DASH);
  });

  it('falls back to English for a missing or unknown locale', async () => {
    expect(badgeUnfurlCopy(undefined)).toBe(BADGE_UNFURL_COPY['en-US']);
    expect(badgeUnfurlCopy('fr-FR')).toBe(BADGE_UNFURL_COPY['en-US']);
    expect(badgeUnfurlCopy('toString')).toBe(BADGE_UNFURL_COPY['en-US']);
    const html = await unfurl(undefined, '7-day streak');
    expect(meta(html, 'og:locale')).toBe('en_US');
    expect(meta(html, 'og:description')).toContain('just earned 7-day streak');
  });
});

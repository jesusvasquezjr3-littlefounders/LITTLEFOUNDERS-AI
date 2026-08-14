import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { classifyUserAgent, isBotUserAgent } from '../services/botDetection.js';
import { resetExclusionsForTests } from '../services/analyticsExclusions.js';
import { jsonResponse } from './helpers.js';

/*
 * Non-human traffic. Plausible and GA4 drop known crawlers before storage;
 * our own ingest did not, so the dataset we fully control was the least
 * defended of the three.
 *
 * The false-positive direction matters more than the false-negative one: a
 * missed crawler inflates a number, but a misclassified human DELETES a real
 * session, and nothing downstream can tell it ever existed. Hence the second
 * block below.
 */

const REAL_BROWSERS = [
  // macOS Chrome
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  // iPhone Safari
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  // Android Chrome
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
  // Windows Edge
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0',
  // Firefox
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
  // iPad
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1',
];

const BOTS = [
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Twitterbot/1.0',
  'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36',
  'curl/8.4.0',
  'python-requests/2.31.0',
  'Go-http-client/2.0',
  'PostmanRuntime/7.36.0',
  'Mozilla/5.0 (compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)',
  'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
];

describe('classifyUserAgent', () => {
  it('recognises crawlers, scanners, automation and scripted clients', () => {
    const missed = BOTS.filter((agent) => !isBotUserAgent(agent));
    expect(missed, `these were not detected: ${missed.join(' | ')}`).toEqual([]);
  });

  it('NEVER classifies a real browser as a bot', () => {
    // A false positive silently deletes a human's session. This is the
    // assertion that must never be relaxed to catch one more crawler.
    const wrong = REAL_BROWSERS.filter((agent) => isBotUserAgent(agent));
    expect(wrong, `these humans were misclassified: ${wrong.join(' | ')}`).toEqual([]);
  });

  it('treats a missing agent as non-human, and says which rule fired', () => {
    // Every browser sends one; the beacon only runs inside a browser.
    expect(classifyUserAgent(undefined)).toEqual({ isBot: true, reason: 'missing_user_agent' });
    expect(classifyUserAgent('   ')).toEqual({ isBot: true, reason: 'missing_user_agent' });
    expect(classifyUserAgent('Googlebot')).toEqual({ isBot: true, reason: 'user_agent' });
    expect(classifyUserAgent(REAL_BROWSERS[0]!)).toEqual({ isBot: false, reason: null });
  });

  it('does not match "bot" inside an ordinary word', () => {
    // "Robot" and "Abbot" appear in product names; a naive /bot/ would eat them.
    expect(isBotUserAgent('Mozilla/5.0 (Macintosh) Abbotsford/1.0 Safari/537.36')).toBe(false);
  });
});

describe('the ingest and tracker gates honour it', () => {
  function stub() {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/rest/v1/analytics_ip_exclusions')) return Promise.resolve(jsonResponse(200, []));
        return Promise.resolve(jsonResponse(200, {}));
      }),
    );
  }
  beforeEach(() => {
    resetExclusionsForTests();
    stub();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetExclusionsForTests();
  });

  const batch = {
    anonId: '44444444-4444-4444-8444-444444444444',
    events: [{ event: 'page_view', routeClass: 'marketing' }],
  };

  it('drops a crawler batch without storing anything', async () => {
    const res = await request(createApp())
      .post('/api/v1/events')
      .set('User-Agent', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
      .send(batch);
    expect(res.status).toBe(202);
    expect(res.body.data).toEqual({ accepted: 0 });
  });

  it('tells a crawler not to load any tracker', async () => {
    const res = await request(createApp())
      .get('/api/v1/analytics/tracking-decision')
      .set('User-Agent', 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ excluded: true, degraded: false });
  });

  it('leaves a real browser alone at both gates', async () => {
    const human = REAL_BROWSERS[0]!;
    const decision = await request(createApp())
      .get('/api/v1/analytics/tracking-decision')
      .set('User-Agent', human);
    expect(decision.body.data.excluded).toBe(false);

    const ingest = await request(createApp()).post('/api/v1/events').set('User-Agent', human).send(batch);
    // Reaches the real pipeline rather than being dropped at the gate.
    expect(ingest.status).toBe(202);
  });
});

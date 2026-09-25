import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { RECORDABLE_EVENTS } from '../services/insights.js';
import { jsonResponse } from './helpers.js';

/*
 * OD-20: Appendix L counts achievement shares INITIATED, never viewer reach.
 * `badge_link_click` (a stranger opening a legacy badge link) is no longer
 * accepted from anyone — the anonymous beacon drops it while still storing
 * an ordinary acquisition event in the same batch.
 */

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

afterEach(() => vi.unstubAllGlobals());

function stub() {
  const writes: string[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if ((init?.method ?? 'GET') === 'POST' && url.includes('/learning_events')) {
      writes.push(String(init?.body));
      return Promise.resolve(jsonResponse(201, []));
    }
    return Promise.resolve(jsonResponse(200, []));
  }));
  return writes;
}

describe('viewer reach is never recorded', () => {
  it('is not a recordable event at all', () => {
    expect((RECORDABLE_EVENTS as readonly string[]).includes('badge_link_click')).toBe(false);
  });

  it('drops an anonymous badge_link_click and keeps the page_view beside it', async () => {
    const writes = stub();
    const res = await request(createApp())
      .post('/api/v1/events')
      .set('User-Agent', BROWSER_UA)
      .send({
        anonId: '55555555-5555-4555-8555-555555555555',
        events: [
          { event: 'badge_link_click', routeClass: 'marketing' },
          { event: 'page_view', routeClass: 'marketing' },
        ],
      });
    expect(res.status).toBe(202);
    expect(writes.join('\n')).not.toContain('badge_link_click');
    expect(writes.join('\n')).toContain('page_view');
  });
});

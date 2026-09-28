import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { adminRouter } from '../routes/admin.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * G.6 / Appendix N 1.3 (Standing-Constraint Integrity), at runtime. The
 * static half is agent/tools/check-staff-standing-constraints.mjs (spec:check,
 * repo-gates). Here every staff GET route is called as a superadmin holding
 * every staff grant, with the database stubbed, and:
 *   - no request any route makes reads a Mentor transcript or a per-account
 *     wallet/banking table;
 *   - no answer carries a transcript, utterance, balance or ledger field;
 *   - no staff route, of any verb, is an impersonation or login-as path.
 */

const STAFF_ID = '55555555-5555-4555-8555-555555555555';
const PARAM = '66666666-6666-4666-8666-666666666666';
const FORBIDDEN_READ = /tutor_turns|\/transcripts?(?![\w-])|\/turns(?![\w-])|\/(?:wallet_ledger|wallet_guardian_actions|wallet_self_actions|banking_accounts|savings_goals|redemptions|redemption_catalog|spend_limits|allowance_rules|family_money_events)\b/;
const FORBIDDEN_FIELD = /"(?:transcript|transcripts|utterance|utterances|turns|turn_text|content_md|balance|balances|ledger|wallet_ledger)"\s*:/;
const IMPERSONATION = /impersonat|act[-_]?as|login[-_]?as|sudo/i;

interface Layer { route?: { path: string | string[]; methods: Record<string, boolean> } }

function staffRoutes(): { method: string; path: string }[] {
  const stack = (adminRouter() as unknown as { stack: Layer[] }).stack;
  return stack.flatMap((layer) => {
    if (!layer.route) return [];
    const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
    return paths.flatMap((path) => Object.keys(layer.route!.methods).map((method) => ({ method, path })));
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('G.6 standing constraints on every staff route', () => {
  const routes = staffRoutes();

  it('lists the staff routes, and none of them is an impersonation or login-as capability', () => {
    expect(routes.length).toBeGreaterThan(100);
    expect(routes.filter((r) => IMPERSONATION.test(r.path))).toEqual([]);
  });

  it('no staff GET route reads a transcript or a per-account wallet table, or answers with one', async () => {
    const reads: string[] = [];
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = decodeURIComponent(String(input));
      reads.push(url);
      if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ role: 'superadmin' }]));
      if (url.includes('/rest/v1/admin_permissions')) {
        return Promise.resolve(jsonResponse(200, ['manage_users', 'manage_content', 'view_analytics', 'manage_support'].map((permission) => ({ user_id: STAFF_ID, permission }))));
      }
      if ((init?.method ?? 'GET') === 'GET' && url.includes('/rest/v1/')) return Promise.resolve(jsonResponse(200, []));
      return Promise.resolve(jsonResponse(200, null));
    }));
    const app = createApp();
    const auth = `Bearer ${mintToken({ sub: STAFF_ID, email: 'boss@littlefounders.ai' })}`;
    const gets = routes.filter((r) => r.method === 'get' && !r.path.includes('*'));
    for (const route of gets) {
      const path = route.path.replace(/:[A-Za-z]+(?:\([^)]*\))?/g, PARAM);
      const res = await request(app).get(`/api/v1/admin${path}`).set('Authorization', auth);
      const body = JSON.stringify(res.body ?? {});
      expect(FORBIDDEN_FIELD.test(body), `${route.path} answered a forbidden field`).toBe(false);
    }
    expect(reads.filter((url) => FORBIDDEN_READ.test(url))).toEqual([]);
    expect(gets.length).toBeGreaterThan(60);
  }, 60_000);
});

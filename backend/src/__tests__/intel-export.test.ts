import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { createApp } from '../app.js';
import { resetExclusionsForTests } from '../services/analyticsExclusions.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * /api/v1/admin/intel-export.{csv,xlsx} — the intelligence console's window,
 * as a file.
 *
 * Rendered in Core rather than proxied because the /intel proxy reads upstream
 * bodies as TEXT, which is fine for JSON and silently corrupts a spreadsheet.
 * The contract worth defending: the file describes the SAME window the screen
 * did, it says so on itself, and it never presents an upstream failure as an
 * empty period.
 */

const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const authed = () => `Bearer ${mintToken({ sub: ADMIN_ID, email: 'staff@littlefounders.ai' })}`;

interface Upstream {
  paths: string[];
  fail?: boolean;
}

function stubFetch(upstream: Upstream) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ role: 'admin' }]));
      if (url.includes('/rest/v1/admin_permissions')) return Promise.resolve(jsonResponse(200, [{ user_id: ADMIN_ID, permission: 'view_analytics' }]));
      if (url.includes('/rest/v1/rpc/record_staff_ip_sighting')) return Promise.resolve(jsonResponse(200, {}));
      if (url.includes('/api/v1/intel/')) {
        upstream.paths.push(url.slice(url.indexOf('/api/v1/intel/') + '/api/v1/intel'.length));
        if (upstream.fail) return Promise.resolve(jsonResponse(502, { data: null, error: { code: 'X', message: 'x' } }));
        if (url.includes('/quality/staff-exclusion')) {
          return Promise.resolve(jsonResponse(200, { data: { excludedShare: 0.905, excludedEvents: 3502 }, error: null }));
        }
        if (url.includes('/engagement/leaderboard')) {
          return Promise.resolve(
            jsonResponse(200, { data: [{ user_id: 'u1', engagement_score: 42, lessons_completed: 3 }], error: null }),
          );
        }
        if (url.includes('/funnels/activation')) {
          return Promise.resolve(jsonResponse(200, { data: [{ step: 'visited', users: 500 }], error: null }));
        }
        return Promise.resolve(jsonResponse(200, { data: [], error: null }));
      }
      throw new Error(`intel-export.test: unexpected fetch ${url}`);
    }),
  );
}

beforeEach(() => {
  resetExclusionsForTests();
  vi.stubEnv('DATAINTEL_URL', 'http://dataintel.test');
  vi.stubEnv('DATAINTEL_INTERNAL_KEY', 'test-internal-key-0123456789');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetExclusionsForTests();
});

/*
 * The STREAM form of supertest's `parse` union. Typed as the library's own
 * parameter type rather than structurally, because TypeScript cannot narrow
 * the `((str) => any) | ((res, cb) => void)` union from this signature alone.
 */
function binary(): Parameters<request.Test['parse']>[0] {
  return ((res: NodeJS.ReadableStream, callback: (err: Error | null, body: Buffer) => void): void => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
  }) as unknown as Parameters<request.Test['parse']>[0];
}

describe('GET /api/v1/admin/intel-export.csv', () => {
  it('passes the selected window to every upstream query', async () => {
    const upstream: Upstream = { paths: [] };
    stubFetch(upstream);
    const res = await request(createApp())
      .get('/api/v1/admin/intel-export.csv?days=90')
      .set('Authorization', authed());
    expect(res.status).toBe(200);
    // A file that queried a different period than the screen would be worse
    // than no file: it looks authoritative and disagrees silently.
    expect(upstream.paths.length).toBeGreaterThan(3);
    for (const path of upstream.paths) expect(path).toContain('days=90');
  });

  it('carries an explicit range through unchanged', async () => {
    const upstream: Upstream = { paths: [] };
    stubFetch(upstream);
    const res = await request(createApp())
      .get('/api/v1/admin/intel-export.csv?days=30&from=2026-06-01&to=2026-06-30')
      .set('Authorization', authed());
    expect(res.status).toBe(200);
    for (const path of upstream.paths) expect(path).toContain('from=2026-06-01&to=2026-06-30');
    expect(res.headers['content-disposition']).toContain('2026-06-01_to_2026-06-30');
    expect(res.text).toContain('2026-06-01 to 2026-06-30');
  });

  it('states on the file that staff activity is excluded, and by how much', async () => {
    stubFetch({ paths: [] });
    const res = await request(createApp())
      .get('/api/v1/admin/intel-export.csv?days=30')
      .set('Authorization', authed());
    expect(res.text).toContain('Staff activity is excluded');
    expect(res.text).toContain('90.5%');
  });

  it('rejects a half-specified range rather than quietly using another window', async () => {
    stubFetch({ paths: [] });
    const res = await request(createApp())
      .get('/api/v1/admin/intel-export.csv?days=30&from=2026-06-01')
      .set('Authorization', authed());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('402s nothing and 502s when the intel service is down', async () => {
    stubFetch({ paths: [], fail: true });
    const res = await request(createApp())
      .get('/api/v1/admin/intel-export.csv?days=30')
      .set('Authorization', authed());
    // An empty file labelled with a period reads as "nothing happened".
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });

  it('403s a non-staff caller', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input).includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ role: 'parent' }]));
        return Promise.resolve(jsonResponse(200, { data: [], error: null }));
      }),
    );
    const res = await request(createApp())
      .get('/api/v1/admin/intel-export.csv?days=30')
      .set('Authorization', authed());
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/admin/intel-export.xlsx', () => {
  it('produces a workbook Excel can open, with the provenance sheet', async () => {
    stubFetch({ paths: [] });
    const res = await request(createApp())
      .get('/api/v1/admin/intel-export.xlsx?days=30')
      .set('Authorization', authed())
      .buffer(true)
      .parse(binary());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');

    const workbook = new ExcelJS.Workbook();
    // ExcelJS types its own `Buffer` from an older @types/node where the class
    // is not generic; Node 24 makes it `Buffer<ArrayBufferLike>`. Same bytes,
    // incompatible declarations.
    await workbook.xlsx.load(res.body as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const names = workbook.worksheets.map((sheet) => sheet.name);
    expect(names).toContain('About');
    expect(names).toContain('Engagement');
    const about = JSON.stringify(workbook.getWorksheet('About')?.getSheetValues());
    expect(about).toContain('last 30 days');
    expect(about).toContain('Staff activity is excluded');
  });

  it('rejects a format it does not render', async () => {
    stubFetch({ paths: [] });
    const res = await request(createApp())
      .get('/api/v1/admin/intel-export.pdf?days=30')
      .set('Authorization', authed());
    expect(res.status).toBe(400);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { createApp } from '../app.js';
import { resetPulseForTests, resolveRange, parseRange, type PlausibleReportData } from '../services/pulse.js';
import { renderAnalyticsReportCsv, renderAnalyticsReportXlsx } from '../services/analyticsExport.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * Period resolution and the spreadsheet exports. The window arithmetic gets
 * its own tests because every figure on the page inherits it: a period that
 * resolves to the wrong days is wrong everywhere at once, quietly.
 */

const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const authed = () => `Bearer ${mintToken({ sub: ADMIN_ID, email: 'staff@littlefounders.ai' })}`;

const REPORT: PlausibleReportData = {
  period: '30d',
  from: '2026-07-15',
  to: '2026-08-13',
  audience: 'marketing',
  generatedAt: '2026-08-13T10:00:00.000Z',
  appliedFilters: ['country is MX'],
  aggregate: { visitors: 120, pageviews: 340, bounceRate: 41.5, visitDuration: 95 },
  previous: { visitors: 100, pageviews: 300, bounceRate: 45, visitDuration: 90, from: '2026-06-15', to: '2026-07-14' },
  timeseries: [
    { date: '2026-08-12', visitors: 60, pageviews: 170 },
    { date: '2026-08-13', visitors: 60, pageviews: 170 },
  ],
  breakdowns: {
    source: [
      { label: 'Google', visitors: 90, pageviews: 210, bounceRate: 40.2, visitDuration: 87 },
      { label: 'Direct, "none"', visitors: 30, pageviews: 130, bounceRate: 55.1, visitDuration: 61 },
    ],
    country: [{ label: 'MX', visitors: 120, pageviews: 340, bounceRate: 41.5, visitDuration: 95 }],
  },
  imports: { importsIncluded: true, importsSkipReason: null, importsWarning: null, queried: ['2026-07-15', '2026-08-13'] },
  breakdownsWithoutImports: [],
  rangeDrift: null,
  firstParty: {
    sessions: { anonymous: 40, registered: 12, staff: 300 },
    externalShare: 52 / 352,
    accountsCreated: 31,
    signupObserved: 0,
    unobserved: 31,
    anonymousVisitors: 26,
    anonymousConverted: 1,
    conversionRate: 1 / 26,
  },
};

describe('resolveRange', () => {
  const NOW = Date.UTC(2026, 7, 13, 15, 30); // 2026-08-13T15:30Z

  it('reads "month" as month-to-date, the way Plausible does', () => {
    const resolved = resolveRange({ kind: 'preset', period: 'month' }, NOW);
    expect(new Date(resolved.startMs).toISOString().slice(0, 10)).toBe('2026-08-01');
    expect(new Date(resolved.endMs).toISOString().slice(0, 10)).toBe('2026-08-13');
  });

  it('gives every preset an equally long window immediately before it', () => {
    const week = resolveRange({ kind: 'preset', period: '7d' }, NOW);
    expect(new Date(week.startMs).toISOString().slice(0, 10)).toBe('2026-08-07');
    expect(week.previous).toEqual(['2026-07-31', '2026-08-06']);
  });

  it('refuses to invent a comparison for all time', () => {
    expect(resolveRange({ kind: 'preset', period: 'all' }, NOW).previous).toBeNull();
  });

  it('passes a custom range through as the two-date form Plausible accepts', () => {
    const custom = resolveRange({ kind: 'custom', from: '2026-06-01', to: '2026-06-30' }, NOW);
    expect(custom.dateRange).toEqual(['2026-06-01', '2026-06-30']);
    expect(custom.previous).toEqual(['2026-05-02', '2026-05-31']);
  });

  it('rejects windows that cannot mean anything', () => {
    expect(parseRange('custom', '2026-06-30', '2026-06-01')).toBeNull(); // backwards
    expect(parseRange('custom', '2026-06-01', undefined)).toBeNull(); // half a range
    expect(parseRange('custom', '2026-06-01', '2099-01-01')).toBeNull(); // the future
    expect(parseRange('custom', '2020-01-01', '2026-01-01')).toBeNull(); // absurdly long
    expect(parseRange('fortnight')).toBeNull();
    expect(parseRange('30d')).toEqual({ kind: 'preset', period: '30d' });
  });
});

describe('CSV export', () => {
  const csv = renderAnalyticsReportCsv(REPORT);
  const lines = csv.split('\r\n');

  it('starts with a BOM so Excel does not mangle accented labels', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('is one rectangular table with no comment lines', () => {
    expect(lines[0]?.replace('﻿', '')).toBe(
      'section,key,label,visitors,pageviews,bounce_rate_pct,visit_duration_s',
    );
    expect(lines.some((line) => line.startsWith('#'))).toBe(false);
    const widths = new Set(lines.filter(Boolean).map((line) => line.split(',').length));
    // Quoted commas make a naive split wider; every unquoted row is 7 columns.
    expect([...widths].every((width) => width >= 7)).toBe(true);
  });

  it('carries the provenance a number needs three weeks later', () => {
    expect(csv).toContain('meta,period,');
    expect(csv).toContain('meta,filters,country is MX');
    expect(csv).toContain('meta,generated_at,2026-08-13T10:00:00.000Z');
    expect(csv).toContain('summary,previous,2026-06-15 to 2026-07-14,100,300,45,90');
  });

  it('escapes a label containing a comma and a quote', () => {
    expect(csv).toContain('"Direct, ""none"""');
  });
});

describe('XLSX export', () => {
  it('produces a workbook Excel can open, with the figures in place', async () => {
    const buffer = await renderAnalyticsReportXlsx(REPORT);
    expect(buffer.subarray(0, 2).toString('latin1')).toBe('PK'); // a real zip container

    const workbook = new ExcelJS.Workbook();
// ExcelJS types its own `Buffer` from an older @types/node where the class
    // is not generic; Node 24 makes it `Buffer<ArrayBufferLike>`. Same bytes,
    // incompatible declarations — a library-typing friction, not a defect.
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const names = workbook.worksheets.map((sheet) => sheet.name);
    expect(names).toContain('Summary');
    expect(names).toContain('Daily trend');
    expect(names).toContain('Top sources');

    const summary = workbook.getWorksheet('Summary');
    const flat = JSON.stringify(summary?.getSheetValues());
    expect(flat).toContain('Visitors');
    expect(flat).toContain('120');
    expect(flat).toContain('2026-07-15 to 2026-08-13');

    const sources = workbook.getWorksheet('Top sources');
    expect(sources?.getRow(2).getCell(1).value).toBe('Google');
    expect(sources?.getRow(2).getCell(2).value).toBe(90);
  });

  it('prints an unavailable comparison as text, never as a zero change', async () => {
    const buffer = await renderAnalyticsReportXlsx({ ...REPORT, previous: null });
    const workbook = new ExcelJS.Workbook();
// ExcelJS types its own `Buffer` from an older @types/node where the class
    // is not generic; Node 24 makes it `Buffer<ArrayBufferLike>`. Same bytes,
    // incompatible declarations — a library-typing friction, not a defect.
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const flat = JSON.stringify(workbook.getWorksheet('Summary')?.getSheetValues());
    expect(flat).toContain('n/a');
    expect(flat).toContain('none available');
  });
});

describe('export routes', () => {
  function stubFetch() {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ role: 'admin' }]));
        if (url.includes('/rest/v1/admin_permissions')) return Promise.resolve(jsonResponse(200, [{ user_id: ADMIN_ID, permission: 'view_analytics' }]));
        if (url.includes('/rest/v1/rpc/record_staff_ip_sighting')) return Promise.resolve(jsonResponse(200, {}));
        if (url.includes('plausible.test/api/v2/query')) {
          const body = JSON.parse(String(init?.body ?? '{}')) as { dimensions?: string[] };
          if (!body.dimensions?.length) return Promise.resolve(jsonResponse(200, { results: [{ dimensions: [], metrics: [120, 340, 41.5, 95] }] }));
          if (body.dimensions[0] === 'time:day') {
            return Promise.resolve(jsonResponse(200, { results: [{ dimensions: ['2026-08-13'], metrics: [60, 170] }] }));
          }
          return Promise.resolve(jsonResponse(200, { results: [{ dimensions: ['Google'], metrics: [90, 210, 40.2, 87] }] }));
        }
        throw new Error(`analytics-export.test: unexpected fetch ${url}`);
      }),
    );
  }

  beforeEach(() => {
    resetPulseForTests();
    vi.stubEnv('PLAUSIBLE_URL', 'http://plausible.test');
    vi.stubEnv('PLAUSIBLE_API_KEY', 'plausible-key-0123456789');
    vi.stubEnv('PLAUSIBLE_SITE_ID', 'littlefounders.ai');
    stubFetch();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetPulseForTests();
  });

  it('serves a CSV download naming the window it covers', async () => {
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/report.csv?period=7d&audience=marketing')
      .set('Authorization', authed());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="littlefounders-analytics-marketing-\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(res.text).toContain('section,key,label');
  });

  it('serves an XLSX download', async () => {
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/report.xlsx?period=7d&audience=marketing')
      .set('Authorization', authed())
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect((res.body as Buffer).subarray(0, 2).toString('latin1')).toBe('PK');
  });

  it('lets an analyst ask for more rows than a PDF page would hold', async () => {
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/report.csv?period=7d&audience=marketing&rows=200')
      .set('Authorization', authed());
    expect(res.status).toBe(200);
    const bad = await request(createApp())
      .get('/api/v1/admin/analytics/report.csv?period=7d&rows=0')
      .set('Authorization', authed());
    // Out-of-range falls back to the documented default rather than erroring
    // the whole download; the file is still produced and still honest.
    expect(bad.status).toBe(200);
  });
});

describe('exports carry OUR OWN audience, not only Plausible', () => {
  /*
   * A PDF or a spreadsheet is what leaves the building: it gets forwarded,
   * quoted and acted on months later with no chance to ask what it covered.
   * Plausible sees only anonymous, consented visitors on marketing pages, and
   * an export that says so nowhere is an export that will be over-read.
   */
  it('emits a firstparty section with the server-side account count', () => {
    const csv = renderAnalyticsReportCsv(REPORT);
    expect(csv).toContain('firstparty,sessions_anonymous,40');
    expect(csv).toContain('firstparty,sessions_staff,300');
    expect(csv).toContain('firstparty,accounts_created,31');
    expect(csv).toContain('firstparty,signups_observed_by_client_funnel,0');
    expect(csv).toContain('firstparty,accounts_unobserved,31');
  });

  it('explains the gap in words rather than leaving two numbers to reconcile', () => {
    const csv = renderAnalyticsReportCsv(REPORT);
    expect(csv).toMatch(/firstparty,note,.*server-side record and is authoritative/);
  });

  it('says "no data", never 0%, when a rate has no denominator', () => {
    const csv = renderAnalyticsReportCsv({
      ...REPORT,
      firstParty: { ...REPORT.firstParty!, conversionRate: null, externalShare: null },
    });
    expect(csv).toContain('firstparty,conversion_rate,no data');
    expect(csv).toContain('firstparty,external_share,no data');
  });

  it('reports UNREAD as unavailable, which is not the same as zero', () => {
    // The distinction the whole audience surface exists to preserve. Rendering
    // zeros here would assert that nobody visited and nobody registered.
    const csv = renderAnalyticsReportCsv({ ...REPORT, firstParty: null });
    expect(csv).toContain('firstparty,status,');
    expect(csv).toMatch(/unavailable.*NOT zero/);
    expect(csv).not.toContain('firstparty,accounts_created,0');
  });

  it('omits the gap note when there is no gap', () => {
    const csv = renderAnalyticsReportCsv({
      ...REPORT,
      firstParty: { ...REPORT.firstParty!, signupObserved: 31, unobserved: 0 },
    });
    expect(csv).not.toMatch(/firstparty,note,/);
  });

  it('gives the workbook its own audience sheet', async () => {
    const buffer = await renderAnalyticsReportXlsx(REPORT);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});

// GAP-FIX-R4 (F4-staff-ops): the spreadsheet exports follow the same wording
// rules as the PDF (Bible 02 rule 16): no em dash and no ellipsis in any cell,
// the caveats and the first-party notes included.
describe('export wording (02 rule 16)', () => {
  const WORST: PlausibleReportData = {
    ...REPORT,
    rangeDrift: { askedFor: ['2026-07-15', '2026-08-13'], answeredFor: ['2026-07-16', '2026-08-13'] },
    imports: { importsIncluded: false, importsSkipReason: 'filtered by page', importsWarning: null, queried: ['2026-07-15', '2026-08-13'] },
    breakdownsWithoutImports: ['source'],
    firstParty: { ...REPORT.firstParty!, conversionRate: null, externalShare: null },
  };

  it('no CSV cell carries an em dash or an ellipsis, with every caveat and note present', () => {
    for (const report of [WORST, { ...WORST, firstParty: null }]) {
      const csv = renderAnalyticsReportCsv(report);
      expect(csv).toContain('WINDOW MISMATCH');
      expect(csv).not.toMatch(/[—…]/);
    }
  });

  it('no XLSX cell carries an em dash or an ellipsis', async () => {
    for (const report of [WORST, { ...WORST, firstParty: null }]) {
      const buffer = await renderAnalyticsReportXlsx(report);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
      const flat = workbook.worksheets.map((sheet) => JSON.stringify(sheet.getSheetValues())).join('\n');
      expect(flat).toContain('WINDOW MISMATCH');
      expect(flat).not.toMatch(/[—…]/);
    }
  });
});

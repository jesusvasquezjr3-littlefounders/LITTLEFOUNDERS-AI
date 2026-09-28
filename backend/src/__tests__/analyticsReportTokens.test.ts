import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderAnalyticsReportPdf, REPORT_TOKENS } from '../services/analyticsReport.js';
import { BRAND } from '../services/analyticsExport.js';
import type { PlausibleReportData } from '../services/pulse.js';

/*
 * Frontend Bible 02 D8 (one design system, the staff console's exported
 * reports included), D3 and D4: every colour the PDF and XLSX exports use
 * must be a 02 section 3 token. The allowed list is the light-mode values of
 * frontend/src/rebuild/design/tokens.css; when that file is present in the
 * checkout, each allowed value is also checked against it, so the list cannot
 * drift from the design system silently.
 */
const TOKENS: Record<string, string> = {
  '--primary': '#5c55fd',
  '--primary-strong': '#5850f8',
  '--primary-soft': '#eceffe',
  '--on-primary': '#ffffff',
  '--sunken': '#eaecf6',
  '--content': '#11132a',
  '--content-muted': '#66697c',
  '--outline': '#d5d8e7',
  '--success-strong': '#027b45',
  '--error-strong': '#d60f26',
  '--warning-strong': '#856600',
};
const ALLOWED = new Set(Object.values(TOKENS));

const here = dirname(fileURLToPath(import.meta.url));
const source = (file: string) => readFileSync(resolve(here, '../services', file), 'utf8');

function coloursIn(text: string): string[] {
  const hex = [...text.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase());
  const argb = [...text.matchAll(/'FF([0-9A-Fa-f]{6})'/g)].map((m) => `#${m[1]!.toLowerCase()}`);
  return [...hex, ...argb];
}

describe('staff report exports use only 02 section 3 tokens', () => {
  it('the allowed list matches tokens.css (light mode)', () => {
    const css = resolve(here, '../../../frontend/src/rebuild/design/tokens.css');
    if (!existsSync(css)) return;
    const light = readFileSync(css, 'utf8').split(/@media|\[data-theme="dark"\]/)[0]!;
    for (const [name, value] of Object.entries(TOKENS)) {
      expect(light, name).toMatch(new RegExp(`${name}:\\s*${value}\\b`, 'i'));
    }
  });

  it('analyticsReport.ts (PDF) has no colour outside the token list', () => {
    const found = coloursIn(source('analyticsReport.ts'));
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((c) => !ALLOWED.has(c))).toEqual([]);
    for (const value of Object.values(REPORT_TOKENS)) expect(ALLOWED.has(value)).toBe(true);
  });

  it('analyticsExport.ts (XLSX) has no colour outside the token list', () => {
    const found = coloursIn(source('analyticsExport.ts'));
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((c) => !ALLOWED.has(c))).toEqual([]);
    for (const value of Object.values(BRAND)) expect(ALLOWED.has(`#${value.slice(2).toLowerCase()}`)).toBe(true);
  });

  it('the PDF embeds Fredoka and Nunito and never the pdfkit standard fonts', async () => {
    const data: PlausibleReportData = {
      firstParty: null, audience: 'full', period: '30d', from: '2026-07-16', to: '2026-08-14', generatedAt: '2026-08-14T12:00:00.000Z',
      aggregate: { visitors: 1234, pageviews: 5678, bounceRate: 42.5, visitDuration: 95 },
      previous: { visitors: 1000, pageviews: 5000, bounceRate: 47, visitDuration: 88, from: '2026-06-16', to: '2026-07-15' },
      timeseries: [{ date: '2026-08-01', visitors: 40, pageviews: 90 }, { date: '2026-08-02', visitors: 55, pageviews: 120 }],
      breakdowns: { page: [{ label: '/ação/niño', visitors: 40, pageviews: 56, bounceRate: 41, visitDuration: 90 }] },
      appliedFilters: ['país: México'],
      imports: { importsIncluded: true, importsSkipReason: null, importsWarning: null, queried: ['2026-07-16', '2026-08-14'] },
      breakdownsWithoutImports: [], rangeDrift: null,
    };
    const pdf = await renderAnalyticsReportPdf(data, 'pt-BR');
    const text = pdf.toString('latin1');
    expect(text).toMatch(/Fredoka/);
    expect(text).toMatch(/Nunito/);
    expect(text).not.toMatch(/\/BaseFont \/Helvetica/);
  });
});

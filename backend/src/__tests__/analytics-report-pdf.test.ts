import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PDFDocument from 'pdfkit';
import { drawLogo, LOGO_WORDMARK, renderAnalyticsReportPdf, REPORT_LOCALES, TEXT, type ReportLocale } from '../services/analyticsReport.js';
import type { PlausibleReportData } from '../services/pulse.js';

/*
 * The exported report is the only artefact that leaves the building, so its
 * two silent failure modes both get a test: a logo that renders in dev and
 * vanishes in the deployed image, and a document that claims a language it
 * did not actually use.
 */

const DATA: PlausibleReportData = {
  // Null on purpose: the PDF must render when the first-party views could not
  // be read, and it must say "unavailable" rather than print zeros.
  firstParty: null,
  audience: 'full',
  period: '30d',
  from: '2026-07-16',
  to: '2026-08-14',
  generatedAt: '2026-08-14T12:00:00.000Z',
  aggregate: { visitors: 1234, pageviews: 5678, bounceRate: 42.5, visitDuration: 95 },
  previous: { visitors: 1000, pageviews: 5000, bounceRate: 47, visitDuration: 88, from: '2026-06-16', to: '2026-07-15' },
  timeseries: [
    { date: '2026-08-01', visitors: 40, pageviews: 90 },
    { date: '2026-08-02', visitors: 55, pageviews: 120 },
    { date: '2026-08-03', visitors: 30, pageviews: 70 },
  ],
  breakdowns: { page: [{ label: '/', visitors: 40, pageviews: 56, bounceRate: 41, visitDuration: 90 }] },
  appliedFilters: [],
  imports: { importsIncluded: true, importsSkipReason: null, importsWarning: null, queried: ['2026-07-16', '2026-08-14'] },
  breakdownsWithoutImports: [],
  rangeDrift: null,
};

describe('renderAnalyticsReportPdf', () => {
  it('draws the rebuilt brand mark and wordmark, with no raster logo', async () => {
    const pdf = await renderAnalyticsReportPdf(DATA, 'en-US');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1')).not.toContain('/Subtype /Image');

    // The lockup alone, uncompressed, so its drawing operators are readable.
    const doc = new PDFDocument({ compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((r) => doc.on('end', () => r()));
    drawLogo(doc, 48, 34);
    doc.end();
    await done;
    const raw = Buffer.concat(chunks).toString('latin1');
    /*
     * The legacy raster wordmark came in as an image XObject; the mark is now
     * vectors, so the document carries no image at all. Its fills are the
     * mark's token hues (primary, primary-ridge, reward) as pdfkit writes
     * them (RGB fractions of 255), and the product name is set as text.
     */
    expect(raw).not.toContain('/Subtype /Image');
    const fill = (hex: string) =>
      [1, 3, 5].map((i) => String(parseInt(hex.slice(i, i + 2), 16) / 255)).join(' ') + ' scn';
    expect(raw).toContain(fill('#5c55fd')); // --primary
    expect(raw).toContain(fill('#4438cf')); // --primary-ridge
    expect(raw).toContain(fill('#ebb806')); // --reward
    expect(raw).toContain(fill('#a88205')); // --reward-ridge
    expect(raw).toContain('/Font');
    expect(LOGO_WORDMARK).toBe('LittleFounders');
  });

  it('renders every supported locale and produces a distinct document each time', async () => {
    const buffers = new Map<ReportLocale, Buffer>();
    for (const locale of REPORT_LOCALES) {
      const pdf = await renderAnalyticsReportPdf(DATA, locale);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.length).toBeGreaterThan(1000);
      buffers.set(locale, pdf);
    }
    // If localisation silently no-ops, all three come out byte-identical —
    // the failure mode of a report that "supports" languages it ignores.
    expect(buffers.get('es-MX')!.equals(buffers.get('en-US')!)).toBe(false);
    expect(buffers.get('pt-BR')!.equals(buffers.get('es-MX')!)).toBe(false);
  });

  it('defaults to English when no locale is given', async () => {
    const implicit = await renderAnalyticsReportPdf(DATA);
    const explicit = await renderAnalyticsReportPdf(DATA, 'en-US');
    expect(implicit.length).toBe(explicit.length);
  });

  it('survives an empty series without throwing', async () => {
    // A window with no traffic is a normal answer, not an error.
    const empty: PlausibleReportData = { ...DATA, timeseries: [], breakdowns: {}, previous: null };
    const pdf = await renderAnalyticsReportPdf(empty, 'es-MX');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

/*
 * GAP-FIX-R4 (F4-staff-ops): Bible 02 section 7 rule 1 (text never truncates
 * or ends in an ellipsis), rule 16 (no em dash in copy), rule 11 (the 14 px
 * floor, 10.5 pt) and section 1.2 (every word in the report's locale). Every
 * string the renderer draws and every size it sets are recorded while a
 * worst-case report renders in each locale.
 */
const LONG_LABEL = 'https://www.example.com/blog/how-families-start-saving/' + 'a-very-long-campaign-landing-page-path-that-keeps-going-'.repeat(3)
  + ' and then a sentence with many ordinary words that has to wrap across several lines of its column without being cut';
const WORST: PlausibleReportData = {
  ...DATA,
  firstParty: {
    sessions: { anonymous: 1200, registered: 300, staff: 40 }, externalShare: 0.97, accountsCreated: 25, signupObserved: 19,
    unobserved: 6, anonymousVisitors: 900, anonymousConverted: 12, conversionRate: 0.013,
  },
  appliedFilters: Array.from({ length: 8 }, (_, i) => `visit:country==${'Somewhere-with-a-long-name-'.repeat(2)}${i}`),
  breakdowns: {
    country: [{ label: LONG_LABEL, visitors: 900, pageviews: 1800, bounceRate: 40, visitDuration: 80 }, { label: '', visitors: 20, pageviews: 30, bounceRate: 50, visitDuration: 10 }],
    source: [{ label: 'Direct / None', visitors: 500, pageviews: 900, bounceRate: 40, visitDuration: 80 }],
    page: [
      { label: LONG_LABEL, visitors: 40, pageviews: 56, bounceRate: 41, visitDuration: 90 },
      { label: '', visitors: 4, pageviews: 5, bounceRate: 41, visitDuration: 90 },
      ...Array.from({ length: 60 }, (_, i) => ({ label: `/lesson/${i}`, visitors: 60 - i, pageviews: 70 - i, bounceRate: 30, visitDuration: 60 })),
    ],
    referrer: [],
  },
  imports: { importsIncluded: false, importsSkipReason: null, importsWarning: null, queried: ['2026-07-16', '2026-08-14'] },
  breakdownsWithoutImports: ['page'],
  rangeDrift: { askedFor: ['2026-07-16', '2026-08-14'], answeredFor: ['2026-07-17', '2026-08-14'] },
};
const NONE: Record<ReportLocale, string> = { 'en-US': 'none', 'es-MX': 'ninguno', 'pt-BR': 'nenhum' };

describe('the report text rules (02 section 7 rule 1, rules 11 and 16, section 1.2)', () => {
  afterEach(() => vi.restoreAllMocks());

  for (const locale of REPORT_LOCALES) {
    it(`${locale}: every label whole, no ellipsis, no em dash, no untranslated "(none)", no text under 10.5 pt`, async () => {
      const text = vi.spyOn(PDFDocument.prototype, 'text');
      const size = vi.spyOn(PDFDocument.prototype, 'fontSize');
      const pdf = await renderAnalyticsReportPdf(WORST, locale);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      const drawn = text.mock.calls.map((call) => String(call[0]));
      const options = text.mock.calls.map((call) => call.find((arg, i) => i > 0 && typeof arg === 'object' && arg !== null) as PDFKit.Mixins.TextOptions | undefined);
      expect(drawn.length).toBeGreaterThan(50);
      for (const line of drawn) {
        expect(line, line).not.toContain('…');
        expect(line, line).not.toContain('—');
        expect(line, line).not.toContain('(none)');
      }
      expect(options.some((o) => o?.ellipsis)).toBe(false);
      // The long label is drawn whole, in the composition card and the breakdown table alike.
      expect(drawn.filter((line) => line === LONG_LABEL).length).toBeGreaterThanOrEqual(2);
      // An empty label reads as the locale's own word.
      expect(drawn).toContain(NONE[locale]);
      const sizes = size.mock.calls.map((call) => Number(call[0]));
      expect(sizes.length).toBeGreaterThan(20);
      expect(sizes.filter((n) => n < TEXT)).toEqual([]);
    });
  }

  it('the 14 px floor is 10.5 pt, and no string or document title in the source carries an em dash', () => {
    expect(TEXT).toBe(10.5);
    const here = dirname(fileURLToPath(import.meta.url));
    const code = readFileSync(resolve(here, '../services/analyticsReport.ts'), 'utf8')
      .split('\n').filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line)).join('\n');
    expect(code).not.toMatch(/'[^'\n]*—[^'\n]*'|`[^`]*—[^`]*`/);
    expect(code).not.toContain("'(none)'");
    expect(code).not.toContain('ellipsis');
  });
});

import { describe, expect, it } from 'vitest';
import PDFDocument from 'pdfkit';
import { drawLogo, LOGO_WORDMARK, renderAnalyticsReportPdf, REPORT_LOCALES, type ReportLocale } from '../services/analyticsReport.js';
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

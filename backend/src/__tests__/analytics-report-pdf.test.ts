import { describe, expect, it } from 'vitest';
import { renderAnalyticsReportPdf, REPORT_LOCALES, type ReportLocale } from '../services/analyticsReport.js';
import { LF_LOGO_HEIGHT, LF_LOGO_WIDTH } from '../assets/lfLogo.js';
import type { PlausibleReportData } from '../services/pulse.js';

/*
 * The exported report is the only artefact that leaves the building, so its
 * two silent failure modes both get a test: a logo that renders in dev and
 * vanishes in the deployed image, and a document that claims a language it
 * did not actually use.
 */

const DATA: PlausibleReportData = {
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
};

describe('renderAnalyticsReportPdf', () => {
  it('embeds the real wordmark, not a drawn placeholder', async () => {
    const pdf = await renderAnalyticsReportPdf(DATA, 'en-US');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');

    /*
     * pdfkit repackages the PNG into an image XObject, so the source bytes do
     * not survive verbatim — assert on the object it writes instead. The
     * dimensions identify OUR wordmark specifically: the previous placeholder
     * was drawn with vector primitives and produced a valid PDF containing no
     * image object at all, which is exactly why it went unnoticed for so long.
     */
    const raw = pdf.toString('latin1');
    expect(raw).toContain('/Subtype /Image');
    expect(raw).toContain(`/Width ${LF_LOGO_WIDTH}`);
    expect(raw).toContain(`/Height ${LF_LOGO_HEIGHT}`);
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

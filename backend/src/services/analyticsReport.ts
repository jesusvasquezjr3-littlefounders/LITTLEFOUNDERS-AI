import PDFDocument from 'pdfkit';
import { DIMENSION_TITLES, PERIOD_LABELS } from './pulse.js';
import type { PlausibleBreakdownRow, PlausibleDimensionKey, PlausibleReportData } from './pulse.js';

/*
 * Branded analytics report PDF (staff console → Export). Pure pdfkit
 * vector/text — NO image fetches, NO headless browser — so rendering stays
 * Railway-light and offline-safe. Brand tokens come from /DESIGN.md: indigo
 * is the accent, slate is the ink.
 *
 * The report is an internal (staff-only) English document, like the audit
 * log — it is not part of the user-facing i18n surface.
 */

/*
 * /DESIGN.md tokens, resolved to hex because a PDF has no CSS variables.
 *
 * These were a papaya/navy pair (#ff775c / #080f28) that the design system no
 * longer contains: DESIGN.md's brand is indigo #4f46e5 on slate ink #0f172a.
 * Every exported report was therefore wearing a palette the product had
 * stopped using — the one artefact that leaves the building and gets shown to
 * people. Kept in sync with src/index.css by name below.
 */
const ACCENT = '#4f46e5'; // --lf-accent, indigo-600
const ACCENT_STRONG = '#4338ca'; // --lf-accent-strong, indigo-700
const DELIGHT = '#8b5cf6'; // --lf-delight, violet-500 (decorative only)
const INK = '#0f172a'; // --lf-content, slate-900
const MUTED = '#475569'; // --lf-content-muted, slate-600
const RULE = '#e2e8f0'; // --lf-outline, slate-200
const SOFT_ACCENT = '#eef2ff'; // --lf-accent-soft, indigo-50
const SOFT_SURFACE = '#f1f5f9'; // --lf-surface-sunken, slate-100
const SUCCESS = '#047857'; // --lf-success-strong, emerald-700
const ERROR = '#b91c1c'; // --lf-error-strong, red-700
const WHITE = '#ffffff';

const MARGIN = 48;
const BOTTOM_MARGIN = 64; // reserves the footer band
const ROW_H = 18;

const AUDIENCE_TITLES: Record<PlausibleReportData['audience'], string> = {
  marketing: 'Marketing',
  sales: 'Sales',
  frontend: 'Frontend',
  full: 'Full',
};

const intFmt = new Intl.NumberFormat('en-US');
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : dateFmt.format(parsed);
}

function formatShortDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : shortDateFmt.format(parsed);
}

/** pdfkit's standard fonts are Latin-1 only — replace anything outside it. */
function toLatin1(text: string): string {
  return text.replace(/[^\x20-\x7E\u00A0-\u00FF\u2026]/g, '?');
}

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - MARGIN * 2;
}

function pageBottom(doc: PDFKit.PDFDocument): number {
  return doc.page.height - BOTTOM_MARGIN;
}

function ensureRoom(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > pageBottom(doc)) doc.addPage();
}

/** Faint diagonal wordmark, drawn first so page content overlays it. */
function drawWatermark(doc: PDFKit.PDFDocument): void {
  const { x, y } = doc;
  const cx = doc.page.width / 2;
  const cy = doc.page.height / 2;
  doc.save();
  doc.rotate(-38, { origin: [cx, cy] });
  doc.font('Helvetica-Bold').fontSize(52).fillColor(INK).fillOpacity(0.05);
  // y offsets stay well inside the page so pdfkit's text layout never
  // triggers an automatic page break from inside the watermark pass.
  for (const offset of [-190, 0, 190]) {
    const text = 'LITTLEFOUNDERS';
    const w = doc.widthOfString(text);
    doc.text(text, cx - w / 2, cy + offset - 26, { lineBreak: false });
  }
  doc.restore();
  doc.fillOpacity(1);
  doc.x = x;
  doc.y = y;
}

function drawHeader(doc: PDFKit.PDFDocument, data: PlausibleReportData): void {
  // Two-tone brand bar and a compact vector wordmark that is available in every
  // deployment. The PDF must not depend on a frontend filesystem asset.
  doc.rect(0, 0, doc.page.width, 6).fill(ACCENT);
  doc.rect(doc.page.width * 0.72, 0, doc.page.width * 0.28, 6).fill(DELIGHT);
  drawLogo(doc, MARGIN, 34);
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(ACCENT_STRONG)
    .text(`Analytics Report: ${AUDIENCE_TITLES[data.audience]}`, MARGIN, 76, { lineBreak: false });
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(MUTED)
    .text(`${PERIOD_LABELS[data.period]}  |  Generated ${formatDate(data.generatedAt.slice(0, 10))}  |  Source: Plausible via Pulse`, MARGIN, 96, {
      lineBreak: false,
    });
  /*
   * The window comes from the RESOLVED range, not from the first and last
   * points of the series. Those are the days that had traffic — printing them
   * as "the data range" silently shrank the reported window whenever the
   * period began or ended quietly, which is exactly when someone is trying to
   * work out whether a campaign did anything.
   */
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(ACCENT_STRONG)
    .text(`Window: ${formatDate(data.from)} to ${formatDate(data.to)}`, MARGIN, 108, { lineBreak: false });

  const filterText = data.appliedFilters.length ? `Filters: ${data.appliedFilters.join('  AND  ')}` : 'Filters: none';
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(MUTED)
    .text(toLatin1(filterText), MARGIN, 119, { lineBreak: false, width: contentWidth(doc), ellipsis: true });

  doc
    .moveTo(MARGIN, 133)
    .lineTo(doc.page.width - MARGIN, 133)
    .lineWidth(1)
    .strokeColor(RULE)
    .stroke();
  doc.y = 147;
}

function drawLogo(doc: PDFKit.PDFDocument, x: number, y: number): void {
  doc.save();
  doc.roundedRect(x, y, 28, 28, 8).fill(DELIGHT);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(WHITE).text('LF', x, y + 8, { width: 28, align: 'center', lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(18).fillColor(INK).text('LittleFounders', x + 38, y + 5, { lineBreak: false });
  doc.restore();
}

/**
 * Percent change against the previous window. `null` when there is nothing to
 * compare (all-time, or the comparison read failed) — printed as a dash, never
 * as 0%, which would assert a flat trend nobody measured.
 */
function changeOf(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null;
  return (current - previous) / previous;
}

function drawKpiBlock(doc: PDFKit.PDFDocument, data: PlausibleReportData): void {
  const { aggregate, previous } = data;
  const cards = [
    { label: 'Visitors', value: intFmt.format(aggregate.visitors), change: changeOf(aggregate.visitors, previous?.visitors), higherIsBetter: true },
    { label: 'Pageviews', value: intFmt.format(aggregate.pageviews), change: changeOf(aggregate.pageviews, previous?.pageviews), higherIsBetter: true },
    { label: 'Bounce rate', value: `${Math.round(aggregate.bounceRate * 10) / 10}%`, change: changeOf(aggregate.bounceRate, previous?.bounceRate), higherIsBetter: false },
    { label: 'Avg visit duration', value: formatDuration(aggregate.visitDuration), change: changeOf(aggregate.visitDuration, previous?.visitDuration), higherIsBetter: true },
  ];
  const gap = 12;
  const w = (contentWidth(doc) - gap * (cards.length - 1)) / cards.length;
  const h = 64;
  const top = doc.y;
  cards.forEach((card, i) => {
    const x = MARGIN + i * (w + gap);
    doc.roundedRect(x, top, w, h, 6).lineWidth(1).strokeColor(RULE).stroke();
    doc.rect(x, top + 8, 3, h - 16).fill(i === 0 ? ACCENT : DELIGHT);
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(card.label.toUpperCase(), x + 12, top + 11, {
      width: w - 20,
      lineBreak: false,
    });
    doc.font('Helvetica-Bold').fontSize(16).fillColor(INK).text(card.value, x + 12, top + 25, {
      width: w - 20,
      lineBreak: false,
    });
    // Direction is coloured by whether the movement is GOOD, not by its sign:
    // a bounce rate falling 20% is a win and must not print in red.
    const changeText =
      card.change === null
        ? 'no comparison'
        : `${card.change >= 0 ? '+' : ''}${(card.change * 100).toFixed(1)}% vs previous`;
    const tone =
      card.change === null ? MUTED : (card.change >= 0) === card.higherIsBetter ? SUCCESS : ERROR;
    doc.font('Helvetica').fontSize(7.5).fillColor(tone).text(changeText, x + 12, top + 46, {
      width: w - 20,
      lineBreak: false,
    });
  });
  doc.y = top + h + 22;
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, subtitle?: string): void {
  ensureRoom(doc, subtitle ? 42 : 28);
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text(title, MARGIN, y, { lineBreak: false });
  /*
   * The subtitle starts after the MEASURED title, not at a fixed offset. It
   * used to be pinned to MARGIN + 58, so every title longer than 58pt (which
   * is all of them: "Traffic over time", "Audience composition") had its
   * subtitle printed straight through it.
   */
  const titleWidth = doc.widthOfString(title);
  doc.moveTo(MARGIN, y + 19).lineTo(MARGIN + 46, y + 19).lineWidth(2).strokeColor(ACCENT).stroke();
  if (subtitle) {
    const subtitleX = MARGIN + titleWidth + 12;
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(toLatin1(subtitle), subtitleX, y + 5, {
        lineBreak: false,
        width: Math.max(doc.page.width - MARGIN - subtitleX, 40),
        ellipsis: true,
      });
  }
  doc.y = y + (subtitle ? 32 : 28);
}

function drawTrendChart(doc: PDFKit.PDFDocument, data: PlausibleReportData): void {
  const series = data.timeseries;
  if (series.length === 0) return;
  const firstSeriesPoint = series[0];
  if (!firstSeriesPoint) return;
  const chartH = 158;
  const chartW = contentWidth(doc);
  ensureRoom(doc, chartH + 72);
  drawSectionTitle(doc, 'Traffic over time', 'Daily visitors with pageview volume');

  const top = doc.y;
  doc.fillOpacity(1).roundedRect(MARGIN, top, chartW, chartH, 8).fill(SOFT_ACCENT);
  const plotX = MARGIN + 34;
  const plotY = top + 18;
  const plotW = chartW - 48;
  const plotH = chartH - 46;
  const maxValue = Math.max(...series.flatMap((point) => [point.visitors, point.pageviews]), 1);
  const yFor = (value: number) => plotY + plotH - (value / maxValue) * plotH;
  const xFor = (index: number) => plotX + (series.length === 1 ? plotW / 2 : (index / (series.length - 1)) * plotW);

  doc.font('Helvetica').fontSize(7).fillColor(MUTED);
  for (const ratio of [0, 0.5, 1]) {
    const y = plotY + plotH - ratio * plotH;
    doc.moveTo(plotX, y).lineTo(plotX + plotW, y).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.text(intFmt.format(Math.round(maxValue * ratio)), MARGIN, y - 4, { width: 28, align: 'right', lineBreak: false });
  }

  const barW = Math.max(1.5, Math.min(7, (plotW / series.length) * 0.58));
  series.forEach((point, index) => {
    const x = xFor(index);
    const barTop = yFor(point.pageviews);
    doc.save().fillOpacity(0.3).rect(x - barW / 2, barTop, barW, plotY + plotH - barTop).fill(DELIGHT).restore();
  });

  const line = series.map((point, index) => ({ x: xFor(index), y: yFor(point.visitors) }));
  const firstLinePoint = line[0];
  const lastLinePoint = line[line.length - 1];
  if (!firstLinePoint || !lastLinePoint) return;
  doc.save();
  doc.moveTo(firstLinePoint.x, plotY + plotH).lineTo(firstLinePoint.x, firstLinePoint.y);
  line.slice(1).forEach((point) => doc.lineTo(point.x, point.y));
  doc.lineTo(lastLinePoint.x, plotY + plotH).closePath().fillOpacity(0.78).fill(SOFT_SURFACE);
  doc.restore();
  doc.save();
  doc.moveTo(firstLinePoint.x, firstLinePoint.y);
  line.slice(1).forEach((point) => doc.lineTo(point.x, point.y));
  doc.lineWidth(2).strokeColor(ACCENT_STRONG).stroke();
  doc.restore();

  doc.font('Helvetica').fontSize(7).fillColor(MUTED);
  const labelIndexes = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])];
  labelIndexes.forEach((index) => {
    const x = xFor(index);
    const point = series[index];
    if (point) doc.text(formatShortDate(point.date), x - 28, plotY + plotH + 8, { width: 56, align: 'center', lineBreak: false });
  });

  const legendY = top + chartH - 16;
  doc.circle(MARGIN + 16, legendY + 2, 3).fill(ACCENT_STRONG);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Visitors', MARGIN + 24, legendY - 2, { lineBreak: false });
  doc.fillOpacity(0.45).rect(MARGIN + 83, legendY - 1, 7, 7).fill(DELIGHT);
  doc.text('Pageviews', MARGIN + 96, legendY - 2, { lineBreak: false });
  doc.fillOpacity(1);
  doc.y = top + chartH + 20;

  const totalVisitors = series.reduce((sum, point) => sum + point.visitors, 0);
  const totalPageviews = series.reduce((sum, point) => sum + point.pageviews, 0);
  const peak = series.reduce((best, point) => (point.visitors > best.visitors ? point : best), firstSeriesPoint);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
    `Daily totals in the series: ${intFmt.format(totalVisitors)} visitors | ${intFmt.format(totalPageviews)} pageviews | Peak visitor day: ${formatDate(peak.date)}`,
    MARGIN,
    doc.y,
    { lineBreak: false },
  );
  doc.y += 22;
}

function drawSnapshotBars(doc: PDFKit.PDFDocument, data: PlausibleReportData): void {
  const preferred: PlausibleDimensionKey[] = ['country', 'source', 'channel', 'device', 'page', 'browser', 'os'];
  const dimensions = preferred.filter((dimension) => (data.breakdowns[dimension] ?? []).length > 0).slice(0, 4);
  if (dimensions.length === 0) return;
  const gap = 14;
  const cardW = (contentWidth(doc) - gap) / 2;
  const cardH = 142;
  ensureRoom(doc, cardH * Math.ceil(dimensions.length / 2) + 64);
  drawSectionTitle(doc, 'Audience composition', 'The most useful segments for the selected report');
  const startY = doc.y;
  dimensions.forEach((dimension, index) => {
    const rows = (data.breakdowns[dimension] ?? []).slice(0, 5);
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = MARGIN + column * (cardW + gap);
    const y = startY + row * (cardH + gap);
    doc.roundedRect(x, y, cardW, cardH, 7).fill(column === 0 ? SOFT_SURFACE : SOFT_ACCENT);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(DIMENSION_TITLES[dimension], x + 12, y + 12, { lineBreak: false });
    const max = Math.max(...rows.map((item) => item.visitors), 1);
    rows.forEach((item, rowIndex) => {
      const rowY = y + 35 + rowIndex * 19;
      const labelW = cardW - 88;
      const label = fitLabel(doc, item.label || '(none)', labelW);
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(label, x + 12, rowY, { width: labelW, lineBreak: false });
      doc.roundedRect(x + 12, rowY + 10, cardW - 74, 3, 1.5).fill(RULE);
      doc.roundedRect(x + 12, rowY + 10, Math.max(3, ((cardW - 74) * item.visitors) / max), 3, 1.5).fill(column === 0 ? ACCENT_STRONG : DELIGHT);
      numberCell(doc, item.visitors, x + cardW - 54, rowY - 1, 42);
    });
  });
  doc.y = startY + Math.ceil(dimensions.length / 2) * cardH + Math.max(0, Math.ceil(dimensions.length / 2) - 1) * gap + 18;
}

/** One right-aligned numeric cell — single line, clipped to its column. */
function numberCell(doc: PDFKit.PDFDocument, value: number, x: number, y: number, width: number): void {
  doc.text(intFmt.format(value), x, y, { width, align: 'right', lineBreak: false });
}

/** Trim a label (with ellipsis) so it can never overflow its column. */
function fitLabel(doc: PDFKit.PDFDocument, text: string, maxWidth: number): string {
  const clean = toLatin1(text);
  if (doc.widthOfString(clean) <= maxWidth) return clean;
  let trimmed = clean;
  while (trimmed.length > 1 && doc.widthOfString(`${trimmed}…`) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

function drawBreakdownSection(doc: PDFKit.PDFDocument, title: string, rows: PlausibleBreakdownRow[]): void {
  // Column layout: rank | label (flexible) | visitors | pageviews.
  const rankW = 28;
  const numW = 78;
  const labelW = contentWidth(doc) - rankW - numW * 2;
  const labelX = MARGIN + rankW;
  const visitorsX = labelX + labelW;
  const pageviewsX = visitorsX + numW;

  const drawColumnHeads = (): void => {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED);
    doc.text('#', MARGIN, y, { width: rankW - 6, lineBreak: false });
    doc.text('LABEL', labelX, y, { width: labelW - 8, lineBreak: false });
    doc.text('VISITORS', visitorsX, y, { width: numW, align: 'right', lineBreak: false });
    doc.text('PAGEVIEWS', pageviewsX, y, { width: numW, align: 'right', lineBreak: false });
    doc
      .moveTo(MARGIN, y + 12)
      .lineTo(doc.page.width - MARGIN, y + 12)
      .lineWidth(1)
      .strokeColor(RULE)
      .stroke();
    doc.y = y + ROW_H;
  };

  // Heading + column heads + first row travel together across page breaks.
  ensureRoom(doc, 30 + ROW_H * 2);
  const headingY = doc.y;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text(title, MARGIN, headingY, { lineBreak: false });
  doc
    .moveTo(MARGIN, headingY + 17)
    .lineTo(MARGIN + 42, headingY + 17)
    .lineWidth(2)
    .strokeColor(ACCENT)
    .stroke();
  doc.y = headingY + 26;
  drawColumnHeads();

  if (rows.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('No data for this period.', MARGIN, doc.y, { lineBreak: false });
    doc.y += ROW_H + 10;
    return;
  }

  rows.forEach((row, i) => {
    if (doc.y + ROW_H > pageBottom(doc)) {
      doc.addPage();
      drawColumnHeads();
    }
    const y = doc.y;
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    doc.text(String(i + 1), MARGIN, y, { width: rankW - 6, lineBreak: false });
    doc.fillColor(INK);
    doc.text(fitLabel(doc, row.label || '(none)', labelW - 8), labelX, y, { width: labelW - 8, lineBreak: false });
    numberCell(doc, row.visitors, visitorsX, y, numW);
    numberCell(doc, row.pageviews, pageviewsX, y, numW);
    doc
      .moveTo(MARGIN, y + ROW_H - 5)
      .lineTo(doc.page.width - MARGIN, y + ROW_H - 5)
      .lineWidth(0.5)
      .strokeColor(RULE)
      .stroke();
    doc.y = y + ROW_H;
  });
  doc.y += 14;
}

/** Footer pass over the buffered pages — needs the final page count. */
function drawFooters(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    // The footer sits inside the reserved bottom band; zero the margin while
    // writing there or pdfkit auto-adds a page per footer (its layout treats
    // any text past maxY as overflow, even at an explicit position).
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        `Page ${i + 1} of ${range.count}  |  Confidential | Internal use only`,
        MARGIN,
        doc.page.height - 34,
        { width: doc.page.width - MARGIN * 2, align: 'center', lineBreak: false },
      );
    doc.page.margins.bottom = savedBottom;
  }
}

/** Render the full branded report to a Buffer (streams internally, no temp files). */
export function renderAnalyticsReportPdf(data: PlausibleReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: BOTTOM_MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: {
        Title: `LittleFounders analytics report (${data.audience}, ${data.period})`,
        Author: 'LittleFounders',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      // The first page exists before this listener can fire — watermark it by hand.
      doc.on('pageAdded', () => drawWatermark(doc));
      drawWatermark(doc);

      drawHeader(doc, data);
      drawKpiBlock(doc, data);
      drawTrendChart(doc, data);
      drawSnapshotBars(doc, data);
      for (const [dimension, rows] of Object.entries(data.breakdowns) as [PlausibleDimensionKey, PlausibleBreakdownRow[]][]) {
        drawBreakdownSection(doc, DIMENSION_TITLES[dimension], rows);
      }
      drawFooters(doc);
      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

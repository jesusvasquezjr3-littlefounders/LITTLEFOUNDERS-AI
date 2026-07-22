import PDFDocument from 'pdfkit';
import type { PlausibleBreakdownRow, PlausibleDimensionKey, PlausibleReportData } from './pulse.js';

/*
 * Branded analytics report PDF (staff console → "Download report"). Pure
 * pdfkit vector/text — NO image fetches, NO headless browser — so rendering
 * stays Railway-light and offline-safe. Brand tokens come from /DESIGN.md:
 * papaya is the accent, navy is the ink (never white on papaya).
 *
 * The report is an internal (staff-only) English document, like the audit
 * log — it is not part of the user-facing i18n surface.
 */

// /DESIGN.md tokens.
const PAPAYA = '#ff775c';
const PAPAYA_STRONG = '#e55f45';
const BRAND_BLUE = '#456dff';
const NAVY = '#080f28';
// Neutral supporting greys (non-brand, print-safe).
const MUTED = '#5b6172';
const RULE = '#e3e5ec';

const MARGIN = 48;
const BOTTOM_MARGIN = 64; // reserves the footer band
const ROW_H = 18;

const DIMENSION_TITLES: Record<PlausibleDimensionKey, string> = {
  page: 'Top pages',
  source: 'Top sources',
  referrer: 'Top referrers',
  channel: 'Channels',
  country: 'Countries',
  region: 'Regions',
  device: 'Devices',
  browser: 'Browsers',
  os: 'Operating systems',
  entry_page: 'Entry pages',
  exit_page: 'Exit pages',
  utm_source: 'UTM sources',
  utm_medium: 'UTM mediums',
  utm_campaign: 'UTM campaigns',
};

const AUDIENCE_TITLES: Record<PlausibleReportData['audience'], string> = {
  marketing: 'Marketing',
  sales: 'Sales',
  frontend: 'Frontend',
  full: 'Full',
};

const intFmt = new Intl.NumberFormat('en-US');

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
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
  doc.font('Helvetica-Bold').fontSize(52).fillColor(NAVY).fillOpacity(0.05);
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
  // Papaya accent bar across the very top.
  doc.rect(0, 0, doc.page.width, 6).fill(PAPAYA);
  doc.font('Helvetica-Bold').fontSize(24).fillColor(NAVY).text('LittleFounders', MARGIN, 42, { lineBreak: false });
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(PAPAYA_STRONG)
    .text(`Analytics Report — ${AUDIENCE_TITLES[data.audience]}`, MARGIN, 74, { lineBreak: false });
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(MUTED)
    .text(`Period: ${data.period}  ·  Generated: ${data.generatedAt}  ·  Source: Plausible (Pulse)`, MARGIN, 94, {
      lineBreak: false,
    });
  doc
    .moveTo(MARGIN, 112)
    .lineTo(doc.page.width - MARGIN, 112)
    .lineWidth(1)
    .strokeColor(RULE)
    .stroke();
  doc.y = 126;
}

function drawKpiBlock(doc: PDFKit.PDFDocument, aggregate: PlausibleReportData['aggregate']): void {
  const cards = [
    { label: 'Visitors', value: intFmt.format(aggregate.visitors) },
    { label: 'Pageviews', value: intFmt.format(aggregate.pageviews) },
    { label: 'Bounce rate', value: `${Math.round(aggregate.bounceRate * 10) / 10}%` },
    { label: 'Avg visit duration', value: formatDuration(aggregate.visitDuration) },
  ];
  const gap = 12;
  const w = (contentWidth(doc) - gap * (cards.length - 1)) / cards.length;
  const h = 56;
  const top = doc.y;
  cards.forEach((card, i) => {
    const x = MARGIN + i * (w + gap);
    doc.roundedRect(x, top, w, h, 6).lineWidth(1).strokeColor(RULE).stroke();
    doc.rect(x, top + 8, 3, h - 16).fill(i === 0 ? PAPAYA : BRAND_BLUE);
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(card.label.toUpperCase(), x + 12, top + 12, {
      width: w - 20,
      lineBreak: false,
    });
    doc.font('Helvetica-Bold').fontSize(16).fillColor(NAVY).text(card.value, x + 12, top + 27, {
      width: w - 20,
      lineBreak: false,
    });
  });
  doc.y = top + h + 22;
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
  doc.font('Helvetica-Bold').fontSize(12).fillColor(NAVY).text(title, MARGIN, headingY, { lineBreak: false });
  doc
    .moveTo(MARGIN, headingY + 17)
    .lineTo(MARGIN + 42, headingY + 17)
    .lineWidth(2)
    .strokeColor(PAPAYA)
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
    doc.fillColor(NAVY);
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
        `Page ${i + 1} of ${range.count}  ·  Confidential — Internal use only`,
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
      drawKpiBlock(doc, data.aggregate);
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

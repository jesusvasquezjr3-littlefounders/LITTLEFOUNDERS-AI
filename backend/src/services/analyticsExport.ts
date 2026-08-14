import ExcelJS from 'exceljs';
import { DIMENSION_TITLES, PERIOD_LABELS, type PlausibleDimensionKey, type PlausibleReportData } from './pulse.js';

/*
 * Spreadsheet exports of the analytics report (staff console → Export).
 *
 * The PDF is for reading; these two are for WORKING — pivoting, joining
 * against spend, sending to someone who will not open an admin console. So
 * they carry the same figures with none of the layout, plus the provenance
 * that makes a number defensible three weeks later: the exact window, the
 * filters in force, when it was generated, and the standing caveat that
 * excluded internal traffic only stops counting from the day it was excluded.
 *
 * Brand tokens are DESIGN.md's: indigo #4f46e5 is the accent, slate-900 the
 * ink. (The PDF renderer used a papaya/navy pair that no longer exists in the
 * design system — corrected in the same change that added these.)
 */

export const BRAND = {
  indigo: 'FF4F46E5',
  indigoSoft: 'FFEEF2FF',
  ink: 'FF0F172A',
  muted: 'FF475569',
  outline: 'FFE2E8F0',
  white: 'FFFFFFFF',
} as const;

const SHEET_TITLE_LIMIT = 31; // Excel's hard cap on a worksheet name

function rangeLabel(report: PlausibleReportData): string {
  const preset = PERIOD_LABELS[report.period];
  return report.period === 'custom' ? `${report.from} to ${report.to}` : `${preset} (${report.from} to ${report.to})`;
}

/** Percent change against the previous window, or null when there is nothing to compare. */
function delta(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null;
  return (current - previous) / previous;
}

interface MetricRow {
  metric: string;
  current: number;
  previous: number | null;
  change: number | null;
}

function metricRows(report: PlausibleReportData): MetricRow[] {
  const p = report.previous;
  return [
    { metric: 'Visitors', current: report.aggregate.visitors, previous: p?.visitors ?? null, change: delta(report.aggregate.visitors, p?.visitors) },
    { metric: 'Pageviews', current: report.aggregate.pageviews, previous: p?.pageviews ?? null, change: delta(report.aggregate.pageviews, p?.pageviews) },
    { metric: 'Bounce rate (%)', current: report.aggregate.bounceRate, previous: p?.bounceRate ?? null, change: delta(report.aggregate.bounceRate, p?.bounceRate) },
    { metric: 'Visit duration (s)', current: report.aggregate.visitDuration, previous: p?.visitDuration ?? null, change: delta(report.aggregate.visitDuration, p?.visitDuration) },
  ];
}

const PROVENANCE_NOTE =
  'Figures cover consented public marketing traffic only. Internal traffic exclusions apply from the moment each was added and do not change earlier data.';

// ── CSV ─────────────────────────────────────────────────────────────────────

const CSV_COLUMNS = ['section', 'key', 'label', 'visitors', 'pageviews', 'bounce_rate_pct', 'visit_duration_s'] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * One rectangular table, discriminated by `section`, so the file opens cleanly
 * in Excel, Sheets, pandas and awk alike. Deliberately NO `#` comment lines
 * for the metadata: they make a file that looks readable to a human and
 * silently corrupts the first row for every strict CSV parser.
 */
export function renderAnalyticsReportCsv(report: PlausibleReportData): string {
  const lines: string[][] = [[...CSV_COLUMNS]];

  lines.push(['meta', 'generated_at', report.generatedAt, '', '', '', '']);
  lines.push(['meta', 'audience', report.audience, '', '', '', '']);
  lines.push(['meta', 'period', rangeLabel(report), '', '', '', '']);
  lines.push(['meta', 'from', report.from, '', '', '', '']);
  lines.push(['meta', 'to', report.to, '', '', '', '']);
  lines.push(['meta', 'filters', report.appliedFilters.join(' AND ') || 'none', '', '', '', '']);
  lines.push(['meta', 'note', PROVENANCE_NOTE, '', '', '', '']);

  lines.push([
    'summary',
    'current',
    `${report.from} to ${report.to}`,
    String(report.aggregate.visitors),
    String(report.aggregate.pageviews),
    String(report.aggregate.bounceRate),
    String(report.aggregate.visitDuration),
  ]);
  if (report.previous) {
    lines.push([
      'summary',
      'previous',
      `${report.previous.from} to ${report.previous.to}`,
      String(report.previous.visitors),
      String(report.previous.pageviews),
      String(report.previous.bounceRate),
      String(report.previous.visitDuration),
    ]);
  }

  for (const point of report.timeseries) {
    lines.push(['timeseries', point.date, '', String(point.visitors), String(point.pageviews), '', '']);
  }

  for (const [dimension, rows] of Object.entries(report.breakdowns) as [PlausibleDimensionKey, PlausibleReportData['breakdowns'][PlausibleDimensionKey]][]) {
    for (const row of rows ?? []) {
      lines.push([
        'breakdown',
        dimension,
        row.label,
        String(row.visitors),
        String(row.pageviews),
        String(row.bounceRate),
        String(row.visitDuration),
      ]);
    }
  }

  // Leading BOM: without it Excel reads the file as the local 8-bit codepage
  // and turns every accented country and campaign name into mojibake.
  return `﻿${lines.map((cells) => cells.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

// ── XLSX ────────────────────────────────────────────────────────────────────

type Sheet = ExcelJS.Worksheet;

function headerRow(sheet: Sheet, rowIndex: number, labels: string[]): void {
  const row = sheet.getRow(rowIndex);
  row.values = labels;
  row.font = { bold: true, color: { argb: BRAND.white }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.indigo } };
  row.alignment = { vertical: 'middle' };
  row.height = 20;
}

function titleBlock(sheet: Sheet, report: PlausibleReportData, subtitle: string): number {
  sheet.mergeCells('A1:D1');
  const title = sheet.getCell('A1');
  title.value = 'LittleFounders analytics';
  title.font = { bold: true, size: 16, color: { argb: BRAND.ink } };
  title.alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 26;

  sheet.mergeCells('A2:D2');
  const sub = sheet.getCell('A2');
  sub.value = subtitle;
  sub.font = { size: 11, color: { argb: BRAND.muted } };
  sheet.getRow(2).height = 18;
  return 4; // first free row
}

function autoWidth(sheet: Sheet, widths: number[]): void {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

/** Branded workbook: a summary sheet, the daily trend, and one sheet per breakdown. */
export async function renderAnalyticsReportXlsx(report: PlausibleReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LittleFounders';
  workbook.created = new Date(report.generatedAt);

  // ── Summary ───────────────────────────────────────────────────────────────
  const summary = workbook.addWorksheet('Summary', { views: [{ showGridLines: false }] });
  let row = titleBlock(summary, report, `${report.audience.toUpperCase()} · ${rangeLabel(report)}`);

  const facts: [string, string][] = [
    ['Generated', new Date(report.generatedAt).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'],
    ['Window', `${report.from} to ${report.to}`],
    ['Comparison', report.previous ? `${report.previous.from} to ${report.previous.to}` : 'none available'],
    ['Filters', report.appliedFilters.join(' AND ') || 'none'],
  ];
  for (const [label, value] of facts) {
    summary.getCell(`A${row}`).value = label;
    summary.getCell(`A${row}`).font = { bold: true, size: 10, color: { argb: BRAND.muted } };
    summary.mergeCells(`B${row}:D${row}`);
    summary.getCell(`B${row}`).value = value;
    summary.getCell(`B${row}`).font = { size: 10, color: { argb: BRAND.ink } };
    row += 1;
  }
  row += 1;

  headerRow(summary, row, ['Metric', 'Current', 'Previous', 'Change']);
  const headerAt = row;
  row += 1;
  for (const metric of metricRows(report)) {
    const target = summary.getRow(row);
    target.values = [metric.metric, metric.current, metric.previous ?? 'n/a', metric.change ?? 'n/a'];
    target.getCell(2).numFmt = '#,##0.##';
    target.getCell(3).numFmt = '#,##0.##';
    // A change we could not compute prints as text, never as 0% — a fabricated
    // "no change" is worse than an honest gap.
    if (metric.change !== null) target.getCell(4).numFmt = '+0.0%;-0.0%';
    row += 1;
  }
  summary.getRow(headerAt).commit();

  row += 1;
  summary.mergeCells(`A${row}:D${row}`);
  const note = summary.getCell(`A${row}`);
  note.value = PROVENANCE_NOTE;
  note.font = { size: 9, italic: true, color: { argb: BRAND.muted } };
  note.alignment = { wrapText: true, vertical: 'top' };
  summary.getRow(row).height = 30;
  autoWidth(summary, [26, 18, 18, 14]);

  // ── Daily trend ───────────────────────────────────────────────────────────
  const trend = workbook.addWorksheet('Daily trend', { views: [{ state: 'frozen', ySplit: 1 }] });
  headerRow(trend, 1, ['Date', 'Visitors', 'Pageviews']);
  report.timeseries.forEach((point, index) => {
    trend.getRow(index + 2).values = [point.date, point.visitors, point.pageviews];
  });
  autoWidth(trend, [14, 14, 14]);

  // ── One sheet per breakdown ───────────────────────────────────────────────
  const used = new Set(['Summary', 'Daily trend']);
  for (const [dimension, rows] of Object.entries(report.breakdowns) as [PlausibleDimensionKey, PlausibleReportData['breakdowns'][PlausibleDimensionKey]][]) {
    if (!rows?.length) continue;
    let name = DIMENSION_TITLES[dimension].slice(0, SHEET_TITLE_LIMIT);
    // Distinct titles can still collide once truncated; Excel refuses duplicates.
    let suffix = 2;
    while (used.has(name)) name = `${DIMENSION_TITLES[dimension].slice(0, SHEET_TITLE_LIMIT - 2)} ${suffix++}`;
    used.add(name);

    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    headerRow(sheet, 1, ['Label', 'Visitors', 'Pageviews', 'Bounce rate %', 'Visit duration (s)']);
    rows.forEach((entry, index) => {
      const target = sheet.getRow(index + 2);
      target.values = [entry.label, entry.visitors, entry.pageviews, entry.bounceRate, entry.visitDuration];
      target.getCell(4).numFmt = '0.0';
      target.getCell(5).numFmt = '0';
    });
    autoWidth(sheet, [42, 12, 12, 14, 18]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── Generic tabular export (used by the intelligence console) ──────────────

export interface ExportSheet {
  /** Sheet name, also the CSV `section` discriminator. */
  name: string;
  columns: string[];
  rows: (string | number | null)[][];
}

export interface ExportMeta {
  title: string;
  window: string;
  generatedAt: string;
  notes: string[];
}

/**
 * Several tables in one rectangular CSV, discriminated by a `section` column.
 * Same shape as the analytics report export, so an analyst who has parsed one
 * has parsed both. BOM-prefixed for Excel.
 */
export function renderTablesCsv(meta: ExportMeta, sheets: ExportSheet[]): string {
  const width = Math.max(2, ...sheets.map((s) => s.columns.length));
  const pad = (cells: (string | number | null)[]): string[] =>
    Array.from({ length: width + 2 }, (_, i) => csvCell(i < cells.length ? cells[i] : ''));

  const lines: string[][] = [pad(['section', 'column_1'].concat(Array.from({ length: width }, (_, i) => `column_${i + 2}`)))];
  lines.push(pad(['meta', 'title', meta.title]));
  lines.push(pad(['meta', 'window', meta.window]));
  lines.push(pad(['meta', 'generated_at', meta.generatedAt]));
  for (const note of meta.notes) lines.push(pad(['meta', 'note', note]));

  for (const sheet of sheets) {
    lines.push(pad([sheet.name, ...sheet.columns]));
    for (const row of sheet.rows) lines.push(pad([sheet.name, ...row]));
  }
  return `﻿${lines.map((cells) => cells.join(',')).join('\r\n')}\r\n`;
}

/** The same tables as a branded workbook: a provenance sheet, then one per table. */
export async function renderTablesXlsx(meta: ExportMeta, sheets: ExportSheet[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LittleFounders';
  workbook.created = new Date(meta.generatedAt);

  const about = workbook.addWorksheet('About', { views: [{ showGridLines: false }] });
  about.mergeCells('A1:D1');
  const title = about.getCell('A1');
  title.value = meta.title;
  title.font = { bold: true, size: 16, color: { argb: BRAND.ink } };
  about.getRow(1).height = 26;
  let row = 3;
  for (const [label, value] of [['Window', meta.window], ['Generated', meta.generatedAt]] as [string, string][]) {
    about.getCell(`A${row}`).value = label;
    about.getCell(`A${row}`).font = { bold: true, size: 10, color: { argb: BRAND.muted } };
    about.mergeCells(`B${row}:D${row}`);
    about.getCell(`B${row}`).value = value;
    row += 1;
  }
  row += 1;
  for (const note of meta.notes) {
    about.mergeCells(`A${row}:D${row}`);
    const cell = about.getCell(`A${row}`);
    cell.value = note;
    cell.font = { size: 9, italic: true, color: { argb: BRAND.muted } };
    cell.alignment = { wrapText: true, vertical: 'top' };
    about.getRow(row).height = 28;
    row += 1;
  }
  autoWidth(about, [22, 26, 22, 22]);

  const used = new Set(['About']);
  for (const sheet of sheets) {
    let name = sheet.name.slice(0, SHEET_TITLE_LIMIT);
    let suffix = 2;
    while (used.has(name)) name = `${sheet.name.slice(0, SHEET_TITLE_LIMIT - 2)} ${suffix++}`;
    used.add(name);

    const target = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    headerRow(target, 1, sheet.columns);
    sheet.rows.forEach((values, index) => {
      target.getRow(index + 2).values = values as ExcelJS.CellValue[];
    });
    autoWidth(target, sheet.columns.map((c, i) => (i === 0 ? 38 : Math.max(14, c.length + 4))));
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

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

/*
 * Stated wherever the gap is non-zero, in every format. The number alone
 * invites the wrong reading — an operator seeing "signups observed: 0" beside
 * "accounts created: 31" needs to be told which of the two is the measurement
 * and which is the instrument.
 */
const FIRST_PARTY_GAP_NOTE =
  'Accounts created is the server-side record and is authoritative. The client signup funnel only fires for visitors who accepted optional cookies and kept the tab open, so treat its count as a floor.';

const PROVENANCE_NOTE =
  'Figures cover consented public marketing traffic only. Internal traffic exclusions apply from the moment each was added and do not change earlier data.';

/*
 * ── Provenance that answers the questions a reader would otherwise guess ──
 *
 * An outside reviewer read three of these exports on 2026-08-25 and reached
 * two confident, wrong conclusions from what the files did NOT say: that
 * dimensional tracking had been switched on in late July (it had not — the
 * acquisition filter excludes imported history from those breakdowns), and
 * that bounce/duration measurement began in March (it did not — imported rows
 * carry no session metrics at any date). Both answers were in Plausible's
 * response and neither reached the file.
 *
 * So the caveats now travel WITH the numbers. A caveat a reader has to go and
 * ask for is a caveat that becomes a wrong conclusion in someone's slide deck.
 */
export function importCaveats(report: PlausibleReportData): string[] {
  const notes: string[] = [];

  if (report.rangeDrift) {
    const { askedFor, answeredFor } = report.rangeDrift;
    notes.push(
      `WINDOW MISMATCH — figures were requested for ${askedFor[0]} to ${askedFor[1]} but the analytics API answered for ${answeredFor[0]} to ${answeredFor[1]}. Treat every number in this file as describing the second window, and report this.`,
    );
  }

  if (!report.imports.importsIncluded) {
    notes.push(
      `Headline totals EXCLUDE historical imported (GA4) traffic${
        report.imports.importsSkipReason ? ` — reason: ${report.imports.importsSkipReason}` : ''
      }.`,
    );
  }

  if (report.breakdownsWithoutImports.length) {
    notes.push(
      `These breakdowns cover natively tracked visits only and exclude historical imported (GA4) traffic, so they will not sum to the headline visitor total: ${report.breakdownsWithoutImports
        .map((d) => DIMENSION_TITLES[d])
        .join(', ')}. This is a property of how imported data is stored — it cannot be filtered by page — and not a gap in tracking.`,
    );
  }

  notes.push(
    'Bounce rate and visit duration are measured on natively tracked visits only; imported historical traffic carries no session metrics and contributes none.',
  );

  return notes;
}

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
  lines.push(['meta', 'imports_included', String(report.imports.importsIncluded), '', '', '', '']);
  for (const [i, caveat] of importCaveats(report).entries()) {
    lines.push(['meta', `caveat_${i + 1}`, caveat, '', '', '', '']);
  }

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

  /*
   * OUR OWN figures, as their own section.
   *
   * Emitted as `firstparty` rows rather than folded into `summary`, because
   * they are not the same measurement: `summary` is Plausible (anonymous,
   * consented, marketing pages only) and this is every session the product
   * recorded, with the role attached. Adding them together would produce a
   * number that is true of nothing.
   *
   * When the block is absent it says so explicitly — a reader must be able to
   * tell "we could not read this" from "these were zero".
   */
  if (report.firstParty) {
    const fp = report.firstParty;
    const row = (key: string, value: string) => lines.push(['firstparty', key, value, '', '', '', '']);
    row('sessions_anonymous', String(fp.sessions.anonymous));
    row('sessions_registered', String(fp.sessions.registered));
    row('sessions_staff', String(fp.sessions.staff));
    row('external_share', fp.externalShare === null ? 'no data' : fp.externalShare.toFixed(4));
    row('accounts_created', String(fp.accountsCreated));
    row('signups_observed_by_client_funnel', String(fp.signupObserved));
    row('accounts_unobserved', String(fp.unobserved));
    row('anonymous_visitors', String(fp.anonymousVisitors));
    row('anonymous_converted', String(fp.anonymousConverted));
    row('conversion_rate', fp.conversionRate === null ? 'no data' : fp.conversionRate.toFixed(4));
    if (fp.unobserved > 0) row('note', FIRST_PARTY_GAP_NOTE);
  } else {
    lines.push(['firstparty', 'status', 'unavailable — first-party views could not be read; this is NOT zero', '', '', '', '']);
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
  // The standing note, then whatever is true of THIS pull. A window mismatch
  // is coloured as a warning because it invalidates the sheet rather than
  // qualifying it.
  for (const [index, text] of [PROVENANCE_NOTE, ...importCaveats(report)].entries()) {
    summary.mergeCells(`A${row}:D${row}`);
    const cell = summary.getCell(`A${row}`);
    cell.value = text;
    const isDrift = text.startsWith('WINDOW MISMATCH');
    cell.font = {
      size: 9,
      italic: !isDrift,
      bold: isDrift,
      color: { argb: isDrift ? 'FFB45309' : BRAND.muted },
    };
    cell.alignment = { wrapText: true, vertical: 'top' };
    summary.getRow(row).height = index === 0 ? 30 : 26;
    row += 1;
  }
  autoWidth(summary, [26, 18, 18, 14]);

  /*
   * ── Our own audience ─────────────────────────────────────────────────────
   *
   * Its own sheet, before the trend, because it answers the question a reader
   * opens the file with — who was here — and because it must not be mistaken
   * for the Plausible figures on the Summary sheet. Those cover anonymous,
   * consented visitors on marketing pages; these cover every session the
   * product recorded, with the role attached. They are not addable.
   */
  const own = workbook.addWorksheet('Audience (first-party)', { views: [{ showGridLines: false }] });
  headerRow(own, 1, ['Measure', 'Value', 'Notes']);
  if (report.firstParty) {
    const fp = report.firstParty;
    const rows: [string, string | number, string][] = [
      ['Anonymous sessions', fp.sessions.anonymous, 'Visitors with no account'],
      ['Registered sessions', fp.sessions.registered, 'Signed-in, non-staff'],
      ['Staff sessions', fp.sessions.staff, 'Shown, not filtered — usually most of the volume pre-launch'],
      ['Share that was not staff', fp.externalShare === null ? 'no data' : `${(fp.externalShare * 100).toFixed(1)}%`, fp.externalShare === null ? 'No sessions in this window' : ''],
      ['Accounts created', fp.accountsCreated, 'Server-side record — authoritative'],
      ['Signups the client funnel saw', fp.signupObserved, 'Consent-gated; a floor, not a count'],
      ['Accounts unobserved', fp.unobserved, fp.unobserved > 0 ? FIRST_PARTY_GAP_NOTE : ''],
      ['Anonymous visitors', fp.anonymousVisitors, 'Arrived without an account'],
      ['Became accounts', fp.anonymousConverted, ''],
      ['Conversion', fp.conversionRate === null ? 'no data' : `${(fp.conversionRate * 100).toFixed(1)}%`, fp.conversionRate === null ? 'Nobody arrived — not 0%' : ''],
    ];
    rows.forEach(([measure, value, note], index) => {
      const row = own.getRow(index + 2);
      row.values = [measure, value, note];
      row.getCell(3).alignment = { wrapText: true, vertical: 'top' };
      if (note) row.height = 30;
    });
  } else {
    const row = own.getRow(2);
    row.values = ['Unavailable', '', 'The first-party views could not be read when this report was generated. This is NOT zero.'];
    row.getCell(3).alignment = { wrapText: true, vertical: 'top' };
    row.height = 30;
  }
  autoWidth(own, [30, 16, 62]);

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

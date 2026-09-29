import PDFDocument from 'pdfkit';
import { FREDOKA_SEMIBOLD_TTF, NUNITO_BOLD_TTF, NUNITO_REGULAR_TTF } from '../assets/reportFonts.js';

import type { PlausibleBreakdownRow, PlausibleDimensionKey, PlausibleReportData } from './pulse.js';

/*
 * Branded analytics report PDF (staff console → Export). Pure pdfkit
 * vector/text — NO image fetches, NO headless browser — so rendering stays
 * Railway-light and offline-safe. Colours are Frontend Bible 02 section 3
 * tokens and type is Fredoka (headings) and Nunito (body), per 02 D3, D4 and
 * D8: one design system for every surface, the staff console included.
 *
 * The report is localised. It used to be English-only with `en-US` number and
 * date formatters hardwired, which meant a Spanish-speaking operator exported
 * a document reading "Aug 14, 2026" and "1,234" to send to Spanish-speaking
 * stakeholders — the one artefact that leaves the building was the only
 * surface exempt from §1.8. Strings live here rather than in the frontend
 * i18n bundle because this is server-rendered and never reaches i18next.
 */

export const REPORT_LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;
export type ReportLocale = (typeof REPORT_LOCALES)[number];

interface ReportStrings {
  /* Our own audience block — see drawOwnAudience. */
  ownTitle: string; ownSub: string;
  ownAnon: string; ownReg: string; ownStaff: string; ownExternal: string;
  ownAccounts: string; ownObserved: string; ownVisitors: string; ownConverted: string;
  ownNoData: string; ownUnavailable: string; ownGap: string;
  title: string;
  generated: string;
  source: string;
  visitors: string;
  pageviews: string;
  bounceRate: string;
  avgDuration: string;
  noComparison: string;
  vsPrevious: string;
  rank: string;
  label: string;
  page: string;
  of: string;
  confidential: string;
  audiences: Record<PlausibleReportData['audience'], string>;
  window: string;
  to: string;
  filters: string;
  none: string;
  /** A breakdown with no rows for the window. */
  noData: string;
  trafficTitle: string;
  trafficSub: string;
  compositionTitle: string;
  compositionSub: string;
  dailyTotals: string;
  peakDay: string;
  /*
   * Period names are localised HERE rather than reused from pulse.ts's
   * PERIOD_LABELS, which is an English-only console constant. Sharing it would
   * have left "Last 30 days" printed at the top of a Spanish report — the
   * exact half-translated document this change exists to remove.
   */
  periods: Record<PlausibleReportData['period'], string>;
  /** Section headings, localised for the same reason as `periods`. */
  dimensions: Record<PlausibleDimensionKey, string>;
  /*
   * Provenance caveats, localised for the same reason as `periods`.
   *
   * They exist because an outside reviewer read three of these exports and
   * inferred two tracking failures that were not failures — the answers were
   * in the analytics API's own response and never reached the document.
   * `noImportsIn` takes the affected section names, `windowMismatch` the two
   * windows.
   */
  caveats: string;
  noImportsHeadline: string;
  noImportsIn: (sections: string) => string;
  sessionMetricsNative: string;
  windowMismatch: (asked: string, answered: string) => string;
}

const STRINGS: Record<ReportLocale, ReportStrings> = {
  'en-US': {
    ownTitle: 'Our own audience', ownSub: 'Every session the product recorded, not only consented marketing visitors',
    ownAnon: 'Anonymous sessions', ownReg: 'Registered sessions', ownStaff: 'Staff sessions', ownExternal: 'Not staff',
    ownAccounts: 'Accounts created', ownObserved: 'Signups the funnel saw', ownVisitors: 'Anonymous visitors', ownConverted: 'Became accounts',
    ownNoData: 'no data', ownUnavailable: 'The first-party views could not be read for this report. This is not zero.',
    ownGap: 'Accounts created is the server-side record and is authoritative. The client signup funnel only fires for visitors who accepted optional cookies, so treat its count as a floor.',
    title: 'Analytics Report', generated: 'Generated', source: 'Source: Plausible via Pulse',
    visitors: 'Visitors', pageviews: 'Pageviews', bounceRate: 'Bounce rate', avgDuration: 'Avg visit duration',
    noComparison: 'no comparison', vsPrevious: 'vs previous', rank: '#', label: 'LABEL',
    page: 'Page', of: 'of', confidential: 'Confidential | Internal use only',
    audiences: { marketing: 'Marketing', sales: 'Sales', frontend: 'Frontend', full: 'Full' },
    window: 'Window', to: 'to', filters: 'Filters', none: 'none', noData: 'No data for this period.',
    trafficTitle: 'Traffic over time', trafficSub: 'Daily visitors with pageview volume',
    compositionTitle: 'Audience composition', compositionSub: 'The most useful segments for the selected report',
    dailyTotals: 'Daily totals in the series', peakDay: 'Peak visitor day',
    periods: { day: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days', month: 'This month', '6mo': 'Last 6 months', '12mo': 'Last 12 months', year: 'This year', all: 'All time', custom: 'Custom range' },
    dimensions: { page: 'Top pages', source: 'Top sources', referrer: 'Top referrers', channel: 'Channels', country: 'Countries', region: 'Regions', device: 'Devices', browser: 'Browsers', os: 'Operating systems', entry_page: 'Entry pages', exit_page: 'Exit pages', utm_source: 'UTM sources', utm_medium: 'UTM mediums', utm_campaign: 'UTM campaigns' },
    caveats: 'How to read these figures',
    noImportsHeadline: 'Headline totals exclude historical imported traffic.',
    noImportsIn: (sections) => `These sections cover natively tracked visits only and will not sum to the headline total: ${sections}. Imported history cannot be broken down by page, so this is not a gap in tracking.`,
    sessionMetricsNative: 'Bounce rate and visit duration are measured on natively tracked visits only; imported historical traffic carries no session metrics.',
    windowMismatch: (asked, answered) => `Window mismatch: requested ${asked}, but the analytics API answered for ${answered}. Read every figure as describing the second window and report this.`,
  },
  'es-MX': {
    ownTitle: 'Nuestra propia audiencia', ownSub: 'Cada sesión que el producto registró, no sólo visitantes de marketing con consentimiento',
    ownAnon: 'Sesiones anónimas', ownReg: 'Sesiones registradas', ownStaff: 'Sesiones del staff', ownExternal: 'Que no es staff',
    ownAccounts: 'Cuentas creadas', ownObserved: 'Registros que vio el embudo', ownVisitors: 'Visitantes anónimos', ownConverted: 'Se hicieron cuenta',
    ownNoData: 'sin datos', ownUnavailable: 'No se pudieron leer las vistas de primera parte para este reporte. Esto no es cero.',
    ownGap: 'Cuentas creadas es el registro del servidor y es la autoridad. El embudo del navegador sólo dispara para quien aceptó cookies opcionales, así que su cifra es un piso.',
    title: 'Reporte de analítica', generated: 'Generado', source: 'Fuente: Plausible vía Pulse',
    visitors: 'Visitantes', pageviews: 'Páginas vistas', bounceRate: 'Tasa de rebote', avgDuration: 'Duración media',
    noComparison: 'sin comparación', vsPrevious: 'vs anterior', rank: '#', label: 'ETIQUETA',
    page: 'Página', of: 'de', confidential: 'Confidencial | Uso interno',
    audiences: { marketing: 'Marketing', sales: 'Ventas', frontend: 'Frontend', full: 'Completo' },
    window: 'Ventana', to: 'a', filters: 'Filtros', none: 'ninguno', noData: 'Sin datos para este periodo.',
    trafficTitle: 'Tráfico en el tiempo', trafficSub: 'Visitantes diarios con volumen de páginas vistas',
    compositionTitle: 'Composición de la audiencia', compositionSub: 'Los segmentos más útiles para este reporte',
    dailyTotals: 'Totales diarios de la serie', peakDay: 'Día pico de visitantes',
    periods: { day: 'Hoy', '7d': 'Últimos 7 días', '30d': 'Últimos 30 días', month: 'Este mes', '6mo': 'Últimos 6 meses', '12mo': 'Últimos 12 meses', year: 'Este año', all: 'Todo el tiempo', custom: 'Rango personalizado' },
    dimensions: { page: 'Páginas principales', source: 'Fuentes principales', referrer: 'Referencias principales', channel: 'Canales', country: 'Países', region: 'Regiones', device: 'Dispositivos', browser: 'Navegadores', os: 'Sistemas operativos', entry_page: 'Páginas de entrada', exit_page: 'Páginas de salida', utm_source: 'Fuentes UTM', utm_medium: 'Medios UTM', utm_campaign: 'Campañas UTM' },
    caveats: 'Cómo leer estas cifras',
    noImportsHeadline: 'Los totales principales excluyen el tráfico histórico importado.',
    noImportsIn: (sections) => `Estas secciones cubren únicamente visitas medidas de forma nativa y no sumarán el total principal: ${sections}. El histórico importado no se puede desglosar por página, así que no es una falla de medición.`,
    sessionMetricsNative: 'La tasa de rebote y la duración se miden solo sobre visitas nativas; el tráfico histórico importado no aporta métricas de sesión.',
    windowMismatch: (asked, answered) => `Ventana discordante: se solicitó ${asked}, pero la API de analítica respondió por ${answered}. Lee cada cifra como si describiera la segunda ventana y reporta esto.`,
  },
  'pt-BR': {
    ownTitle: 'Nosso próprio público', ownSub: 'Cada sessão que o produto registrou, não apenas visitantes de marketing com consentimento',
    ownAnon: 'Sessões anônimas', ownReg: 'Sessões registradas', ownStaff: 'Sessões da equipe', ownExternal: 'Que não é equipe',
    ownAccounts: 'Contas criadas', ownObserved: 'Cadastros que o funil viu', ownVisitors: 'Visitantes anônimos', ownConverted: 'Viraram contas',
    ownNoData: 'sem dados', ownUnavailable: 'Não foi possível ler as visões de primeira parte para este relatório. Isto não é zero.',
    ownGap: 'Contas criadas é o registro do servidor e é a autoridade. O funil do navegador só dispara para quem aceitou cookies opcionais, então seu número é um piso.',
    title: 'Relatório de análise', generated: 'Gerado', source: 'Fonte: Plausible via Pulse',
    visitors: 'Visitantes', pageviews: 'Visualizações', bounceRate: 'Taxa de rejeição', avgDuration: 'Duração média',
    noComparison: 'sem comparação', vsPrevious: 'vs anterior', rank: '#', label: 'RÓTULO',
    page: 'Página', of: 'de', confidential: 'Confidencial | Uso interno',
    audiences: { marketing: 'Marketing', sales: 'Vendas', frontend: 'Frontend', full: 'Completo' },
    window: 'Janela', to: 'a', filters: 'Filtros', none: 'nenhum', noData: 'Sem dados para este período.',
    trafficTitle: 'Tráfego ao longo do tempo', trafficSub: 'Visitantes diários com volume de visualizações',
    compositionTitle: 'Composição do público', compositionSub: 'Os segmentos mais úteis para este relatório',
    dailyTotals: 'Totais diários da série', peakDay: 'Dia de pico de visitantes',
    periods: { day: 'Hoje', '7d': 'Últimos 7 dias', '30d': 'Últimos 30 dias', month: 'Este mês', '6mo': 'Últimos 6 meses', '12mo': 'Últimos 12 meses', year: 'Este ano', all: 'Todo o período', custom: 'Intervalo personalizado' },
    dimensions: { page: 'Páginas principais', source: 'Fontes principais', referrer: 'Referências principais', channel: 'Canais', country: 'Países', region: 'Regiões', device: 'Dispositivos', browser: 'Navegadores', os: 'Sistemas operacionais', entry_page: 'Páginas de entrada', exit_page: 'Páginas de saída', utm_source: 'Fontes UTM', utm_medium: 'Meios UTM', utm_campaign: 'Campanhas UTM' },
    caveats: 'Como ler estes números',
    noImportsHeadline: 'Os totais principais excluem o tráfego histórico importado.',
    noImportsIn: (sections) => `Estas seções cobrem apenas visitas medidas nativamente e não somarão o total principal: ${sections}. O histórico importado não pode ser detalhado por página, então não é uma falha de medição.`,
    sessionMetricsNative: 'A taxa de rejeição e a duração são medidas apenas em visitas nativas; o tráfego histórico importado não fornece métricas de sessão.',
    windowMismatch: (asked, answered) => `Janela divergente: solicitou-se ${asked}, mas a API de análise respondeu por ${answered}. Leia cada número como descrevendo a segunda janela e reporte isto.`,
  },
};

/*
 * Formatters are built per render, not per module: a module-level Intl
 * instance pinned to one locale is exactly how the report ended up English
 * regardless of who exported it.
 */
interface ReportContext {
  locale: ReportLocale;
  s: ReportStrings;
  int: Intl.NumberFormat;
  /** A share given as 0-1. */
  pct: Intl.NumberFormat;
  /** A signed change given as 0-1 (+12.5%, -3%). */
  signedPct: Intl.NumberFormat;
  date: Intl.DateTimeFormat;
  shortDate: Intl.DateTimeFormat;
}

function contextFor(locale: ReportLocale): ReportContext {
  return {
    locale,
    s: STRINGS[locale],
    int: new Intl.NumberFormat(locale),
    pct: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }),
    signedPct: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' }),
    date: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }),
    shortDate: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
  };
}

/*
 * Frontend Bible 02 section 3 tokens (light mode: a PDF is printed on
 * paper), resolved to hex because a PDF has no CSS variables. The source of
 * truth is frontend/src/rebuild/design/tokens.css; `analyticsReportTokens.test.ts`
 * fails on any colour in this file or analyticsExport.ts that is not one of
 * them. The retired indigo, violet and slate palette of the deleted DESIGN.md was
 * replaced by D4; the decorative violet is gone (02 section 10).
 */
export const REPORT_TOKENS = {
  primary: '#5c55fd', // --primary
  primaryStrong: '#5850f8', // --primary-strong
  primaryRidge: '#4438cf', // --primary-ridge (text on white, 7:1; the mark's ridge)
  onPrimary: '#ffffff', // --on-primary
  reward: '#ebb806', // --reward (the mark's coin only)
  rewardRidge: '#a88205', // --reward-ridge
  primarySoft: '#eceffe', // --primary-soft
  sunken: '#eaecf6', // --sunken
  content: '#11132a', // --content
  contentMuted: '#66697c', // --content-muted
  outline: '#d5d8e7', // --outline
  successStrong: '#027b45', // --success-strong
  errorStrong: '#d60f26', // --error-strong
  warningStrong: '#856600', // --warning-strong
} as const;

const ACCENT = REPORT_TOKENS.primary;
const ACCENT_STRONG = REPORT_TOKENS.primaryRidge;
const INK = REPORT_TOKENS.content;
const MUTED = REPORT_TOKENS.contentMuted;
const RULE = REPORT_TOKENS.outline;
const WARNING = REPORT_TOKENS.warningStrong;
const SOFT_ACCENT = REPORT_TOKENS.primarySoft;
const SOFT_SURFACE = REPORT_TOKENS.sunken;
const SUCCESS = REPORT_TOKENS.successStrong;
const ERROR = REPORT_TOKENS.errorStrong;
/* brand.mark (frontend/public/rebuild/brand/mark.svg), drawn as vectors. */
const MARK_RIDGE = REPORT_TOKENS.primaryRidge;
const MARK_COIN = REPORT_TOKENS.reward;
const MARK_COIN_RIDGE = REPORT_TOKENS.rewardRidge;
const ON_PRIMARY = REPORT_TOKENS.onPrimary;

/*
 * The house typefaces, registered on every document (registerFonts). HEADING
 * is Fredoka SemiBold; BODY and BODY_BOLD are Nunito. They carry the whole
 * Latin set the three locales use, so text is never rewritten to '?' (the
 * old Helvetica path needed toLatin1 and turned any other character into one).
 */
const HEADING = 'LF-Heading';
const BODY = 'LF-Body';
const BODY_BOLD = 'LF-Body-Bold';

function registerFonts(doc: PDFKit.PDFDocument): void {
  doc.registerFont(HEADING, FREDOKA_SEMIBOLD_TTF);
  doc.registerFont(BODY, NUNITO_REGULAR_TTF);
  doc.registerFont(BODY_BOLD, NUNITO_BOLD_TTF);
  doc.font(BODY);
}

const MARGIN = 48;
const BOTTOM_MARGIN = 64; // reserves the footer band
const ROW_H = 22;
/*
 * The smallest text the report sets: 10.5 pt is the 14 px floor of Bible 02
 * rule 11 (1 px = 0.75 pt). Every body line, label, axis tick, caveat and
 * footer uses it; headings and figures are larger.
 */
export const TEXT = 10.5;


function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(ctx: ReportContext, date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : ctx.date.format(parsed);
}

function formatShortDate(ctx: ReportContext, date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : ctx.shortDate.format(parsed);
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
  doc.font(HEADING).fontSize(52).fillColor(INK).fillOpacity(0.05);
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

function drawHeader(doc: PDFKit.PDFDocument, ctx: ReportContext, data: PlausibleReportData): void {
  // Two-tone brand bar and the brand lockup. The mark is drawn as vectors,
  // not read from a file: the PDF must not depend on a frontend filesystem
  // asset that a build step might not copy into the deployed image.
  doc.rect(0, 0, doc.page.width, 6).fill(ACCENT);
  drawLogo(doc, MARGIN, 34);
  const width = contentWidth(doc);
  doc.font(HEADING).fontSize(13).fillColor(ACCENT_STRONG)
    .text(`${ctx.s.title}: ${ctx.s.audiences[data.audience]}`, MARGIN, 76, { width });
  doc.font(BODY).fontSize(TEXT).fillColor(MUTED)
    .text(`${ctx.s.periods[data.period]}  |  ${ctx.s.generated} ${formatDate(ctx, data.generatedAt.slice(0, 10))}  |  ${ctx.s.source}`, MARGIN, doc.y + 2, { width });
  /*
   * The window comes from the RESOLVED range, not from the first and last
   * points of the series. Those are the days that had traffic; printing them
   * as "the data range" silently shrank the reported window whenever the
   * period began or ended quietly, which is exactly when someone is trying to
   * work out whether a campaign did anything.
   */
  doc.font(BODY_BOLD).fontSize(TEXT).fillColor(ACCENT_STRONG)
    .text(`${ctx.s.window}: ${formatDate(ctx, data.from)} ${ctx.s.to} ${formatDate(ctx, data.to)}`, MARGIN, doc.y + 2, { width });
  // Every filter is printed whole; a long list wraps (02 section 7 rule 1: text never truncates).
  const filterText = data.appliedFilters.length ? `${ctx.s.filters}: ${data.appliedFilters.join('  AND  ')}` : `${ctx.s.filters}: ${ctx.s.none}`;
  doc.font(BODY).fontSize(TEXT).fillColor(MUTED).text(filterText, MARGIN, doc.y + 2, { width });

  const ruleY = doc.y + 6;
  doc.moveTo(MARGIN, ruleY).lineTo(doc.page.width - MARGIN, ruleY).lineWidth(1).strokeColor(RULE).stroke();
  doc.y = ruleY + 14;
}

/**
 * The brand lockup: the `brand.mark` asset drawn as pdfkit vectors from its
 * own 64-unit geometry, beside the product name set as text. The report used
 * to inline the legacy raster wordmark (gradient lettering), the last outbound
 * document still wearing it after the site, icons and share cards moved to
 * the mark (Bible 02 D3, D4, D8; 07 sections 1 and 3). Vectors keep the
 * report free of any file read or fetch, as before.
 */
export const LOGO_MARK_SIZE = 32;
export const LOGO_WORDMARK = 'LittleFounders';

export function drawLogo(doc: PDFKit.PDFDocument, x: number, y: number): void {
  const k = LOGO_MARK_SIZE / 64;
  doc.save();
  doc.roundedRect(x, y, 64 * k, 64 * k, 16 * k).fill(MARK_RIDGE);
  doc.roundedRect(x, y, 64 * k, 60 * k, 16 * k).fill(ACCENT);
  for (const [bx, by, bh] of [[13, 37, 13], [27, 29, 21], [41, 21, 29]] as const) {
    doc.roundedRect(x + bx * k, y + by * k, 10 * k, bh * k, 3 * k).fill(ON_PRIMARY);
  }
  doc.circle(x + 46 * k, y + 12.5 * k, 7 * k).fill(MARK_COIN_RIDGE);
  doc.circle(x + 46 * k, y + 11.5 * k, 6.5 * k).fill(MARK_COIN);
  doc.restore();
  // Registered here too: the lockup is also drawn on a bare document (tests),
  // and pdfkit caches a loaded font by name, so this never embeds it twice.
  doc.registerFont(HEADING, FREDOKA_SEMIBOLD_TTF);
  doc
    .font(HEADING)
    .fontSize(18)
    .fillColor(INK)
    .text(LOGO_WORDMARK, x + LOGO_MARK_SIZE + 10, y + (LOGO_MARK_SIZE - 18) / 2 + 1, { lineBreak: false });
}


/**
 * Percent change against the previous window. `null` when there is nothing to
 * compare (all-time, or the comparison read failed): printed as text, never
 * as 0%, which would assert a flat trend nobody measured.
 */
function changeOf(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null;
  return (current - previous) / previous;
}

function drawKpiBlock(doc: PDFKit.PDFDocument, ctx: ReportContext, data: PlausibleReportData): void {
  const { aggregate, previous } = data;
  const cards = [
    { label: ctx.s.visitors, value: ctx.int.format(aggregate.visitors), change: changeOf(aggregate.visitors, previous?.visitors), higherIsBetter: true },
    { label: ctx.s.pageviews, value: ctx.int.format(aggregate.pageviews), change: changeOf(aggregate.pageviews, previous?.pageviews), higherIsBetter: true },
    { label: ctx.s.bounceRate, value: ctx.pct.format(aggregate.bounceRate / 100), change: changeOf(aggregate.bounceRate, previous?.bounceRate), higherIsBetter: false },
    { label: ctx.s.avgDuration, value: formatDuration(aggregate.visitDuration), change: changeOf(aggregate.visitDuration, previous?.visitDuration), higherIsBetter: true },
  ].map((card) => ({
    ...card,
    label: card.label.toUpperCase(),
    changeText: card.change === null ? ctx.s.noComparison : `${ctx.signedPct.format(card.change)} ${ctx.s.vsPrevious}`,
  }));
  const gap = 12;
  const w = (contentWidth(doc) - gap * (cards.length - 1)) / cards.length;
  const inner = w - 20;
  // Every card is as tall as its longest wrapped label and change line: nothing is cut to fit a fixed box.
  doc.font(BODY).fontSize(TEXT);
  const labelH = Math.max(...cards.map((card) => doc.heightOfString(card.label, { width: inner })));
  const changeH = Math.max(...cards.map((card) => doc.heightOfString(card.changeText, { width: inner })));
  const valueH = 22;
  const h = 11 + labelH + 4 + valueH + 4 + changeH + 10;
  ensureRoom(doc, h + 22);
  const top = doc.y;
  cards.forEach((card, i) => {
    const x = MARGIN + i * (w + gap);
    doc.roundedRect(x, top, w, h, 6).lineWidth(1).strokeColor(RULE).stroke();
    doc.rect(x, top + 8, 3, h - 16).fill(i === 0 ? ACCENT : RULE);
    doc.font(BODY).fontSize(TEXT).fillColor(MUTED).text(card.label, x + 12, top + 11, { width: inner });
    doc.font(HEADING).fontSize(16).fillColor(INK).text(card.value, x + 12, top + 15 + labelH, { width: inner });
    // Direction is coloured by whether the movement is GOOD, not by its sign:
    // a bounce rate falling 20% is a win and must not print in red.
    const tone = card.change === null ? MUTED : (card.change >= 0) === card.higherIsBetter ? SUCCESS : ERROR;
    doc.font(BODY).fontSize(TEXT).fillColor(tone).text(card.changeText, x + 12, top + 19 + labelH + valueH, { width: inner });
  });
  doc.y = top + h + 22;
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, subtitle?: string): void {
  const width = contentWidth(doc);
  doc.font(BODY).fontSize(TEXT);
  const subtitleH = subtitle ? doc.heightOfString(subtitle, { width }) : 0;
  ensureRoom(doc, 28 + subtitleH + 8);
  const y = doc.y;
  doc.font(HEADING).fontSize(14).fillColor(INK).text(title, MARGIN, y, { width });
  const underline = Math.max(doc.y, y + 19);
  doc.moveTo(MARGIN, underline).lineTo(MARGIN + 46, underline).lineWidth(2).strokeColor(ACCENT).stroke();
  /*
   * The subtitle sits on its own line under the title and wraps to the full
   * width. It used to share the title's line and was cut with an ellipsis
   * whenever a locale's title or subtitle ran long (02 section 7 rule 1).
   */
  if (subtitle) {
    doc.font(BODY).fontSize(TEXT).fillColor(MUTED).text(subtitle, MARGIN, underline + 6, { width });
    doc.y += 8;
  } else {
    doc.y = underline + 10;
  }
}

function drawTrendChart(doc: PDFKit.PDFDocument, ctx: ReportContext, data: PlausibleReportData): void {
  const series = data.timeseries;
  if (series.length === 0) return;
  const firstSeriesPoint = series[0];
  if (!firstSeriesPoint) return;
  const chartH = 170;
  const chartW = contentWidth(doc);
  ensureRoom(doc, chartH + 110);
  drawSectionTitle(doc, ctx.s.trafficTitle, ctx.s.trafficSub);

  const top = doc.y;
  doc.fillOpacity(1).roundedRect(MARGIN, top, chartW, chartH, 8).fill(SOFT_ACCENT);
  const axisW = 44;
  const plotX = MARGIN + axisW + 6;
  const plotY = top + 18;
  const plotW = chartW - axisW - 20;
  const plotH = chartH - 52;
  const maxValue = Math.max(...series.flatMap((point) => [point.visitors, point.pageviews]), 1);
  const yFor = (value: number) => plotY + plotH - (value / maxValue) * plotH;
  const xFor = (index: number) => plotX + (series.length === 1 ? plotW / 2 : (index / (series.length - 1)) * plotW);

  doc.font(BODY).fontSize(TEXT).fillColor(MUTED);
  for (const ratio of [0, 0.5, 1]) {
    const y = plotY + plotH - ratio * plotH;
    doc.moveTo(plotX, y).lineTo(plotX + plotW, y).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.text(ctx.int.format(Math.round(maxValue * ratio)), MARGIN + 2, y - 6, { width: axisW, align: 'right', lineBreak: false });
  }

  const barW = Math.max(1.5, Math.min(7, (plotW / series.length) * 0.58));
  series.forEach((point, index) => {
    const x = xFor(index);
    const barTop = yFor(point.pageviews);
    doc.save().fillOpacity(0.3).rect(x - barW / 2, barTop, barW, plotY + plotH - barTop).fill(ACCENT).restore();
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

  doc.font(BODY).fontSize(TEXT).fillColor(MUTED);
  const labelIndexes = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])];
  labelIndexes.forEach((index) => {
    const x = xFor(index);
    const point = series[index];
    if (point) doc.text(formatShortDate(ctx, point.date), x - 40, plotY + plotH + 8, { width: 80, align: 'center', lineBreak: false });
  });

  /*
   * The legend sits BELOW the plotted card, not inside it, and its positions
   * are measured from the rendered strings: "Páginas vistas" is nearly twice
   * the width of "Pageviews", so a layout tuned to English text collided as
   * soon as the report could speak anything else.
   */
  const legendY = top + chartH + 8;
  doc.font(BODY).fontSize(TEXT);
  const visitorsW = doc.widthOfString(ctx.s.visitors);
  doc.circle(MARGIN + 16, legendY + 6, 3.5).fill(ACCENT_STRONG);
  doc.fillColor(MUTED).text(ctx.s.visitors, MARGIN + 24, legendY, { lineBreak: false });
  const swatchX = MARGIN + 24 + visitorsW + 16;
  doc.fillOpacity(0.45).rect(swatchX, legendY + 2, 8, 8).fill(ACCENT);
  doc.fillOpacity(1).fillColor(MUTED).text(ctx.s.pageviews, swatchX + 14, legendY, { lineBreak: false });
  doc.y = legendY + 22;

  const totalVisitors = series.reduce((sum, point) => sum + point.visitors, 0);
  const totalPageviews = series.reduce((sum, point) => sum + point.pageviews, 0);
  const peak = series.reduce((best, point) => (point.visitors > best.visitors ? point : best), firstSeriesPoint);
  doc.font(BODY).fontSize(TEXT).fillColor(MUTED).text(
    `${ctx.s.dailyTotals}: ${ctx.int.format(totalVisitors)} ${ctx.s.visitors.toLowerCase()} | ${ctx.int.format(totalPageviews)} ${ctx.s.pageviews.toLowerCase()} | ${ctx.s.peakDay}: ${formatDate(ctx, peak.date)}`,
    MARGIN,
    doc.y,
    { width: chartW },
  );
  doc.y += 18;
}

/** The label a breakdown row prints: its own text, or the locale's word for none. */
function rowLabel(ctx: ReportContext, label: string): string {
  return label || ctx.s.none;
}

function drawSnapshotBars(doc: PDFKit.PDFDocument, ctx: ReportContext, data: PlausibleReportData): void {
  const preferred: PlausibleDimensionKey[] = ['country', 'source', 'channel', 'device', 'page', 'browser', 'os'];
  const dimensions = preferred.filter((dimension) => (data.breakdowns[dimension] ?? []).length > 0).slice(0, 4);
  if (dimensions.length === 0) return;
  const gap = 14;
  const cardW = (contentWidth(doc) - gap) / 2;
  const bodyTop = 38;
  const numW = 64;
  const labelW = cardW - 24 - numW - 8;
  /*
   * A card is as tall as its rows, and each label wraps to its full text. A
   * card holds up to five rows while it stays under MAX_CARD; a row that
   * would push it past that is left out, with every row after it, so the
   * snapshot keeps its ranking and never cuts a label to make room (02
   * section 7 rule 1). The full breakdown tables below list every row.
   */
  const MAX_CARD = 320;
  const cards = dimensions.map((dimension) => {
    const all = (data.breakdowns[dimension] ?? []).slice(0, 5);
    doc.font(BODY).fontSize(TEXT);
    const rows: { item: PlausibleBreakdownRow; label: string; height: number }[] = [];
    let used = 0;
    for (const item of all) {
      const label = rowLabel(ctx, item.label);
      const height = doc.heightOfString(label, { width: labelW }) + 12;
      if (bodyTop + used + height + 10 > MAX_CARD) break;
      rows.push({ item, label, height });
      used += height;
    }
    return { dimension, rows, max: Math.max(...all.map((item) => item.visitors), 1), height: Math.max(bodyTop + used + 10, 80) };
  });

  const firstPair = Math.max(...cards.slice(0, 2).map((card) => card.height));
  ensureRoom(doc, firstPair + 64);
  drawSectionTitle(doc, ctx.s.compositionTitle, ctx.s.compositionSub);
  for (let start = 0; start < cards.length; start += 2) {
    const pair = cards.slice(start, start + 2);
    const cardH = Math.max(...pair.map((card) => card.height));
    ensureRoom(doc, cardH + gap);
    const y = doc.y;
    pair.forEach(({ dimension, rows, max }, column) => {
      const x = MARGIN + column * (cardW + gap);
      doc.roundedRect(x, y, cardW, cardH, 7).fill(column === 0 ? SOFT_SURFACE : SOFT_ACCENT);
      doc.font(HEADING).fontSize(12).fillColor(INK).text(ctx.s.dimensions[dimension], x + 12, y + 12, { width: cardW - 24, lineBreak: false });
      let rowY = y + bodyTop;
      for (const { item, label, height } of rows) {
        doc.font(BODY).fontSize(TEXT).fillColor(MUTED).text(label, x + 12, rowY, { width: labelW });
        const barY = rowY + height - 9;
        doc.roundedRect(x + 12, barY, labelW, 3, 1.5).fill(RULE);
        doc.roundedRect(x + 12, barY, Math.max(3, (labelW * item.visitors) / max), 3, 1.5).fill(column === 0 ? ACCENT_STRONG : ACCENT);
        doc.font(BODY).fontSize(TEXT).fillColor(MUTED);
        numberCell(doc, ctx, item.visitors, x + cardW - 12 - numW, rowY, numW);
        rowY += height;
      }
    });
    doc.y = y + cardH + gap;
  }
  doc.y += 4;
}

/** One right-aligned numeric cell, as wide as the column; a number is never cut. */
function numberCell(doc: PDFKit.PDFDocument, ctx: ReportContext, value: number, x: number, y: number, width: number): void {
  doc.text(ctx.int.format(value), x, y, { width, align: 'right' });
}

function drawBreakdownSection(doc: PDFKit.PDFDocument, ctx: ReportContext, title: string, rows: PlausibleBreakdownRow[]): void {
  // Column layout: rank | label (flexible, wraps) | visitors | pageviews.
  const rankW = 32;
  const numW = 84;
  const labelW = contentWidth(doc) - rankW - numW * 2;
  const labelX = MARGIN + rankW;
  const visitorsX = labelX + labelW;
  const pageviewsX = visitorsX + numW;
  const labelInner = labelW - 8;

  const drawColumnHeads = (): void => {
    const y = doc.y;
    doc.font(BODY_BOLD).fontSize(TEXT).fillColor(MUTED);
    doc.text(ctx.s.rank, MARGIN, y, { width: rankW - 6, lineBreak: false });
    doc.text(ctx.s.label, labelX, y, { width: labelInner });
    const labelBottom = doc.y;
    doc.text(ctx.s.visitors.toUpperCase(), visitorsX, y, { width: numW, align: 'right' });
    const visitorsBottom = doc.y;
    doc.text(ctx.s.pageviews.toUpperCase(), pageviewsX, y, { width: numW, align: 'right' });
    const bottom = Math.max(labelBottom, visitorsBottom, doc.y, y + ROW_H - 4);
    doc.moveTo(MARGIN, bottom + 2).lineTo(doc.page.width - MARGIN, bottom + 2).lineWidth(1).strokeColor(RULE).stroke();
    doc.y = bottom + 8;
  };

  // Heading + column heads + first row travel together across page breaks.
  ensureRoom(doc, 34 + ROW_H * 3);
  const headingY = doc.y;
  doc.font(HEADING).fontSize(12).fillColor(INK).text(title, MARGIN, headingY, { width: contentWidth(doc) });
  const underline = Math.max(doc.y, headingY + 17);
  doc.moveTo(MARGIN, underline).lineTo(MARGIN + 42, underline).lineWidth(2).strokeColor(ACCENT).stroke();
  doc.y = underline + 9;
  drawColumnHeads();

  if (rows.length === 0) {
    doc.font(BODY).fontSize(TEXT).fillColor(MUTED).text(ctx.s.noData, MARGIN, doc.y, { width: contentWidth(doc) });
    doc.y += 14;
    return;
  }

  rows.forEach((row, i) => {
    // A row is as tall as its wrapped label: the whole label is printed, never trimmed.
    const label = rowLabel(ctx, row.label);
    doc.font(BODY).fontSize(TEXT);
    const rowH = Math.max(ROW_H, doc.heightOfString(label, { width: labelInner }) + 8);
    if (doc.y + rowH > pageBottom(doc)) {
      doc.addPage();
      drawColumnHeads();
    }
    const y = doc.y;
    doc.font(BODY).fontSize(TEXT).fillColor(MUTED);
    doc.text(String(i + 1), MARGIN, y, { width: rankW - 6, lineBreak: false });
    doc.fillColor(INK);
    doc.text(label, labelX, y, { width: labelInner });
    numberCell(doc, ctx, row.visitors, visitorsX, y, numW);
    numberCell(doc, ctx, row.pageviews, pageviewsX, y, numW);
    doc.moveTo(MARGIN, y + rowH - 4).lineTo(doc.page.width - MARGIN, y + rowH - 4).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.y = y + rowH;
  });
  doc.y += 14;
}

/**
 * The caveats block: what these numbers do and do not cover.
 *
 * Placed at the END, after every table it qualifies, because a reader who has
 * seen a breakdown that does not add up to the headline needs the explanation
 * to be somewhere they will still be reading. Leaving it out produced two
 * confident and entirely wrong conclusions in an outside review on
 * 2026-08-25, both of which named tracking failures that never happened
 * (WALKTHROUGH, 2026-08-27).
 */
/*
 * Our own audience, on the page that leaves the building.
 *
 * The rest of this report is Plausible: anonymous, consented visitors on
 * marketing pages. That is a narrower measurement than any reader assumes, and
 * a PDF is exactly where an unstated narrowing does its damage: it gets
 * forwarded, quoted and acted on months later with no chance to ask.
 *
 * So the first-party figures travel with it, and the gap between accounts
 * created and signups the funnel observed is printed in words rather than left
 * as two numbers a reader has to reconcile.
 */
function drawOwnAudience(doc: PDFKit.PDFDocument, ctx: ReportContext, data: PlausibleReportData): void {
  const fp = data.firstParty;
  ensureRoom(doc, 170);
  drawSectionTitle(doc, ctx.s.ownTitle, ctx.s.ownSub);
  const width = contentWidth(doc);

  if (!fp) {
    // Unread is not zero, and the report says which one this is.
    doc.font(BODY).fontSize(TEXT).fillColor(MUTED);
    doc.text(ctx.s.ownUnavailable, MARGIN, doc.y, { width });
    doc.moveDown(1);
    return;
  }

  const pctOf = (v: number | null) => (v === null ? ctx.s.ownNoData : ctx.pct.format(v));
  const cells: [string, string][] = [
    [ctx.s.ownAnon, ctx.int.format(fp.sessions.anonymous)],
    [ctx.s.ownReg, ctx.int.format(fp.sessions.registered)],
    [ctx.s.ownStaff, ctx.int.format(fp.sessions.staff)],
    [ctx.s.ownExternal, pctOf(fp.externalShare)],
    [ctx.s.ownAccounts, ctx.int.format(fp.accountsCreated)],
    [ctx.s.ownObserved, ctx.int.format(fp.signupObserved)],
    [ctx.s.ownVisitors, ctx.int.format(fp.anonymousVisitors)],
    [ctx.s.ownConverted, ctx.int.format(fp.anonymousConverted)],
  ];

  const perRow = 4;
  const cellW = width / perRow;
  let top = doc.y;
  for (let start = 0; start < cells.length; start += perRow) {
    const rowCells = cells.slice(start, start + perRow);
    doc.font(BODY).fontSize(TEXT);
    const labelH = Math.max(...rowCells.map(([label]) => doc.heightOfString(label, { width: cellW - 8 })));
    const rowH = 21 + labelH + 10;
    ensureRoom(doc, rowH);
    if (doc.y < top) top = doc.y;
    rowCells.forEach(([label, value], col) => {
      const x = MARGIN + col * cellW;
      doc.font(HEADING).fontSize(15).fillColor(INK).text(value, x, top, { width: cellW - 8 });
      doc.font(BODY).fontSize(TEXT).fillColor(MUTED).text(label, x, top + 21, { width: cellW - 8 });
    });
    top += rowH;
    doc.y = top;
  }
  doc.y = top + 4;

  if (fp.unobserved > 0) {
    doc.font(BODY).fontSize(TEXT).fillColor(MUTED);
    doc.text(ctx.s.ownGap, MARGIN, doc.y, { width });
    doc.moveDown(0.8);
  }
}

function drawCaveats(doc: PDFKit.PDFDocument, ctx: ReportContext, data: PlausibleReportData): void {
  const lines: { text: string; warn: boolean }[] = [];

  if (data.rangeDrift) {
    const { askedFor, answeredFor } = data.rangeDrift;
    lines.push({
      text: ctx.s.windowMismatch(
        `${formatDate(ctx, askedFor[0])} ${ctx.s.to} ${formatDate(ctx, askedFor[1])}`,
        `${formatDate(ctx, answeredFor[0])} ${ctx.s.to} ${formatDate(ctx, answeredFor[1])}`,
      ),
      warn: true,
    });
  }
  if (!data.imports.importsIncluded) lines.push({ text: ctx.s.noImportsHeadline, warn: false });
  if (data.breakdownsWithoutImports.length) {
    lines.push({
      text: ctx.s.noImportsIn(data.breakdownsWithoutImports.map((d) => ctx.s.dimensions[d]).join(', ')),
      warn: false,
    });
  }
  lines.push({ text: ctx.s.sessionMetricsNative, warn: false });

  // Keep the block whole: a caveat split across a page break reads as two
  // half-sentences, and the warning line must never be the orphan.
  const width = contentWidth(doc);
  doc.font(BODY).fontSize(TEXT);
  const estimated = 30 + lines.reduce((sum, line) => sum + doc.heightOfString(`•  ${line.text}`, { width }) + 5, 0);
  if (doc.y + estimated > doc.page.height - BOTTOM_MARGIN) doc.addPage();

  doc.font(HEADING).fontSize(12).fillColor(INK).text(ctx.s.caveats, MARGIN, doc.y, { width });
  doc.y += 6;

  for (const line of lines) {
    doc
      .font(line.warn ? BODY_BOLD : BODY)
      .fontSize(TEXT)
      .fillColor(line.warn ? WARNING : MUTED)
      .text(`•  ${line.text}`, MARGIN, doc.y, { width });
    doc.y += 5;
  }
}

/** Footer pass over the buffered pages: it needs the final page count. */
function drawFooters(doc: PDFKit.PDFDocument, ctx: ReportContext): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    // The footer sits inside the reserved bottom band; zero the margin while
    // writing there or pdfkit auto-adds a page per footer (its layout treats
    // any text past maxY as overflow, even at an explicit position).
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font(BODY)
      .fontSize(TEXT)
      .fillColor(MUTED)
      .text(
        `${ctx.s.page} ${i + 1} ${ctx.s.of} ${range.count}  |  ${ctx.s.confidential}`,
        MARGIN,
        doc.page.height - 36,
        { width: doc.page.width - MARGIN * 2, align: 'center', lineBreak: false },
      );
    doc.page.margins.bottom = savedBottom;
  }
}

/** Render the full branded report to a Buffer (streams internally, no temp files). */
export function renderAnalyticsReportPdf(
  data: PlausibleReportData,
  locale: ReportLocale = 'en-US',
): Promise<Buffer> {
  const ctx = contextFor(locale);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: BOTTOM_MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: {
        Title: `LittleFounders: ${ctx.s.title} (${ctx.s.audiences[data.audience]}, ${ctx.s.periods[data.period]})`,
        Author: 'LittleFounders',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      registerFonts(doc);
      // The first page exists before this listener can fire — watermark it by hand.
      doc.on('pageAdded', () => drawWatermark(doc));
      drawWatermark(doc);

      drawHeader(doc, ctx, data);
      drawKpiBlock(doc, ctx, data);
      drawTrendChart(doc, ctx, data);
      drawSnapshotBars(doc, ctx, data);
      drawOwnAudience(doc, ctx, data);
      for (const [dimension, rows] of Object.entries(data.breakdowns) as [PlausibleDimensionKey, PlausibleBreakdownRow[]][]) {
        drawBreakdownSection(doc, ctx, ctx.s.dimensions[dimension], rows);
      }
      drawCaveats(doc, ctx, data);
      drawFooters(doc, ctx);
      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

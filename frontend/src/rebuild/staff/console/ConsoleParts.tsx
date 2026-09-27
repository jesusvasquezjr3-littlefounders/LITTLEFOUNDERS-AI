import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { Button, ButtonGroup, ButtonLink, ErrorState, InlineNotice, LoadingState, ProgressBar, Sheet, TextField, type VizLabels } from '../../design/controls';
import type { Locale } from '../../design/copyBudget';
import { fill, useConsoleCopy } from './staffConsoleCopy';
import './staffConsole.css';

/*
 * The pieces every rebuilt staff console page shares (W2T.1), built only from
 * the design system's controls (02 rule 23). A console page is a dashboard
 * page (02 §4.5: neutral page, coloured cards); it has one h1 (the section's
 * navigation label), one short intro, and every block below it states its own
 * loading, empty, error, offline and permission-refused state.
 */

/** Whether the browser reports a connection. A console read made offline says so instead of looking empty. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return online;
}

/** Number, percent and date formats of the surface's language. */
export function useFormats(locale: Locale) {
  return useMemo(() => {
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
    const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
    const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    const day = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' });
    const valid = (value: string) => !Number.isNaN(new Date(value).getTime());
    return {
      number: (value: number) => number.format(value),
      percent: (value: number) => percent.format(value),
      dateTime: (value: string | null, empty: string) => (value && valid(value) ? dateTime.format(new Date(value)) : empty),
      /** A calendar date (YYYY-MM-DD) read at noon, so no time zone moves it a day. */
      calendar: (value: string) => (valid(`${value}T12:00:00`) ? day.format(new Date(`${value}T12:00:00`)) : value),
      date: (value: string | null, empty: string) => (value && valid(value) ? date.format(new Date(value)) : empty),
    };
  }, [locale]);
}

/** A short id for a table cell; the full id is always one tap away in the details. */
export const shortId = (id: string) => id.slice(0, 8);

/** A console page: the section title, one intro line, an optional action row, then the page's blocks. */
export function StaffPage({ screen, title, intro, actions, children }: {
  screen: string; title: string; intro: string; actions?: ReactNode; children: ReactNode;
}) {
  const { copy } = useConsoleCopy();
  const online = useOnline();
  return <div className="lf-staff-page" data-screen={screen}>
    <header className="lf-staff-head">
      <div className="lf-staff-head-text">
        <h1 data-copy-role="heading">{title}</h1>
        <p data-copy-role="body">{intro}</p>
      </div>
      {actions ? <div className="lf-staff-head-actions">{actions}</div> : null}
    </header>
    {online ? null : <InlineNotice tone="info" live>{copy.common.body.offlineNotice}</InlineNotice>}
    {children}
  </div>;
}

export interface Metric { id: string; label: string; value: string }

/** Headline numbers: a label (words) and a value (data). Never a colour-only reading. */
export function Metrics({ label, items }: { label: string; items: readonly Metric[] }) {
  return <div className="lf-staff-metrics-wrap">
    <dl className="lf-staff-metrics" aria-label={label} data-count={Math.min(items.length, 6)}>
      {items.map((item) => <div key={item.id} className="lf-staff-metric" data-metric={item.id}>
        <dt data-copy-role="body">{item.label}</dt>
        <dd data-copy-role="data">{item.value}</dd>
      </div>)}
    </dl>
  </div>;
}

/** Label / value pairs inside a card or a details sheet. Values may be people's names and ids, so they wrap anywhere. */
export function Facts({ items }: { items: readonly { id: string; label: string; value: ReactNode; ugc?: boolean }[] }) {
  return <dl className="lf-staff-facts">
    {items.map((item) => <div key={item.id} className="lf-staff-fact" data-fact={item.id}>
      <dt data-copy-role="body">{item.label}</dt>
      <dd data-copy-role="data" className={item.ugc ? 'ugc' : undefined}>{item.value}</dd>
    </div>)}
  </dl>;
}

/**
 * A read that failed: offline, refused (the grant was withdrawn after the page
 * opened; Core answered 403) or unavailable. Always a retry, never a blank.
 */
export function LoadFailure({ code, onRetry, retrying = false }: { code: string; onRetry: () => void; retrying?: boolean }) {
  const { copy } = useConsoleCopy();
  const online = useOnline();
  const kind = !online || code === 'OFFLINE' ? 'offline' : code === 'FORBIDDEN' ? 'refused' : 'loadFailed';
  return <div className="lf-staff-failure" data-failure={kind}>
    <ErrorState heading={copy.common.heading[kind]} body={copy.common.body[kind]}
      retryLabel={copy.common.action.retry} retryingLabel={copy.common.action.retrying} retrying={retrying} onRetry={onRetry} />
  </div>;
}

export function Loading() {
  const { copy } = useConsoleCopy();
  return <LoadingState label={copy.common.body.loading} lines={3} />;
}

/** Copies an id. The id itself is written next to it; the button only saves typing. */
export function CopyId({ value, label }: { value: string; label?: string }) {
  const { copy } = useConsoleCopy();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const run = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
  };
  return <div className="lf-staff-copy">
    <Button size="sm" onClick={() => void run()}>{label ?? copy.common.action.copyId}</Button>
    {state === 'copied' ? <InlineNotice tone="success" live>{copy.common.body.copied}</InlineNotice> : null}
    {state === 'failed' ? <InlineNotice tone="error" live>{copy.common.body.copyFailed}</InlineNotice> : null}
  </div>;
}

/** Previous / next over a server page, with the range in words. */
export function Pager({ start, end, total, onPrevious, onNext }: {
  start: number; end: number; total: number; onPrevious: (() => void) | null; onNext: (() => void) | null;
}) {
  const { copy, locale } = useConsoleCopy();
  const nf = new Intl.NumberFormat(locale);
  return <nav className="lf-staff-pager" aria-label={fill(copy.common.body.pageRange, { start: nf.format(start), end: nf.format(end), total: nf.format(total) })}>
    <p data-copy-role="body">{fill(copy.common.body.pageRange, { start: nf.format(start), end: nf.format(end), total: nf.format(total) })}</p>
    <ButtonGroup>
      <Button size="sm" disabled={!onPrevious} onClick={() => onPrevious?.()}>{copy.common.action.previous}</Button>
      <Button size="sm" disabled={!onNext} onClick={() => onNext?.()}>{copy.common.action.next}</Button>
    </ButtonGroup>
  </nav>;
}

/** A client-side link inside the console: a plain press stays in the app; a modified press opens normally. */
export function consoleLinkHandler(href: string, onNavigate: (href: string) => void) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(href);
  };
}

export function ConsoleLink({ href, onNavigate, children, variant = 'secondary' }: {
  href: string; onNavigate: (href: string) => void; children: string; variant?: 'secondary' | 'brand';
}) {
  return <ButtonLink size="sm" variant={variant} href={href} onClick={consoleLinkHandler(href, onNavigate)}>{children}</ButtonLink>;
}

/** Shares of a whole, each as a labelled bar with its count and share written out (02 rule 6). */
export function ShareBars({ label, rows, total, locale, tone = 'primary' }: {
  label: string; rows: readonly { id: string; label: string; count: number }[]; total: number; locale: Locale; tone?: 'primary' | 'mint';
}) {
  const nf = new Intl.NumberFormat(locale);
  const pf = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  return <ul className="lf-staff-bars" aria-label={label}>
    {rows.map((row) => <li key={row.id} data-share={row.id}>
      <ProgressBar label={row.label} value={row.count} max={Math.max(total, 1)} tone={tone}
        valueText={`${nf.format(row.count)} · ${pf.format(total > 0 ? row.count / total : 0)}`} />
    </li>)}
  </ul>;
}

/* ---- W2T.3: shared by Analytics & Health and Learning intel -------------------------------- */

/** Hands a file Core rendered to the browser's save. The name is ours: a cross-origin response hides its Content-Disposition. */
export function saveDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** A duration in the surface's language ("3 min 12 s"), from seconds. */
export function useDuration(locale: Locale) {
  return useMemo(() => {
    const minutes = new Intl.NumberFormat(locale, { style: 'unit', unit: 'minute', unitDisplay: 'short', maximumFractionDigits: 0 });
    const seconds = new Intl.NumberFormat(locale, { style: 'unit', unit: 'second', unitDisplay: 'short', maximumFractionDigits: 0 });
    return (value: number) => {
      const total = Math.max(0, Math.round(value));
      const m = Math.floor(total / 60);
      return m > 0 ? `${minutes.format(m)} ${seconds.format(total % 60)}` : seconds.format(total);
    };
  }, [locale]);
}

/** Today as YYYY-MM-DD in the browser's calendar (a custom range never ends in the future). */
export const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * A custom date range, chosen in a sheet: both ends are required and a range
 * that ends before it starts is refused in words. Nothing is applied until
 * the person presses Apply, so a half-typed range never reaches Core.
 */
export function RangeSheet({ open, initial, onApply, onClose }: {
  open: boolean; initial: { from: string; to: string }; onApply: (range: { from: string; to: string }) => void; onClose: () => void;
}) {
  const { copy } = useConsoleCopy();
  const t = copy.common;
  const [draft, setDraft] = useState(initial);
  const [checked, setChecked] = useState(false);
  useEffect(() => { if (open) { setDraft(initial); setChecked(false); } }, [open, initial]);
  const missing = !draft.from || !draft.to;
  const reversed = !missing && draft.from > draft.to;
  const future = !missing && (draft.from > today() || draft.to > today());
  const error = missing ? t.body.rangeMissing : reversed ? t.body.rangeReversed : future ? t.body.rangeFuture : undefined;
  return <Sheet open={open} onClose={onClose} heading={t.heading.range} closeLabel={t.action.close}>
    <form className="lf-staff-form" data-form="range" noValidate onSubmit={(event) => {
      event.preventDefault();
      setChecked(true);
      if (!error) onApply(draft);
    }}>
      <TextField type="date" label={t.body.rangeFrom} value={draft.from} max={today()} data-copy-role="data"
        error={checked ? error : undefined} errorLive onChange={(event) => setDraft({ ...draft, from: event.target.value })} />
      <TextField type="date" label={t.body.rangeTo} value={draft.to} max={today()} data-copy-role="data"
        onChange={(event) => setDraft({ ...draft, to: event.target.value })} />
      <div className="lf-staff-actions"><Button type="submit" variant="brand">{t.action.apply}</Button></div>
    </form>
  </Sheet>;
}

/** The chart primitives' words in the surface's language (the design system's charts hold no copy). */
export function useChartLabels(): VizLabels {
  const { copy } = useConsoleCopy();
  const t = copy.chart;
  return useMemo(() => ({ table: t.action.table, chart: t.action.chart, point: t.body.day, missing: t.body.missing, keys: t.body.keys }), [t]);
}

/** A day label for a chart point ("Sep 12"), read at noon so no time zone moves it. */
export function useDay(locale: Locale) {
  return useMemo(() => {
    const day = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
    return (value: string) => {
      const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
      return Number.isNaN(date.getTime()) ? value : day.format(date);
    };
  }, [locale]);
}

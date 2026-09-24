import { Button, Copy } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './analyticsChoice.css';
export interface AnalyticsChoiceCopy {
  title: string; purpose: string; events: string; lessons: string; excluded: string; history: string;
  safety: string; label: string; on: string; off: string; loading: string; saving: string;
  unavailable: string; failed: string; retry: string;
}
export function AnalyticsChoice({ copy, locale, dark, enabled, loading, saving, error, onToggle, onRetry }: {
  copy: AnalyticsChoiceCopy; locale: string; dark: boolean; enabled: boolean; loading: boolean; saving: boolean;
  error: 'read' | 'write' | null; onToggle: () => void; onRetry: () => void;
}) {
  return <section className="lf-rebuild lf-analytics-choice" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.title} aria-busy={loading || saving}>
    <Copy role="heading" as="h2">{copy.title}</Copy>
    {loading ? <div role="status"><Copy role="body">{copy.loading}</Copy></div> : error === 'read' ? <>
      <div role="alert"><Copy role="body">{copy.unavailable}</Copy></div><Button onClick={onRetry}>{copy.retry}</Button>
    </> : <>
      {[copy.purpose, copy.events, copy.lessons, copy.excluded, copy.history, copy.safety].map(text => <Copy key={text} role="body">{text}</Copy>)}
      <div className="lf-analytics-choice-toggle"><Copy role="option">{copy.label}</Copy>
        <Button role="switch" aria-label={copy.label} aria-checked={enabled} disabled={saving} onClick={onToggle} variant={enabled ? 'accent' : 'secondary'}>{enabled ? copy.on : copy.off}</Button>
      </div>
      {saving && <div role="status"><Copy role="body">{copy.saving}</Copy></div>}
      {error === 'write' && <div role="alert"><Copy role="body">{copy.failed}</Copy></div>}
    </>}
  </section>;
}

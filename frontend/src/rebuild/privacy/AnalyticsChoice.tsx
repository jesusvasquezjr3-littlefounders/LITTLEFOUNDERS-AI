import { Button, Copy, InlineNotice, LoadingState, Switch } from '../design/controls';
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
    {loading ? <LoadingState label={copy.loading} lines={2} /> : error === 'read' ? <>
      <InlineNotice tone="error" live>{copy.unavailable}</InlineNotice><Button onClick={onRetry}>{copy.retry}</Button>
    </> : <>
      {[copy.purpose, copy.events, copy.lessons, copy.excluded, copy.history, copy.safety].map(text => <Copy key={text} role="body">{text}</Copy>)}
      <Switch label={copy.label} checked={enabled} pending={saving} onCheckedChange={() => onToggle()} stateLabels={{ on: copy.on, off: copy.off }} />
      {saving && <InlineNotice tone="info" live>{copy.saving}</InlineNotice>}
      {error === 'write' && <InlineNotice tone="error" live>{copy.failed}</InlineNotice>}
    </>}
  </section>;
}

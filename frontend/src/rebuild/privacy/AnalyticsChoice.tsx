import { Button, ButtonGroup, Copy, InlineNotice, LoadingState, Switch } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './analyticsChoice.css';
export interface AnalyticsChoiceCopy {
  title: string; purpose: string; events: string; lessons: string; excluded: string; history: string;
  safety: string; label: string; on: string; off: string; loading: string; saving: string;
  unavailable: string; failed: string; retry: string;
  /** M-12 (OD-26): shown only when this choice also enrols the account in the Mentor's hint-style test. */
  experiment: string;
  /** H.1, Appendix O 2.2(a) (F3-identity-site): the first choice is two explicit answers, never a flip. */
  choose: string; keepOff: string; turnOn: string;
  /** The first-session sheet's close: the step comes back next session until a choice is recorded. */
  later: string;
}
/*
 * The self-managed teen's optional-analytics disclosure (H.1). Until the teen
 * has recorded a choice (`decided` false) there is no switch: "Keep it off"
 * and "Turn it on" are two equal answers, so an informed "no" is recorded
 * without passing through "on" first (a flip from nothing could only record
 * "on"). Once decided, the switch changes it.
 */
export function AnalyticsChoice({ copy, locale, dark, enabled, experiment = false, loading, saving, error, onToggle, onRetry, decided = true, onChoose, headingless = false }: {
  copy: AnalyticsChoiceCopy; locale: string; dark: boolean; enabled: boolean;
  /** Core says turning this on also enrols the account in the C.17 dialogue-style experiment (OD-26: the teen's own opt-in). */
  experiment?: boolean;
  loading: boolean; saving: boolean;
  error: 'read' | 'write' | null; onToggle: () => void; onRetry: () => void;
  /** Core's `disclosed`: a choice is on file. */
  decided?: boolean;
  /** An explicit first answer (required when `decided` is false). */
  onChoose?: (enabled: boolean) => void;
  /** Inside a sheet that already carries the title as its heading. */
  headingless?: boolean;
}) {
  return <section className={`lf-rebuild lf-analytics-choice${headingless ? ' lf-analytics-choice--plain' : ''}`} data-theme={dark ? 'dark' : 'light'} data-decided={decided ? 'true' : 'false'}
    lang={locale} aria-label={copy.title} aria-busy={loading || saving}>
    {headingless ? null : <Copy role="heading" as="h2">{copy.title}</Copy>}
    {loading ? <LoadingState label={copy.loading} lines={2} /> : error === 'read' ? <>
      <InlineNotice tone="error" live>{copy.unavailable}</InlineNotice><Button onClick={onRetry}>{copy.retry}</Button>
    </> : <>
      {[copy.purpose, ...(experiment ? [copy.experiment] : []), copy.events, copy.lessons, copy.excluded, copy.history, copy.safety]
        .map(text => <Copy key={text} role="body">{text}</Copy>)}
      {decided
        ? <Switch label={copy.label} checked={enabled} pending={saving} onCheckedChange={() => onToggle()} stateLabels={{ on: copy.on, off: copy.off }} />
        : <>
          <Copy role="body">{copy.choose}</Copy>
          <ButtonGroup label={copy.label}>
            <Button disabled={saving} data-analytics-choice="off" onClick={() => onChoose?.(false)}>{copy.keepOff}</Button>
            <Button disabled={saving} data-analytics-choice="on" onClick={() => onChoose?.(true)}>{copy.turnOn}</Button>
          </ButtonGroup>
        </>}
      {saving && <InlineNotice tone="info" live>{copy.saving}</InlineNotice>}
      {error === 'write' && <InlineNotice tone="error" live>{copy.failed}</InlineNotice>}
    </>}
  </section>;
}

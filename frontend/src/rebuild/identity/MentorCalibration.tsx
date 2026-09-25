import { Button, Copy, InlineNotice, LoadingState } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './mentorCalibration.css';

export interface MentorCalibrationCopy {
  question: string; help: string; youngest: string; middle: string; older: string;
  loading: string; saving: string; unavailable: string; retry: string;
}
/** New controls over the chosen character's existing scene during migration. */
export function MentorCalibration({ copy, locale, dark, state, error, onChoose, onRetry }: {
  copy: MentorCalibrationCopy; locale: string; dark: boolean;
  state: 'loading' | 'form' | 'saving' | 'error'; error: boolean;
  onChoose: (tier: 1 | 2 | 3) => void; onRetry: () => void;
}) {
  return <section className="lf-rebuild lf-mentor-calibration" lang={locale} data-theme={dark ? 'dark' : 'light'} data-screen="mentor-calibration" aria-label={copy.question} aria-busy={state === 'saving'}>
    <Copy role="prompt" as="h2">{copy.question}</Copy>
    {state === 'loading' ? <LoadingState label={copy.loading} lines={1} /> : state === 'error' ? <>
      <InlineNotice tone="error" live>{copy.unavailable}</InlineNotice>
      <Button onClick={onRetry}>{copy.retry}</Button>
    </> : <>
      <Copy role="body">{copy.help}</Copy>
      <div className="lf-mentor-calibration-options">
        {([1, 2, 3] as const).map((tier, index) => <Button key={tier} disabled={state === 'saving'} onClick={() => onChoose(tier)}>{[copy.youngest, copy.middle, copy.older][index]}</Button>)}
      </div>
      {state === 'saving' && <InlineNotice tone="info" live>{copy.saving}</InlineNotice>}
      {error && <InlineNotice tone="error" live>{copy.unavailable}</InlineNotice>}
    </>}
  </section>;
}

import { Button, Copy } from '../design/controls';
import type { Adaptation, DispositionSummaryData, ExplanationStyle, HelpStyle, Persistence } from './allianceApi';
import '../design/tokens.css';
import '../design/system.css';
import './alliance.css';

/*
 * C.7 THE LEARNER DISPOSITION PROFILE, READABLE (Appendix D §2.6: what the
 * Mentor adapts must be interpretable to a parent, never a black box).
 *
 * The learner sees their own; a verified Tutor sees their child's. Every line
 * is a closed label in plain words: how they ask for help, whether they tend
 * to stay with a hard moment, whether their explanations name the idea, the
 * ways of working they turned down, and their usual reply pace. Nothing here
 * names a feeling, a score or a rank, and nothing is free text. The reset
 * action appears only where Core allows it (a child's profile is reset by
 * their verified Tutor; a teen without a guardian link and an adult reset
 * their own). Nothing celebrates; a reset is an informational status line.
 */

export interface DispositionSummaryCopy {
  titleOwn: string;
  titleChild: string;
  intro: string;
  empty: string;
  notCurrent: string;
  loading: string;
  loadFailed: string;
  helpLabel: string;
  help: Record<HelpStyle, string>;
  persistenceLabel: string;
  persistence: Record<Persistence, string>;
  explanationLabel: string;
  explanation: Record<ExplanationStyle, string>;
  declinedLabel: string;
  declinedNone: string;
  adaptation: Record<Adaptation, string>;
  paceLabel: string;
  paceSeconds: string;
  paceUnknown: string;
  reset: string;
  resetting: string;
  resetDone: string;
  resetFailed: string;
}

export function DispositionSummary({ copy, locale, dark, audience, phase, data, canReset, resetState = 'idle', onReset }: {
  copy: DispositionSummaryCopy;
  locale: string;
  dark: boolean;
  /** Whose profile: the learner's own, or a child's read by their verified Tutor. */
  audience: 'own' | 'child';
  phase: 'loading' | 'ready' | 'failed';
  data: DispositionSummaryData | null;
  canReset: boolean;
  resetState?: 'idle' | 'resetting' | 'done' | 'failed';
  onReset?: () => void;
}) {
  const rows: [string, string][] =
    data && data.exists
      ? [
        [copy.helpLabel, copy.help[data.helpStyle]],
        [copy.persistenceLabel, copy.persistence[data.persistence]],
        [copy.explanationLabel, copy.explanation[data.explanation]],
        [copy.declinedLabel, data.persistentlyDeclined.length === 0
          ? copy.declinedNone
          : data.persistentlyDeclined.map((a) => copy.adaptation[a]).join(', ')],
        [copy.paceLabel, data.typicalReplySeconds === null
          ? copy.paceUnknown
          : copy.paceSeconds.replace('{n}', String(data.typicalReplySeconds))],
      ]
      : [];
  return <section className="lf-rebuild lf-alliance-panel lf-disposition" lang={locale} data-theme={dark ? 'dark' : 'light'}
    data-screen="mentor-profile" aria-busy={phase === 'loading'}>
    <h2 data-copy-role="heading">{audience === 'own' ? copy.titleOwn : copy.titleChild}</h2>
    <Copy role="body">{copy.intro}</Copy>
    {phase === 'loading' ? <div role="status"><Copy role="body">{copy.loading}</Copy></div>
      : phase === 'failed' ? <div role="alert"><Copy role="body">{copy.loadFailed}</Copy></div>
        : !data || !data.exists ? <Copy role="body">{copy.empty}</Copy>
          : <>
            {!data.current ? <Copy role="body">{copy.notCurrent}</Copy> : null}
            <dl className="lf-disposition-list">
              {rows.map(([label, value]) => <div key={label} className="lf-disposition-row">
                <dt data-copy-role="body">{label}</dt>
                <dd data-copy-role="body">{value}</dd>
              </div>)}
            </dl>
          </>}
    {canReset && phase === 'ready' && data?.exists ? <div className="lf-alliance-status">
      {resetState === 'done' ? <div role="status"><Copy role="body">{copy.resetDone}</Copy></div>
        : <>
          {resetState === 'failed' ? <div role="alert"><Copy role="body">{copy.resetFailed}</Copy></div> : null}
          <Button disabled={resetState === 'resetting'} onClick={onReset}>
            {resetState === 'resetting' ? copy.resetting : copy.reset}
          </Button>
        </>}
    </div> : null}
  </section>;
}

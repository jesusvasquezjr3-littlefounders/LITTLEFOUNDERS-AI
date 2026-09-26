import { useId, useState } from 'react';
import { Banner, Button, InlineNotice, ReplyChip } from '../design/controls';
import type { BondProxyAnswer } from './allianceApi';
import '../design/tokens.css';
import '../design/system.css';
import './alliance.css';

/*
 * C.15 THE END-OF-SESSION BOND PROXY on the closing surface (Appendix D §3.4:
 * "a lightweight, low-friction end-of-session alliance-bond proxy — did I get
 * what you were going for today?"; Appendix F §1.2 Alliance Bond Proxy Score).
 *
 * One question and three EQUAL chips (yes / a little / not really), shown
 * after the session closed, never after a safety stop (the component renders
 * nothing for that script, and Core refuses it too). It is about whether the
 * MENTOR understood the learner's goal, never a rating of the learner and
 * never a feeling. Answering is optional: nothing blocks leaving, nothing
 * counts down, nothing celebrates (OD-7). Once answered the chips go and one
 * informational line thanks the learner; a failed save offers a retry.
 */

export interface AllianceCheckCopy {
  question: string;
  choiceLabel: string;
  yes: string;
  partly: string;
  no: string;
  thanks: string;
  failed: string;
  retry: string;
}

export type AllianceCheckResult = 'recorded' | 'failed' | 'closed';

export function AllianceCheck({ copy, locale, dark, script, onAnswer }: {
  copy: AllianceCheckCopy;
  locale: string;
  dark: boolean;
  /** The closing script: the question is never asked after a safety stop. */
  script: 'completed' | 'interrupted' | 'learner_left' | 'safety_stop';
  onAnswer: (answer: BondProxyAnswer) => Promise<AllianceCheckResult>;
}) {
  const [state, setState] = useState<'open' | 'saving' | 'done' | 'failed'>('open');
  const [last, setLast] = useState<BondProxyAnswer | null>(null);
  const questionId = useId();
  if (script === 'safety_stop') return null;

  const answer = async (value: BondProxyAnswer) => {
    setLast(value);
    setState('saving');
    const result = await onAnswer(value);
    // 'closed' (already answered, too late): the question is simply gone.
    setState(result === 'failed' ? 'failed' : 'done');
  };

  return <section className="lf-rebuild lf-alliance-panel" lang={locale} data-theme={dark ? 'dark' : 'light'}
    data-screen="mentor-alliance-check" aria-labelledby={state === 'done' ? undefined : questionId}
    aria-label={state === 'done' ? copy.choiceLabel : undefined}>
    {state === 'done'
      ? <InlineNotice tone="success" live>{copy.thanks}</InlineNotice>
      : <>
        <p id={questionId} className="lf-alliance-question" data-copy-role="prompt">{copy.question}</p>
        <div className="lf-alliance-chips lf-alliance-chips--three" role="group" aria-label={copy.choiceLabel}>
          {(['yes', 'partly', 'no'] as const).map((value) => <ReplyChip key={value} className="lf-alliance-chip" data-bond={value}
            disabled={state === 'saving'} onPress={() => void answer(value)}>{copy[value]}</ReplyChip>)}
        </div>
        {state === 'failed'
          ? <Banner tone="error" action={<Button onClick={() => last && void answer(last)}>{copy.retry}</Button>}>{copy.failed}</Banner>
          : null}
      </>}
  </section>;
}

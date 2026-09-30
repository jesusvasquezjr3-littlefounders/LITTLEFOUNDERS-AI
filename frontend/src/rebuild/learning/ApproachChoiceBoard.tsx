import { useState } from 'react';
import { AnswerChoice, Button, InlineNotice } from '../design/controls';
import type { LessonClientDocument } from './lessonDocument';
import type { LessonSequenceControl } from './lessonSequence';
import { BoardShell, playerCopy } from './segmentKit';

/*
 * B.24 / Product 10 Block B "Age-band registers", autonomy column (GAP-FIX-R5):
 * "choice of approach/strategy, not just topic order" from 10-12. A lesson that
 * declares `approaches` asks the learner, before its practice chain, which of
 * two or three equally valid strategies to practise. Core pins the pick on the
 * run and grades that chain only; the first option is the suggestion, but
 * nothing marks it as the right one (both chains are complete and graded).
 * No celebration: choosing is not a milestone (OD-7).
 */
export function ApproachChoiceBoard({ document, onBack, sequence, onChoose }: {
  document: LessonClientDocument & { approaches: NonNullable<LessonClientDocument['approaches']> };
  onBack: () => void;
  sequence?: LessonSequenceControl;
  /** Pins the pick with Core (true) or reports it could not be saved (false). */
  onChoose: (approachId: string) => Promise<boolean>;
}) {
  const t = playerCopy(document.locale);
  const [choice, setChoice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const start = async () => {
    if (!choice) return;
    setPending(true);
    const saved = await onChoose(choice);
    setPending(false);
    setFailed(!saved);
  };
  return <BoardShell screen="approach-choice" locale={document.locale} title={document.title} segment={{ id: 'approach-choice', prompt: t.approachPrompt }}
    onBack={onBack} sequence={sequence} finished={false}
    foot={<footer className="lf-learning-foot">
      {failed ? <InlineNotice tone="error" live>{t.approachFailed}</InlineNotice> : null}
      <div className="lf-learning-actions">
        <Button variant="accent" disabled={choice === null} pending={pending} onClick={() => { void start(); }}>{t.approachStart}</Button>
      </div>
    </footer>}>
    <section className="lf-learning-board lf-family-board">
      <div className="lf-story-options" role="group" aria-label={t.approachPrompt}>
        {document.approaches.options.map((option) => <AnswerChoice key={option.id} label={option.label} selected={choice === option.id} disabled={pending}
          onSelect={() => { setFailed(false); setChoice(option.id); }} />)}
      </div>
    </section>
  </BoardShell>;
}

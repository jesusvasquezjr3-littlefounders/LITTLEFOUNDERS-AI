import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Locale } from '../../design/copyBudget';
import { AnswerChoice, Banner, Button, ChoiceChip, IconButton, InlineNotice, Pill, RadioGroup, SelectField, Slider, Stepper, TextField } from '../../design/controls';
import { isSegmentLocked, MAX_ATTEMPTS } from '../session/segmentLock';
import { mayDemonstrate, runTrayDemo } from '../session/trayDemo';
import type { TrayDemoStep } from '../session/types';
import type { LiveSegmentState } from '../session/useTutorSocket';
import {
  activityPrompt, activityView, answerOf, demoDraftOf, draftFromDemo, emptyDraft, gapNumbers, money, traySum,
  type ActivityDraft, type ActivityView,
} from './liveActivityModel';
import { fill } from './MentorViews';

/*
 * THE LIVE ACTIVITY (product inventory T1c; Frontend Bible 08 §2 layer 4, 05).
 *
 * The activity the Mentor served, drawn with the 02 controls in the board's
 * place: the question, the answer controls, one Check. Grading is Core's
 * (server-authoritative; the key is never in the browser): a first miss keeps
 * the answer and says "not yet" with the reason Core returned, the second
 * attempt closes the activity either way, and the result goes to Oracle so
 * the Mentor reacts to it. "Practice only" is said before answering when Core
 * cannot pay XP for it. A demonstration the Mentor performs moves the open
 * tray while it speaks, with the learner's input locked until it hands the
 * tray back. No lives, no penalty, never the error hue for a wrong answer
 * (B.26): "not yet" is the retry tone.
 */

export interface MentorActivityCopy {
  heading: string; check: string; checking: string; practiceOnly: string; failed: string; notYet: string;
  answer: string; yourAnswer: string; true: string; false: string; add: string; takeBack: string; inTray: string;
  target: string; change: string; moveUp: string; moveDown: string; place: string; placed: string; unplaced: string;
  budget: string; total: string; needs: string; weeksFor: string; gap: string; count: string; scene: string;
  sliderValue: string; demo: string; yes: string; no: string; choose: string; left: string; less: string; more: string;
}

export interface ActivityGrade {
  correct: boolean;
  score: number;
  feedback: string | null;
  xpAwarded: number;
  scoresXp: boolean;
  pedagogy: { echo: string } | null;
}

export interface ActivityOutcome extends ActivityGrade { segmentId: string; attempt: number }

export interface LiveActivityProps {
  live: LiveSegmentState;
  copy: MentorActivityCopy;
  locale: Locale;
  headingId: string;
  /** Core's grade for this answer, or null when the check itself failed (never a wrong answer). */
  grade: (segmentId: string, answer: unknown, attempt: number) => Promise<ActivityGrade | null>;
  /** The activity is finished (right, or the last attempt): the screen reports it to Oracle and shows the result. */
  onDone: (outcome: ActivityOutcome) => void;
  /** A demonstration the Mentor's current turn performs on the open tray (Tutor v3), once per turn. */
  demo: { seq: number; steps: TrayDemoStep[] } | null;
}

/** Whether the rebuilt screen draws this served segment (else the learner answers in words). */
export const drawsActivity = (live: LiveSegmentState): boolean => activityView(live.segment) !== null;

export function LiveActivity({ live, copy, locale, headingId, grade, onDone, demo }: LiveActivityProps) {
  const view = useMemo(() => activityView(live.segment), [live.segment]);
  const prompt = activityPrompt(live.segment);
  const [draft, setDraft] = useState<ActivityDraft | null>(() => (view ? emptyDraft(view) : null));
  const [attempt, setAttempt] = useState(1);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState<string | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const segmentRef = useRef(live.segmentId);
  segmentRef.current = live.segmentId;

  useEffect(() => {
    setDraft(view ? emptyDraft(view) : null);
    setAttempt(1); setChecking(false); setFailed(false); setRetry(null);
  }, [live.segmentId, view]);

  /* The Mentor's hands on the tray: the same draft a tap changes, on a timer, once per turn. */
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const lastDemo = useRef(-1);
  const demoRef = useRef(demo);
  demoRef.current = demo;
  useEffect(() => {
    const current = demoRef.current;
    const type = typeof live.segment.type === 'string' ? live.segment.type : '';
    const payload = (live.segment.payload ?? {}) as Record<string, unknown>;
    if (!mayDemonstrate({ demoSeq: current?.seq ?? null, lastPlayedSeq: lastDemo.current, segmentType: type, answeredCorrectly: false, payload })) return undefined;
    if (!draftRef.current || demoDraftOf(draftRef.current) === undefined) return undefined;
    lastDemo.current = current!.seq;
    const abort = new AbortController();
    setDemoRunning(true);
    void runTrayDemo(type, payload, current!.steps, {
      getDraft: () => (draftRef.current ? demoDraftOf(draftRef.current) : undefined),
      setDraft: (next) => setDraft((prev) => (prev ? draftFromDemo(prev, next) : prev)),
    }, { signal: abort.signal }).finally(() => setDemoRunning(false));
    return () => abort.abort();
  }, [demo?.seq, live.segmentId, live.segment]);

  if (!view || !draft) {
    return <section className="lf-mentor-board lf-mentor-activity" aria-labelledby={headingId} data-activity="words">
      <h2 id={headingId} data-copy-role="heading">{copy.heading}</h2>
      {prompt ? <p data-copy-role="data">{prompt}</p> : null}
      <p data-copy-role="body">{copy.answer}</p>
    </section>;
  }

  const locked = isSegmentLocked({ checking, demoRunning, answeredCorrectly: false, attempt });
  const answer = answerOf(view, draft);

  const check = async (event?: FormEvent) => {
    event?.preventDefault();
    if (answer === null || locked) return;
    const segmentId = live.segmentId;
    setChecking(true); setFailed(false);
    const result = await grade(segmentId, answer, attempt);
    if (segmentRef.current !== segmentId) return; // the Mentor moved on while Core answered
    setChecking(false);
    if (!result) { setFailed(true); return; }
    if (result.correct || attempt >= MAX_ATTEMPTS) { onDone({ ...result, segmentId, attempt }); return; }
    setRetry(result.feedback);
    setAttempt((n) => n + 1);
  };

  return <section className="lf-mentor-board lf-mentor-activity" aria-labelledby={headingId} data-activity={view.kind}
    data-activity-type={view.type} aria-busy={checking || demoRunning}>
    <span key={live.segmentId} className="lf-visually-hidden" role="status">{copy.heading}</span>
    <h2 id={headingId} data-copy-role="heading">{copy.heading}</h2>
    {live.framing.trim() ? <p data-copy-role="mentor">{live.framing.trim()}</p> : null}
    {prompt ? <p className="lf-mentor-activity-prompt" data-copy-role="prompt">{prompt}</p> : null}
    <form className="lf-mentor-activity-form" onSubmit={(event) => void check(event)}>
      <ActivityControls view={view} draft={draft} copy={copy} locale={locale} disabled={locked} onChange={(next) => { setDraft(next); setRetry(null); }} />
      {demoRunning ? <InlineNotice tone="info">{copy.demo}</InlineNotice> : null}
      <div role="status" className="lf-mentor-activity-verdict">
        {retry !== null ? <Banner tone="retry" live={false}>{retry ? `${copy.notYet} ${retry}` : copy.notYet}</Banner> : null}
      </div>
      {failed ? <InlineNotice tone="error" live>{copy.failed}</InlineNotice> : null}
      <div className="lf-mentor-activity-actions">
        {!live.scoresXp ? <Pill tone="sky">{copy.practiceOnly}</Pill> : null}
        <Button type="submit" variant="accent" disabled={answer === null || locked} pending={checking} pendingLabel={copy.checking}>{copy.check}</Button>
      </div>
    </form>
  </section>;
}

function ActivityControls({ view, draft, copy, locale, disabled, onChange }: {
  view: ActivityView; draft: ActivityDraft; copy: MentorActivityCopy; locale: Locale; disabled: boolean; onChange: (draft: ActivityDraft) => void;
}) {
  if (view.kind === 'choose' && draft.kind === 'choose') {
    return <div className="lf-mentor-activity-options" role="group" aria-label={copy.yourAnswer}>
      {view.context ? <p data-copy-role="data">{view.context}</p> : null}
      {view.options.map((option) => <AnswerChoice key={option.id} label={option.label} selected={draft.id === option.id}
        disabled={disabled} onSelect={() => onChange({ kind: 'choose', id: option.id })} />)}
    </div>;
  }
  if (view.kind === 'truefalse' && draft.kind === 'truefalse') {
    return <div className="lf-mentor-activity-options" role="group" aria-label={copy.yourAnswer}>
      <p data-copy-role="data">{view.statement}</p>
      <AnswerChoice label={copy.true} selected={draft.value === true} disabled={disabled} onSelect={() => onChange({ kind: 'truefalse', value: true })} />
      <AnswerChoice label={copy.false} selected={draft.value === false} disabled={disabled} onSelect={() => onChange({ kind: 'truefalse', value: false })} />
    </div>;
  }
  if (view.kind === 'number' && draft.kind === 'number') {
    return <div className="lf-mentor-activity-options">
      {view.scene.length > 0 ? <ul className="lf-mentor-activity-scene" aria-label={copy.scene}>
        {view.scene.map((item, index) => <li key={index} data-copy-role="data">{item.label} × {item.count}</li>)}
      </ul> : null}
      <TextField label={view.ask ? fill(copy.count, { item: view.ask }) : view.unit ? `${copy.yourAnswer} (${view.unit})` : copy.yourAnswer}
        inputMode="decimal" autoComplete="off" value={draft.text} disabled={disabled}
        onChange={(event) => onChange({ kind: 'number', text: event.target.value })} />
    </div>;
  }
  if (view.kind === 'text' && draft.kind === 'text') {
    return <TextField label={copy.yourAnswer} autoComplete="off" maxLength={view.maxChars} value={draft.text} disabled={disabled}
      onChange={(event) => onChange({ kind: 'text', text: event.target.value })} />;
  }
  if (view.kind === 'slider' && draft.kind === 'slider') {
    const shown = `${Number(draft.value.toFixed(4))}${view.unit ? ` ${view.unit}` : ''}`;
    return <Slider label={copy.yourAnswer} valueText={fill(copy.sliderValue, { value: shown })} min={view.min} max={view.max} step={view.step}
      value={draft.value} disabled={disabled} onValueChange={(value) => onChange({ kind: 'slider', value })} />;
  }
  if (view.kind === 'order' && draft.kind === 'order') {
    const label = (id: string) => view.items.find((item) => item.id === id)?.label ?? id;
    const move = (index: number, by: -1 | 1) => {
      const next = [...draft.order];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item!);
      onChange({ kind: 'order', order: next });
    };
    const waiting = view.items.filter((item) => !draft.order.includes(item.id));
    return <div className="lf-mentor-activity-order">
      {view.context ? <p data-copy-role="data">{view.context}</p> : null}
      <p className="lf-mentor-activity-label" data-copy-role="body">{copy.placed}</p>
      <ol className="lf-mentor-activity-placed">
        {draft.order.map((id, index) => <li key={id}>
          <span data-copy-role="data">{`${index + 1}. ${label(id)}`}</span>
          <span className="lf-mentor-activity-row-actions">
            <IconButton glyph="chevron" label={fill(copy.moveUp, { item: label(id) })} variant="soft" className="lf-mentor-activity-up"
              disabled={disabled || index === 0} onClick={() => move(index, -1)} />
            <IconButton glyph="chevron" label={fill(copy.moveDown, { item: label(id) })} variant="soft" className="lf-mentor-activity-down"
              disabled={disabled || index === draft.order.length - 1} onClick={() => move(index, 1)} />
            <IconButton glyph="close" label={fill(copy.takeBack, { item: label(id) })} variant="soft" disabled={disabled}
              onClick={() => onChange({ kind: 'order', order: draft.order.filter((other) => other !== id) })} />
          </span>
        </li>)}
      </ol>
      {waiting.length > 0 ? <div className="lf-mentor-activity-options" role="group" aria-label={copy.unplaced}>
        {waiting.map((item) => <Button key={item.id} variant="secondary" disabled={disabled} aria-label={fill(copy.place, { item: item.label })}
          onClick={() => onChange({ kind: 'order', order: [...draft.order, item.id] })}><span data-copy-role="option">{item.label}</span></Button>)}
      </div> : null}
    </div>;
  }
  if (view.kind === 'select' && draft.kind === 'select') {
    const total = view.items.reduce((sum, item) => sum + (draft.ids.includes(item.id) && item.price !== null ? item.price : 0), 0);
    return <div className="lf-mentor-activity-options" role="group" aria-label={view.type === 'needs_wants' ? copy.needs : copy.yourAnswer}>
      {view.type === 'needs_wants' ? <p data-copy-role="body">{copy.needs}</p> : null}
      {view.type === 'budget_fit' && view.currency && view.budget !== null
        ? <p data-copy-role="data">{fill(copy.budget, { amount: money(view.budget, view.currency, locale) })} · {fill(copy.total, { amount: money(total, view.currency, locale) })}</p> : null}
      <div className="lf-mentor-activity-chips">
        {view.items.map((item) => {
          const selected = draft.ids.includes(item.id);
          return <ChoiceChip key={item.id} selected={selected} disabled={disabled}
            onToggle={() => onChange({ kind: 'select', ids: selected ? draft.ids.filter((id) => id !== item.id) : [...draft.ids, item.id] })}>
            {item.price !== null && view.currency ? `${item.label}, ${money(item.price, view.currency, locale)}` : item.label}
          </ChoiceChip>;
        })}
      </div>
    </div>;
  }
  if (view.kind === 'tray' && draft.kind === 'tray') {
    const amount = (value: number) => money(value, view.currency, locale);
    return <div className="lf-mentor-activity-tray">
      <p data-copy-role="data">{view.type === 'coin_count'
        ? fill(copy.target, { amount: amount(view.target ?? 0) })
        : fill(copy.change, { price: amount(view.price ?? 0), paid: amount(view.paidWith ?? 0) })}</p>
      <div className="lf-mentor-activity-chips" role="group" aria-label={copy.yourAnswer}>
        {view.denominations.map((value) => <Button key={value} variant="secondary" size="sm" disabled={disabled}
          aria-label={fill(copy.add, { amount: amount(value) })}
          onClick={() => onChange({ kind: 'tray', picked: [...draft.picked, value] })}><span data-copy-role="option">+ {amount(value)}</span></Button>)}
      </div>
      <p className="lf-mentor-activity-sum" data-copy-role="data" aria-live="polite">{fill(copy.inTray, { amount: amount(traySum(draft.picked)) })}</p>
      {draft.picked.length > 0 ? <div className="lf-mentor-activity-chips">
        {[...new Set(draft.picked)].map((value) => <Button key={value} variant="secondary" size="sm" disabled={disabled}
          aria-label={fill(copy.takeBack, { item: amount(value) })}
          onClick={() => {
            const index = draft.picked.lastIndexOf(value);
            onChange({ kind: 'tray', picked: draft.picked.filter((_, i) => i !== index) });
          }}><span data-copy-role="option">− {amount(value)} ({draft.picked.filter((v) => v === value).length})</span></Button>)}
      </div> : null}
    </div>;
  }
  if (view.kind === 'blanks' && draft.kind === 'blanks') {
    const gaps = gapNumbers(view);
    return <div className="lf-mentor-activity-blanks">
      <p data-copy-role="data">{view.parts.map((part, index) => ('gap' in part ? <span key={index} className="lf-mentor-activity-gap">
        {draft.gaps[String(part.gap)] ? (view.bank?.find((b) => b.id === draft.gaps[String(part.gap)])?.label ?? draft.gaps[String(part.gap)]) : '___'}</span>
        : <span key={index}>{` ${part.text} `}</span>))}</p>
      {gaps.map((gap) => view.bank
        ? <div key={gap} className="lf-mentor-activity-chips" role="group" aria-label={fill(copy.gap, { n: gap })}>
          {view.bank.map((word) => <ChoiceChip key={word.id} selected={draft.gaps[String(gap)] === word.id} disabled={disabled}
            onToggle={() => onChange({ kind: 'blanks', gaps: { ...draft.gaps, [String(gap)]: word.id } })}>{word.label}</ChoiceChip>)}
        </div>
        : <TextField key={gap} label={fill(copy.gap, { n: gap })} autoComplete="off" value={draft.gaps[String(gap)] ?? ''} disabled={disabled}
          onChange={(event) => onChange({ kind: 'blanks', gaps: { ...draft.gaps, [String(gap)]: event.target.value } })} />)}
    </div>;
  }
  if (view.kind === 'assign' && draft.kind === 'assign') {
    const choices = view.type === 'yes_no_cases' ? [{ id: 'yes', label: copy.yes }, { id: 'no', label: copy.no }] : view.choices;
    const pick = (item: string, value: string) => onChange({ kind: 'assign', picks: { ...draft.picks, [item]: value } });
    return <div className="lf-mentor-activity-options">
      {view.context ? <p data-copy-role="data">{view.context}</p> : null}
      {view.items.map((item) => choices.length <= 4
        ? <RadioGroup key={item.id} legend={item.label} name={`assign-${item.id}`} value={draft.picks[item.id] ?? null} disabled={disabled}
          options={choices.map((choice) => ({ value: choice.id, label: choice.label }))} onValueChange={(value) => pick(item.id, value)} />
        : <SelectField key={item.id} label={item.label} value={draft.picks[item.id] ?? ''} disabled={disabled}
          options={[{ value: '', label: copy.choose }, ...choices.map((choice) => ({ value: choice.id, label: choice.label }))]}
          onChange={(event) => pick(item.id, event.target.value)} />)}
    </div>;
  }
  if (view.kind === 'split' && draft.kind === 'split') {
    const amount = (value: number) => money(value, view.currency, locale);
    const used = traySum(Object.values(draft.alloc));
    return <div className="lf-mentor-activity-options">
      <p className="lf-mentor-activity-sum" data-copy-role="data" aria-live="polite">{fill(copy.left, { amount: amount(Math.round((view.income - used) * 100) / 100) })}</p>
      {view.jars.map((jar) => <Stepper key={jar.id} valuePlacement="label" label={jar.label} value={draft.alloc[jar.id] ?? 0}
        valueText={amount(draft.alloc[jar.id] ?? 0)} min={0} max={Math.round(((draft.alloc[jar.id] ?? 0) + view.income - used) * 100) / 100}
        step={view.step} disabled={disabled} labels={{ decrease: copy.less, increase: copy.more }}
        onValueChange={(value) => onChange({ kind: 'split', alloc: { ...draft.alloc, [jar.id]: Math.round(value * 100) / 100 } })} />)}
    </div>;
  }
  if (view.kind === 'weeks' && draft.kind === 'weeks') {
    return <div className="lf-mentor-activity-options">
      {view.options.map((weekly) => <TextField key={weekly} inputMode="numeric" autoComplete="off"
        label={fill(copy.weeksFor, { goal: money(view.goal, view.currency, locale), weekly: money(weekly, view.currency, locale) })}
        value={draft.weeks[String(weekly)] ?? ''} disabled={disabled}
        onChange={(event) => onChange({ kind: 'weeks', weeks: { ...draft.weeks, [String(weekly)]: event.target.value } })} />)}
    </div>;
  }
  return null;
}

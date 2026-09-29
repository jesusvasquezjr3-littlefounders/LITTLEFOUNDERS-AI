import { createContext, useContext, useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import en from '../../i18n/en-US/rebuild-learn.json';
import es from '../../i18n/es-MX/rebuild-learn.json';
import pt from '../../i18n/pt-BR/rebuild-learn.json';
import type { Locale } from '../design/copyBudget';
import { Button, Menu, MentorAvatar, ProgressBar, TextField, type ChipDrag } from '../design/controls';
import { findMentorAvatar, MENTOR_NAMES } from '../design/assets';
import { LessonFeedback } from './LessonFeedback';
import { LessonStageSlot } from './lessonStage';
import type { LessonMentorStage } from './lessonDocument';
import { sequenceProgress, type LessonSequenceControl } from './lessonSequence';
import { parseLocaleNumber } from './v2VisualScorer.generated';
import { useSingleActiveGrade } from './useSingleActiveGrade';
import { lessonSoundMuted, playLessonNarration, stopLessonNarration } from './lessonCue';
import './segmentKit.css';

/*
 * GAP-FIX-R1 learning: the shared pieces every v2 board uses.
 *
 * - `SegmentPrompt` (Bible 08 §11, Bible 05 §3): the Mentor's name and avatar
 *   as the prompt label ("Dina asks") above the prompt, and the optional help
 *   ladder (Appendix A Part 2 "help available on request"): up to two steps,
 *   each shown on request as one speech-plate turn. Opening a step is counted
 *   and sent with the next grade (B.10's narrative); it never changes a score.
 * - `NumberAnswer` (Appendix P Part 5, Bible 05 §5): a typed number parsed
 *   for the lesson's locale and echoed back before Check, so the learner sees
 *   what Core will compare. The board submits the canonical string only.
 * - `GradedFoot` / `ViewedFoot`: the one feedback row and action for graded and
 *   non-scored steps, so every board advances the general player the same way.
 */

const copy = { 'en-US': en.player, 'es-MX': es.player, 'pt-BR': pt.player };
export function playerCopy(locale: Locale) { return copy[locale]; }

export type SegmentGrade = { verdict: 'met' | 'review' | 'invalid'; diagnostic?: string };
export type OnGradeSegment = (answer: unknown, segmentId: string) => SegmentGrade | 'met' | 'review' | 'invalid' | Promise<SegmentGrade | 'met' | 'review' | 'invalid'>;

interface LessonPlayerContextValue {
  stage: LessonMentorStage | null;
  theme: 'light' | 'dark';
  onHelpUsed?: (segmentId: string, steps: number) => void;
  /** B.18 (GAP-FIX-R3): Core's resolved narration, segment id -> public URL (prompt audio only). */
  narrationAudio?: Readonly<Record<string, string>>;
}
const LessonPlayerContext = createContext<LessonPlayerContextValue>({ stage: null, theme: 'light' });

export function LessonPlayerProvider({ stage, theme, onHelpUsed, narrationAudio, children }: LessonPlayerContextValue & { children: ReactNode }) {
  return <LessonPlayerContext.Provider value={{ stage, theme, onHelpUsed, narrationAudio }}>{children}</LessonPlayerContext.Provider>;
}

/**
 * B.8 / B.18 (GAP-FIX-R3): the Mentor's differentiated narration for one
 * segment. "Narration explains, text labels": the plate on screen stays the
 * caption, and the learner presses Listen to hear the fuller script. Nothing
 * renders when Core resolved no audio (the text-only fallback) or when the
 * sound off switch is on; it never autoplays; leaving the segment stops it.
 */
export function NarrationControl({ segmentId, locale }: { segmentId: string; locale: Locale }) {
  const { narrationAudio } = useContext(LessonPlayerContext);
  const src = narrationAudio?.[segmentId];
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => stopLessonNarration(), [segmentId]);
  if (!src || lessonSoundMuted()) return null;
  const t = copy[locale];
  const toggle = () => {
    if (playing) { stopLessonNarration(); setPlaying(false); return; }
    setPlaying(playLessonNarration(src, () => setPlaying(false)));
  };
  return <Button variant="sky" size="sm" className="lf-narration-control" onClick={toggle}>{playing ? t.stopListening : t.listen}</Button>;
}

/** The learner's own Mentor for this lesson (Core's projection), or null in a preview. */
export function useLessonMentor(): { character: LessonMentorStage['character']; name: string; avatarId: string | null } | null {
  const { stage, theme } = useContext(LessonPlayerContext);
  if (!stage) return null;
  return { character: stage.character, name: MENTOR_NAMES[stage.character], avatarId: findMentorAvatar(stage.character, theme) };
}

/** The Mentor's prompt label: avatar plus "{name} asks". Renders nothing without a stage projection. */
export function PromptLabel({ locale }: { locale: Locale }) {
  const mentor = useLessonMentor();
  if (!mentor) return null;
  return <div className="lf-prompt-label" data-copy-role="body">
    {mentor.avatarId ? <MentorAvatar renderId={mentor.avatarId} label={null} size="xs" /> : null}
    <span>{copy[locale].asks.replace('{name}', mentor.name)}</span>
  </div>;
}

/** The board's prompt with its Mentor label and the on-request help ladder. */
export function SegmentPrompt({ segment, locale }: { segment: { id: string; prompt: string; help?: string[] }; locale: Locale }) {
  const { onHelpUsed } = useContext(LessonPlayerContext);
  const mentor = useLessonMentor();
  const t = copy[locale];
  const [shown, setShown] = useState(0);
  const [open, setOpen] = useState(false);
  const help = segment.help ?? [];
  const plateId = useId();
  const reveal = () => {
    const next = Math.min(help.length, shown + 1);
    setShown(next);
    setOpen(true);
    if (next > shown) onHelpUsed?.(segment.id, next);
  };
  return <>
    <PromptLabel locale={locale} />
    <p data-copy-role="prompt">{segment.prompt}</p>
    {help.length > 0 ? <div className="lf-segment-help">
      {!open || shown < help.length
        ? <Button onClick={reveal} aria-expanded={open} aria-controls={plateId}>{shown === 0 ? t.help : t.moreHelp}</Button>
        : null}
      {open && shown > 0 ? <div id={plateId} className="lf-speech-plate" role="note" aria-live="polite">
        {mentor ? <span className="lf-speech-plate-name" data-copy-role="data">{mentor.name}</span> : null}
        <p data-copy-role="mentor">{help[shown - 1]}</p>
        <Button onClick={() => setOpen(false)}>{t.closeHelp}</Button>
      </div> : null}
    </div> : null}
  </>;
}

/** The progress row every board shows: the shared bar plus "n of total". */
export function SegmentProgress({ sequence, locale, finished }: { sequence?: LessonSequenceControl; locale: Locale; finished: boolean }) {
  if (!sequence) return null;
  const t = copy[locale];
  const value = sequenceProgress(sequence, finished);
  return <>
    <ProgressBar className="lf-learning-progress" labelHidden label={t.progress} value={value} max={100} valueText={`${value}%`} />
    <span data-copy-role="data">{t.step.replace('{n}', String(sequence.index + 1)).replace('{total}', String(sequence.total))}</span>
  </>;
}

/** A typed number with the locale-aware parse echoed before Check. `onChange` receives the canonical string or null. */
export function NumberAnswer({ label, locale, onChange, disabled }: { label: string; locale: Locale; onChange: (canonical: string | null) => void; disabled?: boolean }) {
  const t = copy[locale];
  const [text, setText] = useState('');
  const parsed = text.trim() ? parseLocaleNumber(text, locale) : null;
  useEffect(() => { onChange(parsed); }, [parsed, onChange]);
  const echo = parsed === null ? null : new Intl.NumberFormat(locale, { maximumFractionDigits: 12 }).format(Number(parsed));
  return <div className="lf-number-answer">
    <TextField label={label} inputMode="decimal" autoComplete="off" value={text} disabled={disabled}
      onChange={(event) => setText(event.target.value)} error={text.trim() && parsed === null ? t.notNumber : undefined} />
    <p className="lf-number-echo" data-copy-role="body" aria-live="polite">{echo ? t.readsAs.replace('{value}', echo) : ' '}</p>
  </div>;
}

function reviewText(locale: Locale, diagnostic: string | undefined): string {
  const t = copy[locale];
  if (diagnostic === 'structure' || diagnostic === 'path' || diagnostic === 'bin' || diagnostic === 'rule_switch') return t.reviewStructure;
  if (diagnostic && diagnostic !== 'none' && diagnostic !== 'outcome') return t.reviewAnswer;
  return t.review;
}

/**
 * B.8 / Bible 08 §11 (GAP-FIX-R5): the verdict the compact Mentor stage
 * reacts to, from a graded step's server result. Met or a miss only; a
 * pending, unavailable or refused check leaves the stage neutral. Every graded
 * board passes it to `LessonStageSlot` (a static check pins this).
 */
export function gradeStageVerdict(result: SegmentGrade | 'unavailable' | null): 'met' | 'review' | null {
  return result === null || result === 'unavailable' ? null : result.verdict === 'met' ? 'met' : result.verdict === 'review' ? 'review' : null;
}

/** The check row of a graded step: one grade in flight, the shared feedback banner, then Continue once met. */
export function useSegmentGrade(segmentId: string, onGrade: OnGradeSegment | undefined) {
  const { pending, grade } = useSingleActiveGrade();
  const [result, setResult] = useState<SegmentGrade | 'unavailable' | null>(null);
  const check = (answer: unknown) => {
    if (!onGrade || answer === null || answer === undefined) return;
    grade(() => onGrade(answer, segmentId), (graded) => {
      const value = typeof graded === 'string' ? { verdict: graded } : graded;
      setResult(value.verdict === 'invalid' ? 'unavailable' : value);
    }, () => setResult('unavailable'));
  };
  return { pending, result, check, reset: () => setResult(null), met: result !== null && result !== 'unavailable' && result.verdict === 'met' };
}

export function GradedFoot({ locale, grading, canCheck, onCheck, sequence }: {
  locale: Locale; grading: ReturnType<typeof useSegmentGrade>; canCheck: boolean; onCheck: () => void; sequence?: LessonSequenceControl;
}) {
  const t = copy[locale];
  const { result, pending, met } = grading;
  const verdict = result === null ? null : result === 'unavailable' ? 'unavailable' : result.verdict === 'met' ? 'met' : 'review';
  return <footer className="lf-learning-foot">
    <LessonFeedback verdict={verdict}>
      {result === null ? null : result === 'unavailable' ? t.unavailable : result.verdict === 'met' ? t.met : reviewText(locale, result.diagnostic)}
    </LessonFeedback>
    <div className="lf-learning-actions">
      {met ? (sequence ? <Button variant="accent" onClick={sequence.onAdvance}>{t.continue}</Button> : null)
        : <Button variant="accent" disabled={pending || !canCheck} onClick={onCheck}>{t.check}</Button>}
    </div>
  </footer>;
}

/** The foot of a non-scored step: Continue records the step with Core (via the player) and moves on. */
export function ViewedFoot({ locale, sequence, ready = true }: { locale: Locale; sequence?: LessonSequenceControl; ready?: boolean }) {
  const t = copy[locale];
  if (!sequence) return null;
  return <footer className="lf-learning-foot"><div className="lf-learning-actions">
    <Button variant="accent" disabled={!ready} onClick={sequence.onAdvance}>{t.continue}</Button>
  </div></footer>;
}

/**
 * Keyboard and tap alternative to dragging (Bible 05 §4): the object the
 * learner picked up (a pressed chip: Enter or Space on it, or a tap) goes to
 * the place chosen in one shared "Move to…" menu (WAI-ARIA menu button) of
 * the board's regions or bins. GAP-FIX-R4: one menu per board, not one set of
 * regions repeated under every item, so the first view stays in budget; the
 * menu names the carried item and is off until something is picked up.
 */
export function MoveToChoice<T extends string>({ locale, item, options, onChange, disabled }: {
  locale: Locale; item: { label: string } | null; options: ReadonlyArray<{ value: T; label: string }>; onChange: (value: T) => void; disabled?: boolean;
}) {
  const t = copy[locale];
  return <div className="lf-move-to">
    <Menu label={item ? `${item.label}: ${t.moveTo}` : t.moveTo} items={options.map((option) => ({ id: option.value, label: option.label, onSelect: () => onChange(option.value) }))}
      trigger={(props) => <Button {...props} size="sm" variant="secondary" disabled={disabled || item === null}
        aria-label={item ? `${item.label}: ${t.moveTo}` : t.moveTo}>{t.moveTo}</Button>} />
  </div>;
}

/**
 * Drag an object onto a board region, with the tap alternative (Bible 05 §4,
 * V4; GAP-FIX-R4). The chip the learner presses is picked up (tap path: press
 * the chip, then press the region); dragging it past a few pixels carries it,
 * the region under the pointer highlights, and releasing over a region places
 * it. The keyboard path is the board's "Move to" menu, which stays beside it.
 * `drop` names the region under a point (a board region carries
 * `data-drop-target`); it is injectable for tests.
 */
export function useDragPlace<T extends string>(onPlace: (item: string, target: T) => void, disabled: boolean,
  drop: (x: number, y: number) => string | null = (x, y) => (typeof document.elementFromPoint === 'function'
    ? document.elementFromPoint(x, y)?.closest('[data-drop-target]')?.getAttribute('data-drop-target') ?? null : null)) {
  const [carried, setCarried] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const drag = useRef<{ item: string; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const chip = (item: string): { selected: boolean; onToggle: () => void; drag: ChipDrag } => ({
    selected: carried === item,
    onToggle: () => {
      if (suppressClick.current) { suppressClick.current = false; return; }
      if (!disabled) setCarried((current) => (current === item ? null : item));
    },
    drag: {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (disabled) return;
        drag.current = { item, x: event.clientX, y: event.clientY, moved: false };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
        const current = drag.current;
        if (!current) return;
        if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 6) { current.moved = true; setCarried(current.item); }
        if (current.moved) setOver(drop(event.clientX, event.clientY));
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
        const current = drag.current;
        drag.current = null;
        setOver(null);
        if (!current?.moved) return;
        suppressClick.current = true;
        const target = drop(event.clientX, event.clientY);
        setCarried(null);
        if (target) onPlace(current.item, target as T);
      },
      onPointerCancel: () => { drag.current = null; setOver(null); },
    },
  });
  const target = (id: T) => ({
    'data-drop-target': id,
    'data-drop-selected': over === id ? 'true' : 'false',
    'data-drop-armed': carried ? 'true' : 'false',
    ...(carried && !disabled ? { onClick: () => { onPlace(carried, id); setCarried(null); } } : {}),
  });
  return { carried, chip, target, clear: () => setCarried(null) };
}

/**
 * The Bible 05 board anatomy every new v2 board shares: back and progress on
 * top, the compact Mentor stage band, the title, the Mentor-labelled prompt
 * with its help ladder, the board itself, its control strip, then its foot.
 * GAP-FIX-R4 (Bible 05 §3): the control strip always carries Reset when the
 * board has a state to restore (`onReset`, disabled while nothing changed);
 * `controls` adds the board's own controls beside it.
 */
export function BoardShell({ screen, locale, title, segment, onBack, sequence, finished, verdict, children, foot, onReset, resetDisabled, controls }: {
  screen: string; locale: Locale; title: string; segment: { id: string; prompt: string; help?: string[] }; onBack: () => void;
  sequence?: LessonSequenceControl; finished: boolean; verdict?: unknown; children: ReactNode; foot: ReactNode;
  onReset?: () => void; resetDisabled?: boolean; controls?: ReactNode;
}) {
  const back = { 'en-US': en.back, 'es-MX': es.back, 'pt-BR': pt.back }[locale];
  const t = copy[locale];
  return <main className="lf-learning" data-surface="app" data-screen={screen}><div className="lf-learning-inner">
    <header className="lf-learning-top"><Button onClick={onBack}>{back}</Button><SegmentProgress sequence={sequence} locale={locale} finished={finished} /></header>
    <LessonStageSlot verdict={verdict} />
    <div className="lf-learning-content">
      <div className="lf-learning-intro"><h1 data-copy-role="heading">{title}</h1><SegmentPrompt segment={segment} locale={locale} /></div>
      {children}
      {onReset || controls ? <div className="lf-learning-control-strip lf-board-controls" data-board-controls="true">
        {controls}
        {onReset ? <Button size="sm" disabled={resetDisabled} onClick={onReset}>{t.reset}</Button> : null}
      </div> : null}
      {foot}
    </div>
  </div></main>;
}

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { AgeBand, Locale } from '../design/copyBudget';
import { AnswerChoice, Button, ButtonLink, IconButton, InlineNotice, MENTOR_NAMES, MentorAvatar, ProgressBar, Skeleton, TextAreaField,
  type MentorCharacter } from '../design/controls';
import { findMentorAvatar } from '../design/assets';
import '../design/tokens.css';
import '../design/system.css';
import './placementFlow.css';
import { fill, learnCopy, linkTo, type LearnLinks, type LearnNavigate } from './learnCopy';
import { dontKnowIndex, type PlacementFlow, type PlacementScreen } from './placementFlow';
import { PlacementOutcomeBody } from './PlacementOutcomeView';

/*
 * W2L.2 — L4, the placement flow at /learn/:courseSlug/placement: welcome,
 * the conversational opener (12+ only, Core decides), the adaptive questions,
 * the outcome and the learner's own adjustment, on one full-hue screen
 * (02 rule 15: one state, one hue) with no app navigation around it.
 *
 * B.15: framed as accompaniment, not a test. The learner's own Mentor (the
 * chosen character, a real-model render; no character before one is chosen)
 * says one short turn per step (06 §3.1 `mentor`), "I don't know yet" is
 * always an answer, the learner can go back one question, start from the
 * beginning without any question, and move a start earlier on the outcome.
 * The outcome says only Core's closed frame (PlacementOutcomeBody): what the
 * learner has seen, never what they can do; no score, count or comparison.
 *
 * Every step keeps its screen when a request fails and offers the same
 * request again (B.1: an identical retry of the commit). Presentation only:
 * the host owns transport and navigation (routes/app/learn/PlacementRoute.tsx).
 */

export interface PlacementFlowViewProps {
  flow: PlacementFlow;
  slug: string;
  locale: Locale;
  dark: boolean;
  ageBand?: AgeBand;
  /** The learner's chosen Mentor, or null before a choice (then no character is shown, never a stand-in). */
  mentor: MentorCharacter | null;
  links: LearnLinks;
  onNavigate: LearnNavigate;
  fixture?: boolean;
}

type Copy = (typeof learnCopy)['en-US']['placement'];
type CourseCopy = (typeof learnCopy)['en-US']['course'];

function screenKey(screen: PlacementScreen, answered: number): string {
  switch (screen.kind) {
    case 'question': return `question:${answered}:${screen.ask.questionNumber}`;
    case 'unavailable': return `unavailable:${screen.reason}`;
    default: return screen.kind;
  }
}

export function PlacementFlowView({ flow, slug, locale, dark, ageBand, mentor, links, onNavigate, fixture = false }: PlacementFlowViewProps) {
  const t = learnCopy[locale].placement;
  const c = learnCopy[locale].course;
  const { screen, pending, issue } = flow;
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const key = screenKey(screen, flow.answered);
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef(key);
  /*
   * A new step is a new state of the same page: when the learner moved it (focus was on a control of the flow,
   * or on nothing once the pressed control left), focus moves to the new heading so it is announced. Arrival is
   * the shell's (02 rule 13): the heading stays the same element from loading to the first step, and a first load
   * leaves focus where the document starts.
   */
  useEffect(() => {
    const from = previous.current;
    previous.current = key;
    if (from === key || from === 'loading') return;
    const active = document.activeElement;
    if (!active || active === document.body || root.current?.contains(active)) heading.current?.focus();
  }, [key]);
  const busy = pending !== null;
  const turn = mentorTurn(screen, flow, t);
  return <div ref={root} className="lf-placement-flow" data-screen={fixture ? `placement-${screen.kind}-preview` : `placement-${screen.kind}`} data-age-band={ageBand}
    data-theme={dark ? 'dark' : 'light'} lang={locale} aria-busy={screen.kind === 'loading' || busy}>
    <div className="lf-placement-bar">
      {screen.kind === 'question' && flow.answered > 0
        ? <Button size="sm" disabled={busy} onClick={flow.back}>{t.back}</Button> : <span aria-hidden="true" />}
      {/* Leaving is always possible and never costs anything: nothing is stored until the start is chosen. */}
      <IconButton glyph="close" label={t.close} variant="soft" onClick={() => onNavigate(links.course(slug))} />
    </div>
    <Body screen={screen} flow={flow} t={t} c={c} headingId={headingId} heading={heading} locale={locale} links={links} onNavigate={onNavigate} />
    {turn ? <MentorTurn mentor={mentor} dark={dark} text={turn} /> : null}
    <Actions screen={screen} flow={flow} t={t} c={c} links={links} onNavigate={onNavigate} headingId={headingId} />
    {/* What did not go through, said once; the same action sends it again (B.1: the identical body for a save). */}
    {issue ? <div className="lf-placement-issue">
      <InlineNotice tone="error" live>{issue.offline ? t.offlineError : issue.kind === 'save' ? t.saveError : t.stepError}</InlineNotice>
    </div> : null}
  </div>;
}

/** One Mentor turn per step, at most; the outcome's words are B.15's frame alone. */
function mentorTurn(screen: PlacementScreen, flow: PlacementFlow, t: Copy): string | null {
  switch (screen.kind) {
    case 'welcome': return t.welcomeMentor;
    case 'intake': return t.intakeMentor;
    case 'adjust': return t.adjustMentor;
    case 'question':
      if (screen.ask.phase === 'confirm') return t.confirmMentor;
      return flow.answered === 0 ? flow.reflection : null;
    default: return null;
  }
}

function MentorTurn({ mentor, dark, text }: { mentor: MentorCharacter | null; dark: boolean; text: string }) {
  const avatar = mentor ? findMentorAvatar(mentor, dark ? 'dark' : 'light') : null;
  return <div className="lf-placement-mentor" data-mentor-character={mentor ?? undefined}>
    {avatar ? <MentorAvatar renderId={avatar} label={null} size="md" /> : null}
    <div className="lf-placement-mentor-text">
      {mentor ? <span className="lf-placement-mentor-name" data-copy-role="data">{MENTOR_NAMES[mentor]}</span> : null}
      <p data-copy-role="mentor">{text}</p>
    </div>
  </div>;
}

function Body({ screen, flow, t, c, headingId, heading, locale }: {
  screen: PlacementScreen; flow: PlacementFlow; t: Copy; c: CourseCopy; headingId: string; heading: RefObject<HTMLHeadingElement>;
  locale: Locale; links: LearnLinks; onNavigate: LearnNavigate;
}) {
  // Every step but the outcome has the same shape (progress, heading, detail), so the heading is one element across them.
  const step = (text: string, { role = 'heading', before = null, after = null }: { role?: 'heading' | 'prompt'; before?: ReactNode; after?: ReactNode } = {}) => <>
    {before}
    <h1 id={headingId} ref={heading} tabIndex={-1} data-copy-role={role}>{text}</h1>
    {after}
  </>;
  switch (screen.kind) {
    case 'loading': return step(t.loading, { after: <Skeleton lines={3} /> });
    case 'unavailable': {
      const copy = unavailableCopy(screen.reason, t, c);
      return step(copy.title, { after: copy.body ? <p data-copy-role="body">{copy.body}</p> : null });
    }
    case 'welcome': return step(t.welcomeTitle);
    case 'intake': return step(t.intakeTitle);
    case 'adjust': return step(t.adjustTitle);
    case 'question': {
      const { questionNumber, questionsRemaining, probe } = screen.ask;
      const total = questionNumber + questionsRemaining;
      const label = fill(t.question, { n: questionNumber, total });
      return step(probe.prompt, { role: 'prompt', before: <ProgressBar label={label} labelHidden value={questionNumber} max={total} valueText={label} /> });
    }
    case 'outcome': return <div className="lf-placement-outcome-body">
      <PlacementOutcomeBody rawFrame={screen.result.framing} locale={locale} headingId={headingId} headingRef={heading}
        note={screen.result.cappedByPrerequisite ? t.capped : null} brief={flow.issue !== null} pending={flow.pending === 'save'} pendingLabel={t.saving}
        onStart={flow.accept} onEarlier={flow.earlier} />
    </div>;
  }
}

function unavailableCopy(reason: Extract<PlacementScreen, { kind: 'unavailable' }>['reason'], t: Copy, c: CourseCopy) {
  switch (reason) {
    case 'not-found': return { title: c.notFoundTitle, body: c.notFoundBody };
    case 'age-restricted': return { title: c.ageTitle, body: c.ageBody };
    case 'offline': return { title: c.offlineTitle, body: t.offlineBody };
    case 'refused': return { title: c.refusedTitle, body: c.refusedBody };
    default: return { title: t.errorTitle, body: t.errorBody };
  }
}

function Actions({ screen, flow, t, links, onNavigate, headingId }: {
  screen: PlacementScreen; flow: PlacementFlow; t: Copy; c: CourseCopy; links: LearnLinks; onNavigate: LearnNavigate; headingId: string;
}) {
  const busy = flow.pending !== null;
  const [chosen, setChosen] = useState<number | null>(null);
  const [text, setText] = useState('');
  const questionKey = screen.kind === 'question' ? `${flow.answered}:${screen.ask.probe.topicId}` : null;
  // A new question starts with nothing chosen.
  useEffect(() => { setChosen(null); }, [questionKey]);
  switch (screen.kind) {
    case 'unavailable': return <div className="lf-actions">
      {screen.reason === 'offline' || screen.reason === 'error' ? <Button variant="accent" onClick={flow.reload}>{t.retry}</Button> : null}
      <ButtonLink {...linkTo(links.home, onNavigate)}>{t.courses}</ButtonLink>
    </div>;
    case 'welcome': return <div className="lf-actions">
      <Button variant="accent" size="lg" pending={flow.pending === 'step'} pendingLabel={t.start} disabled={busy} onClick={flow.begin}>{t.start}</Button>
      {/* Always there: a learner who wants the beginning never has to prove it question by question. */}
      <Button size="lg" pending={flow.pending === 'save'} pendingLabel={t.saving} disabled={busy} onClick={flow.startFromBeginning}>{t.fromBeginning}</Button>
    </div>;
    case 'intake': return <form className="lf-placement-intake" onSubmit={(event) => { event.preventDefault(); flow.submitIntake(text); }}>
      <TextAreaField label={t.intakeLabel} rows={4} maxLength={600} value={text} placeholder={t.intakePlaceholder}
        onChange={(event) => setText(event.target.value)} disabled={busy} />
      <div className="lf-actions">
        <Button type="submit" variant="accent" pending={flow.pending === 'intake'} pendingLabel={t.reading} disabled={busy || !text.trim()}>{t.continue}</Button>
        <Button disabled={busy} onClick={flow.skipIntake}>{t.askInstead}</Button>
      </div>
    </form>;
    case 'question': {
      const { probe } = screen.ask;
      const choose = (index: number) => { if (busy) return; setChosen(index); flow.answer(index); };
      return <div className="lf-placement-options" role="group" aria-labelledby={headingId}>
        {probe.options.map((option, index) => <AnswerChoice key={`${probe.topicId}:${index}`} label={option} selected={chosen === index} disabled={busy && chosen !== index}
          onSelect={() => choose(index)} />)}
        <AnswerChoice label={t.dontKnow} selected={chosen === dontKnowIndex(screen.ask)} disabled={busy && chosen !== dontKnowIndex(screen.ask)}
          onSelect={() => choose(dontKnowIndex(screen.ask))} />
      </div>;
    }
    case 'adjust': return <div className="lf-actions">
      <Button variant="accent" disabled={busy} onClick={flow.chooseEarlier}>{t.adjustEarlier}</Button>
      <Button disabled={busy} onClick={flow.chooseBeginning}>{t.fromBeginning}</Button>
      <Button disabled={busy} onClick={flow.keep}>{t.adjustKeep}</Button>
    </div>;
    default: return null;
  }
}

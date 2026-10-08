import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, ButtonLink, InlineNotice } from '../../design/controls';
import type { Locale } from '../../design/copyBudget';
import { GoalProgress } from '../../family/GoalProgress';
import enHabits from '../../../i18n/en-US/moneyHabits.json';
import esHabits from '../../../i18n/es-MX/moneyHabits.json';
import ptHabits from '../../../i18n/pt-BR/moneyHabits.json';
import { ActorClip } from '../ActorClip';
import { follow, siteCopy, type Navigate, type StartAction } from '../blocks';
import type { LessonStageState } from './LessonStage';
import './lesson.css';

/*
 * Landing section 3 (owner brief, 2026-10-07, rebuilt after "the visitor learns nothing"): a mini lesson that TEACHES, the way the real
 * ones do. The learning is in doing: 1 the visitor predicts (in how many weeks will you have the bike?), 2 lets the weeks pass one by one
 * and finds the answer for themselves (40 still to go at 10 a week), 3 meets a game on sale, chooses, and sees what the choice does to the
 * weeks (7 against 4), 4 reads the one sentence they now own ("what you spend today changes when you reach your goal") and goes on to a
 * real first lesson. Nothing is scored and nothing is lost; there is no wrong answer, only what happens. Dina, a transparent clip of the
 * real model, stands directly on the page: no band, no frame. Where real-time 3D can run, the stage is live and follows the decisions:
 * the jar fills with seeds as the weeks pass, the bike lights up when the goal is reached, the game on sale floats in and Dina takes it or
 * waves it away; elsewhere Dina's clips stand in. The goal bar is the app's own.
 */
/** The live 3D stage loads only when the section is near the viewport and the device can run it; otherwise Dina's clips stand in. */
const LessonStage = lazy(() => import('./LessonStage'));

const HABITS = { 'en-US': enHabits, 'es-MX': esHabits, 'pt-BR': ptHabits } as const;
const TARGET = 100;
const START = 60;
const WEEKLY = 10;
const PRICE = 25;
const ARRIVES = Math.ceil((TARGET - START) / WEEKLY); // 4 weeks
const ARRIVES_AFTER_GAME = Math.ceil((TARGET - (START - PRICE)) / WEEKLY); // 7 weeks
const GUESSES = [2, 4, 6] as const;
const ORIGIN = 'landing-lesson';
const TICK = 520;

type Game = 'buy' | 'keep';
const fill = (text: string, n: number) => text.replace('{n}', String(n));

/** Real-time 3D only where it will run well: WebGL available, no data saver, no reduced-motion request, a machine with more than two cores. */
function useLive3D() {
  const [live] = useState(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData === true || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return false;
    if ((navigator.hardwareConcurrency ?? 4) <= 2) return false;
    try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; }
  });
  return live;
}

/** True once the element is within a screen of the viewport (and stays true: the stage then governs its own pausing). */
function useNear(ref: { current: Element | null }) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const watch = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) { setNear(true); watch.disconnect(); } }, { rootMargin: '600px' });
    watch.observe(element);
    return () => watch.disconnect();
  }, [ref]);
  return near;
}

function useReducedMotion() {
  const [reduced] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  return reduced;
}

export function LessonDemo({ locale, start, onNavigate }: { locale: Locale; start: StartAction; onNavigate?: Navigate }) {
  const copy = siteCopy(locale);
  const l = copy.landingV2.lessonDemo;
  const habits = HABITS[locale];
  const reduced = useReducedMotion();
  const live3D = useLive3D();
  const scene = useRef<HTMLDivElement>(null);
  const near = useNear(scene);
  const id = useId();
  const [step, setStep] = useState(0);
  const [guess, setGuess] = useState<number | null>(null);
  const [passed, setPassed] = useState(0); // step 2: weeks the visitor has let pass
  const [game, setGame] = useState<Game | null>(null);
  const [run, setRun] = useState(0); // step 3: weeks that have passed on their own after the choice
  const target = game === 'buy' ? ARRIVES_AFTER_GAME : ARRIVES;

  useEffect(() => {
    if (step !== 2 || !game) { setRun(0); return; }
    if (reduced) { setRun(target); return; }
    // The first beat shows the purchase itself (the bar drops); then the weeks pass.
    const timer = window.setInterval(() => setRun((current) => (current >= target ? current : current + 1)), TICK);
    return () => window.clearInterval(timer);
  }, [step, game, target, reduced]);

  const found = passed >= ARRIVES;
  const running = step === 2 && game !== null && run < target;
  const bought = step === 2 && game === 'buy';
  const value = step === 1 ? Math.min(TARGET, START + passed * WEEKLY)
    : step === 2 && game ? Math.min(TARGET, (bought ? START - PRICE : START) + run * WEEKLY) : START;
  const week = step === 1 ? passed : step === 2 && game ? run : null;
  const clip = step === 0 ? 'lesson-hello' : step === 1 ? (found ? 'lesson-celebrate' : 'lesson-think')
    : step === 2 ? (!game ? 'lesson-think' : running ? 'lesson-think' : bought ? 'lesson-nod' : 'lesson-celebrate') : 'lesson-celebrate';
  const line = step === 0 ? l.oneLine
    : step === 1 ? (found ? l.twoDone : fill(l.twoLine, guess ?? ARRIVES))
      : step === 2 ? (!game ? l.threeLine : running ? l.threeRun : bought ? l.threeBuyDone : l.threeKeepDone) : l.fourLine;
  // What the live stage shows: the jar holds one seed per five units, the bike is lit once the goal is reached, the game floats in until
  // the visitor decides, and Dina's pose follows what is happening (her action replays whenever the moment changes).
  const jar = step === 3 ? TARGET : value;
  const decided = step === 2 && game !== null;
  const moment = [step, passed, game, running].join();
  const counter = useRef(0);
  const actionKey = useMemo(() => ++counter.current, [moment]);
  const stage: LessonStageState = {
    seeds: Math.round(jar / 5),
    unlocked: (step === 1 && found) || step === 3 || (decided && !running),
    game: step === 2 ? (!game ? 'offer' : game === 'buy' ? 'taken' : 'gone') : 'none',
    emotion: step === 0 ? 'happy' : step === 1 ? (found ? 'excited' : 'thinking') : step === 2 ? (!game || running ? 'thinking' : bought ? 'encouraging' : 'excited') : 'excited',
    action: step === 0 ? 'hop' : step === 1 ? (found ? 'celebrate' : passed > 0 ? 'nod' : 'think') : step === 2 ? (!game ? 'think' : running ? 'idle' : bought ? 'nod' : 'celebrate') : 'celebrate',
    actionKey,
  };
  const restart = () => { setStep(0); setGuess(null); setPassed(0); setGame(null); setRun(0); };

  return <section className="lf-demo" data-section data-layout="lesson-demo" aria-labelledby={`${id}-title`}>
    <header className="lf-demo-head">
      <h2 id={`${id}-title`} data-copy-role="heading">{l.title}</h2>
      <p data-copy-role="body">{l.lead}</p>
    </header>
    <div className="lf-demo-stage">
      <div className="lf-demo-scene" ref={scene}>
        {live3D && near
          ? <Suspense fallback={<ActorClip key={clip} name={clip} className="lf-demo-dina" />}><LessonStage state={stage} /></Suspense>
          : <ActorClip key={clip} name={clip} className="lf-demo-dina" />}
      </div>
      <div className="lf-demo-card" key={step}>
        <div className="lf-demo-progress" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1} aria-label={fill(l.step, step + 1)}>
          {Array.from({ length: 4 }, (_, index) => <span key={index} data-done={index <= step} />)}
        </div>
        <p className="lf-demo-line" role="status" data-copy-role="body">{line}</p>

        {step === 0 ? <p className="lf-demo-ask" data-copy-role="body">{l.oneAsk}</p> : null}

        {step !== 3 ? <div className="lf-demo-goal">
          <div className="lf-demo-goal-head">
            <span className="lf-demo-goal-title" data-copy-role="data">{l.goal}</span>
            {week !== null ? <span className="lf-demo-week" data-copy-role="data">{fill(l.week, week)}</span> : null}
          </div>
          <GoalProgress copy={habits.goalProgress} title={l.goal} target={TARGET} progress={{ own: value, bonus: 0, family: 0, total: value }} />
        </div> : <div className="lf-demo-learned">
          <span className="lf-demo-learned-title" data-copy-role="data">{l.learnTitle}</span>
          <strong data-copy-role="body">{l.learn}</strong>
        </div>}

        <div className="lf-demo-actions">
          {step === 0 ? GUESSES.map((n) => <Button key={n} variant="secondary" size="lg" onClick={() => { setGuess(n); setStep(1); }}>{fill(l.weeksOption, n)}</Button>) : null}
          {step === 1 && !found ? <Button variant="accent" size="lg" onClick={() => setPassed((current) => current + 1)}>{l.twoPass}</Button> : null}
          {step === 1 && found ? <Button variant="accent" size="lg" onClick={() => setStep(2)}>{l.next}</Button> : null}
          {step === 2 && !game ? <>
            <Button variant="secondary" size="lg" onClick={() => setGame('buy')}>{l.threeBuy}</Button>
            <Button variant="secondary" size="lg" onClick={() => setGame('keep')}>{l.threeKeep}</Button>
          </> : null}
          {step === 2 && game ? <Button variant="accent" size="lg" disabled={running} onClick={() => setStep(3)}>{l.next}</Button> : null}
          {step === 3 ? <>
            {start.kind === 'continue'
              ? <ButtonLink variant="accent" size="lg" href={start.href} data-cta="continue" onClick={follow(start.href, onNavigate, start.onFollow)}>{l.ctaContinue}</ButtonLink>
              : <Button variant="accent" size="lg" data-cta="start-free" data-origin={ORIGIN} pending={start.pending === ORIGIN} pendingLabel={copy.site.starting}
                disabled={start.pending !== null && start.pending !== ORIGIN} onClick={() => start.onStart(ORIGIN)}>{l.cta}</Button>}
            <Button size="lg" onClick={restart}>{l.again}</Button>
          </> : null}
        </div>
        {step === 3 && start.kind !== 'continue' && start.failed === ORIGIN ? <InlineNotice tone="error" live>{copy.site.startError}</InlineNotice> : null}
        {step === 3 ? <p className="lf-demo-note" data-copy-role="body">{l.ctaNote}</p> : null}
      </div>
    </div>
    {step === 3 ? <p className="lf-demo-bridge" data-copy-role="body">{l.bridge}</p> : null}
  </section>;
}

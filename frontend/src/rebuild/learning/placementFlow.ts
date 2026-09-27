import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { failureOf, type Failure } from './learnHome';

/*
 * W2L.2 (L4): the placement flow's contract with Core (backend/src/routes/placement.ts).
 *
 * STATELESS BY DESIGN, as Core is: there is no quiz session on the server.
 * This flow holds the answers given so far and sends the whole list with
 * every step; Core replays its deterministic search to pick the next
 * question, grades against its own stored probes (the right option never
 * reaches the client) and writes nothing until /commit. So going back one
 * answer, a refresh or a dropped connection costs nothing.
 *
 * B.1: the commit is Core's atomic placement transaction. A commit whose
 * answer was lost is retried with the IDENTICAL body (Core returns the normal
 * result for an identical retry); a different placement already stored is a
 * conflict, and the learner goes to the course, where it applies. Core
 * recomputes the start from the graded answers and clamps a learner's own
 * adjustment downward only, so nothing here can move anyone further ahead.
 *
 * Transport is injected: this module imports nothing from the legacy app.
 */

export interface PlacementTransport {
  (path: string, init?: { method: 'GET' | 'POST'; body?: unknown }): Promise<{ data: unknown; error: { code: string } | null }>;
}

const intakeInfoSchema = z.object({ ageAlreadyKnown: z.boolean(), conversationalIntakeAvailable: z.boolean() });
const intakeReplySchema = z.object({ available: z.boolean(), priorFraction: z.number().min(0).max(1).nullable(), reflection: z.string().nullable() });
const probeSchema = z.object({ topicId: z.string().min(1), prompt: z.string().min(1), options: z.array(z.string()).min(2) });
const askSchema = z.object({
  kind: z.literal('ask'), probe: probeSchema, questionNumber: z.number().int().positive(), questionsRemaining: z.number().int().nonnegative(),
  phase: z.enum(['search', 'confirm']),
});
/** The result Core describes (describeResult): a start, never a score. `framing` is B.15's closed frame, parsed by the outcome view. */
export const placementResultSchema = z.object({
  frontier: z.number().int().nonnegative(),
  startLessonId: z.string().nullable(),
  cappedByPrerequisite: z.boolean(),
  framing: z.unknown(),
});
const doneSchema = z.object({ kind: z.literal('done'), result: placementResultSchema });
const stepSchema = z.discriminatedUnion('kind', [askSchema, doneSchema]);

export type PlacementAsk = z.infer<typeof askSchema>;
export type PlacementResult = z.infer<typeof placementResultSchema>;
type Answer = { topicId: string; selectedIndex: number };

export type PlacementScreen =
  | { kind: 'loading' }
  | { kind: 'unavailable'; reason: 'not-found' | 'age-restricted' | Failure }
  | { kind: 'welcome' }
  | { kind: 'intake' }
  | { kind: 'question'; ask: PlacementAsk }
  | { kind: 'outcome'; result: PlacementResult }
  | { kind: 'adjust'; result: PlacementResult };

/**
 * A step or a save that did not go through. The screen stays as it was, and the learner's own action sends the
 * same request again: the same answers for a step, the identical body for a save (B.1), so no second control
 * is needed to retry.
 */
export type PlacementIssue = { kind: 'step' | 'save'; offline: boolean } | null;

export interface PlacementFlow {
  screen: PlacementScreen;
  /** How many answers the learner has given (the flow can go back one while it is above zero). */
  answered: number;
  /** What Core's conversational opener said back (12+ only), shown with the first question. */
  reflection: string | null;
  intakeAvailable: boolean;
  pending: null | 'step' | 'intake' | 'save';
  issue: PlacementIssue;
  begin: () => void;
  startFromBeginning: () => void;
  submitIntake: (text: string) => void;
  skipIntake: () => void;
  /** An option's index, or `dontKnowIndex` for "I don't know yet". */
  answer: (index: number) => void;
  back: () => void;
  accept: () => void;
  earlier: () => void;
  chooseEarlier: () => void;
  chooseBeginning: () => void;
  keep: () => void;
  reload: () => void;
}

/**
 * "I don't know yet", as an answer index: one PAST the last option. Core's
 * right answer is always a valid index, so this can never be right, and it is
 * worth exactly as much to the search as a wrong guess, without making anyone
 * guess.
 */
export function dontKnowIndex(ask: PlacementAsk): number {
  return ask.probe.options.length;
}

/** "A bit earlier": Core clamps it to what the answers earned, so it can only move a start back. */
export function earlierFrontier(result: PlacementResult): number {
  return Math.max(0, Math.floor(result.frontier * 0.6));
}

/** A refusal that ends the flow (the age safeguard, an unknown course, an account that cannot), or null. */
function terminal(code: string): PlacementScreen | null {
  if (code === 'COURSE_AGE_RESTRICTED') return { kind: 'unavailable', reason: 'age-restricted' };
  if (code === 'NOT_FOUND') return { kind: 'unavailable', reason: 'not-found' };
  return failureOf(code) === 'refused' ? { kind: 'unavailable', reason: 'refused' } : null;
}

export function usePlacementFlow({ slug, transport, neutralReflection, onPlaced }: {
  slug: string;
  transport: PlacementTransport;
  /** The localized line Oracle falls back to when it has nothing to reflect (placementIntake.ts). */
  neutralReflection: string;
  /** Called once the placement is stored: the lesson to start with, or null to open the course. */
  onPlaced: (startLessonId: string | null) => void;
}): PlacementFlow {
  const base = `/placement/${encodeURIComponent(slug)}`;
  const [screen, setScreen] = useState<PlacementScreen>({ kind: 'loading' });
  const [intakeAvailable, setIntakeAvailable] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [reflection, setReflection] = useState<string | null>(null);
  const [pending, setPending] = useState<PlacementFlow['pending']>(null);
  const [issue, setIssue] = useState<PlacementIssue>(null);
  const [revision, setRevision] = useState(0);
  const prior = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  const latest = useRef({ transport, neutralReflection, onPlaced, screen, answers });
  latest.current = { transport, neutralReflection, onPlaced, screen, answers };

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const send = useCallback(async (path: string, init?: { method: 'GET' | 'POST'; body?: unknown }) => {
    try {
      return await latest.current.transport(path, init);
    } catch {
      return { data: null, error: { code: 'NETWORK' } };
    }
  }, []);

  useEffect(() => {
    let active = true;
    setScreen({ kind: 'loading' });
    void send(`${base}/intake`).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setScreen({ kind: 'unavailable', reason: error.code === 'NOT_FOUND' ? 'not-found' : error.code === 'COURSE_AGE_RESTRICTED' ? 'age-restricted' : failureOf(error.code) });
        return;
      }
      const info = intakeInfoSchema.safeParse(data);
      if (!info.success) { setScreen({ kind: 'unavailable', reason: 'error' }); return; }
      // Core alone decides the 12+ floor for the free-text opener; unknown age is never "probably old enough".
      setIntakeAvailable(info.data.conversationalIntakeAvailable);
      setScreen({ kind: 'welcome' });
    });
    return () => { active = false; };
  }, [base, send, revision]);

  const runStep = useCallback(async (next: Answer[]) => {
    setPending('step');
    setIssue(null);
    const { data, error } = await send(`${base}/step`, { method: 'POST', body: { signals: prior.current === undefined ? {} : { aiPriorFraction: prior.current }, answers: next } });
    if (!alive.current) return;
    setPending(null);
    const parsed = error ? null : stepSchema.safeParse(data);
    if (error || !parsed?.success) {
      const end = error ? terminal(error.code) : null;
      if (end) setScreen(end);
      else setIssue({ kind: 'step', offline: error?.code === 'NETWORK' });
      return;
    }
    setAnswers(next);
    setScreen(parsed.data.kind === 'done' ? { kind: 'outcome', result: parsed.data.result } : { kind: 'question', ask: parsed.data });
  }, [base, send]);

  const commit = useCallback(async (body: unknown) => {
    setPending('save');
    setIssue(null);
    const { data, error } = await send(`${base}/commit`, { method: 'POST', body });
    if (!alive.current) return;
    if (error) {
      setPending(null);
      // B.1: a different placement is already stored for this course; it is the one that applies.
      if (error.code === 'PLACEMENT_ALREADY_COMPLETE') { latest.current.onPlaced(null); return; }
      const end = terminal(error.code);
      if (end) setScreen(end);
      else setIssue({ kind: 'save', offline: error.code === 'NETWORK' });
      return;
    }
    // Stored. A reply this client cannot read still means stored: the course screen shows where it starts.
    const parsed = placementResultSchema.safeParse(data);
    latest.current.onPlaced(parsed.success ? parsed.data.startLessonId : null);
  }, [base, send]);

  const commitBody = (options: { chosenFrontier?: number; startFromBeginning?: boolean }) => ({
    signals: prior.current === undefined ? {} : { aiPriorFraction: prior.current },
    answers: latest.current.answers,
    ...(options.chosenFrontier !== undefined ? { chosenFrontier: options.chosenFrontier } : {}),
    startFromBeginning: options.startFromBeginning ?? false,
  });

  const submitIntake = useCallback((text: string) => {
    const learnerText = text.trim();
    if (!learnerText) return;
    setPending('intake');
    setIssue(null);
    void send(`${base}/intake`, { method: 'POST', body: { learnerText, neutralReflection: latest.current.neutralReflection } }).then(({ data, error }) => {
      if (!alive.current) return;
      // An unavailable or failed opener is not the learner's problem: the questions open where they would have anyway.
      const reply = error ? null : intakeReplySchema.safeParse(data);
      if (reply?.success && reply.data.available && reply.data.priorFraction !== null) prior.current = reply.data.priorFraction;
      if (reply?.success && reply.data.reflection) setReflection(reply.data.reflection);
      void runStep([]);
    });
  }, [base, send, runStep]);

  const current = screen;
  return {
    screen,
    answered: answers.length,
    reflection,
    intakeAvailable,
    pending,
    issue,
    begin: () => { if (intakeAvailable) setScreen({ kind: 'intake' }); else void runStep([]); },
    startFromBeginning: () => void commit(commitBody({ startFromBeginning: true })),
    submitIntake,
    skipIntake: () => void runStep([]),
    answer: (index) => {
      if (current.kind !== 'question') return;
      void runStep([...answers, { topicId: current.ask.probe.topicId, selectedIndex: index }]);
    },
    back: () => { if (answers.length > 0) void runStep(answers.slice(0, -1)); },
    accept: () => void commit(commitBody({})),
    earlier: () => { if (current.kind === 'outcome') setScreen({ kind: 'adjust', result: current.result }); },
    chooseEarlier: () => { if (current.kind === 'adjust') void commit(commitBody({ chosenFrontier: earlierFrontier(current.result) })); },
    chooseBeginning: () => { if (current.kind === 'adjust') void commit(commitBody({ chosenFrontier: 0 })); },
    keep: () => { if (current.kind === 'adjust') setScreen({ kind: 'outcome', result: current.result }); },
    reload: () => setRevision((n) => n + 1),
  };
}

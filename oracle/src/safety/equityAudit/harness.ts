import type { SessionContext } from '../../core/client.js';
import { getConfig } from '../../env.js';
import type { TurnHonesty } from '../../tutor/feedbackHonesty.js';
import { TutorOrchestrator, type TurnOutcome } from '../../tutor/orchestrator.js';
import type { SpeechResult } from '../../voice/speech.js';
import type { IdentityCue } from './cues.js';
import { scriptedSay, type AuditScript, type ScriptStep } from './scripts.js';

/*
 * C.18 / C.20 / Appendix D §3.7 — THE EQUITY-DRIFT HARNESS.
 *
 * Replays one scripted session through the REAL orchestrator (the real
 * prompt builder, controller, repair loop and honesty readers), with only the
 * model call answered by a `Responder`:
 *
 *   stub  the zero-spend scripted model (scripts.ts), cue-blind by
 *         construction: what the dry run and CI run (OD-23);
 *   live  the configured model, owner-run and paid (scripts/equity-audit.ts
 *         refuses it without EQUITY_AUDIT_LIVE=approved).
 *
 * Every other network call (Core, Depot, a judge) is refused offline, so a
 * replay can never write to Core or reach a provider other than the model.
 * The clock is virtual (a fixed start, 25 seconds per learner step), so the
 * controller's timing reads are identical for every cue.
 *
 * Per delivered turn the harness keeps the orchestrator's own C.18 honesty
 * facts (`TurnEmission.honesty`: praise specific or generic, a sycophantic
 * draft caught, an affirmation delivered, an answer statement), and every
 * model request body. The bodies prove the variation was CONTROLLED: with the
 * nickname replaced by a placeholder, two cues of the same locale must send
 * byte-identical requests (every request in stub mode; the first request in
 * live mode, where the model's own replies then make the histories differ).
 */

export interface ResponderCall {
  locale: IdentityCue['locale'];
  step: ScriptStep;
  ordinal: number;
  attempt: number;
  url: string;
  init: RequestInit | undefined;
  body: string;
}

export interface Responder {
  mode: 'stub' | 'live';
  /** The model the run measures (the configured MODEL_NAME for live, a label for the stub). */
  model: string;
  respond(call: ResponderCall): Promise<Response>;
}

/** A model completion carrying one Mentor turn, in the provider's wire shape. */
export function completion(say: string): Response {
  const turn = { say, emotion: 'happy', action: 'nod', next: 'ask', segmentRequest: null, offerAdaptation: null, savePlan: false };
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(turn) } }], usage: { prompt_tokens: 100, completion_tokens: 40 } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

export const STUB_MODEL = 'scripted-stub';

/** The zero-spend responder: the scripted, cue-blind model. */
export const stubResponder: Responder = {
  mode: 'stub',
  model: STUB_MODEL,
  respond: async (call) => completion(scriptedSay(call)),
};

/** The owner-run responder: forwards the model call to the configured provider. */
export function liveResponder(realFetch: typeof fetch): Responder {
  return {
    mode: 'live',
    model: getConfig().MODEL_NAME,
    respond: (call) => realFetch(call.url, call.init),
  };
}

export interface ScoredTurn {
  stepIndex: number;
  source: 'model' | 'scripted';
  honesty: TurnHonesty;
}

export interface SessionRun {
  scriptId: string;
  cue: IdentityCue;
  repeat: number;
  turns: ScoredTurn[];
  /** Every model request body, with the nickname replaced by a placeholder. */
  requests: string[];
  modelCalls: number;
}

export const NICKNAME_PLACEHOLDER = '{{LEARNER_NICKNAME}}';

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The per-turn random fence nonces (safety/untrusted.ts: learner input,
 * activity content, transcripts) differ on every call by design; they carry
 * nothing about the learner and are masked before bodies are compared.
 */
const FENCE_NONCE = /<<<((?:END_)?(?:LEARNER_INPUT|ACTIVITY_CONTENT|SESSION_TRANSCRIPT))_[A-Za-z0-9_-]+>>>/g;

/**
 * The body with every whole-word occurrence of the nickname replaced
 * (Unicode word boundaries) and the fence nonces masked: what is left is
 * everything the model was told, minus the cue.
 */
export function normalizeCue(body: string, nickname: string): string {
  return body
    .replace(FENCE_NONCE, '<<<$1_{{NONCE}}>>>')
    .replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(nickname)}(?![\\p{L}\\p{N}])`, 'gu'), NICKNAME_PLACEHOLDER);
}

const silentSpeech = async (): Promise<SpeechResult> => ({ url: null, source: 'unavailable', billedChars: 0, wordTimings: null });

/** A fixed session, identical for every cue but the nickname and the locale. */
export function sessionFor(cue: IdentityCue): SessionContext {
  return {
    sessionId: '0e0e0e0e-0000-4000-8000-000000000001',
    userId: '0e0e0e0e-0000-4000-8000-000000000002',
    tier: 3,
    locale: cue.locale,
    nickname: cue.nickname,
    character: 'rho',
    companion: 'liruf',
    diorama: 'diorama-a',
    intent: 'course_topic',
    adaptations: [],
    courseContext: null,
    skillStates: [],
    /*
     * The adult moderation posture: a minor's posture adds a paid judge call
     * per turn, and moderation is audited separately (C.20, bias audit). The
     * register still follows the tier (tween): what is measured is the
     * Mentor's feedback, and the moderation posture is held fixed.
     */
    isMinor: false,
    voiceConsent: false,
    intelDegraded: false,
  };
}

const STEP_MS = 25_000;
const START_MS = Date.UTC(2026, 0, 5, 16, 0, 0);

function ordinals(steps: readonly ScriptStep[]): number[] {
  const seen = new Map<string, number>();
  return steps.map((step) => {
    const key = step.kind === 'answer' ? `answer:${step.correct}` : step.kind;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    return n;
  });
}

function collect(outcome: TurnOutcome | null, stepIndex: number, into: ScoredTurn[]): void {
  for (let o: TurnOutcome | undefined = outcome ?? undefined; o !== undefined; o = o.after) {
    const honesty = o.emission.honesty;
    if (honesty) into.push({ stepIndex, source: o.emission.source, honesty });
  }
}

/**
 * Replays one script for one cue. Installs its own fetch interceptor and
 * virtual clock for the duration and restores both, so replays run one at a
 * time (the caller awaits each).
 */
export async function replaySession(
  script: AuditScript,
  cue: IdentityCue,
  responder: Responder,
  repeat = 0,
  opts: { quiet?: boolean } = {},
): Promise<SessionRun> {
  if (cue.locale !== script.locale) throw new Error(`cue ${cue.nickname} (${cue.locale}) cannot play ${script.id}`);
  const config = getConfig();
  const modelUrl = `${config.MODEL_API_BASE}/chat/completions`;
  const run: SessionRun = { scriptId: script.id, cue, repeat, turns: [], requests: [], modelCalls: 0 };
  const order = ordinals(script.steps);
  let current: { step: ScriptStep; ordinal: number; attempt: number } = { step: script.steps[0]!, ordinal: 0, attempt: 0 };

  const realFetch = globalThis.fetch;
  const realNow = Date.now;
  const realWarn = console.warn;
  const realError = console.error;
  let clock = START_MS;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url !== modelUrl) {
      // Core, Depot, a judge: never reached from an audit replay.
      return new Response(JSON.stringify({ data: null, error: { code: 'EQUITY_AUDIT_OFFLINE', message: 'offline' } }), { status: 503 });
    }
    const body = typeof init?.body === 'string' ? init.body : '';
    run.modelCalls += 1;
    run.requests.push(normalizeCue(body, cue.nickname));
    const call: ResponderCall = { locale: cue.locale, step: current.step, ordinal: current.ordinal, attempt: current.attempt, url, init, body };
    current.attempt += 1;
    return responder.respond(call);
  }) as typeof fetch;
  Date.now = () => clock;
  if (opts.quiet !== false) {
    console.warn = () => {};
    console.error = () => {};
  }
  try {
    const orchestrator = new TutorOrchestrator(sessionFor(cue), START_MS, silentSpeech);
    for (const [index, step] of script.steps.entries()) {
      clock += STEP_MS;
      current = { step, ordinal: order[index]!, attempt: 0 };
      if (step.kind === 'greet') {
        collect(await orchestrator.greet(clock), index, run.turns);
      } else if (step.kind === 'say') {
        collect(await orchestrator.handleLearnerText(step.text, clock), index, run.turns);
      } else {
        const segmentId = `equity-seg-${index}`;
        orchestrator.noteSegmentServed(segmentId, step.skillKey, step.activity, step.prompt);
        clock += STEP_MS;
        collect(await orchestrator.handleSegmentResult(segmentId, step.correct ? 100 : 20, step.correct, clock), index, run.turns);
      }
    }
  } finally {
    globalThis.fetch = realFetch;
    Date.now = realNow;
    console.warn = realWarn;
    console.error = realError;
  }
  return run;
}

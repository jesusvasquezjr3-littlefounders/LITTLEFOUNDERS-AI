import { z } from 'zod';
import { ADAPTATIONS } from '../context/schema.js';
import type { ClosingScript, EffortAct } from '../tutor/sessionClosing.js';
import {
  ACTIONS,
  EMOTIONS,
  ROLEPLAY_SCENE_IDS,
  type WhiteboardCategories,
  type WhiteboardCompare,
  type WhiteboardMark,
  type WhiteboardMarkedLine,
  type WhiteboardSequence,
  type WhiteboardTokens,
  type WhiteboardBarModel,
  type WhiteboardPartWhole,
  type WhiteboardFlow,
  type WhiteboardGoalBar,
  type WhiteboardWorked,
  type WhiteboardTenFrame,
  type WhiteboardOpenNumberLine,
  type WhiteboardArray,
  type WhiteboardFractionStrip,
  type WhiteboardPartition,
  type WhiteboardTable,
  type WhiteboardScale,
  type WhiteboardTwoBins,
  type WhiteboardVenn,
  type WhiteboardRanking,
  type WhiteboardOutcomes,
  type WhiteboardTrade,
  type WhiteboardChance,
  type WhiteboardDeal,
  type WhiteboardChange,
  type WhiteboardRegroup,
  type WhiteboardEquationBar,
  type WhiteboardReceipt,
  type WhiteboardLedger,
  type WhiteboardPriceTag,
  type WhiteboardInventory,
  type WhiteboardBudgetPlate,
  type WhiteboardPictograph,
  type WhiteboardBeadString,
  type WhiteboardTally,
  type WhiteboardFractionCircle,
  type WhiteboardStack,
  type WhiteboardSequenceCompare,
  type WhiteboardTimeline,
  type WhiteboardBeforeAfter,
  type WhiteboardCycle,
  type WhiteboardGrab,
  type WhiteboardFill,
  type WhiteboardWhatif,
  type WhiteboardYourTurn,
} from '../tutor/turnSchema.js';
import type { WordTiming } from '../voice/provider.js';

/*
 * The websocket wire format.
 *
 * INBOUND IS UNTRUSTED. Every client message is parsed with a `.strict()`
 * discriminated union before anything touches it — the socket is open to a
 * browser, and a browser is a place where anyone can type. An unparseable
 * frame is answered with an error and dropped; it never reaches the
 * orchestrator, the model, or Core.
 *
 * OUTBOUND IS A PLAIN TYPE, not a schema. We author it, so validating our own
 * output on the way out would be theatre. What we DO validate is the model's
 * output (tutor/turnSchema.ts), because that is not ours either.
 *
 * The audio frames carry base64 inside JSON messages rather than using binary
 * frames. Slightly wasteful and worth it: one code path, one parser, one
 * place where an oversized payload is rejected, and no ambiguity about which
 * session a stray binary frame belonged to.
 *
 * AUDIO ARRIVES TWO WAYS, and the second exists for latency, not convenience.
 * `learner_audio` is one whole clip in one frame — the original path, kept so
 * a client that recorded before deciding to send still has a shape to send.
 * `learner_audio_begin` / `_chunk` / `_commit` stream the SAME bytes while the
 * learner is still holding the button, so by the time they release, the upload
 * has already happened and transcription starts immediately. The caps are
 * identical across both paths: a clip that would be rejected whole is rejected
 * in pieces, at the same total.
 */

/** Hard ceiling on one inbound audio clip (~1.5 MB of base64 ≈ 1.1 MB audio). */
export const MAX_AUDIO_B64_CHARS = 1_500_000;

/**
 * Ceiling on one streamed chunk. A chunk is ~250 ms of Opus (a few KB); this
 * is two orders of magnitude of headroom, small enough that a client cannot
 * use the chunk path to smuggle a frame the whole-clip path would refuse.
 */
export const MAX_AUDIO_CHUNK_B64_CHARS = 400_000;

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('learner_text'),
      text: z.string().min(1).max(2_000),
    })
    .strict(),
  /**
   * The learner rephrased their LAST message instead of sending a new one —
   * the "edit" affordance every chat product has and this one lacked. The
   * previous learner line and the tutor's reply to it leave the working
   * history (never the persisted transcript, which is append-only and
   * guardian-readable), and the new text is produced exactly like a fresh
   * turn: same fence, same classification, same claim, same floor.
   */
  z
    .object({
      type: z.literal('learner_edit'),
      text: z.string().min(1).max(2_000),
    })
    .strict(),
  z
    .object({
      type: z.literal('learner_audio'),
      /** base64, not base64url — this is what MediaRecorder + FileReader produce. */
      audio: z.string().min(1).max(MAX_AUDIO_B64_CHARS),
      mimeType: z.string().min(1).max(120),
    })
    .strict(),
  z
    .object({
      type: z.literal('learner_audio_begin'),
      mimeType: z.string().min(1).max(120),
    })
    .strict(),
  z
    .object({
      type: z.literal('learner_audio_chunk'),
      audio: z.string().min(1).max(MAX_AUDIO_CHUNK_B64_CHARS),
    })
    .strict(),
  z.object({ type: z.literal('learner_audio_commit') }).strict(),
  /**
   * The learner cut in while the tutor was thinking. Aborts the in-flight
   * production (model call and synthesis) so the reply to a question the
   * learner has already abandoned is neither paid for nor delivered. Idempotent
   * and free: outside an in-flight turn it does nothing.
   */
  z.object({ type: z.literal('interrupt') }).strict(),
  z
    .object({
      type: z.literal('segment_graded'),
      segmentId: z.uuid(),
      score: z.number().int().min(0).max(100),
      correct: z.boolean(),
      /**
       * v3: Core's signed grade receipt, relayed verbatim from the grade
       * response. Verified server-side (session/gradeEcho.ts); only a valid
       * echo feeds the strategy controller, because the score alone is
       * client-reported and must not steer the pedagogy.
       */
      echo: z.string().max(2_048).optional(),
      attemptNumber: z.number().int().min(1).max(3).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('adaptation_response'),
      adaptation: z.enum(ADAPTATIONS),
      accepted: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal('end_session') }).strict(),
  /**
   * C.8/C.12: the learner's choice on the stop-or-continue offer
   * (`session_end_offer`). Honoured only while an offer is open.
   */
  z.object({ type: z.literal('session_end_response'), accepted: z.boolean() }).strict(),
  z.object({ type: z.literal('ping') }).strict(),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export type BudgetState = 'running' | 'wrapping' | 'ended';

/**
 * V4's live whiteboard, exactly as it reaches the wire — the model's own
 * fields for whichever `kind` it set, plus the server-COMPUTED fields
 * `ws/server.ts`'s `toWireWhiteboard` attaches (`computeSequence` /
 * `computeComparison` / `computeMarkedLine` / `computeCategories`,
 * `tutor/whiteboard.ts`). Named
 * and exported so `core/client.ts`'s `PersistTurnInput` can persist the SAME
 * object a learner actually saw rather than a second, driftable shape — a
 * board replay must show, per /ORACLE.md §12, is the one that was drawn,
 * never one recomputed later against arithmetic that could disagree with it.
 *
 * A discriminated union on `kind`, mirroring `Whiteboard` (turnSchema.ts)
 * exactly — each member is that kind's own model-facing fields intersected
 * with the ONE thing only the server ever adds. Still a plain TYPE, not a
 * schema: this file validates INBOUND, never outbound (see the header
 * comment above), because outbound is ours to author correctly, not a
 * client's claim to police.
 */
export type WireWhiteboard =
  | (WhiteboardSequence & { values: number[] })
  | (WhiteboardCompare & { difference: number; greater: 'left' | 'right' | 'tie' })
  | (WhiteboardMarkedLine & { marks: Array<WhiteboardMark & { position: number }> })
  | (WhiteboardCategories & { values: number[] })
  | (WhiteboardTokens & { subtotals: number[]; total: number })
  | (WhiteboardBarModel & { widths: number[]; unknownIndex: number | null })
  | WhiteboardPartWhole
  | (WhiteboardFlow & { kept: number })
  | (WhiteboardGoalBar & { remaining: number; savedFraction: number })
  | (WhiteboardWorked & { values: number[]; checkValue: number })
  | (WhiteboardTenFrame & { frames: number[] })
  | (WhiteboardOpenNumberLine & { stops: number[]; positions: number[] })
  | (WhiteboardArray & { total: number; cells: number })
  | (WhiteboardFractionStrip & { shares: number[] })
  | (WhiteboardPartition & { pieceValues: number[] })
  | (WhiteboardTable & { unitPrices: number[]; bestIndex: number })
  | (WhiteboardScale & { tilt: 'left' | 'right' | 'level'; difference: number })
  | (WhiteboardTwoBins & { counts: [number, number] })
  | (WhiteboardVenn & { left: number; right: number; both: number })
  | (WhiteboardRanking & { order: number[] })
  | WhiteboardOutcomes
  | WhiteboardTrade
  | (WhiteboardChance & { shares: number[] })
  | (WhiteboardDeal & { perBin: number; remainder: number })
  | (WhiteboardChange & { change: number })
  | (WhiteboardRegroup & { intoCount: number })
  | (WhiteboardEquationBar & { total: number })
  | (WhiteboardReceipt & { total: number })
  | (WhiteboardLedger & { balances: number[]; final: number })
  | (WhiteboardPriceTag & { unitPrice: number; finalPrice: number })
  | (WhiteboardInventory & { left: number })
  | (WhiteboardBudgetPlate & { spent: number; remaining: number; overBy: number })
  | (WhiteboardPictograph & { totals: number[] })
  | (WhiteboardBeadString & { rows: number[] })
  | (WhiteboardTally & { fives: [number, number][] })
  | (WhiteboardFractionCircle & { share: number })
  | (WhiteboardStack & { totals: number[]; max: number })
  | (WhiteboardSequenceCompare & { values: number[][] })
  | (WhiteboardTimeline & { positions: number[] })
  | (WhiteboardBeforeAfter & { delta: number; direction: 'up' | 'down' | 'same' })
  | WhiteboardCycle
  | WhiteboardGrab
  | WhiteboardFill
  | (WhiteboardWhatif & { values: number[][] })
  | (WhiteboardYourTurn & { values: number[] });

/**
 * One closed step of a tray demonstration — mirrors `oracle/src/tutor/
 * turnSchema.ts`'s `DemoStepSchema`. Named and exported for the same reason
 * `WireWhiteboard` is: `core/client.ts`'s `PersistTurnInput` needs a type to
 * persist the SAME steps the wire carried, not a second, driftable shape.
 */
export interface WireDemoStep {
  kind: 'add' | 'remove' | 'pause' | 'place' | 'assign' | 'pair' | 'move';
  denomination?: number;
  ms?: number;
  item?: string;
  bucket?: string;
  left?: string;
  right?: string;
  value?: number;
}

export type ServerMessage =
  | {
      type: 'ready';
      sessionId: string;
      character: string;
      companion: string | null;
      diorama: string;
      /** Whether speech is available at all this session (/ORACLE.md §14). */
      voice: boolean;
      /** Whether the microphone may be opened: voice AND consent AND permission. */
      microphone: boolean;
      /** True when personalization could not be read — the UI says so honestly. */
      intelDegraded: boolean;
      locale: string;
    }
  | {
      type: 'turn';
      seq: number;
      say: string;
      emotion: (typeof EMOTIONS)[number];
      action: (typeof ACTIONS)[number];
      /**
       * Null on delivery. The turn's text ships the moment moderation passes;
       * the audio follows in its own `turn_audio` frame when synthesis and
       * storage finish, so the caption never waits on the voice. The field
       * stays on this frame so a turn's shape is complete in one place.
       */
      audioUrl: string | null;
      /**
       * Whether a `turn_audio` frame for this SAME `seq` is still coming.
       * True on ordinary delivery (synthesis is in flight); false on a resume
       * redraw, which deliberately sends no `turn_audio` at all — replaying a
       * clip the learner already heard reads as a stutter. Found by
       * adversarial review, 2026-08-30 (HIGH): without this, the client could
       * not tell "audio is on its way" from "no audio is coming, ever" just
       * from `audioUrl: null`, and opened the hands-free microphone in the gap
       * before a real clip's `turn_audio` arrived — silently discarding
       * whatever the learner said in that window. See
       * `frontend/src/tutor/useHandsFreeTurn.ts`.
       */
      audioPending: boolean;
      /** What the tutor intends next, so the UI can prepare the panel. */
      next: 'ask' | 'segment' | 'close';
      /**
       * v3 turn policy, chosen per pedagogical strategy. Absent while the v3
       * brain is dormant — the client then keeps its own defaults, which must
       * be real numbers rather than zero: a zero here would cut a child off
       * the moment they drew breath.
       *
       * `idleNudgeMs` — how long to let the learner think before any gentle
       * nudge. `listenSilenceMs` — how much silence, AFTER they have actually
       * spoken, means the turn is theirs no longer (blueprint §6.2). The two
       * are different questions: one is about a learner who has not started,
       * the other about one who has finished. Thinking time is sacred in a
       * Socratic beat and fluency work wants pace, so both move with the
       * strategy rather than being global constants.
       */
      policy?: { idleNudgeMs: number; listenSilenceMs: number };
      /**
       * v3: demonstration steps over the OPEN money-tray activity, validated
       * by the closed turn schema. The client animates them concurrently with
       * the speech and drops any denomination the payload lacks.
       */
      demonstrate?: WireDemoStep[];
      /**
       * V4: the lesson thread — child-facing topic + step N of M, our own plan
       * text. Absent while there is no active plan (open chat).
       *
       * NOTE: added after `demonstrate` without a matching field here for one
       * commit — a conditional spread (`...(cond ? {lesson} : {})`) defeats
       * TypeScript's excess-property check on the object literal it is spread
       * into, so `tsc` passed clean while this type quietly stopped describing
       * the wire. Declaring it explicitly is what makes the frontend's `lesson`
       * typing (`useTutorSocket.ts`) actually checked against what Oracle sends,
       * instead of trusting a shape nothing here asserts.
       */
      lesson?: { topic: string | null; step: number; of: number };
      /**
       * V4: a live sequence board synced to this turn's story (/ORACLE.md
       * §20.5). `values` are the SERVER-COMPUTED running quantities — the
       * client renders them as given and never redoes the arithmetic, exactly
       * the posture `checkAnswer`'s verdict already takes with a spoken answer.
       */
      whiteboard?: WireWhiteboard;
      /**
       * Class III / S17 `roleplay` (TUTOR_INSTRUMENTS.md §3.4): a closed id
       * into the frontend's own pre-authored scene catalog
       * (`frontend/src/tutor/roleplay/scenes.ts`). Unlike `savePlan`, this
       * IS on the wire — the frontend is what plays the scene, so it needs
       * to be told which one, verbatim from the model's own turn.
       */
      roleplayScene?: (typeof ROLEPLAY_SCENE_IDS)[number] | null;
      /**
       * Class III `point_at` (2026-09-04): which element of the open
       * `whiteboard` the character's `action: "point"` gesture reaches for,
       * as a plain array index — never a coordinate, never anything the
       * client trusts as content, only where to aim a pose it already has.
       */
      pointAt?: number | null;
    }
  | {
      /**
       * The voice for an already-delivered turn. `audioUrl` null means the
       * turn stays captioned and silent — sent even then, so a client waiting
       * on a clip knows to stop waiting rather than spinning.
       */
      type: 'turn_audio';
      seq: number;
      audioUrl: string | null;
      /**
       * Word-level timing for THIS clip, present only when the voice
       * provider actually returned it for these exact bytes (ORACLE.md
       * §19.5 — gated on the configured TTS model, which nothing in
       * production requests today, so this is absent on every turn until
       * that changes; see the voice adapter's own comment in `src/voice/`).
       * Omitted rather than sent empty/null: the caption treats "no
       * highlighting for this turn" and "the field was never sent" as the
       * same thing, so there is no reason to spend wire bytes saying so.
       */
      wordTimings?: WordTiming[];
    }
  | {
      /**
       * The server accepted the learner's turn and is producing a reply.
       * Sent at the moment the turn slot is claimed, so the "thinking"
       * performance is authoritative rather than inferred client-side.
       */
      type: 'thinking';
    }
  | {
      /**
       * The conversation so far, sent ONLY when a dropped session re-attaches
       * (/ORACLE.md §3.2 resume). The client's per-socket state was reset by
       * the reconnect; this refills the transcript so the learner returns to
       * the conversation they left, not to a blank one. The final tutor entry
       * carries the real seq of the re-sent `turn` frame so the caption and
       * the log never print the same line twice.
       */
      type: 'history';
      turns: { speaker: 'learner' | 'tutor'; text: string; seq: number }[];
    }
  | {
      type: 'transcript';
      /** What we heard the learner say — shown so they can correct a misheard turn. */
      text: string;
    }
  | {
      type: 'segment';
      segmentId: string;
      seq: number;
      origin: 'catalog' | 'bank' | 'live';
      /** A stripped Lesson Engine segment. The answer key is not here. */
      segment: Record<string, unknown>;
      /** Whether this segment can award XP (/ORACLE.md §8). */
      scoresXp: boolean;
      framing: string;
    }
  | {
      type: 'adaptation_offer';
      adaptation: (typeof ADAPTATIONS)[number];
    }
  /**
   * C.8/C.12: the turn just delivered asked the learner to choose between
   * stopping for today and doing one more. The stage shows two equal
   * choices; the answer is `session_end_response`.
   */
  | { type: 'session_end_offer' }
  /**
   * C.16: sent once, just before `closed` on a graceful close. `script` is
   * the closing script this ending used; `effort` the specific act a
   * completed close named (null otherwise); `topic` the lesson the next
   * session picks up from (null for a safety stop). Our own catalog text.
   */
  | {
      type: 'session_closing';
      script: ClosingScript;
      effort: EffortAct | null;
      topic: string | null;
    }
  | {
      type: 'state';
      budget: BudgetState;
      remainingMs: number;
      turnCount: number;
    }
  | {
      type: 'closed';
      reason: string;
    }
  | {
      type: 'error';
      code: string;
      message: string;
    };

/** Close codes. 4000-4999 is the application range. */
export const CLOSE_CODES = {
  UNAUTHORIZED: 4001,
  SESSION_NOT_FOUND: 4004,
  CONSENT_REQUIRED: 4003,
  BUDGET_EXHAUSTED: 4008,
  ALREADY_CONNECTED: 4009,
  SERVICE_DEGRADED: 4013,
  /**
   * The platform-wide spend circuit breaker refused a NEW session
   * (/ORACLE.md §15.2 item 1, `session/spend-guard.ts`). Deliberately its
   * own code rather than reusing `SERVICE_DEGRADED` — an on-call engineer
   * grepping close codes needs "cost control tripped" to be instantly
   * distinguishable from "moderation is down"; the two have nothing in
   * common and nothing in common to fix. The learner still sees the same
   * honest, generic message either way (`closeCodeToReason` maps both to
   * `SERVICE_DEGRADED`) — a business-side cost ceiling is not something to
   * explain to a child, and "try again soon" is the correct thing to tell
   * them in both cases.
   */
  SPEND_CEILING: 4029,
  NORMAL: 1000,
} as const;

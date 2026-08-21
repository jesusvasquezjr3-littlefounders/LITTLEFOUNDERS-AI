import { z } from 'zod';
import { ADAPTATIONS } from '../context/schema.js';
import { ACTIONS, EMOTIONS } from '../tutor/turnSchema.js';

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
 * The audio frame carries base64 inside a JSON message rather than using a
 * binary frame. Slightly wasteful and worth it: one code path, one parser, one
 * place where an oversized payload is rejected, and no ambiguity about which
 * session a stray binary frame belonged to.
 */

/** Hard ceiling on one inbound audio chunk (~1.5 MB of base64 ≈ 1.1 MB audio). */
export const MAX_AUDIO_B64_CHARS = 1_500_000;

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('learner_text'),
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
      type: z.literal('segment_graded'),
      segmentId: z.uuid(),
      score: z.number().int().min(0).max(100),
      correct: z.boolean(),
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
  z.object({ type: z.literal('ping') }).strict(),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export type BudgetState = 'running' | 'wrapping' | 'ended';

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
      /** Depot URL for the tutor's audio, or null in a silent session. */
      audioUrl: string | null;
      /** What the tutor intends next, so the UI can prepare the panel. */
      next: 'ask' | 'segment' | 'close';
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
  SERVICE_DEGRADED: 4013,
  NORMAL: 1000,
} as const;

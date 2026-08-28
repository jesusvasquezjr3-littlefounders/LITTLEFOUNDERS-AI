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
      /**
       * Null on delivery. The turn's text ships the moment moderation passes;
       * the audio follows in its own `turn_audio` frame when synthesis and
       * storage finish, so the caption never waits on the voice. The field
       * stays on this frame so a turn's shape is complete in one place.
       */
      audioUrl: string | null;
      /** What the tutor intends next, so the UI can prepare the panel. */
      next: 'ask' | 'segment' | 'close';
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

import type { CharacterAction, CharacterEmotion, CharacterId } from '@/components/characters/control/types';

/*
 * The Tutor's client-side types.
 *
 * These mirror Oracle's `ws/protocol.ts` and Core's `/api/v1/tutor/*`
 * responses. They are hand-written rather than generated because the platform
 * has no shared package (/AGENTS.md §1.2) — the same reason the lesson
 * graders are a checked copy.
 */

export type TutorIntent = 'course_topic' | 'weak_skill' | 'faq' | 'open' | 'diagnostic';

/**
 * One spoken word's position in a `turn_audio` clip, in milliseconds from
 * its own start. Mirrors Oracle's `voice/provider.ts` `WordTiming` — see
 * that file for why it is deliberately this narrow (no phoneme/viseme
 * detail, no provider field names).
 */
export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export type Adaptation =
  | 'slower_pacing'
  | 'more_examples'
  | 'less_text'
  | 'more_visual'
  | 'repeat_before_advancing';

export interface TutorPreferences {
  character: CharacterId;
  companion: CharacterId | null;
  diorama: string;
  backdrop: string;
  nickname: string | null;
  adaptations: Adaptation[];
}

export interface TutorCatalog {
  characters: CharacterId[];
  dioramas: string[];
  backdrops: string[];
  adaptations: Adaptation[];
  /**
   * The characters whose mouths actually move (/TUTOR_3D.md §3.1).
   *
   * All four are selectable as the speaking tutor (owner decision 4), but only
   * these two have a mouth card, so only these two earn the tight
   * `conversation` framing. The others are framed wider and lean on the 2D
   * bubble, where their heads DO articulate.
   */
  articulates: CharacterId[];
}

export interface WeakSkillOffer {
  skillKey: string;
  /** The human title Core resolved for the flagged skill's topic, when it could. */
  title: string | null;
  courseId: string | null;
  topicId: string | null;
  recommendedAction: 'remediate' | 'practice' | 'retrieve' | 'continue';
  reasonCode: string;
}

export interface TutorOffers {
  locale: string;
  /**
   * The learner's latest closed conversation, digested — the "continue where
   * you left off" opening. Null until a session has closed with a digest.
   */
  lastSession: {
    topic: string | null;
    courseId: string | null;
    topicId: string | null;
    skillKey: string | null;
    outcome: 'completed' | 'left' | 'stopped';
    daysAgo: number;
  } | null;
  /** True when personalization could not be read — the UI says so honestly. */
  intelDegraded: boolean;
  /**
   * Whether a session can be started at all right now — Oracle's own health
   * AND the learner's daily session cap folded into one answer (round 99:
   * this used to reflect only Oracle's health, so a learner who had used
   * every session today saw the same inviting screen as one who had used
   * none). `startBlockedBy` names the reason; `'SESSION_LIMIT'` is the SAME
   * code `POST /sessions` returns for the identical refusal.
   */
  canStart: boolean;
  startBlockedBy: string | null;
  /**
   * When `startBlockedBy` is `'SESSION_LIMIT'`, the learner's next local
   * midnight — the SAME reset instant `POST /sessions`'s own 429 `resetAt`
   * carries (round 95), exposed here too so the proactive refusal on this
   * screen and the post-tap one never disagree about how long the wait is.
   * Null whenever the cap is not what is blocking (or not reached at all).
   */
  sessionCapResetAt: string | null;
  voiceAvailable: boolean;
  /**
   * Why the microphone is off, when it is. Resolved BEFORE the session starts,
   * so the "talk out loud" checkbox is never a control that does nothing.
   */
  microphoneBlockedBy: string | null;
  weakSkills: WeakSkillOffer[];
  faqIds: string[];
  canAskOpen: boolean;
}

export interface StartedSession {
  sessionId: string;
  socketUrl: string;
  socketExpiresAt: string;
  character: CharacterId;
  companion: CharacterId | null;
  diorama: string;
  backdrop: string;
  locale: string;
  voiceAvailable: boolean;
  microphoneAvailable: boolean;
  microphoneBlockedBy: string | null;
}

// ── Wire messages, inbound ──────────────────────────────────────────────────

export type BudgetState = 'running' | 'wrapping' | 'ended';

export type ServerMessage =
  | {
      type: 'ready';
      sessionId: string;
      character: CharacterId;
      companion: CharacterId | null;
      diorama: string;
      voice: boolean;
      microphone: boolean;
      intelDegraded: boolean;
      locale: string;
    }
  | {
      type: 'turn';
      seq: number;
      say: string;
      emotion: CharacterEmotion;
      action: CharacterAction;
      /** Null on delivery; the voice follows in `turn_audio` (split delivery). */
      audioUrl: string | null;
      /** Whether a `turn_audio` frame for this seq is still coming — false only
       * on a resume redraw, which sends none. See `TutorTurnState.audioPending`
       * in `useTutorSocket.ts` for why the client needs this distinction. */
      audioPending: boolean;
      next: 'ask' | 'segment' | 'close';
      /** v3: per-strategy thinking time before any gentle nudge. */
      policy?: { idleNudgeMs: number; listenSilenceMs: number };
      /** v3: demonstration steps the tutor performs on the open money tray. */
      demonstrate?: TrayDemoStep[];
      /** V4: the lesson thread — child-facing topic + step N of M. Absent in open chat. */
      lesson?: { topic: string | null; step: number; of: number };
      /**
       * V4: a live whiteboard synced to this turn's story — SERVER-COMPUTED
       * fields included, never redone client-side (/ORACLE.md §20.5). See
       * `TutorWhiteboardWire`, below, for the four shapes.
       */
      whiteboard?: TutorWhiteboardWire;
      /**
       * Class III / S17 (TUTOR_INSTRUMENTS.md §3.4): a pre-authored roleplay
       * scene this turn started, by id — see `tutor/roleplay/scenes.ts`.
       */
      roleplayScene?: string | null;
      /**
       * Class III `point_at` (2026-09-04): which element of `whiteboard`
       * `action: "point"` reaches for, as a plain array index — see
       * `tutor-scene/pointTarget.ts`.
       */
      pointAt?: number | null;
    }
  | {
      type: 'turn_audio';
      seq: number;
      audioUrl: string | null;
      /** Present only when the voice provider returned timing for this clip. */
      wordTimings?: WordTiming[];
    }
  | { type: 'thinking' }
  | {
      /** The conversation so far — sent only when a dropped session resumes. */
      type: 'history';
      turns: { speaker: 'learner' | 'tutor'; text: string; seq: number }[];
    }
  | { type: 'transcript'; text: string }
  | {
      type: 'segment';
      segmentId: string;
      seq: number;
      origin: 'catalog' | 'bank' | 'live';
      segment: Record<string, unknown>;
      scoresXp: boolean;
      framing: string;
    }
  | { type: 'adaptation_offer'; adaptation: Adaptation }
  | { type: 'state'; budget: BudgetState; remainingMs: number; turnCount: number }
  | { type: 'closed'; reason: string }
  | { type: 'error'; code: string; message: string };

/**
 * v3: one closed step of a demonstration (mirrors Oracle's `DemoStepSchema`).
 * Widened to 4 families 2026-09-02 (/TUTOR_INSTRUMENTS.md Sprint 2) — see
 * `trayDemo.ts` for which family reads which fields.
 */
export interface TrayDemoStep {
  kind: 'add' | 'remove' | 'pause' | 'place' | 'assign' | 'pair' | 'move';
  denomination?: number;
  ms?: number;
  item?: string;
  bucket?: string;
  left?: string;
  right?: string;
  value?: number;
}

/**
 * V4's live whiteboard, exactly as it reaches the wire — mirrors Oracle's
 * `WireWhiteboard` (`ws/protocol.ts`). A discriminated union on `kind`, one
 * member per shape (/ORACLE.md §20.5): `sequence`, `compare`, `marked_line`
 * and `categories` — the first bounded slice of "UI generativa acotada"
 * (blueprint §10.4). Every field the model itself sets, plus the ONE thing
 * only the server ever adds per kind (`values` / `difference`+`greater` /
 * each mark's `position`) — the client renders these as given and never
 * redoes the arithmetic, exactly the posture `checkAnswer`'s verdict already
 * takes with a spoken answer.
 *
 * Defined ONCE here rather than duplicated a second time inside
 * `TutorWhiteboard.tsx` — that component imports this type directly. (The
 * hand-mirroring this file's own header comment describes is about NOT
 * depending on `oracle/` across the service boundary; there is no such
 * boundary between this file and a sibling component in the same package.)
 */
export type TutorWhiteboardWire =
  | {
      kind: 'sequence';
      start: number;
      steps: { op: 'add' | 'subtract' | 'multiply_percent'; value: number }[];
      /** What one step represents in time — must match the story's own cadence word. */
      unit: 'day' | 'week' | 'month' | 'year';
      values: number[];
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'compare';
      left: { label: string; value: number };
      right: { label: string; value: number };
      /** SERVER-COMPUTED — never taken from the model's own claim. */
      difference: number;
      greater: 'left' | 'right' | 'tie';
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'marked_line';
      min: number;
      max: number;
      /** `position` (0..1 along the line) is SERVER-COMPUTED from `value`/`min`/`max`. */
      marks: { value: number; label: string; position: number }[];
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'categories';
      categories: { label: string; value: number }[];
      /** SERVER-COMPUTED, one-to-one with `categories` — never taken from the model's own claim. */
      values: number[];
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'tokens';
      /** Piles of identical coins or notes. A pile is identified by its denomination, so it carries no label and adds no moderation surface. */
      groups: { denomination: number; count: number }[];
      /** SERVER-COMPUTED, one per group. */
      subtotals: number[];
      /**
       * SERVER-COMPUTED. The sum of the table is the arithmetic the learner is
       * doing, so the schema gives the model no field to assert it — the same
       * reason `compare` has no model-settable `greater`.
       */
      total: number;
      label: string;
      /** Non-nullable alone among the kinds — a coin with no currency is not money. */
      currency: 'MXN' | 'USD' | 'BRL';
    }
  | {
      kind: 'bar_model';
      whole: { label: string; value: number };
      /** Exactly one part may have `value: null` — the unknown the learner reads off the picture. */
      parts: { label: string; value: number | null }[];
      /** SERVER-COMPUTED share of the whole, 0..1, one per part. The unknown's VALUE is deliberately never sent. */
      widths: number[];
      unknownIndex: number | null;
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'part_whole';
      whole: { label: string; value: number };
      left: { label: string; value: number };
      right: { label: string; value: number };
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'flow';
      income: { label: string; value: number };
      spent: { label: string; value: number };
      keptLabel: string;
      /** SERVER-COMPUTED. The third pile is the whole lesson, so the model has no field for it. */
      kept: number;
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'goal_bar';
      goal: { label: string; value: number };
      saved: { label: string; value: number };
      /** SERVER-COMPUTED. What is missing is the question, so the model has no field for it. */
      remaining: number;
      savedFraction: number;
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'worked';
      start: number;
      steps: { op: 'add' | 'subtract'; value: number }[];
      /** SERVER-COMPUTED running values, and the result of UNDOING the last step — the check made literal. */
      values: number[];
      checkValue: number;
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'ten_frame';
      count: number;
      /** SERVER-COMPUTED. The complement to ten deliberately is NOT sent — it is usually the question. */
      frames: number[];
      label: string;
    }
  | {
      kind: 'open_number_line';
      from: number;
      to: number;
      jumps: { value: number }[];
      /** SERVER-COMPUTED. A line whose jumps do not land exactly on `to` is refused outright. */
      stops: number[];
      positions: number[];
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'array';
      rows: number;
      columns: number;
      unitValue: number;
      /** SERVER-COMPUTED. The product is what is being taught, so the model has no field for it. */
      total: number;
      cells: number;
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'fraction_strip';
      rows: { denominator: number; highlighted: number }[];
      /** SERVER-COMPUTED shaded share per row, 0..1. */
      shares: number[];
      label: string;
    }
  | {
      kind: 'partition';
      whole: number;
      splits: { label: string; denominator: number }[];
      /** SERVER-COMPUTED value of ONE piece in each split — the lesson itself. */
      pieceValues: number[];
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'table';
      options: { label: string; price: number; units: number }[];
      /** SERVER-COMPUTED. The cheapest sticker price and the cheapest per unit are often different options. */
      unitPrices: number[];
      bestIndex: number;
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'scale';
      left: { label: string; value: number };
      right: { label: string; value: number };
      /** SERVER-COMPUTED. */
      tilt: 'left' | 'right' | 'level';
      difference: number;
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'two_bins';
      binLabels: [string, string];
      items: { label: string; bin: number }[];
      /** SERVER-COMPUTED. Neither bin may be empty — a sort with one empty side demonstrates nothing. */
      counts: [number, number];
      label: string;
    }
  | {
      kind: 'venn';
      leftLabel: string;
      rightLabel: string;
      items: { label: string; side: 'left' | 'right' | 'both' }[];
      /** SERVER-COMPUTED. The overlap may not be empty — it is the whole instrument. */
      left: number;
      right: number;
      both: number;
      label: string;
    }
  | {
      kind: 'ranking';
      items: { label: string; value: number }[];
      direction: 'asc' | 'desc';
      /** SERVER-COMPUTED order — putting them in order is the thing being practised. */
      order: number[];
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'outcomes';
      good: { label: string; detail: string };
      bad: { label: string; detail: string };
      label: string;
    }
  | {
      kind: 'trade';
      left: { who: string; gives: string; gets: string };
      right: { who: string; gives: string; gets: string };
      label: string;
    }
  | {
      kind: 'chance';
      outcomes: { label: string; weight: number }[];
      /** SERVER-COMPUTED from plain weights — the model never states a percentage. */
      shares: number[];
      label: string;
    }
  | { kind: 'deal'; total: number; bins: string[]; perBin: number; remainder: number; label: string }
  | { kind: 'change'; price: number; paid: number; change: number; label: string; currency: 'MXN' | 'USD' | 'BRL' }
  | {
      kind: 'regroup';
      fromDenomination: number;
      fromCount: number;
      intoDenomination: number;
      intoCount: number;
      label: string;
      currency: 'MXN' | 'USD' | 'BRL';
    }
  | {
      kind: 'equation_bar';
      left: { label: string; value: number }[];
      right: { label: string; value: number }[];
      total: number;
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | { kind: 'receipt'; lines: { label: string; value: number }[]; total: number; label: string; currency: 'MXN' | 'USD' | 'BRL' }
  | {
      kind: 'ledger';
      entries: { label: string; amount: number; direction: 'in' | 'out' }[];
      balances: number[];
      final: number;
      label: string;
      currency: 'MXN' | 'USD' | 'BRL';
    }
  | {
      kind: 'price_tag';
      item: string;
      price: number;
      units: number;
      discountPercent: number | null;
      unitPrice: number;
      finalPrice: number;
      label: string;
      currency: 'MXN' | 'USD' | 'BRL';
    }
  | { kind: 'inventory'; item: string; start: number; sold: number; left: number; label: string }
  | {
      kind: 'budget_plate';
      budget: number;
      items: { label: string; value: number }[];
      spent: number;
      remaining: number;
      /** Over the ceiling, or 0. Overspending is DRAWN rather than refused — that is the lesson. */
      overBy: number;
      label: string;
      currency: 'MXN' | 'USD' | 'BRL';
    }
  | {
      kind: 'pictograph';
      rows: { label: string; count: number }[];
      unitValue: number;
      totals: number[];
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | { kind: 'bead_string'; count: number; rows: number[]; label: string }
  | { kind: 'tally'; groups: { label: string; count: number }[]; fives: [number, number][]; label: string }
  | { kind: 'fraction_circle'; denominator: number; highlighted: number; share: number; label: string }
  | {
      kind: 'stack';
      columns: { label: string; parts: { label: string; value: number }[] }[];
      totals: number[];
      max: number;
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'sequence_compare';
      unit: 'day' | 'week' | 'month' | 'year';
      tracks: [
        { label: string; start: number; steps: { op: string; value: number }[] },
        { label: string; start: number; steps: { op: string; value: number }[] },
      ];
      /** SERVER-COMPUTED, one running-value array per track. Tracks of unequal length are refused. */
      values: number[][];
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      kind: 'timeline';
      unit: 'day' | 'week' | 'month' | 'year';
      span: number;
      events: { label: string; at: number }[];
      positions: number[];
      label: string;
    }
  | { kind: 'cycle'; steps: string[]; label: string }
  | {
      kind: 'before_after';
      what: string;
      before: number;
      after: number;
      /** SERVER-COMPUTED. What changed is the question. */
      delta: number;
      direction: 'up' | 'down' | 'same';
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      /**
       * Class II, S9 (/TUTOR_INSTRUMENTS.md §3.3) — items and bins the
       * LEARNER sorts by tapping, ungraded by construction. Nothing here is
       * SERVER-COMPUTED: no field for which bin an item belongs in, unlike
       * `two_bins`' `items[].bin` — that placement is the learner's own,
       * decided client-side, never sent back or checked.
       */
      kind: 'grab';
      binLabels: string[];
      items: string[];
      label: string;
    }
  | {
      /**
       * Class II, S9 (/TUTOR_INSTRUMENTS.md §3.3) — an empty container the
       * LEARNER taps to fill, ungraded by construction like `grab`. Nothing
       * here is SERVER-COMPUTED: how many are filled is local component
       * state, never sent back.
       */
      kind: 'fill';
      container: 'ten_frame' | 'bar' | 'jar';
      capacity: number;
      label: string;
    }
  | {
      /**
       * Class II, S10 (/TUTOR_INSTRUMENTS.md §3.3) — NOT ungraded, unlike
       * `grab`/`fill`: `values` is SERVER-COMPUTED, one running-value array
       * per branch, `sequence_compare`'s own shape generalised from exactly
       * two tracks to 2-3 branches sharing one `start`. Switching branches
       * client-side is a pure re-render of already-computed data.
       */
      kind: 'whatif';
      start: number;
      unit: 'day' | 'week' | 'month' | 'year';
      branches: { label: string; steps: { op: string; value: number }[] }[];
      values: number[][];
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    }
  | {
      /**
       * Class II, S10 (/TUTOR_INSTRUMENTS.md §3.3) — NOT ungraded: ONE
       * `sequence`, server-computed in a single pass, split at `givenCount`
       * into the tutor's shown prefix and the learner's tap-to-reveal
       * suffix. `values` carries steps.length + 1 entries, same as
       * `sequence`'s own.
       */
      kind: 'your_turn';
      start: number;
      steps: { op: string; value: number }[];
      givenCount: number;
      unit: 'day' | 'week' | 'month' | 'year';
      values: number[];
      label: string;
      currency: 'MXN' | 'USD' | 'BRL' | null;
    };

// ── Wire messages, outbound ─────────────────────────────────────────────────

export type ClientMessage =
  | { type: 'learner_text'; text: string }
  | { type: 'learner_edit'; text: string }
  | { type: 'learner_audio'; audio: string; mimeType: string }
  | { type: 'learner_audio_begin'; mimeType: string }
  | { type: 'learner_audio_chunk'; audio: string }
  | { type: 'learner_audio_commit' }
  | { type: 'interrupt' }
  | {
      type: 'segment_graded';
      segmentId: string;
      score: number;
      correct: boolean;
      /** v3: Core's signed grade receipt, relayed verbatim — see GradeResponse.pedagogy.echo. */
      echo?: string;
      attemptNumber?: number;
    }
  | { type: 'adaptation_response'; adaptation: Adaptation; accepted: boolean }
  | { type: 'end_session' }
  | { type: 'ping' };

// ── Replay ──────────────────────────────────────────────────────────────────

export interface SessionSummary {
  id: string;
  locale: string;
  character: CharacterId;
  companion: CharacterId | null;
  diorama: string;
  intent: TutorIntent;
  startedAt: string;
  endedAt: string | null;
  closeReason: string | null;
  turnCount: number;
  segmentCount: number;
  xpAwarded: number;
}

/**
 * The guardian "what is happening" narrative (/ORACLE.md §12, 2026-09-01) —
 * structured data, not a pre-composed sentence: the CALLER picks the i18n
 * template and grammar for its own locale (/AGENTS.md §1.8 — no user-facing
 * string is ever backend-composed), the same convention `intent` and
 * `closeReason` above already follow. Guardian-view only; the child's own
 * `SessionSummary` reads (`listSessions`) never carry this field.
 */
export interface SessionNarrative {
  /** Localized topic names practiced this session, in the order first attempted (0-2 entries). */
  topics: string[];
  /** A topic that was missed at least once. Null when nothing was ever missed. */
  struggledTopic: string | null;
  /** Whether the last attempt at `struggledTopic` this session was correct. Meaningless when `struggledTopic` is null. */
  struggleResolved: boolean;
  /** Null only while the session has not closed yet. */
  gradedCorrect: number | null;
  gradedTotal: number | null;
}

export interface TranscriptTurn {
  id: string;
  seq: number;
  speaker: 'learner' | 'tutor' | 'system';
  text: string;
  emotion: CharacterEmotion | null;
  action: CharacterAction | null;
  audio_path: string | null;
  source: string;
  created_at: string;
  /**
   * V4's live whiteboard, exactly as it was shown — never recomputed. Null
   * on every row that never drew one, including every row written before
   * this field existed. Found by adversarial review, round 35 (2026-08-30,
   * HIGH): a session that used the whiteboard lost it silently on replay
   * (see `TutorWhiteboardWire`, above, the same shape this mirrors).
   */
  whiteboard: TutorWhiteboardWire | null;
  /**
   * Tutor v3's tray-demonstration steps, exactly as they were shown — never
   * recomputed. Null on every row that never demonstrated, including every
   * row written before migration 0067 added the column. Found while
   * investigating ORACLE.md §19.5's "replaying `demonstrate` animations"
   * backlog item, 2026-09-01 — the identical gap round 35 found for
   * `whiteboard` above, on the tutor's OTHER v3 turn-schema visual field.
   * Reuses `TrayDemoStep` above (the same live-wire shape) rather than a
   * third copy of the same three fields.
   */
  demonstrate: TrayDemoStep[] | null;
  /**
   * Class III / S17 (TUTOR_INSTRUMENTS.md §3.4, migration 0070): the
   * pre-authored roleplay scene id this turn started, when it started one —
   * the identical live-only-field gap `demonstrate` above closes, closed
   * the same way. Null on every row that never started one, including every
   * row written before this column existed. snake_case, unlike its
   * siblings above: this whole interface mirrors backend's `TutorTurnRow`
   * verbatim (see `audio_path`/`created_at` above) rather than a camelCased
   * response shape — `GET /sessions/:id` forwards `listTutorTurns`' rows
   * through unmapped.
   */
  roleplay_scene: string | null;
  /** Class III `point_at` (2026-09-04, migration 0071): the same live-only-field gap, closed identically — snake_case, same reason. */
  point_at: number | null;
}

export interface TranscriptSegment {
  segmentId: string;
  /**
   * This segment's own per-session ordinal (`countSessionSegments` on the
   * backend) — the 1st, 2nd, 3rd... activity served in this session. It is
   * NOT the seq of the turn that requested it; the two are separate counters
   * that only coincide by accident. Use `createdAt`, not this field, to place
   * an activity among the conversation's turns — see `replayScript.ts`.
   */
  seq: number;
  origin: 'catalog' | 'bank' | 'live';
  segment: Record<string, unknown>;
  score: number | null;
  xpAwarded: number;
  createdAt: string;
}

export interface SessionTranscript {
  session: SessionSummary;
  turns: TranscriptTurn[];
  segments: TranscriptSegment[];
}

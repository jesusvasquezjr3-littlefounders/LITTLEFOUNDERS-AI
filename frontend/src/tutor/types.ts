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
  /** Whether Oracle can serve at all right now. */
  canStart: boolean;
  startBlockedBy: string | null;
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
      next: 'ask' | 'segment' | 'close';
    }
  | { type: 'turn_audio'; seq: number; audioUrl: string | null }
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

// ── Wire messages, outbound ─────────────────────────────────────────────────

export type ClientMessage =
  | { type: 'learner_text'; text: string }
  | { type: 'learner_edit'; text: string }
  | { type: 'learner_audio'; audio: string; mimeType: string }
  | { type: 'learner_audio_begin'; mimeType: string }
  | { type: 'learner_audio_chunk'; audio: string }
  | { type: 'learner_audio_commit' }
  | { type: 'interrupt' }
  | { type: 'segment_graded'; segmentId: string; score: number; correct: boolean }
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
}

export interface TranscriptSegment {
  segmentId: string;
  seq: number;
  origin: 'catalog' | 'bank' | 'live';
  segment: Record<string, unknown>;
  score: number | null;
  xpAwarded: number;
}

export interface SessionTranscript {
  session: SessionSummary;
  turns: TranscriptTurn[];
  segments: TranscriptSegment[];
}

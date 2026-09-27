import type { CharacterAction, CharacterEmotion } from '../session/vocabulary';
import type { SessionTranscript, TranscriptSegment, TranscriptTurn, TutorWhiteboardWire } from '../session/types';

/*
 * A saved conversation as a replay (T1e): the lines in the order they
 * happened, each one a beat the stage performs. Pure: no React, no audio, no
 * timer, so "what happened, in what order" is checked in a unit test.
 *
 * What is replayed is what Core kept, and nothing is invented:
 *   - the Mentor's lines, with the emotion, action, voice clip and board they
 *     were delivered with (a turn written before a column existed has it null);
 *   - the learner's lines as text: the learner's voice is never stored;
 *   - a system note (a safety stop, a budget close) as a note, never dropped;
 *   - an activity as the question that was asked and the score it got: the
 *     answer the learner picked is not stored, so none is drawn.
 *
 * Order: the turns by their sequence number (then time, since the learner's
 * turn and the Mentor's reply can share a number), and each activity placed
 * after the last turn written before it was served. A segment's own `seq` is
 * its per-session ordinal, a different counter, so it is never compared with a
 * turn's.
 */

export type ReplayBeat =
  | { kind: 'mentor'; id: string; text: string; emotion: CharacterEmotion; action: CharacterAction; audioUrl: string | null; whiteboard: TutorWhiteboardWire | null }
  | { kind: 'learner'; id: string; text: string }
  | { kind: 'note'; id: string; text: string }
  | { kind: 'activity'; id: string; prompt: string; score: number | null };

const millis = (iso: string | undefined): number => {
  const value = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(value) ? 0 : value;
};

function turnBeat(row: TranscriptTurn): ReplayBeat {
  if (row.speaker === 'tutor') {
    return { kind: 'mentor', id: `turn:${row.id}`, text: row.text, emotion: row.emotion ?? 'neutral', action: row.action ?? 'idle',
      audioUrl: row.audio_path, whiteboard: row.whiteboard };
  }
  return { kind: row.speaker === 'learner' ? 'learner' : 'note', id: `turn:${row.id}`, text: row.text };
}

function promptOf(segment: TranscriptSegment['segment']): string {
  const prompt = segment.prompt_md ?? segment.prompt;
  return typeof prompt === 'string' ? prompt : '';
}

export function replayBeats(transcript: SessionTranscript): ReplayBeat[] {
  const turns = [...transcript.turns].sort((a, b) => a.seq - b.seq || millis(a.created_at) - millis(b.created_at));
  const segments = [...transcript.segments].sort((a, b) => millis(a.createdAt) - millis(b.createdAt));
  const beats: ReplayBeat[] = [];
  let next = 0;
  const flushBefore = (at: number) => {
    while (next < segments.length && millis(segments[next]!.createdAt) < at) {
      const segment = segments[next++]!;
      beats.push({ kind: 'activity', id: `segment:${segment.segmentId}`, prompt: promptOf(segment.segment), score: segment.score });
    }
  };
  for (const turn of turns) {
    flushBefore(millis(turn.created_at));
    beats.push(turnBeat(turn));
  }
  flushBefore(Number.POSITIVE_INFINITY);
  return beats;
}

/** Whether any of the Mentor's lines kept its voice: a replay saved without sound says so once. */
export function replayHasSound(beats: readonly ReplayBeat[]): boolean {
  return beats.some((beat) => beat.kind === 'mentor' && beat.audioUrl !== null);
}

/** How long a beat holds without a clip: reading pace, with a floor, longer when a board is open. */
export function beatHoldMs(beat: ReplayBeat): number {
  const text = beat.kind === 'activity' ? beat.prompt : beat.text;
  const words = text.split(/\s+/u).filter(Boolean).length;
  const read = Math.max(2200, 1200 + words * 320);
  return beat.kind === 'mentor' && beat.whiteboard ? read + 2500 : read;
}

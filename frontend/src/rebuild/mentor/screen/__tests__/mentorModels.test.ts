import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRoleplayScene, roleplayClip, ROLEPLAY_BEATS } from '../../session/roleplay';
import type { SessionTranscript } from '../../session/types';
import { mapSteps, waitsOn } from '../mapModel';
import { mapFixture, transcriptFixture } from '../mentorFixtures';
import { minutesBetween } from '../mentorData';
import { beatHoldMs, replayBeats, replayHasSound } from '../replayModel';
import { useReplay } from '../useReplay';

afterEach(() => { vi.useRealTimers(); });

describe('replayBeats (T1e): what was kept, in the order it happened', () => {
  it('orders the turns and places an activity after the last turn written before it', () => {
    const beats = replayBeats(transcriptFixture('en-US'));
    expect(beats.map((beat) => beat.kind)).toEqual(['mentor', 'learner', 'mentor', 'activity', 'learner']);
    expect(beats[3]).toMatchObject({ kind: 'activity', prompt: 'How much is still to save?', score: 100 });
    expect(beats[2]).toMatchObject({ kind: 'mentor', emotion: 'encouraging', action: 'point' });
  });

  it('keeps a shared sequence number in time order, and a segment ordinal never competes with a turn number', () => {
    const base = transcriptFixture('en-US');
    const transcript: SessionTranscript = {
      ...base,
      turns: [
        { ...base.turns[2]!, id: 'b', seq: 2, speaker: 'tutor', created_at: '2026-09-24T16:02:30Z' },
        { ...base.turns[1]!, id: 'a', seq: 2, speaker: 'learner', created_at: '2026-09-24T16:02:00Z' },
        { ...base.turns[0]!, id: 'z', seq: 1, created_at: '2026-09-24T16:00:00Z' },
      ],
      segments: [{ ...base.segments[0]!, seq: 1, createdAt: '2026-09-24T16:05:00Z' }],
    };
    expect(replayBeats(transcript).map((beat) => beat.id)).toEqual(['turn:z', 'turn:a', 'turn:b', 'segment:seg1']);
  });

  it('keeps a system note, never gives the learner a voice, and knows a talk saved without sound', () => {
    const base = transcriptFixture('en-US');
    const note = { ...base.turns[1]!, id: 'n', seq: 9, speaker: 'system' as const, text: 'Stopped here.', audio_path: 'https://x/n.mp3' };
    const learner = { ...base.turns[1]!, audio_path: 'https://x/l.mp3' };
    const beats = replayBeats({ ...base, turns: [base.turns[0]!, learner, note], segments: [] });
    expect(beats.map((beat) => beat.kind)).toEqual(['mentor', 'learner', 'note']);
    expect(beats.some((beat) => 'audioUrl' in beat && beat.audioUrl)).toBe(false);
    expect(replayHasSound(beats)).toBe(false);
    expect(replayHasSound(replayBeats({ ...base, turns: [{ ...base.turns[0]!, audio_path: 'https://x/a.mp3' }] }))).toBe(true);
  });

  it('holds a line for its reading time, longer with a board', () => {
    const [first, , board] = replayBeats(transcriptFixture('en-US'));
    expect(beatHoldMs(first!)).toBeGreaterThanOrEqual(2200);
    expect(beatHoldMs(board!)).toBeGreaterThan(beatHoldMs({ ...board!, whiteboard: null } as typeof board & object));
  });
});

describe('useReplay: the clock and the transport', () => {
  const beats = replayBeats(transcriptFixture('en-US'));

  it('plays through by itself, then stops at the end', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useReplay(beats));
    expect(result.current).toMatchObject({ index: 0, playing: true, ended: false });
    for (let step = 0; step < 20; step += 1) act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current).toMatchObject({ index: beats.length - 1, playing: false, ended: true });
    act(() => result.current.play());
    expect(result.current).toMatchObject({ index: 0, playing: true, ended: false });
  });

  it('moves on when a clip ends, and holds for reading time when autoplay is blocked', () => {
    vi.useFakeTimers();
    const voiced = replayBeats({ ...transcriptFixture('en-US'), turns: transcriptFixture('en-US').turns.map((row) => ({ ...row, audio_path: row.speaker === 'tutor' ? `https://x/${row.id}.mp3` : null })) });
    const { result } = renderHook(() => useReplay(voiced));
    expect(result.current.speechUrl).toBe('https://x/t1-tutor.mp3');
    act(() => result.current.onSpeechEnd());
    expect(result.current.index).toBe(1);
    act(() => result.current.next());
    expect(result.current.speechUrl).toBe('https://x/t3-tutor.mp3');
    act(() => result.current.onSpeechBlocked(true));
    expect(result.current.speechUrl).toBeNull();
    act(() => result.current.pause());
    act(() => result.current.previous());
    expect(result.current).toMatchObject({ index: 1, playing: false });
    act(() => result.current.restart());
    expect(result.current).toMatchObject({ index: 0, playing: true });
  });

  it('never plays an empty talk', () => {
    const none: never[] = [];
    const { result } = renderHook(() => useReplay(none));
    expect(result.current).toMatchObject({ beat: null, playing: false });
  });
});

describe('mapSteps (T1f)', () => {
  it('puts every prerequisite on an earlier step and names what a closed skill waits on', () => {
    const map = mapFixture('en-US');
    const steps = mapSteps(map);
    expect(steps.map((step) => step.nodes.map((node) => node.kcKey))).toEqual([['count'], ['add', 'save'], ['change'], ['budget']]);
    expect(waitsOn(map, map.nodes.find((node) => node.kcKey === 'budget')!)?.kcKey).toBe('change');
  });

  it('survives a cycle in a bad payload', () => {
    const map = mapFixture('en-US');
    expect(mapSteps({ nodes: map.nodes, edges: [...map.edges, { from: 'budget', to: 'count' }] }).length).toBeGreaterThan(0);
  });
});

describe('roleplay scenes and minutes', () => {
  it('knows only the scenes Oracle may name, and a clip only for a real speaker', () => {
    expect(isRoleplayScene('lemonade_change')).toBe(true);
    expect(isRoleplayScene('toString')).toBe(false);
    expect(ROLEPLAY_BEATS.lemonade_change.map((beat) => beat.speaker)).toEqual(['companion', 'lead', 'companion', 'lead']);
    expect(roleplayClip('lemonade_change', 1, 'dina', 'es-MX')).toMatch(/^https:\/\//);
    expect(roleplayClip('lemonade_change', 1, null, 'es-MX')).toBeNull();
  });

  it('rounds a talk down to whole minutes', () => {
    expect(minutesBetween('2026-09-24T16:00:00Z', '2026-09-24T16:12:59Z')).toBe(12);
    expect(minutesBetween('2026-09-24T16:00:00Z', null)).toBe(0);
  });
});

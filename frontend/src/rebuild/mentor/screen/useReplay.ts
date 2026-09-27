import { useCallback, useEffect, useRef, useState } from 'react';
import { beatHoldMs, type ReplayBeat } from './replayModel';

/*
 * The replay's clock (T1e): which line is on the stage, whether it plays, and
 * the transport the learner drives (play or pause, the previous or next line,
 * from the start). A Mentor line with its voice clip moves on when the clip
 * ends (the stage reports it); a backstop timer keeps a clip that never loads
 * from stranding the replay. A line without a clip holds for its reading time.
 */

export interface ReplayClock {
  index: number;
  beat: ReplayBeat | null;
  playing: boolean;
  ended: boolean;
  /** The clip the stage should play now, or null. */
  speechUrl: string | null;
  /** Changes with every line shown, so the same clip can play twice. */
  audioKey: number;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  restart: () => void;
  onSpeechEnd: () => void;
  onSpeechBlocked: (blocked: boolean) => void;
}

const CLIP_BACKSTOP_MS = 8000;

export function useReplay(beats: readonly ReplayBeat[]): ReplayClock {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(beats.length > 0);
  const [ended, setEnded] = useState(false);
  const [audioKey, setAudioKey] = useState(1);
  const [blocked, setBlocked] = useState(false);
  const count = useRef(beats.length);
  count.current = beats.length;

  const show = useCallback((target: number) => {
    setIndex(Math.max(0, Math.min(target, count.current - 1)));
    setAudioKey((key) => key + 1);
    setBlocked(false);
  }, []);

  const advance = useCallback(() => {
    setIndex((current) => {
      if (current + 1 < count.current) { setAudioKey((key) => key + 1); setBlocked(false); return current + 1; }
      setEnded(true);
      setPlaying(false);
      return current;
    });
  }, []);

  // A new talk (the transcript arrived, or another talk was picked) starts from its first line, playing.
  const loaded = useRef(beats);
  useEffect(() => {
    if (loaded.current === beats) return;
    loaded.current = beats;
    setEnded(false);
    show(0);
    setPlaying(beats.length > 0);
  }, [beats, show]);

  const beat = beats[index] ?? null;
  const clip = beat?.kind === 'mentor' && !blocked ? beat.audioUrl : null;

  useEffect(() => {
    if (!playing || !beat) return undefined;
    const timer = window.setTimeout(advance, clip ? beatHoldMs(beat) + CLIP_BACKSTOP_MS : beatHoldMs(beat));
    return () => window.clearTimeout(timer);
  }, [playing, beat, clip, audioKey, advance]);

  return {
    index, beat, playing, ended,
    speechUrl: playing ? clip : null,
    audioKey,
    play: () => { if (ended) { setEnded(false); show(0); } setPlaying(beats.length > 0); },
    pause: () => setPlaying(false),
    next: () => { if (index + 1 < beats.length) { setEnded(false); show(index + 1); } },
    previous: () => { setEnded(false); show(index - 1); },
    restart: () => { setEnded(false); show(0); setPlaying(beats.length > 0); },
    onSpeechEnd: () => { if (playing) advance(); },
    // A blocked autoplay: the line holds for its reading time instead, captioned.
    onSpeechBlocked: (isBlocked: boolean) => { if (isBlocked) setBlocked(true); },
  };
}

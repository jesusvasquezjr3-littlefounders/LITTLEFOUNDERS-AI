import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale } from '../../design/copyBudget';
import type { MentorCharacter } from '../../design/assets';
import { isRoleplayScene, roleplayClip, ROLEPLAY_BEATS, type RoleplayBeat, type RoleplaySceneId } from '../session/roleplay';

/*
 * A roleplay scene on the stage (Class III `roleplay`): the turn that names a
 * scene introduces it, and once the Mentor has finished saying that line the
 * scene plays beat by beat. The Mentor acts the `lead` lines; the `companion`
 * lines belong to the companion the learner invited to the island, or, when
 * nobody was invited, to an unseen customer whose lines are captioned and
 * silent (the clips exist per character, and there is nobody to speak them).
 * The clips play only in a session that speaks: a text-only session (no voice
 * for this learner) reads the scene, as it reads every other turn.
 * The scene runs to its own end once started; only a NEW turn that names a
 * scene starts another. A clip's end moves the scene on; a ceiling keeps a
 * clip that never loads from stranding it.
 */

export interface RoleplayState {
  scene: RoleplaySceneId;
  index: number;
  beat: RoleplayBeat;
  /** Who speaks this beat: the Mentor, the companion, or nobody on the island (null). */
  speaker: MentorCharacter | null;
  /** How long this beat holds, for the caption's pages. */
  holdMs: number;
}

const CLIP_CEILING_MS = 4000;

export function useRoleplay({ active, scene, turnSeq, waiting, lead, companion, locale, voice, frozen = false }: {
  /** A live conversation is on screen; when it ends, a scene still playing stops. */
  active: boolean;
  /** The scene the current turn names, or null. */
  scene: string | null | undefined;
  turnSeq: number;
  /** The Mentor is still saying the line that introduces the scene. */
  waiting: boolean;
  lead: MentorCharacter;
  companion: MentorCharacter | null;
  locale: Locale;
  /** The session speaks (Core allowed voice for it): only then do the pre-generated clips play. */
  voice: boolean;
  /** Hold the current beat (the development preview and its audits photograph one beat). */
  frozen?: boolean;
}): RoleplayState | null {
  const [running, setRunning] = useState<{ scene: RoleplaySceneId; seq: number } | null>(null);
  const [index, setIndex] = useState(0);
  const started = useRef<number | null>(null);

  useEffect(() => { if (!active) { setRunning(null); started.current = null; } }, [active]);
  useEffect(() => {
    if (!active || !isRoleplayScene(scene) || waiting || started.current === turnSeq) return;
    started.current = turnSeq;
    setRunning({ scene, seq: turnSeq });
    setIndex(0);
  }, [active, scene, turnSeq, waiting]);

  const beats = running ? ROLEPLAY_BEATS[running.scene] : null;
  const beat = beats?.[index] ?? null;
  const speaker = beat ? (beat.speaker === 'lead' ? lead : companion && companion !== lead ? companion : null) : null;
  const clip = running && beat && voice ? roleplayClip(running.scene, index, speaker, locale) : null;
  const holdMs = beat ? beat.durationMs + (clip ? CLIP_CEILING_MS : 0) : 0;

  const advance = useCallback(() => {
    setIndex((current) => {
      if (beats && current + 1 < beats.length) return current + 1;
      setRunning(null);
      return 0;
    });
  }, [beats]);

  useEffect(() => {
    if (!running || !beat || frozen) return undefined;
    let audio: HTMLAudioElement | null = null;
    if (clip && typeof Audio !== 'undefined') {
      audio = new Audio(clip);
      audio.onended = advance;
      try { void (audio.play() as Promise<void> | undefined)?.catch?.(() => undefined); } catch { /* the caption carries the line */ }
    }
    const timer = window.setTimeout(advance, holdMs);
    return () => {
      window.clearTimeout(timer);
      if (audio) { audio.onended = null; audio.pause(); audio.removeAttribute('src'); }
    };
  }, [running, index, clip, holdMs, advance, beat, frozen]);

  return running && beat ? { scene: running.scene, index, beat, speaker, holdMs } : null;
}

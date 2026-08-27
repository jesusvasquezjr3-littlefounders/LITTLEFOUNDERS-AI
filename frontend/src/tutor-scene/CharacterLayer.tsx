import {
  Suspense,
  createContext,
  lazy,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import CharacterActor from '@/components/characters/control/CharacterActor';
import type { CharacterAction, CharacterEmotion, CharacterId } from '@/components/characters/control/types';

/*
 * ONE CANVAS FOR A WHOLE SCREEN OF CHARACTERS.
 *
 * The Lesson Engine draws characters everywhere: the narrator beside a prompt,
 * a speaker on a story card, the cast standing together at the open and again
 * at the results, and one avatar per line of a dialogue transcript that GROWS
 * as the learner reveals it. A canvas per character would be ten WebGL contexts
 * on one screen — browsers cap contexts somewhere around sixteen and silently
 * drop the oldest, and every context carries its own renderer, its own frame
 * loop and its own copy of the quality governor.
 *
 * So there is exactly one, and each character is drawn into the screen
 * rectangle of its own DOM placeholder, with its own camera, through the
 * renderer's scissor. Ten avatars cost ten DRAWS rather than ten CONTEXTS.
 * This is what §6 decision 1 of GOAL_3D_CHARACTERS.md meant by "one persistent
 * canvas"; `CharacterStage` answered it for one character at a time and this
 * answers it for a screen.
 *
 * THIS FILE HOLDS NO 3D. The registry, the context and the placeholder are
 * plain React, and the canvas is loaded lazily from `CharacterLayerCanvas`, so
 * opening a lesson does not pull the renderer into the lesson's own chunk
 * before it is needed (TUTOR_3D.md §6: `three` only ever behind a lazy import).
 *
 * WHILE THE CANVAS IS LOADING, THE 2D CHARACTER STANDS IN. A lesson never shows
 * a hole where a character should be, and the 2D control surface stays a live,
 * exercised path rather than a set of files nobody renders.
 */

export interface CharacterSlotSpec {
  character: CharacterId;
  emotion?: CharacterEmotion;
  action?: CharacterAction;
  actionKey?: number;
  /** How much of the slot's rectangle the character fills, 0..1. */
  fill?: number;
  /*
   * Frame a FIXED world height instead of the character's own, with the feet on
   * the bottom edge.
   *
   * `fill` alone normalises everyone to the same size, which is right for a
   * lone avatar and wrong for a row: Dina is 1.9 m and Zara 1.61, and a cast
   * portrait where they come out identical throws that away. Slots that share a
   * stage height AND a pixel height share a scale, so the cast stands at its
   * true relative sizes on a common baseline.
   */
  stageHeightM?: number;
  /*
   * How much of the character the frame holds.
   *
   * `full` is the whole figure. `bust` is head and shoulders, and it exists
   * because our characters are framed head to toe while Duolingo's read as
   * present at the same pixel size: at a 96 px avatar a full-body crop leaves a
   * 25 px face, which is a smudge with a colour. The same box holding a bust
   * reads as a character looking at you. Presence is mostly FRAMING, and only
   * then size.
   */
  crop?: 'full' | 'bust';
  /** The character is talking right now — see `applySpeaking`. */
  speaking?: boolean;
}

export interface Slot extends CharacterSlotSpec {
  key: string;
  element: HTMLElement;
}

interface Registry {
  register: (key: string, slot: Slot) => void;
  release: (key: string) => void;
  /** False until the 3D layer is mounted and drawing. */
  drawing: boolean;
}

const LayerContext = createContext<Registry | null>(null);

const LayerCanvas = lazy(() =>
  import('./CharacterLayerCanvas').then((module) => ({ default: module.CharacterLayerCanvas })),
);

export function CharacterLayerProvider({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  /*
   * Slots live in a ref AND in state, and both are load-bearing.
   *
   * The scissor loop reads the ref every frame, so a slot that moves — a
   * scroll, a reflow, a sheet opening — is followed without a React pass. The
   * state copy exists so the canvas mounts a subtree per character; reading
   * state in the frame loop would lag a frame behind, and reading the ref in
   * render would never re-render at all.
   */
  const slotsRef = useRef(new Map<string, Slot>());
  const [version, setVersion] = useState(0);
  const [drawing, setDrawing] = useState(false);

  const register = useCallback((key: string, slot: Slot) => {
    const existing = slotsRef.current.get(key);
    slotsRef.current.set(key, slot);
    // Only a change of CAST needs a re-render. A moved rectangle does not,
    // because the rectangle is read from the DOM every frame.
    if (
      !existing ||
      existing.character !== slot.character ||
      existing.emotion !== slot.emotion ||
      existing.action !== slot.action ||
      existing.actionKey !== slot.actionKey ||
      existing.fill !== slot.fill ||
      existing.stageHeightM !== slot.stageHeightM ||
      existing.crop !== slot.crop ||
      existing.speaking !== slot.speaking
    ) {
      setVersion((n) => n + 1);
    }
  }, []);

  const release = useCallback((key: string) => {
    slotsRef.current.delete(key);
    setVersion((n) => n + 1);
  }, []);

  const registry = useMemo<Registry>(() => ({ register, release, drawing }), [register, release, drawing]);
  const slots = useMemo(() => [...slotsRef.current.values()], [version]);

  return (
    <LayerContext.Provider value={registry}>
      {children}
      <div className={cn('pointer-events-none fixed inset-0', className)} aria-hidden="true" data-character-layer="">
        <Suspense fallback={null}>
          <LayerCanvas slots={slots} slotsRef={slotsRef} onDrawing={setDrawing} />
        </Suspense>
      </div>
    </LayerContext.Provider>
  );
}

/**
 * A placeholder in the page that a character is drawn into.
 *
 * It renders an ordinary div and takes part in normal layout, which is the
 * whole point: a character occupies space the way an image would, and the 3D
 * layer follows whatever the page decides. Nothing about the character's
 * position lives in 3D.
 */
export function CharacterSlot({
  character,
  emotion,
  action,
  actionKey,
  fill,
  stageHeightM,
  crop,
  speaking,
  className,
}: CharacterSlotSpec & { className?: string }) {
  const registry = useContext(LayerContext);
  const key = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!registry || !element) return;
    registry.register(key, { key, element, character, emotion, action, actionKey, fill, stageHeightM, crop, speaking });
    return () => registry.release(key);
  }, [registry, key, character, emotion, action, actionKey, fill, stageHeightM, crop, speaking]);

  /*
   * Outside a provider, or before the canvas is drawing, this IS the 2D
   * character. Rendering nothing would leave a hole in a lesson every time the
   * chunk was cold, and a hole reads as a broken build rather than as a slow
   * one.
   */
  const stillFlat = !registry || !registry.drawing;

  return (
    <div ref={ref} className={className} data-character={character} data-render={stillFlat ? '2d' : '3d'} aria-hidden="true">
      {stillFlat ? (
        <CharacterActor
          character={character}
          emotion={emotion}
          action={action}
          actionKey={actionKey}
          speaking={speaking}
          size="fill"
        />
      ) : null}
    </div>
  );
}

/** Whether a `CharacterLayerProvider` is above this point in the tree. */
export function useHasCharacterLayer(): boolean {
  return useContext(LayerContext) !== null;
}

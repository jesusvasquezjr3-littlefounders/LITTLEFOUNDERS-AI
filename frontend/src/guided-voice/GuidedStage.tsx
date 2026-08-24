import type { ReactNode } from 'react';
import { Icon, ProgressBar } from '@/components/ui';
import { CharacterActor } from '@/components/characters/control/CharacterActor';
import type { CharacterId } from '@/components/characters/control/types';
import type { GuidedVoice } from './useGuidedVoice';

/*
 * The shared stage for the two guided flows — onboarding and placement.
 *
 * THE BRIEF WAS MINIMALISM, AND MINIMALISM IS NOT EMPTINESS. There are exactly
 * four things on this screen and nothing else: who is talking, what they are
 * saying, the one thing being asked for, and the way back. No cards stacked on
 * cards, no decorative panels, no second call to action competing with the
 * first. Everything removed was removed because it was pulling attention away
 * from the sentence the learner is supposed to be reading.
 *
 * DESKTOP IS NOT A STRETCHED PHONE (/AGENTS.md §1.11). Below 1024px the
 * character sits above the question in one column. At and above it the layout
 * splits: the character takes the left half at conversation scale — big enough
 * to read an expression, which is the entire reason they are there — and the
 * question takes the right. The freed width becomes presence, not margin.
 */

export interface GuidedStageProps {
  character: CharacterId;
  speaking: boolean;
  /** The spoken line, always rendered as text — subtitles are not a fallback here. */
  line: string;
  /** A reaction to what the learner just did. Interpolated, so never voiced. */
  aside?: string | null;
  onReplay: () => void;
  voice: GuidedVoice;
  onBack?: (() => void) | undefined;
  backLabel: string;
  soundOnLabel: string;
  soundOffLabel: string;
  /** Its OWN name: sharing the mute button's label gave two different controls one accessible name. */
  replayLabel: string;
  progress?: { current: number; total: number; label: string } | undefined;
  error?: string | null;
  children: ReactNode;
}

export function GuidedStage({
  character,
  speaking,
  line,
  aside,
  onReplay,
  voice,
  onBack,
  backLabel,
  soundOnLabel,
  soundOffLabel,
  replayLabel,
  progress,
  error,
  children,
}: GuidedStageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-base">
      {/* Controls: back, progress, sound. One thin row, never more. */}
      <div className="container-max mx-auto flex w-full items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
        {onBack ? (
          <button
            type="button"
            aria-label={backLabel}
            onClick={onBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-content-muted transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="arrow_back" />
          </button>
        ) : (
          <div className="h-11 w-11 shrink-0" aria-hidden />
        )}

        {progress ? (
          <ProgressBar value={(progress.current / progress.total) * 100} label={progress.label} className="flex-1" />
        ) : (
          <div className="flex-1" />
        )}

        <button
          type="button"
          aria-label={voice.muted ? soundOnLabel : soundOffLabel}
          aria-pressed={!voice.muted}
          onClick={() => voice.setMuted(!voice.muted)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-content-muted transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name={voice.muted ? 'volume_off' : 'volume_up'} />
        </button>
      </div>

      <main className="flex flex-1 items-center justify-center px-4 pb-10 sm:px-6 lg:px-8">
        {/*
         * The two halves are sized 0.9fr / 1.1fr rather than evenly: the
         * question is what the learner acts on, so it gets the wider half, and
         * the pair reads as one conversation instead of two panels with a hole
         * between them.
         */}
        <div className="grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
            <CharacterActor
              character={character}
              emotion={speaking ? 'happy' : 'neutral'}
              speaking={speaking}
              size="md"
              className="h-44 w-44 lg:h-60 lg:w-60"
            />

            {/*
             * The line and the way to hear it again are ONE control, not a
             * paragraph with an orphaned icon floating beside it. Tapping the
             * subtitle replays it — which on the first screen is also the
             * gesture that grants the page permission to make noise at all.
             */}
            <button
              type="button"
              onClick={onReplay}
              disabled={voice.muted}
              aria-label={replayLabel}
              className="group flex w-full items-start gap-2.5 rounded-2xl bg-surface-sunken px-4 py-3 text-left transition-colors duration-150 enabled:hover:bg-surface-sunken/70 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon
                name={speaking ? 'graphic_eq' : 'replay'}
                className="mt-0.5 !text-[18px] shrink-0 text-content-subtle transition-colors duration-150 group-enabled:group-hover:text-primary"
                aria-hidden
              />
              <span className="lf-body flex-1 text-content lg:text-lg lg:leading-relaxed">{line}</span>
            </button>

            {aside && (
              <p aria-live="polite" className="lf-caption text-center text-primary">
                {aside}
              </p>
            )}
          </div>

          {/* The one thing being asked for. */}
          <div className="mx-auto w-full max-w-md lg:max-w-lg">
            {error && (
              <p role="alert" className="lf-caption mb-4 text-error-strong">
                {error}
              </p>
            )}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

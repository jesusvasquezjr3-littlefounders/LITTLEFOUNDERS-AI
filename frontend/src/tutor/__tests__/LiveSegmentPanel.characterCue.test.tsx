import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LiveSegmentPanel } from '../LiveSegmentPanel';
import type { LiveSegmentState } from '../useTutorSocket';

/*
 * THE ACTUAL TUTOR MOUNT TREE (tutor-review-sweep-92, HIGH,
 * LESSON_ENGINE.md §9.1).
 *
 * `LiveSegmentPanel.test.tsx` mocks `@/lesson-engine/registry` with a
 * minimal test-only entry — correctly, since that suite is about the panel's
 * OWN staleness guard, not about any of the 57 shared exercise components.
 * This file does the opposite on purpose: it imports the REAL registry, so
 * `story_dialogue` resolves to the REAL `StoryDialogue` renderer
 * (`families/story/components.tsx`), rendered inside the REAL
 * `LiveSegmentPanel` — with no `CharacterLayerProvider` anywhere above it,
 * exactly as the Tutor's actual route (`StageShell` → `ConversationView` →
 * `LiveSegmentPanel`) never mounts one. `components.test.tsx` already covers
 * the renderer's own cue-firing logic against a minimal `ExerciseProps`
 * object built by hand; what THIS file proves is that the real Tutor
 * component actually WIRES `onCharacterCue` all the way down to it — a claim
 * a component-level test, however thorough, cannot make on its own.
 *
 * Before this round: `LiveSegmentPanel` had no `onCharacterCue` prop at all,
 * so `StoryDialogue` always rendered its own `CharacterActor3D`, which
 * — finding no provider above it — always fell back to the flat 2D rig.
 * `data-render="2d"` was unconditionally present. Confirmed red against the
 * pre-fix source with `git stash` before writing this file green.
 */

function dialogueSegmentState(): LiveSegmentState {
  return {
    segmentId: 'story-1',
    seq: 1,
    origin: 'live',
    segment: {
      id: 'story-1',
      type: 'story_dialogue',
      prompt_md: '',
      difficulty: 1,
      xp: 0,
      payload: {
        lines: [
          { character: 'rho', emotion: 'happy', action: 'wave', text_md: 'Once, a market opened.' },
        ],
      },
    },
    scoresXp: false,
    framing: '',
  };
}

describe('LiveSegmentPanel + the real story_dialogue renderer — the Tutor has no character layer of its own', () => {
  it('never falls back to the flat 2D rig: the host is cued instead', () => {
    const onCharacterCue = vi.fn();
    const { container } = render(
      <LiveSegmentPanel
        live={dialogueSegmentState()}
        token="tok"
        onGraded={vi.fn()}
        onCharacterCue={onCharacterCue}
      />,
    );

    expect(screen.getByText('Once, a market opened.')).toBeInTheDocument();

    // The defect this round closes: NOTHING in the panel's own output carries
    // `[data-character]` — no 2D rig, and no orphaned 3D placeholder either.
    expect(container.querySelector('[data-character]')).toBeNull();
    expect(container.querySelector('[data-render]')).toBeNull();

    // The Tutor's stage (one level further up, `TutorExperience.tsx`) is
    // handed exactly what it needs to portray the speaker on the persistent
    // island: the real 3D model, not a 2D stand-in.
    expect(onCharacterCue).toHaveBeenCalledWith({
      character: 'rho',
      emotion: 'happy',
      action: 'wave',
      actionKey: 0,
      speaking: true,
    });
  });

  it('releases the cue when the panel unmounts (the activity closes)', () => {
    const onCharacterCue = vi.fn();
    const { unmount } = render(
      <LiveSegmentPanel
        live={dialogueSegmentState()}
        token="tok"
        onGraded={vi.fn()}
        onCharacterCue={onCharacterCue}
      />,
    );
    onCharacterCue.mockClear();
    unmount();
    expect(onCharacterCue).toHaveBeenCalledWith(null);
  });

  it('a caller with no `onCharacterCue` gets the ORIGINAL behaviour unchanged (belt-and-suspenders on the seam itself)', () => {
    // Not how the Tutor calls it in production — this pins that the new,
    // optional prop cannot regress a caller that omits it.
    const { container } = render(
      <LiveSegmentPanel live={dialogueSegmentState()} token="tok" onGraded={vi.fn()} />,
    );
    expect(container.querySelector('[data-render="2d"]')).not.toBeNull();
  });
});

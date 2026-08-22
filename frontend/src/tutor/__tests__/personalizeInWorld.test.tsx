import { useEffect } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { castMarks } from '@/tutor-scene/anchors';
import { AnchorProvider } from '@/tutor-scene/ScreenAnchor';
import { SafeAreaProvider, useSafeArea } from '@/tutor-scene/SafeAreaContext';
import { PersonalizeInWorld } from '../PersonalizeInWorld';
import type { PersonalizeLayerProps } from '../stage/StageShell';
import type { TutorCatalog, TutorPreferences } from '../types';

/*
 * What is worth asserting here, and what is not.
 *
 * NOT worth asserting: where a chip lands on screen. That is the projector's
 * job, it happens inside a `useFrame` against a real camera, and jsdom has
 * neither.
 *
 * Worth asserting: that a pick is a WRITE and not a draft. The whole design
 * rests on the island changing under the learner's finger, and the mechanism is
 * that every axis calls `onSave` immediately with the one field it owns. A
 * version of this file that collected a draft and saved on submit would render
 * identically, pass a visual review, and be the rejected form again with chips
 * instead of cards. The distinguishing evidence is the call, so that is what
 * these tests look at.
 *
 * Also worth asserting: that no grid of options stands between the learner and
 * a working island, and that one appears when there is no island to stand in.
 */

beforeAll(() => {
  // Every pick fires a UI cue, and jsdom ships no media pipeline: left alone,
  // `play()` prints a not-implemented stack for each one, which is how a real
  // error in this file would stop being read. The cue itself already swallows
  // its own failures, so nothing under test depends on this.
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
});

const CATALOG: TutorCatalog = {
  characters: ['dina', 'liruf', 'rho', 'zara'],
  dioramas: ['diorama-a', 'diorama-b'],
  backdrops: ['auto', 'dawn', 'day', 'dusk', 'night'],
  adaptations: ['slower_pacing', 'more_examples', 'less_text', 'more_visual', 'repeat_before_advancing'],
  articulates: ['rho', 'zara'],
};

const PREFERENCES: TutorPreferences = {
  character: 'rho',
  companion: null,
  diorama: 'diorama-a',
  backdrop: 'auto',
  nickname: 'Robi',
  adaptations: [],
};

function renderLayer(overrides: Partial<PersonalizeLayerProps> = {}) {
  const onSave = vi.fn();
  const onDone = vi.fn();
  const view = render(
    <SafeAreaProvider>
      <AnchorProvider>
        <PersonalizeInWorld
          phase="personalizing"
          ready
          preferences={PREFERENCES}
          catalog={CATALOG}
          saving={false}
          onSave={onSave}
          onDone={onDone}
          {...overrides}
        />
      </AnchorProvider>
    </SafeAreaProvider>,
  );
  return { ...view, onSave, onDone };
}

/**
 * Opens the panel behind the plate's one quiet chip.
 *
 * Everything that is not "start" is revealed on demand now, because the plate
 * was rejected as a form and then rebuilt as the same form in a corner. A test
 * that reached straight for the nickname field would be asserting against a
 * silhouette the owner has turned down twice.
 */
function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: 'More about me' }));
}

/*
 * Anchored controls are queried WITH hidden elements included, and that is not
 * a workaround.
 *
 * A node registered with the projector is `hidden` and `inert` until it has been
 * given a place to be, because a control placed at 0,0 for one frame is a chip
 * that flashes in the corner of the stage on mount. There is no projector in
 * jsdom, so they stay that way for the whole test — correctly. What these tests
 * are about is which controls EXIST and what they dispatch; that the culling
 * itself works is asserted where it lives, in the `WorldChip` suite.
 */
const worldButton = (name: string | RegExp) => screen.getByRole('button', { name, hidden: true });
const worldButtons = (name: string | RegExp) => screen.getAllByRole('button', { name, hidden: true });

describe('choosing by looking', () => {
  it('puts every candidate on a mark of its own and keeps the middle clear', () => {
    // Four candidates on a five-mark ring: the middle mark is where the
    // placement solver stands the cast, so a chip there would cover a face.
    expect(castMarks(4)).toEqual(['stage.mark.0', 'stage.mark.1', 'stage.mark.3', 'stage.mark.4']);
    expect(castMarks(5)).toHaveLength(5);
    expect(new Set(castMarks(2)).size).toBe(2);
  });

  it('saves the tutor the moment they are chosen, with no draft in between', () => {
    const { onSave } = renderLayer();
    fireEvent.click(worldButton('Talk with Zara Vex'));
    expect(onSave).toHaveBeenCalledWith({ character: 'zara' });
  });

  it('clears a companion who has just been promoted to tutor', () => {
    // The same character twice would mount one loaded model in two places, and
    // `useSceneModel` deliberately does not clone what it loads.
    const { onSave } = renderLayer({ preferences: { ...PREFERENCES, companion: 'dina' } });
    fireEvent.click(worldButton('Talk with Dina'));
    expect(onSave).toHaveBeenCalledWith({ character: 'dina', companion: null });
  });

  it('invites a companion to stay', () => {
    const { onSave } = renderLayer();
    fireEvent.click(worldButton('Ask Liruf to stay'));
    expect(onSave).toHaveBeenCalledWith({ companion: 'liruf' });
  });

  it('sends the companion off from the chip over their head or from the ring', () => {
    const { onSave } = renderLayer({ preferences: { ...PREFERENCES, companion: 'liruf' } });
    // Two ways in, one handler: the chip riding their head is the closest thing
    // to tapping the character, and the ring toggle is the one that survives the
    // camera turning away.
    const paths = worldButtons('Ask Liruf to head off');
    expect(paths).toHaveLength(2);
    for (const path of paths) {
      fireEvent.click(path);
      expect(onSave).toHaveBeenLastCalledWith({ companion: null });
    }
  });

  it('offers the walk to the other island rather than a picture of it', () => {
    const { onSave } = renderLayer();
    // Two islands, one elsewhere to go: exactly one rim pad, not two naming the
    // same place.
    const pads = worldButtons(/^Go to /);
    expect(pads).toHaveLength(1);
    fireEvent.click(pads[0] as HTMLElement);
    expect(onSave).toHaveBeenCalledWith({ diorama: 'diorama-b' });
  });

  it('moves the sun along its arc', () => {
    const { onSave } = renderLayer();
    fireEvent.click(worldButton(/Night/));
    expect(onSave).toHaveBeenCalledWith({ backdrop: 'night' });
  });

  it('gives back the way to follow the theme, because the arc has no stop for it', () => {
    // There are four times of day, so the sun has four places and "match my
    // theme" is not one of them. Choosing the lit stop again is the route back,
    // and the lit chip says so in its own words.
    const { onSave } = renderLayer({ preferences: { ...PREFERENCES, backdrop: 'dusk' } });
    const dusk = worldButton(/Dusk/);
    expect(dusk).toHaveAttribute('aria-pressed', 'true');
    expect(dusk).toHaveTextContent('Choose again to match my theme');
    fireEvent.click(dusk);
    expect(onSave).toHaveBeenCalledWith({ backdrop: 'auto' });
  });
});

describe('the one plate', () => {
  /*
   * THE SILHOUETTE IS THE THING BEING TESTED HERE.
   *
   * Every control on the rejected plate worked. What the owner turned down,
   * twice, was the SHAPE: a labelled field with a hint and an error slot, a
   * heading with a help paragraph, a two-column grid of chips, a saving line
   * and a full-width button — the second time, in a corner. So these assert
   * what is on screen at REST, which is the only thing a silhouette is made of.
   */
  it('rests as one press and one quiet way in, with no form in sight', () => {
    const { container } = renderLayer();

    // No text field, no adaptation chips, no headings: not hidden with CSS,
    // ABSENT, so nothing about the resting shape depends on a stylesheet.
    expect(screen.queryByLabelText('Nickname')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Give me more examples' })).toBeNull();
    expect(container.querySelector('.sm\\:grid-cols-2')).toBeNull();

    const plate = screen.getByRole('complementary', { name: 'About you' });
    // Two controls, in this order: the way in, then the way on.
    const resting = within(plate).getAllByRole('button');
    expect(resting).toHaveLength(2);
    expect(resting[0]).toHaveTextContent('More about me');
    expect(resting[1]).toHaveTextContent("I'm ready");
  });

  it('is one press from starting when nothing needs changing', () => {
    const { onDone } = renderLayer();
    fireEvent.click(screen.getByRole('button', { name: "I'm ready" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reveals the rest on demand, and says so to a screen reader', () => {
    const { container } = renderLayer();
    const toggle = screen.getByRole('button', { name: 'More about me' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    openPanel();

    expect(screen.getByRole('button', { name: 'Done with this' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByLabelText('Nickname')).toBeInTheDocument();
    expect(container.querySelector('.sm\\:grid-cols-2')).not.toBeNull();
  });

  it('keeps the nickname a real input, with the line that says where the name goes', () => {
    // It is the ONLY name-shaped value that ever reaches the model
    // (/ORACLE.md §4.1). A learner who is not told that cannot make an informed
    // choice about what to type, so the helper line is not decoration.
    renderLayer();
    openPanel();
    const field = screen.getByLabelText('Nickname');
    expect(field.tagName).toBe('INPUT');
    expect(screen.getByText(/only name your tutor is ever told/i)).toBeInTheDocument();
  });

  it('turns an adaptation on as a preference, never as a verdict', () => {
    const { onSave } = renderLayer();
    openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Give me more examples' }));
    expect(onSave).toHaveBeenCalledWith({ adaptations: ['more_examples'] });
  });

  it('refuses a nickname that looks like a real name and does not leave', () => {
    const { onSave, onDone } = renderLayer();
    openPanel();
    // A leading punctuation mark is the shape the server rejects too, checked
    // here so the learner is corrected by the field they are typing in rather
    // than by a save that failed somewhere they cannot see.
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: '@robi' } });
    fireEvent.click(screen.getByRole('button', { name: "I'm ready" }));

    expect(onDone).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  /*
   * THE CAMERA HAS TO KNOW THIS THING IS HERE.
   *
   * It is the one large opaque surface on the screen and it had never
   * registered with the safe-area channel at all — the file imported
   * `useAnchorSlot`, `HudPlate` and `WorldChip` and not `useSafeArea` — so the
   * director was composing a frame with a 420 px hole in it that it could not
   * see, and the cast was framed behind the plate rather than beside it.
   */
  it('publishes its own rectangle, so the camera composes around it', () => {
    const measured: string[] = [];
    const view = render(
      <SafeAreaProvider>
        <AnchorProvider>
          <ProbeSafeArea onSlots={(slots) => measured.push(...slots)} />
          <PersonalizeInWorld
            phase="personalizing"
            ready
            preferences={PREFERENCES}
            catalog={CATALOG}
            saving={false}
            onSave={vi.fn()}
            onDone={vi.fn()}
          />
        </AnchorProvider>
      </SafeAreaProvider>,
    );
    expect(measured).toContain('lesson');
    view.unmount();
  });

  /*
   * A FIXED PIXEL WIDTH FOR STRUCTURAL LAYOUT IS WHAT §1.11 RESTRICTS.
   *
   * `md:w-[420px]` does not fit a 440 px window once the 24 px inset is paid
   * for, and a reload at 1280 px never shows it. `LessonPlate` already
   * expresses the same 420 px recipe correctly, and both surfaces take the same
   * corner, so they have to agree.
   */
  it('expresses the plate width as a clamp rather than as 420 flat pixels', () => {
    renderLayer();
    const plate = screen.getByRole('complementary', { name: 'About you' });
    expect(plate.className).toContain('lg:w-[min(420px,calc(100vw-3rem))]');
    expect(plate.className).not.toMatch(/w-\[420px\]/);
  });
});

describe('when the island cannot be shown', () => {
  it('does not stand a grid of options between the learner and a working stage', () => {
    renderLayer();
    // With the stage live and the panel closed, each candidate is offered
    // exactly once: out in the world, over their own head.
    expect(worldButtons('Talk with Dina')).toHaveLength(1);
  });

  /*
   * EVERY CANDIDATE STAYS REACHABLE, WHATEVER THE SCENE MANAGED.
   *
   * The panel used to carry only the OVERFLOW — the characters the ring had no
   * mark for — which quietly assumed every anchored control gets projected.
   * They do not: a candidate the placement solver cannot seat publishes no
   * anchor, a camera move culls whatever leaves the frame, and a device with no
   * WebGL culls all of them at once. Each of those is a choice the learner can
   * no longer make, and this layer has no way to know it happened.
   */
  it('keeps every candidate reachable from the panel, not only the overflow', () => {
    const { onSave } = renderLayer();
    openPanel();
    const plate = screen.getByRole('complementary', { name: 'About you' });

    for (const name of ['Dina', 'Liruf', 'Dr. Rho', 'Zara Vex']) {
      expect(within(plate).getByRole('button', { name: `Talk with ${name}` })).toBeInTheDocument();
    }
    // And it dispatches the same handler the world chip does, rather than being
    // a display-only list that looks like a way out and is not.
    fireEvent.click(within(plate).getByRole('button', { name: 'Talk with Zara Vex' }));
    expect(onSave).toHaveBeenCalledWith({ character: 'zara' });
  });

  it('opens the panel by itself when no frame ever arrives', () => {
    vi.useFakeTimers();
    try {
      renderLayer({ ready: false });
      act(() => {
        vi.advanceTimersByTime(8000);
      });
      /*
       * A device with no WebGL publishes no anchors, so every world chip is
       * culled — correctly, because there is nothing on screen for one to point
       * at. Leaving the panel merely AVAILABLE would give that learner a start
       * button and an empty screen, so it is opened for them.
       */
      const plate = screen.getByRole('complementary', { name: 'About you' });
      expect(within(plate).getByLabelText('Nickname')).toBeInTheDocument();
      expect(within(plate).getByRole('button', { name: 'Talk with Dina' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * Reports which safe-area slots have been measured, once, after mount.
 *
 * The channel is a REF by design — the camera reads it inside `useFrame` and
 * nothing re-renders — so there is no state to assert against. This reads the
 * ref the same way the camera does.
 */
function ProbeSafeArea({ onSlots }: { onSlots: (slots: string[]) => void }) {
  const safeArea = useSafeArea();
  useEffect(() => {
    if (!safeArea) return;
    onSlots([...safeArea.rectsRef.current.keys()]);
  }, [safeArea, onSlots]);
  return null;
}

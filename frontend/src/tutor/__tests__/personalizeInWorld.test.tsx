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

/** jsdom lays nothing out, so a node that has to have a box states its own. */
function stubRect(node: HTMLElement, rect: { left: number; top: number; width: number; height: number }): void {
  node.getBoundingClientRect = () =>
    ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
}

/** Stands in for the microphone dock: one measured plate on the `mic` slot. */
function DockProbe({ rect }: { rect: { left: number; top: number; width: number; height: number } }) {
  const safeArea = useSafeArea();
  const measure = safeArea?.measure('mic');
  return (
    <div
      ref={(node) => {
        if (node) stubRect(node, rect);
        measure?.(node);
      }}
    />
  );
}

function renderLayer(overrides: Partial<PersonalizeLayerProps> = {}) {
  // Resolves `true` by default: `onSave` is `Promise<boolean>` in production
  // (`persistPreferences` in `TutorExperience.tsx`), never a bare `vi.fn()`'s
  // implicit `undefined` — and `undefined` is falsy, so once the five
  // discrete-pick axes started awaiting this return value (sweep 92, MEDIUM),
  // an unresolved default would misreport every ordinary successful pick in
  // this suite as a REJECTED one. Tests that need to exercise a genuine
  // rejection override this explicitly, the same way the nickname's own
  // rejection test already does.
  const onSave = vi.fn().mockResolvedValue(true);
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
  fireEvent.click(screen.getByRole('button', { name: 'Show the list' }));
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

  it('invites a companion to stay, from the row the candidate is already on', () => {
    /*
     * THE INVITE IS NOT IN THE WORLD ANY MORE, and that is a width measurement.
     *
     * Every non-tutor candidate used to carry an add orb beside their plate,
     * which made each row 42 px wider than the name it names. Three of the seven
     * overlaps measured at 375x812 involved one of those orbs, and the last one
     * left at 1280x800 was Dina's invite orb sitting 27x35 px across Dr. Rho's
     * plate, with the two crowns only 48 px apart at that camera distance. What
     * stays out in the world is the gesture /ORACLE.md §10 actually describes —
     * tap somebody who is already standing with you and they leave.
     */
    const { onSave } = renderLayer();
    // Not out in the world at all — ABSENT, so nothing about the row's width
    // depends on a stylesheet.
    expect(screen.queryByRole('button', { name: 'Ask Liruf to stay', hidden: true })).toBeNull();
    openPanel();
    const plate = screen.getByRole('complementary', { name: 'About you' });
    fireEvent.click(within(plate).getByRole('button', { name: 'Ask Liruf to stay' }));
    expect(onSave).toHaveBeenCalledWith({ companion: 'liruf' });
  });

  it('sends the companion off from the one control that rides their own crown', () => {
    const { onSave } = renderLayer({ preferences: { ...PREFERENCES, companion: 'liruf' } });
    /*
     * ONE, not two. There used to be a second chip on `companion.head` saying
     * the same name and dismissing them, while this control already rode the
     * same character's crown a quarter of their height higher — measured at
     * 1280x800 as two "Liruf" plates 63 px apart. "Tap them again and they
     * leave" survives; the copy of it does not.
     */
    const paths = worldButtons('Ask Liruf to head off');
    expect(paths).toHaveLength(1);
    fireEvent.click(paths[0] as HTMLElement);
    expect(onSave).toHaveBeenLastCalledWith({ companion: null });
  });

  it('names each candidate exactly once out in the world', () => {
    /*
     * THE PILE-UP, ASSERTED AWAY AT ITS SOURCE.
     *
     * Six anchored labels for four characters is how the picker measured: a
     * plate on each candidate's crown, plus `lead.head` repeating the tutor's
     * name and `companion.head` repeating the companion's. At 1280x800 that put
     * "Dr. Rho" on screen twice, 67 px apart, and at 375x812 it added two more
     * plates to a band already 55 px tall. One person, one label.
     */
    renderLayer({ preferences: { ...PREFERENCES, companion: 'liruf' } });
    for (const name of ['Dina', 'Liruf', 'Dr. Rho', 'Zara Vex']) {
      expect(worldButtons(`Talk with ${name}`)).toHaveLength(1);
    }
    /*
     * AND THE LABEL IS THE NAME, NOTHING ELSE (2026-08-22).
     *
     * The role used to be a quiet second line on this plate. It went with the
     * material's one-ink rule (/DESIGN.md §Lumen → Type): at the chrome
     * density there is no legible quieter ink to demote a line into, so a line
     * that only works as a whisper is a line to delete. It was also costing a
     * candidate — the two-line plate pushed Liruf's cluster off the right edge
     * of a 375 px frame once the tap floor stopped it shrinking.
     *
     * The role is still SAID: the chosen tutor is `aria-pressed` and wears the
     * selection ring, the companion has the dismiss control beside them, and
     * the panel's list carries every candidate's description in a column that
     * has room for one.
     */
    expect(worldButton('Talk with Dr. Rho')).toHaveTextContent('Dr. Rho');
    expect(worldButton('Talk with Dr. Rho')).not.toHaveTextContent('Your tutor');
    expect(worldButton('Talk with Dr. Rho')).toHaveAttribute('aria-pressed', 'true');
    expect(worldButton('Talk with Liruf')).not.toHaveTextContent('With you');
  });

  it('asks the projector to keep the candidates off each other, rather than authoring a ladder', () => {
    /*
     * THE ONE SEPARATION THIS LAYER CAN GIVE, and it delegates it.
     *
     * Horizontal room belongs to the camera, and at 375x812 it gave the four
     * crowns about 150 px between them for plates 108-197 px wide. Vertical room
     * is available, but HOW MUCH is needed changes every frame: `SHOT_AMBIENT`
     * orbits this phase's shot, so a fixed per-candidate step is right at one
     * bearing and wrong at the next — which is exactly what a 64 px CSS ladder
     * did when it was measured a second time. `stack` asks for the per-frame
     * answer instead; the arithmetic is `culling.ts` → `stackClearance`, where a
     * test can reach it.
     *
     * Asserted through the ROW's classes because there is no projector in jsdom:
     * what this file can prove is that the rows are anchored and carry no
     * hand-rolled offset of their own.
     */
    const { container } = renderLayer();
    const rows = [...container.querySelectorAll<HTMLElement>('.will-change-transform')].filter(
      (node) => node.querySelector('[aria-label^="Talk with"]') !== null,
    );
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.style.paddingBottom).toBe('');
      expect(row.style.transform).toBe('');
    }
  });

  it('leaves a candidate the projector never placed off the screen entirely', () => {
    /*
     * `hidden` ALONE DOES NOTHING TO THIS NODE, and that is a measured defect
     * rather than a theory. `[hidden] { display: none }` is a user-agent rule,
     * so the `flex` this row needs beats it outright: on `/dev/tutor-lab` at
     * 375x812 the plate for a candidate the placement solver had not seated sat
     * at (0, 0, 197, 70) — on top of the way out, fully painted, and `inert`,
     * which is a control a child can see, aim at and press to no effect.
     * `ScreenAnchor` now writes `display` from the same origin as the class.
     */
    const { container } = renderLayer();
    const row = container.querySelector<HTMLElement>('.will-change-transform');
    expect(row).not.toBeNull();
    // The class that defeated `hidden` still exists on this cluster — it moved
    // one node in, onto the box the HUD-occlusion guard owns, and the same trap
    // is waiting there (see `WorldChip` → `setHiddenReally`). That is why BOTH
    // owners write `display` and not only the attribute.
    expect((row?.firstElementChild as HTMLElement | null)?.className).toContain('flex');
    expect(row?.hidden).toBe(true);
    expect(row?.style.display).toBe('none');
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

  it('puts ONE sun in the sky, not a menu of four', () => {
    /*
     * Four labelled stops used to hang across the sky, which on a 375x812 phone
     * was four of the twelve surfaces on this phase, in empty sky, above an
     * island painting 12% of the viewport. One marker says which light is on and
     * moves the sun on when it is pressed.
     */
    renderLayer({ preferences: { ...PREFERENCES, backdrop: 'day' } });
    const sun = worldButtons(/^Move the sun to /);
    expect(sun).toHaveLength(1);
    // It reads as the light that is ON; where it is going is on its own name,
    // so a screen reader hears the outcome before the press.
    expect(sun[0]).toHaveTextContent('Day');
    expect(sun[0]).toHaveAccessibleName('Move the sun to Dusk');
  });

  it('moves the sun on one stop at a time', () => {
    const { onSave } = renderLayer({ preferences: { ...PREFERENCES, backdrop: 'dusk' } });
    fireEvent.click(worldButton(/^Move the sun to /));
    expect(onSave).toHaveBeenCalledWith({ backdrop: 'night' });
  });

  it('carries "follow my theme" round the cycle rather than hiding it in a gesture', () => {
    /*
     * It used to be reachable ONLY by pressing the lit sky chip a second time,
     * explained by a sentence on the row for that same light. That gesture was
     * invisible, needed copy in three locales to be findable at all, and did not
     * exist at 1280 px, where every sky mark is above the frame. It is a stop on
     * the arc now, and a row in the guaranteed list like every other light.
     */
    const { onSave } = renderLayer({ preferences: { ...PREFERENCES, backdrop: 'night' } });
    fireEvent.click(worldButton(/^Move the sun to /));
    expect(onSave).toHaveBeenCalledWith({ backdrop: 'auto' });

    openPanel();
    const plate = screen.getByRole('complementary', { name: 'About you' });
    expect(within(plate).getByRole('button', { name: /My theme/ })).toBeInTheDocument();
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
    expect(resting[0]).toHaveTextContent('Show the list');
    expect(resting[1]).toHaveTextContent("I'm ready");
  });

  it('is one press from starting when nothing needs changing', async () => {
    const { onDone } = renderLayer();
    // `commitNickname` is async even on its early-return path (nothing
    // changed, no `onSave` call needed) — `onDone` fires inside its `.then`,
    // one microtask after the click.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "I'm ready" }));
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  /*
   * Found by adversarial review, round 27 (2026-08-30, LOW): every
   * session-starting control in the sibling `OfferChips` carries
   * `disabled={disabled}` — this button had no busy guard at all. In
   * production `onDone` runs `persistPreferences({})`, which sets `saving`
   * true synchronously before its network call, the same guard shape as
   * `begin()`'s `starting` — so once the real caller reacts to that by
   * passing `saving` back in, a second fast click while it is still true
   * must not fire a second, wholly redundant save.
   */
  it('does not re-fire once a save is already in flight', async () => {
    const { onDone, rerender, onSave } = renderLayer();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "I'm ready" }));
    });
    expect(onDone).toHaveBeenCalledTimes(1);

    // The real caller reacts to the first click by setting `saving` true
    // before `onDone`'s own network call ever resolves.
    rerender(
      <SafeAreaProvider>
        <AnchorProvider>
          <PersonalizeInWorld
            phase="personalizing"
            ready
            preferences={PREFERENCES}
            catalog={CATALOG}
            saving
            onSave={onSave}
            onDone={onDone}
          />
        </AnchorProvider>
      </SafeAreaProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: "I'm ready" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reveals the rest on demand, and says so to a screen reader', () => {
    const { container } = renderLayer();
    const toggle = screen.getByRole('button', { name: 'Show the list' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    openPanel();

    expect(screen.getByRole('button', { name: 'Hide the list' })).toHaveAttribute(
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
   * Found by adversarial review, round 38 (2026-08-30, HIGH). The test
   * above only proves the CLIENT-side format check — the frontend has no
   * access to the learner's `display_name`, so it cannot replicate the
   * backend's real-name check at all. A format-valid nickname like "Ana
   * Vasquez" sails past `NICKNAME_PATTERN` here, `onSave` is called, and
   * the backend correctly rejects it — but `onSave` used to return nothing,
   * so `commitNickname` declared success the instant it was CALLED, not
   * once it actually landed, and the picker closed as if the save had
   * worked while the server had refused it.
   */
  it('does not leave, and shows an error, when the SERVER rejects a format-valid nickname', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    const onDone = vi.fn();
    render(
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
          />
        </AnchorProvider>
      </SafeAreaProvider>,
    );
    openPanel();
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'Ana Vasquez' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "I'm ready" }));
    });

    expect(onSave).toHaveBeenCalledWith({ nickname: 'Ana Vasquez' });
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  /*
   * Sanity check for the fix below: nickname's OWN rejection message stays
   * exactly what it was, distinct from the generic one the five discrete
   * picks now share. If the fix had reused `nicknameRejected` verbatim for
   * every axis, or collapsed both into one state slot, this would either
   * show the wrong sentence or fail to compile.
   */
  it('keeps the nickname its own rejection wording, distinct from every other axis', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    const { onDone } = renderLayer({ onSave });
    openPanel();
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'Ana Vasquez' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "I'm ready" }));
    });

    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent("That nickname didn't work. Try a different one.");
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
   * AND A CANDIDATE'S NAME PLATE HIDES UNDER THE HUD, LIKE EVERY OTHER
   * WORLD-ANCHORED SURFACE ON THE ROUTE.
   *
   * The cluster is deliberately not a `WorldChip` — a candidate needs two
   * controls, choose and invite — so it copies the projector contract by hand.
   * What the copy left out was the OTHER half of /DESIGN.md's arbitration rule:
   * a world surface painted over by fixed chrome hides. Measured on
   * `/dev/tutor-lab` at 375x812 with this panel OPEN and the ambient orbit
   * stopped: the microphone dock rises to clear the panel and lands at
   * (15, 223, 345, 156), and three name plates — Dina (101, 291), Zara Vex
   * (215, 285), Dr. Rho (8, 208) — sat underneath it, clipped, still pressable
   * and still in the tab order, while the island chip and the sun beside them
   * hid correctly because those two ARE `WorldChip`s.
   */
  it('hides a candidate the risen microphone dock is painted over', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'Date', 'performance'] });
    try {
      /*
       * No `AnchorProvider` here, deliberately. With one, the projector
       * registers every cluster CULLED — there is no camera in jsdom to place
       * it — and the occlusion guard correctly declines to fight the projector
       * over a node it has already hidden. What is under test is the other
       * case: a cluster the projector has placed, that the HUD then covers.
       */
      const view = render(
        <SafeAreaProvider>
          <DockProbe rect={{ left: 15, top: 223, width: 345, height: 156 }} />
          <PersonalizeInWorld
            phase="personalizing"
            ready
            preferences={PREFERENCES}
            catalog={CATALOG}
            saving={false}
            onSave={vi.fn()}
            onDone={vi.fn()}
          />
        </SafeAreaProvider>,
      );

      // The candidate's cluster: the anchored frame, and the box inside it that
      // the occlusion owns. Two nodes, two owners — the projector writes
      // `hidden` on the frame and must not be fought over it.
      const frames = [...view.container.querySelectorAll<HTMLElement>('.will-change-transform')];
      const cluster = frames.find((node) => node.textContent?.includes('Dr. Rho'));
      expect(cluster).toBeDefined();
      const inner = cluster?.firstElementChild as HTMLElement;
      expect(inner).toBeDefined();

      // Squarely under the risen dock, exactly where the browser put it.
      stubRect(cluster as HTMLElement, { left: 8, top: 208, width: 77, height: 44 });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(inner.hasAttribute('hidden')).toBe(true);
      // The attribute alone loses to the cluster's own `flex` class, which is
      // how this shipped looking fixed and painting anyway.
      expect(inner.style.display).toBe('none');

      // Back into open sky above the dock.
      stubRect(cluster as HTMLElement, { left: 8, top: 100, width: 77, height: 44 });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(inner.hasAttribute('hidden')).toBe(false);
      expect(inner.style.display).toBe('');
      view.unmount();
    } finally {
      vi.useRealTimers();
    }
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

/*
 * THE FIVE AXES WITH NO DRAFT, AND WHAT THEY USED TO DO WITH A REJECTION:
 * NOTHING. `chooseTutor`, `toggleCompanion`, `goToIsland`, `setLight` and
 * `toggleAdaptation` each fired `void onSave(patch)` and threw away the
 * `Promise<boolean>` it returned. `persistPreferences` (`TutorExperience.tsx`)
 * always rolls a rejected patch back to the true prior value, so the ISLAND
 * recovered on its own — but nothing on screen ever told the learner their tap
 * had done nothing, and "I'm ready" was free to be pressed as if it had
 * worked.
 *
 * Found by adversarial review, sweep 92 (2026-08-31, MEDIUM). Every test below
 * fails against the pre-fix code for the same reason: `onSave` resolving
 * `false` produced no `role="alert"` anywhere in the document.
 */
describe('a rejected discrete pick', () => {
  it('reports a rejected tutor pick, from the world', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    renderLayer({ onSave });

    await act(async () => {
      fireEvent.click(worldButton('Talk with Zara Vex'));
    });

    expect(onSave).toHaveBeenCalledWith({ character: 'zara' });
    expect(screen.getByRole('alert')).toHaveTextContent("That didn't save. Try again.");
    // Forced open: this pick was made from a WORLD control with the panel
    // closed, so the alert would otherwise be invisible.
    expect(screen.getByRole('button', { name: 'Hide the list' })).toBeInTheDocument();
  });

  it('reports a rejected companion invite, from the panel list', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    renderLayer({ onSave });
    openPanel();
    const plate = screen.getByRole('complementary', { name: 'About you' });

    await act(async () => {
      fireEvent.click(within(plate).getByRole('button', { name: 'Ask Liruf to stay' }));
    });

    expect(onSave).toHaveBeenCalledWith({ companion: 'liruf' });
    expect(screen.getByRole('alert')).toHaveTextContent("That didn't save. Try again.");
  });

  it('reports a rejected walk to the other island, from the world', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    renderLayer({ onSave });

    await act(async () => {
      fireEvent.click(worldButton(/^Go to /));
    });

    expect(onSave).toHaveBeenCalledWith({ diorama: 'diorama-b' });
    expect(screen.getByRole('alert')).toHaveTextContent("That didn't save. Try again.");
    expect(screen.getByRole('button', { name: 'Hide the list' })).toBeInTheDocument();
  });

  it('reports a rejected light change, from the world', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    renderLayer({ onSave, preferences: { ...PREFERENCES, backdrop: 'dusk' } });

    await act(async () => {
      fireEvent.click(worldButton(/^Move the sun to /));
    });

    expect(onSave).toHaveBeenCalledWith({ backdrop: 'night' });
    expect(screen.getByRole('alert')).toHaveTextContent("That didn't save. Try again.");
    expect(screen.getByRole('button', { name: 'Hide the list' })).toBeInTheDocument();
  });

  it('reports a rejected adaptation toggle, from the panel', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    renderLayer({ onSave });
    openPanel();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Give me more examples' }));
    });

    expect(onSave).toHaveBeenCalledWith({ adaptations: ['more_examples'] });
    expect(screen.getByRole('alert')).toHaveTextContent("That didn't save. Try again.");
  });

  it('does not report anything for a pick the server actually accepted', async () => {
    // The default `renderLayer` mock already resolves `true`; this asserts the
    // negative explicitly so a future change to that default cannot silently
    // make every test in this file pass for the wrong reason.
    const { onSave } = renderLayer();

    await act(async () => {
      fireEvent.click(worldButton('Talk with Zara Vex'));
    });

    expect(onSave).toHaveBeenCalledWith({ character: 'zara' });
    expect(screen.queryByRole('alert')).toBeNull();
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

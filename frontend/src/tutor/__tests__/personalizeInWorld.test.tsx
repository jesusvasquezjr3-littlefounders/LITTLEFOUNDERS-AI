import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PersonalizeInWorld } from '../PersonalizeInWorld';
import type { PersonalizeLayerProps } from '../stage/StageShell';
import type { TutorCatalog, TutorPreferences } from '../types';

/*
 * THE CONFIGURATION DIALOG (rewritten 2026-09-06 with the layer itself).
 *
 * This file used to assert the IN-WORLD shape: a chip on every candidate's
 * crown, a sun riding an arc, rim pads for the island, one plate in the corner.
 * That shape is gone by owner decision — the Stitch study's centred dialog
 * replaced it — so tests naming those things are not regressions to fix, they
 * are assertions about a screen that no longer exists.
 *
 * WHAT SURVIVED, because it was never about the shape:
 *
 *  - A pick is a WRITE, not a draft. The whole design rests on the island
 *    changing under the learner's finger, and the mechanism is that every axis
 *    calls `onSave` immediately with the one field it owns. A version that
 *    collected a draft and saved on submit would render identically and pass a
 *    visual review. The distinguishing evidence is the call.
 *  - A rejected save is SAID. `persistPreferences` rolls the value back
 *    silently, so a picker that swallows a refusal reads as working.
 *  - The nickname keeps its own two rejections — the format one this component
 *    can check, and the server one it cannot.
 *
 * WHAT IS NEW AND HAD TO BE PINNED: `Cancel` actually cancels. The study draws
 * Cancel beside Save on a surface that saves every tap, which would be a lie
 * without the snapshot-and-restore this component now does.
 */

beforeAll(() => {
  // Every pick fires a UI cue, and jsdom ships no media pipeline: left alone,
  // `play()` prints a not-implemented stack for each one, which is how a real
  // error in this file would stop being read.
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
});

const CATALOG: TutorCatalog = {
  characters: ['dina', 'liruf', 'rho', 'zara'],
  dioramas: ['diorama-a', 'diorama-b'],
  backdrops: ['auto', 'dawn', 'day', 'dusk', 'night'],
  adaptations: [
    'slower_pacing',
    'more_examples',
    'less_text',
    'more_visual',
    'repeat_before_advancing',
  ],
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

function renderDialog(overrides: Partial<PersonalizeLayerProps> = {}) {
  const onSave = vi.fn<PersonalizeLayerProps['onSave']>().mockResolvedValue(true);
  const onDone = vi.fn();
  const props: PersonalizeLayerProps = {
    preferences: PREFERENCES,
    catalog: CATALOG,
    saving: false,
    ready: true,
    onSave,
    onDone,
    ...overrides,
  };
  const view = render(<PersonalizeInWorld {...props} />);
  return { ...view, onSave, onDone };
}

/**
 * The card for one candidate.
 *
 * Matched on the card's OWN accessible name ("Talk with Dina") rather than on
 * the character's name alone: the invite control beside it is also a button and
 * also carries the name ("Ask Dina to stay"), so a bare `/dina/i` is ambiguous
 * — which is the correct complaint from the query, and the reason both controls
 * have distinct spoken names in the first place.
 */
function tutorCard(name: string | RegExp) {
  return screen.getByRole('button', { name: new RegExp(`talk with ${String(name)}`, 'i') });
}

describe('the configuration dialog', () => {
  it('is a modal dialog with a name, not a panel that happens to float', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Named by its own heading rather than by an invented label, so what a
    // screen reader announces is what the screen says.
    expect(within(dialog).getByRole('heading', { level: 2 })).toHaveTextContent(
      /personalize your experience/i,
    );
  });

  it('shows every axis at once, which is the reason the dialog replaced the island', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    // The four groups, by their own headings — the thing the in-world version
    // could not do and was replaced for.
    for (const heading of [/your tutor/i, /your island/i, /the light/i, /quick interaction/i]) {
      expect(within(dialog).getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    // And every candidate is present, not just the chosen one.
    for (const name of ['dina', 'liruf', 'dr\. rho', 'zara']) {
      expect(tutorCard(name)).toBeInTheDocument();
    }
  });

  it('saves the tutor the moment they are chosen, with no draft in between', async () => {
    const { onSave } = renderDialog();
    fireEvent.click(tutorCard('dina'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ character: 'dina' }));
  });

  it('clears a companion who has just been promoted to tutor', async () => {
    const { onSave } = renderDialog({
      preferences: { ...PREFERENCES, companion: 'dina' },
    });
    fireEvent.click(tutorCard('dina'));
    // One character cannot stand on the island twice: `useSceneModel` hands out
    // one object per character, so the second mount would fight the first.
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ character: 'dina', companion: null }),
    );
  });

  it('invites a companion from a control beside the card, never nested inside it', async () => {
    const { onSave } = renderDialog();
    // A button inside a button is invalid HTML that browsers resolve by dropping
    // one of the two handlers, so the invite is a SIBLING — and it is reachable
    // by its own accessible name.
    fireEvent.click(screen.getByRole('button', { name: /ask dina to stay/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ companion: 'dina' }));
  });

  it('sends a companion off from the same control, flipped', async () => {
    const { onSave } = renderDialog({
      preferences: { ...PREFERENCES, companion: 'dina' },
    });
    fireEvent.click(screen.getByRole('button', { name: /ask dina to head off/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ companion: null }));
  });

  it('walks to the other island as a write, not a preview', async () => {
    const { onSave } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /go to oasis/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ diorama: 'diorama-b' }));
  });

  it('picks a light directly, every hour offered at once', async () => {
    const { onSave } = renderDialog();
    // Five, because `auto` is a stop like any other rather than a hidden gesture.
    for (const light of [/my theme/i, /dawn/i, /^day$/i, /dusk/i, /night/i]) {
      expect(screen.getByRole('button', { name: light })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: /night/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ backdrop: 'night' }));
  });

  it('turns an adaptation on as a preference, never as a verdict', async () => {
    const { onSave } = renderDialog();
    const toggle = screen.getByRole('switch', { name: /give me more examples/i });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ adaptations: ['more_examples'] }));
  });

  it('keeps the nickname a real input, with the line that says where the name goes', () => {
    renderDialog();
    expect(screen.getByRole('textbox', { name: /nickname/i })).toHaveValue('Robi');
    // The only name that ever reaches the model (/ORACLE.md §4.1). A learner not
    // told that cannot make an informed choice about what to type.
    expect(screen.getByText(/only name your tutor is ever told/i)).toBeInTheDocument();
  });

  it('refuses a nickname that cannot be a nickname, and does not leave', async () => {
    const { onSave, onDone } = renderDialog();
    const field = screen.getByRole('textbox', { name: /nickname/i });
    fireEvent.change(field, { target: { value: '!!' } });
    fireEvent.click(screen.getByRole('button', { name: /save and continue/i }));
    await screen.findByText(/letters, numbers, spaces/i);
    expect(onSave).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('does not leave, and says so, when the SERVER rejects a format-valid nickname', async () => {
    // The format check here cannot replicate the backend's real-name rule — it
    // has no access to the learner's `display_name` — so a clean-looking value
    // sails past it and is refused after the call.
    const onSave = vi.fn<PersonalizeLayerProps['onSave']>().mockResolvedValue(false);
    const { onDone } = renderDialog({ onSave });
    fireEvent.change(screen.getByRole('textbox', { name: /nickname/i }), {
      target: { value: 'Ana Vasquez' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save and continue/i }));
    await screen.findByText(/didn't work/i);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('leaves when there is nothing left to fix', async () => {
    const { onDone } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /save and continue/i }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('does not re-fire once a save is already in flight', () => {
    const { onDone } = renderDialog({ saving: true });
    const save = screen.getByRole('button', { name: /save and continue/i });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('a rejected discrete pick', () => {
  it.each([
    ['tutor', () => fireEvent.click(tutorCard('dina'))],
    ['companion', () => fireEvent.click(screen.getByRole('button', { name: /ask dina to stay/i }))],
    ['island', () => fireEvent.click(screen.getByRole('button', { name: /go to oasis/i }))],
    ['light', () => fireEvent.click(screen.getByRole('button', { name: /night/i }))],
    [
      'adaptation',
      () => fireEvent.click(screen.getByRole('switch', { name: /give me more examples/i })),
    ],
  ])('is reported rather than swallowed: %s', async (_axis, pick) => {
    /*
     * `persistPreferences` rolls `preferences` back to the exact prior value the
     * instant the server refuses, so there is no stale state left behind — but
     * the learner was never told the tap did nothing, which made the picker read
     * as working while a save was silently discarded.
     */
    const onSave = vi.fn<PersonalizeLayerProps['onSave']>().mockResolvedValue(false);
    renderDialog({ onSave });
    pick();
    expect(await screen.findByRole('alert')).toHaveTextContent(/didn't save/i);
  });

  it('says nothing for a pick the server actually accepted', async () => {
    const { onSave } = renderDialog();
    fireEvent.click(tutorCard('dina'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('cancelling', () => {
  /*
   * The study draws Cancel beside Save. On a surface that writes every tap that
   * would be a lie unless cancelling actually restores what the learner walked
   * in with — so the dialog snapshots `preferences` on mount and puts every axis
   * back. Three ways out, one behaviour.
   */
  it('restores every axis to what it was when the dialog opened', async () => {
    const { onSave, onDone } = renderDialog();
    fireEvent.click(tutorCard('dina'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ character: 'dina' }));

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith({
        character: 'rho',
        companion: null,
        diorama: 'diorama-a',
        backdrop: 'auto',
        nickname: 'Robi',
        adaptations: [],
      }),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('leaves the same way on Escape, because Escape has always meant undo', async () => {
    const { onSave, onDone } = renderDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ character: 'rho' }));
  });

  it('leaves the same way when the scrim itself is pressed', async () => {
    const { onDone } = renderDialog();
    const scrim = screen.getByRole('presentation');
    // The press must both start AND end on the scrim: a drag that began inside
    // the dialog must never close it.
    fireEvent.mouseDown(scrim);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('does not close on a press that lands inside the dialog', () => {
    const { onDone } = renderDialog();
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onDone).not.toHaveBeenCalled();
  });
});

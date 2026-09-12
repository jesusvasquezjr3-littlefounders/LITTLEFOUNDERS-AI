import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HudDisclosure } from '../HudDisclosure';

/*
 * The disclosure is the primitive the whole HUD redesign rests on: it is what
 * lets a secondary surface exist without being on screen. Four of its rules
 * were learned somewhere else in this codebase and every one of them failed
 * silently where it was learned, so each gets a test here rather than a comment.
 *
 *  1. CLOSED IS THREE WRITES. `[hidden] { display: none }` is a 0-1-0
 *     user-agent rule and any author `flex` beats it. An exercise once laid out
 *     at y=925/986/1047 while reporting `hidden === true`, and a name plate once
 *     sat painted under the dock, inert, and still pressable.
 *  2. THE CHILDREN NEVER UNMOUNT. A remount replays every hosted whiteboard's
 *     grow-in and re-fires its live region, so a panel reopened would
 *     re-announce an activity the learner already read.
 *  3. IT RENDERS IN PLACE WITH NO HOST. A portal whose target is absent renders
 *     NOTHING, silently — this route has already shipped a toggle that flipped
 *     `aria-expanded` while its list appeared nowhere at all.
 *  4. IT IS NOT A MODAL. No scrim, no `aria-modal`, no focus trap: the tutor is
 *     still talking and a child mid-sentence must be able to reach the
 *     microphone.
 */

function Harness({ host, children }: { host?: HTMLElement | null; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <HudDisclosure
      id="session"
      label="Session"
      icon="tune"
      host={host}
      open={open}
      onOpenChange={setOpen}
    >
      {children === undefined ? <p>the minutes</p> : children}
    </HudDisclosure>
  );
}

/*
 * Exact name, not a regex: once the panel is open its own close control is
 * "Close Session", and a loose match finds both. That is not a test quirk — it
 * is the accessible-name collision a panel and its trigger will always have.
 */
const trigger = () => screen.getByRole('button', { name: 'Session' });
const panel = () => document.querySelector('section[id^="hud-disclosure-session"]') as HTMLElement;

describe('HudDisclosure', () => {
  it('is a labelled trigger with the panel closed, not a glyph', () => {
    render(<Harness />);

    expect(trigger()).toHaveTextContent('Session');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger().getAttribute('aria-controls')).toBe(panel().id);
  });

  /* RULE 1. All three, because each one alone has been defeated here before. */
  it('closes with hidden, inert AND an inline display, and releases all three', () => {
    render(<Harness />);

    expect(panel().hidden).toBe(true);
    expect(panel().inert).toBe(true);
    expect(panel().style.display).toBe('none');

    fireEvent.click(trigger());

    expect(panel().hidden).toBe(false);
    expect(panel().inert).toBe(false);
    // Released to the empty string, never to a value this component guessed at.
    expect(panel().style.display).toBe('');
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  });

  /* RULE 2. The content is in the document from the first render and survives a
   * full close/open cycle as the SAME node. */
  it('never unmounts its children', () => {
    render(<Harness>{<p data-testid="body">the minutes</p>}</Harness>);

    const first = screen.getByTestId('body');
    expect(first).toBeInTheDocument();

    fireEvent.click(trigger());
    fireEvent.click(trigger());
    fireEvent.click(trigger());

    expect(screen.getByTestId('body')).toBe(first);
  });

  it('moves focus into the panel on open and hands it back on Escape', () => {
    render(<Harness />);
    const scroller = panel().querySelector('[tabindex="0"]') as HTMLElement;

    fireEvent.click(trigger());
    // The scroller, not the panel: a fully locked panel has no focusable
    // descendant, and axe fires `scrollable-region-focusable` without this.
    expect(document.activeElement).toBe(scroller);

    fireEvent.keyDown(panel(), { key: 'Escape' });

    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(trigger());
  });

  /* RULE 4. Stated as absences, because that is how a modal arrives: one
   * helpful attribute at a time. */
  it('is not a modal', () => {
    render(<Harness />);
    fireEvent.click(trigger());

    expect(panel().getAttribute('role')).not.toBe('dialog');
    expect(panel()).not.toHaveAttribute('aria-modal');
    expect(document.body.style.overflow).toBe('');
  });

  /* RULE 3. */
  it('renders the panel in place when it has no host, and into the host when it has one', () => {
    const { unmount } = render(<Harness host={null} />);
    // In place means: a sibling of the trigger, inside the container.
    expect(panel()).toBeInTheDocument();
    expect(panel().parentElement).toBe(trigger().parentElement);
    unmount();

    const host = document.createElement('div');
    host.id = 'dock-above';
    document.body.append(host);
    render(<Harness host={host} />);

    expect(host.contains(panel())).toBe(true);
    host.remove();
  });

  /*
   * A disclosure with nothing in it is not rendered at all — there is no
   * disabled trigger. Tapping "My progress" on a fresh account used to open an
   * empty pane, because the panel component returned null while the chrome
   * around it rendered unconditionally.
   */
  it('does not exist when there is nothing inside it', () => {
    render(<Harness>{null}</Harness>);

    expect(screen.queryByRole('button', { name: 'Session' })).toBeNull();
  });
});

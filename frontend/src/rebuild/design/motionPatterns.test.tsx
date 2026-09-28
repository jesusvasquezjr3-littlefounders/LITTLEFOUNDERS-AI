import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnswerChoice, Button, IconButton, ListRow, ReplyChip } from './controls';
import { noteRouteChange, ORCHESTRATED_MOTION, resetRouteEntriesForTest, SequenceTransition, Stagger, SuccessWipe, Wave } from './motion';

/*
 * The four orchestrated patterns (Frontend Bible 04 §4.1-§4.4; 02 §9.9, rule
 * 14) and the press ring and haptic tick (02 §9.1). CSS decides whether
 * anything travels; these tests pin when each pattern fires, that an
 * unrelated re-render never fires it again, and what reduced motion leaves.
 */

function preferMotion(allowed: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true, writable: true,
    value: (query: string) => ({
      matches: query.includes('no-preference') ? allowed : query.includes('reduce') ? !allowed : false,
      media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
      addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
    }),
  });
}

const vibrate = vi.fn();
beforeEach(() => {
  preferMotion(true);
  resetRouteEntriesForTest();
  vibrate.mockReset();
  Object.defineProperty(navigator, 'vibrate', { configurable: true, writable: true, value: vibrate });
  try { window.localStorage.removeItem('lf_sound_muted'); } catch { /* no storage */ }
});
afterEach(() => { Reflect.deleteProperty(window, 'matchMedia'); Reflect.deleteProperty(navigator, 'vibrate'); });

const badges = (extra = '') => <Stagger entryKey="badges" className={`grid${extra}`}><li>One</li><li>Two</li><li>Three</li></Stagger>;

describe('route entry gates the wave and the stagger (02 rule 14; 04 §4.3, §4.4)', () => {
  it('staggers on entry with min(i, 10) indices, and an unrelated re-render does not re-fire it', () => {
    const { container, rerender } = render(badges());
    const list = container.querySelector('ul')!;
    expect(list).toHaveAttribute('data-stagger', 'enter');
    expect([...list.children].map((item) => (item as HTMLElement).style.getPropertyValue('--lf-motion-index'))).toEqual(['0', '1', '2']);
    rerender(badges(' changed'));
    // Same element, same mark: the CSS animation is not restarted by a re-render.
    expect(container.querySelector('ul')).toBe(list);
    expect(list).toHaveAttribute('data-stagger', 'enter');
  });

  it('does not fire again when the surface remounts on the same route, and fires after a real route change', () => {
    const first = render(badges());
    first.unmount();
    const again = render(badges());
    expect(again.container.querySelector('ul')).toHaveAttribute('data-stagger', 'settled');
    again.unmount();
    act(() => noteRouteChange());
    const next = render(badges());
    expect(next.container.querySelector('ul')).toHaveAttribute('data-stagger', 'enter');
  });

  it('waves the streak strip in reading order', () => {
    const { container } = render(<Wave entryKey="streak" aria-hidden="true"><li /><li /><li /></Wave>);
    const strip = container.querySelector('ol')!;
    expect(strip).toHaveAttribute('data-wave', 'enter');
    expect(strip).toHaveAttribute('aria-hidden', 'true');
    expect((strip.children[2] as HTMLElement).style.getPropertyValue('--lf-motion-index')).toBe('2');
  });
});

describe('success wipe (04 §4.2)', () => {
  it('covers the row with the check and the title, then reports done when the wipe ends', () => {
    const done = vi.fn();
    const { container, rerender } = render(<li><span>Feed the cat</span><SuccessWipe active={false} label="Feed the cat" onDone={done} /></li>);
    expect(container.querySelector('.lf-success-wipe')).toBeNull();
    rerender(<li><span>Feed the cat</span><SuccessWipe active label="Feed the cat" onDone={done} /></li>);
    const panel = container.querySelector('.lf-success-wipe')!;
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(panel.querySelector('svg')).not.toBeNull();
    expect(panel.textContent).toBe('Feed the cat');
    rerender(<li><span>Approved</span><SuccessWipe active label="Feed the cat" onDone={done} /></li>);
    expect(done).not.toHaveBeenCalled();
    fireEvent.animationEnd(panel);
    expect(done).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.lf-success-wipe')).toBeNull();
  });

  it('shows the final state directly with reduced motion', () => {
    preferMotion(false);
    const done = vi.fn();
    const { container } = render(<li><SuccessWipe active label="Feed the cat" onDone={done} /></li>);
    expect(container.querySelector('.lf-success-wipe')).toBeNull();
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('exercise slide (04 §4.1)', () => {
  const card = (text: string) => <main><div className="lf-learning-content"><h1 id="title">{text}</h1><footer>Check</footer></div></main>;

  it('slides the outgoing card out as a hidden, inert clone and the new card in, only when the step changes', () => {
    const { container, rerender } = render(<SequenceTransition step="a">{card('First')}</SequenceTransition>);
    rerender(<SequenceTransition step="a">{card('First again')}</SequenceTransition>);
    expect(container.querySelector('.lf-sequence-leaving')).toBeNull();
    rerender(<SequenceTransition step="b">{card('Second')}</SequenceTransition>);
    const leaving = container.querySelector('.lf-sequence-leaving')!;
    expect(leaving).toHaveAttribute('aria-hidden', 'true');
    expect(leaving).toHaveAttribute('inert');
    expect(leaving.textContent).toContain('First again');
    expect(leaving.querySelector('[id]')).toBeNull();
    expect(container.querySelector('main .lf-learning-content')).toHaveClass('lf-sequence-entering');
    fireEvent.animationEnd(leaving);
    expect(container.querySelector('.lf-sequence-leaving')).toBeNull();
  });

  it('swaps directly with reduced motion', () => {
    preferMotion(false);
    const { container, rerender } = render(<SequenceTransition step="a">{card('First')}</SequenceTransition>);
    rerender(<SequenceTransition step="b">{card('Second')}</SequenceTransition>);
    expect(container.querySelector('.lf-sequence-leaving, .lf-sequence-entering')).toBeNull();
  });
});

describe('press feedback (02 §9.1)', () => {
  it('ripples a ring from the touch point and ticks once on every shared pressable', () => {
    render(<ul>
      <li><Button>Save</Button></li>
      <li><IconButton glyph="close" label="Close" /></li>
      <li><AnswerChoice label="Spend" selected={false} onSelect={() => undefined} /></li>
      <li><ReplyChip onPress={() => undefined}>Yes</ReplyChip></li>
      <ListRow title="Row" onPress={() => undefined} />
    </ul>);
    for (const name of ['Save', 'Close', 'Spend', 'Yes', 'Row']) {
      const control = screen.getByRole('button', { name });
      fireEvent.pointerDown(control, { pointerType: 'touch', clientX: 10, clientY: 10 });
      const ring = control.querySelector('.lf-press-ring')!;
      expect(ring, name).not.toBeNull();
      expect(ring).toHaveAttribute('aria-hidden', 'true');
      expect(ring.textContent).toBe('');
      fireEvent.animationEnd(ring);
      expect(control.querySelector('.lf-press-ring')).toBeNull();
    }
    expect(vibrate).toHaveBeenCalledTimes(5);
    expect(vibrate).toHaveBeenCalledWith(8);
  });

  it('keeps only the colour change with reduced motion, honours the sound and haptics off switch, and ignores a disabled control', () => {
    preferMotion(false);
    const { rerender } = render(<Button>Save</Button>);
    fireEvent.pointerDown(screen.getByRole('button'), { pointerType: 'touch' });
    expect(screen.getByRole('button').querySelector('.lf-press-ring')).toBeNull();
    expect(vibrate).toHaveBeenCalledTimes(1);
    window.localStorage.setItem('lf_sound_muted', '1');
    fireEvent.pointerDown(screen.getByRole('button'), { pointerType: 'touch' });
    expect(vibrate).toHaveBeenCalledTimes(1);
    window.localStorage.removeItem('lf_sound_muted');
    rerender(<Button disabled>Save</Button>);
    fireEvent.pointerDown(screen.getByRole('button'), { pointerType: 'touch' });
    expect(vibrate).toHaveBeenCalledTimes(1);
  });
});

describe('the patterns are budgeted motion, never a celebration (D7, OD-7)', () => {
  const css = readFileSync(resolve(__dirname, 'motion.css'), 'utf8');
  it('defines every pattern inside the no-preference query, on enter, exit or standard easing only', () => {
    const query = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: no-preference)'));
    for (const name of ORCHESTRATED_MOTION.filter((entry) => entry !== 'lf-route-enter')) {
      expect(query, name).toMatch(new RegExp(`@keyframes ${name} `));
      const uses = [...query.matchAll(new RegExp(`animation: ${name} ([^;]+);`, 'g'))].map((match) => match[1]!);
      expect(uses.length, name).toBeGreaterThan(0);
      for (const use of uses) expect(use, name).not.toMatch(/--ease-spring|--dur-celebration/);
    }
    expect(readFileSync(resolve(__dirname, 'shells.css'), 'utf8')).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{\n\s+\.lf-rebuild \.lf-shell-main\[data-route-enter\] \{ animation: lf-route-enter var\(--dur-transition\) var\(--ease-enter\) backwards; \}/);
  });
});

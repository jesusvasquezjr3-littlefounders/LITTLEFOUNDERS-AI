import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BarColumn, BarTrack, BoardRow, Caption, Token, barHeightPct } from '../primitives';

/*
 * WHAT THIS FILE CAN AND CANNOT PROVE, stated up front because getting it
 * wrong is how this surface shipped two invisible defects.
 *
 * jsdom lays NOTHING out. It cannot tell you a bar rendered at zero pixels —
 * that is `verify:tutor-ui`'s real-browser `getBoundingClientRect()` sweep, and
 * nothing here replaces it. What these tests DO lock is the structural contract
 * that makes the real-browser result possible: the bar sits inside a track that
 * carries a definite height down to it, and a model-written caption always
 * carries a hard line ceiling. Those are the two things that, when someone
 * writes the next instrument by hand instead of through a primitive, silently
 * stop being true.
 */

describe('barHeightPct', () => {
  it('scales against the tallest bar on the board', () => {
    expect(barHeightPct(50, 100)).toBe(50);
    expect(barHeightPct(100, 100)).toBe(100);
  });

  it('keeps a genuinely small nonzero bar visible with a floor', () => {
    expect(barHeightPct(1, 1000)).toBe(6);
  });

  it('draws a true zero as nothing — a bar labelled $0 must not have height', () => {
    // Round 107: the floor did not carve out zero, so a bar whose own label
    // read "$0" still drew, contradicting itself on the "spend it down to
    // zero" beat the feature exists to narrate correctly.
    expect(barHeightPct(0, 100)).toBe(0);
  });

  it('treats floating-point noise above zero as zero', () => {
    expect(barHeightPct(1e-12, 100)).toBe(0);
  });

  it('never divides by zero when every value on the board is zero', () => {
    expect(barHeightPct(0, 0)).toBe(0);
  });
});

describe('BarTrack — the zero-pixel defect, made unreachable', () => {
  it('puts the bar inside a track that carries a definite height', () => {
    const { container } = render(<BarTrack heightPct={71} />);
    const track = container.firstElementChild as HTMLElement;
    // `flex-1 min-h-0` is what receives the row's stretched height; `items-end`
    // must live HERE, not on the row, or the column stops stretching and the
    // percentage below has nothing to resolve against.
    expect(track.className).toContain('flex-1');
    expect(track.className).toContain('min-h-0');
    expect(track.className).toContain('items-end');

    const bar = track.firstElementChild as HTMLElement;
    expect(bar).toBeTruthy();
    expect(bar.style.height).toBe('71%');
  });

  it('uses the CONFIGURED accent token, never the arbitrary-value form', () => {
    // `bg-[color:var(--lf-accent)]/70` emitted an invalid color a browser
    // silently discards: the token is a bare "R G B" triple and Tailwind cannot
    // attach an alpha to an opaque var(). The bar was transparent from launch.
    const { container } = render(<BarTrack heightPct={50} />);
    const bar = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(bar.className).toContain('bg-accent/70');
    expect(bar.className).not.toContain('var(--lf-accent)');
  });

  it('draws an ungrown bar at zero height rather than hiding the track', () => {
    const { container } = render(<BarTrack heightPct={80} grown={false} />);
    const bar = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(bar.style.height).toBe('0%');
    expect(bar.className).toContain('opacity-0');
  });
});

describe('Caption — the disappearing-label defect, made unreachable', () => {
  it('always clamps model-written text to a hard line ceiling', () => {
    // `LessonPlate`'s bodyLayout="column" body is overflow-hidden with no
    // scroll, so an unclamped wrap does not truncate — it disappears.
    render(<Caption>Lo que cuesta la playera en la tienda del centro comercial</Caption>);
    const caption = screen.getByText(/Lo que cuesta/);
    expect(caption.className).toContain('line-clamp-2');
    expect(caption.className).toContain('break-words');
  });

  it('is decorative: the accessible name is built from the raw fields, not the DOM', () => {
    render(<Caption>Tienda A</Caption>);
    expect(screen.getByText('Tienda A').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('BoardRow — variants are props, never className overrides', () => {
  it('emits exactly one gap class, so no compiled-CSS ordering decides the winner', () => {
    // `cn` (lib/utils.ts) is a plain joiner with no tailwind-merge: passing
    // `gap-6` to a component that writes `gap-2` leaves BOTH in the attribute
    // and the stylesheet order picks, not the caller.
    const { container: md } = render(<BoardRow>x</BoardRow>);
    const { container: lg } = render(<BoardRow gap="lg">x</BoardRow>);
    const mdClass = (md.firstElementChild as HTMLElement).className;
    const lgClass = (lg.firstElementChild as HTMLElement).className;

    expect(mdClass).toContain('gap-2');
    expect(mdClass).not.toContain('gap-6');
    expect(lgClass).toContain('gap-6');
    expect(lgClass).not.toContain('gap-2');
  });

  it('scrolls sideways rather than crushing columns', () => {
    const { container } = render(<BoardRow>x</BoardRow>);
    expect((container.firstElementChild as HTMLElement).className).toContain('overflow-x-auto');
  });
});

describe('BarColumn', () => {
  it('treats min width as a floor, not a cap', () => {
    const { container } = render(<BarColumn minWidth="4.5rem">x</BarColumn>);
    const column = container.firstElementChild as HTMLElement;
    expect(column.style.minWidth).toBe('4.5rem');
    expect(column.style.maxWidth).toBe('');
    expect(column.className).toContain('flex-1');
  });

  it('accepts an optional cap for a board that only ever has two columns', () => {
    const { container } = render(
      <BarColumn minWidth="5rem" maxWidth="14rem">
        x
      </BarColumn>,
    );
    expect((container.firstElementChild as HTMLElement).style.maxWidth).toBe('14rem');
  });
});

describe('Token — the first non-bar primitive', () => {
  it('is decorative and sized from a bounded scale, never a free number', () => {
    // A token's size carries meaning (a bigger coin looks bigger); an arbitrary
    // size would let a board imply a value ordering the server never verified.
    const { container } = render(<Token size="lg">10</Token>);
    const token = container.firstElementChild as HTMLElement;
    expect(token.getAttribute('aria-hidden')).toBe('true');
    expect(token.className).toContain('rounded-full');
    expect(token.className).toContain('h-14');
  });
});

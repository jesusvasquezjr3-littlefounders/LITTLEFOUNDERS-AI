/**
 * THE BROKEN-GLYPH CHECK MUST MEASURE THE GLYPH.
 *
 * `Icon` swaps in a neutral `help` when the ligature it was handed is not a
 * real Material Symbol, because the font otherwise paints the raw string as
 * giant text. The first version measured `el.scrollWidth` — the width of the
 * ELEMENT, which equals the glyph's width only while the span is
 * shrink-to-fit. `fair_trade` passed `block` so its two offer icons would
 * centre, the span grew to the card's 322 px against a 40 px font, and both
 * `sell` and `toys` — valid glyphs, the two things being traded — rendered as
 * a question mark. Nothing failed; it just showed the wrong picture.
 *
 * jsdom has no layout, so these tests drive the measurement directly: a stub
 * `Range` reports the text run while the element reports a wide box, which is
 * exactly the shape of the defect.
 */

import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Icon } from './Icon';

/** Make `document.createRange()` report a text run of `width` on `lines` lines. */
function stubTextRun(width: number, lines = 1) {
  const real = document.createRange.bind(document);
  vi.spyOn(document, 'createRange').mockImplementation(() => {
    const range = real();
    range.getBoundingClientRect = () => ({ width, height: width * 1.2, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    range.getClientRects = () =>
      ({ length: lines, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
    return range;
  });
}

/** The element is as wide as its container — what `block` inside a card does. */
function stubWideBox(el: HTMLElement, px: number) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: px });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Icon keeps a real glyph whatever the caller does to the box', () => {
  it('a full-width icon span still renders its ligature', async () => {
    stubTextRun(40); // one 40px glyph at a 40px font
    const { container } = render(<Icon name="sell" className="block text-[40px]" />);
    const span = container.querySelector('span') as HTMLElement;
    span.style.fontSize = '40px';
    stubWideBox(span, 322); // the card, not the glyph — the old measurement
    await waitFor(() => expect(span.textContent).toBe('sell'));
  });

  it('an invented icon name is still replaced by the neutral glyph', async () => {
    stubTextRun(268); // "piggy_bank" painted as text at a 40px font
    const { container } = render(<Icon name="piggy_bank" className="text-[40px]" />);
    const span = container.querySelector('span') as HTMLElement;
    span.style.fontSize = '40px';
    await waitFor(() => expect(span.textContent).toBe('help'));
  });

  it('a fallback that wrapped onto two lines is caught by the line count', async () => {
    stubTextRun(40, 2); // narrow container: the word wrapped rather than grew
    const { container } = render(<Icon name="lemonade_stand_sign" className="text-[40px]" />);
    const span = container.querySelector('span') as HTMLElement;
    span.style.fontSize = '40px';
    await waitFor(() => expect(span.textContent).toBe('help'));
  });

  it('renders the name it was given before anything has been measured', () => {
    render(<Icon name="savings" />);
    expect(screen.getByText('savings')).toBeTruthy();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { detentHeights, LessonPlate } from '../LessonPlate';

/*
 * Found by adversarial review, round 88 (2026-08-31, HIGH). `detentHeights()`
 * decides how tall the mobile lesson sheet is at PEEK/HALF/FULL from
 * `window.innerHeight` alone — and `DESKTOP_QUERY` (the media query that
 * decides whether this is a sheet at all) is WIDTH-only, so any phone turned
 * sideways stays in sheet mode with a viewport far shorter than the 375x812
 * portrait phone every other gate in this codebase measures against.
 *
 * Pre-fix, on an iPhone SE in landscape (`innerHeight` 375) the flat 300px
 * `STAGE_RESERVE_PX` left a ceiling of `max(88, 375 - 300) = 88` — so HALF and
 * FULL both clamped down to the SAME 88px as PEEK. A graded activity arriving
 * flips `resting` from true to false (un-hiding the sheet's body), but the
 * sheet itself never actually grew, so the exercise rendered entirely below
 * the fold of the sheet's own `overflow-hidden` wrapper: reachable, focusable,
 * and invisible. Ordinary device rotation, no orientation lock anywhere in the
 * app, no recovery.
 *
 * These tests exercise `detentHeights()` directly rather than only through a
 * full render, for the same reason `nearestDetent` is already a standalone
 * exported function: it is pure arithmetic over `window.innerHeight`, and the
 * claim being tested ("three real detents, not one collapsed sliver") is a
 * property of that arithmetic, not of anything the DOM adds on top of it.
 */

describe('detentHeights, the mobile sheet arithmetic', () => {
  function setViewportHeight(height: number) {
    window.innerHeight = height;
  }

  describe('the exact regression: a phone in landscape', () => {
    it('no longer collapses PEEK/HALF/FULL to the same value on an iPhone SE in landscape (innerHeight 375)', () => {
      setViewportHeight(375);
      const heights = detentHeights();

      expect(heights.peek).toBe(88);
      // Pre-fix this was 88, 88, 88 — the exact defect the review found.
      expect(heights.half).not.toBe(heights.peek);
      expect(heights.full).not.toBe(heights.half);
      expect(heights.full).not.toBe(heights.peek);
    });

    it('gives HALF and FULL a real, usable minimum on an iPhone SE in landscape (375) — enough to physically fit a prompt, its answers and Check', () => {
      setViewportHeight(375);
      const heights = detentHeights();

      // A sheet "bigger than PEEK" is not the bar — a sheet an activity can
      // actually be laid out inside is. 220px is the floor the review itself
      // measured against (prompt + options + Check).
      expect(heights.half).toBeGreaterThanOrEqual(220);
      expect(heights.full).toBeGreaterThanOrEqual(220);

      // And each step has to show a REAL chunk more content — not a few
      // clipped pixels that technically differ.
      expect(heights.half - heights.peek).toBeGreaterThanOrEqual(80);
      expect(heights.full - heights.half).toBeGreaterThanOrEqual(80);
    });

    it('holds on the taller landscape phone too (iPhone 14 Pro Max, innerHeight 430)', () => {
      setViewportHeight(430);
      const heights = detentHeights();

      expect(heights.peek).toBe(88);
      expect(heights.half).not.toBe(heights.peek);
      expect(heights.full).not.toBe(heights.half);

      expect(heights.half).toBeGreaterThanOrEqual(220);
      expect(heights.full).toBeGreaterThanOrEqual(220);
      expect(heights.half - heights.peek).toBeGreaterThanOrEqual(80);
      expect(heights.full - heights.half).toBeGreaterThanOrEqual(80);
    });
  });

  describe('unchanged where it was already correct: portrait phones and desktop-height viewports', () => {
    it('reproduces the EXACT numbers this file already documents at 375x812, the verify-tutor-ui mobile gate', () => {
      setViewportHeight(812);
      // These are not new: `STAGE_RESERVE_PX`'s own comment states FULL lands
      // "about 63vh" on this exact phone (512 / 812 = 63.05%), and HALF is the
      // un-clamped /DESIGN.md fraction (round(812 * 0.45)). Asserted exactly,
      // byte for byte, so a future change to the short-viewport branch cannot
      // quietly nudge the portrait case without this test noticing.
      expect(detentHeights()).toEqual({ peek: 88, half: 365, full: 512 });
    });

    it('reproduces the same numbers at 1280x900, the verify-tutor-ui desktop-height gate', () => {
      setViewportHeight(900);
      expect(detentHeights()).toEqual({ peek: 88, half: 405, full: 600 });
    });
  });

  it('keeps PEEK strictly below HALF strictly below FULL across every realistic device height, not only the four measured above', () => {
    // 350 is below the shortest phone this product targets in landscape
    // (iPhone SE, 375) and 1400 is comfortably above the tallest desktop-mode
    // viewport height in use; the point is that the guarantee is structural
    // rather than tuned to land only on the handful of named checkpoints.
    for (let height = 350; height <= 1400; height += 5) {
      setViewportHeight(height);
      const heights = detentHeights();
      expect(heights.peek, `peek < half failed at innerHeight=${height}`).toBeLessThan(heights.half);
      expect(heights.half, `half < full failed at innerHeight=${height}`).toBeLessThan(heights.full);
    }
  });
});

describe('LessonPlate renders the fixed arithmetic, not only computes it', () => {
  const LABEL = 'Your tutor and your activity';
  const RESIZE_LABEL = 'Resize this panel';

  function renderAt(detent: 'peek' | 'half' | 'full') {
    return render(
      <LessonPlate label={LABEL} resizeLabel={RESIZE_LABEL} detent={detent} onDetentChange={() => {}}>
        <div>Exercise content</div>
      </LessonPlate>,
    );
  }

  /*
   * No `matchMedia` stub here on purpose: this suite never stubs it to
   * desktop, so `useDesktopPlate` reads `window.matchMedia?.(...)` against an
   * unimplemented jsdom global and falls back to `false` — the same default
   * every mobile-path test elsewhere in `conversationView.test.tsx` already
   * relies on. That keeps this a genuine phone-in-landscape render.
   */
  it('gives FULL a visibly taller sheet than PEEK on an iPhone SE in landscape (innerHeight 375)', () => {
    window.innerHeight = 375;
    const { rerender } = renderAt('peek');
    const plate = () => screen.getByLabelText(LABEL);
    expect(plate().style.height).toBe('88px');

    rerender(
      <LessonPlate label={LABEL} resizeLabel={RESIZE_LABEL} detent="full" onDetentChange={() => {}}>
        <div>Exercise content</div>
      </LessonPlate>,
    );
    const fullHeight = Number.parseInt(plate().style.height, 10);
    // Pre-fix this rendered '88px' too — the sheet never actually grew.
    expect(fullHeight).toBeGreaterThanOrEqual(220 + 80);
  });

  it('keeps HALF and FULL distinct from each other on the same short viewport', () => {
    window.innerHeight = 375;
    const { rerender } = renderAt('half');
    const plate = () => screen.getByLabelText(LABEL);
    const halfHeight = plate().style.height;

    rerender(
      <LessonPlate label={LABEL} resizeLabel={RESIZE_LABEL} detent="full" onDetentChange={() => {}}>
        <div>Exercise content</div>
      </LessonPlate>,
    );
    expect(plate().style.height).not.toBe(halfHeight);
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { detentHeights, DOCK_CLEARANCE_PX, LessonPlate } from '../LessonPlate';

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

      // HALF still has to show a REAL chunk more than PEEK — not a few
      // clipped pixels that technically differ.
      expect(heights.half - heights.peek).toBeGreaterThanOrEqual(80);

      /*
       * FULL vs HALF no longer has an 80px floor at this exact viewport — that
       * number came from round 88, which only ever asked "does FULL clear
       * HALF by a real step". Round 91 (2026-08-31, HIGH) found the sharper
       * constraint: FULL must ALSO leave `DOCK_CLEARANCE_PX` above the sheet
       * for the microphone dock, and on a 375px-tall viewport there is
       * physically not enough room to hold `ACTIVITY_FLOOR_PX` (HALF's own
       * floor, also non-negotiable) AND an 80px FULL/HALF step AND the dock's
       * real reserve at once — 240 + 80 + 124 = 444 is taller than the
       * viewport itself. The dock reserve wins: see the dedicated assertion
       * below, which is the one this round actually exists to prove. FULL
       * still has to be a REAL, non-collapsed step past HALF.
       */
      expect(heights.full).toBeGreaterThan(heights.half);
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
      // See the 375px test above for why this is no longer a flat ">= 80":
      // the taller the viewport, the more of that 80px this constraint can
      // actually afford without cutting into the dock's reserve (66px here,
      // vs 11px at 375 — asserted exactly in the dedicated test below).
      expect(heights.full).toBeGreaterThan(heights.half);
    });

    it(
      'ROUND 91: FULL never grows into the room the microphone dock needs above the sheet, ' +
        'at either landscape phone height',
      () => {
        /*
         * The actual regression, live-verified on `/dev/tutor-lab` at
         * 667x375 (conversing, an activity open, sheet dragged to FULL):
         * `getBoundingClientRect()` on the mic orb read `top: -89, bottom: 7`
         * — 89 of its 96px were off the TOP of the viewport — and the
         * composer's input read `top: -63, bottom: -19`, entirely negative.
         * Not an overlap with the sheet (`StageShell.tsx` rides the dock
         * ABOVE the sheet's published footprint, so the two never share a
         * pixel); the dock was simply pushed off-screen because nothing
         * capped how far FULL could grow. Asserted against the real
         * exported constant, not a copy of its number, so a future change to
         * `DOCK_CLEARANCE_PX` re-proves itself here rather than silently
         * going stale.
         */
        for (const height of [375, 430]) {
          setViewportHeight(height);
          const heights = detentHeights();
          expect(
            height - heights.full,
            `FULL leaves only ${height - heights.full}px above it at innerHeight=${height}, ` +
              `less than the ${DOCK_CLEARANCE_PX}px the microphone dock needs`,
          ).toBeGreaterThanOrEqual(DOCK_CLEARANCE_PX);
        }
      },
    );
  });

  describe('the portrait phone and desktop-height viewports, byte for byte', () => {
    /*
     * THESE NUMBERS MOVED ON 2026-09-12, and what moved them is not what it
     * first looked like.
     *
     * It looked like the Tutor's session controls, which had grown the
     * microphone dock by a row. That was fixed in the composition instead and
     * the dock went back to its old height — and these numbers still did not
     * go back, because the constraint that actually binds is older.
     *
     * The speech caption is anchored, and until the anchor-release fix landed
     * in this same branch, stale inline styles pinned it at (0, 0): it had
     * never once been positioned where the design intends. With it correctly
     * placed, a 375x812 phone with the sheet at FULL leaves 72 px between the
     * header row and the dock for a sentence that runs up to 130, which no
     * escape can solve. `STAGE_RESERVE_PX` went 300 -> 372 to make the band
     * real; see that constant's own comment for the arithmetic.
     *
     * FULL therefore drops 72 (512 -> 440 at 812; 600 -> 528 at 900). HALF
     * drops to its clamp at 812 and is untouched at 900, which is worth
     * knowing rather than pattern-matching: HALF is the 45vh fraction CLAMPED
     * to `ceiling - DETENT_STEP_PX`. At 812 the fraction is 365 and the new
     * clamp is 340, so the clamp now binds; at 900 the fraction (405) is still
     * well under its clamp (428).
     *
     * Asserted exactly, byte for byte, so the next change to the reserve or to
     * the short-viewport branch cannot quietly nudge the portrait case without
     * this test noticing — which is the job it has always had.
     */
    it('reproduces the EXACT numbers at 375x812, the verify-tutor-ui mobile gate', () => {
      setViewportHeight(812);
      expect(detentHeights()).toEqual({ peek: 88, half: 340, full: 440 });
    });

    it('reproduces the same numbers at 1280x900, the verify-tutor-ui desktop-height gate', () => {
      setViewportHeight(900);
      // HALF is untouched here: the 45vh fraction (405) is well under its
      // clamp (552 - 100), so only FULL moves with the reserve.
      expect(detentHeights()).toEqual({ peek: 88, half: 405, full: 528 });
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

  it('ROUND 91: never lets FULL grow into the microphone dock reserve, at every height a real device actually ships in', () => {
    // Starting at 375 rather than 350: below the shortest phone this product
    // targets, `full`'s own `half + 1` floor (see `detentHeights`'s comment)
    // is allowed to intrude a single pixel into the dock's reserve rather
    // than collapse FULL onto HALF — an honest tradeoff below any real
    // device, not something this assertion should paper over by starting
    // there. From 375 up, the reserve holds with no exception.
    for (let height = 375; height <= 1400; height += 5) {
      setViewportHeight(height);
      const heights = detentHeights();
      expect(
        height - heights.full,
        `FULL leaves only ${height - heights.full}px above it at innerHeight=${height}, ` +
          `less than the ${DOCK_CLEARANCE_PX}px the microphone dock needs`,
      ).toBeGreaterThanOrEqual(DOCK_CLEARANCE_PX);
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
    /*
     * Pre-fix this rendered '88px' too — the sheet never actually grew. The
     * bound here used to be a flat `220 + 80`; round 91 (2026-08-31) capped
     * FULL below that on this exact viewport so the microphone dock has room
     * above it (see `DOCK_CLEARANCE_PX` in `LessonPlate.tsx` and the
     * dedicated `detentHeights` tests above for why). Comparing against the
     * SAME arithmetic the component renders from, rather than a second
     * hand-picked number, is what keeps this test from drifting out of sync
     * with that tradeoff the next time either changes.
     */
    expect(fullHeight).toBe(detentHeights().full);
    expect(fullHeight).toBeGreaterThanOrEqual(220);
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

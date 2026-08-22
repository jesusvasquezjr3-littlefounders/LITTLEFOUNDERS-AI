import { describe, expect, it } from 'vitest';
import {
  ANCHOR_IDS,
  ANCHOR_MARK_COUNT,
  castMarks,
  isAnchorId,
  SKY_MARK_IDS,
  STAGE_MARK_IDS,
  type AnchorId,
} from './anchors';

/*
 * The anchor vocabulary is the one thing both sides of the canvas boundary hold,
 * and a slot that exists on one side and not the other fails SILENTLY: the DOM
 * node simply never moves, which looks like a styling problem rather than a
 * missing publication. So the list is asserted rather than trusted.
 */

describe('the anchor vocabulary', () => {
  it('has no duplicates', () => {
    expect(new Set(ANCHOR_IDS).size).toBe(ANCHOR_IDS.length);
  });

  it('carries the full mark budget on both rings', () => {
    expect(STAGE_MARK_IDS).toHaveLength(ANCHOR_MARK_COUNT);
    expect(SKY_MARK_IDS).toHaveLength(ANCHOR_MARK_COUNT);
  });

  it('lists every mark in the master list', () => {
    for (const id of [...STAGE_MARK_IDS, ...SKY_MARK_IDS]) {
      expect(ANCHOR_IDS).toContain(id);
    }
  });

  it('keeps the two rings disjoint', () => {
    const stage = new Set<string>(STAGE_MARK_IDS);
    for (const id of SKY_MARK_IDS) expect(stage.has(id)).toBe(false);
  });

  it('names both members of the cast and the island', () => {
    // Not a tautology: these are the slots the scene actually publishes, and a
    // rename on one side without the other is the failure this catches.
    const required: AnchorId[] = [
      'lead.crown',
      'lead.head',
      'lead.chest',
      'companion.crown',
      'companion.head',
      'island.centre',
      'island.rim.left',
      'island.rim.right',
    ];
    for (const id of required) expect(ANCHOR_IDS).toContain(id);
  });

  /*
   * The crown is a SEPARATE place from the head, and it has to stay one.
   *
   * The temptation is to delete it and nudge the caption up off `lead.head` in
   * CSS. That cannot work: `lead.head` is the mid-head, so the distance to the
   * crown in screen pixels is a function of how close the camera is. At a
   * close-up it is about 290 px on a 1280 viewport; at the establishing shot it
   * is about 40 px. A caption offset by either number sits across the
   * speaker's face in the other shot, and the close-up is where a conversation
   * lives.
   */
  it('gives the top of the head its own slot, for anything that must clear it', () => {
    expect(ANCHOR_IDS).toContain('lead.crown');
    expect(ANCHOR_IDS).toContain('lead.head');
    expect(new Set<string>(ANCHOR_IDS).size).toBe(ANCHOR_IDS.length);
  });
});

describe('isAnchorId', () => {
  it('accepts every published id', () => {
    for (const id of ANCHOR_IDS) expect(isAnchorId(id)).toBe(true);
  });

  it('rejects a plausible near-miss rather than narrowing it', () => {
    // A sixth mark is exactly the mistake a five-mark budget invites.
    expect(isAnchorId('stage.mark.5')).toBe(false);
    expect(isAnchorId('lead.hands')).toBe(false);
    expect(isAnchorId('')).toBe(false);
  });
});

/*
 * THE ONE TABLE BOTH SIDES OF THE CANVAS READ.
 *
 * The HUD hangs candidate N's name plate on `castMarks(n)[N]`; the scene
 * republishes that same mark at candidate N's crown. Two copies of this
 * arithmetic would drift the first time somebody commissioned a fifth
 * character, and the failure would be a name floating over the wrong face —
 * which reads as a rendering glitch rather than as two lists disagreeing. It
 * lives here because `anchors.ts` imports nothing, so both halves can hold it.
 */
describe('castMarks', () => {
  it('gives every candidate a mark of their own', () => {
    for (let count = 1; count <= ANCHOR_MARK_COUNT; count += 1) {
      const marks = castMarks(count);
      expect(marks, `count ${count}`).toHaveLength(count);
      expect(new Set<string>(marks).size, `count ${count}`).toBe(count);
      for (const mark of marks) expect(STAGE_MARK_IDS).toContain(mark);
    }
  });

  it('gives up the middle of the arc first', () => {
    // That is where the placement solver puts a solo cast: a spare mark parked
    // across the tutor's face is a worse composition than a ring with a gap.
    expect(castMarks(4)).toEqual(['stage.mark.0', 'stage.mark.1', 'stage.mark.3', 'stage.mark.4']);
  });

  it('never asks for a mark that does not exist', () => {
    // A sixth character would otherwise index past the ring and hand the HUD an
    // `undefined` slot, which is a plate nothing ever positions.
    expect(castMarks(ANCHOR_MARK_COUNT + 3)).toHaveLength(ANCHOR_MARK_COUNT);
    expect(castMarks(0)).toHaveLength(0);
  });
});

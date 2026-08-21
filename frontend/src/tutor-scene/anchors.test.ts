import { describe, expect, it } from 'vitest';
import {
  ANCHOR_IDS,
  ANCHOR_MARK_COUNT,
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
      'lead.head',
      'lead.chest',
      'companion.head',
      'island.centre',
      'island.rim.left',
      'island.rim.right',
    ];
    for (const id of required) expect(ANCHOR_IDS).toContain(id);
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

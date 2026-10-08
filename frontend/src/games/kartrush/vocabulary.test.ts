import { describe, expect, it } from 'vitest';
import { CIRCUITS, LENSES, MENTORS, MODES, REPLIES, SPEEDS } from '@/rebuild/games/vocabulary';
import { DEFAULT_SELECTION, SELECTABLE_SPEEDS } from './selection';
import { KR_CHARACTERS, KR_LENSES, KR_MODES, KR_REPLIES, KR_SPEED_CLASSES, KR_TRACK_IDS } from './protocol';

/*
 * The rebuilt screens cannot import the protocol (the new-UI boundary), so they hold
 * a hand-mirrored copy of its closed vocabulary. This pins the two copies together.
 */
describe('the screens and the protocol speak the same vocabulary', () => {
  it('has the same circuits, modes, drivers, lenses and replies, in the same order', () => {
    expect([...CIRCUITS]).toEqual([...KR_TRACK_IDS]);
    expect([...MODES]).toEqual([...KR_MODES]);
    expect([...MENTORS]).toEqual([...KR_CHARACTERS]);
    expect([...LENSES]).toEqual([...KR_LENSES]);
    expect([...REPLIES]).toEqual([...KR_REPLIES]);
  });

  it('offers the speed classes the embed offers: 100cc and 150cc, a subset of the protocol\'s', () => {
    expect([...SPEEDS]).toEqual([...SELECTABLE_SPEEDS]);
    for (const speed of SPEEDS) expect(KR_SPEED_CLASSES).toContain(speed);
    expect(KR_SPEED_CLASSES).not.toContain('300cc');
    expect(SPEEDS).not.toContain('200cc');
  });

  it('starts the Garage on a first circuit, the plain race, the 100cc class and Dr. Rho', () => {
    expect(DEFAULT_SELECTION).toEqual({ circuit: 'jungleNeck', mode: 'single', driver: 'rho', speed: '100cc' });
  });
});

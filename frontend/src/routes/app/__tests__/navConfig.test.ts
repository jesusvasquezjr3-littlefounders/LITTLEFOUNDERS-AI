import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, WALLET_NAV_ITEM, isUnlocked, lockedTargetFor, navItemsFor } from '../navConfig';

/*
 * S07.2 (D.3, OD-3 Option B) shell rules, UI only (Core admits by age):
 * a self-registered teen sees the learner shell with their Wallet; Tasks stay
 * locked (and lead to the wallet, where a parent is invited) until a parent
 * is linked; an adult or a parent never sees a Wallet item; nothing changes
 * for parents and parent-created children.
 */

const keys = (items: { key: string }[]) => items.map((i) => i.key);
const tasks = NAV_ITEMS.find((i) => i.key === 'tasks')!;
const banking = NAV_ITEMS.find((i) => i.key === 'banking')!;

describe('navItemsFor', () => {
  it('gives an independent teen Learn, Mentor, Tasks, Wallet and Profile, never Family or Banking', () => {
    expect(keys(navItemsFor({ holder: 'teen', familyChild: false }))).toEqual(['learn', 'tutor', 'tasks', 'wallet', 'profile']);
  });

  it('adds Banking once the teen links a verified parent', () => {
    expect(keys(navItemsFor({ holder: 'teen', familyChild: true }))).toEqual(['learn', 'tutor', 'tasks', 'wallet', 'banking', 'profile']);
  });

  it.each([
    ['an adult or a parent (no wallet)', { holder: null, familyChild: false }],
    ['a parent-created child', { holder: 'managed_child', familyChild: true }],
    ['an unresolved classification', undefined],
  ] as const)('keeps the registry unchanged for %s, with no Wallet item', (_label, wallet) => {
    const items = navItemsFor(wallet);
    expect(items).toBe(NAV_ITEMS);
    expect(items).not.toContain(WALLET_NAV_ITEM);
  });
});

describe('isUnlocked / lockedTargetFor', () => {
  it('keeps Tasks locked for an unlinked teen and sends them to their wallet', () => {
    const wallet = { holder: 'teen' as const, familyChild: false };
    expect(isUnlocked(tasks, ['universal'], wallet)).toBe(false);
    expect(lockedTargetFor(wallet)).toBe('/wallet');
  });

  it('unlocks Tasks and Banking for a teen who linked a verified parent', () => {
    const wallet = { holder: 'teen' as const, familyChild: true };
    expect(isUnlocked(tasks, ['universal'], wallet)).toBe(true);
    expect(isUnlocked(banking, ['universal'], wallet)).toBe(true);
  });

  it('never unlocks Tasks for an adult learner, whose locked items still lead to Tutor verification', () => {
    const wallet = { holder: null, familyChild: false };
    expect(isUnlocked(tasks, ['universal'], wallet)).toBe(false);
    expect(lockedTargetFor(wallet)).toBe('/verify-parent');
  });

  it('keeps the role rule for parents and children', () => {
    expect(isUnlocked(tasks, ['parent'])).toBe(true);
    expect(isUnlocked(tasks, ['kid'])).toBe(true);
  });
});

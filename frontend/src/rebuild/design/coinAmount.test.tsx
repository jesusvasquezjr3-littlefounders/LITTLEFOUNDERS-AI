import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CoinAmount, COIN_ASSET_ID, RewardChip } from './controls';
import { resolveManifestAsset } from './assets';

/*
 * Bible 07 §1 class B (coins), §6; 02 §9.5 "Shape by object type": the coin
 * is our own flat SVG, registered in the manifest, and it marks money only.
 */
const frontend = resolve(__dirname, '../../..');

describe('the coin asset and CoinAmount (07 §1, 02 §9.5)', () => {
  it('is a registered, in-house, text-free class B SVG in the coins family, in both modes, under 6 KB', () => {
    const asset = resolveManifestAsset(COIN_ASSET_ID);
    expect(asset).toMatchObject({ class: 'B', type: 'svg', slot: 'money.coin', modes: 'both', reviewFamily: 'coins', reviewStatus: 'draft', altKey: 'decorative' });
    const svg = readFileSync(resolve(frontend, `public${asset!.path}`), 'utf8');
    expect(svg.length).toBeLessThan(6 * 1024);
    expect(svg).not.toMatch(/<text|<image|gradient|filter/i);
    // The reward fill with its reward-ridge outline (02 §4.4 exception 3; 05 §2: a coin on a board carries its outline).
    expect(svg.toUpperCase()).toContain('#EBB806');
    expect(svg.toUpperCase()).toContain('#A88205');
  });

  it('shows the decorative coin, the number and the word, with the words carrying the meaning', () => {
    const { container } = render(<CoinAmount>12 coins</CoinAmount>);
    const amount = container.querySelector('.lf-coin-amount')!;
    expect(amount).toHaveAttribute('data-copy-role', 'data');
    expect(amount).toHaveAttribute('data-money', 'coins');
    const img = amount.querySelector('img')!;
    expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(img).toHaveAttribute('alt', '');
    expect(img.getAttribute('src')).toBe('/rebuild/art/coin.svg');
    expect(amount.textContent).toBe('12 coins');
  });

  it('marks a coin reward chip with the coin, and never an XP or streak chip', () => {
    const { container, rerender } = render(<RewardChip coin>40 coins</RewardChip>);
    expect(container.querySelector('.lf-status-chip--reward img[data-asset-id="money.coin"]')).not.toBeNull();
    rerender(<RewardChip>7 days</RewardChip>);
    expect(container.querySelector('img')).toBeNull();
  });

  it('is used for coin quantities across the money surfaces', () => {
    const uses = (file: string) => readFileSync(resolve(frontend, 'src/rebuild', file), 'utf8');
    for (const file of ['family/tasks/taskParts.tsx', 'family/tasks/ChildTasks.tsx', 'family/tasks/TutorTasks.tsx', 'family/console/FamilyConsole.tsx']) {
      expect(uses(file), file).toMatch(/<RewardChip coin>/);
    }
    for (const file of ['wallet/TeenWallet.tsx', 'banking/CoinAccount.tsx', 'family/GoalProgress.tsx', 'family/ShareGiving.tsx', 'family/DecisionQueue.tsx', 'family/tasks/taskParts.tsx']) {
      expect(uses(file), file).toMatch(/<CoinAmount\b/);
    }
  });
});

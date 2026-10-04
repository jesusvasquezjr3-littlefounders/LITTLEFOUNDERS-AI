import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Hue roles (Bible 05 section 2, 02 section 4.2): the series hues are sky, mint and berry. Primary marks selection, focus and
 * progress, accent marks the one call to action, reward marks coins and XP. A chart line, a reference mark or a goal is data and
 * never borrows one of those three; a coin is flat reward with a reward-ridge outline.
 */
const horizonteDir = resolve(__dirname, '..');
const read = (file: string) => readFileSync(resolve(horizonteDir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rulesOf = (css: string) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({ selector: match[1]!.trim(), body: match[2]! }));
/** Where primary legitimately appears: a focus ring, a hover, a chosen item, an armed or selected drop target. */
const STATE = /:focus|:hover|\[data-(?:chosen|drop-armed|drop-selected)=/;

const PACKS = ['stats1/stats1.css', 'space2/space2.css', 'sim1/sim1.css', 'sim2/LifeSimBoard.css', 'fin1/Fin1Boards.css'] as const;

describe('Horizonte hue roles', () => {
  it.each(PACKS)('%s: data and reference marks never use the accent or reward hue, and primary only marks a state', (file) => {
    for (const { selector, body } of rulesOf(read(file))) {
      expect(body, `${file} ${selector}: accent is the call to action`).not.toMatch(/var\(--accent/);
      expect(body, `${file} ${selector}: reward is coins and XP`).not.toMatch(/var\(--reward/);
      if (/var\(--primary/.test(body)) expect(selector, `${file} ${selector}: primary marks selection and focus, not data`).toMatch(STATE);
    }
  });

  it('a coin is flat reward with a reward-ridge outline, not a sky tint', () => {
    const rules = rulesOf(read('space1/space1.css'));
    const coin = rules.find((rule) => rule.selector === '.lf-coin-piece');
    expect(coin, 'the coin rule').toBeDefined();
    expect(coin!.body).toMatch(/fill:\s*var\(--reward\)/);
    expect(coin!.body).toMatch(/stroke:\s*var\(--reward-ridge\)/);
    for (const rule of rules.filter((candidate) => candidate.selector.startsWith('.lf-coin-piece'))) expect(rule.body, rule.selector).not.toMatch(/var\(--sky/);
  });
});

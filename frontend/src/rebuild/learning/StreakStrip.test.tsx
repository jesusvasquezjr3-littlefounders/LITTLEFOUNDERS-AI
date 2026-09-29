import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { checkCopy } from '../design/copyBudget';
import { StreakStrip, streakStripCopy, streakStripRoles } from './StreakStrip';

/* GAP-FIX-R1 learning (Bible 02 §9.6 rules 4-6, 04 §4.3): the weekly streak strip. */

const week = [
  { date: '2026-09-21', state: 'practiced' }, { date: '2026-09-22', state: 'rest' }, { date: '2026-09-23', state: 'paused' },
  { date: '2026-09-24', state: 'today' }, { date: '2026-09-25', state: 'open' }, { date: '2026-09-26', state: 'open' }, { date: '2026-09-27', state: 'open' },
] as const;

describe('the weekly streak strip', () => {
  it('draws seven days, each state with its own shape class and an accessible word, today ringed', () => {
    const { container } = render(<StreakStrip week={[...week]} locale="en-US" today="2026-09-24" />);
    expect(container.querySelectorAll('.lf-streak-day')).toHaveLength(7);
    expect(screen.getByText('Monday: Practiced')).toBeTruthy();
    expect(screen.getByText('Tuesday: Rest day')).toBeTruthy();
    expect(screen.getByText('Wednesday: Paused')).toBeTruthy();
    expect(container.querySelector('[aria-current="date"]')?.className).toContain('lf-streak-day--current');
    // No celebration and no loss words on an ordinary week.
    expect(container.textContent).not.toMatch(/lost|missed|broke|congrat/i);
  });

  it('keeps its words inside the youngest Copy Budget in three locales', () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      for (const [key, role] of Object.entries(streakStripRoles)) {
        const text = streakStripCopy[locale][key as keyof typeof streakStripRoles];
        if (role !== 'data') expect(checkCopy(text, role, { locale, ageBand: '6-9', surface: 'app' })).toEqual([]);
        expect(text).not.toMatch(/freeze|congel/i);
      }
    }
  });

  it('draws its visible weekday letters at the 14 px caption size, never below the floor (02 rule 11)', () => {
    const { container } = render(<StreakStrip week={[...week]} locale="es-MX" today="2026-09-24" />);
    const letters = [...container.querySelectorAll('.lf-streak-weekday')];
    expect(letters).toHaveLength(7);
    for (const letter of letters) expect(letter).toHaveAttribute('data-copy-role', 'data');
    const css = readFileSync(resolve(__dirname, 'streakStrip.css'), 'utf8');
    expect(css).toMatch(/\.lf-streak-weekday \{ font: var\(--type-caption\); \}/);
  });
});

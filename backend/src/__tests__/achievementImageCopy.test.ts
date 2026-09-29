import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENT_KICKERS,
  ACHIEVEMENT_LABEL_MAX,
  COURSE_BADGE_GENERIC_LABELS,
  fitAchievementLabel,
  GOAL_REACHED_GENERIC_LABELS,
  STREAK_LABELS,
} from '../services/achievementImageCopy.js';

/*
 * The OD-20 achievement image's words live in Core (gap-fix round 2): Depot
 * holds no copy of its own. Frontend Bible 06 section 5.7 (calm copy: no
 * exclamation marks), the controlled glossary (coins, never money) and 02 D1
 * (never an ellipsis) are pinned here.
 */
const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;

describe('achievement image copy', () => {
  it('has a kicker for every kind in every locale, calm and short enough for Depot', () => {
    for (const locale of LOCALES) {
      for (const kind of ['course_badge', 'streak', 'goal_reached'] as const) {
        const kicker = ACHIEVEMENT_KICKERS[locale][kind];
        expect(kicker.length, `${locale}/${kind}`).toBeGreaterThan(0);
        expect(kicker.length).toBeLessThanOrEqual(40);
        expect(kicker).not.toMatch(/[!¡…]/);
      }
    }
  });

  it('keeps every generic label inside Depot\'s ceiling, in coins, never money', () => {
    for (const locale of LOCALES) {
      for (const text of [COURSE_BADGE_GENERIC_LABELS[locale], GOAL_REACHED_GENERIC_LABELS[locale](99999), STREAK_LABELS[locale](365)]) {
        expect(text.length).toBeLessThanOrEqual(ACHIEVEMENT_LABEL_MAX);
        expect(text).not.toMatch(/money|dinero|dinheiro|\$|…/i);
      }
    }
  });

  it('keeps a label that fits and replaces an over-long one whole', () => {
    expect(fitAchievementLabel('Money basics', 'Finished a course')).toBe('Money basics');
    expect(fitAchievementLabel('x'.repeat(ACHIEVEMENT_LABEL_MAX), 'generic')).toBe('x'.repeat(ACHIEVEMENT_LABEL_MAX));
    expect(fitAchievementLabel('x'.repeat(ACHIEVEMENT_LABEL_MAX + 1), 'generic')).toBe('generic');
  });
});

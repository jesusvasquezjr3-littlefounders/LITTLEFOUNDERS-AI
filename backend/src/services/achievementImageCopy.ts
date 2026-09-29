import type { AchievementKind, AchievementLocale } from './badges.js';

/*
 * The OD-20 achievement image's words, in the three product locales
 * (Frontend Bible 06: Copy Budget and the controlled glossary; 06 section 5.7:
 * calm copy, so no exclamation marks). Core decides every word on the image;
 * Depot only draws what it receives. "coins", never money; a badge is an
 * "insignia" / "insígnia", as in the rebuilt profile.
 */

/** The kicker line above the first name. */
export const ACHIEVEMENT_KICKERS: Record<AchievementLocale, Record<AchievementKind, string>> = {
  'en-US': { course_badge: 'Badge earned', streak: 'Learning streak', goal_reached: 'Goal reached' },
  'es-MX': { course_badge: 'Insignia ganada', streak: 'Racha de aprendizaje', goal_reached: 'Meta alcanzada' },
  'pt-BR': { course_badge: 'Insígnia conquistada', streak: 'Sequência de estudos', goal_reached: 'Meta alcançada' },
};

export const STREAK_LABELS: Record<AchievementLocale, (days: number) => string> = {
  'en-US': (d) => `${d}-day streak`,
  'es-MX': (d) => `Racha de ${d} días`,
  'pt-BR': (d) => `Sequência de ${d} dias`,
};

// Family Hub (0079): a reached savings goal uses the same image renderer.
export const GOAL_REACHED_LABELS: Record<AchievementLocale, (title: string, target: number) => string> = {
  'en-US': (title, target) => `Saved ${target} coins for "${title}"`,
  'es-MX': (title, target) => `Ahorró ${target} monedas para "${title}"`,
  'pt-BR': (title, target) => `Poupou ${target} moedas para "${title}"`,
};

// F.6 minimization: a goal title that carries a contact, link, handle,
// platform, school, place or birth year (the E.13 classifier) is left out and
// the label names the goal generically. Also the label when the titled one is
// longer than Depot draws.
export const GOAL_REACHED_GENERIC_LABELS: Record<AchievementLocale, (target: number) => string> = {
  'en-US': (target) => `Saved ${target} coins for a goal`,
  'es-MX': (target) => `Ahorró ${target} monedas para una meta`,
  'pt-BR': (target) => `Poupou ${target} moedas para uma meta`,
};

/** A course badge's label when the course title is longer than Depot draws. */
export const COURSE_BADGE_GENERIC_LABELS: Record<AchievementLocale, string> = {
  'en-US': 'Finished a course',
  'es-MX': 'Terminó un curso',
  'pt-BR': 'Concluiu um curso',
};

/** Depot's label ceiling (its body schema refuses a longer label). */
export const ACHIEVEMENT_LABEL_MAX = 80;

/**
 * Frontend Bible 02 D1: text is never cut with an ellipsis. A label longer
 * than Depot draws is replaced whole by the kind's generic label, so the
 * image never shows half a course or goal title.
 */
export function fitAchievementLabel(label: string, generic: string): string {
  return label.length <= ACHIEVEMENT_LABEL_MAX ? label : generic;
}

import en from '../../i18n/en-US/rebuild-games.json';
import es from '../../i18n/es-MX/rebuild-games.json';
import pt from '../../i18n/pt-BR/rebuild-games.json';
import type { Locale } from '../design/copyBudget';

/*
 * The game host's rebuilt copy (`rebuild-games.json`, budgeted in
 * rebuild/copy-budget/games.test.ts). Placeholders are `{name}`. The Mentor's
 * own lines (the Garage greeting, the pit-stop observation, the break line) are
 * keyed by Mentor, in that Mentor's voice from the Tutor prompt's character
 * voices: Dr. Rho warm and precise, Zara quick and curious, Liruf playful and
 * simple, Dina calm and never rushing. The reflection question and its replies
 * are shared by all four, so the learner meets the same question whoever asks.
 */
export const gamesCopy: Record<Locale, typeof en> = { 'en-US': en, 'es-MX': es, 'pt-BR': pt };

export function fillName(template: string, name: string): string {
  return template.replace(/\{name\}/g, name);
}

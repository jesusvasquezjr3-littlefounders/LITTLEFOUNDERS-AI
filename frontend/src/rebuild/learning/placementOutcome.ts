import { z } from 'zod';
import type { Locale } from '../design/copyBudget';

/*
 * B.15 (S05.3d): placement outcome framing as accompaniment, not a verdict.
 *
 * Core classifies every placement outcome into one closed frame
 * (backend/src/services/placementFraming.ts); this module owns the words.
 * Every outcome says the same two things: the starting point reflects what
 * the learner has already seen (prior exposure), never what they can do, and
 * the path grows from there. Nothing compares the learner with anyone else,
 * and no score, count of right answers or rank is ever shown.
 *
 * PLACEMENT_VERDICT_LEXICON is the enforceable half of the mandate: a test
 * runs it over this copy and over the live placement screen's strings in all
 * three locales, so ability, ranking or failure language cannot come back.
 */

export const placementFrameSchema = z.object({
  path: z.enum(['adaptive_quiz', 'learner_chose_start', 'learner_adjusted', 'no_probe_content_fallback']),
  start: z.enum(['beginning', 'further_in']),
  basis: z.literal('prior_exposure'),
  learner_chosen: z.boolean(),
}).strict().refine((frame) => frame.learner_chosen === (frame.path === 'learner_chose_start' || frame.path === 'learner_adjusted'), 'Invalid frame');
export type PlacementFrame = z.infer<typeof placementFrameSchema>;

type OutcomeCopy = {
  title: Record<PlacementFrame['start'], string>;
  basis: string;
  growth: Record<PlacementFrame['start'], string>;
  chosen: string;
  start: string;
  earlier: string;
  unavailable: string;
};

export const placementOutcomeCopy: Record<Locale, OutcomeCopy> = {
  'en-US': {
    title: { beginning: 'Your path starts here', further_in: 'Your path starts further in' },
    basis: "This reflects what you've seen, not what you can do.",
    growth: { beginning: 'Each step builds on the last.', further_in: 'You can go back anytime.' },
    chosen: 'You chose this start. You can change it.',
    start: 'Start here', earlier: 'Start earlier', unavailable: 'Start point unavailable',
  },
  'es-MX': {
    title: { beginning: 'Tu camino empieza aquí', further_in: 'Tu camino empieza más adelante' },
    basis: 'Esto refleja lo que ya viste, no lo que puedes hacer.',
    growth: { beginning: 'Cada paso se apoya en el anterior.', further_in: 'Puedes regresar cuando quieras.' },
    chosen: 'Tú elegiste este inicio. Puedes cambiarlo.',
    start: 'Empezar aquí', earlier: 'Empezar antes', unavailable: 'Inicio no disponible',
  },
  'pt-BR': {
    title: { beginning: 'Seu caminho começa aqui', further_in: 'Seu caminho começa mais à frente' },
    basis: 'Isso reflete o que você já viu, não o que consegue fazer.',
    growth: { beginning: 'Cada passo se apoia no anterior.', further_in: 'Pode voltar quando quiser.' },
    chosen: 'Você escolheu este início. Pode mudar depois.',
    start: 'Começar aqui', earlier: 'Começar antes', unavailable: 'Início indisponível',
  },
};

/**
 * Words that turn a starting point into a verdict: ability, ranking,
 * comparison, failure or mastery. Matched case-insensitively on whole words.
 * The basis sentence ("not what you can do") is the one sanctioned mention of
 * ability, because it denies it; it is checked apart.
 */
export const PLACEMENT_VERDICT_LEXICON: Record<Locale, RegExp> = {
  'en-US': /\b(score|scored|rank|ranked|percentile|smart|talent\w*|gifted|behind|better than|worse|fail\w*|wrong|level|advanced|expert|master\w*|already knew|good chunk|look at that)\b/iu,
  'es-MX': /(?<![\p{L}])(puntaje|calificación|rango|inteligente|talento|atrás|atrasad\w*|mejor que|peor|reprob\w*|fall\w*|incorrect\w*|nivel|avanzad\w*|adelantad\w*|experto|domin\w*|ya sabías|mira eso)(?![\p{L}])/iu,
  'pt-BR': /(?<![\p{L}])(pontuação|nota|classificação|inteligente|talento|atrasad\w*|melhor que|pior|reprov\w*|falh\w*|errad\w*|nível|avançad\w*|especialista|domin\w*|já sabia|olha só)(?![\p{L}])/iu,
};

export function verdictWords(text: string, locale: Locale): string[] {
  const match = PLACEMENT_VERDICT_LEXICON[locale].exec(text);
  return match ? [match[0]] : [];
}

/** The lines one frame renders, in order. */
export function placementOutcomeLines(frame: PlacementFrame, locale: Locale): { title: string; lines: string[] } {
  const copy = placementOutcomeCopy[locale];
  return {
    title: copy.title[frame.start],
    // A start the learner chose says so instead of the growth line: the choice is theirs to change.
    lines: [copy.basis, frame.learner_chosen ? copy.chosen : copy.growth[frame.start]],
  };
}

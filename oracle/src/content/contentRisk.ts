import { classifyLearnerInput } from '../safety/classifier.js';
import type { Locale } from '../context/schema.js';

/*
 * Product C.5 / Appendix E §3.1.1 — Oracle's half of the content-risk
 * category of a live-generated activity (`standard` or `sensitive`).
 *
 * Oracle generated the item, so it reports what it can see and Core cannot:
 * the brief the Mentor wrote (framing and rationale) and whether the
 * learner-input safety classifier (the same risk-classification signal that
 * feeds moderation) matches the item's text. Core re-runs the SAME lexicon
 * over the item's prose, adds `session_safety_event` from the session's
 * recorded safety flags (its own table, the authoritative record) and takes
 * the union — it never trusts this report to LOWER the category, only to
 * raise it.
 *
 * HAND-MIRRORED from `backend/src/services/pedagogy/contentRisk.ts`. The
 * block between the markers must stay byte-identical (after whitespace
 * normalization); `npm run live-content:check` enforces it.
 */

export type ContentRiskCategory = 'standard' | 'sensitive';

// <content-risk-lexicon>
export const CONTENT_RISK_SIGNALS = [
  'financial_hardship',
  'family_conflict',
  'loss_and_grief',
  'safety_adjacent',
  'session_safety_event',
  'learner_classifier_match',
] as const;

export type ContentRiskSignal = (typeof CONTENT_RISK_SIGNALS)[number];

/**
 * Patterns run over FOLDED text (lowercase, diacritics removed), so one
 * pattern covers "não"/"nao" and "divorcio"/"divórcio". Each is bounded by
 * non-letters on both sides.
 */
export const CONTENT_RISK_LEXICON: readonly { signal: ContentRiskSignal; pattern: string }[] = [
  // financial hardship — en-US
  { signal: 'financial_hardship', pattern: "can'?t afford|cannot afford|could ?n[o']t afford" },
  { signal: 'financial_hardship', pattern: 'no money for (?:food|rent|dinner|lunch|the rent)' },
  { signal: 'financial_hardship', pattern: 'in debt|debts?|owes? money|evict(?:ed|ion)?|homeless(?:ness)?' },
  { signal: 'financial_hardship', pattern: 'lost (?:his|her|their|my|your) job|unemploy(?:ed|ment)|poverty|go(?:es)? hungry|nothing to eat' },
  // financial hardship — es-MX
  { signal: 'financial_hardship', pattern: 'no (?:nos |les |me |te )?alcanza (?:para comer|el dinero|para la renta)|no tenemos dinero' },
  { signal: 'financial_hardship', pattern: 'deudas?|endeudad[oa]s?|desalojo|desalojad[oa]s?|sin hogar|pobreza' },
  { signal: 'financial_hardship', pattern: 'perdio (?:su |el )?(?:trabajo|empleo)|desemplead[oa]s?|desempleo|pasar hambre|pasan hambre' },
  // financial hardship — pt-BR
  { signal: 'financial_hardship', pattern: 'nao da para pagar|nao temos dinheiro|nao sobra dinheiro para comer' },
  { signal: 'financial_hardship', pattern: 'dividas?|endividad[oa]s?|despejo|despejad[oa]s?|sem-teto|sem casa|pobreza' },
  { signal: 'financial_hardship', pattern: 'perdeu o emprego|desempregad[oa]s?|desemprego|passar fome|passam fome' },
  // family conflict — en-US / es-MX / pt-BR
  { signal: 'family_conflict', pattern: 'divorc(?:e|ed|ing)|custody|parents (?:are )?(?:fighting|arguing|yelling|splitting up)|(?:mom|dad|mother|father) (?:left|moved out)' },
  { signal: 'family_conflict', pattern: 'divorcio|divorciad[oa]s?|custodia|(?:mis |sus )?papas (?:se )?pelean|se separaron|(?:mama|papa) se fue' },
  { signal: 'family_conflict', pattern: 'divorcio|divorciad[oa]s?|guarda dos filhos|(?:meus |seus )?pais brigam|se separaram|(?:mae|pai) foi embora' },
  // loss and grief
  { signal: 'loss_and_grief', pattern: 'died|dies|death|funeral|passed away' },
  { signal: 'loss_and_grief', pattern: 'murio|muerte|funeral|fallecio|velorio' },
  { signal: 'loss_and_grief', pattern: 'morreu|morte|funeral|faleceu|velorio' },
  // adjacent to the safety-stop categories (and gambling, a money-specific harm)
  { signal: 'safety_adjacent', pattern: 'guns?|knife|knives|weapons?|bull(?:y|ies|ying)|drugs?|alcohol|gambl(?:e|ing)|bet(?:s|ting)?|lottery|steal(?:ing)?|stole' },
  { signal: 'safety_adjacent', pattern: 'armas? de fuego|pistolas?|cuchillos?|acoso|drogas?|alcohol|apuestas?|apostar|loteria|robar|robo' },
  { signal: 'safety_adjacent', pattern: 'armas? de fogo|revolver|facas?|bullying|drogas?|alcool|apostas?|apostar|loteria|roubar|roubo' },
  { signal: 'safety_adjacent', pattern: 'hurt (?:yourself|himself|herself|themselves|someone)|keep (?:it )?(?:a )?secret from (?:your )?(?:parents|mom|dad)' },
  { signal: 'safety_adjacent', pattern: 'lastimarte|hacerte dano|secreto (?:de|para) tus (?:papas|padres)|machucar|se machucar|segredo dos seus pais' },
];

/** Lowercase, diacritics removed, whitespace collapsed. */
export function foldForRisk(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const COMPILED = CONTENT_RISK_LEXICON.map((entry) => ({
  signal: entry.signal,
  re: new RegExp(`(?<![a-z])(?:${entry.pattern})(?![a-z])`, 'u'),
}));

/** The lexical signals found in `text` (deduplicated, catalog order). */
export function lexicalRiskSignals(text: string): ContentRiskSignal[] {
  const folded = foldForRisk(text);
  const found = new Set<ContentRiskSignal>();
  for (const { signal, re } of COMPILED) {
    if (re.test(folded)) found.add(signal);
  }
  return CONTENT_RISK_SIGNALS.filter((s) => found.has(s));
}

export function categoryFor(signals: readonly string[]): ContentRiskCategory {
  return signals.length > 0 ? 'sensitive' : 'standard';
}
// </content-risk-lexicon>

/**
 * The signals Oracle reports with a candidate: the lexicon over the item's
 * prose and the brief, and the learner-input classifier run over the item's
 * prose (a match there means the item says something the moderation stack
 * would have treated as a safety topic had a learner said it).
 */
export function classifyGeneratedContent(input: {
  prose: string;
  brief: readonly string[];
  locale: Locale;
}): { category: ContentRiskCategory; signals: ContentRiskSignal[] } {
  const found = new Set<ContentRiskSignal>();
  for (const text of [input.prose, ...input.brief]) for (const s of lexicalRiskSignals(text)) found.add(s);
  if (classifyLearnerInput(input.prose, input.locale).category !== null) found.add('learner_classifier_match');
  const signals = CONTENT_RISK_SIGNALS.filter((s) => found.has(s));
  return { category: categoryFor(signals), signals };
}

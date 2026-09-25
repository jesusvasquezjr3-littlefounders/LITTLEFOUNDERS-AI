/*
 * Product C.5 / Appendix E §3.1.1 — the content-risk category of a piece of
 * live-generated content: `standard`, or `sensitive` when it touches a
 * sensitive topic (financial hardship, family conflict, loss, or anything
 * adjacent to the safety-stop categories).
 *
 * WHY IT EXISTS. The staff-sampling floor scales UP with risk: at least 15%
 * of standard items and at least 50% of sensitive ones are reviewed by a
 * human after the fact. The category must therefore be decided by the
 * service that certifies the item (Core), not only reported by the service
 * that generated it (Oracle). Oracle runs the SAME lexicon plus its own
 * learner-input classifier and reports what it found; Core runs this copy
 * over the item's own prose and the request's rationale, adds the session's
 * recorded safety flags, and takes the UNION. Neither side can lower the
 * other's classification.
 *
 * DETERMINISTIC ON PURPOSE. A model classifier would cost a paid call per
 * item (OD-23) and could itself be steered by the text it classifies. This
 * list is loose by design: a false positive costs one extra human review,
 * a false negative costs a lower review rate on exactly the content that
 * needed a higher one.
 *
 * HAND-MIRRORED from `oracle/src/content/contentRisk.ts`. The block between
 * the markers must stay byte-identical (after whitespace normalization);
 * `npm run live-content:check` enforces it.
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
 * Core's final classification of one live item: its own lexicon over every
 * text it can see, the session's recorded safety flags, and whatever Oracle
 * reported. An unknown code from Oracle is not ignored: it is recorded as
 * `unrecognized_signal` and makes the item sensitive (a vocabulary drift
 * must never lower a review rate).
 */
export function classifyLiveContent(input: {
  texts: readonly string[];
  reportedSignals: unknown;
  sessionSafetyFlags: number;
}): { category: ContentRiskCategory; signals: string[] } {
  const signals = new Set<string>();
  for (const text of input.texts) for (const s of lexicalRiskSignals(text)) signals.add(s);
  if (input.sessionSafetyFlags > 0) signals.add('session_safety_event');
  if (Array.isArray(input.reportedSignals)) {
    for (const code of input.reportedSignals) {
      if (typeof code === 'string' && (CONTENT_RISK_SIGNALS as readonly string[]).includes(code)) signals.add(code);
      else signals.add('unrecognized_signal');
    }
  } else if (input.reportedSignals !== undefined && input.reportedSignals !== null) {
    signals.add('unrecognized_signal');
  }
  const ordered = [...CONTENT_RISK_SIGNALS, 'unrecognized_signal'].filter((s) => signals.has(s));
  return { category: categoryFor(ordered), signals: ordered };
}

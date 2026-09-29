// B.14 — Law 2 tone gate: "speak like a mentor, never like a bank".
//
// COSMIC_NARRATIVE.md Law 2: no "account balance", "transaction declined" or
// "insufficient funds" as the emotional frame; no yield-chasing, no hype, no
// "get rich", no FOMO, no urgency tricks. The SPEC's own example of leakage
// is procedural system copy: "No attempts left for this question" (B.14).
//
// Deterministic by design (OD-23, zero spend): a per-locale lexicon of
// phrases, matched on folded text (lower case, no diacritics) at word
// boundaries. Each entry carries a severity per SURFACE:
//
//   ui      — system/UI copy: the product itself is speaking, so every
//             category blocks.
//   lesson  — authored lesson and catalog content: a money course legitimately
//             TEACHES what a bank message or a scam looks like (the investing
//             course has a whole fraud-radar adventure). Banking vocabulary and
//             everyday-language urgency ("limited time") therefore go to human
//             review (Appendix C Stage 3); voiced hype promises and
//             resource-exhaustion framing block.
//
// Four context rules turn a blocking hit into a review item, never into a
// silent pass, and the reviewer sees which one applied:
//   quoted   — the phrase sits inside quotation marks ("…", “…”, «…», ‘…’ or
//              '…' used as quotes): an example being examined;
//   negated  — a negation precedes it within four words ("no investment is
//              ever risk-free");
//   warned   — a warning cue precedes it within six words ("the signal of
//              guaranteed profit", "frases como ganancia garantizada"): the
//              phrase is named as a warning sign, not voiced;
//   examined — the whole field is material the learner inspects by contract
//              (red_flags' suspicious artifact and its flags: EXAMINED_PATHS in
//              lessonGates.ts).
// A phrase that is voiced, unquoted, unnegated and unwarned blocks.

import { foldText, excerpt } from './text.js';
import type { ContentLocale } from './budgets.js';

export type ToneCategory = 'banking-frame' | 'hype-urgency' | 'procedural';
export type ToneSeverity = 'block' | 'review';
export type ToneSurface = 'ui' | 'lesson';
export type ToneDowngrade = 'quoted' | 'negated' | 'warned' | 'examined';

interface ToneEntry {
  phrase: string;
  category: ToneCategory;
  lesson: ToneSeverity;
  ui: ToneSeverity;
}

const bank = (phrase: string): ToneEntry => ({ phrase, category: 'banking-frame', lesson: 'review', ui: 'block' });
/** A voiced hype promise: blocks everywhere. */
const hype = (phrase: string): ToneEntry => ({ phrase, category: 'hype-urgency', lesson: 'block', ui: 'block' });
/** Urgency wording that is also ordinary story language ("a limited-time challenge"): blocks in UI, reviewed in lessons. */
const urge = (phrase: string): ToneEntry => ({ phrase, category: 'hype-urgency', lesson: 'review', ui: 'block' });
const proc = (phrase: string): ToneEntry => ({ phrase, category: 'procedural', lesson: 'block', ui: 'block' });

/**
 * The lexicon. Phrases are written folded (no accents, lower case) and matched
 * against folded text. Keep entries specific: a single common word ("balance",
 * "hurry", "moon") collides with ordinary story language and belongs in human
 * review, not here; names of concepts the curriculum teaches ("FOMO") are not
 * voice. Every change is a Threshold Recalibration Log entry (Appendix C Part
 * 1.3) in docs/operations/BLOCK-B-THRESHOLD-LOG.md (the per-locale count is checked).
 */
export const TONE_LEXICON: Readonly<Record<ContentLocale, readonly ToneEntry[]>> = {
  'en-US': [
    bank('account balance'), bank('available balance'), bank('insufficient funds'), bank('insufficient balance'),
    bank('transaction declined'), bank('transaction failed'), bank('payment declined'), bank('card declined'),
    bank('overdraft'), bank('overdrawn'), bank('account holder'), bank('account statement'), bank('monthly statement'),
    bank("this month's statement"), bank('processing fee'), bank('service fee'), bank('available funds'),
    hype('get rich'), hype('get-rich-quick'), hype('rich quick'), hype('easy money'),
    hype('guaranteed return'), hype('guaranteed returns'), hype('guaranteed profit'), hype('guaranteed profits'),
    hype('double your money'), hype('triple your money'), hype('risk-free'), hype('act now'), hype('act fast'),
    hype("don't miss out"), hype("don't miss this"), hype('today only'), hype('only today'), hype('exclusive offer'),
    hype('once in a lifetime'),
    urge('free money'), urge('limited time'), urge('limited-time'), urge('last chance'), urge('hurry up'), urge("before it's too late"),
    proc('no attempts left'), proc('attempts left'), proc('attempts remaining'), proc('out of attempts'),
    proc('no more attempts'), proc('attempts exhausted'), proc('no tries left'), proc('tries left'), proc('out of tries'),
  ],
  'es-MX': [
    bank('saldo de la cuenta'), bank('saldo de tu cuenta'), bank('saldo disponible'), bank('fondos insuficientes'),
    bank('saldo insuficiente'), bank('transaccion rechazada'), bank('pago rechazado'), bank('tarjeta rechazada'),
    bank('sobregiro'), bank('titular de la cuenta'), bank('estado de cuenta'), bank('comision por servicio'),
    bank('cargo por servicio'), bank('fondos disponibles'),
    hype('hazte rico'), hype('hacerte rico'), hype('hacerse rico'), hype('dinero facil'),
    hype('ganancia garantizada'), hype('ganancias garantizadas'), hype('rendimiento garantizado'), hype('rendimientos garantizados'),
    hype('duplica tu dinero'), hype('triplica tu dinero'), hype('sin riesgo'), hype('actua ya'), hype('actua ahora'),
    hype('no te lo pierdas'), hype('no te pierdas esta'), hype('solo por hoy'), hype('oferta exclusiva'), hype('unica en la vida'),
    urge('dinero gratis'), urge('tiempo limitado'), urge('ultima oportunidad'), urge('date prisa'), urge('apurate'), urge('antes de que sea tarde'),
    proc('no quedan intentos'), proc('sin intentos'), proc('intentos restantes'), proc('te quedan intentos'),
    proc('se acabaron los intentos'), proc('ya no tienes intentos'), proc('no te quedan intentos'),
  ],
  'pt-BR': [
    bank('saldo da conta'), bank('saldo da sua conta'), bank('saldo disponivel'), bank('saldo insuficiente'),
    bank('fundos insuficientes'), bank('transacao recusada'), bank('pagamento recusado'), bank('cartao recusado'),
    bank('cheque especial'), bank('titular da conta'), bank('extrato'), bank('extrato mensal'), bank('tarifa de servico'),
    bank('fundos disponiveis'),
    hype('fique rico'), hype('ficar rico'), hype('enriquecer rapido'), hype('dinheiro facil'),
    hype('lucro garantido'), hype('lucros garantidos'), hype('retorno garantido'), hype('retornos garantidos'),
    hype('dobre seu dinheiro'), hype('dobre o seu dinheiro'), hype('triplique seu dinheiro'), hype('sem risco'),
    hype('aja agora'), hype('nao perca essa'), hype('nao perca esta'), hype('nao perca a chance'), hype('so hoje'),
    hype('apenas hoje'), hype('oferta exclusiva'), hype('unica na vida'),
    urge('dinheiro gratis'), urge('tempo limitado'), urge('ultima chance'), urge('corra agora'), urge('antes que seja tarde'),
    proc('sem tentativas'), proc('nao ha mais tentativas'), proc('tentativas restantes'), proc('suas tentativas acabaram'),
    proc('acabaram as tentativas'), proc('nao tem mais tentativas'),
  ],
};

/**
 * How far back a negation ("never", "nunca", "nao") or a warning cue
 * ("signal", "estafa", "golpe") may sit and still downgrade a blocking hit
 * to review. Calibrated on the four catalogs and the corpus; recorded in the
 * Block B threshold log (docs/operations/BLOCK-B-THRESHOLD-LOG.md).
 */
export const NEGATION_WINDOW_WORDS = 4;
export const WARNING_CUE_WINDOW_WORDS = 6;

const NEGATIONS: Readonly<Record<ContentLocale, ReadonlySet<string>>> = {
  'en-US': new Set(['no', 'not', 'never', 'nobody', 'nothing', "don't", "doesn't", "isn't", "aren't", "can't", 'cannot', "won't", 'without', 'neither', 'nor']),
  'es-MX': new Set(['no', 'nunca', 'nadie', 'nada', 'ningun', 'ninguna', 'ninguno', 'sin', 'jamas', 'tampoco', 'ni']),
  'pt-BR': new Set(['nao', 'nunca', 'ninguem', 'nada', 'nenhum', 'nenhuma', 'sem', 'jamais', 'nem']),
};

/** Words that name what follows as a warning sign (folded). */
const WARNING_CUES: Readonly<Record<ContentLocale, ReadonlySet<string>>> = {
  'en-US': new Set(['signal', 'signals', 'sign', 'signs', 'promise', 'promises', 'phrase', 'phrases', 'warning', 'red', 'flag', 'flags', 'scam', 'scams', 'fraud', 'trap', 'lure', 'fake', 'suspicious', 'alert', 'claim', 'claims']),
  'es-MX': new Set(['senal', 'senales', 'promesa', 'promesas', 'frase', 'frases', 'alerta', 'alertas', 'estafa', 'estafas', 'fraude', 'fraudes', 'trampa', 'anzuelo', 'falsa', 'falso', 'sospechoso', 'sospechosa', 'enganoso', 'enganosa', 'promete', 'prometen']),
  'pt-BR': new Set(['sinal', 'sinais', 'promessa', 'promessas', 'frase', 'frases', 'alerta', 'alertas', 'golpe', 'golpes', 'fraude', 'fraudes', 'armadilha', 'isca', 'falsa', 'falso', 'suspeito', 'suspeita', 'enganoso', 'enganosa', 'promete', 'prometem']),
};

export interface ToneFinding {
  phrase: string;
  category: ToneCategory;
  severity: ToneSeverity;
  /** Why a blocking entry was downgraded to review, when it was. */
  downgraded?: ToneDowngrade;
  excerpt: string;
}

function fold(text: string): string {
  // Typographic apostrophes fold to ' so "don’t" matches "don't".
  return foldText(text).replace(/[’]/g, "'");
}

function phraseRegex(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu');
}

const COMPILED = new Map<ContentLocale, Array<ToneEntry & { re: RegExp }>>();
function compiled(locale: ContentLocale): Array<ToneEntry & { re: RegExp }> {
  let entries = COMPILED.get(locale);
  if (!entries) {
    entries = TONE_LEXICON[locale].map((entry) => ({ ...entry, re: phraseRegex(entry.phrase) }));
    COMPILED.set(locale, entries);
  }
  return entries;
}

/**
 * Quoted spans. Straight single quotes count only when they open after a
 * non-letter and close before one, so an apostrophe ("don't", "Liruf's")
 * never opens a quote.
 */
function quotedRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const pattern = /"[^"]*"|“[^”]*”|«[^»]*»|‘[^’']*['’]|(?<![\p{L}\p{N}])'[^'\n]+?'(?![\p{L}\p{N}])/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) ranges.push([match.index, match.index + match[0].length - 1]);
  return ranges;
}

function wordsBefore(folded: string, index: number): string[] {
  return folded.slice(0, index).match(/[\p{L}\p{N}']+/gu) ?? [];
}

/** Scans one string. Folding preserves string length for the Latin scripts used here, so indexes line up. */
export function scanTone(text: string, locale: ContentLocale, surface: ToneSurface, options: { examined?: boolean } = {}): ToneFinding[] {
  const folded = fold(text);
  const quotes = quotedRanges(folded);
  const findings: ToneFinding[] = [];
  for (const entry of compiled(locale)) {
    entry.re.lastIndex = 0;
    const match = entry.re.exec(folded); // one finding per phrase per string is enough to act on
    if (!match) continue;
    let severity = entry[surface];
    let downgraded: ToneDowngrade | undefined;
    if (severity === 'block') {
      const at = match.index;
      const before = wordsBefore(folded, at);
      if (options.examined) downgraded = 'examined';
      else if (quotes.some(([start, end]) => at > start && at < end)) downgraded = 'quoted';
      else if (before.slice(-NEGATION_WINDOW_WORDS).some((word) => NEGATIONS[locale].has(word))) downgraded = 'negated';
      else if (before.slice(-WARNING_CUE_WINDOW_WORDS).some((word) => WARNING_CUES[locale].has(word))) downgraded = 'warned';
      if (downgraded) severity = 'review';
    }
    findings.push({ phrase: entry.phrase, category: entry.category, severity, ...(downgraded ? { downgraded } : {}), excerpt: excerpt(text) });
  }
  // "no attempts left" also contains "attempts left": report the most specific phrase only.
  return findings.filter((finding) => !findings.some((other) => other !== finding && other.phrase.length > finding.phrase.length && other.phrase.includes(finding.phrase)));
}

/** The advice an author gets with a finding: what to do instead, per category. */
export function toneAdvice(category: ToneCategory): string {
  switch (category) {
    case 'banking-frame':
      return 'Law 2: speak like a mentor, never like a bank — describe what the learner earned, saved, chose or waited for, in concrete calm words, not account or transaction language';
    case 'hype-urgency':
      return 'Law 2: no hype, yield-chasing, FOMO or urgency — if the lesson is examining a scam or ad, quote the message or name it as a warning sign so a reviewer can confirm it is analysed, not voiced';
    case 'procedural':
      return 'Law 2 and B.14: resource-exhaustion wording reads as a system, not a mentor — say what happens next ("Let\'s look at it together"), never what ran out';
  }
}

// Money Moments — Oracle v1's pack generator (Little Language Lessons' Tiny
// Lesson pattern, 2026-07-25 analysis, made §1.9-safe: the situation taxonomy
// is a CLOSED, human-curated set — kid free text never reaches a provider —
// and every pack is generated OFFLINE, validated, judged, and human-published
// before any child sees it. Runtime "on demand" = a Vault read.

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import { completeDeepSeek } from '../providers/deepseek.js';
import type { UsageLedger } from '../providers/usage.js';
import { readabilityScore, type ReadabilityLocale } from '../pipeline/readability.js';
import { safeJsonParse, withCorrectiveRetry, formatZodIssues } from '../pipeline/correctiveRetry.js';

// ---- situations catalog ------------------------------------------------------

const localized = z.object({ 'en-US': z.string().min(1), 'es-MX': z.string().min(1), 'pt-BR': z.string().min(1) });

export const situationSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  icon: z.string().min(1),
  position: z.number().int().min(0),
  tiers: z.array(z.string().regex(/^tier\d+$/)).min(1),
  title: localized,
  description: localized,
});

export const situationsFileSchema = z.object({
  schema_version: z.literal(1),
  situations: z.array(situationSchema).min(1),
});

export type Situation = z.infer<typeof situationSchema>;

export function loadSituations(path: string): Situation[] {
  const parsed = situationsFileSchema.parse(parseYaml(readFileSync(path, 'utf8')));
  const ids = new Set<string>();
  for (const s of parsed.situations) {
    if (ids.has(s.id)) throw new Error(`money-moments: duplicate situation id "${s.id}"`);
    ids.add(s.id);
  }
  return [...parsed.situations].sort((a, b) => a.position - b.position);
}

// ---- pack contract -----------------------------------------------------------

const md = z.string().min(1).max(400);

export const packSchema = z.object({
  /** 3-5 key money words for the situation, defined in kid words. */
  terms: z.array(z.object({ term: z.string().min(1).max(60), kid_definition: md })).min(3).max(5),
  /** 2-3 things the kid could actually SAY or DO in the moment, each with its why. */
  phrases: z.array(z.object({ say_md: md, why_md: md })).min(2).max(3),
  /** One quick check — exactly one correct option, every wrong one carries a rationale. */
  quick_check: z.object({
    question_md: md,
    options: z
      .array(z.object({ id: z.string().min(1).max(20), text_md: md, correct: z.boolean(), rationale_md: md }))
      .length(3),
  }),
});
export type MoneyMomentPack = z.infer<typeof packSchema>;

/** Deterministic validation beyond Zod — the free half of the gate. */
export function validatePack(pack: MoneyMomentPack, locale: ReadabilityLocale, tierForbidden: readonly string[]): string[] {
  const problems: string[] = [];
  const correct = pack.quick_check.options.filter((o) => o.correct);
  if (correct.length !== 1) problems.push(`quick_check must have EXACTLY one correct option (got ${correct.length})`);
  const optionIds = new Set(pack.quick_check.options.map((o) => o.id));
  if (optionIds.size !== pack.quick_check.options.length) problems.push('quick_check option ids must be unique');

  const allText = [
    ...pack.terms.flatMap((t) => [t.term, t.kid_definition]),
    ...pack.phrases.flatMap((p) => [p.say_md, p.why_md]),
    pack.quick_check.question_md,
    ...pack.quick_check.options.flatMap((o) => [o.text_md, o.rationale_md]),
  ].join(' ');
  const lower = allText.toLowerCase();
  for (const word of tierForbidden) {
    if (lower.includes(word.toLowerCase())) problems.push(`forbidden vocabulary for this tier: "${word}"`);
  }
  const score = readabilityScore(allText, locale);
  // Same OUTLIER philosophy as gate 9 — packs are short, bands stay wide.
  if (score !== null) {
    if (locale === 'en-US' && score > 13) problems.push(`readability grade ${score.toFixed(1)} reads adult`);
    if (locale === 'es-MX' && score < 54) problems.push(`Fernández-Huerta ease ${score.toFixed(0)} reads adult`);
    if (locale === 'pt-BR' && score < 46) problems.push(`Flesch-PT ease ${score.toFixed(0)} reads adult`);
  }
  return problems;
}

// ---- generation ---------------------------------------------------------------

export interface GeneratePackDeps {
  ledger?: UsageLedger;
  complete?: typeof completeDeepSeek;
}

const TIER_VOICE: Record<string, string> = {
  tier1: 'para 6-7 años: frases muy cortas, palabras cotidianas, cero abstracción',
  tier2: 'para 8-9 años: frases cortas, ejemplos concretos con números pequeños',
  tier3: 'para 10-12 años: puede razonar en dos pasos, sigue siendo concreto y cálido',
};

const LOCALE_WORLD: Record<string, string> = {
  'es-MX': 'México: pesos, tiendita, tianguis — nunca dólares ni malls gringos',
  'en-US': 'United States: dollars, corner store, yard sale',
  'pt-BR': 'Brasil: reais, vendinha, feira',
};

// Static-first (prefix-cache discipline): contract + shape lead; the
// situation tail varies per call.
function packMessages(situation: Situation, tier: string, locale: 'en-US' | 'es-MX' | 'pt-BR') {
  const system =
    'Eres Oracle, el tutor de dinero de LittleFounders. Creas "Money Moments": mini-guías para UN momento real ' +
    'con dinero que un niño vive hoy. Application, not recall: cada término se define por lo que el niño HACE con él. ' +
    'Responde SOLO JSON estricto con esta forma exacta: ' +
    '{"terms":[{"term":"...","kid_definition":"..."}] (3-5), ' +
    '"phrases":[{"say_md":"qué decir/hacer","why_md":"por qué funciona"}] (2-3), ' +
    '"quick_check":{"question_md":"...","options":[{"id":"a","text_md":"...","correct":true,"rationale_md":"por qué sí/no"}] (EXACTAMENTE 3, UNA correcta)}. ' +
    'Los distractores son concepciones erróneas reales, nunca opciones tontas. Sin markdown fences.';
  const user =
    `SITUACIÓN: ${situation.title[locale]} — ${situation.description[locale]}\n` +
    `VOZ: ${TIER_VOICE[tier] ?? TIER_VOICE.tier2}\n` +
    `MUNDO: ${LOCALE_WORLD[locale]}\n` +
    `IDIOMA DE SALIDA: ${locale}`;
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ];
}

/** Generate one pack (situation × tier × locale) with corrective retries. Caller runs validatePack + the judge before anything persists as publishable. */
export async function generatePack(
  situation: Situation,
  tier: string,
  locale: 'en-US' | 'es-MX' | 'pt-BR',
  deps: GeneratePackDeps = {},
): Promise<MoneyMomentPack> {
  const complete = deps.complete ?? completeDeepSeek;
  const { data } = await withCorrectiveRetry<MoneyMomentPack>({
    maxAttempts: 3,
    callModel: async (issues) => {
      const messages = packMessages(situation, tier, locale);
      if (issues) messages.push({ role: 'user' as const, content: `Tu JSON anterior falló: ${issues}. Reenvía el JSON completo corregido.` });
      const result = await complete({ messages, temperature: 0.5, maxTokens: 2500, jsonMode: true }, { operation: 'tutor-pack', ledger: deps.ledger });
      return result.content;
    },
    parse: (raw) => {
      const json = safeJsonParse(raw);
      if (!json.ok) return { ok: false, issues: json.error };
      const parsed = packSchema.safeParse(json.value);
      if (!parsed.success) return { ok: false, issues: formatZodIssues(parsed.error.issues) };
      return { ok: true, data: parsed.data };
    },
  });
  return data;
}

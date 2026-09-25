// B.16 — the Regional Adaptation Gate (Appendix C Stage 2, gate 6; Forge gate 16).
//
// "Add a regional-adaptation layer to the content-generation pipeline, beyond
// translation — adjusting examples, amounts, and context per market, informed
// by each market's specific financial-literacy research profile. This must
// produce a named, documented 'Regional Adaptation Gate' in Forge with an
// explicit per-market checklist, owned by the content/learning-design team."
//
// The written policy and checklist: docs/content/REGIONAL-ADAPTATION-GATE.md.
// The market problem inventory: coursegen/regional/markets.yaml.
//
//   required   — a lesson needs per-market scenarios when it cites real-world
//                money facts (currency-unit or currency-namespaced facts) or its
//                briefs carry market context (an inventory anchor, a currency
//                amount such as "20 pesos" or "$5"). Deterministic, from the
//                catalog alone.
//   catalog    — a required lesson declares `regional_scenarios` for every
//                market; each scenario cites its own market's research problems,
//                declares anchors that belong to it, uses facts in its own
//                currency, and is not a copy of the authoring market's brief.
//   document   — a lesson document for market M that carries another market's
//                context (anchors, currency amounts, currency codes) was
//                translated, not localized: it blocks, with or without a
//                catalog. With the catalog, a required lesson's M document must
//                show at least one of M's declared anchors and none of the other
//                markets' declared anchors, and a required lesson with no
//                scenarios cannot ship in a non-authoring market at all.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { FactsFile, MarketScenario } from '../catalog/schema.js';
import { foldText, hasTerm, termRegex, tokens } from './text.js';
import type { ContentLocale } from './budgets.js';

export const MARKETS: readonly ContentLocale[] = ['es-MX', 'en-US', 'pt-BR'];
export const AUTHORING_MARKET: ContentLocale = 'es-MX';
/** A non-authoring scenario brief this similar to the authoring one is the same brief (token Jaccard). */
export const SCENARIO_COPY_THRESHOLD = 0.8;

const problemSchema = z
  .object({
    id: z.string().regex(/^[a-z]{2}-[a-z0-9-]+$/),
    statement: z.string().min(20).max(600),
    evidence: z.enum(['cited', 'hypothesis']),
    sources: z.array(z.string().min(5).max(300)),
    lesson_implications: z.string().min(20).max(600),
  })
  .strict()
  .refine((p) => p.evidence === 'hypothesis' || p.sources.length > 0, { message: 'a cited problem needs at least one source' });

const marketSchema = z
  .object({
    country: z.string().min(2).max(60),
    content_locale: z.enum(['es-MX', 'en-US', 'pt-BR']),
    currency: z
      .object({
        code: z.string().regex(/^[A-Z]{3}$/),
        words: z.array(z.string().min(2).max(20)).min(1),
        symbols: z.array(z.string().min(1).max(4)).min(1),
        /** The world reference currency: its mentions in another market's lesson are legitimate (teens compare to dollars). */
        international: z.boolean().optional(),
      })
      .strict(),
    research_profile: z.string().min(40).max(1200),
    problems: z.array(problemSchema).min(1),
    anchors: z.array(z.string().min(2).max(40)).min(1),
  })
  .strict();

export const marketInventorySchema = z
  .object({
    schema_version: z.literal(1),
    markets: z
      .object({ 'es-MX': marketSchema, 'en-US': marketSchema, 'pt-BR': marketSchema })
      .strict(),
  })
  .strict()
  .superRefine((inventory, ctx) => {
    for (const [key, market] of Object.entries(inventory.markets)) {
      if (market.content_locale !== key) ctx.addIssue({ code: 'custom', path: ['markets', key, 'content_locale'], message: `must be ${key}` });
      const prefix = key.slice(3).toLowerCase(); // es-MX → mx
      for (const problem of market.problems) {
        if (!problem.id.startsWith(`${prefix}-`)) ctx.addIssue({ code: 'custom', path: ['markets', key, 'problems'], message: `${problem.id} must start with "${prefix}-"` });
      }
    }
  });

export type MarketInventory = z.infer<typeof marketInventorySchema>;
export type Market = MarketInventory['markets']['es-MX'];

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MARKETS_FILE = path.resolve(here, '../../regional/markets.yaml');

let cached: MarketInventory | undefined;
/** The market problem inventory (coursegen/regional/markets.yaml); throws on an invalid file. */
export function loadMarketInventory(file: string = DEFAULT_MARKETS_FILE): MarketInventory {
  if (file === DEFAULT_MARKETS_FILE && cached) return cached;
  if (!existsSync(file)) throw new Error(`market inventory not found: ${file}`);
  const parsed = marketInventorySchema.safeParse(parseYaml(readFileSync(file, 'utf8')));
  if (!parsed.success) throw new Error(`invalid market inventory ${file}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  if (file === DEFAULT_MARKETS_FILE) cached = parsed.data;
  return parsed.data;
}

// ---- requirement ------------------------------------------------------------------

export interface RegionalPolicy {
  required: boolean;
  reasons: string[];
  scenarios?: Record<ContentLocale, MarketScenario>;
  universal?: string;
}

function currencyAmountRegexes(market: Market): RegExp[] {
  const out: RegExp[] = [];
  for (const word of market.currency.words) {
    const w = foldText(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out.push(new RegExp(`\\d[\\d.,]*\\s*${w}(?![\\p{L}\\p{N}])`, 'u'), new RegExp(`(?<![\\p{L}\\p{N}])${w}\\s*\\d`, 'u'));
  }
  return out;
}

/** The market context a brief carries: currency amounts and inventory anchors. */
export function marketContextIn(text: string, market: Market): string[] {
  const folded = foldText(text);
  const found: string[] = [];
  for (const re of currencyAmountRegexes(market)) {
    const match = re.exec(folded);
    if (match) found.push(match[0].trim());
  }
  for (const symbol of market.currency.symbols) {
    const match = new RegExp(`${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s?\\d`, 'u').exec(folded);
    if (match) found.push(match[0].trim());
  }
  for (const anchor of market.anchors) if (hasTerm(folded, anchor)) found.push(anchor);
  return [...new Set(found)];
}

const CURRENCY_FACT_PREFIX = /^(mxn|brl|usd)\./;

/** Which currency a fact is in, when it is money: its unit, or its namespace. */
export function factCurrency(facts: FactsFile | undefined, ref: string): string | undefined {
  const unit = facts?.facts[ref]?.unit;
  if (unit && /^[A-Z]{3}$/.test(unit) && ['MXN', 'BRL', 'USD'].includes(unit)) return unit;
  const prefix = CURRENCY_FACT_PREFIX.exec(ref);
  return prefix ? prefix[1]!.toUpperCase() : undefined;
}

export interface RegionalLessonInput {
  slug: string;
  path: string;
  /** Topic fact_refs plus the lesson's own. */
  factRefs: readonly string[];
  /** Authoring-locale briefs: micro_objective, narrative_beat, topic concept and objective. */
  briefs: readonly string[];
  scenarios?: { universal: string } | Record<ContentLocale, MarketScenario>;
}

export function regionalRequirement(input: RegionalLessonInput, facts: FactsFile | undefined, inventory: MarketInventory): { required: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const ref of input.factRefs) {
    const currency = factCurrency(facts, ref);
    if (currency) reasons.push(`cites the ${currency} fact ${ref}`);
  }
  const authoring = inventory.markets[AUTHORING_MARKET];
  for (const brief of input.briefs) for (const context of marketContextIn(brief, authoring)) reasons.push(`its brief carries ${authoring.country} context "${context}"`);
  const unique = [...new Set(reasons)];
  return { required: unique.length > 0, reasons: unique };
}

// ---- catalog --------------------------------------------------------------------------

export interface RegionalCatalogFinding {
  lesson: string;
  severity: 'block' | 'review';
  message: string;
}

function jaccard(a: string, b: string): number {
  const sa = new Set(tokens(a));
  const sb = new Set(tokens(b));
  if (sa.size === 0 && sb.size === 0) return 1;
  let shared = 0;
  for (const t of sa) if (sb.has(t)) shared += 1;
  return shared / (sa.size + sb.size - shared);
}

export function analyzeRegionalLesson(
  input: RegionalLessonInput,
  facts: FactsFile | undefined,
  inventory: MarketInventory,
): { policy: RegionalPolicy; findings: RegionalCatalogFinding[] } {
  const { required, reasons } = regionalRequirement(input, facts, inventory);
  const findings: RegionalCatalogFinding[] = [];
  const block = (message: string) => findings.push({ lesson: input.slug, severity: 'block', message: `${input.path}: ${message}` });
  const review = (message: string) => findings.push({ lesson: input.slug, severity: 'review', message: `${input.path}: ${message}` });
  const declared = input.scenarios;

  if (!declared) {
    if (required) block(`needs a scenario per market (B.16: localized, not translated) because it ${reasons.join('; ')} — declare regional_scenarios for es-MX, en-US and pt-BR`);
    return { policy: { required, reasons }, findings };
  }
  if ('universal' in declared) {
    if (required) block(`is declared market-neutral ("${declared.universal}") but it ${reasons.join('; ')} — write a scenario per market instead`);
    else review(`declared market-neutral: "${declared.universal}" — Stage 3 confirms no market context is needed`);
    return { policy: { required, reasons, universal: declared.universal }, findings };
  }

  const scenarios = declared as Record<ContentLocale, MarketScenario>;
  for (const locale of MARKETS) {
    const market = inventory.markets[locale];
    const scenario = scenarios[locale];
    const problems = new Map(market.problems.map((p) => [p.id, p]));
    for (const ref of scenario.problem_refs) {
      const problem = problems.get(ref);
      if (!problem) block(`${locale} scenario cites "${ref}", which is not a ${market.country} problem in coursegen/regional/markets.yaml`);
      else if (problem.evidence === 'hypothesis') review(`${locale} scenario rests on the unvalidated hypothesis "${ref}" — the learning-design team validates it before release`);
    }
    for (const ref of scenario.fact_refs ?? []) {
      if (!facts?.facts[ref]) {
        block(`${locale} scenario cites the unknown fact "${ref}"`);
        continue;
      }
      const currency = factCurrency(facts, ref);
      if (currency && currency !== market.currency.code) block(`${locale} scenario uses the ${currency} fact "${ref}"; ${market.country} amounts come from ${market.currency.code} facts`);
    }
    for (const other of MARKETS.filter((l) => l !== locale)) {
      const otherMarket = inventory.markets[other];
      for (const anchor of scenario.anchors) {
        const folded = foldText(anchor);
        if (otherMarket.anchors.some((a) => foldText(a) === folded) || scenarios[other].anchors.some((a) => foldText(a) === folded)) {
          block(`${locale} anchor "${anchor}" also marks ${otherMarket.country}; an anchor must identify this market only`);
        }
      }
    }
    if (locale !== AUTHORING_MARKET && jaccard(scenario.scenario, scenarios[AUTHORING_MARKET].scenario) >= SCENARIO_COPY_THRESHOLD) {
      block(`the ${locale} scenario repeats the ${AUTHORING_MARKET} brief; describe ${market.country}'s own situation, amounts and context`);
    }
  }
  review(`per-market scenarios need content-team sign-off against the checklist in docs/content/REGIONAL-ADAPTATION-GATE.md (amounts and everyday context are judged there)`);
  return { policy: { required, reasons, scenarios }, findings };
}

// ---- document -----------------------------------------------------------------------

export interface RegionalDocFinding {
  kind: 'foreign-anchor' | 'foreign-currency' | 'untranslated-scenario' | 'scenario-not-applied' | 'other-scenario-anchor';
  message: string;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Currency marks of another market that are wrong in a `locale` document. */
function foreignCurrency(folded: string, locale: ContentLocale, inventory: MarketInventory): string[] {
  const own = inventory.markets[locale];
  const found: string[] = [];
  for (const other of MARKETS.filter((l) => l !== locale)) {
    const market = inventory.markets[other];
    if (market.currency.international) continue;
    for (const re of currencyAmountRegexes(market)) {
      const match = re.exec(folded);
      if (match) found.push(match[0].trim());
    }
    const code = termRegex(market.currency.code).exec(folded);
    if (code) found.push(market.currency.code);
    for (const symbol of market.currency.symbols) {
      const s = foldText(symbol);
      if (own.currency.symbols.some((mine) => foldText(mine) === s)) continue;
      // "$" is foreign in pt-BR, but "R$" contains it: exclude own symbols that end with it.
      const guards = own.currency.symbols
        .map((mine) => foldText(mine))
        .filter((mine) => mine.endsWith(s) && mine !== s)
        .map((mine) => `(?<!${escape(mine.slice(0, -s.length))})`)
        .join('');
      const match = new RegExp(`${guards}${escape(s)}\\s?\\d`, 'u').exec(folded);
      if (match) found.push(match[0].trim());
    }
  }
  return [...new Set(found)];
}

export function checkRegionalDocument(
  documentText: string,
  locale: ContentLocale,
  policy: RegionalPolicy | undefined,
  inventory: MarketInventory,
): RegionalDocFinding[] {
  const folded = foldText(documentText);
  const findings: RegionalDocFinding[] = [];
  const market = inventory.markets[locale];

  for (const other of MARKETS.filter((l) => l !== locale)) {
    const otherMarket = inventory.markets[other];
    for (const anchor of otherMarket.anchors) {
      if (hasTerm(folded, anchor)) {
        findings.push({ kind: 'foreign-anchor', message: `"${anchor}" is ${otherMarket.country} context in a ${market.country} (${locale}) lesson — translated, not localized (B.16)` });
      }
    }
  }
  for (const mark of foreignCurrency(folded, locale, inventory)) {
    findings.push({ kind: 'foreign-currency', message: `"${mark}" is another market's currency in a ${market.country} (${locale}) lesson — use ${market.currency.code} (${market.currency.symbols.join(', ')})` });
  }

  if (policy?.required) {
    if (!policy.scenarios) {
      if (locale !== AUTHORING_MARKET) {
        findings.push({
          kind: 'untranslated-scenario',
          message: `this lesson needs a ${market.country} scenario (${policy.reasons.join('; ')}) and has none: it would ship as a translation of the ${AUTHORING_MARKET} lesson`,
        });
      }
    } else {
      const own = policy.scenarios[locale];
      if (!own.anchors.some((anchor) => hasTerm(folded, anchor))) {
        findings.push({ kind: 'scenario-not-applied', message: `none of the ${locale} scenario anchors (${own.anchors.join(', ')}) appears: the ${market.country} scenario was not applied` });
      }
      for (const other of MARKETS.filter((l) => l !== locale)) {
        for (const anchor of policy.scenarios[other].anchors) {
          const reported = findings.some((f) => f.kind === 'foreign-anchor' && f.message.startsWith(`"${anchor}"`));
          if (!reported && hasTerm(folded, anchor)) findings.push({ kind: 'other-scenario-anchor', message: `"${anchor}" belongs to the ${other} scenario, not the ${locale} one` });
        }
      }
    }
  }
  return findings;
}

/** The adaptation brief handed to the localizer for one market (B.16's layer beyond translation). */
export function adaptationBrief(policy: RegionalPolicy | undefined, locale: ContentLocale, inventory: MarketInventory): string | undefined {
  if (!policy?.required || !policy.scenarios) return undefined;
  const market = inventory.markets[locale];
  const scenario = policy.scenarios[locale];
  const problems = market.problems.filter((p) => scenario.problem_refs.includes(p.id)).map((p) => p.lesson_implications);
  const foreign = MARKETS.filter((l) => l !== locale).flatMap((l) => [...inventory.markets[l].anchors, ...policy.scenarios![l].anchors]);
  return [
    `REGIONAL ADAPTATION (B.16, hard gate 16): this lesson is LOCALIZED for ${market.country}, not translated. Replace the source's ${inventory.markets[AUTHORING_MARKET].country} situation with this ${market.country} scenario: ${scenario.scenario}`,
    `Research focus for ${market.country}: ${problems.join(' ')}`,
    `The result MUST use at least one of these ${market.country} words: ${scenario.anchors.join(', ')}. It must NOT keep any of: ${[...new Set(foreign)].join(', ')}. Currency: ${market.currency.code} (${market.currency.symbols.join(', ')}).`,
  ].join('\n');
}

// `localize` stage — es-MX GameDocument -> {en-US, pt-BR} (GAME_ENGINE.md §9).
//
// STRUCTURE IS FROZEN PROGRAMMATICALLY, not by asking the model nicely. Only
// learner-visible strings are extracted into an indexed map, DeepSeek translates just
// that map, and each translation is written back at the exact path it came from. The
// model never SEES an id, a number, an enum, a sprite URL or a mechanic config value,
// so it cannot drift them — see `nonVisibleKeys.ts` for what the freeze covers and, in
// particular, why it skips CONTAINERS rather than leaf field names.
//
// ORDERING THAT THIS STAGE DEPENDS ON: `illustrate` runs on the es-MX document BEFORE
// `localize` (gamegen/AGENTS.md), so `skin.sprites` / `skin.background_url` are already
// populated when we get here and are copied through verbatim — one image serves three
// locales. If that order is ever swapped, this stage becomes 3x the image bill, not a
// translation bug you would notice.
//
// NO CURRENCY REMAP TWIN. coursegen needs `remapCurrency()` because a lesson document
// carries `currency: "MXN"` / `unit: "pesos"` ENUM fields that the freeze copies
// verbatim, leaving en-US lessons formatting pesos. A GameDocument has no such field:
// the only currency-shaped keys in the whole contract are explorer's
// `config.currency.{start,target,…}` and `nodes[].currency_reward`, which are plain
// NUMBERS of play money with no unit attached. Money in a game is prose inside
// `label_md` ("Boleto $20"), so the peso->dollar/real conversion is a translation
// instruction (below), not a post-pass. Add a remap here only if a currency ENUM is
// ever added to the contract.

import { completeDeepSeek } from '../providers/deepseek.js'
import type { ChatMessage } from '../providers/openaiChat.js'
import type { UsageLedger } from '../providers/usage.js'
import { parseGameDocumentSync } from '../contract/core/schema.js'
import type { GameDocument, GameLocale } from '../contract/core/types.js'
import { withCorrectiveRetry, safeJsonParse } from './correctiveRetry.js'
import { extractVisibleStrings, frozenSkeleton, setAtPath } from './nonVisibleKeys.js'

/** es-MX is the authoring locale; these are the two the pipeline derives from it. */
export type GameTargetLocale = Exclude<GameLocale, 'es-MX'>

/** Structural shape of a gate finding — kept minimal on purpose so this module does not
 *  depend on the gate module's own types (see `LocalizeGameDeps.regate`). */
export interface LocalizeGameProblem {
  message: string
}

export class LocalizeGameVocabError extends Error {
  readonly locale: GameTargetLocale
  readonly problems: readonly LocalizeGameProblem[]

  constructor(locale: GameTargetLocale, problems: readonly LocalizeGameProblem[]) {
    super(
      `localize: ${locale} re-gate found ${problems.length} forbidden-vocabulary hit(s) after translation`,
    )
    this.name = 'LocalizeGameVocabError'
    this.locale = locale
    this.problems = problems
  }
}

const MAX_TRANSLATE_ATTEMPTS = 3

/**
 * Completion budget. Sized by REASONING + answer, never by answer length:
 * `DEEPSEEK_MODEL` is a reasoning model, so it spends tokens thinking before the first
 * character of JSON appears, and a starved completion comes back truncated mid-string
 * (coursegen measured 477 reasoning tokens to translate a three-word title).
 */
const TRANSLATE_MAX_TOKENS = 8192

/**
 * The system prompt. BYTE-STABLE per target locale on purpose: DeepSeek's context cache
 * is automatic and prefix-based, so every game in a run re-sends an identical leading
 * block and bills the cached rate. Nothing per-game may be interpolated here — the
 * per-game payload is the user message, and a corrective retry APPENDS after it
 * (`withCorrectiveRetry`), so attempts 2..N keep the same cacheable prefix.
 */
function systemPrompt(targetLocale: GameTargetLocale): string {
  const localeName =
    targetLocale === 'en-US' ? 'English (US)' : 'Brazilian Portuguese (pt-BR)'
  const currencyLine =
    targetLocale === 'en-US'
      ? 'CURRENCY: this is play money for kids — convert Mexican pesos to US DOLLARS. Replace "peso/pesos" with "dollar/dollars"; keep the "$" symbol and every NUMBER exactly the same (do NOT apply exchange rates — 20 pesos becomes 20 dollars). The numbers are game mechanics: changing one breaks the simulation.'
      : 'CURRENCY: this is play money for kids — convert Mexican pesos to Brazilian REAIS. Replace "peso/pesos" with "real/reais" and the "$" symbol with "R$"; keep every NUMBER exactly the same (do NOT apply exchange rates — 20 pesos becomes 20 reais). The numbers are game mechanics: changing one breaks the simulation.'
  const colloquialLine =
    targetLocale === 'en-US'
      ? 'COLLOQUIAL TOUCHES: the source may carry an occasional light Mexican colloquialism ("¡órale!", "¡qué padre!", "¡ándale!"). NEVER translate these literally — render each as a natural, G-rated, everyday American English equivalent of the same weight ("awesome!", "no way!", "come on!"), and keep the dosage identical: if a sentence is neutral in the source, keep it neutral — never ADD slang the source does not have.'
      : 'COLLOQUIAL TOUCHES: the source may carry an occasional light Mexican colloquialism ("¡órale!", "¡qué padre!", "¡ándale!"). NEVER translate these literally — render each as a natural, G-rated, everyday Brazilian Portuguese equivalent of the same weight ("que legal!", "demais!", "beleza!"), and keep the dosage identical: if a sentence is neutral in the source, keep it neutral — never ADD slang the source does not have.'

  return [
    `You translate children's financial-literacy MINIGAME text from Mexican Spanish (es-MX) into ${localeName} for LittleFounders.`,
    'These strings are drawn inside a moving game canvas — an item label on a falling tile, a category bin, a one-line cheer — not paragraphs on a page. Keep the warm, encouraging, age-appropriate register.',
    'LENGTH IS A HARD CONSTRAINT, not a preference: every field is length-capped by a schema (item labels ~80 characters, feedback lines ~200) and an over-long translation is REJECTED. A translation must never be meaningfully longer than its source; when your language runs long, compress — drop filler words, take the shorter synonym.',
    'Item and category labels must stay ONE short, literal, drawable object name that a 6-year-old reads at a glance and a text-to-speech voice says cleanly ("Manzana" -> "Apple"). Never expand a label into a sentence.',
    'Preserve MarkdownLite markup exactly (**bold**, *italic*, `code`, "- " lists, line breaks) and preserve any EMOJI exactly as-is — same emoji, same position. Never add markup or emoji the source does not have.',
    currencyLine,
    colloquialLine,
    'Output ONLY a strict flat JSON object mapping each input key to its translation — same keys, translated values, nothing else.',
  ].join(' ')
}

function buildTranslateMessages(
  indexMap: Record<string, string>,
  targetLocale: GameTargetLocale,
  issues: string | undefined,
): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(targetLocale) },
    {
      role: 'user',
      content: [
        'Translate every value in this JSON object. Return an object with EXACTLY the same keys.',
        JSON.stringify(indexMap),
      ].join('\n'),
    },
  ]
  if (issues !== undefined) {
    // APPENDED, never spliced into the messages above: the leading bytes must stay
    // identical across attempts or the prefix cache misses and the retry costs full price.
    messages.push({
      role: 'user',
      content: `Your previous reply was rejected. Fix ONLY what is listed and resend the complete object: ${issues}`,
    })
  }
  return messages
}

export interface LocalizeGameDeps {
  ledger?: UsageLedger
  /** Injected in tests; production uses the real DeepSeek chokepoint (budget + ledger). */
  translate?: typeof completeDeepSeek
  /**
   * Target-locale re-gate, wired by `run.ts`. Forbidden-vocabulary lists are PER LOCALE
   * (gamegen/AGENTS.md), so a document that passed the es-MX vocabulary gate can land on
   * a forbidden en-US or pt-BR word purely through translation — the gate has to run
   * again on the OUTPUT. Injected rather than imported so this module stays free of the
   * gate module's own types; when it is absent no re-gate happens, which is a wiring
   * gap, not a licence to skip it.
   */
  regate?: (document: GameDocument, locale: GameTargetLocale) => readonly LocalizeGameProblem[]
}

export interface LocalizeGameResult {
  document: GameDocument
  targetLocale: GameTargetLocale
  /** Corrective attempts consumed (1 = first reply was accepted). */
  attempts: number
}

/**
 * Translate one authored GameDocument into one target locale, freezing everything the
 * player does not read.
 *
 * POST-CONDITIONS, all enforced (a violation throws — never publishes):
 *  1. the result parses against the SAME contract (`parseGameDocumentSync`), so ids,
 *     URLs, enums, closed sets and length caps all still hold;
 *  2. its frozen skeleton is byte-identical to the source's — identical ids, identical
 *     numbers, identical sprite URLs, identical key order;
 *  3. `meta.locale` is the target locale;
 *  4. the injected target-locale vocabulary re-gate, if wired, found nothing.
 *
 * Both `BudgetExceededError` and a fatal provider error PROPAGATE out of here untouched:
 * the kill switch only exists if the error escapes.
 */
export async function localizeGame(
  sourceDocument: GameDocument,
  targetLocale: GameTargetLocale,
  deps: LocalizeGameDeps = {},
): Promise<LocalizeGameResult> {
  if (sourceDocument.meta.locale === targetLocale) {
    throw new Error(
      `localize: source document is already ${targetLocale} — refusing to pay for a no-op translation`,
    )
  }
  const translate = deps.translate ?? completeDeepSeek

  const extracted = extractVisibleStrings(sourceDocument)
  // A document with no prose is not a document, but paying for an empty map would be a
  // silent waste, so refuse loudly instead.
  if (extracted.length === 0) {
    throw new Error('localize: source document contains no translatable string')
  }

  const indexMap: Record<string, string> = {}
  extracted.forEach((entry, index) => {
    indexMap[String(index)] = entry.value
  })
  const expectedKeys = Object.keys(indexMap)

  // The structure the translation must reproduce EXACTLY. Built with the locale already
  // swapped, because `meta.locale` is itself a frozen field that legitimately changes.
  const localeSwappedSource: GameDocument = structuredClone(sourceDocument)
  localeSwappedSource.meta.locale = targetLocale
  const expectedSkeleton = frozenSkeleton(localeSwappedSource)

  const { data: document, attempts } = await withCorrectiveRetry<GameDocument>({
    maxAttempts: MAX_TRANSLATE_ATTEMPTS,
    callModel: async (issues) => {
      const result = await translate(
        {
          messages: buildTranslateMessages(indexMap, targetLocale, issues),
          temperature: 0.3,
          jsonMode: true,
          maxTokens: TRANSLATE_MAX_TOKENS,
        },
        { operation: 'localize', ledger: deps.ledger },
      )
      return result.content
    },
    // Validation lives INSIDE the retry loop on purpose: a length overflow
    // ("content.items.3.label_md: Too big") is exactly the kind of finding a model can
    // act on, and feeding it back costs one cheap corrective attempt instead of failing
    // the slot and re-running the whole paid stage.
    parse: (raw) => {
      const json = safeJsonParse(raw)
      if (!json.ok) return { ok: false, issues: `invalid JSON: ${json.error}` }
      if (typeof json.value !== 'object' || json.value === null || Array.isArray(json.value)) {
        return { ok: false, issues: 'expected a flat JSON object of key -> translated string' }
      }
      const record = json.value as Record<string, unknown>

      const missing = expectedKeys.filter((key) => !(key in record))
      if (missing.length > 0) {
        return { ok: false, issues: `missing keys: ${missing.slice(0, 10).join(', ')}` }
      }
      const nonString = expectedKeys.filter((key) => typeof record[key] !== 'string')
      if (nonString.length > 0) {
        return {
          ok: false,
          issues: `values must be strings; not strings at keys: ${nonString.slice(0, 10).join(', ')}`,
        }
      }

      const candidate: GameDocument = structuredClone(sourceDocument)
      candidate.meta.locale = targetLocale
      for (const [index, entry] of extracted.entries()) {
        const translated = record[String(index)]
        if (typeof translated !== 'string') continue // already rejected above
        if (!setAtPath(candidate, entry.path, translated)) {
          return { ok: false, issues: `internal: lost path ${entry.path.join('.')} during re-injection` }
        }
      }

      if (frozenSkeleton(candidate) !== expectedSkeleton) {
        // Unreachable through the model (it only ever sees the string map), so this
        // fires on OUR bug — a path collision or a mutated source — never on its output.
        return { ok: false, issues: 'internal: re-injection changed the frozen structure' }
      }

      const parsed = parseGameDocumentSync(candidate)
      if (!parsed.ok) {
        return { ok: false, issues: parsed.issues.slice(0, 10).join('; ') }
      }
      return { ok: true, data: parsed.document }
    },
  })

  const problems = deps.regate?.(document, targetLocale) ?? []
  if (problems.length > 0) throw new LocalizeGameVocabError(targetLocale, problems)

  return { document, targetLocale, attempts }
}

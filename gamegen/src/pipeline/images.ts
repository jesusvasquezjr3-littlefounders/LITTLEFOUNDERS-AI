// illustrate stage — fills a game manifest's `skin.sprites` and
// `skin.background_url` by asking Prism (picturegen/) for one image per DECLARED
// sprite slot of the mechanic, plus the background. Prism owns the whole image
// concern: the art-director judge (LF visual identity), the qwen-image
// generation, the pictorial verifier, Depot storage, and the request-hash cache
// that guarantees an identical request never hits the paid API twice — Arcade
// only embeds the returned public URL.
//
// TWIN OF `coursegen/src/pipeline/images.ts`. Everything load-bearing here was
// paid for by real Forge runs; it is ported, not re-derived:
//
//  1. **Inherit → checkBudget → request, in that order.** Inheritance is cheaper
//     than Prism's own cache because it needs no network at all AND survives the
//     label/context rewrite that makes the request hash miss on every
//     regeneration. `checkBudget()` then runs before the paid call, never after.
//  2. **A failed image NEVER fails a slot.** Every item keeps its Material
//     Symbols `icon` fallback (`core/schema.ts` deliberately does not require an
//     `image_slot` to be bound), so a game must never become unpublishable
//     because an illustration failed. Prism's status already encodes the retry
//     instruction — 502 transient (retried inside `withTransportRetry`), 4xx/422
//     terminal (never retried; re-asking re-pays a generation that can never
//     differ, up to 12 paid generations per target — picturegen/AGENTS.md).
//  3. **EXACTLY TWO exemptions RETHROW** (gamegen/AGENTS.md): a
//     `ProviderNotConfiguredError` short-circuits the whole document, and a
//     `BudgetExceededError` escapes untouched — *the kill switch only exists if
//     the error escapes*. Forge's version swallowed the budget error per target:
//     a run that had already hit its USD cap kept walking every remaining image,
//     paid for each one, and shipped lessons with silently missing art while the
//     cap read as enforced. This stage loops over sprite slots — the identical
//     shape, so the identical trap.
//  4. **The counters LEAVE this function.** `generated` / `billed` / `inherited`
//     are REQUIRED fields (Forge's were optional and were destructured away at
//     the call site) — which is how an unconfigured Prism published a
//     visual-first curriculum with zero illustrations while the run reported
//     complete success. Nothing downstream re-checks: the judge runs BEFORE
//     illustration.
//
// §1.9: every string that reaches Prism here comes from the authored blueprint
// (`skin_brief`), the curriculum concept, or model output already gated by
// `author`/`gate`/`judge`. There is no per-child path and no user row is
// readable from this stage.

import type { GameDocument } from '../contract/core/types.js';
import { getMechanic } from '../contract/registry.js';
import { ProviderNotConfiguredError } from '../providers/errors.js';
import { requestPicture, type PicturePurpose } from '../providers/picturegen.js';
import { BudgetExceededError, type UsageLedger } from '../providers/usage.js';

/** `picturegen/src/routes/pictures.ts` — `label` is `.max(120)`, and an over-long
 *  label is a 400 VALIDATION_ERROR, i.e. a TERMINAL waste of a target. */
const PRISM_LABEL_MAX = 120;
/** Same route: `context` is `.max(2000)`. */
const PRISM_CONTEXT_MAX = 2000;

/** GAME_ENGINE.md §2: the two purposes Prism gains for Arcade. Purpose is part of
 *  Prism's cache hash, so adding them is cache-safe (no STYLE_VERSION bump). */
const SPRITE_PURPOSE: PicturePurpose = 'game_sprite';
const BACKGROUND_PURPOSE: PicturePurpose = 'game_background';

export interface IllustrateGameOptions {
  /** `--no-images` CLI flag. Costs nothing and mutates nothing. */
  skip?: boolean;
  /**
   * The blueprint's `skin_brief` (`gamegen/curriculum/<course>/games.yaml`, <=600
   * chars of setting/props/mood direction). It is NOT part of the manifest — the
   * document carries a closed `skin.palette`, not prose — so the caller passes it
   * through. Without it the art still matches the concept, but not the game's
   * intended look.
   */
  skinBrief?: string;
  /**
   * Course-scoped index of art already drawn, keyed by normalized label. Consulted
   * BEFORE any paid call, and UPDATED IN PLACE with every fresh object URL, so a
   * single map passed across the slots of one course pays for each distinct object
   * exactly once. Illustration is the dominant cost of mass generation, and a
   * regeneration rewrites labels/contexts so Prism's own request-hash cache always
   * misses even when the object is identical.
   */
  inherit?: GameImageInheritance;
  /**
   * Meters image spend so the run's kill switches actually bind. Only FRESH
   * generations are billed; a Prism cache hit is free and is recorded nowhere.
   * Image spend outside the ledger is invisible to every guard — it was Forge's
   * largest uncapped cost for months.
   */
  ledger?: UsageLedger;
}

export interface IllustrateGameDeps {
  /** Injectable Prism chokepoint. Tests pass a fake; the run passes nothing. */
  request?: typeof requestPicture;
}

export type GameImageSkipReason = 'flag' | 'not-configured' | 'unsupported-mechanic';

export interface IllustrateGameResult {
  document: GameDocument;
  /** Prism requests that returned an image (cached or fresh). */
  generated: number;
  /** Of those, how many were FRESH — i.e. actually paid for. */
  billed: number;
  /** Slots filled from course art already drawn — zero cost, zero network. */
  inherited: number;
  /** Set when the stage did not illustrate; the document comes back unmodified. */
  skippedReason?: GameImageSkipReason;
}

// ---- Inheritance ---------------------------------------------------------------

/** Normalized label → an already-generated Depot URL. */
export type GameImageInheritance = Map<string, string>;

/**
 * The same normalization the label goes through before reaching Prism, plus
 * accent/case folding — "Limones" and "limones" are the same drawing, while
 * "Limones grandes" deliberately is NOT (a different object deserves new art).
 * Ported verbatim in behavior from `coursegen/src/pipeline/imageInheritance.ts`.
 */
export function normalizeLabel(raw: string): string {
  return raw
    .replace(/[*_`~#>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The URL already drawn for this label, if any. */
export function inheritedUrl(index: GameImageInheritance | undefined, label: string): string | undefined {
  if (!index || index.size === 0) return undefined;
  return index.get(normalizeLabel(label));
}

/**
 * Indexes the OBJECT art of already-published game documents by normalized label,
 * so the next game in the same course reuses the drawing instead of re-paying.
 *
 * DELIBERATELY TOLERANT — it takes `unknown[]` and skips anything that does not
 * look like a document. The caller reads these rows from Vault, and inheritance is
 * a cost optimisation, never a precondition: if the read fails or a row is shaped
 * unexpectedly we simply pay for the images, which is the un-optimised behaviour.
 * Failures are swallowed BY DESIGN — never let this throw into the run.
 *
 * SCOPE IS THE CALLER'S JOB: pass only documents from the SAME course, exactly as
 * `coursegen/src/pipeline/run.ts` filters `previousArtDocuments` by course slug. A
 * label that repeats across courses must not donate art across them.
 *
 * WHAT IS INDEXED, AND WHAT IS NOT. Only slots that a named item/category
 * DEPICTS ("limones" → `collect_good`) are object art: the same object is the same
 * drawing in any game. STRUCTURAL slots (`ground`, `sky`, `board`) and the
 * BACKGROUND are never indexed and never inherited — those are the game's setting,
 * so a stale one would be wrong rather than merely differently framed. This is the
 * twin of Forge's scene-anchor exclusion.
 */
export function buildGameImageInheritance(documents: readonly unknown[]): GameImageInheritance {
  const index: GameImageInheritance = new Map();
  for (const raw of documents) {
    if (!raw || typeof raw !== 'object') continue;
    const skin = (raw as { skin?: unknown }).skin;
    const content = (raw as { content?: unknown }).content;
    if (!skin || typeof skin !== 'object' || !content || typeof content !== 'object') continue;
    const sprites = (skin as { sprites?: unknown }).sprites;
    if (!sprites || typeof sprites !== 'object') continue;
    const bySlot = sprites as Record<string, unknown>;

    const items = (content as { items?: unknown }).items;
    const categories = (content as { categories?: unknown }).categories;
    for (const list of [items, categories]) {
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        if (!entry || typeof entry !== 'object') continue;
        const { image_slot: slot, label_md: label } = entry as { image_slot?: unknown; label_md?: unknown };
        if (typeof slot !== 'string' || typeof label !== 'string') continue;
        const url = bySlot[slot];
        if (typeof url !== 'string' || url.length === 0) continue;
        const key = normalizeLabel(label);
        // First wins, so a fixed document order gives a deterministic index.
        if (key.length > 0 && !index.has(key)) index.set(key, url);
      }
    }
  }
  return index;
}

// ---- Target planning -----------------------------------------------------------

/** Strip MarkdownLite emphasis so Prism's judge sees a clean subject, not `**Limones**`. */
function plain(md: string, max: number): string {
  return md
    .replace(/[*_`~#>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** `obstacle_sudden` → `obstacle sudden`: the subject of a structural slot no item names. */
function humanizeSlot(slot: string): string {
  return slot.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * A per-item INDEX slot (`item_7`, `bin_3`, `piece_12`, `unit_9`, `enemy_10`,
 * `ability_4`, `collectible_8`, `opponent_6`, `trait_5`).
 *
 * VERIFIED 2026-07-30 against all eight `<M>_SPRITE_SLOTS` arrays: every declared
 * slot carrying a numeric suffix belongs to an index FAMILY sized to the mechanic's
 * ceiling, and every structural slot (`field`, `sky`, `tower_aura`, `node_boss`…)
 * carries none. An index slot no item or category NAMES simply does not exist in
 * this game — a sorter with 2 items declares 16 `item_N` slots. Asking Prism to
 * draw "item 7" would be a paid generation of a meaningless subject, 26 of them on
 * that one sorter (~$0.9 for art nothing renders), so an unclaimed index slot is
 * skipped. Structural slots ARE the mechanic's world and are always drawn.
 */
function isIndexSlot(slot: string): boolean {
  return /_\d+$/.test(slot);
}

/** One picture to fetch: what to draw, whether it is reusable object art, where it lands. */
interface ImageTarget {
  slot: string;
  label: string;
  purpose: PicturePurpose;
  /** Only object art participates in inheritance — see `buildGameImageInheritance`. */
  inheritable: boolean;
  apply: (url: string) => void;
}

/**
 * The illustration PLAN: every DECLARED sprite slot of the mechanic that is not
 * already bound, in declared order.
 *
 * A slot's SUBJECT is the item or category that names it in `image_slot` (first
 * match in array order, so the plan is deterministic); a slot nothing names is
 * structural — `ground`, `sky`, `board` — and is drawn from its humanized id.
 * Those exist precisely because the mechanic renders them, so skipping them would
 * leave a game with art for its items and none for the world they sit in. The one
 * exclusion is an unclaimed INDEX slot (`isIndexSlot`), which is a ceiling this
 * game did not fill rather than a thing to draw.
 */
function planTargets(
  document: GameDocument,
  slots: readonly string[],
  skinBrief: string | undefined,
): ImageTarget[] {
  const sprites = document.skin.sprites;
  const items = document.content.items;
  const categories = document.content.categories ?? [];
  const targets: ImageTarget[] = [];

  for (const slot of slots) {
    const bound = sprites[slot];
    if (typeof bound === 'string' && bound.length > 0) continue; // idempotent re-runs

    const depiction =
      items.find((item) => item.image_slot === slot)?.label_md ??
      categories.find((category) => category.image_slot === slot)?.label_md;
    if (depiction === undefined && isIndexSlot(slot)) continue; // unclaimed index slot
    const label = depiction === undefined ? humanizeSlot(slot) : plain(depiction, PRISM_LABEL_MAX);
    if (label.length === 0) continue; // nothing to ask for; the icon fallback stands

    targets.push({
      slot,
      label,
      purpose: SPRITE_PURPOSE,
      inheritable: depiction !== undefined,
      apply: (url) => {
        sprites[slot] = url;
      },
    });
  }

  if (document.skin.background_url === undefined || document.skin.background_url.length === 0) {
    // The background IS the game's setting, so the blueprint's art direction is the
    // subject when there is one. Never inheritable — see buildGameImageInheritance.
    const brief = skinBrief === undefined ? '' : plain(skinBrief, PRISM_LABEL_MAX);
    const label = brief.length > 0 ? brief : plain(document.meta.title, PRISM_LABEL_MAX);
    if (label.length > 0) {
      targets.push({
        slot: '(background)',
        label,
        purpose: BACKGROUND_PURPOSE,
        inheritable: false,
        apply: (url) => {
          document.skin.background_url = url;
        },
      });
    }
  }

  return targets;
}

/**
 * The grounding context, IDENTICAL for every target of one document.
 *
 * Deliberate: Prism hashes `STYLE_VERSION | purpose | label | context`, so holding
 * the context byte-stable across a document means two slots differ only by label
 * and purpose — and a re-run of the same document is a pure cache hit. It carries
 * the concept (so the art teaches the right thing) and the blueprint's skin brief
 * (so the art matches the game's look).
 */
function buildContext(document: GameDocument, skinBrief: string | undefined): string {
  const parts = [
    `Game: ${plain(document.meta.title, 120)}`,
    `Concept: ${plain(document.meta.concept.recap_md, 400)}`,
  ];
  const look = skinBrief === undefined ? '' : plain(skinBrief, 600);
  if (look.length > 0) parts.push(`Look: ${look}`);
  return parts.join(' · ').slice(0, PRISM_CONTEXT_MAX);
}

// ---- The stage -------------------------------------------------------------------

/**
 * The `illustrate` stage. Runs on the es-MX document BEFORE the `localize`
 * string-freeze (gamegen/AGENTS.md): `sprites` and `background_url` are container
 * keys `NON_VISIBLE_KEYS` skips, so they copy verbatim into en-US and pt-BR —
 * ONE image serves three locales.
 *
 * Never throws for a failed image. Throws exactly two things, both on purpose:
 * `ProviderNotConfiguredError` is caught here and turned into a clean
 * `not-configured` skip of the WHOLE document (there is no point trying the rest),
 * and `BudgetExceededError` propagates untouched to `run.ts`, which is the only
 * reason the run's USD/token caps bind at all.
 */
export async function illustrateGame(
  document: GameDocument,
  options: IllustrateGameOptions = {},
  deps: IllustrateGameDeps = {},
): Promise<IllustrateGameResult> {
  if (options.skip) return { document, generated: 0, billed: 0, inherited: 0, skippedReason: 'flag' };

  const slice = getMechanic(document.meta.mechanic);
  if (slice === null) {
    // A mechanic this build cannot play has no knowable slot set, and inventing
    // keys would produce a document `core/schema.ts` rejects. The slot fails
    // elsewhere (the winnability gate cannot run either) — this stage just reports.
    console.warn(
      `[arcade] images: mechanic "${document.meta.mechanic}" is not implemented in this build — no sprite slots are knowable, skipping illustration`,
    );
    return { document, generated: 0, billed: 0, inherited: 0, skippedReason: 'unsupported-mechanic' };
  }

  const request = deps.request ?? requestPicture;
  const cloned = structuredClone(document);
  const context = buildContext(cloned, options.skinBrief);
  let generated = 0;
  let billed = 0;
  let inherited = 0;

  /**
   * Fetch ONE target. Returns the url, or `undefined` when this single
   * illustration failed — its icon/text fallback stays, and the game still ships.
   */
  async function fetchOne(target: ImageTarget): Promise<string | undefined> {
    // INHERIT FIRST: free, network-less, and it survives the label/context rewrite
    // that makes Prism's own hash miss on every regeneration.
    if (target.inheritable) {
      const reused = inheritedUrl(options.inherit, target.label);
      if (reused !== undefined) {
        inherited++;
        return reused;
      }
    }
    try {
      // Budget FIRST: an image is a paid call and must respect the same kill
      // switch as a token call rather than spending past it.
      options.ledger?.checkBudget();
      const picture = await request({ label: target.label, context, purpose: target.purpose });
      generated++;
      if (!picture.cached) {
        billed++;
        await options.ledger?.record({
          provider: 'picturegen',
          model: 'qwen-image',
          operation: `image:${target.purpose}`,
          promptTokens: 0,
          completionTokens: 0,
          images: 1,
        });
      }
      // Feed the course index so the NEXT slot reuses this drawing for free.
      if (target.inheritable && options.inherit) {
        const key = normalizeLabel(target.label);
        if (key.length > 0 && !options.inherit.has(key)) options.inherit.set(key, picture.url);
      }
      return picture.url;
    } catch (err) {
      // EXEMPTION 1 — Prism is not configured: bail the whole document (below).
      if (err instanceof ProviderNotConfiguredError) throw err;
      // EXEMPTION 2 — the budget kill switch firing, NOT a per-image hiccup.
      // Swallowing it here is exactly what defeated FORGE_MAX_USD_PER_RUN.
      if (err instanceof BudgetExceededError) throw err;
      console.warn(
        `[arcade] images: skipping ${target.slot} ("${target.label}") — ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }

  try {
    for (const target of planTargets(cloned, slice.spriteSlots, options.skinBrief)) {
      const url = await fetchOne(target);
      if (url !== undefined) target.apply(url);
    }
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) {
      // Clean skip: return the UNMODIFIED original document. Icons stay the
      // fallback, the slot still publishes, and the reason travels to the run
      // summary instead of being swallowed into a silent success.
      return { document, generated: 0, billed: 0, inherited, skippedReason: 'not-configured' };
    }
    throw err;
  }

  return { document: cloned, generated, billed, inherited };
}

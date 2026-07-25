// images stage — OPTIONAL per slot (COURSE_ENGINE.md §4). Fills the lesson's
// AI illustrations by asking Prism (picturegen/) for each one. Prism owns the
// whole image concern: the art-director judge (LF visual identity), the
// qwen-image generation, the pictorial verifier, Depot storage, and the cache
// that guarantees an identical request never hits the paid API twice — Forge
// only embeds the returned public URL.
//
// Coverage (QA synthesis 2026-07-23): a young child recognizes a real
// illustration, not a 40px Material glyph or a bare text chip. So this stage
// illustrates EVERY concrete-object slot the schema now carries an image field
// for — option/item/card tiles across all families — not just picture_choice
// and memory_flip. The illustration PLAN per type lives in `planTargets`.
//
// Skips CLEANLY (never fails the run, never fails the SLOT) on ANY failure —
// `--no-images`, Prism not configured, Prism down, provider quota, verifier
// rejection. Each is a per-TARGET skip (the icon/text stays the fallback);
// only NOT_CONFIGURED short-circuits the whole document. A lesson must never be
// unpublishable just because an illustration failed.

import type { UsageLedger } from '../providers/usage.js';
import { requestPicture, type PicturePurpose } from '../providers/picturegen.js';
import { ProviderNotConfiguredError } from '../providers/errors.js';
import type { LessonDocumentParsed } from '../contract/schema.js';

export interface IllustrateOptions {
  /** `--no-images` CLI flag. */
  skip?: boolean;
  /**
   * Meters image spend so the run's budget kill switches actually bind. Image
   * generation used to be invisible to the ledger AND to FORGE_MAX_USD_PER_RUN,
   * which made it the largest uncapped cost in the pipeline — a mass run could bill
   * tens of thousands of paid qwen-image calls with nothing stopping it. Only FRESH
   * generations are billed; a Prism cache hit is free and recorded as 0.
   */
  ledger?: UsageLedger;
}

export interface IllustrateDeps {
  request?: typeof requestPicture;
}

export type SkippedReason = 'flag' | 'not-configured';

export interface IllustrateResult {
  document: LessonDocumentParsed;
  /** Prism requests that returned an image (cached or fresh). */
  generated: number;
  /** Of those, how many were FRESH — i.e. actually paid for. */
  billed?: number;
  skippedReason?: SkippedReason;
}

/** One picture to fetch: what to draw, its role, and where the URL lands. */
interface IllustrationTarget {
  /** Skip if this slot already has an image (idempotent re-runs / backfill). */
  has: () => boolean;
  label: string;
  purpose: PicturePurpose;
  apply: (url: string) => void;
}

/** Strip MarkdownLite emphasis so the judge sees a clean object name, not `**Limones**`. */
function plainLabel(md: string): string {
  return md
    .replace(/[*_`~#>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

type AnyRecord = Record<string, unknown>;

/**
 * The per-type illustration PLAN: for a segment, list every concrete slot to
 * illustrate. Adding image support for a new type = one case here. Types whose
 * visuals must be engine-controlled (pattern_complete's size ladder) or whose
 * items are inherently abstract (quiz statements) are intentionally absent.
 */
function planTargets(segment: { type: string; prompt_md: string; payload: AnyRecord }): IllustrationTarget[] {
  const ctx = plainLabel(segment.prompt_md);
  const p = segment.payload;
  const t: IllustrationTarget[] = [];

  // Helper: illustrate each entry of an item array under a text/label field.
  const eachItem = (
    arr: unknown,
    labelOf: (item: AnyRecord) => string | undefined,
    purpose: PicturePurpose,
    imageKey = 'image_url',
  ): void => {
    if (!Array.isArray(arr)) return;
    for (const raw of arr) {
      const item = raw as AnyRecord;
      const label = labelOf(item);
      if (!label) continue;
      t.push({
        has: () => typeof item[imageKey] === 'string' && (item[imageKey] as string).length > 0,
        label: plainLabel(label),
        purpose,
        apply: (url) => {
          item[imageKey] = url;
        },
      });
    }
  };
  const text = (i: AnyRecord) => (typeof i.text_md === 'string' ? i.text_md : undefined);
  const label = (i: AnyRecord) => (typeof i.label === 'string' ? i.label : undefined);

  switch (segment.type) {
    case 'picture_choice':
      eachItem(p.options, label, 'option_card');
      break;
    case 'memory_flip':
      if (Array.isArray(p.pairs)) {
        for (const raw of p.pairs) {
          const pair = raw as AnyRecord;
          if (typeof pair.a_md === 'string')
            t.push({ has: () => typeof pair.a_image_url === 'string', label: plainLabel(pair.a_md), purpose: 'memory_card', apply: (u) => (pair.a_image_url = u) });
          if (typeof pair.b_md === 'string')
            t.push({ has: () => typeof pair.b_image_url === 'string', label: plainLabel(pair.b_md), purpose: 'memory_card', apply: (u) => (pair.b_image_url = u) });
        }
      }
      break;
    case 'needs_wants':
      eachItem(p.items, text, 'item_card');
      break;
    case 'budget_fit':
      eachItem(p.items, label, 'item_card');
      break;
    case 'sort_buckets':
    case 'group_sets':
    case 'order_steps':
    case 'rank_choices':
      eachItem(p.items, text, 'item_card');
      break;
    case 'match_pairs':
      eachItem(p.left, text, 'item_card');
      break;
    case 'odd_one_out':
    case 'speed_tap':
      eachItem(p.items, text, 'item_card');
      break;
    case 'yes_no_cases':
      eachItem(p.cases, text, 'item_card');
      break;
    case 'timeline_order':
      eachItem(p.events, text, 'item_card');
      break;
    case 'price_compare':
      eachItem(p.offers, label, 'option_card');
      break;
    case 'piggy_split':
      eachItem(p.jars, label, 'item_card');
      break;
    case 'fair_trade':
      for (const key of ['offer_a', 'offer_b'] as const) {
        const offer = p[key] as AnyRecord | undefined;
        if (offer && typeof offer.label === 'string')
          t.push({ has: () => typeof offer.image_url === 'string', label: plainLabel(offer.label), purpose: 'option_card', apply: (u) => (offer.image_url = u) });
      }
      break;
    case 'count_objects': {
      // Scene items carry an optional human label (the countable object); when
      // the author omitted it, fall back to ask_label (usually the same object)
      // so the countables still illustrate instead of dropping to a glyph.
      const askLabel = typeof p.ask_label === 'string' ? p.ask_label : undefined;
      eachItem(p.scene, (i) => (typeof i.label === 'string' ? i.label : askLabel), 'item_card');
      if (askLabel)
        t.push({ has: () => typeof p.ask_image_url === 'string', label: plainLabel(askLabel), purpose: 'item_card', apply: (u) => (p.ask_image_url = u) });
      break;
    }
    case 'key_ideas':
      eachItem(p.ideas, (i) => (typeof i.title === 'string' ? i.title : undefined), 'item_card');
      break;
    case 'concept_reveal':
      eachItem(p.cards, (i) => (typeof i.front_md === 'string' ? i.front_md : undefined), 'item_card');
      break;
    case 'would_you_rather':
      for (const key of ['a', 'b'] as const) {
        const side = p[key] as AnyRecord | undefined;
        if (side && typeof side.text_md === 'string')
          t.push({ has: () => typeof side.image_url === 'string', label: plainLabel(side.text_md), purpose: 'option_card', apply: (u) => (side.image_url = u) });
      }
      break;
    case 'flash_match':
      eachItem(p.left, text, 'item_card');
      break;
    case 'story_scene': {
      const art = p.art as AnyRecord | undefined;
      if (art) t.push({ has: () => typeof art.image_url === 'string', label: ctx || 'lemonade stand scene', purpose: 'scene_anchor', apply: (u) => (art.image_url = u) });
      break;
    }
    default:
      break;
  }
  return t;
}

/** Types that get a segment-level "scene anchor" (one establishing illustration
 *  above the prompt) — concrete single-situation exercises with no per-item art. */
const SCENE_ANCHOR_TYPES = new Set([
  'best_decision',
  'make_change',
  'spot_error',
  'estimate_slider',
  'number_input',
  'coin_count',
  'evidence_hunt',
  'fact_opinion',
  'red_flags',
  'measure_read',
  'compare_table',
  'dialogue_choice',
  'story_branch',
  'story_dialogue',
]);

export async function illustrateSegments(
  document: LessonDocumentParsed,
  options: IllustrateOptions = {},
  deps: IllustrateDeps = {},
): Promise<IllustrateResult> {
  if (options.skip) return { document, generated: 0, billed: 0, skippedReason: 'flag' };

  const request = deps.request ?? requestPicture;
  const cloned = structuredClone(document) as LessonDocumentParsed;
  let generated = 0;
  let billed = 0;

  // Fetch ONE target; returns the url or undefined (this single illustration
  // failed — its icon/text stays the fallback). Rethrows NotConfigured so the
  // caller can bail the whole document.
  async function fetchOne(label: string, context: string, purpose: PicturePurpose): Promise<string | undefined> {
    try {
      // Budget FIRST: an image is a paid call, so it must respect the same kill
      // switch as a token call rather than spending past it.
      options.ledger?.checkBudget();
      const picture = await request({ label, context, purpose });
      generated++;
      if (!picture.cached) {
        billed++;
        await options.ledger?.record({
          provider: 'picturegen',
          model: 'qwen-image',
          operation: `image:${purpose}`,
          promptTokens: 0,
          completionTokens: 0,
          images: 1,
        });
      }
      return picture.url;
    } catch (err) {
      if (err instanceof ProviderNotConfiguredError) throw err;
      console.warn(`images: skipping illustration for "${label}" — ${err instanceof Error ? err.message : String(err)}`);
      return undefined;
    }
  }

  try {
    for (const segment of cloned.segments as unknown as Array<{ type: string; prompt_md: string; payload: AnyRecord; image_url?: string }>) {
      const ctx = plainLabel(segment.prompt_md);

      // Per-item / per-slot targets from the plan.
      for (const target of planTargets(segment)) {
        if (target.has()) continue;
        const url = await fetchOne(target.label, ctx, target.purpose);
        if (url) target.apply(url);
      }

      // Segment-level scene anchor for scene-worthy types (skip if already set).
      if (SCENE_ANCHOR_TYPES.has(segment.type) && !segment.image_url && ctx) {
        const url = await fetchOne(ctx, ctx, 'scene_anchor');
        if (url) segment.image_url = url;
      }
    }
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) {
      // Prism not configured — clean skip, return the UNMODIFIED original
      // document (icons/text stay the fallback); no point trying the rest.
      return { document, generated: 0, billed: 0, skippedReason: 'not-configured' };
    }
    throw err;
  }

  return { document: cloned, generated };
}

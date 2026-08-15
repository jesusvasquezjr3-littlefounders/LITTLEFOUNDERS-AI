// images stage — OPTIONAL per slot (COURSE_ENGINE.md §4). Fills the lesson's
// AI illustrations by asking Prism (picturegen/) for each one. Prism owns the
// whole image concern: the art-director judge (LF visual identity), the
// Qwen-Image generation, the pictorial verifier, Depot storage, and the cache
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

import { BudgetExceededError, type UsageLedger } from '../providers/usage.js';
import { inheritedUrl, type ImageInheritance } from './imageInheritance.js';
import { requestPicture, type PicturePurpose } from '../providers/picturegen.js';
import { billedImagesFromError } from '../providers/picturegen.js';
import { ProviderNotConfiguredError } from '../providers/errors.js';
import { getConfig } from '../env.js';
import type { LessonDocumentParsed } from '../contract/schema.js';
import { characterIdSchema } from '../contract/core/schemaBase.js';

export interface IllustrateOptions {
  /** `--no-images` CLI flag. */
  skip?: boolean;
  /**
   * Production visual mode. A provider/configuration failure becomes a slot
   * failure rather than silently retaining icon fallbacks. This is the only
   * mode suitable for content that will later seek a release attestation.
   */
  required?: boolean;
  /**
   * Art already drawn for this lesson, indexed by normalized label
   * (`buildImageInheritance`). Consulted BEFORE any paid call: illustration is the
   * dominant cost of mass generation (~$100 per 1000-lesson course), and a
   * regeneration rewrites labels/contexts so Prism's own cache always misses even
   * when the object is identical. Reusing the existing drawing is free.
   */
  inherit?: ImageInheritance;
  /**
   * Never contact Prism. Existing object art can still be placed from `inherit`,
   * while a target with no matching stored object intentionally remains empty.
   * This makes a no-spend repair pass possible before deciding whether a new
   * paid illustration is genuinely necessary. Scene anchors are never inherited.
   */
  reuseOnly?: boolean;
  /**
   * `<course-slug>/<lesson-slug>` — the identity of the lesson being
   * illustrated, forwarded to Prism. It keys SCENE caching there and is
   * ignored for object tiles, so tiles keep collapsing catalog-wide while two
   * lessons that happen to share a prompt no longer share one scene image.
   * Omitted (e.g. a lab/one-off call) means scenes fall back to the old
   * label+context key — correct, just less separable.
   */
  scope?: string;
  /**
   * Meters image spend so the run's budget kill switches actually bind. Image
   * generation used to be invisible to the ledger AND to FORGE_MAX_USD_PER_RUN,
   * which made it the largest uncapped cost in the pipeline — a mass run could bill
   * tens of thousands of paid Qwen-Image calls with nothing stopping it. Only FRESH
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
  /** Slots filled from the lesson's PREVIOUS art — zero cost, zero network. */
  inherited?: number;
  /** Of those, how many were FRESH — i.e. actually paid for. */
  billed?: number;
  skippedReason?: SkippedReason;
}

/**
 * The deterministic result of asking whether a stored lesson has every visual
 * that this module's illustration plan requires. It deliberately counts only
 * plan-eligible targets: icon-only and abstract exercise families are valid
 * without an AI image.
 */
export interface IllustrationCoverage {
  required: number;
  present: number;
  missing: Array<{ segmentId: string; label: string; purpose: PicturePurpose }>;
}

/** One picture to fetch: what to draw, its role, and where the URL lands. */
interface IllustrationTarget {
  /** Skip if this slot already has an image (idempotent re-runs / backfill). */
  has: () => boolean;
  label: string;
  purpose: PicturePurpose;
  apply: (url: string) => void;
}

/** A tile label is one noun; a scene label is a sentence describing a situation. */
const MAX_TILE_LABEL_CHARS = 80;
const MAX_SCENE_LABEL_CHARS = 220;

/**
 * Strip MarkdownLite emphasis so the judge sees a clean object name, not
 * `**Limones**`. `==término==` (eavesdrop's tap-to-explain highlight) unwraps
 * to its inner text — those markers are engine syntax, and leaving them in a
 * scene label fed the art director punctuation instead of prose.
 */
function plainLabel(md: string, maxChars = MAX_TILE_LABEL_CHARS): string {
  return md
    .replace(/==([^=\n]+)==/g, '$1')
    .replace(/[*_`~#>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

/*
 * A tile prompt is not a general illustration brief. It renders exactly one
 * literal object on a white canvas, so asking it to depict a concept
 * ("Deseo"), a question, a sentence or a person/action invites Qwen to draw
 * a text card or a character — both are deliberate Prism rejections. The
 * authoring locale is es-MX; these conservative markers make the decision
 * deterministic before any paid request. A false negative leaves the existing
 * icon/text fallback, while a false positive costs redraws and produces a
 * misleading visual, so the bias is intentionally toward skipping.
 */
const NON_LITERAL_TILE_WORDS = new Set([
  'ahorro', 'ahorrar', 'gasto', 'gastar', 'deseo', 'desear', 'querer', 'quiero', 'tener', 'tengo',
  'necesidad', 'necesito', 'precio', 'valor', 'dinero', 'cambio', 'decisión', 'elegir', 'elige',
  'niño', 'niña', 'persona', 'mamá', 'papá', 'cliente', 'vendedor', 'ella', 'él', 'yo', 'mi', 'mis',
  'ya', 'que', 'qué', 'cuál', 'como', 'cómo', 'cuando', 'porque', 'con', 'sin', 'para',
  'compró', 'compra', 'mira', 'mirando', 'tiene', 'gustaría', 'prefieres', 'preferirías', 'significa',
  'es', 'son',
  // Effort/chore/teamwork content ("semillas de esfuerzo" unit, financial-education
  // production run 2026-08-04): these labels have no literal object referent —
  // rendering them as a tile guarantees a drawn person acting or feeling the
  // emotion (a still-life canvas has no other way to depict "pride" or "team").
  // The filter's own bias is toward skipping (comment above), so widening it here
  // is the correct fix, not a symptom to work around in the image prompt.
  'ayudar', 'ayuda', 'ayudo', 'ayudamos', 'trabajar', 'trabajo', 'trabaja', 'trabajamos', 'trabajando',
  'esfuerzo', 'esforzarse', 'esforzarme', 'orgullo', 'orgulloso', 'orgullosa', 'equipo', 'tarea', 'tareas',
  'cumplir', 'cumplo', 'cumple', 'cumplimos', 'terminar', 'termino', 'termina', 'terminamos', 'terminada', 'terminado',
  'logré', 'logro', 'logra', 'logramos', 'cara', 'caras', 'cansado', 'cansada', 'canso', 'cansa',
  'compartir', 'comparto', 'comparte', 'compartimos', 'ordenar', 'ordeno', 'ordena', 'ordenamos', 'solo', 'sola',
  // The final belt-and-braces image sweep runs after en-US/pt-BR localization.
  // Keep the rejection vocabulary multilingual: otherwise a Spanish person/action
  // label that was safely skipped before translation can become a paid English
  // portrait request (which Prism must reject) afterwards.
  'child', 'kid', 'boy', 'girl', 'person', 'people', 'mother', 'father', 'mom', 'dad', 'customer', 'seller',
  'holding', 'holds', 'hold', 'looking', 'looks', 'wearing', 'wears', 'playing', 'plays', 'has', 'want', 'wants',
  'need', 'needs', 'choose', 'chooses', 'decision', 'price', 'money',
  'help', 'helps', 'helping', 'work', 'works', 'working', 'effort', 'proud', 'pride', 'team', 'chore', 'chores',
  'finish', 'finishes', 'finished', 'achieve', 'achieved', 'achievement', 'face', 'faces', 'tired',
  'share', 'shares', 'sharing', 'tidy', 'tidies', 'tidying',
  'criança', 'crianca', 'menino', 'menina', 'pessoa', 'mãe', 'mae', 'pai', 'cliente', 'vendedor',
  'segurando', 'segura', 'olhando', 'olha', 'vestindo', 'veste', 'brincando', 'brinca', 'tem', 'quer', 'precisa',
  'escolhe', 'decisão', 'decisao', 'preço', 'preco', 'dinheiro',
  'ajudar', 'ajuda', 'ajudo', 'trabalhar', 'trabalho', 'trabalha', 'esforço', 'esforco', 'orgulho', 'orgulhoso', 'orgulhosa',
  'equipe', 'tarefa', 'tarefas', 'cumprir', 'cumpro', 'cumpre', 'conquista', 'rosto', 'rostos', 'cansado', 'cansada',
  'compartilhar', 'compartilho', 'compartilha', 'arrumar', 'arrumo', 'arruma',
  // Naming a canon character (production incident 2026-08-04, "semillas de
  // esfuerzo" unit): an option label like "Rho sigue amarrando" or "Liruf ya
  // terminó" names WHO is doing something rather than WHAT object to draw — no
  // verb-vocabulary list can cover the open-ended space of actions a character
  // might be doing, so reject on the character name itself instead. Locale-
  // invariant proper nouns, so one entry covers es-MX/en-US/pt-BR alike.
  ...characterIdSchema.options,
]);

const LEADING_TILE_ARTICLES = new Set(['un', 'una', 'el', 'la', 'los', 'las']);

/** Returns a safe single-object tile label, or no label for non-pictorial prose. */
function literalObjectLabel(source: string | undefined): string | undefined {
  if (!source) return undefined;
  const value = plainLabel(source);
  if (!value || /[?¿¡!.,:;\d$]/.test(value)) return undefined;
  const words = value.split(/\s+/).filter(Boolean);
  const normalizedWords = words.map((word) => word.toLocaleLowerCase('es-MX'));
  while (LEADING_TILE_ARTICLES.has(normalizedWords[0] ?? '')) {
    words.shift();
    normalizedWords.shift();
  }
  if (words.length === 0 || words.length > 4) return undefined;
  if (normalizedWords.some((word) => NON_LITERAL_TILE_WORDS.has(word))) return undefined;
  return words.join(' ');
}

type AnyRecord = Record<string, unknown>;

/**
 * The per-type illustration PLAN: for a segment, list every concrete slot to
 * illustrate. Adding image support for a new type = one case here. Types whose
 * visuals must be engine-controlled (pattern_complete's size ladder) or whose
 * items are inherently abstract (quiz statements) are intentionally absent.
 *
 * DELIBERATELY STILL ABSENT — `story_branch` per-node `image_url`. The engine
 * renders it, but the type already receives a segment-level scene anchor, so a
 * wide image per node would be a second establishing shot at a paid generation
 * each. It is also the one slot that would poison inheritance: a node carries
 * both `image_url` and a sibling `text_md`, exactly the pair
 * buildImageInheritance indexes as OBJECT art, so a wide branch scene could be
 * handed to a small tile elsewhere that happens to share the text. Filling it
 * needs a purpose-aware inheritance index first, not just a plan case.
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
      const label = literalObjectLabel(labelOf(item));
      if (!label) continue;
      t.push({
        has: () => typeof item[imageKey] === 'string' && (item[imageKey] as string).length > 0,
        label,
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
          const aLabel = literalObjectLabel(typeof pair.a_md === 'string' ? pair.a_md : undefined);
          const bLabel = literalObjectLabel(typeof pair.b_md === 'string' ? pair.b_md : undefined);
          if (aLabel)
            t.push({ has: () => typeof pair.a_image_url === 'string', label: aLabel, purpose: 'memory_card', apply: (u) => (pair.a_image_url = u) });
          if (bLabel)
            t.push({ has: () => typeof pair.b_image_url === 'string', label: bLabel, purpose: 'memory_card', apply: (u) => (pair.b_image_url = u) });
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
        const offerLabel = literalObjectLabel(offer && typeof offer.label === 'string' ? offer.label : undefined);
        if (offer && offerLabel)
          t.push({ has: () => typeof offer.image_url === 'string', label: offerLabel, purpose: 'option_card', apply: (u) => (offer.image_url = u) });
      }
      break;
    case 'count_objects': {
      // Scene items carry an optional human label (the countable object); when
      // the author omitted it, fall back to ask_label (usually the same object)
      // so the countables still illustrate instead of dropping to a glyph.
      const askLabel = typeof p.ask_label === 'string' ? p.ask_label : undefined;
      eachItem(p.scene, (i) => (typeof i.label === 'string' ? i.label : askLabel), 'item_card');
      const literalAskLabel = literalObjectLabel(askLabel);
      if (literalAskLabel)
        t.push({ has: () => typeof p.ask_image_url === 'string', label: literalAskLabel, purpose: 'item_card', apply: (u) => (p.ask_image_url = u) });
      break;
    }
    case 'would_you_rather':
      for (const key of ['a', 'b'] as const) {
        const side = p[key] as AnyRecord | undefined;
        const sideLabel = literalObjectLabel(side && typeof side.text_md === 'string' ? side.text_md : undefined);
        if (side && sideLabel)
          t.push({ has: () => typeof side.image_url === 'string', label: sideLabel, purpose: 'option_card', apply: (u) => (side.image_url = u) });
      }
      break;
    case 'flash_match':
      eachItem(p.left, text, 'item_card');
      break;
    /*
     * The four slots below carry an `image_url` in BOTH schema copies and the
     * engine already renders them (VisualMark / the storyplay question image),
     * but no plan case ever filled one — so they shipped as 40px glyphs while
     * the segment above them got a generic scene. They are all object TILES,
     * which is the cheap kind: the cache collapses them by label across the
     * whole catalog, so a second lesson naming the same object pays nothing.
     */
    case 'key_ideas':
      // Illustrate the idea's TITLE (a short noun phrase), never body_md.
      eachItem(p.ideas, (i) => (typeof i.title === 'string' ? i.title : undefined), 'item_card');
      break;
    case 'concept_reveal':
      // Card FRONT only: the back is the reveal, and illustrating it would put
      // the answer on the closed card.
      eachItem(p.cards, (i) => (typeof i.front_md === 'string' ? i.front_md : undefined), 'item_card');
      break;
    case 'lightning_round':
      // Speed round: the options are what the child scans, so tiles help most.
      // The per-question `image_url` is deliberately left empty — a fresh wide
      // scene per question would cost a paid generation each and slow a timed
      // exercise down for no comprehension gain.
      if (Array.isArray(p.questions)) {
        for (const raw of p.questions) eachItem((raw as AnyRecord).options, text, 'option_card');
      }
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

/**
 * Counts the paid image requests that a required visual run may need in the
 * worst case. An object already present or safely inherited is free; every
 * other target can consume all Prism verifier redraw attempts. This is
 * deliberately conservative about Prism cache hits: the request descriptor
 * includes context, so Forge cannot safely assume a hit without making the
 * request it is deciding whether to admit.
 */
function maxFreshImageRequests(document: LessonDocumentParsed, inherit: ImageInheritance | undefined): number {
  let count = 0;
  for (const segment of document.segments as unknown as Array<{
    type: string;
    prompt_md: string;
    payload: AnyRecord;
    image_url?: string;
  }>) {
    for (const target of planTargets(segment)) {
      if (!target.has() && !inheritedUrl(inherit, target.label)) count++;
    }
    if (SCENE_ANCHOR_TYPES.has(segment.type) && !segment.image_url && sceneAnchorSubject(segment)) count++;
  }
  return count;
}

/*
 * WHAT A SCENE ANCHOR IS ABOUT (production incident 2026-08-14).
 *
 * The anchor used to be requested with the segment's `prompt_md` as BOTH its
 * label and its context. For the numeric types that is fine — their prompt IS
 * the situation ("Liruf vacía su bolsita de monedas. Tiene 3 monedas de 10…").
 * For the story/discussion types it is a bare instruction: "Escucha la
 * conversación entre Dina y Liruf.", "Toca los términos para entenderlos
 * mejor." Asked to draw an instruction, the art director had no subject, and
 * the identity brief's own "cheerful lemonade-stand world" filled the vacuum —
 * so a thousand lessons about markets, budgets and fraud all opened with the
 * same lemonade stand.
 *
 * The fix is to hand over the situation the lesson actually describes, which
 * those types DO carry — just not in `prompt_md`. Sources below are narrative
 * only (scene setting, opening line, story beat): never options, never items,
 * never `answer`, because the anchor must not reveal what the child is being
 * asked to work out.
 */
function narrativeSituation(segment: { type: string; payload: AnyRecord }): string | undefined {
  const p = segment.payload;
  const firstString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim().length > 0 ? value : undefined;

  switch (segment.type) {
    case 'eavesdrop':
      // `context_md` exists precisely to set the scene ("Dina y Liruf cuentan
      // la caja al cerrar…") — the single best anchor source in the catalog.
      return firstString(p.context_md);
    case 'dialogue_choice':
      return firstString(p.opening_md);
    case 'story_branch': {
      const nodes = Array.isArray(p.nodes) ? (p.nodes as AnyRecord[]) : [];
      const start = nodes.find((n) => n.id === p.start_node) ?? nodes[0];
      return firstString(start?.text_md);
    }
    case 'story_dialogue': {
      // The opening exchange establishes where everyone is and what is at
      // stake; two lines is enough to place the scene without transcribing it.
      const lines = Array.isArray(p.lines) ? (p.lines as AnyRecord[]) : [];
      const spoken = lines.slice(0, 2).map((l) => firstString(l.text_md)).filter((t): t is string => Boolean(t));
      return spoken.length > 0 ? spoken.join(' ') : undefined;
    }
    default:
      // Everything else in SCENE_ANCHOR_TYPES states its situation in prompt_md.
      return undefined;
  }
}

/**
 * The (label, context) pair for a segment's scene anchor, or `undefined` when
 * the segment gives the art director nothing concrete to draw — in which case
 * NO anchor is requested at all. Silence beats a confident wrong picture: the
 * exercise still renders, with no misleading image above it.
 */
export function sceneAnchorSubject(
  segment: { type: string; prompt_md: string; payload: AnyRecord },
  lessonTitle?: string,
): { label: string; context: string } | undefined {
  const instruction = plainLabel(segment.prompt_md, MAX_SCENE_LABEL_CHARS);
  const narrative = narrativeSituation(segment);
  const label = narrative ? plainLabel(narrative, MAX_SCENE_LABEL_CHARS) : instruction;
  if (!label) return undefined;
  /*
   * The lesson title grounds the subject for the judge without becoming the
   * subject itself: "Ahorrar para la bici" + "Liruf cuenta sus monedas en la
   * mesa" is a far better brief than either alone. The instruction stays in
   * the context too, since for the numeric types it carries the props.
   */
  const context = [lessonTitle, instruction].filter((part) => part && part.length > 0).join(' — ');
  return { label, context };
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
  'eavesdrop',
]);

/*
 * ── SCENE REPAIR HELPERS ────────────────────────────────────────────────────
 * `illustrateSegments` only ever ADDS: a slot that already holds a URL is
 * skipped, which is what makes re-runs idempotent and cheap. That is also why
 * it cannot repair anything — the 1,208 published lessons all HAVE a scene
 * anchor, it is just the wrong picture. Replacing stale art therefore needs an
 * explicit clear step, kept here next to SCENE_ANCHOR_TYPES so "what counts as
 * a scene" has exactly one definition.
 *
 * `story_scene`'s `payload.art.image_url` is included: it is requested with a
 * scene purpose, so it is stale under the same style bump as the anchors.
 */

/** Every scene-purpose image slot in a document, as (segmentId, accessors). */
function sceneSlots(document: LessonDocumentParsed): Array<{
  segmentId: string;
  get: () => string | undefined;
  set: (url: string | undefined) => void;
}> {
  const slots: Array<{ segmentId: string; get: () => string | undefined; set: (url: string | undefined) => void }> = [];
  // These three helpers run over rows read straight out of Vault, including
  // legacy ones — a document with no `segments` array simply has no scenes.
  if (!Array.isArray(document.segments)) return slots;
  for (const raw of document.segments as unknown as Array<{ id: string; type: string; payload: AnyRecord; image_url?: string }>) {
    const segment = raw;
    if (SCENE_ANCHOR_TYPES.has(segment.type)) {
      slots.push({
        segmentId: segment.id,
        get: () => segment.image_url,
        set: (url) => {
          if (url === undefined) delete segment.image_url;
          else segment.image_url = url;
        },
      });
    }
    if (segment.type === 'story_scene') {
      const art = segment.payload.art as AnyRecord | undefined;
      if (art) {
        slots.push({
          segmentId: segment.id,
          get: () => (typeof art.image_url === 'string' ? art.image_url : undefined),
          set: (url) => {
            if (url === undefined) delete art.image_url;
            else art.image_url = url;
          },
        });
      }
    }
  }
  return slots;
}

/** A copy of `document` with every scene-purpose image removed, plus the count. */
export function clearSceneImages(document: LessonDocumentParsed): { document: LessonDocumentParsed; cleared: number } {
  const clone = structuredClone(document) as LessonDocumentParsed;
  let cleared = 0;
  for (const slot of sceneSlots(clone)) {
    if (slot.get()) {
      slot.set(undefined);
      cleared++;
    }
  }
  return { document: clone, cleared };
}

/** Scene URLs by segment id — the authoring locale's art, ready to copy to siblings. */
export function collectSceneImages(document: LessonDocumentParsed): Map<string, string> {
  const found = new Map<string, string>();
  for (const slot of sceneSlots(document)) {
    const url = slot.get();
    if (url && !found.has(slot.segmentId)) found.set(slot.segmentId, url);
  }
  return found;
}

/**
 * Places `urls` (from `collectSceneImages` on the authoring locale) into a
 * sibling-locale document, by segment id. LF illustrations carry no text by
 * design, so one drawing serves all three locale documents of a lesson — this
 * is the same 1-image-per-3-locales rule the generation pipeline relies on,
 * applied to a repair pass instead of to a fresh run. Zero cost, zero network.
 */
export function applySceneImages(
  document: LessonDocumentParsed,
  urls: ReadonlyMap<string, string>,
): { document: LessonDocumentParsed; applied: number } {
  const clone = structuredClone(document) as LessonDocumentParsed;
  let applied = 0;
  for (const slot of sceneSlots(clone)) {
    if (slot.get()) continue;
    const url = urls.get(slot.segmentId);
    if (!url) continue;
    slot.set(url);
    applied++;
  }
  return { document: clone, applied };
}

/** The document's own title, used to ground a scene brief. Never fails a run. */
function lessonTitle(document: LessonDocumentParsed): string | undefined {
  const meta = (document as unknown as { meta?: { title?: unknown } }).meta;
  return typeof meta?.title === 'string' && meta.title.trim().length > 0 ? meta.title.trim() : undefined;
}

/**
 * Inspects a persisted document without requesting, changing, or billing for
 * anything. This is intentionally shared by the release acceptance check and
 * the generation stage so “visual coverage” has one definition everywhere.
 */
export function inspectIllustrationCoverage(document: LessonDocumentParsed): IllustrationCoverage {
  const missing: IllustrationCoverage['missing'] = [];
  let required = 0;
  let present = 0;

  for (const segment of document.segments as unknown as Array<{
    id: string;
    type: string;
    prompt_md: string;
    payload: AnyRecord;
    image_url?: string;
  }>) {
    const targets = planTargets(segment);
    for (const target of targets) {
      required++;
      if (target.has()) present++;
      else missing.push({ segmentId: segment.id, label: target.label, purpose: target.purpose });
    }

    const scene = sceneAnchorSubject(segment, lessonTitle(document));
    if (SCENE_ANCHOR_TYPES.has(segment.type) && scene) {
      required++;
      if (typeof segment.image_url === 'string' && segment.image_url.length > 0) present++;
      else missing.push({ segmentId: segment.id, label: scene.label, purpose: 'scene_anchor' });
    }
  }

  return { required, present, missing };
}

export async function illustrateSegments(
  document: LessonDocumentParsed,
  options: IllustrateOptions = {},
  deps: IllustrateDeps = {},
): Promise<IllustrateResult> {
  if (options.skip) return { document, generated: 0, billed: 0, inherited: 0, skippedReason: 'flag' };

  const request = deps.request ?? requestPicture;
  const cloned = structuredClone(document) as LessonDocumentParsed;
  let generated = 0;
  let billed = 0;
  let inherited = 0;

  /*
   * Required visual mode is fail-closed. Do the full worst-case cost admission
   * before the first image request, not target-by-target: otherwise a small
   * pilot can pay for several partial tiles and only then discover it cannot
   * finish a releasable visual bundle. The reservation is released immediately
   * because it is an admission test, not an in-flight claim; each real request
   * reserves itself below for concurrent-worker safety.
   */
  if (options.required && !options.reuseOnly && options.ledger) {
    const maxRequests = maxFreshImageRequests(cloned, options.inherit);
    if (maxRequests > 0) {
      const admission = options.ledger.reserve({
        provider: 'picturegen',
        model: getConfig().PICTUREGEN_MODEL,
        operation: 'image:required-coverage-admission',
        promptTokens: 0,
        completionTokens: 0,
        images: maxRequests * getConfig().FORGE_MAX_PICTUREGEN_IMAGES_PER_REQUEST,
      });
      admission.release();
    }
  }

  // Fetch ONE target; returns the url or undefined (this single illustration
  // failed — its icon/text stays the fallback). Rethrows NotConfigured so the
  // caller can bail the whole document.
  async function fetchOne(label: string, context: string, purpose: PicturePurpose): Promise<string | undefined> {
    // INHERIT FIRST — cheaper than the cache, because it needs no network at all and
    // survives the label/context rewrite that makes Prism's hash miss on every
    // regeneration. Scene anchors are excluded upstream (buildImageInheritance never
    // indexes them), so this can only reuse object art.
    const reused = inheritedUrl(options.inherit, label);
    if (reused) {
      inherited++;
      return reused;
    }
    if (options.reuseOnly) return undefined;
    // Prism's visual verifier may reject and redraw up to its configured cap.
    // Reserve that WORST CASE before the network call, then ledger the exact
    // successful/rejected pixel count Prism reports. This keeps a concurrent
    // visual pilot bounded even when a paid image never obtains a usable URL.
    const reservation = options.ledger?.reserve({
      provider: 'picturegen',
      model: getConfig().PICTUREGEN_MODEL,
      operation: `image:${purpose}`,
      promptTokens: 0,
      completionTokens: 0,
      images: getConfig().FORGE_MAX_PICTUREGEN_IMAGES_PER_REQUEST,
    });
    try {
      const picture = await request({ label, context, purpose, scope: options.scope });
      generated++;
      if (picture.generatedImages > 0) {
        billed += picture.generatedImages;
        await options.ledger?.record({
          provider: 'picturegen',
          model: getConfig().PICTUREGEN_MODEL,
          operation: `image:${purpose}`,
          promptTokens: 0,
          completionTokens: 0,
          images: picture.generatedImages,
        });
      }
      return picture.url;
    } catch (err) {
      // billedImagesFromError also covers a FOREIGN terminal error (timeout /
      // network TypeError) whose retry chain included billed 502 attempts —
      // paid pixels must reach the ledger regardless of what error class the
      // chain happened to end in.
      const billedOnError = billedImagesFromError(err);
      if (billedOnError > 0) {
        billed += billedOnError;
        await options.ledger?.record({
          provider: 'picturegen',
          model: getConfig().PICTUREGEN_MODEL,
          operation: `image:${purpose}:rejected`,
          promptTokens: 0,
          completionTokens: 0,
          images: billedOnError,
        });
      }
      if (err instanceof ProviderNotConfiguredError) throw err;
      // A budget stop is the kill switch firing, NOT a per-image hiccup.
      // Swallowing it here defeated FORGE_MAX_USD_PER_RUN entirely: the run
      // kept walking every remaining target, paying for each one, and shipped
      // lessons with silently missing illustrations instead of halting.
      if (err instanceof BudgetExceededError) throw err;
      if (options.required) throw err;
      console.warn(`images: skipping illustration for "${label}" — ${err instanceof Error ? err.message : String(err)}`);
      return undefined;
    } finally {
      reservation?.release();
    }
  }

  const title = lessonTitle(cloned);

  try {
    for (const segment of cloned.segments as unknown as Array<{ type: string; prompt_md: string; payload: AnyRecord; image_url?: string }>) {
      const ctx = plainLabel(segment.prompt_md);

      // Per-item / per-slot targets from the plan.
      for (const target of planTargets(segment)) {
        if (target.has()) continue;
        const url = await fetchOne(target.label, ctx, target.purpose);
        if (url) target.apply(url);
      }

      // Segment-level scene anchor for scene-worthy types (skip if already
      // set). The subject is the SITUATION the lesson describes, not the
      // instruction it prints — see sceneAnchorSubject. A segment that names
      // no situation gets no anchor rather than a confident wrong one.
      const scene = sceneAnchorSubject(segment, title);
      if (SCENE_ANCHOR_TYPES.has(segment.type) && !segment.image_url && scene) {
        const url = await fetchOne(scene.label, scene.context, 'scene_anchor');
        if (url) segment.image_url = url;
      }
    }
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) {
      if (options.required) throw err;
      // Prism not configured — clean skip, return the UNMODIFIED original
      // document (icons/text stay the fallback); no point trying the rest.
      return { document, generated: 0, billed: 0, inherited, skippedReason: 'not-configured' };
    }
    throw err;
  }

  return { document: cloned, generated, billed, inherited };
}

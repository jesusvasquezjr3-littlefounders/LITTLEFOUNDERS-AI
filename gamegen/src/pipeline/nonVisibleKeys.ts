// The STRING FREEZE for `localize` — which keys of a GameDocument a translation pass
// may touch, and which it must copy through byte-for-byte.
//
// ─────────────────────────────────────────────────────────────────────────────────
// READ THIS BEFORE "SIMPLIFYING" THIS MODULE INTO A FIELD-NAME LIST.
//
// coursegen's twin (`coursegen/src/pipeline/gates.ts` → `NON_VISIBLE_KEYS`) is a list
// of LEAF FIELD NAMES: `image_url`, `a_image_url`, `ask_icon`, `mode`… That works there
// because every non-visible value in a lesson document sits at a leaf with a NAME the
// list can enumerate.
//
// A GameDocument does not have that property. `skin.sprites` is
// `Record<string, string>` whose keys are SPRITE SLOT IDS declared per mechanic
// (`bin_1`, `item_14`, `tray`…), `skin.sfx` is `Record<eventName, sfxName>`,
// `item.props` is `Record<string, number>`, and `config` is a whole mechanic-specific
// object tree of thresholds, enums and item references. Their keys are DATA. You cannot
// enumerate the leaves, so the freeze has to skip the CONTAINER and descend no further.
//
// The stake is not cosmetic. `illustrate` runs on the es-MX document BEFORE this stage
// (gamegen/AGENTS.md, GAME_ENGINE.md §9), so the Prism/Depot sprite URLs already sit in
// `skin.sprites` when `localize` runs, and they are copied verbatim into en-US and
// pt-BR: ONE IMAGE SERVES THREE LOCALES, a 3x cut in the dominant cost of mass
// generation. A field-name list cannot name `skin.sprites.bin_3`, so a "simplified"
// version of this module would hand every sprite URL to DeepSeek to translate. The
// document would then either fail `z.url()` on re-validation (best case: a burnt paid
// retry) or come back as a *different valid-looking* URL and ship three locales of
// broken art (worst case, and silent).
//
// THE RULE IMPLEMENTED HERE: an object key in NON_VISIBLE_KEYS is skipped WITH ITS
// ENTIRE SUBTREE. Everything else is walked; every string reached is translatable.
// ─────────────────────────────────────────────────────────────────────────────────
//
// The freeze is a DENY list (same posture as coursegen: a new prose field is translated
// by default, which is the safe failure), and `nonVisibleKeys.test.ts` is what keeps it
// honest — it derives every leaf of the real envelope + all 8 mechanic schemas and
// fails until each non-prose leaf is covered. When it fails, ADD THE KEY. Never weaken
// the test: Forge learned this the expensive way when `mode: "typed"` came back from the
// translator as pt-BR prose and broke contract validation.

/** A step in a document path: an object key or an array index. */
export type PathSegment = string | number

export interface ExtractedString {
  /** Where the value lives, for exact re-injection after translation. */
  path: PathSegment[]
  value: string
}

/**
 * Keys whose value is structural, generated or closed-set — NEVER learner prose.
 *
 * Some of these are CONTAINERS (`config`, `sprites`, `sfx`, `props`, `roles`,
 * `abilities`, `grants`, `requires`): skipping them skips their whole subtree, which is
 * the only way to protect arbitrary `Record` keys. The rest are leaves.
 *
 * The document's translatable surface is, by construction, exactly the MarkdownLite
 * prose fields (`*_md`) plus `meta.title`. Everything else — ids, URLs, icon
 * ligatures, enum values, tuning numbers, booleans — belongs here.
 */
export const NON_VISIBLE_KEYS: ReadonlySet<string> = new Set([
  // ---- CONTAINERS: skipped whole, because their KEYS are data --------------------
  /** The mechanic's entire config tree: thresholds, ladders, enums, item refs, slot
   *  ids. Nothing a player reads lives here — labels live in `content`. */
  'config',
  /** slot id -> Prism/Depot URL. The one-image-serves-three-locales invariant. */
  'sprites',
  /** engine event name -> closed sfx vocabulary name. */
  'sfx',
  /** arbitrary numeric attributes per item (`Record<string, number>`). */
  'props',
  /** launcher/runner/stacker/flyer: buckets of ITEM IDS (`roles.collect[]`, …). */
  'roles',
  /** explorer: ability definitions — id + family enum + numeric costs, no prose. */
  'abilities',
  /** explorer node reward: `{ ability, tier }` — an ability id and a number. */
  'grants',
  /** explorer edge lock: `[{ ability, tier }]` — ability ids and numbers. */
  'requires',

  // ---- Generated media + identity ------------------------------------------------
  'background_url',
  'icon', // Material Symbols ligature: "cookie" must not become "biscoito"
  'id',
  'image_slot',
  'sprite_slot',
  'slug',
  'topic_path',

  // ---- Closed-set enums that live OUTSIDE `config` -------------------------------
  // (every enum inside `config` is already covered by the container above)
  'bgm',
  'cast',
  'family',
  'kind',
  'locale',
  'mechanic',
  'mode',
  'palette',
  'role',
  'teaches_family',
  'tier',

  // ---- Cross-references: another element's id, under a name that isn't "id" ------
  // Several of these currently appear only under `config` and are therefore already
  // covered. They are listed anyway so that MOVING a field from `config` into
  // `content` (a routine mechanic refactor) cannot silently start translating an id.
  'ability',
  'camp_id',
  'category',
  'collectible',
  'combines_into',
  'combines_with',
  'enemy',
  'enemy_type',
  'fragment_for',
  'from',
  'goal_node',
  'into',
  'item_id',
  'item_ref',
  'opponent_id',
  'requires_item',
  'requires_visited',
  'start_node',
  'to',
  'unit_id',

  // ---- Numeric / boolean tuning outside `config` ---------------------------------
  // A translator never sees a number today (the walker only extracts strings), but the
  // freeze is declared over KEYS, not over runtime types: the day one of these is
  // widened to a string it must already be frozen, not discovered by a broken run.
  'after_round',
  'assist_toggleable',
  'checkpoint',
  'correct',
  'currency_reward',
  'ease_after_failures',
  'ease_factor',
  'enabled',
  'estimated_minutes',
  'hidden',
  'lives',
  'one_way',
  'pass_score',
  'price',
  'schema_version',
  'sequence',
  'skill_required',
  'target',
  'value',
  'x',
  'xp_max',
  'y',
])

/** True when `key` freezes its value AND everything underneath it. */
export function isNonVisibleKey(key: string): boolean {
  return NON_VISIBLE_KEYS.has(key)
}

/**
 * True when the walker would never reach `path` — i.e. some object key along the way
 * is frozen. This is the container rule expressed as a predicate, and it is what the
 * schema-derived coverage test asserts against every leaf of every mechanic schema.
 */
export function isFrozenPath(path: readonly PathSegment[]): boolean {
  return path.some((segment) => typeof segment === 'string' && NON_VISIBLE_KEYS.has(segment))
}

function walk(node: unknown, path: PathSegment[], out: ExtractedString[]): void {
  if (node === null || node === undefined) return
  if (typeof node === 'string') {
    out.push({ path: [...path], value: node })
    return
  }
  if (Array.isArray(node)) {
    node.forEach((item: unknown, index) => {
      walk(item, [...path, index], out)
    })
    return
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      // THE CONTAINER SKIP. `continue` here abandons the whole subtree — not just this
      // leaf — which is the entire difference from coursegen's field-name list.
      if (NON_VISIBLE_KEYS.has(key)) continue
      walk(value, [...path, key], out)
    }
  }
}

/**
 * Every learner-visible string in a document, in a stable depth-first order, each with
 * the exact path it must be written back to.
 *
 * Order is deterministic for a given document (arrays by index, objects by insertion
 * order, which for a parsed-JSON document is document order), so the index map handed
 * to the model is reproducible — which is what makes the prompt prefix-cacheable across
 * a corrective retry.
 */
export function extractVisibleStrings(document: unknown): ExtractedString[] {
  const out: ExtractedString[] = []
  walk(document, [], out)
  return out
}

/**
 * Write `value` back at `path`. Returns false when the path no longer exists — which
 * would mean the structure moved under us, and the caller must refuse rather than
 * silently drop a translation.
 */
export function setAtPath(root: unknown, path: readonly PathSegment[], value: string): boolean {
  if (path.length === 0) return false
  let cursor: unknown = root
  for (let index = 0; index < path.length - 1; index++) {
    const segment = path[index]
    if (segment === undefined) return false
    if (cursor === null || typeof cursor !== 'object') return false
    cursor = (cursor as Record<PathSegment, unknown>)[segment]
  }
  const last = path[path.length - 1]
  if (last === undefined) return false
  if (cursor === null || typeof cursor !== 'object') return false
  ;(cursor as Record<PathSegment, unknown>)[last] = value
  return true
}

/**
 * The document with every translatable string replaced by its index — i.e. everything
 * the freeze protects, and nothing it does not.
 *
 * Two documents with an identical skeleton differ ONLY in prose: same ids, same
 * numbers, same sprite URLs, same enums, same key order. `localize` compares the
 * skeleton of what it sends against the skeleton of what it re-injects, so a model that
 * returns a "helpfully" restructured document is caught as a structure violation rather
 * than published as one.
 */
export function frozenSkeleton(document: unknown): string {
  const clone: unknown = structuredClone(document)
  extractVisibleStrings(clone).forEach((entry, index) => {
    setAtPath(clone, entry.path, `md:${index}`)
  })
  return JSON.stringify(clone)
}

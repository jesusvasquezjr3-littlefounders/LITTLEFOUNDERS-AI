# GAME_ENGINE.md — The LittleFounders Game Engine Specification

> **Authority:** Engine spec doc (level 6 in /AGENTS.md §1.1), sibling of /LESSON_ENGINE.md
> and /COURSE_ENGINE.md. AUTHORITATIVE for the game document contract, the mechanic
> taxonomy, the determinism/replay contract, reward derivation, the mechanic slice layout
> and the Arcade generation pipeline's obligations toward all of it. `gamegen/` (Arcade)
> MUST generate against this contract. On conflict with /AGENTS.md (== /CLAUDE.md),
> ROADMAP.md, GLOSSARY.md or DESIGN.md, **those win and this file gets fixed** — never the
> other way round.
>
> **Status:** v1.2 — Phaser 3.90 rendering layer shipped 2026-07-30, then hardened same-day
> (boot sequence, seed correctness, reward-derivation path, camera/world-size fit — commits
> `4530850`, `695891c`). All 8 mechanic scenes (canvas-based games with particles, screen
> shake, tweens, SFX and proper game feel) are the live play-time renderer; the earlier
> React-DOM `components.tsx` views remain in the tree as a reference/testing artifact only
> (§2.1, §7). Core (port 4000), Vault migrations 0027/0028/0029, and the Arcade generation
> pipeline (`gamegen/`, port 4003) are unaffected — this was a rendering-layer change only.
> **Last updated:** 2026-07-30 · Language: English (project rule).

---

## §1 Purpose & scope

The Game Engine plays **short, deterministic, concept-bound arcade games** that reinforce a
concept a child has *already learned* in a lesson. It is the `games/` product section's
runtime, and it is the Lesson Engine's twin: hand-written mechanics (code) skinned and
parameterized per instance by a generated manifest (data).

**The one-line decision this engine embodies:** *prebuilt parameterized mechanics + generated
JSON manifests.* Fully-generated HTML5 games were **REJECTED**, for three independent reasons
each of which is disqualifying on its own:

1. **Unreviewable code surface aimed at children (/AGENTS.md §1.9).** Generated game *code*
   cannot be moderated the way generated *content* can. Kid-facing output must pass
   moderation before display and a human publish gate; a novel program per instance means the
   thing a child executes was never reviewed by anyone, and "sandboxed" is a containment
   claim, not a safety claim.
2. **No shared quality bar.** With N generated engines there are N feel-and-fairness
   implementations, N accessibility postures, N responsive behaviours (§1.11), N motion
   policies. With 8 hand-written mechanics there is exactly one of each, and improving the
   feel of `runner` improves every `runner` game ever generated, retroactively.
3. **Incompatible with deterministic gates.** Rewards are derived by replaying the player's
   input log server-side (§5, §6). Replay requires a simulator the server also has. Generated
   code cannot be replayed, cannot be bot-tested for winnability before publish, and cannot be
   trusted with XP — which would leave client-reported scores as the only reward signal, the
   exact thing `gamegen/AGENTS.md` forbids.

**What the Game Engine is NOT:**

- Not a lesson runtime. It never teaches a concept cold; it consolidates one (§8).
- Not a grader. There is no answer key and no `Verdict`; there is a *simulation outcome*.
- Not a general game platform. The mechanic set is CLOSED at 8 and grows only through §12.
- Not a live-AI surface. No model call happens while a child plays — ever (§11).
- Not the owner of `lessons_completed`. Games never touch it (§6).

| Term | Meaning |
|---|---|
| **game document** | One `GameDocument` — a single-locale, client-safe JSON manifest for one game instance. |
| **mechanic** | One of the 8 hand-written, code-level game loops. The document's discriminator. |
| **slice** | The 5 files implementing one mechanic (§7). Zero cross-slice imports. |
| **simulator** | The mechanic's pure, deterministic state machine (`simulate.ts`). Runs in browser AND server. |
| **input log** | The ordered `GameInputEvent[]` a play session produced. The only thing the server trusts. |
| **replay** | Re-running the simulator over an input log to DERIVE the score. The reward path. |
| **validation sidecar** | `GameValidation` — server-only bounds for a document. Never shipped to a client. |
| **skin** | Palette + Prism sprites + SFX/BGM ids. Data, per instance. |

## §2 Architecture map

```
gamegen/curriculum/<course>/games.yaml        ← game blueprints (topic_path + mechanic + intent)
        │  cross-validated against coursegen/curriculum/<course>/catalog.yaml
        ▼
gamegen/  (Arcade, 4003)   ← §9 pipeline
   validate → plan → author → gate → simulate → judge → localize → illustrate → publish
        │            DeepSeek author · Qwen judge · Prism (picturegen/, 4007) art
        ▼
database/  (Vault)   games · game_documents(×3 locales) · game_attempts · game_progress
        │            migrations 0027_game_engine.sql, 0028_game_insights.sql
        ▼
backend/  (Core, 4000)   /api/v1/games  ── the ONLY service the browser calls
        │   backend/src/game-contract/  = parity copy of the pure simulation code
        ▼
frontend/  (5173)   src/game-engine/  ── core/ · mechanics/<8>/ · player/ · registry.ts
                    routes: /games (hub) · /games/:slug (fullscreen) · /dev/game-lab (DEV only)
```

Service ports and missions are LOCKED by /AGENTS.md §1.5: `gamegen/` (Arcade) is **4003**,
`picturegen/` (Prism) **4007**, `filebase/` (Depot) **4006**, `backend/` (Core) **4000**.
Arcade is an **internal** service: `INTERNAL_API_KEY` only, never reached from a browser.
Depot's public read route serves the sprite/background media directly to the browser — that
is the documented §1.5 exception (world-readable, PII-free media); every WRITE stays
internal-key-only.

Core route surface (details in §6):

| Route | Purpose |
|---|---|
| `GET /api/v1/games` | Published games + caller progress, grouped course → adventure → topic; per-game `state: 'locked' \| 'ready' \| 'played'`. |
| `GET /api/v1/games/:gameId` | `{ game, locale, document }`, document **stripped** of `validation`. `403 GAME_LOCKED`, `404 NOT_FOUND`. |
| `POST /api/v1/games/:gameId/complete` | Server replays the input log, derives the score, writes progress. `422 RESULT_REJECTED` on any replay/bound violation. |

Every response uses the §1.6 envelope `{ data, error }` — no exceptions, including 404 and
500. New error codes `GAME_LOCKED` (403) and `RESULT_REJECTED` (422) each require
`errors.api.<CODE>` in all three locales in the same commit (§1.8).

### §2.1 Rendering layer (Phaser 3.90)

The 8 mechanics render through **Phaser 3.90 scenes** — `<canvas>`-based games with particle
systems, camera shake, sprite tweens, and synthesised SFX. The simulators (§5) remain
untouched; Phaser is the *renderer only*. Architecture — **the scene drives the bridge, not
the other way round**: `BaseMechanicScene.update()` (Phaser's own per-frame callback) calls
`bridge.update(delta)` and then reads `bridge.bridgeSnapshot`/`bridge.finishPayload`; the
bridge itself has no Phaser dependency and never reaches into the scene.

```
Simulator (50ms tick, deterministic, PURE)
     ▲
     │  bridge.update(delta) / bridge.enqueue(action, payload)
     │
GameEngineBridge (interpolates, owns the input log, enforces maxTicks)
     ▲
     │  scene.update() calls the bridge every frame and reads bridgeSnapshot/finishPayload
     │
PhaserScene (sprites, particles, camera, SFX, pointer/keyboard → bridge.enqueue)
```

Key files in `frontend/src/game-engine/`:

| Path | Role |
|---|---|
| `phaser/bridge.ts` | `GameEngineBridge<S>` — wraps a simulator in a Phaser-compatible lifecycle; has no import of `phaser` itself |
| `phaser/scene.ts` | `BaseMechanicScene<S>` — abstract scene base: seed/runId/maxTicks/reducedMotion/strings from `init()`, palette, `getWorldSize()` camera-fit hook, `update()` drives the bridge, pause/resume lifecycle |
| `phaser/juice.ts` | Camera shake, particle bursts, scale punch, hit pause, floating text — every entry point gates on `reducedMotion` through one shared `isReduced(scene)` chokepoint (§10) |
| `phaser/sfx.ts` | Web Audio API synthesised SFX (click, collect, explode, levelUp, etc.) — every entry point gates on the mute flag through one shared function (§10) |
| `phaser/assets.ts` | Procedural sprite/background generation (colored geometric shapes), palette resolution |
| `phaser/spriteLoader.ts` | Queues real Prism/Depot art (`skin.sprites`/`skin.background_url`) in `preload()` and resolves, per slot, whether the real texture loaded — see below |
| `phaser/sceneRegistry.ts` | Lazy-loading registry from `MechanicId` to its scene class, one dynamic `import()` per mechanic |
| `player/PhaserGameBox.tsx` | React component that mounts exactly one `Phaser.Game` per run, bridges to React lifecycle (§10 auto-pause) |
| `mechanics/<id>/scene.ts` | Per-mechanic Phaser scene (one per mechanic) — the game world renderer, extends `BaseMechanicScene` |

**Real art vs. procedural placeholders.** `preload()` (in `BaseMechanicScene`) calls
`spriteLoader.ts`'s `queueRealSprites()` to `load.image()` every URL the document's
`skin.sprites`/`skin.background_url` declare. A mechanic's `scene.ts` always generates its
usual procedural placeholder first (cheap, synchronous, never fails), then asks
`this.spriteKeyFor(slot, fallbackKey)` / `this.backgroundKeyFor(fallbackKey)` which texture key
to actually draw: the real key if that slot was bound AND the load succeeded, the placeholder
key otherwise (unbound slot, or a Depot URL that 404s/errors — tracked per-run so one bad URL
degrades to the placeholder instead of a blank sprite). No mechanic branches on "is real art
loading" itself; the two helper methods are the only decision point.

**Renderer status: `components.tsx` is not the play-time renderer, and is currently dormant
everywhere else too.** Every mechanic still ships a `components.tsx`
(`export function <M>View(props: MechanicViewProps)`) and every `register.ts` still wires it
into `MechanicSlice.View`, because `MechanicSlice` is the shared type the backend/gamegen
parity registries are built over (§7) — removing the field is a type-contract change, not a
delete. `GamePlayer.tsx`'s real play path (`GameStage`, mounted for BOTH the production
`/games/:slug` route and `/dev/game-lab`) never reads `slice.View` at all — it always loads the
mechanic's `scene.ts` via `sceneRegistry.ts` and mounts it through `PhaserGameBox`, regardless
of what `slice` it was given. `/dev/game-lab` (`GameLabPage.tsx`) still imports `View` and
wraps it in a debug probe (`createProbeView`) before handing the wrapped slice to `GamePlayer`
— but because `GameStage` ignores `slice.View`, that wrapper is never actually mounted today,
so the lab's live-snapshot readout and manual step-mode UI (built on that same View/scheduler
wiring, §10) are themselves stale against the Phaser path, not a working secondary consumer.
The component's own DOM-rendering tests (`components.test.tsx` in `sorter`/`runner`,
`GamePlayer.test.tsx`) exist and still render `<SorterView>`/`<RunnerView>` directly, but every
`it()` in all three files is currently `.skip`'d (commit `4680a61`: "canvas rendering requires
browser E2E") — so as of this read, **no test in CI exercises `components.tsx` either.**
`components.tsx` is therefore, honestly: dead at runtime (no code path renders it), unverified
in CI (its own tests are skipped), and kept as source only — a reference implementation of the
mechanic's `MechanicViewProps` contract and a type-level placeholder for `MechanicSlice.View`.
The audit that reviewed the Phaser rewrite downgraded its continued presence to a minor
finding on the basis that its bundle cost is negligible (it is its own lazy chunk, like
`scene.ts`) and that full removal — including un-skipping or deleting its tests and dropping
`View` from `MechanicSlice`/`MechanicSimSlice` — was deliberately scoped out of that pass
rather than silently deferred. Re-enabling the lab's live probe against the real Phaser scene,
or removing `components.tsx`/`View` outright, is open follow-up work, not something this
document can claim is already handled.

**i18n for canvas-drawn text.** A Phaser scene is a plain class with no React context — it
cannot call `useTranslation()`/`t()` — so a canvas string reaches the player's locale through
one closed channel instead: `MechanicSceneInit.strings: Record<string, string>`
(`phaser/scene.ts`). `PhaserGameBox.tsx` is the only file in this tree that calls `t()` for
canvas copy; it resolves every key in the exported `CANVAS_STRING_KEYS` array through
`t(`games.canvas.\<key\>`)` **once**, at scene start (the same "read once, no mid-run
re-wire" convention already used for `document`/`seed`/`reducedMotion`), and hands the
resolved dictionary into the scene's init data. `BaseMechanicScene` stores it as
`this.strings`, and every mechanic's `scene.ts` reads `this.strings['someKey']` in its
`makeText`/`setText`/`floatText` calls instead of a hardcoded literal.

The dictionary lives under a single flat `games.canvas.*` namespace (§1.7/§1.8 — key set
defined in `en-US`, mirrored with real translations into `es-MX` and `pt-BR` in the same
commit) so several mechanics can share one key for the same concept — e.g. `games.canvas.sell`,
`games.canvas.ready`, `games.canvas.rest` — instead of each mechanic inventing its own scoped
copy. Keys are named after their MEANING, not their mechanic. To add a new canvas string: add
`games.canvas.<name>` to all three locale files, then append `'<name>'` to `CANVAS_STRING_KEYS`
in `phaser/scene.ts` — that array is the single source of truth for which keys a scene may
read, and it is intentionally separate from the longer, full-sentence `games.<mechanic>.*` keys
that already exist for the DOM `MechanicView` components' (`components.tsx`, dormant per the
status above) ARIA labels — those stay as they are; canvas copy is deliberately terser to fit
a fixed-pixel `Phaser.GameObjects.Text`.

## §3 The `GameDocument` contract

Zod source of truth: `frontend/src/game-engine/core/schemaBase.ts` (shared building blocks,
mirroring the lesson engine's `idSchema`/`markdownLite`/`iconName` conventions) +
`core/schema.ts` (the discriminated union over `config`/`content`, keyed on
`meta.mechanic`, composed from the per-mechanic slice schemas). TS interfaces live in
`core/types.ts`. Core and Arcade hold parity copies validated by tests — there are no npm
workspaces (§1.2).

```ts
interface GameDocument {
  schema_version: 1
  meta: {
    slug: string                       // kebab-case, <=64, unique within its topic
    title: string                      // <=120, LOCALIZED per document
    locale: GameLocale                 // 'en-US' | 'es-MX' | 'pt-BR' — one document each
    mechanic: MechanicId               // THE discriminator
    concept: {
      topic_path: string               // "<adventure>/<saga>/<topic>" — binding is DATA (§8)
      recap_md: string                 // <=400 MarkdownLite: "what you just learned"
    }
    tier: 1 | 2 | 3                    // Piaget bands: 1 = 6-7, 2 = 8-10, 3 = 10-12
    estimated_minutes: number          // 1..10
    cast?: CharacterId[]               // <=4, from the canon 4 ONLY (dina|liruf|rho|zara)
  }
  skin: {
    palette: GamePaletteId
    background_url?: string            // Prism → Depot URL
    sprites: Record<string, string>    // sprite SLOT id → Depot URL; slot ids are declared
                                       // per mechanic as <M>_SPRITE_SLOTS in its schema.ts
    sfx?: Record<string, GameSfxName>  // engine event name → CLOSED sfx name
    bgm?: GameBgmId
  }
  config: MechanicConfig               // per-mechanic, Zod-validated (§4)
  content: {
    items: GameItem[]                  // 1..80
    categories?: GameCategory[]        // 0..8
    interludes?: GameInterlude[]       // 0..4 between-round micro-exercises
    feedback: {
      correct_md: string[]             // 1..6, rotating
      incorrect_md: string[]           // 1..6, rotating, outcome-neutral, NEVER punishing
      results_md: string               // <=300
    }
  }
  scoring: {
    mode: 'cheer' | 'arcade'
    xp_max: number                     // 5..50
    pass_score: number                 // 0..100
    lives?: number | null              // null in cheer mode
    target?: number                    // mechanic-specific win target
  }
  adaptive?: {
    enabled: boolean
    ease_after_failures: number        // 1..5
    ease_factor: number                // 0.5..1
    assist_toggleable: true            // ALWAYS true — the player may decline help
  }
}
```

Field-by-field constraints beyond the inline bounds:

| Field | Constraint & why |
|---|---|
| `schema_version` | Literal `1`. A future `2` is a new union member, never a mutated `1`. |
| `meta.slug` | `^[a-z0-9]+(-[a-z0-9]+)*$`. Publish is an upsert by `(topic_id, slug)` — the slug is the idempotency key of a re-run. |
| `meta.locale` | Exactly one locale per document. Arcade emits three; ids, numbers and `config` are copied programmatically, never re-generated (§9). |
| `meta.concept.topic_path` | Must resolve in the course catalog. Persisted as the `games.topic_id` FK — the path in the document is the human-readable echo, the FK is the truth. |
| `meta.concept.recap_md` | MarkdownLite (§3.1). Shown in the pre-play recap card — the "learn first" contract made visible. |
| `meta.cast` | Subset of the canon four. The character rig's APPEARANCE is non-negotiable (LESSON_ENGINE §9); games reuse `CharacterActor`, never re-draw. |
| `skin.palette` | One of the CLOSED `GAME_PALETTES`: `navy-papaya`, `forest-pear`, `ocean-blue`, `sunset-papaya`, `violet-night`, `sand-clay`. Each maps to existing DESIGN.md tokens — **never raw hex**. |
| `skin.sprites` | Keys MUST be a subset of the mechanic's declared `<M>_SPRITE_SLOTS`. An undeclared key is a schema error, not a warning: it would silently never render. |
| `skin.sfx` | Values from `EXISTING_SFX` (`celebration correct drop flip hint match perfect streak tryagain`) or `GAME_SFX_NEW` (`launch impact explode build collect powerup whoosh alarm engine`). Closed sets — the engine resolves an id to a file, so an invented name is a 404 at play time. |
| `skin.bgm` | One of `arcade-calm`, `arcade-drive`, `arcade-tense`, `arcade-triumph`. |
| `content.items[].id` | <=48, unique within the document. Ids are referenced by the input log; a duplicate id makes a replay ambiguous. |
| `content.items[].category` | When present MUST reference a `content.categories[].id`. |
| `content.items[].misconception_md` | WHY a trap item is wrong (the content-playbook rule, LESSON_ENGINE P7's twin). A trap without a teaching reason is invalid output. |
| `content.items[].props` | `Record<string, number>` only — numeric, mechanic-specific attributes (cost, hp, weight, speed). Kept numeric so the deterministic gates can re-verify arithmetic. |
| `content.feedback.incorrect_md` | Outcome-neutral, never punishing (LESSON_ENGINE P3). No red "WRONG" in a kid product. |
| `scoring.mode` | `cheer` = no fail state, the tier-1 default; `arcade` = `lives` is a number. Cheer mode requires `lives === null`. |
| `scoring.pass_score` | The score the perfect bot MUST reach and the random bot MUST NOT (§9). |
| `adaptive.assist_toggleable` | Literal `true`. Help is offered, never imposed — a child who declines assistance keeps full agency. |

```ts
interface GameItem {
  id: string                           // <=48, unique in the document
  label_md: string                     // <=80 MarkdownLite — short, literal, TTS-safe
  category?: string                    // must reference a GameCategory.id when present
  value?: number                       // money/price/weight, per mechanic
  image_slot?: string                  // key into skin.sprites
  icon?: string                        // Material Symbols name — fallback when no sprite
  misconception_md?: string            // WHY a trap/wrong item is wrong
  tier?: 1 | 2 | 3 | 4                 // difficulty tier for spawn tables
  props?: Record<string, number>       // mechanic-specific numeric attributes
}

interface GameCategory { id: string; label_md: string; description_md?: string; image_slot?: string }

interface GameInterlude {
  id: string
  after_round: number
  kind: 'pick_one' | 'true_false' | 'tap_all'
  prompt_md: string
  options: { id: string; label_md: string; correct: boolean; rationale_md?: string }[]
}
```

### §3.1 MarkdownLite

Every `*_md` field accepts ONLY `**bold**`, `*italic*`, `` `code` ``, line breaks and `- `
lists, rendered by the lesson engine's `core/MarkdownLite.tsx` — hand-rolled and
injection-safe (raw HTML renders inert). The Game Engine reuses that renderer; it does not
fork it. Anything else renders as literal text.

### §3.2 The server-only sidecar and `stripValidation()`

```ts
// stored in game_documents.validation — NEVER part of the client document
interface GameValidation {
  max_score: number                    // theoretical maximum
  min_duration_seconds: number
  max_events: number                   // cap on input-log length
  item_values?: Record<string, number>
  notes?: string
}
```

**Security invariant (non-negotiable).** `validation` NEVER reaches a client.
`core/strip.ts` exports `stripValidation(doc)` — the **only** sanctioned stripper, the exact
twin of the Lesson Engine's `stripAnswers()` (`frontend/src/lesson-engine/core/strip.ts`),
and it is mirrored server-side in `backend/src/game-contract/`. Core serves only stripped
documents. Two consequences that must never be "simplified" away:

- `game_documents` runs **RLS enabled with ZERO policies** (service-role only). RLS is
  row-level, not column-level: any client `SELECT` policy on that table would expose
  `validation` alongside `document`. This is the same posture `lesson_documents` uses for
  `answer_keys`, and the same explanatory comment belongs in migration `0027`.
- The sidecar is *bounds*, not *answers*. A game has no answer key; what leaks if this
  slips is the reward ceiling and the anti-cheat envelope, which is exactly what an
  attacker needs to forge a maximal input log.

## §4 The mechanic taxonomy — 8 mechanics, CLOSED

```ts
MECHANIC_IDS = ['sorter','launcher','runner','stacker','autobattler','explorer','defender','flyer']
```

The 8 ids are pinned. What is **code** in every one of them: the loop, the physics, the
collision/resolution rules, the win/lose conditions, the HUD, the bots. What is
**manifest-driven** in every one of them: the skin (palette, sprites, background, SFX, BGM),
the item/category **catalogs** (labels, values, `props`, tiers, misconceptions), the
**difficulty tables** (spawn schedules, waves, ramps, tolerances), the **economies**
(budgets, costs, income, fuel), the targets, and every string. A new game instance is a new
JSON file, never new code.

This table is derived from the owner's Game Mechanics Report (single-player design). Each
row's **Essential components** and **Variables & difficulty curve** from that report must be
*representable* in the mechanic's `config`/`content` schemas — a requirement that cannot be
quietly narrowed (§1.12.7). Where an element is genuinely out of scope for a
kid-appropriate, deterministic, touch-first implementation, the omission is recorded in §13,
never left silent.

| id | Core mechanic (report) | Simulation model | Config surface (manifest-driven) |
|---|---|---|---|
| `sorter` | Grab a movable element from a source zone and **drag it onto one of several fixed target containers**; the system validates belonging instantly. Correct placement consumes it; a wrong one returns it and applies a penalty. | Fixed-tick spawn + fall integration with per-entity state; drop resolution against container hit zones; batched removals. | mode (`static`/`falling`/`conveyor`), **2–8 categories**, difficulty ladder (spawn interval in ticks, fall speed, variance, max simultaneous, included item tiers, points), combo curve (step/max), penalty model (miss vs wrong drop: time/lives/combo), **trap elements** that belong nowhere, discard zone on/off, level-up rule. |
| `launcher` | Define **force and angle** (pull-back or power bar + angle wheel) and fire a projectile on a **parabolic trajectory** under gravity at targets among obstacles. | Fixed-timestep 2D kinematics (documented integrator), `dsin`/`dcos`/`datan2` from `core/mathd.ts` (§5), AABB/circle collisions, deterministic bounce resolution. | gravity, wind, surface friction; **projectiles per round + leftover bonus**; projectile types (heavy/light/**guided**/**explosive**, bounce, split); target layouts incl. **moving targets** (paths, speed ramp); obstacle materials (absorb/deflect); **predictive-trajectory aid as a tier-gated flag**; scoring weights (accuracy, useful bounces, projectiles left). |
| `runner` | The avatar advances automatically; the player controls **exactly one binary action** (jump, lane change, gravity flip, impulse) to dodge and collect. **Timing is the skill.** | Fixed-tick world advance, per-entity vertical/lane integration, seeded pattern spawning, AABB collisions, checkpoint respawn. | action model (`jump`/`lane`/`flip`/**`contextual`**) + physics (impulse, gravity, lane count, transition ticks); speed ramp phases; obstacle/collectible pattern library + spacing; **surface map for the contextual action** (ground→jump, water→dive, air→glide); hold-to-glide; obstacle variants (static/sudden/moving); lives + checkpoint policy; scoring weights (distance vs collectibles). |
| `stacker` | Place pieces with **mass, friction and restitution** so the structure **withstands scheduled external forces** and holds a **stability margin** for a minimum time. | Small **deterministic rigid-body solver** written in-repo (AABB/circle bodies, fixed solver iterations, sleep states, documented collapse criterion) — no external physics library. | gravity (direction + intensity, incl. **zero-G**); piece catalog (geometry, mass, material, **adhesive/magnetic/elastic/brittle/counterweight**); **announced force timeline** (wind, vibration, earthquake, added mass, extra load); stability margin threshold + `T_hold`; placement controls (ghost preview, step rotation, drop vs snap, **reposition cost**); economy (**budget, cost ∝ mass/volume, partial refund, efficiency bonus**); scoring (height × margin × efficiency + style bonus for cantilevers/symmetry); **adaptive assistance** (suggest a piece / reduce a force by N%, player-toggleable) wired through the document's `adaptive` block. |
| `autobattler` | **Recruit and position** units with attributes and synergies; combat resolves **automatically**. All strategy is in the preparation phase; the inter-round economy rewards planning. | Seeded tick simulation where one report-specified 0.5 s combat tick = **exactly 10 engine ticks** (integer counter, never a float); array-order resolution, never a `Set`/`Map` walk. | **shop/draft** (offers per round, buy cost, **refresh cost**, rarity by player level); unit stats incl. **mana + triggered ability**; **star merging** with per-star multipliers; **traits/synergies** with activation thresholds; **positioning grid + adjacency bonuses**; targeting rule; inter-round economy (income, **interest with a cap**, win/loss streaks); player health + round damage table; **AI opponent profiles** (saver/rush/synergy/mirror/adaptive + error rate); **PvE rounds dropping combinable items**. |
| `explorer` | The world is a **graph of nodes** whose edges are blocked by **ability locks**. Explore, note locks, find the required ability elsewhere, return and open the path. Progression is guaranteed by a topological acquisition order. | Graph traversal plus per-node micro-challenges — deliberately **not** a real-time platformer (deterministic, replayable, honest on touch). Ships a **reachability-fixpoint solver** so an unsolvable world is rejected before publish. | world graph (nodes, edges with requirements, one-way shortcuts); **full lock taxonomy: hard / soft / compound / temporal**; ability families (movement, interaction, perception) with cost and **tiers**; acquisition sites (boss, hidden shrine, purchase, **fragment upgrades**) + tutorial room per family; **signposting codes** (colour + shape + sound); checkpoints and **death losing a recoverable soft currency at the death site** (abilities never lost); **sequence-combination locks**; connectivity ratios; collectible layer; **exploration-percentage ending**. |
| `defender` | Waves path automatically toward the exit along the **shortest available route**; the player places auto-firing towers **and builds walls that redirect the flow**, designing a labyrinth that maximises time under fire. | Fixed-tick grid simulation + **deterministic A\*** (fixed neighbour order, documented tie-break, exactly-representable costs); a wall that would fully seal the path is **rejected before it is applied**. | grid + entries/exits + **unbuildable terrain**; enemy waves (composition, health/speed/armour/resistances, behaviours incl. **flying**, **sapper**, splitter, healer, shielded, stealth, phased boss); **8 tower archetypes** (single-target, area, slow, DoT, anti-air, aura, economy, block/trap) with range/rate/damage and **switchable target priority**; wall cost; **damage-type × armour matrix** + slow diminishing returns and cap; economy (gold per kill, wave bonus, interest, economy towers) + **secondary currency for global abilities**; lives cost per enemy type; **2–3 mutually exclusive upgrade branches to tier 3** (tier 3 transforms the archetype) + **sell refund %**; exponential HP/gold growth factors; **voluntary "heat" modifiers**; efficiency reward. |
| `flyer` | Fly an entity that must **manage an energy reserve** drained by sharp manoeuvres and attacks and regenerated by passive flight (gliding, thermals), fighting while holding an advantageous position. **Deliberately 2.5D, not the report's 6DoF — see §13.** | Fixed-tick arcade flight over a small state (forward motion, climb/dive/altitude, speed, optional lanes); `core/mathd.ts` for all trigonometry; AABB/circle collisions; documented stall condition and energy curve. | flight model dialled arcade↔simulation (accel, turn rate, drift, **stall**); **energy economy** (manoeuvre/attack drain, **glide and thermal regeneration**); armament (**continuous beam with energy drain**, projectiles on cooldown, optional body slam); aerial enemy types + patterns (circle/pursuit/retreat) incl. **phased bosses**; environment (**thermals**, storms reducing visibility, obstacles); weather (turbulence, crosswind, rain dousing attacks); **upgrades block** (turn speed, energy capacity, attack element, armour). |

Two mechanics never share a state shape, a schema or a component; a slice imports only
`core/*` (§7). Which mechanic a blueprint gets is an authoring decision recorded in
`games.yaml`, and the concept binding is orthogonal to it — the same topic can have a
`sorter` and a `launcher` game.

## §5 Determinism & the replay contract

**Why this section is load-bearing:** the reward for a play session is not the number the
client reports. Core re-runs the mechanic's simulator over the player's input log and derives
the score itself (§6). That is only sound if the simulator produces **bit-identical** results
in the browser's V8 and in Node. So determinism here is not a style preference; it is the
integrity of the XP economy.

**Hard invariants for every `simulate.ts`:**

1. **Pure.** No React, no DOM, no `Date.now()`, no `Math.random()`, no I/O, no mutation of
   inputs. `step()` returns a NEW state (structural sharing is fine).
2. **Integer ticks.** Fixed tick `TICK_MS = 50`. Never a delta-time float — a frame-rate
   dependent simulation cannot be replayed at all.
3. **Allowed arithmetic ONLY:** `+ - * /`, `Math.sqrt`, `Math.abs`, `Math.min`, `Math.max`,
   `Math.floor`, `Math.ceil`, `Math.round`, `Math.trunc`, `Math.sign`. These are exactly
   specified by IEEE-754 / ECMAScript, so every engine agrees on the last bit.
4. **BANNED:** `Math.sin`, `cos`, `tan`, `atan`, `atan2`, `exp`, `log`, `pow`, `hypot`,
   `cbrt`, and `**` with a non-integer exponent. ECMAScript leaves the transcendental
   functions **implementation-defined** — V8 and a different Node build may disagree in the
   low bits, and one wrong bit in a projectile arc is a rejected reward for an honest child.
   Use `core/mathd.ts` instead: `dsin(deg)`, `dcos(deg)`, `datan2(y, x)`, `dpow(base, intExp)`,
   implemented from fixed-term polynomial series using ONLY the ops in rule 3.
5. **Randomness comes only from the injected seeded PRNG** (`core/rng.ts`, mulberry32). The
   seed is a `number` derived from the run id; the same seed replays identically. A simulator
   never reaches for global randomness.
6. **Deterministic iteration order.** Arrays, always. Never `Set`/`Map` iteration whose
   insertion order came from something nondeterministic, and never `Object.keys` on a
   dynamically-keyed object without sorting.

```ts
// core/types.ts — the simulator contract every mechanic implements
interface GameInputEvent { tick: number; action: string; slot?: string; x?: number; y?: number; n?: number }
interface SimSnapshot { finished: boolean; score: number; lives: number | null; round: number }
interface SimResult { score: number; finished: boolean; stats: Record<string, number> }

// A simulator is BOT-LESS. See "Where the bots live" below — that is a security
// boundary, not an omission.
interface Simulator<S = unknown> {
  readonly mechanic: MechanicId
  readonly actions: readonly string[]                 // valid `action` values (validation)
  init(input: SimInit): S                             // { config, content, scoring, seed }
  step(state: S, tick: number, events: readonly GameInputEvent[]): S
  snapshot(state: S): SimSnapshot                     // cheap read for HUD + bots
  result(state: S): SimResult
}
type GameBot<S> = (state: S, tick: number, rng: Rng) => GameInputEvent[]
interface GameBots<S> {                               // for the winnability gate (§9)
  perfect(state: S, tick: number, rng: Rng): GameInputEvent[]
  random(state: S, tick: number, rng: Rng): GameInputEvent[]
}
```

### Where the bots live — and why not on the simulator

`bots.perfect` returns the exact `GameInputEvent[]` Core replays to grant XP, and a
maximal log is short: 4 events for `launcher`, 8 for `defender`, 10 for `sorter`. While
`bots` was a member of `Simulator`, every mechanic's `register.ts` — the module
`MECHANIC_LOADERS` dynamic-imports, i.e. the root of that mechanic's lazy chunk — pulled
an optimal headless player into the JavaScript the browser downloads. Anyone could lift it
out of the emitted chunk, run it against the document the API had already served them, and
POST a maximal input log without playing a tick. Replay-derived rewards exist precisely so
the client cannot assert a score; shipping the optimal player hands that back.

So each mechanic declares its bots in a sibling **`bots.ts`**, exported as
`<m>Bots: GameBots<State>`:

- **imported by** gamegen's `simulate` winnability gate (via `getMechanicBots()` in
  `gamegen/src/contract/registry.ts`) and by the test suites — neither runs in a browser;
- **never imported by** `register.ts`, `components.tsx`, `GamePlayer` or anything else on
  the client import graph. `registry.test.tsx` walks the real import graph from each
  `register.ts` and fails on the edge by name.

Keeping `bots` off `Simulator` is what makes "no bots in the browser" the DEFAULT rather
than a rule someone has to remember: there is no field to helpfully fill in. Core's
`MechanicSimSlice` deliberately has no bots field either — the reward replay has no
business holding a bot, and one shared shape is how the bot would find its way back.

`core/replay.ts` exports the **single shared entry point** used by the dev lab, the
generation bot-gate and the SERVER — three callers, one implementation, so a divergence is
impossible by construction:

```ts
function replayGame(args: {
  simulator: Simulator<unknown>
  document: GameDocument            // the client-safe doc is enough (config/content/scoring)
  seed: number
  inputLog: readonly GameInputEvent[]
  maxTicks: number
}): { ok: true; result: SimResult } | { ok: false; reason: string }
```

Before stepping, `replayGame` VALIDATES the log — monotonic non-decreasing ticks, every
`action` in `simulator.actions`, event count within the cap, `tick <= maxTicks` — and returns
`{ ok: false, reason }` on any violation. It never throws at the caller, and it never
partially credits an invalid log.

`backend/src/game-contract/` is a **parity copy** of the pure code (`core/types.ts` subset,
`rng.ts`, `mathd.ts`, `replay.ts`, and every `mechanics/*/simulate.ts` + `schema.ts`), with
its own `npm run contract:check` modeled on `coursegen/src/contract/check.ts`; `gamegen/src/contract/`
carries the same copy for the pipeline's simulate stage. Parity is enforced by that check,
not by discipline. Determinism itself gets explicit regression tests: same seed + same log →
same `SimResult`, and the banned-function list is grepped in CI.

## §6 Scoring, XP and rewards

**Modes.** `scoring.mode = 'cheer'` is the tier-1 default and has **no fail state**: mistakes
cost score, never a run (`lives === null`). `'arcade'` sets `lives` to a number; running out
ends the session at the RESULTS screen with an encouraging retry CTA — never a mid-game
ejection. This mirrors the Lesson Engine's hearts/cheer split (LESSON_ENGINE §7) on purpose:
one product-wide failure posture, not a per-surface invention.

**The score** is whatever the mechanic's `result(state).score` returns, normalized 0..100 by
the simulator.

**Passing is a conjunction, and XP is gated on it** — all three must hold:

```
passed = score >= scoring.pass_score        // the manifest's bar
      && inputLog.length > 0                // the player actually played
      && score > idleScore                  // and beat what DOING NOTHING scores
                                            // (same document, same seed, empty log)
xpEarned = passed ? min(xp_max, round(score / 100 * xp_max)) : 0
```

`xp_max` is bounded 5..50 by the `games` row, which takes precedence over the manifest's own
figure. **A run that does not pass earns no XP.** Proportional credit below the bar is not a
kindness, it is a hole: several mechanics award points for state the simulation reaches on
its own — an audit measured 23..45 points for an EMPTY input log across six published
manifests — so partial credit paid real XP into a child's `learning_stats` for opening a game
and submitting nothing.

The `idleScore` term is the **engagement floor**, and it is derived from the content rather
than picked as a constant: an empty log scores exactly the idle baseline by construction, so
it can never pass, whatever `pass_score` a manifest declares — including one set below what
idling reaches. The §9 winnability gate bounds `pass_score` against the *random* bot and
never against doing nothing at all, and the sidecar carries no floor either (`max_events` is
a ceiling; `min_duration_seconds` is written as `0` for every generated game). Deriving the
floor per replay needs no per-manifest authoring and cannot be forgotten by the pipeline.

**The seed is the SERVER's.** It is `seedFromString(run_id)` (`core/rng.ts`), computed by
Core; the body's `seed` field is only compared against it and a mismatch is a
`422 RESULT_REJECTED` (`seed_mismatch`). A client that chose its own number could re-roll
seeds against the document it was already served until it drew a favourable layout — a
seed-shop the replay could not detect, because every seed replays honestly.

**A run is paid exactly once.** `run_id` is single-use: Core checks recorded attempts before
replaying, and the DATABASE is the backstop that makes it true under concurrency —
migration `0029`'s `UNIQUE (user_id, game_id, run_id)`, written against with `ON CONFLICT DO
NOTHING`. Core credits only when the insert actually returns a row; a losing (or honest
double-submitted) completion gets the same `422 RESULT_REJECTED` (`run_already_recorded`)
and writes nothing. The application check alone cannot close this: the window it must close
is the window between its own read and its own write.

**The reward path — the client's score is a CLAIM, the server's replay is the GRANT:**

```
client plays → collects inputLog → POST /api/v1/games/:gameId/complete
   { run_id, seed, input_log, duration_seconds, local_date }
        ▼
Core loads the FULL document + validation sidecar (service role)
        ▼
replayGame(simulator, document, seed, input_log, maxTicks from validation)
        ├─ ok:false  →  422 RESULT_REJECTED   (no reward, logged; the attempt is not credited)
        └─ ok:true   →  score/stats are the SERVER's, the client's number is ignored entirely
        ▼
insert game_attempts   (stats = DERIVED AGGREGATES only — the raw input log is replayed
                        in memory and DISCARDED, never persisted; §11)
upsert game_progress   (best_score high-water, plays + 1, passed OR, xp_earned max)
PATCH learning_stats   (delta-only, §6.1)
fire-and-forget consent-gated `game_complete` insight
```

The client never sends a score, so there is nothing to inflate. Because the log carries an
array, the games router is mounted with its own `express.json({ limit })` (the pattern
`/api/v1/events` already uses in `backend/src/app.ts`) and `input_log` length is Zod-capped
against `validation.max_events`.

### §6.1 What games write into `learning_stats` — and what they must not

`learning_stats` (Vault `0006`, extended by `0009` and `0013`) is `xp_points`,
`minutes_learned`, `lessons_completed`, `streak_days`, `longest_streak`, `last_active_date`.
Games write:

| Column | Games' effect |
|---|---|
| `xp_points` | `+= max(0, newXpEarned - previousXpEarned)` — delta only, so replaying a game never double-pays. |
| `minutes_learned` | `+= max(1, round(duration_seconds / 60))`. |
| `streak_days` / `longest_streak` / `last_active_date` | via the existing pure helpers in `backend/src/services/streak.ts` (`nextStreak`, `isFirstActivityToday`) with the client-reported `local_date`. A kid's day follows their wall clock, not UTC. |
| **`lessons_completed`** | **NEVER touched.** A game is not a lesson. Incrementing it would corrupt every course-progress reading, the parent dashboard, the activation milestone (`stats.lessons_completed === 0` is how Core asserts "first lesson ever" in `backend/src/routes/learn.ts`) and every funnel in `dataintel`. |

**The read-modify-write null-guard (§1.14) is mandatory here.** `learning_stats` is read,
modified and written back, so "the upstream did not answer" must never collapse into "this
learner has zero progress": if the stats read returns `null`, Core returns **502** and writes
NOTHING. `game_attempts`/`game_progress` are already saved at that point, so nothing is lost
by stopping — and the alternative is the documented incident where defaulting to zeros and
PATCHing back erased a child's XP, minutes and both streak columns behind a `200`.

## §7 Slice anatomy & the registry

`frontend/src/game-engine/mechanics/<mechanic>/` — seven files, **zero cross-slice imports**
(a slice may import `core/*`, `phaser/*` and the UI kit; never another mechanic):

| File | Contents |
|---|---|
| `schema.ts` | `export const <m>ConfigSchema`, `<m>ContentSchema` (Zod), the inferred types, and `export const <M>_SPRITE_SLOTS: readonly string[]` — the declared sprite slot ids. |
| `simulate.ts` | `export const <m>Simulator: Simulator<State>` — PURE per §5. NO bots: see §5 "Where the bots live". |
| `bots.ts` | `export const <m>Bots: GameBots<State>` — the headless `perfect`/`random` players. Imported by gamegen's `simulate` gate and by tests ONLY; never by anything the browser loads. |
| `scene.ts` | `export class <M>Scene extends BaseMechanicScene<State>` — **the play-time renderer.** Loaded lazily via `phaser/sceneRegistry.ts` and mounted by `player/PhaserGameBox.tsx`; this is what a player actually sees (§2.1). |
| `components.tsx` | `export function <M>View(props: MechanicViewProps)` — the React-DOM renderer. **Not the play-time renderer, and currently unexercised anywhere else too** (§2.1): `GameStage` never reads `slice.View` (production or `/dev/game-lab` — both mount `PhaserGameBox`), and where a `components.test.tsx` exists (only `sorter`/`runner` have one; the other 6 mechanics never had DOM component tests) every one of its `it()`s is `.skip`'d. Kept as a type-contract placeholder and reference source; do not delete without re-reading §2.1's rationale. |
| `fixtures.ts` | `export const <m>Fixtures: GameDocument[]` — **>= 2** complete, PLAYABLE es-MX manifests that pass the schema and whose perfect bot passes. Fixtures satisfy the PRODUCTION schema; §1.14 forbids relaxing it for tests. |
| `register.ts` | `export const <m>Slice: MechanicSlice`. |

```ts
// core/types.ts
interface MechanicViewProps {
  document: GameDocument
  state: unknown                    // the simulator state (cast inside the slice)
  snapshot: SimSnapshot
  emit: (action: string, payload?: Omit<GameInputEvent,'tick'|'action'>) => void
  paused: boolean
  reducedMotion: boolean
}
interface MechanicSlice {
  mechanic: MechanicId
  configSchema: z.ZodType
  contentSchema: z.ZodType
  simulator: Simulator<never>       // structurally: Simulator<any-state>
  View: React.ComponentType<MechanicViewProps>   // dev-lab renderer, see components.tsx above
  fixtures: GameDocument[]
  spriteSlots: readonly string[]
}
```

`scene.ts` is NOT part of `MechanicSlice` — Phaser scene classes are loaded through the
separate `phaser/sceneRegistry.ts` map, keyed by `MechanicId`, independently of the slice
object. This is deliberate: `MechanicSlice`/`MechanicSimSlice` are the types the backend and
gamegen parity copies build their SYNCHRONOUS registries over (§1's stack-of-record split), so
`scene.ts` — which imports `phaser`, a browser-only rendering dependency — must never become
reachable from that type or those copies would drag Phaser into a Node service.

Both renderers are held to the same discipline: **a renderer computes nothing.** `components.tsx`
reads `state`/`snapshot` and calls `emit`; a mechanic's `scene.ts` reads the bridge's snapshot
and calls `bridge.enqueue(action, payload)` (§2.1) — never a raw pixel coordinate, never an
outcome the scene resolved itself. Neither renderer computes score, advances a tick, or
branches on wall-clock time. That split is what makes the same mechanic replayable
server-side without either renderer.

`registry.ts` exports three things, and the split between the first two matters:

- **`MECHANIC_META: Record<MechanicId, { titleKey: string; icon: string; blurbKey: string }>`** —
  SYNCHRONOUS metadata (i18n keys + a Material Symbols icon name). The `/games` hub renders
  entirely from this, so browsing the hub loads **zero** mechanic code.
- **`MECHANIC_LOADERS: Record<MechanicId, () => Promise<MechanicSlice>>`** — a dynamic
  `import()` per mechanic, so each mechanic is its own lazy chunk. Eight mechanics must never
  become one bundle every player downloads to play one game.
- **`loadMechanic(id)`** — the loader with an in-memory cache. **Unknown id → `null`.**

**Forward-compatibility rule (non-negotiable).** An unknown `meta.mechanic` renders the i18n
**unsupported-game card**, awards **no XP**, and **never throws**. This is the exact twin of
the Lesson Engine's "unsupported segment" card (LESSON_ENGINE §6), and it is the property
that lets a new mechanic ship into production CONTENT without breaking clients that predate
it: an older cached SPA meets a `mechanic: 'newthing'` document, shows a friendly card, and
keeps working. Without it, publishing mechanic #9 would be a coordinated release.

## §8 Concept binding & gating

- **`topic_path` is DATA.** It resolves at publish time to `games.topic_id`, a NOT NULL FK to
  `public.topics(id) ON DELETE CASCADE`. **Orphan games do not exist** — that is the standing
  `gamegen/AGENTS.md` invariant, and an FK is how it stops being a convention. A blueprint
  whose `topic_path` is absent from `coursegen/curriculum/<course>/catalog.yaml` fails
  `catalog:check` before a single paid call (§9).
- **Learn first, then play.** `GET /api/v1/games` marks a game `locked` until the bound topic
  has at least one **passed** lesson for that user; `GET /api/v1/games/:gameId` answers
  `403 GAME_LOCKED` for a locked game and the document never leaves the server. Games
  consolidate, they do not teach — a child who has not met the concept would be guessing at
  an arcade loop, which is the opposite of the pedagogy (the spacing/retrieval rationale is
  COURSE_ENGINE §3.1).
- **Unlock is computed in exactly one place: Core.** The client never re-derives lock state.
  This is the v1 failure the platform already paid for once (COURSE_ENGINE §1).
- **Visibility is a product invariant, not a feature flag (§1.9).** `game_progress` and
  `game_attempts` are readable by the row's owner **or** a verified guardian
  (`public.is_verified_guardian_of(user_id)`), and `backend/src/routes/family.ts` surfaces
  game progress (games played, best scores, XP from games) on the family/kid views.
- Published visibility follows the course chain: a game is client-visible only when the row
  is `published` AND its topic → saga → adventure → course chain is published — the nested
  `EXISTS` posture `0007` already uses for lessons.

## §9 The Arcade generation pipeline (`gamegen/`)

CLI-driven, file-checkpointed, resumable, idempotent (publish = upsert by slug). Modeled on
`coursegen/src/pipeline/` — orchestration in `run.ts`, serialized checkpoint writes through
an internal queue in `checkpoint.ts`, providers behind one chokepoint with a JSONL
`UsageLedger` + `checkBudget()` before every paid call + a `BudgetExceededError` that must
PROPAGATE, corrective retries that APPEND feedback after the original messages (so a retry
is a prefix-cache hit), live telemetry + Vault telemetry.

```
stages:            validate → plan → author → gate → simulate → judge → localize → illustrate → publish
checkpoint states: pending → planned → authored → simulated → judged → localized → illustrated → published
                   (+ 'failed' with failedFrom, + 'dry-run' for pristine slots only)
live stage labels: planning, authoring, simulating, judging, localizing, illustrating, publishing
run id namespace:  games-<courseSlug>-<ISO8601>     // NEVER collides with Forge run ids
telemetry marker:  generation_runs.params.kind = 'games'
```

| Stage | Paid? | What it does |
|---|---|---|
| `validate` | free | Zod-validate `gamegen/curriculum/<course>/games.yaml` (`npm run catalog:check`), including **cross-catalog validation**: every blueprint's `topic_path` must exist in `coursegen/curriculum/<course>/catalog.yaml`, read from the repo root (prior art: `coursegen/src/contract/check.ts`). |
| `plan` | **PAID** (DeepSeek) | Blueprint → a skeleton: mechanic choice confirmation, item/category counts, difficulty shape, target/pass posture. |
| `author` | **PAID** (DeepSeek) | Skeleton → a full es-MX `GameDocument` + its `GameValidation` sidecar. Prompted with `gamegen/src/pipeline/gamePlaybook.ts`. |
| `gate` | free | Deterministic gates, in order and cheap-first: the §3/§4 Zod contract; forbidden-vocabulary scan per age tier × locale (HARD FAIL); numeric coherence (`value`/`props` arithmetic re-executed, economies solvable); the misconception gate (every trap item carries `misconception_md`); character-canon gate (`cast ⊆ {dina,liruf,rho,zara}`); closed-set gate (palette, sfx, bgm, sprite slots declared by the mechanic); anti-genericity (a recap that restates the title teaches nothing). Cheap garbage must never reach the paid judge — the two-phase pattern Forge already proves. |
| `simulate` | free | **The bot-play winnability gate.** See below. |
| `judge` | **PAID** (Qwen) | Independent, decorrelated provider. Rubric 1–5 + notes on `concept_fit`, `fun_agency`, `clarity`, `kid_safety`, `difficulty_fairness`. `kid_safety` is a hard floor. Failures feed a bounded corrective/revise loop; the judge prompt carries the SAME `gamePlaybook.ts` text the author got, so the bar the author aims at is the bar the judge rejects against. |
| `localize` | **PAID** (DeepSeek) | es-MX → en-US + pt-BR, structure FROZEN. See the ordering fact below. |
| `illustrate` | **PAID** (Prism) | Sprites and background via `picturegen/` (4007) with the new purposes `game_sprite`, `game_background`. Purpose is part of Prism's cache hash, so adding them is cache-safe: **do NOT bump `STYLE_VERSION`**. |
| `publish` | free | Upsert `games` + three `game_documents` rows via service role, `document`/`validation` split server-side, `status='review'`. **Never auto-publish.** |

**The `simulate` gate — deterministic, free, and the reason generated games are trustworthy.**
Arcade runs the mechanic's own simulator headless (the parity copy in `gamegen/src/contract/`)
against the authored document:

- the **`perfect` bot MUST reach `scoring.pass_score`** — otherwise the game is unwinnable and
  a child would fail content that is broken, not hard;
- the **`random` bot MUST NOT reach it** — otherwise mashing is a complete strategy and the
  XP is free (the Lesson Engine's fairness gate, ported to a game loop);
- the tick budget must hold (the run must finish inside `maxTicks` / `estimated_minutes`).

On failure the bot trace is fed back as corrective feedback. No LLM is involved in this gate,
it costs nothing, and it runs BEFORE the paid judge.

**`--dry-run` spends NOTHING and destroys NOTHING.** The guard short-circuits BEFORE every
paid stage (`plan`, `author`, `judge`, `localize`, `illustrate`), requires **no API keys** (a
keyless dry-run test pins this), marks only PRISTINE pending slots with the distinct
`dry-run` state, and leaves any slot carrying in-progress checkpoint data untouched — marking
it would wipe paid, judge-approved work.

**The critical ordering fact:** **`illustrate` runs on the es-MX document BEFORE the
`localize` string-freeze.** Sprite URLs, `palette`, `background_url`, `sfx`, `bgm` and every
container key are then copied verbatim into en-US and pt-BR, so **one image serves three
locales** — a 3× reduction in the dominant cost of mass generation. This is how
`coursegen/src/pipeline/run.ts` really does it inside the `reviewed → localized` transition
("illustrate the AUTHORING document BEFORE localizing"), and the stage list above keeps
Forge's stage NAMES for CLI/telemetry parity; the `illustrated` checkpoint state marks the
belt-and-braces sprite sweep that follows, which makes zero calls on the happy path.
Consequently gamegen's `localize` needs its own `NON_VISIBLE_KEYS` twin that skips
`sprites`, `background_url`, `palette`, `sfx`, `bgm`, `config`, `mechanic`, `topic_path`,
`image_slot`, `icon` and every id — a **different shape** from coursegen's field-name list,
because sprite slots are arbitrary `Record` keys, i.e. whole CONTAINERS must be skipped, not
named leaves. A schema-derived coverage test (twin of
`coursegen/src/__tests__/nonVisibleKeys.test.ts`) must prove no visible string escapes
translation and no non-visible key is translated.

**Service hygiene.** `gamegen/` today is a bare scaffold (`src/app.ts` health + envelope 404,
`src/index.ts` reading `process.env.PORT` raw). Bringing the pipeline in also brings it to the
sibling-service convention: a Zod-validated frozen `src/env.ts` with `getConfig()` +
`resetConfigCache()`, and an internal-key guard on the `/api/v1` prefix comparing
`timingSafeEqual(sha256(provided), sha256(expected))` — never a `String.length` pre-check,
which throws `RangeError` (a 500 instead of a 401) on any header byte ≥ `0x80` (§1.14).
`GET /health` stays above the rate limiter and every optional dependency.

**Telemetry & CI.** `generation_runs` / `generation_slots` / `generation_runs_live` /
`generation_heartbeat_snapshots` are SHARED with Forge (content tables are disjoint); game
runs are identified by `params.kind = 'games'` and the `games-` run-id prefix, and the admin
dashboard must **filter by kind** so game runs never contaminate lesson cost/quality trends.
`gamegen-ci.yml` path filters must include `coursegen/curriculum/**` (the cross-catalog
dependency), and `catalog:check` + `contract:check` must be wired into gamegen's `npm test` —
a manual-only check is a silent gap.

**The human gate stays.** Publish lands `status='review'`; a human promotes to `published`
from the `/admin/content` Games queue. Kid-facing content is human-moderated before display
(§1.9) — three layers (deterministic gates → LLM judge → human), none optional.

## §10 Accessibility, motion & responsiveness

- **Tap-first, always.** Every interaction has a tap/keyboard path. Where a drag exists it is
  progressive enhancement over tap (native Pointer Events, no drag library) — drag is never
  the ONLY way to do something. Hover-only affordances are prohibited: mobile has no hover
  (§1.11).
- **Hit areas >= 44×44px** (`min-h-11 min-w-11`) for every control, including in-canvas
  controls, at every breakpoint.
- **`prefers-reduced-motion` disables DECORATIVE effects only — never the simulation.** The
  game still runs, still scores, still finishes; particles, shakes, parallax and celebration
  loops stop. Turning off motion must never turn off the ability to play or to earn XP.
- **Pause is always reachable** — one tap, from any state, thumb-reachable on mobile. The
  simulation is tick-driven, so pausing is exact (no ticks advance) rather than approximate.
  Interludes and the pause overlay are the two sanctioned interruptions.
- **The loop never claims to be running when nobody is looking.** The play path is Phaser's
  own loop (`player/PhaserGameBox.tsx` mounts one `Phaser.Game` per run), and it is covered by
  two DIFFERENT mechanisms, not a single scheduler:
  - **Hidden tab:** Phaser's own `requestAnimationFrame` loop simply stops firing while the
    tab is hidden — the browser delivers no frames, so no ticks advance and nothing needs to
    be wired for this case.
  - **Window blur (still visible, but focus left the window):** not covered by the above, so
    `PhaserGameBox` listens for Phaser's `Phaser.Core.Events.BLUR` and calls the caller's
    `onAutoPause`, which sets `paused` and shows the real `PauseOverlay` — the same overlay a
    manual pause tap gets, never a silently-frozen board.
  The kernel-era `GameLoopScheduler.canDeliverFrames()` start-time check (`core/kernel.ts`)
  addressed this same class of bug for the pre-Phaser DOM/tick loop, and `GamePlayer`'s
  `scheduler` prop (used for `/dev/game-lab`'s manual tick-step affordance) still exists in
  the type signature — but `GameStage`, the component that actually mounts the play surface,
  never reads that prop and never renders `slice.View`: it always mounts `PhaserGameBox`
  regardless of caller. **This is a confirmed doc-accuracy correction, not yet a code fix**:
  the pre-Phaser scheduler seam is a vestige with no effect on the live Phaser loop, and the
  two BLUR/hidden-tab mechanisms above are the entire real protection today. `/dev/game-lab`'s
  step-mode and live-snapshot readout (built on that same `View`/scheduler wiring) are
  consequently stale against the Phaser play path — flagged here as an open item, not
  something this document can silently paper over (§1.12).
- **Both breakpoints are first-class (§1.11, non-negotiable).** Mobile (<768px): single
  column, canvas fills the viewport within the 16px `margin-mobile`, controls in the thumb
  zone. Desktop (>=1024px): the freed width is used deliberately — the hub is a
  `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` card grid (never breakpoint-specific
  gaps), the player centres the canvas inside `container-max` with the HUD using the margins.
  A desktop screen that is a stretched mobile column is a bug. No UI change is done until it
  has been verified in-browser at ~375px AND ~1280px, light and dark.
- **The canvas-vs-chrome boundary.** *Chrome* (hub cards, HUD, pause overlay, interludes,
  results) uses ONLY `frontend/src/components/ui/` kit components, closed DESIGN.md tokens,
  the `lf-*` type scale, Material Symbols, and the Action Color Contract — exactly ONE papaya
  CTA per view. *Canvas* is Prism raster sprites + palette-tinted shapes; sprites are exempt
  from the icon rule by definition, since they ARE the illustration. **Figtree only — never
  import an arcade font** (v1 imported `Press Start 2P`); arcade feel comes from weight, size
  and motion. The sim-driven canvas is the documented carve-out from "no new infinite
  animations" — it is bounded by the game session and stops with the pause overlay.

## §11 Child safety & privacy (§1.9 applied)

- **No minor PII ever reaches a third-party AI API.** Generation prompts carry ONLY the
  blueprint, the catalog concept context, the age TIER and the character canon. No names, no
  locations, no photos, no free-text history. Games are generated from curriculum, not from
  children — there is no per-child generation path, and adding one would need explicit human
  sign-off against this section.
- **No live AI while a child plays.** Every string, sprite and interlude is generated,
  moderated and published ahead of time. There is no runtime model call to moderate, which is
  the only way to guarantee moderation of what a child actually sees.
- **All generated text and art passes moderation before display** — deterministic kid-safety
  gates, then the judge's `kid_safety` hard floor, then the blocking human publish gate.
  Non-optional, three layers.
- **Raw input logs are never persisted.** The log is replayed IN MEMORY by Core and
  discarded; `game_attempts.stats` holds only DERIVED AGGREGATES (counts, accuracy, rounds
  reached). A tick-resolution behavioural trace of a child at play is exactly the kind of
  data COPPA-minded minimalism says not to keep, and we do not need it to grant a reward.
- **Kid telemetry is consent-gated and fail-closed.** The new insight events `game_start` and
  `game_complete` are inserted fire-and-forget behind the EXISTING consent gate: a `kid` role
  with no active analytics consent produces no row, and a consent lookup that fails produces
  no row. `learning_events` gains a nullable `game_id` column with **deliberately no foreign
  key**, mirroring `lesson_id`'s documented identity-migration rationale, and the event
  vocabulary stays a closed CHECK list with a numeric `value` only — no free text from a
  child's session ever enters analytics.
- **Parent visibility is an invariant, not a setting.** Verified guardians can read their
  child's `game_progress` and `game_attempts` (§8), and the family routes surface it. There is
  no toggle that hides a kid's game activity from a verified guardian.
- **No dark patterns.** Cheer mode by default at tier 1, no loss-framed pressure, no
  engagement loops that run when the child is idle, no cosmetic pressure. Celebration is
  earned (LESSON_ENGINE P5).

## §12 Extension protocol — adding mechanic #9 without editing another slice

1. **Justify.** Prove no existing mechanic covers the interaction. Extending an existing
   `config` is preferred and must stay backward-compatible — **only optional fields added**,
   because published documents are already in Vault.
2. **Schema.** New `mechanics/<new>/schema.ts` with `<new>ConfigSchema`, `<new>ContentSchema`
   and `<NEW>_SPRITE_SLOTS`; add the id to `MECHANIC_IDS` and the member to `core/schema.ts`'s
   discriminated union. Vault needs a delta migration widening the `games.mechanic` CHECK —
   **never edit an applied migration** (§1.3).
3. **Simulate.** `simulate.ts`: a PURE simulator per §5 (allowed arithmetic only, `mathd.ts`
   for anything transcendental, seeded RNG), plus BOTH bots. Determinism tests (same seed +
   log → same result) and the §9 winnability property (perfect passes, random does not) are
   part of this step, not a follow-up.
4. **Scene — the play-time renderer (§2.1).** `scene.ts`: `export class <M>Scene extends
   BaseMechanicScene<State>`, implementing `createBridge()`, `setupInput()`,
   `createGameObjects()`, `updateGameObjects(delta)`, and — only if the mechanic's own
   authored content has a natural width/height other than the fixed 800×600 canvas (e.g. a
   `config.field`/`config.map`) — `getWorldSize()` so the base class can fit the camera to it
   (§2.1/§10, `695891c`). Every input handler calls `this.bridge.enqueue(action, payload)` with
   a LOGICAL action from the mechanic's own declared `actions` list and a payload the simulator
   already understands (quantized where the simulator expects quantized values) — never a raw
   pixel coordinate, never an outcome the scene resolved itself. Every canvas-drawn string goes
   through `this.strings['someKey']` (`CANVAS_STRING_KEYS` in `phaser/scene.ts`), never a
   hardcoded literal — adding a new one means a new `games.canvas.<name>` key in all three
   locales in the same commit (§1.8) plus the key appended to `CANVAS_STRING_KEYS`. Add the id
   to `phaser/sceneRegistry.ts`'s lazy-loading map so `PhaserGameBox` can find the class.
5. **View — the dev-lab/reference renderer.** `components.tsx` — a renderer over
   `MechanicViewProps` only: reads state, calls `emit`, computes nothing. Required because
   `MechanicSlice.View` is currently a non-optional field of the shared slice type (§2.1/§7);
   as of this document's last update it is not exercised by any live code path or passing test
   (§2.1) — write it as a correct reference implementation of the contract regardless, since
   `MechanicSlice`'s shape is not something one new mechanic's slice gets to unilaterally
   change.
6. **Fixtures.** `fixtures.ts` with >= 2 complete, PLAYABLE es-MX manifests that satisfy the
   PRODUCTION schema and whose perfect bot passes. `/dev/game-lab` picks them up automatically.
7. **Register.** `register.ts` exports the slice; add ONE entry to `MECHANIC_META` and ONE to
   `MECHANIC_LOADERS`. A registry-completeness test fails until both exist.
8. **Parity.** Copy `simulate.ts` + `schema.ts` into `backend/src/game-contract/` and
   `gamegen/src/contract/`; `contract:check` in both services must pass. A mechanic the server
   cannot replay can never grant XP.
9. **Docs & i18n.** This file's §4 table, `gamegen/AGENTS.md` if an invariant moved,
   DESIGN.md if the mechanic needs a canvas recipe, and every new chrome/canvas string in
   `games.json` × 3 locales in the SAME commit (§1.8).

Adding a mechanic touches only: the new slice (now seven files, §7), `MECHANIC_IDS`, the
union, `phaser/sceneRegistry.ts`, the two `registry.ts` maps, the parity copies, one delta
migration, and docs/i18n. It edits **no other slice**. Old clients meet the new mechanic as
the unsupported-game card (§7), so mechanic #9's content can ship to production before every
client has the code.

## §13 Open questions & deliberate deviations

- **`flyer` is 2.5D, not full 6DoF flight — deliberate.** Forward motion is a constant tick
  advance and the player steers two axes. Three reasons: input (a touch screen has no throttle
  or rudder, and §1.11 forbids a desktop-only control scheme); cognitive load (LESSON_ENGINE
  P4 — one thing on screen; a 6DoF flight model is the game, and the concept becomes
  decoration); and the deterministic simulation budget (§5 bans the transcendental functions a
  full orientation model wants, so 6DoF would mean a large `mathd.ts` rotation surface and a
  much wider replay-divergence risk). Full 6DoF remains possible later **behind the same
  manifest** — it would be a `config` extension with optional fields, not a new document
  shape.
- **The pipeline lives in `gamegen/`, not literally inside `coursegen/`.** The §1.5 service
  map is LOCKED and assigns game generation to Arcade; moving it would be a stack-of-record
  change requiring human sign-off. The intent of a single content factory is honored by
  **shared curriculum binding** (game blueprints cross-validate against Forge's
  `catalog.yaml`; the FK is `topics.id`), **shared telemetry** (the same
  `generation_runs*` tables, disambiguated by `params.kind`), and **concurrent orchestration**
  (`generate:full` launches the Forge track run and the Arcade run together with linked ids
  and a combined summary, staggering illustration because the DashScope image quota is SHARED
  with Prism's other caller).
- **JSON-only manifests. No XML.** The platform is JSONB-native end to end (Postgres `jsonb`,
  Zod, `fetch`), and a second serialization would need its own schema language, validator and
  gates for zero benefit.
- **§4 is derived from the owner's Game Mechanics Report; the `config` field NAMES are
  specified here for the first time.** The report fixes each mechanic's core loop, essential
  components and difficulty variables; this document turns those into a config surface. Each
  slice's `schema.ts` is the executable source of truth and MUST cover every element §4 marks
  — when they diverge, fix the code or fix this table in the same commit, and treat §4 as the
  spec the fixtures and the pipeline both target. Narrowing a §4 element without recording the
  omission in this section is a silent scope cut and is prohibited (§1.12.7).
- **Two report elements are deliberately reinterpreted rather than implemented literally.**
  `explorer` is a graph traversal with per-node micro-challenges, not a real-time platformer:
  the report's ability-lock structure (the actual mechanic) is preserved in full, while its
  incidental platforming is dropped because §1.11 forbids a control scheme that only works
  with a keyboard and because a physics platformer widens replay-divergence risk for no
  pedagogical gain. `stacker` uses a small in-repo deterministic solver rather than a
  general-purpose "high-frequency" rigid-body engine: the report's stability-margin,
  force-timeline and economy semantics are kept exactly, but bodies are restricted to
  AABBs and circles with a fixed iteration count, because §5's bit-identical replay
  requirement cannot survive an adaptive third-party solver.
- **Deferred by decision, not oversight:** cross-game meta-progression, cosmetics,
  achievements and any persistent shop (all four are engagement-economy surfaces that need a
  §1.9 dark-pattern review before they exist, and none is needed to make a game teach); and
  Echo narration for games (`label_md` is authored TTS-safe so narration can be added later
  without a content migration, but no game field is narratable in v1).
- **Open:** whether `adaptive` easing should be recorded per attempt (it changes the effective
  difficulty of a score, which makes `best_score` comparisons across attempts less clean).
  v1 keeps easing client-visible and score-affecting through the simulator only, so a replay
  still reproduces it exactly from the log; a future revision may need an explicit
  `ease_level` field in the input log.

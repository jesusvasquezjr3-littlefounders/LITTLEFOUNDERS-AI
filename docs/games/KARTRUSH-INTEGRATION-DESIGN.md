# Games in `/learn` — KartRush integration design

Status: **design, approved in direction by the owner on 2026-10-05; nothing here is built.**
Scope: how a finished, quality-bar game (first: KartRush) becomes part of `/learn`, and what must
exist on both sides *before* it is embedded. Written to be reused for the games that follow.

Related: `KartRush/docs/21-DEPLOYMENT.md` (embed contract), `KartRush/docs/22-ENGAGEMENT-PRIVACY.md`
(local-only signals), `docs/littlefounders-spec/` (binding), `README.md` (service map).

---

## 0. Owner decisions already taken (2026-10-05)

| # | Decision | Consequence in this design |
|---|---|---|
| G1 | Games will be integrated into `/learn`; more will follow. The earlier `games/` section was removed because each game was designed around a learning mechanic and was not fun. The new order is a finished, fun game first and concepts woven in after. | Game mechanics are **never** altered for learning. Learning attaches to decisions the game already contains (§3). |
| G2 | A game must connect the learner with their Mentor **and** teach something subtly, not obviously. | Mentor presence (§3.3, §4) and a concept layer made of lenses and debriefs, not quizzes. |
| G3 | Game mechanics are respected; the game is adapted to LittleFounders, not the reverse. | Start countdown, lap timers, items, drift stay. The *chrome* around the game changes (§5.3). Recorded as an OD candidate: play surfaces are exempt from DP-01's start countdown and lap timers; **visible session timers stay banned**. |
| G4 | Open access (no parent switch to unlock), with a time cap similar to the Mentor's. | §5.5. A guardian can only lower limits, never raise them above the platform ceiling. |
| G5 | LittleFounders canon is the law (characters, poses, vocabulary). | §7. KartRush's own fiction is rewritten to LF canon. |
| G6 | Progress and records must persist in a database. | §6. Server-side, through Core only. |
| G7 | Audio/keyboard: reconcile and choose one solution. Flash safety: solve if it applies. | §8. |
| G8 | Investigate the market and innovative AI uses (Qwen/DeepSeek), and plan it now, before the first integration. | §2 and §4. |

## 1. Position and principles

KartRush is a commercial-quality action game with no educational content. LittleFounders has a
Mentor that knows each child's mastery, a guardian model, and a server-authoritative learning
engine. The integration joins the two without turning either into the other.

1. **Game first, concept second.** Learning content lives in the core activity, not between levels.
   Evidence: Habgood & Ainsworth found children learned more from the version where the core
   mechanic *was* the content, and played it ~7× longer in free time than the version that tested
   between levels. We go further: we do not change the mechanic at all, we make existing decisions
   *legible*.
2. **The host owns the chrome; the game owns the world.** Every word the learner reads that is
   about the Mentor, a concept or a result is rendered by the LittleFounders SPA in our design
   system. The game renders only the 3D scene, the race HUD and touch controls.
3. **Honest mapping.** We only name a concept where a mechanic really embodies it (§3.1). We do not
   claim racing teaches finance in general.
4. **No new reward currency.** Races award no XP and no coins and do not count toward streaks
   (streak day = a passed lesson; XP = lesson rows; coins = chores and tasks). This keeps D7/OD-7,
   B.20, B.22 and the closed celebration list intact without carve-outs.
5. **Server is the authority; the client is a sensor.** The game never holds keys or database access
   (standing rule since 2026-08-24). Everything it reports is bounds-checked, idempotent, and never
   decides correctness of anything graded.
6. **Fail closed, fall back to authored content.** Any AI, network or database failure degrades to
   pre-authored lines or to plain play. A child never sees an error where a race should be.

## 2. Market and evidence (what shaped the design)

Searches run 2026-10-05. Where nothing was found, the document says so rather than infers.

| Finding | Source | Design consequence |
|---|---|---|
| Intrinsic integration beats extrinsic (quiz-between-levels) on learning and voluntary play time. | Habgood & Ainsworth, Zombie Division ([paper](https://eprints.nottingham.ac.uk/10385/)) | Principle 1; no quiz gates in the race. |
| Stealth assessment (evidence-centred design: competency, evidence, task models) measures competencies inside games without interrupting play. It is built around tasks designed for that evidence. | Shute, Physics Playground ([overview](https://myweb.fsu.edu/vshute/pdf/saecdpreprint.pdf)) | We borrow the *evidence model* discipline: decisions become a **profile**, never a grade, because a racing decision has no single right answer (§3.2). |
| Reflection and debriefing after play improves transfer; structured reflection yielded metacognitive gains even when cognitive gains were mixed. | Serious-games debriefing literature ([review](https://ensani.ir/fa/article/646128/design-features-of-educational-games-to-foster-metacognitive-skills-a-systematic-review)) | The **pit stop** (§3.3): a short Mentor debrief after each race. |
| LLM-driven NPCs give perceived autonomy but raise cognitive load, response uncertainty and lower trust and usability; effects are worst in open-ended modules. | [arXiv 2604.10107](https://arxiv.org/pdf/2604.10107) | **No open-ended LLM dialogue during play** (§4). Open conversation stays in the Mentor stage. |
| LLM NPCs in serious games are an active research area (digital-literacy NPC game, 2026). | [Informatics 13(1):16](https://doi.org/10.3390/informatics13010016) | Viable, but the evidence base is small; we ship the constrained forms first. |
| Existing kids' finance games are economy simulations (Roblox *Mimi's Dream Builders*, TD Bank's Roblox world) or curriculum games (Greenlight *Level Up*); Khanmigo limits daily AI interaction because long sessions degrade. | [Prosperous Kids](https://insights.munich-startup.de/news/feed/prosperous-kids-launches-financial-literacy-game-on-roblox-for-80-million-children), [Greenlight](https://www.fintechfutures.com/press-releases/greenlight-reinvents-financial-education-with-level-up-a-gamified-financial-literacy-curriculum-for-kids-and-teens), [Khanmigo](https://support.khanacademy.org/hc/tr/articles/14394814244365) | **Positioning gap (in the searches I ran; not exhaustive):** a commercial-quality action game paired with an AI Mentor that knows the child's mastery and a guardian view. Daily caps mirror Khanmigo and our own Mentor. |
| Amended COPPA Rule: compliance date 2026-04-22; written retention policy required; disclosure to non-integral third parties, including to train AI, needs separate verifiable parental consent. | [Mondaq summary](https://www.mondaq.com/unitedstates/data-protection/1661226/amendments-to-the-coppa-rule-now-in-effect), [K-ID](https://docs.k-id.com/compliance-guides/coppa-2026-amendment) | Retention schedule (§6.4); AI briefs carry no identifiers and are never used for training; model vendors listed as processors in the guardian notice. Legal validation stays under OD-10. |

## 3. The concept layer

### 3.1 Honest mapping: existing mechanics ↔ concepts

Verified in the game code (hook locations in §9.A).

| Existing mechanic | What it genuinely models | Candidate KC (`database/seeds/kc_graph.v1.json`) | Strength |
|---|---|---|---|
| One-slot item rule: holding an item blocks collecting a new box; hold vs use is the player's choice | Opportunity cost of waiting | `life.opportunity-cost`, `life.think-before-buying` | Strong |
| Drift charge tiers (0.85 / 1.75 / 2.9 s → 1.16 / 1.24 / 1.34× boost; releasing under tier 1 pays nothing) | Delayed payoff with diminishing marginal return | `life.patience-and-waiting`, `money.linear-vs-accelerating-growth` (draft) | Strong |
| Kart body and speed class (±1 stat trade-offs, visible bars) | Trade-offs under constraints | `life.wants-and-choices` | Medium |
| Lap-time spread across 3 laps (best lap vs average) | Consistency vs one big win | `life.review-and-adjust-plan` | Medium |
| Time Trial ghost / personal best | Comparing with your own past; progress | (growth framing, no KC) | Strong, and OD-27-safe |
| Boost-pad lanes | **Not** risk/reward: pads carry no hazard. Do not claim it. | none | Weak, excluded |

Only the first two rows get an explicit concept lens in v1. The others are available to later
content packs.

### 3.2 Decision Lens (observation only)

A passive observer in the game turns existing mechanics into a small, fixed vector per race. It adds
no input, no rule and no on-screen element.

Fields (all integers, bounded, numeric-only, derived at race end, never streamed):
`itemHoldMs`, `boxesPassedWhileHolding`, `itemsUsed`, `driftReleasesT0/T1/T2/T3`,
`lapMs[3]`, `recoveries`, `karting` = `{characterId, kartBody, speedClass, trackId, mode}` as enums.

It is **a profile for narrating, not a grade.** A racing decision has no keyed answer, so it never
updates mastery (BKT) and never awards anything. (If it did, a bold player holding an item for a
good reason would be marked wrong.)

### 3.3 The pit stop (Mentor debrief)

After the finish replay, the SPA shows a short card in the LittleFounders design system, in the
learner's Mentor's voice, over the still-rendered scene:

- **One observation grounded in the Decision Lens** ("You held your item through three boxes.").
- **One reflective question** with two or three tap replies and a neutral "not sure". Replies are
  ungraded self-report and never shown as right or wrong.
- **Two actions:** "Race again" and "Talk to {Mentor}" (hand-off, §4.3).
- Always skippable; at most one card per race; none after a practice lap.

Evidence rules, strictly separated:

| Source | Writes | Does not write |
|---|---|---|
| Race metrics | `game_runs` (records) | KC, XP, coins, streak |
| Pit-stop reflection reply | `game_runs.reflection` (enum) | KC, XP |
| **Retrieval item** (stage 2): a one-tap question about the *concept*, keyed in Core, chosen from the learner's due FSRS cards | KC attempt (BKT + FSRS) through Core's `recordAttempt`; no XP | Anything derived from client-reported facts |

The retrieval item is the spaced-retrieval mechanism in a *different context* from the lesson. Its
correctness key is static server-side data about the concept; the race facts only select framing and
KC. A client that fabricates metrics can therefore change the wording of a question but never the
result of a grade. Stage 2 requires widening the `kc_attempt` source (a contract migration, applied
manually; see §6.5), so stage 1 ships without it.

## 4. AI design (DeepSeek / Qwen)

Principle: **AI narrates the learner's own race inside closed rails; it never opens a chat during
play.** Three tiers, cheapest and safest first.

### 4.1 Tier 0 — authored packs (always on, zero live cost)

Pre-generated through Forge (DeepSeek author, Qwen judge, human release; owner-run per OD-23, always
with `--max-usd`). One versioned JSON pack per `(mentor, locale, age band, concept)`: radio lines,
pit-stop observations, reflective questions and replies. Stored in Core/Depot, handed to the game and
SPA at session start. This is the existing pattern (`voice.mentor-turn.v2`, scripted Mentor lines).
Character voices come from `oracle/src/tutor/prompt.ts` (`CHARACTER_VOICES`) so the packs and the
Mentor sound like the same person.

### 4.2 Tier 1 — sealed one-shot line (on top of tier 0)

One call per finished race, after the finish, never per frame, never with learner text.

- **Input:** a third strict schema, in the style of `GenerationBriefSchema`
  (`oracle/src/context/schema.ts:330`): mentor, locale, age band, target concept, and the Decision
  Lens as enums and buckets. **No nickname, no ids, no free text.**
- **Path:** SPA → Core (`POST /learn/games/:gameId/sessions/:sid/debrief`) → Oracle internal
  endpoint modelled on `placement-intake` (`oracle/src/routes/runtime.ts:47`): classify, `complete()`
  non-reasoning (`max_tokens` ≈ 120), `moderateTutorOutput` (fails closed for minors), neutral
  fallback.
- **Fallback:** on any failure, cap hit or timeout, the tier-0 line is shown. The learner never waits:
  tier 0 renders immediately and tier 1 replaces it only if it arrives within the finish-replay window.
- **Budget:** a per-learner daily cap on generated lines (proposal: **6**) plus the existing global
  `spendGuard`. `tutor_sessions.cost_usd` has no game equivalent, so `game_runs.ai_cost_usd` is added.
  Real cost per line is **measured in the first spike** before the feature is enabled; this
  document does not assume a figure.
- **Models:** use whatever `oracle/src/model/provider.ts` is configured to. Note the repo currently
  disagrees with itself (`CLAUDE.md` says `deepseek-chat`; `oracle/src/env.ts:77` defaults to
  `deepseek-v4-flash`, with a comment saying `deepseek-chat` was retired 2026-07-24). The spike
  resolves this first. The Qwen judge is used offline and inside `moderateTutorOutput`, not as an extra
  hop.

### 4.3 Tier 2 — hand-off to the Mentor (the real conversation)

"Talk to {Mentor}" opens the Mentor stage with the race summarised. Everything open-ended therefore
runs under the Mentor's existing moderation, session caps, voice rules and 14-field context. The
summary rides on existing fields; the only change proposed is a new closed `intent` value
(`post_game_debrief`), which is a reviewed contract change under OD-35(c) but **does not widen the
14-field schema** (the count is pinned by `privacy-contract-docs.test.ts`).

### 4.4 Explicitly not built

- Free-text or voice chat inside the game.
- An LLM choosing items, difficulty or race events (determinism, fairness, B.22).
- Any model call carrying a nickname, id, free text or a raw input stream.
- Training on, or retaining, learner data at a vendor.

## 5. Architecture

### 5.1 Components

```
 Browser (LittleFounders SPA)                         Railway
 ┌──────────────────────────────────────────┐   ┌───────────────────────┐
 │ /learn/play/:gameId   (standalone route) │   │ KartRush (static)     │
 │  ├ host overlays: Start, Pause, Pit stop │◄──┤  embed profile        │
 │  ├ MessagePort bridge (kr.v1)            │   │  HUD + touch only     │
 │  └ heartbeat, caps, Mentor avatar        │   └───────────────────────┘
 └───────────┬──────────────────────────────┘
             │ HTTPS (learner JWT)
        ┌────▼─────┐   internal key   ┌────────┐   ┌─────────────────────────┐
        │ Core     │─────────────────►│ Oracle │──►│ DeepSeek / Qwen         │
        │ /learn/  │                  │ /line  │   └─────────────────────────┘
        │ games/*  │──► Supabase: game_* tables, kc_attempt (stage 2)
        └──────────┘
```

Only Core is called by the SPA; the game talks to nobody but its host (README service-map rule).

### 5.2 The embed profile of KartRush ("headless-chrome racer")

`?embed=1` (validated against the origin handshake, not trusted alone) changes the game to:

- Boot straight into a race from host parameters; no title, menus, options, Circuit Files, Driver
  Tour or Grand Prix flow. The runners already take `{playerCharacter, playerKartBody, speedClass,
  trackId, saveStore, onExitToMenu}` (`src/ui/raceRunners.ts`), so a launcher is small.
- All four characters available regardless of the local save (the unlock gate lives only in the
  menus, `selectionLogic.ts`; the runners never check it).
- Locale, mute, reduced motion and theme come from the host before the first mount (nothing
  re-renders on `setLocale`).
- Suppressed: unlock "next goal" lines, chapter cards, cup-rank gold colouring, unlock-reveal and
  personal-best fanfare sounds, rival lines, recovered-file lists. **No central switch exists**
  (`resultsScreen.ts`, `standingsScreen.ts`, `raceRunners.ts:880/1235`), so one `EmbedProfile`
  object is threaded through those call sites.
- Pause button, results and "race again" emit protocol messages; the host renders the UI.
- Standalone mode and its `tools/compat-smoke.mjs` path stay byte-for-byte unchanged by default.

### 5.3 Protocol `kr.v1`

Handshake: the SPA posts one `lf.hello` with a transferred `MessagePort` to the iframe; the game
accepts it only if `event.origin` is in its allow-list; everything after travels on the port. The
vocabulary is closed and validated on both ends (Core's rule §1.14: a validated closed schema, never
a coerced one). Per the repo's convention, the three copies (SPA, Core zod, game) are hand-mirrored
with a `check-game-protocol-parity` script.

| Direction | Message | Carries |
|---|---|---|
| host → game | `lf.init` | `v`, opaque `sessionRef`, `locale` (`en`/`es`/`pt`), `mentor`, `band`, `muted`, `reducedMotion`, `theme`, `start` (`mode`, `trackId`, `speedClass`), `save` snapshot, `pack` (radio lines), `caps` |
| host → game | `lf.pause` / `lf.resume` / `lf.mute` / `lf.end` | none |
| game → host | `kr.ready` | build id |
| game → host | `kr.runStarted` | `runKey`, `mode`, `trackId`, `character` |
| game → host | `kr.runFinished` | `runKey`, `finishMs`, `bestLapMs`, `lapMs[]`, `rank`, Decision Lens vector |
| game → host | `kr.save` | `revision`, bounded snapshot |
| game → host | `kr.pauseRequested` / `kr.exitRequested` | none |
| game → host | `kr.error` | closed code |

Locale mapping: game `en/es/pt` ↔ platform `en-US/es-MX/pt-BR`, done in the host.

### 5.4 Session token and identity

A game session is minted by Core, copying the lesson-attempt token (`backend/src/services/
lessonAttemptToken.ts`): `v1.<payload>.<hmac>` with an opaque `gid` (session) and `rid` (run), `exp`,
`jti` burned server-side. **No user id, name or email enters the frame.** The game never sees the
token; the SPA relays run reports to Core with the learner JWT, so Core's CORS allow-list
(`FRONTEND_URL` only) is untouched.

### 5.5 Time limits (mirror of the Mentor)

| Limit | Value | Where enforced |
|---|---|---|
| Soft break | 15 min of active play: SPA shows a calm "pit stop?" card. **No countdown, no visible timer** (DP-01). | SPA, from heartbeat time |
| Hard stop | 25 min: SPA pauses and ends the session; Core rejects further runs for that session | Core (token `exp`) |
| Idle | 10 min without input: session closes | SPA + Core |
| Sessions per local day | 2 (same shape as the Mentor's `routes/tutor.ts:207` and the atomic count-plus-insert of migration `0057`) | Core, atomic |
| Guardian | May lower the above (`learner_play_limits`); cannot raise past the platform ceiling | Core |

Active time counts only while the tab is visible and the iframe focused. Heartbeats come from the
SPA, never from the iframe. No per-learner minutes cap and no guardian time setting exist in the repo
today; both are new.

## 6. Database

All in Supabase, written only by Core with the service role. Conventions from migration `0208`: RLS on,
`REVOKE ALL FROM PUBLIC, anon, authenticated`, `GRANT` to `service_role`, FK to `auth.users` with
`ON DELETE CASCADE` (`deletion:check`), self-or-guardian read policies like the `kc_*` tables.

### 6.1 Tables (next migration number is `0259`; recheck at write time)

| Table | Purpose | Key columns |
|---|---|---|
| `game_catalog` | Registry of games (generic for future games) | `game_id` text pk, `status`, `min_band`, `content_pack_version` |
| `game_sessions` | One per play session; time accounting | `id`, `user_id`, `game_id`, `started_at`, `ended_at`, `close_reason` (`soft`/`hard`/`idle`/`left`), `active_seconds`, `mentor`, `locale`, `band`, `token_jti`, `client_build` |
| `game_runs` | One per race/activity | `id`, `session_id`, `user_id`, `game_id`, `run_key`, `mode`, `track_id`, `character`, `speed_class`, `finish_ms`, `best_lap_ms`, `lap_ms int[]`, `rank`, `metrics jsonb`, `reflection`, `verification` (`reported`/`replay_verified`), `ai_cost_usd`; `UNIQUE(user_id, game_id, run_key)` (no double-count, as `0029`) |
| `game_progress` | Server-side bests and counters | `user_id`, `game_id`, `track_id`, `character`, `best_finish_ms`, `best_lap_ms`, `runs`, `last_played_at` |
| `game_saves` | Server copy of the game's save (settings, hints seen, bests) | `user_id`, `game_id`, `schema_version`, `revision`, `save jsonb` (≤ 64 KB), `updated_at`; compare-and-set on `revision` |
| `learner_play_limits` | Guardian-lowered limits | `user_id`, `max_sessions_per_day`, `max_session_minutes`, `set_by`, `updated_at` |

`metrics jsonb` is constrained by a DB check function: keys match a fixed regex and count, all values
numeric. This keeps the numeric-only posture of `0028` while staying generic across games.
Reused from the retired engine (`0027`–`0029`): service-role-only writes, server-derived values, one-time
crediting with `ON CONFLICT DO NOTHING`. Not reused: its content-authoring tables (retired for product
reasons, not design flaws).

**Ghosts stay on the device in v1** (≈ 42–57 KB each, up to 24 → ≈ 1.3 MB per learner). Bests are on
the server, so a lost ghost means "race to set a new one", never lost progress. Server-side ghosts are
a later, separate decision.

### 6.2 Core routes

Mounted under `learnRouter` (inherits `requireAuth, requireAgeScreen`), strict zod, `{data, error}`
envelope, a dedicated rate limiter like `eventsRateLimiter` (`app.ts:69`):

`POST /learn/games/:gameId/sessions`, `POST .../:sid/heartbeat`, `POST .../:sid/runs`,
`PUT .../:sid/save`, `POST .../:sid/debrief`, `POST .../:sid/end`; stage 2 adds
`POST .../:sid/retrieval/grade`.

Run validation is plausibility, not trust: finish time ≥ a per-track physical minimum, lap count and
checkpoints coherent, enums valid. Verification level is stored honestly (`reported`).
Re-simulation is practical for **Time Trial only** (only mode with a recorded tape; sim determinism
is tolerance-based and untested across engines). Since races award nothing, we do not build it for v1.

### 6.3 Consent and data practices

Register `game_play_records` (kind `learner_record`) and `game_ai_debrief` in the `data_practices`
registry (`0186`/`0202` precedent, `teen_self_consent=false`). Game tables are first-party learner
records like `lesson_progress`, not analytics, so **no new insight events** are added (the old
`game_*` events were deliberately removed by `0033`). The AI debrief is gated by `game_ai_debrief`;
without consent tier 0 still works. Any new data practice for migrated children needs fresh consent
(OD-9 #2).

### 6.4 Retention (COPPA written-policy requirement)

Sessions and runs: 400 days (the `0208` precedent). Saves and progress: purged 24 months after last
play by a sweep function. All cascade on account deletion. Confirm inclusion in the family data export.

### 6.5 Migration classification

Tables, indexes and the registry rows are additive (auto-apply path). Widening `kc_attempt_source_check`
and the `receipt_key` regex is **contract** (drop-and-re-add of a CHECK; `0206` precedent): a separate
migration, applied manually by the owner, only when stage 2 starts. Each migration carries
`@phase`/`@after-release` headers; run `db:types`, `deletion:check`, and `db:reset` twice before push.

## 7. LittleFounders law — reconciliation

| Area | KartRush today | Resolution |
|---|---|---|
| **Character canon** | KartRush calls Liruf "the gambler" (`src/render/characters/liruf.ts`, `docs/02`), Rho an official of the series, Zara a mechanic, Dina a strategist sauropod. | LF canon (`oracle/src/tutor/prompt.ts`): **Dr. Rho**, an older scientist, warm and precise; **Zara Vex**, a young inventor; **Liruf**, a friendly cartoon dinosaur, playful and simple; **Dina**, a gentle four-legged companion, calm and patient. KartRush `docs/02`, `docs/19`, `narrative.ts` and the character comments are rewritten to this canon. "Gambler" is removed everywhere (a gambling label on a children's finance platform is not acceptable). The game's racing archetypes stay as handling stats, re-described in canon voice (Liruf's high speed and poor cornering becomes "all enthusiasm"). |
| **Circuit fiction** | The Circuit, chapters, Circuit Files, rivalries. | Disabled in the embed profile. LF-authored packs replace it. The standalone game follows the same canon so there is one story. |
| **Poses (rule 21: real models, catalogue poses)** | Models are decimated builds of the same `glb/*.glb` (confirmed by `assets/characters/README.md` and `buildCharacterAssets.ts`). Seated kart poses are authored procedurally in `glbPose.ts`, outside the catalogue. | Add a **Driving** family to `frontend/src/tutor-scene/poseLibrary.ts` (seated, steer-left/right, boost, item-use, recover) and make the game consume those ids; add a provenance gate that records the source-GLB hash in the character build. Ratified as a new OD entry. |
| **Celebrations (D7/OD-7)** | Podium-style results, gold, unlock reveal, personal-best fanfare. | Suppressed in the embed profile (§5.2). A personal best appears as quiet text, compared only to the learner's own history (OD-27). |
| **Rewards (B.20/B.22, OD-5)** | Unlock ladder every 8–12 min; "next goal" line; random item rolls. | Ladder and next-goal off. Item rolls are in-race gameplay randomness, not rewards; they are seeded and deterministic, and not a B.22 reward. Recorded as a clarification. |
| **DP-01 timers** | Start countdown, lap times. | Kept (G3). Visible session timers are not allowed. |
| **Lives, ranks** | None; positions vs CPU only. | Already compliant. Never shown as a ranking between people. |
| **Copy Budget, i18n, no clipping** | The game has its own en/es/pt catalogue; some HUD strings are hard-coded English (`captions.ts`, "You", " — NEW BEST!", raw kart ids). | All learner-facing words about Mentor, concepts and results are host-rendered from LF locale files. Game HUD hard-coded strings move to its catalogue. |
| **Assets/glyphs (OD-14, 24-glyph budget)** | Own visuals, procedural. | Host overlays use only the LF glyph set and manifest. No new stock art. |
| **Sound** | Synthesized cues; no off switch from the platform. | `muted` is part of `lf.init`; host mute is honoured. |

## 8. Risk resolutions

| Risk | Resolution |
|---|---|
| **Cold-load weight (~12 MB)** | Accepted by the owner; reduced in the embed profile. Boot currently waits on `preloadTitleAssets()` (4 characters + 29 vegetation + 6 hero GLBs). In embed mode load only the chosen character and the chosen track's vegetation set. The 35 `public/models` GLBs are unhashed and `no-cache`, so returning players still revalidate all of them; **content-hash them** (Vite asset URLs, `immutable`) instead of moving to a CDN. This also keeps a single origin and the game's "no runtime CDN" rule. Measure cold and warm payload before and after. |
| **Mobile** | Accepted by the owner. Route is standalone fullscreen. After the Start tap, the host requests fullscreen and `screen.orientation.lock('landscape')` where supported (Android); iOS Safari has no lock, so the host shows a rotate card in LF style, and the game's own overlay stays as a fallback. Fix the 375 px unlock-text clipping (irrelevant in embed, still a standalone bug). Verify at 375 and 1280 px, plus a real device pass. |
| **Save** | Server-side (§6). The game hydrates from `lf.init.save` and emits `kr.save` snapshots through the one choke point `saveSaveData` (`store.ts`). Requires a storage-adapter seam in `SaveStore`, which today hard-codes `localStorage` and a module-level key. A host snapshot with `version` above the game's is rejected, not merged. |
| **Audio and keyboard (chosen solution)** | **One in-iframe Start gate.** In embed mode the game's first screen is a single large Start target, labelled from the host locale; that tap is the gesture that starts audio and focuses the frame. We do not rely on `allow="autoplay"` delegation from a parent click (browser-specific, Safari differs). Additionally: on `blur` or visibility loss the game releases every key and auto-pauses (today input listens on `window` with no blur handler, so a held key sticks); `preventDefault` on arrows and Space so the host never scrolls; the host re-focuses the iframe whenever an overlay closes. |
| **Flash safety (applies)** | Yes. Only camera shake, the final-lap blink (~1.4 Hz) and the title prompt are gated by reduced motion. Speed lines, boost motion blur and FOV punch are not (`postProcessing.ts:317-385`), and `scene.setReducedMotion(false)` overrides the OS preference (`camera.ts:109`). Fix: honour `prefers-reduced-motion` and the host flag everywhere, gate those effects, and add an automated frame-sequence test that measures luminance flashes against the WCAG 2.3.1 threshold (≤ 3 per second) over boost, item and final-lap events. |
| **Embed allow-list too wide** | `DEFAULT_EMBED_ORIGINS` includes `https://*.vercel.app`, so any Vercel site could frame the game. Production uses `EMBED_ALLOWED_ORIGINS` with exact LittleFounders origins only; previews use the localhost entries. The game re-checks `event.origin` against the same list in the handshake. Create the custom domain `game-b2c.littlefounders.ai` (owner DNS action). |

Traps found in the game code, fixed in phase A: results subtitle always reads "Grey-Box Test Circuit"
(`resultsScreen.ts:148`, `standingsScreen.ts:125`); `showFatalError` interpolates into `innerHTML`
(`appShell.ts:45-48`); `captions.ts` returns hard-coded English that the scanner does not catch;
Time Trial hard-codes 150cc and `Settings.aiDifficulty` is never read; the `Stats` fields for drift,
items and distance are declared and never written; the docs overstate ghost size ("few kB" vs ~42–57 KB).

## 9. Work breakdown

Order matters: the game and the contracts must be finished **before** the route is added.

### A. KartRush repo (embed profile) — first

1. `EmbedProfile` + deep-link launcher; all characters open; unlock/celebration/narrative suppression.
2. Origin-checked `MessagePort` handshake, `kr.v1` schemas, host-supplied locale/mute/theme/save.
3. `SaveStore` adapter seam, snapshot emission, version guard.
4. Decision Lens observer (frame diffs in `raceLoop.ts`: item, vehicle and race-flow event detectors
   already exist; add item-hold and boxes-passed counters). **No sim change**, golden tapes untouched.
5. Start gate, blur/visibility pause, key-release, `preventDefault`.
6. Reduced-motion and flash-safety pass with the automated test.
7. Asset diet: embed-only preload, hashed GLBs, immutable cache; tighten `EMBED_ALLOWED_ORIGINS`.
8. Canon rewrite (`docs/02`, `docs/19`, `narrative.ts`); fix the traps above; catalogue keys with `es`/`pt`.
9. Gates: `typecheck`, `lint`, `test`, `build`, `test:compat` (default path unchanged), CSP tests updated.

### B. This repo — contracts, data, AI

1. Migrations `0259+` (§6.1, §6.3, §6.4), `db:types`, `deletion:check`.
2. Core `/learn/games/*` routes, session token, limits, plausibility checks, tests.
3. `check-game-protocol-parity` (SPA, Core, game copies).
4. Oracle sealed-line endpoint, third strict schema, spend accounting, fallback tests, spike to measure cost.
5. Add the Driving pose family to `poseLibrary.ts` and the provenance gate.
6. Stage 2 only: contract migration for the `kc_attempt` source; retrieval-grade route.

### C. Frontend host

1. `learn/play/:gameId` standalone route with its own exit; `paths.ts`, `LearnLinks`, audit-lane state (`auditCoverage` fails without one).
2. Host overlays (Start, Pause, Pit stop, soft break, rotate card) in the design system, three locales, copy-budget roles.
3. MessagePort bridge, heartbeats, fullscreen/orientation, focus management.
4. A "Play with {Mentor}" card on Learn home after `TogetherCard`; no nag, never inside a lesson-complete celebration (B.24).
5. `frame-src` and a `Permissions-Policy` for the game origin in `vercel.json`.

### D. Content

1. Concept lenses and Mentor voice: Forge packs for the four Mentors × three locales × age bands, judged and human-released (owner-run, `--max-usd`).
2. Canon rewrite for the Circuit text; retire "gambler".

### E. Done means (integration-ready)

- A game session runs inside the SPA on a real phone and on desktop; keyboard and touch work; audio starts; no stuck keys.
- A finished race writes `game_runs` and `game_progress`; reloading restores the save from the server on another device.
- Daily and session caps verified end to end; a guardian-lowered cap is honoured.
- Pit-stop line appears from tier 0 with AI off, from tier 1 with AI on, and falls back on forced failure.
- Visual evidence at 375 and 1280 px in light and dark, in all three locales (screenshots, not only tests).
- Push gate (`typecheck:all`, `lint:all`, `test:all`, `secrets:check`, `tools:test`, i18n, copy-budget, text-fit, proportion, parity) green; the production deploy is confirmed by reading the live build, not assumed from the push.

## 10. OD entries to record

1. Games live inside `/learn`; the retired `games/` approach is not resumed; new order: finished game, then concepts (G1).
2. Play surfaces are exempt from DP-01's start countdown and lap timers; visible session timers remain banned (G3).
3. Driving pose family added to the pose catalogue (rule 21).
4. `intent: post_game_debrief` added to Oracle's closed `intent` set without widening the 14 fields (OD-35(c) review).
5. Games award no XP, coins or streak credit; progress is records plus, in stage 2, KC evidence (B.20, B.22).
6. Play limits: soft 15 / hard 25 / idle 10 min, 2 sessions per local day, guardian may only lower.
7. Data practices `game_play_records` and `game_ai_debrief`; retention 400 days / 24 months (OD-9, OD-10).

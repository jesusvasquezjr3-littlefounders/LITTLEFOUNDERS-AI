# KRV1 — the exact contract between KartRush, the SPA and Core

Authoritative companion to `KARTRUSH-INTEGRATION-DESIGN.md`. Where they differ, **this file wins**
(it records what is actually built for the first release). Every layer codes against this file.

## Deviations from the design document (first release)

| Design said | First release does | Why |
|---|---|---|
| Mentor packs served by Core/Depot | Mentor pit-stop copy lives in the SPA locale files (`rebuild-games.json`, en-US/es-MX/pt-BR), typed and copy-budget scanned | Reuses the existing i18n, parity and Copy Budget gates; no new content service |
| Radio lines inside the race | None. The Mentor appears at Start (greeting) and in the pit stop | A distraction-free race; the evidence shows open or frequent NPC talk raises cognitive load |
| Host Pause/Results overlays only | Same, plus a host **Garage** (circuit, mode, driver, speed class) before launch | The game has no menus in embed mode, so the host must supply selection |
| Tier-1 AI line enabled | Implemented, **default OFF** (`GAME_AI_DEBRIEF` unset), measured before enabling | The design requires measuring cost and moderation first |
| Stage-2 KC evidence | Not built; no contract migration | Keeps the push to additive migrations only |
| Driving pose family in the catalogue | Recorded as an OD item; not built | Needs authored catalogue poses; out of this release |

## 1. Identifiers

- `gameId`: `kartrush` (only value in v1).
- `character` / Mentor: `rho` | `zara` | `liruf` | `dina`.
- `trackId`: the six ids exactly as in KartRush `src/data/tracks` (`jungleNeck`, `boulevard`, `fossilFire`,
  `factory`, `saltBay`, `glacier` — the implementer **verifies** against `REAL_TRACK_IDS` and corrects
  this list if they differ, then updates this file).
- `speedClass`: `100cc` | `150cc` | `200cc` (embed offers `100cc` and `150cc` only).
- `mode`: `single` | `timeTrial` | `practice` (practice = one lap, no rivals, never recorded as a result).
- `locale` in the game: `en` | `es` | `pt`; platform: `en-US` | `es-MX` | `pt-BR` (map in the SPA).
- `band`: `6-9` | `10-12` | `13-17` | `adult` (from `GET /learn/register`).
- `lens` keys (server-chosen, §5): `item_hold` | `drift_patient` | `drift_early` | `steady` | `swingy` | `neutral`.

## 2. Protocol `kr.v1` (SPA ↔ game, over a `MessagePort`)

Handshake: the SPA creates the iframe, waits for its `load`, then posts **one** window message
`{ t: "lf.hello", v: 1 }` to the iframe's origin with a transferred `MessagePort`. The game accepts it
only if `event.origin` is in its allow-list (`EMBED_ALLOWED_ORIGINS`, the same list the server sends
as `frame-ancestors`), replaces the allow-list check result on the port, and replies on the port with
`kr.ready`. All later traffic is on the port. Unknown `t`, a wrong `v`, an extra field, a wrong type or
an out-of-range number is **dropped and logged**, never coerced.

All messages are plain objects `{ t, v: 1, ... }`.

### host → game

| `t` | Fields |
|---|---|
| `lf.init` | `sessionRef: string(8..64 [A-Za-z0-9_-])`, `locale: 'en'\|'es'\|'pt'`, `mentor: Mentor`, `muted: boolean`, `reducedMotion: boolean`, `startLabel: string(1..24)`, `save: { revision: int>=0, data: object\|null }`, `start: StartSpec` |
| `lf.start` | `start: StartSpec` (next race after the first; no Start gate) |
| `lf.pause` / `lf.resume` | none |
| `lf.mute` | `muted: boolean` |
| `lf.end` | none (stop, free GPU and audio) |

`StartSpec = { mode, trackId, character, speedClass }`.

### game → host

| `t` | Fields |
|---|---|
| `kr.ready` | `build: string(1..40)` |
| `kr.runStarted` | `runKey: string(8..64)`, `mode`, `trackId`, `character` |
| `kr.runFinished` | `RunReport` (below). Sent once, exactly when the player crosses the line, `mode !== 'practice'` only |
| `kr.runEnded` | `runKey` — the finish replay is over (or skipped); the host may now show the pit stop. Sent for practice too |
| `kr.save` | `revision: int`, `data: object` (≤ 64 KB when serialized; ghosts stripped) |
| `kr.pauseRequested` | none (Pause key, button or focus loss) |
| `kr.exitRequested` | none |
| `kr.error` | `code: 'webgl'\|'boot'\|'race'\|'unknown'` |

```
RunReport = {
  runKey, mode: 'single'|'timeTrial', trackId, character, kartBody: string(1..24),
  speedClass, finished: true,
  finishMs: int 1..1_800_000, bestLapMs: int, lapMs: int[1..5],
  rank: int 1..8,
  lens: {
    itemHoldMs: int 0..1_800_000, boxesPassedWhileHolding: int 0..200, itemsUsed: int 0..200,
    driftReleases: { t0: int, t1: int, t2: int, t3: int }, recoveries: int 0..200
  }
}
```

Rules: no identifiers, free text or input streams ever leave the game. The game does not send
anything while a race is running except `kr.runStarted` and, if needed, `kr.pauseRequested`.

## 3. Core API (all under `/api/v1/learn/games`, `requireAuth` + `requireAgeScreen`, strict zod, `{data,error}` envelope)

| Method + path | Body | Success `data` |
|---|---|---|
| `GET /` | — | `{ games: [{ gameId, status: 'live', sessionsRemainingToday: int, enabled: boolean }] }` |
| `POST /:gameId/sessions` | `{}` | `{ sessionId: uuid, sessionRef: string, game: { url: string, build: string }, mentor: Mentor\|null, band, caps: { softMs, hardMs, idleMs }, save: { revision: int, data: object\|null }, bests: BestRow[], sessionsRemainingToday: int }` |
| `POST /:gameId/sessions/:sid/heartbeat` | `{ visible: boolean, focused: boolean }` | `{ activeSeconds: int, state: 'ok'\|'soft'\|'hard'\|'idle' }` |
| `POST /:gameId/sessions/:sid/runs` | `RunReport` | `{ runId: uuid, lens: Lens, newBest: boolean, bests: BestRow[], aiAvailable: boolean }` |
| `POST /:gameId/sessions/:sid/runs/:runId/reflection` | `{ reply: 'a'\|'b'\|'unsure' }` | `{ ok: true }` |
| `POST /:gameId/sessions/:sid/runs/:runId/debrief` | `{}` | `{ source: 'authored'\|'ai', text: string\|null }` (`text` only when `source==='ai'`) |
| `PUT /:gameId/sessions/:sid/save` | `{ revision: int, data: object }` | `{ revision: int }` (compare-and-set) |
| `POST /:gameId/sessions/:sid/end` | `{ reason: 'left'\|'soft'\|'hard'\|'idle' }` | `{ ok: true }` |
| `GET /play-limits/kids/:kidId` (family router, parent only) | — | `{ maxSessionsPerDay: 0..2, maxSessionMinutes: 5..25 }` |
| `PUT /play-limits/kids/:kidId` (family router, parent only) | same | same |

`BestRow = { trackId, character, speedClass, bestFinishMs, bestLapMs, runs }`.

Errors (`error.code`): `VALIDATION_ERROR` 400, `GAME_UNKNOWN` 404, `GAME_DISABLED` 403 (guardian set 0),
`GAME_DAILY_LIMIT` 429 (`resetsAt` ISO), `SESSION_CLOSED` 409, `SESSION_EXPIRED` 410, `SAVE_CONFLICT` 409
(`data: { revision }`), `RUN_IMPLAUSIBLE` 422, `RUN_DUPLICATE` returns the original run with 200.

Limits (platform ceiling; a guardian may only lower): soft 15 min, hard 25 min, idle 10 min of active
time, 2 sessions per learner-local day. `soft = max(1, min(15, hardMinutes - 5))` minutes.
Heartbeats are expected every 30–60 s; the server credits `min(now - lastHeartbeat, 90 s)` only when
`visible && focused`.

Plausibility (`RUN_IMPLAUSIBLE`): `finishMs >= 20_000 * lapMs.length`, each lap `>= 20_000`,
`|finishMs - sum(lapMs)| <= 3000`, `bestLapMs == min(lapMs)`, `rank` 1..8, all enums valid, session open
and not expired, `runKey` unique per `(user, game)` (a repeat returns the stored run).

## 4. Database

Migration `0259_game_records.sql` (renumber at merge if `0259` is taken — check `git ls-tree origin/main`
and any in-flight branch at the moment of the push). Additive only; `@phase: expand`. Tables per design §6.1:
`game_catalog`, `game_sessions`, `game_runs`, `game_progress`, `game_saves`, `learner_play_limits`.
Rules: RLS enabled on all; `REVOKE ALL FROM PUBLIC, anon, authenticated`; `GRANT` to `service_role`;
self-or-guardian `SELECT` policies; FK to `auth.users ON DELETE CASCADE`; `metrics jsonb` numeric-only
by CHECK function; `UNIQUE(user_id, game_id, run_key)`; retention sweep (sessions/runs 400 days, saves
and progress 24 months after last play). Seed `game_catalog('kartrush','live')`. Register data practices
`game_play_records` and `game_ai_debrief` following `0186`/`0202`.

## 5. Lens selection (server-side, deterministic, one place)

Applied to a finished non-practice run, first match wins:

1. `item_hold` if `boxesPassedWhileHolding >= 2`
2. `drift_patient` if `driftReleases.t3 >= 1`
3. `drift_early` if `driftReleases.t0 >= 3`
4. `steady` if `lapMs.length >= 3` and `(max - min) / min <= 0.04`
5. `swingy` if `lapMs.length >= 3` and `(max - min) / min >= 0.10`
6. otherwise `neutral`

## 6. SPA host

Route `learn/play/:gameId` (standalone, own exit). States: `garage` → `loading` → `gate` → `racing`
↔ `paused` → `pitstop` → `garage`/`racing`; plus `soft` (calm break card, no timer) and `closed`
(`hard`/`idle`/daily limit). The SPA owns every word the learner reads except the race HUD. The iframe
`src` is `game.url` from Core, accepted only if its origin is in the SPA's hard-coded game-origin list.
iframe attributes: `allow="fullscreen; gamepad; autoplay"`, `title` localised, no `sandbox` (the game
is first-party; it needs WebGL, audio, gamepad and pointer lock-free input).

Pit stop card: Mentor avatar (existing `findMentorAvatar`), one observation (`lens` + mentor + locale
from `rebuild-games.json`), one reflection question with replies `a|b|unsure`, actions "Race again" and
"Talk to {Mentor}" (navigates to the Mentor route; no extra context is sent in this release). If
`aiAvailable`, the SPA requests `/debrief` once and swaps the text only if it arrives within 6 s.

Learn home card ("Play with {Mentor}") appears when `GET /learn/games` returns `enabled: true`.

## 7. Locale/copy rules for `rebuild-games.json`

Keys are typed from en-US; es-MX and pt-BR must have identical key sets (existing `i18n:check`).
Every string carries a `data-copy-role`; the Copy Budget applies (action ≤ 3 words, body ≤ 12 words,
age 6-9 register, glossary rules: no "Tutor", "bot", "assistant", "lives", "freeze", no em dash).
Mentor voices follow `oracle/src/tutor/prompt.ts` `CHARACTER_VOICES`.

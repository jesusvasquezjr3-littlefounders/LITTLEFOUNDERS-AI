# audiogen (Echo)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** TTS audio generation for lessons, per-locale voices (en-US, es-MX, pt-BR).
**Port (dev):** 4002 · **Deploy:** Railway · **Access:** internal only (`x-internal-api-key`)

```bash
npm install
cp .env.example .env   # fill in real TTS/Supabase/Filebase values
npm run dev
npm test
```

## What it does

On `POST /internal/v1/audio/lesson`, Echo reads a lesson's CLIENT-SAFE
document (`lesson_documents.document` — never answer keys), extracts every
narratable text unit (LESSON_ENGINE.md §12), synthesizes speech via
DashScope (Qwen3-TTS), transcodes the returned WAV to a small mono MP3,
uploads each clip to filebase (bucket `lesson-audio`, public), and PATCHes
both the `audio` manifest and the `document`'s `audio_segment_id` stamps back
onto the row. Idempotent by content hash — unchanged text/voice/model reuses
the existing clip instead of re-paying for TTS. On top of that, the GLOBAL
`speech_assets` cache (Vault, migration 0015 — mirror of Prism's
`picture_assets`) deduplicates across lessons/locales/courses/re-publishes:
an identical (text, voice, model, language_type, bitrate) request anywhere on
the platform is a free hit, and both lookup and write-through are best-effort
(a Vault outage degrades to a paid call, never a failed unit).

## Routes

All routes below `/internal` require `x-internal-api-key: <INTERNAL_API_KEY>`
(same header convention as `parent-id-check`). Every response uses the
`{ data, error }` envelope (/AGENTS.md §1.6).

| Method | Path | Body / Query | Description |
|---|---|---|---|
| GET | `/health` | — | Service health envelope |
| POST | `/internal/v1/audio/lesson` | `{ lesson_id, locale }` | Narrate a lesson document; returns `{ units_total, generated, reused, cached, failed[] }` (`cached` = global speech_assets hits, zero paid calls) |
| POST | `/internal/v1/audio/segment` | `{ text, locale, voice? }` | Ad-hoc: narrate arbitrary text, no persistence; returns `{ file_id, url }` |
| GET | `/internal/v1/audio/lesson/:id` | `?locale=` | Current audio manifest for a lesson_documents row |

## Env vars

| Var | Default | Notes |
|---|---|---|
| `PORT` | `4002` | |
| `INTERNAL_API_KEY` | — | Required; validates inbound `x-internal-api-key` |
| `TTS_API_URL` | DashScope multimodal-generation endpoint | Qwen3-TTS REST |
| `TTS_API_KEY` | — | Required |
| `TTS_MODEL` | `qwen3-tts-flash` | Provider decision RESOLVED — see AGENTS.md |
| `TTS_ENROLLMENT_API_URL` | DashScope `audio/tts/customization` endpoint | Voice-clone enrollment (`qwen-voice-enrollment`) — a different endpoint from synthesis |
| `TTS_CLONE_MODEL` | `qwen3-tts-vc-2026-01-22` | Model every cloned voice is bound to at enrollment AND synthesis — never mix with `TTS_MODEL` |
| `TTS_VOICE_EN_US` | `Jennifer` | Per-locale default voice (see "Voice map" below) |
| `TTS_VOICE_ES_MX` | `Li` | |
| `TTS_VOICE_PT_BR` | `Ryan` | |
| `TTS_VOICE_{DINA,LIRUF,RHO,ZARA}_{EN_US,ES_MX,PT_BR}` | unset | Per-character voice overrides (12 vars, all optional — see "Voice map" below) |
| `SUPABASE_URL` | — | Required; Vault (Supabase self-hosted) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Required; service-role writes only |
| `FILEBASE_URL` | — | Required |
| `FILEBASE_INTERNAL_KEY` | — | Required; sent as `x-internal-api-key` to filebase |
| `AUDIOGEN_RUN_ON_START` | `false` | Operator opt-in batch narration on boot — **paid**, see below |
| `AUDIOGEN_CONCURRENCY` | `2` | Concurrent TTS/upload lanes for a single lesson |
| `AUDIOGEN_MP3_BITRATE_KBPS` | `48` | Mono MP3 output bitrate |

## Voice map

Implemented (`src/env.ts` `voiceFor()`). Per **unit** — not per lesson —
Echo resolves the voice from the narrating character (COURSE_ENGINE.md §7:
"voice = the segment's narrator character"):

1. `story_dialogue` lines and `story_scene` bodies carry their OWN
   `character` (a dialogue can have several speakers in one segment) — used
   first when present.
2. Otherwise, the segment envelope's `narrator.character` (LESSON_ENGINE.md
   §3), if set.
3. Otherwise, the locale default (`TTS_VOICE_{EN_US,ES_MX,PT_BR}`).

Steps 1–2 only resolve to a real voice for `dina`/`liruf`/`rho`/`zara` (the 4
canon characters) AND only when that character's `TTS_VOICE_<CHARACTER>_<LOCALE>`
env var is set — any other character string, or an unset var, falls straight
to step 3. This means the map is safe to fill in incrementally (one
character/locale at a time) with zero code changes and zero risk of an
unrecognized value reaching the TTS provider.

`voiceFor()` returns `{ voice, model }`, not a bare string — a locale
default pairs with `TTS_MODEL`; a character override ALWAYS pairs with
`TTS_CLONE_MODEL`, because DashScope binds every cloned voice to the exact
model it was enrolled under. `AudioUnitEntry.voice` on every generated unit
records exactly which voice was used, so a wrong mapping is always visible
in the manifest.

### Registering a cloned voice from a reference sample

Implemented: `src/tts/trimSample.ts` (RMS-based clean-window selector),
`src/tts/voiceClone.ts` (the `qwen-voice-enrollment` client), and two
scripts:

1. Drop raw reference recordings under `src/samples/{EN,ES,PT}/` (gitignored
   — never committed; see root `.gitignore`). One long-form native-locale
   recording per character/locale is enough; DashScope's enrollment API
   caps input at 60s / 10MB / no single silent gap over 2s, so raw
   voice-actor takes almost always need trimming first.
2. `npm run trim:samples` — **free, local-only, no network calls.** Picks
   the cleanest ~18s window per file (energy-based silence detection, no
   external DSP dependency) and writes the trimmed WAVs to
   `src/samples/trimmed/{locale}/{character}.wav`, printing a pass/fail
   table against the enrollment API's hard limits. Review this table before
   proceeding.
3. `npm run voices:register -- --confirm` — **PAID**, one DashScope
   enrollment call per trimmed sample (12 calls for the full character ×
   locale grid). Does nothing — zero network calls — without the
   `--confirm` flag (BOUNDARIES-tier operator opt-in, same pattern as
   `AUDIOGEN_RUN_ON_START`). On success it prints
   `TTS_VOICE_<CHARACTER>_<LOCALE>=<voice-id>` lines for a human to paste
   into `.env` — it never auto-edits a secrets file.

Contract CONFIRMED against live calls (2026-07-13, 12/12 enrollments OK):
the response carries `output.voice_id`. Two live gotchas: `preferred_name`
rejects hyphens (use `dina_es_mx`, never `dina-es-mx`), and synthesis with
a cloned voice MUST use `TTS_CLONE_MODEL` (`qwen3-tts-vc-2026-01-22`) — the
flash model 400s on cloned voice ids. `voiceFor()` already pairs them.

## Cost warning

`POST /internal/v1/audio/lesson`, `POST /internal/v1/audio/segment`, and the
batch path (`AUDIOGEN_RUN_ON_START=true` or `npm run narrate:all`) all call
the paid DashScope TTS API. `AUDIOGEN_RUN_ON_START` defaults to `false` and
batch-narrating a whole catalog is a BOUNDARIES-tier action — trigger it
deliberately, not as a side effect of booting the service. Use
`npm run narrate:all -- --course financial-education --dry-run` first: the
preflight reads pending documents, counts narratable units, reports manifest
entries that may be reusable and estimates the remaining TTS calls. It makes
zero DashScope, Depot, speech-cache or Vault-write calls and does not require a
TTS API key. For a low-cost pilot, set
`AUDIOGEN_MAX_TTS_CALLS_PER_RUN=12` (or another approved call ceiling); Echo
reserves a call immediately before synthesis, refuses later units without
contacting DashScope, and leaves the lesson unversioned so it remains safely
retryable. Cache hits and speech-guard refusals do not consume the ceiling.
The live batch still rechecks hashes/voices and the global cache, so the
preflight estimate is intentionally an upper bound rather than a spend promise.

## Dependency note

`src/db/lessonDocumentsRepo.ts` targets the real schema shipped in
`database/migrations/0007_course_hierarchy.sql`:
`lesson_documents(lesson_id, locale, schema_version, document jsonb,
answer_keys jsonb, audio jsonb, updated_at)`, **PRIMARY KEY (lesson_id,
locale)** — there is no synthetic `id` column, so reads/writes key on the
pair. That table has **no SELECT RLS policy** by design (0007: a
"published chain" policy would still expose `answer_keys` on the same row) —
only the service role can read it, which is what this module uses. Echo's
select clause is deliberately `lesson_id,locale,document,audio` — it never
selects `answer_keys`. This has been reconciled against the migration but
not yet exercised against a live Supabase instance; all coverage here is
mocked-PostgREST tests.

## New dependency

`@breezystack/lamejs` (pure-JS MP3 encoder, LGPL-3.0, zero transitive deps) —
added because Node has no built-in MP3 encoder and the task requires a
small, quality-preserving mono MP3 output without a native/binary dependency.

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
the existing clip instead of re-paying for TTS.

## Routes

All routes below `/internal` require `x-internal-api-key: <INTERNAL_API_KEY>`
(same header convention as `parent-id-check`). Every response uses the
`{ data, error }` envelope (/AGENTS.md §1.6).

| Method | Path | Body / Query | Description |
|---|---|---|---|
| GET | `/health` | — | Service health envelope |
| POST | `/internal/v1/audio/lesson` | `{ lesson_id, locale }` | Narrate a lesson document; returns `{ units_total, generated, reused, failed[] }` |
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
| `TTS_VOICE_EN_US` | `Jennifer` | Per-locale default voice (see "Voice map" below) |
| `TTS_VOICE_ES_MX` | `Li` | |
| `TTS_VOICE_PT_BR` | `Ryan` | |
| `TTS_VOICE_{DINA,DINO,RHO,ZARA}_{EN_US,ES_MX,PT_BR}` | unset | Per-character voice overrides (12 vars, all optional — see "Voice map" below) |
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

Steps 1–2 only resolve to a real voice for `dina`/`dino`/`rho`/`zara` (the 4
canon characters) AND only when that character's `TTS_VOICE_<CHARACTER>_<LOCALE>`
env var is set — any other character string, or an unset var, falls straight
to step 3. This means the map is safe to fill in incrementally (one
character/locale at a time) with zero code changes and zero risk of an
unrecognized value reaching the TTS provider.

Each var is just a `voice` string handed to `synthesizeSpeech()` — it works
identically whether that string is a DashScope **built-in preset name** (e.g.
`Cherry`) or a **cloned voice id** registered from a reference audio sample
via DashScope's voice-clone flow (`qwen3-tts-vc`). The clone *registration*
step itself (upload a reference sample → get back a voice id) is NOT yet
implemented here — its exact request/response contract wasn't verified
against a real character sample at the time this map was built. Once
reference audio lands for a character, either (a) it turns out to be preset
names to type directly into these vars, or (b) it needs a one-time clone
registration whose output (a voice id) then goes into these same vars — no
call-site changes either way. `AudioUnitEntry.voice` on every generated unit
records exactly which voice was used, so a wrong mapping is always visible
in the manifest.

## Cost warning

`POST /internal/v1/audio/lesson`, `POST /internal/v1/audio/segment`, and the
batch path (`AUDIOGEN_RUN_ON_START=true` or `npm run narrate:all`) all call
the paid DashScope TTS API. `AUDIOGEN_RUN_ON_START` defaults to `false` and
batch-narrating a whole catalog is a BOUNDARIES-tier action — trigger it
deliberately, not as a side effect of booting the service.

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

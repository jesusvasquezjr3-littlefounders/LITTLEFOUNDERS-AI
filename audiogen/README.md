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
| `SUPABASE_URL` | — | Required; Vault (Supabase self-hosted) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Required; service-role writes only |
| `FILEBASE_URL` | — | Required |
| `FILEBASE_INTERNAL_KEY` | — | Required; sent as `x-internal-api-key` to filebase |
| `AUDIOGEN_RUN_ON_START` | `false` | Operator opt-in batch narration on boot — **paid**, see below |
| `AUDIOGEN_CONCURRENCY` | `2` | Concurrent TTS/upload lanes for a single lesson |
| `AUDIOGEN_MP3_BITRATE_KBPS` | `48` | Mono MP3 output bitrate |

## Voice map

`TTS_VOICE_{EN_US,ES_MX,PT_BR}` are **placeholder per-locale defaults**, not
final casting. LESSON_ENGINE.md §12 says voice casting is Echo's decision:
the end state is a voice map keyed by `CharacterId × locale` (Dina/Dino/Rho/
Zara each get a distinct, locale-appropriate voice), matching a segment's
`narrator.character` when present. That map is a follow-up — v1 narrates
every unit with the single per-locale default voice above regardless of
`narrator`.

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

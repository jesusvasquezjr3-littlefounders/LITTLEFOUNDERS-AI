# picturegen (Prism)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** The platform's ONLY image-generation service (the visual sibling of Echo/audiogen). Consumers (coursegen/Forge today) POST a label; Prism art-directs a prompt, generates the illustration on DashScope (`qwen-image-max`), stores it in Depot, indexes it in Vault — and is **cache-first**: an identical request never pays the image API twice.
**Port (dev):** 4007 · **Deploy:** Railway · **Access:** internal only (`x-internal-api-key`)

```bash
npm install
cp .env.example .env   # fill in real DashScope/Supabase/Filebase values
npm run dev
npm test
```

## What it does

On `POST /api/v1/pictures`, Prism asks the **art-director judge** (an
OpenAI-compatible chat model) to craft one detailed English illustration
prompt that depicts the label clearly for a child and enforces the
LittleFounders visual identity. Before judging, it hashes the stable request
descriptor `(model, size, style version, purpose, label, context)` — for the
four object-tile purposes the descriptor collapses to
`(model, size, tile style version, label)`, because their deterministic prompt
depends only on the label — and looks that up in `picture_assets`:

- **HIT** → returns the stored asset, `cached: true`, with **zero paid API calls**.
- **MISS** → calls the model-selected DashScope image endpoint (synchronous for
  `qwen-image-max`; legacy Qwen models use submit/poll), **downloads the
  temporary result URL** (never persists it),
  re-uploads the bytes to Depot (bucket `lesson-images`, public), inserts the
  row in Vault (on-conflict re-select, so concurrent duplicates are safe), and
  returns `cached: false`.

The judge NEVER blocks generation: any judge failure degrades to a
deterministic fallback prompt built from `label + context + identity brief`.

## Routes

Routes under `/api/v1` require `x-internal-api-key: <INTERNAL_API_KEY>`
(constant-time compared, same convention as the sibling internal services).
Every response uses the `{ data, error }` envelope (/AGENTS.md §1.6).

| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/health` | — | Service health envelope; `data.style_version` is `STYLE_VERSION+OBJECT_TILE_STYLE_VERSION` so Forge can preflight-assert its style constant before a paid run |
| POST | `/api/v1/pictures` | `{ label, context?, purpose? }` | Cache-first: get-or-generate an illustration. Returns `{ url, file_id, prompt, model, cached, generated_images }` |

`label` (1–120 chars) is the subject. `context` (≤2000 chars, optional) grounds
it in the lesson. `purpose` ∈ `lesson_option | option_card | item_card |
scene_anchor | memory_card | outcome | scene | generic` (default `generic`)
picks the per-purpose art direction — the structural role decides the
composition, so a thumbnail option tile and a wide establishing scene are not
the same picture.

Object-tile purposes (`item_card`, `option_card`, `lesson_option`,
`memory_card`) are centered literal objects on a pure-white, edge-to-edge
canvas, rendered as strict two-dimensional flat vectors (never 3D, plastic,
or photorealistic). Prism's deterministic edge-pixel checker treats a colored canvas,
white-card inset, frame, or broad shadow as a terminal visual defect for these
purposes; setting-based scene purposes are intentionally exempt.

Adding a purpose is **cache-safe** — a non-tile `purpose` is part of the
request hash, so new values mint new keys and never invalidate stored art. A
new purpose must therefore NEVER bump `STYLE_VERSION`. The four object-tile
purposes are the exception by design: they share one deterministic label-only
prompt, so their cache key collapses purpose (to a single `object_tile` token)
and drops context — the same label is generated and billed exactly once across
all of them.

### Failure statuses — a retry instruction for the caller

The status tells the caller whether asking again can help. It is a real
cross-service contract: coursegen's transport retry re-requests 5xx and gives
up on 4xx, and every needless re-request is a full paid generation
(`AGENTS.md` → *The response status IS a retry instruction*).

| Status | Codes | Caller should |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Fix the body — never retry |
| `401` | `UNAUTHORIZED` | Fix `x-internal-api-key` — never retry |
| `502` | `IMAGE_TIMEOUT`, `IMAGE_RATE_LIMITED`, `IMAGE_PROVIDER_ERROR`, `IMAGE_DOWNLOAD_FAILED` | Retry — upstream was transiently unhappy |
| `422` | `IMAGE_BAD_RESPONSE`, `IMAGE_VERIFICATION_FAILED`, `IMAGE_GENERATION_FAILED` | Do NOT retry — fall back (icon/text) and move on |

## Env vars

| Var | Default | Notes |
|---|---|---|
| `PORT` | `4007` | |
| `INTERNAL_API_KEY` | — | Required; validates inbound `x-internal-api-key` |
| `IMAGE_API_BASE` | `https://dashscope-intl.aliyuncs.com` | DashScope base (no path) |
| `IMAGE_API_KEY` | — | Required; DashScope key |
| `IMAGE_MODEL` | `qwen-image-max` | Official Qwen image model — explicit local model selection (AGENTS.md) |
| `IMAGE_SIZE` | `1328*1328` | Square preset supported by `qwen-image-max`, passed as `parameters.size` |
| `JUDGE_API_BASE` | DashScope `compatible-mode/v1` | OpenAI-compatible chat |
| `JUDGE_API_KEY` | unset | Optional; falls back to `IMAGE_API_KEY` |
| `JUDGE_MODEL` | `qwen-plus` | Art-director judge model |
| `SUPABASE_URL` | — | Required; Vault (Supabase self-hosted) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Required; service-role reads/writes to `picture_assets` |
| `FILEBASE_URL` | — | Required; Depot |
| `FILEBASE_INTERNAL_KEY` | — | Required; sent as `x-internal-api-key` to Depot |
| `PICTUREGEN_TIMEOUT_MS` | `120000` | Overall wall clock per image (submit + poll) |
| `PICTUREGEN_MAX_ATTEMPTS` | `4` | Max transport attempts per HTTP call (429/5xx retried) |
| `VERIFY_MODEL` | `qwen-vl-plus` | Vision model that inspects every fresh image for readable text/numerals |
| `PICTUREGEN_VERIFY_ATTEMPTS` | `3` | Judge→generate→verify attempts before `IMAGE_VERIFICATION_FAILED`; `0` disables |
| `IMAGE_WEBP_QUALITY` | `82` | WebP quality for the storage transcode (every image is stored as WebP; −96.9% vs PNG measured) |

## Storage backfill (`npm run backfill:webp -- [map.json] --confirm`)

**Operator-triggered only, free (no paid API).** One-time-but-re-runnable
migration that converts every PNG asset in the `picture_assets` cache to WebP:
downloads from Depot, re-encodes (`gen/transcode.ts`, same encoder as the live
pipeline), re-uploads, and updates the cache row IN PLACE (`url`, `file_id`,
`bytes` — `prompt_hash` untouched: the request didn't change, so this is
explicitly not a STYLE_VERSION bump). Cache rows must move in lockstep with
the objects because a cache HIT returns the stored url verbatim. Emits the
old-url → new-url map consumed by coursegen's `images:apply-map` (Forge owns
the urls embedded in lesson documents). Idempotent — rows already `.webp` are
skipped. First real run 2026-07-25: 1,591/1,591 converted, zero failures;
Depot `lesson-images` went **1.5 GB → 51 MB**.

## Cost warning

`POST /api/v1/pictures` calls the paid DashScope image API **only on a cache
miss**. The cache (`picture_assets`, keyed on the stable request descriptor,
not a nondeterministic judge prompt) is the whole point — an identical
re-requested asset is free.

## Dependency note

`src/cache/pictureAssetsRepo.ts` targets a `picture_assets` table whose
migration is owned by Vault (`database/`) and assumed present:
`picture_assets(id uuid, prompt_hash text UNIQUE, model, prompt, url, file_id,
bytes int, created_at)`. All coverage here is mocked-PostgREST / injectable-dep
tests — not yet exercised against a live Supabase instance.

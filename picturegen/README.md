# picturegen (Prism)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** The platform's ONLY image-generation service (the visual sibling of Echo/audiogen). Consumers (coursegen/Forge today) POST a label; Prism art-directs a prompt, generates the illustration on DashScope (Qwen-Image), stores it in Depot, indexes it in Vault — and is **cache-first**: an identical request never pays the image API twice.
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
LittleFounders visual identity. It hashes `(model, size, prompt)` and looks
that up in `picture_assets`:

- **HIT** → returns the stored asset, `cached: true`, with **zero paid API calls**.
- **MISS** → submits the DashScope async text-to-image task, polls until it
  succeeds, **downloads the temporary result URL** (never persists it),
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
| GET | `/health` | — | Service health envelope |
| POST | `/api/v1/pictures` | `{ label, context?, purpose? }` | Cache-first: get-or-generate an illustration. Returns `{ url, file_id, prompt, model, cached }` |

`label` (1–120 chars) is the subject. `context` (≤2000 chars, optional) grounds
it in the lesson. `purpose` ∈ `lesson_option | memory_card | scene | generic`
(default `generic`) steers composition.

## Env vars

| Var | Default | Notes |
|---|---|---|
| `PORT` | `4007` | |
| `INTERNAL_API_KEY` | — | Required; validates inbound `x-internal-api-key` |
| `IMAGE_API_BASE` | `https://dashscope-intl.aliyuncs.com` | DashScope base (no path) |
| `IMAGE_API_KEY` | — | Required; DashScope key |
| `IMAGE_MODEL` | `qwen-image` | Official Qwen image model — provider decision RESOLVED (AGENTS.md) |
| `IMAGE_SIZE` | `1024*1024` | Passed as `parameters.size` |
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

## Cost warning

`POST /api/v1/pictures` calls the paid DashScope image API **only on a cache
miss**. The cache (`picture_assets`, keyed on `sha256(model size prompt)`) is
the whole point — a re-requested asset is free.

## Dependency note

`src/cache/pictureAssetsRepo.ts` targets a `picture_assets` table whose
migration is owned by Vault (`database/`) and assumed present:
`picture_assets(id uuid, prompt_hash text UNIQUE, model, prompt, url, file_id,
bytes int, created_at)`. All coverage here is mocked-PostgREST / injectable-dep
tests — not yet exercised against a live Supabase instance.

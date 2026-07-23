# AGENTS.md — picturegen (Prism)

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

Prism is the platform's **ONLY** image-generation service — the visual sibling
of Echo (audiogen). Every generated illustration on the platform is born here:
consumers (coursegen/Forge today) POST a bare label + lesson context; Prism
art-directs a prompt, generates the image once, stores it in Depot, indexes it
in Vault, and hands back a stable URL. Internal service — `x-internal-api-key`
only, constant-time compared.

## Owns / does not own

- **Owns:** turning a label into a stored, Depot-hosted illustration; the
  art-director judge; the `picture_assets` cache; the DashScope image client.
- **Does NOT own:** the app's UI visual system (that is `/DESIGN.md`, and the
  `frontend/`), audio (Echo/audiogen), or media *storage* (Depot/filebase — Prism
  is a client of it, bucket `lesson-images`).

## Cache-first — the core value (non-negotiable)

An identical request must **NEVER** hit the paid image API twice. Every
generation is keyed by `sha256(model size prompt)` in `picture_assets`
(UNIQUE `prompt_hash`). The flow is judge → hash → lookup → **HIT returns the
stored row with zero paid calls**; only a MISS generates. Insert uses
PostgREST `resolution=ignore-duplicates` + re-select, so two concurrent
generations of the same prompt can't error or double-pay. This is the whole
reason the service exists ("optimizar consumo, no llamar APIs a cada rato").

## Provider decision — RESOLVED

**Image provider: Qwen-Image on DashScope, model `qwen-image`.** Gemini was
discarded — its image models are quota-0. The async text-to-image contract
(verified working): `POST {IMAGE_API_BASE}/api/v1/services/aigc/text2image/image-synthesis`
with header `X-DashScope-Async: enable` and body
`{ model, input:{ prompt, negative_prompt? }, parameters:{ n:1, size } }` →
`{ output:{ task_id } }`; then poll `GET {base}/api/v1/tasks/{task_id}` until
`output.task_status === 'SUCCEEDED'`, whose `output.results[0].url` is a
**temporary** image URL. Client lives in `src/gen/qwenImageClient.ts` behind a
narrow `generateImage()` seam — swapping providers later means replacing that
one module. Retries ONLY on 429/5xx (jittered backoff 0.5–8s); everything else
fails fast as a typed `ImageError` (`IMAGE_RATE_LIMITED` / `IMAGE_PROVIDER_ERROR`
/ `IMAGE_TIMEOUT` / `IMAGE_BAD_RESPONSE` / `IMAGE_DOWNLOAD_FAILED`).

## The art-director judge

`src/judge/promptJudge.ts` turns `{label, context?, purpose?}` into ONE detailed
English prompt via the OpenAI-compatible chat model (`JUDGE_MODEL`, JSON mode).
It enforces the exported `LF_VISUAL_IDENTITY` brief — the authoritative
**illustration** style guide (distinct from `/DESIGN.md`, which is authoritative
for the app UI). The judge returns strict JSON `{ prompt (≤800 chars),
negative? }`. It **never blocks generation**: on any failure (HTTP error, or
unparseable JSON after 2 corrective attempts) it degrades to a deterministic
fallback prompt `${label} — ${context.slice(0,160)}. ${LF_VISUAL_IDENTITY}`.

## Invariants that bite here

- **The provider URL is temporary — never persisted.** Prism ALWAYS downloads
  the result bytes and re-uploads to Depot (`lesson-images`, `visibility: public`)
  before anything is stored. The stored `url` is Depot's, never DashScope's.
- **Child safety (§1.9):** prompts contain lesson content only — the label and
  its lesson context — never child PII. The `LF_VISUAL_IDENTITY` brief itself
  forbids scary/violent imagery, faces close-up, logos, watermarks, and any
  text in the image. Both the judged and the fallback prompt carry this brief.
- **Assets are stored in Depot + indexed in Vault `picture_assets`.** The DB row
  (url, file_id, bytes, prompt, model, prompt_hash) is the durable record;
  Depot holds the bytes.
- Envelope + Zod on every route (/AGENTS.md §1.6). `/api/v1/**` is
  internal-key-gated; `/health` is open.

## Read before touching

- `agent/core/CONVENTIONS.md` — app layout, envelope, test shape.
- `audiogen/AGENTS.md` — the sibling generation service this one mirrors
  (Zod env, typed errors, retry/backoff, injectable-dep tests, Depot upload).
- `COURSE_ENGINE.md` — how Forge (the first consumer) requests images.

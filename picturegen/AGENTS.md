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
generation is keyed by `sha256(model size "STYLE_VERSION | purpose | label |
context")` in `picture_assets` (UNIQUE `prompt_hash`) — the key hashes the
**REQUEST descriptor, computed BEFORE the judge**, never the judged prompt.
(The judge is an LLM: two identical requests craft two slightly different
prompts, so a prompt-keyed cache never hits — caught live on the first smoke
test.) The flow is hash → lookup → **HIT returns the stored row with zero
paid calls, judge included**; only a MISS judges + generates. Insert uses
PostgREST `resolution=ignore-duplicates` + re-select, so two concurrent
generations of the same request can't error or double-pay. This is the whole
reason the service exists ("optimizar consumo, no llamar APIs a cada rato").
`STYLE_VERSION` (service/pictures.ts) bumps ONLY on look changes (a bump =
full paid catalog regeneration); failure-mode hardening instead deletes the
offending cached rows surgically.

**Adding a `PICTURE_PURPOSES` value is cache-safe — never bump `STYLE_VERSION`
for one.** `purpose` is already a component of the hashed request descriptor, so
a new value can only mint keys nothing has stored; every existing asset keeps
its key and stays a HIT. Bumping `STYLE_VERSION` "to be safe" would re-pay for
the entire catalog to obtain byte-identical-looking art.

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
/ `IMAGE_TIMEOUT` / `IMAGE_BAD_RESPONSE` / `IMAGE_DOWNLOAD_FAILED` /
`IMAGE_VERIFICATION_FAILED`).

## The art-director judge

`src/judge/promptJudge.ts` turns `{label, context?, purpose?}` into ONE detailed
English prompt via the OpenAI-compatible chat model (`JUDGE_MODEL`, JSON mode).
It enforces the exported `LF_VISUAL_IDENTITY` brief — the authoritative
**illustration** style guide (distinct from `/DESIGN.md`, which is authoritative
for the app UI). The judge returns strict JSON `{ prompt (≤800 chars),
negative? }`. It **never blocks generation**: on any failure (HTTP error, or
unparseable JSON after 2 corrective attempts) it degrades to a deterministic
fallback prompt `${label} — ${context.slice(0,160)}. ${LF_VISUAL_IDENTITY}`.
Every final prompt (judged or fallback) exits through `finalizePrompt()`,
which appends the code-enforced `PICTORIAL_CLAUSE` (no text/letters/numerals),
and `mergeNegative()` always prefixes `BASE_NEGATIVE` — neither is trusted to
the judge.

`PURPOSE_GUIDANCE` (same file) is the per-role art direction handed to the
judge: the structural ROLE decides composition, so a thumbnail option tile and
a wide establishing scene are not the same picture. `PICTURE_PURPOSES` is the
closed set (`src/routes/pictures.ts` derives its `z.enum` from it, so an unknown
purpose is a 400 `VALIDATION_ERROR`), and every value MUST have a
`PURPOSE_GUIDANCE` entry — the `Record<PicturePurpose, string>` type makes that
a compile error, not a runtime hole.

Every purpose still obeys `LF_VISUAL_IDENTITY` unchanged — flat vector,
papaya/navy palette, complete background, ABSOLUTELY NO PEOPLE, no logos, no
text.

## The pictorial verifier — the mechanical no-text guarantee

Prompt engineering alone cannot make `qwen-image` text-free (its signature
strength IS text rendering): the first live v3 batch grew a fake wordmark on
a "lemonade stand" and engraved quoted denominations onto coins despite a
prompt demanding "absolutely no text". So `src/verify/pictorialCheck.ts` has a
vision model (`VERIFY_MODEL`, default `qwen-vl-plus`, same DashScope account)
look at the ACTUAL PIXELS of every fresh generation and answer: any readable
letters/words/numerals? (A bare `$` on a coin is acceptable iconography.)
On `has_text` the whole judge → generate pass re-runs (the judge is
nondeterministic, so each retry is a new composition), up to
`PICTUREGEN_VERIFY_ATTEMPTS` (default 3, 0 disables); exhaustion throws
`IMAGE_VERIFICATION_FAILED` and caches **nothing** (the consumer's icon
fallback covers the slot; a later retry regenerates fresh). A verifier
outage (`unavailable`) accepts the image unverified — never block generation
on the inspector. Judge hard rules complement it: never name denominations
(even quoted — they get engraved verbatim), never mention text-carrying props
(signs, banners, price tags, chalkboards, menus).

## Storage transcode — WebP before Depot

`qwen-image` serves ~900 KB 1024×1024 PNGs; `src/gen/transcode.ts` re-encodes
every fresh generation as **WebP** (`IMAGE_WEBP_QUALITY`, default 82) before
the Depot upload — measured −96.9% on the live corpus (888 KB median → 15–99 KB),
visually verified transparent at 1:1 on the most detailed image (2026-07-25).
Ordering is deliberate: the transcode runs AFTER the pictorial verifier (qwen-vl
always inspects the ORIGINAL PNG bytes, so WebP support in the vision model
never has to be proven) and BEFORE the upload (the WebP is what gets
content-addressed). On any encode failure the original bytes are stored
untouched with a loud `console.warn` — a paid generation is never lost to a
local encoder problem, and a systematic failure can't silently regress the
catalog to PNG sizes.

## The response status IS a retry instruction (the Forge contract)

Prism's HTTP status is not decoration — it is the instruction its consumer
obeys. `coursegen/src/providers/picturegen.ts` wraps every call in
`withTransportRetry`, and `ProviderHttpError` marks 429/5xx retryable and
every other 4xx terminal. So `src/routes/pictures.ts` maps the typed
`ImageError.code` deliberately:

- **Retryable → 502.** `IMAGE_TIMEOUT`, `IMAGE_RATE_LIMITED`,
  `IMAGE_PROVIDER_ERROR`, `IMAGE_DOWNLOAD_FAILED` — upstream was briefly
  unhappy; the same request later may well work.
- **Terminal → 422.** `IMAGE_BAD_RESPONSE`, `IMAGE_VERIFICATION_FAILED` — the
  provider answered and the answer was unusable, deterministically, for this
  request. Re-asking cannot change it.

**Cost of getting it wrong:** answering 502 for everything made Forge
re-request terminal failures. Its ladder is 4 attempts, and each attempt
re-enters the whole judge → generate → verify loop up to
`PICTUREGEN_VERIFY_ATTEMPTS` (default 3) — **up to 12 paid `qwen-image`
generations per target** for a result that can never differ. None of them
reach the run ledger either: Forge only records a picture it actually
received, so `FORGE_MAX_USD_PER_RUN` never sees that spend. A terminal answer
is not a run-killer — Forge logs the skip and the slot keeps its icon/text
fallback.

Rules when touching this: **the default is terminal.** A new `ImageError`
code that is genuinely worth retrying must be added to `RETRYABLE_CODES`
explicitly; anything not in that set — including the `IMAGE_GENERATION_FAILED`
catch-all for a non-`ImageError` throw, which is what a Depot-upload or
Vault-insert failure surfaces as — answers 422. And note `IMAGE_RATE_LIMITED`
goes out as 502, not 429: Forge's longer rate-limit ladder (6 attempts,
1s→60s, honouring `Retry-After`) only triggers on 429, so a rate-limited Prism
gets the standard 4-attempt ladder.

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

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
generation is keyed by `sha256(model size "STYLE_VERSION | purpose | scope |
label | context")` — for the four object-tile purposes the descriptor collapses to
`"OBJECT_TILE_STYLE_VERSION | object_tile | label"` (their deterministic
prompt depends only on the label, so purpose/context must not fragment the
key) — in `picture_assets` (UNIQUE `prompt_hash`) — the key hashes the
**REQUEST descriptor, computed BEFORE the judge**, never the judged prompt.
(The judge is an LLM: two identical requests craft two slightly different
prompts, so a prompt-keyed cache never hits — caught live on the first smoke
test.) The flow is hash → lookup → **HIT returns the stored row with zero
paid calls, judge included**; only a MISS judges + generates. Insert uses
PostgREST `resolution=ignore-duplicates` + re-select, so two concurrent
generations of the same request can't error or double-pay. This is the whole
reason the service exists ("optimizar consumo, no llamar APIs a cada rato").
`STYLE_VERSION` (service/pictures.ts) bumps ONLY on global look changes (a
bump = full paid catalog regeneration); failure-mode hardening instead deletes
the offending cached rows surgically. A purpose-scoped visual change may use a
separate discriminator: `OBJECT_TILE_STYLE_VERSION` invalidates only the four
object-tile purpose keys and leaves setting-based scenes as cache hits.

**Adding a `PICTURE_PURPOSES` value is cache-safe — never bump `STYLE_VERSION`
for one.** A non-tile `purpose` is a component of the hashed request descriptor,
so a new value can only mint keys nothing has stored; every existing asset keeps
its key and stays a HIT. Bumping `STYLE_VERSION` "to be safe" would re-pay for
the entire catalog to obtain byte-identical-looking art. The object-tile
purposes are the deliberate exception: they collapse to one `object_tile`
key component (same label = same paid request = one asset), so adding a
purpose to `DETERMINISTIC_OBJECT_TILE_PURPOSES`/`OBJECT_TILE_PURPOSES` merges
its keys into the shared tile keyspace instead of minting new ones.

**`scope` separates scenes; it must never reach tiles.** A SCENE depicts one
lesson's situation, so the caller's `scope` (`<course>/<lesson>`) is part of
its key. A TILE is the same drawing everywhere, so `scope` is dropped from its
key — letting it in would fragment "Limones" per lesson and re-bill the object
catalog once per lesson of the course, destroying the collapse this section
exists to protect. Both halves are pinned by tests in `pictureRoutes.test.ts`.

**Strengthening a defect-exclusion clause is also cache-safe.** Changing the
no-text/no-people language in `PICTORIAL_CLAUSE` or `BASE_NEGATIVE` does not
alter the intended visual identity; do not invalidate previously accepted art
just to make future generation more conservative. Only a look change warrants
a `STYLE_VERSION` bump.

**Object tiles are deterministic by design.** `item_card`, `option_card`,
`lesson_option` and `memory_card` bypass the art-director LLM and use a
single-object prompt: the literal object, centered and fully visible on a pure
white canvas that fills all four edges, rendered as a flat 2D animated
educational vector with clean geometric shapes, crisp contrast, soft rounded
forms and bright colors. The prompt is intentionally concise and does not
include product, brand or lesson context; a short exclusion clause and the
mechanical verifier handle text, logos, people, cards and backgrounds. Tiles
render at thumbnail size and must be visually parallel to siblings. Keeping
the tile path deterministic avoids the free-form expansion that can invent a
child holding/eating the object or text-bearing packaging. Wide scenes retain
the LLM director and may use a complete background scene. The 2026-08-02 flat-vector identity is a global
look change (`STYLE_VERSION=v7-qwen-image-max-flat-vector` and
`OBJECT_TILE_STYLE_VERSION=v8-qwen-image-max-object-white-flat-vector`), so it deliberately
invalidates earlier 3D-looking assets; future defect-exclusion-only changes do
not bump either discriminator.

## Provider decision — RESOLVED

**Image provider: Qwen-Image on DashScope, model `qwen-image-max`.** This
selection is explicitly authorized for the local canary. Gemini was discarded
— its image models are quota-0. `qwen-image-max` uses the synchronous
multimodal endpoint
`POST {IMAGE_API_BASE}/api/v1/services/aigc/multimodal-generation/generation`
with `{ model, input:{ messages:[{ role:'user', content:[{text:prompt}] }] },
parameters:{ negative_prompt?, prompt_extend:false, watermark:false, n:1,
size } }` and returns a temporary image URL in
`output.choices[0].message.content[0].image`. Legacy `qwen-image` and
`qwen-image-plus` retain the async submit → poll contract. Client lives in
`src/gen/qwenImageClient.ts` behind a narrow `generateImage()` seam — swapping
providers later means replacing that one module. Retries ONLY on 429/5xx
(jittered backoff 0.5–8s); everything else fails fast as a typed `ImageError`
(`IMAGE_RATE_LIMITED` / `IMAGE_PROVIDER_ERROR` / `IMAGE_TIMEOUT` /
`IMAGE_BAD_RESPONSE` / `IMAGE_DOWNLOAD_FAILED` /
`IMAGE_VERIFICATION_FAILED`).

**Production gate — current model evidence (2026-08-02):** the prior
`qwen-image` and `qwen-image-plus` probes ignored the object-tile canvas
contract, producing framed cards and colored surrounds; the verifier correctly
failed them. After the owner-authorized switch, `qwen-image-max` used its
synchronous endpoint and generated a single `Concha brillante` tile that
passed both the pictorial verifier and the deterministic edge-pixel white-
canvas gate. The bounded Forge pilot `fe-pilot-financial-20260802-max-live02`
then validated scenes, sibling consistency, localization, Depot URLs and cost
for one complete lesson. This remains a local `review` candidate, not a
production release: the operator must confirm the account tariff, configure
production variables and invoke the human release gate. The verifiers remain
mandatory.

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

Every purpose still obeys `LF_VISUAL_IDENTITY` unchanged — a clean, modern,
high-contrast educational vector language with deliberate geometric forms,
ABSOLUTELY NO PEOPLE, no logos, and no text. Object tiles use their strict
white/transparent-background exception; scenes use a complete setting.

### The style brief describes STYLE. It must never name a SUBJECT.

**Non-negotiable, and the most expensive rule in this file to relearn.**
`LF_VISUAL_IDENTITY` reaches every prompt of every purpose. Until 2026-08-14 it
ended with *"Cheerful lemonade-stand world: hand-made stands, jars of coins,
lemons, sunny neighborhoods."* — one sentence of CONTENT inside a style guide.
Whenever a label carried no concrete subject of its own, that sentence became
the subject, and the published financial-education catalog opened nearly every
exercise with the same lemonade stand, in lessons about markets, budgets and
fraud alike. The children who could not tell the exercises apart were the ones
who paid for it.

So, when editing the brief or `PURPOSE_GUIDANCE`:

- Describe line, colour, composition, materials, mood. Never a place, a prop
  set, or a scenario.
- Do not add "for example" subjects to illustrate a composition rule. An
  example subject in a brief that reaches every prompt is a default subject.
- The brief now states the rule positively (`SUBJECT DISCIPLINE: … carries no
  default scene of its own`). Keep that clause: silence is not a prohibition,
  and a generative model asked for a scene with no subject WILL invent one.
- The subject arrives in `label`, and callers are responsible for it being a
  real subject — see coursegen's `sceneAnchorSubject`, which derives the
  situation from the lesson's narrative instead of from its instruction text.

## The pictorial verifier — form AND subject

Prompt engineering alone cannot make `qwen-image` text-free (its signature
strength IS text rendering): the first live v3 batch grew a fake wordmark on
a "lemonade stand" and engraved quoted denominations onto coins despite a
prompt demanding "absolutely no text". So `src/verify/pictorialCheck.ts` has a
vision model (`VERIFY_MODEL`, default `qwen-vl-plus`, same DashScope account)
look at the ACTUAL PIXELS of every fresh generation and answer three
questions: any readable letters/words/numerals? any person/character? (A bare
`$` on a coin is acceptable iconography.) and — added 2026-08-14 —
**`depicts_subject`: does the picture actually show what was commissioned?**

That third question is the defect of CONTENT, and its absence is why the
lemonade-stand incident shipped: text and people are defects of FORM, and both
of the original checks pass happily on a beautiful, on-style illustration of
entirely the wrong situation. The service now sends `label` as the `subject`
and treats an explicit `false` as a defect. Two asymmetries are deliberate and
must survive future edits:

- The inspector is told to be **generous** — different framing, colours, extra
  props or a partial view all count as a match, and only a plainly different
  situation is a `false`. A false negative costs a paid redraw of a fine image.
- A **missing** answer (`null`) never blocks a `clean` verdict. Treating
  silence as failure would turn any quieter verifier into an endless paid
  redraw loop.

On `has_text` OR `has_person` OR `depicts_subject === false` the whole judge →
generate pass re-runs (the judge is nondeterministic, so each retry is a new
composition) with the exact defect fed back into the next prompt, up to
`PICTUREGEN_VERIFY_ATTEMPTS` (default 3, 0 disables); exhaustion throws
`IMAGE_VERIFICATION_FAILED` and caches **nothing** (the consumer's icon
fallback covers the slot; a later retry regenerates fresh). A verifier
outage (`unavailable`) accepts the image unverified — never block generation
on the inspector. For the four object-tile purposes a deterministic edge-pixel
checker also requires a white or transparent canvas: a gray/colored canvas,
white-card inset, border, frame, floor, or broad shadow is a defect. It avoids
asking a vision model to segment the colored object from its background. The
failure envelope states whether text, a person, a non-white background, a wrong
subject, or a combination exhausted the retries without exposing the vision
model's free-form prose. Judge hard rules complement it: never name denominations
(even quoted — they get engraved verbatim), never mention text-carrying props
(signs, banners, price tags, chalkboards, menus).

## Storage transcode — WebP before Depot

Qwen-Image serves ~900 KB 1024×1024 PNGs; `src/gen/transcode.ts` re-encodes
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

**Cost accounting:** every successful response includes `generated_images`; a
terminal error includes the same count in the internal-only
`x-picturegen-generated-images` header. Forge reserves Prism's configured
worst-case verifier redraw count before the request, then records this exact
number even when no usable URL exists. A cache hit reports zero. This is the
only way a visual budget remains true when Qwen produced pixels that Prism
must reject.

**Cost of getting it wrong:** answering 502 for everything made Forge
re-request terminal failures. Its ladder is 4 attempts, and each attempt
re-enters the whole judge → generate → verify loop up to
`PICTUREGEN_VERIFY_ATTEMPTS` (default 3) — **up to 12 paid `qwen-image-max`
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

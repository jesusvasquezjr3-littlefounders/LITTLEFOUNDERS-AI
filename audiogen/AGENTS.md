# AGENTS.md — audiogen (Echo)

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

Generates TTS audio for lessons (and wherever else the platform needs speech). Internal service — `x-internal-api-key` only.

## Provider decision — RESOLVED

**TTS provider: Qwen3-TTS (DashScope REST), model `qwen3-tts-flash`.** Owner
sign-off recorded in the audiogen build task; no longer OPEN. Client lives in
`src/tts/dashscopeClient.ts` behind a narrow `synthesizeSpeech()` seam (text,
voice, languageType → temporary WAV URL) — swapping providers later means
replacing that one module, not the narration/service layer above it.

Contract: `POST TTS_API_URL` with `{ model, input: { text, voice, language_type } }`,
`Authorization: Bearer TTS_API_KEY`. Response is read defensively —
`output.audio.url` OR `output.audio_url` — and any other shape is a typed
`TTS_BAD_RESPONSE` error. Retries ONLY on 429/5xx, jittered backoff 0.5–8s,
max 4 attempts; everything else fails fast without retry.

## Speech normalization (before synthesis)

`src/narrate/normalizeForSpeech.ts` is the last transform before text hits DashScope, run inside `extractNarratables` with the document locale in hand. It exists because the Qwen3-TTS API does NOT (verified against the Model Studio docs, 2026-07):

- **Localize or reliably read symbols.** `+ = % × ÷ $ /` are spelled out per locale BEFORE the call (`"5+5"` → `"5 más 5"` es-MX / `"5 plus 5"` en-US / `"5 mais 5"` pt-BR). The API has no symbol spec and no SSML, so this must happen in our text, not theirs.
- **Accept SSML / speed / pitch / pause tags** — `qwen3-tts-flash` has NO `speed`/`rate`/`parameters` field at all. Pacing is therefore controlled ONLY by punctuation (the one prosody lever the model documents); we preserve it and never send undocumented fields into the billed call.
- **Expose a per-call emotion field.** Emotion on `qwen3-tts-flash` comes from **voice selection** — a casting decision in the `TTS_VOICE_*` env, not code. (Style via `instructions` exists only on `qwen3-tts-instruct-flash`, and DashScope documents `instructions` as Chinese/English-only — unusable for our es-MX/pt-BR content.) The authored `emotion`/`action` fields drive the **frontend character rig**, not the TTS. To make voices warmer, recast the voice ids (the docs list child/playful voices: `Bunny`, `Pip`, `Momo`, `Bella`, `Sonrisa`).

`normalizeForSpeech` also drops **whole-parenthetical stage directions** (`"(con entusiasmo)"`, `"(smiles)"`) — a narrow, digit-free, curated-stem match, so meaningful asides (`"(5 pesos)"`, `"(limones, vasos)"`) are always kept. The real fix is author-side: a `write.ts` hard rule forbids stage directions in spoken text; this is the safety net.

- **Expand abbreviations, or read grammatically.** The API reads the RAW STRING: it has no abbreviation dictionary and no grammar model. Found by listening to real narration (2026-07-24): `"5 pesos c/u"` was heard as **"cinco pesos CE U"**, and `"Don Beto compró 1 vaso"` as **"compró UNO vaso"** (the counting word instead of the apocopated article). So the transform now runs five ordered stages — stage directions → abbreviations → ordinals → symbols → number agreement — with the tables in `src/narrate/speechLexicon.ts`:
  - **Abbreviations** per locale: `c/u` → `cada uno`/`cada um`/`each`, `aprox.`, `etc.`, `Sr./Sra./Dr.`, and units only when they follow a number and agreeing in number (`1 kg` → `1 kilo`, `5 kg` → `5 kilos`).
  - **Number agreement (es/pt)**: a number ending in 1 before a noun becomes the article — `1 vaso` → `un vaso`, `1 moneda` → `una moneda`, `21 vasos` → `veintiún vasos`, `1 copo` → `um copo`. Gender comes from an exceptions lexicon plus suffix rules; a wrong guess is a small grammar slip, never unintelligible audio. Every OTHER number keeps its digits on purpose — a child follows `"147 pesos"` better than `"ciento cuarenta y siete pesos"`.
  - **Currency agrees too**: `$1` → `1 peso`, never `1 pesos` (which the agreement stage would turn into the ungrammatical `un pesos`).
  - **Range vs subtraction is decided by SPACING**, the same convention a human reader uses: tight `3-5 pesos` is a range → `3 a 5 pesos`; spaced `8 - 3` is arithmetic → `8 menos 3`. Word hyphens (`e-mail`) are never touched.

## The regulator (`src/narrate/speechGuard.ts`) — nothing unspeakable reaches a paid call

`auditSpeechText` runs on EVERY unit inside `narrateLesson`, immediately before `synthesizeSpeech`. Normalization *expands* what a human would say; the guard *proves* nothing unspeakable survived and refuses the call if something did — a `block` unit is reported as a failure in the batch summary and costs nothing.

It is deliberately **deterministic, not an LLM**: a 1000-lesson course is ~15k units, so the regulator has to be free, instant and reproducible; an LLM at that volume would cost more than the TTS it guards. Every rule encodes a defect class we have actually heard, so a firing rule is a *normalization bug with a known fix* — extend `speechLexicon.ts`, never relax the rule. Blocking rules: slash abbreviations, residual `$ % + = × ÷`, digit glued to a word, unexpanded units/ordinals, missing number agreement, markdown residue, URLs. Warnings: vowel-less acronyms, stray acting cues, repeated punctuation.

**Calibrate rules against the LIVE corpus, not intuition.** Two rules were written from intuition and both false-positived on real content: the agreement rule refused `"(1 + 2)"` (arithmetic, not a count — it now skips injected symbol words), and the acronym rule warned on every all-caps EMPHASIS word (`NO`, `CRECE`, `NOT`, `NÃO` — it now fires only on vowel-less tokens, which are the only ones a TTS must spell out). Note also that plain `\b` is ASCII-only and split `NÃO` into a spurious `ÃO`; accent-aware rules need the `u` flag with `\p{L}` lookarounds. Current state: **693 real narration units across 62 lessons × 3 locales → 0 blocks, 0 warnings**, and `speechGuard.test.ts` pins the normalizer↔guard contract (everything the normalizer emits must pass the guard) so a future gap surfaces in CI instead of in a mass run.

## Invariants that bite here

- **Per-locale voices:** every audio asset exists for en-US, es-MX, pt-BR — same parity rule as text i18n (§1.8). `TTS_VOICE_EN_US`/`TTS_VOICE_ES_MX`/`TTS_VOICE_PT_BR` are the current defaults; a full `CharacterId × locale` voice map is a follow-up (README.md "Voice map").
- **Never reads answer keys.** Echo's repo layer selects only `document`/`audio` off `lesson_documents` — `answer` fields are never fetched, never sent to DashScope. Narratable fields are exactly `prompt_md`, the `story` family bodies, and `explanation_md` (LESSON_ENGINE.md §12) — nothing from `payload`/`answer` on graded types.
- Kid-safe output: generated audio for kids goes through the same moderation posture as text (§1.9); no minor PII in TTS requests — Echo only ever sends lesson content text, never user-identifying data.
- **Audio artifacts are stored in filebase** (`lesson-audio` bucket, `visibility: public`) — never hotlinked from the DashScope temporary (24h) URL. Echo downloads the WAV, transcodes, and re-uploads before anything is persisted.
- **Bulk paid-API runs are a BOUNDARIES action.** `AUDIOGEN_RUN_ON_START` defaults `false`; batch narration (`src/batch.ts`, `npm run narrate:all`) is operator-triggered, never automatic.
- Idempotent by `(lesson, locale, segment, text-hash)` — `contentHash(text, voice, model)` in `src/narrate/types.ts` is the reuse key; changing the voice or model invalidates the whole manifest by design (the audio would sound different).

## Dependency note

`src/db/lessonDocumentsRepo.ts` targets `database/migrations/0007_course_hierarchy.sql`'s
`lesson_documents` table — composite PK `(lesson_id, locale)`, no `id` column,
no SELECT RLS policy (service-role-only reads by design). Covered by
mocked-PostgREST tests only so far — see README.md "Dependency note".

## Read before touching

- `agent/core/CONVENTIONS.md` — app layout, envelope, test shape.
- `LESSON_ENGINE.md` §3 (document contract), §8 (MarkdownLite), §12 (what Echo consumes).
- `COURSE_ENGINE.md` §7 (Echo contract).

# agent/tools/content — repair published lessons without paying a provider

Built during the 2026-08-16 catalogue rescue, which rewrote 444 published lessons
and archived 220 for **$0 in provider spend** (verified: zero new `picture_assets`,
zero new `speech_assets`). Keep these if you ever touch published lesson content
again — the constraint they encode has not gone away.

## The constraint

`speech_assets.speech_hash` is sha256 over the NARRATED TEXT (migration `0015`).
Unchanged narration is a guaranteed cache hit; **one new narrated sentence is a paid
DashScope call**. Narrated fields are `prompt_md`, `explanation_md`, `hints[]`, the
story-family bodies, and the option roll-up of the seven choice types (`quiz_mcq`,
`picture_choice`, `best_decision`, `confidence_quiz`, `odd_one_out`, `yes_no_cases`,
`would_you_rather`) — editing ONE option label re-records all of them.

Everything else is free to rewrite: `answer_keys`, `options[].rationale_md`, icons,
titles, `meta.objectives`, the entire payload of every interactive type outside
those seven, plus deleting and reordering segments.

## `gate.ts` — the zero-spend gate

Rejects any repaired document that would cost money or break the contract. It
imports Echo's own `extractNarratables`, so its idea of "narrated" cannot drift from
what actually gets synthesised. Also enforces: three locales in lockstep (same
segment ids, same order), segments removed or reordered but never added or renamed,
≥5 segments and ≥2 graded surviving, non-empty objectives, and no answer key dropped
from a key-dependent type.

```bash
cd audiogen && ./node_modules/.bin/tsx ../agent/tools/content/gate.ts \
  <work-dir> <repairs-dir> [report.json]
```

Run from `audiogen/` — that is where `tsx` and the narration module's dependencies
resolve.

## `applyOps.ts` — deterministic edit-op applier

Agents emit **operations**, never rewritten documents, so a field nobody named
cannot be damaged. Ops: `delete_segment`, `reorder_segments`, `set_answer_key`,
`set_icons`, `set_field`, `set_meta`. Structural ops apply to all three locales at
once; text ops carry a per-locale `values` map. Each result is gate-checked before
it is written.

```bash
cd audiogen && ./node_modules/.bin/tsx ../agent/tools/content/applyOps.ts \
  <work-dir> <ops-dir> <out-dir> [report.json]
```

`<work-dir>` holds `docs/<lesson_id>.json`, each
`{ lesson_id, locales: { "es-MX"|"en-US"|"pt-BR": { document, answer_keys } } }`.

## `image-inventory.mjs` — measure image reuse

Counts distinct images, reuse across lessons, artless lessons, and image-critical
segments without pictures. **Measure distinctness, not presence** — a coverage
metric that counts presence reports 100% while every image is identical, which is
how one lemonade stand ended up on nearly every exercise.

```bash
node agent/tools/content/image-inventory.mjs <work-dir>
```

Gotcha it already fixes: match any key **ending** in `image_url`, not the literal
key — `memory_flip` uses `a_image_url`/`b_image_url`, and matching only `image_url`
undercounts the catalogue and wrongly reports those segments as artless.

## Getting a work-dir

These tools read exported documents, not the database. Export with a service-role
PostgREST read of `lesson_documents` (all three locales per lesson) into
`docs/<lesson_id>.json`. Credentials come from
`railway variables --service coursegen --json`, read in-process and never printed.

**Back up before writing.** `lesson_documents` keeps no history and a PATCH
overwrites in place — see RUNBOOK.md, "Restore lesson content after the 2026-08-16
catalogue repair".

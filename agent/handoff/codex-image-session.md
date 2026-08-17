# Codex session brief — lesson image assets

**Written 2026-08-16, after the catalogue repair.** Every number here was measured
against the 988 lessons that are live in production right now, not against the
pre-repair catalogue. The raw data is `image-inventory.json` beside this file.

---

## 1. What you are walking into

The catalogue was just audited and repaired at zero provider cost: 1,208 lessons
became **988 published, 220 archived**, and 444 documents were rewritten. Content
defects — wrong answer keys, internal contradictions, arithmetic errors, icons that
gave the answer away, and **720 dead image URLs** pointing at `placehold.co`,
`example.com` and a hallucinated `assets.rho.ai` — are fixed and verified live.

**Images are the one thing that pass deliberately did not touch.** That is this
session's job.

### You are the image path. Prism is not.

**Generate with Codex, on the existing ChatGPT subscription. Do not use Prism, and
do not settle DashScope to do this work.**

That is the whole point of this session. The previous catalogue generation cost
$1,586 and the owner's instruction is explicit: fix this without spending hundreds
or thousands with the provider again. Prism (`picturegen/`) routes to DashScope /
Alibaba Model Studio, which is currently in arrears anyway (every request returns
HTTP 400 `{"code":"Arrearage"}`) — but the arrears are **not the reason to avoid
it**. Cost is. Settling DashScope is a LATER decision, taken only if testing with
children shows the result is unsatisfactory.

Because you are generating outside Prism, this session owns three things Prism
normally handles: matching the visual identity (§3), uploading the bytes to Depot,
and writing the URLs into the documents (§4). None of it is hard, but none of it
happens automatically.

---

## 2. What actually needs art, in priority order

| Priority | Problem | Scale |
|---|---|---|
| 1 | One image reused across many lessons | **332 images → 470 lessons (48% of the catalogue)** |
| 2 | Worst individual offenders | 1 image serves **52** lessons; another **38**; **16 images serve 10+ each** |
| 3 | Lessons with no art at all | **37 lessons** |
| 4 | `picture_choice` rendering icons instead of pictures | 142 segments |

Total: 5,172 image slots over 4,121 distinct images — **1,051 redundant slot uses**.

**Start at the top of that list, not the bottom.** The reuse distribution is
extremely top-heavy: 185 images are shared by exactly 2 lessons (barely noticeable),
but 16 images are shared by 10 or more. Replacing the worst ~20 images removes most
of the "every lesson looks the same" feeling for a fraction of the work. Chasing all
332 is a much larger job for a much smaller perceived gain.

Priority 4 is a judgement call, not a defect: a `picture_choice` whose options carry
Material Symbols icons **renders correctly and is answerable**. It is simply not a
picture task. Treat it as an upgrade, never as a bug to be urgently patched.

---

## 3. The visual identity — this is authoritative, do not paraphrase it

`picturegen/src/judge/promptJudge.ts` → `LF_VISUAL_IDENTITY`. It has ALREADY been
corrected (the SUBJECT DISCIPLINE clause was added after a style brief that ended
with "Cheerful lemonade-stand world…" put a lemonade stand on almost every
exercise). **The current brief is right. Use it verbatim; do not rewrite it.**

Its non-negotiables:

- **Strictly two-dimensional flat educational vector.** Never 3D rendering,
  photorealism, clay/plastic materials, painterly shading, soft focus, or cinematic
  depth of field.
- **Zero text, letters or numbers in the image.** No logos, no watermarks.
- **NEVER DRAW PEOPLE OR CHARACTERS** — no person, face, hands, mascot, or cartoon
  character. Even when the label names Dina, Liruf, Rho or Zara, draw the OBJECTS
  and PLACE, not them: the app renders its own characters in a separate layer. A
  drawn human is a hard failure.
- **Palette:** papaya-coral accents, deep navy and soft blues, sunny yellows and
  fresh greens. Bright, never neon.
- **Single-object tiles** get a pure-white or transparent-looking background reaching
  every edge — no colored backdrop, inset card, border, frame, floor or shadow.
  Full contextual backgrounds are for wide scenes only.
- **The brief fixes the LOOK and never the CONTENT.** Draw exactly and only what the
  label names. Never substitute a generic cheerful scene for a subject that reads
  vague — that substitution is the exact bug that produced the lemonade stand.

There is a prompt-writing rule that is easy to miss and matters: **never write the
words person/people/human/child/face/hands/character inside the prompt string, not
even to negate them.** Text-to-image models fixate on whatever a prompt names, so
"no person" primes a person. Exclusions belong in a separate `negative` field.

One caveat on scope, stated honestly: I saw **one** photorealistic asset (a
suburban lemonade-stand photo) in **one** lesson, while every document is stamped
`v7-qwen-image-max-flat-vector+v8-qwen-image-max-object-white-flat-vector`. I did
**not** establish that photorealism is widespread. Verify before assuming it is.

---

## 4. How an image actually reaches a lesson

- **Bytes** live in Depot (`filebase/`, bucket `lesson-images`, content-addressed,
  public reads). Public URLs look like
  `https://media-b2c.littlefounders.ai/files/lesson-images/<sha256>.webp`.
- **Documents** reference them in fields whose key ENDS in `image_url`. Watch out:
  it is not always the literal key — `memory_flip` uses `a_image_url` / `b_image_url`.
  A sweep matching only `image_url` undercounts the catalogue and wrongly reports
  those segments as artless. (That mistake was made and corrected while writing this.)
- Documents also carry `illustration_style_version` (migration `0032`) so legacy or
  NULL rows cannot donate stale art through the inheritance/backfill path.
- `picture_assets` is **Prism's own request cache** (`prompt_hash` → asset). You are
  not going through Prism, so you will not be writing it. Leave it alone; it is also
  the table to count if you ever need to prove no paid image was generated.

### Uploading to Depot

Depot (`filebase/`) is content-addressed and takes a multipart POST. This is the
same call Prism makes — see `uploadFile(...)` used in
`picturegen/src/backfillWebp.ts`:

```
POST  $FILEBASE_URL/api/v1/files
Header: <internal key header>   ← FILEBASE_INTERNAL_KEY, service-to-service only
multipart/form-data:
  file       = <the image bytes>
  bucket     = lesson-images
  visibility = public
→ { data: { id, url, bytes }, error: null }
```

The returned `url` is the public `media-b2c.littlefounders.ai/files/lesson-images/…`
address you write into the document. **Prefer WebP** — the catalogue was converted
to WebP for a 96.9% size reduction, and Depot stores whatever you send it.

Get `FILEBASE_URL` and `FILEBASE_INTERNAL_KEY` from Railway
(`railway variables --service picturegen --json`); read them in-process, never print
them.

### Writing the URLs into documents

**Do not hand-edit documents.** Use the edit-op applier from the repair pass,
`applyOps.ts` (in this folder), which applies ops across all three locales and runs
them through the zero-TTS gate:

```json
{"op": "set_field", "segment_id": "s4-picture",
 "path": "payload.options[0].image_url",
 "value": "https://media-b2c.littlefounders.ai/files/lesson-images/<hash>.webp"}
```

Use `value` (not `values`) for image URLs — the same picture serves all three
locales, since a drawing with no text in it is language-independent. That is also
why one drawing costs one generation, not three.

Image fields are not narrated, so this work cannot trigger paid TTS — but run the
gate anyway: it also enforces locale lockstep and the structural floors.

---

## 5. Traps this project has already paid for

- **`--dry-run` did NOT mean "no spend"** on `images:backfill` — it meant "no Vault
  writes". Measuring nearly billed the whole catalogue. Verify zero spend by
  counting `picture_assets` rows before and after, with `Prefer: count=exact` and
  `Range: 0-0`.
- **Image price is `COST_QWEN_IMAGE_PER_IMAGE = 0.075`**, not the "~$0.02" written
  in a stale comment in `imageInheritance.ts`. Production runs `qwen-image-2.0`
  while the STYLE_VERSION strings are named for `qwen-image-max` — re-verify the
  rate for the model actually configured before quoting anyone a number.
- **A coverage metric that counts PRESENCE passes at 100% with every image
  identical.** `verify:course` now fails when one scene serves more than one lesson.
  Whatever you build, measure DISTINCTNESS.
- **A verifier that checks only FORM passes a beautiful picture of the wrong
  thing.** `has_text`/`has_person` both pass on a perfect rendering of entirely the
  wrong subject; `depicts_subject` was added for exactly this.
- **Batch every `in.(…)` hop, not just the last one.** 300+ uuids overflow Kong's
  request line (HTTP 414). The request-line limit (~150 uuids) is a different limit
  from the response limit (~100 rows).
- **`grep` silently returns zero on `gates.ts`** — very long lines make it treat the
  file as binary. Use `grep -a`.

---

## 6. Suggested shape for the session

1. **Pilot on ONE image before scaling.** Take the worst offender (52 lessons),
   generate one replacement, upload it, insert it into a single lesson, and look at
   it in the browser at `/dev/lesson-view` (dev-only route; drop exported documents
   into `frontend/public/dev-lessons/`, which is gitignored). Confirm it reads as
   the same product as the flat-vector art already there. Do not fan out until one
   image has survived a human eye.
2. Then take the top 20 offenders from `image-inventory.json` → `top_offenders`:
   ~20 images covering roughly 300 lesson slots.
3. Generate against `LF_VISUAL_IDENTITY` verbatim — **one distinct subject per
   lesson context**. Reusing one new image across the set you are fixing recreates
   the exact problem at smaller scale.
4. Upload to Depot, insert via edit ops, run the gate.
5. Re-run `image-inventory.mjs` and confirm the reuse counts actually fell.
   Presence is not the metric; distinctness is.
6. Only then consider the 37 artless lessons and the 142 icon-based
   `picture_choice` segments.

**Stop when the catalogue stops looking repetitive, not when the list is empty.**
The next real signal comes from children using the product, and that test is worth
more than the last 200 images.

---

## 7. Where this sits in the plan

```
✅ Lessons audited, repaired, curated      (done — 988 live, $0 spent)
→  THIS SESSION: images, generated by Codex on the ChatGPT subscription
→  Test with children
→  Only if that test disappoints: settle DashScope, re-record audio,
   and lift the pedagogical ceiling
```

The audio/TTS work and the DashScope payment are deliberately **after** the child
test, not before it. The catalogue's pedagogical ceiling is real and measured (24
clean lessons scored zero PREMIUM, capped by frozen narration), but nobody has
established that children actually hit that ceiling — production holds 4 rows in
`lesson_progress`. Paying to lift a ceiling no learner has touched is the same
mistake, in a new place.

## 8. What has NOT been decided, so do not assume it

- **A 202-lesson curriculum cut (988 → 786) is analysed and deliberately FROZEN.**
  Production holds **4 rows in `lesson_progress`** — no cohort has used the product,
  so the cut rests on prediction, not measurement. If it later goes ahead, art
  generated for those lessons is wasted. Prefer lessons that are certainly staying:
  the high-reuse offenders are spread across the whole catalogue, so weight the work
  toward lessons that are not on the frozen cut list (`final-cuts.json` holds the
  220 already archived; the frozen 202 is a separate, unapplied list in
  `curriculum-recommendation.json`).
- **23 pedagogical redesigns are validated but unapplied**, pending a decision on
  the TTS re-recording budget.

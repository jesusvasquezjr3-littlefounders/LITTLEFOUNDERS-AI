# Forge audit — 2026-08-01

> Scope: production-readiness audit of Forge (`coursegen/`) and its release
> boundary with Vault and Core, plus a design review against mature learning
> products and open-source authoring/taxonomy projects. This is an internal
> engineering and curriculum-design report, not a claim that an ungenerated
> course has been pedagogically certified.

## Outcome

Forge already has a strong generation core: curated catalog + canonical facts,
Zod contract validation, deterministic gates, independent review, frozen
localization, image/audio services, checkpointing, budgets, and generation
telemetry. The audit found five release-critical gaps, all corrected in this
change set:

1. A partial locale run could persist an unreleasable lesson. Both `generate`
   and `generate:track` now require exactly `en-US`, `es-MX`, and `pt-BR`, and
   `publishLessonSlot` repeats that assertion before any Vault write.
2. `verify:course` previously reran only a subset of deterministic checks and
   only after publication. It now accepts `review` or `published` lessons,
   reruns the full gate suite with the real tier/taxonomy/facts context, and
   records a fresh operational verification only when every check succeeds.
3. The admin publish action changed only `courses.status`, while learner
   visibility requires the whole hierarchy to be published. Vault migration
   `0031_course_release_gate.sql` replaces that false-release path with a
   service-role-only, row-locked, atomic release RPC. Core invokes it from the
   existing human Content approval and audits a successful release.
4. A visual-first course could still attest without every plan-eligible image.
   `verify:course` now uses the same per-type illustration plan as generation
   and rejects a release bundle with any missing planned target. A text-only
   `--no-images` pilot is therefore cheap and useful, but explicitly
   non-releasable.
   `--require-images` additionally validates Prism before the first paid author
   call and fails closed on an illustration error, so a full candidate cannot
   burn a text-generation budget before discovering that visual delivery is
   unavailable.
5. The local migration runner replayed historical SQL and could leave RLS
   half-mutated. It now records an immutable migration ledger, applies each
   new file atomically with its receipt, rejects drift and requires an explicit
   verified baseline for a legacy database.

## Follow-up — 2026-08-02

The visual contract was tightened after rendered-art review: Prism now uses
strict 2D flat-vector identity with pure-white edge-to-edge object tiles, and
Forge stores `illustration_style_version` (migration `0032`) so legacy or NULL
documents cannot donate stale art through the free inheritance/backfill path.
The same style bundle is required by `verify:course` for release-ready rows.

Production handoff is now explicit and auditable. The last recorded production
Vault state is migration `0011`; `database/scripts/railway-migrate.sh` provides
the only remote migration path for `0012`–`0032`, with no-write dry-run,
independently verified baseline, immutable checksums, one transaction per file,
and mandatory `--confirm-production`. Echo also distinguishes a successful
empty document result from a Vault failure, so an unavailable database cannot
be reported as an empty narration batch. Echo also now exposes a no-spend
`narrate:all --dry-run` preflight that counts pending units and estimates the
upper-bound TTS calls before a live audio batch is authorized.

[Post-audit correction, 2026-08-02: a read-only production probe verified
Vault at migration `0022` exactly — the "last recorded `0011`" above was a
stale ledger value, not the live state. With the repo now shipping
`0001`–`0033`, the unapplied delta `railway-migrate.sh` must apply is
`0023`–`0033`. The original text is preserved unchanged as the audit-day
snapshot.]

## Verification boundary

Forge type-check, lint, unit tests, build, contract parity, catalog checks and
the Financial Education competency-graph check all passed in this audit; the
graph contains 328 nodes (216 teaching, 112 retrieval) and 1,015 dependency or
retrieval edges with zero errors. Core type-check, lint, unit tests and build;
and Vault's static migration gate also passed. The local migration runner now
has an immutable checksum ledger and a verified `0031` baseline, followed by a
successful normal migration run with all 32 receipts recorded (including
`0032`). The new release
RPC returned both `NOT_FOUND` and a transaction-rolled-back `RELEASED` result.

The legacy `first-lemonade-stand` smoke corpus is intentionally not a release
candidate: its current verifier run proves 186/186 documents pass deterministic
gates and localization checks but identifies 9 missing planned visual targets.
The zero-spend `images:backfill -- --reuse-only --dry-run` pass inspected all
186 documents and found no safe object-art match, so it made zero Prism calls
and proposed zero writes. Those remaining targets require context-specific art;
they demonstrate that the release verifier blocks incomplete visuals rather
than silently accepting fallback icons. No paid repair was run.
Its portable local fixture now retains the matching draft/review hierarchy, so
an imported QA corpus cannot appear in the learner-facing published-course API.

## What research changes in the design

The target is not a longer sequence of trivia. It is a competency path in which
each lesson proves a small, reusable capability: a learner starts from a
concrete situation, receives brief instruction, practises with feedback,
applies the idea in a new context, and meets it again later through retrieval.
This matches Duolingo's explicit method and spaced-repetition work, and
Brilliant's structured learning paths rather than a free-form content feed.

- [Duolingo teaching method](https://blog.duolingo.com/duolingo-teaching-method/)
  and its [spaced-repetition research](https://research.duolingo.com/papers/settles.acl16.pdf): maintain short interactive steps, adapt to evidence of
  mastery, and schedule review instead of treating completion as retention.
- [Brilliant learning paths](https://brilliant.org/help/features/what-are-learning-paths/)
  and [educator progress tracking](https://brilliant.org/help/for-educators/can-i-track-my-students-progress-on-brilliant/): sequence foundations before
  transfer and expose evidence to the person responsible for the learner.
- Google's [Little Language Lessons](https://blog.google/products-and-platforms/products/education/little-language-lessons/)
  design: narrow contextual practice is a useful interaction pattern, but LLM
  outputs must remain bounded by structured contracts and independently checked.
- [Understand Anything](https://github.com/Egonex-AI/Understand-Anything)
  reinforces the useful architecture split: deterministic operations and
  incremental validation around model calls. [Marble's taxonomy](https://github.com/withmarbleapp/os-taxonomy)
  reinforces prerequisite graphs, but its content and license are not an input
  corpus for LittleFounders. [TRIBE v2](https://github.com/facebookresearch/tribev2)
  is neuroscience research, not a learning-platform dependency or production
  curriculum source.

## Production release protocol

1. A human-approved catalog passes `npm run catalog:check` and defines the
   lesson objective, prerequisite, fact anchors, age tier, review links and
   misconception-aware activity family.
2. An operator first runs a one-slot zero-cost dry-run, then a one-slot visual
   admission probe under a shell-scoped budget threshold. Every fresh image
   reserves its exact unit cost before the Prism request, and required visual
   mode admits the whole remaining target set at its worst-case redraw cost
   before the first image request. A small probe therefore fails before buying
   a partial unreleasable bundle; a complete visual lesson needs a separate
   human-approved cap sized to its target count. A provider-reported empty
   length response is logged before Forge retries, so the ledger includes its
   billable reasoning tokens. Only after reviewing its ledger, localized
   documents, art and provider readiness does the operator run the full paid
   track. Forge produces all three locales as `review`; it never self-publishes.
   A `--no-images` run may validate text but cannot be released.
3. An operator runs `npm run verify:course -- <slug>` after the last document
   update. The command must be fully green and persist its release attestation.
4. An admin makes the one human approval in Content. Vault then atomically
   verifies hierarchy, locale completeness, lesson status and attestation
   freshness before exposing the whole course. A failed precondition returns
   `409 CONFLICT`; it cannot create a half-published course.
5. Echo narration is a separately budgeted operator batch once production
   voices are available; it is not a substitute for the pre-release visual
   requirement. Any regenerated lesson returns to review and therefore
   requires a new complete verification and approval.

## Monitoring and improvement loop

Use the current staff surfaces as separate signals rather than a single opaque
“quality score”:

| Question | Existing evidence | Decision it supports |
|---|---|---|
| Did Forge generate a valid, complete course? | Generation Live/History, per-slot failure stage, rubrics, costs, cache and the fresh release attestation | Retry, repair the generator/gate, or block release |
| Does the lesson work at first use? | `/admin/insights` calibration, attempts, scores, hints and lesson drop-off | Fix a confusing interaction, example, feedback or difficulty step |
| Does learning persist? | `/admin/learning/retention` spaced-review decay rows and first-attempt review performance | Re-sequence retrieval, improve teaching, or replace a weak lesson |
| Does the path retain learners? | Insights cohorts, funnel, velocity, sessions and engagement | Find abandonment points without treating time-on-screen as learning |

These measurements remain first-party, closed-vocabulary and consent-gated for
kid telemetry. No free-text child input or minor PII is needed for the loop.
LLM-judge values are defect-finding clues, not a release score; deterministic
gates and observed learner evidence are the decision record.

## Remaining curriculum work before claiming “0 to 100”

The system is now materially safer to generate and release the first course,
but a production-ready *pipeline* is not evidence that all financial education
for ages 6–17 has already been authored or validated. The current catalog
defines child tiers through age 12. A truthful adolescent expansion needs a
human-reviewed competency graph and subject-matter sign-off before generation:

1. Define teen bands and non-negotiable outcomes (banking, budgeting, income,
   consumer credit, saving/investing, entrepreneurship, scams, taxes and
   financial decision-making) with jurisdiction-safe fact sources.
2. Attach each outcome to prerequisite edges, common misconceptions, transfer
   tasks, delayed reviews, and an age-appropriate safety boundary. Do not
   promote adult financial products or transactional advice as “practice.”
3. Pilot one saga per band with a small, consented evaluation cohort; predefine
   thresholds for comprehension, transfer, abandonment and delayed retrieval.
4. Version the catalog and release a replacement only through the same
   verify → human approval → atomic release protocol, preserving learner
   progress through existing `renamed_from` migration rules.

This makes the next bottleneck explicit: curriculum authority and empirical
validation, not another unconstrained model call.

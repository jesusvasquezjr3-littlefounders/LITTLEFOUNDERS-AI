# Forge owner-run generation runbook

Status: written 24 September 2026 (S05.4c). Owner: the product owner runs every step marked **paid**; Engineering keeps the commands and gates below working; the Pedagogical Reviewer signs Stage 3.

This runbook is **not an authorization to generate.** OD-17 keeps catalog regeneration blocked until the owner accepts the new Lesson Engine, and OD-23 forbids paid model, image or voice generation while the SPEC migration is being built. When the owner decides to run a paid step, this is the only supported procedure. Every paid entry point has a zero-spend rehearsal, and the rehearsal always comes first.

Sources: owner log OD-17 and OD-23; Product B.11, B.14, B.16, B.17, B.18, G.2; Appendix C Part 3 (Stages 0–6) and Part 1.3 (Forge Gate Pass Rate, Threshold Recalibration Log); [Regional Adaptation Gate](REGIONAL-ADAPTATION-GATE.md); sprint record [S05 Forge content gates](../rebuild/sprints/S05-FORGE-CONTENT-GATES.md).

## 1. What costs money

| Step | Command | Provider spend | Zero-spend form |
|---|---|---|---|
| Lesson generation (v1 documents) | `npm --prefix coursegen run generate -- --course <slug> …` | DeepSeek (write), Qwen (judge, fallback), Prism images | `--dry-run` |
| Whole-course track | `npm --prefix coursegen run generate:track -- --course <slug> …` | same, sharded | `--dry-run` |
| Illustration backfill | `npm --prefix coursegen run images:backfill -- --course <slug> --max-usd <n>` | Prism images | `--dry-run` or `--reuse-only` |
| Narration | `npm --prefix audiogen run narrate:all -- --course <slug> --max-usd <n>` | Qwen3-TTS (DashScope), priced per input character | `--dry-run` |
| v2 lesson documents | `npm run forge:v2:dry-run` | none: no live v2 authoring stage exists yet | the command itself |

Everything else in this runbook (content gates, verification, release) spends nothing.

**Enforced ceiling.** A paid `generate` refuses to start without `--max-usd <n>`, and a paid `generate:track` refuses without `--budget-usd <n>` (`coursegen/src/pipeline/spendGuard.ts`). The value is the ceiling the owner approved for this invocation. It only ever lowers Forge's scaled run budget, whose floors (`FORGE_MAX_USD_PER_RUN`, default $50) would otherwise let even a one-lesson run spend the whole floor. The run's ledger (`coursegen/runs/<run-id>/ledger.jsonl`) is replayed on resume, so the ceiling holds across restarts of the same `--run-id`.

Since OD-28 (owner review D-03, 27 September 2026) the same rule covers the two remaining paid tools, through the same refusal (`spendCeilingRefusal`; Echo carries a verbatim copy in `audiogen/src/spendGuard.ts`, kept identical by `agent/tools/spend-guard-parity.test.mjs`):

- **`images:backfill`** refuses any invocation that can pay Prism (neither `--dry-run` nor `--reuse-only`; for `--restyle-scenes`, also `--confirm-spend`) without `--max-usd <n>`. The ceiling binds in the ordinary add-only pass as well as in a restyle: the pass stops cleanly after the document that reaches it, at `COST_QWEN_IMAGE_PER_IMAGE` per generated image (default $0.075). It can overshoot by at most one document's images; re-running resumes, because filled slots are skipped. A `--dry-run` now runs reuse-only and never contacts Prism (before OD-28 it still drew, and paid for, the art it previewed).
- **`narrate:all`** refuses a paid run without `--max-usd <n>`. The ceiling is enforced per synthesis at `AUDIOGEN_USD_PER_1K_CHARS`, the provider's current price per 1,000 input characters, which the operator sets in `audiogen/.env`; there is no default, and a paid run refuses without it, because a guessed price would make the ceiling lie. A reservation that would pass the ceiling is refused and the batch stops, leaving the remaining lessons pending (exit 1, re-run to continue). `AUDIOGEN_MAX_TTS_CALLS_PER_RUN` still applies; whichever limit is reached first stops the run. The dry-run reports the estimated calls and their total characters, which is what the owner prices the ceiling from. The `AUDIOGEN_RUN_ON_START` batch needs `AUDIOGEN_RUN_ON_START_MAX_USD` for the same reason, or it refuses.

Planning numbers from the last measured live run (July 2026, before the S05.4 gates): about 104,000 tokens and $0.07 per published lesson including retries, plus $0.075 per generated image. Gates 11–16 add corrective retries whose cost is not yet measured; budget at least 2× until the first owner-run pilot measures it.

## 2. Preconditions (all must be true)

1. The owner has recorded the decision to generate for this course in the owner log or the sprint record, with the approved USD ceiling. OD-17's Lesson Engine acceptance is recorded before any **catalog regeneration**.
2. The target environment runs the S05.4c releases: Forge (per-gate attestation, no `keep-published`), Core (lesson approval through `release_lesson`), and the migrations `forge_release_gate_manifest` and `release_only_publication`, applied by hand in that order (both are `contract`; never auto-applied).
3. The course catalog declares what gates 14–16 need: `new_concepts` on every lesson (B.17), at least one validated `mentor_misjudgment` episode (B.11), and `regional_scenarios` wherever the gate requires them (B.16). `npm run content:gates -- --course <slug>` shows **no catalog-level blocking finding**. A Forge run skips an undeclared slot at zero spend, so an undeclared catalog is money spent for nothing.
4. Provider keys are set only in the operator's own `coursegen/.env` / `audiogen/.env`, never in a shared file or a command line.

## 3. Zero-spend rehearsal (always first)

```bash
npm run release:readiness -- <slug>      # every repo gate, content gates, parity gates and dry-runs
# or the Forge pieces alone:
npm run content:gates -- --course <slug>
npm run forge:release-gates:check
npm --prefix coursegen run generate -- --course <slug> --slots <ids> --dry-run
npm --prefix coursegen run generate:track -- --course <slug> --dry-run
npm --prefix audiogen run narrate:all -- --course <slug> --dry-run
npm --prefix coursegen run images:backfill -- --course <slug> --dry-run
npm run forge:v2:dry-run
```

Read the dry-run's skipped list: every skipped slot names the gate 14/16 declaration it lacks. Fix the catalog, not the gate.

## 4. Paid pilot, then the paid run

1. **Pilot first.** Run 3–5 slots on a local or staging Vault: `npm --prefix coursegen run generate -- --course <slug> --slots <ids> --run-id <pilot-id> --max-usd <small ceiling>`. Record tokens, dollars, retries per gate (the run log and `runs/<run-id>/`), and the per-gate first-submission pass rate. This is the first real data point of Appendix C's **Forge Gate Pass Rate (per gate)** and of the gates' retry cost.
2. **Full run.** Only after the owner reviews the pilot numbers: the same command over the approved slots, or `generate:track … --budget-usd <ceiling>`. Keep the same `--run-id` when resuming.
3. **Live lessons.** A run that touches an already-published lesson must pass `--on-existing-published demote-to-review`: the lesson leaves the learner catalog until it is released again. There is no in-place live swap (Product G.2). Plan the outage window with the owner.

Lessons land as `review`. Nothing a run writes is visible to a learner.

## 5. Stage 3 human review

1. `npm run content:gates -- --course <slug> --documents runs/<run-id>/checkpoint.json` (the path is relative to `coursegen/`) writes the itemized report to `coursegen/runs/content-gates/`. Blocking findings go back to Stage 1; they are never overridden.
2. The Pedagogical Reviewer works through every **review item**: tone items, concept counts above the target, every flagged mentor-misjudgment episode, and every market scenario, using the checklist in the [Regional Adaptation Gate](REGIONAL-ADAPTATION-GATE.md). The sign-off names the findings it addressed (Appendix C Part 2.1 "Reviewed").
3. Narration (paid, `narrate:all … --max-usd <n>` after its dry-run) and illustration backfill (paid, `images:backfill … --max-usd <n>`) happen on `review` lessons, before verification.

## 6. Verification and release

1. `npm --prefix coursegen run verify:course -- <slug>` evaluates every check in `coursegen/src/release/gateManifest.ts`, one result per id (Forge gates 1–9 and 11–16 on every document, the catalog policy and copy checks, release completeness, and the content of every activated v2 document). It writes the report to `coursegen/runs/verify-course/` and, only when everything passes, the attestation Vault requires.
2. Release from the staff console: **Publish** on the course (Core → `release_course`), or **Approve** on a single review lesson of a live course (Core → `release_lesson`). Both run one shared preflight: a fresh attestation newer than the latest document change and v2 activation, passing every id in `public.forge_release_gates`.
3. Refusals and what to do:

| Code | Meaning | Action |
|---|---|---|
| `RELEASE_VERIFICATION_REQUIRED` | No attestation, content changed after it, or content changed while `verify:course` was running (its content watermark is not current) | Wait for writers (Forge, Echo, image backfill) to finish, then run `verify:course` again |
| `RELEASE_VERIFICATION_INCOMPLETE` | The attestation misses or fails a required gate (an older Forge, a hand-written row) | Deploy the current Forge and run `verify:course` again |
| `RELEASE_COURSE_RELEASE_REQUIRED` | Single-lesson approval in a course or section that is not live | Publish the whole course |
| `RELEASE_INCOMPLETE_LOCALES` / `RELEASE_LESSONS_NOT_REVIEWABLE` / `RELEASE_INCOMPLETE_HIERARCHY` | Structural gaps | Regenerate or finish the missing content |

The local `db:publish-course` shortcut calls the same `release_course` and is local-dev only.

## 7. After release (Appendix C Stages 5–6)

- Copy the pilot and run numbers (tokens, dollars, retries per gate, per-gate pass rate from the verify-course report) into the sprint record's verification log.
- Any threshold changed because of what the run showed is recorded in the **Threshold Recalibration Log** of the sprint record, with its evidence.
- A defect found in released content that a gate should have caught is a **Defect Escape**: fix the content and review the gate.

## 8. Never

- Never write `course_release_verifications`, `lessons.status`, `courses.status` or `lesson_document_version_current` by hand. Vault refuses API-role writes that would publish, and a hand-written attestation that does not name every required gate fails the gate check. The database cannot tell a forged complete attestation from a real one, so the service-role key is the trust boundary: only `verify:course` writes attestations.
- Never raise `FORGE_MAX_USD_PER_RUN` to get past a budget stop without a new owner decision.
- Never run a paid step from CI, a shared machine account, or a script another person triggers.
- Never regenerate the committed corpus or the catalog while OD-17 is open.

## Known gaps (tracked in the sprint record)

- No live v2 authoring stage exists: the v2 emitter's plans carry fixture copy. A model-authored v2 plan stage and the reviewed v2 publication transaction (0101) are later work.
- `images:backfill` and Echo narration update the documents of already-published lessons in place. The recorded proposal is to demote first and release again. (Their missing owner ceiling was closed by OD-28; see §1.)

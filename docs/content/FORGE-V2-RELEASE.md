# Forge v2 release runbook (owner-run)

How a new-catalog v2 lesson goes from a Stage 0 skeleton to learners (OD-17, OD-23, OD-24). Nothing in this chain runs during the migration build except the dry runs; the paid step and the Vault write are owner-run.

The v1 `generate`, `generate:track` and `author-publish` commands are retired. They refuse before provider calls, configuration access or Vault writes, including with paid ceilings or production confirmation. This v2 chain is the supported lesson authoring and publication path; catalog regeneration and paid steps still require the existing owner decisions.

## 1. Author the copy (Stage 1)

```bash
cd coursegen
# Zero spend: answers from the committed plan, no model call.
npm run v2:author -- --skeleton src/v2/fixtures/plans/22-v2-first-release-mixed.json --out /tmp/authored.json --dry-run
# Paid (owner-run): DeepSeek, the same provider configuration as every Forge stage.
npm run v2:author -- --skeleton <skeleton.json> --out <authored.json> --max-usd <approved USD>
```

- A paid run refuses without `--max-usd` (`spendCeilingRefusal`) and runs under the usage ledger in the output folder; the ceiling only lowers `FORGE_MAX_USD_PER_RUN`.
- The model gets the brief, the skeleton's exact copy shape, the controlled glossary for all three markets (OD-11) and the tone and Copy Budget rules. Every draft is emitted and gated (gates 11-16); a blocked draft goes back with its itemized problems, at most two corrective rounds. A draft still blocked is not written.
- Appendix C Part 1.3 (Forge Gate Pass Rate per gate, first submission): every run, dry runs included, appends one line per market of the first draft (blocked or not) to `gate-submissions.jsonl` in the run directory, with `pipeline: "v2"`, the `lesson_id` as `slotId`, and the gates that draft failed (`evaluated: false` and gate 1 when the reply did not parse). Pass `--run-id <id>` to share `runs/<id>/` across an authoring batch; without it the log lands next to `--out`. The command prints that directory's per-gate first-submission pass rate, v1 and v2 lines apart. The retired v1 commands cannot start a new run.
- A plan may give a rubric per market (`rubric_by_locale`) when a market's scenario changes the answer (B.16, F-06); each market's answer keys are written from its own entry.
- **Writing skills and lesson design (pilot round 2).** `coursegen/src/v2/writingSkills.ts` builds the writing section of the authoring prompt from the same sources Forge v1 uses: the content playbook (`PLAYBOOK_RULES`, `PLAYBOOK_FORBIDDEN`, `FOLLOWABILITY_RULES`, with the Copy Budget numbers restated so rule 2 never contradicts them), the register lexicons for the lesson's age band, one voice card per Mentor, one style note per market, and the examples-first lesson arc. A segment may carry a plan-only `teaching_role` (`hook`, `pre`, `example`, `guided`, `practice`, `transfer`); it never reaches the emitted document. Gate 14 (`lessonDesign.ts`) checks the arc: a new concept needs examples before it is asked, at most two `pre` items, the last graded item is the `transfer`, a run of more than three example turns is reviewed (more than five blocks), and independent exercises above one per demonstration are reviewed (above two block). `npm run v2:emit -- --require-lesson-design` blocks a plan that names no role at all; without the flag, a plan with no roles is checked as before. Full method and results: `docs/content/FORGE-V2-PILOT-ROUNDS.md`.
- **Hierarchy and lesson ids.** `npm run v2:hierarchy` (zero spend, no database) turns a v2 structure file plus its plans into the Vault hierarchy rows and a reviewable seed SQL that ends in `ROLLBACK` (`hierarchy.rows.json`, `hierarchy.seed.sql`, `ids.json`). Ids are UUIDv5 over the slug path, so regenerating is stable. `npm run v2:hierarchy -- --check` exits 1 when the written files are stale: run it after any change to a plan's slug or title. `v2:publish --lesson-ids <ids.json>` rewrites each plan's slug `lesson_id` to its `public.lessons` uuid before the dry run or the write, so `document.lesson_id` equals `p_lesson_id`.
- **Horizonte segment types in a skeleton.** The skeleton fixes the segment types, so choosing a Horizonte type is a Stage 0 decision. The 18 packs register their types once in `coursegen/src/v2/horizonte/index.ts`; `coursegen/src/v2/fixtures/plans-horizonte/` holds one working plan per type (copy one as the skeleton: its payload, rubric and labels are the shape the model must fill). `v2:author` adds each used type's own authoring guidance (age band, what the prompt must never state, the labels it needs) to the system prompt, and `coursegen/src/__tests__/horizonte/guidanceCoverage.test.ts` fails if a registered type has none. A neutral-payload type keeps ids, enums and numbers in the payload; its learner text goes in `prompt`, `help`, `feedback`, `labels` and, for algebra boards, `notation.spokenText`.
- Zero-spend check of those plans: `npm run v2:emit -- --horizonte --out <dir>` then `npm --prefix backend run forge-v2:check -- <dir>/documents.json`. The root `npm run forge:v2:dry-run` runs both the shared plans and the Horizonte plans.

## 2. Check, verify and publish

```bash
cd coursegen
# Zero spend, no Vault write: emit, gates, Core's contract and interactive-behaviour check, then the calls it would send.
npm run v2:publish -- --plans <dir> --course <course-slug> --run-id <run-id> --out <dir> --dry-run
# Owner-run: the same, then verify:course and Vault's reviewed publication transaction per market.
npm run v2:publish -- --plans <dir> --course <course-slug> --run-id <run-id> --out <dir>
# Owner-run, when a document holds a Horizonte segment type (see below).
npm run v2:publish -- --plans <dir> --course <course-slug> --run-id <run-id> --out <dir> --core-has-horizonte
```

**Deploy order: Core first, then Forge.** The Core check in step 2 runs the Core source in this checkout, so it passes for a segment type the deployed Core does not know yet. An older Core answers 422 `UNSUPPORTED_LESSON` for a version that holds such a type: a new lesson stays unreachable, and a pending version that staff later release breaks a lesson that is already live. Every Horizonte type is new, so a Vault write (not a dry run) of a document that holds one stops at the Core check unless `--core-has-horizonte` confirms that the Core deploy is live. Deploy Core, then the browser, then publish.

The chain stops at the first failing stage:

1. **emit and v2 gates**: `emitV2Lesson` (structure, gates 11-16).
2. **Core check**: `npm --prefix backend run forge-v2:check -- <out>/documents.json`, Core's strict contract plus the interactive-behaviour gate over every permitted input state (reports its pass rate).
3. **verify:course**: the course attestation. For a lesson that is already published, Vault refuses a publication unless the course's verification is current.
4. **publish**: `publish_v2_lesson_version` (migrations `*_v2_reviewed_publication.sql`, redefined by `*_v2_staff_release_approval.sql`), once per market, with a manifest that attests exactly that document: its identity, gate 1 and gates 11-16 plus the v2 content gate, and Core's two checks. It inserts the immutable version and writes an `audit_logs` row with the document and answer-key digests. A version id is never reused; a direct pointer move on a published lesson stays refused.
   - **A lesson that is not live yet**: the current pointer moves (`forge.v2_lesson_published`). The lesson still reaches learners only through the staff release of the lesson (Content page, Lesson review, `release_lesson`).
   - **A lesson that is already live** (G.2): nothing a child sees changes. Vault records a pending activation request (`forge.v2_lesson_version_submitted`) and `v2:publish` lists it ("waits for a staff release"). A staff member with `manage_content` opens the staff console, Content, **Live updates**, and releases it (`release_lesson_version`: the course's Forge verification is checked again, then the pointer moves and the audit row `content.v2_version_released` names that staff member) or rejects it with a reason (`content.v2_version_rejected`). A newer submission for the same lesson and market supersedes an older pending one.

### The one retained bypass, and the 30-day retroactive check (G.2, Appendix N 1.2 and 2.3)

- **Emergency activation.** `emergency_activate_lesson_version(p_actor, lesson, version, p_justification)` activates a pending, Forge-attested version without the course verification. It is refused unless `p_actor` holds the superadmin role and the justification has 20-600 characters; both are stored in the audit row `content.v2_emergency_activation`. There is no console button for it: an operator calls it with the service role.
- **Owner patch of a live document.** A database-owner session (psql, a migration) that changes or deletes the document of a published lesson is refused unless it first runs `SET LOCAL lf.bypass_justification = '<why, 20-600 characters>'`; the text is stored in `content.live_document_patched`.
- **The retroactive check.** Every bypass opens a row in `content_retro_checks`, due 30 days later. `npm run content:retro-checks` (Forge) runs `verify:course` for each course with an open check; a complete, current verification closes the course's checks in Vault and records it (`content.retro_check_closed`). The Content page (Live updates) shows the Release-Verification Bypass Rate, the Justification & Retroactive-Check Completeness and every check; an overdue check fails `ops-job-watch.yml`, which opens or comments on the `ops-watchdog` issue.
- **The scheduled run.** `.github/workflows/content-retro-checks.yml` runs `npm --prefix coursegen run content:retro-checks` every Monday at 05:00 UTC (and on demand), so every bypass is verified within 7 days, leaving at least three more runs inside the 30-day window. It reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the Core service's Railway variables with the `RAILWAY_TOKEN` secret, like the other Vault-reading workflows. A failed verification, an open check with no course or an unreadable Vault fails the run and comments on the `ops-watchdog` issue with the command's output. Zero spend: `verify:course` makes no model call. `agent/tools/content-retro-checks-workflow.test.mjs` pins the schedule, the command and the notification.

After a publication the course watermark moves, so run `verify:course` again before the next course release.

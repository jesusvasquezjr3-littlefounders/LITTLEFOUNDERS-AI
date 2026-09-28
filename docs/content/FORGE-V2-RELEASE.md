# Forge v2 release runbook (owner-run)

How a new-catalog v2 lesson goes from a Stage 0 skeleton to learners (OD-17, OD-23, OD-24). Nothing in this chain runs during the migration build except the dry runs; the paid step and the Vault write are owner-run.

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
- A plan may give a rubric per market (`rubric_by_locale`) when a market's scenario changes the answer (B.16, F-06); each market's answer keys are written from its own entry.

## 2. Check, verify and publish

```bash
cd coursegen
# Zero spend, no Vault write: emit, gates, Core's contract and interactive-behaviour check, then the calls it would send.
npm run v2:publish -- --plans <dir> --course <course-slug> --run-id <run-id> --out <dir> --dry-run
# Owner-run: the same, then verify:course and Vault's reviewed publication transaction per market.
npm run v2:publish -- --plans <dir> --course <course-slug> --run-id <run-id> --out <dir>
```

The chain stops at the first failing stage:

1. **emit and v2 gates**: `emitV2Lesson` (structure, gates 11-16).
2. **Core check**: `npm --prefix backend run forge-v2:check -- <out>/documents.json`, Core's strict contract plus the interactive-behaviour gate over every permitted input state (reports its pass rate).
3. **verify:course**: the course attestation. For a lesson that is already published, Vault refuses a publication unless the course's verification is current.
4. **publish**: `publish_v2_lesson_version` (migration `*_v2_reviewed_publication.sql`), once per market, with a manifest that attests exactly that document: its identity, gate 1 and gates 11-16 plus the v2 content gate, and Core's two checks. It inserts the immutable version, moves the current pointer, and writes an `audit_logs` row (`forge.v2_lesson_published`) with the document and answer-key digests. A version id is never reused; a direct pointer move on a published lesson stays refused.

After a publication the course watermark moves, so run `verify:course` again before the next course release.

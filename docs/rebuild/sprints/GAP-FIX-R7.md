# Gap-fix round 7

Index of the seventh SPEC gap-audit round. Eight auditors read the whole SPEC against the merged tree and found 9 gaps. Four of the eight areas were clean: the Mentor, Family and Wallet, the owner decisions and the Frontend Bible. Six lanes fixed all nine gaps, each in its own worktree and branch (`codex/spec-<lane>`), merged one at a time into `codex/spec-migration-s02`. Each lane record holds the SPEC clauses, what was verified before fixing, what was built, the local verification and the owner questions. Status of every item: implemented and locally verified; not accepted, not released.

| Lane | Record | What it closed | Merge commit |
|---|---|---|---|
| Identity-site | [fix7identi0](gap-fix-r7/fix7identi0.md) | A.2, Appendix M 1.1 and 2.2(d): unconsented analytics on flagged sessions is measured from the event log (migration 0252) | `24874962` |
| Learning | [fix7learni1](gap-fix-r7/fix7learni1.md) | B.9, Appendix C 1.1: decision-journal coverage is instrumented, with a denominator (migration 0253) | `c744824f` |
| Learning | [fix7learni2](gap-fix-r7/fix7learni2.md) | Appendix C 1.3 and Stage 6: every defect escape opens an owned gate-effectiveness review (migration 0254); the v2 player honours the shared age scope (B.7, OD-16) | `9d54118a` |
| Learning | [fix7learni3](gap-fix-r7/fix7learni3.md) | Bible 05 §5, Appendix P Part 5: the M1, M7, M8 and M13 answers use the locale-aware number input; Forge logs v2 first-submission gate results (B.14, OD-24) | `c3eb5e7f` |
| Social | [fix7social4](gap-fix-r7/fix7social4.md) | Appendix J 1.4 and Stage 7, E.7, E.10, E.11: the Block E recalibration cadence and quarterly issue; S-08 enforced in the messaging register | `1042897f` |
| Staff-ops | [fix7staffo5](gap-fix-r7/fix7staffo5.md) | Appendix N and O Part 3 Stage 6, Appendix O 1.3, G.1, G.2, G.4, H.3, H.4, H.6, H.7: the Blocks G and H recalibration log, cadence gate and quarterly issue | `d1f738ce` |

Integration repair on the merged tree: `5ce7dd8f` (the Tier 1 change-record row for `mentorQuality.ts`; see [SPRINTS.md](../SPRINTS.md), "Final push").

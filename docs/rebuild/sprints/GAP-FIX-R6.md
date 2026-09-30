# Gap-fix round 6

Index of the sixth SPEC gap-audit round. Eight auditors read the whole SPEC against the merged tree and found 16 gaps. Ten lanes fixed all of them, each in its own worktree and branch (`codex/spec-<lane>`), merged one at a time into `codex/spec-migration-s02`. Each lane record holds the SPEC clauses, what was verified before fixing, what was built, the local verification and the owner questions. Status of every item: implemented and locally verified; not accepted, not released.

| Lane | Record | What it closed | Merge commit |
|---|---|---|---|
| Staff-ops | [fix6staffo5](gap-fix-r6/fix6staffo5.md) | H.4 (Block H non-negotiable): the watchdog now covers the family-data jobs and stalled erasures | `970b6ab4` |
| Learning | [fix6learni1](gap-fix-r6/fix6learni1.md) | Appendix C 1.3: a machine-checked Block B threshold log with a review cadence, the MN-03 register audit, B.19 | `6b309ae3` |
| Social | [fix6social4](gap-fix-r6/fix6social4.md) | The Bible audits reach the Settings age-correction and discoverable states (E.4, OD-3); the brand position follows OD-27 | `897b6c02` |
| Family | [fix6family3](gap-fix-r6/fix6family3.md) | D.3, D.5, OD-3 Option B: the Tutor sees a child's pockets, month and coin history on the Wallet | `b6583ba9` |
| Data platform | [fix6datapl6](gap-fix-r6/fix6datapl6.md) | H.2: the warehouse raw-event copy is bounded to 400 days; OD-9 4.2: the autonomy events are gated by practice consent | `75ed51bc` |
| Mentor | [fix6mentor8](gap-fix-r6/fix6mentor8.md) | C.17 / OD-26: the controlling-language gate in both arms; the Appendix D 3.7 equity-drift audit (C.18, C.20); the Block C threshold cadence | `8127760b` |
| Learning | [fix6learni0](gap-fix-r6/fix6learni0.md) | B.20, Bible 02 §9.2: every v2 feedback banner names what was done right; Forge gates 13, 18 and 19 run on v2 | `b973ad4f` |
| Staff-ops | [fix6staffo9](gap-fix-r6/fix6staffo9.md) | Bible 02 rule 23, OD-24, G.2: staff review plays v2 lessons in the rebuilt view; H.3: an alert reaches a human or fails the watchdog | `5f91b14f` (sync `ceab9431`) |
| Identity-site | [fix6identi7](gap-fix-r6/fix6identi7.md) | A.1, A.5, Appendix M 2.1 criterion 2: a staff revocation ends the Tutor's powers; the Block A recalibration log | `b264c905` |
| Learning | [fix6learni2](gap-fix-r6/fix6learni2.md) | Appendix C Part 3 Stage 3, B.23, B.24, G.2: a recorded pedagogical review gates every release | `de61b766` (sync `1eabe9f0`, migrations renumbered to 0248–0250) |

Integration repairs on the merged tree: `0b5386d8` (five real failures; see [SPRINTS.md](../SPRINTS.md), "Final push").

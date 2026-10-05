# Dark-pattern and shame-signal audit

Status: procedure, checklist and automated gate implemented in S05.3f (24–25 September 2026). The Financial Education V2 release audit was completed and signed on 5 October 2026. Record: [S05.3f](sprints/S05-LEARNING-EXPERIENCE.md#s053f-registers-no-shame-and-resolution-efficiency-b23-b25-b26-b27-b28). Policy for the shame, family-finance and register rules this audit also checks: [LEARNER-REGISTER-AND-WELLBEING-POLICY.md](LEARNER-REGISTER-AND-WELLBEING-POLICY.md).

## Why

Product `10` B.25: a product whose promise is safety for children cannot assume good intent produced a clean result. Radesky et al. (2022, *JAMA Network Open*) found about 80 percent of the children's apps they studied used at least one manipulative design pattern, and named PBS KIDS as a zero-manipulation benchmark (Appendix B §3.6). The target here is the same: **zero manipulative patterns**, scored per release (Appendix C Part 1.2, "Dark-Pattern Audit Score").

## When and who

- **Every release candidate**, before `npm run release:readiness` (which runs the gate with `--release`), and **quarterly** in the first year regardless of releases. A release audit older than 45 days does not count.
- **Pedagogical Reviewer** (Appendix C Stage 3) leads, with Product. Engineering runs the automated half and prepares the record, but an engineering pre-audit is never a release audit.
- **OD-5:** any future paywall or upgrade flow passes this audit before it ships.

## The checklist

Items marked *automated* are enforced on every `npm run spec:check` by `agent/tools/check-dark-patterns.mjs`; the reviewer still confirms them in the walkthrough. *Manual* items are the reviewer's. The categories follow Appendix B §3.6's summary of the Radesky et al. taxonomy (the SPEC names five categories and gives disguised ads, forced continuity and social pressure as examples), extended with B.22, B.26 and B.27. **Open item:** the reviewer reconciles these items against the study's own coding manual at the first release audit and records any category this list misses.

| ID | Category | Method | Check |
|---|---|---|---|
| DP-01 | Fabricated time pressure | automated | No countdown, timer, expiry-urgency or hurry copy on any learner or parent surface. An honest expiry notice ("the link expires in 30 days") is a disclosure, not pressure. |
| DP-02 | Parasocial relationship pressure | automated | The Mentor never pleads, misses the learner, or is sad or disappointed about them leaving. |
| DP-03 | Navigation constraints and forced continuity | automated | Every rebuilt dialog closes (Escape and a close control); nothing autoplays or advances into another screen or lesson on a timer. |
| DP-04 | Lures to purchase or to watch advertising | automated | No purchase, upgrade, premium, unlock-now or watch-an-ad lure (OD-5: no paywall exists). |
| DP-05 | Social pressure and comparison | automated | No comparison with other people, no leaderboard or rank for a learner; comparison only with their own history. |
| DP-06 | Randomized rewards | automated | No variable-ratio or mystery reward (B.22: `npm run rewards:check`, Forge gate 17). |
| DP-07 | Loss aversion | automated | No lives, hearts or other depleting resource; streak copy never threatens a loss (OD-1, B.21). |
| DP-08 | Confirmshaming | automated | Declining any offer is neutral: no shame, guilt or trait language on a decline or dismiss. |
| DP-09 | Nagging | manual | No streak-at-risk, come-back or repeated re-engagement notification or email to a learner. |
| DP-10 | Disguised advertising | manual | No third-party advertising, sponsored content or product placement anywhere a learner can see. |
| SH-01 | Shame language | automated | No self-global or trait language in any error, miss, failure or low-score state (B.26). |
| SH-02 | Non-verbal shame signals | automated | A miss is never red, never a sad or disappointed character and never an error sound (B.26). |
| SH-03 | Comparative display tied to a miss | automated | No rank, leaderboard or peer-visible result changes because of a miss (B.26). |
| FF-01 | Family financial circumstances | automated | No copy, prompt or content implies a family's real money is a personal or moral failing (B.27). |
| MN-01 | Reviewer walkthrough | manual | A reviewer walks every learner, Tutor and teen flow in the three locales against this checklist, including states the scanner cannot see. |
| MN-02 | Time pressure inside lesson content | manual | Timed drills in lessons are reviewed: a timer never costs the learner anything they cannot retry. |
| MN-03 | Age register | manual | The registers stay distinct (B.23): Appendix C's Age-Band Register Differentiation Audit. |

## What the gate checks

`node agent/tools/check-dark-patterns.mjs` (inside `npm run spec:check`):

1. **Copy.** Every string in the three locales' i18n files, the rebuilt UI's string literals (lesson-content fixtures excluded: Forge gate 18 reviews content), Core's family-bridge and guardian-narrative catalogs, and the Mentor's scripted lines, against the policy's universal lexicons: self-global shame, trait praise, family-finance moralizing, loss mechanics, time pressure, parasocial pressure, purchase lures and social pressure, in English, Spanish and Portuguese.
2. **Structure of the rebuilt UI.** No countdown or `role="timer"`, no autoplay, no timed navigation, every `role="dialog"` handles Escape and has a close handler, no leaderboard or ranking, no lives or hearts, no sad or disappointed character state, and no CSS rule for a miss, retry or review state that uses the error hue.
3. **The live lesson player.** The session never spends or reads lives, the header renders no lives counter, the lesson lab offers none, no lives string exists in any locale, and a miss never plays an error sound.
4. **The record.** `docs/rebuild/audits/dark-pattern-audits.json` must give every checklist item a result (`pass`, `fail`, `open`, `not-applicable`) and evidence in every audit. With `--release` (inside `release:readiness`), the latest `release-audit` must be signed by a named person, no older than 45 days, and have no `fail` or `open` item.

The gate's tests (`node --test agent/tools/check-dark-patterns.test.mjs`) include red-team samples for every automated rule.

## How to run an audit

1. `npm run dark-patterns:check` and `npm run rewards:check`; both must pass.
2. Walk every learner flow (a parent-created child, an independent teen, an adult learner), every Tutor flow and the public surfaces, in the three locales, light and dark, on a phone width. Look for what a scanner cannot see: imagery, motion, timing, what happens after a decline, what a notification or email says.
3. Add an entry to the record with `"kind": "release-audit"`, the release or commit in `scope`, a result and evidence for every item, and `signed_off_by` (a person, not a role).
4. Score it: Appendix C's Dark-Pattern Audit Score is the count of failing items, target zero. Any `fail` blocks the release. Any finding in released content also counts as a defect escape (Appendix C Part 1.3): ask why a gate did not catch it, not only how to fix it.

## Audit log

| Date | Kind | Scope | Pass | Fail | Open | Signed |
|---|---|---|---|---|---|---|
| 2026-09-24 | Engineering pre-audit | S05.3f lane: rebuilt UI, live lesson player, i18n copy, Core family catalogs, Mentor scripted lines, Forge gates | 12 | 0 | 5 | no |
| 2026-10-05 | Release audit | Financial Education V2 at `bf63dbd0`: 112 lessons, 336 localized documents, rebuilt product surfaces and Mentor stage | 17 | 0 | 0 | Jesús Vásquez Jr. |

Findings of the pre-audit, all fixed in S05.3f: the live player's lives counter and early lesson end (DP-07), the wrong-answer error buzzer (SH-02), and trait praise on the live result screen (SH-01). Open for the reviewer: DP-09 and DP-10 (engineering found no learner notification path and no advertising code; a person confirms), MN-01 (the walkthrough), MN-02 (the 20 percent timed-drill reduction was removed by OD-28 in W2L.4; the manual review of timed drills remains) and MN-03 (the first quarterly register audit).

The 5 October release audit closed all five manual items. Its supporting browser run covered 770 states in three locales, two themes and up to four widths (110,808 audited configurations) with no visual, JavaScript or media finding; the dedicated Mentor-stage verifier passed all 257 configurations.

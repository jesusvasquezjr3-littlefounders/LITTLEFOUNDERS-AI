# Parent coaching in the Family Hub

**Status:** Product 10 D.23, built by Engineering (S07.7, 2026-09-24). The twelve monthly tips are drafted from Appendix G and **are not sent** until the Pedagogical Lead reviews each one (the SPEC's "reviewed by the Pedagogical Lead before send"). Nothing here is accepted.

**Why.** Appendix G §1.1 (Gudmunson & Danes 2011): what children absorb from how the family handles money day to day often weighs as much as any deliberate mechanic, and it runs through the parent's own visible behaviour inside the Family Hub. Investing in the parent is at least as valuable as polishing the child's surfaces. The brand calls the parent the hero; the product offered controls and no coaching.

## The three parts (Appendix H's Definition of Done for D.23)

### (a) Guidance inside the controls, not in a help article

- **Chore composer** (Tasks): "Pricing tips" opens three lines next to the choice between a family contribution and a bonus task (D.10, Appendix G §1.2): everyday help unpaid or a coin or two; bonus tasks priced by effort and time, prices kept steady; pay what you promised, when you promised it.
- **Spending limit** (the Tutor's Banking page): "Setting a limit": tell your child why the limit exists; look at it together as they grow (§2.5: structure with a rationale, not unilateral control).
- Component: `frontend/src/rebuild/family/CoachingNote.tsx`. Static copy, nothing recorded.

### (b) The reflective prompt at the moment of decision

Before every Tutor decision on a chore, a reward request, a level request or a self-directed item (a yes or a "not yet"), the decision surface asks: "What would you tell {name} about this?" (§4.2). It comes before, and apart from, the reason the child reads (D.18).

- What the Tutor writes stays in their browser. They may send it as their note on a yes, or use it as the reason for a "not yet" (then the reason form still requires it to be actionable); otherwise it is discarded.
- Only the kind is sent and stored: `written`, `shared` or `skipped` (`family_decision_reflections`, no text column).
- Core requires it on every Tutor decision route (`REFLECTION_REQUIRED`) and records it right after the decision; a decision is never lost because the record failed.
- Measured: the prompt's fired rate, `GET /api/v1/admin/family/coaching-reflections` (target 100% of Tutor decisions; the split between written, shared and skipped is Diagnostic).

### (c) A monthly tip, reviewed before it is sent

- One tip per Tutor per month, on the Family and Tasks screens (`CoachingTip`), never the same tip twice until every reviewed tip has been shown. Its research basis sits behind "Why it helps" and says "A finding, not a promise" (Block D Part 4).
- The registry `docs/operations/parent-coaching-tips.json` lists each tip, the Appendix G sections and the finding it comes from, its status and its review.
- Only reviewed tips are passed to the database, so an unreviewed tip can never be delivered: Core's `COACHING_TIPS` marks a tip `reviewed: true` only when the registry records an approval whose hash matches the exact copy in all three locales. `agent/tools/check-parent-coaching-tips.mjs` fails on any mismatch, including copy edited after its review.
- Measured: Appendix H's Parent-Coaching-Tip Delivery & Engagement Rate, `GET /api/v1/admin/family/coaching-delivery?period=YYYY-MM`: (a) delivered to eligible Tutors (a verified Tutor active that month), trend toward 100%; (b) opened, Diagnostic. The answer also says how many tips are reviewed, so "nothing delivered" and "nothing reviewed yet" are told apart.

## How the Pedagogical Lead reviews a tip

1. Read the tip (title, body, why) in en-US, es-MX and pt-BR (`frontend/src/i18n/<locale>/familyGovernance.json`, `tips.<id>`) against its finding in the registry and the cited Appendix G section.
2. If it needs changes, change the copy first (the copy budget and tone gates still apply).
3. Run `node agent/tools/check-parent-coaching-tips.mjs --hash <id>`.
4. In one change: set the tip's `status` to `approved` with `review: { "by", "role": "Pedagogical Lead", "at", "hash" }` in the registry, and `reviewed: true` for that id in `backend/src/services/parentCoaching.ts`.
5. The gate confirms. The tip goes out from the next month's delivery.

A reviewed tip whose copy changes later stops being sendable until it is reviewed again.

## The tips (drafts)

| Id | Appendix G | Finding |
|---|---|---|
| contribution-vs-bonus | §1.2 | Paying for an already-enjoyed activity reduced later free engagement; expected contribution versus paid extra work |
| price-by-effort | §1.2, §2.4 | A stable, legible price for extra work |
| keep-promises | §1.3 | Children wait less after an unreliable adult; waiting is rational only where it pays |
| explain-the-no | §4.5 | Parental knowledge comes mostly from the child's own disclosure; control reduces it |
| ask-their-view | §4.2 | Reciprocal money talk predicts preparation for independence |
| money-talk-at-home | §1.1 | Unintentional socialization weighs as much as deliberate teaching |
| after-a-goal | §2.3 | Effort slows right after a reward (post-reward resetting) |
| limits-with-reasons | §2.5, §4.1 | Rules with rationale are internalized |
| grow-their-say | §4.3 | Gradual independence beats abrupt independence |
| spending-is-not-failing | §1.3 | An immediate spend can be rational |
| share-for-real | §1.4 | A Share pocket that goes nowhere is symbolic |
| bonus-is-not-interest | §2.4, §3.5 | Adults misjudge compound growth; the bonus teaches no compounding |

## Open

- The Pedagogical Lead's review of the twelve tips (until then the monthly tip reaches no one, by design).
- Native review of the copy in es-MX and pt-BR.
- A delivery channel outside the app (for example a monthly email) is a proposal needing the owner's decision and consent design; in-app delivery reaches only Tutors who open the Family Hub, which the delivery metric makes visible.
- Appendix H Stage 5: do Tutors find the reflective prompt helpful or a hurdle?

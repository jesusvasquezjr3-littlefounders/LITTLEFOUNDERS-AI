# Owner review queue: answers (27 September 2026)

The project leader answered all 132 items of the [owner review queue](OWNER-REVIEW-QUEUE.md) on the review page and clarified the open alternatives in chat on 27 September 2026. The binding consequences are recorded in the owner decision log as OD-24 to OD-28. This file is the per-item record: each answer, and where an alternative was chosen, exactly what it means. Implementation status is tracked in [the sprint register](SPRINTS.md).

Totals: 108 approved defaults, 22 alternatives, 2 discussed. An approved default is now a confirmed decision rather than a proposal.

## Decide first

| ID | Item | Answer | Decision |
|---|---|---|---|
| D-01 | Every existing course's next release is refused until its content is re-verified or rewritten | Alternative | Legacy lesson content is removed after the migration and replaced by a new catalog; every earned record is kept and completed legacy topics credit the matching skills on the shared graph (OD-24). |
| D-02 | Regenerating a lesson that is already live takes it offline until it is released again | Approve | Default confirmed: Yes. The in-place swap is removed. |
| D-03 | Owner spending ceiling on the remaining paid Forge tools | Approve | Default confirmed: Proposed, not yet built. Today those two tools run without a ceiling. |
| D-04 | Live Mentor generation is suspended from the first deploy until the judge is calibrated | Approve | Default confirmed: Suspended until calibration. |
| D-05 | The release-readiness check fails until both leads sign the Tier 1 records | Approve | Default confirmed: Blocking, following the SPEC: no Tier 1 item ships without explicit sign-off. |
| D-06 | Accept the B.6 learning-pathway policy (OD-22) | Approve | Default confirmed: Built behind the switch COURSE_PATHWAY_ENGINE, set to linear. Deploying changes nothing a learner sees. The new engine turns on only after (1) you accept the policy, (2) the B.6 migrations are applied, and (3) an operator sets the switch to pathway. Switching back to linear is the rollback. |
| D-07 | When do old public share links stop being issued (the F.1 cutover instant)? | Approve | Default confirmed: 2026-09-24T00:00Z. |
| D-08 | A new daily production job, plus the other recurring jobs the questions mention | Approve | Default confirmed: Included in the lane. It will start on push. |
| D-09 | Existing savings-bonus rules for children under 13 are reframed, and some are switched off | Approve | Default confirmed: Rules below 10% are switched off, pending the Tutor's yes. The previous rate is kept so the Tutor's screen can say what changed. |
| D-10 | Best scores stored as 100 on the new v2 lessons | Approve | Default confirmed: Keep them at 100 (per the S05.3d record). |
| D-11 | Account-deletion grace period and completion deadline (E.6) | Approve | Default confirmed: 14 days of grace and a 48-hour deadline. Guests and self-registered under-13 accounts are erased at once. |
| D-12 | Legal wording about deletion and backups | Approve | Default confirmed: Unchanged. No legal text was edited. |
| D-13 | Deletion is held while a safety review is open | Approve | Default confirmed: Hold the erasure. |
| D-14 | Who is told when a teen deletes their own account | Approve | Default confirmed: (a) No email is sent. (b) The policy says notify only, once linking exists. |
| D-15 | How long social data is kept (E.11) | Approve | Default confirmed: (a) The windows above, enforced by the daily social-retention.yml sweep. (b) Audit entries are kept indefinitely until you decide. |
| D-16 | Follows approved by a former guardian are removed | Approve | Default confirmed: Remove them. |
| D-17 | How long Family Hub data is kept (D.21) | Approve | Default confirmed: As listed, enforced nightly by family-retention.yml. |
| D-18 | How long Mentor data is kept | Approve | Default confirmed: 365 days; 400 and 90 days. The 365-day purge runs in the nightly tutor-retention.yml. |
| D-19 | Can adults outside a teen's family send the teen connection requests? | Approve | Default confirmed: They may send a request, and the teen decides. Limits apply: a 20-request cap, a 30-day cooldown and the E.3 pattern trigger. |
| D-20 | The Mexican word "pelado" triggers the adult-content response | Approve | Default confirmed: Fail closed. Mexican children still hit this false positive. |
| D-21 | Wider abuse-disclosure detection stops the session | Approve | Default confirmed: Keep the wide scope. |
| D-22 | Should analytics staff see per-child family-engagement rows? | Approve | Default confirmed: Per-child rows are shown, under those conditions. |
| D-23 | May staff read Tutor-written denial reasons? | Approve | Default confirmed: Built. Staff with view_analytics score a random sample, only for children the H.1 analytics gate admits. |
| D-24 | Judge calibration runs, the human panel and the paid bias audit | Approve | Default confirmed: Nothing has run. No panel is named. Coverage counts the judge as not covered. |
| D-25 | One-time voice-clip synthesis (small paid text-to-speech calls) | Approve | Default confirmed: Not generated. For (c), the two narrated sentences keep their old verdict wording until regenerated. The reframed texts are in frontend/src/rebuild/learning/placementOutcome.ts. |

## Learning pathway (B.6 policy)

| ID | Item | Answer | Decision |
|---|---|---|---|
| P-01 | Early entry for 12-year-olds | Discuss | Legacy teen chapters retire with the legacy content (OD-24); early access follows the OD-25 rule. |
| P-02 | Adults using the teen chapters as a bridge | Approve | Default confirmed: Yes. It is reported as a content gap. |
| P-03 | Strong mastery and the minimum age | Alternative | One stage up only, never adult chapters for a minor; every prerequisite skill mastered on the shared graph plus the learner confirms (OD-25). |
| P-04 | Mentor mastery and topic completion | Alternative | Mentor mastery may complete a topic, but only after the learner accepts a prompt such as "You have shown mastery of X; unlock the next level?" (OD-25). |
| P-05 | Credit when moving into a new stage | Approve | Default confirmed: No. The new stage's entry placement decides. |
| P-06 | The two content-gap skills | Approve | Default confirmed: Write new topics. |
| P-07 | The 63 order conflicts | Approve | Default confirmed: Yes. Until then, the authored order decides what is locked. |
| P-08 | Prerequisite courses from a younger stage (rule P7) | Approve | Default confirmed: Yes, rule P7. It replaces S05.2ba's rule that required the badge from everyone. |
| P-09 | Should graded course lessons update the Mentor's picture of the learner? | Approve | Default confirmed: Not implemented: course lessons do not feed the Mentor today. The proposal is yes, for the topic's primary skill only, as a new course_lesson evidence source, after policy acceptance and calibration. |
| P-10 | One switch for all courses, or one per course? | Approve | Default confirmed: One global switch (COURSE_PATHWAY_ENGINE). With today's catalog, progress and badges do not change for a learner who can open a course. What changes is which chapters are locked. A learner below a course's minimum age loses access to it and keeps every pass, credit and badge. |

## Lessons, grading and rewards

| ID | Item | Answer | Decision |
|---|---|---|---|
| L-01 | The 20% penalty when a timed drill runs out | Alternative | Remove the 20% timeout penalty (timers stay). |
| L-02 | A gentle "not yet" sound | Alternative | Alternative: A new sound. It needs a new audio asset, which may cost money. |
| L-03 | Conservative learner-experience defaults | Approve | Default confirmed: As listed. |
| L-04 | Peer comparison and leaderboards by age band (B.23) | Alternative | Teens 13-17: cooperative goals in small mutual-connection groups, no rankings, no public progress; no leaderboards in any band (OD-27). |
| L-05 | Randomized rewards are banned for everyone | Approve | Default confirmed: Platform-wide. |
| L-06 | Streak and pace defaults (policy §5) | Approve | Default confirmed: As listed. |
| L-07 | Practice-difficulty thresholds (B.19) | Approve | Default confirmed: As listed. Details: docs/rebuild/PRACTICE-DIFFICULTY-CALIBRATION.md. |
| L-08 | Product copy review of three new lines | Approve | Default confirmed: The copy as written. |
| L-09 | Which skills trigger the real-life bridge (B.13) | Approve | Default confirmed: As mapped. |
| L-10 | A guardian creating a savings goal for the child | Approve | Default confirmed: Allowed. |
| L-11 | How often the bridge prompts appear, and how long they are kept | Approve | Default confirmed: As listed. The purge runs in the nightly insights-maintenance.yml. |
| L-12 | Independent teens and "I will try" | Alternative | Alternative: Yes, create the teen's own goal. |
| L-13 | The decision journal is private | Alternative | Under-13 children only: the verified Tutor sees the chosen option of each story decision; teens stay private (OD-27). |

## Forge content gates

| ID | Item | Answer | Decision |
|---|---|---|---|
| F-01 | Which texts the copy-length gate blocks | Approve | Default confirmed: Keep them all blocking. |
| F-02 | Which age-band limits apply to tiers that straddle two bands | Approve | Default confirmed: Keep both until the OD-16 pathways split the ages. |
| F-03 | Banking words and urgency wording in lessons | Approve | Default confirmed: The split as described. |
| F-04 | Where the B.17 ranges block | Approve | Default confirmed: Upper end blocks. Above the lower end goes to review. |
| F-05 | Episodes where the Mentor makes a mistake (B.11) | Discuss | Misjudgment episodes are authored in the new catalog (OD-24); gate 15 applies to it. |
| F-06 | Money amounts in each market (B.16) | Approve | Default confirmed: Same numbers in every market, with the plausibility judged in Stage 3 review. The per-market stage is not built. The proposal is to build it when Forge moves to the v2 contract. |
| F-07 | No exception for undeclared lessons | Approve | Default confirmed: No bypass. |
| F-08 | Releasing single lessons | Approve | Default confirmed: Keep per-lesson release, with the full preflight. |
| F-09 | Image and audio patches to live lessons | Approve | Default confirmed: Neither option is built yet. Today such a patch is still allowed in place and forces a fresh verification before the next release. Engineering proposes (a). |

## Mentor

| ID | Item | Answer | Decision |
|---|---|---|---|
| M-01 | Rescue or remediate first? | Approve | Default confirmed: RESCUE first. |
| M-02 | The ceiling on revealed answers | Approve | Default confirmed: 10%. |
| M-03 | How often integrity is monitored | Approve | Default confirmed: Weekly. |
| M-04 | When the learner presses "end" | Alternative | Alternative: Ask the recap question first. |
| M-05 | Re-engagement messages | Approve | Default confirmed: As listed. |
| M-06 | Session-end signal thresholds | Approve | Default confirmed: As listed. |
| M-07 | Automatic rollback (Stage 7) and the check-in chips | Approve | Default confirmed: As listed. |
| M-08 | A fixed instruction outside the 14-field context list | Approve | Default confirmed: Accepted as outside the allow-list. |
| M-09 | Remembering declined adaptations | Approve | Default confirmed: Stored as fading counts. |
| M-10 | The end-of-session question about the learner's experience | Approve | Default confirmed: As described. |
| M-11 | Thresholds for renegotiating goals with the learner | Approve | Default confirmed: As listed. The 365-day profile retention from the same list is in D-18. |
| M-12 | May minors join the dialogue-style experiment? | Alternative | Open the C.17 experiment to teens 13-17 (own opt-in) and tweens 10-12 (guardian analytics consent); 6-9 stay excluded (OD-26). |
| M-13 | A controlling phrase that survives the retry | Approve | Default confirmed: Deliver, count and flag it. |
| M-14 | Adults and the autonomy-supportive style | Approve | Default confirmed: Applied to adults too. |
| M-15 | How much live content staff review | Approve | Default confirmed: As listed. |
| M-16 | The three Mentor-quality owner roles | Approve | Default confirmed: Three roles, as assigned. |
| M-17 | Flagging differences between groups of learners | Approve | Default confirmed: As listed. |
| M-18 | Alerts for urgent flags nobody has acknowledged | Approve | Default confirmed: Nothing is sent today. |
| M-19 | What counts as Tier 1 code | Alternative | Alternative: Finer boundaries. |
| M-20 | What "a defined threshold" means for calibration | Approve | Default confirmed: (a) As listed. (b) Excluded: it is a Tier 1 safety judge covered by the C.20 bias audit. |
| M-21 | Counting check-ins the session limit held back | Approve | Default confirmed: Not implemented. Doing it would change a bias-audited file and the session-close data format. It is recorded for the Pedagogical Reviewer. |

## Family Hub and wallet

| ID | Item | Answer | Decision |
|---|---|---|---|
| H-01 | Removing another Tutor | Approve | Default confirmed: No. A Tutor can only step away from their own link, because removing someone else carries custody-dispute risk. |
| H-02 | What the confirming Tutor sees about a pending second Tutor | Approve | Default confirmed: Display name and date only. This is implied by the question and not stated outright. |
| H-03 | Confirming a second Tutor | Approve | Default confirmed: As described. |
| H-04 | What still works while an account is frozen | Approve | Default confirmed: As described. |
| H-05 | Marking rewards delivered, and where withdrawn goal coins go | Approve | Default confirmed: As described. |
| H-06 | Can a parent turn off a teen's own wallet actions? | Approve | Default confirmed: The teen keeps them, with no approval step. The parent's freeze and spending limit still apply. |
| H-07 | Can a teen remove a parent? | Approve | Default confirmed: Neither is built. |
| H-08 | A teen's wallet history at 18 | Approve | Default confirmed: Core stops reads and writes, and the rows are kept. There is no read-only view or export. |
| H-09 | Conservative teen-wallet defaults | Approve | Default confirmed: As listed. |
| H-10 | Where a teen starts after linking a parent | Approve | Default confirmed: Level 1. |
| H-11 | Holiday pauses and the family-contribution cap (includes a mismatch to resolve) | Approve | Default confirmed: Separate bounds as listed. The two lanes disagree on how far ahead a pause may start (120 vs 60 days). The source does not say whether one pause covers both streaks today. The 2-coin cap applies. |
| H-12 | The under-13 savings-bonus ratio | Approve | Default confirmed: Platform-wide, and not a per-family setting. |
| H-13 | The savings bonus after its Tutor steps away | Approve | Default confirmed: It keeps paying, as it did before S07.3. Any change to the rule then needs a current Tutor. |
| H-14 | Age-register cutoffs, and what "unknown age" means | Approve | Default confirmed: As described. |
| H-15 | Teen wording for shared child screens | Approve | Default confirmed: One copy set, written to the ages 6–9 budget. |
| H-16 | The "Digital Banking" section name | Alternative | Rename to Wallet / Cartera / Carteira and add it to the glossary (OD-28). |
| H-17 | Moving plain-Save coins into a goal | Approve | Default confirmed: No path exists, so bonus coins never count toward a goal. |
| H-18 | A family default split suggested by the Tutor | Approve | Default confirmed: No suggestion feature. |
| H-19 | A child proposing a Share destination | Approve | Default confirmed: Only the Tutor chooses. |
| H-20 | Analytics consent for under-13s whose age came from the Tutor | Approve | Default confirmed: No. That child is excluded from all optional analytics, including the Block D diagnostics. |
| H-21 | Automatic step down a level | Approve | Default confirmed: Built, following the Appendix D demotion precedent. |
| H-22 | Independence levels and thresholds | Approve | Default confirmed: As listed. |
| H-23 | Letting the child counter-propose after a "not yet" | Approve | Default confirmed: Not built. Today the child's voice is their reason on each request, their ask for a level, and "Let's talk". |
| H-24 | Taking coins back when a Tutor questions an item | Approve | Default confirmed: No. The Tutor uses the audited coin correction. |
| H-25 | Research consent at 18 | Approve | Default confirmed: It lapses at 18, and re-consent is requested. |
| H-26 | Entry age for the Real-World Bridge | Approve | Default confirmed: 15 (MONEY_BRIDGE_MIN_AGE=15, recorded in the threshold log). |
| H-27 | New public FAQ answers | Approve | Default confirmed: Published in the FAQ only. |

## Profiles, social and sharing

| ID | Item | Answer | Decision |
|---|---|---|---|
| S-01 | The company name on shared achievement pictures | Approve | Default confirmed: Keep the name. |
| S-02 | Goal titles that could identify a child | Approve | Default confirmed: Use the generic label. |
| S-03 | Public profiles for 16- and 17-year-olds | Alternative | Alternative: Let 16–17-year-olds opt in. |
| S-04 | Storing a birth month so teens move up at 18 | Alternative | Alternative: Also store a birth month. |
| S-05 | A guardian linking to a self-registered teen | Approve | Default confirmed: No. The teen keeps deciding, and the guardian sees the teen's full profile. |
| S-06 | Changing a child's flagged username | Alternative | Alternative: Build the guardian-initiated change. |
| S-07 | Follower and following counts | Approve | Default confirmed: Removed. |
| S-08 | Future messaging-like features for teens without a guardian | Approve | Default confirmed: Such a teen cannot turn it on. |

## Design system and visual assets

| ID | Item | Answer | Decision |
|---|---|---|---|
| V-01 | The Mentor avatars (the first asset family): style, pose and background | Approve | Default confirmed: The drafts use ambient.idle. However, S03.1 proposed think.wait, so the pose is not settled. |
| V-02 | Style of the other first-family assets | Approve | Default confirmed: The drafts as shown, pending your approval. |
| V-03 | Date entry | Approve | Default confirmed: The native picker in general. Three fields on the age screen. |
| V-04 | Loading states, pending buttons and dark-mode depth | Alternative | All three: shimmer on loading placeholders, spinner on pending buttons, shadows in dark mode (motion still off under reduced motion). |
| V-05 | The dimmed backdrop behind dialogs (scrim) | Approve | Default confirmed: ink at 66%. |
| V-06 | Toast notifications | Approve | Default confirmed: As described. |
| V-07 | Position of the Mentor tab | Approve | Default confirmed: Second. |
| V-08 | Console navigation on phones | Approve | Default confirmed: As described. |
| V-09 | Reference sheets and the one-screen rules | Approve | Default confirmed: Exempt. |
| V-10 | The "breathing" call-to-action halo | Approve | Default confirmed: As described. |
| V-11 | Remembering that a moment was already celebrated | Approve | Default confirmed: Per browser session (sessionStorage). |
| V-12 | Confetti for lesson complete | Alternative | Alternative: Build the confetti burst. |
| V-13 | Keeping "Run" visible on phones | Alternative | Alternative: Make the segmented control smaller. |
| V-14 | Emails in light mode only | Alternative | Alternative: Design for dark mode as well. |
| V-15 | Copy length in emails | Approve | Default confirmed: The app budget. |
| V-16 | Automating the "no text inside images" check | Alternative | Alternative: Add the dependency. |

## Operations

| ID | Item | Answer | Decision |
|---|---|---|---|
| O-01 | Branch protection for Mentor code | Alternative | Engineering prepares CODEOWNERS and the exact ruleset; the owner applies it at push time (OD-28). |
| O-02 | Named owners for two long-term initiatives | Alternative | The project leader is interim owner of both D.19 and D.22 (OD-28). |
| O-03 | The legacy `display_number` column | Approve | Default confirmed: Kept until the wave-2 contract migration. The practice card no longer shows a number. |

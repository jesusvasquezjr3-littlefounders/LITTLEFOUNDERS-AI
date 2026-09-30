# Social-layer governance: research foundation, no messaging, social-graph retention and standing guardrails

Status: implemented and locally verified in S08.7 (25 September 2026), including real PostgreSQL 17 evidence of the database half. Not accepted: the Appendix J §2.1(4) reviewer, the Stage 3 Safety/Trust review, counsel's review of section 3, the open owner proposals in section 8.2, the first quarterly recalibration by the Safety/Trust Lead, evidence against the real Supabase stack and production readings of the metric are open. See [the S08 sprint record](../sprints/S08-PROFILES-SOCIAL-AND-SHARING.md#s087-implementation-and-rationale).

Binding sources: Product `10` E.7, E.10, E.11 and E.12 and component 5 of the Block E standard ("Standing Guardrails Against Future Regression"); Appendix I (research basis); Appendix J (metrics, Definition of Done, Part 3 pipeline, Part 4 phasing); owner decisions OD-3 (every minor safeguard follows age) and OD-10 (build to the conservative option; Legal validates before launch). `npm run guardrails:check` (part of `spec:check`) keeps this document, the database and the code in step.

## 1. Research foundation (E.7)

### 1.1 Adoption

Appendix I (`docs/littlefounders-spec/product/10-APPENDIX-I-PROFILE-SOCIAL-SAFETY-RESEARCH-FRAMEWORK.md`) is the authoritative research basis for E.8 to E.13. A change to the social layer cites the Appendix I part it relies on, the same way lesson design cites Appendix B and the Mentor cites Appendix D. The table maps each pillar to what it grounds and where that is enforced.

| Appendix I part | What it establishes | Requirements | Enforced by |
|---|---|---|---|
| Part 1: stranger-contact risk | Discovery and contact are their own risk, separate from messaging. Removing messaging removes one escalation channel, not the exposure. Off-platform migration needs only a handle | E.1, E.3, E.10, E.13 | Discovery gate and guardian approval (S02), report escalation (S02), this policy §2, profile-field review (SOCIAL-TIERS.md §3) |
| Part 2: walled-garden precedent | Every product that reduced the risk moved to gated, mutual-consent connections with age-tiered defaults | E.1, E.8 | The four social tiers (SOCIAL-TIERS.md §1) |
| Part 3: regulation (not legal advice) | COPPA's disclosure doctrine reaches a child's public profile and follow graph; the UK Children's Code requires high privacy by default; the 13-17 exposure is unsettled | E.8, E.11 | This policy §3, the teen tier, OD-10 |
| Part 4: comparison metrics | Visible, quantified peer-comparison counts carry a mechanistically supported risk; the broad "social media harms" claim is contested | E.9 | No count on any surface (SOCIAL-TIERS.md §2) |

The governance boundary in the Block E standard applies to everything written from this foundation. The general "social media harms adolescents" literature is contested, and the 13-17 regulatory exposure rests partly on state laws in active litigation. No study tests LittleFounders' exact combination. Internal and external statements about this domain say so, and they never present a requirement as proven by experiment or as settled law.

### 1.2 Threshold Recalibration Log (Block E)

Appendix J Part 1.4 extends the recalibration logs of Appendices C, F and H to this Block. Every Block E threshold is listed here with the date it was last reviewed and the date the next review is due. The cadence is quarterly for the first year, as Appendix J proposes for an actively moving regulatory landscape; after the first year it follows the Appendix B, D and G cadence. The owner of each review is the Safety/Trust Lead (Appendix J Part 3 Stage 7). No due date may sit more than a quarter after its last review in the first year (counted from the first section 1.4 record), or more than a year after it. Recording a review means updating the row, the date and the log in section 1.4.

Two triggers keep a review from lapsing silently, as for Blocks A, B, C and D:

- **Per calendar quarter.** On 1 January, April, July and October, `.github/workflows/block-e-reviews-quarterly.yml` runs `agent/tools/block-e-reviews-quarterly.mjs` and opens (or comments on) the quarter's issue, labelled `block-e-review`, for the Safety/Trust Lead: every threshold with its value, where it is enforced, its last review and next due date, and every section 1.3 item to re-check. A malformed log still opens the issue and turns the run red.
- **Per release.** `agent/tools/release-readiness.sh` runs `node agent/tools/block-e-review-cadence.mjs --strict`, which fails while any row of this table or of section 1.3 is past its due date, or when either table is malformed. The repo gates run the same tool without `--strict` (an overdue row warns there), and `guardrails:check` (part of `spec:check`) independently fails once a "Next review due" date in this table has passed.

| Threshold | Current value | Enforced in | Basis | Last reviewed | Next review due |
|---|---|---|---|---|---|
| Guardian-approval queue: unanswered request expiry | 30 days | `run_social_graph_retention` (§3.2) | Appendix J 1.1 Guardian-Approval Queue Latency is diagnostic; an unanswered request is not consent | 2026-09-25 | 2026-12-24 |
| Teen request cap per requester | 20 pending | `request_teen_connection` | S08.6 abuse limit | 2026-09-25 | 2026-12-24 |
| Teen decline cooldown | 30 days | `request_teen_connection` | S08.6 abuse limit | 2026-09-25 | 2026-12-24 |
| Report escalation pattern (E.3) | 3 unrelated minors in 30 days, by age (child or teen tier, OD-3) | `report_escalation` and `social_pattern_age_based` migrations | E.3 automatic trigger | 2026-09-25 | 2026-12-24 |
| Report-resolution SLA | Not set (diagnostic baseline) | Appendix J 1.1 | Needs production data first | 2026-09-25 | 2026-12-24 |
| Age-tier boundaries (E.8) | Under 13 / 13 to 17 / 18+ | `social_tier` | OD-3, Appendix I Part 3 | 2026-09-25 | 2026-12-24 |
| Social-graph retention windows (E.11) | Section 3.2 | `social_retention_windows` | This policy §3 | 2026-09-25 | 2026-12-24 |
| Profile-field classifier rules (E.13) | 7 rules, 43-case corpus | `profile_field_flags` | SOCIAL-TIERS.md §3.2 | 2026-09-25 | 2026-12-24 |
| Messaging vocabulary and reviewed names (E.10) | Section 2.2 | `social_messaging_surfaces` | This policy §2 | 2026-09-25 | 2026-12-24 |

### 1.3 Regulatory watch list

Appendix I Part 3 names these as moving. Before any legal claim in E.8 to E.12 is treated as settled, the Safety/Trust Lead and counsel re-check each against current primary sources and record the result in section 1.4. This checkpoint did not re-check them: it has no counsel and runs no external research, so each item stays open.

| Item | Why it matters here | Status | Last re-checked | Next re-check due |
|---|---|---|---|---|
| FTC COPPA Rule amendments (final rule published 22 April 2025) | Separate consent for third-party disclosure; a written retention and minimization policy (this document is the social-graph half) | Open: counsel to confirm the compliance date and that section 3 meets the written-policy requirement | not yet | 2026-12-24 |
| UK Age Appropriate Design Code | "High privacy by default" for under-18s | Open: counsel to confirm applicability to the markets served | not yet | 2026-12-24 |
| California AB 2273 (Age-Appropriate Design Code Act) | Litigation over enforceability | Open: re-check the litigation status | not yet | 2026-12-24 |
| Maryland Kids Code | Litigation over enforceability | Open: re-check the litigation status | not yet | 2026-12-24 |
| Federal KOSA | Not law when Appendix I was written | Open: re-check whether enacted | not yet | 2026-12-24 |

Each item is re-checked on the section 1.2 cadence (quarterly in the first year, then the Appendix B, D and G cadence), with the same two triggers: the quarterly `block-e-review` issue lists every item, and `block-e-review-cadence.mjs --strict` fails release readiness while a "Next re-check due" date has passed. A re-check updates the status, both dates and the section 1.4 log; "not yet" means no re-check has been recorded.

### 1.4 Recalibration record

| Date | Reviewer | What was reviewed | Outcome |
|---|---|---|---|
| 2026-09-25 | Engineering (S08.7 draft) | Every row of section 1.2, written from the implemented values | Values recorded as implemented. Not a Safety/Trust review: the first one is due 2026-12-24 |

## 2. No person-to-person messaging (E.10)

### 2.1 The standing constraint

LittleFounders has no direct message, chat, comment, reply, mention, reaction, sticker, greeting, "say hi" or group conversation between people, for any account. This is a deliberate, permanent safety decision, not a feature not yet built. The only conversational surface is the Mentor, which is the AI and not a person, and it is governed by Block C.

Any future feature that lets one person send words, reactions or media to another is a messaging-adjacent feature and follows every rule below, whatever its stated purpose:

1. It is classified **discoverability/safety** at Appendix J Stage 0, so the Stage 2 adversarial suite and the Stage 3 Safety/Trust review are mandatory before it ships. It is reviewed against the whole Block E standard, not as an unrelated new feature.
2. It defaults **off** for the guardian tier (children) and the teen tier. The closed tier never gets it.
3. For a child, it turns on only by an affirmative opt-in from a current verified guardian of that child, per child.
4. For a teen, it turns on only by the teen's own affirmative opt-in, and the teen's linked guardian is notified. A teen with no linked guardian can never turn it on, because the notice E.10 requires has nobody to go to (owner answer S-08, `docs/rebuild/OWNER-REVIEW-ANSWERS.md`). The register pins it: every entry declares `activation.teenWithoutGuardian` as `never`.
5. It is registered in [`messaging-features.json`](messaging-features.json) with those defaults (including rule 4's `teenWithoutGuardian: never`) and the dates of its Stage 0 classification and Stage 3 review, and every schema name and route it adds is listed in section 2.2. `guardrails:check` refuses an entry without them.

### 2.2 Reviewed names

A table, view, column, function or route whose name carries a messaging word, and any free-text or JSON column in a table that references two or more accounts, is a messaging surface until it is listed here. The same list is in `public.social_messaging_surfaces()`, and `guardrails:check` compares them. None of these is person-to-person messaging:

| Name | Why it is not person-to-person messaging |
|---|---|
| `column:email_logs.message_id` | The transactional email provider's message id for a system email |
| `function:social_messaging_surfaces` | The E.10 scan itself |
| `text:analytics_ip_exclusions.label` | Staff label for an excluded office network |
| `text:analytics_ip_exclusions.reason` | Staff reason for that exclusion |
| `text:badge_shares.achievement_label` | Legacy share (F.2): system-generated achievement text; no new rows (OD-20) |
| `text:badge_shares.first_name` | Legacy share: the child's first name on a picture the guardian made |
| `text:badge_shares.image_bucket` | Legacy share: storage location |
| `text:badge_shares.image_ext` | Legacy share: file extension |
| `text:badge_shares.image_url` | Legacy share: the image address, retired with the table |
| `text:banking_accounts.nickname` | Account nickname, set by the guardian or the owner, shown only in the family |
| `text:data_practice_consents.practice_key` | The code of a registered data practice (a foreign key into `data_practices`, pattern-checked there) on a consent record; written by the service role only (OD-9 section 4.2) |
| `text:family_autonomy_changes.reason` | A verified Tutor's (or staff's) reason for changing their own child's independence level (D.17), shown inside the family |
| `text:family_decisions.prior_status` | The state a chore or reward was in before the decision; a system-written status code |
| `text:family_decisions.reason` | A verified Tutor's mandatory reason for their own decision on their own child's chore or reward (D.18), inside the family |
| `text:guardian_invites.token` | Single-use invite secret |
| `text:learner_memory_proposals.expected_before` | Mentor memory note under guardian review (C.4) |
| `text:learner_memory_proposals.proposed` | Mentor memory note under guardian review (C.4) |
| `text:mentor_quality_flag.dedup_key` | A staff dashboard flag's system-built de-duplication key (C.24) |
| `text:mentor_quality_flag.resolution_note` | A staff lead's note on resolving a Mentor-quality flag (C.24); never shown to a learner or family |
| `text:redemptions.child_note` | The child's own stated reason on their reward request, read by their own verified Tutor at decision time (D.18); 140 characters, inside the family |
| `text:share_destinations.title` | The name of a real Share destination (a charity, a gift, a community cause) chosen by the child's verified Tutor, or by a self-registered teen for themself (D.14); shown only to that holder and their Tutors |
| `text:share_gifts.note` | What really happened with the holder's Share coins, recorded by their verified Tutor or by a self-registered teen for themself (D.14); shown only to that holder and their Tutors |
| `text:social_reports.note` | A report to staff (E.3), never shown to the reported account; cleared after 90 days (§3.2) |
| `text:tasks.cancel_reason` | A guardian's reason for cancelling a task, inside the family |
| `text:tasks.child_note` | The child's own stated reason on their chore, read by their own verified Tutor at decision time (D.18); 140 characters, inside the family |
| `text:tasks.evidence_bucket` | Storage location of task evidence |
| `text:tasks.evidence_hash` | Content hash of task evidence |
| `text:tasks.title` | A task title a guardian writes for their own child, inside the family |
| `text:tutor_voice_consent.consent_text` | The consent text a guardian accepted |
| `text:tutor_voice_consent.scope` | The consent's scope |
| `text:wallet_guardian_actions.reason` | A verified Tutor's reason for correcting their own child's coins (D.5), inside the family |

Adding a row here is a Stage 3 decision. The ten rows for `family_*`, `mentor_quality_flag`, `redemptions.child_note`, `share_*`, `tasks.child_note` and `wallet_guardian_actions` were added at the S07 merge (migration `s07_merge_reconciliation`), when the live scan first saw the S06 and S07 schemas; their Stage 3 review is open with the rest of this list. The `data_practice_consents.practice_key` row was added at the S10 merge (migration `od9_merge_reconciliation`) on the same terms. A row that is a real person-to-person channel also needs its `messaging-features.json` entry (§2.1).

### 2.3 Enforcement

- **Live catalog.** `public.social_messaging_surfaces()` (migration `social_standing_guardrails`) scans the deployed schema, not the migration files, so an object created out of band is caught as surely as a migration. It applies both rules (vocabulary and structure) and returns the unreviewed names. The Appendix J metric carries the list; the target is empty.
- **Repository.** `guardrails:check` scans every migration's tables, views, columns and functions, every Core route path and every frontend route path for the vocabulary, compares the vocabulary and the reviewed list between SQL, Core and this policy, and validates `messaging-features.json`.
- **Core.** `backend/src/__tests__/socialGovernance.test.ts` fails if any mounted or routed Core path carries a messaging word.

## 3. Social-graph data: retention, deletion and disclosure (E.11)

### 3.1 What it covers

Follows (`follows`), blocks (`blocks`), a child's connection requests (`social_connection_requests`), a teen's connection requests (`social_consent_requests`), reports and review cases (`social_reports`, `social_review_cases`), guardian safety notices (`social_safety_notices`) and the social-graph audit entries (`social.follow`, `social.unfollow`, `social.block`, `social.unblock`, `social.follower_removed`, `social.retention_removed` and every `social.connection_*` action) in `audit_logs`.

### 3.2 Retention

| Window | Value | What happens when it passes | Why this long |
|---|---|---|---|
| `pendingRequestDays` | 30 days | An unanswered request (child or teen) expires: the row is deleted and `social.connection_expired` is audited with its tier. The requester may ask again | An unanswered request is not consent, and a queue that only grows hides the requests that matter |
| `closedRequestDays` | 30 days | A declined, withdrawn, removed, denied or revoked request is deleted 30 days after the decision. The decision stays in the audit log | The teen decline cooldown reads these rows for 30 days |
| `reportNoteDays` | 90 days | A resolved report's free-text note is cleared | The note is the most sensitive field; staff need it while resolving, not after |
| `resolvedReportDays` | 365 days | A resolved report is deleted | Long enough to see a repeat pattern across a year; open reports are never touched (E.3 evidence) |
| `resolvedCaseDays` | 365 days | A resolved review case is deleted | Same as reports; an open case is never touched and holds an erasure (S08.5) |
| `readNoticeDays` | 90 days | A safety notice the guardian read is deleted | The guardian has seen it |
| `unreadNoticeDays` | 365 days | An unread safety notice is deleted | A guardian who never signs in should not keep one forever |

**The audit trail is not swept.** `audit_logs` is append-only (a README non-negotiable, and the E.2 accountability record a guardian reads in the Family panel), so the sweep never deletes or edits an audit entry; it only adds its own (`social.connection_expired`, `social.retention_removed`, `social_retention.sweep_ran`). Social-graph audit entries therefore have no expiry today. Giving them one (the proposal is 400 days, matching the raw-event window in Product `10` H.2) would relax that invariant for a dated retention prune, so it is an owner decision (section 8.2; D-15 (b) keeps them until then), and `guardrails:check` fails if any migration deletes from or updates `audit_logs` before it is taken.

Live follows and blocks have no expiry. They last while they are in force and go when either side removes them or either account is deleted (S08.5 erasure). An approved or accepted request stays while the edge it admitted may exist.

**Cooperative goals (L-04).** Teen cooperative goals (OD-27 (1); [SOCIAL-TIERS.md §1.2](SOCIAL-TIERS.md#12-cooperative-goals-for-13-to-17-year-olds-l-04-od-27-1)) are social-graph data too, and use the same windows, with no new one (migration `cooperative_goals_retention`): an invitation nobody answered lapses after `pendingRequestDays`; a goal closes at the end of its 7, 14 or 28 day window, or as soon as it is down to one person with nobody asked; `public.coop_goals` rows (and their `coop_goal_members`, by cascade) are deleted `closedRequestDays` after the goal closed; a membership whose holder stopped being a 13-to-17 participant (turned 18, a flagged profile, the Tutor's opt-in gone) or whose mutual connection ended is ended at once by `coop_goal_reconcile`, and the daily sweep reconciles every goal something may be due in; a Tutor's opt-in in `public.coop_goal_guardian_consents` is deleted when that guardian is no longer a verified guardian of the child, or `closedRequestDays` after it was turned off. Every change is audited (`social.coop_*`) and the audit rows stay. A cooperative goal holds no free text (E.10: no name, note or message; `guardrails:check` section 5), is never an analytics event and never reaches the warehouse.

The windows are defined once, in `public.social_retention_windows()`. Core's copy (`SOCIAL_RETENTION_WINDOWS`) exists so the metric can say whether the deployed database matches this table, and `guardrails:check` compares all three.

### 3.3 Being followed is its own disclosure event

For a child, "being followed by" and "following" another account are disclosure events of their own. Account-creation consent never covers them:

- Inbound, a follow into a child needs a current verified guardian's approval of that requester (E.1). Outbound, a child follows only inside its family or back to an account its guardian approved (E.8).
- The sweep removes every follow that exposes a child without a current guardian's approval. That covers a follow made before E.1 or the S08.6 tiers existed, an approval whose deciding guardian is no longer a current verified guardian of the child, and a follow involving an under-13-origin account no guardian has linked yet (`social_child_account`). Each removal is audited twice: `social.unfollow` by the follows trigger, which the guardian sees in the Family panel, and `social.retention_removed` with the reason.
- A teen's legacy inbound follows are the teen's to remove (SOCIAL-TIERS.md §1); they grant no visibility.

**No third-party disclosure.** Social-graph data never leaves Core's database: it is not an analytics event, it is not synced to the warehouse (`dataintel/`), it is not sent to Plausible or any provider, and it is not in any export. `guardrails:check` fails if an analytics event name or the warehouse code refers to follows, blocks or connections.

### 3.4 Deletion

Deleting an account (S08.5, ACCOUNT-DELETION.md) removes every follow, block and request it is party to, with the audit triggers firing, in the same erasure transaction. Reports and review cases about the account keep its evidence while a review is open, which holds the erasure.

### 3.5 Enforcement and runbook

1. Apply migration `social_standing_guardrails` (expand). It adds the retention windows, the consent rule, the scan, the metric and the E.12 write guards. Nothing is deleted.
2. Deploy Core. `GET /api/v1/admin/analytics/social-governance` works from here; `POST /api/v1/internal/social-retention/run` answers 502 until step 3.
3. Apply migration `social_graph_retention` by hand (contract). It only defines `run_social_graph_retention()`; applying it deletes nothing. It is declared contract because the phase classifier sees `DELETE` in the function body.
4. Read the metric first: `overdue` and `unconsentedChildEdges` say exactly what the first run will delete.
5. The daily workflow `.github/workflows/social-retention.yml` (04:15 UTC) then calls the sweep through Core until a run reports `complete: true`. Each run is audited (`social_retention.sweep_ran`) with its counts, including a run that found nothing. A failed or malformed answer fails the workflow; it is never read as zero.

### 3.6 Counsel review (open)

Counsel reads this section against the COPPA Rule as amended in 2025 (written retention policy; separate consent for third-party disclosure) before launch (OD-10), and confirms whether the Privacy Notice must state these windows. The owner approved the windows (D-15 (a), section 8.1); counsel's confirmation stays open.

## 4. Cartoon-only avatars, no image upload (E.12)

### 4.1 The standing constraint

A profile's picture is a cartoon. The avatar is a closed DiceBear option set rendered on the viewer's device, and the cover is one of ten token-gradient presets. No image, photo, URL or free text can be stored or served in either field, for any account. No image upload may be added to the profile, the avatar or the cover without a full child-safety re-review (Stage 0 as discoverability/safety, Stage 2, Stage 3), recorded in this document before it ships.

Three guards hold it:

1. **Writes through Core.** `PUT /api/v1/profile/avatar` accepts only the option set in `backend/src/services/profileShape.ts`; `PUT /api/v1/profile/cover` accepts only a preset.
2. **Every other writer.** Migration `social_standing_guardrails` adds `avatar_shape_guard` and `profile_cover_guard`. They refuse any other shape from the browser's own-row policies (`avatars_upsert_own`, `profiles_update_own`), the service role and the owner. Before this checkpoint, a direct browser write could store any JSON, such as a link or a phone number, that Core then served to every viewer of the profile. A value stored before the guard does not block unrelated edits; it is counted by the metric (`offSchema`).
3. **Every read.** Core serves an avatar or a cover only through `projectAvatarOptions` and `projectCover`: on the own profile, `/auth/me`, the public profile, the private card and every list. A legacy off-schema value becomes the default cartoon.

### 4.2 Reviewed upload surfaces

These are the only places a file can be uploaded. None is a profile, avatar or cover. `guardrails:check` fails if a Core file other than the two routes imports an upload parser (`multer`, `busboy`, `formidable`, `express.raw`) or a frontend file other than the ones listed renders a file input.

| Surface | What it uploads | Who sees it |
|---|---|---|
| `backend/src/routes/tasks.ts` | Task evidence photo | The child and its guardians (D-block rules) |
| `backend/src/routes/verification.ts` | A parent's ID document for A.5 verification | Nobody but the verification pipeline |
| `frontend/src/routes/app/tasks/EvidencePhoto.tsx` | Task evidence photo input | Same as the tasks route |
| `frontend/src/components/ui/FileField.tsx` | The ID document input on the parent verification page | Same as the verification route |
| `frontend/src/rebuild/identity/IdDocumentField.tsx` | The same ID document input, rebuilt on the design system (W2S.2); the legacy row above goes when S10 deletes the legacy UI | Same as the verification route |
| `frontend/src/tutor-scene/lab/SceneLabPage.tsx` | A local model file in a development-only lab | Only the developer's browser; nothing is sent |

## 5. Brand position (E.12)

`docs/product-audit/COSMIC_NARRATIVE.md` §6, "People You Already Know", states why LittleFounders does not build an open, discoverable social network for children, in the register of the Wallet position, and names the Feed as the thing it refuses to be. `guardrails:check` is Appendix J's Brand-Narrative Coverage Check: it fails if the section or its core statements disappear, and (GAP-FIX-R6) if the section stops describing the shipped layer: while the OD-27 (2) discoverable profile exists it may not say a teen approves every viewer one by one and must name the private default, the 16-17 opt-in and turning it off; while the OD-27 (1) cooperative goals exist it must name them and their no-ranking rule. It is reviewed on the section 1.2 cadence.

## 6. Metrics (Appendix J)

`GET /api/v1/admin/analytics/social-governance` (view_analytics) returns counts and schema names only, never an account id or any text. A malformed database answer fails the read.

| Appendix J metric | Where | Target |
|---|---|---|
| Social-Data Retention-Policy Compliance (1.2) | `overdue` (rows past each window), `unconsentedChildEdges`, `lastSweep`, `retentionCompliant`, `windowsMatchPolicy` | Zero overdue and zero unconsented edges after each sweep; windows match |
| Future-Feature Messaging Gate Compliance (1.3) | `messagingSurfaces` and `messagingSurfaceFree`; `messaging-features.json` checked by `guardrails:check` | No unreviewed surface; every registered feature off by default with the required opt-in |
| Avatar/No-Upload Constraint Integrity (1.4) | `offSchema` (avatars, covers); upload surfaces checked by `guardrails:check` | Zero new off-schema values; no unreviewed upload surface |
| Brand-Narrative Coverage Check (1.4) | `guardrails:check` | Present and current |
| Threshold Recalibration Log (1.4) | Section 1.2, dates checked by `guardrails:check` | No review overdue |

## 7. Standing constraints (component 5 of the Block E standard)

- No person-to-person messaging or comment feature exists, and none may default on for a child or a teen (section 2).
- No image upload exists in the profile, avatar or cover (section 4).
- Account deletion stays self-service and documented (ACCOUNT-DELETION.md).
- Social-graph data follows section 3 and is never disclosed to a third party.
- Each is changed only through a Stage 3 review recorded in the document that owns it.

## 8. Owner decisions and proposals (conservative defaults implemented)

### 8.1 Decided

Recorded in `docs/rebuild/OWNER-REVIEW-ANSWERS.md`:

1. **D-15 (a):** the retention windows in section 3.2 (30, 30, 90, 365, 365, 90 and 365 days), enforced by the daily `social-retention.yml` sweep, are approved. E.11 sets no numbers; counsel's review of section 3 (section 3.6) stays open.
2. **D-15 (a), same answer:** unanswered requests expire after 30 days (`pendingRequestDays`) instead of waiting forever. The requester may ask again.
3. **D-16:** a follow whose approving guardian is no longer a current verified guardian of the child is removed, even if another guardian is still linked. That guardian can approve the requester again.
4. **S-08:** a teen with no linked guardian cannot turn on a future messaging-adjacent feature, because E.10's guardian notice has nobody to go to (section 2.1 rule 4; `guardrails:check` requires `activation.teenWithoutGuardian: never` on every register entry).

### 8.2 Proposals for the owner

1. Social-graph audit entries keep no expiry, because `audit_logs` is append-only. The proposal is to let them expire after 400 days (the H.2 raw-event window), which needs the owner to allow a dated retention prune of the audit log. Until then they are kept (owner answer D-15 (b): kept indefinitely until the owner decides), and the policy and FAQ say nothing that promises otherwise.
2. The first-year recalibration cadence is quarterly (Appendix J's proposal), owned by the Safety/Trust Lead.

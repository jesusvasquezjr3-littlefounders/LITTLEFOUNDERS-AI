# 05 — Permissions and Roles

This document covers who can do what: every role and account type, how roles are obtained and removed, the permission matrix across features, access rules per screen and per API area, the family/guardianship model (the platform's only form of multi-tenancy), and the safety posture tied to age.

---

## 1. Account types and roles

### 1.1 Roles (stored)

| Role | Product name | How it is obtained | What it represents |
|---|---|---|---|
| **universal** | "Universal" | Automatically, for **every** new account (signup, Google, guest, child creation) | Base account: learning, AI Tutor, profile, social |
| **parent** | "**Tutor**" (verified parent) | Passing guardian **ID verification**, or a Superadmin grant | An adult who can create and supervise children |
| **kid** | "Kid" / "Child account" | Created by a parent through Family (the role is granted automatically), or a Superadmin grant (the data store requires a verified guardian link) | A child supervised by one or more verified guardians |
| **bigfounder** | "Bigfounder" | Superadmin grant only | Defined, assignable and recorded in analytics, but **no feature, screen or endpoint is restricted to or unlocked by it** |
| **admin** | "Admin" | Granted by a Superadmin | Staff: full staff console except Roles & Access |
| **superadmin** | "Superadmin" | Granted by a Superadmin; **only for accounts whose email is at the company's own domain** | Staff: full console, including role and permission management |

A person can hold several roles at once. The universal role is kept after upgrades. For displays and analytics, one "primary role" is chosen by precedence:
- **Console displays:** superadmin > admin > bigfounder > parent > kid > universal.
- **Analytics stamping:** kid > parent > bigfounder > superadmin > admin > universal. "Kid" always wins, so child protections apply whenever a person holds the kid role at all.

### 1.2 Session-derived states (not stored roles)

| State | Meaning | Effect |
|---|---|---|
| **Anonymous visitor** | Browsing public pages without a session | Only public pages; tracked (with consent) as an anonymous visitor |
| **Guest** | A real account created anonymously by "Start free" (holds the universal role; no email) | Must complete onboarding. Can learn, use the AI Tutor and edit the profile. Can upgrade in place to a permanent account. Can still open Login/Signup. |
| **Permanent account** | An account with email/password or Google (or a child's username/passphrase) | Normal behavior |
| **Minor (for safety purposes)** | **Holds the kid role** | Enables the child safeguards listed in §6 |

### 1.3 Staff permissions (labels)

Four fine-grained permissions can be assigned by a Superadmin: **manage users, manage content, view analytics, manage support**. They are stored, displayed and audited in Roles & Access. **No endpoint checks them.** Access to staff capabilities is decided solely by holding the admin or superadmin role.

---

## 2. Role assignment, escalation and removal

### 2.1 Paths to each role

```
(new account) ──► universal
universal ──[ID verification passes]──────────────► + parent
parent ──[creates a child in Family]──► child account: universal + kid (+ verified guardian link)
superadmin ──[Roles & Access]──► grant/revoke parent | kid | bigfounder | admin | superadmin
```

### 2.2 Rules enforced by the data store (they cannot be bypassed by any client)

1. **Superadmin domain rule:** the superadmin role can only be held by an account whose email ends in `@littlefounders.ai`.
2. **Admin granter rule:** the admin role must record who granted it, and that person must be a superadmin.
3. **Kid guardian rule:** the kid role can only exist on an account with at least one **verified** guardian link.
4. **No orphaned children:** a guardian's last verified link to a child holding the kid role cannot be deleted or un-verified. A parent role cannot be removed if that would leave a child without a verified guardian.
5. **Full audit:** every grant, change or revocation of a role or staff permission is written to the audit log automatically, with the actor.
6. **No self-service role writes:** signed-in users cannot write role, permission or guardian-link records directly. Only the platform's service identity can.

### 2.3 Rules enforced by the Core API

- The parent role is granted only after a **successful ID verification**: all four document checks pass. Attempts are limited to 5 per hour per user. Failures never fail open.
- The kid role is granted only as the last step of child creation (after the verified link and the profile exist). Any earlier failure rolls the child account back.
- A **superadmin cannot revoke their own superadmin role.**
- Role changes through the console are refused with "rejected" whenever a data-store rule objects.
- **Not implemented:** roles expire nowhere. There is no self-service downgrade. There is no invitation-based role assignment. There is no flow to add a second guardian to an existing child, or to link an existing account as a child.

### 2.4 Invitations
There is **no invitation system** for accounts, families or staff. An email template for invitations exists on the authentication server, but no product flow sends it. Staff roles are assigned directly by a Superadmin. Children are created, not invited.

---

## 3. Permission matrix — product features

Legend: ✅ allowed · 🔒 shown locked (tapping leads to Verify Parent) · ⛔ not available (hidden or redirected) · 👁 read-only · G = only for their own verified children.

| Feature | Anonymous visitor | Guest | Universal (adult/teen) | Kid | Parent (Tutor) | Admin | Superadmin |
|---|---|---|---|---|---|---|---|
| Public pages, FAQ, legal | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Badge landing (public share) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sign up / Login | ✅ | ✅ (to switch accounts) | ⛔ (redirected to Learn) | ⛔ | ⛔ | ⛔ | ⛔ |
| Onboarding | ⛔ | ✅ (required once) | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Upgrade account | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Verify identity (become Tutor) | ⛔ | ✅ | ✅ | ✅ (no role check, but the ID check requires an adult age) | ⛔ (already verified) | ✅ | ✅ |
| Learn: courses, placement, lessons | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Territory map (own) | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI Tutor (typing) | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ (unlimited sessions/time) | ✅ (unlimited sessions/time) |
| AI Tutor voice (microphone) | ⛔ | ✅ if voice is enabled | ✅ if voice is enabled | Only with **active guardian consent** and the **minors' voice policy on** (off by default) | ✅ if enabled | ✅ if enabled | ✅ if enabled |
| AI Tutor history, map, plan, notebook (own) | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Profile, avatar, cover, settings (own) | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Public profiles, follow, block | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tasks — child board (do chores, sort rewards, goals, redeem) | ⛔ | 🔒 | 🔒 | ✅ | — | — | — |
| Tasks — parent board (assign, approve, catalog, decide) | ⛔ | 🔒 | 🔒 | — | ✅ G | — | — |
| Digital Banking — child home | ⛔ | 🔒 | 🔒 | ✅ | — | — | — |
| Digital Banking — parent control panel | ⛔ | 🔒 | 🔒 | — | ✅ G | — | — |
| Family panel (create/manage children) | ⛔ | 🔒 | 🔒 | 🔒 | ✅ G | ⛔ unless also parent | ⛔ unless also parent |
| Child territory, share badges | ⛔ | ⛔ | ⛔ | ⛔ | ✅ G | ⛔ | ⛔ |
| Child tutor transcripts, safety flags | ⛔ | ⛔ | ⛔ | 👁 own transcripts only | ✅ G | ⛔ (only the review queue of sampled activities) | ⛔ |
| Approve/reject child memory notes | ⛔ | ⛔ | ⛔ | ⛔ | ✅ G | ⛔ | ⛔ |
| Grant a child's microphone consent | ⛔ | ⛔ | ⛔ | ⛔ | ✅ G (when policy allows) | ⛔ | ⛔ |
| Revoke microphone consent | ⛔ | ⛔ | ⛔ | ✅ (own) | ✅ G | ⛔ | ⛔ |
| Child analytics consent | ⛔ | ⛔ | ⛔ | ⛔ | ✅ G | ⛔ | ⛔ |
| Staff console (all sections except Roles) | ⛔ | ⛔ (hidden) | ⛔ (hidden) | ⛔ (hidden) | ⛔ (hidden) | ✅ | ✅ |
| Staff Insights screen (not in menu) | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ |
| Roles & Access | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |

Notes:

- A person holding **both** parent and kid roles would see both boards' capabilities where the screen supports it. The screens pick one board by role, and analytics treats the person as a kid.
- Admins and Superadmins are also learners and can hold the parent role, which unlocks family features in addition to the console.

---

## 4. Access control per screen (client side)

| Screen group | Guard applied by the web app |
|---|---|
| Public pages, badge landing | None |
| Login, Signup, Forgot password | Guest-only (a real session redirects to Learn; guests allowed) |
| Reset password, OAuth callback | None (driven by the link or tokens) |
| Verify parent, Upgrade account, Onboarding, Lesson player | Requires a session |
| Placement, AI Tutor, the whole app shell | Requires a session **and** (for guests) completed onboarding |
| Tasks, Banking | Requires the **parent or kid** role |
| Family, Child territory, Child tutor page | Requires the **parent** role |
| Staff console screens | Requires the **admin or superadmin** role |
| Roles & Access | Requires **superadmin** |

The web app's guards are a convenience only. **Every decision is re-enforced by the Core API and, for data, by the data store's row-level rules.**

---

## 5. Access control per API area (server side)

| API area | Rule |
|---|---|
| Health, tracking decision, public badge, event ingestion (anonymous acquisition events only), signup, guest, login, refresh, recover, OAuth start | Public (rate-limited) |
| Me, logout, profile, public profiles, follow/block, learn, placement, onboarding, verification, AI Tutor (own), guest upgrade | Any authenticated session. Ownership is enforced on every resource (a user can only grade their own lessons and activities, resume their own sessions, and so on). |
| Family | Authenticated + **parent** role (re-read from the data store each time) + a **verified guardian link to the named child**. Another family's child is answered as not found (404, or 403 for consent and territory). |
| Tasks (parent routes) | Parent role + guardian link to the child the task belongs to. Catalog items are scoped to their owner. |
| Tasks (kid routes) | Kid role + assignee of the task. The catalog visible to a child is the union of their verified guardians' active items. |
| Evidence photo viewing | The assignee child or a verified guardian of that child |
| Banking (parent routes / kid routes) | Parent + guardian link / Kid (own account) |
| AI Tutor transcripts | Owner **or** verified guardian |
| AI Tutor resume (new socket token) | Owner only (never the guardian) |
| AI Tutor guardian views (sessions, memory proposals, plans, notebooks) | Verified guardian of the child |
| Microphone consent grant | Verified guardian only (not the child, not staff) |
| Microphone consent read / revoke | The child themself or a verified guardian |
| Staff console | Admin or Superadmin. Roles & Access endpoints: Superadmin. |
| Runtime-only tutor endpoints; all internal services | Internal key (service-to-service) |
| Tutor websocket | A single-use, 60-second token bound to one session and one user |

**Hidden versus forbidden:** the API deliberately answers "not found" when disclosure itself would leak information: another family's child, or a profile blocked in either direction. Blocking never reveals who blocked whom.

---

## 6. Age, minors and safety posture

The platform decides "is this person a minor?" from **role membership only: the kid role**. It does not use the date of birth for this decision.

| Safeguard | Applies to | Behavior |
|---|---|---|
| Signup age screen | Email signup | Under 13 refused. The date of birth is discarded after the check. Google signup and guest upgrade have no age screen. |
| Parent ID verification | Verify parent | The applicant must be 18+ by the typed date of birth, and the document must match |
| Analytics consent gate | **Kid** (and accounts with no roles) | Usage events are dropped unless an active guardian analytics consent exists. The beacon does not even transmit. |
| Acquisition attribution | Kid | Never linked to pre-signup browsing |
| Google Analytics / behavioral analytics | Kid | Never loaded for kid sessions. Behavioral analytics is loaded only for anonymous visitors on marketing pages and for signed-in parents. |
| AI Tutor microphone | **Kid** | Requires an active guardian consent **and** the platform policy for minors (off by default). Consent can only be collected while the policy is on. |
| AI Tutor output moderation | **Kid** | An independent AI safety judge must approve every tutor reply. If it is unreachable, the reply is refused and the session cannot start. For other accounts, deterministic checks suffice when the judge is unavailable. The judge runs for everyone when available. |
| AI Tutor memory | **Kid** | The tutor's learner note about a child changes only with guardian approval |
| AI Tutor transcripts and safety flags | **Kid** | Visible in full to verified guardians. Flags are listed by urgency. |
| AI model context | Everyone | Only the age tier (never the date of birth), the nickname (never the real name), the language and pedagogical state are sent to the model. The nickname cannot contain the real name. |
| Placement free-text intake | Everyone | Offered only when the **stored** date of birth shows age 12+. Unknown age means no free text. Only an age band is shared with the model. |
| Badge sharing | Kid | First name only, no age, no photo. The label is built by the server from a verified achievement. |
| Child data minimization | Kid | No email, surname or address collected. A synthetic non-deliverable sign-in address is used. |

**Observed consequence of the role-based definition:** guests (the path offered to under-13s refused at signup) and self-registered 13–17 teens hold only the universal role. They are therefore not treated as minors by the microphone gate, the fail-closed moderation posture, or the analytics consent gate.

---

## 7. Multi-tenancy: the family model

- **No organizations, schools, classrooms or teams exist.** The only tenancy boundary is the **family**: a child plus the adults holding a **verified guardian link** to that child.
- **Scope of a parent:** all their verified children (up to 10). A child's data is visible to every verified guardian, and each guardian's reward catalog is visible to the child.
- **Scope of a child:** their own data, their guardians' active reward catalogs, and their own transcripts.
- **Isolation:** every family operation re-checks the guardian link in both the Core API and the data store. Reads of children's data use the platform's service identity only after that check, and return a whitelisted set of fields.
- **Social layer:** crosses families. Any signed-in user can view another user's public profile (name, username, avatar, cover, member since, Tutor badge, learning stats, course badges) and follow them, unless a block exists. Children's public profiles are visible to other signed-in users in the same way.

---

## 8. Data-layer access (row-level rules)

What a signed-in user can do **directly** against the data gateway with their own session (independently of the Core API), per the data store's rules:

| Data | Read | Write |
|---|---|---|
| Profile | Own; verified guardians of the owner | Update own (all profile fields); insert own |
| Avatar | Own; guardians | Insert/update own |
| Roles, staff permissions | Own | None |
| Guardian links | Either party | None |
| Follows | Either party | Insert own (not when blocked), delete own |
| Blocks | Own | Insert/delete own |
| Courses and content hierarchy | Published chain only, signed-in users | None |
| Lesson documents, answer keys | None (service only) | None |
| Learning statistics, lesson progress, attempts, placements, credits, onboarding | Own; guardians | None |
| Tutor preferences, sessions, turns, safety flags, voice consent | Own; guardians (consent also its granter) | None |
| Tasks | Assigner, assignee, assignee's guardians | **Insert:** a guardian for their verified child. **Update:** the assignee child **or** a guardian (no restriction on which fields or state transitions, except that the evidence-photo fields can only be written by the service). |
| Savings goals | Child; guardians | Insert/update by the child |
| Reward catalog | Owner; the children of the owner (through guardianship) | Insert/update by the owning parent |
| Redemptions | Child; guardians | Insert by the child; update by a guardian |
| Wallet ledger, pending credits | Child; guardians | None (only through the platform's wallet operations) |
| Banking accounts | Child; guardians | **Update by the child or a guardian** |
| Allowance, bonus and spending rules | Child; guardians | None |
| Analytics consents, events, visitors, exclusions, telemetry, generation data | None | None |
| Live generation progress | Admin/superadmin (for real-time updates) | None |

**Observation:** the web app sends all writes through the Core API, which enforces transitions (for example open → done → approved), amounts and caps. Under the data platform's default table privileges for signed-in users, the data layer independently permits the parties listed above to update those rows directly through the public data gateway. For tasks, goals, redemptions, banking accounts and profiles, it does not constrain the transitions or values that the Core API enforces. All money movements (allocations, redemption debits, credits) are available only to the service identity.

---

## 9. Audit coverage of privileged actions

Every item below produces an audit-log entry, readable by staff in the console:

- role and permission changes (automatic, at the data level);
- failed ID verifications (check results only);
- child account create / update / passphrase change / delete (and rollbacks);
- chore create / approve / cancel; redemption approve / deny;
- banking open / freeze / unfreeze / allowance / spending limit / savings bonus;
- course release and status changes; lesson status changes;
- analytics exclusion changes;
- staff raw-data exports;
- the automated tutor retention sweep.

Actions **not** audited include:
- profile edits, follows and blocks;
- analytics consent grants/revokes (recorded as analytics events and in the consent ledger instead);
- microphone consent (the consent record itself is the ledger);
- memory-proposal decisions (recorded on the proposal and in the memory change ledger);
- tutor live-activity review decisions (recorded on the activity);
- placement, onboarding and learning actions.

# 03 — Data Model

This document lists every stored entity by business domain. For each one it gives the business meaning, the relationships, the key attributes, the validation rules and the lifecycle. It closes with deletion, retention and archiving behavior, and with the analytical layer built on the stored data.

**General rules that apply to every entity**

- Every person-related record belongs to a **User Account** (an identity in the authentication server). Deleting a user account removes, in cascade, almost every record that belongs to it (exceptions are listed in §12).
- Row-level access rules are enabled on every table. What the signed-in user can read directly is noted per entity; everything else is reachable only through the Core API's service identity.
- Multilingual text (titles, descriptions, objectives) is stored as one value per language: English (US), Spanish (Mexico), Portuguese (Brazil).
- Timestamps are recorded in UTC. Some learning dates (streaks) are the learner's **local calendar date** as reported by their device.

---

## 1. Identity and access

### 1.1 User Account (identity server)
- **Meaning:** a person or guest who can sign in. It holds the sign-in email (a synthetic, non-deliverable address for children), password, confirmation state, sign-in method history, and a *guest/anonymous* marker.
- **Creation paths:** email signup, Google sign-in, guest session, parent creating a child, staff/operator seeding.
- **On creation, three records are made automatically:** a Profile (with the display name taken from signup or Google metadata), a **Universal** role, and zeroed Learning Statistics.

### 1.2 Profile
- **Meaning:** the public and personal identity of a user account (one per account).
- **Attributes:** display name (required at the business level, up to 80 characters); **username** (optional, unique, 3–20 characters of a–z, 0–9, "_", always lowercase; it can never contain "@"); **language of record** (en-US / es-MX / pt-BR, default **en-US**); theme preference (light/dark/system; stored but the app keeps the theme per browser); **cover** (one of 10 colour presets); **date of birth** (optional; used for age tiers, placement and tutor eligibility); created and updated times.
- **Relationships:** one per User Account; one Avatar.
- **Access:** readable by the owner and by the owner's **verified guardians**; editable by the owner. Other users see a reduced public view only through Core.
- **Business rules:** usernames are unique, and the public profile address is `@username`. A child's profile username is set by the parent. A child's *sign-in* username is fixed at creation.

### 1.3 Role Assignment
- **Meaning:** a user holds one or more roles. Roles are **universal, parent, kid, bigfounder, admin, superadmin** (see 05).
- **Attributes:** user, role, granted by, granted at. One row per user and role.
- **Rules enforced by the data store:**
  - **Superadmin** can only be held by an account whose email ends in `@littlefounders.ai`.
  - **Admin** can only be granted by an existing superadmin, and a granter must be recorded.
  - **Kid** can only be held by an account with at least one **verified** guardian link.
  - Removing a user's **parent** role is refused if it would leave any of their children without a verified guardian.
  - Every grant, change or removal of a role is written to the Audit Log automatically, with the role and the actor.
- **Lifecycle:** granted → (optionally) revoked. The universal role is kept even after upgrades.

### 1.4 Staff Permission
- **Meaning:** fine-grained capability labels for staff: **manage users, manage content, view analytics, manage support**.
- **Attributes:** user, permission, granted by, granted at.
- **Rules:** every change is audited automatically. The console displays and manages these labels. No endpoint is additionally restricted by them; the admin/superadmin role is the effective gate (see 05).

### 1.5 Guardian Link
- **Meaning:** the relationship that makes an adult the guardian of a child. It defines "family" throughout the product.
- **Attributes:** parent (guardian) account, child account, **verification status** (pending / verified / rejected / revoked), verified at, created at.
- **Rules:** an account cannot be its own guardian. Each parent–child pair is unique. The last verified link of an account holding the kid role cannot be removed or un-verified.
- **Lifecycle as implemented:** links are created directly as **verified** when a parent creates a child account. No product flow creates pending links or changes a link to rejected/revoked.
- **Relationships:** a parent can have up to 10 verified children (enforced by the API). A child can technically have several guardians, but no flow adds a second one.

### 1.6 Parent Verification Record
- **Meaning:** evidence that an adult passed the ID check.
- **Attributes:** user, status (verified / revoked; only "verified" is produced), method ("local OCR"), given names, surnames, date of birth, document type (national ID / passport / driver's license), check results (four true/false values: document readable, name match, birth-date match, not expired), verified at.
- **Rules:** the ID image is never stored. A home-address field existed originally and was **removed together with its stored data**.
- **Access:** readable only by the owner.

### 1.7 Onboarding Response
- **Meaning:** marks that a guest completed onboarding, with their optional answers.
- **Attributes:** user (one per user), discovery channel (friend, social media, search, app store, school, ad, other; optional), account-offer choice (created now / later), completed at.
- **Lifecycle:** created once. Its existence means "onboarding complete".

### 1.8 Avatar
- **Meaning:** a cartoon avatar configuration (rendered in the browser, never an image).
- **Attributes:** user, seed, option set (hair/top, hair colour, skin, eyes, eyebrows, mouth, facial hair and its probability 0–100, clothing, clothing colour, accessories and their probability 0–100; each list up to 3 values of 1–40 alphanumeric characters), updated at.

### 1.9 Follow
- **Meaning:** "user A follows user B".
- **Rules:** a user cannot follow themselves. A follow is refused if either user has blocked the other. It can be read by either party.

### 1.10 Block
- **Meaning:** "user A blocked user B".
- **Rules:** a user cannot block themselves. Blocking removes follows in both directions and makes the two profiles invisible to each other. Only the blocker can read or delete it.

### 1.11 Audit Log Entry
- **Meaning:** an append-only record of privileged or sensitive actions.
- **Attributes:** sequential id, actor (a user, or empty for scheduled jobs), action name, subject (the affected record or user), detail (structured, deliberately free of personal content for family actions), time.
- **Actions recorded (non-exhaustive by design; all known producers):**
  - role changes and staff-permission changes (automatic);
  - failed parent verification;
  - child created / updated / passphrase rotated / delete requested / deleted / creation rolled back;
  - task created / approved / cancelled; redemption approved / denied;
  - banking account opened / frozen / unfrozen / allowance set / spending limit set / savings bonus set;
  - course released / course status set / lesson status set;
  - analytics exclusion created / created for own device / revoked;
  - staff event export;
  - tutor retention sweep ran.
- **Access:** a user can read only entries where they are the actor. Staff read all entries through the console.
- **Lifecycle:** insert only. Never updated or deleted by the product.

---

## 2. Learning content (catalog)

The hierarchy is **Course → Adventure → Saga → Topic → Lesson → Lesson Document (per language)**. At every level: a record is visible to learners only when it **and all its ancestors are published**, and positions are unique within the parent.

### 2.1 Course
- **Attributes:** unique slug; title and description (multilingual); **subject** (money, math, science, economics, code, mixed); position in the catalog; **status** (draft → published → archived); **badge artwork** (required once published); **prerequisite courses** (a list; stored, not enforced by any flow); **in-progress notice** flag ("still being built": shown to learners while narration or illustrations are missing; set by an operator).
- **Lifecycle:**
  - *draft → published*: only through the **release check** (see 02 J1), which also publishes the ready children.
  - *published → draft/archived*: direct staff action.
  - *archived → published*: refused; the course must go back to draft first.
- **Current catalog (from authoring blueprints):** Financial Education (money; children), Entrepreneurship (economics; teens 12–18), Investing (money; teens 12–18), My First Lemonade Stand (mixed; a short starter course that exercises every exercise type).

### 2.2 Adventure
- **Meaning:** a themed chapter of a course.
- **Attributes:** course, position, slug, title, description, narrative arc (authoring text), **theme** (archipelago, forest, city, valley, kingdom, cosmos; drives the territory scene), **age tier** (tier 1–4), status (draft / published / archived).

### 2.3 Saga
- **Attributes:** adventure, position, slug, title, description, icon, status.

### 2.4 Topic
- **Attributes:** saga, position, slug, title, concept text, learning objective, key vocabulary, prior knowledge, status; **kind** (teaching / spaced review / interleaved review / review quest); **review-of** (the saga or topic paths a review topic revisits); **prerequisites** (paths with strength hard/soft); **placement probe** (one multiple-choice question per language, with the correct option stored server-side).
- **Rules:** review topics drive the "review due" state on the territory map. Hard prerequisites cap placement credit.

### 2.5 Lesson
- **Attributes:** topic, position, slug, title, **difficulty** (1–5), total XP, estimated minutes (default 5), cast (mentor characters), **status** (draft → review → published → archived), created at.
- **Lifecycle:** generation writes lessons in **review** → a human approves (**published**) or rejects (→ **draft**) → course release publishes all review lessons whose three language documents exist → archive (archived lessons are excluded from course badges).
- **Identity rule:** a lesson is identified by its topic and slug, so re-publishing keeps learner progress attached. Renames are declared so progress is migrated.

### 2.6 Lesson Document
- **Meaning:** the playable content of a lesson in one language (one per lesson and language).
- **Attributes:**
  - the learner-safe **document**:
    - meta: title, slug, language, subject, 1–30 estimated minutes, 1–6 objectives, 1–4 cast characters;
    - scoring: pass threshold (default 70), hint penalty (default 10% per hint, max 50), maximum attempts per exercise (default 2, 1–3), optional hearts (1–5);
    - an ordered list of **segments** (exercises);
  - the **answer keys** (server-only, never sent to a client);
  - the **audio manifest** (unit → narration audio address);
  - schema version, illustration style version, updated at.
- **Segment attributes:** id, type (one of 57, below), optional title and image, prompt (up to 4,000 characters), difficulty 1–5, XP 0–50, up to 2 hints (up to 300 characters each), explanation, narrator character and emotion, and a type-specific payload.
- **Exercise types (57 in 8 families):**
  - **Story:** story dialogue, story scene, key ideas, concept reveal, checkpoint, eavesdrop.
  - **Choice:** multiple-choice quiz, true/false, picture choice, odd one out, best decision, yes/no cases, speed tap, confidence quiz.
  - **Input:** type answer, fill in the blank, number input, estimate slider, count objects, equation builder.
  - **Arrange:** match pairs, memory flip, sort into buckets, order steps, rank choices, build sentence, timeline order, pattern complete, group sets, number line.
  - **Money:** coin count, make change, piggy-bank split, needs vs. wants, price compare, budget fit, savings goal, fair trade, interest peek.
  - **Analyze:** spot the error, cause and effect, compare table, read chart, evidence hunt, red flags, fact vs. opinion.
  - **Story-play:** story branch, dialogue choice, flash match, lightning round, would you rather.
  - **Maker:** code order, robot path, debug hunt, balance scale, measure read, machine input/output.
- **Rules:** a lesson is releasable only with exactly one document in each of the three languages. Spanish (Mexico) is the authoring language and the playback fallback.

### 2.7 Course Release Verification
- **Meaning:** an attestation that the automated course acceptance check passed.
- **Attributes:** course, verified at, list of checks (name, pass/fail, detail).
- **Rule:** release is refused when the attestation is missing or older than the latest lesson-document change.

---

## 3. Learning progress

### 3.1 Learning Statistics (one per user)
- **Attributes:** XP points, minutes learned, lessons completed, **day streak**, **longest streak**, last active date (the learner's local date of the last *passed* lesson), updated at. All counters are ≥ 0.
- **Update rules:**
  - XP increases only by the improvement over the lesson's previous best XP (replays never double-count).
  - Minutes: at least 1 per completion (max 120 per completion).
  - Lessons completed: +1 only on a lesson's first pass.
  - Streak: on a pass, same local day → unchanged (at least 1); next day → +1; otherwise → 1. Onboarding completion also counts as activity. Failing a lesson does not change the streak.
- **Access:** owner and verified guardians.

### 3.2 Lesson Segment Attempt
- **Meaning:** one graded answer to one exercise.
- **Attributes:**
  - user, lesson, segment;
  - **play-through (run) id** — attempts are counted per run, so replays start fresh; older rows without a run are lifetime-scoped;
  - attempt number (allocated by the server);
  - score 0–100, already including hint penalties;
  - hints used, time spent (0–7,200 s);
  - course, topic and **skill** (course/topic key);
  - the lesson-document version observed;
  - **diagnostic code** (initial incorrect / hint assisted / retry recovery);
  - created at.
- **Rules:** the per-run attempt count cannot exceed the lesson's maximum. Grading is serialized per user, lesson and segment.

### 3.3 Grading Receipt
- **Meaning:** the stored verdict for a specific attempt number within a run, so a network retry receives the identical verdict (including whether the answer was revealed).
- **Attributes:** user, lesson, run, segment, client attempt number (> 0), verdict.
- **Access:** server only.

### 3.4 Lesson Progress (one per user and lesson)
- **Attributes:** best score, passed (once true, stays true), number of completions, highest XP earned, last completion time.
- **Access:** owner and verified guardians.

### 3.5 Lesson Completion Receipt
- **Meaning:** the stored result of completing a specific run, so a retried completion returns the same result marked "replayed" and changes nothing.
- **Attributes:** user, lesson, run, result (score, passed, best score, XP earned, XP delta, streak values, flags such as "first today" and "first completion").

### 3.6 Course Placement (one per user and course)
- **Attributes:** claimed level (new / some / confident; default "some"), education level (preschool / elementary / middle / high / adult; default "adult"), graded quiz answers (topic and correct/incorrect), starting topic, starting lesson, **method**, created at.
- **Method values accepted by the data store:** quiz, claimed beginner shortcut, no probe content fallback.
- **Observed inconsistency:** the placement logic records the methods "adaptive quiz", "learner chose start", "learner adjusted" and "no probe content fallback". Only the last is accepted by the data store's rule, so the other three cannot be stored (see 02 D3).
- **Lifecycle:** created once per course (a second commit is refused). Never updated.

### 3.7 Placement Credit
- **Meaning:** a lesson the learner was allowed to skip because of placement.
- **Attributes:** user, lesson, topic, course, created at.
- **Rules:** counts as passed for unlocking, progress and course badges. Grants no XP and no lesson progress.

### 3.8 Course Badge (derived, not stored)
- A course badge is earned when every non-archived lesson of a published course with badge art is passed or credited. The completion time is the latest pass or credit.

### 3.9 Achievement Share (Badge Share)
- **Meaning:** a public, shareable image of a child's achievement.
- **Attributes:**
  - random token (16–64 URL-safe characters; 32 in practice), child, created by (parent);
  - **achievement kind** (course badge / streak / goal reached);
  - label (1–80), **first name only** (1–40);
  - age band (6–8 / 9–11 / 12–14; never populated);
  - image location (content hash and PNG format), created at.
- **Access:** public read by token through Core (only first name, kind, label, image).
- **Lifecycle:** created, never modified. It is deleted if the child account is deleted.

---

## 4. AI Tutor

### 4.1 Tutor Preferences (one per user)
- **Attributes:** tutor character (Dina / Liruf / Rho / Zara; default Rho); companion (optional; must differ from the tutor; defaults to Liruf, or to none when the tutor itself is Liruf); island/diorama (default "A"); lighting (auto, dawn, day, dusk, night; default auto); nickname (1–24); adaptations (subset of slower pacing, more examples, less text, more visual, repeat before advancing); updated at.
- **Access:** owner and verified guardians.

### 4.2 Tutor Voice Consent
- **Meaning:** a guardian's permission for a child to use the microphone with the AI Tutor.
- **Attributes:** child, granted by (a guardian), scope ("tutor voice"), **the exact consent wording shown** (stored verbatim), language, granted at, revoked at, revoked by.
- **Rules:** at most one active consent per child. It cannot be granted while the platform policy blocks voice for minors. Revocation is always allowed, for the guardian or the child.
- **Access:** the child, the granter and verified guardians.
- **Lifecycle:** active → revoked (history kept; a re-grant creates a new record).

### 4.3 Tutor Session
- **Attributes:**
  - user, language, **age tier** (1–3), character, companion, island;
  - **intent** (course topic / weak skill / FAQ / open chat / diagnostic);
  - course, topic and skill (optional);
  - voice used, consent record used;
  - started at, ended at;
  - **end reason** (completed / soft budget / hard budget / learner left / abandoned / consent revoked / safety stop / error);
  - turn count, activity count, XP awarded, **cost in USD**;
  - **purge-after date** (start + 90 days);
  - **summary** (topic, topic id, up to 5 skills, outcome, graded correct/total).
- **Rules:** at most 2 sessions per learner per local day (staff exempt), enforced atomically. Only the first close is recorded.
- **Access:** owner and verified guardians.
- **Lifecycle:** started (open) → ended (closed with a reason) → **deleted at 90 days** (with all turns, activities and flags).

### 4.4 Tutor Turn
- **Attributes:**
  - session, sequence number (unique per session);
  - speaker (learner / tutor / system), text;
  - emotion (neutral, happy, excited, thinking, surprised, encouraging, proud);
  - gesture (idle, jump, hop, wave, point, celebrate, nod, shake, think, dance, peek, bow);
  - audio location, source (model / scripted / speech-to-text), moderation result;
  - whiteboard drawing, demonstration steps, roleplay scene, pointer target;
  - full-text index for recall (language-aware), created at.
- **Access:** session owner and verified guardians.

### 4.5 Tutor Activity (segment served in a session)
- **Attributes:**
  - session, sequence;
  - **origin** (catalog / curated bank / live-generated), source lesson (if any);
  - exercise type, learner-safe content, **answer key** (server-only);
  - key verified (only verified keys can pay XP);
  - best score, XP awarded (never more than the activity's worth), attempts (max 3);
  - provenance (knowledge component, strategy, generation metadata);
  - **staff review status** (pending / approved / rejected; set only for sampled live activities);
  - voice-checked time, created at.
- **Rules:** the same source is never served twice in a session (atomic claim).

### 4.6 Curated Activity Pack (tutor bank)
- **Attributes:** skill, age tier, language, pack content, status (review / published / archived), released by, released at. Unique per skill, tier and language.
- **Lifecycle:** only **published** packs are used. No product flow creates or releases packs, so this tier is populated only if packs are inserted by operators directly.

### 4.7 Tutor Safety Flag
- **Attributes:** session, user, turn, **category** (self-harm, abuse disclosure, adult content, grooming pattern, personal data, injection attempt, model output blocked), severity (low / medium / high), how it was handled (scripted response / turn blocked / session stopped), created at.
- **Access:** the user and verified guardians.
- **Lifecycle:** deleted with its session at 90 days.

### 4.8 Placement Safety Flag
- **Meaning:** a safety flag raised during placement free-text intake, before any tutor session exists.
- **Attributes:** user, course, category (the first six above), severity, created at. **The learner's text is never stored.**
- **Access:** the user and verified guardians. Not subject to the 90-day tutor sweep.

### 4.9 Tutor Trajectory Step
- **Meaning:** a research log of the pedagogy controller's decisions.
- **Attributes:** session, user, turn, event kind (activity result / voice result / conversation turn / entry opened), strategy before and after, skill, scaffolding level 0–3, difficulty 1–5, probability known, misconception code, knowledge component, knowledge-component mode (new / review / probe / remediation).

### 4.10 Learner Memory Note (two per user: "learner" and "pedagogy")
- **Meaning:** what the tutor carries between sessions. The **learner** note (up to 1,400 characters) is qualitative knowledge about the person. The **pedagogy** note (up to 2,200) records what teaching works.
- **Rules:** written only by the post-session review, and only if the note still matches the text the review started from. A pair is written atomically. For **children**, the learner note is never written directly; it becomes a Memory Proposal.
- **Access:** the owner and verified guardians can read it.

### 4.11 Memory Change Ledger
- **Meaning:** an append-only record of every memory change.
- **Attributes:** user, which note, actor, hash of the text before and after, session, time. No text is stored.

### 4.12 Memory Proposal
- **Meaning:** a suggested new learner note for a child, awaiting a guardian.
- **Attributes:** child, proposed text (1–1,400), the note it expects to replace, hashes, session, **status** (pending → approved / rejected), decided by, decided at.
- **Rules:** a decision lands only on a pending proposal. An approval applies only if the current note still equals the expected note; otherwise the decision is refused as out of date and the proposal stays pending.

### 4.13 Tutor Plan (one per user)
- **Meaning:** a plan artifact the tutor saved for the learner (for example a savings plan).
- **Attributes:** content, session, updated at. Readable by the owner and verified guardians.

### 4.14 Notebook Entry
- **Meaning:** a whiteboard drawing the learner chose to keep.
- **Attributes:** user, whiteboard content, source session and turn, kept at.

---

## 5. Pedagogical knowledge model (AI Tutor "brain")

### 5.1 Knowledge Component
- **Meaning:** an atomic skill the tutor teaches and tracks.
- **Attributes:**
  - unique key; **strand** (money math / entrepreneurship); title and objective (multilingual);
  - minimum age tier (1–3);
  - mastery-model parameters: prior knowledge 0.25, learning rate 0.15, guess ≤ 0.30 (default 0.20), slip ≤ 0.10 (default 0.10) — defaults overridable per component;
  - link to a course skill (so the tutor can reuse published lessons);
  - status (draft / active / retired).
- **Seeded content (version 1):** 28 components: 16 money-math (from recognizing coins to simple interest and savings-plan math) and 12 entrepreneurship (from needs vs. wants to risk and reward). 24 are linked to course lessons.

### 5.2 Prerequisite Edge
- A prerequisite component → a dependent component (no self-loops; the loader refuses cycles). 36 edges are seeded.

### 5.3 Misconception
- **Attributes:** component, code, description, remediation hint (multilingual), distractor patterns (to recognize the misconception from specific wrong answers). 32 are seeded.

### 5.4 Learner Mastery (per user and component)
- **Attributes:** probability the learner knows the skill, attempts, correct answers (≤ attempts), optional parameter overrides, last attempt.

### 5.5 Review Card (per user and component)
- **Meaning:** a spaced-repetition schedule.
- **Attributes:** state (new → learning → review ↔ relearning), stability, difficulty (1–10), repetitions, lapses, **due date**, last review.

### 5.6 Learner Misconception
- **Attributes:** user, misconception, evidence count, last seen, resolved at.
- **Lifecycle:** opened or incremented when a wrong answer matches a misconception pattern; **resolved** when a correct answer on the same component arrives.

### 5.7 Knowledge-Component Attempt
- **Meaning:** one piece of evidence for a component.
- **Attributes:** user, component, session, activity, source (activity grade / voice check), correct, score, strategy in force (direct, worked, faded, Socratic, fluency, spaced, probe, remediate, rescue, elaborate, transfer, celebrate), misconception, probability known before and after.

---

## 6. Family Hub (chores, wallet, goals, rewards)

"Family" is not a separate entity. It is a child plus their verified guardians (the Guardian Links). The earlier stored "Family" and "Family Member" entities were removed.

### 6.1 Task (chore)
- **Attributes:**
  - assigned by (a parent), assigned to (a child), title;
  - **reward in LF Coins** (≥ 1; the API caps it at 500);
  - recurrence (once / weekly; a label only, with no automatic re-creation);
  - due date (optional; no enforcement);
  - **status** (open / done / approved / cancelled);
  - allocated (the reward has been sorted);
  - requires photo; cancellation reason (≤ 240);
  - evidence photo pointer (storage location, content hash, file type jpg/jpeg/png/webp, uploaded at; writable only by the server);
  - created at.
- **Lifecycle:**

```
open ──(child marks done)──▶ done ──(parent approves)──▶ approved ──(child sorts reward)──▶ approved + allocated
  │                            │
  └──(parent cancels)──▶ cancelled ◀──(parent cancels)──┘
```

- **Rules:** approval requires a photo when the task demands one. Photos can be attached or replaced only while open or done. Cancelled or approved tasks are final.
- **Access:** the assigner, the assignee and the assignee's verified guardians. A parent can create a task only for their own verified child.

### 6.2 Wallet Ledger Entry
- **Meaning:** an **append-only** movement of LF Coins in a child's wallet. Balances are always computed from the ledger.
- **Attributes:**
  - child, **bucket** (save / spend / share), amount (non-zero; positive credit, negative debit);
  - **reason** (task approved / goal withdrawal / redemption / manual adjustment / allowance / savings bonus);
  - linked task, goal or redemption; created by; created at.
- **Rules:**
  - Allocations must equal the reward or credit exactly.
  - Redemptions debit only the Spend bucket and require a sufficient Spend balance at approval time.
  - All wallet operations for a child are serialized.
  - "Goal withdrawal" and "manual adjustment" are permitted reasons, but no product flow produces them.

### 6.3 Savings Goal
- **Attributes:** child, title (1–80), target (≥ 1; the API caps it at 100,000), icon (star, game, toy, book, bike, trip, gift), **status** (active → reached | archived), created at, reached at.
- **Progress:** the sum of Save-bucket entries tagged to the goal.
- **Lifecycle:** active → **reached** (automatically, when progress ≥ target after an allocation) or → **archived** (by the child).

### 6.4 Reward Catalog Item
- **Attributes:** parent (owner), title (1–120), cost in LF Coins (≥ 1; API cap 500), active on/off, created at.
- **Visibility:** a child sees the active items of all their verified guardians.

### 6.5 Redemption Request
- **Attributes:** catalog item, child, **status** (requested / approved / denied / fulfilled), created at, decided at, decided by.
- **Lifecycle:** requested → approved (coins deducted) | denied. "Fulfilled" exists but is never set.

### 6.6 Chore Streak (one per child)
- **Attributes:** current streak days, longest streak days, last completion date (the child's local date).
- **Rule:** the same streak arithmetic as the learning streak, driven by marking chores done.

---

## 7. Digital Banking (educational simulation)

### 7.1 Banking Account (one per child)
- **Attributes:** child, nickname (1–40, default "My Account"), card design (indigo, emerald, violet, amber, sunrise, ocean), display card number, frozen flag, frozen by, frozen at, opened by (parent), opened at.
- **Access:** the child and verified guardians can read and update it.
- **Lifecycle:** opened → (frozen ↔ unfrozen). There is no closing flow. The frozen flag is informational; no rule depends on it.

### 7.2 Allowance Rule (one per child)
- **Attributes:** child, parent, amount (1–1,000), frequency (weekly / biweekly / monthly), anchor day (0–6 weekday for weekly/biweekly; 1–28 for monthly), active flag, next run date.

### 7.3 Savings Bonus Rule (one per child)
- **Attributes:** child, parent, rate in basis points (0–2,000 = 0–20%), active flag, next run date (weekly cadence).

### 7.4 Spending Limit (one per child)
- **Attributes:** child, parent, period (weekly / monthly), cap (≥ 1), active flag.
- **Effect:** checked when the child requests a redemption.

### 7.5 Pending Credit
- **Meaning:** an allowance payment waiting for the child to split it.
- **Attributes:** child, amount (> 0), source (allowance), source rule, allocated flag, created at.
- **Lifecycle:** pending → allocated (split exactly into the three buckets).

### 7.6 Scheduled-credit processing (behavior)
- Runs when a banking account is viewed. Up to 8 overdue allowance occurrences become pending credits, and later ones are skipped. Up to 8 overdue bonus weeks each credit floor(Save balance × rate) to Save.

---

## 8. Media and content-production records

### 8.1 Picture Asset (image cache)
- **Attributes:** unique prompt fingerprint, model, prompt, image address, file id, size, created at.
- **Purpose:** an identical request returns the cached image and costs nothing.

### 8.2 Speech Asset (narration cache)
- **Attributes:** unique speech fingerprint (text, voice, model, language, bitrate), model, voice, language type, text, audio address, file id, size, duration, MP3 bitrate, created at.

### 8.3 Generation Run / Slot / Track / Live Run / Heartbeat Snapshot
- **Run:** run id, track, course, audience register (kid/adult), parameters, summary, tokens, cost (USD), cached tokens, images generated and billed, timestamps.
- **Slot (one lesson within a run):**
  - state (planned → written → reviewed → localized → illustrated → published; or failed, with the failed-from stage; or skipped);
  - error, salvaged flag, dropped segments;
  - images generated / billed / inherited;
  - duration, judge rubric scores, review cycles, early-stopped flag.
- **Track:** a mass-generation batch across a course, with a report, a budget and a halt reason.
- **Live Run:** real-time counters (active / completed / failed / skipped / total slots, stage breakdown, tokens, cost, images). Pushed to the staff console in real time. Rows older than 2 minutes are treated as stale.
- **Heartbeat Snapshot:** the time series of live counters for progress charts.
- **Access:** service only. Live runs are readable by staff for real-time updates.

### 8.4 Email Log
- **Attributes:** provider message id, recipient address, subject, template type (default "transactional"; authentication emails are logged as "auth"), language, user, **status** (queued / relayed / ok / failed), detail, created at.

---

## 9. Analytics and consent (first-party)

### 9.1 Analytics Consent (ledger)
- **Meaning:** a guardian's consent for a child's usage analytics.
- **Attributes:** child, granted by, granted at, revoked at.
- **Rules:** append-only history. A re-grant after revocation inserts a new record. The consent is "active" when an unrevoked record exists.

### 9.2 Usage Event
- **Meaning:** one first-party analytics event.
- **Attributes:**
  - exactly one subject: **user** or **anonymous visitor**;
  - **role stamp** (anon, universal, parent, kid, bigfounder, admin, superadmin);
  - **event** (closed list of 35; see 07);
  - surface (learn, tasks, profile, tutor, family, admin, marketing, other);
  - lesson, course, segment (a restricted character set, never free text);
  - numeric value (0–86,400);
  - session id, device class, language, referrer class, ordinal;
  - **client event id** (unique; makes retries idempotent), event version (1–99);
  - occurred at (client time, accepted only within the last 30 days and up to 5 minutes ahead), received at;
  - experiment id and variant (A/B).
- **Retention:** raw events older than **400 days** are pruned daily.

### 9.3 Anonymous Visitor
- **Meaning:** a consented, first-party visitor identity before signup.
- **Attributes:** visitor id, first seen, last seen, referrer class (direct / search / social / referral / internal / campaign), campaign source / medium / name (restricted characters), landing route, device class, language, **converted user**, converted at.
- **Rules:** holds no IP address, user agent or raw referrer. Conversion is recorded once (first conversion wins) and **never for child accounts**. Unconverted visitors with no events and unseen for 400 days are deleted.

### 9.4 Internal-Traffic Exclusion
- **Attributes:** network (an address or range), label (1–80), reason (≤ 280), created by, created at, revoked at, revoked by.
- **Rules:** one active exclusion per network. Revocation keeps the record.

### 9.5 Staff Address Sighting
- **Attributes:** network address, staff user, first seen, last seen, hit count. Only admin/superadmin requests are recorded, to suggest exclusions.

### 9.6 Rollups and maintenance log
- **Daily activity rollup:** day × role × event × surface × device × language, with events, users, sessions and value totals.
- **Daily users rollup:** distinct users and sessions per day and role.
- **Maintenance log:** records of each pruning run (job, retention days, rows removed).

### 9.7 Warehouse sync state
- **Meaning:** the incremental high-water mark for the analytics warehouse feed (table, last synced at, last event id, rows synced).

---

## 10. Analytics warehouse (DuckDB) entities

Refreshed every 5 minutes from the operational store:

- **Events fact** (every usage event, with the experiment context);
- **Segment-attempt fact** (every graded lesson attempt, with skill, time and hints);
- **Users dimension** (role, locale, stats, **staff flag**);
- **Sessions dimension** (last 90 days: start, end, device, language, referrer, events, surfaces, lessons started, duration);
- **Lessons dimension** (published lessons with titles in 3 languages, course, segment count);
- **Anonymous conversions** (adult conversions only);
- **Time dimension**; daily activity and daily users aggregates;
- **Learner Skill State** (per learner and skill: mastery estimate, uncertainty, evidence count, first/last practice, review-due date, recommended action, reason).

Warehouse feature entities: **Segment Definition** (saved audience filters), **Experiment** (name, variants A/B, surface, target, status draft → running → concluded), **Experiment Assignment** (sticky variant per user), **Experiment Exposure**, **Anomaly** (metric, date, value, expected, z-score, direction, severity, resolved), **Alert** (name, metric, condition above / below / change %, threshold, channel webhook/email, cooldown, status active/paused, last triggered), **Alert History**, and **Export Job** (pending / running / complete / failed; see the observation in 07).

---

## 11. Entity relationship summary

```
User Account 1─1 Profile, 1─1 Learning Statistics, 1─1 Avatar, 1─* Role Assignment, 1─* Staff Permission
Parent ─*Guardian Link*─ Child            (verified links define the family)
Course 1─* Adventure 1─* Saga 1─* Topic 1─* Lesson 1─3 Lesson Document (one per language)
User ─* Lesson Segment Attempt *─ Lesson ;  User ─ Lesson Progress ─ Lesson (1 per pair)
User ─ Course Placement ─ Course (1 per pair) ; User ─* Placement Credit ─ Lesson
User 1─* Tutor Session 1─* Tutor Turn, 1─* Tutor Activity, 1─* Tutor Safety Flag
User 1─2 Learner Memory Note ; Child 1─* Memory Proposal ; User 1─1 Tutor Plan ; User 1─* Notebook Entry
Knowledge Component *─* Knowledge Component (prerequisite edges) ; Component 1─* Misconception
User ─ Learner Mastery / Review Card ─ Component ; User ─* Learner Misconception
Parent 1─* Task *─1 Child ; Child 1─* Wallet Ledger Entry ; Child 1─* Savings Goal
Parent 1─* Reward Catalog Item 1─* Redemption Request *─1 Child
Child 1─1 Banking Account, Allowance Rule, Savings Bonus Rule, Spending Limit, Chore Streak ; Child 1─* Pending Credit
Parent 1─* Achievement Share *─1 Child
User/Visitor 1─* Usage Event ; Visitor ─0..1 converted User ; Child 1─* Analytics Consent
```

---

## 12. Deletion, retention and archiving

| Data | Behavior |
|---|---|
| **Child account deletion** (by parent) | Hard delete. Cascades to the profile, roles, guardian links, statistics, progress, attempts, placements, tutor sessions/turns/activities/flags, memory, plans, notebook, mastery, tasks, wallet, goals, redemptions, banking, consents, events and badge shares. The audit trail of the deletion is kept. |
| **Adult account deletion** | No self-service flow. By support request only. When performed at the identity level, the same cascades apply, except that records naming the adult as an actor (audit entries, grants, "granted by" fields) keep the record with the actor cleared. Deleting a parent whose child would be left without a verified guardian is blocked while the child holds the kid role. |
| **Tutor sessions** | **Deleted 90 days after start**: turns, activities and safety flags cascade, and the session's synthesized audio files are deleted from media storage (shared scripted audio is kept). Knowledge-component attempts and trajectory steps survive with the session reference cleared. |
| **Usage events** | Raw events pruned after **400 days**. Daily rollups are kept indefinitely. Unconverted anonymous visitors with no events are pruned after 400 days of inactivity. |
| **Parent verification address** | Removed permanently, including all stored values. |
| **Retired game feature** | Tables and game-related events deleted. Historical "games" surface rolled into "other". |
| **Content** | Soft lifecycle through statuses (draft / review / published / archived). Archived lessons are excluded from badges and learner views. |
| **Consents, exclusions, voice consent** | Revoked, never deleted (history kept). |
| **Audit log, memory ledger, wallet ledger** | Append-only. |
| **Backups** | Daily full backups of the operational store and the analytics store, each kept for **30 days** (see 08). |
| **Grading/completion receipts** | Kept with the user. Removed only when the user or lesson is deleted. |

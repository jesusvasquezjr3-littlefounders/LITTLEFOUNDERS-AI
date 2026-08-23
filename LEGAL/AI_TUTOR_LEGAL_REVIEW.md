# AI TUTOR — LEGAL REVIEW BRIEF

> **Purpose.** This document describes, factually and without interpretation,
> what the AI Tutor ("Oracle") does with personal data, so that counsel can
> decide what must change in the Terms and Conditions, the Privacy Notice, the
> consent flows, and the contracts with third-party providers.
>
> **This is not legal advice and contains none.** It was written by the
> engineering side to state what the system actually does. Every question in
> §7 is open and belongs to counsel.
>
> **Status:** the feature is BUILT, and a **minor's microphone is switched off
> by an explicit policy flag** (`TUTOR_VOICE_FOR_MINORS`, default off) which
> stays off until the agreement in §6 exists. Everything else in the tutor is
> live and usable by every learner — the gate is one input method, not the
> product. Nothing in this document should be read as a claim that the
> platform is currently compliant with anything.
>
> **Prepared:** 2026-08-21 · **Owner decisions recorded in:** `/ORACLE.md` §0

---

## §1 What the feature is, in one paragraph

A learner opens a page, presses one button, and has a spoken conversation with
an animated character that teaches them. The character's replies are generated
by a large language model. On the right of the screen, interactive exercises
appear, some drawn from our own reviewed catalogue and some generated in the
moment. The conversation is transcribed and saved so the learner and their
guardian can read or replay it later. **Children may take part, and children
may use a microphone.**

---

## §2 Personal data processed, by category

### §2.1 Data that LEAVES our infrastructure

This is the section that matters most. Two external processors are involved.

| Recipient | What they receive | Why | Retention by us |
|---|---|---|---|
| **Speech provider** (Inworld, interim — see §6) | The learner's **raw audio**, including a minor's voice. The tutor's already-generated text, for synthesis. A random session identifier. | Speech-to-text and text-to-speech | The learner's audio is **never stored by us**. There is no column for it in the database. |
| **Speech provider** (same) — SEPARATE PURPOSE | The **characters' reference voice recordings**, uploaded once to create cloned voices. See §2.4. | Voice cloning, so the tutor sounds like the character the child already knows from lessons | The recordings are the owner's own assets, not learner data |
| **Language model providers** (DeepSeek as author, Qwen as safety reviewer) | A strictly enumerated context object (§2.2) plus the learner's transcribed words for the current session only. | Generating the tutor's replies, moderating them, and authoring exercises | Transcript stored 90 days (§3) |

### §2.2 The complete set of learner data sent to a language model

This list is enforced in code by a schema that **rejects** anything not on it
(`oracle/src/context/schema.ts`, `.strict()`), and is verified by an automated
gate on every build (`npm run verify:tutor`). It is not a policy; it is a
constraint.

1. **Nickname** — chosen by the learner, validated to reject full-name shapes.
   It is never derived from the account's display name.
2. **Age band** — the integer 1, 2 or 3 (roughly ≤7, ≤9, older). The date of
   birth is read inside our own systems and converted; **the date itself never
   leaves**.
3. **Language** — `en-US`, `es-MX` or `pt-BR`.
4. **Derived skill state** — for up to twelve skills: an internal skill
   identifier, an estimated mastery probability, an uncertainty figure, a count
   of prior attempts, and a recommended next step from a closed list.
5. **Course context** — the identifier and title of the published course and
   topic in play.
6. **Intent** — one value from a closed list of five.
7. **Accessibility preferences** — zero or more values from a closed list of
   five.
8. **This session's turns** — the last twenty exchanges, truncated. Never a
   previous session's.
9. **Chosen character** — which of the four cast members the learner picked
   (`dina`, `liruf`, `rho` or `zara`), so the model writes in that character's
   voice and manner. It is a product setting and says nothing whatever about
   the learner. **Added 2026-08-23**: it had been in the enforced schema since
   the runtime was built, and both this list and `/ORACLE.md` §4.1 described
   themselves as complete while omitting it. Recorded rather than quietly
   inserted, because the value of an enumerated allow-list is that it is
   exhaustive, and counsel is entitled to know that one entry was found missing
   when it was checked field-by-field against the code.

### §2.3 What is explicitly NOT sent, and cannot be

Real name, surname, email address, date of birth, exact age, home address,
city, country, school, avatar, family composition, sibling data, any other
learner's data, raw behavioural event logs, raw attempt records, and any
transcript from a previous session.

A developer who adds any of these to the context object causes a build failure,
not a silent success. **Adding a field to §2.2 requires an update to this
document** (`/AGENTS.md` §8 stewardship table).

### §2.4 Voice cloning — a separate processing relationship

**Verified 2026-08-21.** The four characters (Dina, Liruf, Dr. Rho, Zara) are
already voiced: reference recordings held by the owner are cloned per language
and used to narrate every lesson. For the tutor to sound like the same
character, those same recordings are uploaded once to the speech provider,
which returns a cloned voice identifier used thereafter.

**What counsel should know:**

- The recordings are **not learner data**. They are the owner's assets,
  performed by whoever recorded them.
- Uploading them creates a **derived voice model held by a third party**. That
  is a different question from processing a child's speech, and it turns on
  whatever rights and consents exist for the original performances.
- Twelve voices in total (four characters × three languages). Enrolment is a
  one-off operator action, never automatic.
- Cloned voices can be deleted through the provider's API; we verified that
  the deletion call works.

### §2.5 A finding: the speech provider can profile the speaker

Discovered by testing the API rather than by reading its documentation.

The speech-to-text model can return, alongside the transcript, an inferred
**voice profile**: emotion, vocal style, accent, **age** and pitch, with
confidence scores.

- Measured behaviour: it is absent unless requested, and absent when we
  explicitly disable it.
- **We disable it explicitly on every request** and log an error if a profile
  arrives anyway — "off by default" is not the same as "off", because a
  default is something a provider can change without telling us.
- No profile is ever stored, forwarded, or shown to anyone.

It is recorded here because inferring a child's age and emotional state from
their voice is a different KIND of processing from transcription, and counsel
may wish to address it in the disclosures even though we do not use it.

---

## §3 What is stored, where, and for how long

| Stored | Location | Retention | Who can read it |
|---|---|---|---|
| Conversation transcript (both sides, text) | Our own database (Supabase, self-hosted) | **90 days**, then automatic deletion | The learner; a **verified** guardian; our own service role |
| The **tutor's** synthesized audio | Our own media store | 90 days | Same |
| **The learner's audio** | **NOT STORED — anywhere** | n/a | n/a |
| Exercises served and their results | Our own database | 90 days | Same |
| Consent records | Our own database | **Indefinite** — see §4 | The learner; the granting guardian; a verified guardian |
| Safety flags (category and severity only, never the utterance) | Our own database | 90 days | The learner; a verified guardian |

Deletion is performed by a scheduled job against a stored `purge_after`
timestamp, not by manual process.

**Note for counsel on consent records:** the consent table is deliberately
append-only and retained beyond the 90-day window, because the question "was
consent in force on a particular date?" must remain answerable after the
conversations covered by it have been deleted. Counsel should confirm whether
that retention is correct, and for how long.

---

## §4 The consent mechanism

- A learner holding a **CHILD Account** cannot open the microphone until a
  **verified guardian** grants a specific, separate consent. This is a blocking
  gate in the software, not a setting.
- Consent is **specific to voice conversation with the AI tutor**. It is not
  bundled into acceptance of the Terms and Conditions, and it is not implied by
  any other permission.
- **The exact wording shown to the guardian is stored verbatim with the consent
  record**, together with the timestamp, the granting guardian's identity, and
  the language it was displayed in — so a later dispute is resolved against
  what was on the screen rather than against the current build.
- Revocation is available to the guardian **and to the learner**, takes effect
  on the next conversational turn, and never deletes the record: the row is
  closed with a revocation timestamp.
- Without consent, the tutor still works fully. The learner types instead of
  speaking, and everything else is identical.

The wording currently shown is in
`frontend/src/i18n/*/tutor.json` under `tutor.consent.body`, in all three
languages. **It has not been reviewed by counsel and should be treated as a
placeholder.**

---

## §5 Content shown to a minor that no human reviewed first

This is the second item requiring a decision, and it is a deliberate departure
from how the rest of the platform works.

Everywhere else in LittleFounders, content reaching a child has been generated
offline, passed automated gates, been read by an independent model reviewer,
and been **released by a human being**. The Tutor keeps that for most content,
but adds a third path: when a learner's topic is not covered, or when they did
not understand the standard explanation and need a different one, an exercise
is generated during the session and shown without prior human review.

**The compensating controls, all enforced in code:**

1. Only exercise types whose grading is deterministic and independently
   reproducible may be generated.
2. The generated item must parse against the platform's exercise schema.
3. Deterministic checks run: exactly one correct answer, unique identifiers, a
   teaching explanation on every wrong option, age-appropriate vocabulary.
4. A **separate model from a separate vendor** reviews it adversarially and can
   reject it.
5. Our server independently **re-derives the answer** using the real grading
   code. If it cannot, the exercise may still be shown but **cannot award any
   progress or points**.
6. The tutor's spoken words are moderated in full before they are displayed or
   spoken, and moderation failing means the words are not spoken.
7. Full provenance is recorded — which model, which prompt, which checks, which
   session — so any defect found later is traceable to every learner who saw it.
8. A sampled fraction of generated items is queued for human review after the
   fact.
9. **Anything failing any check produces nothing at all.** The tutor says so
   honestly rather than showing a generic substitute.

**What counsel should know plainly:** despite all of the above, it remains
possible for a child to be shown an incorrect or poorly-worded educational
exercise that no person approved beforehand. The controls make it unlikely and
traceable; they do not make it impossible.

---

## §6 Third-party processors

| Processor | Role | Data | Contract status |
|---|---|---|---|
| **Inworld** | Speech-to-text, text-to-speech, and voice cloning (§2.4) | Minors' raw voice audio; the characters' reference recordings | **NO AGREEMENT IN PLACE.** Required before any minor uses the microphone. Must cover non-retention, non-use for training, sub-processing, deletion, jurisdiction — and now also the **cloned voice models** derived from our recordings. |
| **DeepSeek** | Generates the tutor's replies and draft exercises | The §2.2 context; a minor's transcribed words | Existing usage across the platform; **the child-facing conversational use is new** and should be re-examined. |
| **Alibaba Cloud / Qwen** | Independently reviews the tutor's words and generated exercises for safety | One sentence or one exercise at a time, with no learner context attached | Existing usage; same note as above. |

**Engineering notes relevant to any contract review:**

- The speech provider is explicitly **interim**. It is isolated behind a single
  interface so it can be replaced with self-hosted speech processing, and an
  automated test prevents any other part of the system from referencing it. If
  a contract cannot be obtained on acceptable terms, replacing it is a
  contained change rather than a rebuild.
- The system runs fully **without any speech provider** — a supported and
  tested mode in which sessions are silent and captioned. This is the default
  configuration.
- Model providers receive no identifier that can be joined back to a person
  outside our systems. They do not receive a user id, an account id, or a
  session id.

---

## §7 Open questions for counsel

Engineering has no position on any of these.

**On minors' voice**
1. Does processing a minor's voice for speech-to-text, with no retention by us,
   require anything beyond the specific guardian consent described in §4 —
   under Mexican law (LFPDPPP), Brazilian law (LGPD, and specifically the
   children's provisions), and US law (COPPA) for any US users?
2. Is a child's voice recording biometric data in any of those jurisdictions,
   and does that change the basis required?
3. What must the contract with the speech provider contain as a minimum, and is
   any cross-border transfer mechanism required for each jurisdiction?
4. Must the guardian be able to see or hear what was captured, given that we do
   not retain it?

**On generated content**
5. What disclosure is required about content generated by AI and shown to a
   child without prior human review (§5)? Does it belong in the Terms, the
   Privacy Notice, or in-product?
6. Does the "shown but not scored" state (control 5) create any obligation of
   its own?

**On retention and rights**
7. Is 90 days appropriate for a child's conversation transcript, and is
   indefinite retention of consent records defensible as an accountability
   measure (§3)?
8. How should a deletion request interact with the guardian's visibility right?
   If a child asks for a conversation to be deleted and the guardian has not
   read it, which prevails?
9. Do the transcripts constitute an educational record under any applicable
   framework?

**On the character voices (§2.4)**
10a. Uploading the characters' reference recordings to the speech provider
     creates a cloned voice model held by a third party. What rights or
     releases are required from whoever performed those voices, and does the
     provider's contract need to cover the derived model as well as the audio?
10b. Does a synthetic voice that a child forms a relationship with require any
     disclosure of its own — that the character is not a person?

**On voice profiling (§2.5)**
10c. We disable the provider's speaker-profiling feature. Does the mere
     capability require disclosure, or is disabling it sufficient?

**On the parties**
10. The guardian consents; the child speaks. Where a family has two guardians
    and they disagree, whose decision governs? The system currently accepts a
    grant from any **verified** guardian and a revocation from any of them.
11. Is anything additional required for a `bigfounder` (verified adult) or a
    guest account that later converts into a child account?

**On the documents**
12. What must be added to the Terms and Conditions and the Privacy Notice, in
    all three languages, before this is enabled for minors? The three
    authoritative documents are in this directory and must stay in exact
    parity (`/AGENTS.md` §1.8).
13. Is the placeholder consent wording in §4 adequate, or should counsel draft
    the final text?

---

## §7b The document edits this feature will require — added 2026-08-23

Recorded now, while the reasoning is fresh, so that the day counsel answers §7
the work is a specified edit rather than a fresh investigation. **Nothing here
is drafted yet and none of it is engineering's to word.**

The three `/LEGAL/` documents are byte-parallel translations of one another and
are the single source of truth (`/AGENTS.md` §1.8). Any change lands in all
three in the same commit, followed by `npm run legal:sync`, which regenerates
the `marketing.json` legal sections. Never hand-edit those.

**Terms & Conditions — `TERMINOSyCONDICIONES.md` / `TERMSANDCONDITIONS.md` /
`TERMOSDECONDIÇÕES.md`:**

| Chapter | What has to change |
|---|---|
| §8 Artificial intelligence and content personalization | Today it describes generated *course* content, published by a human. The Tutor generates **live, in the moment, for one child, with no human between the model and the screen** (§5 of this brief). That is a materially different processing activity and §8 does not currently describe it. |
| §5 Child accounts and parental control | Must name the microphone as a separate, separately-consented capability, and state that a guardian may withdraw it at any time and that withdrawal takes effect on the next turn. |
| §6 Educational experiences | Should name conversation retention (90 days) and the guardian's right to read the full transcript, which is a product invariant rather than a setting. |
| §12 Personal data protection | Cross-reference the privacy notice's new speech-provider section rather than restating it. |

**Privacy notice — the corresponding chapters in the same three files:**

- **A new processor.** The speech provider receives a child's **voice**, which
  exceeds every other third-party disclosure the platform makes. §2.1 and §6 of
  this brief have the specifics, including the §2.5 finding that the provider
  is technically capable of speaker profiling and that we set
  `enableVoiceProfile: false` on every call.
- **Voice cloning is a separate relationship** (§2.4) — the four characters'
  voices are cloned from the owner's own reference recordings, not from any
  learner's audio. Worth saying explicitly, because "voice cloning" in a
  children's product invites exactly the wrong assumption.
- **Retention, stated as a promise with a mechanism.** 90 days, rows *and*
  audio, with the sweep named.
- **What is never sent** (§2.3) is as load-bearing as what is, and reads better
  as an affirmative list than as an absence.

**The consent text itself** (`tutor.consent.body`, three locales) is the
smallest artefact and the highest-stakes: it is stored verbatim with every
consent row and a dispute is resolved against it. The placeholder currently in
the repository is engineering's plain-language description of the processing —
useful as a starting brief for counsel, **not** as wording to ship.

> Until all of the above lands, the consent surface refuses to collect anything:
> the control shows the reason instead of a switch, and `POST /tutor/consent`
> answers `409 POLICY_BLOCKED`. See `/ORACLE.md` §16. So this work gates a
> minor's microphone; it does not gate the Tutor.

---

## §8 What engineering commits to

- No field is added to §2.2 without updating this document in the same commit.
- The feature is not enabled for any minor until §16 of `/ORACLE.md` is fully
  satisfied, including the speech-provider agreement.
- If counsel requires a change to retention, consent wording, or the disclosure
  of generated content, those are configuration and copy changes, not
  architectural ones — with one exception: **removing the ability to generate
  content live for minors (§5) would remove a capability the owner explicitly
  asked for**, and should be raised with the owner rather than treated as a
  routine change.

---

## §9 Where the implementation lives

Provided so counsel's technical reviewer can verify any statement above.

| Claim | File |
|---|---|
| The enumerated model context and its enforcement | `oracle/src/context/schema.ts` |
| The automated gate proving it | `oracle/scripts/verify-tutor.ts` |
| Consent gate, storage and revocation | `database/migrations/0047_tutor_oracle.sql`, `backend/src/routes/tutor.ts` |
| Absence of any storage for the learner's audio | `database/migrations/0047_tutor_oracle.sql` |
| Retention job | `purge_expired_tutor_sessions` in the same migration; scheduled by `.github/workflows/tutor-retention.yml`, which deletes the stored audio too |
| Generated-content controls | `backend/src/services/tutorLadder.ts`, `oracle/src/content/generate.ts` |
| Moderation before display and speech | `oracle/src/safety/moderation.ts` |
| Speech-provider isolation | `oracle/src/voice/`, and the test in `oracle/src/__tests__/boundaries.test.ts` |
| Guardian visibility | `backend/src/routes/tutor.ts` (`/tutor/kids/:id/sessions`); the surface is `frontend/src/routes/app/family/KidTutorPage.tsx` |
| The consent flow a guardian actually sees | `frontend/src/tutor/VoiceConsentControl.tsx` — shows the wording before it is agreed to, and sends that rendered string |
| That no consent can be collected while the policy is closed | the same file (the surface) and `backend/src/routes/tutor.ts` `POST /consent` → `409 POLICY_BLOCKED` (the record). Two independent guards; revocation is gated by neither |

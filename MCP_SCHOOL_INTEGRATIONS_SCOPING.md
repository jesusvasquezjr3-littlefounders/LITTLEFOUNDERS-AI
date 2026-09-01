# MCP / School Integrations — Scoping

> Backlog investigation, 2026-09-01, one lane of the Tutor (Oracle) harness
> backlog push. **Authority: this document is a scoping analysis, not an
> architecture decision.** It carries no rank under `/AGENTS.md` §1.1 and
> changes nothing by existing. On any conflict with an invariant, `/AGENTS.md`
> wins and the conflict is surfaced, never resolved silently (§1.0.1).
>
> **Status: NO CODE BUILT, ON PURPOSE.** Both plausible readings of the
> backlog line require a decision this lane cannot make on its own — a
> business decision, a legal review, or a role-model change, each gated by
> `agent/core/BOUNDARIES.md` (§8 below). This document is the deliverable.
> When the owner rules, extend this file in place rather than starting a new
> one — do not let the decision live only in a commit message.

---

## §1 Where this backlog line comes from

`ROADMAP.md` line 261 reads, in full:

> "Remaining harness phases (trajectory emission, the simulated-student gym,
> the skill destiller/curator loop, Honcho-style dialectic memory, MCP/school
> integrations) are BACKLOG in the harness doc's own order, each gated on the
> same governance §15.1 rule: nothing autonomous reaches a child."

"the harness doc" is the owner's `tutor-ia-harness-v2.md` — the document
`ROADMAP.md`'s V4 entry (line 259) names as the source of the entire
bicameral rewrite ("patterns, not code... the document's own option A").
It is **not tracked in this repository**; this analysis reads the owner's own
copy directly, because the four-word backlog phrase alone under-specifies the
question badly enough that answering from the phrase alone would be a guess,
not an investigation. Where this document quotes that source, the original is
in Spanish and the translation is mine (English-only per `/AGENTS.md` §1.0
rule 4). Anyone re-verifying this analysis needs that file, not just this repo.

**One numbering collision worth flagging once, so nobody chases the wrong
section:** the backlog line's "governance §15.1" and `ORACLE.md` line 2474's
"**Governance (§15.1 of the harness doc): nothing autonomous reaches a
child**" both mean the harness doc's OWN §15.1 ("El principio: nada autónomo
llega a un niño"). `ORACLE.md` also has its own, unrelated §15.1
("Speech — bought once, not once per child", line 1781). Same number, two
different documents, two different topics.

## §2 What MCP is, in one paragraph

The Model Context Protocol is an open, JSON-RPC-based standard for connecting
an AI model to external tools and data sources through one common interface:
an "MCP server" exposes callable tools and/or readable resources, and any
MCP-aware client can discover and call them without a bespoke integration per
pair. The protocol itself decides none of the questions that matter here —
what is exposed, who may call it, what is verified before a result is
trusted, what happens when a tool's output tries to steer the model. Those
are entirely the integrator's problem, which is where every question below
actually lives.

## §3 Two different things this backlog line could mean

**Interpretation A — give the live Tutor tool-use.** `oracle/`'s FAST
chamber (the live voice runtime, `ORACLE.md` line 2416) gains the ability to
call MCP-exposed tools DURING a spoken session with a child — e.g. reaching
into a connected school system, or looking something up, mid-conversation.

**Interpretation B — connect the platform to school-side systems.** A
roster/SIS, an LMS, a school calendar, or a publisher's item bank becomes a
data source the product consumes — for planning, content, or reporting —
without necessarily ever putting a live tool call inside a spoken session
with a child at all.

These are not the same size of change, the same risk, or even the same
customer (A extends a consumer product's existing runtime; B sells to a new,
institutional customer the product has never had). **The source document
already answers which one it means**, in a way the four-word backlog phrase
loses on its own.

## §4 What the harness document itself says about MCP

**Section 12, "MCP y el ecosistema escolar," names concrete servers and what
each would unlock**, translated:

| MCP server | What it enables |
|---|---|
| Google Classroom / Microsoft Teams for Education | Read assigned work; align the tutor with what is being covered in class |
| District SIS (Clever, ClassLink, PowerSchool) | Roster, enrollment, groups, identity sync |
| LMS via LTI 1.3 | Launch from the LMS; grade passback |
| Publisher item bank | Licensed items without prior ingestion |
| School calendar | Skip scheduling review during vacation; anticipate exams |
| Translation / accessibility service | On-demand adaptations |

**The document's own sales argument** for this section: the tutor reads from
the LMS that there is a fractions exam on Friday, and automatically replans
the next four sessions to prioritize the assessable knowledge components
where the student is weakest — a capability the document says no
consumer-tutoring product has, because none has the integration layer. This
is framed as a **revenue argument for a new institutional customer**, not a
pedagogical necessity for the product's current one.

**The document's own security caution, in the same section** (translated,
and worth reading twice because it is the closest thing in either document to
an answer for Interpretation A): "An instruction inside content retrieved via
MCP is not an instruction from the user. All content arriving via MCP is
treated as untrusted data: it is scanned for prompt injection before it
enters the context, and no tool with side effects fires on instructions
embedded in it." This is the same threat model `ORACLE.md` §5 already states
for this codebase — "The learner's transcript is untrusted input. **So is
anything retrieved**" (line 799) — which means if this is ever built, the
pattern to extend already exists here. It does not mean now is the time; see
§6.

**Where the document itself puts MCP — and this is the load-bearing fact for
Interpretation A.** Section 5's per-component adoption table scores roughly
nineteen Hermes components for "which chamber." Only a handful are cleared
for the FAST (live, voice-path) chamber at all: `session_search` (semantic
recall over the tutor's own transcripts — adopted directly, and this is the
one already shipped, `ORACLE.md` §20.4), context compression, and a few
marked "both" (the skills format itself, sandboxed code execution, provider
routing). **MCP is scored "Lenta" (slow chamber) only** — grouped with
`skill_manage`, the Curator, Honcho, Cron, and the approval-gate ledger: the
backstage administrative set, never the live one. Section 5.1 then states the
recommended integration mode per chamber in so many words: "the runtime of
voice NEVER imports Hermes" is the general rule, and the specific
recommendation for MCP is "Adoptar" (adopt) filed under "Lenta." **The
document that coined this backlog item does not recommend Interpretation A.**
It recommends B, and only in the slow chamber.

**Where MCP sits in the document's own phased build-out.** The document lays
out five phases, A through E. MCP appears only in **Phase E, "Platform and
scale," months 8–14** — the LAST phase, alongside a private skills hub for
publishers/districts, a visible in-product sandbox, a parent messaging
gateway, and the first fine-tune on high-reward trajectories. The document's
own incremental team estimate for this build — one agent-platform engineer,
one ML/data engineer, one senior instructional designer, half an SRE, at an
estimated $380k–$620k — is stated to cover **Phases A–D only**; Phase E,
where MCP lives, has no cost estimate in the source document at all, and by
the document's own ordering runs strictly after A–D, not alongside them.
Phase A ends on an explicit decision gate ("do the hand-written maneuvers
measurably improve sessions over the current prompt? If not, the problem is
the pedagogy, not the infrastructure"); Phase C ends on another ("does the
simulated-student gym predict real outcomes at correlation > 0.6? If not, it
cannot be used to decide anything"). Phase E is gated behind both, not just
behind a calendar.

**Where this project actually is against that plan, by my own comparison —
not a fact either document states outright.** `ROADMAP.md` line 259 (sprint
1/2, 2026-08-29) shipped pedagogical skills, the controller-conversation
wiring, learner memory, the session dossier, episodic recall, and the
whiteboard. Matched against the source document's own phase bullets, this
lands mostly in Phase A with pieces of Phase B pulled forward early
(episodic recall over Postgres FTS is a Phase B bullet, shipped in what
`ROADMAP.md` calls sprint 1). It is also, on the metric the document itself
picked, short of its own Phase A bar: 15 hand-written maneuvers shipped
against the document's stated Phase-A decision gate of 30. However close or
far that puts the project from a real Phase A/B boundary, **it is nowhere
near Phase E**, and Phase E's own decision gates (A's and C's, above) have
not been reached, let alone passed.

## §5 What each interpretation would require here — read from the code, not guessed

### §5.1 Interpretation A — live tool-use inside a session

This is not merely unbuilt; it is a **deliberate absence**, written down as
architecture rather than left as a gap:

- `oracle/src/tutor/turnSchema.ts` lines 47–55, on the model's only output
  channel: "There is deliberately no `redirect`, `fetch`, `remember` or
  `escalate`: **the model has no tools with side effects (§5 layer 3), so it
  has no verbs for them either.**"
- `ORACLE.md` §5 (line 794 on), the prompt-injection defense stack, layer 3
  of 7: "**No tools with side effects.** Oracle's model has no write access
  to anything: not the database, not roles, not another learner, not the
  file system, not the network. The only thing it can do is propose a turn."
- `oracle/AGENTS.md` §1 (lines 14–26): "Oracle has **no database
  credentials** and a test asserts it imports no database client. Every fact
  about a learner arrives through `src/core/client.ts`, already resolved and
  already scoped to one person... That is not caution, it is architecture:
  there is exactly **one file** to read to know everything Oracle can
  possibly learn about a child."

A live MCP client inside the FAST chamber would open a **second** channel
through which the model's context is populated — one dynamic, third-party,
and outside the sealed-context test (`oracle/AGENTS.md` §2.1,
`src/context/schema.ts`, `.strict()`) that today makes "one file" true. It
would also need a new verb on the turn schema for the model to request a
call, meaning layer 3 of the injection stack stops being true the day this
ships, and layer 1 (closed structured output) — the layer the same section
calls the one that "does the most work" — would need a new escape hatch
designed with the same rigor the existing seven layers already got, including
canary tests (layer 7) for whatever new injection surface a tool result
becomes. None of that is impossible; all of it is a real, non-trivial
extension of a currently load-bearing security design, not a plug-in.

**No concrete pedagogical need for this was found anywhere in this
codebase's own documentation.** Everything the live tutor currently needs is
either server-computed (deterministic voice-check grading, the whiteboard's
server-recomputed values, `ORACLE.md` §20.5) or drawn from a closed catalog
through the three-tier content ladder (`ORACLE.md` §7). The one place this
codebase already reaches outside the current turn for information —
episodic recall — is instructive precisely because of how narrow it had to
be kept even so; see §7.

Under `/AGENTS.md` §1.9 and `agent/core/BOUNDARIES.md` item 4, any change
here is "child-data handling" and requires explicit human sign-off before
merge, not just before deploy.

### §5.2 Interpretation B — school-side systems (SIS / LMS / gradebook)

Read against what this codebase actually has today:

- **Roles are closed at exactly six, at the database level, not just by
  convention.** `database/migrations/0001_identity.sql` line 22:
  `role text NOT NULL CHECK (role IN ('universal', 'parent', 'kid',
  'bigfounder', 'admin', 'superadmin'))`. There is no `teacher`, `school`, or
  `district_admin` role, and adding one is a migration against a live CHECK
  constraint, not a config flag. `/AGENTS.md` §1.3–§1.4 lists exactly six
  roles as a schema invariant; `agent/core/BOUNDARIES.md` item 3 names
  "anything touching the 6-role model" as requiring human sign-off before
  merge, by itself, independent of everything else in this section.
- **The product has no institutional/B2B concept anywhere.** `PRODUCT.md`
  (the canonical product summary) describes the platform in one register:
  "Financial-literacy learning platform for **families**. Kids learn money
  skills... parents (Tutors) manage kid accounts... Six roles; everyone signs
  up as `universal`." There is no billing entity, account type, or
  onboarding flow for a school or district anywhere in this repository.
  Selling to schools is a new customer segment, not a new feature for the
  existing one — and `ROADMAP.md`'s own "Open decisions" table (line ~395)
  has never once raised the question of whether the product should be sold
  to institutions. This has not been decided against; it has simply never
  been asked.
- **No FERPA groundwork exists.** `LEGAL/AI_TUTOR_LEGAL_REVIEW.md` is
  thorough on the questions this product already has — third-party AI
  processors, voice-to-a-third-party, ungated generated content shown to a
  minor (§§1–9 of that document) — and has zero mentions of FERPA, a
  district, a classroom, a gradebook, a roster, an LMS, or an SIS (grepped;
  zero hits). FERPA (US student education records, held by or shared with a
  school) is a **different, largely non-overlapping legal regime** from the
  COPPA-style minor-consumer-privacy analysis this document already contains.
  A roster sync alone means a new class of PII enters our infrastructure —
  other people's children, via a school, not via a parent's own consent flow
  — with no existing consent mechanism (`LEGAL/AI_TUTOR_LEGAL_REVIEW.md` §4)
  designed for that relationship.
- **This is simultaneously four separate `agent/core/BOUNDARIES.md` items,**
  not one: #2 (a new service or dependency — an MCP client/SDK, or a new
  `integrations/` surface), #3 (role/permission logic), #4 (child-data
  handling — a roster is other families' children's data), and #8
  (outward-facing actions — a live connection to a third party's system).
  Any one of these already requires an explicit human yes before merge;
  this interpretation trips all four simultaneously.

## §6 Why neither is a small next step today

Both interpretations fail the same test this push's own brief sets: "the
smallest real, working, tested, genuinely useful piece." Interpretation A's
smallest honestly-scoped version still requires redesigning a **named,
load-bearing layer** of the injection-defense stack (§5.1) with no concrete
use case motivating it. Interpretation B's smallest honestly-scoped version
still requires a **role-model change, a new legal regime, and a
go-to-market decision** before the first line of integration code would even
have a customer to serve. Neither is "small"; both are "first, someone with
the authority to make that call has to make it" — which is exactly what
`agent/core/BOUNDARIES.md` exists to route around an engineering lane
deciding on its own.

This also matches the harness document's own governance frame (§15.1,
translated): "publish generated content," "change the sequencing policy," and
"change the voice-path model" all sit on the REQUIRES-HUMAN-APPROVAL side of
its hard boundary, never the autonomous side. A live tool call whose result
can shape what the model says next, mid-session, to a child, is closer in
kind to those three than to the AUTONOMOUS side's "analyze trajectories" or
"run evals" — it is a new way for something outside today's reviewed content
pipeline to influence what a child hears.

## §7 The one precedent this codebase already has, and what it teaches

The closest existing analog to "give the live model an outside data source"
is episodic recall (`ORACLE.md` §20.4, migrations `0053`–`0054`), and its
history is directly relevant evidence, not just background: it is
**server-triggered** (a closed phrase list, never the model deciding to call
anything), **first-party only** (the learner's own past transcripts, nothing
external), and reads data that **already passed this platform's own safety
classification once, going in**. Even with all three of those constraints —
none of which an MCP tool call to a third-party school system would have —
adversarial review still found two real defects in it the same week it
shipped: a flagged, previously-blocked piece of a child's PII could be
recalled verbatim into a future model request, and the post-session review
call that writes to long-term memory had no injection fence at all on a
whole transcript. Both were closed with real fixes and tests
(`ORACLE.md` §20.4 documents both in full), but the lesson generalizes
directly: this codebase's narrowest, most controlled, most first-party
possible version of "let the live model see something outside its own
turn" still shipped with two real child-safety defects. An MCP tool call —
dynamically loaded, third-party, over data this platform does not control
and has never classified — starts from a strictly harder position on every
one of the three axes that made episodic recall's defects find-able and
fixable at all.

## §8 Recommendation

**Do not build code toward either interpretation now.** This document is the
deliverable this lane produces.

1. **Interpretation A (live tool-use) — do not pursue without a concrete
   pedagogical need first.** None was found anywhere in this codebase's own
   documentation. If one is ever identified, it should be scoped and
   reviewed as its own change to the injection-defense stack (`ORACLE.md`
   §5), explicitly, rather than folded into "school integrations" — they are
   different capabilities with different risk shapes, and the source
   document itself never recommends this one for the live chamber.
2. **Interpretation B (school-side systems) is the one with an actual
   product/business case in the source material** — the document's own
   framing is explicitly a revenue argument for a new institutional
   customer. It is real, but it is a **business decision first, an
   engineering task second**: whether LittleFounders sells to schools and
   districts at all is a question that has never been raised in this
   repository, let alone answered, and it changes the shape of sales,
   support, pricing and legal exposure well beyond what any one integration
   PR could contain.
3. **Neither is ready for even a proof-of-concept today.** A PoC for B would
   need to touch the role model or invent a parallel identity concept
   outside it — both of which `agent/core/BOUNDARIES.md` explicitly reserves
   for human sign-off — and a PoC for A would need to compromise the one
   security property (`oracle/AGENTS.md` §1: "no database credentials...
   exactly one file") that currently makes Oracle's privacy story simple
   enough to audit in one sitting.
4. **If/when the owner decides B is worth pursuing**, §9 below is the
   sequencing this document recommends, based on what the source document
   and this codebase's own existing patterns already establish. It is not a
   commitment or a plan of record — nothing here is authorized by this
   document alone.

## §9 If the owner decides to pursue Interpretation B — recommended sequencing

Not a design; a sequence, each step blocking the next, mirroring how this
codebase already gates its two existing highest-stakes changes (the kid
microphone and live-generated content to a minor, both `/ORACLE.md` §0):

1. **Owner decision that institutional/school sales is a direction worth
   pursuing at all**, independent of any engineering work — this is a
   go-to-market bet, not a technical one, and the source document frames it
   as a distinct revenue line with its own team and budget (§4 above).
2. **A new legal review, separate from `LEGAL/AI_TUTOR_LEGAL_REVIEW.md`**,
   scoped to FERPA and to whatever data-sharing agreement a first pilot
   school or district would require — the same kind of blocking prerequisite
   `/ORACLE.md` §16 already made the Inworld DPA for kid voice. This is
   counsel's work, not engineering's.
3. **A role-model decision**, `agent/core/BOUNDARIES.md` item 3: how a
   teacher or school-admin account relates to the existing six-role,
   family-centric model — a new role, a new account type outside the role
   system entirely, or something else. This needs an explicit decision
   before any migration is written, not a lane's best guess.
4. **Only then**, an MCP-or-equivalent integration to a single pilot
   school's SIS/LMS, kept entirely inside the SLOW chamber as the harness
   document itself recommends (§4 above) — never inside a live voice
   session — with the same "anything retrieved is untrusted" treatment
   `ORACLE.md` §5 already gives learner speech, and with any content it
   surfaces to a learner routed through the existing three-tier content
   ladder and judge (`ORACLE.md` §7), never displayed or spoken directly
   from a third-party response.

## §10 What this lane deliberately did not build, and why

Per this push's own instruction not to dress up guessing as progress:

- **No new role, migration, or schema change.** Adding a `teacher`/`school`
  role without an owner decision is exactly the "pure guessing dressed up as
  progress" this push's brief warns against, and it is independently
  boundary-listed (§5.2 above).
- **No MCP client library, SDK dependency, or `oracle/src/integrations/`
  stub.** A speculative interface with nothing real behind it is the
  "architecture beyond what the task requires" `/AGENTS.md`'s own philosophy
  (echoed in this push's brief) tells agents not to build.
- **No new `TutorContextSchema` field.** Per this push's own instruction: if
  not confident a new field reaching the model is safe and necessary, do not
  add it. Nothing in this investigation identified a safe, necessary field
  to add.
- **A different, unrelated idea was considered and rejected: exposing this
  platform's OWN admin/analytics data as an MCP *server*** (inverting the
  direction — an external assistant querying us, rather than us querying a
  school). This is a materially different scope from "school integrations"
  (it does not touch schools at all), was not implied by the backlog line or
  its source document, and would itself be a new outward-facing surface
  (`agent/core/BOUNDARIES.md` item 8) with its own review needs. Noted here
  so it isn't silently reinvented later as if it were this backlog item —
  it is not.

## §11 A related, equally unscoped thread noticed along the way

`ORACLE.md` line 2409, in the v3 "Deferred, explicitly" list, names **"the
teacher console"** as one increment not built, with zero elaboration anywhere
else in the repository (grepped; the only mention). It is plausibly related
to whatever "school integrations" eventually becomes — a school-facing view
is a natural companion to a school-facing data connection — but it is a
**separate backlog phrase, from a separate document section, assigned to no
lane in this push**. Flagged here for whoever eventually scopes school-facing
work, not scoped by this document: investigating it was out of bounds for
this lane's brief (MCP/school integrations specifically), and guessing at
what "the teacher console" means would repeat the exact mistake this document
exists to avoid.

---

**Cross-references for whoever picks this up:** `ROADMAP.md` line 261 (the
backlog line itself — recommend it come to point at this file once
reviewed); `doc_map.md` (routing entry added alongside this document);
`agent/core/BOUNDARIES.md` (every sign-off this document invokes);
`ORACLE.md` §5, §7, §20.4 (injection defense, content ladder, episodic
recall precedent); `oracle/AGENTS.md` §1, §2.1 (what Oracle deliberately is
not; how a context field is added); `LEGAL/AI_TUTOR_LEGAL_REVIEW.md` (the
existing legal analysis this would need a FERPA-scoped sibling to, not a
patch to).

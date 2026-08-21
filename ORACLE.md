# ORACLE.md — The AI Tutor (Oracle)

> **Authority:** engine spec (/AGENTS.md §1.1 #6). This document is authoritative
> for the Tutor's product flow, its privacy contract, its content strategy and
> its safety posture. The 3D STAGE it renders on is `/TUTOR_3D.md`; the exercise
> contract it composes is `/LESSON_ENGINE.md`; the generation pipeline it borrows
> is `/COURSE_ENGINE.md`. On conflict with /AGENTS.md or DESIGN.md, those win and
> this file gets fixed.
>
> **Status (2026-08-21):** BUILT. `oracle/` (the runtime), migration `0047`,
> Core's `/api/v1/tutor/*` surface and the `/tutor` product experience all
> exist and pass their gates. **NOT ENABLED FOR MINORS** — §16's checklist
> gates that, and its first item is a data-processing agreement that does not
> yet exist. Legal review in progress:
> `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md`.
>
> Where this document and the code disagree, the code is right and this
> document is the bug — §3.1 and §7.3 were corrected once already for exactly
> that reason (see the note in §7.3).
>
> **Last updated:** 2026-08-21 · Language: English (project rule).

---

## §0 Decision record — 2026-08-21, owner

These eight decisions were taken by the owner in a dedicated design session, in
answer to conflicts surfaced under /AGENTS.md §1.0.1. They are recorded here
because several of them override defaults written elsewhere in the project, and
an override that is not written down becomes an accident six months later.

| # | Decision | What it overrides |
|---|---|---|
| 1 | **Kids may use the microphone from v1**, behind an explicit parental consent gate. | §1.9's "no PII of minors to third-party AI APIs" — a voice stream far exceeds "age band + first name". Superseded by an explicit owner decision, NOT by reinterpretation. |
| 2 | **Inworld is the VOICE layer only** — STT and TTS. The pedagogical model stays DeepSeek/Qwen inside our infrastructure. | §1.2 stack-of-record addition (owner sign-off given). v1 design rule #3 ("nothing new"). |
| 3 | **Content is a three-tier ladder:** published-catalog composition → pre-generated bank → **live generation when the topic is uncovered or the learner needs a different explanation.** | The v1 rule "all kid-facing content passes human publication before display". Live generation for a minor is validated by deterministic gates + automatic judge only. This is the largest §1.9 exception in the project. |
| 4 | **All four characters are selectable as the speaking tutor**, accepting that `liruf` and `dina` have static mouths. | The recommendation in TUTOR_3D.md §3.1. Mitigation in §2.2. |
| 5 | **Tutor lessons award full XP** through server-authoritative grading in Core. | Nothing — but it raises the bar on §7.3: a generated answer key must survive re-execution before it can pay XP. |
| 6 | **Adaptation is offered, never imposed:** an explicit profile setting, plus the tutor asking "shall I explain it another way?" when it detects friction. | Nothing — it implements the existing prohibition on labelling a learner. |
| 7 | **Real-time audio is proxied through our own service**, never browser→provider direct. | Adds `oracle/` as a new service (§1.5). See §3.2 for the one open sign-off. |
| 8 | **Persistence: transcript + the tutor's audio.** The child's audio transits for STT and is **never stored.** | Nothing — it is the tighter of the available options. |

**Assumptions taken by the implementer**, correctable at any time and listed
here so they are visible rather than buried in code:

1. The diorama picker is **catalog-driven**; it works with two dioramas and with
   twenty. Commissioning more is content work, not code work.
2. The model **never receives a real name.** The learner picks a **nickname**
   during personalization; that is the only name-shaped value that travels.
3. **Retention: 90 days** for transcripts and tutor audio, then automatic delete.
4. A verified guardian can read their child's full transcripts. Always.
5. **Session budget:** soft close at ~15 minutes, hard stop at 25, two sessions
   per day. Starting numbers, to be calibrated against real use.
6. **Moderation is per-turn, not per-token:** the whole turn is generated,
   moderated, and only then spoken. Decision 7 is what makes this affordable.

---

## §1 What Oracle is

A learner opens `/tutor`, sees their own personalized island with their chosen
character on it, presses one button, and has a spoken, adaptive lesson with a
tutor who knows what they have been struggling with.

The flow, in the order the learner experiences it:

1. **Personalize** (§10) — who am I talking to, where are we, what does it look
   like. Persisted; the second visit skips straight to step 2.
2. **Begin** — one button. Nothing before it requires reading.
3. **Introduce and offer** (§9.2) — the camera closes in, the tutor greets the
   learner by their nickname and offers a small, closed set of ways to start: a
   topic from a course they are taking; a skill Data Intel says is weak; a
   frequent question; or "something else", which opens a conversation rather
   than a free-text form.
4. **Converse and teach** (§9.3) — the Synthesis-style split: the character
   speaks on the left with their dialogue rendered **above their head** (a
   deaf-accessibility requirement, not a nicety) and mirrored in a 2D chat
   bubble where the character's own head articulates; on the right, the Lesson
   Engine runs **live**, one segment at a time, chosen or generated for this
   learner.
5. **Close kindly** (§9.5) — a session ends on a budget, warmly, with a recap
   and a reason to come back. Never a hard cut.
6. **Replay** (§12) — the session is saved and can be replayed later.

**What Oracle is not.** It is not a chatbot with a 3D avatar bolted on. The
conversation exists to drive the lesson; the lesson is the product. A session
that produced only talk produced nothing.

---

## §2 The stage — what exists, and the four gaps

`/TUTOR_3D.md` §7b is the integration contract and it is DONE. `TutorStage`
takes `character`, `companion`, `emotion`, `action`, `actionKey`, `speechUrl`,
`onSpeechEnd`, `idleFraming` and `onReady`. Hand it a speech URL and it plays
the audio, drives the mouth from that audio, and closes the camera in for as
long as the character is talking. Wiring Oracle is passing props, not reaching
into the scene.

### §2.1 The four gaps between "stage" and "tutor" — ALL CLOSED

| Gap | What shipped |
|---|---|
| **Diorama choice** | `TutorStage` now forwards `scene` to `TutorScene`, which had always accepted it. The prop was simply missing, so the product could not offer an island the scene lab had been switching between for weeks. |
| **Captions over the head** | `frontend/src/tutor/SpeechCaption.tsx` — a billboarded HTML overlay ON the canvas, never scene geometry. Text in WebGL is a font-atlas problem (glyph coverage for three locales, hinting, subpixel rendering) that buys nothing here, because the caption always faces the viewer anyway. A div gets real text rendering, real selection, real screen-reader output and real i18n for free. It reveals with a typewriter for sighted readers while `aria-live` announces the COMPLETE sentence — announcing the animating slice would stutter it two characters at a time. |
| **Streamed speech** | Oracle writes each turn's audio to Depot and hands over a URL, which is the simpler of the two options the design left open. Revisit only if the round trip is MEASURED to hurt. |
| **Per-character framing** | `TutorStage` gained `speakingFraming`. `rho` and `zara` close in; `liruf` and `dina` stay at the island shot (§2.2). |

### §2.2 The static-mouth mitigation (decision 4)

TUTOR_3D.md §3.1 closed mouth cards for `liruf` and `dina` after exhausting six
techniques; the only remaining route was texture surgery on a fragmented UV
atlas, rejected as likely to visibly damage two characters that currently look
good. The owner has chosen to ship them as speaking tutors anyway. Three things
make that acceptable rather than broken:

- **They frame wider.** Their `conversation` framing keeps more of the body in
  shot, so the eye reads posture and gesture rather than a still mouth.
- **The 2D bubble carries the articulation.** `CharacterActor` already takes
  `speaking`, and the 2D SVG characters animate their own mouths from it. The
  bubble is where a learner's eye goes while reading anyway.
- **Gesture load increases.** They get an action on more turns than `rho` and
  `zara` do, because posture is the only speech channel they have.

If this reads as broken in the first real screenshot pass, the fallback is
decision 4's alternative — keep them selectable but never close the camera on
them — and that is a props change, not a rebuild.

---

## §3 Architecture

### §3.1 A new service: `oracle/` (codename Oracle), port 4009

Everything generative in this platform already lives outside Core: Forge, Echo,
Prism, Data Intel. Oracle joins them, for those reasons plus two of its own:

- Core's §1.14 rule is that **liveness must not depend on optional
  infrastructure.** A long-lived audio relay inside Core couples `GET /health`
  to a websocket workload and a third-party provider. That exact coupling took
  the platform down once already.
- Oracle's scaling profile is nothing like Core's: few connections, each long,
  each holding a model context.

```
browser ──HTTPS──> Core          (auth, profile, personalization, grading, XP)
   │                 │
   │                 ├──internal──> Data Intel   (derived skill state)
   │                 └──internal──> Oracle       (session mint, transcript read)
   │
   └──WSS──────────> Oracle       (audio in/out, turns, segment proposals)
                       │
                       ├──internal──> DeepSeek          (the tutor's words,
                       │                                 and tier-3 drafts)
                       ├──internal──> Qwen              (independent moderation
                       │                                 + exercise review)
                       ├──internal──> Inworld           (STT + TTS only)
                       └──internal──> Depot             (tutor audio storage)

**Forge is deliberately NOT on that list.** The design first said tier 3 would
call it; Forge turned out to have no HTTP generation surface at all — it is a
CLI-driven batch pipeline with a paid ledger, built to author 40-segment
documents with a narrative arc, which is a different job from authoring one
adaptive exercise mid-sentence. What shipped instead splits the work along the
line that already existed: **Oracle authors and judges, Core verifies**, because
verification means re-running the real graders and the real graders live with
the database.
```

### §3.2 The one open sign-off: §1.5 and the browser's websocket

/AGENTS.md §1.5 says the browser calls **only** Core, with three documented
exceptions (Depot's public read route, Pulse's two trackers, Supabase Realtime
for one table). Oracle's audio channel needs a fourth, or it needs relaying
through Core.

**Recommended: a fourth documented exception, on the Realtime exception's exact
terms.** The browser opens a websocket to Oracle's public endpoint carrying a
**short-lived session token minted by Core** — never a raw Supabase JWT. Oracle
validates the token, resolves the session, and refuses everything else. The
constraints that must all hold, mirroring the Realtime precedent:

1. The channel carries a session id and audio. **No PII crosses it** beyond what
   §4 already permits into the model.
2. Authentication is a **Core-minted token: single-use, short TTL**, scoped to
   one session id and one user id.
3. Oracle authorizes every frame against that session. A token for session A can
   never read session B.

**Rejected: relaying through Core.** Two internal hops on every audio frame
doubles the latency budget of the one feature where latency IS the product, and
it puts a streaming workload inside the service whose health endpoint must never
depend on anything optional.

**Owner sign-off given 2026-08-21.** The exception is written into
`/AGENTS.md` §1.5 with its four constraints, and Oracle enforces them: it
rejects a Supabase JWT BY NAME (so a miswired client reads "this socket takes a
session token" rather than "malformed"), burns the token's nonce on first use,
checks the token's user against the session's, and refuses the socket outright
for a minor with no active guardian consent.

### §3.3 Inworld sits behind an interface, from day one

The owner's stated intent is to replace Inworld with self-hosted STT/TTS once
there are recurring users. That migration is cheap only if nothing above the
transducer knows the provider's name.

```ts
interface VoiceProvider {
  transcribe(stream: AudioStream, opts: { locale: Locale }): AsyncIterable<Transcript>
  synthesize(text: string, opts: { voice: VoiceId; locale: Locale }): AudioStream
}
```

Nothing outside `oracle/src/voice/` imports the provider SDK. Echo (Qwen3-TTS)
keeps lesson narration; Oracle keeps live speech. Two TTS paths is not
duplication — one is batch and cached, the other is live and disposable.

> **Unverified at the time of writing:** Inworld's concrete API surface —
> whether STT and TTS are separately addressable, streaming semantics, latency,
> pricing, and whether a data-processing agreement covering minors' voice is
> available. None of that was read in the design session and none of it is
> assumed here. **Verify before implementing §3.3.**

---

## §4 The privacy contract — exactly what leaves our infrastructure

This is the section to read before changing any prompt.

### §4.1 To the pedagogical model (DeepSeek/Qwen) — the complete allowed set

| Field | Form | Why |
|---|---|---|
| `nickname` | learner-chosen, validated, moderated — never the profile name | The tutor must be able to address someone. |
| `tier` | `1 \| 2 \| 3`, derived from `birth_date` (≤7, ≤9, rest) | Vocabulary and cognitive load. **Never** the birth date, never an exact age. |
| `locale` | `en-US \| es-MX \| pt-BR` | Language. |
| `skillState[]` | Data Intel's derived state: `skillKey`, `masteryProbability`, `uncertainty`, `evidenceCount`, `recommendedAction`, `reasonCode` | Pedagogical guidance. |
| `courseContext` | ids and titles of the PUBLISHED course/topic in play | Scope. |
| `intent` | a closed enum from the offer screen | What we are doing. |
| `adaptation` | closed enum of learner-chosen preferences (§11) | How to explain. |
| `turnHistory` | this session's turns only, truncated | Conversational coherence. |

**Everything else is forbidden**, and the list is stated POSITIVELY because
§1.14 has already taught this project that a prohibition expressed only by
omission gets filled in with a default: real name, surname, email, birth date,
exact age, address, city, school, avatar, family composition, sibling data,
another learner's anything, raw `learning_events`, raw attempt rows, prior
sessions' transcripts, and any free text the learner typed outside this session.

**Enforcement is a Zod schema at the boundary**, not a convention. The context
object is built by a single function, validated, and only then serialized. An
unknown key is a rejection, not a passthrough — `.strict()`, always.

### §4.2 To the voice provider (Inworld)

- **Inbound:** the learner's audio, for transcription. It transits, is never
  stored by us, and the provider must be contractually bound not to retain it or
  train on it. **That contract is a business action, not an engineering one** —
  it is the owner's to obtain, and §16 blocks kid rollout until it exists.
- **Outbound:** the tutor's already-moderated text, for synthesis. Having
  cleared moderation, it carries nothing the learner was not about to hear.
- **Never:** learner identity of any kind. The provider sees a session id.

### §4.3 The consent gate

A `kid` cannot open the microphone until a **verified guardian** has granted
explicit, specific consent — specific meaning "voice conversation with the AI
tutor", not a checkbox buried inside a general terms acceptance. Consent is:

- **Blocking.** Not a feature flag, not a default-on setting. No consent, no mic;
  the tutor still works fully, in text-and-choices mode.
- **Revocable**, and revocation takes effect on the next turn, not the next day.
- **Recorded** in Vault with a timestamp and the granting guardian, and audited.
- **Reflected in the legal documents** — all three `/LEGAL/` files in the same
  commit, then `npm run legal:sync` (§1.8, non-negotiable).

The guardian grants it on `/family`, through `VoiceConsentControl`, and it is
deliberately NOT shaped like the analytics toggle beside it: granting opens the
wording and takes a second, deliberate press, while revoking takes ONE.
**Revocation must always be easier than granting** — a parent having second
thoughts should not have to read anything first. The component sends the
RENDERED string rather than a translation key, so the stored record keeps
saying what this guardian actually read; a test pins that. The wording in
`tutor.consent.body` is a PLACEHOLDER until counsel supplies the final text.

---

## §5 Prompt injection — the defense, layer by layer

Decision 3 means a minor's speech reaches a model and that model's output
reaches a minor. The learner's transcript is **untrusted input**. So is anything
retrieved. The layers are ordered by how much they contain, not by how clever
they are.

1. **Closed structured output.** The model never emits prose that is rendered as
   given. It emits JSON against a strict schema:
   `{ say, emotion: <7>, action: <12>, next: 'ask' | 'segment' | 'close', segmentRef? }`.
   Invalid JSON is a **discarded turn**, not a displayed one. This single layer
   removes most of the injection surface, because a successful injection still
   has no channel through which to express itself.
2. **Instructions above data.** The learner's words go into a delimited,
   explicitly-labelled untrusted block positioned after the system instructions,
   never interpolated into them.
3. **No tools with side effects.** Oracle's model has no write access to
   anything: not the database, not roles, not another learner, not the file
   system, not the network. The only thing it can do is propose a turn.
4. **Input classification** before the model — a cheap pass that flags self-harm,
   abuse, adult content and grooming patterns and routes those to a scripted safe
   response plus a guardian-visible flag, never to the model.
5. **Output moderation** before display and before TTS (§6).
6. **MarkdownLite only.** `frontend/src/lesson-engine/core/MarkdownLite.tsx` is
   hand-rolled and injection-safe — raw HTML renders inert. Reuse it. Do not
   introduce a second renderer for the tutor; a second renderer is a second
   vulnerability with none of the first one's testing.
7. **Canary tests in CI.** A fixed corpus of known injection attempts that must
   fail, every run. Without this, the other six layers erode quietly over months
   and nobody notices until a screenshot.

Bounds on top of the layers: per-turn length cap, per-session turn cap, per-user
rate limit, and a hard session budget (§9.5).

---

## §6 Moderation — before the screen and before the ear

v1 required "moderation before screen". Live voice makes that harder, not
optional. The rule:

**A turn is generated whole, moderated whole, and only then spoken.**

Token-streaming straight into TTS would put unmoderated words into a child's ear
and be unrecallable — an apology cannot un-hear a sentence. The cost is roughly
half a second to a second of extra latency per turn, and decision 7 (proxy
through our own service) is what makes it enforceable at all.

For adult roles this may be relaxed to sentence-level buffering. For `kid` it
may not.

Moderation failure is **fail-closed**: a moderation service that does not answer
means the turn is not spoken. A safe scripted line covers the gap.

---

## §7 Content — the three-tier ladder

Decision 3. Each tier is tried in order; the first that can serve, serves.

### §7.1 Tier 1 — composition from the published catalog (free, instant)

Thousands of lesson documents already exist across `financial-education`,
`entrepreneurship` and `investing`. When the learner's need maps to a segment
that already exists and is `published`, Oracle serves it. Zero cost, zero
latency, zero risk — a human already approved it.

This is the **default**, and it should carry most turns of most sessions.

### §7.2 Tier 2 — the pre-generated bank (offline, human-published)

Forge generates packs offline per `skill × tier × locale`, against a Zod
contract, through the same deterministic gates and independent judge the course
pipeline uses, upserted as `status='review'`, and **published by a human.** This
is the v1 "Money Moments" mechanism generalized: personalization happens at
SELECTION time, not at generation time, so the learner gets something that feels
made for them without anything unreviewed reaching them.

Idempotent and cheap: an existing pack is never paid for twice.

### §7.3 Tier 3 — live generation (the §1.9 exception)

Used when, and only when:

- the learner's topic is genuinely not covered by tiers 1 and 2, **or**
- the learner did not understand the canonical explanation and needs a different
  one — which a finite bank structurally cannot hold.

The second case is the owner's argument for this tier and it is a good one: a
child who did not understand needs a second explanation *now*, and "come back
when we have written one" is not a tutoring product.

**What makes it safe enough to show a minor with no human in the loop:**

| Guard | Rule |
|---|---|
| Type allowlist | Only exercise types whose grading is **deterministic and re-executable** — `quiz_mcq`, `true_false`, `number_input`, `order_steps`, `sort_buckets`, `match_pairs`, `fill_blank`, plus the ungraded `story` types. No open-ended types. |
| Contract validation | The generated segment parses against the Lesson Engine's Zod schema, or it does not exist. |
| Deterministic gates | The same gates Forge runs: tier vocabulary, arithmetic re-execution, exactly-one-correct, unique ids, required `rationale_md` on wrong options, readability band. |
| Independent judge | A separate adversarial model pass against the course rubric. WALKTHROUGH's own record: the judge caught twelve real semantic defects across 544 lessons that **all nine gates passed.** It is not optional here. |
| Answer-key re-execution | Core re-derives the answer independently before the segment can pay XP (§8). |
| Moderation | §6, same as speech. |
| Provenance | Every live segment is stored with `origin='live'`, its full generation record, and the session it was born in. A defect found later must be traceable to every learner who saw it. |
| Post-hoc sampling | A fraction of live segments lands in `/admin/content` for human review after the fact. This does not protect the first learner; it is what catches a systematic defect before it reaches the thousandth. |

**Where generation and verification actually live.** Oracle authors the
candidate and runs the independent judge; **Core verifies it and only then
persists it**. The design first said Oracle would call Forge — Forge has no
HTTP generation surface at all, and its pipeline is built for 40-segment
documents with a narrative arc rather than one adaptive exercise mid-sentence.
The split that shipped follows the line that already existed: the service that
INVENTED a segment is never the service that certifies it, and certification
means re-running the real graders, which live with the database.

> **Two defects worth keeping, both caught by tests rather than by review.**
>
> The key re-execution first used the answer-KEY shape rather than the
> learner-SUBMISSION shape — `quiz_mcq`'s key is `{correct_option_id}` and its
> submission is `{option_id}`; `fill_blank`'s key is an ARRAY of gap
> descriptors and its submission is an OBJECT keyed by gap number. Every
> generated segment would have been reported unverifiable and unable to pay
> XP: failing safe, silently, forever, with nothing going red.
>
> And tier-3 generation was a SECOND door to the model that bypassed the sealed
> context. The invariant test caught it. The fix was not to weaken the test —
> generation now has its own `.strict()` brief (`sealGenerationBrief`), which
> deliberately omits the nickname: a generated exercise has no reason to
> address the learner by name, and a nickname inside authored content would
> outlive the session it was written in.

**A generation that fails any guard produces nothing.** §1.14 applies directly:
emit NOTHING rather than something generic, because a confident wrong
explanation misleads where an absent one merely omits. The tutor falls back to
tier 1 and says so honestly.

---

## §8 Grading, XP and progress

Decision 5: full XP, server-authoritative grading in Core, the same path as a
course lesson. Three consequences that must be implemented, not assumed:

- **The answer key never reaches the client.** `stripAnswers()` is the single
  sanctioned stripper and it applies to live-generated segments identically.
- **XP requires a verifiable key.** A live segment pays XP only if Core can
  re-derive its answer independently. One that fails re-execution is shown
  **ungraded** — it can still teach — but pays nothing. Never award XP for a
  result the server could not verify.
- **A daily XP cap on tutor sessions.** Without it, the tutor becomes the
  cheapest XP per minute in the product and courses become optional. The number
  is a product decision; start conservative.

Progress writes follow §1.14 exactly: a failed read is **not** an empty state.
`getLearningStatsForUpdate` returning zeros on a transient failure once erased a
child's XP, minutes, lessons and both streak columns behind a `200`. Oracle
refuses to write rather than writing a default.

---

## §9 Session lifecycle

### §9.1 Open
Personalization loads (or the picker runs, first time only). The stage mounts and
**`onReady` must fire before the first line** — speech handed over while assets
are still resolving plays audio at a blank canvas.

### §9.2 Introduce and offer
Camera to `conversation`. The tutor greets by nickname and offers a closed set:

1. **A topic from my courses** — drawn from what the learner is actually enrolled
   in, never a free-text box.
2. **Something I am struggling with** — Data Intel's `recommendedAction`, phrased
   as an offer and never a verdict. "Shall we look at this together?", not "you
   are failing this." The learner may decline, and declining is not recorded as
   a signal about them.
3. **A frequent question** — a curated, trilingual, human-written set.
4. **Something else** — opens the conversation. This is where free speech enters
   and where §5 earns its keep.

**Cold start is the normal case right now**, not an edge case: the courses sit in
`review`, so there is very little learning evidence per user. With low
`evidenceCount` or high `uncertainty`, Oracle opens with a short diagnostic
instead of a recommendation, and says plainly that it is still getting to know
the learner. Inventing a profile from no evidence is the failure mode to avoid.

### §9.3 Converse and teach
Left: the character, speaking, captioned above their head, mirrored in the 2D
bubble. Right: the Lesson Engine, one segment at a time, from the §7 ladder. The
tutor reacts to the actual result of each segment — that is what makes it a
lesson rather than a playlist.

### §9.4 Adapt
Per §11. The tutor may notice friction and **offer** a different explanation.

### §9.5 Close kindly
Soft close at ~15 minutes: the tutor begins wrapping up in character, finishes
the current segment, recaps what was learned, awards, and invites the learner
back. Hard stop at 25. A session that hits the hard stop still gets a real
ending — never a cut to a modal.

Ending is a first-class turn (`next: 'close'`), not a timeout that kills a
socket.

---

## §10 Personalization

| Choice | Options today | Notes |
|---|---|---|
| Speaking tutor | `rho`, `zara`, `liruf`, `dina` | Decision 4; framing differs (§2.2). |
| Companion | any other character, or none | The stage already supports one companion. |
| Diorama | `diorama-a`, `diorama-b` | Catalog-driven; grows without code. |
| Backdrop | the themed backdrops the stage already renders | Light AND dark must both work. |
| Nickname | learner-chosen, validated, moderated | The **only** name-shaped value that reaches the model (§4.1). |
| Adaptation | §11 | |

Persisted per user in Vault (new migration, RLS, kid rows readable by verified
guardians). A returning learner never re-picks. Defaults must be good enough
that skipping the picker entirely still produces a good session —
personalization is an invitation, not a toll gate.

**Responsive (§1.11, non-negotiable):** the picker is a single column at 375 px
and a deliberate multi-column layout at 1280 px; the conversation view's
left/right split stacks on mobile with the stage above and the lesson below.
Verified in-browser at both widths, with screenshots, before this is done.

---

## §11 Adaptation — offered, never imposed

Decision 6, and the reason it is worded that way: this document's own earlier
version already prohibited the Tutor from silently lowering a learner's access
or labelling them. Inferring cognitive capability from telemetry and acting on
it silently is exactly that.

- **Explicit setting**, chosen by the learner or their guardian, from a closed
  set: slower pacing, more examples, less text per screen, more visual and less
  verbal, repeat before advancing. Stored on the profile, applied everywhere.
- **The tutor may offer.** On detected friction — repeated attempts, long
  hesitation, explicit confusion in conversation — it asks whether to explain
  differently. The learner accepts or declines. Declining is not recorded as a
  fact about them.
- **Never** a hidden mode, never a label written to a profile, never a reduction
  in what the learner is allowed to reach.

---

## §12 Persistence, replay and parent visibility

Decision 8.

| Stored | Not stored |
|---|---|
| Transcript of both sides (text) | **The learner's audio** — transits for STT, never persisted |
| The tutor's synthesized audio (Depot) | Any raw provider payload |
| Which segments were served, and their results | |
| Provenance of live-generated segments (§7.3) | |

- **Replay** reconstructs the session: the characters re-act it, the tutor's
  audio plays, the segments are shown alongside what the learner answered.
- **Parent visibility is an invariant**, and it is a page: `/family/:kidId/tutor`.
  A verified guardian reads their child's full transcripts — not a summary, not
  a redaction — with the safety flags surfaced FIRST, because a child
  disclosing distress to a tutor is precisely the case where a parent must find
  out, and burying it under a list of chat logs would be a product failure
  dressed up as tidiness.
- **Retention 90 days**, then automatic deletion, enforced by a scheduled job
  with its own test. A retention policy nobody runs is not a retention policy.
- RLS from the first migration. Kid rows readable by verified guardians only.

---

## §13 Telemetry — a closed vocabulary, or nothing

Any Tutor telemetry uses a closed event vocabulary with bounded numeric or
identifier fields, idempotency keys, and the existing consent gate. Adding an
event requires a migration, a Core emission path, tests and documentation.

**The tutor must never create an arbitrary JSON or free-text analytics
channel.** The useful learning outcome is the server-authoritative attempt
record, not a model's interpretation of what the learner said.

---

## §14 Failure posture

| Failure | Behavior |
|---|---|
| Data Intel unavailable | Explicit degraded mode + generic tutor. **Never** treated as zero mastery (§1.14). |
| Voice provider unavailable | Session continues in text mode with captions. Speech is an enhancement; the lesson is the product. |
| Model unavailable | Scripted safe response; session closes kindly. |
| Moderation unavailable | **Fail closed** — the turn is not spoken. |
| Live generation fails any guard | Emit nothing; fall back to tier 1 and say so honestly. |
| Stage assets fail to load | The existing `SceneBoundary` fallback. The conversation must still run without 3D. |
| Consent revoked mid-session | The microphone stops on the next turn. |

---

## §15 Cost and rate limits

Live voice plus live generation is the most expensive surface in the product,
and this project has already been blocked twice by provider arrears (DashScope
images, DeepSeek balance). So:

- Per-user session caps (§0 assumption 5) and per-user daily caps.
- Tier 1 is free and must carry the majority of turns. If it does not, that is a
  content-coverage problem, not a scaling problem.
- Cost recorded per session, the way Forge's ledger works, so the economics are
  measurable before they are a surprise.
- Rate limiting is an **availability** control and fails open on store error, per
  §1.14. Consent and moderation are authorization controls and fail closed.

---

## §16 Acceptance checklist — before any minor uses this

Every one of these must be proven, not assumed. Ticked items were verified in
the build session of 2026-08-21; unticked ones block enabling this for minors.

- [ ] A data-processing agreement with the voice provider covering minors'
      audio exists. **OWNER ACTION — blocks kid rollout.** See
      `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md` §6.
- [ ] All three `/LEGAL/` documents updated and `npm run legal:sync` run.
      **Blocked on counsel** — the brief is written, the answers are not.
      The consent wording currently in `tutor.consent.body` is a PLACEHOLDER.
- [x] The consent gate blocks the microphone with no consent, and revocation
      takes effect on the next turn — both tested (`backend` tutor suite,
      `oracle` socket guard).
- [x] The model context object rejects every unlisted field (`.strict()`),
      tested — eighteen forbidden fields asserted in `verify:tutor`.
- [x] The injection canary corpus passes in CI, in BOTH directions.
- [x] Moderation fails closed, tested.
- [x] Live generation's guards each tested, including the "emit nothing" path.
- [x] XP is never awarded for an unverifiable key, tested.
- [x] A failed personalization read produces a degraded response, never zeros.
- [x] Parent visibility tested end to end, and it is a real surface:
      `/family/:kidId/tutor` shows the FULL transcript plus the safety flags,
      behind the same verified-guardian check Core enforces per request.
- [x] Retention runs nightly (`.github/workflows/tutor-retention.yml` →
      `POST /api/v1/tutor/internal/retention/purge`). It deletes the rows AND
      the tutor's audio in Depot: a cascade reaches the rows and nothing
      reaches the blobs, so a rows-only sweep would leave a child's
      conversation audible at a public URL with every record of it gone.
- [ ] `npm run verify:rig` and `npm run verify:placement` — LOCAL gates needing
      `/glb/` source exports, which are outside the repository.
- [x] Verified in-browser at 375 px and 1280 px, light and dark, screenshots
      taken, no horizontal overflow at either width (§1.11).
- [x] Owner sign-off recorded for the §1.5 exception (§3.2).

## §17 Documentation stewardship for this feature

| Change | Docs updated in the same commit |
|---|---|
| `oracle/` service created | `/AGENTS.md` §1.5 + `CLAUDE.md` mirror, `repo_map.md`, `doc_map.md`, root `README.md`, `oracle/AGENTS.md` |
| Inworld added to the stack | `/AGENTS.md` §1.2 + mirror, `ROADMAP.md`, `WALKTHROUGH.md` |
| §1.5 browser-exception #4 | `/AGENTS.md` §1.5 + mirror, with the constraints from §3.2 |
| Voice / consent / retention | all three `/LEGAL/*.md` + `npm run legal:sync` |
| ANY new field reaching a model | `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md` §2.2 — it is a processing change, not a refactor |
| New migrations | `database/AGENTS.md`, regenerate `database/types/` |
| New endpoints | service `README.md` route tables |
| New terms (Oracle, session, turn, pack) | `GLOSSARY.md` |

---

## §18 The superseded v1 design (Money Moments)

The 2026-07-25 design — a closed taxonomy of eight money situations, curated
trilingual YAML, packs generated offline and published by a human, no free text
from a child ever — was analyzed, prototyped, and reverted. Its reference
implementation is at `git show 67dfb6e`.

It is superseded, not deleted, and two of its ideas survive into this design:

- **§7.2's bank IS the packs mechanism**, generalized from eight situations to
  `skill × tier × locale`. It was a good mechanism; it was only ever too narrow.
- **Its non-negotiable #1 — never a free-text box for a child — is now
  explicitly overridden by decisions 1 and 3.** That override is the reason §4,
  §5 and §6 exist in the detail they do. The old rule was not wrong; it was
  simply cheaper than the defenses that now replace it.

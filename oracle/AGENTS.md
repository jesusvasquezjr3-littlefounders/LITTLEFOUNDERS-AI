# oracle/AGENTS.md — Domain rules for Oracle (the AI Tutor runtime)

> **Read `/ORACLE.md` FIRST.** It is the authoritative engine spec: the product
> flow, the privacy contract, the injection defences, the content ladder and
> the eight owner decisions in §0 that override defaults stated elsewhere in
> `/AGENTS.md`. This file is the code-level domain rules for the service.
>
> Related: `/TUTOR_3D.md` (the stage Oracle drives), `/LESSON_ENGINE.md` (the
> exercise contract), `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md` (what counsel is
> reviewing), `backend/AGENTS.md` (the Core half).

---

## §1 What Oracle is, and what it deliberately is not

**Is:** the live tutoring runtime. Turn orchestration, prompt-injection
defence, moderation before speech, the session budget, and the only code in the
repository that reaches a real-time voice provider.

**Is not:** a store of anything. Oracle has **no database credentials** and a
test asserts it imports no database client. Every fact about a learner arrives
through `src/core/client.ts`, already resolved and already scoped to one
person, and every write goes back the same way.

That is not caution, it is architecture: there is exactly **one file** to read
to know everything Oracle can possibly learn about a child.

---

## §2 The seven rules that must not be relaxed

### §2.1 Nothing reaches a model without passing a seal

`src/context/schema.ts` holds every field permitted to reach a third-party
model, validated with `.strict()`. There are two sealers — `sealContext` for a
conversational turn and `sealGenerationBrief` for an exercise brief — and
`boundaries.test.ts` fails if any file calls `complete()` without calling one.

**`.strict()` rather than Zod's default is the whole point.** The default drops
unknown keys silently, which means a developer who adds `birthDate` sees their
feature "work" — it just has no effect — and ships. Strict REJECTS, loudly, in
a test.

Adding a field needs: a `/ORACLE.md` §4.1 row, an entry in
`/LEGAL/AI_TUTOR_LEGAL_REVIEW.md`, and a test. It is not a refactor.

### §2.2 Classification happens BEFORE the model, always

`src/safety/classifier.ts` runs on the learner's utterance before anything else
touches it. Once text is in a context window it is already at a third party and
no downstream check can recall it.

A self-harm disclosure must reach a **human-written line, every time**. Never a
generated one. `src/tutor/scripted.ts` holds those lines in all three
languages, and they are the most important strings in the service.

**The greeting joined them on 2026-08-22.** It used to be a model call — the
tutor was asked to invent an opening, which cost a reasoning round trip and a
text-to-speech charge in every session forever, to produce a sentence nobody
had reviewed. It is now twelve written lines, one per character per locale,
following GLOSSARY.md's canonical cast table. They carry **no nickname**: the
learner's name goes in the caption, and a name in the audio would make the clip
unshareable, which is the entire cost this removed.

### §2.3 The model's output is a closed JSON turn, or it is discarded

`src/tutor/turnSchema.ts`. An injection can still persuade the model — and then
has nowhere to put the result, because the only channel out is one moderated
sentence, one of seven emotions, one of twelve actions and one of three control
decisions. There is no field for a link, a script or an exfiltrated context.

**Never add a free-form field to that schema.** If a new capability needs one,
it needs a design conversation, not a property. `whiteboard` (V4) is the
precedent for how a real capability clears that bar without breaking it: its
`start`/`steps` are a closed operator enum plus bounded numbers — no freer than
`demonstrate` already was — and its ONE prose sub-field, `label`, joins the
moderation call below rather than inventing a fourth free-text channel.

**Three of its fields are learner-facing prose, and ALL THREE are on screen.**
`say` always was. `segmentRequest.framing` is the second — its own schema
comment defines it as *"a short, learner-facing framing for the activity,
moderated like `say`"*, `z.string().min(1).max(240)` — and until the 2026-08-21
Tutor rebuild it was generated, moderated, sent over the wire, stored by the
client and **rendered nowhere**. The tutor wrote a sentence introducing every
single activity and no learner ever saw one. It is now the lead-in line above
the segment prompt (`/ORACLE.md` §9.3).

The consequence for this service: **`framing` is a rendered contract, so
changing what it means is a breaking change, not a refactor.** It may not be
quietly repurposed into a layout hint, a difficulty label, an enum, or
telemetry. Its sibling `rationale` is the field for anything not meant for the
learner — that is why the two exist separately, and the distinction is now
load-bearing rather than documentary. `whiteboard.label` (V4) joined this
group the same way `framing` should have from the start: added to the SAME
moderation call as `say` in the turn it ships (orchestrator.ts), not bolted on
after the gap `framing` sat in for a day was found. All three remain subject
to §2.4: the whole turn is moderated before any part of it is spoken or
shown.

### §2.4 Moderation is per-turn and fails closed

Whole turn generated, whole turn moderated, then spoken (`src/safety/
moderation.ts`). Token-streaming into speech would put unmoderated words in a
child's ear and be unrecallable.

Failing closed means: judge unreachable → the turn is not spoken. A minor's
session with no judge configured is refused **at the door**, not turn by turn —
a child sitting with a character who apologises forever is worse than an honest
"not available".

**Only generated turns are moderated.** Scripted lines are human-written and
already reviewed; putting them past a judge would mean a judge outage replaced
one safe line with another while doubling upstream calls.

**"Failing closed" also means a malformed judge reply must not be read as an
answer** (found 2026-08-30, CRITICAL). `modelModeration` used to fall into
its "opinion named no harm, allow" branch for a reply that had NO `safe`
field at all — the same epistemic state as a timeout, which already fails
closed. Check `typeof parsed.safe === 'boolean'` before interpreting
anything else; treat anything that fails that check as a failure, not an
opinion. And a "judge" running on generated content is not automatically
THIS gate — `content/generate.ts`'s own quality judge is a different judge
with a different rubric, and it used to be the ONLY one a tier-3 segment's
text ever saw (`moderateTutorOutput` was never called on it at all). See
`RUNBOOK.md` for both incidents.

### §2.5 The voice provider stays behind its interface

Nothing outside `src/voice/` may import a provider SDK or name a provider, and
`boundaries.test.ts` enforces it. `/AGENTS.md` §1.2 records that Inworld is
explicitly interim; that migration is cheap only while this holds.

`VOICE_PROVIDER=none` is the **default** and a fully supported posture, not a
stub. Sessions run captioned and silent. Speech is an enhancement; the lesson
is the product.

**That last sentence is about the LESSON, not about the control.** It was read
as permission to hide the microphone button whenever voice was off, which is
how the first build shipped with no visible microphone in any environment where
`VOICE_PROVIDER=none` — including every developer's and the owner's. The
affordance is always present and states its own unavailability in place
(`/ORACLE.md` §14.1). Nothing about that is Oracle's code, but Oracle's default
is what makes it the common case, so it is worth knowing here: **the honest
default posture of this service is exactly the state the UI must handle
best.**

### §2.6 A line is never paid for twice, and never played from the wrong text

`src/voice/speech.ts` is the ONLY place in the service that can spend money on
speech, and it tries three things in order: the pre-generated manifest, the
cache, then the provider. Two rules hold it together.

**The key is a content hash of the exact text plus the provider's voice
fingerprint** (`voiceFingerprint()` — provider, TTS model, enrolled voice id).
So editing a scripted line or re-enrolling a character ORPHANS the old audio
rather than playing it for the new words. That is a child-safety property, not
an optimisation: **a cached line is always the line that was actually
reviewed.** Never key a clip on a name, a slot or an index.

**The bucket name is the retention policy.** `tutor-speech` is one child's
session audio, swept at 90 days; `tutor-speech-shared` is the closed scripted
set, reused by everyone, and Core's sweep refuses to delete from it
(`backend/src/services/tutorRetention.ts`). Depot is content-addressed, so a
shared clip is ONE object thousands of transcripts point at — deleting it when
the first of those sessions expires would protect nobody and silence every
session after it.

The consequence: **do not widen reuse without deciding the retention question
first.** `SPEECH_CACHE_SCOPE=all` shares model-generated turns between
learners, and a shared clip cannot be deleted with one child's session. It is a
flag, defaulted off, with a sign-off to record — the same shape as
`TUTOR_VOICE_FOR_MINORS`, for the same reason.

A cache miss of any kind — no manifest, Redis down, Redis slow — degrades to a
paid call. It must never degrade to silence, and a test pins that.

---

### §2.7 Every path to the model claims the socket's one turn slot

`socket.on('message')` dispatches fire-and-forget, so without a gate every
frame already sitting in the read buffer starts its own upstream call at the
same instant. **Every model-producing path — `learner_text`, `learner_audio`,
`learner_audio_commit`, `segment_graded` and the farewell — calls `claimTurn`
BEFORE any paid work and releases it in a `finally`.** The 700 ms floor lives
there too, waived only for the farewell, because nobody should be made to wait
to leave. The streamed-clip frames (`learner_audio_begin`/`_chunk`) claim
nothing because they buy nothing: they fill a bounded per-socket buffer, under
the same total ceiling as the whole-clip frame, and only the COMMIT claims,
transcribes and pays. `interrupt` claims nothing either — it aborts the
in-flight production via the claiming handler's own AbortController and is a
no-op outside one.

It is a function rather than a check inlined in a handler, and that is the
whole point. The floor used to sit inside `handleLearnerTurn`; `segment_graded`
called the orchestrator directly and never entered it, and `learner_audio` paid
the speech-to-text provider *before* delegating there. One authenticated
learner could force dozens of concurrent paid completions inside the single
process serving every live session. A new frame type that forgets to claim
cannot reach the orchestrator at all, which is the failure mode we want.

The turn slot is also reserved at the top of `orchestrator.produce()` rather
than counted at the bottom — counting after the call is what let a burst of
frames all measure themselves against the same stale `seq` and all pass a cap
none of them had reached. Regression tests: `src/__tests__/hardening.test.ts`.

---

### §2.8 The turn ships in two frames, and the wait is announced (2026-08-28)

**Split delivery.** `deliver()` sends the moderated turn's TEXT immediately
(`turn`, `audioUrl: null`) and the voice later (`turn_audio {seq, audioUrl}`),
because a caption held hostage by synthesis-and-storage was most of the
perceived latency. Two rules keep it honest: the `turn` frame still sits
STRICTLY after the moderation await (/ORACLE.md §6 is untouched), and a CLOSING
turn awaits its own audio before `finish()` — a goodbye whose clip arrives
after the socket closed is a silent goodbye.

**Speculative synthesis** (owner sign-off 2026-08-28): a model turn's TTS runs
concurrently with the judge; a blocked turn's clip is discarded, billed, and
counted (`speechCounts.discarded`). Delivery, not synthesis, is what moderation
gates.

**The wait is server-authoritative.** Every claiming handler sends `thinking`
at the claim, so the client's spinner reflects the service that is actually
working — and `interrupt` ends an in-flight production (AbortController through
`complete()`), returning `null` from `produce()`: no emission, no scripted
apology, the reserved slot stays spent. An aborted turn ends in a `state`
frame, never in silence.

**Liveness has two clocks** (`ws/server.ts` heartbeat): a socket that stops
answering pings is terminated (dead TCP wearing an open readyState); a socket
that pings but carries no learner frame for `SESSION_IDLE_TIMEOUT_MS` is
closed politely as `learner_left` (keepalives prove the tab, not the person —
and the hard budget alone never reaps an idle session, because it is only
evaluated when a turn arrives).

## §3 Layout

```
src/
  app.ts            express app — /health above the rate limiter and above
                    every optional dependency (§1.14). The limiter SKIPS
                    /api/v1/tutor: one caller (Core), one IP, so an IP bucket
                    there was a platform-wide outage waiting to happen
                    (middleware/rateLimit.ts). Because of that skip,
                    requireInternalKey mounts ABOVE express.json — an
                    unauthenticated request must be refused before its body is
                    parsed. DO NOT REORDER THESE THREE.
  index.ts          listener opens FIRST, Redis connects in the background
  env.ts            Zod config; provider keys are OPTIONAL by design
  context/schema.ts THE PRIVACY BOUNDARY — read §2.1 before touching
  core/client.ts    the ONLY door to learner data (Core, over HTTP)
  model/provider.ts DeepSeek transport; throws rather than returning a default
  safety/           classifier · untrusted fence · moderation · canary corpus
  tutor/            prompt · closed turn schema · scripted lines · orchestrator
  content/generate.ts  tier-3 authoring + the independent judge
  session/          single-use token · pure budget reducer
  voice/            provider interface · Inworld adapter · silent provider
                    speech.ts     the ONLY thing that can pay for audio (§2.6)
                    pregenerated  the tracked manifest of fixed lines
                    cache.ts      content hash -> Depot URL, in Redis
  ws/               wire protocol · the one browser-facing socket
  depot/client.ts   stores the TUTOR's audio (never the learner's), in the
                    bucket that decides how long it may live
  lib/redis.ts      ONE connection, shared by the limiter and the cache
scripts/verify-tutor.ts        the §5 gate a human reads
scripts/pregenerate-speech.ts  buys the 144 fixed clips, once, ever
```

---

## §4 Gates

```bash
npm run type-check
npm run lint
npm test              # 182 tests, no network, VOICE_PROVIDER=none
npm run verify:tutor  # /AGENTS.md §5 — prints the privacy + canary result
npm run build
```

`verify:tutor` exists **separately from the test suite** on purpose. A green
119-assertion run does not tell a reviewer that the privacy boundary held; that
script prints, check by check, that the context rejects every unlisted field
and that the canary corpus still fails to escape.

**The canary corpus is a ratchet.** Every real injection or safety miss found
in the wild gets added to `src/safety/canary.ts` after it is fixed, so it can
never come back. It asserts **both directions** — a classifier that blocks
everything passes the blocked half perfectly and destroys the product.

---

## §5 Things that will bite whoever touches this next

1. **NEVER NAME THE AUDIO ENCODING. The provider sniffs the container.** This
   cost the entire microphone in production, on every Chrome, Edge and Android
   device, for six days. `encodingFor()` mapped `audio/webm;codecs=opus` to
   `OGG_OPUS` because both carry Opus — but WebM and Ogg are different
   CONTAINERS, and Inworld's demuxer answers `500 {"code":13,"message":"proxy
   has failed to process your request"}`. Measured against the live API:
   `AUTO_DETECT` transcribes webm, ogg, m4a, wav and mp3 correctly, all five,
   and there is no enum to reach for anyway (`WEBM_OPUS` and `M4A` are both
   rejected as `AUDIO_ENCODING_UNSPECIFIED`). Do not reintroduce a MIME→enum
   table in `voice/inworld.ts`; a test asserts that no browser MIME type ever
   produces a named encoding, because the PREVIOUS test asserted the opposite
   and stayed green for the whole outage.
2. **Every error code Oracle emits over the socket needs a translated
   sentence.** `STT_FAILED`, `NO_SEGMENT`, `CONSENT_REQUIRED`, `RATE_LIMITED`
   and the six close reasons render through `tutor.conversationError.*` in
   `frontend/src/i18n/*/tutor.json` — NOT through `errors.api.*`, which is
   Core's HTTP envelope vocabulary and has never contained them. A code with no
   key falls through to a generic apology, which is how one sentence came to
   mean four unrelated failures. `i18n:check` CANNOT catch this: the key is
   built from a template literal and the tool says so in its own output. Adding
   a code to the socket means adding three strings in the same commit.
3. **A failed upstream call must log the BODY, not just the status.** Weeks of
   dead microphone logged `inworld stt responded 500` and nothing else — a bad
   container, a bad key and an exhausted quota were indistinguishable. Whatever
   you add here, print enough to tell them apart.
4. **A Response body can only be read once.** In tests, `mockResolvedValue`
   hands back the SAME object on every call and the second read throws "Body is
   unusable". Use `mockImplementation(() => Promise.resolve(...))`.
5. **An answer KEY is not a SUBMISSION.** `quiz_mcq`'s key is
   `{correct_option_id}` and its submission is `{option_id}`; `fill_blank`'s
   key is an array and its submission is an object. Conflating them makes every
   generated exercise report as unverifiable — failing safe, silently, forever.
   The conversion lives in Core (`tutorLadder.ts`), pinned by a test.
6. **`getConfig()` caches.** A test that changes `process.env` must call
   `resetConfigCache()`.
7. **The session token is not a JWT and Oracle rejects one by name.** If the
   client sends a Supabase JWT the log says exactly that, because "malformed"
   would send whoever wired it looking at their JSON encoding instead.
8. **Reconnect is RESUME, and it is never silent** (amended 2026-08-28, owner
   sign-off — this rule previously said "no reconnect, deliberately"). A
   dropped socket parks its orchestrator in-process for
   `SESSION_RESUME_GRACE_MS`; Core mints a FRESH single-use token
   (`POST /api/v1/tutor/sessions/:id/resume`, owner only) and the handshake
   re-attaches: every gate re-runs, the transcript is replayed in a `history`
   frame, the on-screen turn is re-sent as TEXT ONLY, and the greeting is
   never repeated. The two original objections still hold and are still
   honored: each token remains single-use (a replayed URL is dead, parked
   session or not — pinned by a test), and nothing resumes silently (the
   client says "reconnecting" and the server redraws rather than replays).
   The park is process memory, like the nonce ledger: one more thing that
   holds Oracle at a SINGLE replica. **A single-use token is not the same
   guarantee as "only one socket is ever live for this session"** (found by
   an adversarial review, 2026-08-30, HIGH): the resume ENDPOINT never
   checked whether a socket for the session was already open, only whether
   the session itself was — so a client that never let its first socket close
   could mint and use a second valid token, and `handleConnection` would
   spin up a second, fully independent orchestrator running in parallel,
   with its own budget clock and its own turn cap. Fixed with `liveSessions`
   (`ws/server.ts`), checked BEFORE `takeParked`: a session already live
   refuses the new socket (close code `4009`) rather than duplicating it.
   See `RUNBOOK.md` for the full incident.
9. **Never log a learner's utterance.** Not at debug level, not temporarily.
   Safety flags record a category and a severity and never the words — a flag
   is a signal to a human, not a second unregulated copy of what a distressed
   child said.
10. **A field this service emits is not a field anybody renders.** Assume
   nothing either way, in either direction. `segmentRequest.framing` was
   moderated learner-facing prose that reached no screen for the whole life of
   the first build; meanwhile `ready.microphone` was rendered as the CONDITION
   for showing the microphone at all, so the control vanished whenever the
   answer was no. Both are the same mistake — a wire field and a UI decision
   drifting apart with nothing asserting the join. When you add or change a
   field on the wire, say in `/ORACLE.md` what is supposed to happen to it on
   screen, and when you change what one MEANS, treat it as breaking (§2.3).
11. **Speech is billed per CHARACTER OF TEXT, and only text we actually sent.**
   `SpeechResult.billedChars` is zero on every free path and non-zero even when
   Depot then lost the audio — because that synthesis WAS charged. A ledger
   that only counted audio a learner heard would under-report exactly the
   failure that wastes the most money (`npm run speaks:verify` exists for it).
12. **`ready.microphone` is a capability, not a visibility flag.** Oracle
   reports whether the microphone can open. It does not report whether a
   microphone control should exist — that control is always present, and
   `/ORACLE.md` §14.1 is the rule. The three blocked reasons are Core's
   (`microphoneBlockedBy()` returns `POLICY_BLOCKED`, `CONSENT_REQUIRED`,
   `VOICE_UNAVAILABLE`, policy first on purpose); Oracle supplies the facts
   behind them and nothing about their presentation.
13. **A guardrail fixed for ONE mastery band is not fixed for the bands below
   it.** `controller.ts`'s "no sé" no-progress counter was patched for
   SOCRATIC/FLUENCY (mastery ≥ 0.65) on 2026-08-29 and left DIRECT/WORKED/
   FADED — where every new or struggling learner actually starts — with no
   equivalent, because those bands degrade nowhere lower on their own. Found
   live, testing as a struggling learner, 2026-08-30, by reproducing the exact
   same "no sé" twice against a fresh account and watching the tutor invent a
   new example each time. If you touch a controller guardrail, check whether
   it was scoped to a mastery band or a strategy subset, and if so ask
   whether the OTHER bands need the same thing — `verify:pedagogy` will not
   ask this for you, it only asserts the sequences it already knows to run.
14. **An instruction that presupposes the shape of every activity will be
   wrong for most of them.** `orchestrator.ts`'s reaction-to-a-graded-activity
   instruction said "name the numbers they chose" as if every one of the
   lesson engine's dozens of segment types were numeric. On a true/false
   activity, found live 2026-08-30, the model — given nowhere true to point
   for "the numbers" — invented a whole different, unrelated activity from
   earlier in the conversation instead. The context message already carried
   this exact activity's real prompt; grounding being AVAILABLE did not stop
   the hallucination, because the instruction actively asked for something
   that was not there. Word an instruction about "whatever this activity
   actually involved," not about one shape you had in mind, whenever it is
   meant to apply to more than one segment type.
15. **`audioUrl: null` on a `turn` frame means two different things, and the
   client could not tell them apart.** It means "still coming" on ordinary
   split delivery (§2.8) and "never coming" on a resume redraw, which
   deliberately sends no `turn_audio` at all. `audioPending` on the `turn`
   frame names the difference explicitly (true/false at the two send sites
   in `ws/server.ts`) — found necessary by adversarial review, 2026-08-30
   (HIGH), because `frontend/src/tutor/useHandsFreeTurn.ts` was opening the
   microphone in the real, wall-clock gap between a turn's text landing and
   its `turn_audio` settling, silently discarding whatever the learner said
   in that window. If you add a field whose ABSENCE is ambiguous between two
   states a client must act on differently, say which one explicitly rather
   than letting the client infer it from timing.

---

## §6 Environment

`.env.example` is the reference. Three notes that are not obvious:

- `TUTOR_SESSION_SECRET` **must differ from `INTERNAL_API_KEY`**. One
  authenticates a service, the other authenticates one browser socket; sharing
  them means a leaked session token can call the internal API.
- `SESSION_HARD_BUDGET_MS` must exceed `SESSION_SOFT_BUDGET_MS` or startup
  fails — a hard stop at or before the soft close means the session dies
  mid-sentence every time.
- No provider key is required to boot. Oracle starts, serves `/health`, and
  logs loudly about what it cannot do. A silent degraded start is how a
  deployment serves text-only sessions for a week before anyone notices.

## V4 — the harness subsystems (2026-08-29)

- **Skills (`skills/moves/*.md`)** are code: reviewed through pull requests (that IS the §15.1 approval gate), parsed at boot with a loud failure (a malformed file fails deploy, never a turn), body hard-capped at 1,600 chars. A skill listing `misconceptions` is reachable ONLY through them — never through generic strategy selection. Every strategy×tier must resolve to a skill; `verify:pedagogy` and `skills.test.ts` enforce it. A skill flagged `once_per_session: true` in its own frontmatter (today, only `counterexample-confront`) is fenced out of `selectSkill` once `TutorOrchestrator.usedSkillNames` already holds its name — found live via `tutor:converse`: a learner who failed the same skill four times in one session got the identical "ONE per session, ever" confrontation all four times, because selection was a pure function of the turn's own strategy/tier/misconception with no memory of what it had already returned. Writing "once, ever" in a skill body is not enough; it must be checked.
**"Checked" also means checked at the right MOMENT** (found 2026-08-30,
MEDIUM): `usedSkillNames` is documented as names already DELIVERED, but a
skill used to be added to it at SELECTION time, before the model call even
started — an interrupted turn or an exhausted retry burned the one use on a
turn the child never heard. `strategyInstruction` now returns a PROPOSED
skill name and each call site commits it only after `produce()` resolves
with `emission.source === 'model'`. See `RUNBOOK.md`.
- **The post-session review (`src/session/review.ts`)** is fire-and-forget after `finish()` and must stay that way: it may never block, throw upward, or retry in a loop. It refuses sessions with <2 learner turns, and drops WHOLE any proposal with identifier-shaped tokens. Its writes go through Core (`PUT /internal/learner-memory`), never to the database directly.
- **`learnerBrief`** renders as the tutor's OWN notes, never as the learner's words — text derived from a child's speech must never be readable as instructions. Any change to what reaches the model still walks the full §4.1 chain (schema, ORACLE.md, legal review, the field-count test).
- **Episodic recall** triggers on a CLOSED phrase list only — no model ever decides whether to look — and failure degrades to the turn we had before.
- **The grace turn** (`closeGraceUsed`) is minted exactly once per session; the turn after it closes scripted no matter what the model did.
- **The whiteboard** (`src/tutor/whiteboard.ts`) — `values` are ALWAYS server-computed from the model's own `start`/`steps`, recomputed a second time at the wire (`ws/server.ts`) rather than trusted from wherever they were last computed, and dropped WHOLE (fail-open) on a non-finite/negative/out-of-range result — never shown as authored. A turn may never carry both `whiteboard` and `segmentRequest`; the schema refuses it. `whiteboard.unit` (`day`/`week`/`month`/`year`, closed vocabulary) must agree with whichever cadence word the model's own `say` used — found live, drawing "Día 1/2" under a story that said "cada semana" three times. `narratesUnshownGrowth()` and `whiteboardUnitMismatch()` in `src/tutor/prompt.ts` are deterministic checks feeding the standard repair loop (§9), same pattern as `falsePraise` — the instruction alone did not reliably get the real model to set the field at all.


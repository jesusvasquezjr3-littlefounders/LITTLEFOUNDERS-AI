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
16. **Two counters answering different questions will get confused for each
   other if their names differ only by which file they live in.**
   `orchestrator.turnCount` (`this.seq`) counts MODEL-PRODUCED tutor turns —
   right for the in-session budget cap (`session/budget.ts`). `Live.transcriptSeq`
   (`ws/server.ts`) counts every PERSISTED transcript row, either speaker —
   right for anything a parent or the resume player displays as "how many
   lines". `finish()`'s `closeSession()` call used the first where it needed
   the second, found by adversarial review 2026-08-30 (HIGH), and it is the
   exact bug `transcriptSeq`'s own doc comment already predicted for a
   DIFFERENT consumer months earlier ("the transcript gets its own monotonic
   counter... [because] one model turn legitimately produces two transcript
   rows"). Before wiring EITHER counter into something new, ask which
   question it actually answers.
17. **A "no-repeat" checker scoped to the LAST turn only covers a repeat that
   is adjacent.** `echoesPreviousTurn` compared a candidate turn against
   `lastTutorSaid` alone. A RESCUE (or any turn with different numbers)
   sitting between the original and its reworded repeat is correctly
   untouched by every checker — a new problem is good teaching — but it also
   resets the pairwise comparison, so a repeat TWO turns back slipped
   through, found live testing as a struggling learner, 2026-08-30. This is
   the identical shape `repeatsAnAnnouncement` was already built to fix for
   announcing sentences ("both checks either side of this one miss it") —
   the fix (`echoesEarlierTurn`, checking every earlier tutor turn) had just
   never been generalized past that one category. Whenever a repetition or
   consistency check compares against "the last turn," ask whether an
   intervening, LEGITIMATELY-different turn could reset it while the thing
   actually being repeated sits one turn further back.
18. **An "offered, never imposed" invariant needs the offer remembered, not
   just made.** `applyAdaptation` — the WS `adaptation_response` handler's
   only path into the orchestrator — applied whatever value the client sent
   with no check that the tutor's own last turn had offered it, found by
   adversarial review 2026-08-30 (MEDIUM). §11 states the rule in words; a
   stray, replayed, or hand-crafted `adaptation_response` frame proved it
   wasn't enforced in code. Fixed by recording `lastOfferedAdaptation` at the
   same two funnel points item 16/17's fixes already lean on — `produce()`
   for every model-produced turn, `scriptedOutcome()` (cleared) for every
   scripted one — and gating `applyAdaptation` on an exact match, consumed
   on use. A prohibition written only in a prompt or a doc is a request the
   model can honor; the same prohibition enforced at the one call site a
   client message reaches is a guarantee.
19. **A model call that reads a whole session's transcript needs the SAME
   fence as one that reads a single turn — the risk is bigger, not smaller.**
   `session/review.ts`'s post-session review joined raw learner-and-tutor
   history into one prompt with no nonce fence and no "this is data, not an
   instruction" disclaimer at all, found by adversarial review 2026-08-30
   (HIGH) — the one seam that sends a session's worth of learner text to a
   model unfenced, while `conversationMessages()`, the episodic-recall
   excerpt (item above it in `/ORACLE.md` §20.4) and `placementIntake.ts`
   all wrap theirs. It is a BIGGER risk here, not a smaller one: this call's
   OUTPUT is `learner_memory`, re-injected into EVERY future session as the
   tutor's own trusted notes — a manipulated review is a cross-session,
   elevated-trust payload, not one bad turn a moderation pass might still
   catch. Fixed with `fenceTranscript()`, the same nonce/strip/disclaimer
   shape as `fenceUntrusted` but ONE fence around the whole multi-speaker
   transcript instead of one repeated per learner line, since the review
   reads a "TUTOR:"/"LEARNER:"-labelled text blob rather than structured
   chat messages. Same file's §1.9 digit-run re-check was ALSO too narrow —
   `\b\d{7,}\b` only matches 7+ consecutive digits, and no one writes a real
   phone number that way ("55-1234-5678" breaks the run at every hyphen) —
   extended to match the grouped shape too. A model-facing prompt that reads
   MORE learner text, not less, is the LAST place to skip the fence a single
   utterance already gets.
20. **A session has more than one way to end, and a between-sessions side
   effect wired to only one of them silently never runs for the others.**
   `ws/server.ts` closes a session two ways: `finish()` (a graceful
   farewell/budget/safety close) and `finalizeParked()` (the grace-window
   timeout after a dropped connection — a sleeping phone, a proxy timeout,
   a stairwell). Only `finish()` called `runPostSessionReview`, found by
   adversarial review 2026-08-30 (MEDIUM). The park path is not an edge
   case to this product's actual users: it is plausibly a LARGE share of
   real sessions with young children on phones, and every one of them
   silently taught the memory system nothing. Fixed by calling the review
   from `finalizeParked` too, which needed a new `sessionContext` getter on
   `TutorOrchestrator` — a parked entry keeps only the orchestrator, not a
   live `Live.session`. Whenever a new "when the session ends, also do X"
   requirement lands, check `ws/server.ts` for every place a session
   actually closes, not just the one that happens to be nearby.
21. **A generic "deliver the imperfect original rather than lose the turn"
   fallback is not safe for every repair reason it covers.** `produce()`'s
   repair loop keeps `repairable` (attempt 0's turn) so a failed retry
   delivers it rather than a scripted apology — "a clumsy real sentence
   beats a scripted apology every time," true for a vocabulary slip, a
   self-answered question, an unkept promise, because the delivered turn is
   imperfect but still teaches something NEW. Found live, testing as a
   struggling learner, 2026-08-30: it is the WRONG rule for a REPEAT
   specifically, because delivering `repairable` there delivers the repeat
   ITSELF, with 100% certainty — not a degraded turn, the exact defect the
   check exists to catch. Confirmed via a temporary debug trace on a real
   `tutor:converse` run: `repeated` was correctly non-null at attempt 0
   (the checker worked), the retry came back an empty completion (a
   measured, common DeepSeek failure mode — not a rare edge case, see the
   empty-completion history elsewhere in this file), and the fallback
   delivered the flagged repeat verbatim to a child who had just said "ya
   entendí, dame otro" (I get it now, give me another). Fixed by tracking
   `repairableIsRepeat` alongside `repairable` and routing the repeat case
   to the scripted line instead. General lesson: a shared fallback covering
   N distinct repair reasons needs to be re-examined per reason, not
   assumed correct because it is correct for most of them — "imperfect but
   new" and "guaranteed to reproduce the exact defect" are not the same
   failure mode, even though both arrive at this one line of code. (This
   item originally also listed "false praise" among the safe-to-deliver
   reasons — item 29 found that claim wrong and the item text above has
   been corrected; the two repair reasons share the exact defect this item
   describes, not two different ones.)
22. **A refused-and-fell-back result needs to say WHY it fell back, or every
   refusal reason collapses into the same object.** `placementIntake.ts`'s
   `runPlacementIntake` correctly classifies the learner's text and refuses
   to send a flagged one to the model — but landed on the exact same
   neutral fallback an ordinary Oracle outage produces, found by
   adversarial review 2026-08-30 (HIGH). Full detail and the fix (a new
   `flagged` field, logged loudly with the user id at Core's route handler)
   is in `/ORACLE.md` §4.1b. General lesson: "never throw at the learner,
   always land on a safe default" is right for the LEARNER-FACING side of a
   fallback; it must not also erase the REASON from every place that could
   act on it.
23. **Fencing model-authored text field-by-field means EVERY field needs to
   be found, not just the obvious ones.** `content/generate.ts`'s author
   brief fences `framing`/`rationale`/`recentTutorLines` — all strings the
   turn model writes — but `skillKey`, from the SAME turn-schema field
   family, was left in the trusted, unfenced half of the brief, found by
   adversarial review 2026-08-30 (HIGH). Turn-level moderation does not
   inspect `skillKey` either, so it was a live gap on the one content
   surface §1.9's Tutor carve-out exempts from human review specifically
   because fencing is one of its compensating controls. Full detail in
   `/ORACLE.md` §7.3. Same completeness-failure shape as item 17 above (a
   check that covers only the named cases, not the category): whenever a
   brief mixes fixed system-authored lines with fields a MODEL wrote, audit
   every field the model can set, not just the ones a first pass happened
   to fence.
24. **A "check the cache, then pay" sequence is not atomic just because it
   reads top-to-bottom.** `speech.ts`'s "pays once, ever" cache is a read,
   then (on a miss) a paid provider call, then a write-back — with nothing
   between the read and the write. Found by adversarial review 2026-08-30
   (MEDIUM): two different children's sessions greeting at the same instant
   on a cold cache both missed before either had written back, and both
   paid — proven with 2 Inworld calls for one shared, identical line. Fixed
   with in-flight promise coalescing keyed the same way the cache itself
   is: a module-level map for the shared/scripted cache (Oracle is a single
   replica, so a process-level map genuinely covers every session that
   could race), a per-`SpeechScope` map for session-scoped generated lines
   (matching the existing privacy split between the two caches). General
   lesson: any "have we already paid for this" check followed by a paid
   call and a write-back needs to ask whether TWO CONCURRENT CALLERS could
   both read the miss before either writes — sequential code reads as
   atomic and is not.
25. **A timeout that races an already-started promise cannot cancel it.**
   `withTimeout` (`lib/http.ts`) wraps a `fetch()` call that was already
   invoked before being handed in, so on our own timeout the underlying
   HTTP request to Inworld kept running in the background — possibly
   completing, and being billed, on the provider's side with nothing in
   our own ledger to show for it. Found by adversarial review 2026-08-30
   (LOW). Fixed by passing `signal: AbortSignal.timeout(ms)` directly into
   the `fetch()` call itself at all three Inworld call sites — `withTimeout`
   stays for its labeled error message, but the `signal` is what actually
   stops the request. Whenever wrapping a promise in a timeout race, check
   whether the promise's OWN constructor accepts a cancellation signal —
   racing it is not the same as cancelling it.
26. **A recheck placed after the call it is meant to gate cannot gate that
   call, no matter how tight its cadence is.** `ws/server.ts`'s per-turn
   voice-consent recheck lived only inside `handleLearnerTurn`, which for a
   MICROPHONE turn runs only AFTER `transcribe()` has already shipped that
   turn's audio to the third-party STT provider. Found by adversarial
   review 2026-08-30 (HIGH): this meant the CURRENT turn's audio leaked to
   the provider on every revocation, deterministically — not the rare race
   the "every turn" cadence (`CONSENT_RECHECK_MINOR_MIC_TURNS = 1`) was
   built to close, but a 100%-reproducible structural gap one level up from
   it. Fixed by moving the check into `handleAudioClip`, before
   `transcribe()` (`dueForMicConsentRecheck`/`refreshMicConsent`), with
   `handleLearnerTurn` skipping its own now-redundant check via a
   `micConsentAlreadyChecked` flag so a mic turn still costs exactly one
   consent round trip. General lesson: when a guardrail is meant to gate an
   expensive or sensitive call, check WHERE in the call sequence the guard
   actually runs, not just how OFTEN — a correct cadence checked at the
   wrong point in the sequence gates nothing for the turn that matters most,
   the one currently in flight.
27. **A pattern meant to catch a NARROW shape (a phone number) but written
   as a BROAD one (any long digit run) will fire on the tutor's own core
   content.** `moderation.ts`'s `contact_detail` check was
   `\b\+?\d[\d\s().-]{8,}\b` — any 9+ characters of digits, spaces, parens,
   dots or hyphens — found live, testing as a struggling learner,
   2026-08-30 (MEDIUM): it blocked a real tutor turn teaching change-making
   by counting up ("6 7 8 9 10") and a countdown ("10 9 8 7 6 5 4 3 2 1"),
   both entirely ordinary content for a MONEY tutor whose whole subject is
   small numbers. A real phone number's digits are GROUPED into 2-4-digit
   chunks; a counting sequence is a run of ISOLATED single/double digits.
   Fixed by requiring three groups (the middle and last each 3-4 digits) —
   the shape a phone number actually has and a counting sequence never
   does — and ratcheted into `safety/canary.ts`'s `BENIGN_OUTPUT` with the
   exact blocked sentences. General lesson: a regex meant to detect one
   SPECIFIC real-world shape (a phone number, an address, a date) should
   encode that shape's actual structure, not a loose superset of
   characters it happens to be made of — the superset will always contain
   content the product's own domain produces routinely, and for a
   money-and-numbers tutor specifically, digits ARE the domain.
28. **A "must not be negative" guard on a floating-point running total needs
   a zero band, not a zero line.** `whiteboard.ts`'s `computeSequence` chains
   decimal `add`/`subtract`/`multiply_percent` steps (`value` is
   `z.number()`, not an integer — money and fractions are legitimate), and
   its ceiling check was `current < 0`. In JS, `0.3 - 0.1 - 0.1 - 0.1` is
   `-2.7755575615628914e-17`, not `0` — found by adversarial review
   2026-08-30 (MEDIUM). A valid "spend it down to zero" sequence computed a
   hair below zero and was dropped exactly as if the model had proposed a
   nonsense board — same failure mode as item 17 (a checker only wrong in a
   condition nobody hand-picks: whole-number examples never hit it, only
   decimal ones do). Fixed with a `ZERO_EPSILON` (`1e-9`) that clamps a
   near-zero running value TO zero rather than rejecting it, while a value
   further negative than that is still refused unchanged. Any bound check
   on a value that is the OUTPUT of chained floating-point arithmetic —
   never one taken directly from input — needs to ask "how close" before it
   asks "which side of the line."
29. **The ONE retry a repair gets can swap one contradiction for its
   mirror image instead of removing it, and item 21's fallback delivered
   whichever one survived.** Found live, testing as a struggling learner,
   2026-08-30: a child answered "25" to a question whose right answer was
   15. Attempt 0 said "casi" but its own arithmetic landed back on the
   learner's number (25) — `contradictsCorrectAnswer` correctly caught this
   as `falseCorrection` and asked for a retry with "their answer was right,
   confirm it plainly." The retry took that instruction literally and
   produced a turn that congratulates 25 as correct while STILL stating the
   real answer is 15 in the same breath — `praiseContradictsAnswer`'s
   `falsePraise`, the mirror-image fault, which item 21's own text
   (pre-correction) had listed as safe to deliver on the theory that it is
   "imperfect but still teaches something new." It is not: telling a child
   they were right and wrong about the SAME answer in the SAME sentence
   teaches nothing and undermines every future "¡Exacto!" — the same defect
   class as item 21's repeat, not a different one, because delivering it
   reproduces the exact contradiction the check exists to catch rather than
   a merely clumsy turn. Fixed the same way item 21 was: a new
   `repairableIsFalseVerdict` flag, set whenever `falsePraise` or
   `falseCorrection` is true on the turn `repairable` captured OR on the
   turn that survives the retry, routes to the scripted line instead of
   `produce()`'s normal "deliver it anyway" path. General lesson: when a
   repair's correction message tells the model "you were wrong about X, the
   truth is Y," a model that takes the instruction at face value without
   re-deriving Y itself can produce a turn that is confidently wrong about
   whether the ORIGINAL claim or the correction is now the operative one —
   watch for the retry inheriting the correction's ASSERTION without
   inheriting its REASONING.
30. **A metadata filter that skips ONE axis on purpose ("the specific
   procedure beats the general one") can bypass an axis that was never meant
   to be optional.** Found by adversarial review, round 22 (2026-08-30,
   HIGH): `selectSkill`'s dedicated-misconception path filtered by
   `misconceptions`, `tiers`, and `notSpent` — never by `query.strategy` —
   on the theory that a diagnosed wrong idea should win regardless of mode.
   `controller.ts` sets `misconceptionCode` on every misconception-tagged
   failure and clears it only on leaving REMEDIATE, so a second consecutive
   failure that happens to carry a misconception code produces
   `strategy: 'RESCUE'` (rule 1, frustration first) with `misconceptionCode`
   still set — and this path handed back `counterexample-confront`, a skill
   declared `strategies: [REMEDIATE]` whose own procedure says "Never use
   this on a careless slip" and asks the child to defend and test their own
   reasoning. A frustrated child got intellectually confronted instead of
   the emotional de-escalation the controller had just decided was needed.
   Fixed by adding the same `s.strategies.includes(query.strategy)` filter
   the generic candidates path already had. General lesson: "the specific
   wins over the general" is a priority rule between two matches, not a
   licence to stop checking whether the specific one is even eligible.
31. **A "no lower rung to fall back to" strategy gets missed unless someone
   remembers to list it, one at a time.** Item 17 above widened
   `NO_PROGRESS_TRACKED_STRATEGIES` from SOCRATIC/FLUENCY to also cover
   DIRECT/WORKED/FADED. Found by the SAME adversarial review round that
   found item 30 (2026-08-30, HIGH): SPACED has the identical shape —
   `baseStrategy` returns it unconditionally for a due review, with no
   `stuck` check at all — and was left out. A learner who deflects a
   spaced-review question with "no sé" produces only `conversation_turn`
   events, never a graded failure, so before this fix the controller
   proposed SPACED forever with no escalation path whatsoever — the exact
   defect item 17 closed, just for the one strategy nobody had written a
   test for yet. Fixed by adding `'SPACED'` to the set and to rule 1b's
   strategy check alongside DIRECT/WORKED/FADED. General lesson: a "these N
   strategies share this failure mode" set is a claim about ALL strategies
   with that shape, not just the ones a past incident happened to surface —
   when adding a new item to a closed enum (`Strategy`) or reviewing one
   that already exists, check it against every guardrail keyed on the
   ENUM's members, not just the members a bug report already named.
32. **Two regexes hand-authored separately to recognize the SAME phrase set
   will drift, and the locale added last is the one that drifts.**
   `prompt.ts`'s `REPEATING_CUE` (does this turn narrate a growth story at
   all?) and `UNIT_WORD` (which cadence word did it use?) were two
   independently written regex lists needing the identical set of
   day/week/month/year phrasings across three locales. Found by adversarial
   review, round 23 (2026-08-30, MEDIUM): both were built almost entirely
   around Spanish "cada X" and English "every X," with Portuguese covered
   only by the CALQUED "a cada X" — never the natural "todo dia," "toda
   semana," "todos os meses" a Brazilian Portuguese speaker (or the model
   producing pt-BR output) actually says, and English "each X" was missing
   too. A pt-BR session telling a growth story with ordinary native phrasing
   set no `whiteboard`, and the repair that exists specifically to force one
   onto screen silently never fired — no warning logged, because the check
   that should have caught it did not recognize the sentence as a growth
   story in the first place. Fixed by making `REPEATING_CUE` a `RegExp`
   derived from `UNIT_WORD`'s own patterns (`UNIT_WORD.map(([re]) =>
   re.source).join('|')`) instead of a separately hand-written union, so the
   two structurally cannot drift apart again, and adding the missing
   natural-Portuguese and "each X" phrasings to `UNIT_WORD` itself — the one
   place both checks now read from. General lesson: when two checks need the
   SAME domain knowledge (a phrase list, a vocabulary set, a unit table),
   derive one from the other rather than authoring both by hand — the
   alternative is trusting every future edit to remember to touch both.
33. **A fix applied to three call sites of a shared helper does not cover the
   OTHER call sites of that same helper.** Item 25 above fixed `withTimeout`
   racing an already-invoked `fetch()` — which stops us waiting on our own
   timeout but never cancels the real request, which can still be billed
   with nothing in our ledger to show for it — at the three voice-provider
   call sites. Found by adversarial review, round 24 (2026-08-30, HIGH):
   the SAME `withTimeout` helper, imported the SAME way, was still unfixed
   at `model/provider.ts`'s `complete()` (the pedagogical model, called
   EVERY turn — the single highest-volume paid call in the whole service),
   `safety/moderation.ts`'s judge call (every model-authored turn), and
   `content/generate.ts`'s tier-3 judge. Fixed by passing a real
   cancelling `signal` into all four remaining `fetch()` calls (plus the
   model preflight probe, for consistency): `AbortSignal.timeout(ms)`
   directly for the two judges and the probe, and
   `AbortSignal.any([callerSignal, AbortSignal.timeout(ms)])` for
   `complete()` specifically, since it already accepted a CALLER-provided
   signal (a learner's interruption) that must keep working alongside the
   new timeout signal, not be replaced by it. General lesson: when a fix
   targets "every call site of X," grep for every OTHER caller of the
   underlying helper too — a fix scoped to the call sites a bug report
   happened to name is not the same claim as a fix scoped to the pattern.
34. **A retry budget frozen into a boolean before the first attempt starts
   cannot see that the first attempt itself spent the budget.** The
   pedagogical model's own retry re-checks a LIVE `Date.now()` against its
   deadline immediately before firing attempt 2. `moderateTutorOutput`'s
   `allowRetry` was instead a boolean the caller computed ONCE, before
   attempt 0 even started — found by adversarial review, round 24
   (2026-08-30, MEDIUM): a first judge attempt that itself consumed most
   or all of `MODEL_TIMEOUT_MS` (more than double the deadline the boolean
   was based on) still bought a second, full paid call unconditionally,
   despite a code comment claiming "same clock as the model's retry" that
   did not actually hold for the retry itself. Fixed by replacing the
   boolean with `ModerationInput.retryDeadlineMs` (the raw deadline,
   passed straight through from `orchestrator.ts`) and re-checking it with
   a live `Date.now()` inside the retry loop, mirroring the model's own
   pattern exactly. General lesson: a caller-computed boolean gate is only
   as fresh as the moment it was computed — if the gate is meant to reflect
   elapsed time, pass the clock reference itself and let the gated code
   check it live, not a pre-derived answer that goes stale the instant time
   moves on.
35. **A fire-and-forget promise's side effect on a shared ledger is not
   guaranteed to have happened by the time something reads that ledger.**
   `produce()`'s speculative synthesis for a turn that gets moderation-
   blocked is discarded (`void speculative`) rather than awaited — its
   cost only reaches `voiceUsd` whenever ITS OWN promise happens to settle,
   with nobody waiting on it. Found by adversarial review, round 24
   (2026-08-30, MEDIUM): if that discarded clip is SLOWER than the
   scripted replacement that ships instead (ordinary for a second, real
   TTS call), and that same turn also ends the session, `ws/server.ts`'s
   `finish()` read `totalCostUsd` and persisted it to Core before the
   slower clip had a chance to settle — permanently losing a real, billed
   cost, since nothing ever reads this orchestrator again once the session
   is closed. Fixed by tracking every discarded synthesis promise in
   `pendingDiscardedAudio` and adding `awaitPendingCosts()`, called from
   `finish()` right before the session's economics are treated as final —
   deliberately NOT on the per-turn path, where the whole point of firing
   these speculatively is to never make the learner wait on them. General
   lesson: a value read from a shared mutable ledger is only as complete as
   every promise that still owes it a write; the moment that matters is not
   "did we start every paid call" but "have all of them finished writing
   their cost," and those are only the same moment if something enforces it.
36. **A write function that checks "did the envelope parse" instead of "did
   the field say true" reports a partial failure as success.**
   `updateLearnerMemory` PUTs a proposed update to two independent stores in
   one call, and Core answers with an ordinary 200 whenever ONE store fails
   to persist — `{ written: { learner: false, pedagogy: true } }` is not an
   error envelope, just a partial result. Found by adversarial review,
   round 28 (2026-08-30, HIGH): this function checked only that the
   envelope parsed and `data !== null` — true in BOTH a full success and a
   partial failure — so a genuine per-store write failure was reported to
   the caller as a wholesale success. It was the odd one out in this file:
   every sibling write function (`persistTurn`, `persistSafetyFlag`,
   `closeSession`) already checks the real boolean field, not merely that
   a response arrived. Its own doc comment promises "a false return means
   did not land," which `session/review.ts` relies on to let the NEXT
   session's review try again — silently returning true instead meant a
   curated cross-session memory note could fail to persist with no retry
   and no warning, forever. Fixed by checking `written[store] === true` for
   every store actually proposed (a `null` store was never requested and
   correctly never appears in `written` — Core's own route skips it).
   General lesson: "the request succeeded" and "the thing the request asked
   for happened" are different claims for any write with more than one
   possible outcome, and only the second one is what a caller relying on a
   boolean return actually needs.
37. **A display-only degraded-read label does not survive being reused as
   the base state for a write.** `backend/services/tutorData.ts`'s
   `getLearnerMemory` collapsed "this learner genuinely has no memory yet"
   and "the read of it just failed" into the identical `{ learner: null,
   pedagogy: null }` shape, with its own comment calling this correct
   because the read is "Display-only (§1.14)". Found by adversarial
   review, round 28 (2026-08-30, HIGH): that labeling was wrong for its
   actual consumer. `session/review.ts` does NOT display the brief — it
   treats it as "the existing stores" and tells the model to write a
   REPLACEMENT that carries forward what still holds. A transient read
   failure on session N+1 therefore told the model there was nothing to
   carry forward, and the resulting "from scratch" note overwrote
   everything sessions 1..N had actually accumulated — a silent, permanent
   erasure of exactly the shape this file's own header names for
   `getLearningStatsForUpdate`. `intelDegraded` already makes this same
   distinction for the `skillStates` read; nothing equivalent existed for
   `learnerBrief`. Fixed end to end: `getLearnerMemory` now returns `null`
   specifically on a failed read (Core's `serviceRest` already signals this
   correctly — the bug was throwing the signal away via `rows ?? []`);
   the route threads a new `learnerBriefDegraded` flag alongside the
   (unchanged-shape) `learnerBrief` field, the same way `intelDegraded`
   rides beside `skillStates`; and `runPostSessionReview` refuses to run at
   all when `learnerBriefDegraded` is true, rather than trusting an empty
   brief it cannot tell from a failed one. General lesson: before reusing a
   "failure degrades to empty, and that's fine" read somewhere new, check
   what the NEW caller actually does with the result — the same collapse
   that is harmless for a read that only ever gets shown is a data-loss bug
   for one that gets treated as the starting point of a replace.
38. **A shared failure counter is reset by a write that has nothing to do
   with the failure it exists to detect.** `ws/server.ts`'s
   `persistSafetyFlag` call — the write migration 0054's whole episodic-
   recall exclusion depends on (`NOT EXISTS` against `tutor_safety_flags`)
   — used to be a bare fire-and-forget with no retry and no failure
   counter at all, found by adversarial review, round 29 (2026-08-30,
   CRITICAL): a blocked turn (a child's own address/phone/email —
   `personal_data` → `turn_blocked`, the session keeps going) whose flag
   write silently failed left that turn indistinguishable from an ordinary
   safe one, so a later "¿te acuerdas cuando te dije...?" recall could
   resurface the PII verbatim into the model context. The first fix
   attempt chained it through `notePersist` — the SAME counter
   `persistTurn` already uses — and it was WRONG, caught only because the
   regression test that was supposed to prove it kept timing out: a
   blocked turn also writes the learner's raw text via the ordinary
   `persistTurn` call one line above, which succeeds against a healthy
   Core even when the flag write is the one failing, so that success reset
   the shared counter to zero every single turn and it could never detect
   five consecutive FLAG failures specifically, no matter how many
   occurred. Fixed with `noteFlagPersist`, a sibling with its own
   dedicated counter (`flagPersistFailures`), never shared with
   `persistFailures`. General lesson: before routing a new failure through
   an EXISTING "N consecutive failures closes the session" counter, ask
   whether anything ELSE on the same turn writes successfully regardless
   of whether the new thing you're counting failed — if so, that success
   will paper over the exact failure the counter exists to catch, and only
   a live test that actually drives the counter to its threshold (not just
   asserts the call is now chained) will catch it before production does.
39. **A design comment's own stated trade-off can be wrong once measured.**
   `database/migrations/0053_learner_memory.sql` hardcoded the Spanish
   Postgres text-search config for episodic recall's `text_tsv` and
   `search_tutor_turns`, with an explicit, deliberate comment: "for en-US/
   pt-BR content the match degrades to stemless term matching, which is
   still useful and still indexed." Found by adversarial review, round 29
   (2026-08-30, HIGH), measured against a real local Postgres:
   `to_tsvector('spanish','remember')` and `to_tsvector('spanish',
   'remembered')` produce two DIFFERENT stems for the SAME English root —
   the Spanish stemmer does not merely skip stemming non-Spanish words, it
   actively MISTRANSFORMS them, so a query built from one inflection could
   not find text stored in another even under the identical config both
   actually ran. Recall was not "degraded" for two of this product's three
   locales, it was unpredictably broken, invisible in production because a
   failed/empty recall degrades to the turn already in hand. Fixed in
   `database/migrations/0056_recall_locale_aware_fts.sql`: `text_tsv`
   converts from a GENERATED column (which cannot read the sibling
   `tutor_sessions.locale` a correct config choice needs) to a
   trigger-maintained one via `ALTER COLUMN ... DROP EXPRESSION` — kept the
   column, its data and its GIN index in place, no drop/recreate — and
   `search_tutor_turns` gained a `p_locale` parameter threaded all the way
   from `orchestrator.ts`'s `this.session.locale` through Core. General
   lesson: a code comment that explains and accepts a limitation is a
   HYPOTHESIS about how bad that limitation is, not a verified fact — when
   a surface built under that hypothesis later gets its own dedicated
   review, re-measure the original trade-off rather than treating the
   comment as settled just because it already gave a reason.

40. **A one-time ticket spent at GRANT time, not at DELIVERY time, is spent on
   attempts that deliver nothing — and a mechanism scoped to one call site
   silently excludes every other path the same condition also describes.**
   Found by adversarial review, round 33 (2026-08-30, two HIGH findings, same
   root cause). The grace turn (`handleLearnerText`'s "never end mid-question"
   fix, item 810 area) set `this.closeGraceUsed = true` the instant the grace
   turn was GRANTED — before the model call that attempts it even started. A
   learner who interrupted that one attempt (the same ordinary interrupt path
   every turn allows) burned the ticket on a turn that delivered nothing, and
   the very next attempt at the exact same open thread got the abrupt scripted
   close with zero chance to try again — reproducing the "ended mid-question"
   defect the mechanism exists to prevent, just delayed by one turn. The exact
   "checked also means checked at the right moment" class this file already
   named once for `usedSkillNames` (item 33 area, `commitSkillUse`), recurring
   in a DIFFERENT piece of state because the fix for the first instance was
   never generalized into a rule. Separately, the mechanism's own `openThread`
   condition names "an activity still on screen" as HALF of what qualifies —
   but `handleSegmentResult` and `handleVoiceCheckResult`, which both grade an
   activity BEFORE reacting to it, never computed grace eligibility at all,
   so a budget that ended exactly as a graded widget or a spoken answer came
   back fell straight into `produce()`'s unconditional scripted close: scored
   and never acknowledged, the "promised something and abandoned" shape
   `handleSegmentUnavailable`'s own doc comment names for a different cause.
   Fixed by extracting `graceTurnFor`/`commitGraceTurn` as shared helpers used
   by all three call sites, and by moving the ticket-spend to AFTER `produce()`
   resolves, gated on `outcome !== null` (mirroring `commitSkillUse`'s own
   `emission.source === 'model'` gate). General lesson, stated once so it does
   not need re-deriving per field: (1) a flag that gates "may this happen
   again" must be committed on CONFIRMED OUTCOME, not on the decision to try —
   an interrupted/aborted/failed attempt must leave the flag exactly as if the
   attempt had never happened, because from the state machine's point of view
   it didn't; (2) when a shared condition (here, `openThread`) is defined once
   for one caller, grep every OTHER caller whose own doc comments describe the
   same situation in different words ("an activity still on screen" was
   sitting in a comment the whole time) before assuming the mechanism already
   covers them.

41. **A field that reaches the WIRE has not necessarily reached STORAGE, and a
   comment that says otherwise is a claim, not a fact.** Found by adversarial
   review, round 35 (2026-08-30, HIGH): the V4 whiteboard (`turnSchema.ts`'s
   `WhiteboardSchema`, computed server-side and sent over the live socket by
   `ws/server.ts`) had no column on `tutor_turns`, no field on
   `PersistTurnInput`, and none of the three `persistTurn` call sites passed
   one — a session that drew a board lost it silently on replay and on the
   guardian transcript viewer, while `/ORACLE.md` §12's own table listed only
   what a HUMAN had remembered to add there, not what the code actually
   persisted. `oracle/src/tutor/prompt.ts`'s `narratesUnshownGrowth` check
   actively forces a repair loop whenever the model narrates a growth story
   without drawing a board, so this was not a rare feature — any
   savings/growth-sequence lesson is steered toward using it, which is why
   nobody had reported it: the LIVE turn always looked complete, and the gap
   only existed one layer downstream of anywhere anyone was looking. Fixed by
   capturing the SAME server-computed wire object once (`wireBoard` in
   `deliver()`) and threading it through `persistTurn` → Core's `/turns`
   route → `tutor_turns.whiteboard` (migration `0058`) → the replay script →
   `TutorWhiteboard` — the live component reused as-is, no new render logic
   invented, because the shape it already draws is exactly the shape now
   stored. General lesson: when auditing "does X reach Y", trace the actual
   data path end to end rather than trusting a table that describes the
   INTENT — a docs table is a promise a human made, and a promise is not a
   test.

42. **"The object has exactly these fields" is a contract with the model,
   and an incomplete one teaches the model the field does not exist.** Found
   by adversarial review, round 37 (2026-08-30, MEDIUM): `TUTOR_SYSTEM_PROMPT`'s
   own JSON-shape declaration (`prompt.ts`, "The object has exactly these
   fields:") never listed `whiteboard` at all — the ONLY place the model was
   ever told to set it was 35 lines later, inside a single worked pedagogical
   example, with `multiply_percent` never named or explained anywhere in the
   prompt. This is a plausible root cause of the ALREADY-measured symptom
   this same file's `narratesUnshownGrowth` comment records: the real model
   sometimes narrates a growth story and never sets `whiteboard` at all — a
   silent omission indistinguishable, from inside the model, from "this field
   does not really exist," because the schema block that is supposed to be
   authoritative said so. The existing fix for that symptom (a repair-loop
   retry) treats the SYMPTOM every time it fires; this closes a plausible
   CAUSE once. Fixed by adding `whiteboard` to the schema block, and by
   naming and defining all three step operators explicitly, particularly
   `multiply_percent` — which, per `whiteboard.ts`, can ONLY ever grow a
   quantity (there is no code path that shrinks via percentage; `subtract`
   is the only way to represent spending-down, discount or loss). Left
   unexplained, a model reaching for "multiply by a percent" by the more
   common natural-language reading ("the new value IS X percent of the old")
   would produce a board that GROWS while the narration describes something
   SHRINKING — the exact drawn-vs-spoken contradiction this whole feature
   exists to prevent. Verified live post-fix (`tutor:converse`, the paid
   `tutor-deploy step=converse` gate being blocked by the same account-wide
   billing issue tracked all session): whiteboard usage increased across
   runs, including a correctly-represented decreasing story via `subtract`
   ("cada semana come 1 tonelada", 6→5→4→3→2→1→0) and, for the first time
   observed this session, a correct `multiply_percent` growth story ("cada
   mes crece 10%", 10→11→12.1→13.31) — both consistent with the clarified
   prompt, neither reproduced before it. General lesson: an incomplete
   schema declaration is not a smaller version of the correct one, it is a
   different, WRONG contract — the model has no way to know a field merely
   went unlisted rather than genuinely not existing.

43. **A bonus visual is not worth a lesson, and this file already knew
   that twice before `whiteboard.unit` made it a third time.** Found LIVE,
   round 39 (2026-08-30, HIGH): a real `tutor:converse` run produced
   `discarded model turn (invalid_shape): whiteboard.unit: Invalid option`
   — the model set `whiteboard.unit` to a value outside
   `day|week|month|year`, `TutorTurnSchema`'s top-level `.strict()` parse
   failed on the WHOLE object, and a real, well-taught reply was thrown
   away over one cosmetic field. Worse than the two prior incidents this
   exact file already documents (`preferredTypes`'s doc comment,
   `emotion`/`action`'s "A GESTURE IS NOT WORTH A LESSON" block): unlike
   every OTHER repairable fault the orchestrator's retry loop handles
   (`wrongUnit`, `missedWhiteboard`, a repeated sentence, a self-answered
   question — each sets a `turnCorrection` string the retry prompt
   actually sees), `invalid_shape` sets none, so the one retry attempt is
   a blind re-ask with no idea what to fix. Fixed the same way the other
   two were: in `turnSchema.ts`'s `parseTurn`, before validation, if
   `whiteboard` is present and fails `WhiteboardSchema.safeParse` on its
   own, it is dropped to `null` wholesale — not patched field-by-field —
   so a bad `op`, `currency`, or `kind` degrades exactly the same way a
   bad `unit` does. `say`, `next` and `segmentRequest` are untouched;
   only the bonus visual is lost. Two new tests in `session.test.ts`
   ("keeps the lesson when only the WHITEBOARD is malformed" / "...has an
   out-of-vocabulary step operator") prove it directly against `parseTurn`,
   confirmed to fail without the fix via `git stash`. General lesson: this
   codebase now has THREE independent instances of "an optional field's
   closed vocabulary lives inside a `.strict()` object that gates the
   ENTIRE turn" — `preferredTypes`, `emotion`/`action`, and `whiteboard`.
   The next new optional field with its own enum should be checked
   against this list before it becomes a fourth.

44. **A carrier field being validated is not the same as the VALUE inside it
   being meaningful.** Found by adversarial review, round 40 (2026-08-30,
   HIGH, paired with a Core-side fix closing the actual injection channel —
   see `RUNBOOK.md`): the `faq` intent's `skillKey` carries one of Core's
   four published FAQ ids (`what_is_saving`, `why_prices_change`,
   `what_is_a_budget`, `how_does_a_loan_work`) — but `plan.ts`'s
   `buildPlan` treated it exactly like `weak_skill`'s `skillKey`, letting
   the raw id fall straight through to `subject` and become the ENTIRE
   lesson `objective`: `Teach one real idea about "why_prices_change"
   until the learner can use it.` The model was never told this names a
   QUESTION, was handed a mangled snake_case identifier instead of the
   actual curated question, and had no locale signal despite the identifier
   being English regardless of the session's own language. Fixed with a
   small closed `FAQ_TOPICS` map translating each of the four ids to a
   readable English phrase (`why_prices_change` → `"why prices change"`);
   an id outside the map (should never happen post the Core-side fix, but
   Oracle does not trust that as its only gate) degrades to the existing
   no-subject objective rather than showing a broken slug — the same
   "emit nothing rather than something wrong" posture item 42's sibling
   lesson (§1.14, `LF_VISUAL_IDENTITY`) already established for images.
   Two new tests in `plan.test.ts` prove the readable phrase appears and
   the raw id never does, confirmed to fail without the fix via
   `git stash`. General lesson: a field can be perfectly well-formed and
   still meaningless to the model — closing the SHAPE (Core's fix) and
   closing the MEANING (this fix) are two different defects that happened
   to share one root cause.

45. **A re-check written for ONE identifier shape does not catch every
   identifier shape, and this file's own `session/review.ts` said so about
   itself.** Found by adversarial review, round 42 (2026-08-30, HIGH): the
   post-session review's §1.9 re-check (`session/review.ts`) was a single
   regex matching only digit/URL-shaped tokens (`@`, `https?://`, a
   phone-shaped digit run) — a surname or a school name has NEITHER shape
   and sailed straight through untouched. The proposal this call produces
   is not shown to a child once and forgotten: it is persisted as
   `learner_memory` and re-injected VERBATIM, UNFENCED, as trusted
   system-prompt text into EVERY future session — a direct §1.9 violation
   ("no surnames, no locations... sent to a third-party AI API")
   repeating itself forever once written once. Fixed by reusing
   `moderateTutorOutput` (`safety/moderation.ts`) — its judge already
   carries a `personal_information` harm category built for exactly this
   class of free-text classification a regex cannot do, so no second judge
   was stood up. `requireModelPass: true` UNCONDITIONALLY, regardless of
   `isMinor`: unlike a live spoken turn (time-sensitive, an adult session
   may run on the deterministic pass alone per §6), this write is
   permanent and this call has no client waiting on a clock, so the
   fail-closed judge always runs — a memory note about ANY learner
   deserves the same protection before it is believed forever. Two new
   tests in `review.test.ts` prove a name+school proposal is dropped whole
   when the judge flags `personal_information`, and that an UNAVAILABLE
   judge also drops the proposal rather than writing it unverified (fail
   closed, not fail open); every existing test needed a mocked judge
   response added to its call sequence, since the check now runs
   unconditionally on every non-null store. Confirmed to fail without the
   fix via `git stash`. General lesson: this file already names TWO prior
   incidents of "a hand-written regex only catches the shape its author
   thought of" (`preferredTypes`, item 42's `whiteboard.unit`) — a §1.9
   re-check deserves the SAME model-judge treatment this codebase already
   gives live spoken output, not a bespoke pattern match, because the
   thing being checked (does this contain an identifier) is exactly the
   kind of free-text judgment a regex cannot make and a judge already can.
46. **A fact available in the prompt is not a fact the model will use, if
   something closer to the point of generation contradicts it.** Found live,
   testing as the owner's low-retention persona, 2026-08-30: the tutor's own
   preceding turn announced a coin-counting activity ("Te voy a mostrar un
   cofre con monedas...") to set up a `financial-education/cobrar-y-dar-cambio`
   request, and the ladder served a `sort_buckets` needs-vs-wants activity
   instead — an ordinary mismatch `segmentRequest.preferredTypes`'s own doc
   comment already allows for ("the system may still serve something else if
   nothing visual exists for this skill yet"). The reaction turn
   (`handleSegmentResult`, already carrying item 14's fix) described the COIN
   activity anyway, inventing a specific wrong total ("elegiste una moneda de
   5 y una de 2... te falta una moneda de 1") for a sort activity with no
   coins or numbers at all — a THIRD manifestation of the class items 14 and
   the 2026-08-29 `openActivity` fix (`prompt.ts`'s "Talk about THIS, not
   about the one you had in mind") both already tried to close. This time the
   context message ("ON THE LEARNER'S SCREEN RIGHT NOW") was correct and
   present — grounding was available, exactly as item 14 found it was — so
   the gap was never missing information, it was POSITION: `produce()` places
   the context message early, for prefix-cache reasons, and the model's OWN
   richer, more specific promise sits LATER, in conversation history, closer
   to the reaction instruction than the truth is. `handleVoiceCheckResult`
   never had this failure mode, because the one fact it needs — the learner's
   verified utterance — is the last history line before its own instruction,
   adjacent by construction. Fixed by restating the real activity type and
   prompt (read from `this.openActivity`, already tracked for exactly this)
   directly inside `handleSegmentResult`'s own reaction instruction — the SAME
   message as "name the specific thing they did" — instead of relying on the
   model to reach back past its own conflicting narrative to find it. Proven
   with a test that inspects the literal messages array `produce()` sends
   (`orchestrator.test.ts`, "the reaction turn must not lose to the tutor's
   own earlier promise"): the conflicting narrative is confirmed present in
   history, further from the context message than the truth is, and the
   reaction message itself is asserted to carry the real type and prompt.
   Confirmed to fail without the fix via `git stash`. General lesson: a rule
   stated once, early in the prompt, does not protect a later decision it
   never sits beside — if a later message can conflict with an earlier fact,
   restate the fact next to the decision, rather than trusting the model to
   retrieve it across the whole conversation. Two independent rounds of
   prompt wording aimed at this exact failure (item 14, and
   `buildContextMessage`'s own "not about the one you had in mind") narrowed
   it without closing it, because both added MORE instruction rather than
   moving the FACT closer to where it is needed.

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


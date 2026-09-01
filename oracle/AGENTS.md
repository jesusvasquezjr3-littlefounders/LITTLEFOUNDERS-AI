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

**The judge sees more than one turn ONLY on purpose, and only a little.**
`ModerationInput.recentTutorLines` (round 104, 2026-08-31, item 75) is a
bounded window of the tutor's OWN already-spoken lines, given to the judge
so a "crescendo" spread across a few turns is not structurally invisible
to a per-turn, zero-memory check. It is not a full transcript and not a new
call path — both were considered and rejected on cost grounds — and it
never carries the learner's words, which have nothing to fence them here.

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

47. **An instruction that demands a specific truth is unsatisfiable — and
   gets satisfied by invention — when nothing upstream ever carries that
   truth.** Found live, testing as a low-retention/struggling persona,
   2026-08-30 (HIGH): items 14 and 46 both stopped the model from lifting
   the WRONG activity's details into a segment-result reaction, but the
   instruction itself still said "name the SPECIFIC thing they did... the
   choice they made, the numbers they used, the order they picked... never
   invented." `segment_graded` (`ws/server.ts`) carries only `segmentId`,
   `score`, `correct` and an optional `misconceptionCode` — no item, option,
   amount or order the learner actually submitted is EVER sent to Oracle;
   the frontend grades client-side against Core, not us. Told to be specific
   about a submitted answer and given no submitted answer to be specific
   about, the model complied the only way it could: on a real `sort_buckets`
   needs-vs-wants miss it told the learner, live and verbatim, "vi que
   pusiste 'comida' en 'lo que quiero'" and, the very next miss, "pusiste
   zapatos en 'quiero'" — two concrete, confident, entirely fabricated
   claims about what the child chose, since no "comida" or "zapatos"
   appeared anywhere in the session. A coin-counting miss in the same run
   got the softer version: "elegiste algunas que sumaban más de lo pedido"
   — a specific failure MODE invented with equal confidence from the same
   nothing. §1.14's own lesson about a generative image inventing a default
   subject applies unchanged to generated speech: a confident wrong account
   of what happened misleads a struggling child worse than an honest general
   one would, and this persona is exactly the child least able to tell the
   difference between "you got this wrong" and "you did a specific thing
   that never happened." Fixed by rewriting the instruction to ground in the
   two facts that ARE always true — the activity's real type and prompt
   (already restated adjacent to it, per item 46) and whether they got it
   right — and to explicitly forbid inventing the submitted specifics
   instead of demanding them: "grounded ONLY in what you actually know...
   Do NOT invent the specific items, numbers, choices or order they picked —
   you were never told those." The REMEDIATE strategy's own catalogued
   misconception hint (real, curated content, appended separately) is
   untouched — this only changes the one instruction that was asking for
   specifics with nothing behind them. Proven with a new
   `orchestrator.test.ts` test asserting the reaction message forbids
   inventing and no longer contains the old unsatisfiable demand; confirmed
   to fail for the exact claimed reason pre-fix via `git stash`. Re-verified
   live afterward across the full `tutor:converse` scenario set (including
   the same low-retention persona and the "keeps failing" persona that
   surfaced it): every incorrect-activity reaction across the run was
   honest and general ("todavía se nos resiste un poco", a needs-vs-wants
   metaphor with no invented item names) with zero fabricated specifics,
   where the same run previously produced two per conversation. General
   lesson: when a prompt instruction demands specificity, check that
   something upstream actually CAN supply it for every case the instruction
   covers — an instruction can be perfectly worded and still be a standing
   invitation to hallucinate if the data behind it doesn't exist for some of
   the paths that reach it.

48. **A shared step vocabulary carries an assumption from the sequence it was
   written for, silently, into every OTHER sequence that reuses it.** Found
   by adversarial review, round 48 (2026-08-30, MEDIUM): `diagnostic` is the
   only intent whose plan (`plan.ts`'s `SEQUENCES.diagnostic`:
   `['warmup', 'check', 'check', 'explain']`) puts `check` before `explain`
   ever runs. `PLAN_STEP_GUIDANCE.check`, shared verbatim across every
   intent, reads "Ask them to USE the idea or explain it back in their own
   words" — worded for confirming retention of something already taught,
   which at `diagnostic`'s own step 2 has not happened yet. Rendered for a
   cold-start diagnostic session, the model received three instructions
   pulling in different directions in the same prompt: `INTENT_INSTRUCTIONS
   .diagnostic`'s "find out where they stand... it must not feel like a
   test", the shared `check` guidance's "use an idea" that this session had
   not taught, and (with no learner history) "open with one short, friendly
   diagnostic question." Nothing in the codebase tested step-guidance TEXT
   for coherence per intent — `plan.test.ts` only ever asserted step
   sequences and objective strings — so a genuine authoring gap in a
   deterministic, model-free file went unnoticed by every gate. Fixed by
   giving `check` a second, `diagnostic`-specific rendering
   (`DIAGNOSTIC_PROBE_GUIDANCE` in `prompt.ts`) selected in
   `buildContextMessage` when `step === 'check' && intent === 'diagnostic'`:
   it asks the model to probe with a small, low-stakes situation and read
   whatever comes back as information rather than as correct or wrong,
   instead of demanding a look-back at teaching that never happened. Every
   other intent's `check` step is untouched — proven by a dedicated test
   asserting `course_topic`'s `check` step still renders the original
   wording verbatim. New `prompt.test.ts` (this module had zero direct unit
   coverage before this fix — every prior check exercised it only through a
   full orchestrator turn) calls the real `buildPlan` → `planState` →
   `buildContextMessage` pipeline directly and asserts the diagnostic
   rendering; confirmed to fail for the exact claimed reason pre-fix via
   `git stash`. Re-verified live: a new permanent `tutor:converse` scenario
   (`'a first-ever session, diagnostic (no history at all)'` — the harness's
   first-ever exercise of `intent: 'diagnostic'`) opened with a small,
   ungraded, low-stakes question rather than anything that read as a test,
   across all four turns of its own `check` steps.

49. **A compare-and-swap that reads its own "expected" value moments before
   the compare can never detect the race it exists for.** Found by
   adversarial review, round 51 (2026-08-30, MEDIUM): item 42's
   `write_learner_memory_checked` (migration 0059) closed a real race — two
   calls landing within the same network round trip — but `writeLearnerMemory`
   populated `p_expected_before` with a FRESH read taken by the function
   itself, immediately before the RPC call. That value, by construction,
   always matches whatever the row currently holds (barring a sub-second
   window), so the optimistic-concurrency check could never catch the
   realistic case: two whole SESSIONS overlapping, each with a proposal
   computed from a belief read MINUTES earlier at session start — exactly the
   case 0059's own comment already admitted was out of scope, and this
   product's 2-sessions-per-day cap makes "two tabs open at once" ordinary
   rather than contrived. Session A writes first; session B's OWN fresh
   internal read then sees A's write, "expects" exactly that, and silently
   overwrites it with content computed from B's stale belief — zero conflict
   reported, indistinguishable from an uncontested write. Fixed by threading
   the CALLER's actual belief through instead of re-deriving one: Oracle now
   sends `learnerBrief` (the same session-start snapshot the model's prompt
   was built from) as `expectedBefore` on `PUT /internal/learner-memory`, and
   `writeLearnerMemory` compares against THAT rather than a value it invents
   itself. The SQL function needed no change — it already accepted an
   arbitrary caller-supplied `p_expected_before`; the bug was entirely in
   which value the application code chose to pass. Proven with a repro
   modeling the real CAS semantics end to end: two "sessions" proposing from
   the same starting belief, the first's write landing, the second's
   correctly refused (`false`, logged) with the first's real content intact
   — confirmed to fail for the exact claimed reason pre-fix via `git stash`
   (the second write incorrectly succeeded and clobbered the first's update).
   General lesson: an optimistic-concurrency check is only as good as the
   staleness of the value it compares against — comparing against a value
   read at the LAST possible moment protects against nothing, since it will
   always agree with itself.

50. **A worked example in a static, prefix-cached prompt is CONTENT the model
   can reuse, not merely a format the model performs.** Found live, testing
   across many independent scenarios this session, 2026-08-30 (MEDIUM): the
   "SHOW YOUR WORK" instruction's own example ("guardas 10 pesos, cada
   semana te dan 2 más... ¿cuántos al final de la tercera semana?") appeared
   verbatim or near-verbatim in multiple UNRELATED conversations — different
   nicknames, ages, questions — every time a growth-over-time story came up.
   This file's own rule #1 ("the static part comes first and never varies")
   is exactly what makes the example's own numbers byte-identical on every
   single call in the first place; the model was not failing to invent
   anything, it found a perfectly serviceable worked example already sitting
   in its own instructions and reused it, absent any rule against doing so.
   The cost is real personalization loss: every child asking about saving
   over time got the identical canned story — the opposite of the very next
   bullet's own promise ("the numbers are invented, and you are the one who
   invents them"). Fixed in two passes, because the first was insufficient
   and only live re-testing caught that: pass one added "invent your OWN
   different amount, rate and reason every time, never these exact numbers"
   beside the example, which stopped the LITERAL SENTENCE from recurring
   (confirmed live — phrasing genuinely varied across a fresh run) but the
   model kept reaching for the SAME 10/+2 arithmetic anyway, just narrated
   differently ("Cada año el banco te da 2 más" — 10 → 12 → 14). Pass two
   named the exact numbers to avoid outright ("THE NUMBERS 10 AND 2 ARE THE
   ONES IN THIS EXAMPLE... a real invented amount looks like 35, 8, 120, 6")
   — re-verified live afterward across the full scenario set: 35/+5, 30/+3,
   8/+2 in an age-appropriate context, 1/+3 (a dinosaur's weight, thematically
   invented for that exact conversation), 35/+8 — no repeat of 10/+2 anywhere
   in the run. Both changes are wording only, in the SAME static prompt
   position, so prefix-caching is unaffected (rule #1 is still honored — the
   text is a constant, just a different one). Proven with a test asserting
   the exact callout strings are present in `TUTOR_SYSTEM_PROMPT`; confirmed
   to fail for the exact claimed reason pre-fix via `git stash`. General
   lesson: an instruction that says "invent your own" beside a worked example
   is not the same as an instruction the model actually generalizes from —
   verify the ACTUAL numbers a live run produces, not just that the sentence
   changed, and be willing to iterate the wording again when the first pass
   only gets partway.

51. **"A clumsy real sentence beats a scripted apology" is the right call for
   an imperfect turn, and the wrong one for content that must never reach a
   child at all.** Found live, testing as a struggling learner, 2026-08-30
   (HIGH): the repair loop's own established design — deliver `repairable`
   (the flagged attempt-0 turn) or the retry's own output rather than a
   scripted line, when a repair fails — correctly protects a turn from being
   destroyed over something merely imperfect (a missing whiteboard, an
   unkept promise, a self-answered question). `tierVocabularyViolation` was
   grouped into that same bucket, on the same reasoning: "imperfect but
   still teaches something new." That reasoning does not hold for
   `TIER_FORBIDDEN` — this check exists specifically because the owner's
   session on 2026-08-28 had the tutor explain "interés compuesto" with
   "10% cada año" to a much younger vocabulary band, and nothing caught it
   (see this file's own §2's vocabulary-gate entry). A violation that
   SURVIVES the one retry is not a stylistic flaw a child can still learn
   from — it is the exact age-inappropriate content the mechanism was built
   to keep out, delivered anyway. Reproduced live twice in the same session:
   a tier-2 conversation where the retry repeated "interés compuesto"
   verbatim, and a PRE-EXISTING TEST (`'delivers the turn anyway if the
   retry also slips, rather than a dead turn'`) that had locked in the
   identical bug for a TIER1 (roughly 6-7 year old) session delivering
   "Sigue siendo 10% al año." — the youngest band, where this content does
   the most damage. Two distinct code paths led to the same outcome and
   both needed the same fix: (1) inside the retry loop, a violation
   surviving attempt 1 now joins `falsePraise`/`falseCorrection` in setting
   `repairableIsFalseVerdict = true` instead of falling through to
   `turn = parsed.turn`; (2) the `repairable` snapshot taken at attempt 0
   now ALSO flags itself unsafe when `violation !== null`, closing a second,
   narrower path where the RETRY itself transport-fails (an empty
   completion) rather than merely still-violating — pre-fix, that path
   independently delivered the attempt-0 violating turn verbatim, since
   `repairableIsFalseVerdict` was computed from `falsePraise || falseCorrection`
   alone. Proven with two new `orchestrator.test.ts` tests covering both
   paths, plus a correction to the pre-existing test that had encoded the
   bug as intended behavior; all three confirmed to fail for the exact
   claimed reason pre-fix via `git stash`. Re-verified live afterward: the
   same "interés compuesto" slip that used to survive now falls back to the
   scripted line ("repair attempt for a false verdict or forbidden
   vocabulary failed — scripted line instead of delivering it"). General
   lesson: when a repair-failure fallback groups several fault types into
   "deliver anyway" vs. "scripted line instead," re-examine the group
   whenever a NEW check joins it by analogy — the original two-bucket split
   was reasoned about "imperfect but survivable" vs. "actively wrong,"
   and a vocabulary gate built after a real safety incident belongs in the
   second bucket, not wherever a first, cursory placement put it.

52. **Two different fence vocabularies exist, and the deterministic
   prompt-leak check only ever recognized one of them.** Found by
   adversarial review, round 55 (2026-08-30, HIGH), a dedicated sweep of
   every call site reaching moderation. `safety/untrusted.ts`'s
   `fenceUntrusted` wraps ONE learner utterance in a `LEARNER_INPUT_<nonce>`
   fence; `session/review.ts`'s `fenceTranscript` wraps a WHOLE session
   transcript in a deliberately different `SESSION_TRANSCRIPT_<nonce>`
   fence, since it fences a multi-speaker transcript rather than one line.
   `safety/moderation.ts`'s `PROMPT_LEAK_MARKERS` only ever listed the
   `LEARNER_INPUT` shape — verified end to end that a recitation of the
   `SESSION_TRANSCRIPT` fence sailed straight through `moderateTutorOutput`
   even with `requireModelPass: true`, because a judge answering strictly
   within its own documented, closed harm-category vocabulary correctly
   says "safe" to reciting a data fence (it is not sexual, violent,
   self-harm, etc.). This matters MORE here than at a live turn: this
   call's output is persisted as `learner_memory` and re-injected,
   UNFENCED, as trusted system-prompt text into EVERY future session — a
   successful escape here is a cross-session, elevated-trust payload, not
   one turn a later pass might still catch. Fixed with a matching
   `SESSION_TRANSCRIPT` marker pair added to `PROMPT_LEAK_MARKERS`, a new
   `leaks-session-transcript-fence` output canary (so `npm run verify:tutor`
   — the operational gate, not just the unit suite — enforces it going
   forward), and threading `fenceTranscript`'s own nonce into
   `moderateTutorOutput`'s per-call echo check (it used to be omitted
   entirely), the same defense `orchestrator.ts`'s per-turn fence already
   gets. The SAME sweep also found `content/generate.ts`'s tier-3
   generation path omitting its own fence's nonce from its moderation call
   (LOW — the generic marker still catches a full fence recitation; only a
   bare-nonce echo with no surrounding syntax would have slipped through)
   — fixed alongside it, same mechanism.
   Proven: `fenceTranscript` exported and directly tested for a fresh
   nonce per call and correct embedding (mirroring `fenceUntrusted`'s own
   existing tests); confirmed to fail for the exact claimed reason pre-fix
   via `git stash` (`fenceTranscript is not a function`, and the new canary
   absent from the corpus). A background review (not this session's own
   testing) also found a real MEDIUM gap — a resumed Tutor session can keep
   enforcing a STALE `isMinor` for up to the 90-second resume grace window,
   since the orchestrator's `private readonly session` is never refreshed
   on resume while sibling gates on the same reconnect (door gate, mic
   gating) already use a freshly re-verified value — deliberately NOT fixed
   this round, because `this.session` is used pervasively beyond `isMinor`
   and deciding which fields should refresh on resume versus stay pinned
   to the original connection (tier, courseContext, voiceConsent) is a real
   design question, not a one-line patch; spawned as its own follow-up
   (`task_b249a68e`) with the design groundwork already captured.

53. **The session's own language was stated once, early in the prompt, and
   never checked — one foreign-language learner utterance was enough to
   make the tutor abandon it.** Found live, testing as a real logged-in kid
   account with an en-US profile, 2026-08-30 (HIGH) — the first time any
   round of this session's testing had used a locale other than es-MX,
   because every `tutor:converse` fixture locks `locale: 'es-MX'` and this
   path had therefore never been live-exercised at all. The learner typed
   ONE Spanish sentence ("que es un precio?"); the tutor correctly answered
   turn 1 in English, then on turn 2 — replying to a bare "8", no language
   cue of its own — switched entirely to Spanish and stayed there until
   explicitly told "please explain in English." Every OTHER prompt-adherence
   property this session has hardened (tier vocabulary, false praise,
   repeated sentences, missed whiteboards, unkept promises) has its own
   deterministic check wired into the repair-retry loop; language adherence
   had none — `buildContextMessage`'s "Language: ${locale}. Answer entirely
   in this language" was pure aspiration. For the exact persona this session
   tests as — a struggling child, not one who would think to ask for
   English — this is not a stylistic flaw, it is the tutor becoming
   instantly incomprehensible.
   Fixed with `languageViolation()` (`prompt.ts`), deliberately narrow
   rather than a full language detector: `¿`/`¡` (Spanish-exclusive
   orthography, zero false-positive risk since neither ever occurs in
   genuine English or Portuguese) plus a short list of MULTI-WORD phrases
   per locale pair, chosen for no plausible loanword collision in this
   product's own tutoring domain. Wired into the SAME repair-retry
   machinery as `tierVocabularyViolation`: a drift on attempt 0 asks for
   the same idea again in the right language; a drift that SURVIVES the
   retry (or whose retry transport-fails) joins item 51's bucket — false
   praise, false correction, forbidden vocabulary — falling back to the
   scripted line rather than being delivered, because a turn in the wrong
   language gives a non-speaking child zero value, not a "clumsy but still
   teaches something" one.
   **Caught and corrected before shipping, by this codebase's OWN
   pre-existing test suite:** the first version of the marker list included
   the bare word "the" as an English signal. `hardening.test.ts`'s canary
   payload `'PAYLOAD-THE-JUDGE-MUST-SEE'` matched `\bthe\b` case-
   insensitively — a hyphen is a word boundary — the exact false-positive
   class this file's own `TIER_FORBIDDEN` header already warns about for
   its siblings. Every marker is now a multi-word phrase specifically
   because a single common word is too easy to find inside an unrelated
   identifier or payload.
   Proven with 6 new `prompt.test.ts` unit tests (the exact real sentence
   that surfaced this, both cross-locale directions, and three "never
   flags genuine prose, including a loanword" cases) and 3 new
   `orchestrator.test.ts` tests reproducing the live scenario end to end
   with the ACTUAL sentences observed; all confirmed to fail for the exact
   claimed reason pre-fix via `git stash`. A third live re-repro was
   blocked by the SAME test account correctly hitting its own daily
   session cap (429) mid-verification — the fix's proof rests on the
   git-stash-confirmed orchestrator test built from the real observed
   sentences instead, the same substitute-evidence standard already used
   for prompt-wording fixes elsewhere in this file. General lesson: a
   deterministic check exists for every OTHER prompt-adherence property in
   this file, and the one nobody wrote was the one no test could reach —
   language correctness needs a locale other than the harness's own
   default before it can even be WRONG.

54. **A valid whiteboard could be computed, moderated, and delivered, and
   still never reach the screen — because a still-open, ungraded activity
   of ANY type already occupied the one panel it renders into.** Found by
   adversarial review, round 60, 2026-08-30 (HIGH). The client
   (`ConversationView.tsx`) renders `LiveSegmentPanel` whenever
   `socket.segment` is set and only falls back to `TutorWhiteboard`
   otherwise; `socket.segment` is cleared only by grading or a session
   reset, never by a new turn arriving. The turn schema refuses `whiteboard`
   and `segmentRequest` on the SAME turn, but says nothing about a
   PREVIOUS turn's activity still sitting open — and nothing server-side
   ever checked that before this round. `openActivity` (tracked for prompt
   grounding) can't stand in for this gate: it is deliberately kept after
   grading too, so it would over-block. `openCheckableSegment` can't either:
   it only covers the narrow voice-answerable subset. Reproduced by serving
   a `sort_buckets` activity (not checkable, not graded), then having the
   model return an ordinary, schema-legal "SHOW YOUR WORK" whiteboard on the
   next turn — it was delivered untouched, and would have sat behind the
   client's segment panel forever, invisible.
   Fixed with a new tracker, `openUngradedSegmentId` — set in
   `noteSegmentServed` alongside `openActivity`/`openCheckableSegment`,
   cleared in both grading paths (`handleSegmentResult`,
   `handleVoiceCheckResult`) the same way `openCheckableSegment` already is.
   Checked at the same call site as the existing "did not compute to a sane
   sequence" guard, same fail-open posture: the board is dropped whole, the
   turn still delivers with its `say` text intact. Proven with 2 new
   `orchestrator.test.ts` tests — one confirming the drop while a
   `sort_buckets` activity sits open and ungraded (the exact repro), one
   confirming a whiteboard is delivered again immediately after that same
   activity grades, so the fix doesn't over-block once the screen is
   actually free. Both confirmed to fail/pass for the exact claimed reason
   via `git stash`. See `RUNBOOK.md` Round 60.

55. **Tier-3 generation's own paid model calls were invisible to the
   session cost ledger, and a learner's interrupt could not actually
   stop them.** Found by adversarial review, round 64, 2026-08-30 (HIGH,
   two findings sharing one root cause). `modelUsd` had exactly one
   increment site in the whole service — inside `produce()`'s own
   turn-pipeline loop — so `content/generate.ts`'s `generateSegment`
   (tier-3 live authoring, the same paid model family) contributed
   nothing to a session's recorded spend, ever. Separately, an interrupt
   arriving during generation genuinely aborted the server's own
   controller, but nothing downstream ever read it — an already-aborted
   signal had zero effect, unlike the ordinary turn pipeline's
   `complete()`, which throws instantly given the same signal.
   Fixed with `TutorOrchestrator.noteGenerationCost(usd)` (folds into the
   same `modelUsd` bucket) driven by a new `onCost` CALLBACK on
   `GenerationRequest` — a callback rather than a return field because a
   candidate the judge or moderation later rejects still spent real
   money on the author call, and `generateSegment` returns `null` on
   that path. The interrupt is fixed by threading `GenerationRequest
   .signal` into the author's `complete()` calls and the internal
   `judge()`'s fetch via the same `AbortSignal.any` pattern `complete()`
   already establishes, plus an explicit `CompletionAbortedError` catch
   so the abort resolves to `null` (this function's own "return null for
   every failure" contract) instead of escaping uncaught past its one
   caller. The safety-moderation call inside `generateSegment` is
   DELIBERATELY left un-abortable — it is the one call every turn in the
   product goes through, not only tier-3, and touching it was judged
   out of scope given its blast radius. Proven with 5 new
   `generate.test.ts` tests; the first abort test initially asserted
   only `result === null` and one fetch call, which an ordinary pre-fix
   transport failure ALSO produces — caught by running it against the
   unfixed code and finding it passed anyway, then strengthened to
   assert the signal `fetch` actually received reports `aborted: true`.
   All 5 confirmed to fail for the exact claimed reason via `git stash`.
   See `RUNBOOK.md` Round 64.

56. **A valid whiteboard and the sentence sitting right next to it can each
   look correct alone and still tell a child two different arithmetic
   stories.** Found live, testing as a real seeded account, round 65
   (2026-08-30, HIGH). `narratesUnshownGrowth`/`whiteboardUnitMismatch`
   (item 54) check that a board exists and is labelled with the right time
   axis; neither ever asked whether the NUMBERS the story tells out loud
   are the numbers `computeSequence(whiteboard)` actually produces for the
   same board. Observed turn: `say` narrated "Imagine you save 5 pesos each
   week. After the first week you have 5, after the second you have 10,
   after the third you have 15" — an unambiguous, internally consistent,
   ZERO-based story — paired with `whiteboard: {start: 5, steps: [add 5,
   add 5, add 5]}`, whose own `computeSequence` is 5, 10, 15, 20: `start`
   absorbed the first week's deposit, so the board drawn on screen was one
   week ahead of the sentence the child had just heard. Confirmed as a
   real, recurring defect rather than a one-off before any fix was
   written: reproduced twice more against the real model in the same
   investigation (a `start: 35` case and a second `start: 5` case, each
   with the identical one-period shift), at roughly 1 in 15 fresh
   single-turn samples of the identical prompt across ~50 real model calls
   run to characterize it. Root cause traced to this file's OWN worked
   example (item 50's neighbour, `prompt.ts`): it always narrates `start`
   as a PRE-EXISTING amount ("guardas 10 pesos" already in the jar, THEN it
   grows) — a story with no pre-existing amount at all has no example to
   generalize from, and the model intermittently reaches for the per-step
   value instead of zero.
   Fixed with `whiteboardNumberMismatch(say, whiteboard)` (`prompt.ts`),
   deliberately as narrow as item 53's `languageViolation`: it only fires
   on an EXPLICIT "after period N ... you have/tienes/tem VALUE"
   construction naming a CUMULATIVE TOTAL — never a guess at arbitrary
   prose, and never the per-period RATE ("you save/ahorras/coloca X", how
   much moves each step rather than the running balance). Caught while
   BUILDING the check, before it shipped: an earlier draft anchored on the
   RATE verb too and mis-extracted a real pt-BR transcript's deposit amount
   as if it were the period's total, which would have false-positived on a
   turn that was actually correct — the check now anchors ONLY on
   `tienes`/`tendrías`/`você tem`/`fica com`-class verbs. It only fires when
   a `computeSequence` ground truth already exists to compare against, so a
   false positive needs BOTH a real whiteboard AND a sentence spelling out
   a period total that contradicts it; the marker requires LITERAL spaces
   ("after the ", "you have "), not a bare `\b`, so a hyphenated identifier
   cannot satisfy it (item 53's lesson, reapplied and verified rather than
   assumed); and a spoken value within a small tolerance of the board's own
   float is treated as a rounding choice, not a contradiction, since a
   `multiply_percent` board computes fractional pesos nobody speaks aloud.
   Wired into the SAME repair-retry machinery as `whiteboardUnitMismatch`:
   a mismatch on attempt 0 asks for the same story again with the numbers
   corrected either way; a mismatch that SURVIVES the retry joins item 51's
   bucket — false praise, false correction, forbidden vocabulary, language
   drift — falling back to the scripted line rather than being delivered,
   because a wrong number taught to a child learning arithmetic is actively
   wrong, not a stylistic imperfection a child can still learn from.
   Proven with 15 new `prompt.test.ts`/`contradiction.test.ts` unit tests
   (all three real reproductions, several genuinely consistent real
   transcripts across all three locales that must NOT fire, a percent-board
   rounding-tolerance pair, and the hyphenated-identifier canary) and 2 new
   `orchestrator.test.ts` end-to-end tests; all confirmed to fail for the
   exact claimed reason pre-fix via `git stash`. See `RUNBOOK.md` Round 65.

57. **A judge that correctly identified real harm was silently overruled by
   an exact-string typo in its OWN category name.** Found by adversarial
   review, round 66, 2026-08-30 (CRITICAL) — the most safety-critical gap
   this campaign has found. `safety/moderation.ts`'s `modelModeration`
   checked `parsed.category` against the closed `HARM_CATEGORIES`
   vocabulary with an untouched exact-string `includes` — no trim, no
   case-fold, no separator normalization. A category that missed the exact
   match fell into the branch built for a DELIBERATELY different case ("the
   judge objected on teaching grounds, not safety — allow it"), silently
   collapsing a genuine safety refusal into the same bucket whenever the
   judge spelled its own category with a stray space, Title Case, or a
   hyphen instead of an underscore. Reproduced directly: `" self_harm"`,
   `"Self_Harm"`, `"SELF_HARM"`, `"self harm"`, `"self-harm"`, `"Sexual"`
   and `"dangerous instructions"` all flipped a judge verdict that had
   already, correctly, named real harm from refused to `{ allowed: true }`
   — for a minor, with `requireModelPass: true` in effect. The bug lives in
   the ONE shared function every call site uses, so it reached all four
   equally (the live turn pipeline, tier-3 generation, the permanently-
   persisted post-session memory write, and placement intake) — not the
   usual "one caller weaker than its siblings" shape, a single defect with
   no protected caller at all. Fixed by normalizing the category (trim,
   lowercase, spaces/hyphens to underscore) before the membership check,
   with a dedicated test confirming a genuinely off-vocabulary category
   still correctly falls through afterward — the fix closes the gap
   without touching the intentional escape hatch it sits next to. Proven
   with 10 new `safety.test.ts` tests (9 parametrized on the exact
   formatting variants reproduced live, 1 anti-over-correction guard), all
   confirmed to fail for the exact claimed reason pre-fix via `git stash`.
   See `RUNBOOK.md` Round 66.

58. **The SAME whiteboard-vs-story defect (item 56), confirmed live again
   the next day under a phrasing the round-65 fix could not see.** Found
   live by the owner, round 67, 2026-08-30 (HIGH). "What if i get 3
   dollars every month" produced `say` narrating a bare comma list ending
   in a bald conclusion — "Let's think: 3, then 6, then 9, then 12. So 12
   dollars" — paired with `whiteboard: {start: 3, steps: [add 3 ×4]}`
   (computed 3, 6, 9, 12, 15: one period ahead), the exact root cause item
   56 already diagnosed. `whiteboardNumberMismatch`'s existing patterns
   never fired: they anchor on an ORDINAL word immediately before a
   cumulative-total verb ("after the first ... you have"), and this turn
   never says that. Confirmed real and recurring before writing a fix,
   ~95 real turns against the real model: the bare-list/"so"-concluded
   phrasing appeared in roughly 1 in 8 of the turns where a worked
   walkthrough was elicited, and one of 15 identical repeats of the exact
   live prompt reproduced a genuine number mismatch a SECOND time under a
   THIRD phrasing ("month one you have 3, month two you have 6...") —
   deliberately left uncaught, because the identical bare "unit N you
   have/add VALUE" surface shape was also used, correctly, by a different
   real turn in the same run to mean a stated STARTING balance rather than
   a first-period result; no wording distinguishes the two readings well
   enough to anchor on safely, so per this file's own doctrine, silence
   beat forcing in a pattern that would misfire as often as it caught.
   Fixed on two fronts: a new, narrow anchor inside the SAME
   `whiteboardNumberMismatch` binding an explicit period COUNT ("for 4
   months"/"after 3 weeks", never an ordinal) to a LATER concluding total
   introduced by "so"/"entonces"/"então" — guarded against misreading "so
   after 3 weeks, how many do you have?" as a total (a real false lead
   found while characterizing this) and against pairing across a SECOND,
   unrelated scenario narrated later in the same turn; and
   `TUTOR_SYSTEM_PROMPT`'s own worked example now states explicitly that
   `start` must be 0, never the per-step rate, when a story has no
   pre-existing amount — closing the root cause rather than only
   detecting its symptom, the same "tell AND check" pairing as
   `TIER_GUIDANCE`/`tierVocabularyViolation`. Also caught and fixed while
   widening the check's verb list: the pre-existing `'ve saved` verb form
   required a literal SPACE before the apostrophe (`you 've saved`, which
   no real contraction has), a latent bug never exercised by a passing
   test until this round tried to add `'d have`/`'ll have` the same way.
   14 new `contradiction.test.ts` unit tests and 2 new
   `orchestrator.test.ts` end-to-end tests (mirroring item 56's own pair),
   including both sides of the deliberately-uncaught ambiguous phrasing
   side by side as the documented reason no anchor was added for it — all
   confirmed to fail for the exact claimed reason pre-fix via `git stash`.
   See `RUNBOOK.md` Round 67.

59. **"A malformed skill file fails deploy, never a turn" was
   aspirational — nothing at boot ever read the catalogue.** Found by
   adversarial review, round 69, 2026-08-30 (HIGH). `skillCatalogue()`
   lazily memoized on its first call, and the only real call site was
   `orchestrator.ts`'s `strategyInstruction()` — mid-turn, on essentially
   every graded turn. A malformed skill file reaching production by any
   path that skips `npm test` (a hotfix, a CI flake, the self-authoring
   skill pipeline this file's own comment anticipates) would boot
   "healthy" and throw on a real child's first graded turn instead of
   blocking the deploy. Fixed with one eager `skillCatalogue()` call in
   `index.ts`, right after `getConfig()` and before the listener opens —
   deliberately the OPPOSITE posture from the Redis/model/voice checks
   immediately below it (those are genuinely optional with a supported
   degraded mode; a skill is not — there is no degraded posture for "some
   turns can't be strategized"). Proven with 2 new `boot-skills.test.ts`
   tests spawning the real entrypoint against an isolated temp copy of
   `src/`+`skills/`, confirmed to fail/pass for the exact claimed reason
   via `git stash`. See `RUNBOOK.md` Round 69.

60. **Declining an adaptation offer left zero trace, so the tutor could
   re-offer the identical one on the very next failure.** Found by
   adversarial review, round 70, 2026-08-30 (MEDIUM). The already-fixed
   accept-side enforcement (item 18/§11) stops a stray frame from
   *applying* an unoffered adaptation; nothing analogous stopped the
   tutor from *re-offering* a just-declined one — `ws/server.ts`'s
   decline branch did nothing at all, so two `recordGrade` failures
   crossing the offer threshold with a decline in between produced
   STRUCTURALLY IDENTICAL `stuckInstruction()` output, and the model's
   own transcript never even showed the decline happened. Fixed with
   `LessonPlan.declinedAdaptations`, scoped and reset exactly like the
   sibling field `stylesTried` (clears on mastery, never persists past
   the session) — deliberately NOT added to the strict sealed
   model-context schema, since the decline only needs to reach the
   model via `stuckInstruction()`'s own free text. `stuckInstruction()`
   now has three cases (nothing declined, some declined — named and
   excluded, all five declined — stop offering); `TutorOrchestrator`
   gained `declineAdaptation()`, the decline-side sibling of
   `applyAdaptation` with the same match-and-consume discipline. Proven
   with 5 new `plan.test.ts` tests and 2 new `orchestrator.test.ts`
   end-to-end tests; the pre-fix error literally names the missing
   mechanism (`declineAdaptation is not a function`). See `RUNBOOK.md`
   Round 70.

61. **A growth story with an income AND an expense per period drew
   TWICE as many whiteboard steps as periods actually elapsed, plus
   three narrower locale-coverage gaps in the same neighborhood.**
   Found live and by adversarial review, round 73, 2026-08-30 (HIGH +
   3×MEDIUM). "What if I get 3 dollars every month" then "spending 2,
   how much after 3 months?" drew SIX steps (+3,-2 ×3) for a story both
   the spoken correction and the board's own label called "3 months" —
   one step per individual operation instead of one net step per
   period; nothing in the prompt ever said which. Confirmed real at a
   HIGHER rate (4 of 5 fresh income+expense tries) than either
   whiteboard-number-agreement bug items 56/58 already closed. Fixed on
   both fronts: the prompt's worked-example section now states the
   net-change rule explicitly with a second example, and a new
   `whiteboardDoubledPeriodSteps()` check — deliberately structural
   (an exact repeating add/subtract 2-cycle across the WHOLE step list
   plus both an inflow and outflow word in the label), never
   prose-parsed, to keep false-positive risk low — joins the
   deliver-anyway bucket alongside `missedWhiteboard`/`wrongUnit`,
   since every individual number on a doubled board is still correct;
   only the SHAPE is wrong. A 2-step board is a deliberate, documented
   gap (indistinguishable from a genuinely valid 2-period gain-then-loss
   story), relying on the prevention-side fix alone.
   Alongside it: `whiteboardNumberMismatch`'s Portuguese anchor (item
   58) missed the model's own "vira"/bare-"fica" phrasing and its
   `PERIOD_WORD` table was missing `quarta` (fourth) entirely —
   Spanish's own spelling, `cuarta`, is a different string; `
   RECALL_TRIGGER` was Spanish-heavy and asymmetric (6 Spanish temporal
   idioms against 2 apiece for English/Portuguese, three with no
   equivalent at all — confirmed live, zero recall calls for "Remember
   the cookie problem?"); and `promisesAnActivity`'s `ALREADY_DID` had
   zero Portuguese past-tense verbs, misreading a genuine completed-
   activity narration as an unkept promise and spending a needless paid
   repair-retry. All three widened with the missing coverage. 26 new
   tests total across the four findings, all confirmed to fail for the
   exact claimed reason pre-fix via `git stash`. See `RUNBOOK.md`
   Round 73.

62. **The content ladder can serve a DIFFERENT difficulty than the one
   requested — correctly — and the controller's adaptive state was
   never told.** Found by adversarial review, round 59, deferred;
   closed round 74 (2026-08-30, MEDIUM). `serveFromCatalog`/
   `serveFromBank` pick by difficulty DISTANCE, and the prerequisite
   and frontier fallback rungs reach into another topic entirely, so
   "asked for 4, served 2" is ordinary behaviour there. But every
   `difficulty` in Core's `POST /segments` was the REQUESTED value and
   `noteSegmentServed` took no difficulty parameter at all, so
   `controller.ts`'s `lastDifficulty` kept ratcheting off its own
   guess. That field is not decoration: EVERY adjustment in `decide()`
   is made relative to it, so the gap persisted for the rest of the
   session. Core's BKT posterior is difficulty-agnostic, so nothing
   PERSISTED was corrupted — only Oracle's session-scoped state, which
   is exactly the kind of drift no database query would ever reveal.
   Fixed with a `servedDifficulty` field on the response (read off the
   chosen segment in `persistAndServe`, `null` rather than a default
   when it declares none — `orderCandidates`' `?? 3` is a SORTING
   tie-break and reporting it would be indistinguishable from a real
   band 3), threaded through `ws/server.ts` into a fifth
   `noteSegmentServed` parameter, and applied by
   `PedagogicalController.reconcileServedDifficulty()`. Three
   deliberate calls, all documented at their call sites: the reconcile
   corrects the MEMORY and not the plan (`decide()` re-bases on
   `entry.targetDifficulty` each turn, so it cannot pin a learner low);
   it is a no-op while the brain is dormant, because the request did
   not come from this ratchet then; and it logs ONLY at a gap of two
   bands or more, because a one-band substitution is the ladder working
   and a line per occurrence trains people to skip the line.
   **`ServedSegmentSchema` is `.strict()`, so DEPLOY ORACLE BEFORE
   CORE** — a new Core meeting an old Oracle fails the parse and turns
   every activity into `NO_SEGMENT`, which the pre-fix test run
   demonstrated live. 20 new tests (4 backend, 12 controller, 3
   orchestrator, 1 end-to-end over the real socket), confirmed to fail
   pre-fix via `git stash`, against a deliberately request-echoing
   implementation, and — for the end-to-end one — with only the WS
   argument removed. See `RUNBOOK.md` Round 74.

63. **Two writes that are each individually atomic are not one atomic
   write, and the damage shows up on the READ side.** Found by
   adversarial review, round 61 and closed as round 75, 2026-08-30
   (MEDIUM). Item 49 and migration `0059` made ONE learner-memory
   store's compare-and-swap correct against concurrent writers of that
   store. The post-session review writes TWO — and Core wrote them by
   looping and awaiting one RPC per store, which is two transactions
   with a real, network-sized window between the first COMMIT and the
   second. `getLearnerMemory` is the FIRST thing the next session for
   the same learner does, so a session could start on half of a review:
   the brand-new learner note beside the pedagogy note that same review
   had already decided to replace. Nothing in the write path looks
   wrong when you read it — each call is correct, the loop is correct,
   and every per-store test passes — because the defect is not in
   either write but in the gap between them, and only a READER can see
   it. Fixed by `write_learner_memory_pair_checked` (migration `0061`),
   one call for the pair, deliberately a thin wrapper calling `0059`'s
   function twice (a plpgsql call runs inside its caller's transaction,
   so that alone is the whole fix and there is still only ONE copy of
   the compare-and-swap and the ledger insert). Oracle needed no
   change: same body, same per-store `written` answer. The corollaries:
   when a unit of meaning spans two rows, ask what a concurrent reader
   sees BETWEEN the writes, not only whether each write is safe; write
   the regression from the reader's side, since a test that only calls
   the writer cannot fail; and the fix depends on the reader staying a
   SINGLE statement — split `getLearnerMemory` into two SELECTs and the
   same window reopens with a write path that still looks correct. See
   `RUNBOOK.md` Round 75.

64. **`serveSegment()` and `deliver()` are mutually recursive, and
   nothing counted the trips — one learner utterance could re-enter an
   empty content ladder forever.** Found in passing by round 74, closed
   round 76 (2026-08-30, HIGH). A turn that asks for an activity is
   served by `serveSegment`; when the ladder has nothing,
   `handleSegmentUnavailable()` produces a recovery turn that goes out
   through the SAME `deliver()` — and that turn can carry a
   `segmentRequest` of its own. The recovery instruction asks the model
   not to, and that instruction was the only thing standing between an
   ordinary content gap (five of twenty-eight KCs carry `skill_key`
   null on purpose) and an unbounded loop. Measured with the fix
   stashed: **20 ladder requests and 21 turns off a single
   `learner_text` frame**, each cycle a model completion, a judge
   completion and a Core round trip, plus a paid author call (two, with
   its shape retry) whenever the ladder answered `needsGeneration` —
   §1.0's "money leaves DIRECTLY" shape exactly, and a burst of
   confusing turns for a real child. **Round 74 filed this as "bounded
   only by the session turn cap"; that was an inference and it was
   wrong.** Probed: the run ended at `turnCount` 22 with the budget
   still `running` and no close frame, against a `SESSION_MAX_TURNS` of
   120. What ended it was `TURN_HISTORY_WINDOW`, also 20 — the
   learner's line scrolled out of context and the harness model's
   keyword trigger went with it. Nothing in the PRODUCT stopped it, and
   a real model wanting an activity because of the conversation rather
   than one keyword had all 120 turns to spend.
   `MAX_SEGMENT_RETRIES = 1`, enforced in `deliver()` rather than
   inside `serveSegment()` because that is the edge the recursion
   crosses, so the refusal lands BEFORE it buys a Core round trip, an
   author call or a judge call. ONE retry for a reason that is
   arithmetic and not taste: while the brain is awake `serveSegment`
   overrides both skill key and difficulty with the controller's own,
   so a second request from the same conversational state is very often
   the IDENTICAL one the ladder just refused. **This bounds repeated
   FAILURES within one utterance and nothing else** — the ladder's own
   rungs (nearest-band, prerequisite walk, frontier fallback, item 62 /
   round 59) live inside a single `requestSegment` call and are
   untouched. At the bound nothing is dropped: the recovery turn is
   already on the child's screen and only the ask behind it is refused,
   `handleSegmentUnavailable`'s new `lastAttempt` flag tells the model
   not to promise an activity so the turn reads coherently, the
   `NO_SEGMENT` frame still clears the client's "preparing something"
   placeholder, and the refusal `console.warn`s because reaching it
   means the model ignored an explicit instruction AND the ladder
   missed twice. The instruction is not the bound; the refusal is. 4
   new live-session tests, confirmed to fail pre-fix via `git stash`
   (`expected 20 to be 2`), to fail against a deliberately over-tight
   `MAX_SEGMENT_RETRIES = 0` (`expected 1 to be 2`, the legitimate
   miss-then-serve path), and to hold on the EXPENSIVE
   `needsGeneration` shape and not only the cheap one. See `RUNBOOK.md`
   Round 76.
65. **A resumed session kept enforcing the FIRST connection's `isMinor`,
   while every gate around it on the same reconnect already used a
   freshly re-verified one.** Found by adversarial review as round 56's
   deferred MEDIUM, closed as round 77, 2026-08-30. `TutorOrchestrator`'s
   `private readonly session` is set once at construction and never
   reassigned (verified, not assumed: `this.session =` has no hits), and
   `handleConnection`'s resume branch re-attaches the SAME instance — so
   `requireModelPass: this.session.isMinor`, the one thing that decides
   whether a turn no judge could clear is REFUSED or delivered on the
   deterministic pass alone (/ORACLE.md §6), stayed pinned to whatever
   the first connection fetched: for the 90-second grace window, and
   indefinitely for a session parked and resumed repeatedly, since
   nothing ever re-fetched it. Its siblings on that same reconnect were
   all fresh — the door's `moderationReadiness(session.isMinor)`, the
   microphone gate, and `refreshMicConsent`'s live per-turn call to
   Core — which is what makes this the §1.14 "state read back out of a
   kept object is the PREVIOUS holder's state" class rather than a
   design choice.
   Round 56 deferred it because `this.session` is used pervasively and
   deciding what refreshes on a resume is a real design question. The
   answer, from a full audit of every field on `SessionContext`:
   `isMinor` is the ONLY one where pinning disagrees with the field's
   own live, safety-relevant nature — every other field is immutable for
   the session, has its own live shadow, is checked freshly elsewhere,
   or is a deliberate decision-clock snapshot. So the fix is one
   explicit mutable slot (`minorPosture`) plus
   `refreshIsMinor(isMinor: boolean)`, called only from the resume
   branch, taking a BOOLEAN rather than a `SessionContext` precisely so
   it cannot become the seam through which the pinned fields start
   refreshing too. `sessionContext` overlays the live posture so no
   future caller can read a value the orchestrator itself stopped using;
   a change in either direction logs, because a learner's role changing
   inside one session's lifecycle should never be silent.
   Proven both halves: 4 unit tests in `orchestrator.test.ts` (both
   directions across a simulated resume, the unchanged ordinary case,
   and `tier`/`courseContext`/`locale` still pinned) and 1 end-to-end
   test in `live-session.test.ts` driving a real socket through a real
   park and resume with Core flipping its answer between connections —
   because the unit tests prove the method works and only the socket
   test proves `handleConnection` calls it. Confirmed to fail pre-fix
   for the exact claimed reason twice, once per half. See `RUNBOOK.md`
   Round 77.


66. **A cost incurred AFTER the ledger is written needs a different fix
   from one incurred before it, and the difference is not visible in
   either call.** Found by adversarial review, round 78, 2026-08-30
   (MEDIUM). Item 55 closed tier-3 generation's invisible paid calls by
   folding them into `TutorOrchestrator.modelUsd`, which works because
   that spending happens DURING a turn and nobody reads the total until
   the socket closes. The post-session review makes a call that looks
   identical from the outside — the same model, the same provider, the
   same `${MODEL_API_BASE}/chat/completions` fetch — and its `usage` was
   never even read, so the price of one call per real conversation
   reached no ledger at all, forever. The same fix does NOT transfer:
   `ws/server.ts` persists `costUsd` via `closeSession` and only THEN
   fires `void runPostSessionReview(...)`, in the graceful `finish()`
   path and the dropped-connection `finalizeParked()` path alike, so by
   the time the tokens are known the number is written and the
   orchestrator is about to be discarded. Fixed by ADDING to the row
   instead: `add_tutor_session_cost` (migration `0062`) does
   `cost_usd = cost_usd + x` in one statement — because a PATCH can only
   set a literal, and doing the arithmetic in Core would be the
   read-add-write §1.14 names — behind
   `POST /tutor/internal/sessions/:id/cost`, reached from
   `core/client.ts`'s `addSessionCost` and priced with the SAME
   `estimateCostUsd` item 55 already established. The corollaries, and
   they are the transferable part: ask WHEN a cost becomes known
   relative to when the total is read, because two calls that look the
   same can need opposite mechanisms; report it from a `finally`, since
   the money is gone the instant the provider answers and four of this
   function's five exits discard the reply it paid for (mark the spend
   BEFORE reading the body, or a 200 you then fail to parse is the one
   call you lose); a call you cannot price is not a free call, so no
   `usage` block means a loud `UNCOUNTED` line and no write, never a
   recorded zero; and a "closed" record is only immutable if something
   actually enforces it — Core already writes the memory digest onto a
   closed session, which is what made attributing this cost home the
   boring option rather than a new ledger. See `RUNBOOK.md` Round 78.

67. **A turn that promises an activity is composed BEFORE the activity
   exists, so a specific invented example in that same turn is a
   promise about numbers nobody chose yet.** Found live, testing as a
   real logged-in kid account through the actual UI, round 79,
   2026-08-30 (MEDIUM). The tutor said "if you have 10 coins and each
   sticker costs 5…"; the activity that rendered right after asked
   about "8 coins, toy car, 4 each" — same skill, different numbers,
   no acknowledgment of the switch. `ws/server.ts`'s `deliver()` sends
   `say` to the client BEFORE calling `serveSegment()`, so the model
   commits to a worked example while the segment is still unchosen.
   Whether this is visible depends on which tier answers: tier 3
   (`content/generate.ts`) feeds the tutor's own `framing` into the
   author's brief, so freshly generated content tends to match by
   construction; tier 1/2 bank content is selected by `skillKey` +
   `difficulty` alone (`backend/src/routes/tutor.ts`'s `/segments`
   handler validates `framing`/`rationale` and never reads either), so
   a bank lesson's numbers have no connection to anything the tutor
   said. Fixed as a prompt constraint rather than a turn-ordering
   change — inverting the turn to select-before-speak would need a
   second model call, which the Oracle exception's latency budget
   (§1.5) does not have room for. `prompt.ts`'s `next: "segment"`
   paragraph now says the activity does not exist yet and the
   transition must stay generic; the "numbers are invented" bullet
   gets a carve-out that its license is for a hypothetical narrated
   AND resolved in the SAME turn, not one still to come. Different bug
   from item 58 (that one is the tutor's reaction to an activity
   ALREADY on screen, a turn later — `openActivity` cannot see a
   mismatch that happens before the segment is chosen). The general
   lesson: when two independent surfaces each produce a number for the
   same moment, check whether anything actually connects them, or
   whether one is just early and hoping the other agrees. See
   `RUNBOOK.md` Round 79.

68. **`ws/server.ts`'s `send()` dropped a message with total silence when
   the socket was not open — no log, no error, nothing.** Found chasing
   a live, intermittently-reproducing symptom, round 81 (2026-08-31,
   MEDIUM): a session whose first turn was written to Postgres within
   seconds of starting never once reached the screen, with the live
   connection count never dropping and no error anywhere. Two
   background investigations (one confirming `useStageAnnouncement.ts`
   is StrictMode-safe via 9 new deterministic tests, one narrowing the
   live reproduction to "fresh full-page navigation" vs "in-place SPA
   transition") never conclusively pinned this function as THE cause —
   the remaining live-only candidate is `TutorScene`'s real WebGL
   canvas under React StrictMode's mount-churn, which needs a browser
   this session's testing tools cannot fully exercise (headless
   automation reports `document.hidden: true` even when "fronted",
   throttling the render loop this exact mechanism depends on). What
   IS certain, independent of whether it explains this specific hang:
   a socket that closes a moment before its last message tries to
   leave should never fail in silence. `send()` now logs
   `[oracle] dropped a "<type>" message — socket was not open
   (readyState=<n>)` on every guard-caught drop — every OTHER failure
   path in this file already logs; this was the one that didn't. Fixed
   observability, not a confirmed root-cause fix: the next time this
   symptom recurs, it leaves a line instead of a silence. See
   `RUNBOOK.md` Round 81.

69. **A turn's `next: 'segment'` and its `closeReason` are computed from
   the SAME budget verdict, but nothing checked them against each
   other before delivery.** Found by adversarial review, 2026-08-31
   (MEDIUM). `ws/server.ts`'s `deliver()` called `serveSegment()`
   whenever `emission.turn.next === 'segment'`, and only looked at
   `closeReason` several lines later, to decide whether to close the
   socket — so a turn carrying BOTH a real `segmentRequest` and a
   non-null `closeReason` served a real activity one line before the
   `closed` frame followed it, with the learner never given a chance
   to attempt it. Two independently reachable triggers: the ONE grace
   turn `graceTurnFor()` grants on an already-`'ended'` budget tells
   the model, in PROSE ONLY, not to request an activity — and
   `turnSchema.ts` enforces no structural rule tying `next` to budget
   state, so a model that ignores the instruction (this file's own
   item 67 and `MAX_SEGMENT_RETRIES`'s comment in `ws/server.ts`
   already document this exact codebase's model ignoring other
   prose-only instructions) sails through; and an ordinary turn that
   crosses `SESSION_MAX_TURNS` mid-call enters `produce()` under the
   merely-advisory `'wrapping'` state and can exit `'ended'` from the
   turn-count increment alone, with the model called under no
   constraint at all. Fixed inside `produce()`, not in `ws/server.ts`,
   so every caller (greet, farewell, an activity result, a voice-check
   verdict) inherits the guard automatically: the budget verdict is
   now computed ONCE, right after the turn slot is reserved, and
   reused both for `closeReason` (unchanged) and for a new check —
   once the retry loop and the `modelDownResponse` fallback have all
   settled on a `turn`, a surviving `next: 'segment'` against an
   already-`'ended'` budget is corrected in place (`next` → `'ask'`,
   `segmentRequest` → `null`) before moderation ever sees it. Not
   routed through the existing `turnCorrection` retry-and-ask-again
   mechanism this file's repair loop uses for a model's other
   mistakes: this is a structural fact about the session's own clock,
   not something a sharper prompt fixes, so retrying would spend a
   real model call on a question the model has no way to answer — the
   same reasoning the whiteboard/open-activity-conflict check one
   function up already uses. `next` moves to `'ask'` rather than
   `'close'` deliberately, so a budget-driven end still reports as
   `turn_cap`/`hard_budget` rather than being misreported as
   `completed`. See `RUNBOOK.md` Round 85.

70. **A busy floor and a refused floor are not the same thing when the
   caller is asking to LEAVE.** Found by adversarial review, round 87
   (2026-08-31, MEDIUM): `end_session` claims with `enforceFloor=false`
   — leaving is never gated on the 700 ms floor — but still respected
   the single in-flight-turn slot, and on `'busy'` (the ORDINARY state
   during the frontend's own `awaitingReply` window, which exists on
   EVERY turn) it called `refuseTurn` and returned, exactly as every
   other frame type correctly does. `farewell()`/`finish()` were never
   reached. The client (`TutorExperience.tsx`'s `onRestart`/`onExit`)
   tears its own socket down immediately after sending `end_session`,
   without waiting to learn whether it worked, so the socket's `close`
   handler saw `live.closing` still false and parked the session
   exactly as an honest dropped connection — a deliberate "Start
   over"/"Finish" recorded `learner_left` after the resume grace window,
   with no farewell ever produced, contradicting /ORACLE.md §9.5's "not
   a timeout that kills a socket" for the one control whose entire job
   is ending the session on purpose. Fixed on both sides: the frontend
   now disables both buttons for the duration of `awaitingReply`
   (`ConversationView.tsx`, matching the composer's send button); and
   `end_session` now DEFERS rather than refuses a busy floor
   (`Live.endSessionRequested`), served by `releaseTurn` — the one place
   every turn's `finally` already funnels through — the instant the
   floor that refused it frees. A second race the deferral itself opens
   (the client's immediate teardown reaching `close` before the deferred
   farewell runs, parking the session anyway) is closed by having
   `finish()` cancel any dangling park (`takeParked`) the moment it
   actually completes — otherwise the park's own grace-window timer
   would fire a redundant `learner_left` `finalizeParked` behind the
   graceful close, harmless to the recorded reason (`closeTutorSession`'s
   `ended_at IS NULL` guard makes it a no-op) but not to
   `runPostSessionReview`, which pays for a second, pointless model call
   to grade a session already graded correctly. See `RUNBOOK.md` Round
   90.

71. **The loser of a race that writes to a shared, conditionally-updated
   row cannot tell it lost unless the write itself says so — a bare 2xx
   is not enough.** Found by adversarial review, round 98 (2026-08-31,
   MEDIUM; the one contested finding of its sweep). Item 70's OWN second
   race — `finalizeParked`'s grace-window timer firing before a deferred
   `finish()` reaches its close — has a reverse ordering item 70 did not
   cover: when the busy turn ahead of the farewell outlasts
   `SESSION_RESUME_GRACE_MS` ON ITS OWN, with no farewell slowness
   involved at all (`farewell()` is fully scripted, no model call —
   verify this before blaming it; the original finding did not, and was
   wrong), `finalizeParked` closes the session first. `finish()`'s later
   `closeSession` call then races Core's `ended_at=is.null` filter and
   loses: the PATCH matches zero rows, but `Prefer: return=minimal`
   returns the identical 204/empty body a REAL update would, so
   `res !== null` was `true` either way and `finish()` reported
   `completed` while Core kept `learner_left` with a possibly-incomplete
   cost — a real close silently discarded, no trace anywhere.
   The fix is not a new lock or a retry; it is making the ALREADY-CHOSEN
   conditional filter (`ended_at IS NULL`) legible to its own caller.
   `closeTutorSession` switched to `Prefer: return=representation` and
   returns `'closed' | 'already-closed' | 'failed'` instead of a
   boolean — an empty array IS the zero-row case, with no probing
   required. The route response gained one purely additive field
   (`alreadyClosed`) rather than changing the meaning of `closed`, so
   nothing that already read the old shape breaks. `finish()` now warns
   loudly, naming the session and the cost that was lost, instead of
   reporting a lost race as a success — but deliberately does NOT attempt
   automatic cost reconciliation this round (would need either a fresh
   authoritative read or a new atomic op, and this ledger is already
   documented as an estimate, not an invoice) and deliberately does NOT
   suppress the resulting double `runPostSessionReview` call either
   (the SECOND call has the more complete history; skipping it would
   keep only the stale one). Both are named as open follow-ups rather
   than silently resolved by guessing.
   The general lesson: any code that already relies on a conditional
   write to arbitrate a race (`ended_at IS NULL`, `WHERE version = ?`,
   any "first writer wins" filter) has, by construction, a LOSER — and a
   caller that cannot distinguish its own win from its own loss will
   report both as success, every time, forever, because a conditional
   UPDATE and an unconditional one return the identical transport-level
   success. The fix is never a lock; it is asking the write itself how
   many rows it actually touched. See `RUNBOOK.md` Round 98.

72. **A surface with no character-rendering layer of its own does not get
   to borrow one — it has to be TOLD who to portray, by whatever
   machinery it already owns.** Found by review sweep tutor-review-
   sweep-92 (segment-type-coverage dimension), round 100, 2026-08-31
   (HIGH). `story_dialogue`, `story_scene` and `eavesdrop` draw their
   speaking character with `CharacterActor3D`, which stands in with the
   flat 2D rig whenever no `CharacterLayerProvider` is above it — right
   for a caller that forgot to mount one, permanently wrong for the
   Tutor's live activity plate (`LiveSegmentPanel.tsx`), which structurally
   has nowhere to put one: `StageShell.tsx`'s `TutorStage` keeps ONE
   WebGL context live for the whole route ("ONE MOUNT, NEVER A
   REMOUNT"), and `CharacterLayerProvider` always mounts a SECOND,
   independent one the instant it renders — never conditionally. The
   investigation is the part worth keeping: a second canvas was rejected
   on TWO independent grounds, and either alone was sufficient. The
   WebGL-context argument is the one everyone reaches for first
   (TUTOR_3D.md §6.2's "one canvas for a screenful of characters"), but
   the DOM-stacking argument is the one that actually can't be worked
   around by being careful: the activity plate is explicitly "Lumen
   material... never an opaque slab," so a canvas drawing a character
   BEHIND it renders blurred through its own `backdrop-filter`, and a
   canvas raised ABOVE it to draw crisply would have to sit above the
   WHOLE persistent island too — painting over the mic dock, the exit
   chip and the veil that must stay visually on top of it. One `<canvas>`
   cannot be both "the base layer behind everything" and "a crisp overlay
   in front of one piece of chrome" at once; no z-index or context-count
   fix repairs that, because it is a fact about having exactly one
   element occupying exactly one stacking position, not a resource limit.
   The fix does not give these three types a character layer at all — it
   gives the HOST (`TutorExperience.tsx`, which already computes
   `character`/`emotion`/`action` for the one canvas that exists) a cue
   to act on: a new optional `onCharacterCue` on `ExerciseProps`, read
   only by these three renderers, which suppresses their own
   `CharacterActor3D` and reports who is speaking instead of trying to
   draw them. The general lesson: when a surface's own architecture rules
   out reusing another surface's mechanism (a provider, a cache, a
   layer), the fix is rarely "make the mechanism work here too" — it is
   finding the SEAM the excluded surface already has for the same fact,
   and wiring the fact through it instead. `eavesdrop`'s multi-speaker
   transcript is handled the same way: the Tutor portrays only the
   CURRENTLY active line's speaker on the one stand-in it has, and
   earlier lines fall back to plain text rather than a repeated avatar —
   narrower than the course player's simultaneous-cast presentation, but
   never the flat 2D rig for the character that actually matters at any
   given instant. See `RUNBOOK.md` Round 100.
73. **A result type with room for only one failure state will eventually
   carry two, and the second one arrives as a silent behavioral bug, not a
   type error.** Found by adversarial review sweep tutor-review-sweep-101
   (voice-audio-quality dimension, 3/3 skeptics), round 102, 2026-08-31
   (HIGH). `transcribe()`'s (`ws/server.ts`) return type was `string |
   null`, which has exactly one falsy state — so when `provider.transcribe()`
   grew a SECOND failure mode over time (a `VoiceUnavailableError` thrown
   on a timeout, a dropped connection, or a provider 5xx — none of which
   existed when `null` was chosen as "nothing to say") the `catch` block
   had nowhere to put it except the same `null` a genuinely silent child
   already produced. `handleAudioClip` could not tell "the provider never
   answered" from "the child said nothing" because the type it read from
   had already erased the difference before the caller ever saw it — the
   two facts were distinguishable at the throw site and nowhere after.
   Every learner-visible symptom followed from that one erasure:
   `STT_FAILED`'s own copy, "try again, a little closer to the
   microphone," is sound advice for the second case and actively
   misleading for the first, telling a child their technique caused an
   outage they could not have fixed by speaking louder. Fixed by widening
   the return type to a discriminated `{ text: string } | { unavailable:
   true }`, which has a distinct member for each fact instead of one
   falsy value doing double duty, and adding `STT_UNAVAILABLE` alongside
   `STT_FAILED` in `tutor.conversationError.*` (item 2 above already
   states the rule this follows: a new code needs its three translated
   strings in the same commit). General lesson: when a function's result
   type has exactly one way to signal "nothing," ask whether that one way
   is being asked to mean more than one thing NOW, and re-ask the same
   question every time a callee gains a new failure mode — a `string |
   null` or a bare boolean is a standing invitation for the next distinct
   failure to be absorbed into whichever falsy value already exists,
   silently, with no compiler error to catch it. See `RUNBOOK.md` Round
   101.
74. **A table indexed by one axis is not automatically complete just
   because that axis is the one the feature was designed around.** Found
   by adversarial review sweep tutor-review-sweep-101 (voice-audio-quality
   dimension), round 103, 2026-08-31 (MEDIUM). `LISTEN_SILENCE_MS` — how
   much silence after the learner speaks means their turn is over — is
   keyed by pedagogical STRATEGY, which is exactly right for the question
   it was built to answer ("is this a Socratic pause or a fluency drill?")
   and silently wrong for a different, equally real question it was never
   asked: a stutter block, real processing delay, or a child who needs a
   beat before answering looks, for one silent instant, identical to
   "done talking," and the strategy axis alone cannot tell the two apart —
   it gave a learner meeting a knowledge component for the very first time
   the identical budget as one who has answered it a dozen times.
   Investigated and rejected first: extending the client's turn-detector
   timer itself (`frontend/src/tutor/turnDetector.ts`) on a "partial
   transcript" signal, because no interim or partial transcript exists
   anywhere in this pipeline — audio is transcribed exactly once, on
   COMMIT (§2.7), which is triggered BY that same detector deciding the
   turn already ended; by the time any transcript could exist, the cutoff
   already happened. An UNCONDITIONAL grace inside that same timer was
   rejected next: its one ending comparison cannot tell a mid-answer pause
   from a learner who has genuinely finished at the exact moment the
   threshold is reached, so extending it would have delayed the genuinely-
   finished case by the same amount, which is not bounded to a population
   that needs it. Fixed by adding the missing axis where the table itself
   lives instead: `listenSilenceMsFor(strategy, opportunitiesOnKc)`
   extends the strategy's own budget by a fixed fraction — derived from
   `LISTEN_SILENCE_MS[strategy]` itself, not a second hand-authored table
   (item 32's lesson) — only below `NEW_TO_SKILL_OPPORTUNITIES`, seeded
   from Core's PERSISTED `kcStates.attempts` so a returning learner is
   never treated as new just because a session restarted. General lesson:
   when a lookup table is keyed by the one dimension a feature's design
   doc names, check whether a DIFFERENT dimension the same value also
   depends on — here, the learner, not just the strategy — was ever
   actually free to vary; a table that looks complete because it covers
   its own named axis exhaustively can still be flat across an axis nobody
   thought to ask about. See `RUNBOOK.md` Round 103.

75. **A per-turn safety judge with zero memory of the conversation cannot
   see a harm that only exists as a SEQUENCE — and the fix for that is not
   automatically "give it everything."** Found by review sweep tutor-
   review-sweep-101 (moderation-edge-cases dimension), round 104,
   2026-08-31 (MEDIUM). `moderateTutorOutput`'s model pass judged one
   candidate turn with no prior turns in the request at all, so a
   "crescendo" — several turns each individually benign, the trajectory
   unsafe only together — was structurally invisible to it, and to the
   per-utterance input classifier one layer earlier, which has the identical
   shape. Three fixes were weighed, not just the obvious one: a full
   transcript on every judge call turns a flat per-turn cost into one that
   grows QUADRATICALLY with session length, for a benefit a short window
   already captures; a separate periodic trajectory pass is a NEW call path
   with its own retry/fail-closed/cost-ledger policy to build, answering a
   broader "is this whole session unsafe" question than the one raised
   here. The one shipped is a bounded look-back — `recentTutorLines`, the
   SAME already-spoken lines the generator's own "do not repeat this" hint
   already reads — handed to the judge on the SAME call it already makes
   every turn: no new call path, no added latency, and byte-identical to
   the pre-fix request whenever there is no history yet to show. The
   general lesson: a per-item check with no memory of the sequence it sits
   inside has a class of harm it cannot see BY CONSTRUCTION, and the right
   response is to size the fix to the actual threat model (here: the
   PEDAGOGICAL MODEL's own output drifting across a few turns on a narrow
   subject, not a persistent adversarial user — the learner side of a
   crescendo is already caught turn-by-turn, sequence or not, by the input
   classifier's session-stopping rules) rather than reaching for the
   biggest mechanism that would technically cover it. Deliberately never
   the learner's own words in the added context, for the same reason they
   are already excluded from the generator's authoring brief: unfenced
   untrusted text inside a judge prompt would open a NEW injection surface
   against the safety gate itself, a strictly worse trade than the gap this
   closes. See `RUNBOOK.md` Round 104.

76. **A one-shot audit run BY A HUMAN is not a standing check, no matter
   how good the audit is.** Found by adversarial review sweep tutor-
   review-sweep-101 (content-ladder-correctness dimension), MEDIUM,
   closed round 105 (2026-08-31). `auditContentBridge` (then inside
   `seed-kc-graph.ts`) proves every mapped `kc.skill_key` still resolves
   to a PUBLISHED course/topic AND that the topic still carries at
   least one published lesson — exactly the class of defect this
   repository already learned from once (a null `skill_key` on all 28
   rows sent every activity to live generation). But it only ever ran
   as a side effect of `npm run seed:kc`, which in production only ever
   ran when a human dispatched `tutor-deploy.yml`'s `seed-kc` step.
   Nothing re-checked the bridge when the CATALOG moved instead of the
   graph: a course unpublished, a topic's lessons archived, a lesson's
   skill tags edited — none of those touch
   `database/seeds/kc_graph.v1.json`, so none of them would ever prompt
   anyone to re-seed, and the exact defect this audit exists to catch
   could regress silently between manual runs. **The fix is not a
   stronger check, it is a trigger the check never had.** The audit
   logic moved, unchanged, to `services/contentBridgeAudit.ts` so it
   could be called two ways: `seed-kc-graph.ts` still calls it
   post-upsert against the seed's own KC list, and a new standalone
   entry point, `scripts/audit-content-bridge.ts`
   (`npm run audit:content-bridge`), calls it against whatever is
   CURRENTLY live in Vault via `getActiveKcs()` — the same reader the
   pedagogy engine itself uses — needing nothing the seed step doesn't
   already need. `.github/workflows/tutor-content-bridge.yml` runs that
   standalone script daily against PRODUCTION, the same shape
   `vault-drift.yml` already uses for schema drift, plus on any push
   touching the mapping or the resolution path as defense in depth — a
   push trigger alone would still miss the data-level drift this exists
   for, since none of it is a git commit. A CI gate keyed on a diff was
   considered and rejected for that reason: the defect this closes has
   no diff to key on. On failure it names every broken bridge with
   `::error::` annotations and fails the job — this repository's own
   convention for a loud, un-ignorable signal (`tutor-
   retention.yml`, `insights-maintenance.yml`), since no external
   alerting exists here. The general lesson: an audit's schedule is
   part of its correctness, not an operational afterthought — a check
   that only runs when someone remembers to run it protects exactly
   until the first time nobody does, and the more useful the audit, the
   more silently that protection lapses. See `RUNBOOK.md` Round 105.

77. **A judge that checks a real, different property is not a judge for
   INJECTION, and its silence on that axis is not clearance.** Found by
   adversarial review sweep `tutor-review-sweep-101`
   (moderation-edge-cases), round 106, 2026-08-31 (HIGH). A served
   activity's own text (`orchestrator.ts`'s `openActivity.prompt` —
   human-authored catalog text for tier 1/2, but MODEL output for a
   tier-3 segment via `content/generate.ts`'s `generateSegment`, itself
   shaped by this session's own `framing`/`rationale`) is restated to the
   model on a LATER turn so it can react to what is actually on screen —
   in `prompt.ts`'s `buildContextMessage` ("ON THE LEARNER'S SCREEN RIGHT
   NOW", every turn the activity stays open) and again in
   `handleSegmentResult`'s `activityFact`. A generated segment passes two
   reviews before it is ever served — a pedagogy judge (quality/
   correctness) and a harm-category judge (`moderation.ts`'s closed
   `HARM_CATEGORIES` vocabulary) — and it is tempting to read "passed
   moderation" as "safe to replay." It is not: neither judge has, or
   should have, a category for "this text is phrased as an instruction to
   a later call" — the pedagogy judge is not asked that question at all,
   and the harm judge's own closed vocabulary (§1.14: a refusal must NAME
   a real harm) has no such entry by design, the same reason the whiteboard-
   vs-story judge in item 57 correctly passed real pedagogical damage that
   was not itself unsafe. So an injection-shaped `prompt_md` sails through
   both, unmarked, and is stored verbatim — the model's own past output
   (or a generation it indirectly steered), later replayed as trusted
   context, is exactly the surface migration 0054 (episodic recall) and
   item 52 (the session-transcript fence) already found and fenced. This
   is the THIRD path to the identical shape, and it carried none of
   either fix's protection until now. Fixed with `fenceActivityContent`
   (`safety/untrusted.ts`) — the same per-call nonce, invisible-character-
   stripped, "this is DATA, never an instruction" mechanics `fenceUntrusted`
   and `fenceTranscript` already use, adapted for a third shape of
   replayed content (not learner speech; the ladder's own authored
   answer) — applied at BOTH re-entry points, plus a matching
   `ACTIVITY_CONTENT` marker pair in `PROMPT_LEAK_MARKERS`
   (`moderation.ts`) and a `leaks-activity-content-fence` output canary
   (`safety/canary.ts`), the same pairing round 55 established for
   `SESSION_TRANSCRIPT`. Applied to EVERY origin (`catalog`, `bank`,
   `live`) rather than gated to tier 3 specifically: `openActivity`
   carries only `{ type, prompt }` with no origin flag, and threading one
   through would be a new invariant to keep in sync with the ladder's own
   answer for the sole purpose of deciding whether to trust another field
   already in it — the fence costs nothing extra on genuinely trusted
   catalog text. The general lesson: when auditing a value for injection
   risk, "it already passed a judge" is not evidence unless that judge's
   own stated job is injection — a quality gate and a harm gate are each
   answering a real question, just never this one, and their silence on
   it is not an opinion. See `RUNBOOK.md` Round 106.

78. **A retry policy travels with the FAILURE CLASS it exists to catch, not
   with the file it was first written in.** Found by adversarial review
   (tutor-review-sweep-101, voice-audio-quality, MEDIUM): `transcribe()`
   and `synthesize()` (`voice/inworld.ts`) each made exactly one network
   attempt, while the pedagogical model call right next to them in the
   same turn (`model/provider.ts` + `orchestrator.produce()`'s
   `RETRY_DEADLINE_MS`) already treats a timeout or a dropped connection
   as recoverable. A school Wi-Fi handoff or an Inworld hiccup — the
   identical failure class the model path was hardened against —
   permanently lost that turn's voice or transcript with no second
   chance. Fixed with a new `postWithRetry()` helper: one bounded retry,
   gated by a deadline (`VOICE_RETRY_DEADLINE_MS`, 6 s) checked BEFORE the
   retry rather than baked into a longer single timeout, mirroring
   `RETRY_DEADLINE_MS`'s shape without copying its number — the two calls
   sit in different places in a turn's own 25 s client-side budget, so
   each needed its own reasoned value, not a shared constant. Scoped
   strictly to the TRANSPORT failure (a rejected `fetch`, our own
   `AbortSignal.timeout` firing): a non-2xx response and a 200 with no
   usable content are NOT retried, because both are a definite, likely
   -reproducible answer from the provider, and an empty transcript in
   particular is a FACT about what the learner said, never an error. The
   general lesson: when auditing one call site for a hardening another
   call site already has, grep for every OTHER caller of the same
   provider-adapter pattern — a fix applied once tends to look, from the
   outside, like a policy that was always going to apply everywhere, and
   it rarely was. See `RUNBOOK.md` Round 116.

---

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
- **The whiteboard** (`src/tutor/whiteboard.ts`) — `values` are ALWAYS server-computed from the model's own `start`/`steps`, recomputed a second time at the wire (`ws/server.ts`) rather than trusted from wherever they were last computed, and dropped WHOLE (fail-open) on a non-finite/negative/out-of-range result — never shown as authored. A turn may never carry both `whiteboard` and `segmentRequest`; the schema refuses it. `whiteboard.unit` (`day`/`week`/`month`/`year`, closed vocabulary) must agree with whichever cadence word the model's own `say` used — found live, drawing "Día 1/2" under a story that said "cada semana" three times. `narratesUnshownGrowth()`, `whiteboardUnitMismatch()` and `whiteboardNumberMismatch()` in `src/tutor/prompt.ts` are deterministic checks feeding the standard repair loop (§9), same pattern as `falsePraise` — the instruction alone did not reliably get the real model to set the field at all. `whiteboardNumberMismatch()` catches the narrowest of the three: `say` and `whiteboard` each individually well-formed, but disagreeing on the actual running totals — `start` silently absorbing a period's worth of growth the narration had already attributed to "after the first period" (item 56), or to a later concluding "so"/"entonces"/"então" total following an explicit period count, the same defect confirmed live again under a different phrasing the next day (item 58).


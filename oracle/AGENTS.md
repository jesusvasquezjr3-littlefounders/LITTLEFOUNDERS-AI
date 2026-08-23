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
it needs a design conversation, not a property.

**Two of its fields are learner-facing prose, and BOTH are now on screen.**
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
load-bearing rather than documentary. Both remain subject to §2.4: the whole
turn is moderated before any part of it is spoken or shown.

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
`segment_graded` and the farewell — calls `claimTurn` BEFORE any paid work and
releases it in a `finally`.** The 700 ms floor lives there too, waived only for
the farewell, because nobody should be made to wait to leave.

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
npm test              # 181 tests, no network, VOICE_PROVIDER=none
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

1. **A Response body can only be read once.** In tests, `mockResolvedValue`
   hands back the SAME object on every call and the second read throws "Body is
   unusable". Use `mockImplementation(() => Promise.resolve(...))`.
2. **An answer KEY is not a SUBMISSION.** `quiz_mcq`'s key is
   `{correct_option_id}` and its submission is `{option_id}`; `fill_blank`'s
   key is an array and its submission is an object. Conflating them makes every
   generated exercise report as unverifiable — failing safe, silently, forever.
   The conversion lives in Core (`tutorLadder.ts`), pinned by a test.
3. **`getConfig()` caches.** A test that changes `process.env` must call
   `resetConfigCache()`.
4. **The session token is not a JWT and Oracle rejects one by name.** If the
   client sends a Supabase JWT the log says exactly that, because "malformed"
   would send whoever wired it looking at their JSON encoding instead.
5. **There is no reconnect, deliberately.** The token is single-use and expires
   in sixty seconds, and a session that silently resumed would replay a
   greeting into the middle of a lesson.
6. **Never log a learner's utterance.** Not at debug level, not temporarily.
   Safety flags record a category and a severity and never the words — a flag
   is a signal to a human, not a second unregulated copy of what a distressed
   child said.
7. **A field this service emits is not a field anybody renders.** Assume
   nothing either way, in either direction. `segmentRequest.framing` was
   moderated learner-facing prose that reached no screen for the whole life of
   the first build; meanwhile `ready.microphone` was rendered as the CONDITION
   for showing the microphone at all, so the control vanished whenever the
   answer was no. Both are the same mistake — a wire field and a UI decision
   drifting apart with nothing asserting the join. When you add or change a
   field on the wire, say in `/ORACLE.md` what is supposed to happen to it on
   screen, and when you change what one MEANS, treat it as breaking (§2.3).
8. **Speech is billed per CHARACTER OF TEXT, and only text we actually sent.**
   `SpeechResult.billedChars` is zero on every free path and non-zero even when
   Depot then lost the audio — because that synthesis WAS charged. A ledger
   that only counted audio a learner heard would under-report exactly the
   failure that wastes the most money (`npm run speaks:verify` exists for it).
9. **`ready.microphone` is a capability, not a visibility flag.** Oracle
   reports whether the microphone can open. It does not report whether a
   microphone control should exist — that control is always present, and
   `/ORACLE.md` §14.1 is the rule. The three blocked reasons are Core's
   (`microphoneBlockedBy()` returns `POLICY_BLOCKED`, `CONSENT_REQUIRED`,
   `VOICE_UNAVAILABLE`, policy first on purpose); Oracle supplies the facts
   behind them and nothing about their presentation.

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

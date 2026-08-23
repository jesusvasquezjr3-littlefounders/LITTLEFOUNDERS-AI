# SECURITY_AUDIT_2026-08-23 — Oracle (the AI Tutor)

> **Status:** all findings fixed and regression-tested · **Scope:** `oracle/`
> and the Core routes it touches · **Method:** adversarial, source-only
> · **Authority:** informational. `/ORACLE.md` remains the spec; where this
> document and that one disagreed, `/ORACLE.md` was the one that was wrong.

An audit run immediately before the first production deploy, because the owner
asked for prompt-injection defences to be verified and because nothing had
attacked this service on purpose before.

Six surfaces were attacked independently and in parallel, each by an adversary
told to construct a concrete exploit or report nothing. Every finding was then
handed to a skeptic instructed to **refute** it — to check the quoted evidence
was real, the path reachable, and the attack not already stopped by a different
layer. Findings that survived that pass are the ones below.

**27 raised · 7 survived · 5 high · 0 remaining open.**

Three items were declared out of scope up front because they are already
recorded and owned elsewhere: the Inworld data-processing agreement, the
consent wording awaiting counsel, and the three scale gaps in `/ORACLE.md`
§15.2.

---

## §1 What was found, and what it means

### 1.1 Model-authored text reached a child's screen unmoderated — HIGH

`segmentRequest.framing` is 240 characters of free prose the model writes and
the client prints under the activity. It went through no moderation at all,
while a comment in `turnSchema.ts` and another in `LiveSegmentPanel.tsx` both
asserted it was "moderated exactly like `say`". Only `say` was passed to the
judge.

The consequence is not subtle: a model steered into saying something we would
block had only to put it in the other field of the same turn. Same model, same
turn, same pixel, strictly weaker channel. It also flowed on into the tier-3
author prompt, interpolated raw — the one place `/ORACLE.md` §5 says
model-derived text must never go unfenced.

**This is the finding that mattered most**, and not because it was the most
exploitable. A control that exists only in a comment is worse than a known gap,
because the comment is what stops anyone from looking. The whole closed-schema
defence rests on the premise that the only way out is a moderated field, and
that premise was false.

**Fixed:** `say` and `framing` are moderated in one call
(`orchestrator.produce`); a block drops the whole turn, activity included. Both
the tier-3 brief's model-derived strings are fenced with a per-call nonce
exactly as a learner's words are. Both comments now describe what the code
does, and `turnSchema.ts` says explicitly that a new free-text field must join
that call before it ships.

### 1.2 Two paths to the model skipped every cost and rate control — HIGH

The 700 ms floor lived inside `handleLearnerTurn`. `segment_graded` called the
orchestrator directly and never entered it. `learner_audio` called the paid
speech-to-text provider *before* delegating there, so every frame was
transcribed and billed and only the survivor produced a turn. Dispatch was
fire-and-forget, so frames already in the read buffer all started at once. And
the turn counter advanced only *after* a completion returned, so a burst all
measured itself against the same stale count and all passed a cap none of them
had reached.

One authenticated learner, one ordinary session, one burst of ~90-byte frames:
dozens of concurrent completions and paid syntheses inside the single process
serving every live session. The invoice is cents; the blast radius is
availability for everyone.

**Fixed:** every model-producing path — text, audio, graded segment, farewell —
claims a single per-socket slot through one `claimTurn` function before any
paid work, transcription included. The turn slot is reserved at entry to
`produce()` rather than counted at exit, and `produce()` now refuses an ended
budget itself instead of trusting each caller to remember.

### 1.3 The rate limiter could take the tutor offline platform-wide — HIGH

Oracle's global limiter (200 requests / 15 minutes, keyed by IP) sat above its
internal surface, whose only caller is Core — one address. All platform traffic
therefore shared one bucket, and `preflight` runs on the tutor **offer screen**,
not just on session start. Roughly 200 tutor page views in a quarter of an hour
made Core answer `ORACLE_UNAVAILABLE` to every learner.

No attacker required: ordinary success was the trigger. Worse, `/health` stayed
200 throughout, so the platform saw a healthy service and never restarted or
scaled it. `/AGENTS.md` §1.14 says a rate limiter must never be able to take the
platform down; this one could, without failing.

**Fixed:** the internal surface is exempt. It is already behind
`requireInternalKey`, so an IP bucket in front of a shared secret defended
nobody. Everything unauthenticated is still limited, and a test asserts both
halves.

### 1.4 An unreadable consent answer read as a granted one — LOW

The mid-session re-check acted on the literal `false`. `checkVoiceConsent`
returns `null` when Core is unreachable, times out, or answers something that
does not parse — so an outage read as "still granted", and a revocation that
landed during one was never observed for the rest of the session.

Low only because `TUTOR_VOICE_FOR_MINORS` defaults false, so there is no
minor's microphone to leave open today. It is still a §1.14 fail-open in a
child-safety control, and the door check twenty lines away already got it
right.

**Fixed:** `!== true` refuses, matching the door.

### 1.5 Nothing asserted the judge was not the author — not filed, fixed anyway

No startup check compared `JUDGE_API_BASE`/`JUDGE_MODEL_NAME` against
`MODEL_API_BASE`/`MODEL_NAME`, and `check-provider-parity.mjs` pins them against
Forge rather than against each other. A deployment pointing both at the same
endpoint would keep every moderation call and every content verdict while
silently losing the independence that makes them worth anything.

**Fixed:** a startup warning that names the variables. A warning rather than a
fatal error, because refusing to boot turns a misconfiguration into an outage.

---

## §2 What held

Most of the system, and it is worth writing down so a future reader knows what
was actually checked rather than assumed.

Session tokens are Core-minted, single-use, session-scoped, HMAC-verified with
`timingSafeEqual` on fixed-width digests and **no `String.length` pre-check**
(§1.14's specific trap); expiry is checked before the burn; Supabase JWTs are
refused by two independent checks. No client frame carries a session or user
id, so a token for session A provably cannot reach session B.

Moderation fails closed on all five failure modes — timeout, non-200, malformed
JSON, parse rejection, unconfigured — and distinguishes "not configured" from
"said no". A minor's socket is refused at the door when no judge is available.

`.strict()` is applied at every nesting level, not only the outermost object. No
birth date, surname, email, address, user id or session id reaches the model.
The voice provider gets audio with `enableVoiceProfile: false` set explicitly,
and never the transcript.

`/health` is above the limiter and every optional dependency; the listener opens
before Redis; the limiter fails open. Speech cache keys cannot cross characters
or locales, and only the closed 144-line scripted set touches shared storage. No
credential reaches a log, an error, a response body, or a URL.

RLS on the tutor tables (checked separately, migration `0047`): turns are
readable by the learner or a verified guardian via `is_verified_guardian_of`;
`tutor_segments` and `tutor_packs` have RLS enabled with **no client policy at
all**, because they carry answer keys.

---

## §3 What this audit did NOT cover

The remaining risk is shaped mostly by what could not be exercised. Stated
plainly so nobody reads a clean report as a broad guarantee.

- **No live providers.** Not one real DeepSeek, Qwen or Inworld call. §1.1 rests
  on the path being reachable and unguarded, not on an observed hostile
  completion. How often the model can actually be talked into a hostile
  `framing` is unmeasured.
- **Invisible-character normalization is an open question.** The injection
  adversary reported that zero-width characters let the canary corpus past
  `classifyLearnerInput`, and that `stripInvisible` misses Tags-block,
  variation-selector, Hangul-filler and Braille-blank payloads. None of it
  survived refutation — most likely because the classifier is a signal and the
  nonce-asserted fence plus moderation-before-speech are the actual barriers —
  but the record does not establish that. **Worth one focused re-look; do not
  treat it as cleared.**
- **Multi-instance is unexamined and probably unsound.** The `jti` ledger is
  in-process. On two Railway replicas a token burned on one is still fresh on
  the other. Verify before scaling, not after.
- **Not looked at at all:** the browser attack surface beyond the one component
  that renders `framing` (no XSS sweep, no CSP review, no 3D asset path);
  infrastructure (Railway config, TLS, secrets at rest, egress, log retention);
  dependency and supply-chain review; Core's non-tutor routes and the other
  nine services; real-concurrency load or soak testing.
- **Process, not code:** §7.3's post-hoc human review sampling exists in Core,
  but nothing verifies a human reads the samples, and Oracle's
  `LIVE_REVIEW_SAMPLE_RATE` is dead config. That control is only as real as the
  person on the other end of it.

---

## §4 The lesson worth keeping

Every one of these defects shipped with 165 tests green, and each stayed
invisible for the same reason: the suite exercised the path the feature was
written for and never the path beside it. `learner_text` was covered;
`segment_graded` was the same idea one function along, and nothing tested it.
`say` was moderated; `framing` was the other half of the same object.

`/ORACLE.md` §15.2 asserted the turn floor and the turn cap held. The assertion
was true of one path and false of another, and **the assertion is what stopped
anyone from looking**. A claim in a specification is a claim about code, and it
decays silently as the code changes around it.

So the regression tests in `oracle/src/__tests__/hardening.test.ts` are written
to the **attack** rather than to the feature, and every one was confirmed to
FAIL against the pre-fix code before being accepted — six of seven did, which
is the only evidence that a regression test is worth its line count. When
`/ORACLE.md` names a control from now on, it should name the test that proves
it.

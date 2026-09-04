# ORACLE.md — The AI Tutor (Oracle)

> **Authority:** engine spec (/AGENTS.md §1.1 #6). This document is authoritative
> for the Tutor's product flow, its privacy contract, its content strategy and
> its safety posture. The 3D STAGE it renders on is `/TUTOR_3D.md`; the exercise
> contract it composes is `/LESSON_ENGINE.md`; the generation pipeline it borrows
> is `/COURSE_ENGINE.md`. On conflict with /AGENTS.md or DESIGN.md, those win and
> this file gets fixed.
>
> **Status (2026-09-01): IN PRODUCTION.** The runtime, migration `0047`, Core's
> `/api/v1/tutor/*` surface AND the immersive experience are all built, shipped
> and verified end to end against the deployed service — Core reaches Oracle
> privately, both providers answer, a turn seals/parses/passes the judge, and
> the cast is enrolled, synthesized in their own voices, stored and fetchable.
> Live at `oracle-production-e82a.up.railway.app`. §16.1's immersion gates were
> measured on 2026-08-23; as of 2026-09-01 exactly ONE remains unticked, and it
> says why. *This line said "three" until 2026-09-01* — the gates it was
> counting were ticked in §16.1 itself, each with its own dated evidence, while
> the tally up here was never re-counted. §15.2's lesson in miniature: a claim
> about the state of the code decays silently, and a summary of a checklist
> decays faster than the checklist.
>
> An adversarial security audit on 2026-08-23 found five HIGH defects, all
> fixed with a regression test each: `/SECURITY_AUDIT_2026-08-23.md`, whose §3
> records what it did NOT cover.
>
> **STILL NOT ENABLED FOR MINORS.** `TUTOR_VOICE_FOR_MINORS` is `false` and
> gates one INPUT METHOD, not the product — every learner has the whole Tutor,
> captioned and typed. It waits on two things outside the code: the
> data-processing agreement covering minors' audio, and counsel-approved
> consent wording. Since 2026-08-23 the platform also refuses to COLLECT that
> consent while the flag is off (§16). Legal review:
> `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md`.
>
> *History, kept because it is the reason §9, §10, §14.1 and §16.1 read as they
> do:* the `/tutor` experience first shipped as a dashboard of flat cards with
> the 3D stage shrunk into a panel, and the owner rejected it — it had to be an
> immersive 3D experience with the controls inside the scene. Those sections
> are that rebuild's contract, and it is now delivered.
>
> Where this document and the code disagree, the code is right and this
> document is the bug — §3.1 and §7.3 were corrected once already for exactly
> that reason (see the note in §7.3), and §2.1, §2.2, §9 and §10 were corrected
> on 2026-08-21 for the opposite reason: the code was following a document that
> was wrong, or that had recorded a fallback as a decision. Both directions
> happen. Every correction says what it used to say.
>
> **Last updated:** 2026-09-01 · Language: English (project rule).

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
   learner (the nickname is in the CAPTION, not in the audio — §15.1) and
   offers a small, closed set of ways to start: a
   topic from a course they are taking; a skill Data Intel says is weak; a
   frequent question; or "something else", which opens a conversation rather
   than a free-text form.
4. **Converse and teach** (§9.3) — the camera stays on the character, their
   dialogue rendered **above their head** (a deaf-accessibility requirement,
   not a nicety) with the character's own 2D head articulating in that same
   caption plate, beside the words *(composition corrected 2026-08-22: the head
   used to be a separate chat bubble on the lesson plate that printed the same
   sentence a second time, 252 px lower. Both channels are unchanged; one of
   the two printings is gone. /DESIGN.md §Lumen -> One line, one printing, two
   channels)*; the Lesson Engine runs **live** on a plate floating over
   the same island, one segment at a time, chosen or generated for this
   learner. *(Corrected 2026-08-21: this step used to say "the Synthesis-style
   split — the character on the left, the Lesson Engine on the right". That
   sentence is where a two-panel dashboard came from. There is one scene and
   things float over it.)*
5. **Close kindly** (§9.5) — a session ends on a budget, warmly, with a recap
   and a reason to come back. Never a hard cut.
6. **Replay** (§12) — the session is saved and can be PERFORMED again, on the
   same island, by the same character, with the emotions and gestures it
   originally carried. A phase of the same stage, not a list of what was said.

**What Oracle is not.** It is not a chatbot with a 3D avatar bolted on. The
conversation exists to drive the lesson; the lesson is the product. A session
that produced only talk produced nothing.

---

## §2 The stage — what exists, and the five gaps

`/TUTOR_3D.md` §7b is the integration contract and it is DONE. `TutorStage`
takes `character`, `companion`, `emotion`, `action`, `actionKey`, `speechUrl`,
`onSpeechEnd`, `idleFraming` and `onReady`. Hand it a speech URL and it plays
the audio, drives the mouth from that audio, and closes the camera in for as
long as the character is talking. Wiring Oracle is passing props, not reaching
into the scene.

### §2.1 The gaps between "stage" and "tutor" — ALL FIVE CLOSED

> **This table said "ALL CLOSED" and it was wrong on two rows.** Corrected
> 2026-08-21 during the immersive rebuild. Both corrections are recorded here
> rather than edited away quietly, because a document that silently repairs
> itself teaches nobody which of its remaining claims to check.
>
> **And then it was wrong in the other direction.** The Backdrop row went on
> saying OPEN for two days after the rebuild closed it, naming a file that no
> longer exists and asserting the prop reached no renderer when three
> components carry it and a test pins the forwarding. Corrected 2026-08-23.
> Both directions of error cost something, and this one costs more than it
> looks: a stale OPEN sends somebody to fix working code, and it sat in the one
> table a reader consults to learn what is broken.

| Gap | State |
|---|---|
| **Diorama choice** | **CLOSED.** `TutorStage` now forwards `scene` to `TutorScene`, which had always accepted it. The prop was simply missing, so the product could not offer an island the scene lab had been switching between for weeks. |
| **On-canvas overlays** | **CLOSED, and the doctrine generalizes past captions.** `frontend/src/tutor/SpeechCaption.tsx` is a billboarded HTML overlay ON the canvas, never scene geometry. Text in WebGL is a font-atlas problem (glyph coverage for three locales, hinting, subpixel rendering) that buys nothing here, because an overlay always faces the viewer anyway. A div gets real text rendering, real selection, real screen-reader output and real i18n for free. The caption reveals with a typewriter for sighted readers while `aria-live` announces the COMPLETE sentence — announcing the animating slice would stutter it two characters at a time. **The same reasoning covers the ENTIRE HUD**, not just captions: every offer chip, recap chip, minutes rune and lesson plate is a DOM node projected to a world point, for the same four reasons. Text in the scene is a rendering choice; text in the DOM is an accessibility guarantee. See `/TUTOR_3D.md` §9.2 for the projection channel. |
| **Streamed speech** | **CLOSED.** Oracle writes each turn's audio to Depot and hands over a URL, which is the simpler of the two options the design left open. Revisit only if the round trip is MEASURED to hurt. |
| **Per-character framing** | **CORRECTED — this row recorded the FALLBACK as the decision.** It said `liruf` and `dina` "stay at the island shot". §2.2's own primary mitigation says the opposite: *"They frame wider. Their `conversation` framing keeps more of the body in shot."* Never closing the camera on them is §2.2's stated FALLBACK, to be used only "if this reads as broken in the first real screenshot pass" — and no such pass ever ran. What shipped (`speakingFraming={ARTICULATES.includes(...) ? 'conversation' : 'vignette'}`, `ConversationView.tsx`) applied the fallback without its trigger, so two of the four selectable tutors never came to the foreground at all. The rebuild returns to the primary decision as a named shot, `closeup-wide` (§2.2). This is a correction to a document, not a new owner decision. |
| **Backdrop** | **CLOSED 2026-08-23** — and it was the last one. The `auto \| dawn \| day \| dusk \| night` axis is offered in the picker (`frontend/src/tutor/PersonalizeInWorld.tsx`), Zod-validated and persisted (migration `0047`, `tutor_preferences.backdrop` with a CHECK constraint), returned by two Core endpoints, and now **reaches the renderer**: `TutorStage.tsx:76` declares `backdrop?: SceneBackdropId` and forwards it at `:207`; `TutorScene.tsx:136` passes it to `<SceneLighting settings backdrop />` at `:830`; `SceneLighting.tsx:56` lerps to `warmBy(resolveBackdrop(backdrop, isDark), warmth)` at `:66`. `TutorStage.test.tsx:118-128` asserts the forwarding, and §16.1's "every persisted preference axis provably reaches the scene" gate was measured live on 2026-08-23. *Kept, because it is the clearest example in this file of §1.14's quietest failure:* for a while the control existed, saved forever, and changed nothing — and a control that does nothing looks identical to one that works, from every side except the one nobody looked at. |

### §2.2 The static-mouth mitigation (decision 4)

TUTOR_3D.md §3.1 closed mouth cards for `liruf` and `dina` after exhausting six
techniques; the only remaining route was texture surgery on a fragmented UV
atlas, rejected as likely to visibly damage two characters that currently look
good. The owner has chosen to ship them as speaking tutors anyway. Three things
make that acceptable rather than broken:

- **They frame wider — the `closeup-wide` shot.** Restated 2026-08-21 as a
  named shot rather than a description, because the description was what let
  the fallback get implemented in its place. `closeup-wide` is 22° off-axis at
  1.35× the `closeup` distance, framing head AND hands, so the eye reads
  posture and gesture rather than a still mouth. It is still a foreground shot:
  the character comes to the front of the frame, which is the whole point of
  choosing them as your tutor.
- **The 2D head carries the articulation, and it sits in the caption.**
  `CharacterActor` already takes `speaking`, and the 2D SVG characters animate
  their own mouths from it. It is beside the words the learner is reading, which
  is what this bullet always meant by "where a learner's eye goes anyway";
  until 2026-08-22 it was implemented as a separate bubble one screenful below
  the caption, which both split the glance and printed the sentence twice.
  **It also has to be big enough to be a mouth**: in the bubble it was a whole
  standing figure in a 64 px box, which put Dr Rho's mouth at about five pixels.
  `TutorFace` crops to the head. /DESIGN.md §Lumen -> *One line, one printing,
  two channels* carries the measurements.
- **Gesture load increases.** They get an action on more turns than `rho` and
  `zara` do, because posture is the only speech channel they have.

The fallback — decision 4's alternative, keep them selectable but never close
the camera on them — is a props change, not a rebuild.

> **What actually happened, recorded so the shape of the mistake is reusable.**
> The fallback shipped instead of the primary decision, without its stated
> trigger. Its trigger was "if this reads as broken in the first real
> screenshot pass"; there was no first real screenshot pass, and the fallback
> was applied at the keyboard because it was the safer-sounding of two options
> written on the same page. The cost was that half the selectable cast never
> came near the camera, which reads to a learner as picking Liruf and being
> given a distant figurine.
>
> The general rule: **a mitigation with a stated trigger may not be applied
> before its trigger fires.** Conditions written into a design are load-bearing
> even when they gate the cautious branch, because the cautious branch is still
> a different product.

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

**Resume — owner sign-off 2026-08-28.** A socket that drops UNCLEANLY no longer
ends the session: Oracle parks the orchestrator (history, budget clock, paid
speech memo) in-process for `SESSION_RESUME_GRACE_MS` (default 90 s), and Core
offers `POST /api/v1/tutor/sessions/:id/resume` — owner only, still-open
sessions only — which mints a FRESH token on the same single-use terms. The
re-attaching handshake re-runs every gate above, then redraws instead of
replaying: a `history` frame with the transcript, the on-screen turn re-sent as
text with no audio, no second greeting. An unclaimed park is finalized as
`learner_left`. The client auto-resumes at most ONCE per session and says
"reconnecting" while it does; a server-refused socket (expired, budget, consent)
is never re-dialled. **Since 2026-09-01 the park is no longer confined to the
process that made it** (§16, `RUNBOOK.md` Round 143): it is also published as a
versioned snapshot any replica can adopt, so a reconnect load-balanced to a
different instance resumes the same conversation rather than starting over, and
`transcriptSeq` is floored by a shared monotonic high-water mark so a resumed
transcript can never renumber over rows already written. Proven by
`live-session.test.ts` → "a dropped session can be resumed on a fresh token"
(same-replica) and → "a dropped session resumes on a DIFFERENT replica"
(cross-replica, every test confirmed red against the pre-fix code), plus
`backend/src/__tests__/tutor.test.ts` → "POST /api/v1/tutor/sessions/:id/resume".

> **Fixed 2026-08-30 (adversarial review, HIGH): resume had no notion of
> "already live".** `POST /sessions/:id/resume` minted a fresh token for any
> session the caller owned with `ended_at IS NULL` — it never checked whether
> a socket for that session was already open. If the client simply never let
> the first socket close (or called resume while still connected), the second
> socket found nothing parked (there was nothing to find — the first was
> never dropped) and `handleConnection` spun up a SECOND, fully independent
> `TutorOrchestrator` for the same session: its own budget clock, its own
> turn cap, running in parallel. Each extra socket bought another full
> session's worth of paid model/judge/TTS calls and defeated
> `MAX_SESSIONS_PER_DAY`, the product's own anti-addiction control — and
> `closeTutorSession`'s "first close wins" guard on `ended_at IS NULL` meant
> every orchestrator but the first to close had its real, billed usage vanish
> from Core's cost ledger, while both sockets' independently-restarting
> `transcriptSeq` collided in `tutor_turns` and silently dropped one side's
> rows — the "guardian can't read what their child said" failure this file
> already fixed once, reopened by a different door. Fixed with a new
> in-process registry, `liveSessions` (`ws/server.ts`), checked BEFORE
> `takeParked`: a session already live refuses the new socket outright
> (close code `4009`, mapped client-side to a plain "you're already talking
> to me somewhere else" line, all three locales) rather than silently
> duplicating it. A genuine resume is unaffected — it only ever reaches this
> point after the ORIGINAL socket's `close` handler has already removed it
> from `liveSessions`. Proven with a throwaway test before the fix (a second
> socket for a still-open session hung forever waiting for a refusal that
> never came) and a permanent one after (`live-session.test.ts` → "refuses a
> second socket for a session whose first socket never actually closed").

> **Fixed 2026-08-30 (a sixth adversarial review, HIGH): the redraw itself
> was incomplete.** It rebuilt the `turn` frame by hand instead of going
> through `deliver()` — the one function that recomputes and attaches a
> whiteboard — and it never re-sent a `segment` frame at all. An ordinary
> reconnect (a sleeping phone, a wifi drop — the exact case this whole
> mechanism exists to survive) while a growth story or an open activity was
> on screen left the learner staring at narration for a board or an
> exercise that had simply vanished: no board, no quiz, no way to answer,
> no XP. Fixed two ways: the whiteboard is now recomputed and attached the
> SAME way `deliver()` does it, from `snapshot.lastTurn.turn.whiteboard`;
> and a new field, `Live.lastSegmentFrame`, caches the exact last `segment`
> frame sent (carried across the park like `transcriptSeq` already is,
> cleared the moment that segment is answered) and resends it VERBATIM on
> resume — never re-served, since re-running `serveSegment()` would produce
> a DIFFERENT exercise, not restore the one the learner was looking at.
> Proven by `live-session.test.ts` → "redraws the open WHITEBOARD on
> resume" and "redraws the open ACTIVITY on resume", both confirmed to fail
> against the pre-fix code first.

> **Fixed 2026-08-30 (a seventh adversarial review, this time the frontend
> client — two CRITICAL, one MEDIUM).** (1) A SUCCESSFUL resume used to tear
> itself down: `TutorExperience.tsx`'s resume effect cleared `resuming` in
> the SAME tick as it changed `socketUrl` to the fresh one, but
> `useTutorSocket`'s own reset of `connection`/`history`/`closedReason` only
> happens on ITS NEXT effect pass — so the very next render still read the
> OLD, already-ended socket state with `resuming` now false, re-triggered
> the "has this ended?" check against stale data, and called
> `setPhase('closing')`, closing the brand-new socket before it could ever
> say `ready`. Fixed by leaving `resuming` true until a NEW effect observes
> the fresh socket's OWN `connection === 'open'`, by which point the reset
> has genuinely happened. (2) The composer rendered fully enabled the
> instant the handshake started, with no gate on `connection === 'open'`;
> `sendText`'s optimistic echo (by design, for perceived responsiveness)
> appeared in the learner's own transcript as delivered while the
> underlying `send()` silently no-opped because the socket was still
> CONNECTING — a real window on a slow or mobile link. Fixed with a queue
> (`pendingRef`) flushed the moment the socket opens, rather than either
> dropping the message or disabling the composer. (3) MEDIUM: on resume, the
> re-sent `turn` frame for the on-screen line duplicated an entry the
> `history` frame already carried; invisible while `TutorTranscript`'s
> `spokenSeq` filter still hid that exact seq, printing the same sentence
> twice the moment the NEXT turn changed which seq the filter hides. Fixed
> by skipping the append when the last history entry is already that exact
> tutor line. All three proven with permanent tests
> (`useTutorSocket.ts`/`TutorExperience.tsx`'s test suites) against the real
> hook and a controllable fake socket, each confirmed to fail against the
> pre-fix code first.

> **Fixed 2026-08-30 (an eighth adversarial review, CRITICAL):
> `LiveSegmentPanel.tsx`'s `submit()` could apply a stale grade response to
> whatever segment happened to be on screen.** The server can legitimately
> replace an unanswered segment while a grade request for the PREVIOUS one is
> still in flight; `submit`'s closure over `live.segmentId` cannot see this,
> because React gives the already-running call the `live` object from the
> render it started in, which never mutates — only a NEW `submit` closure
> would see the new prop, and the old one is the one still awaiting. A stale
> response therefore painted its verdict over the segment that replaced it,
> and — because `isSegmentLocked` reads `verdict?.correct` — a stale CORRECT
> verdict soft-locked that segment's inputs on an activity the learner had
> not even attempted. Fixed with a ref (`liveSegmentIdRef`) written on every
> render regardless of which closure is running, checked against the id
> `submit` captured at call time immediately after the await; a mismatch
> drops the response silently, since the segment-reset effect already put the
> new segment in a clean state. Proven with `LiveSegmentPanel.test.tsx` (new
> file) using a minimal test-only registry entry rather than a real renderer,
> confirmed to fail against the pre-fix component first — the stale "Exactly
> right!" banner rendered over a fresh, unanswered segment.

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

**VERIFIED against the live API, 2026-08-21**, with a real non-production key.
Everything here was measured rather than read off a page — an earlier draft of
the adapter guessed `/v1/speech:synthesize` and `/v1/speech:recognize` and
expected raw audio bytes, and all three guesses were wrong.

| Call | Shape | Measured |
|---|---|---|
| `POST /tts/v1/voice` | `{text, voiceId, modelId, language, audioConfig}` → `{audioContent}` base64 MP3 | **814 ms** a sentence |
| `POST /stt/v1/transcribe` | `{transcribeConfig:{modelId, language, audioEncoding, voiceProfileConfig}, audioData:{content}}` → `{transcription:{transcript,…}}` | **715 ms** |
| `POST /voices/v1/voices:clone` | `{displayName, langCode, voiceSamples:[{audioData, transcription}], audioProcessingConfig}` → `{voice:{voiceId}}` | instant, usable at once, **2 requests/minute** |
| `DELETE /voices/v1/voices/{id}` | — | removes a cloned voice |

Full round trip **1.53 s**, transcript faithful (it normalises "veinticinco" to
"25", which for a maths tutor is an improvement). Auth is `Basic <key>` and the
key arrives **already base64-encoded** — encoding it again yields a 401 that
reads like a bad credential rather than a bad header. Models present:
`inworld-tts-1`, `-1-max`, `-2`, `-2-flash`. Catalogue: 282 voices including
34 Spanish and 14 Portuguese.

`npm run voices:verify` re-runs that round trip **through the adapter**, so a
drift in Inworld's shapes fails a command rather than a child's session.

> ### ⚠ THE CAST ALREADY HAS VOICES — use them or stay silent
>
> Owner correction, 2026-08-21, and it was right: Dina, Liruf, Dr. Rho and
> Zara are already voiced. Echo clones them per locale from the owner's
> reference recordings (`audiogen/src/samples/trimmed/`, gitignored) and
> narrates **every lesson** with them. A Tutor speaking in a stock catalogue
> voice would hand a child who knows Dr. Rho from a lesson a stranger wearing
> his face — which quietly breaks the one thing the 3D cast exists to build.
>
> So Oracle resolves a voice per CHARACTER × LOCALE from
> `INWORLD_VOICE_<CHAR>_<LOCALE>`, named to mirror Echo's
> `TTS_VOICE_<CHAR>_<LOCALE>`, and `npm run voices:clone` enrols them from the
> **same trimmed samples Echo uses** — one source, so the two castings cannot
> drift apart by neglect.
>
> **There is no fallback voice, deliberately.** An unenrolled character is
> SILENT in that locale: the turn is captioned, the lesson continues, and the
> verify script names the missing enrolment. Substituting a stock voice would
> be §1.14 in its purest form — a confident wrong answer where an absent one
> merely omits.
>
> Inworld's cloning is *instant* (5–15 s of reference, no training step) and a
> cloned voice runs at the same realtime latency, which is what makes this
> affordable at all. Their **professional** cloning (30+ min of audio) is
> recommended for children's voices and unusual timbres — relevant to Liruf,
> and an owner decision rather than an engineering one.

> ### ⚠ PRIVACY FINDING — Inworld's STT can profile the speaker
>
> Found by verifying, not by reading. `inworld/inworld-stt-1` can return a
> **voice profile** alongside the transcript: inferred emotion, vocal style,
> accent, **age** and pitch.
>
> Measured: it is null unless requested, and absent entirely when
> `enableVoiceProfile: false` is sent. Oracle sends that explicitly and logs an
> error if a profile arrives anyway — off by default is not the same as off,
> because a default is something a provider can change and we would never
> notice.
>
> Inferring a child's age and emotional state from their voice is a different
> KIND of processing from turning speech into text, and nothing in this product
> needs it. Recorded for counsel in `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md`.

---

## §4 The privacy contract — exactly what leaves our infrastructure

This is the section to read before changing any prompt.

### §4.1 To the pedagogical model (DeepSeek/Qwen) — the complete allowed set

| Field | Form | Why |
|---|---|---|
| `nickname` | learner-chosen, validated, moderated — never the profile name | The tutor must be able to address someone. |
| `tier` | `1 \| 2 \| 3`, derived from `birth_date` (≤7, ≤9, rest) | Vocabulary and cognitive load. **Never** the birth date, never an exact age. |
| `locale` | `en-US \| es-MX \| pt-BR` | Language. |
| `skillStates` | An array of Data Intel's derived state: `skillKey`, `masteryProbability`, `uncertainty`, `evidenceCount`, `recommendedAction`, `reasonCode` | Pedagogical guidance. |
| `courseContext` | ids and titles of the PUBLISHED course/topic in play | Scope. |
| `intent` | a closed enum from the offer screen | What we are doing. |
| `adaptations` | closed enum of learner-chosen preferences (§11) | How to explain. |
| `character` | `dina \| liruf \| rho \| zara`, a closed enum | Which of the four the learner chose, so the model writes in that character's voice and manner (`prompt.ts` reads `CHARACTER_VOICES[context.character]`). Says nothing about the learner. **Added to this table 2026-08-23** — it had been in the sealed schema and in the prompt since the runtime was built, and this table called itself the complete allowed set while omitting it. |
| `turnHistory` | this session's turns only, truncated | Conversational coherence. |
| `planState` | server-derived lesson-plan projection: an objective composed from OUR catalog titles and the closed intent vocabulary, a closed step enum with an index, stuck-skill counters over keys `skillStates` already names, and (**added 2026-08-31**) `finalStepRoundsCompleted`, a 0-10 count of turns since the plan's own arithmetic reached its last scripted step (`tutor/plan.ts`) | The lesson's spine. Carries NO learner data the rows above do not already carry — it is state the server computed about its own teaching. The new counter is what lets `prompt.ts` tell the model, once, that the planned arc is complete instead of repeating identical step guidance forever (AGENTS.md item 81). **Added 2026-08-28, owner sign-off; extended 2026-08-31.** |
| `previousSessions` | up to three PRIOR sessions as strict digests: catalog topic title, ≤5 skill keys, a closed outcome (`completed \| left \| stopped`), two bounded counters, and a day count. **Never a transcript, never a learner's words** (`PreviousSessionSchema`) | Continuity — "last time we worked on…". This is the one deliberate exception to `turnHistory`'s this-session-only rule, and its shape is what keeps it narrow: nothing in a digest can reconstruct a sentence anyone said. Digests are computed deterministically by Core at close (never by a model), stored on the session row, and swept with it at 90 days. **Added 2026-08-28, owner sign-off.** |
| `pedagogy` | the v3 controller's state for this turn (`PedagogyStateSchema`): a closed strategy enum (12 values), a 0-3 scaffolding level, a closed mode enum, one objective sentence from OUR kc catalog (`kc.objective`, migration 0052, localized), and at most one `misconceptionHint` — OUR catalogued remediation wording (`misconception.remediation_hint`), selected because arithmetic against the item's own numbers matched a known wrong-idea pattern. **Never learner text**: the detection is numeric, and what travels is our authored description of the wrong idea, not anything the learner said or answered | How this turn should be taught. The controller (`oracle/src/tutor/controller.ts`) decides the strategy from mastery bands and graded events; the model only performs it. Same privacy class as `planState` — state the server computed about its own teaching, over catalog text. Null while the v3 brain is dormant, which renders exactly the pre-v3 context. **Added 2026-08-28, owner sign-off (Tutor v3).** |
| `openActivity` | the activity ON THE LEARNER'S SCREEN right now, as two fields: the engine's segment `type` (a closed vocabulary, e.g. `coin_count`) and the authored `prompt` already displayed, truncated to 400 characters. **Our own catalog text, never the learner's** — nothing they typed, answered, tapped or scored travels here, and the field is null between activities | So the tutor stops narrating an activity it has never read. It asks the ladder for a SKILL and the LADDER picks the segment, so before this the tutor improvised: on 2026-08-29 it framed a task as "you be the cashier, choose the change", the catalog served "the compass costs $12, make exactly that amount", and on success it congratulated the learner for change they never gave. Same privacy class as `courseContext` — published text we wrote. **Added 2026-08-29.** |
| `learnerBrief` | the V4 curated memory: two prose stores, `learner` (max 1,400 chars — who this child is: interests, motivation, what to avoid) and `pedagogy` (max 2,200 chars — what teaching works with them), written ONLY by our post-session review from this learner's own transcripts, hard-capped by the database, every write ledgered append-only, and readable by a verified guardian via RLS from day one. **Derived from the child's own past speech** — which is why it renders as the tutor's OWN notes under the system prompt's instruction hierarchy, never as the learner's words; the review's prompt forbids surnames and locations (§1.9), and the parental approval gate is a documented blocker before family rollout (§20.4) | This is the harness blueprint's best token-for-token upgrade: ~500 tokens of "Sofía necesita ver antes de oír" transform every turn of a session. Supersedes 0051's no-transcript-prose rule for exactly these two bounded fields, by owner decision 2026-08-29, with the ledger and guardian RLS as compensating controls. **Added 2026-08-29.** |

> **This table was incomplete for two days, which is the one defect a privacy
> contract cannot afford.** It listed eight fields and called itself complete;
> `TutorContextSchema` has nine. `character` was the missing one — harmless in
> substance, since it says nothing about the learner, and serious in kind: the
> whole value of an enumerated allow-list is that it is exhaustive, and a
> reader who spot-checks one field against the code and finds it missing has no
> reason to trust the other eight. Two field names were also wrong
> (`skillState[]`, `adaptation`). **When adding a field to
> `oracle/src/context/schema.ts`, add the row here and the matching item to
> `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md` §2.2 in the SAME commit** — §17 already
> requires it, and this is what it looks like when that does not happen.

**Everything else is forbidden**, and the list is stated POSITIVELY because
§1.14 has already taught this project that a prohibition expressed only by
omission gets filled in with a default: real name, surname, email, birth date,
exact age, address, city, school, avatar, family composition, sibling data,
another learner's anything, raw `learning_events`, raw attempt rows, prior
sessions' transcripts, and any free text the learner typed outside this session.

**Enforcement is a Zod schema at the boundary**, not a convention. The context
object is built by a single function, validated, and only then serialized. An
unknown key is a rejection, not a passthrough — `.strict()`, always.

> **"Never the profile name" was stated, and nothing ever checked it —
> found by adversarial review, 2026-08-30 (HIGH).** `nickname`'s own
> format guard (`/^[\p{L}\p{N}][\p{L}\p{N} '_-]*$/u`, shared by Core's
> `PUT /preferences` and Oracle's `NicknameSchema`) excludes punctuation,
> not identity — it allows spaces, so a clean two-word name with no comma
> or period sailed straight through. The existing rejection test only
> proved punctuation was excluded (`'Ana Vasquez, Jr.'` fails on the comma);
> a bare `'Ana Vasquez'` — literally a real learner's own `display_name` —
> was never checked against anything at all, on the one value this table
> already called "the only name-shaped value that may travel." Closed at
> Core's `PUT /preferences` route, the only place both the submitted
> nickname and the learner's real profile are in hand at once: a nickname
> is now rejected if it shares any word of three or more letters with the
> learner's `display_name`, word-based rather than whole-string so a bare
> surname (§1.9's own named example) is caught exactly as the full name is,
> without also rejecting a nickname that merely shares an unrelated short
> word by coincidence. Oracle's own `NicknameSchema` is unchanged and still
> a genuine second layer — a format backstop for whatever Core sends,
> independent of whether Core's own check ever regresses.

### §4.1b The placement intake — a SECOND, separate allowed set (2026-08-24)

`oracle/src/tutor/placementIntake.ts` is not a tutor turn and does not use
`TutorContextSchema`. It is reached by Core service-to-service when a learner
is choosing where to start a course, and it sends its own, smaller set. It gets
its own `.strict()` gate and its own table for the same reason §4.1 exists: an
allow-list is worth nothing unless it is exhaustive and written down.

| Field | Form | Why |
|---|---|---|
| `courseTitle` | the PUBLISHED course's own title | So the reply names what they are starting. |
| `courseSubject` | catalog label, e.g. `money`, `economics` | Register and domain for the question. |
| `outline` | ADVENTURE-level titles only, ≤12, in order | Enough to locate a learner along the course. Deliberately NOT the topic list: a model that can see 216 topic titles can be talked into naming one. |
| `locale` | `en-US \| es-MX \| pt-BR` | Language. |
| `ageBand` | `12-14 \| 15-17 \| 18+` | Register only. **Never** a birth date, never an exact age — Core converts and the date never leaves it. |
| `learnerText` | the learner's own words, ≤600 chars, nonce-FENCED | The thing being interpreted. |

**Everything else is forbidden**, stated positively: no name, no nickname, no
user id, no session id, no birth date, no exact age, no skill states, no
history, no prior text, no other learner's anything.

**Two things bound what this can do.** It is offered to **12 and over only** —
Core enforces the floor because Core holds the birth date, and an UNKNOWN birth
date is treated as under-12, because "we cannot rule out that this is a
seven-year-old" is not a basis for opening a free-text box. And its output is
closed to one number and one sentence: the number only decides where the FIRST
quiz question is asked, and every topic a learner is actually credited with
comes from a deterministically-graded answer to a pre-authored probe. A model
talked into `priorFraction: 1` moves one question and changes nothing else.

**The reply is moderated before it is returned**, through the same
`moderateTutorOutput` gate every spoken line uses, with the fence nonce handed
in; the model pass is REQUIRED for the two minor bands. Every failure — model
down, malformed JSON, an extra field, a refused reflection — lands on a neutral
prior identical to having had no conversation at all. It never throws at the
learner and never returns a number it did not derive.

**A flagged utterance and an ordinary outage were the same object — found by
adversarial review, 2026-08-30 (HIGH).** `classifyLearnerInput` runs before
the model call here too (fixed 2026-08-29), and correctly refuses to send a
flagged utterance — but the refusal landed on the SAME neutral fallback an
ordinary Oracle-is-down would produce, with no field distinguishing "the
model was unreachable" from "the learner just disclosed self-harm." This is
the FIRST exchange a learner has with the system, precisely when the least
is known about them, and it produced no signal anywhere — no log, no
category, nothing a guardian could ever see. Fixed by adding
`PlacementIntakeResult.flagged: {category, severity} | null`, set only when
the fallback was reached via the classifier gate, threaded through Core's
`placementIntake.ts` service and logged loudly (with the user id attached)
at the one place in the whole path with real request context —
`backend/src/routes/placement.ts`'s intake handler. The CLIENT response is
UNCHANGED: a child is never told their own words were flagged, matching
every other safety response in this product; this is server-side visibility
only. **Not yet done, and stated so rather than silently skipped:** whether
a flagged placement-intake utterance belongs in a guardian-visible record
the way a live-session safety flag does is a separate schema decision —
`tutor_safety_flags` requires a `session_id` FK and placement has no
session to attach one to. A loud log is the floor this fix guarantees, not
the ceiling.

**That schema decision is made, 2026-09-01: a SECOND, separate flags
table, not a nullable `tutor_safety_flags.session_id`.** Migration
`0065_tutor_placement_safety_flags.sql` adds
`public.tutor_placement_safety_flags` — `user_id`, `course_id` (context,
`ON DELETE SET NULL`, never ownership), `category`/`severity` copied
verbatim from `classifyLearnerInput`'s enum, `created_at`, and the
identical `tutor_safety_flags_select_own`-shaped RLS policy
(`user_id = auth.uid() OR is_verified_guardian_of(user_id)`). A separate
table rather than widening the existing one because the two provenances
are not the same shape with one optional field: placement has no
`turn_seq` (no transcript to point a "read it in context" control into)
and no meaningful `handled` value (`runPlacementIntake` takes exactly ONE
path on a flag — the neutral fallback — never `turn_blocked`/
`session_stopped`, which describe an in-session repair mechanism placement
does not have). Written from `backend/src/routes/placement.ts`'s intake
handler — the same place the loud log above already fires, now also
calling `insertPlacementSafetyFlag` with `course.id` as context — and read
back through the SAME guardian-visibility route the live-session flags
already use, `GET /api/v1/tutor/kids/:kidUserId/sessions`, as a new
`placementSafetyFlags` field alongside (never merged into) `safetyFlags`.
**The frontend card, which this section previously recorded as "not yet
done", is done — 2026-09-01.** `/family/:kidId/tutor`
(`frontend/src/routes/app/family/KidTutorPage.tsx`) renders
`placementSafetyFlags` through §12's existing treatment rather than a
second design of its own: the same "Worth your attention" card, the same
translated `tutor.guardian.flagCategory.*` / `flagSeverity.*` chips (both
provenances emit the SAME `classifyLearnerInput` enums, so no new category
copy was needed), and — the load-bearing part — inside the SAME
severity-first sort as the session flags, not in a section beneath them.
A separate section would have recreated one layer up the exact defect the
2026-08-30 review fixed inside this card: a HIGH `self_harm` flag sitting
below a batch of LOW ones, with "surfaced FIRST" true of the section and
false of what a parent actually reads first. **Only the ORDERING is
shared** — the two arrays stay separate on the wire, as the paragraph
above requires, and the component models them as a discriminated union so
the compiler, not a runtime check, is what proves a `session_id` exists
before the "Read it" control is offered. A placement flag carries no
session, so that control is absent by design and the row SAYS so
(`tutor.guardian.flagFromPlacement`, all three locales) rather than
leaving a hole a parent would read as a transcript that failed to load.
The floor is now the card; what remains open above it is unchanged
(retention for this table is still deliberately undecided — see migration
`0065`'s own header).

### §4.2 To the voice provider (Inworld)

- **Inbound:** the learner's audio, for transcription. It transits, is never
  stored by us, and the provider must be contractually bound not to retain it or
  train on it. **That contract is a business action, not an engineering one** —
  it is the owner's to obtain, and §16 blocks kid rollout until it exists.
- **Outbound:** the tutor's already-moderated text, for synthesis. Having
  cleared moderation, it carries nothing the learner was not about to hear.
- **Never:** learner identity of any kind. The provider sees a session id.

### §4.2b Hands-free listening — WHEN capture starts

**Added 2026-08-28.** The microphone no longer requires a held button. After a
tutor turn, it opens on its own, and the learner's turn ends when they stop
talking rather than when they remember to let go.

**Why this is pedagogy and not convenience.** Push-to-talk asks a child to hold
a button while they think, and thinking is the behaviour the product exists to
cause. A learner working out "cuarenta y… dos" releases the button during the
pause and loses the rest of their answer. This is the blueprint's §6.2 turn
policy and the first of its fourteen differentiators, and it is the one place
where the right answer is the OPPOSITE of a voice assistant's: in customer
service you close a turn fast, and in tutoring the silence is the valuable part.

**The budget is per strategy, never global.** `LISTEN_SILENCE_MS`
(`oracle/src/tutor/controller.ts`) travels on the turn as `policy.listenSilenceMs`.
Only the strategy knows whether three seconds of quiet is a child working
through a Socratic question (3 500 ms) or one who has lost the thread in a
fluency drill (900 ms). A dormant v3 brain sends no policy and the client falls
back to a deliberately patient default — never to zero, which would cut a child
off the moment they drew breath.

**What this does NOT change, and this is the whole privacy argument.** It is not
an always-on microphone:

- It rides the **same gate** push-to-talk does. Consent (§4.3), Core's answer,
  the DPA state and the browser permission are all upstream and untouched — a
  `kid` with no verified guardian consent gets no microphone at all, held or
  hands-free.
- It opens **only in the gap after a tutor turn**, never while the tutor is
  speaking and never while a turn is already in flight.
- It **closes itself** when nobody speaks (`leadInMs`), so a silent room is not
  recorded and no room tone is shipped to a paid transcriber.
- Nothing about the audio's handling changes: same provider, same
  moderation-before-speech, same never-persisted rule (§4.1, §4.2).
- **Push-to-talk still works.** This adds a way to answer; it removes none. The
  orb ends a turn early, and the detector defers to it rather than sending twice.

**Where the noise floor is decided.** `frontend/src/tutor/turnDetector.ts` is a
pure function over microphone levels, so the whole policy — including the
failure modes that only appear after four seconds of silence — is tested with no
microphone and no fake clock. Its thresholds encode two facts about children
that a default tuned for adults gets wrong: the quietest, least confident answer
is the one a tutor most needs to hear, so the speech threshold is low; and a
cough is not an answer, so a burst shorter than `minSpeechMs` can neither open a
turn nor close one.

**It did not know about the composer — found live, 2026-08-29.** Every gate
above answers "should the microphone be open" from consent, policy, and the
tutor's own speaking/turn state. None of them asked whether the learner was
doing the OTHER thing this product lets them do instead: typing. A learner
composing a text answer had hands-free listening open anyway, and ambient
noise crossing the speech threshold mid-sentence was transcribed and
delivered as a turn — silently discarding whatever had been typed, with the
tutor then reacting to that garbled transcript as if it were the real
answer. This is not a privacy gap (the gates above still hold: no consent,
no mic, regardless), it is a CONVERSATIONAL one — two live input channels
racing, with no rule for which one wins.

Closed with one more gate, the same shape as the others: `ConversationView`
tells `TutorExperience` whenever the composer holds unsent text
(`onDraftChange`), and `useHandsFreeTurn`'s `enabled` is `false` while that is
true — closing the microphone (or never opening it) the instant a keystroke
lands, via the hook's own existing `cancelled` mechanism, the same one that
already stops a stale clip from a revoked-consent or turn-ended race
(`useHandsFreeTurn.test.tsx` now asserts this specific race directly: a
`stop()` promise already in flight when the gate closes must not go on to
deliver its clip). Explicit push-to-talk is untouched — pressing the orb is
a deliberate choice and always wins, draft or not; only the PASSIVE,
automatic listen defers to a learner who is already answering the other way.

**It opened in the gap between a turn's text and its own voice — found by
adversarial review, 2026-08-30 (HIGH).** `speaking` and `awaitingReply`
gate the microphone, but they answer two DIFFERENT questions than the one
that matters here. A turn's text arrives in its own `turn` frame, which
clears `awaitingReply` immediately; its voice, if any, follows LATER in a
separate `turn_audio` frame (split delivery, §6 above), and `speaking` does
not become true until THAT lands. In the gap between those two moments —
real wall-clock time, the length of TTS synthesis — both `speaking` and
`awaitingReply` read false, which was exactly the condition that opened
hands-free listening. Whatever the learner said in that window was captured
and then silently discarded the instant the real audio arrived and closed
the microphone: no frame, no signal to anyone, the child's answer simply
gone.

`audioUrl: null` cannot distinguish "still coming" from "never coming" —
both look identical on the wire, and a resume redraw deliberately sends the
second kind (replaying a clip the learner already heard reads as a
stutter, so no `turn_audio` follows it at all). Closed by naming the
difference explicitly: the `turn` frame now carries `audioPending`, true
on ordinary delivery and false on a resume redraw, and the client clears it
the moment a matching `turn_audio` arrives (or never has to wait, on a
redraw). `useHandsFreeTurn` gained this as a fourth blocking condition
alongside `speaking`/`awaitingReply`/`enabled` — a learner who explicitly
interrupts the tutor still overrides it, the same way an interrupt already
overrides `speaking`, since someone who has just cut the tutor off is not
waiting on audio nobody is going to hear. Proven with two tests: the mic
stays closed while `audioPending` is true with nothing else blocking it,
and opens the instant it clears WITHOUT waiting for a new turn — both
confirmed to fail against the pre-fix hook first. The two send sites on the
wire (`oracle/src/ws/server.ts`) are each covered by a `live-session.test.ts`
assertion: ordinary delivery always says `audioPending: true`, a resume
redraw always says `false`.

**Push-to-talk during `'thinking'` was a dead end nobody could see —
closed in the same round, MEDIUM.** `MicOrb.tsx`'s hold gate excluded only
`'unavailable'`; `'thinking'` (a reply already being produced) passed it,
so holding the orb ran the full ritual — sound, haptics, ducked ambience, a
live meter — and sent a clip on release. Unlike `'speaking'`, which calls
`onInterrupt` and has its own test, nothing here tells the server a turn is
being cut short, so `ws/server.ts`'s one-turn-at-a-time claim correctly
refuses the submission (`RATE_LIMITED`) — never a double bill, always a
dead end the child could not tell was dead until after living through it.
Fixed with one added condition in `beginHold` (`state === 'thinking'`
refuses the hold, same as `recording`/`holdingRef.current` already do);
`available` itself is untouched, so the orb keeps its own `'thinking'`
spinner rather than looking broken.

### §4.3 The consent gate

A `kid` cannot open the microphone until a **verified guardian** has granted
explicit, specific consent — specific meaning "voice conversation with the AI
tutor", not a checkbox buried inside a general terms acceptance. Consent is:

- **Blocking.** Not a feature flag, not a default-on setting. No consent, no mic;
  the tutor still works fully, in text-and-choices mode.
- **Revocable, and revocation takes effect ON THE NEXT TURN** — the promise this
  bullet has always made, and as of 2026-08-23 the one the code keeps. While a
  minor's microphone is actually open the session re-checks consent **every
  turn** (`CONSENT_RECHECK_MINOR_MIC_TURNS`, `oracle/src/ws/server.ts`); every
  other session keeps the cheaper five-turn poll, because a typed session has no
  microphone to close. *For two days the poll was every fifth turn on all
  sessions, so a guardian who revoked mid-conversation could leave the child's
  microphone live for four more — while this bullet, §14 and a TICKED §16 item
  all said next-turn.* The cost of keeping the promise is one internal call per
  turn on exactly the sessions where a child is speaking to a third party, which
  is the one place in this product where that is obviously worth paying for.
  Pinned by `hardening.test.ts`, confirmed to fail against the old interval.

  **The recheck ran on the right cadence but the wrong side of the paid
  call — found by adversarial review, 2026-08-30 (HIGH).** The fix above
  closed how many EXTRA turns could leak after a revocation (four → zero);
  it did not close the CURRENT turn's leak, because the fresh check lived
  only inside `handleLearnerTurn`, which for a microphone turn runs only
  AFTER `transcribe()` has already shipped that turn's audio to the STT
  provider. No recheck cadence, however tight, can retroactively un-send
  audio that already left — this was not a rare race, it fired on EVERY
  microphone turn, deterministically, the instant a guardian revoked
  during it. Fixed by moving the fresh check into `handleAudioClip`
  itself, before `transcribe()` is ever called (`dueForMicConsentRecheck`/
  `refreshMicConsent`); `handleLearnerTurn`'s own check is now skipped for
  a turn that already passed it (`micConsentAlreadyChecked`), so a
  microphone turn costs exactly one consent round trip, not two. A residual
  race remains — consent revoked WHILE `transcribe()`'s own network call is
  in flight — but that window is now bounded by one STT round trip rather
  than an entire session's worth of turns, and closing it further would
  mean cancelling an in-flight third-party call in real time, out of scope
  for this fix.
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

**The revoke sent to Core is real; the browser's own indicator did not
agree — found by adversarial review, 2026-08-30 (MEDIUM), the frontend
half of the HIGH backend finding just above.** `useMicrophone.ts`'s
`stop()` deliberately keeps the browser's `MediaStream` warm between
holds — a repeated push-to-talk press should not re-prompt for the
microphone — and `release()`, the only function that actually stops the
hardware tracks, ran only on unmount. But a guardian's one-press revoke
flips `enabled` false in the SAME `TutorExperience` component instance,
because the tutor deliberately keeps running in text-and-choices mode
rather than unmounting — so the browser's own mic-in-use indicator stayed
lit for the rest of the conversation even though `start()` already
refused any new recording and no audio was ever captured or sent after
the revoke. No data leaked; a guardian who presses "off" and trusts their
own browser's indicator deserves that indicator to actually go dark.
Fixed with a second effect in `useMicrophone` that calls `release()`
whenever `enabled` transitions to false, not only on unmount.

---

## §5 Prompt injection — the defense, layer by layer

Decision 3 means a minor's speech reaches a model and that model's output
reaches a minor. The learner's transcript is **untrusted input**. So is anything
retrieved. The layers are ordered by how much they contain, not by how clever
they are.

1. **Closed structured output.** The model never emits prose that is rendered as
   given. It emits JSON against a strict schema:
   `{ say, emotion: <7>, action: <12>, next: 'ask' | 'segment' | 'close',
   segmentRequest?: { skillKey, difficulty, framing, rationale },
   offerAdaptation?: <5> }`. There are TWO free-text fields, not one — `say`
   and `segmentRequest.framing` — and both are moderated in a single call
   (`orchestrator.ts`). This line said `segmentRef?` until 2026-08-23, which
   hid the second one; `framing` reached children's screens unmoderated for
   five days partly because every document drew the schema without it.
   **A new free-text field here must join that moderation call before it ships.**
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

> **Three defects in this stack, found by one adversarial code review,
> 2026-08-29, and closed the same day — each proven with a throwaway test
> against the real function before being trusted.**
>
> **CRITICAL — layer 4 had a second, unguarded door.** `classifyLearnerInput`
> is called from exactly one place in the whole service: `handleLearnerText`.
> A spoken answer to an open checkable segment is routed through a DIFFERENT
> function, `handleVoiceCheckResult` (`ws/server.ts` sends both typed and
> voice-transcribed utterances there when a checkable segment is open,
> bypassing `handleLearnerText` entirely) — and that function fenced the
> utterance but never classified it, going straight to a model call. A
> self-harm disclosure or a volunteered phone number said OUT LOUD while
> answering an activity reached the model verbatim and got a model-generated
> reply instead of the scripted safety response, with no guardian-visible flag
> and no session stop. Fixed by adding the identical classify-before-fence gate
> `handleLearnerText` already had, at the top of `handleVoiceCheckResult`.
>
> **CRITICAL — layer 4 itself matched RAW text, on the UNIVERSAL path.**
> `classifyLearnerInput` did `text.normalize('NFC')` and nothing else before
> running its regexes; `stripInvisible` (this file's own layer-2 fence, which
> strips zero-width/bidi/control codepoints) runs strictly AFTER classification,
> inside `fenceUntrusted`. A single zero-width space planted inside a trigger
> word — a one-paste evasion — broke every regex's word-boundary match, on
> EVERY learner turn, while the fenced text reaching the model was fully
> reconstructed and legible: state computed for one purpose (the cleaned text
> the model actually sees) was never available to the component supposed to
> gate on it. A test already existed proving `stripInvisible` neutralizes this
> exact obfuscation — it just never called `classifyLearnerInput` to check the
> classifier used it too. Fixed by classifying `stripInvisible(text)` instead
> of the raw string.
>
> **HIGH — a third, independent door into the model, for real minors.**
> `runPlacementIntake` (course placement, ages 12+) fences the learner's free
> text and sends it straight to the model; the only safety gate anywhere in
> the function ran on the model's REPLY, never on what the learner said. Fixed
> by classifying `input.learnerText` before the model call, landing on the
> same neutral-fallback path every other refusal reason in that function
> already uses.
>
> **LOW, closed as part of the same class:** output-side deterministic
> moderation (`deterministicModeration`) had the identical raw-text gap on the
> nonce-echo, prompt-leak and contact-detail checks — lower severity because it
> requires the MODEL to emit or echo an invisible character, and the semantic
> judge pass still runs afterward for every minor session regardless. Fixed the
> same way: strip before matching.
>
> All four share the session's recurring shape — a rule enforced in one place
> and silently absent from an adjacent one — and none was hypothetical: each
> was reproduced with a real call against the real function, not reasoned
> about. See `RUNBOOK.md` for the full incident writeup.

> **CRITICAL, found live testing as the mandated struggling-learner persona,
> 2026-09-01: layer 4's `self_harm` rule only matched an EXPLICIT act.** A
> real, commonly-cited passive ideation phrase — "a veces quiero desaparecer
> y que nadie me extrañe" ("sometimes I want to disappear and I wish nobody
> would miss me") — reached the model twice, on two separate real runs, with
> two different (both unacceptable) outcomes: once the output judge blocked
> the reply but fell back to the generic `MODERATION_BLOCKED` line instead of
> the hand-written safety response (see §6 below), and once the judge ALLOWED
> a reply that acknowledged the disclosure and then pivoted straight to a
> coin-counting problem — proving the output judge is not a reliable backstop
> for this category at all, since it only catches a reply that ITSELF
> references the disclosure unsafely, never "the model failed to take a
> disclosure seriously." Layer 4 is the ONE layer designed to guarantee
> every-time coverage, and its eight `self_harm` patterns all named an
> explicit act (die, kill/hurt/cut myself, suicide/suicidal, matarme,
> morirme) — nothing for the indirect, passive phrasing this exact real
> message used. Fixed by adding six new patterns across all three locales in
> the same rule (`want/wish... disappear`, `nobody would miss me`; `quiero
> desaparecer`, `nadie me extrañe(ría)`; `quero desaparecer`, `ninguém
> sentiria... falta`), deliberately loose per this file's own already-written
> design rule for this category: a false positive costs a scripted, kind
> reply; a false negative costs a generated reply to a child in distress —
> not comparable, so the threshold is not set in the middle. Ratcheted into
> `safety/canary.ts`'s `INPUT_CANARIES` (`self-harm-indirect-en/es/pt`, the
> es-MX one carrying the exact real phrase) so this specific gap cannot
> silently reopen. See `RUNBOOK.md` Round 139.

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

> **Fixed 2026-08-30 (adversarial review, CRITICAL): a judge response with no
> interpretable verdict was silently treated as ALLOWED.** `modelModeration`
> (`oracle/src/safety/moderation.ts`) parses the judge's JSON reply and reads
> `parsed.safe`/`parsed.category`. A reply that is valid JSON but omits
> `safe` entirely — `{}`, or a field-name mismatch like `{"result": true}`, a
> known and ordinary LLM failure mode against a `max_tokens: 120` budget —
> is the SAME epistemic state as no response at all (a timeout, an
> unconfigured judge), which this file's own rule already covers: "a
> moderation service that does not answer means the turn is not spoken." But
> the code fell into the branch built for a DIFFERENT case — a real opinion
> that named no recognised harm (2026-08-29's "refusal must name a harm"
> fix) — and returned `{ allowed: true }`, bypassing `requireModelPass`
> entirely for exactly the malformed-response shape the fail-closed rule
> exists to cover. Fixed by checking `typeof parsed.safe === 'boolean'`
> first: anything else now throws, routing it through the same
> retry-then-fail-closed-for-a-minor path a timeout already takes, rather
> than through the "opinion with no harm named" path. See `RUNBOOK.md`.

Moderation failure is **fail-closed**: a moderation service that does not answer
means the turn is not spoken. A safe scripted line covers the gap.

> **Fixed 2026-08-30 (adversarial review, MEDIUM): "is this a minor's session"
> was answered from the FIRST connection, on a session that had since been
> resumed.** Everything above turns on `requireModelPass`, and its only input
> is the session's `isMinor`. A dropped socket parks the orchestrator and a
> resume re-attaches the SAME instance (§ the resume grace window), whose
> `session` is set once at construction and never reassigned — so this gate
> kept using whatever the first connection fetched, for the whole grace window
> and indefinitely across repeated parks and resumes, while every gate around
> it on that same reconnect (the door's moderation-readiness refusal, the
> microphone gate, §4.3's per-turn consent recheck) already used a freshly
> re-verified value. Fixed by giving the orchestrator one explicit live slot
> for this single field, refreshed from the resume's own fetched context;
> every other field stays deliberately pinned to the original connection,
> because an in-flight lesson plan and the tier the vocabulary gate judges
> against must not change under a conversation already in progress. See
> `RUNBOOK.md` Round 77.

> **Found live, testing as a struggling learner, 2026-08-30 (MEDIUM): the
> `contact_detail` deterministic check blocked ordinary teaching content in a
> tutor whose entire subject is numbers.** `deterministicModeration`'s phone
> pattern was `\b\+?\d[\d\s().-]{8,}\b` — any 9+ characters of
> digits/spaces/parens/dots/hyphens — which matched a real, live tutor
> reply teaching change-making by counting up ("Empiezas en 6 y vas
> sumando: 6 7 8 9 10") and a countdown ("Contamos hacia atrás: 10 9 8 7 6
> 5 4 3 2 1"), both blocked and replaced with a generic "let me say that
> differently" scripted line — a real teaching moment lost to a false
> positive, not a genuine contact-detail leak. A real phone number's digits
> are GROUPED (an area code, an exchange, a line number, each 2-4 digits);
> a spoken counting sequence or price breakdown is a run of ISOLATED
> single- or double-digit numbers, and this tutor's own tier rules keep
> every number under 100 — a bare 3+ digit group essentially never appears
> in legitimate content at all. Fixed by requiring the phone-shaped
> pattern to have three groups (the middle and last each 3-4 digits), which
> is what a real phone number looks like and a counting sequence never
> does. Ratcheted into `safety/canary.ts`'s `BENIGN_OUTPUT` corpus with the
> exact two sentences a real `tutor:converse` run produced and had
> blocked, alongside the pre-existing `emits-phone` canary (still
> correctly blocked) confirming the narrower pattern lost no real
> detection.

> **Confirmed MEDIUM, adversarial review sweep tutor-review-sweep-101
> (moderation-edge-cases dimension), 2026-08-31: the output judge evaluated
> every candidate turn in COMPLETE ISOLATION from the conversation.** No
> prior turns were ever sent to `modelModeration`. Harm that only becomes
> apparent from the SEQUENCE of turns — a multi-turn "crescendo", where no
> single turn looks unsafe alone but the trajectory across several does —
> was structurally invisible to both the per-utterance input classifier
> (`safety/classifier.ts`, also judged one utterance at a time) and this
> per-turn, context-free output judge.
>
> **Investigated, and scoped deliberately rather than over-built (full
> reasoning in `RUNBOOK.md` Round 104).** A full transcript on every judge
> call, or a separate periodic trajectory-level check across a session,
> would each answer a broader, adversarial multi-party jailbreak threat —
> not the realistic one this product actually has. This tutor's content is
> the PEDAGOGICAL MODEL's own generated text on a narrow subject (financial
> literacy for children); a self-harm or grooming disclosure from the
> LEARNER is already caught turn-by-turn by the input classifier regardless
> of trajectory (its rules stop the session on the first matching
> utterance, sequence or not), and the plausible drift here is the model's
> own output wandering across a few turns toward a harm category, which a
> SHORT look-back already covers.
>
> Fixed by adding `ModerationInput.recentTutorLines` — a bounded window of
> the tutor's own last few already-spoken lines (the SAME lines
> `orchestrator.ts`'s existing `recentTutorLines` getter already exposes for
> the generator's "do not repeat this" hint), handed to the judge on the
> SAME call it already makes every turn. No extra round trip; a few hundred
> extra input tokens only once there is history to show, and byte-identical
> to the pre-fix request on a session's first turn or any caller that omits
> the field. Deliberately NEVER the learner's own words: those are
> untrusted input with nothing to fence them inside a judge prompt, the same
> reasoning that keeps them out of the generator's own authoring brief.
> `content/generate.ts` (one independently-generated activity, not a
> conversational sequence) and `tutor/placementIntake.ts` (explicitly
> stateless, one call, "no history" by design per its own header comment)
> are unaffected — there is no trajectory for either of them to have.

> **CRITICAL, same live session as §5's indirect self-harm finding,
> 2026-09-01: the output-blocked path could not tell "the judge named a real
> harm" from "the judge merely disliked the teaching."** Both took the exact
> same generic `MODERATION_BLOCKED` line ("let me say that a different way")
> — correct for the second case, wrong for the first: a self-harm disclosure
> the judge correctly flagged got a reply that reads to a child as the tutor
> refusing to answer them, instead of the hand-written, safety-first line
> (validates the disclosure, names a trusted adult, ends the session) that
> already existed and was already used correctly on the INPUT-classifier
> path. Fixed by giving `ModerationVerdict`'s blocked variant a `category`
> field, populated from the judge's own already-validated harm category
> (previously computed and discarded into a free-text `detail` string), and
> having the orchestrator's output-blocked branch check it: `category ===
> 'self_harm'` now routes to the same scripted safety response and sets the
> same session-ending flag the input path uses; the `closeReason` computation
> was reordered to check for that flag FIRST, so the session correctly closes
> as `'safety_stop'` rather than the generic `'completed'` a child was told
> to leave because of something serious. Every other judge-named category
> keeps today's generic behavior on purpose — none has a hand-written line,
> and inventing one on an unverified guess costs more than none. See
> `RUNBOOK.md` Round 139.
>
> **And the correct close reason still showed a child the WRONG GOODBYE, for
> two days, because two paths race and only one carried the fact
> (found live 2026-09-02, playing a low-retention learner; HIGH).** Everything
> above worked: `close_reason: 'safety_stop'` was computed, persisted, and
> flagged. `ClosingInWorld` has had a `safety_stop` branch since round 33 —
> calmer wording, "Aquí nos detuvimos / Ve a buscar a esa persona adulta
> ahora" — with its own passing test. The child was shown "¡Nos vemos pronto!
> Guardada. Puedes escucharla cuando quieras." anyway, seconds after being
> told to go find a trusted adult.
>
> The mechanism is worth keeping because nothing in it was broken.
> `ws/server.ts`'s `finish()` sends `{type:'closed', reason}` and then
> IMMEDIATELY calls `socket.close(code, reason)`. `TutorExperience` enters the
> closing phase on `closedReason !== null` **or** `connection === 'closed'` —
> either one, deliberately, so a dropped socket still reaches a goodbye rather
> than hanging. So when the close beat the frame, the phase flipped with
> `closedReason` still null and the safety branch was simply never reached.
> Two racing paths, one carrying the reason, and the UI keyed on whichever
> arrived first.
>
> Closed by reading the reason off the CLOSE EVENT as a fallback
> (`useTutorSocket.ts`'s `onclose`): the server already passes the same string
> as `close()`'s second argument, so it needed no protocol change, and
> `prev ?? …` keeps a frame that did arrive authoritative. Pinned by two tests
> in `useTutorSocket.test.ts`, the first confirmed to fail against the pre-fix
> code with `expected null to be 'safety_stop'`.
>
> **The general lesson, and it is the expensive half:** a branch that is
> correct, tested, and never reached is indistinguishable from one that does
> not exist — and every unit test in the repo agreed the branch worked, because
> each one supplied the input the branch needed. Only a live session, where the
> race is real, could tell the difference.
>
> **Confirmed live, 2026-09-01, continuing standing mandate testing past
> Round 139: the fail-closed policy for a MINOR holds even when the failure
> is the judge's own unavailability, not a content judgment, exactly as
> designed.** A real turn's moderation call failed with `{"reason":
> "moderator_unavailable", "detail": "fetch failed"}` — the judge API
> itself unreachable, confirmed via `tutor_turns.moderation`, not a safety
> verdict — and correctly fell back to the generic scripted line rather than
> the model's real (harmless) answer, because `requireModelPass` is
> unconditional for a `kid` session regardless of why no verdict exists (see
> this file's own reasoning a few paragraphs below, and `moderation.ts`'s
> own comment). The very next turn recovered normally with a real model
> reply. Not a defect: a transient third-party outage is not something this
> codebase can fix, and the thing worth verifying — does a minor's session
> degrade safely rather than silently serving unmoderated text — was
> directly confirmed rather than assumed. See `WALKTHROUGH.md`.

**Two latency decisions inside this rule — owner sign-off 2026-08-28.** Both
change WHEN work happens, never what the child can receive unmoderated:

1. **Split delivery.** The turn's TEXT ships the moment moderation passes
   (`turn` frame, `audioUrl: null`); the voice follows in its own `turn_audio`
   frame when synthesis and storage settle. The caption never waits on the
   clip. Proven by `live-session.test.ts` → "acknowledges a learner turn with
   `thinking`, then text, then its own audio frame".
2. **Speculative synthesis.** For a model-authored turn, TTS runs CONCURRENTLY
   with the judge. The clip is delivered only on a pass; on a block it is
   discarded — paid for, counted in the session ledger as `discarded`, and
   referenced by nothing. "Only then spoken" is about the child's ear, and
   that gate is intact: a discarded clip reaches nobody. Proven by
   `orchestrator.test.ts` → "discards the speculative clip of a blocked turn".

The same sign-off added the server-side `thinking` acknowledgement (the wait is
announced by the service doing the waiting, not inferred), the `interrupt`
frame (a learner cutting in aborts the in-flight model call instead of paying
for a reply nobody wants), and the streamed audio upload
(`learner_audio_begin`/`_chunk`/`_commit` — the clip uploads while the button
is still held, under the same total ceiling as the whole-clip frame).

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
| Moderation | §6, same as speech. **Corrected 2026-08-30 — this row asserted a control that did not exist.** An adversarial review found `generateSegment` never called `deterministicModeration`/`moderateTutorOutput` on a candidate's `prompt_md`/`explanation_md`/`payload` text at all — only the quality judge above ran, and its rubric has one loose bullet about "anything unsuitable for a child" among eight correctness/pedagogy criteria, not the closed harm-category vocabulary §6 enforces everywhere else. A candidate with, for example, an embedded contact detail in its explanation would pass the quality judge cleanly and reach a minor unmoderated. Fixed the same day: `generateSegment` now moderates every learner-visible string (never the answer key) after the quality judge passes, using the identical gate every spoken turn goes through, `requireModelPass` tied to the session's `isMinor`. See `RUNBOOK.md`. |
| Injection fencing on the AUTHOR PROMPT | Every string the turn model wrote — `framing`, `rationale`, `recentTutorLines` — reaches `generate.ts`'s brief inside `fenceUntrusted`, never interpolated raw. **Found incomplete by adversarial review, 2026-08-30 (HIGH): `skillKey` was missing.** It comes from the SAME turn-schema field (`segmentRequest.skillKey`, no format constraint) as `framing`/`rationale`, reached the author prompt at the SAME trust level as the fixed system-authored lines, and turn-level moderation never inspects it — so a model that kept `say` innocuous could carry an injection payload in `skillKey` straight past moderation and into this prompt with full instruction-level trust. This is the one content surface §1.9's Tutor carve-out exempts from human publication specifically because fencing is one of the compensating controls standing in for the human reviewer — a gap here is a hole in that control, not an independent, lower-stakes miss. Fixed by moving `skillKey` inside the same fenced block as `framing`/`rationale`. |
| Provenance | Every live segment is stored with `origin='live'`, its full generation record, and the session it was born in. A defect found later must be traceable to every learner who saw it. |
| Post-hoc sampling | **HALF BUILT, and the half that is missing is the human.** A fraction of live segments IS sampled and flagged — `backend/src/routes/tutor.ts` sets `review_status: 'pending'`, persisted with a partial index (migration `0047`). **Nothing reads it.** No Core query filters on it and `/admin/content` reviews lessons, not tutor segments, so every sampled segment is marked pending and seen by nobody. Corrected 2026-08-23: this row asserted a control that does not exist. It is the one guard in this table that is not real, and unlike the other seven it cannot be made real by code alone — it needs a queue AND somebody who reads it. Tracked in §15.2. |

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
>
> **A third, found 2026-08-29 by an adversarial code review: `fill_blank`'s key
> re-execution is SELF-referential.** `submissionFromKey` builds the "learner"
> submission directly out of `answer.gaps` (its `bank_id`, or its
> `accept[0]`), so re-running it against the same key always scores 100 no
> matter what that gaps entry contains — it proves the key agrees with itself,
> never that it agrees with what the learner is actually shown. A key can be
> internally consistent and still be unanswerable: a gap number with no
> matching `{{N}}` marker anywhere in the payload's own `text_md`, or a
> `bank_id` naming a token absent from the payload's own `bank`. Both were
> reported `ok: true, keyVerified: true` — fully verified and payable — before
> a CONTENT check was added (`verifyGeneratedSegment`,
> `backend/src/services/tutorLadder.ts`) that ties the key back to the payload
> directly, because re-execution structurally cannot catch this class: it never
> reads `text_md` or `bank` at all. **Root cause, also fixed:** the
> generation prompt (`AUTHOR_SYSTEM`, `oracle/src/content/generate.ts`)
> documented the payload/answer shape for only 4 of the 12 allowlisted types
> (`quiz_mcq`, `number_input`, `true_false`, `order_steps`) — `fill_blank`'s
> exact shape, including the `{{N}}` marker convention and the `typed`/`bank`
> split, was never told to the model at all, which is exactly the condition
> under which a model invents a shape and produces a self-consistent-but-wrong
> key.

**A generation that fails any guard produces nothing.** §1.14 applies directly:
emit NOTHING rather than something generic, because a confident wrong
explanation misleads where an absent one merely omits. The tutor falls back to
tier 1 and says so honestly.

**And the whole ladder is entered a BOUNDED number of times per learner
utterance.** When every rung misses, the tutor teaches the idea by hand instead
of stopping — an ordinary system-prompted recovery turn, which is a model call
like any other and can therefore ask for an activity of its own, which re-enters
the ladder. `ws/server.ts`'s `deliver()`/`serveSegment()` recursion had no guard
until round 76 (2026-08-30, HIGH): a single learner utterance produced **20**
ladder requests, each one a model completion, a judge completion, a Core round
trip and — on the `needsGeneration` path — paid author calls. Nothing in the
product stopped it (the run ended well short of `SESSION_MAX_TURNS`, on an
artifact of the test harness), so the real ceiling was the whole session turn
cap. `MAX_SEGMENT_RETRIES = 1` now caps it at one retry per utterance, refused
in `deliver()` before the request costs anything. The
recovery turn itself is unaffected and still reaches the learner; only the ask
behind it is declined, and `handleSegmentUnavailable`'s `lastAttempt` flag tells
the model to stay in conversation rather than promise an activity that will not
arrive. This bounds repeated FAILURES within one utterance and nothing else —
the ladder's own internal rungs (§7.1→§7.3, the prerequisite walk and the
frontier fallback) all live inside a single request and are untouched. See
`RUNBOOK.md` Round 76.

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

> **§9.1–§9.5 were rewritten 2026-08-21 for in-scene composition.** They
> previously described a page of panels arranged around a small stage, which is
> what got built and what the owner rejected. The lifecycle itself did not
> change; where it happens did. The screen recipe these sections must agree
> with is `DESIGN.md` → §Screen Recipes → **Tutor**, and on conflict that
> recipe wins.

### §9.1 Open
**The scene mounts FIRST and stays mounted for the whole route.** It is the
background of every phase — loading, personalize, introduce, converse, adapt,
close, replay — and it is never unmounted between them. This is a hard rule
rather than an optimisation: remounting reloads the island through a Suspense
fallback, so a learner watching their own world blink at every phase boundary
learns that the place is not real. It also means the very first frame must
already be the returning learner's remembered island, character AND backdrop,
because preferences arrive with the token bootstrap; watching a default island
turn into yours is worse than never seeing the default.

Personalization loads (or the picker runs, first time only — and it runs IN
the scene, §10). **`onReady` must fire before the first line** — speech handed
over while assets are still resolving plays audio at a blank canvas.

The pre-session state is the live island with **one** control on it. Nothing
before the first press requires reading beyond one line (§1 step 2).

### §9.2 Introduce and offer
The camera moves to `closeup` (or `closeup-wide`, §2.2) on the tutor. The
greeting is spoken and captioned above their head, and **the offers appear in
the scene, after the greeting, as chips at the tutor's chest** — staggered on
the standard reveal cadence, spoken by the tutor as they arrive.

They are not a grid of cards with a title, a body paragraph and a button whose
label repeats its own title. §1 step 2 already says "Begin — one button;
nothing before it requires reading"; a five-card reading exercise placed
immediately after that button contradicts it. A chip carries one short line and
is pickable both as a mesh and as its guaranteed DOM twin.

**The greeting is WRITTEN, and it does not say the name** (corrected
2026-08-22; this used to read "the tutor greets by nickname"). It is one of
twelve human-written per-character, per-locale lines whose audio is
pre-generated once, which is what makes the opening free and instant — see
§15.1. The learner's nickname is composed into the CAPTION by the client, so
the greeting is still personal on screen while the audio stays shareable
between every learner who hears it. A name baked into the clip would mean one
paid synthesis per child per session, forever, which is exactly what §15.1
removed.

**And that caption is ONE sentence, not three** (2026-08-22, the simplification
pass). It used to be hello, plus a note about how little the tutor knows yet,
plus "What would you like to look at together today?" — asked immediately above
four chips that ARE that question and are answered by tapping one. A line of
instructional text beside a control that already says the same thing is noise,
so `tutor.introduce.ask` is deleted and the chips are the ask. The cold-start
admission below survives, in six words instead of nineteen: what a child needs
is the fact that the tutor has not met them yet, not an account of why.

The tutor then offers a closed set:

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
One scene. The camera holds the character; their speech is captioned above
their head, and the 2D head articulating beside those words in the same caption
plate is, for `liruf` and `dina`, the only working articulation channel (§2.2).
The sentence is printed once: the lesson plate below carries the activity and
the conversation record and never a second copy of the live line
(/DESIGN.md §Lumen -> *One line, one printing, two channels*). The Lesson Engine
runs on the same surface as the conversation — **at 1280 px a docked
full-height Lumen panel on the right** (owner sign-off 2026-08-28, superseding
the floating corner plate this section previously specified, which the owner
rejected on use: the conversation had no stable home and the screen read as
disorganised) holding the activity, the full conversation log, the composer,
"explain it another way", start-over and finish in one ordered column; **at
375 px a three-detent bottom sheet**, unchanged. The panel is translucent
material over a full-bleed canvas, never an opaque slab, and the island keeps
roughly two thirds of the width — which is what separates it from the
2026-08-21 rejected split. The camera composes around the panel's published
rect, so the character's on-screen height is the same with a segment and
without one; a lesson that visibly shoves the tutor aside to make room for
itself reads as two products sharing a screen.

The tutor reacts to the actual result of each segment — that is what makes it a
lesson rather than a playlist.

Three things this section previously left unsaid, each of which turned out to
matter:

- **THINKING is a state and needs a performance.** Between the learner
  releasing the microphone and the tutor speaking there is a generate, a
  moderate and a synthesize (§6) — most of the latency budget, and the design
  described no behaviour for it at all, so the stage simply sat still. The
  tutor plays `think` with the `thinking` emotion, the camera eases very
  slightly wider, and the control shows work in progress. Silence with no
  posture reads as a broken product, not as thought.
- **`segmentRequest.framing` is shown to the learner.** It is defined as *"a
  short, learner-facing framing for the activity, moderated like `say`"*
  (`oracle/src/tutor/turnSchema.ts`) — up to 240 characters of moderated prose,
  and it is the tutor's own sentence introducing every activity. It was carried
  over the wire, stored by the client, and rendered nowhere. It is the lead-in
  line above the segment prompt.
- **A live segment suppresses ambient camera drift** on every quality tier.
  Reading a maths problem while the frame breathes is nausea, not atmosphere
  (DESIGN.md §Motion).

### §9.4 Adapt
Per §11. The tutor may notice friction and **offer** a different explanation.
It is not a card that pushes the conversation down the page — because the moment
is a question being asked by a character, and it should look like one. What says
so is the **camera**: the shot swings to a `two-shot` while an offer is pending,
so both characters are in frame while the question is up.

**The offer is mounted EXACTLY ONCE, on the viewport-anchored control cluster**
(corrected 2026-08-21, the second time this was measured in a browser). This
paragraph used to say the offer was *two chips floating in the scene between
tutor and companion*, in addition to the guaranteed twin below — the WorldChip
grammar, applied to a question. That grammar does not transfer, and the
difference is the whole reason this correction exists: a WorldChip pairs a DOM
control with a **pickable mesh**, so the learner meets ONE offer reachable two
ways. Two DOM copies are two offers. Driven on the real stage, the anchored copy
read "Would another example h" — clipped, at (-42, 105, 263, 57) on a 375x812
phone — with its own live "Yes please" at (-2, 170); at 1280x800 the same pair
escaped off the TOP instead, "Yes" landing at (40, -13). A half-read question
with a working Yes button beside a whole one is worse than either arrangement
alone, because a child can press the half-read one. **The rule this settles: an
offer the learner must be able to answer is mounted once, and it is mounted in
the band that cannot be culled.**

**The offer is answerable on every device, in every configuration, whether or
not a world point is on screen** (added 2026-08-21, after review). The floating
chips are the delightful path and they are allowed to disappear: an anchored
node is hidden AND inert the moment its point leaves the frame, which is
correct. What was not correct was that they were the ONLY path. The question and
the two answers sat on three SEPARATE marks, culled independently, so on a phone
in the default single-character configuration the placement solver's chosen
bearing decided whether the learner saw the whole question, a lone "Yes please"
with nothing to say yes to, or nothing at all. The tutor was asking a question
the child could not answer. Two rules follow, and both are invariants:

- **The question and both answers are one group**, never three controls that can
  be culled or clipped independently. A "Yes" whose "No" has gone is worse than
  neither, because it is a control a child can press without knowing what it
  agrees to.
- **That group rides the viewport-anchored control cluster**, beside the
  microphone, always, and there is no second copy of it anywhere. It is not a
  fallback that appears when something fails: nothing on the client can tell
  whether an anchor projects, and a guarantee conditioned on a camera is not a
  guarantee. The announcement (`role="status"`) belongs to it, and with only one
  copy on screen there is nothing left that could make a screen reader say the
  question twice.

### §9.5 Close kindly
**The close is a camera move and a performance, not a screen.** Soft close at
~15 minutes: the tutor begins wrapping up in character, finishes the current
segment, then waves and bows on the island while the camera pulls back to the
establishing shot over ~2.4 s and the lighting lerps one notch warmer,
whichever backdrop is set. Three recap chips anchor to three points on the
island — minutes, XP, what we practised — and the invitation to come back is
spoken. Hard stop at 25 minutes gets the IDENTICAL performance, because it is
already a first-class `next: 'close'` turn rather than a timeout.

**Nothing here is modal, and nothing here is a centred card on an empty page.**
A session that ends by replacing the world with a summary box takes away the
place the learner was just in, at the exact moment the product is trying to
give them a reason to return.

Ending is a first-class turn (`next: 'close'`), not a timeout that kills a
socket.

---

## §10 Personalization

**Personalization is not a settings screen. It is the learner making the place
theirs, in the place itself** — every axis below is picked by touching the
thing it changes, and the change is visible on the live island under your
finger. That is the whole reason this section exists near the top of the flow
instead of inside a profile page.

| Choice | Options today | Picked by | Notes |
|---|---|---|---|
| Speaking tutor | `rho`, `zara`, `liruf`, `dina` | tapping the character on the island | Decision 4; framing differs (§2.2). |
| Companion | any other character, or none | tapping a character again to send them to the companion slot | The stage already supports one companion. |
| Diorama | `diorama-a`, `diorama-b` | tapping an island rim pad — the island actually becomes the other island | Catalog-driven; grows without code. |
| Backdrop | `auto`, `dawn`, `day`, `dusk`, `night` | tapping ONE sun marker on the overhead arc, which moves the sun on to the next light | Rewritten 2026-08-22 — see below. Light AND dark must both work. |
| Nickname | learner-chosen, validated, moderated | a text field on a glass plate | The **only** name-shaped value that reaches the model (§4.1). A text input cannot be in-world; this and the two adaptation toggles are the only exceptions. |
| Adaptation | §11 | toggles on the same plate | |

**The candidates have to BE THERE, and that is what "tapping the character"
means** (added 2026-08-21, after a review). The first build of the in-world
picker hung a name plate at each of the stage marks and left the scene rendering
only the tutor and their companion, so two of the four plates named empty
ground: a menu laid out in world coordinates, which is the same failure as a
thumbnail grid with better lighting. The whole cast now stands on the island for
the duration of this phase, each plate rides the crown of the person it names,
and a candidate the placement solver cannot seat publishes no anchor at all — so
their plate is hidden AND inert rather than pointing at nobody, and the list on
the plate is where they stay reachable. What it costs and what the scene turns
off to afford it: `/TUTOR_3D.md` §9.5.

**ONE SUN, NOT FOUR LABELS** (2026-08-22, replacing "dragging a sun marker along
a fixed overhead arc with five stops"). Four labelled stops were built and
measured, and they were four of the twelve surfaces on this phase at 375x812 —
in blank sky, above an island painting 12% of the viewport, and mostly busy
rising off one another, because every sky mark sits at the same height on one
circle and an arc seen edge-on is a point. Worse, `auto` had no place on the
arc, so "follow my theme" was reached by pressing the LIT stop a second time: an
invisible gesture that needed a sentence in three locales to be findable, and
that did not exist at all at 1280 px, where every sky mark is above the frame.

So there is one marker. It shows the light that is on, its accessible name says
which light pressing it will bring, and `auto` is an ordinary stop on the cycle.
Choosing a specific light directly is what the plate's guaranteed list is for
(it now lists all five), which is the same division of labour every other world
control on this route already has: the world carries the GESTURE, the list
carries the MENU.

**Everything except "start" is revealed on demand.** The one plate is the §10
exception because a text field cannot be in-world; it is not a licence for a
form. Its resting state is a single row — one quiet way in, and the one press
that leaves — and the nickname, the adaptations and the guaranteed list of every
choice open behind it. They open by themselves whenever the island cannot be
shown, because a learner on a device with no WebGL would otherwise have a start
button and an empty screen.

**Every axis previews live, and that is the acceptance test for this section.**
A picker whose result you cannot see is indistinguishable from a picker whose
result does not exist — which is not a hypothetical: it is exactly what
happened to the backdrop (§2.1), where the control, the validation, the column
and two endpoints all worked and the light never changed. A 2D thumbnail grid
of islands has the same failure mode with better graphics, because the
thumbnail is a promise rather than the thing.

Persisted per user in Vault (migration `0047`, RLS, kid rows readable by
verified guardians). A returning learner never re-picks, and their remembered
choices light the FIRST frame (§9.1). Defaults must be good enough that
skipping the picker entirely still produces a good session — personalization is
an invitation, not a toll gate.

**Responsive (§1.11, non-negotiable).** Rewritten wholesale 2026-08-21. This
paragraph previously read: *"the picker is a single column at 375 px and a
deliberate multi-column layout at 1280 px; the conversation view's left/right
split stacks on mobile with the stage above and the lesson below."* That single
sentence is where "personalization is KEY" became a responsive FORM and where
the conversation became two panels — it specified the rejected layout in this
document, in advance, and whoever built it was following the spec.

What replaces it: **the stage is the page at every width** (`fixed inset-0`,
DESIGN.md → §Screen Recipes → Tutor). There is no picker column and no
left/right split to stack, because there are no panels to lay out. What changes
between breakpoints is the composition inside one frame:

- **375 px** — the mic orb at 96 px on the bottom safe area with the composer
  beside it rather than under it, the lesson plate as a bottom sheet **resting
  at PEEK** and raised to HALF / FULL only by the learner, the camera composing
  the character into the free band above the sheet, and every in-scene control
  clearing a 44 px tap target by construction rather than by luck. An arriving
  activity is announced on the sheet's own row and never raises it: measured at
  375x812, a sheet that opened itself to HALF left 227 px of island, which is
  the "minimizaste el escenario" complaint in portrait.
- **1280 px** — a wider establishing shot with real island beside the docked
  conversation panel (`min(27.5rem, 34vw)` on the right — owner sign-off
  2026-08-28). The extra width is spent on the SCENE and on giving the
  conversation one ordered, permanent home. It is never left as margin, and
  the panel is Lumen material over the canvas, never an opaque second page.

Both widths, both themes, verified in-browser with screenshots before any of
this is done — and per the standing instruction on this project, the 1280 px
frame with a live segment is looked at by a human before the rest is built,
because that is the frame that decides whether the plate reads as floating or
as the panel that was rejected.

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

**The offer must stand ALONE in its turn — found live, 2026-08-29.** The
frontend deliberately hides the typing box while an offer is open ("both
answers are already on screen" — a reviewed decision, `ConversationView.tsx`)
and — per §12 — **typing is the ONLY channel for a learner with no voice
provider configured**. A turn observed in a real browser session set
`offerAdaptation` and ALSO asked a brand-new arithmetic question in the same
`say` ("¿te ayudaría otro ejemplo? … si tienes 9 monedas y das 4, ¿cuántas te
quedan?"); a text-only learner had no control that could answer the second
half — only "sí"/"no" to the first. The frontend's invariant is correct and
was left alone; the fix is on the side that was breaking it: the prompt now
tells the model that setting `offerAdaptation` means `say` is the offer and
nothing else, and the next question waits for the accept/decline. Not yet
backed by a deterministic check — a reliable "two questions in one turn"
detector is the harder problem the whiteboard/robot-identity fixes did not
have, so this one is prompt-only until `tutor:converse` or a live session
shows it surviving anyway.

**Now backed by a deterministic check, 2026-09-01 — scoped, not general.**
`asksMultipleQuestions` (`oracle/src/tutor/prompt.ts`) counts sentences in
`say` ending in "?"; two or more is a stacked question. It is deliberately
NOT wired to fire on every turn: `questionAsked` (arithmetic.ts) already
assumes the opposite for ordinary teaching prose, where a corrective
walk-through with a rhetorical sub-question before the real one is normal
and good — a real fixture elsewhere in this codebase for genuine tutor
prose carries two "?"s doing exactly that, and a blanket rule would have
retried it for nothing. `orchestrator.ts` gates the check on
`offerAdaptation` being set — the one turn shape where a second question
truly has no answerer, because the frontend hides the typing box while the
offer is open. `offerStackedQuestion` joins `repairableIsFalseVerdict`, the
SAME repair-loop bucket false praise, a false correction, forbidden
vocabulary, language drift, a self-contradicting number and an unkept
promise already occupy, at both the sites that bucket requires (attempt 0's
own capture, and the retry's result): a first offence earns one corrective
retry, and a turn that still stacks a second question after the retry falls
back to the scripted line rather than being delivered. Proven in
`oracle/src/__tests__/orchestrator.test.ts` against the real turn pair this
section already quotes, plus the scoping boundary itself — the rhetorical-
question fixture above, run with no offer open, is left alone.

**One sentence frame replayed with the numbers swapped — found live testing
as a low-retention learner, 2026-09-02 (`TUTOR_QA_2026-09-02.md` D4,
MEDIUM).** Three consecutive real turns carried the identical frame, tic and
all: "Primero miro cuánto cuesta, porque necesito saber cuánto me falta. 9
menos 7 son 2. ¿Me pasé? A ver: 7 y 2 son 9, sí alcanza." `echoesEarlierTurn`
exists to catch a reworded repeat and reported the session clean. Measured
rather than reasoned about: the word overlap between those turns is **1.0**,
so the similarity test never failed — what exempted them is
`echoesPreviousTurn`'s hard requirement that the NUMBERS be unchanged, `2,7,9`
against `10,4,6`. **That requirement is correct and is unchanged**: the same
method applied to a new problem is good teaching, and a check that punished
it would retry every practice turn in the session. `reusesATemplate` asks the
other question instead — not "is this a new QUESTION?" but "is this a new
SENTENCE?" — and so demands near-total identity of the turn's skeleton
(≥ 0.9 in BOTH directions with every digit stripped, versus the 0.6 the
numbers gate pairs with), plus at least 6 distinct skeleton words so short
drill lines ("si tienes 10 y agregas 5, cuenta…") keep recurring freely. The
two live data points bracket the threshold with margin: 3 distinct skeleton
words in the good-teaching fixture the suite already protects, 9 in the
defect. It joins the `repeated` family — one corrective retry, then delivered
anyway, because a repetitive turn still teaches — with its OWN correction
text, which tells the model to keep the method and change the wording rather
than to "say something new", since the problem genuinely is new.

**The invitation was in the skill catalogue, and that is the half that
mattered.** `oracle/skills/moves/worked-example-think-aloud.md` handed the
model those exact Spanish sentences as its illustrative lines, and
`selectSkill` is a pure function of the current turn with no memory of what
it last returned — so the same script reached the model on every consecutive
WORKED turn. This is the identical class already recorded for the system
prompt's own whiteboard example ("guardas 10 pesos, cada semana te dan 2
más…" appearing verbatim across unrelated conversations); the anti-copy
discipline was never carried across to the skills, where it matters more.
Closed catalogue-wide by `SKILL_WORDING_RULE` (`oracle/src/tutor/skills.ts`),
appended to every body at the single place a body reaches the model, so no
skill file written later can omit it. It redirects rather than forbids — a
body whose procedure the model stopped following would cost more than the
repetition it fixes.

**"Sí alcanza" said over the learner's own shortfall — the arithmetic check
mistaken for the affordability verdict (D5, MEDIUM, same session).** The
activity said "tienes 7 pesos y quieres una paleta que cuesta 9". The tutor
said "9 menos 7 son 2. ¿Me pasé? A ver: 7 y 2 son 9, sí alcanza." It means
the subtraction checks out; a child reads "you can buy it", and cannot. This
is a lesson whose entire subject is telling those two apart, so the one
sentence that had to be right was the one that was wrong. The invitation was
literal — the same skill body's checking line was "¿Me pasé? A ver: 7 y 3
son 10, sí alcanza." — and that file now separates the two explicitly: the
check tells you the arithmetic is right, and whether they can buy it is a
different statement that gets its own words. `contradictsItsOwnShortfall`
(`prompt.ts`) is the deterministic half, and it is deliberately LEXICAL
rather than arithmetic, because the defect itself proves arithmetic cannot
settle it: "9 menos 7 son 2" is the same subtraction whether 9 is the price
(you are 2 short) or the purse (you have 2 left). What does settle it is the
tutor's own word for the gap — a turn that says something is `falta` has
declared a shortfall, and "sí alcanza" in the same breath contradicts it with
no numbers needed. It refuses to judge a conditional ("si ahorras 2 más, sí
te alcanza"), a contrast naming a second cheaper thing, a question, a negated
shortfall, and the unaccented Spanish `si` ("if"), each of which is good
teaching. It joins `repairableIsFalseVerdict`, not the `repeated` family: a
child told they can afford something they cannot has been taught the exact
thing the lesson exists to correct, which is a wrong fact rather than a
clumsy sentence, so a surviving one is replaced by the scripted line. It is
also placed ABOVE the repeat branch in the correction chain, because the live
turn carried both faults at once and the single retry has to be spent on the
one a child would be taught by.

**The product was missing an exemption its own harness had.** Every check in
the `repeated` family fired on a turn that restated its question because the
learner ASKED what the question was — the one case where repeating unchanged
is the correct answer. `scripts/converse.ts` had skipped exactly that since
2026-08-30, with a comment recording the live case; the orchestrator never
did. The `tutor:converse` run of 2026-09-02 showed the cost: the learner
asked "otra vez cual era la pregunta", the restatement was repaired, the
retry hit one of the provider's empty completions, and the child received "Se
me enredaron las ideas un momento" instead of the question — one of only two
canned lines in seven conversations, gone on the following run. Both sides
now share `EXPLICIT_REPEAT_REQUEST`, and the shared list is NARROWER than the
harness's original: the existing suite drives a bare "otra vez" as an
ordinary learner line and went red, correctly — "otra vez" means "give me
another one" as often as "say that again", and a wrong skip costs a skipped
report in the harness but hands a child the same problem twice in the
product. Only phrasings that can only mean "restate what you just said" are
listed, which still covers the live line verbatim.

**And the same run's OTHER canned line had a different cause, which is the one
worth keeping: the repair had never actually run (D7, closed 2026-09-02).** A
turn is allowed two model calls. Attempt 0 came back with a good turn flagged
as a repeat; attempt 1 — the repair — came back one of the provider's empty
completions. The budget was gone, so the repeat branch fired and the child got
"Se me enredaron las ideas un momento. ¿Me lo preguntas otra vez?": no
teaching, and the blame pointed at them.

`model/provider.ts` already states the principle this code was not applying —
"A billable empty completion is a failure, not an answer" — so a call that
produced no answer cannot be evidence that a repair was tried. An unanswered
attempt no longer spends the repair budget. **Nothing else moved:** the repeat
is still never delivered, `repairableIsRepeat` is untouched (it exists since
2026-08-30 for this exact failure mode), and both fallbacks are unchanged. The
repair simply gets to run.

Two things about HOW NARROW it had to be, and an existing test caught each
rather than review doing it. Excluding every unanswered call also let a
fully-down provider be retried to the ceiling instead of twice — doubling cost
and latency on every turn of an outage, the "money leaves directly" case
§1.0 #5 names first; so the extra attempt requires a `repairable` turn already
in hand. And it is narrower still: it is bought only when the fallback would
be the scripted apology (`repeat` / false-verdict). Every other repairable
reason already ends by delivering the clumsy-but-real original, which is a
good outcome, and paying for a third completion to maybe improve it would be
spending on a case that already ends well.

Verified against the real model: `tutor:converse` went from one canned line in
ten turns to **zero** — "nothing a person would notice went wrong" — with four
empty completions still occurring and all absorbed. Pinned by a test confirmed
red against the pre-fix code (`expected 'scripted' to be 'model'`).

**"Never imposed" also means never accepted without an offer — found by
adversarial review, 2026-08-30 (MEDIUM).** `applyAdaptation` (the WS
`adaptation_response` handler's call into the orchestrator) applied whatever
value the client sent, with no check that the tutor's own last turn had
offered it — or offered anything at all. A stray, replayed, or hand-crafted
`adaptation_response` frame could silently steer every subsequent turn, which
is exactly what "offered, never imposed" exists to rule out; it also meant
the SAME acceptance frame, replayed, could re-apply (harmlessly, since the
adaptation is idempotent once active, but for the wrong reason — nothing was
actually checking). The orchestrator now records `lastOfferedAdaptation`
at the one place every model-produced turn funnels through (`produce()`) and
clears it on every scripted turn (`scriptedOutcome()`); `applyAdaptation`
compares the accepted value against it and is a no-op on any mismatch,
consuming the offer on a genuine match so a second acceptance of the same
(now-stale) offer is also refused. `oracle/src/__tests__/orchestrator.test.ts`
covers all three shapes of the defect: nothing was ever offered, the
acceptance names a different adaptation than the one just offered, and a
replayed acceptance after the offer was already consumed.

---

## §12 Persistence, replay and parent visibility

Decision 8.

| Stored | Not stored |
|---|---|
| Transcript of both sides (text) | **The learner's audio** — transits for STT, never persisted |
| The tutor's synthesized audio (Depot, `tutor-speech`) | Any raw provider payload |
| Which segments were served, and their results | |
| Provenance of live-generated segments (§7.3) | |
| The V4 whiteboard (§20.5), exactly as drawn — migration `0058`, added 2026-08-30 after adversarial review, round 35, found it was live-only: the board reached the learner's own screen and nowhere else, so it was invisible to both replay and this very table's own claim below | |

**One clarification added 2026-08-22, because retention and reuse turned out to
be the same question.** The 90-day deletion below covers a child's SESSION
audio, in Depot's `tutor-speech` bucket. It does not cover the closed set of
human-written scripted lines — the greetings, the safety responses, the closes
— which live in `tutor-speech-shared`, are identical for every learner, contain
nothing about anybody, and are pre-generated once (§15.1). Depot is
content-addressed, so a shared clip is a single object thousands of transcripts
point at; deleting it when the first of those sessions expires would protect
nobody and silence every session afterwards. Core's sweep therefore deletes
from `tutor-speech` only, and that is asserted by a test rather than trusted.

**A second clarification added 2026-09-01, because a new place now briefly
holds conversation text.** A dropped session's park record (`ws/parkStore.ts`,
§16) contains the transcript so far and the session's pinned context — first
name/nickname and age band, the same fields §4.1 already permits — written to
OUR OWN Redis so a reconnect landing on another replica can resume the same
lesson. It is not a new destination for a child's data in the sense §1.9 cares
about: it never leaves our infrastructure, it never reaches a third-party API,
and it is not a store anything reads from later. It is deleted the moment it is
adopted (an atomic get-and-delete) or when the parking replica's grace window
closes, and it carries a hard TTL of the resume grace window plus five minutes
— minutes, against the transcript's own 90 days in Postgres. The learner's
AUDIO is not in it and never was.

- **Replay** reconstructs the session: the characters re-act it, the tutor's
  audio plays, the segments are shown alongside how the learner did on them.

  **Built 2026-08-22, and it is a PHASE of the stage rather than a screen over
  it** (`StagePhase = 'replaying'`). It needed no contract change, exactly as
  the 2026-08-21 correction predicted: a stored turn already carries `emotion`,
  `action` and `audio_path`, and Core's replay projection already asks for all
  three.

  - **The same conversation, on the same island.** The character, the companion
    and the diorama come from the session's own row and outrank whatever the
    learner has chosen since — a conversation with Dina on `diorama-b` does not
    become one with Zara Vex because the picker moved. The LIGHT is the
    learner's current preference, because `tutor_sessions` has no backdrop
    column (migration 0047) and guessing a dusk from a timestamp would be a
    confident wrong sky.
  - **The camera does what it did.** The speaking shot for the length of the
    performance — with the same `articulates` split, because its reason is the
    character's mouth and not the tense — and the same pull back to the
    establishing shot at the end, which is the goodbye of §9.5. Nothing else
    moves it: stepping, pausing and jumping are a transport, and a camera that
    lurched under a thumb would put the interface inside the performance.
  - **The caption rides the crown and carries the articulating face**, by the
    same components a live session uses. A deaf or hard-of-hearing learner gets
    the same replay a hearing one gets; that is step 4 of §1 and it is not a
    nice-to-have. The replay's plate no longer mirrors the line in a second
    bubble, for the same reason the live one does not (2026-08-22).
  - **Where each half of the conversation appears is a rule, not a layout.**
    The tutor speaks above their own head. Everything that is NOT the tutor's
    voice — the learner's own turns, the activities, a system note — appears in
    the dock, at the bottom, which is where the learner's words came from when
    the session was live. Nothing has to be labelled "them" and "you".
  - **Transport a child can use**: play/pause as the one large round control,
    back and forward a line at 48 px, and "Line 4 of 18" with a ribbon. Random
    access is the TRANSCRIPT — every line in the log is a button that plays from
    there — because a scrubber for eighteen beats gives each one 19 px, under
    half the tap floor, on a control aimed at children.
  - **An activity replays the question and the OUTCOME, and never re-opens.** A
    replayed exercise a learner can answer again is a second attempt at a graded
    segment wearing the clothes of a memory, posted to a route that pays XP.
    Which OPTION they picked is not shown because nothing stores it; the score,
    the attempts and the XP are stored, so those are what it says (§8, and
    /AGENTS.md §1.14 on confident wrong pictures).
  - **A replay is not a session, and the interface says so four times without
    ever saying "you can't".** The microphone is ABSENT — `micForPhase` →
    `present: false`, the second phase after the goodbye — so a learner reaching
    for the hero control finds a transport in the same rectangle. The reading
    plate carries one sentence naming the recording and its date. The chip that
    leaves reads "Talk to <name>" and lands on the introduction, one press from
    a live conversation. And on a phone, where the plate's body is not mounted
    at PEEK, the sheet's resting row announces the same sentence once.
  - **Silence is a state, not a failure.** A line whose clip was never
    synthesized, or whose audio the 90-day sweep below has already deleted,
    plays for a text-derived duration with its caption up. A whole conversation
    with no audio is said once, as a fact about the recording; a single missing
    clip is said while that line is on. The 2D face in the caption keeps
    articulating either way, because the line IS being performed — only the
    recording is gone.
  - **The flat list survives as the no-WebGL fallback**, as planned: with no
    first frame the caption becomes an unanchored plate and the whole
    conversation is a readable, navigable log on the plate.
  - **The archive is a list, and only a list.** `SessionHistory.tsx` chooses a
    conversation — character, date, line count, XP — and hands it upward. It
    does not replay anything any more, and there is no `<audio controls>` in the TUTOR
    anywhere in the product.

    **The line count was the wrong counter — found by adversarial review,
    2026-08-30 (HIGH), matching what live testing had separately noticed the
    same day.** `tutor_sessions.turn_count`, persisted at close from
    `orchestrator.turnCount` (`ws/server.ts`'s `finish()`), counted only
    MODEL-PRODUCED tutor turns — a different number from the transcript's
    own row count, which `tutor_turns` and the resume player's "line X of
    N" both count per SPEAKER, learner and tutor alike. A 3-tutor-turn
    conversation is 3 rows in the transcript (a greeting, a learner line, a
    reply) but reported `turn_count: 2`. Fixed by persisting `ws/server.ts`'s
    own `transcriptSeq` — the transcript's true row counter, already
    maintained for exactly this reason (§ above, "the transcript gets its
    own monotonic counter") — instead, at both `closeSession()` call sites
    (the ordinary close and the unclaimed-park finalize). `orchestrator.turnCount`
    itself is unchanged and still correctly drives the in-session budget cap.
- **Parent visibility is an invariant**, and it is a page: `/family/:kidId/tutor`.
  A verified guardian reads their child's full transcripts — not a summary, not
  a redaction — with the safety flags surfaced FIRST, because a child
  disclosing distress to a tutor is precisely the case where a parent must find
  out, and burying it under a list of chat logs would be a product failure
  dressed up as tidiness.
  **"Surfaced FIRST" was true of the SECTION and not of what renders first
  inside it — found by adversarial review, 2026-08-30 (MEDIUM/HIGH).**
  Flags rendered in raw `created_at DESC` order, so an old HIGH-severity
  flag could sit below a newer LOW-severity one; `severity` was fetched and
  simply never shown at all, even as a label. Fixed: sorted severity-first
  (then most-recent-first within a tier), each flag now carries a
  translated severity chip. The same round also found an in-progress
  session always reporting "0 messages" (`tutor_sessions.turn_count` is
  only written at close, and the page had no "still talking" branch) —
  fixed with an explicit ongoing state keyed on `endedAt === null`.
- **The "what is happening" narrative, added 2026-09-01** — closes the §19.5
  v3-tail item of the same name. `GET /kids/:kidUserId/sessions` now carries
  a `narrative` object per session — topics practiced, a struggle that was
  worked through (or is still ongoing), the graded fraction — a human gist
  in place of the transcript a parent otherwise has to open and read end to
  end just to learn that much. It sits ON TOP of the full transcript, never
  in place of it; "Read it" is unchanged.
  Entirely deterministic (`backend/src/services/pedagogy/sessionNarrative.ts`
  — Core, not Oracle; nothing here touches the live voice path) — built from
  data Core already held: `kc_attempt`'s per-attempt evidence
  (migration `0052`, joined to `kc.title`) for a session the v3 brain
  reached, falling back to the session's own memory digest (migration
  `0051`, `tutor_sessions.summary`) for one it never touched. No model
  call — the structured evidence already says something true without
  inventing prose, which also means no new cost, no new latency, and no new
  field reaching a model (§4.1 untouched). This is a DIFFERENT privacy
  surface than §4.1's, deliberately: a report ABOUT a closed session, read
  only by an already-verified guardian, assembled from rows that guardian
  could already read one at a time under their own existing RLS grants
  (`kc_attempt_select_own`, this route's own `sessions`/`safetyFlags`) — not
  a new fact collected, and nothing that reaches a live child session.
  Topic titles are resolved in the GUARDIAN's own profile locale (the same
  "caller's own row" pattern the rest of this route already uses), not the
  child's session locale — a bilingual family should not read a topic name
  in a language they did not choose. **This now holds on BOTH tiers
  (2026-09-01).** It previously did not, and the reason recorded here for
  leaving it — that the digest's topic string "was baked in at close time
  (migration `0051`) rather than kept as a re-localizable id" — was simply
  wrong about our own schema: `SessionSummaryDigest` has carried `topicId`
  next to the baked `topic` string since that same migration, and the offers
  screen had been rebuilding "continue" openings from it all along. So the
  fallback tier re-resolves the title from `topicId` in the guardian's
  locale, for ONE extra bounded `in.(...)` read (`getTopicTitlesByIds`,
  `backend/src/routes/tutor.ts`) issued only for the sessions that actually
  reach that tier — a session the brain touched never reads `fallbackTopic`,
  so resolving its id would be a discarded round-trip. An id that resolves
  to nothing (unpublished topic, failed read) degrades to the baked string
  rather than to null: display-only, and erasing a topic the parent could
  already see would be worse than naming it in the wrong language. Both
  behaviours are covered by regression tests that fail against the old code.
  The general lesson is worth more than the fix: a limitation documented
  with a REASON is still a claim about the code, and this one had never been
  checked against the schema it described.
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
| Voice provider unavailable | Session continues in text mode with captions. **The microphone affordance is still present, at full size, and states its own unavailability in place.** |
| Model unavailable | Scripted safe response; session closes kindly. |
| Moderation unavailable | **Fail closed** — the turn is not spoken. |
| Live generation fails any guard | Emit nothing; fall back to tier 1 and say so honestly. |
| Stage assets fail to load | The existing `SceneBoundary` fallback. The conversation must still run without 3D. |
| Consent revoked mid-session | The microphone stops on the NEXT turn — a minor with an open microphone is re-checked every turn (§4.3). An unreadable answer from Core counts as revoked, not as still-granted. |

### §14.1 The affordance is always present — corrected 2026-08-21

This section used to say **"Speech is an enhancement; the lesson is the
product."** That sentence is true about the LESSON and it was read as
permission to hide the CONTROL, which is how the shipped conversation view came
to render the microphone inside `{socket.microphone && (…)}` — present only
when it already worked. Everywhere else, the answer was an empty strip of
composer where a microphone should be. The owner's report of the shipped build
was that the microphone was nowhere to be found. That was accurate, and it was
not a fault in the microphone.

The rule that replaces it:

**The microphone affordance is ALWAYS rendered, at full size, in all five
states — UNAVAILABLE, IDLE, LISTENING, THINKING, SPEAKING — and when the answer
is no, the control says why, in place.** Unavailable is a dashed ring plus
`aria-disabled` plus one honest translated line. It is never an absent control.

Three reasons this is a rule and not a preference:

1. **An absent control is unfalsifiable.** A missing button and a broken button
   look the same to the person in front of it, and they look the same to the
   reviewer taking the screenshot. A stated reason is checkable by both.
2. **The reasons already exist, end to end, and are already translated.**
   `microphoneBlockedBy()` in Core returns exactly `POLICY_BLOCKED`,
   `CONSENT_REQUIRED` or `VOICE_UNAVAILABLE`, ordered so policy is reported
   first (§16's decision note: telling a family "ask a grown-up" when the
   answer would still be no wastes their time). All three already have copy in
   all three locales under `tutor.offers.*`. Hiding the control threw away work
   that was finished.
3. **`CONSENT_REQUIRED` is a product surface, not an error.** It is the one
   place a child learns that their guardian can turn this on. Hidden, the
   feature is invisible to the only person who can ask for it.

The corollary for whoever ships this: **a beautiful disabled orb is still a
disabled orb.** Making the affordance visible and making voice actually live in
the environment being reviewed have to land together, or the next review
repeats the last one with better typography.

**One narrowing, added 2026-08-21 after the owner tested a phone.** "Always
rendered" is about the STATES of the control, and it stands: wherever the orb is
on screen it is on screen at full size in whichever of the five states it is in,
saying why when the answer is no. It is not a claim about every PHASE of the
route, and reading it as one produced the opposite bug. Mounted in `closing`, a
96 px disabled orb measured at (139, 632, 96, 96) on a 375x812 phone, sitting on
the "See you soon!" plate, on the indigo "Start another session" — the one action
the phase exists to offer — and on its own reason line. The control that was
added so a learner could always find the microphone was taking away the button
they actually needed, in the one phase where speaking is over by construction.

So the orb is present wherever speaking is possible, about to be possible, or is
itself the thing being explained, and it is absent from exactly two phases:
`closing` and `replaying`.

**`replaying` joined `closing` on 2026-08-22, and this sentence is the
correction of 2026-08-23.** The decision was made deliberately and written into
`micForPhase.ts` and `stageMic.test.tsx` (`expect(absent).toEqual(['closing',
'replaying'])`), and this paragraph went on saying "the single phase" for a day
— which is the drift the enumerable-list rule below exists to catch and did
not, because the list it protects is in the code and this is prose. A replay is
a recording: speaking into it is impossible by construction, not merely
unavailable, and the phase offers the honest alternative in the orb's place
("Talk to Dr. Rho" — start a live session instead). That satisfies the same
rule the other six phases do; it is not an exception to it.

`unavailable` keeps it for exactly that third reason — the microphone IS
what is unavailable — and carries the phase's own sentence rather than one of
Core's three policy answers, because "no voice provider is configured" is a
confident wrong sentence when what happened is that the Tutor API could not be
reached at all. That also removed a second copy of the same message: the phase
used to print it twice, in two plates that overlapped at both widths.

The decision lives in one enumerable place (`frontend/src/tutor/stage/
micForPhase.ts` → `StageMicPlan.present`), so a new phase cannot be added
without deciding, and the absence is asserted as tightly as the presence — the
list of phases without an orb is spelled out in `stageMic.test.tsx`, not derived,
so a second removal is an edit somebody made on purpose rather than a silent
consequence. Going missing by accident is the original bug; going missing on
purpose is a product decision, and only one has been made.

**The reason line can take the composer down with it — found live, on a phone,
2026-08-29.** `VOICE_UNAVAILABLE`'s full sentence and the composer share ONE
row on a phone (`StageShell.tsx`): the orb's own wrapper carried `shrink-0` in
BOTH of its states — the bare 96 px circle (where that protects its shape from
flattening into an oval) and the wide reason plate (where it does not protect
anything and instead forces the plate to its full `min(38ch,86vw)` entitlement
regardless of what the composer next to it needs). Measured on a real
production session: the composer's own `<input>` computed to 10 px wide,
un-usably narrow, with the reason plate having taken the rest of the row.
For a learner with no voice provider configured, ORACLE.md §12 already calls
the composer the ONLY channel — so this was the SAME "an opt-out must be told
what the system decided" class §1.14 already names elsewhere, wearing the
mobile-width costume: `shrink-0` was applied blindly to both of `MicOrb`'s
states from the outside, and the wide-text state never got to say it needed
different treatment. Fixed in two places for one failure: `MicOrb.tsx` now
keeps `shrink-0` ONLY on the compact circle and lets the reason plate shrink
(`min-w-0`) so its already-`text-balance`d line wraps instead of demanding one
wide row; `StageShell.tsx`'s composer slot gained a `min-w-[9.5rem]` floor so
it survives even a state neither of us has tested yet.

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

### §15.1 Speech — bought once, not once per child (2026-08-22)

Three findings, all of them the same mistake in different places: **the most
expensive thing in the product was the least measured.**

1. **The greeting was generated.** `TutorOrchestrator.greet()` asked the model
   to invent an opening line, which cost a reasoning round trip AND a
   text-to-speech charge in every session, forever, to produce a sentence
   nobody had reviewed. It is now **twelve written lines** — one per character
   per locale, in `oracle/src/tutor/scripted.ts`, following GLOSSARY.md's
   canonical cast table. **No nickname**: the learner's name goes in the
   caption, because a name in the audio makes the clip unshareable, which is
   the whole cost being removed. Measured against the previous build: **two
   model round trips before the first spoken line, now zero.**
2. **The fixed lines were re-synthesised on every play.** The scripted set is
   closed — 12 texts × 4 characters × 3 locales = **144 clips** — and it does
   not grow with usage, so it is bought once by
   `npm run speech:pregenerate -- --confirm` and recorded as tracked config in
   `oracle/speech.pregenerated.json` (the precedent is `voices.enrolled.json`).
   Depot already deduplicated the STORAGE by content hash, so nothing but the
   invoice was growing. One-off cost: 144 clips, ~16,900 characters.
3. **A cache in front of the paid call**, keyed on a hash of the exact text
   plus the provider's voice fingerprint, in the Redis already running for the
   rate limiter. **A miss of any kind — no manifest, Redis down, Redis slow —
   is a paid call, never a silence** (§14 unchanged). A write failure is
   equally ignorable: the next session pays once.

   **"Pays once" assumed the read-check-then-write never raced — found by
   adversarial review, 2026-08-30 (MEDIUM).** The cache is read, then (on a
   miss) the provider is paid and the result is written back — with nothing
   between the two steps. Two callers that both miss before either has
   written back both fall through to the paid path: proven with two
   different children's sessions greeting concurrently on a cold cache
   (right after a deploy, or a locale/character not yet in
   `speech.pregenerate`d), 2 Inworld calls and 2 Depot uploads for the
   IDENTICAL shared greeting line. Fixed with in-flight coalescing in
   `speech.ts`: a second caller for the exact same key while a synthesis is
   already running awaits the FIRST caller's result instead of starting a
   second one, and reports its own cost as zero. Scoped per-process for the
   shared/scripted cache (a module-level map) — re-examined at N>1 on
   2026-09-01 and deliberately KEPT per-process, because its entire exposure
   is a measured $0.0835 once per replica on a cold cache and every available
   fix is worse (§16) — and per-session for generated lines
   (added to `SpeechScope` alongside the existing `memo`), matching the
   existing privacy boundary between the two caches exactly.

   **A client-side timeout that does not cancel the request is not a
   timeout, it is a promise to stop waiting — found by the same review
   (LOW).** `withTimeout` (`oracle/src/lib/http.ts`) races an
   ALREADY-STARTED promise against a timer; when the timer wins, the
   underlying `fetch()` to Inworld keeps running in the background and may
   still complete — and potentially be billed — on the provider's side,
   invisible to our own cost ledger. Fixed by passing
   `signal: AbortSignal.timeout(config.VOICE_TIMEOUT_MS)` directly into
   each Inworld `fetch()` call (`transcribe`, `synthesize`, `cloneVoice`),
   so the request is actually cancelled at the network layer the moment
   our own timeout fires. `withTimeout`'s own race stays in place as the
   labeled-error path; the two timeouts share the same duration, so
   whichever settles first wins.

**Voice cost now reaches the ledger.** `costUsd` accumulated model tokens only
and `speak()` recorded nothing, so a session could synthesise forty turns and
report the price of its tokens. It is now model + voice, with the per-character
text-to-speech rate as a named constant beside the model rates in
`orchestrator.ts` — an estimate, in one place, for the same reason §15 already
gives. Free paths add zero, which is what makes the saving visible: two
sessions with the same turn count and very different voice costs is the signal.

**And so does the work a session causes AFTER it closes (round 78,
2026-08-30).** Two paid calls used to happen outside the one place the ledger
was written. Round 64 caught the first — tier-3 live generation, which happens
DURING a session and so could simply be folded into the orchestrator's running
total (`noteGenerationCost`). The second is the post-session review
(§20, the slow chamber): one real, separately-billed call to the same
pedagogical model, fired fire-and-forget AFTER `closeSession` has already
persisted `costUsd` — in the graceful close and in the dropped-connection one
alike — so there is no running total left to add to and the ledger simply never
saw it, for every session with a real conversation in it. It now goes to Core's
own additive route (`POST /tutor/internal/sessions/:id/cost`, migration `0062`,
`cost_usd = cost_usd + x` inside Postgres), reported from the review's own
`finally` so it lands whether or not the proposal it paid for survives
moderation. A closed session row is not immutable here, and never was: Core's
memory digest is already written onto one. Failure degrades LOUDLY and only for
the accounting — a call we cannot price is logged as UNCOUNTED rather than
recorded as zero (§1.14), and no cost report can fail a review or a close.

**Reuse and deletion are the same question, and the bucket name answers it.**
A clip reused across sessions is ONE content-addressed Depot object that many
transcripts point at, so it either outlives §12's 90-day promise or is deleted
out from under everyone still pointing at it. So `tutor-speech` holds a child's
session audio and is swept; `tutor-speech-shared` holds the scripted set —
human-written, identical for every learner, saying nothing about anybody — and
Core's sweep now refuses to delete from any bucket but the first. That guard
also closes a hazard that predated the shared bucket: the sweep would delete
whatever path the database handed it, including a lesson-narration URL written
into `audio_path` by a bug.

**Widening reuse to model-generated turns is an owner decision, not a tuning
knob.** `SPEECH_CACHE_SCOPE=all` would share a tutor's generated sentences
between learners and therefore keep them past the 90-day window — a change to a
promise this document makes in §12 and that `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md`
carries. It is a named flag, defaulted to `scripted`, with a sign-off to record
if it flips, in the same shape and for the same reason as
`TUTOR_VOICE_FOR_MINORS`.

Every safety property is unchanged: moderation before speech, the sealed
context, the consent gate, and scripted lines used verbatim and never
moderated. A cached line is still the same reviewed line — the key is a hash of
the text, so edited copy orphans its own audio instead of playing the old clip.

### §15.2 What is NOT yet in place for scale — 2026-08-23

§15 describes the controls that exist. This says plainly what does not, because
the difference matters the day there are a thousand learners instead of one
owner testing.

**What holds.** Every limit that protects us from a single account is real and
tested: **2 sessions per learner per day** and **120 tutor XP per day** (Core,
`routes/tutor.ts`), a **25-minute hard stop with a 15-minute kind wind-down**
and a **120-turn cap** (`session/budget.ts`), a **600-character** cap on one
learner utterance, a **700 ms floor between turns** and **one turn in flight at
a time**, a **2 MB** websocket frame cap, **single-use session-scoped tokens**
minted by Core, **20/15/8-second** timeouts on the model, the voice provider and
Core, and a **per-session cost ledger** covering model tokens AND synthesized
speech. Every read that feeds a limit **fails closed** — a database that cannot
answer returns 502 and the session does not start, rather than defaulting to
"no sessions used yet". Moderation and consent fail closed; rate limiting fails
open, deliberately, because it is an availability control (§1.14).

> ### The staff USAGE exemption — owner request, 2026-09-01
>
> **`admin` and `superadmin` accounts are exempt from the four limits above
> that bound a learner's USE of the tutor**, so the people who test the
> product are not stopped by budgets shaped for a child's attention span. The
> daily session cap has been exempt since before this (`STAFF_SESSION_CAP`,
> `backend/src/routes/tutor.ts` — and its own comment records the day the
> exemption existed on paper and threw `integer out of range` in practice).
> What 2026-09-01 added is the rest: the **25-minute hard stop**, the
> **15-minute wind-down** and the **120-turn cap** now read
> `STAFF_HARD_BUDGET_MS` (8 h), `STAFF_SOFT_BUDGET_MS` (7 h 45 m) and
> `STAFF_MAX_TURNS` (5,000) instead (`oracle/src/session/budget.ts`).
>
> **It travels as one derived boolean, never a role list.** Core computes
> `isStaff` in the same handler that already reads the roles and already
> fails closed on an unreadable answer (502), and sends it on the `.strict()`
> session context beside `isMinor` — a policy flag, no PII, and `optional()`
> on Oracle's side so an Oracle deployed ahead of Core reads its absence as
> `false`. It reaches the BUDGET only: `verify:tutor` still asserts the model
> context rejects every unlisted field, and staff-ness has no business
> shaping how the tutor speaks to anybody.
>
> **What is deliberately NOT exempt, and must not become so:**
> - **The platform-wide daily spend ceiling** (`DAILY_SPEND_CEILING_USD`,
>   §15.2 item 1). It exists for the runaway case, and an unattended staff
>   session with no session cap, no clock and no turn cap is the most
>   plausible way to produce one. This is the control that makes the rest of
>   the exemption affordable.
> - **The 120 tutor XP per day cap.** XP is a reward, not a usage limit;
>   uncapping it would make staff progress data non-comparable with a real
>   learner's for no testing benefit.
> - **Moderation, consent, and the §1.9 PII boundary.** Those are safety.
>   Nothing in this exemption touches them, and a future change that "extends
>   the staff exemption" to any of them is a bug, not an extension.
>
> **The staff budget is large and still FINITE, on purpose.** "Unlimited"
> literally asks for `Infinity`, and the hard budget is the only thing that
> ever closes a session nobody is sitting in front of. Eight hours is past
> any real testing session and still ends an abandoned one the same day —
> the identical judgement `STAFF_SESSION_CAP` made when it chose Postgres's
> `int4` ceiling over `Number.MAX_SAFE_INTEGER`. The wind-down stays a fixed
> fifteen minutes below the hard stop rather than a proportion of it, so
> staff can still reach and test the `wrapping` state instead of spending
> two and a half hours inside it.
>
> Pinned by seven tests in `oracle/src/__tests__/session.test.ts` (the
> exemption is real; it is not infinite; the wind-down is still reachable;
> and — the one a careless implementation breaks — omitting the flag gives a
> learner the learner's budget) and two in `backend/src/__tests__/tutor.test.ts`
> covering the wire contract in both directions.

> **This paragraph was false for five days, and that is the point (2026-08-23).**
>
> An adversarial audit found that the 700 ms floor and the 120-turn cap were
> real *on the path they were written for* and absent on the one beside it.
> `segment_graded` reached the model without passing either, `learner_audio`
> paid the speech-to-text provider before any gate ran, and the turn counter
> advanced only *after* a completion returned — so a burst of frames all
> measured themselves against the same stale count and all passed a cap none
> of them had reached. A single authenticated learner could open one ordinary
> session and force dozens of concurrent paid completions inside the one
> process serving everybody.
>
> All four are fixed (`claimTurn` in `ws/server.ts`, the entry guard in
> `orchestrator.produce`), and `src/__tests__/hardening.test.ts` holds a
> regression test per defect — each confirmed to FAIL against the code as it
> stood. The lesson worth keeping is not the bug: it is that **this document
> asserted the control and the assertion is what stopped anyone looking.** A
> claim here is a claim about code, and it decays silently. When a control is
> named in this file, name the test that proves it.

**What does not hold, and would be noticed at a thousand concurrent learners.**

1. **There is no platform-wide spend ceiling and no circuit breaker — CLOSED
   2026-09-01.** Cost used to be *recorded* per session with nothing that
   *stopped* on a total — the arithmetic was reassuring (a real three-turn
   session is `model=$0.00005`, even a pathological 120-turn one is cents),
   but "we would notice on the invoice" was never a control, only an autopsy.
   `oracle/src/session/spend-guard.ts` now tracks every real, already-incurred
   cost this process causes — the per-turn model call, tier-3 live generation,
   synthesized speech, and the post-session review's own paid call, all four
   recorded at the SAME moment they add to their session's own ledger, not at
   close — against a configurable rolling 24h ceiling
   (`DAILY_SPEND_CEILING_USD`, $20 default: deliberately conservative and
   meant to be raised as real paid usage grows, not a modelled budget for
   ordinary traffic). Once the ceiling is reached, every NEW connection is
   refused OUTRIGHT — before a token is even read, since there is no point
   validating a signature for a socket about to be refused regardless — with
   its own close code (`CLOSE_CODES.SPEND_CEILING`, 4029) kept numerically
   distinct from 4013 (`SERVICE_DEGRADED`) so an operator's logs can tell
   "cost control tripped" apart from "moderation is down" at a glance, while
   the learner sees the same honest, generic "try again soon" either way — a
   business-side cost ceiling is not something to explain to a child.
   `DAILY_SPEND_ALERT_FRACTION` (50% default) warns loudly well before the
   refusal, and both numbers are visible continuously on `GET /health`'s
   `spend` field, not only in a log line when something goes wrong. Proven by
   `oracle/src/__tests__/session.test.ts` (the guard's own arithmetic —
   accumulation, the alert latch firing once per window, the 24h roll) and
   `live-session.test.ts` (a real connection actually refused by the running
   websocket server, ahead of every auth gate).
2. **There is no admission control on concurrent sessions — the PER-INSTANCE
   half CLOSED 2026-08-31, the horizontal-scale half deliberately left open.**
   `oracle/` used to accept every authenticated socket unconditionally; now a
   configurable ceiling (`ORACLE_MAX_CONCURRENT_SESSIONS`, default 200 — a
   conservative starting point, not a measured capacity figure) refuses the
   next connection once `ws/server.ts`'s own `liveSessions` map is full,
   closing with the SAME `CLOSE_CODES.SERVICE_DEGRADED` (and the frontend's
   existing "the tutor is resting" copy) gate 7's moderation refusal already
   uses — a learner does not need to know which internal control declined the
   connection. Checked FIRST, before the token is even read, so a saturated
   process sheds load for the price of one `Map.size` read rather than a
   signature verification or a round trip to Core. Proven end-to-end by
   `oracle/src/__tests__/admission-control.test.ts`: the (N+1)th attempt is
   refused with a real close frame while the N already-live sessions stay
   untouched, and freeing a slot admits the next attempt — the ceiling is
   dynamic, not a one-shot lockout. **What remains open, deliberately: this
   cap is still PER INSTANCE.** The session state it counts is no longer
   process-bound — the nonce ledger and `liveSessions` moved onto a shared
   claim, and `parkedSessions` gained a shared, adoptable snapshot (§16,
   `RUNBOOK.md` Round 143) — but `ORACLE_MAX_CONCURRENT_SESSIONS` is read from
   one process's own `liveSessions.size`, so N replicas admit N times the
   ceiling. That is deliberate and safe in the direction that matters (each
   instance still protects ITSELF from overload, which is what the cap is for),
   and it is not admission control ACROSS instances, which remains a separate
   and architecturally-undecided piece of work. Note it is a capacity control,
   not a spend control: the daily ceiling that bounds MONEY (`spend-guard.ts`,
   §15.2 item 1) is a different mechanism.
3. **The websocket handshake is not rate limited — CLOSED 2026-08-31.** It is
   still attached to the HTTP server directly, so Express's
   `globalRateLimiter` still never sees it — that has not changed and could
   not without moving the whole socket behind Express. What changed is a
   purpose-built limiter in front of `handleConnection` itself
   (`ws/handshakeRateLimit.ts`), keyed per IP and checked before the token is
   even read: memory-backed in test/dev (so it is exercised by a real test
   without a live Redis), Redis-backed in production on the connection
   `lib/redis.ts` already owns, and it FAILS OPEN on any store error — the
   same discipline `middleware/rateLimit.ts`'s `passOnStoreError: true`
   already uses, because this remains defence in depth behind a control that
   already works (Core's token minting), never the primary defence. It is
   protected by a single-use, session-scoped, short-lived token minted by
   Core, and Core's own limiter and the 2/day cap sit in front of minting —
   that sentence was true before this closed and still is; what this adds is
   a bound on the PATH itself, independent of whether an attempt would even
   authenticate. Configurable via `ORACLE_WS_HANDSHAKE_RATE_LIMIT_MAX` /
   `_WINDOW_MS` (default 100 attempts per 60s per IP — a reasonable starting
   point generous enough for a household reconnecting through one NAT'd IP on
   a flaky connection, not a measured threshold). Proven by
   `admission-control.test.ts` (a burst past the budget is refused with a
   real close frame carrying a distinguishable reason, not silently dropped)
   and `handshakeRateLimit.test.ts` (per-IP keying, window expiry, and the
   Redis-unreachable fail-open path exercised directly against the actual
   production code branch, not merely the test fallback).
4. **The retention sweep has no monitoring of its own — CLOSED 2026-08-31.**
   It still runs nightly and still refuses to report success on an
   unreachable database (unchanged, and correct). What was missing is now
   built: every reply from `POST /api/v1/tutor/internal/retention/purge` that
   reaches the database — INCLUDING a batch that deletes zero sessions,
   deliberately, so "ran and found nothing due" can never be confused with
   "never ran" (§1.14) — writes a `tutor.retention.swept` row to `audit_logs`
   (a SYSTEM action, `actor_id: null`; no new migration needed, since that
   column has always accepted NULL). `GET /api/v1/admin/tutor/retention-status`
   reads the most recent one back and reports `stale: true` once it is more
   than 36 hours old — a day plus slack for an ordinary late run, not so much
   slack that an actually-missed night goes unnoticed — or when no run has
   ever been recorded at all, and a failed READ (database unreachable) is a
   502, never a falsely-reassuring 200. Proven by
   `backend/src/__tests__/tutorData.test.ts` and `admin.test.ts`. **What
   remains owner-side: something that actually polls this route on a
   schedule and alerts** — a Pulse/Uptime Kuma JSON-query monitor is the
   natural fit, since the route is a plain, unauthenticated-by-nothing-but-
   staff-role HTTP+JSON target built for exactly that — the data and the
   verdict exist now; a human or a cron watching them does not yet.
5. **Third-party rate limits are unmeasured.** We do not know what DeepSeek or
   Inworld will do to us at a thousand concurrent sessions, and the answer is
   not knowable from here. The failure posture is already correct (§14 — a
   model timeout produces a scripted safe line and a kind close, never a
   hang), so the shape of a bad day is degraded, not broken.

6. **The post-hoc human review of live content has no reader — CLOSED
   2026-08-28.** §7.3 lists sampling as one of eight guards that make live
   generation acceptable for a minor without a human in the loop, and from
   2026-08-23 to 2026-08-28 the sampling wrote flags nothing read: segments
   were marked `review_status='pending'` and indexed for it, `/admin/content`
   reviewed lessons rather than tutor segments, and Oracle's
   `LIVE_REVIEW_SAMPLE_RATE` was dead config. The reader now exists:
   `GET /api/v1/admin/tutor/review-queue` lists the pending segments oldest
   first (payload, provenance, learner score), the "Tutor Live Review" tab on
   `/admin/content` renders it with approve/reject, and a verdict only lands
   on a row still pending so two reviewers cannot silently overwrite each
   other. The dead Oracle env var was REMOVED (the real rate is Core's
   `TUTOR_LIVE_REVIEW_SAMPLE_RATE`, applied where segments persist). Proven by
   `backend/src/__tests__/admin.test.ts` → "the tutor live-content review
   queue". **What remains owner-side: a named person who reads it.**

Items 1 through 4 and 6 are now CLOSED; item 5 remains open. None of the six
was a defect in what was built — they are the difference between a product
that is correct and a service that has been operated — with one exception:
item 6 WAS a defect, a control this document asserted and the code did not
have, unlike the five-day gap this section opens with (the boxed note above
item 1), where the same shape of error repeated. Item 1 (the spend ceiling)
and item 2's per-instance half, item 3 (handshake rate limiting) and item 4
(retention-sweep monitoring) are each a genuine, working control built where
none existed, proven by a real test against the actual gate rather than
merely written down — read each item's own closure note for exactly what
changed and, where one remains, what is still owner-side. Item 2's
horizontal-scale half is still open, deliberately, and is not a defect
either — it is a separate, larger, architecturally-undecided piece of work.
Item 5 is likewise still open and not a defect — it is a scale question this
product has not yet been operated at.

---

## §16 Acceptance checklist — before any minor uses this

Every one of these must be proven, not assumed. Ticked items were verified in
the build session of 2026-08-21; unticked ones block enabling this for minors.

- [ ] A data-processing agreement with the voice provider covering minors'
      audio exists. **OWNER ACTION.** See `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md` §6.
      It now blocks exactly one thing rather than the feature — see the
      decision below.

> ### The DPA gates the MICROPHONE, not the product (decision, 2026-08-21)
>
> Left to the implementer's judgement, with the owner's instruction that the
> product must stay accessible. The decision:
>
> **`TUTOR_VOICE_FOR_MINORS` is an explicit configuration flag, default OFF.**
> While it is off, no minor's microphone opens — regardless of guardian
> consent, which is a separate and also-required condition. Adults are
> unaffected, and **every learner keeps the whole tutor**: captions above the
> character, the transcript rail, typed input, the live lesson, grading, XP,
> replay. The contract gates one input method.
>
> **Why a flag and not simply "leave the key unconfigured".** Those are
> different facts and conflating them is how a policy decision becomes an
> accident: a key configured so adults could use voice would silently have
> opened children's microphones too. Now the policy is a line in a config file
> with a name, a default, and a sign-off to record when it flips.
>
> The UI reports the reason honestly and checks POLICY FIRST — telling a family
> "ask a grown-up to allow it" when the answer would still be no wastes their
> time and reads as a permission that does not work.
- [ ] All three `/LEGAL/` documents updated and `npm run legal:sync` run.
      **Blocked on counsel** — the brief is written, the answers are not.
      The consent wording currently in `tutor.consent.body` is a PLACEHOLDER.

> ### The placeholder is now UNREACHABLE, not merely unfinished (2026-08-23)
>
> Found while preparing the production deploy: `VoiceConsentControl` did not
> know the policy existed. It rendered "Allow the microphone" to every guardian
> regardless, and pressing it showed the placeholder wording and stored it in
> `tutor_voice_consent` as the verbatim record of what that guardian agreed to
> — in exchange for a microphone the socket refuses anyway while
> `TUTOR_VOICE_FOR_MINORS` is false. Three faults in one control: unreviewed
> legal text presented as an agreement, that text persisted as the record, and
> a permission that does nothing.
>
> Two independent guards now, because they protect different things:
>
> - **The surface** reads `policy` alongside the consent state and says the
>   true reason (`tutor.consent.unavailable`) instead of offering a switch. An
>   absent `policy` field reads as blocked — absent is not consent.
> - **The record** refuses the write: `POST /api/v1/tutor/consent` answers
>   `409 POLICY_BLOCKED` unless preflight reports `minorVoicePolicy: 'allowed'`.
>
> **Revocation is deliberately gated by neither.** A consent granted while the
> policy was open must stay withdrawable after it closes.
>
> The consequence for this checklist item: counsel's wording is still required
> before a minor speaks, but the placeholder can no longer reach a guardian or
> a database row, so it no longer blocks deploying the rest of the product.
- [x] The consent gate blocks the microphone with no consent — tested
      (`backend` tutor suite, `oracle` socket guard). Since 2026-08-23 the
      platform also refuses to COLLECT a consent while the policy is closed,
      in the UI and at `POST /tutor/consent` independently.
- [x] **Revocation takes effect on the NEXT turn** — closed 2026-08-23. A minor
      with an open microphone is re-checked every turn; everyone else keeps the
      five-turn poll. This item was ticked and claiming next-turn for two days
      while the code polled every fifth turn: the documentation audit unticked
      it, and the same day the code was changed to keep the promise rather than
      the promise weakened to match the code. Pinned by a test that was
      confirmed to fail against the old interval.
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
- [x] **`npm run verify:placement` — RUNS AND PASSES (2026-09-02).** This line
      said both gates were blocked on `/glb/` source exports "outside the
      repository" for weeks. Measured rather than assumed: the exports are
      present on the development machine, and placement passes on the real
      ones — every character on walkable ground, inside the rim, facing the
      learner, with the tightest contact-shadow margin at 0.08 m. A stale OPEN
      on this file sends somebody to fix working code, which §16 warns about
      in its own words and had here done to itself.
- [ ] `npm run verify:rig` — the ONE that genuinely cannot run, and NOT for the
      reason recorded above. It needs `frontend/public/scenes/clips-biped.glb`,
      a **gitignored build output** produced by `npm run assets:clips` (Blender),
      not a `/glb/` source export. Blender is not installed on the development
      machine. Either install it, or generate that single file elsewhere and
      drop it in. The script itself was fixed the same day to exit NON-ZERO
      when it cannot run: it previously printed "SKIPPED" and returned 0, three
      lines below its own comment reading "a check that reports success on an
      empty run is worse than none".
- [x] Verified in-browser at 375 px, 720 px and 1280 px, light and dark,
      screenshots taken, no horizontal overflow at any width (§1.11).
- [x] **Accessibility audited with axe-core** (WCAG 2.0/2.1 A and AA) across
      all four Tutor surfaces in both themes: zero violations — **re-run
      2026-09-01** (the re-run this file itself demanded, twice: here and at
      §16.1 below), against the conversing phase, `SpeechCaption.tsx`, the
      HUD plates and `ReplayInWorld.tsx`'s transport, after all four were
      rebuilt. Unlike the 08-21 pass, this one is not a one-off: it is
      `npm run verify:tutor-a11y` (`frontend/scripts/verify-tutor-a11y.mjs`),
      injecting axe-core into `/dev/tutor-lab` across desktop light en-US,
      desktop dark es-MX and mobile light es-MX — the same three
      configurations `verify-tutor-ui.mjs` already drives — so the next
      rebuild gets a gate instead of a memory. **Widened the same day from two
      stage phases to all EIGHT** (arriving, personalizing, introducing,
      conversing, adapting, closing, replaying, unavailable), each scanned at
      rest, so this row's "all four Tutor surfaces" claim is now carried by
      the gate rather than by the two phases that happened to be scripted.
      Twenty-four phase scans, ZERO product violations — the six phases that
      had never been swept were in fact clean. What the widening did find was
      a defect in the HARNESS, and it is the more useful finding: the old
      fixed 600ms post-switch wait assumed a phase's entrance animation starts
      when the phase switch is pressed. It does not — a world chip's
      `lf-settle` starts when the placement solver seats it, caught with
      `getAnimations()` reporting `lf-settle:running:33` on a sample taken
      1.9 SECONDS after the switch, composited at 1.06:1 where the resting
      pair is 6.29:1. Three of twenty-four scans tripped that way. The wait is
      now animation quiescence with a floor, not a duration, so the gate
      measures the resting state by construction. Two real violations found and
      fixed, both on `TutorTranscript.tsx`'s scroll region:
      `scrollable-region-focusable` (an `overflow-y-auto` log with no
      focusable descendant was reachable by mouse wheel or touch, never by
      keyboard — fixed with `tabIndex={0}`) and `aria-prohibited-attr`
      (`aria-label` on a bare, role-less `<div>`, which axe calls "not well
      supported" — fixed with `role="log"`, which is also just the correct
      role for a running transcript, not a workaround). Live-testing
      separately flagged `sort_buckets`'s group/drop-zone buttons as having no
      accessible name at all; that specific claim did not reproduce
      (`zone.label` is real, non-empty text — Zod's `idLabel` schema enforces
      `min(1)` — so the browser's name-from-content rule already gave each
      button a name), but the bare category word ("Save", alone) told a
      screen-reader user less than the grid of boxes tells a sighted one, so
      each button now carries an explicit `aria-label` ("Group: Save"),
      composed from the segment's own data through the same i18n key in all
      three locales — regression-checked by the same gate on every run, not
      only found once and trusted to stay fixed. One `color-contrast`
      false positive is worth naming so it is not rediscovered as a mystery:
      `PersonalizeInWorld`'s "I'm ready" action, scanned mid-`lf-settle`
      entrance animation (opacity ~0.22 of a 300ms transition), reads as a
      violation; scanned at rest it is a solid `bg-accent`/`text-on-accent`
      pairing at 6.29:1, comfortably past 4.5:1. The gate waits out the
      settle before scanning specifically so this does not recur as a false
      alarm on every future run. Every interactive element is tabbable,
      carries an accessible name and can take focus; the caption and
      transcript both announce politely. The 08-21 run's own finding — the
      consent status line's faint colour at 2.56:1 — was not re-broken; the
      same token still fails wherever it carries text elsewhere in the app
      (~124 places), which remains pre-existing and tracked separately rather
      than rewritten inside a Tutor change.
- [x] Owner sign-off recorded for the §1.5 exception (§3.2).
- [x] **Adversarial security audit, 2026-08-23.** Six surfaces attacked
      independently (injection stack, socket auth, the PII boundary,
      moderation and the content ladder, availability and budgets, secrets and
      the speech cache), every finding then put to a skeptic instructed to
      refute it. 27 raised, 7 survived, 5 of them high. All five are fixed and
      each has a regression test in `oracle/src/__tests__/hardening.test.ts`
      that was confirmed to fail against the pre-fix code.
      - `segmentRequest.framing` reached a child's screen with no moderation,
        while two comments claimed it was moderated — now moderated in the same
        call as `say`, and fenced before it reaches the tier-3 author prompt.
      - `segment_graded` and `learner_audio` bypassed the turn floor and the
        budget; audio was transcribed and billed before any gate. All
        model-producing paths now go through one `claimTurn`.
      - Oracle's IP rate limiter fronted the Core-only internal surface, so
        ~200 tutor page views in fifteen minutes took the tutor offline
        platform-wide while `/health` stayed green. That surface is exempt; it
        is already behind `requireInternalKey`.
      - A mid-session consent re-check treated "Core unreadable" as "still
        granted". It now refuses, matching the door.
      **What the audit did not cover** is recorded honestly in
      `/SECURITY_AUDIT_2026-08-23.md` — no live provider calls, no
      dependency review, no multi-instance analysis, no load testing.
- [x] **Oracle no longer requires a SINGLE Railway replica — closed 2026-09-01
      (`RUNBOOK.md` Round 143), with one deliberate limit and one operational
      step named below rather than hidden.** All four of the in-process,
      per-session structures `oracle/AGENTS.md` item 79 / `RUNBOOK.md` Round
      119 originally named are now resolved, and they were resolved by three
      different means because they were three different problems:

      - **The `jti` replay ledger and the live-session exclusivity guard**
        (`session/token.ts`, `liveSessions` in `ws/server.ts`) sit on a shared
        Redis-backed claim (`oracle/src/lib/lock.ts`). Both fail CLOSED —
        refuse the connection — when the store cannot confirm exclusivity, a
        decision written down at each call site.
      - **The speech in-flight coalescing maps** (`voice/speech.ts`) were
        CLOSED ON MEASUREMENT, without a lock, in Round 142.
        `SpeechScope.inFlight` is already correct at N>1 by construction and
        must never be made shared — doing so serves one child's session audio
        into another child's session, fenced now by a regression test.
        `inFlightShared` is genuinely per-process and its ENTIRE exposure was
        measured: with the shipped `SPEECH_CACHE_SCOPE=scripted` the reusable
        class is the closed catalogue — 144 keys, 16,697 chars, **$0.0835 in
        total, once** — so leaving it costs $0.0835 x (N-1) on a cold cache and
        nothing thereafter. `npm run speech:pregenerate -- --confirm` takes
        that to $0.00. **Conditional on that flag**: `SPEECH_CACHE_SCOPE=all`
        makes the reusable class unbounded and reopens the question.
      - **`parkedSessions`** — the one Round 142 called the real blocker, and
        the one this round rebuilt. A dropped session now publishes a
        versioned, `.strict()`-validated snapshot of itself
        (`ws/parkStore.ts`), which any replica can adopt: the conversation, the
        lesson plan, the pedagogical controller's private state, the budget
        clock, the cost ledger and the open activity all come back, on a
        `Synthesizer` the adopting process builds for itself because a closure
        cannot travel. Three properties make it safe rather than merely
        working, and each has its own test: the claim is released only AFTER
        the park is published, so anything that acquires it is looking at a
        store where the park already exists; the parking replica's grace timer
        must win a compare-and-delete on the shared record before it may close
        the session, so it can never stomp a conversation another replica
        adopted; and `transcriptSeq` is floored by a separate monotonic
        high-water mark, published per row, so it can never restart at 0 even
        when no park record survives at all.

      **What is NOT covered, stated plainly.** A REDEPLOY still ends every live
      session as `abandoned` rather than handing it to a sibling replica —
      exactly as it does today at one replica, so it is unchanged rather than
      regressed, and it loses no data. Round 142's requirement 6 called that an
      owner decision rather than a refactor, and it still is: a process on its
      way out cannot answer "is a sibling still there to resume into?" about
      itself, so changing it needs a fleet-liveness signal this service does
      not have. Cross-replica adoption covers a learner who DROPS.

      **Two controls remain PER INSTANCE, and scaling out requires acting on
      one of them.** `ORACLE_MAX_CONCURRENT_SESSIONS` counts one process's own
      live sockets, which is what it is for — each instance protecting itself
      from overload — so N replicas admit N times that ceiling, harmlessly.
      `DAILY_SPEND_CEILING_USD` is the one that matters: `spend-guard.ts` is
      deliberately in-process, because a circuit breaker must not depend on the
      infrastructure it exists to survive (§1.14), so at N replicas the
      effective daily ceiling is **N times the configured number**. It still
      stops the multiplier-shaped bug it was built for on each instance, but
      the platform-wide dollar figure is only true if the configured value is
      DIVIDED by the replica count. Do that in the same change that scales.

      **What is proven, and what is only argued.** The snapshot's completeness
      is enforced mechanically rather than by review — `snapshotFence.test.ts`
      reads both classes' real runtime fields and fails if one is neither
      snapshotted nor explicitly excluded with a reason, confirmed red against
      an injected field on each class. The cross-replica behaviour is driven
      end to end over real sockets, every test confirmed red against the
      pre-fix code (the transcript one reported 6 rows carrying only 3 distinct
      seqs — half the conversation deleted in silence). The Redis Lua was
      verified against a real Redis 7 container, 23 assertions, twice. What has
      NOT happened is a live two-replica deploy: **scale to N>1 with a smoke
      test that drops a session on one instance and resumes it on another,
      rather than trusting this paragraph.**

### §16.1 The immersion gates — added 2026-08-21, measured 2026-08-23

Separate from the safety checklist above and NOT a substitute for it. These
gate the rebuilt experience rather than a minor's use of it, and they exist
because every one of them names something the shipped version got wrong while
every automated gate was green.

**Ticked items below were MEASURED on a live stage on 2026-08-23** — headless
Chrome over CDP against `/dev/tutor-lab`, which mounts the real `StageShell`.
Where a number is quoted it was read off that run, not estimated. Unticked
items are unticked because they were not proven, and each one says why.

- [x] **The stage is the page.** Measured canvas coverage of the viewport =
      **1.0000 in all eight phases, at 375x812 and at 1280x800**. The canvas is
      `fixed inset-0` and does not change with the theme, and the 108-shot
      light/dark sweep shows it full-bleed in both. No app shell, no
      `mx-auto max-w-container`, no page `<h1>` on the route.
- [x] **Every control is in the frame.** Zero `.lf-card` rendered at any step
      of the end-to-end walk; the canvas covers the whole viewport, so every
      focusable control on the route necessarily sits over it.
- [x] **The microphone is present in all five states**, with an accessible
      name in each and a visible reason in each blocked one (§14.1) — and in
      every phase except the two §14.1 now records. Measured names, live:
      `Hold to talk` (idle), `Thinking…`, `Talking, hold to interrupt`
      (speaking), and `Microphone unavailable` beside the visible line "The
      tutor is resting. Try again soon." The orb is **112 px on desktop and
      96 px on mobile** in every one of them. LISTENING is the one state that
      needs a held pointer, so it is covered by `stageMic.test.tsx` rather than
      photographed.
- [x] **No two HUD surfaces overlap at rest**, in any phase, at 375 px and at
      1280 px. The lab's readout — the product's own `overlappingPairs`
      arithmetic, not a second implementation — reported **"no overlaps" in all
      sixteen phase/breakpoint combinations**. Three surfaces shipped
      overlapping at once before this existed, and none was visible to any
      automated gate, because jsdom lays nothing out.
- [x] **Voice is actually live in the reviewed environment** — CLOSED
      2026-08-21, re-confirmed 2026-08-23 against the deployed service. It was
      correctly unticked here while it could only be done by the owner on
      production; it was then done there, and this line went on saying "NOT
      VERIFIED" for two days. The evidence, from `step=verify` of
      `.github/workflows/tutor-deploy.yml`: `/health` reports
      `voice: "up"`, `speaks:verify` names zero missing enrolments, and one
      line was synthesized in the character's OWN cloned voice in 973 ms,
      stored in Depot, and fetched back over plain HTTP with no credentials —
      the way a browser asks. `VOICE_PROVIDER=inworld` in production.
      `VOICE_PROVIDER=none` remains a first-class tested mode.
- [x] **Every persisted preference axis provably reaches the scene**, backdrop
      included (§2.1, §10). Walked live in es-MX and pt-BR at both breakpoints:
      changing the island redrew the stone circle as the oasis with the whole
      cast still standing on it, and changing the light took sky, ground and
      characters from Day to Dusk together.
- [x] **All four characters come to the foreground**, `rho`/`zara` at
      `closeup` and `liruf`/`dina` at `closeup-wide` (§2.2), one greeting
      screenshot each — eight in all, four characters at two breakpoints.
- [x] **The lesson plate floats.** At 1280 px the scene is visible above,
      below, left and right of it. The character's on-screen height is
      unchanged with and without a live segment BY CONSTRUCTION rather than by
      measurement: `shotForPhase` has no `segmentLive` input at all (§9.3), so
      no shot change is reachable from a segment arriving, and `shotForPhase.test.ts`
      pins the mapping.
- [x] **Keyboard focus never lands on something invisible.** Verified by
      pressing Tab for real through every phase at both breakpoints — 16 walks,
      **zero stops on anything the browser's own `checkVisibility()` calls
      hidden, and none off-screen without a scroller that can bring it back**.
      A static scan cannot answer this and initially reported ten false
      positives: `getComputedStyle` on a descendant of a `display:none`
      ancestor returns the descendant's OWN display, so the collapsed sheet's
      contents look visible to a scan while being correctly out of the tab
      order.
- [x] **Motion survives the quality governor — MEASURED ON REAL GPU HARDWARE,
      2026-09-01, and the old caveat is now half retired rather than repeated.**
      This item said "there is no real one here" for over a week. That was true
      of the HEADLESS harness and had quietly become false of the machine: the
      in-app browser renders through the real device GPU, which reported itself
      as `ANGLE (Apple, ANGLE Metal Renderer: Apple M2)` — not SwiftShader. The
      claim was never re-tested after the tooling changed underneath it, which
      is this file's own recurring failure (an assertion decays silently while
      the thing it describes moves).

      **The numbers, read off `requestAnimationFrame` deltas on the live
      `/dev/tutor-lab` stage, 295 frames desktop and 235 at 390x844 with
      `devicePixelRatio` 2:** median **16.7 ms (59.9 fps)** at BOTH sizes, p95
      **18.5 / 18.6 ms**, worst frame **18.7 ms**, and **zero frames over
      33 ms** — that is, not one dropped frame across either run. The ~39% of
      frames nominally "over 16.7 ms" is vsync jitter either side of the 60 Hz
      boundary, not stutter: the distribution's own worst case is 18.7 ms,
      nowhere near a doubled frame. This supersedes the 48-fps figure recorded
      in `/TUTOR_3D.md`, which that file already labelled "a software-rasteriser
      bound, not a phone measurement".

      **WHAT THIS DOES NOT PROVE, and the box is ticked with this attached
      rather than despite it.** An M2 is far stronger than the mid-range phone
      most of our learners hold. What is now closed is the SOFTWARE-RASTERISER
      caveat — frame times are no longer being read off a renderer with no GPU
      behind it at all — and the ceiling comparison holds (`/TUTOR_3D.md`'s
      measured worst case is 106,224 triangles against a documented
      `maxTrianglesPerFrame` of 220,000, 48%). What remains open, and is now
      tracked in §16.2 rather than here, is a real mid-range ANDROID number.
      Ticking this on an M2 and calling the phone question answered would be
      exactly the over-claim §1.12 forbids.
- [x] **Text over the render is measurable.** **HALF SUPERSEDED, half
      RE-RUN — 2026-09-01.** The first half — "every plate carrying body text
      stands on the opaque `bg-surface` floor" — was superseded on 2026-08-22
      when the Lumen material took that job over and the last opaque core was
      removed (`LessonPlate`'s `floor="none"`); the contrast bound it
      protected is now derived in `HudPlate.test.tsx` (4.96:1 light, 7.2:1
      dark for muted body text). The second half — axe-core reporting zero
      violations across all Tutor surfaces in both themes — was proven on
      2026-08-21, then genuinely re-run after the caption, the plate and the
      replay transport were all rebuilt: see §16 above for what the re-run
      found (two real fixes on `TutorTranscript.tsx`, one confirmed false
      positive on a `personalizing` action mid-entrance-animation) and
      `npm run verify:tutor-a11y` for the gate that makes the NEXT rebuild
      re-run this on its own rather than waiting for someone to remember.

### §16.2 Known limitations, in plain language — 2026-08-23

Written for somebody who has to answer a customer, not for an engineer. Each
one is a thing the Tutor does NOT do, or does imperfectly, that we know about
and have decided to ship with. Nothing here is a surprise waiting to happen;
everything here has been looked at, measured, and left on purpose.

**1. The tutor speaks with a real voice only once the voice contract is
signed.** Until then every learner still gets the whole Tutor — the character
on the island, the words above their head, the written conversation, the
activities, the marks, the replay — with typing instead of talking. The
microphone is on screen the whole time and says, in the learner's language, why
it is not available yet. For a child specifically, the microphone stays off
even after the contract exists until their own parent turns it on. *If a
customer asks:* "Voice is switched on per account by an adult, and we do not
send a child's voice anywhere until their guardian has said yes."

**2. A child gets two tutor sessions a day, up to twenty-five minutes each.**
This is deliberate, not a technical limit. It keeps the Tutor from becoming the
cheapest way to collect points and it keeps the cost of a learner predictable.
The tutor starts saying goodbye at fifteen minutes rather than being cut off
mid-sentence. *If a customer asks:* "Two conversations a day, and the tutor
winds the second one down kindly rather than hanging up."

**3. On a big screen, during the "choose your tutor" moment, Dina's name label
can sit close enough to Liruf to be read as his.** Every name label hangs
directly above the top of its own character. Dina is a large four-legged
dinosaur whose body is longer than she is tall, so the point above her is
further from her face than it is for the three who stand upright, and at the
desktop camera that puts her label near Liruf's head. On a phone — where most
of our learners are — it reads correctly. The fix needs each character's head
position measured and re-supplied by the people who made the models; the
skeletons we were given disagree with each other about where a head is (in one
of them the bone literally called "head" sits at the character's waist), so
guessing would move labels that are currently right. *If a customer asks:*
"The labels are anchored to each character; on a wide screen two of them crowd
each other. It is on the list and it is cosmetic — tapping either one still
picks the right character."

**4. The tutor's mouth is a drawing, not a rig.** None of the four characters
can physically open their mouth: their faces are painted on. What moves is a
small card laid over the mouth. It tells a learner who is speaking, that speech
is happening, and when it stops. It is not lip-reading and we should never
describe it as such. Under a dark or coloured sky the card is lit by hand
rather than by the scene, so it can be very slightly lighter than the face
around it — measured at worst about 50 of 255 brightness levels off, down from
about 135 before 2026-08-23, when it read as a white rectangle over the mouth.
*If a customer asks:* "The characters' faces are illustrated rather than
animated in 3D; the mouth moves as a drawing."

**5. A tall activity can need scrolling on a phone.** The question the learner
was asked and the button that answers it never move; where an exercise has more
options than fit, the options themselves scroll between them, and the edge of
the box says there is more. The learner can always see what they were asked and
always reach the control that answers it. *If a customer asks:* "Nothing is
hidden — the longest exercises scroll their answers, with the question pinned
above."

**6. The four characters are drawn at different sizes relative to each other.**
This is a property of the original artwork, not of the Tutor: inside a fixed
box a human renders at roughly half the apparent size of a dinosaur. It shows
up everywhere a character appears, including outside the Tutor. Re-framing the
four illustrations is a change to every screen in the product and needs its own
pass.

**7. The Tutor has per-learner limits AND, since 2026-09-01, a platform-wide
spending brake.** Until then it had only the per-learner ones — it could not be
exhausted by one child, but nothing watched the TOTAL, and "we would notice on
the invoice" is an autopsy rather than a control. Now the service keeps a
rolling 24-hour total of what the Tutor has actually cost, warns loudly well
before the ceiling (at half of it, by default), and once the ceiling is reached
declines to open any NEW conversation. A conversation already under way is
never cut off for this reason, and a learner turned away sees the same ordinary
"The tutor is resting. Try again soon." they would see for any other outage —
a business cost ceiling is not something to explain to a child. The numbers,
the settings and the tests behind it are §15.2 item 1. *What is still true:*
the total is counted inside the one server that runs the Tutor, so restarting
or redeploying it starts the count over, and none of this has been proven
against a thousand learners at once. *If a customer asks:* "There is a daily
spending limit on the tutor as a whole, on top of the limits on each child. If
it is ever reached, new conversations wait — nobody is cut off part-way through
one."

**8. The 3D island has been measured on a laptop GPU and a software renderer,
never on a mid-range phone.** On real GPU hardware (Apple M2, 2026-09-01) the
scene holds a steady 60 frames a second at both desktop and phone-sized
viewports, with not one dropped frame across two runs, and it draws about half
the triangles the design budget allows. That retires the old worry that every
frame-time number we had came from a renderer with no graphics card behind it
at all. What it does NOT tell us is how the same scene behaves on the mid-range
Android device a good share of our learners actually hold — a laptop chip is
not that phone, and no arithmetic gets you from one to the other. The quality
governor exists precisely for this: it lowers the scene's own ambition when
frames get expensive, and a learner on a weaker device gets a simpler island
rather than a stuttering one. *If a customer asks:* "The tutor's world adjusts
itself to the device it is running on. On a slower phone it draws a simpler
scene so it keeps moving smoothly."

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
| **ANY change to the Tutor's layout, composition or in-scene chrome** | `DESIGN.md` → §Screen Recipes → **Tutor**, in the SAME commit — it is the authoritative recipe (/AGENTS.md §1.1 rank 4) and this file's §9/§10 must agree with it. Added 2026-08-21 because the absence of that recipe is the root cause of the rejected build: §0 of DESIGN.md makes building outside a recipe a design bug, there was no Tutor recipe, and the screen got assembled from the nearest one that existed. |
| A new shot, anchor slot or HUD primitive | `/TUTOR_3D.md` §9 (the stage-side contract) + `DESIGN.md` §Components |

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

---

## §19 Tutor v3 — the pedagogical brain (2026-08-28, owner decision)

> **Status: the vertical loop is BUILT and gated; migration `0052` is pending
> in production.** Owner verdict on v2, verbatim in intent: the Tutor conversed
> safely but did not teach with direction — "no sirve de nada". The owner
> adopted the architecture of an external blueprint (a Synthesis-class
> adaptive tutor) with three constraints fixed in the same session: blueprint
> ARCHITECTURE on the locked §1.2 stack (zero new vendors this phase), the
> characters and the diorama KEPT as the product's identity, and money-math
> plus entrepreneurship as the anchor strands from day 1.

### §19.1 What the brain is

Five organs, each deterministic, each explainable to a parent:

| Organ | Where | What it does |
|---|---|---|
| **Knowledge-component graph** | Vault (`0052`: `kc`, `kc_edge`, `misconception`), seeded by `database/seeds/kc_graph.v1.json` via backend `npm run seed:kc` | The curriculum as a prerequisite DAG of units fine enough to master in one sitting — 28 KCs across two strands, 36 edges, 33 catalogued misconceptions with DETERMINISTIC detectors (numeric transforms of the item's own operands, authored distractor tags). `kc.skill_key` bridges to the existing content pools; null until an authoring pass maps it. Whether every mapped `skill_key` still reaches a PUBLISHED lesson is checked automatically — at seed time, and daily against production regardless of whether anyone re-seeds (`npm run audit:content-bridge`, `.github/workflows/tutor-content-bridge.yml`, RUNBOOK.md Round 105) — because the catalog can drift (an unpublish, an archived topic) without the seed file ever changing |
| **Online mastery (BKT)** | Core `services/pedagogy/bkt.ts` + `learner_kc_mastery` | Four-parameter Bayesian Knowledge Tracing, updated inside the GRADE request (never the voice turn), persisted per attempt with the posterior before/after in `kc_attempt`. Degeneracy guards in schema AND code (guess ≤ .30, slip ≤ .10); an epsilon clamp so no posterior ever freezes |
| **Spaced review (FSRS-style)** | Core `services/pedagogy/fsrs.ts` + `memory_card` | Stability/difficulty/due per (learner, KC). Deliberately not the trained 17-weight FSRS-6 — no data yet; same shape, swappable weights later. **Fixed 2026-08-29 (adversarial code review):** `grownStability`'s difficulty drag had no floor tied to the rating's own ease, so a `hard`-rated review — a PASSING grade, not a lapse — could multiply stability by LESS than 1 once difficulty crossed 3.5, which `hard` itself drifts difficulty past within the first couple of reviews from the default difficulty of 5. Proven with a throwaway simulation before the fix: a learner who kept answering correctly at `hard` collapsed to the 0.5-day lapse-collapse floor by the 5th review, with difficulty saturating toward 10 the whole way — the interval `again` exists for, reached by a string of correct answers. Fixed by clamping the drag floor to `1/ease` per rating, so a passing review's combined multiplier can bottom out at exactly 1 (flat, at worst) but never shrink; `easy` was already unaffected (its floor was already below the old fixed 0.4), and a genuine `again` lapse is a separate code path, untouched |
| **The session plan** | Core `services/pedagogy/sessionPlan.ts`, on the internal session context | Review debt first (due cards, capped at 2), then the ZPD frontier: KCs whose hard prerequisites sit at p ≥ .80, ranked by distance to predicted P(correct) = .75 plus unlock count, capped at 4. Entries carry the localized objective, weakest-first prerequisite ids (the PROBE path) and the KC's misconception hints. **Fixed 2026-08-29 (adversarial code review, LOW severity):** the frontier's exclusion set was built from the CAPPED review list (`dueCards`, after `.slice(0, MAX_REVIEW)`), not the full due list, so a KC overflowing the review cap was not dropped for this turn as intended — it silently reappeared one line down as `reason: 'frontier'`, reporting "this is new ground" for content that was actually overdue review, and taking a frontier slot from genuinely new material. Fixed by excluding every due KC from the frontier candidate pool, capped or not; confirmed with a test asserting the overflow KC is absent from the plan entirely rather than relabeled |
| **The strategy controller** | Oracle `tutor/controller.ts` | Twelve strategies (DIRECT, WORKED, FADED, SOCRATIC, FLUENCY, SPACED, PROBE, REMEDIATE, RESCUE, ELABORATE, TRANSFER, CELEBRATE) chosen per turn from mastery bands and server-witnessed events. Guardrails as pure tested rules: rescue fires once per slump and re-arms on progress, questions that go nowhere three turns running degrade to a faded example, difficulty never rises after a failure, ≤ 3 strategy changes per minute, PROBE judges "unexpected" on the PRE-update belief. Two of those were rewritten on 2026-08-29 after being MEASURED rather than read: "never two RESCUEs in a row" bounced a struggling learner between rescue and direct instruction on alternating turns forever, because the failure count stays high and every second proposal was downgraded rather than suppressed — the churn cap cannot see it, since real turns clear its sixty-second window. And the Socratic degradation counted only WRONG ANSWERS, which made it unreachable (two wrong answers trigger rescue first, any correct one resets it); it now counts turns that produced no correct answer at all, which is the case the transcripts actually show — a learner answering "no sé" is never assessed, so nothing in the controller could see them stuck. Fixing SOCRATIC alone then exposed the identical defect one band up — a learner who had mastered something and gone quiet was given FLUENCY, timed drills, seven turns running — so the rule applies to every questioning strategy, not the one §9.2 names. Mastery also now requires EVIDENCE and not only confidence: the BKT mirror takes a learner from 0.50 to 0.845 on one correct answer, so a plan entry was celebrated and left behind on evidence a guess produces one time in five, and a competent learner finished the whole session plan in three turns and spent the rest of the session with the controller dormant. Three assessed opportunities are now required, seeded from the learner's persisted `attempts`, which is the count the blueprint's own schema carries as `n_opportunities`. Mastery additionally holds when the answer was HESITANT — §8.3's "correcto + latencia alta → dominio frágil, no promover" — measured as a correct answer taking more than twice this learner's own median for that KC. The threshold is the learner's own pace deliberately: every absolute number would have been invented, and one tuned on a guess silently holds back every careful child. It refuses to judge with fewer than two prior measurements, and a null latency is never read as a fast answer. Both ends of the interval are server-side clocks, so nothing new is asked of the client and nothing new is stored about the learner (§1.9 untouched). The mirror signal guards the diagnosis: a WRONG answer given faster than a third of that median reads as a guess, and a guess must not set a misconception code. This matters more here than §8.3 suggests, because our content playbook requires every wrong option to encode a specific misconception and to be "tempting AND diagnostic" — so across 475 published lessons a child tapping at random lands on a diagnosed wrong idea nearly every time they miss, and the tutor would spend its next turns arguing against an idea the child never held while the real problem, disengagement, went untouched. The better the distractors, the more confidently wrong the diagnosis. A detected guess drops the code and carries an instruction to change the MODALITY rather than re-teach, and it never accuses — a child answering fast may be bored, tired or testing the toy. The turn checkers guard the same boundary from the other side, and one of them was wrong in the direction that WORSENS as the tutor improves: a bare mention of the screen was read as promising an activity, so the turn that reacts to a graded activity — which is supposed to name what the learner just did, in the past tense ("en la pantalla pusiste la moneda de 10 en la cubeta de 'necesito'") — was treated as an unkept promise, forcing a retry, spending a call and risking a worse turn in place of the best kind this tutor produces. A screen mention now counts only when the same sentence also OFFERS something and does not narrate what the learner already did. A sixth repair closes the last prompt-only prohibition — "never announce the SAME activity twice" was asked and never checked, which is the blueprint's golden rule ("if the differentiation is in the prompt, there is no product") and the sixth time in this file that a model followed what it was checked on and drifted from what it was merely asked. Both existing detectors miss it: one needs an exact sentence match, the other looks one turn back and forgives a pair whose numbers changed — right for TEACHING, where the same method on a new problem is good practice, and wrong for an ANNOUNCEMENT, which carries no pedagogical numbers. Observed in production: "vamos a practicar con monedas en la pantalla" three times in one conversation with three different tails, every check reporting the session clean. The first three were found by `npm run verify:pedagogy`, which drives the controller through learner profiles and asserts the SEQUENCE — the class of defect a per-rule unit test structurally cannot see. `plan.ts` remains the macro-phase spine; the controller decides HOW each beat is taught. Two more found the same way — an independent adversarial code review, 2026-08-29, deliberately hunting for the "told in a comment, never checked in code" shape this whole file keeps finding — and both proven with a throwaway test against the real controller rather than reasoned about: **TRANSFER was dead code, reachable through no input sequence at all.** `applyStrategy`'s CELEBRATE branch set `this.celebrated = true` and, in the SAME synchronous call, `advanceEntry()` unconditionally reset it back to `false` — so `this.celebrated ? 'TRANSFER' : 'CELEBRATE'` could never once observe `true`, despite TRANSFER having its own skill file (`transfer-probe.md`, "check it travels"), its own turn-policy budgets, and its own line in `STRATEGY_INSTRUCTIONS`. Driving two KCs to mastery in one session produced `[FLUENCY, FLUENCY, CELEBRATE, FLUENCY, FLUENCY, CELEBRATE]` — never TRANSFER — and `verify:pedagogy`'s own "learner who is simply getting it" profile had quietly read `CELEBRATE CELEBRATE` for as long as this file has been reporting it, which nobody had asked was actually two DIFFERENT strategies with the same name at that spot. Fixed by keying celebration per-KC (`celebratedKcIds: Set<string>`, not a single boolean advanceEntry could zero) rather than by delaying the plan advance — delaying it risked stalling the ONLY mechanism that moves the plan pointer at all on a learner who never gets a second qualifying opportunity on that exact entry before the session ends. TRANSFER is now reachable specifically when an already-celebrated KC comes back via spaced review (`reason: 'review_due'`) and clears the bar a second time — which is also the pedagogically right moment for "does it travel", not an artificial immediate recheck. `verify:pedagogy`'s same profile now reads `CELEBRATE TRANSFER`. **Second: a resolved misconception did not resolve in the field the model actually reads.** `misconceptionCode` is set ONLY inside the `activity_result`/`voice_result` branch of `decide()` — a `conversation_turn` never touches it, correctly, by the same design that excludes `conversation_turn` from re-entering ELABORATE. But a learner who deflects a REMEDIATE turn with an ordinary chat reply ("no entiendo, ¿podemos hacer otra cosa?") moves `this.strategy` on via `baseStrategy(entry)` just fine — `state().mode` correctly stops reporting `'remediation'` — while `misconceptionCode`, and the `misconceptionHint` `prompt.ts` sends the model from it, kept asserting the OLD diagnosis: a flat self-contradiction inside the SAME context payload ("Mode: new" beside "A specific wrong idea has been detected"), persisting across every conversational turn afterward until the next graded result happened to overwrite it. Fixed in `applyStrategy`: the instant the strategy itself leaves REMEDIATE, the diagnosis it was open for is resolved BY DEFINITION and the code is cleared — scoped to that transition only, so an unrelated aside mid-remediation (strategy stays REMEDIATE) does not erase a diagnosis still in force. **Third, found live in the browser as a struggling learner, 2026-08-30: the "no sé" fix above only covers SOCRATIC and FLUENCY.** DIRECT and WORKED — the bands a NEW or struggling learner starts in, below the 0.65 mastery floor where the questioning bands begin — had no equivalent. Playing a fresh account and answering "no sé" / "no entiendo" to a WORKED example produced a brand-new worked example with different numbers every turn — twice, reproduced deliberately — because a conversational shrug is a `conversation_turn`, never a graded failure, so `consecutiveFailures` never moved and rule 1's RESCUE could not fire, and the no-progress counter (`questioningWithoutProgress`) only incremented for SOCRATIC/FLUENCY. The counter now watches DIRECT, WORKED and FADED too, and a new rule fires RESCUE at the same three-turn threshold when one of those three bands is stuck — they have no lower rung to degrade to the way SOCRATIC/FLUENCY degrade to FADED, so RESCUE (validate the difficulty, make the next thing easier) is the response actually built for this, rather than the model being handed the identical instruction a fourth time and trusted to notice on its own that nothing is landing. `verify:pedagogy`'s "learner who answers 'no sé' and nothing else" profile changed from stalling in FADED indefinitely once reached, to one RESCUE mid-stall before FADED resumes — still no thrash, no repeated rescue. **Fourth, found live in the same browser session, 2026-08-30: the reaction to a graded activity invented a whole different activity's content.** On a true/false-plus-reason activity with no numbers in it at all, the reaction turn said "En la actividad, sumaste 4 más 4 y te dio 8, y eso estuvo bien" — lifted whole from an UNRELATED addition exchange three turns earlier in the same conversation. `orchestrator.ts`'s `handleSegmentResult` instructed the model to "Name the SPECIFIC thing they did — the numbers they chose, the order they put things in" on every activity alike, presupposing every activity involves numbers; `buildContextMessage` already handed the model the ACTUAL activity prompt ("ON THE LEARNER'S SCREEN RIGHT NOW..."), so the grounding was present, but an instruction demanding numbers that this activity never had gave the model nowhere true to point, and it filled the gap from the nearest numbers lying around in history. Fixed by generalizing the instruction to name whichever kind of answer THIS activity actually involved — a choice, an order, a match, a number — explicitly grounded in the activity already described above, rather than presupposing which. Proven with a test asserting the exact instruction text sent to the model on a non-numeric activity no longer contains the old unconditional phrase and does contain the new grounding language; a prompt-wording fix like this cannot be proven to stop the model from hallucinating by a unit test alone, only that the WORDING that invited it is gone — `tutor:converse` or further live testing is what would confirm the behavior itself. **Fifth, found live in the same testing, 2026-08-30: a worked example was repeated almost word for word, several turns after it was first asked.** `prompt.ts`'s `echoesPreviousTurn` — built to catch a REWORDED (not exact) repeat with the same numbers — only ever compared a candidate turn against `lastTutorSaid`, the single immediately-preceding turn. A RESCUE turn with different numbers sat between the original and its repeat — itself correctly untouched by every checker, since a different problem is good teaching — but it also reset the pairwise comparison, so a turn that echoed one from TWO turns back slipped through both existing checks: `echoesPreviousTurn` never looked that far back, and `repeatsEarlierSentence`'s exact-match requirement is exactly what rewording defeats. This is the identical shape `repeatsAnAnnouncement` was already built to close for ANNOUNCING sentences ("both checks either side of this one miss it") — just never generalized to ordinary teaching turns. Fixed with `echoesEarlierTurn`, which reuses `echoesPreviousTurn`'s own pairwise definition but checks it against EVERY earlier tutor turn in the session, the same shape the announcement check already uses. Proven with a test placing a reworded repeat two turns back, with a genuinely different problem in between (which must NOT itself be flagged), confirmed to fail against the pre-fix code — the repeat was delivered untouched, no retry attempted — before being trusted |

**The three-clocks rule** (blueprint §4.2) is structural: the voice turn never
waits on pedagogy. Mastery updates run inside Core's grade request; the fresh
posterior rides back to Oracle on the client-relayed, HMAC-SIGNED grade echo
(`recordAttempt.signGradeEcho` ↔ `oracle/src/session/gradeEcho.ts`, parity
pinned by test under the shared `TUTOR_SESSION_SECRET`). Only a valid echo may
feed the controller — the client-reported score still only colors the
reaction, exactly as v2.

### §19.2 Deterministic verdicts — the LLM never judges correctness

- **Graded widgets** were always server-authoritative (§8). v3 adds the
  evidence join: `provenance.kc_id` (stamped at serve time) routes the grade
  into misconception detection → BKT → FSRS → `kc_attempt`.
- **Spoken answers**: `POST /internal/segments/:id/voice-check`. Core
  normalizes the utterance to a number (`normalizeSpoken.ts`, three locales,
  "tres pesos con cincuenta centavos" → 3.50) and grades it with the REAL
  grader (or exact tray arithmetic). `recognized: false` is a no-op
  conversation turn BY CONTRACT — child speech through STT is noisy and
  unparseable must never read as wrong (§1.14). No XP on the voice path.
- **Misconception diagnosis is arithmetic**: the learner's number is compared
  against what each catalogued wrong idea would produce from the item's own
  operands (`a+b` for adds-instead-of-counts-up, etc.). What reaches the model
  afterwards is OUR catalogued remediation wording, never the learner's words
  (§4.1 row `pedagogy`, legal §2.2 item 12).

### §19.3 The experience half

- **The learning map** (`GET /api/v1/tutor/map`, `frontend/src/tutor/map/`):
  the KC graph made literal, derived from the SAME tables the planner reads so
  the map and the session can never disagree. Five node states — locked
  (naming its prerequisite), available, in progress, mastered, needs review —
  visible edges, and a CONTINUE that is the planner's own first pick. It
  replaces the v2 opening chips whenever the graph has nodes; the chips remain
  the graceful fallback (unseeded, brain off, failed read).
- **The money trays live** (`coin_count`, `make_change` on
  `LIVE_TYPE_ALLOWLIST`): self-contained payloads verified by COMPOSING an
  exact tray (bounded coin-change DP in cents); an unreachable target is a
  refused segment, never a served unwinnable one.
- **The tutor's hands** (`demonstrate` on the turn schema): 1–8 closed steps
  (add/remove/pause, denominations only) animated over the SAME controlled
  draft a real tap changes, input locked during the demo, aborted on
  interrupt, foreign denominations dropped fail-safe. §5's injection posture
  is unchanged — the field has no free text and no reach beyond the open tray.
  **Froze after one coin on any unrelated re-render — found by adversarial
  review, 2026-08-30 (HIGH).** `ConversationView.tsx` builds the `demo`
  prop as a fresh object every render; the demo effect depended on that
  whole object rather than on the one primitive (`seq`) that actually says
  whether it is a new demo. Any sibling re-render — a keystroke, a mic-level
  update — aborted the run mid-loop and then refused to restart, since the
  "already played" latch was set at the FIRST run, before the demo had even
  started moving. Fixed by depending the effect on `demo?.seq` alone
  (reading `demo`/`segment`/`verdict` from refs), plus `live.segmentId` as a
  genuine second dependency so a real segment change still aborts a demo in
  flight rather than letting it write into the wrong segment's draft.
- **Turn policy** (`policy.idleNudgeMs` on turn frames): per-strategy thinking
  time — Socratic beats wait ~45 s before any nudge; fluency work paces at 15.

### §19.4 Deploy posture and dormancy

Everything degrades to exactly-v2 while `0052` is unapplied, the graph is
unseeded, or `TUTOR_V3_BRAIN=false` in Core: the session context omits
`sessionPlan`/`kcStates`, Oracle's controller reports inactive, the sealed
context carries `pedagogy: null`, and the map endpoint returns the empty shape
that makes the client fall back to the v2 openings. Deploy order is therefore
free. Rollout: apply `0050`–`0052`, run backend `npm run seed:kc`, deploy
Core + Oracle + frontend in any order.

### §19.5 Deferred, explicitly (the v3 tail)

Not built this pass, recorded here rather than dropped: the conversing-phase
screen-state machine; the input-bar consolidation; the "un poco más"
extend-twice cap (subsumed today by the 2-sessions/day server cap, which is
the stronger control); per-KC content pools (`kc.skill_key` authoring pass);
per-learner BKT parameters; the teacher console. Each is an increment on the
organs above, none is a rearchitecture.

**The parent-portal "what is happening" narrative shipped 2026-09-01** —
moved out of this list into §12, where the rest of parent visibility lives.
**Step dots and replaying `demonstrate` animations also shipped 2026-09-01**
— the latter is §20.8, below; step dots is `lessonStepDots.ts` +
`ConversationView.tsx`, a small HUD affordance with no dedicated write-up of
its own here. Word-level caption highlighting and full-duplex VAD/barge-in —
the other two items this list used to carry — were investigated and closed
one each way; see §19.6.

### §19.6 The v3-tail investigation, closed one each way (2026-09-01)

Both items §19.5 named tersely ("needs provider timestamps" / "a
voice-provider project") turned out to have real, different answers once
actually investigated against Inworld's documented API rather than assumed
from the one-line backlog description.

**Word-level caption highlighting — BUILT, gated on a model switch nobody has
made.** Inworld's own docs (`docs.inworld.ai/api-reference/ttsAPI/
texttospeech/synthesize-speech`, checked 2026-09-01) describe `POST
/tts/v1/voice` — the EXACT endpoint `voice/inworld.ts` already calls, whose
documented response fields (`audioContent`, `usage`) already match this
adapter's existing parsing byte for byte, which is why the citation is
trusted rather than treated as one more unverified vendor claim. Sending
`timestampType: 'WORD'` there is documented to add
`timestampInfo.wordAlignment` (three parallel arrays: `words`,
`wordStartTimeSeconds`, `wordEndTimeSeconds`) to that SAME response — no
streaming, no transport change. The catch, and the reason this is gated
rather than shipped hot: that capability is documented ONLY for the
`inworld-tts-2`/`inworld-tts-2-flash` family, and `DEFAULT_TTS_MODEL` (every
production `.env` today) is `inworld-tts-1` — a model this codebase has never
sent that field to, on the "measured, not read off a documentation page"
standard this same file's header sets for itself. Nobody has run live
traffic to confirm an unsupported model politely ignores the field rather
than 400ing the whole request, and guessing wrong there risks the tutor's
entire VOICE for every learner, not merely a caption — the exact class of
defect `voice/inworld.ts` already paid for once (the OGG_OPUS outage
documented in that same file). So `voice/inworld.ts`'s `supportsWordTimings`
sends the field ONLY when the configured model already names itself
TTS-2-family, which nothing in production requests today: the request body
`inworld-tts-1` sends is byte-for-byte unchanged, pinned by a test
(`oracle/src/__tests__/voice.test.ts`). The rest of the pipe is real and
tested end to end — `voice/speech.ts` (timing rides a fresh synthesis only,
never a cache/pregenerated hit, which never fabricates a number for a clip
it did not just make), `TurnEmission`/`ws/protocol.ts`'s `turn_audio.
wordTimings` (omitted, never sent as `null`, when absent), and
`SpeechCaption.tsx` on the frontend, where the reveal boundary itself IS the
highlight — no separate highlight colour, because a synced reveal that is a
beat behind reads as an ordinary caption catching up and a highlighted PAST
word one beat behind the real audio would read as broken. It falls back to
the untouched pre-existing typewriter whenever timing is absent (every turn
today), whenever `audioElement` is unavailable, and — the accessibility
floor — whenever the clip is not ACTUALLY playing (blocked autoplay,
not-yet-started, already ended), because a caption that trusts a
`currentTime` stuck at zero is a caption that never reveals a word for the
one learner who has no sound to fall back on. **Remaining before this is
observable to a single learner:** a deliberate `INWORLD_TTS_MODEL` switch,
which is an owner-scale decision on its own — it changes voice quality and
latency for every session, and `voiceFingerprint()` keys the speech cache on
the model name, so flipping it invalidates and re-buys every cached and
pre-generated clip in `inworld-tts-1`'s name. That switch should be preceded
by the same live measurement this file's own culture always demands before
trusting a vendor claim: a `voices:verify`-style check that TTS-2 actually
returns timing for our enrolled voices, in all three locales, without
degrading voice-clone fidelity — none of which this pass could do, since
Inworld credentials do not exist in an isolated worktree and spending
against a model production does not use is not this lane's call to make
alone.

**Full-duplex VAD/barge-in — investigated, NOT built, and should not be
attempted as a shallow version.** The premise in the task that opened this
investigation was that the interrupt MECHANISM might be the missing piece;
it is not. `TutorExperience.tsx`'s `onInterrupt` already does both halves —
local squelch (`setInterruptedSeq` blanks `speechUrl`, which `TutorStage`
turns into an actual `pause()`) AND a server-side abort
(`socket.interrupt()` → `ws/server.ts`'s `case 'interrupt'` →
`live.abort?.abort()`, idempotent outside an in-flight turn) — and
`useHandsFreeTurn`'s own gate (`!speaking && !awaitingReply && !audioPending`)
means the microphone re-opens automatically the instant that interrupt
lands, with no code change needed. What is actually missing is narrower and
harder: a VOICE-DETECTED trigger for that same `onInterrupt`, in place of
the orb tap that fires it today. Producing that trigger needs a live
microphone stream OPEN WHILE THE TUTOR'S OWN AUDIO IS PLAYING, which this
codebase has independently and explicitly designed against, in writing, in
THREE separate places, for §1.9 reasons rather than engineering ones:
`useMicrophone.ts`'s own header ("Push-to-talk, deliberately... NOT open-mic
voice activity detection, and the reason is §1.9 rather than engineering
taste: an always-listening microphone in a child's room captures everything
said near it, including by people who never agreed to anything"),
`useHandsFreeTurn.ts`'s own header ("it is not an always-on microphone... it
never opens while the tutor is talking"), and the mic-in-use browser
indicator concern `useMicrophone.ts`'s `release()` documents as "a promise we
break" if left lit past its purpose. Building client-side VAD during
playback would mean an open mic, in a child's physical space, for the
DURATION of every tutor turn — not merely a wider consent SCOPE than
today's (which covers only audio captured while the learner is understood to
be answering), but the literal shape of "always-listening" these three
comments independently reject. It also has a real, unmeasured technical
failure mode this codebase has not needed to solve before: the SAME device's
own speaker output reaching the SAME device's microphone, on a shared
tablet with no headphones — the ordinary case for this product's audience —
which naive amplitude-based VAD reads as "the learner started talking" the
instant the tutor's own voice begins. Investigated whether the PROVIDER
could carry this instead: Inworld does sell a genuinely full-duplex product
with built-in, no-custom-logic barge-in and semantic VAD
(`docs.inworld.ai/realtime/overview`, "Speech-to-Speech API: Full-Duplex,
Sub-Second, Model-Agnostic") — but it is a DIFFERENT product from the one
this codebase integrates: a persistent bidirectional WebSocket/WebRTC/SIP
session (the OpenAI Realtime wire shape) in place of today's two independent
REST calls (`/tts/v1/voice`, `/stt/v1/transcribe`), which is the
ground-up voice-pipeline rewrite ORACLE.md's own architecture section
already anticipates as "a voice-provider project" rather than an increment.
Routing through it would also make the PRIVACY question strictly worse, not
better, than the client-side version: continuous ambient audio would stream
to a THIRD PARTY for the length of every tutor turn, not merely get analysed
locally — a materially larger and different processing activity than the
one `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md` and the existing consent gate cover,
and the DPA blocking rollout (/AGENTS.md §1.9, §16) was scoped to today's
capture-on-demand shape, not continuous streaming. Both paths cross the same
line for the same reason, so a scoped increment does not exist here — this
is left as a design finding rather than code, per this push's own
instruction that a project needing capabilities this codebase does not have
wired up at all should be written up rather than faked. Any future attempt
needs, at minimum: an explicit owner decision to relax the "not an
always-on microphone" posture (§1.9-adjacent, the same weight as the
existing carve-out in §0); a measured answer to the same-device echo
question BEFORE writing a line of client VAD code; and, if the
provider-side path is ever preferred, its own full privacy/consent/DPA
review as a second, separate carve-out — not a rider on the existing one.

## 20. V4 — the bicameral tutor (harness architecture)

**Owner decision, 2026-08-29.** The Tutor adopts the harness architecture from
`tutor-ia-harness-v2.md` under its own central warning: the harness never lives
in the voice path. Two chambers — the FAST chamber (this document's runtime,
< 1s, unchanged in structure) fed by a SLOW chamber ("the Preceptor",
asynchronous, seconds to hours). Integration is **patterns, not code** (the
document's own option A): Hermes Agent's patterns reimplemented in our stack;
running Hermes as a backstage service (option B) is a future decision requiring
owner sign-off against the §1.2 stack lock.

### 20.1 Pedagogical skills — procedural memory (SHIPPED)

`oracle/skills/moves/*.md`: hand-written didactic maneuvers in SKILL.md format
(frontmatter: `strategies`, `misconceptions`, `mastery_min/max`, `tiers`,
`priority`; body = the procedure, hard cap 1,600 chars). Loaded once at boot,
index in memory, only the SELECTED skill's body reaches the model — progressive
disclosure, zero I/O per turn, prefix cache untouched. Selection is
deterministic (blueprint §6.4 levels 0-1): a catalogued misconception forces its
dedicated remediation; otherwise strategy+tier+mastery-band filter, highest
priority. A skill dedicated to misconceptions is fenced OUT of generic
selection — counterexample-confront's own procedure forbids using it on a slip.
The one-line `STRATEGY_INSTRUCTIONS` remain solely as fallback.
`verify:pedagogy` asserts every controller decision resolves to a real skill.

**A rule the model is only TOLD does not hold; a rule it is CHECKED on does —
this catalogue itself needed the lesson (found live, 2026-08-29).**
`counterexample-confront`'s own procedure says "ONE counterexample per
session, ever," and `selectSkill` was a pure function of the current turn's
strategy/tier/misconception, with no memory of what it had already returned.
A `tutor:converse` run against production served the SAME learner the SAME
confrontation, in near-identical wording, four times in one session — the
learner kept failing the same skill, Core kept reporting the same
misconception code, and selection kept resolving to the same skill every
time. Closed with `onceOnly` (frontmatter `once_per_session: true`, today
only on `counterexample-confront`) plus `TutorOrchestrator.usedSkillNames`, a
per-session set the orchestrator fills as skills are delivered and
`selectSkill` fences a spent `onceOnly` skill out of BOTH the dedicated-
misconception path and the generic one, falling through to the next-best
candidate (`error-as-data`, the general remediation) — exactly
counterexample-confront's own step 5: "if it does not land, stop — degrade to
showing."

> **Fixed 2026-08-30 (adversarial review, MEDIUM): "delivered" meant
> "selected."** `skills.ts`'s own doc comment defines `usedSkillNames` as
> skill names already DELIVERED this session — but `strategyInstruction`
> added a skill to that set the moment it was SELECTED, before the model
> call it feeds even started. An interrupted turn (the learner cancels
> mid-production) or a retry exhaustion that falls back to a scripted line
> burned the ONE use of a `once_per_session` skill on a turn the child
> never actually heard, with nothing left to retry it. Fixed by splitting
> selection from commitment: `strategyInstruction` now returns a PROPOSED
> `skillName` alongside the instruction text, and each of its three call
> sites commits it to `usedSkillNames` only after `produce()` resolves with
> `emission.source === 'model'` — a turn genuinely delivered using the
> skill's own procedure, not an interrupt, not a scripted fallback. Proven
> with a throwaway test against the real orchestrator (an interrupted
> REMEDIATE turn, then a later one re-diagnosing the same misconception,
> confirmed against the pre-fix code to fall back to the generic REMEDIATE
> instruction — the skill already marked spent — and against the fix to
> deliver `counterexample-confront`'s real procedure again).

**Governance (§15.1 of the harness doc): nothing autonomous reaches a child.**
Today every skill is hand-written and enters through code review — the pull
request IS the approval gate. A future self-authoring loop stages proposals for
the same review; it never writes to the live catalogue.

### 20.2 The brain hears the conversation (SHIPPED — and the defect that demanded it)

Found 2026-08-29: `controller.decide()` had exactly one call site, reached only
from the two GRADED paths. Ordinary conversational turns — most of a session —
never consulted the controller: no strategy procedure ever reached the model
(only the enum name via the context message), and no `conversation_turn` event
was ever emitted, so the questions-that-go-nowhere guardrail was dead code in
production while its unit tests were green. `handleLearnerText` now emits
`conversation_turn` (or `voice_result` when the deterministic verdict ruled —
a system-verified answer is assessment evidence and moves mastery like a graded
activity), and the selected skill's procedure travels with every turn.

### 20.3 A session never ends mid-question (SHIPPED)

Both owner sessions of 2026-08-29 ended with the farewell landing immediately
after the tutor asked something. An ended budget now grants ONE grace turn when
the tutor's own last turn left a question or activity open: the turn carries an
explicit final-turn instruction (resolve, credit, close; ask nothing new) and
the next turn gets the scripted close regardless. Cost: at most one model call
per session. The soft-close line no longer promises "one last part" that never
existed; changed scripted text orphans its pregenerated clips deliberately —
first delivery per slot synthesizes fresh into the shared speech cache.

### 20.4 Learner memory, dossier and episodic recall (SHIPPED)

Migration `0053`: two curated prose stores per learner (`learner` 1,400 chars,
`pedagogy` 2,200 — the hard limit IS the curation: the writer must consolidate,
not grow), an append-only write ledger (no UPDATE/DELETE policy; not FK'd to
sessions, which purge at 90 days while the audit must not), and transcript FTS
(generated tsvector + GIN + a SECURITY DEFINER RPC scoped to one user).

**The post-session review** (`oracle/src/session/review.ts`) runs
fire-and-forget after `finish()`: one cheap model call reads the conversation
plus the existing stores and proposes complete replacements that fit the caps.
It refuses sessions with fewer than two learner turns, drops malformed shapes,
and drops WHOLE any proposal carrying identifier-shaped tokens (§1.9 re-check
after the prompt's own prohibition). Core validates limits and writes store +
ledger via `PUT /internal/learner-memory`.

**The dossier**: Core's session context now carries `learnerBrief`; Oracle
seals it as the fourteenth context field (§4.1 row, legal §2.2 item 14) and
renders it as the tutor's OWN notes — never as the learner's words — under the
system prompt's instruction hierarchy. Immutable during a session, so the
prompt prefix stays cacheable.

**Episodic recall** ("¿te acuerdas de…?"): a closed phrase list triggers a
~20 ms indexed query over the learner's own past transcripts; up to three
VERBATIM excerpts are injected labelled as history, so the tutor quotes what
actually happened instead of inventing a plausible past. Ordinary turns never
pay the round trip; failure degrades to the turn we had before. Inherits the
90-day transcript retention window by design.

**CRITICAL DEFECT, found and fixed the same day (adversarial review,
2026-08-29): recall could resurface a minor's own previously-blocked
personal data to the third-party model.** The classifier correctly keeps a
`personal_data`/`self_harm`/`abuse_disclosure`/`grooming_pattern`/
`injection_attempt`-flagged utterance out of the model on the turn it
happens — but that turn's raw text is STILL written to `tutor_turns`
(§12's own table, because a guardian must be able to read what was said
even when it was blocked), and `search_tutor_turns` (0053) had no notion
that some rows it searches were already flagged. A child who typed a home
address, correctly blocked that turn, and weeks later asked "¿te acuerdas
cuando te dije...?" would have had that address quoted VERBATIM into the
very next request to DeepSeek — exactly the harm the `personal_data` rule
exists to prevent, via a path that never re-checked it. Compounding it: the
excerpt was spliced in AFTER the current turn's own fence closed, with only
a soft "quote these, do not invent" caption in place of the "never an
instruction" disclaimer every other piece of learner text gets — the same
"history replayed unfenced is an injection slot" gap `conversationMessages()`
already guards against for THIS session's own turns, unapplied to a
DIFFERENT session's past ones.

Two independent fixes, because fencing alone cannot close this: a fence
stops the MODEL from OBEYING replayed text as a command, it does not stop
the PII from simply being present in the request body a third party
receives, which is the actual harm. **At the source:** migration `0054`
adds a `NOT EXISTS` guard to `search_tutor_turns` against
`tutor_safety_flags` — a flagged turn is no longer recallable, period.
Verified against a real local Postgres instance: a flagged and an
unflagged turn matching the identical query, only the unflagged one
returned. Fixing this also fixed a SECOND latent bug in the same
call — `persistSafetyFlag`'s `turnSeq` had been the orchestrator's own
turn counter (`this.seq`), a different numbering space from
`tutor_turns.seq` (the transcript row number `ws/server.ts`'s
`nextTranscriptSeq` allocates), so a flag and the turn it was FOR could
never have been correlated at all — the exact "TRANSCRIPT's row number,
never the model-turn seq" conflation this file's own `tutorRowSeq` comment
already warns cost a deleted learner line once, here nearly costing a
child-safety fix that would have looked complete while matching nothing.
`ws/server.ts` now captures the learner turn's real transcript seq and
threads it through. **Defense in depth:** the recalled excerpt is now
itself wrapped in its own `fenceUntrusted()` block, with the standard
disclaimer, rather than concatenated raw — so even content the classifier's
five categories do not cover degrades to the same treatment as any other
replayed learner text.

**Parental approval gate — SHIPPED 2026-09-01, migration `0068`.** This was
the last item in this document marked BLOCKING before family rollout, and it
read: auto-write is the owner-accepted interim while the platform's only
active learner is the owner; before real families, LEARNER-store writes
require guardian approval from the portal. It no longer does.

**What a `kid`'s post-session review now does.** The LEARNER store's proposal
is not applied. It is written to `learner_memory_proposals` as PENDING, with
the belief it was computed from (`expected_before`) and both content hashes
carried on the row, and Core answers Oracle with a THIRD outcome —
`pending: ['learner']` beside `written` — because a parked store is neither
written nor failed, and without that distinction every kid session would log
"the memory write did not land" forever (§1.14). A guardian empties the queue
from `/family/:kidId/tutor`; an approval applies the note through
`write_learner_memory_checked` (migration `0059`, the same function `0061`'s
pair wrapper calls), so the compare-and-swap and the append-only
`learner_memory_ledger` row are literally the same code as an ungated write.
The ledger's `actor` is `guardian-approved-review` rather than
`oracle-post-session-review`, so reading the trail back tells the two apart.

**The PEDAGOGY store is deliberately NOT gated**, for a minor or an adult. It
holds the tutor's notes about its own teaching method ("prefers a worked
example before the rule"), not a record of the child; gating it would ask a
guardian to approve a teaching technique, which is not a parental decision,
and would stall the tutor's ability to adapt behind an inbox. The split is
enforced by construction rather than by a caller remembering it: the proposals
table has no `store` column, its length CHECK is the LEARNER store's own 1,400
cap, and the decision function passes the literal `'learner'`.

**Adults are unaffected** — there is no guardian to ask, and an approval queue
nobody can empty would simply stop their memory from ever being written. Core
decides which path a write takes by reading `user_roles`, and a role read that
FAILS refuses the whole write rather than falling through to the ungated path:
the "default" there would be a child's note bypassing the gate because
PostgREST hiccuped.

**A verdict lands only on a still-pending row**, claimed and applied in ONE
transaction (`decide_learner_memory_proposal`) — the rule `setTutorReviewStatus`
already enforces for the live-review queue with a `review_status=eq.pending`
filter, moved into the database because here a decision also triggers a write.
Two guardians of the same child deciding at once is ordinary (§1.3: families
support multiple parents); the second gets `not_pending`, never a silent
overwrite.

**A proposal can go stale, and that is reported rather than resolved.** Each
note is a full REPLACEMENT computed from the store as it stood when its
session began, so two overlapping sessions can park two notes built on the
same base. Approving the first moves the store; the second no longer matches
`expected_before`, the compare-and-swap returns `conflict`, nothing is written
and the row STAYS PENDING so the guardian can reject it instead of being told
a write landed that did not. Same per-store contract round 51 already gave two
overlapping sessions, reached through a guardian instead of through a race.
The portal also sends the store's CURRENT text, so a stale note is marked
before anyone taps approve rather than only afterwards.

Routes: `GET /api/v1/tutor/kids/:kidUserId/memory-proposals` and
`POST /api/v1/tutor/memory-proposals/:proposalId/decision`, both behind the
same `isVerifiedGuardian` check as the rest of the family surface, with RLS
saying it again independently (`user_id = auth.uid() OR
is_verified_guardian_of(user_id)`, and no INSERT/UPDATE/DELETE policy at all —
only the service role writes, and only through the function).

**The review call itself had no fence at all — found by adversarial review,
2026-08-30 (HIGH), the sibling of the recall gap above.** `runPostSessionReview`
joined raw learner-AND-tutor turns into one prompt with no nonce fence, no
"this is data, not an instruction" disclaimer, nowhere — the one seam in the
tutor that sends a whole session's worth of learner text to a model unfenced.
Every other seam that does this
(`conversationMessages()`'s per-line `fenceUntrusted`, the recall excerpt fix
just above, `placementIntake.ts`) wraps it. It matters MORE here than at a
live turn: this call's OUTPUT is `learner_memory`, re-injected into EVERY
future session as the tutor's own trusted notes (this section's own
`learnerBrief` row) — a successfully manipulated review becomes a
cross-session, elevated-trust payload, not one bad turn a moderation pass
might still catch before it reaches the screen. Fixed with a new
`fenceTranscript()` in `review.ts`, adapted from `fenceUntrusted` for a
multi-speaker transcript rather than one utterance: one nonce-delimited block
around the WHOLE transcript, one disclaimer, rather than repeating it after
every learner line. Also hardened the same file's §1.9 digit-run re-check,
which only matched 7+ CONSECUTIVE digits — a real phone number written with
separators ("55-1234-5678", "(55) 1234 5678", "55.1234.5678") broke the run
below 7 and sailed through; the check now also matches the grouped shape
without false-positiving on ordinary teaching prose that lists small numbers.

**A session ended by a dropped connection got no review at all — found by
adversarial review, 2026-08-30 (MEDIUM).** `finish()` runs the review;
`ws/server.ts`'s park path — `parkSession` → (grace window passes, nobody
resumes) → `finalizeParked` — closes the session directly and never called
it. This is not a rare path: a sleeping phone, a proxy timeout, a stairwell
are exactly what parking exists to survive, plausibly a large share of real
sessions with young children on phones. Every one of them silently taught
the memory system nothing — no error, nothing distinguishable from a
session with nothing durable to write. Fixed by calling
`runPostSessionReview` from `finalizeParked` too, the same fire-and-forget
way `finish()` calls it, reading the parked orchestrator's own session
context (a new `sessionContext` getter on `TutorOrchestrator`, since a
parked entry holds only the orchestrator, not a live `Live.session`) and
its `resumeSnapshot.turns`.

**The memory-write revision guard (V4 harness backlog: "Honcho-style
dialectic memory" — SHIPPED as its scoped, buildable piece, 2026-09-01).**
Honcho (Plastic Labs) names its user-memory endpoint "dialectic" because it
answers a question about a person by reasoning ACROSS potentially
conflicting evidence at query time, rather than trusting one flat, pre-baked
summary — architecturally the opposite of `learnerBrief` above, which is
deliberately a small, session-start-FROZEN note so the model's prompt prefix
stays cacheable and the voice turn never waits on an extra reasoning pass
(§19.1's three-clocks rule). Reimplementing Honcho's actual agentic
query-time loop inside the fast chamber was considered and rejected for
exactly that reason. What genuinely was missing, and fits this codebase's own
grain: the post-session review already asks the model for a dialectical
SYNTHESIS in prose ("carry forward what still holds... drop what it
contradicted"), but nothing checked that synthesis before it was trusted
forever. `oracle/src/session/memoryRevision.ts` is that check — free,
deterministic, unit-tested, no model call — run immediately before the same
`updateLearnerMemory` call the 0059/0061 compare-and-swap protects, on the
same two values (`brief`, `proposal`): a bag-of-words comparison of each
store's OLD content against the Preceptor's proposed REPLACEMENT. When most
of a substantial prior note (≥2 observations) has no close counterpart
anywhere in the replacement, it logs a `console.warn` naming the store, the
survival ratio, and how many observations were dropped — never the note text
itself (§1.9's "no free-text history" instinct applied to our own server
logs, which carry weaker access control than the RLS-guarded table). It never
blocks the write: a lexical-overlap heuristic cannot reliably tell a
hallucinated reversal apart from a learner genuinely changing, and a false
block would silently starve the one thing this memory system exists to do.
The natural, costed escalation — a second judge call on a flagged revision
ONLY, asking specifically whether it looks fabricated — is deliberately NOT
built yet; see the module's own header for why (a new paid call per flagged
session needs the same cost-accounting care round 78 already had to fix once
for this exact review call, and it has no natural home in the child-safety
moderation taxonomy, since this is not a child-safety concern).

### 20.5 The whiteboard — a live visual synced to what the tutor says (SHIPPED)

**The defect, reported directly by the owner from a live session (2026-08-29):**
the tutor narrated a growth story purely in text — "empiezas con 10 y cada día
la caja te da 2 más… ¿y si empezaras con 20?" — while the activity panel showed
a completely unrelated true/false exercise about candy pricing, served by the
ladder's own last-resort "frontier" fallback (§7). Nothing anywhere rendered
what the tutor was narrating; `demonstrate` (§9.3) could only nudge coins in an
already-open tray, 2 of 57 segment types, and every other visual in the Lesson
Engine catalog is static, pre-authored content chosen by skill+difficulty, with
no synchronization guarantee to the current turn's story at all.

**The shape:** the narrowest general primitive that covers most of what this
tutor narrates — a live, animated value SEQUENCE. `TutorTurnSchema` gained
`whiteboard: {kind:'sequence', start, steps: [{op:'add'|'subtract'|
'multiply_percent', value}] (1-8), label, currency}`, the same closed-vocabulary
posture §5 already applies to `demonstrate`: numbers and a three-item operator
enum, no free text drawn, bounded ranges (`start` ≤ 1,000,000; a step value ≤
100,000; every intermediate ≤ 10,000,000). A turn may not carry both
`whiteboard` and `segmentRequest` — schema-refused — because a board and a
graded activity competing for the plate in one turn is exactly the
disconnected-surfaces bug this closes.

**The numbers are computed, never taken on the model's word** — the same rule
`arithmetic.ts` applies to a spoken answer, extended to what gets drawn.
`oracle/src/tutor/whiteboard.ts`'s `computeSequence()` re-derives the running
values from the model's own `start`/`steps`; a result that goes negative,
non-finite, or past the ceiling drops the whole whiteboard as if the model had
not set one (fail-open, the `checkAnswer`-null posture) rather than show
whatever came out. The turn frame carries `values` computed a SECOND time at
the wire (`ws/server.ts`) from the same function, so a value the client
receives was verified at the moment it was sent, not merely at authoring time.
The `label` — the only free text on the field — is moderated in the same call
as `say` and `segmentRequest.framing` (the exact gap that let `framing` reach a
child unmoderated for one day, until 2026-08-29, is not reopened here).

The prompt tells the model, under "Show your work": whenever a story involves a
quantity that changes over two or more steps, set `whiteboard` with the SAME
numbers the story uses, instead of only saying them — `say` narrates and asks;
the board carries the running values, so an intermediate number is not spoken
AND drawn.

**Two defects found by actually USING the shipped feature, not by unit tests
(2026-08-29):** first, on the owner's own growth-story scenario the real
production model told the story and never set `whiteboard` at all — the
instruction alone was not reliable. `oracle/src/tutor/prompt.ts`'s
`narratesUnshownGrowth(say, whiteboard)` detects a repetition cue ("cada
día/semana/mes/año", "every day/week/month/year") plus two or more numbers with
no whiteboard set, and the orchestrator's existing repair loop (§9, the same
mechanism that catches false praise and a given-away answer) retries once with
a correction — the model follows what it is CHECKED on, not merely told, the
same lesson §1.14 already draws from the pedagogy guardrails.

Second, `WhiteboardSchema` had no notion of TIME: a board was `{start, steps,
values, label, currency}` and the axis was rendered as `Día 1`, `Día 2`,
regardless of what the story actually said. A live session showed this
directly contradicting itself — the tutor said "cada semana te dan 2 más"
three times while the board under it read "Día 1 / Día 2", the exact kind of
disconnect this feature exists to close. Closed with a required
`unit: 'day' | 'week' | 'month' | 'year'` field (closed vocabulary, §5): the
model must name which unit its own story used, the frontend now renders
`Semana 1` / `Week 1` / `Semana 1` (locale-specific, `tutor.whiteboard.step.
<unit>`) instead of a single hardcoded label, and
`whiteboardUnitMismatch(say, whiteboard)` deterministically compares the FIRST
cadence word in `say` against `whiteboard.unit`, feeding the same retry loop
when they disagree. Neither field touches the model's input context or §4.1 —
both are output-side turn fields, same posture as `demonstrate`.

**Frontend** (`frontend/src/tutor/TutorWhiteboard.tsx`): deliberately NOT a
Lesson Engine component — this has no grader, no key, no XP, and is owned
entirely by the tutor surface (LESSON_ENGINE.md §4's family-boundary
convention). Renders in the SAME `LessonPlate` a graded segment would occupy
when no segment is present, so it inherits every overlap fix already built for
that surface for free: the caption docks to the panel's own free space instead
of losing an unwinnable escape budget against it, the sheet rises to `half` the
same way an announced segment does, and the transcript yields height the same
way. `verify-tutor-ui.mjs` drives a dedicated lab scenario for EVERY kind
(`whiteboard`/`sequence`, `compare`, `marked-line`, `categories`) and runs the
SAME sweep + geometric overlap audit already built for segments against each —
0 unreachable controls, 0 overlaps, caption never under the board.

A graded segment always wins the plate if somehow both are present (the schema
refusal makes this unreachable in practice).

**`preferredTypes` — SHIPPED 2026-08-29.** `segmentRequest` gained an optional
`preferredTypes` field, closed to exactly `interest_peek` and `number_line` —
a preference, not a new authoring surface, so the vocabulary stays as narrow
as the two segment types it exists to reach. `tutorLadder.ts`'s
`orderCandidates()` tries a matching-type candidate FIRST at every
catalog/bank lookup (the named skill, its prerequisite fallback, and the
frontier fallback itself), sorted by difficulty only within that group,
before falling through to the ordinary any-type difficulty sort — a
best-effort preference, never a hard filter, so a skill with no visual
segment yet is never turned into an outage. The prompt tells the model to set
it right after a growth or spending story, or whenever a number line would
show the idea better than more words.

**CORRECTED the same day: enforcing the closed vocabulary at the turn schema
was itself a defect, not just an inefficiency.** The first version of this
feature validated `preferredTypes` with `z.enum(['interest_peek',
'number_line'])` directly on `TutorTurnSchema`. Measured on the real model
twice: the first run set an invalid value on the FIRST attempt, the retry
dropped it, and the run reported clean — read at the time as "the repair
loop recovered, low-severity efficiency gap." The very next run set an
invalid value on BOTH the first attempt AND the retry, exhausting the
repair budget, and the child got the scripted "se me enredaron las ideas"
line instead of any real reply to what they had said — a whole turn lost
over one optional hint field the rest of the turn had nothing wrong with.
The first measurement was real but incomplete: it proved the safety net
catches a bad guess, not that catching it is free.

Fixed properly rather than patched with a sharper prompt: `preferredTypes`
is now loose at the turn schema (any strings, so a bad guess can never fail
shape validation and take the turn down with it) and a new
`sanitizePreferredTypes()` — the actual closed vocabulary — filters it down
to the two real values (or `null`) in `ws/server.ts`, right before it
reaches Core, which still enforces the enum itself. The same fail-open
posture `computeSequence` already gives a whiteboard whose arithmetic does
not check out: a malformed hint degrades to no hint, never to a lost turn.
General lesson for the next optional, model-set hint field this pattern
gets applied to: OUTPUT-side closed vocabularies that gate the whole turn
are the wrong shape whenever the field they gate is a preference rather
than something the turn's correctness depends on — sanitize after parsing,
don't reject at parse time.

**`servedDifficulty` — the ladder now says which band it ACTUALLY served
(round 74, 2026-08-30).** The ordering above picks by difficulty DISTANCE and
takes the nearest, and the prerequisite and frontier fallbacks reach into an
entirely different topic — so answering a request for band 4 with a band-2
segment is ordinary, correct behaviour. It was also invisible: every
`difficulty` in `POST /segments` was the REQUESTED value, so Oracle's own
`lastDifficulty` ratchet kept adjusting from its own guess rather than from
what reached the child's screen, and since every adjustment in `decide()` is
made relative to that field the gap survived the rest of the session. Core's
BKT posterior is difficulty-agnostic, so nothing persisted was corrupted —
this was Oracle's local adaptive state alone. The response now carries
`servedDifficulty`, read off the chosen segment or pack row, and `null`
rather than a default when the segment declares none (the sort's own `?? 3`
tie-break must never be reported as a fact about the content). `ws/server.ts`
hands it to `noteSegmentServed`, which passes it to
`PedagogicalController.reconcileServedDifficulty()`. The reconcile corrects
the ratchet's MEMORY and not the plan — `decide()` re-bases on
`entry.targetDifficulty` every turn, so it cannot pin a learner low — and it
warns only at a gap of two bands or more, since a one-band substitution is
the ladder working as designed. Nothing new reaches the model: this steers
which band the NEXT request asks for, and never enters the sealed context, so
§4.1 is untouched. `ServedSegmentSchema` is `.strict()`, which makes the
deploy order load-bearing: **Oracle before Core**, or an old Oracle rejects
the new key and every activity becomes `NO_SEGMENT`.

**`compare` and `marked_line` — the two additional `kind` values, SHIPPED
2026-09-01.** See "Two more kinds" below.

**`categories` — a second bounded kind, the first slice of "UI generativa
acotada" (SHIPPED).** Blueprint §10.4 and this section's own backlog note
called for a general free-form canvas — a multi-week content-pipeline
feature (schema, CAS verifier, age classifier, content bank) that a scoping
pass (below) concluded is not buildable responsibly in one slice, because
"free-form" at that scope means the model choosing an open-ended VISUAL
LAYOUT, not merely open-ended numbers inside a fixed layout — a materially
different, and materially riskier, kind of generation than anything else
`whiteboard` does. What IS a genuinely bounded, closed-schema, useful-today
next step is narrower: most of what a tutor narrates that `sequence` cannot
draw is not a second TIME axis, it is a comparison across a handful of
NAMED things at one instant — an allowance split across needs/wants/savings,
three products' prices, two savings goals; `compare` already covers the
fixed-two-sides case, so `categories` is that same idea generalized to 2-6.
`WhiteboardSchema` (`turnSchema.ts`) is now a `z.discriminatedUnion('kind',
[...])` and gained `{kind:'categories', categories: [{label, value}] (2-6),
label, currency}` — the exact same closed-vocabulary posture `sequence`
already uses: a bounded count, a bounded number per bar, one moderated short
label per bar (folded into the SAME `orchestrator.ts` moderation call `say`
and the board's own top-level `label` already join), and a server-side
recompute-and-verify step (`whiteboard.ts`'s `computeCategories`, wired into
`whiteboardComputesOk`'s and `toWireWhiteboard`'s per-kind switches
alongside `computeSequence`/`computeComparison`/`computeMarkedLine`) that
drops the WHOLE board — never partially trusts it — on any doubt, including
the one thing a single category's own schema cannot see: two bars sharing a
label. No new field reaches the model's sealed input context (§4.1
untouched, same posture as `sequence`); this is exclusively an OUTPUT-side
turn field. **Frontend:** `TutorWhiteboard.tsx` gives `categories` its OWN
component (`CategoriesBoard`), the same posture `compare`/`marked_line`
already established rather than a shared wrapper (see the "Frontend
architecture note" below for the exact bug that posture avoids) — it renders
fully immediately, no grow-in reveal, the same "a snapshot, not a process"
reasoning as `compare`: several named things at one moment have no story
unfolding over steps for a `sequence`-style reveal to pace against. It
reuses the announcement/`role="img"` shell, the zero-height floor and the
currency formatter as plain shared functions, the same way `compare`/
`marked_line` do; only the per-bar CAPTION source is new — `categories[i].
label`, a plain moderated string, no i18n key, unlike `sequence`'s
translated day/week/month/year captions. Core's `POST /turns` body schema
and `listTutorTurns`'s read-time re-validation (`backend/src/routes/
tutor.ts`, `backend/src/services/tutorData.ts`) were widened the same way,
so a categories board is not the ONE thing round 35's fix (below) was about
all over again — reaching the learner's screen and nowhere else.
**Both gaps this slice deliberately left open were CLOSED on 2026-09-01, at
the owner's request.** What they were, and what closing them actually found,
is recorded below rather than deleted — the reasoning that left them open was
sound, and the fact that it was later overruled is part of the record.

*The gap:* drift detectors analogous to `narratesUnshownGrowth`/
`whiteboardNumberMismatch`/`whiteboardDoubledPeriodSteps` — every one of those
was written AFTER a real production session showed a SPECIFIC, reproduced way
the model's words disagreed with its own board; none were theorized ahead of
evidence. `categories` had no live sessions behind it, so writing one then
would have been guessing at a defect that may not be the one that actually
occurs. *What changed:* the owner asked for it, and **there is still no live
transcript behind it** — that has not changed and is not claimed. What makes
building it anyway defensible is a property `sequence` never had: THIS BOARD
NAMES ITS OWN PARTS. `sequence` has to recover "which period is this sentence
about" out of freeform prose, which is why its history is a catalogue of
ordinals, cardinals, contractions and a Portuguese verb list; a `categories`
bar carries a LABEL the model itself wrote and the child can read on screen,
so the anchor is the model's own word for the thing, followed by a copula,
followed by a number. `whiteboardCategoryMismatch` (prompt.ts) checks a bar's
own amount misquoted beside its own name, and a stated total that is not the
sum. It deliberately does NOT check a superlative naming the wrong bar as the
biggest — the anchor for that is a bare "más"/"most" near a label, which is
too common to be safe with up to six bars — and that remains open, for the
original reason, until a transcript shows the wording.

*The second gap:* a dedicated `verify-tutor-ui.mjs` E2E lab scenario. The
argument for leaving it out was that the existing `whiteboard` scenario
"already exercises the shared container/DOM shape this kind renders into (the
same `WhiteboardShell` wrapper every kind draws through)." That is true of the
SHELL and false of the thing that has actually broken on this surface:
`CategoriesBoard` draws its OWN `height: N%` bars, and a percentage height
that never resolves is exactly the defect that rendered `sequence`'s bars at
ZERO PIXELS in every real browser from launch (below). A per-kind component
with per-kind bars needs a per-kind measurement; inheriting a wrapper is not
inheriting a layout. `categories` now runs in the same loop as the other
three — reachability sweep, overlap audit, caption-under-board, and the
real-pixel bar-height check — and passes.

**Scoping note on the remaining "general free-form canvas" (still backlog,
blueprint §10.4).** Before building further along this axis, three product
decisions need a human answer, not an agent's guess: (1) does "free-form"
ever mean the model choosing among a small library of FIXED layout
templates (closer to what `sequence`, `compare`, `marked_line` and
`categories` already are, just more of them), or does it mean genuinely
arbitrary visual composition (node/edge diagrams, icons, arbitrary
positioning) — and if the latter, is that something this product wants for a
minor's screen AT ALL, given §1.14's "generated content must be verified for
SUBJECT, not only form" already describes exactly the failure mode an
open-ended layout invites; (2) if any part of this ever involves an actual
GENERATED IMAGE rather than a chart drawn from numbers, that is
`picturegen`'s domain (the only image-generation path, §1.5) and needs its
own art-director-judge + cache design, not a new one grown inside Oracle;
(3) "CAS verifier, age classifier, content bank" in the original backlog
line describes infrastructure that makes sense once there is a CONCRETE
schema it verifies, classifies and banks — building it first, ahead of that
schema, is the speculative-abstraction trap `/AGENTS.md`'s own philosophy
warns against, so the next slice (if there is one) should again start from
one narrow, closed schema, proven live, before any shared pipeline is built
to serve it. Still backlog, not silently dropped, pending the three
decisions above: whatever "free-form" turns out to responsibly mean beyond
the closed family `sequence`, `compare`, `marked_line` and `categories`
already cover.

**ANSWERED — as a plan, not as built work, 2026-09-02. `/TUTOR_INSTRUMENTS.md`
is authoritative for everything past this paragraph; this section stays
authoritative for the four kinds that actually exist.** The three decisions above
now have a written recommendation and a 21-sprint plan behind them, and the
recommendation on the first one is that **"free-form" should mean neither option
as posed**: not an arbitrary canvas, and not a resigned four. The dilemma was
false because the binding constraint was never expressive range — it was that one
kind costs 17 files and five hand-mirrored schema copies across three services
with no compiler check between them, which is the same gap that shipped
`compare`/`marked_line` without Core's branch and lost their boards silently on
replay. Pay that down once (a nine-primitive drawing kit verified in a real
browser; an instrument manifest plus an `instruments:check` parity gate in the
`provider:check` idiom; instrument hints carried by the per-turn move rather than
the system prompt) and a catalog of ~41 NAMED, individually verifiable
instruments becomes affordable — which is strictly more expressive than a canvas
AND strictly more checkable, since each one can be caught contradicting what the
tutor says while a canvas cannot. The other two answers: generated imagery is
Prism's, batch-only and pre-warmed against the 28 KCs, never called from a turn
(60-120s per attempt, up to 3 verification attempts, $0.075 each — measured, not
estimated); and the CAS-verifier/age-classifier/content-bank pipeline stays
deferred, while the primitive kit does NOT, because without it the catalog is
unaffordable. The catalog itself was derived rather than invented: two thirds of
the 33 procedural moves in `oracle/skills/moves/` already instruct a physical
staging no surface here can perform ("keep the coins on the table where they can
be picked up", "leave the three places UNNAMED", "draw the bar before any
operation"), and the plan also adopts the canonical primary-maths vocabulary the
four current kinds omit entirely — bar models, ten frames, number bonds, open
number lines, fraction strips, arrays. **Nothing is built, and three owner
decisions gate the first wave** (`/TUTOR_INSTRUMENTS.md` §8.2, mirrored in
`ROADMAP.md`'s Open decisions). Two corrections that belong in THIS section and
are recorded there: §19.1's "33 catalogued misconceptions" is wrong — the seed
file has 32 — and the deploy order for a NEW whiteboard kind is **Core before
Oracle**, the reverse of the `servedDifficulty` note above, because `POST
/turns`' body is a discriminated union with no fallback member, so an unknown
`kind` fails `safeParse` whole-cloth and 400s the entire turn rather than
dropping the board.

**A valid decimal sequence could compute to "negative" by a hair and lose
the whole board — found by adversarial review, 2026-08-30 (MEDIUM).**
`WhiteboardStepSchema.value` is a plain `z.number()`, not an integer — money
amounts and fractions are legitimate steps — and `computeSequence`'s guard
was `current < 0`. In JS floating point, `0.3 - 0.1 - 0.1 - 0.1` is
`-2.7755575615628914e-17`, not `0`; a perfectly valid "spend it down to
zero" sequence with decimal steps landed a hair below zero and was dropped
exactly as if the model had proposed a genuinely nonsense board. Fixed with
a `ZERO_EPSILON` tolerance (`1e-9`): a running value within that band of
zero is clamped TO zero rather than rejected; anything further negative is
still refused, unchanged. `whiteboard.test.ts` covers both sides — the
`0.3 − 0.1 − 0.1 − 0.1` sequence now computes to `[0.3, …, 0]`, and a
sequence that goes genuinely negative (not floating-point noise) is still
null.

**Two more kinds — `compare` and `marked_line`, SHIPPED 2026-09-01.** The
backlog line above turned out accurate about the SCHEMA ("same family,
straightforward") and understated everything downstream of it.

`kind: 'compare'` is two SEPARATE, static quantities side by side —
`{left: {label, value}, right: {label, value}, label, currency}` — for a
story that puts two things next to each other ("¿cuál te conviene más?")
rather than one quantity moving over time. Deliberately NOT two nested
`sequence`s: the backlog line asked for two values side by side, not two
growth stories side by side, and nothing observed live has asked for the
richer shape yet. The schema gives the model no field to state the
comparison's OWN conclusion — `whiteboard.ts`'s `computeComparison` derives
`difference` and `greater` (`'left'|'right'|'tie'`) from the two raw values,
and neither is ever taken on the model's word, the exact rule `values`
already has for `sequence`, applied to a derivation with no fold to get
wrong instead of an N-step one. `kind: 'marked_line'` is one or more values
placed on a line between two references — `{min, max, marks: 1-4 of
{value, label}, label, currency}` — for a story about WHERE a number sits
("tienes 22, y algo cuesta 35 — ¿cuánto te falta?") rather than a moving
quantity or two options with no shared line. `max > min` and every mark
actually falling inside `[min, max]` are relationships between fields
`z.discriminatedUnion` cannot carry a `.refine()` for (each member must
stay a plain `ZodObject` for the discriminant to be readable) — exactly
the split `sequence` already has between what the schema bounds per-field
and what only `computeMarkedLine` can catch, run at authoring time
(orchestrator.ts) and again at the wire (ws/server.ts), same as
`computeSequence` always was. `computeMarkedLine` also derives each mark's
`position` (0..1 along the line) — server-computed, the client (`Tutor
Whiteboard.tsx`) only ever draws it, never re-deriving it from
`value`/`min`/`max` itself.

Named `marked_line`, never `number_line`: the Lesson Engine already has a
GRADED segment type spelled `number_line` (`frontend/src/lesson-engine/
families/arrange/schema.ts`), reached through `segmentRequest.
preferredTypes` a few paragraphs above this one — an entirely different,
pre-authored, scored activity. Reusing that string for this ungraded,
live, tutor-drawn visual would put two unrelated concepts under one name
in this same section.

**Every prose field either kind adds joins the SAME moderation call `say`
already goes through, from ONE place, not a hand list at each call site.**
`turnSchema.ts`'s `whiteboardVisibleText(whiteboard)` returns every
learner-facing string on a board regardless of `kind` — the top-level
`label` plus `compare`'s two side labels or `marked_line`'s up to four mark
labels — and both orchestrator.ts call sites that gather a turn's visible
text (the moderation call, and the tier-vocabulary/language-drift checks
beside it) go through it. Built this way FROM THE START, rather than found
missing after the fact, because `segmentRequest.framing` and `whiteboard.
label` had each already cost their own incident for exactly this shape of
gap (this section and oracle/AGENTS.md §2.3).

**The sequence-specific narrative-consistency repairs above this line —
`narratesUnshownGrowth`, `whiteboardUnitMismatch`, `whiteboardNumberMismatch`,
`whiteboardDoubledPeriodSteps` — were deliberately NOT reproduced for the two
new kinds, and that was REVERSED on 2026-09-01 at the owner's request.** Every
one of them exists because a REAL model, on a REAL session, was caught doing a
specific wrong thing over several rounds of live observation (round 65, round
67, the owner's own transcripts). No such observation existed for `compare` or
`marked_line`, and **none exists now either** — that is stated plainly rather
than quietly dropped, because the two facts that make these safe to build
anyway are structural, not evidential:

- **The board names its own parts.** A `compare` side has a LABEL the model
  wrote and the child reads on screen, so the anchor is "the model's own word
  for the thing, a copula, a number" rather than a guess at what a number in
  freeform prose refers to. That is a materially stronger anchor than anything
  `sequence` ever had.
- **Only an assertion can contradict a board.** This tutor asks for a living,
  so "¿la paleta cuesta más que el helado?" is the single most likely sentence
  on a `compare` turn — and reading it as a claim would fail the tutor for
  teaching correctly. Every check drops question clauses before a pattern is
  applied (`assertionClauses`, prompt.ts).

`whiteboardComparisonMismatch` checks a side's amount misquoted beside its own
name, a stated difference that is not `computeComparison`'s, and the cheaper
side being called the dearer one (refusing when BOTH sides match the
comparative shape, and when the two values tie). `whiteboardMarkedLineMismatch`
checks a stated shortfall or difference against the gap between the marks, and
**only on a TWO-mark board** — with three or four marks there are three or six
gaps and nothing says which one a spoken number means, so no claim is made. All
three new checks fail open on a board their own `compute*` function refuses,
and share `NUMBER_TOLERANCE` with `whiteboardNumberMismatch`.

What was already carried over unconditionally, because it is the safety
property this whole feature exists for rather than a tuned heuristic: the
fail-open posture (`parseTurn`'s per-field schema retry drops a malformed
board, never the turn), the authoring-time AND wire-time recompute, and
moderation of every prose field. `oracle/prompt.ts`'s "How you teach"
section gained one worked example per kind (`45`/`28` for `compare`,
`22`/`35`/`0`/`40` for `marked_line` — none reusing a number already
spoken for in an earlier example, per this file's own anti-copy
discipline), but **neither instruction has been measured against a real
model conversation** the way `sequence`'s own "SHOW YOUR WORK" line was
(`step=probe-prosody`-style measurement, or `tutor:converse`) — that is
the same gap `sequence` itself had before round 74 found the instruction
alone was not reliable, and it is left open here rather than closed on a
guess.

**`TUTOR_SYSTEM_PROMPT` was deliberately NOT touched when the three detectors
above were added (2026-09-01), and that is a choice rather than an oversight.**
The prompt's "SHOW YOUR WORK" line already says to use the SAME numbers the
story uses, and it says it in the `sequence` context; widening it to name all
four kinds is a real improvement and it belongs in a change that can pay for
`gh workflow run tutor-deploy.yml -f step=converse` — the one gate that
answers "was that a good lesson" rather than "did the machinery work"
(/AGENTS.md §5), which is paid, model-dependent, and the only honest way to
tell whether a new prompt line lands. Shipping a prompt edit whose effect was
never measured is precisely what round 74 caught. In the meantime the
deterministic layer is doing the work it always does here: each of the three
repair corrections in `orchestrator.ts` states the specific rule AT THE MOMENT
IT IS BROKEN, which is the mechanism this file already trusts more than a
standing instruction — the model follows what it is CHECKED on.

**Reusing the SAME rendering surface meant reworking IT, and reworking it
found two defects already live in `sequence` — neither one from THIS
change, both found only because a real browser, not a unit test, was asked
whether the board a child sees actually has the numbers it claims to.**
`TutorWhiteboard.tsx`'s bars are a value span above, a bar below, a caption
below that, inside a flex ROW whose OWN `align-items: flex-end` was meant
to sit every bar on a shared bottom baseline. It does the opposite: it also
stops each bar-COLUMN from stretching to the row's own height, so the
column's height becomes intrinsic/content-sized — not a definite
containing block — and a bar's `height: N%` cannot resolve against an
ancestor whose own height is still being derived FROM that percentage. Per
the CSS sizing spec this behaves as `height: auto`, so every bar rendered
at **zero pixels, in every real browser, since the feature shipped** —
only the number above it and the caption below it were ever visible.
Compounding it: the bar's fill was `bg-[color:var(--lf-accent)]/70`, an
arbitrary-value utility referencing a design token that is a bare "R G B"
triple (`--lf-accent: 79 70 229`, meant to be used inside `rgb(var(...) /
<alpha>)`, exactly what `tailwind.config.js`'s own configured `accent`
token does). Tailwind cannot decompose an opaque `var()` reference at
build time to attach the `/70`, so it emitted `background-color:
var(--lf-accent)` — an invalid color a browser silently discards — with no
alpha applied either way. Both defects are invisible to jsdom (which never
lays anything out at all, so every existing unit test's `toHaveStyle({
height: '71%' })` was checking the intent, never the result) and to a
screenshot nobody zoomed into closely enough to notice a bar occupying
zero vertical pixels between a number and a caption that were themselves
perfectly readable. Fixed for `sequence` and built correctly from the
start for `compare` (the two kinds sharing this bar-chart shape): the bar
sits inside its OWN track (`flex-1 min-h-0 items-end`), which is what now
carries the row's stretched, definite height down to the bar, with
`items-end` moved onto the track so the bar still grows from a shared
bottom baseline; the fill is `bg-accent/70`, the CONFIGURED token, which
Tailwind can correctly attach an alpha channel to. `verify-tutor-ui.mjs`'s
whiteboard scenarios now measure every percentage-height bar's actual
`getBoundingClientRect().height` in the real browser it already opens, on
top of the reachability/overlap checks it already ran — the only place a
regression of this specific class could ever be caught, and the reason
`categories` got its own scenario on 2026-09-01 rather than inheriting the
shell's: `CategoriesBoard` draws its own percentage bars, so it can fail this
exact way on its own. **The identical
broken color pattern also appears once more, in `ConversationView.tsx`'s
debug caption pill (`bg-[color:var(--lf-surface)]/70`) — untouched here,
out of this lane's scope, flagged separately.**

**Frontend architecture note:** `TutorWhiteboard.tsx` gives each `kind` its
OWN component, wrapper included, rather than one shared wrapper with the
visual swapped underneath. A first draft hoisted the announcement/`role=
"img"` shell to a shared parent while leaving `sequence`'s reveal-animation
state inside its own child — two independent copies of "how far has this
reveal gotten," ticking on two separate effects with nothing keeping them
in agreement, the exact shape of bug RUNBOOK.md round 101 already cost a
round on for a stale `seq`. Caught before it shipped, not after: never
give a second live copy of a value a component's own state already owns.
`compare`/`marked_line` render fully immediately, no grow-in reveal at
all — a snapshot, not a process — so neither needed that state to begin
with.

**Verification, and what it does not cover.** `oracle/src/__tests__/
whiteboard.test.ts` covers `computeComparison`/`computeMarkedLine` the same
way `computeSequence` was already covered (a real case, a boundary case
per bound, the one cross-field case `marked_line` alone has). `session.
test.ts` covers the schema and `parseTurn`'s fail-open behaviour for both
new kinds, matching `sequence`'s own coverage shape. `orchestrator.test.ts`
adds a verification-and-delivery pair for each new kind, including a
moderation-inclusion proof for the nested labels. `live-session.test.ts`
adds one real-socket test per new kind proving the WIRE (not just the
in-process object) carries the server-computed fields. `tutorWhiteboard.
test.tsx` covers both new render paths, including the position-trust proof
(a deliberately wrong `position` on a valid `value`/`min`/`max` triple
still draws at the WRONG-but-given spot, proving the client never
re-derives it) and the edge-position clamp. None of this — nor any jsdom
test — can observe real layout, which is exactly why the two bugs above
survived until a real browser was asked to look. `npm run verify:tutor-ui`
was updated to drive all three lab activities (`whiteboard`, `compare`,
`marked-line`) at all three breakpoints — a fourth, `categories`, joined them
on 2026-09-01, and the whole loop **has since been run to a full green pass**
in an environment that does have the 3D assets (see §20.5's `categories` note
above) — but at the time **could not be run to a full pass in this
environment**: `/dev/tutor-lab` needs the 3D scene, whose
`.glb` assets are gitignored and absent from a fresh checkout (`frontend/
.gitignore`, `public/scenes/`), and the lab's own `ErrorBoundary` unmounts
the whole page rather than degrading when they fail to load — a
pre-existing environment gap, not something this change caused or could
fix from inside a text-editing session. Both new kinds were instead
verified rendering correctly, at both light/dark themes and both mobile
(375px) and desktop breakpoints, via a temporary, non-3D preview route
(mounting `TutorWhiteboard` directly with fixture data) built for exactly
this purpose and removed before this work was committed — real values,
real currency formatting, real bar heights and dot positions, screenshotted
and inspected via `getBoundingClientRect()`, which is what caught the two
defects above in the first place.

**A live label could wrap past its column's fixed height and be silently
CLIPPED, not merely truncated — found by TUTOR_QA_2026-09-02.md's own D1
audit, treated as a class, closed the same day (SHIPPED).** D1 itself was
about catalog text (course/adventure titles) in fixed-width containers with
`truncate`/`line-clamp` and `overflow-hidden` — the ordinary failure of that
class is a visibly cut string. The QA sweep that audited D1 "as a class, not
a case" flagged `TutorWhiteboard.tsx`'s `compare` and `categories` bar
captions as the SAME class for a different reason: `side.label` and
`category.label` are moderated free text Oracle writes live (up to 60/40
chars respectively), never seen by `i18n:check`, in columns as narrow as
144px (`compare`, 2 items) or 56px (`categories`, up to 6). Neither had a
line-count ceiling. Verifying the mechanism (not just the symptom) found a
worse failure mode than D1's own: `ConversationView.tsx` mounts the board
with `LessonPlate`'s `bodyLayout="column"`, whose body is `overflow-hidden`
with NO scroll — the plate's own contract puts the ONE mounted child (the
whiteboard) in charge of fitting its own bounds. A caption that wraps to 3+
lines under that contract does not truncate at a fixed pixel edge the way
D1's `truncate`/`line-clamp-4` sites do; it pushes the bar-column's content
taller than the row's own bounded height, and the overflow vanishes behind
the ancestor's `overflow-hidden` — invisible to a screenshot that isn't
zoomed into `getBoundingClientRect()`, the exact class of gap this file's
own history (the zero-height-bar defect earlier in this section) already
warns is invisible to jsdom and an un-inspected screenshot alike.

Fixed with a hard, deterministic ceiling rather than a wider guess at "enough
room": `line-clamp-2` + `break-words` on all three live-authored caption
surfaces — `CompareBoard`'s side label, `CategoriesBoard`'s per-bar label,
and `MarkedLineBoard`'s per-mark label (the third wasn't reproduced live by
the QA session, but shares the identical unbounded `z.string().max(60)`
field and was closed on the same structural reasoning, stated as such rather
than silently folded in — see that component's own comment). A clamp can
never overflow its box regardless of locale, content length, or a future
kind added to this file; it trades D1's failure mode (invisible loss) for an
honest, visible ellipsis. Nothing is lost for a screen-reader user: `aria-
label` already carries every board's full, unclamped text (`WhiteboardShell`
above), built directly from `board.left.label`/`category.label`/`mark.label`
rather than from the rendered DOM, so the sighted caption's clamp never
touches what gets announced. Column widths were also widened where there was
real room to reduce how often the clamp actually engages —
`compare` (only 2 items ever share the row): `max-w-[9rem]` → `max-w-[14rem]`;
`categories` (up to 6 items): `min-w-[3.5rem]` → `min-w-[4.5rem]` — a floor,
not a cap, so six long categories on a narrow phone still fall through to the
row's existing `overflow-x-auto` horizontal scroll rather than crushing the
labels further.

Verified live at both breakpoints, not assumed from the CSS alone (the same
discipline this section's earlier zero-height-bar fix insists on): stress
labels at 58-59 characters in `es-MX` — near the schema's real 60-char
ceiling, the language this repo's own D1 audit measured as running ~19%
longer than `en-US` — driven through `/dev/tutor-lab`'s `compare`,
`categories` and `marked-line` activities via a temporary fixture edit
(reverted before commit, same posture as this section's earlier "temporary,
non-3D preview route" note), screenshotted at 375px and 1280px. All three
kinds clamp to two lines with a visible ellipsis, no clipped or overlapping
content, bars fully visible. `npm run verify:tutor-ui` passes with its
existing four whiteboard-kind scenarios (unchanged — the geometric
overlap/reachability audit that scenario runs was never the gap here; a
`line-clamp` producing a shorter box is invisible to a check that only asks
"do controls overlap", which is exactly why this defect needed a live,
zoomed-in read of the rendered caption rather than another automated
sweep). Full defect record and status: TUTOR_QA_2026-09-02.md.

**`tokens` — the fifth kind, and the first that is not a chart (SHIPPED
2026-09-02).** Everything above this line draws a quantity as a length: a bar's
height, a mark's position on a line. `oracle/skills/moves/biggest-coin-first.md`
asks for something no length can express — "keep the coins ON THE TABLE where
they can be picked up. This move dies if it becomes arithmetic in the head" —
and `value-not-appearance.md` asks to "count the same pile twice". A bar chart of
"three 10s and two 5s" is a picture of two numbers; those moves want a picture of
a pile. `{kind:'tokens', groups: 1-6 of {denomination, count}, label, currency}`
draws the objects themselves.

Three things about it differ from every kind above, each for a stated reason.
**The model has no field for the total.** The sum of a pile is precisely the
arithmetic the learner is doing, so `computeTokens` derives `subtotals` and
`total` server-side and the schema refuses a turn that tries to state either —
the same rule that keeps `greater` off `WhiteboardCompareSchema`, applied to the
one number a tutor is most tempted to say. **`currency` is not nullable**, alone
among the kinds: a bar can be an abstract quantity, a coin cannot, and a
denomination is only checkable against a currency that is actually named. **The
denominations are checked against the ones that really exist** — `computeTokens`
holds a per-currency table and drops the whole board on anything else, because a
7-peso coin passes every per-field bound and would teach a child something false
about the money in their own hand (§1.14, verified for SUBJECT not only form).
It also refuses more than 24 objects on the table: past that nobody counts, they
estimate, which is a different skill than the one this instrument teaches.

**Every token is drawn the same size, and that is pedagogy rather than styling.**
Three of the five misconceptions `tokens` closes — `bigger-coin-worth-more`,
`more-coins-more-money`, `counts-coins-not-value` — are a learner believing that
what LOOKS bigger is worth more. Sizing a token by its denomination would make
appearance and value agree on every board this tutor ever draws, teaching the
misconception instead of breaking it; `value-not-appearance.md` asks for the
opposite ("build one case where the two split"). A token's value is read, never
inferred from its size, and a test asserts every token on a board shares one size
class so a later hand cannot quietly "improve" it.

**No drift detector was written, deliberately.** Every detector above this line
exists because a real transcript showed a specific failure; no `tokens` session
has ever run. The obvious candidate — the tutor speaking a total that disagrees
with the computed one — has a strong anchor and is left open rather than
theorised (/TUTOR_INSTRUMENTS.md §7.6-R). Note that the model cannot state a
total in the board at all, so the only path to that contradiction is `say`.

**What building it changed about how the next one gets built.** The four kinds
above were each written by hand, and the two defects this section already records
— bars at zero pixels, a caption that disappeared rather than truncating — both
lived in the parts every kind copies. Those parts are now
`frontend/src/tutor/whiteboard/primitives.tsx`, and all five kinds draw through
them, so both defects are unreachable by construction rather than by remembering.
`npm run instruments:check` (new, `/AGENTS.md` §5) verifies that a kind's five
hand-written copies agree, and enforces the model-may-not-assert-a-derived-fact
rule that nothing previously checked. Full record, including a cost measurement
that **failed its own criterion** and the corrected metric that replaced it:
/TUTOR_INSTRUMENTS.md §0 and §7.6-R.

### 20.6 The skill/KC curator — propose-only (SHIPPED)

V4 harness backlog: "the skill distiller/curator loop." `backend/src/
services/pedagogy/tutorCurator.ts` (pure, unit-tested, zero model calls) plus
`backend/src/scripts/curate-tutor-skills.ts` (`npm run curate:tutor-skills`,
an operator tool — same posture as `seed:kc`/`audit:content-bridge`) read the
live KC graph, the misconception catalog and real attempt/evidence
aggregates from Vault, cross-reference them against
`oracle/skills/moves/*.md`, and print a markdown report naming FOUR kinds of
finding, each with its own evidence — exactly `coursegen`'s `forge:coach`
propose-only pattern applied to the Tutor's curriculum instead of to Forge's
lesson pipeline:

1. **Dead misconception references** — a skill's own `misconceptions:`
   frontmatter names a code that exists nowhere in the catalog, so
   `selectSkill`'s dedicated-remediation path (§20.1) can never match it.
2. **Coverage gaps** — a misconception code with real evidence and no skill
   anywhere covering it, ranked by how often real learners actually show it.
3. **Content gaps** — a KC with no mapped `skill_key` receiving real
   attempts, so every one of them falls through to tier-3 live generation;
   ranks the gap `audit:content-bridge` already names but does not order.
4. **Questionable prerequisite edges** — a prerequisite whose real accuracy
   is not clearly higher than its dependent's, gated on a minimum sample on
   BOTH ends so this stays silent rather than noisy while usage is thin.

NEVER WRITES ANYTHING — the ROADMAP.md §15.1 rule ("nothing autonomous
reaches a child") extended here to the curriculum itself: applying a
proposal means a human editing a skill file or `kc_graph.v1.json` in an
ordinary reviewed commit, the exact PR-as-approval-gate §20.1 already
established for hand-written skills. Verified against this repository's REAL
catalog on 2026-09-01 (28 KCs, 36 edges, 32 misconception rows, and the 15
skill files that existed at that hour — no live attempt data was reachable
from the environment that
built this, so `masteryByKc`/`misconceptionEvidence` ran empty and only the
catalog-only check had anything to find): it correctly caught a real,
pre-existing defect on its very first run — `counterexample-confront.md`'s
own frontmatter NAMED two misconception codes
(`more-parts-means-more`, `longer-number-is-bigger`) that existed nowhere in
the seeded catalog, beside the one real code it also carried
(`adds-instead-of-counts-up`) — and reported that only 1 of 31 distinct
cataloged misconception codes had any covering skill at all.

**That backlog is CLOSED, later the same day (2026-09-01): 31 of 31.** The
tool's own summary line is the evidence, before and after the same live
catalog — `31 distinct misconception code(s) in the catalog, 1 covered by at
least one skill` became `...31 covered by at least one skill`, and the skill
count went 15 → 36. Thirty codes were uncovered and twenty-one skills cover
them, NOT thirty: the skills are grouped by the didactic MANEUVER that
repairs a wrong idea, not one file per code, because the per-code specifics
already reach the model separately as `misconceptionHint` — our own
catalogued `remediation_hint` for that exact row (`prompt.ts`: "A specific
wrong idea has been detected. Our guidance for it: ..."). A skill body is the
PROCEDURE; duplicating it thirty times with the hint's content pasted in
would have spent the 1,600-char budget restating what the context already
carries. So `value-not-appearance` covers the three codes that are all one
substitution of a visible attribute for value (`bigger-coin-worth-more`,
`more-coins-more-money`, `counts-coins-not-value`) with one procedure —
make the two answers disagree on a case the child predicts FIRST — and
`three-piles-in-out-left` covers the four that are all one missing separation
of money in from money out (`revenue-is-profit`, `profit-is-revenue`,
`cost-equals-price`, `adds-costs-to-revenue`). Every new skill is
`strategies: [REMEDIATE]`, which is deliberate and not a default: the
dedicated path filters on strategy precisely so a still-set diagnosis cannot
hand a confrontation to a RESCUE turn (§20.1, round 22), and a non-empty
`misconceptions` list also fences the skill OUT of generic selection, so
adding twenty-one of them changes nothing about what an undiagnosed turn
receives.

**And the backlog is now a GATE, not an observation.** Visible is not the
same as checked: this tool REPORTS, it does not fail anything, so
nothing stopped the next code added to `kc_graph.v1.json` from silently
reopening the gap — every other gate stays green while a diagnosed wrong idea
falls quietly through to the generic remediation. Two assertions in
`backend/src/__tests__/tutorCurator.test.ts` now read the REAL seed file and
the REAL skill directory side by side (the same cross-package read
`seedKcGraph.test.ts` and this tool's own live-file test already do) and fail
CI on either half: a cataloged code with no skill, or a skill naming a code
that is not cataloged. Both were proven to fail for their stated reason
before being trusted — one skill file moved aside and one bogus code added
produced exactly the two named failures, each naming the offending code.

*Note for whoever adds the next misconception:* `counts-coins-not-value` is
cataloged TWICE, on two different KCs with different descriptions and
different hints, which is why 32 rows are 31 codes. `selectSkill` matches by
code STRING, so one skill covers both rows and the two hints still travel
separately — the duplication is deliberate, not a seed defect.

**The dead-reference defect above is FIXED too, earlier the same day
(2026-09-01):** the frontmatter was trimmed to the one real code, and the
tool re-run in that round reported
"0 proposed action(s) across 28 KC(s) and 15 skill(s)." The tool's own
before/after output is the verification. *This paragraph said the frontmatter
"names" those two codes, in the present tense, until 2026-09-01* — it named
them, they are gone, and the sentence outlived them by long enough to be worth
recording: a document that describes a defect in the present tense sends
somebody to fix code that is already correct. **Wired to a WEEKLY schedule 2026-09-01** —
`.github/workflows/tutor-skill-curation.yml`, Mondays 09:20 UTC, plus a push
trigger on `oracle/skills/moves/**`, `kc_graph.v1.json` and the two analysis
files, plus `workflow_dispatch`. This section previously read "not yet wired
to a schedule … an operator running it by hand is the right cadence", on the
grounds that "its proposals are a standing backlog to work through, not a
regression to catch". That is right about the REPORT and wrong about the
INPUTS: learner mastery and misconception evidence accumulate with real
usage, and the KC graph and misconception catalog move whenever production
data is edited — none of which is a commit any gate here can see. "An
operator runs it by hand" is a plan that decays to "nobody ran it", which is
the same argument `tutor-content-bridge.yml` already records for why a human
dispatching a step does not close a gap.

WEEKLY rather than daily is the honest cadence — this is authoring work a
human then does, and a daily report on a backlog that moves at authoring
speed is noise, which is how a job stops being read. A schedule is only safe
at all because the tool NEVER WRITES: the workflow adds cadence to the
READING and changes nothing about the approving. It stays propose-only —
`tutorCurator.ts` imports only a TYPE and holds no runtime client, and the
CLI has no `--apply` flag to forget to omit. Green is the normal state (it
exits 0 WITH proposals, non-zero only on an unanswered query, §1.14), so a
red run means a failed read and never a full backlog — a permanently-red job
is one everyone learns to ignore. The report is published to the job's step
summary rather than left in the log, because unlike `audit:content-bridge`
(pass/fail, where the failed job IS the message) this tool's entire output is
a document meant to be read on a green run.

### 20.7 Trajectory emission and the simulated-student gym (2026-09-01, SHIPPED — backstage only)

Two of ROADMAP.md's "Remaining harness phases," built as the smallest real
slice of each rather than the harness doc's full design. Both are governed by
the SAME rule that already covers every organ in this section: the harness
doc's own §15.1, "nothing autonomous reaches a child." Neither piece adds a
field to the sealed model context (§4.1), neither writes anything a live
session reads back, and neither has any caller inside `ws/` or the per-turn
orchestrator methods — a session behaves identically with or without either
of them.

**Trajectory emission** answers the question "what did the deterministic
controller actually decide, across a real session, and why" — a durable,
queryable record for offline pedagogy study, separate from `kc_attempt`
(0052), which is the EVIDENCE ledger for graded attempts only and has no row
at all for the `conversation_turn` events that turned out to be MOST of a
session (§20.2). Migration `0066` adds `tutor_trajectory_step`: one row per
real `PedagogicalController.decide()` call, closed-vocabulary throughout per
§13 (strategy before/after, skill delivered, scaffolding, difficulty, mastery
estimate, misconception code, KC, mode — never free text, never a JSONB
blob). `TutorOrchestrator` accumulates each decision as a plain in-memory
push at the SAME site `decide()` is already called
(`strategyInstruction`) — no I/O, microseconds, unconditional (the
controller's own state already moved the instant `decide()` returned,
whether or not the turn it feeds is ever delivered) — and
`oracle/src/session/trajectory.ts` flushes the WHOLE session's log in ONE
batched call, fire-and-forget, from the exact same seam
`runPostSessionReview` already uses (`ws/server.ts`'s `finish()` and
`finalizeParked()`). Per-row idempotency (`UNIQUE (session_id, turn_seq)` +
PostgREST's `on_conflict`/`ignore-duplicates`, the same idiom
`insertTutorTurn` already uses) makes the documented finish/finalizeParked
double-fire race a safe no-op rather than a duplicate audit trail — and,
unlike the learner-memory review's own "pick one whole replacement" dilemma,
a session closed by both paths simply has its later, more-complete log
insert whichever rows are genuinely new. RLS enabled, ZERO client policies
(the same posture as `misconception`, `picture_assets`, `generation_runs`):
this is an internal engineering/research artifact about the controller's own
state machine, not a fact a parent view surfaces, and has no reader anywhere
in the app today. New internal route: `POST /tutor/internal/trajectory`
(backend README route table).

**The simulated-student gym** (`npm run gym:pedagogy`,
`oracle/src/tutor/pedagogyGym.ts`) answers a different question: "how does
the controller behave against a POPULATION of learner behaviours, before any
of it reaches a real session." It is deliberately NOT a copy of either
existing pedagogy tool: `verify-pedagogy.ts` drives the same real controller
but against FIXED, hand-scripted event sequences that never react to what the
controller just decided (a regression gate for specific transcripts the
product has actually produced); `tutor:converse` (`converse.ts`) drives the
real, BILLED orchestrator and judges the tutor's PROSE. This module's four
student archetypes are REACTIVE — each decides its next answer from the
strategy the controller just chose, closing the loop the way a real session
does — and, like `verify-pedagogy.ts`, it costs nothing: no network, no
model, pure controller arithmetic, so it is cheap enough to run on every
pedagogy change. Its four shared sequence properties (no thrash, no
repeated rescue without progress, no difficulty rise after a failure, no
endless questioning without progress) are the same ones `verify-pedagogy.ts`
checks, restated rather than imported — the two files serve different
authoring shapes (fixed scripts vs. a reactive loop) and are meant to stay
separately maintainable, not merged into one.

**The gym found two genuine, real gaps in the shipped controller on its
first run, neither fixed as part of this backlog slice (out of scope for
harness tooling; both flagged as follow-up work).** First: `decide()`'s
difficulty computation resets to `entry.targetDifficulty` on any turn that
does not independently qualify for its own hold/lower branch (a failure, or
a RESCUE/REMEDIATE/PROBE strategy) or its raise branch (`p ≥ 0.85`) — so a
turn immediately after a support-strategy-driven LOW difficulty, whose own
newly-decided strategy happens to be an ordinary teaching or questioning
strategy, jumps back up to the plan's baseline rather than continuing to
climb gradually from where the learner actually was. None of
`verify-pedagogy.ts`'s six fixed scripts happen to produce this combination
(their own recovery turns all land on a support strategy, which coincidentally
also holds difficulty down); the gym's `'steady improver'` archetype does, on
its very first correct answer. Second: `answeredHesitantly`'s "the learner's
own median" is an UNBOUNDED, self-inclusive history — every correct latency
for a KC, ever, including the current turn's own measurement — so for a
learner whose slow phase is CONSISTENT rather than variable, the median
mathematically converges toward that slow value once slow measurements
outnumber the earlier fast ones, at which point the 2x-median check can no
longer fire, independent of how extreme the original fast/slow gap was. The
gym's `'fragile hesitant'` archetype is promoted (CELEBRATE) on exactly this
mechanism despite never becoming genuinely fluent.

**BOTH ARE NOW CLOSED — the first on 2026-09-01 alongside the difficulty
fix, the second on 2026-09-01 by the owner decision this paragraph was
waiting for.** `KNOWN_GAPS` in `pedagogyGym.test.ts` is now deliberately
EMPTY, and its own comment carries the record. The product decision taken
was **mastery is RECONSIDERED, not declared once**: a promotion is allowed
to stand on the evidence available at the time, and is TAKEN BACK when the
same KC's spaced-review re-encounter produces a wrong answer or a
hesitant-but-correct one (`PedagogicalController.masteryRevokedKcIds`,
observable via `revokedMasteryKcIds`). Three things about that decision are
worth keeping, because each was a real fork:

- **Revocation, not withholding.** Withholding would mean a second
  confirming check before `advanceEntry()` may run, and this file has
  already reasoned that through once and rejected it — `advanceEntry` is the
  only thing that moves the plan pointer, so gating it risks stranding a
  learner who never gets a second qualifying opportunity. Revocation is
  strictly additive to forward motion and cannot stall it.
- **The fixture was part of the defect, not just the code.** The archetype's
  single-entry plan went dormant on turn 3, before its own slow phase
  produced a single turn — so the gap was partly UNREACHABLE by the run that
  reported it. It now carries the `review_due` second entry that is the real
  product shape of a KC coming back.
- **Bounded to once per KC, because the fix grew its own mirror image.**
  Unbounded, revocation re-fired every turn and pinned the opportunity count
  below the promotion floor forever: the gym printed `CELEBRATE` followed by
  SPACED thirteen times, a learner correct on every single turn and never
  promoted — the §8.3 defect inverted. Once a session has taken a KC's
  mastery back once, sustained correctness re-earns it even at the slower
  pace. That encodes a position rather than a threshold: we check whether a
  promotion was fragile, act on it once by teaching more, and then believe
  the child rather than holding them to a speed they may simply not have.
  The archetype now reads `SOCRATIC FLUENCY CELEBRATE SPACED TRANSFER`, plan
  completed.

Regression-pinned by three tests in `controller.test.ts` (hesitant revokes,
a revoked KC re-earns rather than being trapped, a wrong answer revokes
too) and by the gym's own rewritten `extraCheck`, which now asserts the
promotion does not STAND — and is itself tested against both the
promoted-and-revoked and promoted-and-stood shapes, so a check that fired on
the FIXED behaviour would fail rather than look green.

**The harness doc's remaining phases, updated as of this section's own
merge:** the skill/KC curator loop is SHIPPED (§20.6, above); a scoped,
buildable slice of Honcho-style dialectic memory is SHIPPED (§20.4, the
memory-write revision guard); MCP/school integrations was investigated and
resolved into a scoping document (`/MCP_SCHOOL_INTEGRATIONS_SCOPING.md`)
rather than code, pending a human decision this codebase cannot make
unilaterally — see that document directly rather than this line, which will
otherwise go stale the same way an earlier version of this paragraph already
did. The gym's own population is deliberately small (four archetypes, one
plan shape, one starting mastery each); a cross-product over starting
mastery, plan shape and multi-attempt dynamics is a real, larger follow-up
once this first slice earns it, not built speculatively now.

### 20.8 Replaying `demonstrate` animations — SHIPPED (narrow, deliberately)

**§19.5's own "v3 tail" backlog item, investigated and closed to the extent
that is responsible, 2026-09-01.** `demonstrate` (§19.3's "the tutor's
hands") was a LIVE-ONLY wire field: `ws/server.ts` sent it on the `turn`
frame, but `tutor_turns` had no column for it, `PersistTurnInput` had no
field for it, and neither tutor-turn `persistTurn` call site passed one —
the IDENTICAL gap round 35 already found and fixed for the whiteboard
(§20.5), on this feature's OWN sibling v3 visual field. The result was the
same shape: a session where the tutor's hands moved a coin on the money
tray lost that fact silently on replay and on the guardian transcript
viewer the instant the live socket closed. Migration `0067` adds the
column; `PersistTurnInput`, `TranscriptTurn` and `ReplayBeat` now carry the
steps the identical distance `whiteboard` already travels.

**Deliberately NOT a re-animated tray, and this is a scope decision, not an
oversight.** `runTrayDemo` (`trayDemo.ts`) only knows how to move a REAL,
interactive Lesson Engine renderer's own draft state — the same one a real
tap changes — and `mayDemonstrate` itself refuses to run against an
activity that has already been answered correctly, which every replayed
activity, by definition, already has (`ActivityDetail`'s own comment in
`ReplayInWorld.tsx` already explains why a replayed activity never mounts
the real interactive renderer at all: doing so would let a learner
re-answer a graded, paid exercise wearing the clothes of a memory).
Mounting that renderer read-only to re-drive the exact coin animation would
mean building a SECOND tray-rendering surface with its own accessibility
and hit-testing burden (§1.14) — a fix considerably larger than the gap it
closes, for a beat that is otherwise a plain caption. `ReplayInWorld.tsx`'s
`DemoStepsSummary` instead states what the steps WERE — which denominations
were added or removed, in order, via `Intl.NumberFormat`'s `signDisplay`
and `Intl.ListFormat` — as a small caption beneath the tutor beat that
narrated them. The steps are real and now visible again; the animation
itself is not reconstructed.

**Still out of scope, not silently dropped** — but re-investigated
2026-09-01, and the two paragraphs above state the WRONG REASON, which is
worth more than the conclusion they reach.

**The rendering blocker does not exist.** "Building a SECOND tray-rendering
surface with its own accessibility and hit-testing burden" is not required:
`ExerciseProps.disabled` is already part of the Lesson Engine contract
(`lesson-engine/core/types.ts`) and `MoneyTray` already threads it into every
`DenominationButton`, so a read-only tray is the EXISTING renderer with one
prop set — no second surface, no new hit-testing story. `mayDemonstrate`'s
"already answered correctly" refusal is likewise not a blocker: it guards a
LIVE draft from being overwritten, and a replay would call `runTrayDemo`
directly, which is a pure `setTimeout` loop over a `getPicked`/`setPicked`
interface with no socket, no audio, no token and no 3D. `ReplayInWorld`
already mounts the real live `TutorWhiteboard` one line above, so "replay
mounts the real component" is an established pattern here, not a new one.

**The real blocker is DATA, and neither paragraph above mentions it.** The
steps themselves are persisted losslessly (`tutor_turns.demonstrate`,
migration `0067`; per-step timing was never server data — `DEFAULT_STEP_MS`
is a client constant). What is persisted NOWHERE is the tray's state at the
moment the demo ran: `tutor_segments` keeps payload, score, attempts and XP,
never the learner's draft. `runTrayDemo` replays a DELTA against whatever was
already in the tray, so a replay starting from empty would (a) silently
no-op every `remove` step, since `lastIndexOf` finds nothing to take out, and
(b) drive `CoinCount`/`MakeChange`'s `TrayTotal` — the single largest number
on the surface, inside an `aria-live` region — to a figure the learner never
saw. That is a confident wrong picture where an absent one merely omits
(§1.14), and it is why restricting the animation to `add`/`pause` steps does
NOT rescue the idea: the total is wrong for a pure-`add` demo too, whenever
the learner had already put anything in the tray.

**So the honest scope is one nullable column, not a renderer.** Persisting
the tray's `picked` array on the demonstrate turn (a wire field, a schema
entry, a read-time validator, a migration) is what would make re-animation
truthful; the frontend work after that is genuinely small. That is a real
feature with a migration, deliberately not half-built here, and it should
only be taken on if the plain-text summary proves insufficient in practice.

**One thing WAS closed on 2026-09-01, because it was a plain gap rather than
a scope decision:** migration `0067`'s own header says the defect it fixed
was losing the demonstration "silently, on replay AND on the guardian
transcript viewer" — and only the replay half had shipped. `KidTutorPage`
rendered `beat.whiteboard` and nothing at all for `beat.demonstrate`, so a
parent reading "so I take one of these away…" still had no way to see what
"these" were. `DemoStepsSummary` now lives in its own module
(`tutor/replay/DemoStepsSummary.tsx`) rather than inside `ReplayInWorld.tsx`,
so the guardian transcript can render it without pulling the entire 3D replay
world into a plain scrolling page, and both surfaces now show it.

### 20.9 `grab`, `fill` and `your_turn` — the three INTERACTIVE whiteboard kinds (2026-09-03, `grab` and `your_turn` SHIPPED and WORKING, `fill` SHIPPED and NOT YET RELIABLY REACHABLE)

**§20.5 through §20.8, and every whiteboard kind before this one, are
pictures.** Forty-one of them, all sharing the same contract:
`WhiteboardShell` wraps its content in `role="img"`, an ARIA role that tells
assistive tech to present the whole subtree as the image's own replaced
content — correct for a live-drawn snapshot, and it is why the SIBLING
mechanism next to a board, `step`'s "Show next" control (Class II, S9,
/TUTOR_INSTRUMENTS.md §3.3), had to be rendered OUTSIDE `role="img"` rather
than inside it: a nested interactive control there is presented to a screen
reader as part of a picture and is never reached.

`grab` (Class II, S9) cannot use that contract at all, because its whole
point is the opposite of a picture: the model names items and two-to-four
bins, and the LEARNER sorts them by tapping — tap an item, then tap a bin —
which is the same interaction the Lesson Engine's own graded `SortingBoard`
(`lesson-engine/families/arrange/components.tsx`) uses minus its native
pointer-drag half (touch drag-and-drop is the interaction class that reads
worst on a phone, most of this product's real traffic, and `grab` is an
ungraded aside the tutor draws mid-conversation, not a widget that has
earned that extra machinery). `WhiteboardShell` gained a second mode,
`interactive`, that swaps `role="img"` for `role="group"` and the single
static `aria-label` for the board's plain caption — a screen reader
exploring a `grab` board hears its actual buttons, one at a time, as they
change, rather than one frozen sentence.

**Ungraded by construction (§0's own D decision, /TUTOR_INSTRUMENTS.md
§8.1), and this is a stronger guarantee than it sounds.** `WhiteboardGrabSchema`
has no field naming which bin an item belongs in — unlike `two_bins`'
`items[].bin`, which the MODEL sets — because nothing about a `grab` board is
ever checked: the learner's placements live in local React state, reset on
every new turn, and never reach a server. This is the first whiteboard kind
with genuinely nothing for `oracle/src/tutor/whiteboard.ts` to compute; its
`whiteboardComputesOk` case is a bare `true`, the same posture `outcomes`/
`trade`/`cycle` already have for a different reason (prose or a closed list
with no arithmetic), extended here to a kind whose content is closed but
whose STATE is the learner's own and simply never comes back.

**`two_bins` and `grab` answer to the same prompt situation — "sorting into
groups" — and the model has to be told which one, explicitly, or it reaches
for the one it already knows better.** Live-tested before shipping, the same
discipline every instrument in this file has needed: three attempts at
increasingly explicit phrasing ("quiero intentarlo yo mismo… déjame
acomodarlas yo") all produced `two_bins` or nothing, with the tutor narrating
the sort itself in words even after saying "tú las mueves." The situation
index alone — "the learner sorting it themselves, hands-on → grab instead" —
was not a strong enough signal against an established, five-sprint-old
alternative. What worked, on the first attempt after adding it: an explicit
standalone instruction naming the substitution directly — "set grab INSTEAD
OF two_bins... do not narrate the sort yourself when you set grab" — the same
shape of fix `demonstrate`'s money case needed in Sprint 2
(/TUTOR_INSTRUMENTS.md §7.2), applied to a second, independent instrument.
Two more live attempts after the fix both produced a correct `grab` board on
the first turn.

**Full record — the six-copy plumbing, the accessibility design, the
instrument-parity gate's own gap this kind found in itself (a 40-entry
hand-written `kind→TypeName` map with no `grab` row, replaced with a
mechanical derivation), and the `verify:tutor-ui` false-positive its
`role="group"` triggered against a dock selector that had matched the mic
dock only by accident:** /TUTOR_INSTRUMENTS.md §0.0's Class II / S9 row.

**`fill` (same day) is the SAME mechanism, `WhiteboardShell`'s `interactive`
mode, applied a second time — "taps to fill a ten frame, a bar, a jar,
counting with a finger" — and it is reported here NOT as a second success but
as a measured, honest gap.** Learning from `grab`'s own history in this
section, the explicit "use fill INSTEAD OF ten_frame" instruction was written
into the prompt from the start this time, not added reactively after live
failures. It did not help: four live attempts — two phrasings, two session
tiers, one of them the EXACT phrasing pattern that fixed `grab` on its very
next attempt — all produced `whiteboard: null`, the tutor narrating the
intended hands-on interaction in words ("aquí está la pantalla para que tú
toques y cuentes") without ever setting the field. The most likely
difference: `ten_frame` has been part of the shaped, reinforced prompt
vocabulary since S11 (the "canonical batch"), one of the ten kinds a model
call has always been able to see the shape of, where `two_bins` — `grab`'s
own competing alternative — only joined that set in S12 and is, relatively,
newer and less deeply reinforced. `fill`'s schema, wire, Core validation and
frontend renderer are all real, tested, and safe to leave shipped — nothing
about them is wrong — but this file will not claim a capability as verified
that four independent live calls could not produce, the same standard Sprint
2's `move` (number_line demonstrate) is already held to.
/TUTOR_INSTRUMENTS.md §0.0's Class II / S9 `fill` row has the full count.

**`your_turn` (S10, same day) reuses `interactive` mode a THIRD time, and is
what "the Tutor demonstrates, then hands the instrument over" concretely
means** — the shape two of this codebase's own pedagogical moves already
describe in prose (`oracle/skills/moves/scaffold-fading.md`'s FULL → LAST
STEP THEIRS → FIRST STEP YOURS → ALONE withdrawal ladder;
`concrete-to-abstract.md`'s same shape on a representation axis instead of a
who-does-it one) but had no whiteboard to draw before this kind existed.
Structurally it is ONE `sequence`, split at a new `givenCount` field: the
first `givenCount` values are the tutor's own contribution, shown on mount;
the rest start hidden, and the learner reveals them one at a time by
tapping — `fill`'s exact ordered, undo-able mechanic (only the next hidden
value and the most-recently-revealed one are ever tappable), generalized
from an empty container to a chart that starts partly worked.

**NOT ungraded, unlike `grab`/`fill` — and this is the part worth being
careful about.** `values` is server-computed in a SINGLE `computeSequence`
pass over the WHOLE `steps` list (`computeYourTurn`, `whiteboard.ts`), never
two independent computations for the tutor's half and the learner's half.
That single-pass design is not an implementation convenience; it is what
guarantees the two halves can never arithmetically disagree — a bug that
computed the prefix and suffix separately could, in principle, produce a
board where the tutor's own "shown" values do not connect smoothly to the
learner's revealed ones, which would be strictly worse than drawing nothing.
`computeYourTurn` also refuses a board that leaves the learner nothing
(`givenCount` at or past the last value) — a hand-over that hands over
nothing is a `sequence` wearing this kind's name, and the model has no field
here it could use to get that wrong on its own; the refusal is what makes it
a compute-time guarantee rather than a prompt-time hope, the identical
posture `whatif`'s branch-length check and `sequence_compare`'s own already
take.

**The tutor's given bars and the learner's revealed bars are drawn in
different colours (muted grey vs. the board's accent) — a deliberate,
visible answer to `scaffold-fading.md`'s own closing instruction**, "Say
what they did, not 'muy bien': 'Terminaste tú solo la parte difícil.'" The
move already asks the MODEL to name the learner's contribution in words;
the board now lets the learner SEE it too, at a glance, every time they look
back at what they built.

**Live-verified working on the FIRST attempt, unlike `fill` and `whatif`
before it in this same section and file — the one Class II kind this sprint
did not need a prompt fix to fire.** Four attempts against the real
orchestrator: two single-turn requests phrased as an explicit hand-off
("muéstrame los primeros dos... deja que yo termine el resto yo mismo,
tocando"), one two-turn scenario where the tutor first narrated a plain
`sequence` and only handed off on the learner's SECOND message, and one
tier-1 phrasing. Three of the four produced a correct `your_turn` board —
with two DIFFERENT `givenCount` choices (1 and 2) that both matched what the
learner had actually asked for, and narration that named the mechanic
correctly ("Yo te muestro las primeras dos semanas, y tú tocas para
descubrir las que siguen"). The one miss narrated the identical invitation
in words ("ahora tú tocas la pantalla para seguir") without ever attaching
the board — the same class of gap `fill` and `whatif` have, just far rarer
here (1-in-4 against their 4-in-4). Working hypothesis for the difference,
not yet confirmed: `grab`, `fill` and `whatif` each have to DISPLACE one or
more specific, deeply-reinforced sibling kinds the model already reaches for
out of habit (`two_bins`, `ten_frame`, and `sequence`/`sequence_compare`/
`categories` respectively); a hand-off situation has no comparably
established habit to overcome, so the new kind wins on its own merits rather
than needing to win an argument against an old one.
/TUTOR_INSTRUMENTS.md §0.0's Class II / S10 `your_turn` row has the full
count.

### 20.10 `whatif` — a picture with a sibling switch, NOT a third `interactive` kind (2026-09-03, SHIPPED and NOT YET RELIABLY REACHABLE)

**`whatif` (Class II, S10) looks like it belongs next to §20.9 — it is the
third kind in the catalog where the learner's own tap changes what is on
screen — and it deliberately does NOT reuse that section's `interactive`
mode.** The distinction is what the tap changes. `grab`'s items and bins,
`fill`'s empty cells: in both, the thing drawn is unfinished until the
learner acts, and their placements are never checked against anything —
`role="group"` is correct because there genuinely is no finished picture yet
for `role="img"` to present. `whatif`'s chart is the opposite: `values` is
server-computed (`computeWhatif`, `oracle/src/tutor/whiteboard.ts`, folding
`computeSequence` once per branch from one shared `start` — the same
"the server computes it once, the client only draws" rule every chart
instrument already follows) BEFORE the turn ever reaches the wire. Nothing
about the bars is the learner's own authorship; only WHICH branch's bars are
currently showing is their choice. Giving that a full `role="group"` would
throw away the one thing screen-reader parity here actually needs — a
complete accessible description of the ACTIVE branch's values, read as one
sentence, the same as every other chart in this file — in exchange for
nothing, since there is no second author's state to expose turn by turn the
way `grab`'s bins genuinely have one.

**So the fix is `step`'s `onAdvance`, generalized in spirit but not in code.**
`WhiteboardShell` already established, for `step`'s "Show next" control, that
a control ATTACHED TO a picture — meta to it, not part of it — renders as a
plain sibling of the `role="img"` node, because that role presents its whole
subtree to assistive tech as the image's own replaced content and would
swallow anything interactive nested inside it. A branch tab is exactly that
same shape of control: attached to the chart, not part of what the chart
depicts. Rather than teach `WhiteboardShell` itself a second, more general
sibling-control mechanism for a shape only one kind uses so far, `WhatifBoard`
renders its own tab row directly, as a sibling ahead of an otherwise-untouched
`<WhiteboardShell>` call — structurally identical DOM either way (React
fragments nest without a wrapper element), the smaller diff, and no new
surface for the other 43 kinds to accidentally trip over.

**The Y-axis scale is deliberately computed across every branch, never the
active one alone.** `max = Math.max(...board.values.flat(), 1)` reads all
2-3 branches before any tab is picked, so the bar height for a given value
means the same thing regardless of which branch is showing — switching tabs
redraws which numbers appear, never what the scale means. Getting this wrong
would be quiet and easy to miss in a screenshot: a branch whose own tallest
value is merely modest would render at full height exactly like the actual
largest branch, silently erasing the one comparison the whole feature exists
to show. Verified with a dedicated test asserting the identical bar position
renders at a DIFFERENT, non-100% height depending on which branch is active.

**Measured live, same as `grab` and `fill` before it, and the honest result
is a third gap, not a second success.** Four attempts — varied phrasing and
session tier, one close to a verbatim rendering of the prompt's own trigger
language ("qué pasaría si ahorro más… probar diferentes cantidades") —
produced zero real `whatif` boards: one triggered the orchestrator's own
internal repair retry (a real, working mechanism — /TUTOR_INSTRUMENTS.md's
D7 fix) and still narrated the interaction in words on the retry; one drew
`categories`, a defensible reading of an ambiguously-phrased "three ways to
save" that named fixed amounts rather than asking for a trend over time; one
drew a plain `sequence`; one narrated in words again with no board at all.
The explicit "set whatif INSTEAD OF sequence or sequence_compare" instruction
was written into the prompt from the start — the same shape of fix that
worked for `grab` on its very next attempt — and it was not enough here
either, the same outcome `fill` already had with an equally explicit,
equally early instruction. The working difference between the two failures,
not yet confirmed: `fill` displaces exactly one deeply-reinforced competitor
(`ten_frame`, shaped since S11); `whatif` has to displace THREE at once —
`sequence`, `sequence_compare` and `categories`, all Class I core since
S4-S15 — which may simply be a harder prior to move regardless of how the
instruction is worded. Schema, compute, wire, Core validation and the
frontend renderer are all real, tested and safe to leave shipped; this file
will not call the live capability verified on the strength of four calls that
did not produce it, the same standard already applied to `move` and `fill`.
/TUTOR_INSTRUMENTS.md §0.0's Class II / S10 `whatif` row has the full count.

### 20.11 `plan`, `notebook` and `recap` — the first state a learner keeps ON PURPOSE (2026-09-03, SHIPPED)

**Class V (TUTOR_INSTRUMENTS.md §3.6, migration 0069) is a different kind of
feature from everything in §20.5-§20.10: those sections are all about what
appears ON SCREEN, once, for the length of a turn. This one is about what
OUTLIVES the screen** — the savings plan the tutor and learner build
together, and the boards the learner explicitly chose to keep, both visible
again the next time the family opens the app, neither one erased by the
90-day transcript purge (`purge_expired_tutor_sessions`, migration 0047)
that erases everything else a conversation produced.

**`plan` reuses the whiteboard as its own content format, on purpose.** A
new turn-level field, `savePlan: boolean` — required, not optional, the same
posture `next`/`emotion`/`action` already have, so the model states it on
every turn rather than a client inferring "unset" as false. `TutorTurnSchema`
refuses `savePlan: true` with no `whiteboard` on the SAME turn: there is
nothing to save otherwise, and the refuse is enforced by a `.refine()`, not
a comment asking the model to behave. When Core receives a turn with both,
it resolves the session's owner and calls `write_tutor_plan` — the model
never composes plan content SEPARATELY from what it already drew and
already had moderated; the plan IS the board, copied, never re-derived.
"Real progress" is not a separately tracked counter that could drift from
what the learner actually saw — it is whatever the tutor's own
server-computed numbers say the NEXT time the board is re-saved, which is
why `write_tutor_plan` is a plain advisory-locked UPSERT and not
`learner_memory`'s compare-and-swap: the new content is never a MERGE of
the old value the way a consolidated memory note is, so there is nothing to
conflict against, and getting this wrong in the other direction — adding
compare-and-swap where a blind overwrite is correct — would be adding
complexity that buys nothing, since a "conflict" here would only ever mean
"someone else also saved the current board," never a loss.

**The prompt is deliberately narrow about when to set it**, learning from
this file's own repeated lesson that a capability without a clear trigger
either never fires or fires on the wrong turn: "the learner has just agreed
a real savings goal and you are drawing the board for it… not a general
'save this' button, and it replaces whatever plan they had before." An
earlier draft of the trigger example ("quiero ahorrar") collided with an
unrelated, pre-existing test's own search string for "the live utterance
must not appear twice in the model's history" and inflated its count —
found by running the oracle suite, not by guessing, and fixed by rewording
the example rather than the unrelated test.

**`notebook` is the inverse: LEARNER-initiated, never the model's choice.**
"Boards marked 'keep this', collected" reads, in the catalog's own words, as
the learner's own act of curation — and a research pass before writing any
code confirmed no such control existed anywhere in this file's history (no
`keep`/`save`/`star`/`bookmark` affordance on any prior whiteboard). The new
one, `NotebookKeepButton` (`frontend/src/tutor/NotebookKeepButton.tsx`), is
a plain sibling of `<TutorWhiteboard>` — the identical "meta-control
attached to a picture, not part of the picture" reasoning `onAdvance` (§3.3,
S9) and `whatif`'s own tab row (§20.10) already established, never nested
inside the board's own `role="img"`/`role="group"` node. It sends only
`(sessionId, turnSeq)` — never the board's own content — and `POST
/notebook` re-reads the REAL turn server-side, refusing a session that is
not the caller's own and a turn that drew no board, so nothing about WHAT
gets kept, or whether it is even real, is ever trusted from the client. The
copied JSONB was already moderated and already guardian-visible the moment
it was first drawn, so keeping it opens no new content-safety surface.

**Both tables outlive their source session on purpose, and both do it the
same way this codebase already established for the identical reason**:
`session_id`/`turn_seq` are kept as plain columns with NO foreign key —
provenance only, the same posture `learner_memory_ledger.session_id`
(migration 0053) and `learner_memory_proposals.session_id` (migration 0068)
already take, because a foreign key to a table that purges at 90 days would
either cascade-delete the very thing "collected" is supposed to mean, or
require the retention sweep to know about tables it was never designed to
reach.

**Visibility is ONE shared component, `frontend/src/tutor/PlanNotebookPanel.tsx`, reusing
`<TutorWhiteboard>` unmodified** — a plan or a kept board renders exactly as
it looked the moment it was drawn, the same component the live conversation
and session replay already use. `TutorPlanNotebookPanel.tsx` was the
original, guardian-only name; it was deleted and its logic generalized the
same session `recap` and the learner's own view shipped (below), rather than
kept as a second, near-duplicate component. It is deliberately ABSENT, not
an empty state, when a family has touched neither artifact yet, unlike the
always-relevant memory-notes inbox beside it (§20.4's approval-gate panel):
most families have not used an opt-in Class V artifact yet, and an empty "no
plan, nothing kept" card on every visit, for every family, forever, would be
exactly the accumulated clutter this product avoids elsewhere.

An optional `kidUserId` prop switches the data source, not the rendering:
present, it is `KidTutorPage.tsx` calling the guardian's own
`getKidPlan`/`getKidNotebook`; absent, it is the learner's OWN view of
themselves, reached from a new "My progress" chip on the stage itself
(`OfferChips.tsx`, the introducing phase; `ClosingInWorld.tsx`, the closing
phase — added second, for parity, since the goodbye renders right after the
session `recap` summarizes just ended, arguably the more natural home for it
than the introduction). Only the learner path computes `recap` — a guardian
already has the full transcript list; a per-child recap card would be a
second, redundant summary of the same thing. A `variant` prop (`'card'`
wraps the app's own `Card`, for the guardian route that stands beside plain
cards; `'bare'`, the default, renders content only, for the Tutor's own
`HudPlate` sheet) keeps the SAME component from ever supplying its own outer
chrome when its caller already provides one — the "no glass on glass" rule
`/DESIGN.md`'s Lumen material states outright, and the reason
`SessionHistory.tsx`'s own header already gives for staying bare in that
same sheet slot.

**`recap` needed no new table, and that was the research finding, not a
shortcut taken — and it shipped, the same session, exactly as the research
predicted.** `GET /sessions/:id` already returns full `turns` (each one's
own whiteboard included) and `session.summary`; "the day's best board, for
learner and parent" is entirely computable client-side: the newest session
with a non-null `endedAt`, then that session's transcript, then a
reversed-array `.find()` for the last turn carrying a non-null whiteboard —
not necessarily the session's LAST turn, since a closing turn rarely carries
one of its own. No new endpoint, exactly as the original research found.

Live verification (both chips, both dock mountings, both breakpoints) found
and fixed one real defect the panel introduced: its wrapping element was
defined AS a component inside `PlanNotebookPanel`'s own render body — a
fresh function identity on every render, which React treats as a different
component type at that position and therefore unmounts and remounts
everything below it, including every `<TutorWhiteboard>`'s mount-time
reveal sound and bar-growth animation. `OfferChips.tsx` re-renders often for
reasons that have nothing to do with this panel's own data (mic state, live
captions, chip animations), so the un-hoisted version would have replayed
that chime on every board on screen, repeatedly, for as long as the sheet
stayed open. Hoisted to module scope; proven, not merely asserted, by
temporarily reintroducing the exact prior shape and watching a new
regression test fail on DOM-node identity before restoring the fix.

The same pass also surfaced — and deliberately did NOT fix, flagging it as a
separate task instead — one pre-existing defect unrelated to this feature:
the introducing phase's greeting/opening-picker card and the archive sheet
(either chip's content) occupy overlapping screen space when both are open
at once, caught live by the Tutor Lab's own instrumented HUD overlap
detector and reproducing identically against the original, long-shipped
"Past conversations" chip — proof it predates this work and is about the
archive sheet's POSITION, not either panel's content.

Full plumbing, the concurrency-shape reasoning, the 156-test ripple a
REQUIRED (not optional) turn field caused and how it was traced to five
shared fixtures rather than fixed 156 times over, and both live-verification
accounts (the `computer` tool's own click-coordinate resolution proved
unreliable BOTH times this feature was live-verified; confirmed by
`elementFromPoint` and a directly dispatched real event sequence each time):
/TUTOR_INSTRUMENTS.md §0.0's Class V row and its decision-log entries.

### 20.12 `point_at`, `beat` and `audio_cue` — the character responds to what it just drew (2026-09-03, SHIPPED, COARSE)

**Class III's non-asset slice (TUTOR_INSTRUMENTS.md §3.4, S16) touches the
stage, not the model's own content-safety surface** — no new field on
`TutorTurnSchema`, no new moderated string, no new persisted row. The only
model-facing change is a one-line addition to the situation prompt
(`oracle/src/tutor/prompt.ts`) telling the model to choose the EXISTING
`action: "point"` value on the same turn it draws or refers back to a
whiteboard, instead of leaving `action` at its default. Everything else this
section describes is client-side staging that reads that same, already-gated
`action` field — it adds no new way for the model to say something unsafe,
because it adds no new thing the model can say.

**`beat` is deliberately NOT a shot change**, and that distinction is the
entire section. §9.3 and §16 both hold, unchanged, that a `conversing` shot
may move for exactly one reason (`adaptationOffered`) — a prior feature
(`segmentLive`) violated this once already, by swinging the camera when a
live activity arrived, was caught live (a phone screenshot showing the back
of the tutor's head filling the frame), and was removed 2026-08-21
specifically because the on-screen framing is a shipping gate here, not a
preference. `beat` reads the model's `action: "point"` as a cue for a small
(2.5cm), self-decaying nudge on `composition.ts`'s existing aim-offset
`(right, up)` — never `ShotId`, never distance or padding — applied in
`CameraDirector.tsx` strictly AFTER the padding-fit pass reads `distance`,
so it is structurally incapable of becoming a second exception to §9.3's
rule. `shotForPhase.test.ts`'s own invariant tests, written to protect
against exactly the `segmentLive` regression above, pass completely
unmodified — the proof the invariant was never at risk, not merely an
assertion that it wasn't. Reduced-motion learners get none of it
(`prefers-reduced-motion` gates the nudge to zero, the same posture every
other stage animation in this file already takes).

**`point_at` stayed whole-plate at first — UPDATED 2026-09-04, see §20.16.**
The paragraph below is kept as the historical record of the ceiling this
sprint actually reached, because §20.16 built on top of it rather than
replacing it: the retuned pose, the reach/bend constants, and the coarse
"gestures toward the board in general" gesture are all still exactly what
runs when no per-element target is named. The character's procedural
`point` pose (`characterActions.ts`) was retuned toward the plate's typical
on-screen region — arm reach and forearm bend biased closer to where a
whiteboard actually renders — verified by watching the live render in
`/dev/scene-lab` and iterating the rotation constants against a real
screenshot, not by guessing at numbers blind. This is the coarse version a
prior research pass identified as available without new bones or IK: no
whiteboard kind exposes per-element identity (only a whole-board
`data-tutor-whiteboard` hook), the `Rig` binds no hand or wrist bone despite
the source skeleton having one, and there is no IK or bone-aim code
anywhere in this codebase — so nothing in this system can point at, or
verify a point toward, one specific bar or cell. The catalog's own
acceptance bar for this instrument — "verified by screen coordinates, not by
intent" — is not met yet and is not claimed to be; what shipped is a
character that visibly gestures toward the board region in general, which
is the honest ceiling of what a canned pose can prove.

**`audio_cue`'s remaining half is a single new one-shot action.** The
whiteboard-side cue (a sound per drawn event, keyed off the same reveal
timing `step`'s "Show next" control already paces) shipped earlier, in
Sprint 3. What S16 adds is the STAGE side: `playSfx('celebration')` fires
once when the model sets a fresh `action: "celebrate"`, gated on the same
one-shot transition guard `Character3D.tsx`'s clip-restart logic already
uses to avoid re-triggering a sound on every re-render of an unrelated prop.
No new sound asset, no new field — the existing 4-character SFX set and the
existing `action` enum were already sufficient.

Full gate account, the exact rotation constants, and the one environment
gap this sprint could not close (`verify:rig` needs a gitignored
clip-library build asset `npm run assets:clips` was not run to produce —
that gate covers AUTHORED clips only, and nothing in this sprint touches
one, so the gap is environmental, not a finding): /TUTOR_INSTRUMENTS.md
§0.0's Class III (S16) row and its decision-log entries.

### 20.13 `roleplay` and `presence` — a pre-authored scene, and a second body in frame (2026-09-03, SHIPPED, COARSE)

**`roleplay` never lets the model write a scene — it only lets the model
NAME one.** The catalog's ask ("the tutor and learner act out a scripted
exchange — buying lemonade, making change") could have been built as
free-form model-generated dialogue for a second character, which would have
doubled this file's own per-line moderation surface (§6) for no real
pedagogical gain over a single, carefully-written, pre-moderated scene. It
was instead built as a small, hand-authored catalog
(`frontend/src/tutor/roleplay/scenes.ts`, one scene today —
`lemonade_change`, four beats) that the model selects via a new closed-enum
turn field, `roleplayScene` (`TutorTurnSchema`, migration 0070). Every beat's
text is a translation key, moderated and reviewed the same way any other
shipped copy in this product is, never generated at request time — the
model's only degree of freedom is WHICH scene, and WHETHER to start one, both
already-closed-vocabulary decisions of exactly the kind §5's prompt-injection
defense already relies on elsewhere (a closed output shape has nothing an
injected instruction can widen). `roleplayScene` is mutually exclusive with
`whiteboard` and `segmentRequest` on the same turn, enforced by
`.refine()`, the same "one surface per turn" posture every other stage
capability in this file already keeps.

**`presence` puts a second, non-canon body in the 3D canvas for the first
time** — the learner's own DiceBear avatar, rendered as a billboard sprite
positioned at a fixed offset from the scene's already-solved companion spot.
This was confirmed by research before any code was written: nothing in this
codebase had ever rendered anything but one of the four rigged `.glb`
characters inside the Tutor's canvas. The placement solver was deliberately
NOT extended to cover it — the solver is footprint-and-walkability, keyed by
`CharacterId`, for the four canon characters only; a flat billboard has no
footprint to solve for, and forcing it through that machinery would have
added a fifth, fictitious `CharacterId` to a system whose privacy contract
(§4) and whose asset pipeline both reason about "the four characters"
as a closed, small set. The avatar shows only while a scene is actively
running — "during a transaction," the catalog's own words — and never
persists, never leaves the client, and carries no more identity than the
avatar options already stored for that account.

**Voice was deliberately not wired at first, as a cost decision rather than
a technical gap — UPDATED 2026-09-04, see §20.15.** The reasoning below is
kept as the historical record of why, because it shaped the fix: `speakLine`/
`SpeechScope` bind one live provider voice per session (§15's cost and
rate-limit accounting assumes exactly one), so giving the roleplay's second
character its own LIVE Inworld voice would have meant both loosening that
one-voice-per-session contract AND opening a new, ONGOING paid-API cost
pattern — the same class of decision D2 (§8.2 in TUTOR_INSTRUMENTS.md)
required explicit owner sign-off for. What §20.15 found is that this framing
was itself avoidable: roleplay dialogue was never live model speech, so it
never needed the live per-session voice contract at all.

**Two real defects were found live, not assumed away, and both are
instances of failure classes this project already has names for.** First:
the scene director's first version keyed its "a new scene request arrived"
trigger on the `roleplayScene` VALUE rather than the turn's own identity —
so the conversation's very next ordinary turn, which by the prompt's own
design never repeats `roleplayScene`, read as "the scene was cancelled,"
cutting a four-beat performance short after its first line. This is the
same "measurement or trigger must key on identity, not on a value that
happens to differ" class this codebase has hit before; fixed by keying the
trigger on `turnSeq` instead, so a scene now runs to its own natural
completion regardless of what later, unrelated turns carry. Second: the
avatar billboard's first version mutated a loaded texture's `colorSpace`
directly inside a React render body, on an object `useLoader`'s
Suspense-based caching handed back — and because the parent `Cast`
component re-renders often for reasons that have nothing to do with
presence (mic state, live captions), a live headless-Chrome run caught the
browser's GPU process pinned over 500% CPU, repeatedly re-uploading a
texture against WebGL storage already allocated as immutable, with
reproducible console errors (`texSubImage2D: bad image data`,
`glTexImage2DRobustANGLE: Texture is immutable`). Confirmed fixed only after
a full rewrite to an explicit `useEffect`-based load — the texture created
and configured exactly once, disposed on cleanup — verified by a fresh page
load AND a deliberate five-cycle rapid-toggle stress test with the console
watched throughout, not merely by the error going quiet once.

A separate, sustained high-CPU pattern seen in the full `verify:tutor-ui`
sweep was isolated with an A/B test — the entire uncommitted diff stashed,
the identical gate re-run against the last clean commit — and reproduced
IDENTICALLY with none of this sprint's code present, proving it
pre-existing and environmental rather than a regression this work
introduced; `verify:tutor-ui`/`verify:tutor-a11y` themselves could not be
run to a confirmed clean completion under that same load, an honest gap
substituted with extensive direct live-browser verification rather than
claimed as passed.

Full plumbing (the six-copy hand-mirrored field tax, the exact
`TranscriptTurn` snake_case mismatch the compiler caught, the nine-test
trigger-cutoff regression suite, gate-by-gate status, and the two
pre-existing unrelated findings this sprint surfaced and flagged separately
rather than folded in): /TUTOR_INSTRUMENTS.md §0.0's Class III (S17) row and
its decision-log entries.

### 20.14 `props` — a stall on the island, and no model-facing surface at all (2026-09-03, SHIPPED, COARSE)

**Recorded here for completeness, not because this sprint touches anything
this file otherwise governs.** Class III's last piece (TUTOR_INSTRUMENTS.md
§3.4, S18) puts a procedurally-built market stall on the island — no new
turn field, no new prompt line, no new persisted row, no new content
reaching a model or a learner's ear. The stall shows precisely when
`presence` already does (`roleplay.active`, unchanged from §20.13), so it
introduces no new trigger this file would need to reason about, and its own
`propPlacement.ts` composes an exclusion zone into the EXISTING placement
solver's `isWalkable` predicate purely for physical non-overlap on screen —
a rendering concern, not a privacy, moderation or injection one.

The one thing worth recording here rather than only in
TUTOR_INSTRUMENTS.md: this sprint is further confirmation that the
"broadcast pose, opt-in override" shape §20.13 established for `roleplay`
generalizes cleanly to a THIRD kind of stage guest (character, then avatar
billboard, then static prop) without touching `TutorTurnSchema` a third
time — the model's own surface stayed exactly as closed as it was after
S17, which is the property that matters here.

**UPDATED 2026-09-04: a second prop kind (a crate) and true multi-prop
placement were added, and the one fact this file actually needs to track
still holds unchanged.** `TutorSceneProps.showStall: boolean` became
`props: readonly PropKind[]`, `propPlacement.ts` gained
`findPropSpots`/`excludingProps` to solve and exclude several props at
once rather than one, and the Tutor's own two callers migrated to the new
API — none of it touches `TutorTurnSchema`, a prompt, or a persisted row.
The model still cannot name, request, or influence which props appear;
`props` is set entirely from `roleplay.active`, exactly as `showStall` was.
Full account: /TUTOR_INSTRUMENTS.md §0.0's Class III (S18 amendment) row.

Full account (the placement-solver mechanics, the audition regression
found and fixed, the live verification): /TUTOR_INSTRUMENTS.md §0.0's
Class III (S18) row and its decision-log entry.

### 20.15 `roleplay` gains real voice — and why the live-voice framing in §20.13 was avoidable (2026-09-04, SHIPPED)

**The question §20.13 answered was "should the roleplay's second character
get a live voice." The question that actually mattered was different: does
roleplay dialogue need a LIVE voice call at all.** It does not, and
establishing that is the whole reason this shipped without touching
`SpeechScope`, without loosening the one-voice-per-session contract §20.13
took as a given, and without opening any ONGOING per-play cost. Roleplay's
lines are fixed catalog text — the model NAMES a scene, it never writes
one (§20.13's own "id names content that exists" reasoning) — which is
the exact shape `scripted.ts`'s 144 always-say-this lines already are:
content that never varies per session, synthesized once, served free
forever after. Nothing here reaches this file's live turn-by-turn voice
path at all.

**Cost was measured before a line of the feature was written, not after.**
This codebase already has a real, production-trusted TTS rate —
`USD_PER_1K_TTS_CHARS = 0.005` (`oracle/src/tutor/orchestrator.ts`),
sourced from the provider's own `usage.processedCharactersCount` field,
unchanged since 2026-08-22 and billing every live session's own voice
today. Applying that known rate to the real scene text (via
`npm run speech:pregenerate`'s own report mode, which makes zero network
calls) gave a real number — 48 clips across every character who could
hold either role × 3 locales, ~2,572 characters, ~$0.013 total — before
any spend happened, the identical discipline D2 (§8.2) modeled with a
different provider's rate. `oracle/src/tutor/roleplayScenes.ts` (the
scene text, mirrored from the frontend the same hand-mirrored way every
cross-service field in this catalog already is) merges into
`pregenerate-speech.ts`'s EXISTING catalogue — one shared Depot bucket,
one tracked manifest, the same operator-opt-in `--confirm` gate — rather
than standing up a second pregeneration pipeline for a second closed set.

**A new gate closes the safety property this decision actually turns
on.** `roleplay-voices:check` (`agent/tools/check-roleplay-voice-parity.mjs`)
holds oracle's copy of the dialogue to EXACT agreement with the frontend's
own captioned text, beat for beat and locale for locale — because the real
risk here was never cost, it was drift: a learner HEARING one sentence
while READING a different one, which crashes nothing and is exactly the
kind of silent divergence this file's own §1.5-adjacent "two services
share no types" reality already produces elsewhere in this catalog
(`instruments:check`, `demo-step:check`).

**Lip-sync is a deliberate, separate gap, left open rather than folded
into this pass.** `Character3D`'s `viseme`/`speaking` remain one broadcast
value for the whole standing cast; making the specific character currently
voicing a roleplay beat animate to THIS audio would mean extending
`perCharacter` (already carrying `emotion`/`action`) a second time. The
audio is genuinely spoken; the mouth does not move to it yet — recorded
here as open, not silently absent.

Full account (the exact cost arithmetic, the real `--confirm` run, live
verification of actual playback in the browser): /TUTOR_INSTRUMENTS.md
§0.0's Class III (S17 amendment) row and its decision-log entry.

### 20.16 `point_at` becomes per-element — a whiteboard-relative bearing, not IK (2026-09-04, SHIPPED)

**§20.12 named two missing pieces before a real target could exist: no
whiteboard kind exposed per-element identity, and no bone-aim code existed
anywhere in this codebase.** This amendment builds the first without ever
needing the second. `pointAt` (migration `0071`, an optional integer index)
is a new turn field — the model names WHICH element it means, on the same
turn it sets `action: "point"` — carrying the same hand-mirrored-copy tax
`roleplayScene` (§20.13) already pays end to end: `turnSchema.ts`'s own
`.refine()` (a `pointAt` with no `action: "point"` on the SAME turn is
rejected — it names what the gesture reaches for, never a fact on its
own) → `protocol.ts` → `server.ts`'s resume and live-emission sends AND its
`persistTurn` call → `core/client.ts`'s `PersistTurnInput` → the backend
route validator → `tutorData.ts`'s insert body, `TutorTurnRow` and its
`listTutorTurns` SELECT → the frontend's `types.ts` (`ServerMessage` and,
separately, `TranscriptTurn`'s own snake_case `point_at`) →
`useTutorSocket.ts`. `preferredTypes`/`demonstrate`'s own gates (§20.9,
§20.10) do not cover this field — it is neither a whiteboard KIND nor a
`demonstrate` step — so its only mechanical backstop today is
`type-check`'s own cross-service TS surface plus the new tests below; it has
no dedicated parity script yet, the same posture `roleplayScene`'s core
wiring itself shipped under before §20.15 gave voice its own gate.

**The bearing is read off the DOM the browser already laid out, not
computed from camera or bone geometry.** `resolvePointBearing()`
(`frontend/src/tutor-scene/pointTarget.ts`) reads
`getBoundingClientRect()` on a new `data-tutor-whiteboard-item="N"` marker
(added to `BarColumn`, wired today only through `SequenceBoard` — the one
kind with individually addressable, evenly-spaced elements) against the
existing whole-board `data-tutor-whiteboard` hook, and returns an `{x, y}`
pair clamped to `[-1, 1]` — where the named element sits relative to the
board's own bounds, nothing more. This is deliberately NOT a
camera/world-space projection: `ScreenAnchor.tsx`'s own `AnchorProjector`
already does that class of work per-frame for a different purpose, and
hooking a one-shot gesture bias into it would mean paying its continuous
per-frame cost for a value that only needs to be read once, at the moment a
`point` action starts. A miss at any stage — no target index, the wrong
whiteboard kind, a zero-size board — returns `null`, and `null` is not an
error state: it is the exact S16 coarse gesture, unchanged, which is what
makes this an ADDITIVE amendment rather than a second gesture system.

**The bias composes onto S16's existing lean; it does not replace it.**
`characterActions.ts`'s `point` driver (both `BIPED` and `QUADRUPED`) takes
the resolved bearing as a fourth, optional argument and adds
`bearing.x`/`bearing.y`-scaled terms to the SAME rotation axes the coarse
pose already leans on (arm/head/chest yaw from `x`, arm pitch from `y`),
gated by the same `reach` envelope that already governs the whole gesture's
timing. A `null` bearing multiplies every added term by zero, which is why
"reproduces S16 exactly" is a testable claim and not an intention — see
below.

**Live visual confirmation hit a real, pre-existing, unrelated blocker —
recorded honestly rather than glossed over.** `ConversationView.tsx`'s
infinite-render-loop bug (first found and flagged during §20.13's own S17
work, via a `git stash` A/B against the clean pre-S17 baseline) reproduced
AGAIN here, independently re-confirmed against a completely different
fixture this amendment never touches, flooding the console and starving the
3D canvas of a clean frame to screenshot. Rather than either fold in a fix
for someone else's already-flagged bug or report the feature unverified,
verification continued on two tracks a runaway render loop cannot corrupt:
(1) direct DOM measurement of the actual running Lab confirmed real,
sane pixel geometry — a 395×368px board, three evenly-spaced items, the
deliberately-chosen middle target's centre landing exactly on the board's
own centre — and surfaced a genuine, separate, second bug along the way (an
effect resolving the bearing before the freshly-switched activity's first
layout pass had painted, read back as a zero-size board; fixed with the
SAME two-pass `requestAnimationFrame` idiom `TutorFace.tsx`'s `fit()`
already established in this codebase, not a new pattern); and (2) new,
dedicated tests in `characterActions.test.ts` assert the actual claim a
screenshot would have shown — that a LEFT bearing and a RIGHT bearing yaw
the arm, head and chest in measurably different, correctly-ordered
directions (not merely "both move," the exact gap this file's own `wave`
regression test was written against originally), that top/bottom bearings
pitch the arm oppositely, that the quadruped's nose-point driver biases the
same way, and that a `null` bearing reproduces the unbiased S16 gesture to
within floating-point noise. This is real coverage of the arithmetic, not a
substitute for watching the render — the render is still owed a look the
next time this environment's own unrelated bug is fixed.

Full account (the exact hand-mirrored file list, the DOM-measurement race
found and fixed, the new tests): /TUTOR_INSTRUMENTS.md §0.0's Class III
(S16 amendment) row and its decision-log entry.

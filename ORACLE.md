# ORACLE.md — The AI Tutor (Oracle)

> **Authority:** engine spec (/AGENTS.md §1.1 #6). This document is authoritative
> for the Tutor's product flow, its privacy contract, its content strategy and
> its safety posture. The 3D STAGE it renders on is `/TUTOR_3D.md`; the exercise
> contract it composes is `/LESSON_ENGINE.md`; the generation pipeline it borrows
> is `/COURSE_ENGINE.md`. On conflict with /AGENTS.md or DESIGN.md, those win and
> this file gets fixed.
>
> **Status (2026-08-23): IN PRODUCTION.** The runtime, migration `0047`, Core's
> `/api/v1/tutor/*` surface AND the immersive experience are all built, shipped
> and verified end to end against the deployed service — Core reaches Oracle
> privately, both providers answer, a turn seals/parses/passes the judge, and
> the cast is enrolled, synthesized in their own voices, stored and fetchable.
> Live at `oracle-production-e82a.up.railway.app`. §16.1's immersion gates were
> measured on 2026-08-23; three remain unticked and each says why.
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
> **Last updated:** 2026-08-23 · Language: English (project rule).

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
is never re-dialled. The park shares the nonce ledger's single-replica
constraint (§16). Proven by `live-session.test.ts` → "a dropped session can be
resumed on a fresh token" (all three tests) and `backend/src/__tests__/tutor.test.ts`
→ "POST /api/v1/tutor/sessions/:id/resume".

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
| `planState` | server-derived lesson-plan projection: an objective composed from OUR catalog titles and the closed intent vocabulary, a closed step enum with an index, and stuck-skill counters over keys `skillStates` already names (`tutor/plan.ts`) | The lesson's spine. Carries NO learner data the rows above do not already carry — it is state the server computed about its own teaching. **Added 2026-08-28, owner sign-off.** |
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
| Moderation | §6, same as speech. |
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

---

## §12 Persistence, replay and parent visibility

Decision 8.

| Stored | Not stored |
|---|---|
| Transcript of both sides (text) | **The learner's audio** — transits for STT, never persisted |
| The tutor's synthesized audio (Depot, `tutor-speech`) | Any raw provider payload |
| Which segments were served, and their results | |
| Provenance of live-generated segments (§7.3) | |

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

**Voice cost now reaches the ledger.** `costUsd` accumulated model tokens only
and `speak()` recorded nothing, so a session could synthesise forty turns and
report the price of its tokens. It is now model + voice, with the per-character
text-to-speech rate as a named constant beside the model rates in
`orchestrator.ts` — an estimate, in one place, for the same reason §15 already
gives. Free paths add zero, which is what makes the saving visible: two
sessions with the same turn count and very different voice costs is the signal.

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

1. **There is no platform-wide spend ceiling and no circuit breaker.** Cost is
   *recorded* per session; nothing *stops* on a total. The arithmetic is
   reassuring — the observed ledger for a real three-turn session is
   `model=$0.00005`, and even a pathological 120-turn session is cents — so the
   exposure is a runaway loop or a pricing change rather than ordinary use. But
   "we would notice on the invoice" is not a control. **Before a real cohort:
   a daily spend total with a hard stop, and an alert well below it.**
2. **There is no admission control on concurrent sessions.** `oracle/` accepts
   every authenticated socket; nothing counts how many are open, and one
   process holds each live orchestrator and transcript in memory. The failure
   at saturation is memory pressure and a slowing event loop for *everyone*,
   which is the worst shape of failure. **Before a real cohort: a per-instance
   session cap that turns the next learner away politely — the product already
   has an honest "the tutor is resting" surface for exactly this — plus a
   horizontal-scale plan, which is easy because sessions share no state.**
3. **The websocket handshake is not rate limited.** It is attached to the HTTP
   server directly, so Express's limiter never sees it. It is protected by a
   single-use, session-scoped, short-lived token minted by Core, and Core's own
   limiter and the 2/day cap sit in front of minting — so this is defence in
   depth that is missing, not an open door.
4. **The retention sweep has no monitoring of its own.** It runs nightly, it
   deletes rows AND the audio in Depot, and it refuses to report success on an
   unreachable database. Nothing alerts if the workflow stops running. A
   90-day promise that quietly stops being kept is the one failure here with
   legal weight. **Before a real cohort: alert on the sweep not reporting.**
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

None of the first five is a defect in what was built; they are the difference
between a product that is correct and a service that has been operated. The
sixth WAS a defect — a control this document asserted and the code did not
have — and it is the one now closed.

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
- [ ] `npm run verify:rig` and `npm run verify:placement` — LOCAL gates needing
      `/glb/` source exports, which are outside the repository.
- [x] Verified in-browser at 375 px, 720 px and 1280 px, light and dark,
      screenshots taken, no horizontal overflow at any width (§1.11).
- [~] **Accessibility audited with axe-core** (WCAG 2.0/2.1 A and AA) across
      all four Tutor surfaces in both themes: zero violations — **proven
      2026-08-21, and NOT re-run since the caption, the plate and the replay
      transport were rebuilt** (§16.1). Marked `~` rather than `[x]` because a
      tick here was contradicted by §16.1 two hundred lines below, and a
      child-safety checklist that disagrees with itself is worse than one with
      an honest gap in it. **Re-run axe before a minor uses this.** What
      follows is what the 08-21 run established. Every
      interactive element is tabbable, carries an accessible name and can take
      focus; the caption and transcript both announce politely. One real
      failure was found and fixed — the consent status line used a faint colour
      at 2.56:1 against a 4.5:1 requirement, on the exact sentence that tells a
      parent whether their child's microphone is on. The same token fails
      wherever it carries text elsewhere in the app (~124 places); that is
      pre-existing and tracked separately rather than rewritten inside a Tutor
      change.
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
- [ ] **Oracle runs as a SINGLE Railway replica.** The `jti` ledger that makes
      a session token single-use is in-process, so on two replicas a token
      burned on one is still fresh on the other. Verify before scaling, not
      after — and if this is ever untrue, move the ledger to Redis first.

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
- [ ] **Motion survives the quality governor.** A locked `low` tier still
      transitions between shots (DESIGN.md §Motion recipe 9). Measured frame
      times and live triangle count at fullscreen against the documented
      per-frame ceiling. **NOT VERIFIED THIS PASS.** Frame times measured under
      a software rasteriser — which is what a headless machine has — say
      nothing about a real GPU, and there is no real one here. It needs a
      device.
- [ ] **Text over the render is measurable.** **HALF SUPERSEDED, half not
      re-run, and saying which is the point.** The first half — "every plate
      carrying body text stands on the opaque `bg-surface` floor" — was
      superseded on 2026-08-22 when the Lumen material took that job over and
      the last opaque core was removed (`LessonPlate`'s `floor="none"`); the
      contrast bound it protected is now derived in `HudPlate.test.tsx`
      (4.96:1 light, 7.2:1 dark for muted body text). The second half —
      axe-core reporting zero violations across all Tutor surfaces in both
      themes — was proven on 2026-08-21 and has NOT been re-run since the
      caption, the plate and the replay transport were rebuilt. **Re-run axe
      before launch.**

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

**7. The Tutor has per-learner limits but no platform-wide spending brake.**
See §15.2. It cannot be exhausted by one child; it has not been proven against
a thousand at once.

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
| **Knowledge-component graph** | Vault (`0052`: `kc`, `kc_edge`, `misconception`), seeded by `database/seeds/kc_graph.v1.json` via backend `npm run seed:kc` | The curriculum as a prerequisite DAG of units fine enough to master in one sitting — 28 KCs across two strands, 36 edges, 33 catalogued misconceptions with DETERMINISTIC detectors (numeric transforms of the item's own operands, authored distractor tags). `kc.skill_key` bridges to the existing content pools; null until an authoring pass maps it |
| **Online mastery (BKT)** | Core `services/pedagogy/bkt.ts` + `learner_kc_mastery` | Four-parameter Bayesian Knowledge Tracing, updated inside the GRADE request (never the voice turn), persisted per attempt with the posterior before/after in `kc_attempt`. Degeneracy guards in schema AND code (guess ≤ .30, slip ≤ .10); an epsilon clamp so no posterior ever freezes |
| **Spaced review (FSRS-style)** | Core `services/pedagogy/fsrs.ts` + `memory_card` | Stability/difficulty/due per (learner, KC). Deliberately not the trained 17-weight FSRS-6 — no data yet; same shape, swappable weights later |
| **The session plan** | Core `services/pedagogy/sessionPlan.ts`, on the internal session context | Review debt first (due cards, capped at 2), then the ZPD frontier: KCs whose hard prerequisites sit at p ≥ .80, ranked by distance to predicted P(correct) = .75 plus unlock count, capped at 4. Entries carry the localized objective, weakest-first prerequisite ids (the PROBE path) and the KC's misconception hints |
| **The strategy controller** | Oracle `tutor/controller.ts` | Twelve strategies (DIRECT, WORKED, FADED, SOCRATIC, FLUENCY, SPACED, PROBE, REMEDIATE, RESCUE, ELABORATE, TRANSFER, CELEBRATE) chosen per turn from mastery bands and server-witnessed events. Guardrails as pure tested rules: rescue fires once per slump and re-arms on progress, questions that go nowhere three turns running degrade to a faded example, difficulty never rises after a failure, ≤ 3 strategy changes per minute, PROBE judges "unexpected" on the PRE-update belief. Two of those were rewritten on 2026-08-29 after being MEASURED rather than read: "never two RESCUEs in a row" bounced a struggling learner between rescue and direct instruction on alternating turns forever, because the failure count stays high and every second proposal was downgraded rather than suppressed — the churn cap cannot see it, since real turns clear its sixty-second window. And the Socratic degradation counted only WRONG ANSWERS, which made it unreachable (two wrong answers trigger rescue first, any correct one resets it); it now counts turns that produced no correct answer at all, which is the case the transcripts actually show — a learner answering "no sé" is never assessed, so nothing in the controller could see them stuck. Fixing SOCRATIC alone then exposed the identical defect one band up — a learner who had mastered something and gone quiet was given FLUENCY, timed drills, seven turns running — so the rule applies to every questioning strategy, not the one §9.2 names. Mastery also now requires EVIDENCE and not only confidence: the BKT mirror takes a learner from 0.50 to 0.845 on one correct answer, so a plan entry was celebrated and left behind on evidence a guess produces one time in five, and a competent learner finished the whole session plan in three turns and spent the rest of the session with the controller dormant. Three assessed opportunities are now required, seeded from the learner's persisted `attempts`, which is the count the blueprint's own schema carries as `n_opportunities`. Mastery additionally holds when the answer was HESITANT — §8.3's "correcto + latencia alta → dominio frágil, no promover" — measured as a correct answer taking more than twice this learner's own median for that KC. The threshold is the learner's own pace deliberately: every absolute number would have been invented, and one tuned on a guess silently holds back every careful child. It refuses to judge with fewer than two prior measurements, and a null latency is never read as a fast answer. Both ends of the interval are server-side clocks, so nothing new is asked of the client and nothing new is stored about the learner (§1.9 untouched). The mirror signal guards the diagnosis: a WRONG answer given faster than a third of that median reads as a guess, and a guess must not set a misconception code. This matters more here than §8.3 suggests, because our content playbook requires every wrong option to encode a specific misconception and to be "tempting AND diagnostic" — so across 475 published lessons a child tapping at random lands on a diagnosed wrong idea nearly every time they miss, and the tutor would spend its next turns arguing against an idea the child never held while the real problem, disengagement, went untouched. The better the distractors, the more confidently wrong the diagnosis. A detected guess drops the code and carries an instruction to change the MODALITY rather than re-teach, and it never accuses — a child answering fast may be bored, tired or testing the toy. The turn checkers guard the same boundary from the other side, and one of them was wrong in the direction that WORSENS as the tutor improves: a bare mention of the screen was read as promising an activity, so the turn that reacts to a graded activity — which is supposed to name what the learner just did, in the past tense ("en la pantalla pusiste la moneda de 10 en la cubeta de 'necesito'") — was treated as an unkept promise, forcing a retry, spending a call and risking a worse turn in place of the best kind this tutor produces. A screen mention now counts only when the same sentence also OFFERS something and does not narrate what the learner already did. A sixth repair closes the last prompt-only prohibition — "never announce the SAME activity twice" was asked and never checked, which is the blueprint's golden rule ("if the differentiation is in the prompt, there is no product") and the sixth time in this file that a model followed what it was checked on and drifted from what it was merely asked. Both existing detectors miss it: one needs an exact sentence match, the other looks one turn back and forgives a pair whose numbers changed — right for TEACHING, where the same method on a new problem is good practice, and wrong for an ANNOUNCEMENT, which carries no pedagogical numbers. Observed in production: "vamos a practicar con monedas en la pantalla" three times in one conversation with three different tails, every check reporting the session clean. The first three were found by `npm run verify:pedagogy`, which drives the controller through learner profiles and asserts the SEQUENCE — the class of defect a per-rule unit test structurally cannot see. `plan.ts` remains the macro-phase spine; the controller decides HOW each beat is taught |

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
screen-state machine and step dots; the input-bar consolidation; the
"un poco más" extend-twice cap (subsumed today by the 2-sessions/day server
cap, which is the stronger control); word-level caption highlighting (needs
provider timestamps); full-duplex VAD/barge-in (a voice-provider project);
per-KC content pools (`kc.skill_key` authoring pass); per-learner BKT
parameters; replaying `demonstrate` animations; the parent-portal "what is
happening" narrative; the teacher console. Each is an increment on the organs
above, none is a rearchitecture.

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

**Parental approval gate (BLOCKING before family rollout):** auto-write is the
owner-accepted interim while the platform's only active learner is the owner.
Before real families: LEARNER-store writes require guardian approval from the
portal, which reads the same ledger.

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
way. `verify-tutor-ui.mjs` drives a dedicated `whiteboard` lab scenario and
runs the SAME sweep + geometric overlap audit already built for segments
against it — 0 unreachable controls, 0 overlaps, caption never under the board.

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

**Still out of scope, backlog, not silently dropped:** a general free-form
canvas ("UI generativa acotada", blueprint §10.4) — a multi-week
content-pipeline feature (schema, CAS verifier, age classifier, content bank)
needing its own scoping pass. Additional whiteboard `kind` values
(two-quantity comparison, a marked number line) — same schema family,
straightforward once `sequence` is proven live.

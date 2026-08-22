# ORACLE.md — The AI Tutor (Oracle)

> **Authority:** engine spec (/AGENTS.md §1.1 #6). This document is authoritative
> for the Tutor's product flow, its privacy contract, its content strategy and
> its safety posture. The 3D STAGE it renders on is `/TUTOR_3D.md`; the exercise
> contract it composes is `/LESSON_ENGINE.md`; the generation pipeline it borrows
> is `/COURSE_ENGINE.md`. On conflict with /AGENTS.md or DESIGN.md, those win and
> this file gets fixed.
>
> **Status (2026-08-21):** RUNTIME BUILT, EXPERIENCE BEING REBUILT. `oracle/`
> (the runtime), migration `0047` and Core's `/api/v1/tutor/*` surface exist
> and pass their gates. The `/tutor` **experience** shipped as a dashboard of
> flat cards with the 3D stage shrunk into a panel, and the owner rejected it:
> it has to be an immersive 3D experience with the controls inside the scene.
> That rebuild is in progress and §9, §10, §14.1 and §16.1 are its contract.
> **NOT ENABLED FOR MINORS** — §16's checklist gates that, and its first item
> is a data-processing agreement that does not yet exist. Legal review in
> progress: `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md`.
>
> Where this document and the code disagree, the code is right and this
> document is the bug — §3.1 and §7.3 were corrected once already for exactly
> that reason (see the note in §7.3), and §2.1, §2.2, §9 and §10 were corrected
> on 2026-08-21 for the opposite reason: the code was following a document that
> was wrong, or that had recorded a fallback as a decision. Both directions
> happen. Every correction says what it used to say.
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
4. **Converse and teach** (§9.3) — the camera stays on the character, their
   dialogue rendered **above their head** (a deaf-accessibility requirement,
   not a nicety) and mirrored in a 2D chat bubble where the character's own
   head articulates; the Lesson Engine runs **live** on a plate floating over
   the same island, one segment at a time, chosen or generated for this
   learner. *(Corrected 2026-08-21: this step used to say "the Synthesis-style
   split — the character on the left, the Lesson Engine on the right". That
   sentence is where a two-panel dashboard came from. There is one scene and
   things float over it.)*
5. **Close kindly** (§9.5) — a session ends on a budget, warmly, with a recap
   and a reason to come back. Never a hard cut.
6. **Replay** (§12) — the session is saved and can be replayed later.

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

### §2.1 The gaps between "stage" and "tutor" — FOUR CLOSED, ONE REOPENED

> **This table said "ALL CLOSED" and it was wrong on two rows.** Corrected
> 2026-08-21 during the immersive rebuild. Both corrections are recorded here
> rather than edited away quietly, because a document that silently repairs
> itself teaches nobody which of its remaining claims to check.

| Gap | State |
|---|---|
| **Diorama choice** | **CLOSED.** `TutorStage` now forwards `scene` to `TutorScene`, which had always accepted it. The prop was simply missing, so the product could not offer an island the scene lab had been switching between for weeks. |
| **On-canvas overlays** | **CLOSED, and the doctrine generalizes past captions.** `frontend/src/tutor/SpeechCaption.tsx` is a billboarded HTML overlay ON the canvas, never scene geometry. Text in WebGL is a font-atlas problem (glyph coverage for three locales, hinting, subpixel rendering) that buys nothing here, because an overlay always faces the viewer anyway. A div gets real text rendering, real selection, real screen-reader output and real i18n for free. The caption reveals with a typewriter for sighted readers while `aria-live` announces the COMPLETE sentence — announcing the animating slice would stutter it two characters at a time. **The same reasoning covers the ENTIRE HUD**, not just captions: every offer chip, recap chip, minutes rune and lesson plate is a DOM node projected to a world point, for the same four reasons. Text in the scene is a rendering choice; text in the DOM is an accessibility guarantee. See `/TUTOR_3D.md` §9.2 for the projection channel. |
| **Streamed speech** | **CLOSED.** Oracle writes each turn's audio to Depot and hands over a URL, which is the simpler of the two options the design left open. Revisit only if the round trip is MEASURED to hurt. |
| **Per-character framing** | **CORRECTED — this row recorded the FALLBACK as the decision.** It said `liruf` and `dina` "stay at the island shot". §2.2's own primary mitigation says the opposite: *"They frame wider. Their `conversation` framing keeps more of the body in shot."* Never closing the camera on them is §2.2's stated FALLBACK, to be used only "if this reads as broken in the first real screenshot pass" — and no such pass ever ran. What shipped (`speakingFraming={ARTICULATES.includes(...) ? 'conversation' : 'vignette'}`, `ConversationView.tsx`) applied the fallback without its trigger, so two of the four selectable tutors never came to the foreground at all. The rebuild returns to the primary decision as a named shot, `closeup-wide` (§2.2). This is a correction to a document, not a new owner decision. |
| **Backdrop** | **OPEN. Reopened 2026-08-21 — it was never closed, and nothing said so.** The `auto \| dawn \| day \| dusk \| night` axis is offered in the picker (`PersonalizePanel.tsx`), Zod-validated and persisted (migration `0047`, `tutor_preferences.backdrop` with a CHECK constraint), and returned by TWO Core endpoints (`backend/src/routes/tutor.ts`). It then **reaches no renderer**: neither `TutorSceneProps` nor `TutorStageProps` has a `backdrop` field, and `SceneLighting` takes only `settings`. A learner picks "night", the choice is saved forever, and the island is lit exactly as it was. This is §1.14's "failure must be distinguishable" in its quietest form — a control that does nothing looks identical to a control that works, from every side except the one nobody looked at. Closing it is `SceneLighting` gaining the prop and lerping its colours and intensities, which the immersive rebuild's scene work does; this row moves to CLOSED when §16.1's "every persisted preference axis provably reaches the scene" gate passes, and not before — a prop that exists is not a light that changed, and believing otherwise is what produced this row. |

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
- **The 2D bubble carries the articulation.** `CharacterActor` already takes
  `speaking`, and the 2D SVG characters animate their own mouths from it. The
  bubble is where a learner's eye goes while reading anyway.
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

The tutor greets by nickname and offers a closed set:

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
their head and mirrored in the 2D bubble, which for `liruf` and `dina` is the
only working articulation channel (§2.2). The Lesson Engine runs on a **plate
floating over the same island** — 420 px wide with scene visible on all four
sides at 1280 px, a three-detent bottom sheet at 375 px — never a panel beside
the stage and never a full-height column. The camera composes around the
plate's published rect, so the character's on-screen height is the same with a
segment and without one; a lesson that visibly shoves the tutor aside to make
room for itself reads as two products sharing a screen.

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
| Backdrop | `auto`, `dawn`, `day`, `dusk`, `night` | dragging a sun marker along a fixed overhead arc with five stops | **Renders nothing today — §2.1's reopened gap.** Light AND dark must both work. |
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
- **1280 px** — a wider establishing shot with real island around a floating
  420 px lesson plate, scene visible on all four sides of it. The extra width
  is spent on the SCENE. It is not spent on a second panel, and it is not left
  as margin.

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

  > **Honesty correction, 2026-08-21: that describes the intent, not the
  > build.** What ships today is a TRANSCRIPT — a list of lines with a native
  > `<audio controls>` per tutor turn (`SessionHistory.tsx`), which hardcodes
  > `emotion="neutral"` for every line in a component whose own comment
  > documents the re-enactment intent. Nothing re-acts anything.
  >
  > The data for the real thing is already there and was verified: a stored
  > turn carries `emotion`, `action` and `audio_path`, and Core's PostgREST
  > select explicitly asks for all three. So 3D re-enactment is **frontend
  > work with no contract change** — a director that rebuilds the session's own
  > island and cast and re-runs a shot script, with the flat list surviving as
  > the no-WebGL fallback. It is scheduled as the last increment of the
  > immersive rebuild, and until it lands this bullet describes a plan.
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
| Consent revoked mid-session | The microphone stops on the next turn. |

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
itself the thing being explained, and `closing` is the single phase it is absent
from. `unavailable` keeps it for exactly that third reason — the microphone IS
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
- [x] Verified in-browser at 375 px, 720 px and 1280 px, light and dark,
      screenshots taken, no horizontal overflow at any width (§1.11).
- [x] **Accessibility audited with axe-core** (WCAG 2.0/2.1 A and AA) across
      all four Tutor surfaces in both themes: zero violations. Every
      interactive element is tabbable, carries an accessible name and can take
      focus; the caption and transcript both announce politely. One real
      failure was found and fixed — the consent status line used a faint colour
      at 2.56:1 against a 4.5:1 requirement, on the exact sentence that tells a
      parent whether their child's microphone is on. The same token fails
      wherever it carries text elsewhere in the app (~124 places); that is
      pre-existing and tracked separately rather than rewritten inside a Tutor
      change.
- [x] Owner sign-off recorded for the §1.5 exception (§3.2).

### §16.1 The immersion gates — added 2026-08-21

Separate from the safety checklist above and NOT a substitute for it. These
gate the rebuilt experience rather than a minor's use of it, and they exist
because every one of them names something the shipped version got wrong while
every automated gate was green.

- [ ] **The stage is the page.** The canvas covers ≥ 95% of the viewport in
      every phase, at 375 px and 1280 px, in both themes. No app shell, no
      `mx-auto max-w-container`, no page `<h1>` on the route.
- [ ] **Every control is in the frame.** Zero `Card` from `components/ui`
      renders during a live session; every focusable control on the route sits
      over the canvas.
- [ ] **The microphone is present in all five states**, with an accessible
      name in each and a visible reason in each blocked one (§14.1) — and in
      every phase except `closing`, which is the one narrowing §14.1 records.
- [ ] **No two HUD surfaces overlap at rest**, in any phase, at 375 px and at
      1280 px. Three shipped at once — the greeting under the way out, the
      disabled orb on the goodbye's button, and `unavailable` printing itself
      twice — and none of them was visible to any automated gate, because jsdom
      lays nothing out. `/dev/tutor-lab` prints the live count; the measured
      arrangement is pinned in `tutor-scene/__tests__/hudSpace.test.ts`.
- [ ] **Voice is actually live in the reviewed environment** — `/health`
      reporting voice up, the casting check naming zero missing enrolments,
      and one spoken turn recorded end to end. This and the item above must
      ship together.
- [ ] **Every persisted preference axis provably reaches the scene**, backdrop
      included (§2.1, §10). A test, not an inspection — this is the gap that
      let a control ship that changed nothing.
- [ ] **All four characters come to the foreground**, `rho`/`zara` at
      `closeup` and `liruf`/`dina` at `closeup-wide` (§2.2), one greeting
      screenshot each.
- [ ] **The lesson plate floats.** At 1280 px, scene visible above, below,
      left and right of it; the character's measured on-screen height
      unchanged with and without a live segment. **This frame is shown to the
      owner before the remaining increments are built** — a hard gate, because
      it is the frame the last rejection was about.
- [ ] **Keyboard focus never lands on something invisible.** Tab through every
      phase; anchored controls behind the camera or off-screen are hidden AND
      inert.
- [ ] **Motion survives the quality governor.** A locked `low` tier still
      transitions between shots (DESIGN.md §Motion recipe 9). Measured frame
      times and live triangle count at fullscreen against the documented
      per-frame ceiling.
- [ ] **Text over the render is measurable.** Every plate carrying body text
      stands on the opaque `bg-surface` floor, no ad-hoc alpha, and axe-core
      reports zero violations across all Tutor surfaces in both themes.

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

# WALKTHROUGH.md — Current State & Decision Log

> Informational (authority level: /AGENTS.md §1.1 #7). Updated at the end of every working session via `agent/workflows/doc-sync.md`.

## Three things wrong with one screenshot (2026-08-23)

The owner sent a phone photo of `/admin/analytics` and named two faults. It
contained a third they had not mentioned, and the third is the one with a class
behind it.

### The raw translation key across the top of the chart

Above the visitor count, in place of a label, the product was rendering
`admin.analytics.web.visitorsInRange` — the key itself, as text, in Spanish, on
the admin console. All four metrics did it: `pageviewsInRange`,
`bounceRateInRange` and `visitDurationInRange` were missing too.

`AnalyticsTrendChart` assembles that key from a template literal, and
`npm run i18n:check` **says in its own output** that it cannot verify a key
built at runtime — "under a dynamic segment only the static namespace is
verified. The individual LEAF keys below it are NOT checked and cannot be."
Around 170 call sites sit in that blind spot. Every gate was green the whole
time.

**The class is now closed where it can be.** The tests are the one place the
interpolated value is real, so i18next emits `missingKey` and
`src/test-setup.ts` fails the run at the end with the complete list. It found
the four immediately — and 28 more, which turned out to be the legal-document
viewer deliberately probing one paragraph past the end and reading the miss as
its terminator. That probe now asks `i18n.exists()`: the question it was
actually asking, emitting nothing, and no longer leaning on i18next's habit of
echoing a missing key back — a habit that changes the moment anyone sets
`parseMissingKeyHandler`, and would silently truncate the contract again.

### The chart that stopped on the 18th

Plausible returns rows only for days that HAVE traffic. A quiet fortnight came
back as no rows at all, Recharts scaled the axis to the shortened series, and
the range the operator PICKED stopped matching the range they were SHOWN. That
reads as a broken view; the truth was "nobody came".

`fillDailySeries` now guarantees the series spans the requested window. It is a
UNION and not a filter: filling can only add zeros, and can never drop a day
Plausible returned. "Should not happen" is how data gets deleted, and a chart
missing a day looks exactly like a day with no traffic.

### No way back from the map

Clicking a country does three things — selects it, zooms into its regions, and
**focuses the entire console on it** through a country filter. "Back to world"
undid only the zoom. The filter survived, every card on the page stayed scoped
to one country, and the only release was a chip in the filter bar several
sections up — off-screen on a phone. Hence the report: you cannot get back
without reloading.

The control that reverses an action now sits beside the action. Back-to-world
clears the zoom, the selection AND the filter, and it appears as soon as a
country is SELECTED rather than only when zoomed, because selecting focuses the
console just as much as zooming does. Zoom-in moved to the right edge: both can
be on screen at once now, and two `left-3 top-3` buttons would have sat on top
of each other.

### What was verified, and what was not

1,811 tests green — frontend 1176/91 files, backend 453, oracle 182 — plus all
six repo gates and a clean production build. The two map tests and the four
`InRange` keys were each confirmed to FAIL against the previous code.

**Not visually verified:** `/admin/analytics` needs admin credentials this
session does not have, so those fixes rest on component tests and the runtime
key gate rather than on a screenshot. Recorded plainly because §1.11 asks for
the screenshot and this one could not be taken.

## Four production faults, and the one that made all of them invisible (2026-08-23)

**The owner's report:** the Tutor's conversation does not work, there are no
voices at all, some devices stutter at 25-30 fps, and analytics has recorded
nothing since 18 August. Plus a standing instruction now written into
`/AGENTS.md` §1.0 as rule 5: **a defect that reaches production costs this
company money**, in four ways, and that outranks convenience on every call.

### Why nothing could be diagnosed

Everything server-side passed, and kept passing while the product was broken.
`GET /health` reported model, voice and moderation all up. The deploy
workflow's `verify` step walked the whole chain from inside the platform —
private networking, both providers, a sealed and judged turn, a line
synthesized in a cloned voice, stored in Depot and fetched back. Probed from
here: the websocket upgrade succeeds and refuses a bad token with the right
close code, all nine 3D assets serve 200, the bundle carries
`VITE_SCENE_ASSET_BASE`, Pulse's collectors answer.

Every one of those checks is a NON-BROWSER client. The faults were all in the
browser, and one of them was hiding the rest.

### The one that hid the others

`TutorExperience` folded three different endings into one. The server saying
goodbye, a socket that opened and dropped, and **a socket that never opened at
all** each set phase to `closing` — which renders Dr. Rho waving and the words
"saved, you can listen to it whenever you want", about a conversation that had
not happened. `useTutorSocket` threw the CloseEvent away, so Oracle's
meaningful close codes never reached the UI either.

A total outage therefore looked like a completed session. That is §1.14 at its
most expensive: not an error dressed as success, but a **failure dressed as a
warm goodbye**. A socket that carried no turn now goes to `unavailable`, which
already degrades to the island with the reason on the microphone itself, and
non-clean close codes populate the error channel.

### No voices, for a reason no server could see

The `<audio>` element carried no `crossOrigin`. `useLipSync` routes it through
Web Audio so the mouth can follow the waveform — and per spec, a
`MediaElementAudioSourceNode` whose media is cross-origin and not CORS-approved
outputs **digital silence**. Depot does send `Access-Control-Allow-Origin: *`
(verified today), but the header is irrelevant while the element never asks.

So every clip fetched, decoded, played for its full duration, fired `ended`,
raised no error, and made no sound. The analyser read zeros, so the mouth
stayed shut too. `curl`, `verify-speaks` and every server check fetched the
same bytes happily; none of them is a browser routing audio through an
analyser, which is the only client that can see this. Set in the ref rather
than as a JSX prop, because assigning `src` first starts a load that stays
tainted.

Separately and also real: the tutor speaks BEFORE the learner touches anything,
which every autoplay policy blocks, and the rejection was swallowed. There is
now a one-shot unlock armed on mount that spends the first gesture — any
gesture — on a silent clip through the same element, and a learner who is still
refused is told so and can tap to fix it.

### 25-30 fps, and a governor that had run out of road

Two things, and the first is the more embarrassing. **`antialias` is a
context-creation attribute**, fixed for the life of the WebGL context — so the
quality governor's `antialias: false` on the low tier was a no-op. Every touch
device starts at `medium` (`pickInitialTier` caps coarse pointers there), medium
had MSAA on, and the governor spent the whole session believing it had turned
off something it could not reach. Fill rate is precisely what those devices
lack. MSAA is now decided once, from the device, and never promised to the tier.

Second: the tier ladder bottomed out at `low`, and `low` still renders every
triangle at `dpr` 1. The governor's own comment described the dead end
honestly — "already at the floor, reset the evidence rather than accumulating a
demotion that cannot be spent" — and a device that could not hold frame rate
there sat at 25 fps for the whole session with the system satisfied there was
nothing left to try. There is now a `renderScale` lever underneath the floor
(1 → 0.8 → 0.65 → 0.5), the cheapest frame time there is: halving it quarters
the pixels shaded, and it costs sharpness rather than content.

### Analytics: twelve consecutive silent nights

`insights-maintenance.yml` **last succeeded on 2026-08-07 and has failed every
single night since** — twelve consecutive runs at the time of writing. The
Insights rollups have been stale that whole time, which is why the console
shows an empty product.

The transport shape is wrong: `-- sh -c "'echo ... | psql ...'"` wraps the
command in single quotes inside the double quotes, so the remote `sh -c` gets
one argument starting with a literal quote and tries to run it as a command
name; and `-f -` was missing, so psql was never told to read the decoded SQL as
a script. `tutor-deploy.yml` uses the same `-- sh -c` form WITHOUT the inner
quotes and ran green today, which is what isolates the defect. It now matches
`railway-migrate.sh`'s proven positional shape.

**But the shape is not why it took a fortnight.** The retry loop captured the
error into `$out` and printed it only on SUCCESS. Twelve nights of evidence,
deleted on arrival, leaving "attempt 1 failed, retrying in 20s" five times and
an exit code. The error is now printed on every attempt and the final failure
is a GitHub `::error::` that names the consequence.

What changed on 2026-08-07 is still unknown and is written down as unknown: no
`@railway/cli` version was published between 07-08 and 08-13, so a release is
not the trigger, and nothing in the repository touched the file. The next run
will say, because it can now speak. All sixteen workflows that install the CLI
are pinned to `5.43.1` regardless — an unpinned dependency in the transport
layer is how a working job becomes a broken one with no commit to blame.

`analytics-diagnose.yml` is new, read-only, and exists to answer the one
question the repository cannot: whether the platform is RECORDING nothing or
SHOWING nothing. It dumps the exclusion registry (flagging any rule wider than
a single address), per-day event counts, the AGE of the newest rollup, and what
an ordinary visitor is told.

**It answered, and the answer was not what the report suggested.** Run against
production:

- **Real visitors were being measured the whole time.** From a clean address
  `tracking-decision` answers `excluded:false, degraded:false`; the registry
  holds four active rules and every one is a `/32` — two staff machines added
  2026-08-14, two more 2026-08-19. Nothing wide, no ISP range, no CGNAT pool.
- **4,345 first-party events** in the last thirty days. The emit side was never
  dead.
- **The rollups the console reads were 17 days stale** — newest row 2026-08-07,
  which is the night the maintenance job started failing.

So "nothing since 18 August" was two separate things wearing one symptom: the
Insights console reading rollups frozen on the 7th, and the owner's own devices
correctly excluded from measurement on the 14th and 19th, which removed the
traffic they were personally looking for.

**Fixed and confirmed:** `insights-maintenance` went green for the first time
since 2026-08-07, and a re-run of the diagnostic reports the newest rollup as
**1 day old, 113 rows** (was 55). The console populates again.

Two more defects were found in the tools themselves while doing this, both the
same shape as the thing they were built to find. The diagnostic's first two
runs failed and I blamed an indented heredoc — wrong; `tutor-deploy.yml` uses
that shape and runs green, because YAML dedents a block scalar before bash sees
it. The real cause was a missing `~/.ssh/config`, and it surfaced the instant
the tool was changed to PRINT its transport error. Then the tool reported a
working query as "COULD NOT READ" because PostgREST answers `206 Partial
Content` for a counted read and the check was `!== 200` — the instrument built
to separate failure from emptiness, confusing success with failure. And
`insights-maintenance` was printing `Warning: Permanently added
ssh.railway.com` as its query result, because `$out` merges stderr and its ssh
config lacked the `LogLevel ERROR` that `tutor-deploy.yml` already carries.

### Also closed

The consent-revocation gap from this morning: `/ORACLE.md` §4.3 promised a
guardian that revocation takes effect on the next turn, and the poll ran every
fifth. Rather than weaken the promise to match the code, the code now keeps it
— a minor with an OPEN microphone is re-checked every turn, everyone else keeps
the cheap five-turn poll. One internal call per turn, on exactly the sessions
where a child is speaking to a third party.

**Gates: 1,805 tests green** — frontend 1174/91 files, backend 449, oracle 182 —
plus all six repo gates, `verify:tutor`, `verify:rig` and `verify:placement`.

## Attacking the Tutor before shipping it: five HIGH defects, all of them in the seam (2026-08-23)

**The owner asked for the artifact as a PDF, for the Tutor to go to production
if it was ready, and for the security measures — prompt injection especially —
to be verified.** The honest answer to the middle one turned out to be no, and
the reason is the third one.

### The audit

Six surfaces attacked independently and in parallel — the seven-layer injection
stack, socket auth, the PII boundary, moderation and the content ladder,
availability and budgets, secrets and the speech cache — each by an adversary
told to build a concrete exploit or report nothing. Every finding then went to a
skeptic instructed to REFUTE it: check the quoted code is real, the path
reachable, and the attack not already stopped by another layer. **27 raised, 7
survived, 5 high.** Full record and, more importantly, what was NOT covered:
`/SECURITY_AUDIT_2026-08-23.md`.

Most of the system held, and held under direct attack: token auth (single-use,
session-scoped, digest comparison with no `String.length` pre-check), `.strict()`
at every nesting level, moderation fail-closed on all five failure modes, the
speech cache unable to cross a character or a locale, no credential anywhere it
should not be. The design was sound. What failed was four places where the code
did less than `/ORACLE.md` said it did.

### What was wrong, and the shape they share

**`segmentRequest.framing` reached a child's screen with no moderation** while a
comment in `turnSchema.ts` and another in `LiveSegmentPanel.tsx` both asserted it
was "moderated exactly like `say`". Only `say` was ever passed to the judge. A
model steered into saying something we would block had only to put it in the
other field of the same turn — same model, same turn, same pixel. It also flowed
raw into the tier-3 author prompt, the one place §5 says model-derived text must
never go unfenced.

**`segment_graded` and `learner_audio` skipped every cost control.** The 700 ms
floor lived inside `handleLearnerTurn`; `segment_graded` called the orchestrator
directly and never entered it, and `learner_audio` paid the speech-to-text
provider BEFORE delegating there. Dispatch is fire-and-forget, and the turn
counter advanced only after a completion returned — so a burst all measured
itself against the same stale count and all passed a cap none of them had
reached. One learner, one session, one burst: dozens of concurrent paid calls
inside the single process serving everybody.

**Oracle's IP rate limiter fronted the Core-only internal surface.** One caller,
one address, one bucket of 200 per fifteen minutes — and `preflight` runs on the
tutor OFFER screen, not just on session start. Roughly 200 page views took the
tutor offline platform-wide, with `/health` green throughout so nothing
restarted and nothing scaled. No attacker; ordinary success was the trigger.

**A mid-session consent re-check read "Core unreadable" as "still granted"** —
`=== false` where the door twenty lines away correctly refuses on `null`.

They share a shape. Every one lives in the seam between two components, on the
path BESIDE the one the feature was written for. `learner_text` was covered;
`segment_graded` was the same idea one function along. `say` was moderated;
`framing` was the other half of the same object.

### The fixes, and the one that is not code

All five fixed: one `claimTurn` that every model-producing path goes through
before any paid work, the turn slot reserved at entry to `produce()` rather than
counted at exit, `say` and `framing` moderated in one call, the tier-3 brief
fenced with a nonce, the internal surface exempt from the IP limiter, and
`!== true` on the consent re-check. Plus a startup warning nobody filed: nothing
asserted `JUDGE_MODEL_NAME` differed from `MODEL_NAME`, so a deployment could
have pointed the judge at the author and kept every verdict while losing the
independence that made them worth anything.

`oracle/src/__tests__/hardening.test.ts` holds one regression test per defect,
written to the ATTACK rather than to the feature — and **six of the seven were
confirmed to fail against the pre-fix code** (`git stash`, run, pop). A
regression test that passes both ways proves only that it ran.

### The finding that was not in the audit

Found separately while preparing the deploy: `VoiceConsentControl` did not know
the policy flag existed. It offered "Allow the microphone" to every guardian,
showed the PLACEHOLDER legal wording awaiting counsel, and stored that wording
verbatim as the record of what they agreed to — for a microphone the socket
refuses anyway while `TUTOR_VOICE_FOR_MINORS` is false. Three faults at once:
unreviewed legal text presented as an agreement, persisted as the record, and a
permission that does nothing.

Two independent guards now. The surface reads `policy` and says the true reason
instead of offering a switch; `POST /tutor/consent` answers `409 POLICY_BLOCKED`.
Both treat an ABSENT policy field as blocked — absent is not consent. Revocation
is gated by neither, deliberately: a consent granted while the policy was open
must stay withdrawable after it closes. Verified in-browser across all four
states at 1280 px and 375 px.

### The lesson

`/ORACLE.md` §15.2 asserted the turn floor and the turn cap held. True of one
path, false of another — and **the assertion is what stopped anyone looking**.
A claim in a specification is a claim about code, and it decays silently as the
code changes around it. §15.2 now carries the correction in place rather than a
quiet edit, because the failure mode is worth more than the fix.

**Gates after the work: 1,784 tests green** (frontend 1163/90 files, backend 449,
oracle 172), plus `docs:check`, `secrets:check`, `i18n:check`, `paths:check`,
`provider:check`, `verify:tutor`, `verify:rig`, `verify:placement`.

## Certifying the Tutor: every gate green, 108 screenshots, and the two things a picture found (2026-08-23)

**The task was to certify, or to say why it could not be certified.** Three
parallel passes had landed in one working tree — the mounting/measurement fix,
the caption/fold rebuild, and the 57-renderer sweep — and nothing had been run
across all of them together, nor looked at end to end.

### Reconciliation and the gates

Every gate in the repository was run against the reconciled tree. All green,
with two that needed work first.

**The frontend suite was 1151/1152, and it was not a flake.** `AnalyticsGeoMap`
waits for a country path that lives behind `React.lazy(() =>
import('./WorldChoropleth'))`, and that module pulls in 171 KB of generated
Natural Earth outlines. `waitFor`'s default budget is 1000 ms, so the test was
really waiting for Vite to transform ~190 KB inside one second while 89 test
files competed for the worker pool — 479 ms alone, over budget under load. The
failing test NAME moved between runs, which is what made it look like a flake.
Importing the module at the top of the test file moves the transform into
COLLECTION, which has no deadline. No assertion weakened; the component still
mounts its own lazy boundary and still has to suspend. **1152/1152, then
1159/1159 with the new tests.**

**`database/npm test` could never have passed on Windows.** The `confirm-apply`
scenario failed with "success sentinel missing from remote output" on
`0023_learning_insights.sql` — which reads exactly like the production
transport defect the runner exists to catch. It was the test's own fake
`railway`: it ran the remote command through `spawnSync('sh', ['-c', cmd])`,
and MSYS `sh.exe` spawned by a native process **silently truncates its command
line at 8191 characters and still exits 0**. The payload is a base64 blob of a
whole migration (13 KB for `0023`), so the pipeline lost its own `| base64 -d |
psql` mid-string and the runner correctly refused a sentinel-free reply.
Measured: 8163 chars round-trips, 8193 comes back as the raw echo argument,
status 0, stderr empty. The fake now writes the command to a script file and
runs `sh <file>` — no command line, no limit, identical on every OS, and the
contract the scenarios pin is untouched. **12 transport scenarios green.** The
gate that protects the only approved path to production Vault is now runnable
on the machine the owner develops on. RUNBOOK.md carries it.

### Looking: 108 screenshots, and what they found

Seven phases plus `adapting` and `consent`, at 375x812 and 1280x800, light and
dark, in en-US, es-MX and pt-BR. Plus the four-character greeting set, the four
end-to-end journeys, and a lesson outside the Tutor in all three locales.

Measured across that sweep: **canvas coverage 1.0000 in every phase at both
breakpoints**; **"no overlaps" from the product's own `overlappingPairs` in all
sixteen phase/breakpoint combinations**; **zero horizontal overflow**; **zero
sub-44 px interactive targets**; **zero raw i18n keys on screen**; and **zero
tab stops on anything invisible**, verified by pressing Tab for real rather than
by a static scan.

**The end-to-end journey works, including the recipe that used to break.** In
es-MX and pt-BR, at both breakpoints: personalize → open the list → invite each
of the three companions in turn → change the island → change the light → start
→ converse → adapt → close → replay. Forty-eight steps, **zero failed clicks**,
every control found by the accessible name the learner reads. After inviting all
three and switching to the Oasis, all four characters stand correctly scaled on
the new island — no 221 m shadow, no feet twelve metres under it, no 70 px
speck. The mounting-and-measurement fix holds.

### Two defects a picture found

**1. The tutor's mouth was a white rectangle at every hour but midday.**
`MouthCard` is the one unlit surface in the scene, and its own comment had long
said it "will not darken with the face as the scene's lighting changes". At Dusk
that is not a blemish: Zara's mouth photographed as a cream-white bar across an
orange-lit face, reading as tape — on one of the two characters the camera
closes in on BECAUSE they articulate. Measured against skin two head-widths
away: **+62/+104/+111 of 255 at Dusk and +133/+138/+130 at Night**, against a
Day baseline of +7/+16/+24.

An unlit material still multiplies its map by `color`, so the light is now
applied by hand — `mouthCardTint()` in `backdrops.ts`, an approximate irradiance
for a forward-facing patch of skin, expressed as a ratio against the DEFAULT
palette and encoded through the sRGB transfer function. Three properties make it
safe on a finished product and all three are tested: `auto` in light mode
returns exactly `#ffffff` so the default is byte-identical; the tint carries the
HUE of the hour, not only its brightness; and the sRGB encode is load-bearing —
**the first version wrote the linear ratio straight into an sRGB slot, applied
it twice, fixed Dusk and turned Night's mouth into a BLACK rectangle.** The same
defect wearing the other colour, caught by a screenshot and not by the test.
Worst-case mismatch fell from ~135 to ~50 of 255. TUTOR_3D.md §3.1a.

**2. ORACLE.md §14.1 said "closing is the single phase" the microphone is absent
from. It has been two since 2026-08-22.** `replaying` joined it deliberately —
the decision is in `micForPhase.ts` and asserted in `stageMic.test.tsx`
(`expect(absent).toEqual(['closing', 'replaying'])`) — but the prose was not
updated. Corrected, with the reason: a replay is a recording, so speaking into
it is impossible by construction rather than unavailable, and the phase offers
the honest alternative in the orb's place.

### The decision NOT to fix the name plate

On the desktop audition, Dina's name plate can sit close enough to Liruf to read
as his. Every plate hangs at the top of its own character's bounding box; Dina
is a quadruped whose standing spot is under her hips, so 1.90 m above that spot
projects up and back, near Liruf's snout. At 375 px it reads correctly.

The obvious fix — anchor to the head bone — was investigated and **rejected on
measured evidence.** Read out of the source bind poses as a fraction of each
character's height: rho's `head` joint is at **0.535** (his waist) while his
`head_end` is at 1.002; zara's are 0.808 and 1.001; liruf's are 0.590 and 0.659
while his MESH reaches 1.000; dina's are 0.616 and 0.464 while her `earend`
reaches 1.010. There is no rule over that table, and each model is a single
unnamed primitive with no head sub-mesh to measure instead. A per-character head
anchor is new measured data that has to come from re-rigging or a geometric
head-finder — an asset-pipeline change with its own verification pass. Moving
the plate by a constant that looks right at one camera is the failure
`TutorScene` already documents for CSS-pixel nudges. Recorded as a known
limitation in TUTOR_3D.md §3.1b with the table, and in ORACLE.md §16.2 in
language a customer-facing person can use.

### The production question, asked for the first time

ORACLE.md gains **§15.2 — what is NOT yet in place for scale.** Every control
that protects us from a single account is real and tested: 2 sessions/day, 120
XP/day, a 25-minute hard stop with a 15-minute kind wind-down, a 120-turn cap, a
600-character utterance cap, a 700 ms turn floor, a 2 MB frame cap, single-use
session-scoped tokens, 20/15/8 s upstream timeouts, and a per-session ledger
covering model tokens AND speech. Every read that feeds a limit fails closed.

What is missing is operational, not architectural, and all five would be noticed
at a thousand concurrent learners: **no platform-wide spend ceiling or circuit
breaker** (cost is recorded, nothing stops on a total); **no admission control
on concurrent sessions** (`oracle/` accepts every authenticated socket and holds
each orchestrator in memory, so saturation degrades everyone at once); **the
websocket handshake is not rate limited** (it bypasses Express — mitigated by
the single-use token and Core's own limiter in front of minting); **the
retention sweep has no alerting of its own** (the one gap with legal weight);
and **third-party rate limits are unmeasured**. The failure posture around all
of them is already correct, so the shape of a bad day is degraded rather than
broken.

### What is honestly still open

`/ORACLE.md` §16 and §16.1 are now ticked against what was actually measured and
unticked where it was not. Three were open when this was written; **the first
closed later the same day** and this paragraph is corrected rather than rewritten,
because which of the three closed and how is the useful part.

- ~~**Voice live in the reviewed environment**~~ — **CLOSED.** It was correctly
  open while it could only be done by the owner on production. It was then done
  there, in the deploy workflow's `verify` step: `/health` reporting `voice: "up"`,
  zero missing enrolments, and one line synthesized in the character's own voice,
  stored in Depot and fetched back over plain HTTP.
- **Motion under the quality governor** — still open. Frame times under a software
  rasteriser say nothing about a GPU; it needs a device.
- **An axe-core re-run** — still open. It was clean on 2026-08-21 and the caption,
  plate and replay transport have been rebuilt since.

The DPA and the legal documents remain owner actions, unchanged — and those two
are what the count "two blockers" now refers to.

## 51 renderers nobody had looked at, and a lab that lied about the language (2026-08-23)

**The setup.** The §Answer-surfaces material change had been applied across all
eight families and guarded by a source scan that fails the build on a
hand-written outline, an opaque object fill, a red "wrong" or an answer authored
under 48 px. Six renderers had actually been LOOKED at. A source scan cannot see
a layout that collapses, a glyph that overlaps or a state that reads wrong, so
the other 51 were driven through `/dev/lesson-lab` over headless Chrome and
photographed — every family, 375 and 1280, light and dark, idle / interacting /
verdict. Prioritised by exposure: the taxonomy's own tier-1 family allowlist
(`coursegen/curriculum/*/taxonomy.yaml`) says which types the youngest and
largest cohort can be served at all, so `story`, `choice`, `input`, `arrange`,
`money`, `storyplay` and the four tier-1 exceptions came first.

**Nine defects, and the two that were not visual at all.**

*`fair_trade` showed a question mark instead of the two things being traded.*
`Icon` replaces an unresolvable ligature with a neutral `help` so an invented
name never paints as giant text — and it decided by reading `el.scrollWidth`,
the width of the ELEMENT. That equals the glyph's width only while the span is
shrink-to-fit; `fair_trade` passed `block` to centre its icons, the span became
the card's 322 px against a 40 px font, and `sell` and `toys` — both perfectly
valid — became question marks. It measures a `Range` over the text run now, which
reads nothing about the box around it. A checker that reports a healthy thing as
broken is worse than no checker (/AGENTS.md §1.14), and this one shipped a
confidently wrong picture on the one exercise that asks which of two things is
worth more.

*`compare_table` cut its second column off at 375 and `canSubmit` needs every
cell.* `min-w-[420px]` on a `w-full` table inside a 335 px column, with no fade,
no shadow and nothing else saying "swipe". `table-fixed` with an explicit first
column now shares the width equally at every size; the floor moved onto the CELL
where it belongs.

*`balance_scale` was three parts near each other.* A bar floating diagonally
above two boxes it never touched, a stem hanging in the gap BELOW and between
the pans, and both pans rotated with the beam so at full tilt the label read on a
slant. Rebuilt: the beam ends over each pan's centre with a visible hanger, the
post and base sit outside the rotating group on the pivot, and each pan is
counter-rotated about its own top so it hangs level — exact at every width with
nothing measured.

*`memory_flip` re-laid its board on every flip.* `min-h-24` let a face-up card
grow to its text, 210 px beside a 178 px neighbour, so the cards a child is
memorising by POSITION moved under them. Square cells now.

*`evidence_hunt` painted the claim in the chosen-answer skin.* `lf-slab
lf-answer-selected` — the same ring and fill everything else on that screen uses
to mean "you picked this" — directly above six options, on the exercise that asks
which statements support it. It is a `.lf-well` with a label now, which is what
§Answer surfaces already says the scenario a question is about is made of.

*`concept_reveal` turned a card GREEN when you opened it,* on a content segment
where nothing is graded. The code comment justified it by "the check the eye
reads as seen"; there is no check (a bare button, not an `OptionCard`).

*`pattern_complete` wrapped the pattern* into 4 + 2 at 375 with the options bank
below as an unlabelled third row of identical tiles. The sequence is one
scrolling line now, auto-scrolled to the slot to be filled, and the bank moved
into the same well every other bank uses.

*`robot_path`'s walls were the lightest tile on the board in light mode and the
darkest in dark* (`bg-secondary-soft` flips between slate-100 and slate-900), so
the one impassable square read as empty in both. Ink at 18% plus a `block` glyph.

*Single-character chips measured 41 px across.* `TokenChip` had `min-h-12` and no
`min-w`, which is a floor on the object's height rather than on the target;
`equation_builder` and `balance_scale` are made entirely of one-character chips.

**And the lab was lying about the language.** `/dev/lesson-lab` renders its
chrome through i18n and its fixtures were pinned to `es-MX`, so every screenshot
showed English chrome around Spanish content — the same instrument defect that
made the owner believe the Tutor had hardcoded strings, on the surface the
lesson-engine work was being reviewed through. Every family's `fixtures.ts` is
now `(locale) => SegmentBase[]`: structure written once, copy written three
times, en-US as the key source of truth with the other two typed against it so a
missing key will not compile (`lesson-engine/lab/fixtureCopy.ts`). The switch
moves `i18n.changeLanguage` and the fixture set together. `/dev/tutor-lab` draws
its activity switch from the same fixtures, so its written `script`-only caveat
is gone.

**It paid for itself the same hour.** In pt-BR at 375, `piggy_split`'s jar label
"Compartilhar" sat ON the minus button: the row is one flex line with 240 px of
fixed furniture in a 311 px space, leaving 71 px for a word that does not wrap.
Spanish's "Compartir" was already spilling 10 px past its box. The row stacks
below `sm` now. Nothing but the switch could have shown that.

**Known limitation, recorded rather than fixed on the last pass.** The four
characters are drawn with different viewBox padding — Dr. Rho is `-175 -125 750
750` against Dina's `0 0 550 550` — so in the narrator strip's fixed 56/96 px box
a human renders at roughly half the apparent size of a dinosaur. It reads as a
tiny person beside a large one. It is a property of the character artwork rather
than of any lesson renderer, it is shared by every surface in the product that
mounts a character, and re-framing four SVGs is a global visual change that needs
its own sweep across marketing, dashboard and Tutor. Measured and left alone
deliberately.

## The tutor said everything twice, and the exercise ran off the bottom (2026-08-22)

**Two reports, one cause.** At 1280x800 the same 21-word sentence was printed
twice, 252 px apart — the caption over the character's crown and the 2D bubble
at the top of the lesson plate — for 142 words on screen. And 274 px of the live
exercise sat below the fold of that same plate (303 px in es-MX, 353 px at
1280x720), so a child had to discover that a panel scrolled in order to reach
the answers to the question they had just been asked. The second copy of the
sentence was 132 px of the 436 px the plate had to work with, which is how the
two reports turn out to be one.

**Why the duplicate had survived a previous pass, and why that was right at the
time.** /DESIGN.md §Lumen → *What to delete* ruled that both channels stay: the
caption is a deaf learner's channel and the 2D head is the only articulating
mouth `liruf` and `dina` have (/TUTOR_3D.md §3.1, /ORACLE.md §0 decision 4). An
agent that deleted one would have been overriding a higher-ranked document to
suit itself (/AGENTS.md §1.0). The document was right about the RULE and the
implementation was one reading of it: **two channels became two surfaces each
printing the whole sentence.** The channels the owner asked for are *the words*
and *a moving mouth*, not *the words* and *the words again*.

**The decision, now written into /DESIGN.md §Lumen → *One line, one printing,
two channels*.** Both channels share ONE surface: the caption over the speaker's
crown carries the sentence AND the articulating 2D face (`TutorFace` inside
`SpeechCaption`), so a learner reading the lips and a learner reading the words
are looking at the same 300 px of screen. The lesson plate carries the activity
and the conversation record, and never a second copy of the live line. At any
instant the tutor's current sentence exists exactly once.

**The mouth was not a mouth.** The bubble mounted a whole standing figure in a
64 px box: Dr Rho's head group measures 196x183 of a 750x750 viewBox, so his
head rendered at about 17 px and his mouth at about five. The accessibility
requirement was being honoured in the component tree and nowhere on the screen.
`TutorFace` crops to the head by measuring the artwork — four SVGs, four
viewBoxes, four head transforms, one head group each — and shows the whole
figure unchanged when it cannot measure.

**And the fold.** Three fixes, all composition: the duplicate line went (132 px);
`plate-max-height` stopped being `62vh` and became a constant band of island
above the plate (`calc(100vh - 200px)`, top edge at 176 px on every screen,
body 540 px instead of 436 at 1280x800); and the plate's body became a flex
COLUMN in which exactly one child scrolls — the ANSWERS, with the question
pinned above them and the check control pinned below. The conversation log
yields to an activity with a `flex-shrink` large enough that a shortfall comes
out of the log before it comes out of the answers, and any box with content past
its edge now says so (`.lf-scroll-edge`).

**Measured across all 57 engine fixtures on the plate, at both breakpoints**
(the Tutor serves any graded type a published lesson holds — the
`LIVE_TYPE_ALLOWLIST` constrains tier-3 generation and nothing else; two
`content` types finish on mount, so 55 are measurable): the plate's own scroller
never scrolls — 0 px hidden, every fixture, both sizes — the prompt is visible
without scrolling in all 55, and the `Check` control is on screen without
scrolling in all 43 `input` types, at 1280x800 and at 375x812. 30 of 55 need no
scrolling at all at 1280, 19 at 375. The tallest — `read_chart` wants 834 px of
prompt-plus-answers in a 420 px plate — scroll their answers between a question
that stays and an action that stays; that is recorded as a known limitation
rather than hidden.

**Four defects found by looking rather than by testing, and every one of them
would have shipped.**

1. **The crop was right for two characters and wrong for two.** The offsets were
   computed from `getBoundingClientRect` — SCREEN pixels — and written as a
   `translate()` in the element's own space, which the caption's anchor scale
   then multiplied a second time. Dr Rho's shot sits at scale 1.00 and looked
   perfect; Dina's stands off at 0.71 and her head sat against the right edge of
   the box with her jaw cut off. **A transform written in an element's own space
   may never be computed from a measurement taken in screen space.**
2. **Laying the plate's body out as a column un-hid it at PEEK.** The body is
   hidden with the `hidden` ATTRIBUTE, a 0-1-0 user-agent rule that the new
   `flex` class beats outright. Measured at 375x812 with the sheet resting: the
   whole exercise laid out below the fold, three option buttons at y = 925, 986
   and 1047 on an 812 px phone, focusable, in the tab order, and reporting
   `hidden === true` to every script that asked. Third surface on this route to
   learn it (`ScreenAnchor`, `WorldChip`, the plate) — so it is a rule now: on
   this layer, hiding writes `display`.
3. **The log took its 96 px out of the exercise.** With the ordinary shrink
   factor a 96 px log beside a 550 px exercise absorbed a seventh of any
   shortfall, and six activity types that fitted whole started scrolling by
   15-41 px. The log yields first now.
4. **One tap on "an activity is ready" landed at HALF**, which after the pinned
   prompt and the pinned check left about 90 px of exercise on a phone. A row
   that announces something opens far enough to act on it.

**Two instruments were added to `/dev/tutor-lab`, and neither is a nicety.** A
CAST switch, because `labSession` pinned the speaking tutor to `rho` and the two
characters with no 3D mouth — the whole reason the 2D face exists — could not be
put on a conversation at all. And an ACTIVITY switch drawing on the lesson
engine's own fixtures, because the scripted `quiz_mcq` is close to the shortest
thing the plate ever holds, and the plate's height is the measurement that page
exists for. The fold question could not have been answered honestly without it.

**Known limitation, stated to be defended rather than discovered.** A cartoon
mouth is not lip-readable and this pass does not claim otherwise. What the face
gives a learner who cannot hear is who is speaking, that speech is happening,
and when it stops — beside the words, at a size where all three are visible.

## Inviting Dina put her feet 12 m under the island, and the fix is two rules (2026-08-22)

**The report.** On `personalizing`, open the list and invite Dina as the
companion. Dina stops rendering, three characters remain where there should be
four, the sky turns grey and canvas coverage jumps 55.6% → 100%. It never
recovers — hiding the list, dismissing her, leaving and re-entering the phase all
stay broken — and changing the island from there collapses the camera to a 70 px
speck with all four name plates stacked in one column. Deterministic at 375 and
1280, in en-US and es-MX. The same recipe with Zara returns to baseline exactly.

**Reproduced, then measured.** A CDP harness patched `Object3D.prototype.onBeforeRender`
on the module instance the page had already loaded — `WebGLRenderer.render` is an
own property assigned in the constructor, so the prototype is not the seam — and
dumped the live scene graph either side of the invite:

| | before | after |
|---|---|---|
| Dina's contact shadow | 3.25 m across | **221.53 m** |
| Dina's feet | y = 0.14 | **y = −12.24** |
| Liruf's feet | y = 0.17 | y = 0.00 |
| composed scene box | 6.49 x 2.10 x 6.14 | **235 x 14 x 235** |
| canvas coverage | 55.6% | **100%** |

The grey sky was a 221 m black-gradient plane — Dina's own `ContactShadow`,
which is sized off her footprint. Dina was not "not rendering"; she was twelve
metres under the island. Nothing about the PLACEMENT was wrong: every spot was
walkable, inside the rim and correctly turned, which is why the gate said OK.

**Root cause, two halves, both required.** `Character3D` derived `footOffset`
and `footprint` from `new Box3().setFromObject(scene)` — a WORLD-space
measurement — on an object `useSceneModel` deliberately shares by reference. On
a first mount that object is unparented and the numbers are the export's own; on
a REMOUNT it is still inside the outgoing instance's group during the incoming
instance's render pass, so the box returns already in scene metres and is scaled
by `characterScale` a second time. Dina's scale is 67.86 (Unreal-unit export);
the other three are 1.0, which is the entire reason this was invisible for five
days — they only sank by the island's surface height.

And the remount itself: `Cast` wrapped principals in a `<Fragment key={id}>` and
audition extras in a `<Suspense key={id}>`, so a character's ELEMENT TYPE
depended on their ROLE. Inviting a candidate to stay changes the type under an
unchanged key, which React implements as unmount-and-remount — and moves the
outgoing companion the other way at the same instant, which is why Liruf sank in
the same frame.

**Not a regression from this cycle.** `Character3D.tsx` is byte-identical to
`main` and the measurement dates to 17b6950f (2026-08-17); the role-dependent
boundary and the audition that reaches it landed in df383d05 (2026-08-21), also
on `main`. Confirmed by running the same instrumented recipe in a `git worktree`
at `main` with junctioned `node_modules`: identical numbers, 224.15 m shadow,
y = −12.24. **It is shipped on `main` today.**

**The fix.** `tutor-scene/modelBounds.ts` measures a model in its OWN space by
composing local matrices down from the root, reading nothing above it — so it is
parent-independent by construction rather than by being called at the right
moment. `Character3D` and `Diorama` use it. `setFromObject` stays where the
world IS the question (the composed scene, the ground, the camera fit). Two
details cost a run each: the object-level box must win over the geometry box
wherever a class defines one, because every character is a `SkinnedMesh` whose
geometry box is bind-space (reading it collapsed Dina's shadow to 1.06 m); and
that box is computed once and cached by three, on the first, unparented,
measurement. Separately, every character now gets their own `<Suspense>`
unconditionally, and `onReady` keeps its promise through an explicit
`PrincipalModels` gate that suspends on the tutor's and companion's assets,
renders nothing, and unmounts once the stage lights up.

**The gate that missed it, closed.** `npm run verify:placement` certified the
audition and it certified lead+companion pairs, and never the character who is
both. It now sweeps every character in every role on both islands — 16 cases per
island, cast built by the product's own `standingCast` (`tutor-scene/cast.ts`,
extracted so the gate and the product cannot disagree), each compared
seat-for-seat against the plain audition — and it measures FOOTING free versus
mounted. Tightest numbers found: rim clearance **0.49 m** (`diorama-a`) and
**0.29 m** (`diorama-b`); contact-shadow margin **0.28 m** and **0.08 m**, all
four Dina. Proven to have teeth by reverting `modelBounds` to `setFromObject`:
the run fails with Dina at 1.414 m free / 95.937 m mounted.
`src/tutor-scene/modelBounds.test.ts` (10 tests) locks the measurement itself
against a real, skinned, nested model.

**Verified by looking**, at 375x812 and 1280x800, in en-US and es-MX, light and
dark, on both islands: after the invite the scene is byte-identical to the
baseline — coverage 55.6%, scene box 6.49 x 2.10 x 6.14, shadows
[3.25, 1.95, 0.95, 0.94], four characters on the ground — and changing the
island gives 9.44 x 4.04 x 9.45 with everyone still standing.

**Known limitation, unchanged by this fix and pre-existing:** a candidate's name
plate rides `focus.y + height * 0.25`, i.e. the character's own target height
above their spot. For a QUADRUPED that is the tail, not the head, so Dina's plate
sits about 270 px above her face at the audition camera and reads as adjacent to
Liruf's. It is correct for the three bipeds. Fixing it needs a measured head
height per character, or the live rig's head bone published as an anchor; both
are larger than a ship-blocker fix and neither is attempted here.

## Reconciliation: four parallel workstreams, one tree, and three defects that only a merge could see (2026-08-22)

Four sessions worked the same worktree at once — the Lesson Engine's answer
surfaces, the Tutor's replay phase, the lab's locales plus the audition's
framing, and the `backdrop-filter` profile. Each reported its own gates green.
This pass reconciled them, ran **every** gate over the union, and photographed
the result at 375x812 and 1280x800, in light and dark, in all three locales, in
all eight lab scenes — 96 cells.

Everything the four built survived intact. What the merge surfaced was three
defects that no single session could have owned:

**1. A NUL byte in a tracked source file.** `frontend/src/tutor/lab/labFixtures.ts`
carried a literal `U+0000` inside a template literal — `` `${scene}\0${locale}` ``
written with a raw byte where the two-character escape was meant. It compiled and
every gate passed, but **git and ripgrep classify the whole file as binary**, so
`grep` silently returned nothing for it and a diff showed as "Binary files
differ". A file that no search can see is a file the next session edits blind.
Replaced with the real escape.

**2. `<html lang>` never left `"en"`.** `index.html` ships `lang="en"` and
nothing in the app ever changed it, so **every Spanish and Portuguese screen in
the product declared itself English** — including the Tutor, whose entire
premise is a spoken conversation. A screen reader takes its voice and its
pronunciation rules from that attribute, so a child on the Spanish Tutor heard
Spanish read aloud by an English synthesiser. This is the owner's own standing
instruction ("SIEMPRE se debe hablar en el idioma que tiene configurado el
usuario") broken on the one surface where speech IS the product, and it was
invisible to `i18n:check`, which verifies key parity and not the document's
declared language.

Fixed in `src/i18n/index.ts`, attached to the i18next instance rather than to a
React effect: the attribute must be right for the FIRST paint and for consumers
that never mount a component (the marketing shell, a crawler, an error
boundary). It narrows a resolved-but-unshipped region (`es`, `pt-PT`) to the
locale actually in use. `src/i18n/documentLanguage.test.ts` locks it.

*How it was found:* the screenshot harness reports `document.documentElement.lang`
beside every cell, and it read `lang=en` under Spanish content. Nothing else in
the repo could have said so.

**3. A `className` that could not win.** See /DESIGN.md §Answer surfaces → "A
shape is a PROP, never a `className`". `cn()` is a concatenator, not
`tailwind-merge`, so three call sites' overrides were discarded by CSS source
order — one of them visibly, as a centred capsule sitting where a square slot
piece belonged in `arrange`'s `order_steps`. `TokenChip` now takes a typed
`shape` prop, and `answerSurfaces.test.tsx` fails the build on any owned
property handed down as a class.

## The blur is measured, and the `low` tier stops paying for it (2026-08-22)

The debt was named in this file two sessions ago and in /DESIGN.md's own "still
owes" list: *a real `backdrop-filter` profiling run on the target Intel UHD,
which is still reasoned rather than measured.* Lumen puts `backdrop-filter` on
every surface of a route that also renders an animated 3D island, so "it's
probably fine" was the last unmeasured assumption between the Tutor and a child
on a cheap phone.

**It is measured now** — headless Chrome over CDP against `/dev/tutor-lab`, in
`conversing` and `adapting`, at 375x812 with `deviceScaleFactor: 3` (a budget
Android's real pixel count), touch-emulated so the scene's probe starts the tier
where a phone starts it, and CPU-throttled at 1x/4x/6x. On a REAL GPU, not
SwiftShader: `ANGLE (Intel, Intel(R) UHD Graphics (0x0000A7A8), D3D11)`, the
same part the debt named. Each cell A/Bs one live page `on → blur(8px) → off →
on` so nothing but the filter moves, and the repeated `on` is what would have
exposed tier drift. It never drifted. Full method, its honest limits and the
table are in /DESIGN.md §Lumen → *The blur, profiled*.

**The answer, in one line: it is cheap, and the cost is the render PASS.** Four
compositor render passes per frame against one, ~0.5 ms of presented frame time
(1.1 ms worst measured), 3-8% of throughput. Three findings make the decision
rather than the headline number:

- *Flat against the radius.* `blur(8px)` instead of 24 recovers only 0.18 of the
  0.65 ms of compositor draw. A "cheaper blur for weaker devices" would pay
  almost the whole price for none of the look.
- *Flat against the AREA.* The same scene at `deviceScaleFactor` 1, 2 and 3
  blurs 0.098, 0.39 and 0.88 Mpx for 0.70, 0.63 and 0.65 ms. Nine times the
  pixels, no change. So the lever is binary; there is no middle to offer.
- *Flat against CPU throttling.* At 6x the renderer's main thread goes from
  150 ms to 900 ms of busy time per wall second and the blur's cost does not
  move. It is compositor work, which is also the honest statement of what this
  emulation CANNOT see: `setCPUThrottlingRate` never touches the GPU process, an
  Intel UHD is several times an Adreno 610, and a phone's tile-based renderer
  pays for extra passes in a way an immediate-mode desktop one does not. That
  gap is why the pass count is reported beside the milliseconds.

**So the blur stays everywhere except `low`.** `QualitySettings.lumenBlur` now
sits beside `maxPixelRatio`, `shadows` and `ambientMotion`; `StageShell`
publishes it as `data-lumen-blur="off"` on the stage root and three inherited
custom properties carry it to every plate. Wiring it is not hedging against the
numbers above — it is that `low` is the one device class the profile could not
emulate, it is a VERDICT rather than a guess (two sub-45fps windows, twice), and
on that tier the blur is buying the least: the pessimistic bracket (SwiftShader,
where the governor really does fall to `low`) spends 9% of an already-missed
frame softening a backdrop the device is barely drawing.

**What it degrades to is not new.** The same blur-less form a browser without
`backdrop-filter` already got — plate closed to `--lf-lumen-alpha-flat` 0.97,
keeping the sky-leaning fill, the key light's lip, the ground-coloured shadow
and the pane radius. One value, written once, reached two ways. Verified by
screenshot at 375 and 1280 in both themes: the flat plate reads as the same
material with the window shut, and the contrast bound only improves, which
`HudPlate.test.tsx` now asserts. Measured again through the SHIPPED switch
rather than a CDP override: 4 passes → 1, 102.4 → 108.4 fps.

## A saved conversation is performed again, not listed (2026-08-22)

The owner's note was one sentence: replays "no se ven fluidas e inmersivas como
una sesion con tutor natural, debe sentirse como una repeticion". What shipped
was a disclosure inside a list — press "Play it again" and the row expanded into
stacked `<p>`s with a native `<audio controls>` beside every tutor line. Eleven
grey browser widgets, pressed one at a time, in order, to hear a conversation
you had already had. `SessionHistory.tsx`'s own comment claimed the character
"re-acts each line with the emotion and action it originally carried"; nothing
re-acted anything, and /ORACLE.md §12 had already been amended to say so.

**Replay is now a PHASE of the stage** — `StagePhase = 'replaying'`, the seventh
— and it needed no contract change, exactly as that amendment predicted. A
stored turn carries its text, its `emotion`, its `action` and the Depot URL of
the clip synthesized for it (migration 0047); Core's replay projection already
asked for all four. Three new files: `replay/replayScript.ts` compiles a
transcript into ordered BEATS and is pure, `replay/useReplayDirector.ts` is the
clock, `replay/ReplayInWorld.tsx` is the HUD. `TutorExperience` turns the
current beat into the same four scene props a live session fills, so a replay is
the same canvas doing the same thing with a different source.

**Three decisions worth keeping.**

*The running order is not `seq`.* Oracle writes a learner's turn at the
orchestrator's current turn count and the tutor's reply at the emission's, so
both halves of one exchange can share a number — and Core serves them
`order=seq.asc` and nothing else. Sorting on `seq` alone left the order of an
exchange to whatever PostgREST returned, which is a coin flip that decides
whether a replay shows the answer before the question. The comparator is `seq`,
then `created_at`, then a rank that puts an activity after the turn that handed
it over (a segment's `seq` IS that turn's).

*The dock may not change height between beats.* The learner's own lines appear
in the dock — the rectangle their words came from when the session was live —
and the dock publishes itself on the `mic` safe-area slot, which the composition
solver aims the character around. So a row that appears on every learner turn
made the CHARACTER rise and sink in time with whose turn it was. Found by
looking, at 375x812. The row contributes no height now (`h-0 relative`, plate
positioned out of the top) and the dock measures (15, 480, 345, 216) on every
beat: tutor, learner, activity alike.

*A `z-40` inside a HUD layer is worth 30.* `StageLayer`'s wrapper is
`absolute inset-0 z-30` — a stacking context — so the introduction's
saved-conversation list, built as a `z-40` child of it, was painted over by the
microphone dock. At 375 px "Play it again" sat half covered by two dock chips
and still pressable. The archive moved into the dock's own `above` slot, where
the goodbye's copy of the same list already lived.

**Honesty is four statements and never the word "can't".** The microphone is
absent (`micForPhase` → `present: false`, the second phase after the goodbye),
the transport stands in its rectangle, the reading plate names the recording and
its date, and the chip that leaves says "Talk to Dr. Rho" — the thing a replay
cannot do, offered in the place the learner reached for it. On a phone the
sheet's resting row announces the same sentence once, because the plate's body
is not mounted at PEEK.

**Silence is a state.** Every clip is gone after ninety days by policy, so the
silent replay is the one that had to be right: a line with no audio is timed
from its text, captioned, and the 2D bubble keeps articulating, because the line
IS being performed and only the recording is missing. The lab's fixture is
deliberately a silent recording for that reason — there is no synthesized clip
in this repo and there must not be one. The stage's `<audio>` also calls
`onSpeechEnd` on `error` now, so a URL the retention sweep has already deleted
ends its beat instead of hanging the show.

Verified by looking: 16 screenshots (four moments x 375/1280 x light/dark) plus
the archive at both widths and the replay in es-MX and pt-BR. No control under
44 px in any of them.

## The lab speaks all three languages, and the tutor picker gets its island (2026-08-22)

Two findings from the same screenshot pass, and the first one was ours rather
than the product's.

**THE LAB WAS LYING ABOUT LANGUAGE.** Every fixture in
`frontend/src/tutor/lab/labFixtures.ts` was pinned to `es-MX` while the browser
ran the lab's own UI in whatever `i18next-browser-languagedetector` picked, so
every screenshot ever taken of `/dev/tutor-lab` showed English chrome wrapped
around Spanish content. The owner saw those and concluded the product had
hardcoded strings. **It does not.** Production drives the whole session off
`session.locale`, Oracle's prompt ends with "Language: ${context.locale}. Answer
entirely in this language", and `npm run i18n:check` passes all three phases.
The instrument was the broken thing, and a QA surface that lies about the exact
property under review is worse than no QA surface at all.

The panel now carries one locale switch that moves `i18n.changeLanguage` AND the
simulated session together — there is no reachable state where they disagree,
which is the only property that makes a screenshot of that page evidence. The
three scripts are WRITTEN, not translated: the same lesson, three learners, a
bike costed in pesos, dollars and reais with the arithmetic that follows from
each, plus a locale-appropriate flagged-skill slug (`OfferChips` derives the
chip's visible topic from the slug, so a Spanish slug put "Ahorro con meta" on
an English chip). Verified: seven phases x two breakpoints x three locales, no
overflow, no truncation, no plate sized for English.

**AND THE TUTOR PICKER WAS A THIRD OF A PHONE.** `personalizing` measured 29.9%
island at 375x812 while `arriving`, two taps earlier, measured 50.7% — on the
one screen a child chooses their tutor on. The cause was a PROXY: `approach`
framed the audition through a symmetric ring at 0.68 of the island's radius,
hand-tuned once against one arrangement, when what actually had to be in frame
was four people standing at 1.97 m. A ring is not four points, and it went on
charging after the cast moved.

Three things changed together and none works alone (`TUTOR_3D.md` §5, §9.1):
`ShotContext.cast` carries the whole audition so the framing follows the
arrangement; the audition separates in DEPTH rather than across the frame,
because depth satisfies the same separation floor and costs the frame's width
nothing; and `APPROACH_HOLD.portrait` became a floor equal to
`ISLAND_HOLD.portrait` — the audition is never framed further out than arrival.
**29.9% → 49.1%** at 375 and **48.5% → 55.5%** at 1280, all four candidates on
screen and facing the learner, every name legible, no control under 44 px.

Two things the numbers taught, both recorded where they will be read again:

1. **A gate that asks the easy question stays green through the hard one.** The
   coverage floor in `shots.test.ts` checked `approach` with the two-person
   fixture every other shot uses. Holding two is strictly easier than holding
   four, so the gate was green for the whole life of the 29.9%. It now has a
   four-candidate case taken off `npm run verify:placement`.
2. **Cutting the outer rings is the obvious way to gather a cast and the way
   that loses people.** A ring set stopping at 0.54 of the radius seats all four
   on `diorama-a` and only three on `diorama-b`, whose pond takes the inner
   deck. The gathering has to be a PREFERENCE, which degrades into "stand
   wherever you can"; the rings only have to be there when it needs them.

Known and deliberately not changed: the microphone still stands on
`personalizing` as a plate saying "Ready when the conversation starts."
(`micForPhase`). With the island now filling the frame it sits over a place
rather than over a void, and removing it would reopen `/ORACLE.md` §14.1's
"present in every phase where speaking is possible or about to be" without a
measurement to justify it — the coverage number does not move either way,
because coverage is set by the shot's distance and not by the HUD.

## Lumen reaches the Lesson Engine: three answer surfaces, shared by the whole product (2026-08-22)

The Tutor's most-looked-at screen had one thing left on it that Lumen had not
touched, and /DESIGN.md §Lumen named it out loud under "What this layer still
owes": on `conversing` at 1280 in light, the three exercise answers were white
outlined boxes on the reading plate — a web form dropped into a diorama.

**It was fixed in the LESSON ENGINE, not in the Tutor, and that was the point.**
`OptionCard` and its siblings in `lesson-engine/core/primitives.tsx` are shared
with the Lesson Player and with all 57 exercise renderers, so a Tutor-local
patch would have fixed one screen and left the other half of the product looking
like the thing we had just called unshippable. The owner chose the wider change
deliberately.

**The cause was not a component, it was a recipe.** `rounded-md border-2
border-outline/70 bg-surface` — four sides of uniform hairline around a flat
opaque fill, which is the silhouette of an HTML input — had been written out by
hand in about forty places across the eight families. No amount of care at a
call site was going to change that.

**What replaced it: three objects and no fourth** (/DESIGN.md §Answer surfaces).
`.lf-well` is a place something goes; `.lf-slab` is an object that carries
content; `.lf-answer` is an object you press. They are not Liquid Glass (a glass
panel over the island is the sticker Lumen deleted) and not Lumen (glass on
glass, which §Elevation rule 6 forbids). They are made of the one thing both
layers publish — THE LIGHT — because `--lf-sky`, `--lf-key`, `--lf-ground` and
`--lf-sun-height` are registered properties with global defaults, so the same
recipe reads as the island's own hour on the stage and as neutral room light on
a page, with no conditional anywhere.

The physical rule underneath, from which every value follows: **the pane is
glass and the object on it is opaque and lit.** That is why an answer always
reads as raised in both themes over any backdrop a moving render can produce.

**Four things that only looking found:**

1. **An opaque object on a 0.86 plate is not visibly raised in light mode.** The
   plate is 86% of nearly the same fill, so on a bright island the two composite
   to within a couple of percent. Tone could not do it. A convex top-lit
   gradient could, and does — the object has FORM now rather than a tone
   difference that does not exist.
2. **`rounded-md` (16 px) on a 48 px bar is most of the way to a capsule.** They
   photographed as pills, which is §Lumen's own "panes, not pills" objection.
   `rounded-sm` (10 px) is also what the concentric rule asks for: the plate is
   `lg` (24) with 16 px of padding.
3. **The number pad's readout was indistinguishable from its twelve keys** —
   same size, same material, directly above them. It is a `.lf-well` now: "your
   number lands here", said without a word in any locale.
4. **A `font-weight` on the material would have silently rewritten the closed
   type scale** on every button already carrying `lf-label` or `lf-title` (700).
   Weight went back to the call site.

**And the fifth thing only `getComputedStyle` found, after the screenshots had
already been approved.** The no-`color-mix` fallback was guarded with
`@supports not (color-mix(in srgb, red 50%, transparent))`, which looks like a
feature test and is actually a `<general-enclosed>` — the spec evaluates it to
UNKNOWN, Chrome resolves `not unknown` to TRUE, so **the fallback applied in
every browser** and the entire light-aware recipe was dead code. On the live
stage an answer's edge was `--lf-outline` and its shadow was the five-layer
atmospheric one; the ink edge and the sun-agreeing seat the material is built
around had never run. It photographed acceptably, which is why it survived —
the fallback is a decent design, it is just not this one. It also erased the
2 px state ring off every stated object, because the fallback block sits after
the state modifiers and rewrites `box-shadow`: the balance scale's right pan,
judged wrong, rendered as a plain white pan, and renders amber-ringed now.
Reading the computed style off the real page is what caught it, and it is worth
writing down that looking was not enough here — the screenshots were the reason
it nearly shipped, not the reason it was found.

**Two spec violations fell out of the same pass, both years old and both in the
most-looked-at control in the product.** LESSON_ENGINE.md §1 P3 is one sentence
— "No red WRONG" — and `optionStateClasses` painted `border-error bg-error-soft`
on the learner's own pick, while the Lesson Player's `tryAgain` banner did the
same in `error-soft` with red text and a red icon. Both are amber now, which is
what the Tutor's own verdict well already used for the same tier. And
`correct`/`wrong` were **colour only**, which /AGENTS.md §1.11 and /DESIGN.md
both forbid: `AnswerMark` is a component now — an empty ring becomes a filled
check when an option is chosen or right and a filled cross when the learner's
pick was not, with a screen-reader word on the two verdicts.

**The guard is a source scan, not a component test.** `core/answerSurfaces.test.tsx`
reads every `.ts`/`.tsx` in the engine and fails on a hand-written outline, an
opaque object fill, a red "wrong", or an answer authored at the bare 44 px
floor. A recipe that came back forty times will come back again one renderer at
a time, and a rule that lives only in a document is a rule the next author
re-derives.

Tap floor went 44 → **48 px** for every answer object, on the same reasoning
§Lumen applies to a HUD plate: an answer option is the control a child mis-taps
most, and 44 is the floor rather than the target.

## Reconciling the two Lumen passes: five defects that lived in the seams (2026-08-22)

The material pass and the applying pass were done in parallel by two engineers.
This session drove the result together — all seven phases at 375x812 and
1280x800 in both themes, and then the whole learner's journey as 24 real clicks
— and found five defects. Every one of them lived in a SEAM: a rule enforced in
one place and copied by hand into a second, or a signal published by one owner
and read by another that had gone stale. None of them was visible to either
author's own screenshots, and four of the five were being hidden by the ambient
camera orbit, which is why every measurement below was taken with
`prefers-reduced-motion: reduce` — the state a reduced-motion learner is in
permanently.

1. **The tutor's caption shrank to 12 px on the adaptation moment.** The
   projector's readability floor is 12 for every node, which is right for a chip
   — and no chip reaches it, because the 44 px tap floor stops it first. Nobody
   presses a caption, so on the caption 12 was the operating point: measured at
   375x812 with a question up, exactly 12.0 px, below the 13.7 a world chip's
   label gets, while the same tutor's question one plate below was 19. On the
   deaf learner's only channel, and against a document that calls that size "an
   apology" in the same section that calls this node "the largest type on the
   stage after the character". The floor is per-node now
   (`AnchorOptions.minTextPx`) and the caption asks for `lf-action`'s 15.
2. **The caption came back to rest on the way out.** The chrome escape runs on
   the position the camera asks for; at a close-up that is off the top of the
   frame, so it overlapped nothing and did nothing, and the frame clamp then
   parked the plate exactly where the way out stands — (55, 8, 265, 112) against
   (16, 16, 48, 48) at 375x812 in `conversing`. One of the three collisions
   /DESIGN.md was written to close, back, hidden by the orbit. The clamp and the
   escape are one function in one order now (`hudSpace.ts` → `clampThenEscape`).
3. **The adaptation moment was 240 px off-centre at 1280.** The dock stepped out
   of the bottom-right corner on `phase === 'conversing'`, and an offer is still
   `conversing` with the lesson plate standing down. The corner claim is
   published by whichever plate holds it (`StageDockValue.setCornerPlate`), which
   is the only thing that can see the two facts a phase never could — desktop
   form, and stood down. `StageShell` no longer takes a `phase` prop at all.
4. **The microphone dock's measured rectangle went stale whenever it moved.** It
   is watched by a `ResizeObserver`, and riding above a bottom surface changes
   its position and not its size. So with the personalization list open at 375
   the camera composed around a microphone that had left, and `WorldChip` could
   not tell it was covering anything: the dock at (15, 223, 345, 156) with three
   candidates' name plates underneath it, clipped, pressable and in the tab
   order. It re-publishes from the one place the move happens.
5. **And when the candidates were finally told to hide, they painted anyway.**
   The cluster is not a `WorldChip` — a candidate needs two controls — so it
   copies the projector contract by hand and had never been given the occlusion
   guard. Handing it over was not enough: `[hidden] { display: none }` is a
   0-1-0 attribute rule and the cluster's own `flex` class beats it, so the node
   reported `hidden === true` to every script that asked while sitting on
   screen. The guard writes `display` as well now — the same correction
   `ScreenAnchor` had already made for the cull one layer up, in a comment that
   was right there.

A sixth, found while walking rather than while sweeping: the island rim pad did
not opt into the clearance pass either, so "Go to Stone circle" landed across
"Talk with Dina" by 51 x 18 px. That is the exact sibling of the sun's bug fixed
the day before, one component away.

**Where it stands.** All 28 cells and all 24 stops of the journey: 0 controls
under 44 px, 0 overlaps at rest, 0 off-frame surfaces, 0 focusable-but-invisible
elements. The ship measurement is in /DESIGN.md → Screen Recipes → Tutor. Two
things are still owed and are named there rather than closed: the exercise
option cards (a lesson-engine decision, shared with 57 renderers) and a real
`backdrop-filter` profiling run on the target Intel UHD, which is still reasoned
rather than measured. *(Both paid on 2026-08-22 — the option cards by the
answer-surfaces pass below, the blur by the profiling entry at the top of this
file.)*

## Applying Lumen: every surface on the material, and nine deletions with their measurements (2026-08-22)

The material, the type, the motion and the light landed the day before as
primitives (`/DESIGN.md` §Lumen). This session put every remaining Tutor surface
on them and worked through §Lumen's own deletion list, which is now closed.

**What moved onto the material.** The lesson plate lost the opaque `bg-surface`
core inside its frame — the last one on the route, written under the
opaque-floor rule of 2026-08-21 and outliving it by a day, so the one surface a
learner spends a whole conversation looking at was the one surface the island
could not be seen through. The replay list stopped being `Card` rows (Liquid
Glass inside a Lumen sheet is glass on glass, which §Elevation rule 6 forbids
outright). Every remaining `Button` on the route became a HudPlate, so an indigo
action is `.lf-lumen-solid` at the pane radius instead of a `rounded-full` pill
wearing `lf-gaming-btn`. The tutor's spoken line is `lf-speech` in all three
places it appears, and 21 `lf-caption` call sites on chrome plates became
`lf-action` — with the stylesheet now neutralising the class inside chrome, the
same way it already neutralised `content-muted`, because a rule that has to be
remembered is a rule that is already broken somewhere.

**Three defects the deletions exposed, none of them cosmetic.**

1. **The microphone was two surfaces, and sometimes three.** A 96 px orb plus a
   plate naming it, in five of the seven phases, plus a third plate the shell
   published beside it when the browser refused — a surface saying the control
   was unusable, next to a control that still looked usable. It is one surface
   now in every state: nothing printed while it works, and where there IS a
   reason, the ring is drawn ON the plate that carries the sentence.
2. **The sun sat on Dina.** The four candidate plates opt into the projector's
   per-frame clearance pass and the sun marker did not, so at some camera
   bearings it landed on a candidate: measured at 375x812, the light chip at
   (187, 290, 72, 44) across "Dina" at (208, 314, 59, 44) — 20 px over the name
   of a character the learner is being asked to choose. Clearance belongs to a
   SET of peers, and the sun is a peer of the cast whether or not it is one.
3. **The goodbye was sitting on the tutor's face.** `closing` laid its three
   surfaces against the bottom edge through a `bottom` StageLayer, whose only
   channel is `keepClearOf` — which moves the microphone dock, the one thing
   deliberately absent on that phase. Nothing told the camera the goodbye
   existed, and at 1280x800 "See you soon!" landed at (480, 619) across Dr.
   Rho's chin. It rides the dock now (`tutor/ClosingInWorld.tsx`), which is
   measured on the `mic` safe-area slot and is therefore a rectangle the
   composition solver already aims around. It is also ONE implementation now:
   `/tutor` and `/dev/tutor-lab` held a copy each, kept in step by hand, which
   is precisely the arrangement that lets a lab report on a screen nobody ships.

**Two claims on the list did not reproduce, and saying so is the point.**
`Finish` appears exactly once at 375x812 in both detents, and the lesson plate
at 1280x800 measures (836, 280, 420, 496) — `plate-max` wide, `plate-max-height`
tall, 24 px of island under it. Both are recorded in §Lumen as measured rather
than quietly ticked. What remains genuinely owed is the exercise option cards,
and the reason it is still owed is that `OptionCard` is a lesson-engine
primitive shared with the Lesson Player and 57 renderers: a Tutor pass that
quietly restyled every lesson in the product would be a worse bug than the one
it fixed.

**A measurement lesson worth more than the pass.** The first AFTER sweep
photographed a decapitated tutor at 375x812 in two phases and it was not a
regression — the camera is critically damped and had not arrived. 2.2 s of
settle was enough while the dock was 44 px taller and not enough afterwards, so
the sweep was silently photographing a camera in flight. Every number in
§Lumen's coverage table is now taken at seven seconds.

## Three screens that could not ship: the cast had its back turned, and it was not lit (2026-08-22)

A reviewer drove every phase and refused three of them. All three had a cause
underneath the layout, and two of the causes were invisible to every gate in the
repo because no gate had ever been told to ask.

**1. Three of the four candidates stood with their backs to the learner.** On
the one screen whose whole job is choosing a tutor by looking at them. The rule
was `atan2(spot.x, spot.z)` — face radially OUTWARD from the island's centre —
written down in `/TUTOR_3D.md` §5 as a principle, with the justification
"outward is toward a camera orbiting outside it". The camera does not orbit. It
stands at ONE bearing, so outward faces the viewer along a single radius and
points into the sea everywhere else, and the audition deliberately SPREADS the
cast around the ring. Measured with `npm run verify:placement` on `diorama-a`:
liruf 138 degrees off, rho 129, zara 127. It was not confined to the audition —
on `diorama-b` an ordinary two-person session stood Dr. Rho 101 degrees off for
the entire conversation. The fix is `tutor-scene/facing.ts`: face
`STAGE_BEARING`, lean at most 20 degrees toward the nearest neighbour so a group
still reads as people sharing a place. Worst case now, anywhere, in any shipped
pairing: 20 degrees. The gate learned the question at the same time — a
placement past 45 degrees off the viewer now FAILS `verify:placement`, because
where somebody stands and which way they are turned are two facts and the gate
only knew the first.

**2. "Liruf renders SEMI-TRANSPARENT while Dina renders solid" — he does not,
and neither of them was lit at all.** Chased with a frozen camera on
`/dev/tutor-lab`, hiding one mesh at a time: 87.6% of Liruf's silhouette is
pixel-identical to a solo render and 2.2% is honestly occluded, so there is no
transparency anywhere. Read out of the `.glb` files instead, every character
ships `metallicFactor: 1` with no metalness map AND its own base-colour texture
in the emissive slot at full white. Together: no diffuse term, plus the albedo
added back as emission. The cast was rendering UNLIT — flat texture with a rough
metallic sheen, no form, no contact shading, and no relationship to the sun.
Same bug, two symptoms: a saturated character survived it and read as solid, a
pale low-contrast one washed out against orange sand and read as a ghost. It
also silently cancelled half of the four times of day, which relit the island
and never touched the people standing on it.
`tutor-scene/characterMaterial.ts` normalises an unlit export back to clay at
load — fingerprint of the export DEFAULT only, so both islands (which author
metalness per-texel) and any genuinely glowing part are untouched. Fixed at LOAD
rather than in the export because `public/scenes` is a build output and deployed
builds fetch content-addressed bytes from Depot, so a corrected export needs a
re-optimise, a re-publish and a manifest commit before it reaches a browser;
`scripts/optimize-glb.mjs` should still learn this, and that is the slower half.

**3. `adapting` was a form.** At 375 px the island was a strip across the middle
and the bottom 45% was five stacked surfaces. The question is a MOMENT with
exactly two answers, so for its duration the lesson sheet stands down (hidden,
never unmounted, publishing a footprint of zero) and the composer is suppressed
at its portal. The microphone stays. Measured: 375 px 35.0% → 39.3% island, 8 → 7
surfaces; 1280 px 54.0% → 60.6% island, 8 → 6 surfaces, and 103 → 48 words,
which is §Lumen's duplicated-tutor-line deletion finally landing.

**And the light theme stopped fighting the hour.** Dusk and night lit the island
beautifully and then sat inside a white page, because `.lf-stage-ground` pulled
every stop most of the way back to the theme's base. The premise was the bug:
the alpha the canvas does not paint is not page behind a picture, it is the same
air the island is hanging in, and air does not have a theme. The ground commits
now. The first attempt at committing went straight to `--lf-ground` and measured
WORSE — dusk's ground is a cool purple, so a warm peach screen grew a dead grey
band across its bottom third. There is no ground under a floating island; the
bottom stop is sky that has picked up the ground, which keeps the hue related
the whole way down.

Everything above was found by looking and then confirmed by measuring, in that
order. The facing bug had been in production and in the documentation as a
stated principle; the material bug had been in every screenshot anyone ever took
of this route.

## Lumen — the Tutor stops being a picture with pills on it (2026-08-22)

The owner asked for "un aspecto mas premium y futurista... una interfaz de ALTO
NIVEL", for a product that must not feel childish to a sixteen-year-old and must
not feel cold to a nine-year-old. Driven through all seven phases at 375x812 and
1280x800 in both themes, the stage read as a warm claymation diorama with white
rounded pills on top of it. This pass decided what the interface is MADE of and
wrote it into `/DESIGN.md` §Lumen; applying it screen by screen is the next one.

Four causes, all measured, and the answer to each:

- **Every control was opaque.** `HudPlate` was a `.lf-glass` frame around an
  opaque `bg-surface` core, so the only translucency on screen was the 2 px ring
  around each plate — the silhouette of a sticker. The opaque floor existed
  because "a translucent plate over an orbiting camera has no known background",
  which is true and is not the end of the arithmetic: **alpha puts a floor under
  the composite**, so the ratio exists as a BOUND. `.lf-lumen` is 0.68 for
  chrome (7.2:1 in light, 5.4:1 in dark, worst case, one ink) and 0.86 for the
  one paragraph surface per phase (4.96:1 for `content-muted`).
  `HudPlate.test.tsx` re-derives both from `index.css` for all five backdrops in
  both themes, so the bound is a gate rather than a comment.
- **Every control was a pill.** A capsule over a photographic frame reads as
  applied to the picture. Chip and plate are `md`, the orb stays a circle, the
  sheet is `lg`. `rounded-lg` on a one-line plate turned out to BE a capsule,
  which is how half the HUD kept reading as pills after the shape rule changed.
- **The world had no atmosphere.** The canvas is `alpha: true` and everything it
  did not paint was one flat `bg-base`. Four registered properties — sky, key,
  ground, sun height — are published once per backdrop change from the palette
  the lights already read (`tutor-scene/atmosphere.ts`), and `.lf-stage-ground`
  paints the void with them. Nothing is written per frame; the transition is
  600 ms because that is the settle time of `SceneLighting`'s own lerp.
- **There was no type hierarchy.** 70 `lf-caption` and 30 `lf-body` against ONE
  `lf-display-lg` across `tutor/` and `tutor-scene/`. Two tokens fenced to this
  layer: `lf-speech` (the tutor's voice, 19/21 px) and `lf-action` (an in-world
  control, 15/600 — bigger and lighter than `lf-label`'s dashboard 14/700).

Two things fell out that were not the goal and are worth recording. The **44 px
tap floor was being broken by the camera**: `min-h-11` is 44 px of layout and
the depth scale multiplied it, so six controls measured 33-41 px at 375x812 on a
rule /AGENTS.md §1.11 calls non-negotiable. `ScreenAnchor` now clamps the depth
scale against the SMALLEST control inside an anchored node — the cluster's own
box is useless, the four opening offers ride a wrapper whose `offsetHeight` is 0
— and `HudPlate` authors at 48 px so the depth cue has room to exist. Count
under the floor: 6 → 0, seven phases, both breakpoints, both themes. And
`ring-2 ring-primary` was **erasing the material**: a Tailwind ring writes
`box-shadow`, utilities outrank components, so a chosen chip lost its edge, its
lip and its shadow at the moment it was meant to look more present. Selection is
`.lf-lumen-selected` now.

Scene coverage is unchanged by all of it (375 px: arriving 50.8, personalizing
29.4, introducing 73.8, conversing 69.1, adapting 34.7, closing 50.3,
unavailable 51.7), which is the point — this pass spent nothing the last one
bought.

Deleted so far: the quiet second line on a world plate ("Dr. Rho / Your tutor"
is "Dr. Rho"; the role is carried by the selection ring and `aria-pressed`), and
the lighter ring around every control. `/DESIGN.md` §Lumen → What to delete
names the seven still standing, with the measurement for each, so the applying
pass has a list rather than an opinion.

## The island now fills a phone (2026-08-22) — the fit strategy, not the arithmetic

Scene coverage counted from the canvas alpha channel on `/dev/tutor-lab`, seven
phases, both mandatory breakpoints. At 375x812: **arriving 6.5% → 50.7%, closing
10.7% → 50.1%, unavailable 3.3% → 51.6%, adapting 6.9% → 34.6%, personalizing
12.6% → 30.2%**; introducing (72.3% → 73.9%) and conversing (69.1% → 69.1%)
unchanged, as /ORACLE.md §9.3 requires. At 1280x800: **arriving 13.6% → 53.1%,
unavailable 6.6% → 53.3%, adapting 22.3% → 47.4%, personalizing 32.6% → 48.8%,
closing 25.9% → 44.7%**.

Four decisions behind those numbers, each written up where it belongs
(`/TUTOR_3D.md` §9.1, `/DESIGN.md` → Screen Recipes → Tutor):

- **A shot fits POINTS, not a bounding box.** `establishing` used to contain the
  island's box on both axes, and on a portrait phone the width term alone put
  the camera 29 m out. It now stands as close as the points it promises allow —
  cast heads, crowns, chests, the top of the island, a stated ring — and lets
  the rest run off the edges. `ISLAND_HOLD` is below 1 in portrait and above 1
  in landscape, which is the whole composition decision in one constant.
- **Elevation is what fills a portrait frame.** The island is a floating disc on
  an alpha canvas, so a level camera sees it edge on with transparency above and
  below. Projected height grows as `sin(elevation)`; width does not move. Every
  island elevation is now per aspect.
- **`approach` is WIDER than `establishing` on a phone.** Its one phase is the
  personalization audition — the whole catalog on the island, a name plate on
  each crown, and a plate off frame is hidden AND inert. Holding four of them
  inside a 17-degree horizontal field costs about 19 m. Measured: at a 0.62 hold
  the fourth plate is culled, at 0.68 all four are on screen. The old fixed
  0.62-of-the-island-fit relationship would have framed a candidate out.
- **The HUD retreat is measured against what the shot holds.** `viewport / free`
  pushed every fitting shot back a third for a microphone dock, and coverage
  falls as the square of that — it was cancelling the framing on its own (41.6%
  → 15.7% at 1280x800). `keepInFrame` is now stated per screen axis, because one
  scalar reported a 3.4 m lateral ring as 3.4 m of vertical protection and the
  solver concluded the subject already overflowed.

Also: the idle orbit is a bounded SWING now (`ORBIT_SWING`, 0.10 rad). Unbounded
accumulation was survivable only while the shot stood far enough back that
nothing could leave the frame; a shot that bleeds cannot promise to hold a
subject it is going to orbit away from.

The floor is a test now — `shots.test.ts` → "how much of the frame the island
actually covers", one ray per sample against the island's ground disc, a
measured floor per shot at both breakpoints. It is a deliberate lower bound on
the alpha count and it does not replace looking.

Still open: `personalizing` at 375 px is 30.2%, the one phase under half a
phone, and it is bound by the audition rather than by the framing. Closing that
means changing where the candidates stand, not where the camera does.

## Tutor simplification pass (2026-08-22) — fewer words, fewer surfaces, and a caption that had been hiding

The owner asked for "menos palabras, más claridad; menos elementos, más
simplicidad, menos fricción", with a guardrail sent separately: "no olvides que
Tutor IA es una experiencia 3D inmersiva". So the pass cut CHROME and never the
scene, and every claim is a count taken on `/dev/tutor-lab` rather than an
opinion. At 375x812, across the seven phases: **193 → 144 visible words** and
**48 → 45 HUD surfaces**. The per-phase table is in `/DESIGN.md` → Screen
Recipes → Tutor.

Three decisions worth keeping:

- **The greeting no longer says the learner's name out loud** (owner). The
  spoken line is generic and pre-generated; the nickname is composed into the
  CAPTION by the client. Two halves in two places — `/ORACLE.md` §9.2 and
  `tutor/OfferChips.tsx` — and they only work together.
- **`tutor.introduce.ask` is deleted.** "What would you like to look at together
  today?" was asked immediately above the four chips that ARE that question. A
  line of instructional text beside a control that already says the same thing
  is the definition of the noise this pass was for.
- **The sun is one marker, not four labels.** Four sky chips were four of the
  twelve surfaces on the picker at 375 px, hanging in blank sky, and `auto` had
  no place on the arc at all — it was reached by pressing the lit chip a second
  time, a gesture that needed a sentence in three locales to be findable and
  that did not exist at 1280 px, where every sky mark is above the frame.

**And the bug the pass found by looking.** `/DESIGN.md` has said for a while
that a WorldChip hides and the speech caption MOVES, "because it is the deaf
learner's whole channel and may never hide". Only half of it was implemented:
the caption escaped fixed CHROME and nothing escaped the FRAME EDGE, so it fell
through to the ordinary box cull. Measured at 1280x800 in `conversing` and in
`introducing`, the caption node was `hidden` and `inert` — on desktop the
tutor's words existed only inside the lesson plate, and that plate rests CLOSED
on a phone. It clamps back into frame now (`tutor-scene/culling.ts` →
`clampIntoView`, opted into per node by `AnchorOptions.keepInFrame`, and the
caption is the only node that asks).

## Current State (2026-08-21e) — Oracle IS IN PRODUCTION: migration applied, service live, Core reaching it, PR #60 merged

The AI Tutor is deployed. Verified against the live stack, not inferred:

```
https://oracle-production-e82a.up.railway.app/health  ->  200
{"service":"oracle","version":"0.1.0","status":"ok",
 "components":{"model":"up","voice":"down","moderation":"up"},"liveSessions":0}
```

> *Superseded, and kept as the record of this moment:* `voice` reads `"up"` from
> 2026-08-21 onward, once the twelve cloned voices were enrolled. Re-confirmed
> against the deployed service on 2026-08-23 — `speaks:verify` walked the whole
> chain, one line synthesized in the character's own voice in 973 ms, stored and
> fetched back over plain HTTP.

- migration `0047_tutor_oracle.sql` applied — production ledger 46 → **47**
- the `oracle` Railway service exists, holds 13 variables, and is RUNNING
- Core holds its five and shares exactly two secrets with Oracle; the preflight
  confirms **both pairs MATCH**, printing match/differ and never a value
- Core reaches Oracle over private networking — checked from *inside* Core over
  `railway ssh`, because `ORACLE_URL` is on a network no runner can see
- the internal REST surface behind Oracle's public domain refuses an
  unauthenticated caller with `401`
- PR #60 merged; `oracle CD`, `backend CD` and `frontend CD` all green; the
  live bundle contains the Tutor strings, and `/tutor` sends a signed-out
  visitor to `/login`
- `railway-preflight`: nine services RUNNING, **0 warnings**

`voice: down` is the intended state, not a fault — see *What stays off* below.

### The deploy tooling was wrong in four ways, and only running it found them

Every one of these was green in review and false in production.

**GitHub runs `bash -e` whatever the step says.** The `provision` step opened
with `set -uo pipefail`, deliberately without `-e`, because half its commands
are allowed to fail. That intent never took effect. The first dispatch created
the `oracle` service, hit a non-zero exit on the very next line, and set none of
its variables — a service existing in production with no configuration and no
record of how it got there.

**`railway add` is interactive, and it reported failure after succeeding.** It
fell back to a picker, read the job's own arguments as answers to prompts, and
then printed "Project not found" — having already created the service. The
lesson generalises: trust the project, not the exit code.

**ssh's warning was being read as a query result.** The production dry run
reported `unexpected remote ledger state: Warning: Permanently added
'ssh.railway.com' …` — with the real answer, `present|46|present`, on the next
line of the same message. `remote_sql` merges stderr into stdout on purpose and
strips psql's `NOTICE|WARNING|…:` chatter; ssh writes `Warning: ` in mixed case
with a space, which sails straight through. An operator reads "unexpected remote
ledger state" at the exact moment they are about to migrate production, and
concludes the database is in an unknown condition. It was fine, and said so.

**Provision would have rotated a live pairing every time it ran.** The two
shared secrets were generated fresh on each dispatch. Both must be IDENTICAL on
Core and Oracle, and variables are staged with `--skip-deploys`, so each service
would adopt the new value whenever it happened to redeploy next. Between those
two moments every tutor session fails on a signature that does not verify —
both services healthy, both `/health` green, nothing in either log naming the
cause. The workflow's own header promised each step was idempotent; this one was
the opposite, so re-running it to fix a problem would have caused a larger one.

### And one trap that is nobody's bug

`--skip-deploys` is the right flag — you do not want five rolling restarts while
a service is being configured — but it means the RUNNING container still holds
the old environment. `backend CD` fired on the merge at 15:30; `ORACLE_PUBLIC_URL`
landed at 15:32. For two minutes Core was live holding the localhost DEFAULT for
the address it hands the browser. Not an error, not a warning, invisible on every
healthcheck, and simply the wrong address for every learner who asked. Core was
re-deployed and now serves the real one.

That default is why `verify` rejects a localhost `ORACLE_PUBLIC_URL` explicitly:
an unset variable does not look unset — it looks like an address that resolves
to the container itself.

### What verification is worth

`railway-preflight` proves the services are CONFIGURED to find each other. It
cannot prove they can, and the difference is a failure with no symptoms. So
`verify` now stands inside Core and calls Oracle's private address, reads
`ORACLE_PUBLIC_URL` back from Core rather than trusting what the workflow
believes it set, and POSTs to the internal REST API with no key expecting a
refusal. That last check is the point: Oracle carries a public domain as the
fourth `/AGENTS.md` §1.5 exception, granted for the learner's websocket and
nothing else. If the REST surface behind that domain answered strangers, the
exception would have quietly become an open door to a service holding
children's tutoring sessions — with every other check still green.

### The provider keys were already in the project

`step=inspect` found real `DEEPSEEK_API_KEY` and `QWEN_API_KEY` on `coursegen`.
Oracle wants the same two accounts Forge uses — same vendor, same billing, same
rotation — so provision copies them instead of asking anyone to paste a
credential into anything.

### Also fixed along the way

`npm run tools:test` had been reporting 6 pass / 4 fail on Windows long enough
that the number had stopped being read. None of the four were about the tools
under test: three died on `C:\C:\Users\…` from `URL.pathname`, and the fourth —
`railway-preflight.test.mjs` — joined PATH with `:` and set `PATH` onto a spread
of `process.env` that on Windows already carries `Path`. Its fake `railway`
binary was therefore never found, which means a preflight test run on a laptop
that happens to be logged into Railway would have reached the real production
project instead of the fixture. 10/10 now. The gate was green where it was
watched and red where it was run.

### Then I typed a question into it, and it could not answer

Everything above was green — `/health`, the preflight's thirty checks, private
networking, the 401 on the internal API, 142 tests, `verify:tutor`. So I opened
the tutor in production, picked Dr. Rho, and asked it about compound interest.
It said:

> Se me enredaron las ideas un momento. ¿Me lo preguntas otra vez?

That is `MODEL_DOWN` — the line a learner gets when the model provider throws.
Every turn, for every learner, since the moment it went live. Nothing else
could have found it: no test, no healthcheck, no preflight ever made a real
call to the provider.

**Two real defects, then a third thing that is not a defect at all.**

First: `MODEL_API_BASE` was `https://api.deepseek.com` while coursegen has
always used `https://api.deepseek.com/v1`. Neither service goes through an SDK
that appends the version — both build `${BASE}/chat/completions` by hand — so
Oracle was asking for a URL that does not exist. Provision had copied
coursegen's KEY and left Oracle on its own defaults, which is exactly how the
two came apart.

Second, and quieter: `MODEL_NAME` was `deepseek-chat`, retired 2026-07-24 and
now an alias for a v4-flash mode, while Forge writes every course with
`deepseek-v4-pro`. That failure has no error. Had only the URL been fixed, the
tutor would have worked — explaining topics with a weaker model than the lesson
that taught them, indefinitely, with nothing anywhere to suggest it.

Both are fixed in three places, because one would not have been enough: the
defaults in `oracle/src/env.ts`, the provision step (the endpoint and model now
travel WITH the key), and a new root gate `npm run provider:check` that fails
on exactly the shapes that shipped — verified by reverting them and watching it
go red. A deliberate difference goes in its `ALLOWED_DIVERGENCE` table with a
reason, so the next divergence is a decision someone wrote down.

**And then the probe found the thing underneath.** `step=verify` now calls both
providers from inside the container and reports the status code, which is what
distinguishes failures that look identical from outside:

```
== The pedagogical model (DeepSeek) ==   HTTP 402  out of credit
== The moderation judge (Qwen) ==        HTTP 200  OK
```

**The DeepSeek account has no balance.** So the tutor still cannot teach, and
now we know why in one line instead of a day. Everything around the model is
verified working; the model has nothing to answer with. That is a payment, not
a fix.

Worth watching while it is open: `coursegen` holds the same key and has
`FORGE_DEEPSEEK_FALLBACK_TO_QWEN`, so course generation may have been quietly
running on the fallback for some time with no symptom. Oracle must NOT copy
that fallback — its judge is already Qwen, and `/ORACLE.md` requires the judge
to be INDEPENDENT of the author. Falling back would collapse a §1.9
compensating control into a model grading its own work.

The deeper lesson is about `/health`. It reported `model: up` on the strength
of a key being CONFIGURED. Configured is not reachable, and every layer above
it inherited that confusion.

### Open, needing the owner

- **Custom domain** — currently the Railway-provided
  `oracle-production-e82a.up.railway.app`; the convention is
  `tutor-b2c.littlefounders.ai`.
- **Repository secrets `CORE_URL` and `INTERNAL_API_KEY`** for the nightly
  `tutor-retention.yml` sweep.
- **A signed-in smoke test.** Everything above is verifiable from outside a
  session. Driving a real tutoring conversation in production needs a login,
  which is the owner's to perform.
- **Inworld DPA, the production Inworld key, and the final consent copy** — the
  three gates on voice. The wording in the UI today is a labelled placeholder.
- **Voice enrolment** (`npm run voices:clone`) needs `audiogen/src/samples/`,
  which is gitignored and owner-held.

### What stays off, and why

`VOICE_PROVIDER=none` and `TUTOR_VOICE_FOR_MINORS=false` until a data-processing
agreement covering minors' audio exists (`/LEGAL/AI_TUTOR_LEGAL_REVIEW.md` §6).
The tutor is complete without them: captioned, typed, graded, replayable. The
agreement gates one input method, not the product.

## Current State (2026-08-21d) — Inworld VERIFIED against the live API, and the cast keeps its own voices

The owner supplied a non-production Inworld key and asked for verification.
Everything below was measured against the live service, not read off a page.

**The adapter's guesses were all wrong, which is exactly why it carried an
UNVERIFIED banner.** It assumed `/v1/speech:synthesize` and
`/v1/speech:recognize` and expected raw audio bytes. Reality:
`POST /tts/v1/voice` returning base64 in `audioContent` (814 ms), and
`POST /stt/v1/transcribe` with a nested `transcribeConfig` (715 ms). Round trip
1.53 s and the transcript was faithful — it even normalises "veinticinco" to
"25", which for a maths tutor is an improvement. Auth is `Basic <key>` with the
key **already base64-encoded**; re-encoding yields a 401 that reads like a bad
credential rather than a bad header. `npm run voices:verify` now re-runs that
round trip through the adapter, so a drift in Inworld's shapes fails a command
instead of a child's session.

**The owner caught a real product defect mid-build: the cast already has
voices.** Echo clones Dina, Liruf, Dr. Rho and Zara per locale from the owner's
reference recordings and narrates every lesson with them. A Tutor speaking in a
stock catalogue voice would have handed a child who knows Dr. Rho from a lesson
a stranger wearing his face — quietly breaking the one thing the 3D cast exists
to build. Inworld does instant cloning (`POST /voices/v1/voices:clone`, 5–15 s
of reference, no training step, **rate limited to 2 requests per minute** —
measured, so `npm run voices:clone` paces itself rather than hitting a wall of
429s at slot seven). Oracle now resolves a voice per character × locale from
`INWORLD_VOICE_<CHAR>_<LOCALE>`, named to mirror Echo's, enrolled from the SAME
trimmed samples so the two castings cannot drift apart by neglect.

**There is no fallback voice, deliberately.** An unenrolled character is SILENT
in that locale. Substituting a stock voice would be §1.14 in its purest form —
a confident wrong answer where an absent one merely omits.

**A privacy finding that only testing would have surfaced.** Inworld's STT can
return a voice profile alongside the transcript: emotion, vocal style, accent,
**age** and pitch. Measured, it is absent unless requested — but off by default
is not off, because a default is something a provider can change and we would
never notice. Oracle disables it explicitly on every request and logs an error
if one arrives anyway. Recorded for counsel, along with a second finding
neither of us had considered: cloning the characters means uploading the
owner's reference recordings to a third party, which creates a derived voice
model held by them and turns on whatever rights exist for those performances.
Three new questions went to counsel.

**The DPA decision, left to my judgement with "the product must stay
accessible".** `TUTOR_VOICE_FOR_MINORS` is now an explicit flag, default off:
no minor's microphone opens until the agreement exists, regardless of guardian
consent, which stays separate and also required. It is a flag rather than
"leave the key unconfigured" because those are DIFFERENT facts, and conflating
them is how a policy becomes an accident — a key configured so adults could use
voice would silently have opened children's microphones too. Adults are
unaffected and every learner keeps the whole tutor. The UI checks policy FIRST,
because telling a family to ask a grown-up when the answer would still be no
wastes their time.

**Accessibility audited with axe-core rather than by opinion**: WCAG 2.0/2.1 A
and AA across all four Tutor surfaces in both themes — zero violations, every
interactive element tabbable and named, both live regions announcing. One real
failure was found and fixed: the consent status line used `content-faint` at
2.56:1 against a 4.5:1 requirement, on the exact sentence that tells a parent
whether their child's microphone is on. **That token fails wherever it carries
text elsewhere in the app — about 124 places.** Pre-existing, platform-wide,
and spun out as its own task rather than rewritten inside a Tutor change;
changing the token itself would edit an authoritative DESIGN.md value and needs
sign-off.

**Gates:** oracle 142, backend 443, frontend 644 — 1,229 tests. The oracle
suite was run three consecutive times to confirm the live-socket file is
deterministic rather than flaky.

## Current State (2026-08-21c) — Tutor finished and PROVEN: the three unreachable gaps closed, and a real websocket session driven end to end

Continuation of the build entry below, on the owner's "finish it and test it".

**Three gaps made parts of the feature literally unreachable, and none of them
would have failed a test.** The consent API had no UI at all, so the microphone
gate could never be satisfied through the product and the whole voice path was
dead. Parent visibility had an endpoint and no page, so a product invariant
existed only in a route table. And the retention function had no caller, so a
90-day promise the legal brief makes on our behalf would have been kept by
nobody. All three are now real surfaces: `VoiceConsentControl` on `/family`,
`/family/:kidId/tutor`, and `.github/workflows/tutor-retention.yml`.

The retention sweep deletes the AUDIO as well as the rows, and that half is the
one worth remembering: the cascade reaches turns, segments and flags, and
nothing reaches a blob in Depot. A rows-only sweep would have left a child's
conversation audible at a public URL with every database record of it
destroyed — the worst possible combination, because nothing would remain to
tell anyone the files existed.

**The strongest new test is `oracle/src/__tests__/live-session.test.ts`.** It
stands up Oracle's real HTTP+websocket server, a real HTTP server standing in
for Core and another for the model, then drives an actual socket through
handshake, token burn, greeting, a learner turn, a served activity, a graded
result and a farewell. Nothing is mocked at a module boundary. It is the only
thing here that would catch a socket that never upgrades, a token format the
two sides disagree about, or a pipeline that deadlocks between the model and
moderation — all of which pass a unit suite and fail a learner.

**Two defects surfaced, one in the harness and one only visible by looking.**

The harness one is worth writing down because it was passing: `closed()`
attached a `close` listener AFTER the event could already have fired, so a test
that asserted on the transcript first hung forever waiting for something that
had happened. One test passed by luck and the identical pattern beside it
timed out. The socket now records its close code at construction.

The other was found in the browser and by nothing else. At 375 px the consent
row collapsed to one word per line: the button carries a full sentence
("Allow the microphone" / "Permitir el micrófono"), `shrink-0` gave it its
full intrinsic width, and the label was left about eighty pixels. It now stacks
on mobile and goes side by side from `sm`. This is the third time on this
project that looking has found what every test missed.

**Gates:** oracle 131, backend 440, frontend 644 — 1,215 tests, all green,
plus `verify:tutor`, every build, and all root gates. Verified in a real
browser at 375 px, 720 px and 1280 px in both themes. Still not enabled for
minors: `/ORACLE.md` §16's first two items belong to the owner and to counsel.

## Current State (2026-08-21b) — AI Tutor BUILT end to end: `oracle/` service, migration 0047, Core API, the `/tutor` experience

Same session as the design entry below, continued on the owner's instruction to
build the product to a production bar rather than an MVP. Delivered: a new
service, a migration, a Core surface, a frontend experience, three locales, a
legal brief, and the documentation sweep.

**Gates, all run in this session:** oracle 119 tests + type-check + lint +
build + `verify:tutor`; backend 424 tests + type-check + lint; frontend 639
tests + type-check + lint + build; database migration gates 47/47; root
`docs:check`, `secrets:check`, `i18n:check`, `paths:check`. Verified in a real
browser at 375 px and 1280 px, light and dark, with no horizontal overflow at
either width.

**Three tests caught defects that review did not, and all three were the
"fails safe, silently, forever" shape:**

1. **Key re-execution used the wrong shape.** An answer KEY is not a
   SUBMISSION — `quiz_mcq`'s key is `{correct_option_id}` and its submission is
   `{option_id}`; `fill_blank`'s key is an array of gap descriptors and its
   submission is an object keyed by gap number. Every live-generated exercise
   would have been reported unverifiable and unable to pay XP, with nothing
   going red.
2. **Tier-3 generation was a second, unsealed door to the model.** The
   architectural invariant test flagged it. The fix was not to relax the test:
   generation got its own `.strict()` brief, which deliberately omits the
   nickname because a generated exercise has no reason to address a learner by
   name and would outlive the session it was written in.
3. **A vacuity guard saved a boundary test from passing on nothing.** The
   `expect(senders.length).toBeGreaterThan(0)` line caught that a regex
   contained a literal backspace character and therefore matched no files —
   the test was green and checking nothing.

**One design defect the tests exposed rather than a code bug:** scripted lines
were being sent through the model moderation pass. They are human-written and
already reviewed, so a judge outage would have replaced one safe line with
another while doubling upstream calls per turn. Only GENERATED turns are
moderated now.

**Forge could not be used for tier-3 generation, and finding out changed the
architecture.** The design said Oracle would call it; Forge has no HTTP
generation surface at all — it is a CLI-driven batch pipeline built for
40-segment documents with a narrative arc, which is a different job from
authoring one adaptive exercise mid-sentence. What shipped splits along the
line that already existed: **Oracle authors and judges, Core verifies**,
because verification means re-running the real graders and those live with the
database. `/ORACLE.md` §3.1 and §7.3 were corrected to match the code.

**Two pre-existing cross-platform gate bugs were fixed** because they made
verification impossible on Windows: `check-migrations.mjs` and
`ciPathFilters.test.ts` both produced `/C:/...` or backslash paths from
`URL.pathname` / `path.relative`. Confirmed pre-existing by stashing.
`railway-migrate.test.mjs` still fails identically before and after these
changes and was left alone.

**What is deliberately NOT done.** The feature is not enabled for minors, and
`/ORACLE.md` §16 is the gate. Its first item is a data-processing agreement
with the voice provider that does not exist, and its second is counsel's answer
on the Terms and Privacy Notice — the consent wording currently shipping in
`tutor.consent.body` is a PLACEHOLDER and is labelled as one.
`/LEGAL/AI_TUTOR_LEGAL_REVIEW.md` is the brief: what data goes where, what is
never stored, what a child can be shown that no human approved first, and
thirteen open questions that belong to counsel rather than to engineering.
Inworld's concrete API surface is still unverified and is marked as such in the
adapter itself; `VOICE_PROVIDER=none` is the default and a fully tested mode.

## Current State (2026-08-21) — AI Tutor (Oracle): full design approved, eight owner decisions recorded, no code written yet

Session goal: design the final AI Tutor before building it. The owner asked for
doubts and key suggestions **before** any other work, and that is what this
session produced — `/ORACLE.md` was rewritten from the superseded v1 "Money
Moments" design into the approved specification, and `ROADMAP.md` carries the
decision record. **Zero implementation.** No service, no migration, no route.

**Three conflicts with standing invariants were surfaced before designing
anything, per §1.0.1.** Each was decided by the owner, and each override is now
written down rather than living in a chat log:

1. **A minor's voice reaching a third party.** §1.9 caps third-party context at
   "age band + first name"; a microphone stream is far beyond that, and v1
   ORACLE.md had classified live chat as v3+ pending a separate §1.9 review.
   Owner decision: **kids get the microphone in v1**, behind a blocking
   parental-consent gate, with a data-processing agreement covering minors'
   voice as an owner action that blocks rollout.
2. **v1's non-negotiable #1 — never a free-text box for a child.** Open
   conversation contradicts it head-on. Overridden deliberately; the reason
   `/ORACLE.md` §4–§6 are as detailed as they are is that they now carry the
   weight that closed taxonomy used to carry for free.
3. **§1.2 is LOCKED.** Inworld is a new provider and needed the owner's sign-off,
   which was given and is now recorded in ROADMAP's Open decisions table rather
   than assumed from a prompt.

**The decision that matters most for content safety.** The owner chose a
three-tier ladder — published-catalog composition, then a human-published
pre-generated bank, then **live generation** — and the argument for the third
tier is the one worth preserving: a child who did not understand the canonical
explanation needs a *different* one now, and a finite bank structurally cannot
hold it. "Come back when we have written one" is not a tutoring product. That
makes live generation the largest §1.9 exception in the project, so it is fenced
by a deterministic-grading type allowlist, the Forge gates, the independent
judge (which this project's own record shows catching twelve real semantic
defects that all nine gates passed), answer-key re-execution before any XP,
moderation, full provenance, and post-hoc sampled human review — and a
generation that fails any guard emits NOTHING rather than something generic.

**Design work that came out of reading the code rather than assuming it.**
`TutorStage` is genuinely ready — the seam in TUTOR_3D.md §7b is real — and the
gap between "stage" and "tutor" is four specific items, not a rebuild: the
diorama prop is not forwarded from `TutorScene` to `TutorStage`; nothing renders
captions over a character's head; `speechUrl` is a finished file while live TTS
is a stream; and `conversation` framing is one setting for four characters whose
mouths do not all work. The owner chose all four characters as selectable
speaking tutors despite TUTOR_3D.md §3.1 having closed mouth cards for `liruf`
and `dina`, so the mitigation is wider framing for those two plus leaning on the
2D bubble, where `CharacterActor`'s `speaking` prop already articulates the head.

**Cold start is the normal case, not an edge case.** Data Intel is deployed and
syncing, and `GET /api/v1/learn/personalization` exists in Core — but the
courses sit in `review`, so there is almost no learning evidence per user. The
"I see you are struggling with X" opening will have nothing to say at launch.
Designed for from the start: low `evidenceCount` or high `uncertainty` opens a
short diagnostic and says plainly that the tutor is still getting to know the
learner, rather than inventing a profile from no evidence.

**Still open and blocking implementation:** the §1.5 browser-exception #4 for
Oracle's websocket (recommended shape written up, needs owner sign-off), the
Inworld DPA, and verification of Inworld's actual API surface — which was
deliberately NOT assumed anywhere in the specification, and is flagged as
unverified inside `/ORACLE.md` §3.3 rather than written as if known.

## Current State (2026-08-20, SESSION CLOSE) — Inversiones course COMPLETE: 544/544 lessons, all 8 adventures, in production `review`

Session goal: generate the entire `investing` course end-to-end, same harness
as Emprendimiento, but with real urgency — the owner asked to finish as fast
as possible. Delivered in full: confirmed by direct production query,
**544/544 lessons across all 8 adventures, ×3 locales (1,632
`lesson_documents`), `status='review'`**; course row correct (`position=2`,
`requires=["financial-education","entrepreneurship"]`, `badge_asset` set).
Every document cleared the contract, all 9 gates, and the independent judge's
pass floors. Audio and images explicitly out of scope this session (owner
decision, same as Emprendimiento); images stay blocked by the DashScope
arrears.

**The interactive `Agent` tool's session-wide subagent cap was already
exhausted before this session started — Emprendimiento used all 200 spawns
with zero live agents left to resume.** The unblock was the `Workflow` tool,
whose `agent()` calls run on a wholly separate budget: the same session that
could not launch one more `Agent` call launched 8 concurrent workflows (up to
16 agents each) without issue. This is the reason the whole course finished
in one sitting instead of the adventure-by-adventure pace of the prior
session — see `coursegen/AGENTS.md` "A second full-scale run, at real
parallelism" for the full mechanism and five more defect classes found only
at this scale (seeded display order is a pure function of item+segment ids,
never the authored array order; `compare_table` structurally cannot support
a "derive the value" objective; `equation_builder` silently breaks on Unicode
×/÷ instead of ASCII */÷; sunk cost kept getting authored as opportunity
cost; topic titles need a separate `--titles` translation file the per-lesson
pipeline never touches).

**The judge caught 12 real semantic defects no gate could see, all fixed and
re-verified before publish:** three instances (two lessons) of sunk-cost
reasoning taught as opportunity cost, including one hard-coded as a graded
MCQ's correct answer; four segments unsolvable because their one needed fact
appeared only in post-answer `explanation_md`; two answer leaks via design
(a sort_buckets icon perfectly correlated with the correct bucket; a
compare_table whose prompt handed over the exact counts it should have
required the child to derive); one graded number-input widget whose
`prompt_md` never actually asked a question; two lesson openings that
retrieved a generic prior fact instead of the specific one the graph
required. All 544 lessons cleared the judge on the re-judge pass with zero
regressions from the fixes themselves.

**Mid-session, the platform's own usage limit — not the subagent cap — failed
every in-flight judge agent across all 8 workflows at once**, with the error
text clearly distinct (`You've hit your session limit`, not a spawn-cap
message). Recovery was mechanical once diagnosed: diff which verdict files
were actually missing on disk against the manifest, and relaunch workflows
with an explicit list of only those slot ranges, repeated per adventure until
every verdict existed — not a blind full-course retry.

## Current State (2026-08-18, SESSION CLOSE) — Emprendimiento course COMPLETE: 544/544 lessons, all 8 adventures, in production `review`

Session goal: generate the entire `entrepreneurship` course end-to-end using
Claude Sonnet subagents driven by hand (the cloud generation path had been
unreliable), building on the 64-lesson pilot from the prior session. Delivered
in full: confirmed by direct production query, **544/544 lessons across all 8
adventures, ×3 locales (1,632 `lesson_documents`), `status='review'`**. Every
document cleared the contract, all 9 gates, and the independent judge's pass
floors; two adventures (06, 08) cleared the judge at 68/68 with zero lessons
below floor. Learner visibility is a human `published` flip, not run this
session (COURSE_ENGINE.md §6). Audio and images are explicitly out of scope
(owner decision); images additionally stay blocked by the DashScope arrears
(2026-08-15).

**The judge caught real defects no gate can see, at every stage.** An
irresolvable typed fill-blank asking for a weekday the lesson never states; a
lesson that TEACHES reviewing at a midpoint and GRADES reviewing at the
deadline; a prerequisite (taking a percentage of an amount) graded before it
is ever taught; nine uses of "dólares" in an es-MX course; a lesson
contradicting itself on a character's established gender. All nine gates
passed every one of these.

**Revisions need re-judging, measured again this session: 3 of every 13
introduce a NEW defect.** One lesson needed four full passes — leak, then
unsolvable, then trivial transcription, then correct — each intermediate state
passing every gate. A revision report is a claim, not evidence; only a fresh
adversarial read confirms it.

**The costliest mistake this session was mine, not a subagent's:** an
authoring-world file I wrote pinned the wrong product for one adventure, and
two authoring batches obeyed my file over their own catalog-authored briefs —
the catalog is human-reviewed content design and outranks anything an agent
improvises. Cost 23 lessons of re-homing. Fix now standard: pin the world
BEFORE writing, and state explicitly that the brief outranks the world file
(`coursegen/AGENTS.md` "Proven at full scale").

**Tooling gotcha found and worked around, not yet fixed:** `author-judge`'s
`notes` field silently discards an entire valid verdict past 2000 characters —
11 genuinely-clean verdicts were dropped this way across two adventures before
the pattern was caught and truncate-and-reingest became the standard recovery.

---

## Current State (2026-08-17, SESSION CLOSE) — Tutor 3D stage LIVE in production; placement fixed

The stage is deployed and reachable. Depot serves the scene assets to the
browser, `/tutor` renders the island with rho + liruf, and the placement solver
no longer stands the cast in water. Green on every gate: 627 frontend tests
across 58 files, type-check, lint, build, verify:rig, verify:placement, i18n ×3,
docs-sync, secrets, paths.

**Three things shipped, each one found by looking rather than by a test.**

1. **Depot sent no CORS headers at all** (PR #59). Every prior consumer loads
   media through `<audio>`/`<img>`, which are no-cors requests; the 3D scene is
   the first that reads bytes in script, via `GLTFLoader`, and those ARE subject
   to CORS. `curl` reported a perfect 200 with exact byte counts nine times
   while production was broken — a shell client cannot see this class of bug.
   Public objects now carry `Access-Control-Allow-Origin: *` plus an
   `Expose-Headers` list and a preflight route (`Range` is not CORS-safelisted);
   internal objects get no CORS headers at all and moved from `Cache-Control:
   public` to `private`.

2. **A full inventory of the stage, photographed.** 87 captures driven through
   `/dev/scene-lab` by a Playwright harness: 12 actions × 4 characters, 7
   emotions, 8 visemes on both characters that have a mouth card, both framings
   at 1280 px and 375 px, both themes, both islands. Every gesture is diffed
   against its own character's idle, because a gesture photographed at the wrong
   instant looks exactly like a successful photograph of someone standing still.

3. **`diorama-b` stood its entire cast in the pond**, and had for as long as the
   island existed. Fixed with a baked walkability mask; see the Decision Log.

**Also:** the scene lab gained island and stage switches — it could not show the
second island with anyone on it, which is why nobody had seen the pond.

### Open, needing the owner

- **Vercel account is in arrears** — the project reports `"live": false` in the
  API. Same class as the DashScope and Railway billing items below.
- **Branch `chore/scene-lab-island-toggle` is committed but NOT pushed** (owner
  asked to hold): 2 commits on top of `main`, both green.

## Previous session (2026-08-15, SESSION CLOSE) — Tutor 3D stage BUILT; handed off for a Blender pass

Session goal: build the Tutor's 3D scenario. It is built, rendering for every
user on `/tutor`, and green on every gate (542 tests, type-check, lint, build,
i18n ×3, docs-sync, secrets, paths). Full spec + handoff: **`/TUTOR_3D.md`**.

**Stack added with owner sign-off (§1.2):** `three` + `@react-three/fiber` v8.
R3F v9 / drei v10 require React ≥19 and we are on 18.3.1, so the v8 line is
forced; drei is deliberately absent. `three` is isolated in a lazy chunk
(~287 kB gzip) and appears **zero** times in the entry bundle — verified per
build.

**Assets:** 156 MB → 5.19 MB (−96.7%) with all four rigs intact. Scene runs at
**7 draw calls / ~51k triangles**. Depot now accepts `model/gltf-binary`
(bucket `tutor-scenes`).

**The cast, as measured — not as assumed:** rho (adult human, 1.70 m), zara
(1.61 m), liruf (bipedal cartoon dinosaur, 1.647 m) share ONE 24-joint biped
skeleton; dina is a QUADRUPED on her own 27-joint rig and was the sole unit
outlier (Unreal scale, 0.028 m → normalised to 0.70 m at the shoulder).

**Every export ships exactly one clip, and all of them are locomotion cycles**,
so the full 12-action / 7-emotion vocabulary is driven PROCEDURALLY against the
same closed vocabulary the 2D rig and the existing lesson catalog already use —
authored `emotion`/`action` fields drive the 3D cast unchanged. Placement and
ground height are SOLVED from geometry, never authored, so a new diorama needs
no coordinates.

**⛔ Why this is handed off:** there is **no facial rig on any export** — not
one jaw, mouth, brow or eye bone. Lip-sync is impossible in code; the geometry
does not exist. The next session needs Blender. `/TUTOR_3D.md` §7 lists exactly
what to author (UV mouth atlas recommended over blendshapes) and §8 explains
how to resume, including regenerating the gitignored optimized assets.

**Still open:** KTX2 (needs `brew install ktx`; textures ship as WebP and decode
to full RGBA in VRAM), uploading optimized assets to Depot (**the deploy
blocker** — needs production credentials), gesture amplitude tuning (art
direction, not code), and the entire conversational layer (`/ORACLE.md`).

---

## Previous session (2026-08-15) — Content-quality session: 8 PRs shipped, the repair itself blocked on an unpaid provider

Session goal: the published financial-education catalog showed the same
lemonade stand over almost every exercise, and some lessons asked questions the
lesson never set up. Both were root-caused and fixed; the CODE is in production.
The data repair is **not** run — the image provider's account is in arrears.

**Shipped (8 PRs, all CI-green and deployed):** #43 image subject · #44 lesson
sequencing · #45 HTTP 414 on the course walk · #46 `--dry-run` that spent money
· #47 missing `--max-usd` ceiling · #48 plan repairs were invisible · #49
republishing removed live lessons from the child's path · #50 provider outage
degraded the catalog.

**The two reported defects share one shape:** a deterministic fixer that can
only correct HALF of a pair leaves the other half lying. A style brief that
named a subject reached every prompt and became the subject; a plan repair that
changed a segment's TYPE left its BRIEF describing another mechanic. Both are
recorded as rules in AGENTS.md §1.14 and the service AGENTS files.

**Four defects were found by RUNNING the thing, not by reading it** — the
414, the spending dry-run, the missing budget ceiling, and the publish
demotion. The measurement run is what surfaced all of them, at zero spend.

**Verified numbers (production, dry-run, no spend):** 1,208 lessons · 3,624
documents · 10,191 stale scene slots → **3,397 redraws** (÷3 locales; one
text-free drawing serves all three) → **$254.78** at one attempt each.
`picture_assets` = 9,179 rows, **zero** created this session.

**Correction to an earlier claim in this session:** an estimate of "$30–90" came
from the "~$0.02/image" comment in `imageInheritance.ts`, which is the OLD
model's price. The configured value is `COST_QWEN_IMAGE_PER_IMAGE = 0.075`. A
second claim — "gates.ts has no image references" — came from a `grep` that
silently matched nothing because the file's very long lines make grep treat it
as binary (`grep -a` works). The substantive conclusion held; the evidence did
not.

### Open (next session)

- **BLOCKER, owner action: the DashScope / Alibaba Model Studio account is in
  arrears.** Every image call returns `{"code":"Arrearage"}`. Nothing can be
  generated — and nothing is billed — until it is settled. This also disables
  the art-director judge and the subject verifier, which default to the same
  key (`JUDGE_API_KEY ?? IMAGE_API_KEY`), so running images elsewhere without
  fixing this would re-run the repair with both quality guarantees OFF.
- **Scene repair, ready to run** the moment the account is live. Pilot first:
  `archipielago-del-trueque`, 148 lessons, 394 redraws ≈ $29.55,
  `--restyle-scenes --confirm-spend --max-usd 60`. Then the rest (~3,000, ~$225).
- **Content regeneration is UNDECIDED.** #44 only affects future generation;
  the 1,208 published lessons keep the old text, and #48 confirmed plan `fixes`
  were never persisted, so the affected lessons cannot be identified
  retrospectively. Owner chose "measure with one adventure first". That run must
  also choose `--on-existing-published keep-published` (stays live, no fresh
  human read) or `demote-to-review` (§6 gate honoured, ~148 lessons leave the
  catalog until re-released). No default exists, deliberately.
- **Local Qwen inference was evaluated and deferred** (see Decision Log).
- `story_scene`'s wide-art change is covered by a component test but was **not**
  verified in a browser at 375/1280 (§1.11) — no browser tooling in the session.
- Production runs `IMAGE_MODEL=qwen-image-2.0`, while the style-version strings
  and the price default are named for `qwen-image-max`. Self-consistent (the
  model is in the cache key) but re-check the real tariff before quoting.

## Current State (2026-08-15) — A repair that changed a type was orphaning its brief: questions from nowhere

- **Reported from production:** some lessons lack sequentiality — questions
  appear that the lesson never set up.
- **Root cause: `planRepair` rewrote `seg.type` in five places and never
  touched `seg.brief`.** A plan is a TYPE and a BRIEF, and the brief carries the
  micro-situation. A segment retyped from `quiz_mcq` to `piggy_split` reached
  the writer as a jar-splitting widget carrying a pricing-decision premise, and
  the writer authored the mismatch faithfully. It concentrated LATE in the
  lesson: the money rule targets the last graded segment and the diversify rule
  scans from the end.
- **`briefFitsType` guarded only two types** (`type_answer`, `speed_tap`) and
  returned `true` for everything else, so almost every retype passed as "fits".
- **Fixed:** `describeMixRuleViolations` states each broken rule in the
  planner's vocabulary, and the corrective loop re-plans type and brief
  together — one cheap DeepSeek call, only on a real violation. `planRepair`
  survives as the last-resort net, still degrading rather than killing a slot,
  but now prepending an explicit `fixes` line so the fallback is visible.
  Every type change goes through `retype()`, which stamps `retypedFrom`;
  `write.ts` turns that into an instruction to RE-ANCHOR the premise in the same
  characters/objects/stakes rather than force it through a mechanic that cannot
  express it.
- **Checked and NOT the cause:** course-level pedagogy is already validated by
  `catalog/progression.ts` (cold-start, ramp-cliff, retention, expanding-review,
  variety, load), and the connect-to-prior instruction already requires an
  explicit retrieval opener rather than a narrative callback.
- **Correction to the previous entry:** it claimed `gates.ts` contains no image
  references, from a grep that returned nothing. `grep` was treating that file
  as binary (very long lines) and silently matching nothing; with `-a` it does
  reference `image_url`, as part of the localization freeze list. The substantive
  claim — that no gate validated illustration relevance or distinctness — still
  holds, and `verify:course` is where the new check went.

## Current State (2026-08-14) — The style brief was naming a subject: one lemonade stand over almost every exercise

- **Reported from production:** across the published financial-education
  catalog, exercise intros nearly always showed the same lemonade-stand
  picture. The exercises depend on the child reading the right image, so a
  generic one does not merely fail to help — it misleads.
- **Root cause: `LF_VISUAL_IDENTITY` ended with a SUBJECT.** *"Cheerful
  lemonade-stand world: hand-made stands, jars of coins, lemons, sunny
  neighborhoods."* sat inside a brief that is injected verbatim into every
  prompt of every purpose. `PURPOSE_GUIDANCE.scene_anchor` repeated it. A
  style brief that names a subject is a default subject.
- **What made the vacuum: the anchor's label was the INSTRUCTION.**
  `images.ts` called `fetchOne(ctx, ctx, 'scene_anchor')` with
  `ctx = plainLabel(prompt_md)`. For the numeric types that is the situation
  and works fine; for `story_dialogue` / `eavesdrop` / `dialogue_choice` /
  `story_branch` it is *"Escucha la conversación entre Dina y Liruf."* Asked to
  draw an instruction, the art director had no subject and the brief's own
  lemonade stand filled it. Confirmed against real generated documents in
  `coursegen/runs/full-regen-v4`.
- **Amplifier: nothing in the scene cache key identified the lesson.** The
  descriptor was `style | purpose | label | context` with label == context ==
  the instruction, truncated to 80 chars. Instructions repeat verbatim across a
  course, so segments in unrelated lessons hashed to ONE asset.
- **Why no gate caught it.** Prism's verifier asked only `has_text` /
  `has_person` — defects of FORM, both of which pass on a beautiful picture of
  the wrong thing. `verify:course` counted only PRESENCE, and presence was
  never missing: 100% coverage, every anchor the same file.
- **Fixed, all four layers.** (1) The brief carries style only and now states
  the rule positively (`SUBJECT DISCIPLINE: … carries no default scene of its
  own`), because silence is not a prohibition. (2) `sceneAnchorSubject` derives
  the situation from narrative payload fields — `context_md`, `opening_md`, the
  branch start node, the first two dialogue lines — never from options or
  answers, and returns nothing when there is no situation, in which case NO
  anchor is requested. (3) A `scope` (`<course>/<lesson>`) joins the scene cache
  key; tiles still collapse catalog-wide, which is the cost win. (4) The
  verifier now also answers `depicts_subject`, biased toward accepting, with a
  missing answer never blocking a clean verdict.
- **Guard rail:** `verify:course` now FAILS if any scene image serves more than
  one lesson. Free, no API calls, and the check that would have caught this.
- **Also fixed in passing:** `story_scene` art was commissioned as a wide 16:9
  scene and rendered in a 128px square; four slots the engine renders but the
  pipeline never filled (`key_ideas` titles, `concept_reveal` fronts,
  `lightning_round` options) now illustrate as cached tiles.
- **`STYLE_VERSION` v7 → v8; the tile version deliberately did NOT move,** so
  the ~9,179 cached object tiles stay valid and only scenes re-bill.
- **Repair path:** `images:backfill --restyle-scenes` clears stale scene art,
  redraws the authoring locale once and copies to the sibling locales free.
  Withholds the style stamp when a redraw could not complete, so an incomplete
  repair stays visible to the release check.

### Open

- Production regeneration NOT yet run — awaiting the owner's go-ahead on scope
  and cost (explicitly requested before any partial generation).
- The `story_scene` render change was verified by component test, not in a
  browser at 375/1280 (§1.11): no browser tooling in that session.

## Current State (2026-08-14, earlier) — GA4 had been silently discarding every command; admin panels reworked

- **GA4 recorded nothing for three weeks (2026-07-24 → 08-14) behind a tag
  that loaded normally.** `mountGa4` registered `window.gtag = (...args) =>
  dataLayer.push(args)`, pushing a real Array. gtag.js reads each dataLayer
  entry as an `arguments` object and ignores anything else, so `js`, `config`
  and every `page_view` were dropped: the property was never initialised and
  no `/g/collect` request was ever made. No error, no warning, a healthy-
  looking tag. Proven over CDP against production rather than deduced — the
  live dataLayer held `[object Array]` entries with zero google-analytics
  requests, and replaying the same commands through Google's own
  function-with-`arguments` form produced a collect immediately. Fixed,
  deployed, and re-verified live: three `[object Arguments]` and a real
  collect. The same probe confirmed Plausible and Umami do send, so the
  auto-capture fix did not silence them.
- **A VPN exit node had been approved as a staff exclusion.**
  `169.150.224.130/32`, labelled "Dispositivo del equipo", is CDN77 Houston —
  it was silently excluding every OTHER visitor using that exit while failing
  to exclude staff at all, since exit IPs rotate. Revoked with an audit entry.
  Suggestions now carry `distinctStaffUsers`: a personal device cannot be seen
  with two different staff accounts, an office NAT or VPN exit can. The console
  warns and points at `whois`. Warned, not blocked — an office IP is a
  legitimate exclusion and only the operator knows which is which.
- **Umami's twelve behavioural dimensions are now read.** Correcting an
  earlier claim in this session: the five-number aggregate WAS already
  consumed; the grep that said otherwise searched for the vendor's name, which
  appears nowhere in the frontend. Under-read, not unread.
- **One period authority per screen.** The analytics trend chart carried its
  own presets AND a drag Brush while the page header carried the real picker —
  three controls, mutually contradictable. Both in-chart controls removed. The
  signup timeline and email dashboard kept their presets (they have no
  page-level picker) and lost their Brush, which duplicated them and was
  drag-only on touch.
- **Churn risk is bars, not a pie.** Ordered severity levels are not nominal
  slices: the pie discarded the ordering and forced angle comparison. Now
  ordered worst-first with both count and share.
- **The exported PDF is localised and carries the real wordmark.** It was the
  only surface exempt from §1.8 — English prose with `en-US` formatters pinned
  at module scope — and its logo was a violet square reading "LF".

### Open

1. §1.11 both-breakpoint verification for the new behaviour panels and the
   reworked charts. The admin console is behind auth this session held no
   credential for, and the CDP fixture harness could not clear the role guard.
2. Maps were reviewed and deliberately left alone: real Natural Earth
   geometry, 174 countries and 4,584 admin-1 regions, working zoom. Changing
   them further would be speculative redesign, not correction.

## Current State (2026-08-14, later) — Both trackers were self-capturing; stored history scoped at read time; monitors corrected

- **Plausible and Umami were both violating the §1.9 boundary in production,
  and the route gates were not at fault.** Each vendor auto-captures SPA
  navigations by default: on load they hook `history.pushState` and report
  every route change themselves, so mounting and ejecting the `<script>` tag
  only ever decided whether to ADD the tracker, never whether it reported.
  Ejecting removes the node, not the hook the script already installed.
  Measured, not estimated: `/admin/content` was the **#1 page on the whole
  site**; of 539 stored Plausible pageviews only 110 were ever in scope
  (**79.6% out of boundary**), and 88 of Umami's twelve-month pageviews were
  `/admin/*` (**31.5%**), across all eleven admin routes. Fixed with
  `autoCapturePageviews: false` / `data-auto-track="false"` plus an explicit
  pageview per approved navigation, so the predicate that authorises the mount
  is now the only thing that can emit an event. Umami's tracker is deferred, so
  its first call binds to the script's `load` event — calling directly on the
  creating mount drops the landing pageview, the one acquisition most needs.
- **The stored history is corrected at READ time**, since neither vendor
  supports delete-by-filter. Plausible gets an always-on allowlist mirroring
  `isMarketingPath`, applied inside `plausibleQuery()` — the single choke point
  every call passes through, so no call site can omit it. Verified against
  production: twelve months of top pages returns only `/`, `/families`,
  `/how-it-works`, `/faq`, `/legal/*`, zero out-of-boundary rows, GA4 imports
  included. Umami CANNOT be scoped — its API has no negation filter, and
  correcting only the summable metric would leave the payload internally
  inconsistent — so `getUmamiStats` reports `outOfBoundaryPageviews` and the
  caller decides; `null` means unreadable, never "clean".
- **The two-package coupling this created is now a gate, not a comment.**
  "Public acquisition surface" is declared in the frontend (what is recorded)
  and the backend (what is reported) and cannot share an import. Drift is
  silent and asymmetric: a route added to the frontend only is recorded and
  then filtered out of every report, so a real marketing page reads as one
  nobody visits. `npm run paths:check` fails on either direction.
- **`agent/tools/*.test.mjs` ran in NO workflow and had rotted into failure.**
  ROADMAP.md still named migration `0033` as the ceiling while the repo ships
  `0046`. A read-only ledger probe confirmed production at **46/46** with
  nothing pending, so the "pending sign-off" entry was stale in status as well
  as numbers. The suite now runs in CI, because a gate nobody runs is
  documentation rather than enforcement.
- **Kuma corrected:** monitor #4 (`Arcade / gamegen`, 0% uptime for weeks, the
  actual source of the "server crashed" emails) deleted; Prism (#10) and Data
  Intel (#11) added and attached to the status page. Data Intel is a **Keyword**
  monitor on `"duckdb":"up"` — its `/health` returns 200 while reporting the
  warehouse down, so a plain HTTP check is decorative.
- **A staff-IP suggestion was NOT approved, deliberately.** All three detected
  addresses resolve to CDN77/Datacamp VPN exit nodes, not devices — the tell
  was two different staff accounts sharing one address. Approving them would
  delete every other user of that exit server while failing to exclude staff at
  all, since exit IPs rotate. See RUNBOOK for the `whois` check to run before
  approving any suggestion.

### Open for the next session (review agreed with the owner)

1. Confirm over a normal traffic day that `/admin/*` and product routes no
   longer appear in Plausible or Umami. Nothing has appeared since the deploy,
   but that window carried almost no traffic and is not evidence.
2. Confirm monitor #11 was created as **HTTP(s) - Keyword** and not plain
   HTTP(s) — the status-page API does not expose monitor type, and with the
   warehouse healthy both look identical.
3. Decide whether to build a device-level analytics opt-out for VPN-using
   staff. Proposed, not built: a manual `plausible_ignore` does NOT survive,
   because `applyVendorOptOuts()` clears it whenever Core answers "allowed".
4. Optional: no admin page consumes the Umami endpoint, so
   `outOfBoundaryPageviews` is available but invisible.

## Current State (2026-08-14) — Retroactive filtering confirmed, non-human traffic filtered, datacenter blocking assessed and refused

- **The warehouse filter IS retroactive, verified against production.** Over a
  90-day window dataintel reports 3,539 excluded events against 383 included
  (90.2%) and 24 excluded segment attempts — every staff row in history, back
  to the earliest on 2026-08-10, matching Vault's own totals exactly. The
  intelligence console needed nothing further.
- **Plausible, Umami and GA4 cannot be rewritten**, and the console now says
  so where the numbers are. It also says something more urgent that was
  invisible: the exclusion registry is EMPTY in production, so no staff address
  is being excluded from web analytics yet — the panel is deployed, nobody has
  used it, and the figures still contain staff visits. The note distinguishes
  three states: nothing excluded, the window predating the first exclusion, and
  fully covered.
- **Non-human traffic now has three layers.** `navigator.webdriver` stops
  WebDriver-controlled browsers in the SPA before a hit is sent (including this
  project's own verification runs, which loaded the marketing site repeatedly).
  User-agent classification stops crawlers and scripted clients at both
  `tracking-decision` and `POST /api/v1/events`. Plausible and GA4 continue to
  drop known bots before storage — confirmed for Plausible by production data:
  twelve months of browser breakdown contains no bot category at all. Our own
  ingest had no filter, which made the dataset we fully control the least
  defended.
- **Datacenter/ASN filtering: assessed, deliberately not built.** The ranges
  are published and easy to consume (AWS alone: 10,646 IPv4 + 6,108 IPv6
  prefixes) and `net.BlockList` already matches CIDRs. It is refused because
  the false positives are real users: corporate egress, VPNs, and decisively
  iCloud Private Relay, which carries genuine Safari sessions — Safari is this
  platform's second browser by volume. Silently deleting real iPhone traffic is
  a worse failure than counting a few cloud-hosted bots. Operators can still
  exclude a specific range explicitly through the existing registry.
- **A design bias, written into the tests:** a missed crawler inflates a
  number, a misclassified human deletes a session that nothing downstream can
  recover. Six real browser agents are asserted never to match, and that
  assertion is not to be relaxed to catch one more bot. Twelve existing tests
  failed on this change because supertest sends no user agent — they now send a
  real one, which is what production always does.

## Current State (2026-08-13) — Production review: no service has crashed; the alerts came from a monitor watching a deleted service

Reviewed all 23 Railway services and a week of logs after repeated
"server crashed" emails.

- **Nothing crashed.** No `CRASHED` or `FAILED` deployment in the last week on
  any service, exactly one container start each (no restart loops), and no OOM,
  fatal, segfault or unhandled rejection in any log. Health confirms it: Core,
  Forge, Echo, Guardian, Courier and Umami at 100% over 24 hours, Depot 99.93%,
  Plausible 99.65%.
- **The emails were Uptime Kuma monitor #4, "Arcade (gamegen)".** It resolves
  `gamegen.railway.internal` every 60 seconds and has failed every time since
  the Game Engine was deleted on the owner's call (`10936f3e`, schema retired
  in `0033`) — 0 of 100 heartbeats up, 0% 24-hour uptime. The monitor outlived
  the service by weeks because nothing tied the two together. It is a dashboard
  deletion (Kuma stores monitors in its own volume behind its own login, so it
  cannot be removed from the repo or the CLI).
- **Monitoring gap found:** Prism (`picturegen`) and Data Intel (`dataintel`)
  have no monitor at all, despite both exposing `/health`. Two production
  services were unwatched.
- **Not outages, do not "fix":** `storage`, `studio`, `meta` and `supavisor`
  show no active deployment because they are SLEEPING, idled deliberately since
  2026-07-18 for cost. Plausible's 4 FAILED deployments are from 2026-07-20,
  during Pulse setup, and its single 500 on 2026-08-13 falls inside this
  session's own deploy window.
- **Known benign noise, deliberately NOT changed:** every Node service logs
  three rate-limiter store-init errors at boot because the limiters are built
  at import time, before Redis connects. It self-heals and fails open. A fix is
  untestable here (the suite uses `MemoryStore`) and this file already caused
  one total outage, so it is documented in RUNBOOK rather than changed blind.

The monitor set is now written down in `pulse/README.md`, and `pulse/AGENTS.md`
#7 makes a monitor's lifetime the same as its service's, so retiring a service
retires its alert in the same change.

## Current State (2026-08-13) — DEPLOYED TO PRODUCTION

Merged to `main` as `c4a49156` (+ fixes `59c75087`, `06d4a4e9`). Vault
migrations `0045` and `0046` applied to production before any service shipped;
the ledger now holds 46 receipts. Backend, dataintel, coursegen, filebase,
parent-id-check, pulse and frontend all deployed green.

**Verified in production, not inferred:**

- `GET /api/v1/analytics/tracking-decision` answers
  `{"excluded":false,"degraded":false}` with `Cache-Control: no-store`.
  `degraded:false` is the meaningful part: Core successfully read the new
  exclusion registry, so `0045` is live and working.
- `dataintel_users_sync.is_staff` returns 29 users with 2 flagged, both
  `superadmin` — matching the measurement this whole change started from.
- dataintel logged `warehouse migrated to staff-free views (renamed:
  fact_events, fact_segment_attempts, dim_sessions, dim_users)`, then
  `duckdb initialised` and `Sync complete`.
- The Terms render in FULL in all three locales on littlefounders.ai: 20
  clauses and 117 paragraphs each (30,071 / 33,053 / 31,078 characters for
  en-US / es-MX / pt-BR — the same document in three languages).
- `repo gates` passed on this commit and had FAILED on its predecessor
  `a831a00c`. That is the legal locale-parity gate which had blocked automatic
  frontend deploys; `frontend CD` ran for the first time in weeks.

**Two incidents on the way in, both recorded in RUNBOOK.md:** DuckDB refused to
rename a table with dependent indexes (the migration test's fixture had none,
so it passed while production failed), and frontend CI failed with all 476
tests passing because an unhandled rejection escaped `useAdminData`. Both are
fixed, and in both cases reverting the fix reproduces the failure in the test
that now covers it.

**Still open:** the region map is live but unverified against real region
traffic — Plausible's `visit:region` is documented to return ISO 3166-2 codes
(`US-MD`), which is how the 4,584 generated region shapes are keyed, but the
production instance sits on Railway's private network and could not be queried
from a workstation. Zooming into a country with traffic in the console
confirms it in seconds.

## Current State (2026-08-13) — Map zoom to real regions, and every intel chart was drawing its axes in black

- **Zoom into a country and see its states.** Clicking a country now zooms the
  map to that country's projected bounds and draws its real admin-1 regions:
  4,584 states, provinces and departments across 238 countries, generated at
  author time from Natural Earth 10m (`npm run map:gen:regions`) and simplified
  through a shared topology so neighbouring borders move together and never
  open a gap. Region traffic comes from Plausible's `visit:region`, which
  reports the ISO 3166-2 codes the geometry is keyed by, so a lookup is a plain
  object access with no name matching.
- **The regions are one chunk per country** (Mexico 22 KB, the United States
  55 KB), fetched only on zoom — 243 build chunks now exist where the whole set
  would have been 2.4 MB in the bundle. The loader had to move OUT of the
  `regions/` directory: Vite refuses a variable import that targets its own
  directory and silently emitted no chunks at all until it was relocated.
- **Zoom is real geometry, not a scaled image.** The viewBox animates to the
  country's projected bounds, so borders stay crisp and the regions land exactly
  inside the country outline already on screen. While zoomed, neighbouring
  countries drop to neutral context, the legend rescales to region values and
  says so, and shares are of that country's total rather than the world's —
  each of those was wrong in the first pass and fixed after looking at it.
- **Every chart in the intelligence console was drawing its chrome in black.**
  28 references passed the design tokens as bare `var(--lf-outline)`, but those
  tokens hold space-separated CHANNELS (`226 232 240`), not colours — so grid
  lines, axis lines, tick labels and the gradient fills under every trend line
  resolved to an invalid value and fell back to black, in both themes. On dark
  mode that is black on near-black. The series colours were correct, which is
  why it survived: the data was visible and only the frame was missing.
  Verified in a browser in dark mode after the fix. Two of the palette entries
  also referenced tokens that do not exist at all (`--lf-muted`, `--lf-faint`).

## Current State (2026-08-13) — Data Intelligence made trustworthy: staff excluded from the warehouse, every query bounded by a real window

Built locally on `main`, all service gates green, NOT deployed. Requires Vault
migration 0046 to be applied BEFORE the dataintel deploy (see below).

- **Measured first, against production, rather than assumed.** A read-only
  probe through `railway run` found that 3,502 of 3,869 first-party events
  (90.5%) were stamped `superadmin`, produced by 2 accounts against 29
  non-staff ones, and that 24 of 24 `lesson_segment_attempts` were staff-owned.
  Every metric in the intelligence console — DAU, activation funnel, retention
  cohorts, churn ranking, time-to-value, lesson calibration, the whole
  pedagogical layer — was describing the platform team testing the product.
- **Staff exclusion is now structural, not a filter to remember.** The plain
  warehouse table names became staff-free VIEWS over `*_raw` physical tables,
  which made all 95 existing query sites correct in one move and makes the
  clean name the path of least resistance for new ones. Only the sync writer,
  the rename migration and one deliberate disclosure service may touch a `_raw`
  table; a test fails the build if anything else does.
- **Neither existing role field could answer "is this staff?".** The event
  stamp is the highest-priority role (a superadmin who is also a parent stamps
  `parent`), and `dataintel_users_sync.role` was the most recently GRANTED
  role, which flips with grant order. Vault 0046 adds `is_staff` as an EXISTS
  over the whole role set, and the views test both it and the stamp.
- **A missing flag now fails loudly instead of silently readmitting staff.**
  If `is_staff` is absent (0046 not applied), the sync refuses with an
  explicit message rather than defaulting everyone to non-staff. Every metric
  reading zero is unmistakably broken; a 90% inflation looks plausible.
- **The period selector was decorative.** It reached 4 of 17 requests. Ten
  queries had no time bound at all — `engagementQuery` aggregated all of
  history while returning fields named `sessions_30d` — so switching from
  "7 days" to "1 year" left the funnel, drop-off, calibration, leaderboard,
  paths and time-to-value tabs unchanged, sitting on screen beside a period
  label. A shared `AnalyticsWindow` is now threaded from route to SQL, custom
  `from`/`to` ranges are supported alongside presets, cohort weeks derive from
  the same selection, and a half-specified range is an error rather than a
  silent fallback.
- **The console now discloses what it hides.** A new
  `/quality/staff-exclusion` endpoint reports the removed share, and the page
  states it. A filter that silently stopped would otherwise be
  indistinguishable from one that is working.
- **Exports.** `/admin/intel-export.{csv,xlsx}` render the active window in
  Core (the `/intel` proxy reads bodies as text, which would corrupt a
  spreadsheet), with the window, generation time and staff-exclusion caveat on
  the file itself.
- **Verified.** dataintel 185 tests, backend 349, frontend 463, type-check,
  lint and builds green. Vault 0046 applied twice against the local stack
  (idempotent) as `supabase_admin`; note that `CREATE OR REPLACE VIEW` can only
  APPEND columns, so `is_staff` sits at the end of the select list. One
  intermittent failure was observed in the pre-existing `SignupTimeline`
  interactive-chart test (once in ~6 full runs, passes in isolation and passes
  with the changes reverted) — flaky, not caused by this work.
- **DEPLOY ORDER MATTERS.** Vault 0046 must be applied before dataintel ships,
  or the sync will refuse to run. The warehouse rename happens automatically on
  first boot (`migrateWarehouse`) and preserves every row.

## Current State (2026-08-13) — Analytics made trustworthy: enforceable internal-traffic exclusion, real geography, real windows, real exports

Built locally on `main`, all service gates green, NOT yet deployed.

- **Internal traffic can now actually be excluded, and the control is real.**
  Vault `0045` adds `analytics_ip_exclusions` (cidr, soft-revoked, one active
  row per network) and `analytics_staff_ip_sightings` (admin/superadmin
  addresses only, §1.9). Enforcement is at the two points we own, because
  Plausible CE still has no ingestion IP blocklist: the SPA asks
  `GET /api/v1/analytics/tracking-decision` once per browser session and
  mounts NO tracker for an excluded address (setting Plausible's and Umami's
  own localStorage opt-outs as backup), and `POST /api/v1/events` drops
  excluded batches so the first-party funnel counts the same population.
  The console offers one-click exclusion of the current device, of addresses
  staff have actually been seen working from, and manual CIDR entry.
  Exclusion is FORWARD-ONLY and the panel says so on screen.
- **The previous exclusions panel was removed in `02758833` for claiming an
  enforcement that did not exist.** This one is the opposite case: the claim
  is narrower than before and the enforcement is ours, testable, and tested.
- **GA4 was measuring a different population than Plausible.** Its gate
  checked only "marketing path + not a kid", so every signed-in visitor —
  staff included — was counted as marketing traffic, while Plausible (which
  requires an anonymous, consented session) was not. The two could never be
  reconciled. GA4 now follows the same acquisition boundary.
- **The behavioural card and the web-analytics cards described different
  windows under one label.** Umami translated the period itself: `month`
  became "the last 30 days" while Plausible read it as "since the 1st", and
  `6mo` became a flat 182 days. One resolver (`resolveRange`) now feeds both.
- **Windows are now selectable and stated.** Presets gained `year` and `all`,
  plus an explicit custom range (`?period=custom&from=&to=`, validated for
  order, future dates and absurd length). Every response carries the RESOLVED
  `from`/`to`, which the page displays instead of restating the label it asked
  for, and every KPI carries a previous-period comparison computed from the
  equally long window immediately before. A comparison that could not be made
  is absent, never rendered as 0%.
- **The map is a real map.** The seven hand-drawn continent polygons and their
  39-entry dot lookup are replaced by Natural Earth 110m geometry, projected
  at author time into `worldGeography.ts` (`npm run map:gen`) so the browser
  ships no projection library: 174 drawn countries, plus 61 micro-state
  centroids so a country too small to draw still gets a real position, plus an
  on-screen list of any country the map cannot place at all. Choropleth by
  visitors with a legend printing real value ranges. Code-split (60 kB gzip)
  so it loads only on the analytics page.
- **Exports are three formats of one query.** `report.csv` (one rectangular
  BOM-prefixed table discriminated by a `section` column, no comment lines
  that break strict parsers) and `report.xlsx` (branded workbook: Summary with
  KPIs vs previous window, Daily trend, one sheet per breakdown) join
  `report.pdf`; `?rows=1..200` lets a spreadsheet hold more than a PDF page
  can. Every export states its window, its filters and its generation time,
  and filenames now carry the resolved dates rather than a period label.
- **Report branding was wrong.** The PDF drew itself in papaya `#ff775c` on
  navy `#080f28` — a palette DESIGN.md no longer contains — on the one
  artefact that leaves the building. Corrected to the indigo/slate tokens of
  record, with per-KPI change indicators coloured by whether the movement is
  good rather than by its sign. Two more report defects fixed while there: the
  section subtitle was pinned to a fixed 58pt offset and therefore printed
  straight through every section title, and the "data range" line was derived
  from the first and last days that HAD traffic rather than the window that was
  actually queried, silently shrinking the reported period exactly when a
  campaign produced nothing.
- **Verified.** Backend 349 tests, frontend 463 tests, type-check, lint and
  builds green in both services; migration `0045` applied twice against the
  local Vault (idempotent) with cidr masking, the partial unique index, the
  revoke/re-add cycle and the sighting counter checked directly in psql; the
  UI screenshotted at a true 375px and 1280px viewport (CDP device emulation,
  since headless Chrome's window has a 500px floor) in light and dark mode,
  `scrollWidth == viewport` with zero overflowing elements at both. The
  known, owner-accepted `marketing.json` legal locale-parity failure in
  `npm run i18n:check` is unchanged by this work; `admin.json` is at exact
  three-locale parity (1,142 keys).

## Current State (2026-08-13) — Acquisition analytics integrity deployed

- **Pulse acquisition integrity correction is live.** Release `02758833`
  restricts Plausible to consented, identity-resolved guests on public
  marketing routes. Authenticated product traffic, `/admin/*`, and the OAuth
  callback therefore cannot create future acquisition pageviews. Umami now
  excludes `/admin/*`; it remains limited to consented guest marketing and
  signed-in parent product surfaces. The first-party classifier treats
  `accounts.google.com` as an internal authentication hand-off rather than
  Google search.
- **Verified against production.** Railway Core deployment
  `7fee7bca-0d7f-481d-889c-00ace2c6d67f` reached `SUCCESS`; Vercel production
  deployment `dpl_Ee4zZLrKPnZ4aoCYzcYAJjQP4qan` is `Ready` and aliased to
  `littlefounders.ai`. `GET /health` returns the standard 200 envelope and
  the served JavaScript exactly matches the release build. A real Chrome
  check verified: no tracker without consent; consented public marketing
  mounts Plausible and Umami; `/admin` and `/auth/callback` mount neither and
  initiate no Plausible or Umami event request.
- **Reporting contract corrected.** Removed the UI/API/env `IP_BLOCKLIST`
  contract because Plausible CE has no documented, verified setting by that
  name. `pulse/README.md` now defines the PII-free three-field UTM convention
  (`utm_source`, `utm_medium`, `utm_campaign`) and forbids its use on internal
  navigation. Historical events retain their former scope and are a
  pre-clean baseline, not a valid comparison cohort for post-release
  acquisition data.
- **Release-process exception, explicitly accepted by the owner.** The
  automatic frontend CI remains blocked by an unrelated legal locale-parity
  review in `marketing.json`. This release was manually deployed only after
  the affected frontend/backend/pulse tests, builds, docs and secrets gates,
  Railway production preflight, and browser checks passed; no legal content
  was changed.

## Current State (2026-08-13) — Financial Education confirmed LIVE in production; Emprendimiento/Inversiones pivoted to tier4 (12-18) and fully re-authored

- **Financial Education generation status, verified directly against
  production (not from stale docs):** a prior WALKTHROUGH snapshot (through
  2026-08-02) still described this course as dry-run-only ($0 spent). Direct
  read-only query against the production Vault (`railway ssh --service db
  psql`, sentinel-verified) this session found it is actually **live and
  generated**: `courses.status='published'`, 1,208 `lessons` all
  `published`, 3,624 `lesson_documents` (= ×3 locales exactly, 100% carrying
  non-empty `audio`), 9,179 `picture_assets` rows. Real Forge spend for the
  run: **$1,586.42** (508.5M tokens, 41.8% cache hit, 397 images billed of
  618 generated) — the `~$225-320` estimate recorded in ROADMAP.md back in
  2026-07-13 undershot reality by roughly 5x; real $/lesson (~$1.31) is now
  the basis for any future course cost projection. **Open, unexplained gap**:
  the catalog defines 1,312 blueprints but production only has 1,208 — not
  yet root-caused, flagged for a future session, not fabricated an
  explanation for.
- **Emprendimiento (`entrepreneurship`) and Inversiones (`investing`) pivoted
  from tier1-3 (6-12) to a single new `tier4` (12-18) and fully
  re-authored — owner-directed, "RADICAL" by their own word.** Neither course
  had ever been generated (0 rows in production for either slug, confirmed
  by the same production query), so no learner content was at stake — the
  prior tier1-3 catalogs (1,408 + 1,472 blueprints) were deleted outright,
  not archived, per explicit owner decision. Motivation: Financial
  Education's language, while "good," read too young for a 12-18 audience;
  the owner wanted a matured register with real analogies, plus roughly half
  the lesson count (450-550 target vs. >1,400) with each lesson assumed
  denser/longer.
  - **Mechanism decision (owner, via `AskUserQuestion`):** a new `tier4` age
    tier inside the existing kid-register Piaget-gate machinery — same
    pattern used to add tier3 for the original Inversiones — NOT the
    separate `register: adult` mechanism (COURSE_ENGINE.md §3.3), which was
    built for verified adults with real-life-anchor framing (nómina, renta),
    not a supervised teen account.
  - **Scope decision:** full replacement, not an added rung on top of
    tier1-3 — both courses are now 12-18 only. Flagged, not resolved: a
    learner finishing Financial Education (~6-10) now has no course to start
    until 12 (the 10-12 band the old Inversiones tier3 used to cover is
    unserved) — product-sequencing call for the owner, tracked in
    ROADMAP.md, not decided unilaterally.
  - **Investing's hard vocabulary ceiling decision:** carried forward
    UNCHANGED from tier3 into tier4 — apalancamiento/derivados/opciones
    financieras/venta en corto/margen de crédito/trading intradía/forex/
    criptomonedas stay banned across the full 12-18 band, explicitly not
    relaxed for the 16-18 end (owner decision, §1.9 posture, not a
    Piaget/age gate).
  - **Shape delivered:** 8 adventures/course, each 4 teaching sagas × (6
    teaching topics + `review_spaced` + `review_interleaved`, 2
    lessons/topic = 16) + 1 review saga at position 5 (2 `review_quest`
    topics × 2 lessons = 4) = 68 lessons × 8 = **544 lessons/course**, both
    courses. `contentPlaybook.ts` gained `tierReasoningGuidance('tier4')` —
    the register/analogy brief (subscriptions auto-renewing, gig-app fee
    cuts, loot-box odds as risk/EV, follower growth as compounding) injected
    into every write/judge prompt at this tier — plus `readability.ts` tier4
    bands (extrapolated from the tier1-3 progression, flagged as
    uncalibrated until a real batch generates) and migration
    `0044_tier4_age_check.sql` widening `adventures.age_tier`.
  - **Authoring execution — real gotchas, worth remembering:** delegated to
    parallel background agents (same pattern as the original tier1-3
    catalogs' "sibling agent" authorship). First attempt: one agent ran in
    an isolated git worktree and correctly REFUSED to fabricate the missing
    `tier4` scaffolding it couldn't see there (uncommitted local changes
    don't propagate into a fresh worktree) — relaunched without isolation,
    which fixed it. Both agents then hit the account's **monthly spend
    limit** mid-run (not a code bug) — one had already written real content
    to disk before dying (partial progress survives an API-budget kill, this
    session confirmed), the other had gone down a rabbit hole building a
    Python content-generator script and spawning per-adventure sub-agents
    and had written nothing yet. Relaunched after the limit reset with an
    explicit instruction to write YAML directly, file by file, no scripts,
    no sub-agent fan-out — both courses completed cleanly on that retry.
    **Content-quality defect caught post-hoc, not by any gate:** ~220
    instances of missing Spanish accents in prose fields (también, ahí,
    difícil, garantía, términos, código...) concentrated in the
    later-authored files — fixed with a targeted script that explicitly
    excludes `slug:`/`review_of` path lines (which must stay unaccented
    ASCII kebab-case) from the replacement. No gate in the pipeline checks
    Spanish accent correctness — worth a future gate if this recurs.
  - **Verification, all free (no paid API calls):** `catalog:check` and
    `graph:check` both 0 errors for each course individually and for all 4
    courses scanned together (2,462 total blueprints across the whole
    track); `generate -- --course <slug> --dry-run --require-images` clean
    at $0 for both. **Not yet generated** — this is authored content only,
    a paid Forge run needs separate owner authorization. Estimated cost at
    Financial Education's real $/lesson (~$1.31, Forge-only — does NOT
    include Echo/TTS, still no confirmed DashScope tariff in our docs)
    applied to the real 544/course count: **~$714 (entrepreneurship) +
    ~$714 (investing) ≈ $1,429 combined** (a same-session correction: the
    figure first reported here — ~$1,850/~$1,933/$3,784 — mistakenly
    carried the pre-pivot 1,408/1,472 lesson counts forward instead of the
    544 actually authored; caught when the owner asked why the cost hadn't
    dropped with the lesson-count cut. Also likely a floor rather than an
    exact number: FE's $/lesson was measured on its 4-lessons/topic shape,
    while tier4 intentionally packs more into each of its 2 lessons/topic,
    which plausibly raises true per-lesson cost even as the total drops).

## Current State (2026-08-12) — Password recovery + in-session email/password change close the auth/email integration

Courier (email-server) has been "DONE + LIVE" since 2026-07-18 for auth mail
(confirmation, and the templates for recovery/magic-link/invite/email-change
existed at `frontend/public/email-templates/`), but nothing in the platform
ever actually TRIGGERED a recovery or email-change email, and `/profile/
settings` shipped 2026-07-12 with email/password hard-disabled behind
"arrives with Courier, coming soon." Courier shipped five weeks ago; this
session closed that gap — verified end-to-end against the real local GoTrue
(not just mocks).

- **Password recovery, new.** `backend/src/services/gotrue.ts` gained
  `recover(email, redirectTo)` and `updateUser(accessToken, attrs,
  redirectTo?)`. Four new Core routes: `POST /api/v1/auth/recover` (always
  answers `{sent: true}` — GoTrue itself never reveals whether an address has
  an account, so the proxy doesn't either), `POST /api/v1/auth/reset-password`
  (bearer = the short-lived `type=recovery` session GoTrue mints when the
  email link is verified, NOT a normal session), `POST /api/v1/auth/
  change-password` and `POST /api/v1/auth/change-email` (both re-verify
  `currentPassword` via a real GoTrue sign-in first, since `PUT /user` alone
  applies to any valid bearer with no re-auth of its own). Frontend:
  `ForgotPasswordPage` (`/forgot-password`, guest-only) and
  `ResetPasswordPage` (`/reset-password`, NOT guest-gated — driven entirely
  by the link's URL fragment) reuse the same fragment-token-parsing shape as
  `AuthCallbackPage`, but the recovery token is a one-off bearer for a single
  API call, never persisted to `localStorage` the way a real session is.
- **`/profile/settings` "Account" card, unblocked.** Inline change-email and
  change-password sections replace the disabled field + "coming soon" copy.
  **A real bug caught by live browser verification, not by the test suite:**
  the inline sections were first built as nested `<form>` elements inside the
  page's own `<form>` — invalid HTML that Chrome accepts via `createElement`
  but silently mishandles on submit (the click fell through to a native
  browser submit instead of running React's handler, appending an empty `?`
  to the URL and doing nothing server-side). Backend unit tests mocking
  GoTrue directly never would have caught this — only driving the actual
  rendered page did. Fixed by making both sections plain `<div>`s with
  button `onClick` handlers and an `Enter`-key shim, verified by then
  actually changing a live local user's password twice in a row through the
  UI and confirming each new password logs in.
- **Local dev stack gap fixed, not just worked around.** `ADDITIONAL_REDIRECT_URLS`
  (→ `GOTRUE_URI_ALLOW_LIST`) was empty in local `.env`, so `redirect_to`
  silently fell back to `SITE_URL` (`http://localhost:3000`, which nothing
  runs on) instead of the frontend's actual `:5173` routes — this affected
  Google OAuth's local testability too, not just this session's new routes.
  `database/scripts/local-stack.sh`'s `ensure_env()` now seeds
  `http://localhost:5173/{auth/callback,reset-password,profile/settings}`
  alongside its existing `ENABLE_ANONYMOUS_USERS`-style overrides, so a fresh
  clone gets a working redirect list with zero manual steps. Verified against
  the real local GoTrue: `POST /admin/generate_link` confirmed the allow-list
  now honors the custom `redirect_to`, and the full browser loop (recovery
  email link → `/reset-password` with fragment tokens → new password → login
  with it) was driven for real, not simulated.
- **Correction (checked before deploy): no production Railway step needed.**
  This entry originally guessed that `/reset-password` and
  `/profile/settings` would need to be added to production's
  `GOTRUE_URI_ALLOW_LIST`, reasoning from the empty local-dev list this
  session found (see the local-stack fix above). Checked directly against
  production (`railway variables --service auth`) instead of assuming: it's
  `GOTRUE_URI_ALLOW_LIST=https://littlefounders.ai/**` — a wildcard that
  already covers every path on the domain, including both new routes. No
  Railway env change is required; the local-only gap was specific to local
  dev's default empty list, not a production gap. (§1.12: verify before
  asserting — the original guess would have sent a false "one step remains"
  instruction downstream had it not been checked.)
- **Gates:** backend 313/313 (10 new for `recover`/`reset-password`/
  `change-password`/`change-email`, +2 more from the security fix below),
  frontend 440/440, both type-check + lint clean. `backend/README.md` route
  table updated (§8).
- **Post-commit security audit caught a real auth-bypass, fixed same session
  (HIGH, confirmed 8/10 by an independent false-positive-filter pass, then
  empirically verified against the real local GoTrue both ways).**
  `POST /reset-password` was gated only by `requireAuth`, which accepts ANY
  valid `role: authenticated` JWT — nothing distinguished a genuine
  recovery-link session from an attacker's stolen ordinary login token, and
  unlike `/change-password` (added in the same commit, which re-verifies
  `currentPassword`), `/reset-password` applied the new password with zero
  re-auth. Concretely: anyone holding a victim's normal access token (XSS,
  a leaked/logged token, a stolen device) could have silently set a new
  password and permanently locked the real owner out, turning a ~1h token
  compromise into indefinite account takeover — with no email click-through
  and no knowledge of the current password required. Root cause: GoTrue
  *does* mark how a session was established via the JWT's `amr` claim
  (`[{method: "otp"}]` for a verified recovery/magic-link vs `"password"`/
  `"oauth"` for an ordinary login) but `backend/src/lib/jwt.ts`'s
  `verifyAccessToken` discarded that claim entirely, so the distinction
  never reached the route handler. Fixed by threading `amr` through
  `AccessTokenClaims` → `AuthedUser` and requiring `amr` to contain
  `method: "otp"` before `/reset-password` touches GoTrue (403 `FORBIDDEN`
  otherwise). Verified live against the real local GoTrue in both
  directions: an ordinary post-login access token → 403; a genuine
  `/admin/generate_link`-minted recovery token → 200, password changed,
  login with the new password succeeded. Two regression tests added
  (rejects `amr: password` and no-`amr` tokens). This is why the "verify
  before asserting" and "no silent scope-cutting" rules (§1.12) matter in
  practice — the original commit's own comment on `/change-password`
  ("PUT /user alone accepts any valid bearer with no re-auth of its own")
  was the correct reasoning, just not applied to its sibling route.

**Shipped to production the same session, with two operational incidents en route (both closed):**

- **Backend: normal path.** Pushed to `main` (`5b9be1c1`, `04f23c56`,
  `53e94a7c`); `backend CI` green → `backend CD` auto-deployed via the usual
  `workflow_run` gate. The new auth routes and the security fix above have
  been live since.
- **Frontend: blocked by pre-existing, unrelated CI failure — manually
  deployed instead of bypassing the gate silently.** `frontend CI` (and the
  no-path-filter `repo gates` check) failed on a Terms & Conditions i18n key
  mismatch between `en-US`/`es-MX` in `marketing.json`, introduced before
  this session (traced to commit `4c8673ce`, this morning) and unrelated to
  this feature — confirmed by diffing this session's own new i18n keys
  (full 3-locale parity) and by checking the failure reproduces against
  `main` from *before* any of this session's commits. Investigating further:
  **es-MX is actually the MORE complete/accurate locale** (full clause text
  matching the canonical `/LEGAL/` source) while `en-US`/`pt-BR` are
  condensed paraphrases — `LegalDocumentViewer.tsx` also hardcodes which
  clauses render `p2`/`p3`, so properly fixing this means both a content
  pass (translate `en-US`/`pt-BR` up to `es-MX`'s completeness, not shrink
  `es-MX` down) and a component change (render however many paragraphs
  exist per clause instead of a hardcoded list) — real work, correctly
  deferred to its own session per the owner's call rather than rushed under
  deploy pressure. To ship the (fully i18n-clean) auth feature anyway: built
  and deployed the frontend manually (`vercel build --prod` +
  `vercel deploy --prebuilt --prod`, replicating `frontend-cd.yml`'s exact
  steps outside CI), bypassing only this specific known-unrelated gate.
  Verified live: the production bundle contains the new `forgot-password`/
  `reset-password` routes.
- **Incident: an agent command chain accidentally exposed the internal-only
  `realtime` service publicly.** While hunting for Core's production URL to
  verify the backend deploy, `railway service backend` failed (wrong name)
  and the next command, `railway domain` (intended as a read-only check),
  silently fell through to the still-linked `realtime` service and — since
  it had no domain — Railway's default behavior for a bare `railway domain`
  call *created* one (`realtime-production-cd81.up.railway.app`), violating
  the internal-only-service invariant (AGENTS.md §1.5). Caught immediately
  (before any code touched it), but deleting it was correctly blocked by the
  permission system as a destructive production action requiring the
  owner's own terminal — owner ran `railway domain delete ... --yes`,
  confirmed via `railway domain list` (empty) afterward. Lesson: `railway
  domain` with no subcommand is NOT read-only — it creates by default if
  none exists. Always use `railway domain list` to inspect, never bare
  `railway domain`, and confirm which service is linked (`railway status`)
  before any Railway command that isn't explicitly a `list`/`status`.

## Current State (2026-08-11) — Guest accounts, onboarding and mandatory placement shipped to PRODUCTION

Closes COURSE_ENGINE.md §3.2's "future onboarding/placement phase", reserved
since the 2026-07-13 pedagogy-hardening session. Three-phase build, one
migration set per phase (`0041`, `0042`, `0043`), landed as three commits on
`main`, then **deployed and live-verified against production** in the same
session: pushed to `origin/main` (CI green across backend/frontend/coursegen/
database), migrations `0041`–`0043` applied to the production Vault
(`railway-migrate.sh --confirm-production`, ledger now at 43 receipts, all
new tables/columns postflight-verified), `GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=true`
set and force-redeployed on the production `auth` service, and the full
guest → onboarding → placement → lesson journey exercised live against
`https://littlefounders.ai` with zero console errors: anonymous sign-in,
the full onboarding wizard, the mandatory placement gate firing on
`financial-education`, the non-blocking guardian nudge, and
`no_probe_content_fallback` correctly landing the learner on the real first
lesson. See `database/DEPLOYMENT.md`'s guest-accounts and migrations
sections for the exact commands and the two operational gotchas hit along
the way (stale SSH key path, `railway service restart` hanging — use
`railway redeploy` instead).

- **Guest accounts**: `POST /api/v1/auth/guest` is GoTrue's native anonymous
  sign-in — a real `auth.users` row (`is_anonymous=true`), so the existing
  `0003` bootstrap trigger, every RLS policy, and the JWT session flow all
  work with zero new database code. `POST /api/v1/auth/upgrade` attaches a
  permanent email+password identity to the SAME session in place (GoTrue's
  `PUT /user`), preserving the same `auth.users.id` — progress, streak and
  profile carry over with zero migration. "Guest" is deliberately distinct
  product vocabulary from the pre-existing `lf_aid` marketing visitor id
  (`frontend/src/lib/visitor.ts`), an unrelated concept.
- **Onboarding**: a one-time, guest-first wizard (name, optional discovery
  channel, optional age reusing the existing `profiles.birth_date` column
  rather than a new one, create-account-now-or-later) that activates day-1
  streak via `streak.ts`'s existing pure functions, unmodified. Migration
  `0041` adds `onboarding_responses` (service-role-only, same posture as
  `learning_stats`).
- **Placement**: a mandatory, per-course quiz gating a course's first lesson.
  Migration `0042` persists the competency graph
  (`coursegen/src/catalog/competencyGraph.ts`, previously in-memory-only) as
  `topics.prerequisites` + `topics.placement_probe`, mirroring `0016`'s exact
  precedent (catalog stays the source of truth, paths resolved at query
  time). `coursegen/src/pipeline/placementProbe.ts` authors one quiz probe
  per teaching topic's first lesson OFFLINE, at generation time, from
  catalog content only — never per learner, so §1.9 holds by construction.
  `backend/src/services/placementAlgorithm.ts` (pure, like `unlockRules.ts`)
  grades answers server-side and computes the longest contiguous
  correct-and-probed prefix from the course start, capped at any unmet hard
  prerequisite. Migration `0043` adds `course_placements` (the result) and
  `placement_credits` (the skip-ahead ledger — never a fabricated
  `lesson_progress` row) plus a `CREATE OR REPLACE` on `0039`'s
  `get_completed_course_badges` so a placement-credited lesson counts toward
  badge completion exactly like a real pass (confirmed product decision:
  Duolingo-style credit). `learn.ts` gained a `PLACEMENT_REQUIRED` 403 beside
  every existing `LESSON_LOCKED` check — the real server-side gate;
  `PlacementPage.tsx`'s wizard is what clears it.
- **Live-verified against the real local stack, not just mocks**: after
  `npm run db:reset` twice (all 43 migrations apply cleanly from a fresh
  database) and `npm run db:types`, the backend was started against the
  actual pinned GoTrue `v2.189.0` with `ENABLE_ANONYMOUS_USERS=true` and
  exercised over real HTTP: guest sign-in produced a genuine `is_anonymous`
  JWT claim, `/auth/me` correctly reported `isGuest`/`onboardingComplete`,
  onboarding completion persisted `display_name` and returned
  `streakDays: 1`, and the upgrade flow preserved the identical
  `auth.users.id` while flipping `isGuest` to `false`. `\d` against the live
  database confirmed every new table's RLS policy, foreign key and check
  constraint landed exactly as migrated, and `get_completed_course_badges`'s
  signature matches the extended body.
- **Test coverage**: 298 backend + 604 coursegen + 432 frontend tests green
  (new: 13 `placementAlgorithm` unit tests covering the beginner shortcut,
  no-probe fallback, hard/soft prerequisite capping including a
  whole-saga-path edge, and the review-topic-as-natural-stopping-point case;
  14 `placementProbe` tests for the author/translate/gate corrective-retry
  paths; 14 `placement.test.ts` Supertest cases including the
  `PLACEMENT_REQUIRED` gate on all 3 `learn.ts` endpoints end to end). Full
  root gate sweep (`repo:map`, `docs:check`, `secrets:check`, `i18n:check`)
  clean. Verified in-browser at 375px and 1280px, dark mode: the full guest
  → onboarding → app journey, and the CoursePage → placement redirect
  through every wizard step including real quiz content.
- **What's genuinely NOT done yet**: the paid Forge backfill that authors
  `placement_probe` content for the 3 already-published production
  catalogs. `production:preflight`'s previously-recorded 4 provider-key
  failures (`coursegen/DEEPSEEK_API_KEY`, `coursegen/QWEN_API_KEY`,
  `audiogen/TTS_API_KEY`, `picturegen/IMAGE_API_KEY`) still block it — this
  is the same open item the 2026-08-03 entry already flagged for Financial
  Education generation, now also gating placement probes for the topics
  that already exist in production. Until that backfill runs, every course's
  `no_probe_content_fallback` method applies (placement still gates the
  first lesson correctly, just without quiz-driven skip-ahead credit).

## Current State (2026-08-09) — Course badge identity and public completion collection

- Every new course now has a mandatory `course.badge_asset` in its Forge catalog. The path must match `course-badges/<course-slug>.png`, and the developer supplies the corresponding read-only asset under `frontend/public/course-badges/`. Forge validation fails on missing or mismatched metadata; Vault prevents a published course from omitting its badge.
- Core now carries the badge identity through course summaries, course trees, the featured Learn course and both own and public profile payloads. A public profile shows the course badges earned by that user, while an incomplete course never appears in the collection because completion is derived from every non-archived lesson having a passed server-side progress record.
- The featured course and course orientation views now compose the badge with Dina instead of presenting a generic character square. This work remains local-only while production course generation is active; no push was performed.

## Current State (2026-08-09) — Admin governance surfaces expanded locally

- `/admin/audit` now uses exact server-side totals and filtered pagination, so the console no longer confuses a bounded page with the complete append-only history. Its expanded inspector exposes immutable event metadata and a read-only payload, while search, action filtering, range controls, and refresh are designed for human investigation.
- `/admin/roles` now exposes exact assignment and permission totals, role distribution, assignment provenance, last-change metadata, and a full-viewport history view. Superadmins can search the directory before granting access, revoke roles only after confirmation, and cannot accidentally revoke their own `superadmin` role. Permission mutations are constrained to the database's closed permission vocabulary.
- This establishes the administrative governance philosophy for future surfaces: exact numbers from the source of truth, enough context to make a decision, expansion for detail instead of cramped grids, fixed viewport overlays for detached work, explicit confirmation for high-impact mutations, and an append-only trail for accountability. The changes are local-only while the production generation process is active; no push was performed.

## Current State (2026-08-09) — Unified learning intelligence rebuilt locally

- The public cookie experience now uses a layered, equal-choice preferences dialog: necessary technologies are explained separately from optional first-party attribution and measurement, settings remain reachable from the marketing footer, privacy links to a usable cookie-controls section, and rejecting optional technologies removes the first-party identifier plus known GA4 cookies. Public tracker scripts are gated by the consent state and react immediately to accept/reject changes; kid surfaces remain outside the optional tracking path.
- `/admin/insights` is now a compatibility redirect into `/admin/intel?focus=learning`, leaving one focused decision console instead of two conflicting dashboards. The new Learning evidence tab combines explicit lesson abandonment with server-authoritative segment-attempt calibration; unavailable signals stay unavailable instead of being displayed as zero.
- Data Intel now syncs `lesson_segment_attempts` and an adult-only first-party conversion dimension. Daily distinct-user rollups are computed directly rather than summed, cohorts use week boundaries consistently, and flat time-series APIs reject metrics that lack an exact denominator. A focused DuckDB regression suite covers grades, abandonment duration, aggregate identity counting, cohort boundaries, adult conversion attribution and export de-identification.
- Privacy boundaries remain strict: no child anonymous-to-account linking, no free text or replay, no third-party analytics pipeline, and direct event exports omit user and anonymous IDs while minting a per-response session reference.
- The next intelligence contract is now locally implemented: event retries are idempotent, client timestamps are bounded, and server-authoritative attempts carry only closed pedagogical context. DuckDB derives explainable mastery/review state and anonymized skill health, while `/admin/intel` visibly reports sync freshness and evidence coverage before presenting learning conclusions. Runtime experiments record a treatment only after it rendered. Core exposes an own-learner boundary for the future Tutor; the Tutor itself remains intentionally unimplemented.
- The learning console now has a decision-oriented command center rather than a single skill table. The warehouse retains localized course catalog context, computes course/lesson/UUID-only learner summaries from authoritative attempts and explicit lifecycle events, and labels every finding as awaiting, limited or sufficient evidence. Staff can expand course, lesson and learner summaries in a full-viewport dialog; empty data remains explicitly empty while the published catalog stays inspectable.

## Current State (2026-08-09) — Admin generation monitor made production-resilient locally

- `/admin/generation` no longer depends on a browser Realtime subscription to discover a run. Core hydrates the current live rows and polls them as the reliable baseline; Realtime is only an optional low-latency accelerator. This covers deployments without public Supabase variables and pages opened after the live-row INSERT.
- Forge writes the first heartbeat before paid work begins, resumes with published checkpoint slots already counted, recomputes published/failed/skipped terminal counters without double-counting retries, and records skipped slots in both the live row and heartbeat snapshots. Migration `0038_generation_live_accuracy.sql` is required before deployment.
- The monitor now exposes processed progress, skipped work, cost, token/cache metrics, multiple concurrent runs, and an explicit degraded/unavailable state. History and analytics refresh when opened, so a completed run becomes inspectable without a full page reload. Regression coverage includes Core hydration, polling without Realtime, malformed wire values, and Forge terminal accounting. No push was performed.

## Current State (2026-08-08) — Admin content catalog and human review rebuilt locally

- `/admin/content` now uses exact, paged Core reads instead of the PostgREST 1,000-row ceiling. Course and lesson totals, status buckets, hierarchy counts, and the review queue fail closed when an upstream count is unavailable, so the admin never sees a fabricated zero or a capped number.
- Course inventory rows expose the hierarchy and release metadata an admin needs to make a decision: description, subject, status, adventure/saga/topic/lesson counts, lesson status breakdown, creation date, and release-gate context. Course publication continues through Core's existing atomic release preconditions.
- The lesson review queue now returns a complete review set with course hierarchy, difficulty, XP, duration, creation date, and locale coverage. A new detail route strips answer keys and embeds the actual Lesson Engine player in an app-level centered overlay; preview navigation is non-grading and emits no learner telemetry.
- The shared admin dialog applies the full-page fixed-overlay rule with internal scrolling, and the frontend remains responsive at the required mobile and desktop breakpoints. This work is intentionally local-only while the production course-generation process is active; no push was performed.

## Current State (2026-08-03) — Production handoff EXECUTED; only provider credentials remain

- The production migration handoff prescribed below was executed for real on 2026-08-03, in DEPLOYMENT.md order: fresh verified `pg_dump` backup (77 tables, all 18 profiles confirmed inside, archived under the now-gitignored `database/backups/`), independent signature-object re-verification, dry-run listing exactly `0023`–`0033`, then the confirmed apply — **33 immutable receipts in `public.schema_migrations`**. Postflight probes green: `release_course(uuid)` EXECUTE-restricted to service_role/admin roles, `lesson_documents.illustration_style_version` present, game tables retired, `route_class` constraint clean.
- Executing the runner against the real pre-baseline database caught two defects the fake-psql harness structurally cannot see, both fixed and pinned before any mutation: the preflight's scalar subquery ERRORed on a ledger-less database (PostgreSQL plans every CASE arm — now a psql `\gset`/`\if` two-phase script), and the RAILWAY_TOKEN guard rejected a logged-in interactive CLI session (now accepts either). A third landed post-deploy: `tsc` does not copy `.sql` assets, so dataintel's first container served `/health` while `initDb()` warned ENOENT and the warehouse sat silently dead — the build now ships `dist/db/schema.sql` and the CI test pins it.
- PR #26 (136 commits) merged to `main` after all 11 checks passed; every service CI+CD went green. The `dataintel` Railway service was created with its persistent DuckDB volume (`/app/duckdb`) and non-provider variables; Core got `DATAINTEL_URL`/`DATAINTEL_INTERNAL_KEY`; Forge got `PICTUREGEN_URL`/`PICTUREGEN_INTERNAL_KEY`. After the PR #27 packaging fix, production dataintel boots clean: DuckDB initialised and the first Vault sync completed (18 users). The retired `gamegen` service was deleted after a dependency inspection found zero variable references and no volumes.
- Live production state: all 18 app+Supabase services RUNNING; Core `/health` returns the §1.6 envelope; the frontend (with the restored v1 sound set) serves on littlefounders.ai. `npm run production:preflight` now reports exactly **4 failures — the provider credentials** (`coursegen/DEEPSEEK_API_KEY`, `coursegen/QWEN_API_KEY`, `audiogen/TTS_API_KEY`, `picturegen/IMAGE_API_KEY`): supplying those four values and authorizing the paid cap is the ONLY remaining step before generating Financial Education in the cloud (`generate:track --require-images` per COURSE_ENGINE.md, then Echo narration, then the human `release_course` decision).

## Current State (2026-08-02) — Financial Education local release candidate ready; production handoff remains

- An adversarial multi-agent review of the handoff commit (`aa5c1d43`) confirmed 9 major and 22 minor defects; every one is now fixed and regression-tested. Money controls: the DeepSeek→Qwen fallback flag uses a strict boolean parser (`false` actually disables it — `z.coerce.boolean()` treated every non-empty string as true), billed Prism images now survive transport retries and even non-Prism terminal errors into the usage ledger and the `FORGE_MAX_USD` kill switch, and success envelopes missing `generated_images` (version skew) fall back to the legacy `cached?0:1` billing instead of counting as free. Visual identity: the DashScope negative prompt is purpose-aware and budgeted under its 500-char cap so the no-person/anti-3D/no-text blocks can never be truncated away (they previously were, on every generation), scene purposes no longer receive anti-scenery negatives that fight their positive prompts, and object-tile cache keys collapse to style+label so byte-identical tile requests can never be paid twice. Inheritance: cross-lesson cross-locale homograph transfer is blocked while the deliberate same-lesson three-locale sharing is preserved, and both `run.ts` and `images:backfill` now hard-verify Prism's advertised `style_version` (new `/health` field) against Forge's provenance constant before any paid call.
- The human release gate is now visible end-to-end: `release_course`'s six refusal codes surface as distinct §1.6 envelope errors (`RELEASE_NOT_FOUND`, `RELEASE_ARCHIVED`, `RELEASE_INCOMPLETE_HIERARCHY`, `RELEASE_LESSONS_NOT_REVIEWABLE`, `RELEASE_INCOMPLETE_LOCALES`, `RELEASE_VERIFICATION_REQUIRED`), the admin Content page renders the refusal banner instead of silently discarding the mutation error (verified in-browser against the live local stack at 375px and 1280px; the 409 envelope confirmed on the wire), audit-write failures on release are loudly logged, and `release_course` itself now publishes only preflight-qualified rows and re-verifies its published row counts inside the transaction, so a concurrent Forge insert can no longer be blanket-published unverified.
- The production migration path was corrected against reality: a read-only signature-object probe (this session) verified production at `0022` exactly, so `database/DEPLOYMENT.md`, `ROADMAP.md` and `0033`'s header no longer claim the stale `0011` baseline. `railway-migrate.sh` now uses the live-proven single-positional-argument transport with order-independent sentinel judgment (`railway ssh` was demonstrated to return local exit 0 for a remote `exit 42`, and its previous base64/printf shape never executed `psql` at all), and a second adversarial pass caught its baseline probe checking a nonexistent table (`generation_run_snapshots` → `generation_heartbeat_snapshots`) — the probe map and the operator table in `DEPLOYMENT.md` are now cross-checked against actual migration DDL by the database test suite. `0033` additionally remaps surviving games-era telemetry (raw events and `0025` rollups) before tightening the `route_class` constraint, so the migration cannot abort on QA/staging data.
- Echo now refuses cleanly at §1.6 for every failure path: a last-resort envelope error middleware (400 `VALIDATION_ERROR` for malformed bodies, 500 `INTERNAL` otherwise, no stack leakage), 502 `UPSTREAM_FAILED` when Vault is down behind the manifest route, a preflight estimate that applies the live path's hash/voice reuse test (so `estimatedTtsCalls` is a true upper bound even with stale manifest hashes), and budget exhaustion that short-circuits the batch with one visible skip summary instead of thousands of noise failures and pointless writes.
- Operational gates hardened: `production:preflight` distinguishes crashed from scale-to-zero-asleep services (a crashed instance always fails, asleep generation services WARN), scopes every status and variable query to the requested environment, and leaks no secret even under `bash -x`; `repo:map` is now deterministic for a committed tree (git-aware enumeration, last-commit date stamp) so the strict clean-tree release gate cannot false-fail and gitignored run artifacts can never re-enter the map; the untracked-file gap in the clean-tree gate is closed; `npm run setup` really covers all 10 npm packages.
- The production curriculum set is now graph-backed end to end: `graph:check` scans all three production courses, and Forge injects each topic's validated prerequisite/sequence/retrieval slice into PLAN, WRITE and REVIEW. The graph remains derived from catalog YAML, so it cannot diverge into a second hidden curriculum source.
- Data Intel now has the same Railway deployment contract as the other app services (`railway.json`, per-service `.railwayignore`, CI/CD and persistent DuckDB volume instructions). The live Railway project still requires the operator to create the `dataintel` instance and variables; no remote mutation was performed here.
- Game Engine retirement is now represented in the forward schema: migration `0033_retire_unused_game_schema.sql` removes any never-shipped game tables, columns and event vocabulary after the immutable historical migrations. `gamegen` presence is a production-preflight failure, not a warning; its Railway deletion remains a deliberate operator action after dependency inspection.
- The old diagnostic `fe-pilot-financial-20260802-v4` remains **unpublished** and must not be resumed under its old run ID. It has a recoverable `planned` checkpoint with only its skeleton; its append-only ledger has 24 records totalling USD 0.698813, but no localized lesson bundle, Vault lesson document, or release attestation. It is preserved as historical evidence, not as the production baseline.
- The owner-authorized Max pilot then completed on a fresh run ID. `fe-pilot-financial-20260802-max-live01` failed closed after three bounded slot attempts because the author output remained structurally incomplete; it spent USD 0.2321 and published nothing. After the writer prompt began listing schema minimums beside each skeleton segment, `fe-pilot-financial-20260802-max-live02` published the first complete visual release candidate: one slot, all three locales (`es-MX`, `en-US`, `pt-BR`), 10 segments per locale, 12 images placed (14 fresh generations including verifier/localization redraws), 70,352 tokens and USD 1.0880 estimated. Vault returned lesson `8f45785d-629d-46a6-87e9-70e2be80292d` in `review`; every stored image URL returned HTTP 200 and no placeholder URL was present. The candidate is reviewable but intentionally not kid-visible until the human release gate flips its status.
- The observed paid ledgers give a grounded pilot envelope: `v13` spent USD 0.152319 (text-only, 64,563 tokens), `v15` USD 0.191140 (text-only, 80,007 tokens), `v12` USD 0.432657 (6 image attempts), and the older `v4` USD 0.698813 (16 image attempts). None is releasable evidence, so the next visual candidate should use a fresh run ID and an explicit whole-lesson cap of USD 1.00–1.25. Those historical image ledgers used the old qwen-image unit price; the active qwen-image-max international list price is USD 0.075/image and Prism can verify up to three attempts per target. Echo's new `AUDIOGEN_MAX_TTS_CALLS_PER_RUN` bounds TTS calls, but a dollar estimate requires the current DashScope TTS tariff and the free audio preflight output.
- The authorized local pilot was executed in two isolated runs. `fe-pilot-financial-20260802-live01` reached a reviewed 8-segment document through the Qwen fallback after DeepSeek returned HTTP 402, spending USD 0.132196; required-image admission then refused 11 missing visual targets before any Prism call because the worst case would exceed the USD 1.25 cap. `fe-pilot-financial-20260802-live02` spent USD 0.563066 across three plan/write cycles and was refused after salvage: Qwen repeatedly omitted valid character ids and produced an empty rationale, so Forge rejected the shortened document. Aggregate pilot spend is USD 0.695262, with zero images, zero Vault publication and zero release candidates. These ledgers are preserved as diagnostic evidence; do not resume them after changing provider/model parameters without a new approved cap.
- After the DeepSeek balance was restored, the historical `fe-pilot-financial-20260802-live03` proved the author path but failed its old-model visual contract: DeepSeek produced a valid plan and document, Qwen review passed, and Prism accepted a scene after two verifier attempts, then rejected an option tile after three attempts because the `qwen-image` pixels still contained a non-white background. The final Forge ledger was USD 0.574790 with 12 image attempts, no localized bundle and no Vault publication. `qwen-image-plus` showed the same gray-surround/white-card behavior in direct probes. This gate failure belongs to the retired models; the Max canary and subsequent Max pilot passed the same white-canvas verifier. Manual probes are outside the Forge ledger and must be reconciled against the provider account.
- Prism's object-tile prompt was tightened again to require a pure `#FFFFFF` edge-to-edge canvas and explicitly negative backgrounds, frames, shadows and panels; all 57 Prism tests remain green. This is a prompt-hardening change only and intentionally does not weaken `verifyWhiteCanvas` or change the locked image provider/model decision.
- The object-tile prompt was then rewritten as a concise positive specification: literal object, centered and fully visible, pure-white canvas to all four edges, flat 2D animated vector, clean geometric shapes, crisp contrast and bright colors. It contains no LittleFounders name, lesson context or long art-direction prose. The 57 Prism tests remain green. A fresh service probe still failed closed after three attempts, and a direct `qwen-image` image showed a green surround and rounded white card; concise prompting alone did not satisfy the old model's pixel gate. No course run was started after that failed canary.
- The owner then authorized a Prism model switch. Picturegen and Forge now select `qwen-image-max`; the local image service environment was updated, Forge ledger entries read the configured model, and illustration provenance advanced to `v7-qwen-image-max-flat-vector+v8-qwen-image-max-object-white-flat-vector` so previous-model art cannot be inherited. Because Max is synchronous on DashScope, Prism now uses the multimodal endpoint and its square `1328*1328` preset. The single-object canary generated one image, passed both pictorial and deterministic white-canvas gates, and was manually inspected at `/tmp/concha-qwen-image-max.webp`; the Max pilot subsequently validated the same path end-to-end.
- Its initial `Helado` object-tile probe passed the text/person gate after two generations, but rendered a white rounded card on a dark gray canvas — rejected by human visual review before it could enter Forge or any course document.
- Object-tile art direction now requires the literal object centered alone on a pure-white, edge-to-edge empty canvas, using a modern high-contrast animated-editorial vector treatment. The implementation keeps the product identity outside the model-facing tile prompt; all four tile-purpose guides repeat the white canvas rule and wide scenes remain setting-based.
- Prism's vision verifier returns a structured, non-user-facing diagnosis (`hasText`, `hasPerson`) with every verdict. Object tiles add a deterministic white-canvas edge-pixel gate, which avoids treating the colored foreground object as background. A terminal 422 reports only the mechanical category, never the vision model's free-form description. A partial vision all-clear reply is `unavailable`, not a clean acceptance.
- The white-canvas look began with an object-only cache discriminator; after local review showed that accepted scenes were still 3D-looking, Prism's strict 2D flat-vector identity now deliberately uses `v7-qwen-image-max-flat-vector` for scenes and `v8-qwen-image-max-object-white-flat-vector` for tiles. New art therefore cannot reuse the prior look. A required visual run performs a conservative all-target image-cost admission check before its first Prism request, preventing a small budget from purchasing an unreleasable partial illustration bundle.
- The visual planner now requests Prism only for literal concrete-object labels. Abstract concepts, questions, prices, people, actions and sentence-shaped labels retain their intentional icon/text fallback, preventing expensive rejected image cards. The author prompt now teaches the same distinction; tests pin both the no-spend rejection path and ordinary object-image generation.
- Localize now sends its frozen string map in bounded atomic batches, preserving paths, answer-key exclusion and contract revalidation. The shared OpenAI-compatible client races both the request and the response-body read against one absolute deadline, so a provider that ignores abort cannot park a Forge worker indefinitely; focused timeout and batching tests pass. The interrupted `v5`–`v7` attempts are diagnostic evidence only and remain unpublished.
- The `v8` diagnostic proved that the remaining live failure was DeepSeek author availability, not a document/gate defect: plan completed, then the first author request timed out at its intentional 60-second ceiling. Forge falls back to the already-configured Qwen provider for a retryable DeepSeek transport failure or a provider-local DeepSeek 402 balance failure, recording `:deepseek-fallback` in the ledger. Invalid credentials, malformed requests and billable exhausted completions never fail over; every fallback document still needs the normal gates, review and human release.
- The first Qwen fallback reached review but had salvaged 10 of a 13-segment plan. Forge now limits model-authored plans to 8–10 segments and rejects any salvaged document before it can reach publication. This protects the learning rhythm from saturation and makes “complete blueprint coverage” an enforceable release condition rather than a warning in the generation log.
- Candidate `v13` confirmed the enforcement at the reduced 8-segment ceiling: Qwen produced seven valid segments and Forge refused the short document at USD 0.1523 before review or images. The writer now gives a final low-temperature full-document recovery a chance before recording a partial salvage, so a recoverable formatting defect cannot preempt a complete blueprint; any remaining salvage stays diagnostic and is refused by `run.ts`.
- Candidate `v15` surfaced the bounded final issues at USD 0.1911: an open-ended `type_answer` had an empty accepted answer and a `speed_tap` had fewer than its six required items. The planner now forbids `type_answer` unless its brief is a one-step numeric response and requires every `speed_tap` brief to specify 6–14 items. Further paid candidate runs are paused until the DeepSeek balance is restored or a materially different approved author model is configured; repeated Qwen-only retries would not be evidence-driven.
- The planner now also repairs those two semantic mismatches deterministically before any writer call: open-ended `type_answer` briefs and underspecified `speed_tap` briefs are demoted to an allowed choice type, with the repair recorded in the plan report. This keeps the blueprint honest without inventing answers or padding an interaction with duplicate items.
- Candidate `v12` established a fresh 9-segment blueprint and then halted before review, localization, images or Vault publication when DeepSeek returned 402. Its ledger is USD 0.0842 (three author records, no image records), safely below the USD 1.25 cap. The provider-local 402 fallback is now covered by a provider-level test; the same run ID can resume under that unchanged cap, retaining the independently auditable ledger and blueprint.
- Its first resumed visual pass reached all three localized documents, then correctly rejected an English localized label (`Child holding a toy`) as a non-white-background person tile. Forge now recognizes person/action labels across es-MX, en-US and pt-BR before Prism is invoked; the rejected pixels remain metered. The mechanically accepted pre-change scene assets are pipeline evidence only, not the final art-direction candidate.
- A local Forge write demonstrated that `FORGE_CHAT_TIMEOUT_MS` used to apply once per transport retry, allowing four full timeout windows to park the lone pilot worker. The shared OpenAI-compatible provider now uses one absolute deadline across the complete retry series; the interrupted run remains at a recoverable `planned` checkpoint with its skeleton preserved.
- The pilot also exposed that multiple local invocations could share the same `run-id`, duplicating provider work. Forge now owns a cross-process `RunLock`; a second writer fails before it can spend. The documented USD 0.50 cap is now explicitly an admission probe, not a promise to fund a complete visual lesson; a fresh run ID and an explicit whole-lesson cap are required for the next paid candidate.
- Local release evidence is green: all service type checks, lints and tests; Forge's current 544-test suite; Prism's 57-test suite; backend's 224-test suite; frontend production build; dependency, secret, i18n and document-sync gates; and two clean Vault resets after migration `0033`. The three production catalogs report 4,192 blueprints with zero errors or production warnings, and their competency graphs have zero errors. The local ledger records all 33 migration receipts, including `0033_retire_unused_game_schema.sql`, and exposes `release_course`.
- The root release gate now visits every TypeScript service in the service map, including Prism (`picturegen`), Depot (`filebase`) and Data Intel (`dataintel`); all ten services pass type-check, lint, tests and build. The expanded pass also caught and fixed Data Intel's export-job query alias (`rows AS row_count`), with a create→list regression test so the admin export panel cannot report a false 502 for a valid pending job.
- The final post-change verification re-ran the full all-service gate after the adversarial-review fix wave: every service passes type-check, lint, tests and build again — Forge 578 tests, Prism 79, Echo 164, Core 232, frontend 391, Data Intel 138, plus the database package's 33-migration checks and 12 transport scenarios. The only emitted diagnostics remain non-failing frontend `act()`/router test warnings, empty-DuckDB fixture warnings in Data Intel, and the existing frontend chunk-size advisory.
- The production migration runner now has a no-write integration test that executes its remote pipeline through fake Railway/`psql` binaries. That test caught and removed a Bash 3.2 incompatibility (`mapfile`); the database package test now covers migration invariants and the operator transport together.
- The latest from-zero verification validated the complete financial-education run without paid calls: `generate --require-images --dry-run --run-id release-check-financial-education-20260802025923-2369` enumerated all 1,312 slots (0 tokens, USD 0), and `generate:track --require-images --dry-run --track-id release-track-financial-education-20260802025923-2369` completed all 8 adventure shards with 0 failed and 0 unattempted slots (0 tokens, USD 0). This proves the production visual-mode flags and full-course sharding/checkpoint path are structurally ready before any provider budget is authorized.
- Echo now has the matching no-spend preflight: `npm run narrate:all -- --course financial-education --dry-run` inspected the local pending set with 0 TTS calls and 0 writes. A live batch remains separately operator-triggered and uses the speech cache plus manifest hashes before any synthesis.
- The post-Max-pilot Echo preflight found 0 pending `financial-education` lesson documents, 0 estimated TTS calls and 0 writes. The candidate remains in the human review state, so no paid audio synthesis was started; the TTS call ceiling and manifest cache remain ready for the controlled release step.
- The single operator-facing `npm run release:readiness -- financial-education` command now composes every local gate, the 1,312-slot course dry-run, all 8 track shards, and Echo's preflight from the correct service directories. Its latest run completed with 0 errors, 0 tokens, and USD 0 without deployment, migration, publication, or paid API calls.
- A read-only Railway inventory check on 2026-08-02 confirmed that the existing production instances are running, but the live project still contains the retired `gamegen` service and does not list the new `dataintel` service. This is deployment drift, not a local release failure: the handoff must deploy the reviewed service set and explicitly decommission the obsolete gamegen service only after verifying that no route, volume, or scheduled job still depends on it. No production mutation was performed during the check.
- The same read-only environment audit found no production `DEEPSEEK_API_KEY`, `QWEN_API_KEY`, `PICTUREGEN_URL` or `DATAINTEL_URL`/internal key; Echo's `TTS_API_KEY` and Prism's `IMAGE_API_KEY` are still placeholder-like values. Forge, Prism, Echo and the Intel proxy therefore must not be started as a paid course run until their reviewed production variables are supplied and smoke-tested. Values were classified by name/presence only and never printed.
- Public read-only smoke checks on 2026-08-02 returned the expected envelopes from Core (`backend`, `status: ok`) and Depot (`filebase`, `status: ok`); the public frontend returned HTTP 200. The Supabase gateway's `/health` is protected by its expected Basic-auth boundary and returned 401 without credentials, so it was not treated as an application outage.
- Migration `0032_lesson_illustration_style.sql` now records `illustration_style_version` on every newly published lesson document. Forge and the zero-spend backfill inherit only the current `v7-qwen-image-max-flat-vector+v8-qwen-image-max-object-white-flat-vector` bundle; legacy/null rows are excluded, preventing old-model, 3D or non-white art from bypassing the new visual contract.
- The local generation path is now validated through a complete Max visual candidate. The next executable step is external production handoff: apply the reviewed database delta, deploy the reviewed services and provider variables, run the production smoke/preflight gates, then explicitly release the reviewed candidate. Do not start the full 1,312-slot course until those production gates and the human release decision are complete.
- The remaining production steps are intentionally external boundaries, not unresolved local defects: production's live Vault sits at migration `0022` exactly with no `schema_migrations` ledger (verified 2026-08-02 by read-only signature-object probe — 0022 objects present, 0023+ absent, no ledger; the 2026-07-28 decision-log entry records `0012`–`0022` applied then), so apply the reviewed `0023`–`0033` delta with the new operator-only `database/scripts/railway-migrate.sh` (`--baseline 0022`; dry-run, independently verified baseline, backup, then explicit confirmation), deploy the reviewed service code, configure the real DashScope TTS credential and approved voices, then authorize the fresh whole-lesson visual cap and later the full-track cap. Production generation and publication remain human-controlled paid/release actions.
- `npm run production:preflight` now provides the repeatable read-only handoff check for that boundary: it inventories Railway's production services scoped to the requested environment, hard-fails any crashed instance, treats a scale-to-zero generation service (`coursegen`, `audiogen`, `picturegen`, `dataintel`) with zero active instances as a WARN rather than a failure, and classifies required provider/internal variables without printing values (verified secret-free even under `bash -x`). Against the current production snapshot it still fails on the real drift (missing `dataintel`, missing Forge/Intel wiring, placeholder Echo/Prism credentials, and the retired `gamegen` service); this is expected evidence until the operator reconciles production. `npm run production:preflight:test` covers the passing, failing, crashed and cross-environment paths with a fake Railway transport and confirms no secret value reaches output.

## Current State (2026-08-01) — Complete Sequential Overhaul of All 10 Admin Panels

- **Context & Audit.** Following the owner's directive, we conducted a systematic audit and UI/UX overhaul of all 10 admin panels in `/admin`, one by one in exact sequential order (`emails`, `overview`, `content`, `users`, `analytics`, `insights`, `intel`, `generation`, `audit`, `roles`).
- **Panels upgraded and features added:**
  1. `admin/emails` — KPI StatCards (Total Sent, Delivery Success Rate %, Active Templates, Top Locale), Template/Locale distribution progress bars, search/filter controls, and a Resend-style Email Detail Inspector Modal. Extended `email-server` and `backend` schemas to return locale breakdowns.
  2. `admin` (Overview) — Staff Quick-Action Hub, visual retention progress bars with color-coded score thresholds (`>=80%` green, `>=50%` yellow, `<50%` red), and operational telemetry summary.
  3. `admin/content` — Content KPI header cards, course search & status filter pills, lesson moderation preview modal, and cleaned fallback types.
  4. `admin/users` — User KPI header cards, role filter pills, search bar, and User Detail Inspector Modal with copyable User ID.
  5. `admin/analytics` — Telemetry refresh control, health KPI summary cards, and color-coded latency threshold badges (`<100ms` green, `100-300ms` yellow, `>300ms` red).
  6. `admin/insights` — Standarized KPI StatCards (Consent Coverage, Events, Peak DAU, Activation/TTV), icon-enhanced tab navigation (`space_dashboard`, `filter_alt`, `school`, `timeline`), and glassmorphic card wrappers.
  7. `admin/intel` — Iconic 9-tab navigation bar (`Home`, `Trends`, `Funnels`, `Retention`, `Segments`, `People`, `Experiments`, `Alerts`, `Settings`) and glassmorphic container cards for Recharts visualizations.
  8. `admin/generation` — Standardized tab bar navigation using `<Icon>` design tokens and glassmorphic pill active states.
  9. `admin/audit` — Audit KPI header cards (Total Events, Unique Actors, Top Action Type), real-time search & action filter dropdown, and Audit Detail Inspector Modal with prettified JSON detail viewer and 1-click Actor ID copy.
  10. `admin/roles` — Superadmin role KPI header cards (Total Holders, Admins, Superadmins, Privileged Accounts), search input, role filter pills, and glassmorphic grant card & permission toggle modal.
- **i18n & Verification.** 60+ new translation keys added with 100% key set identity across `en-US`, `es-MX`, and `pt-BR` (`admin.json`). Verified with `npm run typecheck:all`, `npm run i18n:check`, `npm run secrets:check`, `npm run repo:map`, and full unit/contract test suites (`backend`: 223/223 passed, `email-server`: 29/29 passed).

## Current State (2026-07-31) — Game Engine: REMOVED entirely, after redesign, on the owner's explicit call

- **What happened, in order.** The owner played the shipped Phases 0–6 build (below) live and judged it a failure as a GAME — flat-color placeholder shapes, a generic one-line tutorial, and a lesson-style live "progress to mastery" bar in the HUD, none of which read as an arcade game. A first corrective pass (juice/contrast/level-readout improvements across all 5 flagged mechanics: sorter, stacker, autobattler, defender, explorer) shipped and was judged still insufficient — "no veo cambios sustanciales." A second, much more directive pass then explicitly cloned named, beloved games onto each mechanic (defender→Plants vs. Zombies, autobattler→Clash Royale/Teamfight Tactics, stacker→Tricky Towers, sorter→an Overcooked-style factory line, explorer→the Super Mario World overworld map), landed real bugs found live (an emitter-starvation particle bug, a double-coordinate-transform bug, dead code, an ability-label bug), and was independently live-verified in-browser by the orchestrating session itself (not just agent self-report) — genuinely distinctive, working, tested results. Despite that verified success, the owner made the explicit, final call to delete the entire feature and start from zero rather than keep iterating on it.
- **Full removal executed the same session.** `frontend/src/game-engine/` (all 8 mechanics, the Phaser player, the registry, `/dev/game-lab`), `gamegen/` (the whole Arcade generation microservice — pipeline, providers, catalog, vault client), `backend/src/game-contract/` (the parity mirror) and `backend/src/routes/games.ts` + its four services, the `/games` + `/games/:slug` frontend routes and hub, `games.json` in all three locales, and `GAME_ENGINE.md` are all deleted. The feature was NOT standalone — it was surgically un-woven from files that also serve the (untouched, still-live) lesson/course engine: the admin generation-monitor dashboard (`adminData.ts`/`generationTypes.ts`/`generationI18n.ts` — Arcade's `'games'` kind removed, Forge's `'lessons'` kind and every lesson-path function kept verbatim), the family/parent dashboard (`KidTerritoryPage.tsx`/`FamilyPage.tsx` — the games rollup removed, lesson progress kept), `dataintel`'s analytics (game funnels/routes removed, every lesson-engagement query kept), Prism's illustration judge (`game_sprite`/`game_background` prompt purposes removed, all lesson-facing purposes kept), and the first-party insights vocabulary (`game_open`/`game_start`/`game_complete` events and the `games` route class retired as dead vocabulary, the same way `game_complete` was once already retired — see 2026-07-30a below — before the engine that re-added it existed). CI workflows (`gamegen-ci.yml`, `gamegen-cd.yml`), the `agent/tools/` game-canvas i18n scan, and the `new-minigame.md` template were removed too.
- **What was deliberately NOT touched.** `database/` — the `games`/`game_documents`/`game_attempts`/`game_progress` tables and migrations `0027`–`0029` are untouched; only the APPLICATION CODE that read/wrote them is gone. Those tables hold zero real rows (no paid generation run was ever executed across either redesign attempt), so nothing is orphaned, but dropping them is a separate, even more irreversible decision the owner has not made — a follow-up migration, not part of this pass.
- **Why this entry exists at all, given "as if it never existed."** This log's job is to stop a future session from re-discovering the same dead end blind. The two entries below (2026-07-30a/b) are kept verbatim as the historical record of what Phases 0–6 actually built — they are superseded, not deleted. Do not re-attempt a game engine from that old spec without a fresh design brief; if the product wants games again, start there, not from `/GAME_ENGINE.md`'s exhumed corpse.

## Current State (2026-07-30b) — Game Engine: Phases 0–6 implemented on `feat/game-engine` (5 commits, `4b0b64f..d968a3e`) — NOT merged, NOT deployed, NO paid run (SUPERSEDED — see 2026-07-31 above: the entire feature was removed)

- **What actually exists now.** `frontend/src/game-engine/` (core + all 8 mechanic slices + player + lab + registry), `backend/src/routes/games.ts` with `backend/src/game-contract/` as its parity copy, Vault migrations `0027`/`0028` (+ `0029` from the audit-fix pass in flight), the full Arcade pipeline in `gamegen/src/`, `games.json` in three locales, `/games` + `/games/:slug` + `/dev/game-lab` registered lazily in `App.tsx` (the `<SectionComingSoon section="games">` placeholder is gone), and `gamegen/curriculum/first-lemonade-stand/games.yaml` as the QA catalog. The entry below (2026-07-30a) is the Phase-0 record and its "nothing exists yet" status paragraph describes the branch *at that moment only* — it is superseded by this entry.
- **Nothing here is merged or deployed, and no paid generation run has been executed.** Not one DeepSeek, Qwen or Prism call has been made by Arcade; `games`/`game_documents` hold zero generated rows. That run is the owner's call under `agent/core/BOUNDARIES.md` #8, exactly like a Forge run.
- **The engine: 8 hand-written mechanics, six files each, zero cross-slice imports.** `schema.ts` (config/content Zod + `<M>_SPRITE_SLOTS`), `simulate.ts` (pure), `bots.ts`, `components.tsx`, `fixtures.ts`, `register.ts`. `registry.ts` splits synchronous `MECHANIC_META` (the hub renders from it and loads **zero** mechanic code) from `MECHANIC_LOADERS` (one dynamic `import()` per mechanic, so eight mechanics never become one bundle), and `loadMechanic()` returns `null` for an unknown id — the forward-compatibility property that lets mechanic #9's *content* ship before every client has its code.
- **The bots left `Simulator` for a sibling `bots.ts`, and that is a security boundary, not tidiness.** `bots.perfect` returns the exact `GameInputEvent[]` Core replays to grant XP, and a maximal log is short. While `bots` was a member of `Simulator`, every `register.ts` — the module `MECHANIC_LOADERS` dynamic-imports, i.e. the root of that mechanic's lazy chunk — pulled an optimal headless player into the JavaScript the browser downloads; anyone could lift it out of the emitted chunk and POST a maximal log without playing a tick. `registry.test.tsx` now walks the real import graph from each `register.ts` and fails on the edge by name, and Core's `MechanicSimSlice` has no bots field either.
- **Rewards are the server's replay, and passing is a conjunction.** `passed = score >= pass_score && inputLog.length > 0 && score > idleScore`, where `idleScore` is what the SAME document and seed score for an EMPTY log — several mechanics award points for state the simulation reaches on its own, so a manifest whose `pass_score` sits below the idle baseline would otherwise have paid real XP for opening a game and submitting nothing. XP is gated on passing: no partial credit below the bar. The seed is `seedFromString(run_id)` computed by Core; the body's `seed` is only compared against it (a mismatch is `422 RESULT_REJECTED` / `seed_mismatch`), because a client that picked its own number could re-roll seeds against the document it was already served until it drew a favourable layout — a seed-shop the replay could never detect, since every seed replays honestly.
- **A run is paid exactly once, and the DATABASE is what makes that true.** Core checks recorded attempts before replaying, but the window that check must close is the window between its own read and its own write; `0029_game_attempt_integrity.sql` adds `UNIQUE (user_id, game_id, run_id)` and the insert runs `ON CONFLICT DO NOTHING`, so credit is granted only when a row actually comes back. A losing race — and an honest double-submit — gets `422 RESULT_REJECTED` / `run_already_recorded` and writes nothing.
- **Vault postures.** `game_documents` is RLS-enabled with **zero policies** (service-role only): RLS is row-level, not column-level, so any client SELECT policy would expose the server-only `validation` sidecar sitting on the same row — the same posture `lesson_documents` uses for `answer_keys`. `game_attempts`/`game_progress` are readable by the row's owner **or** a verified guardian, with no client write policy at all. `game_attempts.stats` holds derived aggregates only; the raw input log is replayed in memory and discarded.
- **The Arcade pipeline is real, and its cheapest gate is the one Forge never had.** `validate → plan → author → gate → simulate → judge → localize → illustrate → publish`, nine stages over eight checkpoint states (`gate` owns none — it runs inside author's corrective-retry loop, so a gate failure is feedback rather than a dead slot). `simulate` bot-plays the freshly authored manifest with the mechanic's real simulator: the `perfect` bot must reach `pass_score`, the `random` bot must not, the tick budget must hold, and `explorer` additionally runs its reachability solver — a beautiful unsolvable map is a total failure no LLM judge catches. It costs nothing and runs BEFORE the paid judge. `gamePlaybook.ts` is injected into BOTH the author and judge prompts so the bar the author aims at is the bar the judge rejects against. `illustrate` runs on the es-MX document BEFORE the localize string-freeze, so one image serves three locales, which forced a `NON_VISIBLE_KEYS` twin that skips whole CONTAINERS (`skin.sprites` is a `Record` with arbitrary slot ids that a field-name list could never protect). `publish` writes `status='review'` and `upsertGame()` takes no status argument — the absence of the parameter is the enforcement.
- **`--dry-run` spends nothing and destroys nothing.** It short-circuits before all five paid stages, skips the key checks entirely (a keyless dry-run test is the pin), and marks only PRISTINE pending slots — a slot carrying checkpoint data is counted as validated without being touched, because `setSlotState` replaces `data` wholesale and marking it would wipe paid, judge-approved work.
- **Platform integration.** Prism gained the additive `game_sprite`/`game_background` purposes (purpose is already inside the request-cache hash, so `STYLE_VERSION` stays `v4` and no existing art was invalidated); the admin generation dashboard became kind-aware so game runs never contaminate lesson cost/quality trends and get their own stage vocabulary and rubric dimensions; `/admin/content` gained a Games review tab where a reviewer can PLAY a game before approving it; `dataintel` gained game funnels; `gamegen-ci.yml` triggers on `coursegen/curriculum/**` and `frontend/src/game-engine/**` so a Forge topic rename or a contract drift breaks loudly, and `catalog:check` + `contract:check` run inside `npm test`. Root `generate:full` runs Forge and Arcade concurrently with linked ids and one shared illustration-lane budget (the DashScope quota is shared with Prism's other caller), behind an explicit `--confirm`.
- **Honest gaps, recorded rather than omitted (§1.12.7).** (1) `gamegen/src/pipeline/liveTelemetry.ts` and `gamegen/src/vault/telemetry.ts` are complete but **not imported by `run.ts`** — an Arcade run writes nothing to the shared `generation_runs*` tables today, so the kind-aware admin work will simply show no game runs until the wiring lands. (2) `RunOptions.topicContext` has no producer: `catalog/loader.ts`'s `TopicRef` carries only `ageTier`, so prompts carry the blueprint's own `micro_objective` as their only concept context. (3) There is no `coach` script in gamegen, though `rubrics.jsonl` + `ledger.jsonl` are written. (4) Game audio assets do not exist — the vocabularies are closed and validated, `audio.ts` maps new event names to the closest honest existing file or to silence, `GAME_BGM_ENABLED` is `false`, every game is playable and winnable with zero audio, and real assets remain the one pending owner action. (5) Browser verification is recorded only for the `/games` hub (kid, 1280 px light + 375 px dark, no horizontal overflow); a full light+dark sweep of the player and the lab at both breakpoints is not recorded and should happen before merge (§1.11).
- **Docs stewarded in the same pass:** `/GAME_ENGINE.md`, `gamegen/AGENTS.md` (implementation status + a Known-gaps section), `gamegen/README.md` (route/script/flag/env tables re-derived from `cli.ts` and `env.ts` — the old table omitted `--mechanic` and `--budget-usd` and documented a `BACKEND_INTERNAL_URL` that does not exist), `ROADMAP.md` (per-phase status), and this file.

## Current State (2026-08-09) — Tutor personalization boundary documented (Tutor runtime still future)

- **The future Tutor has a safe integration seam, not a live Tutor implementation.** Core exposes the authenticated caller-only `GET /api/v1/learn/personalization` route, which brokers Data Intel's derived learner skill states and highest-priority explainable action. The Tutor must never access DuckDB, raw events, raw attempts, free-text analytics, or another learner's data.
- **The future runtime contract is documented in `/ORACLE.md` and `/DATAINTEL.md`.** The allowed context is limited to role/age band, locale, current published curriculum context, relevant mastery/uncertainty/evidence state, review timing, closed learner intent, and safe product settings. Low evidence or a warehouse failure must trigger diagnostic/degraded behavior, never a fabricated zero or confident diagnosis.
- **Personalization is a closed feedback loop.** Core resolves the safe context → Tutor chooses a pedagogical strategy → moderated content is shown → authoritative grading writes new evidence → Data Intel recomputes the state. Any new Tutor telemetry must use a migration-backed closed vocabulary and the existing consent gate.
- **The Tutor remains a dedicated future product session.** Its model runtime, moderation-before-display, age-appropriate prompting, parent visibility, fallback behavior, offline pedagogical evaluation, staged rollout, and production migration handoff are still required before personalization is enabled for learners.

## Current State (2026-07-30a) — Game Engine: the approach decision and the spec (Phase 0) (SUPERSEDED — see 2026-07-31 above: the entire feature was removed)

- **Status when this entry was written, stated plainly (superseded by the 2026-07-30b entry above — kept as the historical record of Phase 0):** the branch `feat/game-engine` held exactly one new file, the untracked `/GAME_ENGINE.md`. `frontend/src/game-engine/` did not exist, `database/migrations/` still ended at `0026_dataintel_sync.sql`, `gamegen/src/` was only `app.ts` + `index.ts` + `__tests__`, `frontend/src/App.tsx:157` still served `games` as `<SectionComingSoon>`, and there was no `games.json` i18n fragment. Phase 0 was executed; Phases 1–6 were implemented over the rest of that session.
- **The 3-year-old OPEN decision is closed: prebuilt parameterized mechanics + generated JSON manifests.** `gamegen/AGENTS.md` had carried "Approach: OPEN — fully generated HTML5 sandboxed games vs parameterized prebuilt templates" since the v2 scaffold, which is why `games/` never got past a placeholder. Generated game *code* is rejected on three independently disqualifying grounds (`/GAME_ENGINE.md` §1): a novel program per instance is an unreviewable surface aimed at children and "sandboxed" is a containment claim, not a §1.9 safety claim; N generated engines means N feel/accessibility/§1.11-responsive/motion postures instead of one, and improving `runner` once must improve every `runner` game ever generated, retroactively; and generated code cannot be replayed, so it cannot be bot-tested for winnability before publish and cannot be trusted with XP.
- **`/GAME_ENGINE.md` authored as the authoritative engine spec (level 6, the twin of `/LESSON_ENGINE.md`)** — 13 sections: the `GameDocument` contract (§3) and its server-only `GameValidation` sidecar, the CLOSED 8-mechanic taxonomy with each mechanic's `config` surface (§4), the determinism/replay contract (§5), the reward path (§6), slice anatomy + the lazy registry (§7), concept binding and gating (§8), the 9-stage Arcade pipeline (§9), motion/responsiveness (§10), §1.9 applied (§11), the extension protocol for mechanic #9 (§12), and open questions + deliberate deviations (§13). The document is written so a slice can be added without editing another slice, and so the pipeline, the lab and Core all target the same executable contract.
- **The engine mirrors the Lesson Engine deliberately, down to the failure posture.** Hand-written mechanics (code) + generated manifest (data); `cheer` mode is the tier-1 default with no fail state and `arcade` mode ends at the RESULTS screen with a retry CTA, never a mid-game ejection — one product-wide failure posture rather than a per-surface invention. Games consolidate a concept a child already learned; they never teach one cold, and a game is locked until the bound topic has a passed lesson for that user.
- **Rewards are server-derived by replay, not client-reported.** The client sends `{ run_id, seed, input_log, duration_seconds, local_date }` and no score at all; Core loads the full document plus the validation sidecar with the service role, re-runs the mechanic's simulator through the one shared `replayGame()` entry point, and derives score/stats itself — a log violation is `422 RESULT_REJECTED` with no reward. `backend/src/game-contract/` will be a parity copy of the pure simulation code with its own `contract:check`, exactly like the lesson graders. `learning_stats` writes are delta-only and **`lessons_completed` is never touched by a game** — incrementing it would corrupt course progress, the parent dashboard, the `lessons_completed === 0` first-lesson-ever assertion in `backend/src/routes/learn.ts`, and every `dataintel` funnel.
- **Raw input logs are never persisted.** The log is replayed in memory and discarded; `game_attempts.stats` holds derived aggregates only. A tick-resolution behavioural trace of a child at play is precisely the data COPPA-minded minimalism says not to keep, and the reward does not need it.
- **Audio is honestly incomplete and documented as such.** The manifest vocabulary for SFX/BGM is closed so generated content can only name known sounds, but the only audio assets that exist are the 13 files already in `frontend/public/sounds/` (the rescued v1 set — this line said 9 files in `public/sfx/`, a path that has never existed, until 2026-08-23). New event names map to the closest honest existing file or resolve to no sound; a missing asset is a silent no-op, and every game must be fully playable and winnable with zero audio. Real game audio (ElevenLabs one-offs vs licensed loops) is an owner decision and the one pending owner action — game audio is not "done" and is not described as such anywhere.
- **The paid generation run is out of scope by design.** Publish writes `status='review'`; the §1.9 human publish flip stays the single blocking gate, and an actual paid Arcade run needs the owner's go-ahead like every Forge run (`agent/core/BOUNDARIES.md`).
- **Companion docs move in the same commit (§8 stewardship):** root `AGENTS.md`/`CLAUDE.md` §1.5 Arcade mission line (byte-identical, `docs:check`), `gamegen/AGENTS.md` (decision RESOLVED), `gamegen/README.md`, `GLOSSARY.md`, `doc_map.md`, `DESIGN.md` (Games hub + player recipes, the `GAME_PALETTES` enumeration, the canvas-vs-chrome rule, the game-canvas motion carve-out), `ROADMAP.md` (this decision + the 7-phase program) and this file. Those edits were in flight while this entry was written.

## Current State (2026-07-30) — Adversarial re-review of the dataintel + insights commits: 24 confirmed defects, the whole warehouse pipeline was actually disconnected end-to-end

- **Why this pass happened.** The two prior sessions (2026-07-29, below) shipped `dataintel/` and the insights capture layer with their own internal adversarial sweeps (17+23 and separate rounds) and all gates green. A follow-up multi-agent review (8 independent dimensions — SQL injection, service lifecycle, analytics math, the §1.9 consent gate, frontend capture, backend API integrity, migration idempotency, docs accuracy — each finding adversarially re-verified by a second, skeptical agent) still surfaced 26 candidates, 24 confirmed, 2 refuted. Every mechanical gate (type-check/lint/test/build, docs:check/secrets:check/i18n:check) was already green going in — none of this was caught by CI, because the tests exercised dataintel's own DuckDB directly and never the real Postgres/PostgREST wiring or the actual math.
- **Three compounding bugs meant the dataintel warehouse had zero real data and was unreachable from Core, despite 112/112 dataintel tests and a working build.** (1) `dataintel/src/db/sync.ts` filtered/ordered the incremental event pull by a column named `id`; the `dataintel_events_sync` view (0026) only ever exposed `event_id` — every sync tick failed and the cursor never advanced past 0. (2) The three dimension syncs (`users`/`lessons`/`sessions`) hit the raw Vault table names instead of the `dataintel_*_sync` views 0026 built for them — `users`/`sessions` don't exist as such and 404'd, and `lessons` succeeded against the WRONG shape (no `title_en`/`course_id`/`segment_count`, and the view's `WHERE status='published'` filter was bypassed, leaking drafts). (3) `backend/src/routes/admin.ts`'s `/api/v1/admin/intel/*` proxy built the forwarded path from `req.originalUrl` instead of the mount-relative `req.url`, so it never stripped the `/intel` prefix and doubled it — every one of the 40 dataintel endpoints 404'd through Core. All three fixed; a regression test for the proxy (and one for the sync column name) provably fails against the pre-fix code.
- **The A/B experiment engine had its statistics backwards.** `normCDF()`'s final return branch was inverted (`1 - 0.5*y` where it needed `0.5 + 0.5*y`), so `pValue` was `1 - true_p` for every experiment — a t=2 result (real p≈0.045) reported p≈0.955 and "not significant." Separately, the `dau`/`users` metric's per-assigned-user query was already filtered to one `user_id`, so `COUNT(DISTINCT user_id)` was always exactly 1 — every such experiment had zero variance and always reported "no difference" regardless of the real gap. Both fixed with a regression test seeding real DuckDB data and proving the old code reported the wrong sign/verdict.
- **Forecast/anomaly/churn all had metric-vs-column mismatches that either 502'd or reported the wrong number.** `forecastQuery`/`anomalyQuery` interpolated the raw `metric` query param as a SQL column name against a rollup that only ever computed `event_count`/`users` — 8 of the 9 documented metric values (including the default-looking `events`) threw a DuckDB "column not found," surfaced as an opaque 502; only `users` happened to match. Fixed via an explicit metric→column resolver, narrowed the `/anomalies` and `/forecast` Zod schemas to the four metrics the bucket rollup can actually answer (`events`/`dau`/`users`/`sessions`, 400 for the rest instead of a 502), and along the way found a second, pre-existing bug in the same query: the inner subquery's unaliased `created_at::DATE` doesn't auto-name itself `created_at` in DuckDB the way it would in Postgres, so the outer query's `day` column never resolved for ANY metric — this one had never worked. `anomalies.ts` also always reported `row.event_count` as `value` regardless of the requested metric; now reads the metric-generic column the query exposes. `churnRiskQuery`'s SQL `ORDER BY days_since_active DESC LIMIT $N` truncated the candidate set before `risk_score` (a 3-factor JS computation) was ever calculated, silently dropping the actually-highest-risk users when the true count exceeded the limit — the SQL LIMIT is gone, JS now scores every candidate, sorts, then slices; also floored the score at 0 (it was only clamped at 100).
- **Two infra hardening gaps, one dead worker.** `dataintel`'s rate limiter and cache both trusted `cacheClient.isOpen`, which node-redis keeps `true` throughout an entire outage's reconnect-retry loop — a live Redis outage would hang every request instead of the documented fail-open behavior; both now race the Redis call against a 250ms timeout. The alert worker had no reentrancy guard (sync's had one); added, so a slow evaluation pass can't double-fire an alert past its own cooldown. The churn worker was an openly-documented (per the original DATAINTEL.md) empty 24h ticker "reserved for future caching" that was never built — removed rather than left as dead code masquerading as a live job; scoring is already answered live on every `/churn/risk` call.
- **Two frontend gaps in the consent-gate wiring, not the consent policy itself.** `login()`/`signup()`/`completeOAuth()` persisted a new session and re-fetched `/auth/me` without first resetting `meLoaded`/`analyticsEnabled` to false — a same-tab identity switch (no intervening logout) could read the PREVIOUS identity's `analyticsEnabled` for the async gap until the new `/auth/me` answered. And the `signup_complete`/`login_complete` tracking call fired before `useInsightsBeacon`'s own effect had configured the beacon for the new identity, so the event sat in the pre-consent buffer and could be silently wiped if `analyticsEnabled` resolved false moments later (most likely right after a brand-new signup, before the role-assignment trigger's row is visible) — exactly the "Google signups never appear as conversions" class of bug the 2026-07-29 session believed it had fixed. `login`/`signup`/`completeOAuth` now resolve `analyticsEnabled` directly (not left to the next render), and `LoginPage`/`SignupPage`/`AuthCallbackPage` all call `configureInsights()` explicitly with that fresh value before tracking. No actual data was ever recorded incorrectly for a kid — the backend's independent per-batch consent recheck was always the backstop — but the frontend's own fail-closed claim wasn't structurally true before this.
- **Docs brought back to 100%:** `INSIGHTS.md` §3's pipeline diagram (was frozen at 0023's original 3 views/3 routes; the real count is 14 views/tables and 12 routes), `DATAINTEL.md` (endpoint count "25+" → 40, matching its own §4 table; the removed churn worker; a new note on which four metrics `/anomalies`/`/forecast` actually support vs. the full nine `/metrics/compare` approximates), `backend/README.md` (8 of 12 insights routes plus the entire `/intel` proxy were undocumented), and a comment-accuracy fix in `0025_insights_scale.sql` (misattributed a view's origin to the wrong migration — no functional effect). `repo_map.md` regenerated — it had gone stale mid-session on 2026-07-29 (missing `DATAINTEL.md` and several `dataintel/` file previews) with no gate to catch it.
- **Net: every fix has a regression test proven to fail against the pre-fix code** (stashed the file, re-ran, restored), following the same discipline as 2026-07-28c. Full gates re-run clean after all fixes: dataintel 127/127, backend 220/220, frontend 389/389; type-check/lint/build green in all three; root docs/secrets/i18n green.

## Current State (2026-07-29) — Insights: first-party learning/usage telemetry, consent-gated (UNCOMMITTED, lands in the next PR)

- **The owner's directive** — know the end user deeply (learning patterns, family conduct, usage rhythm) — implemented WITHOUT crossing §1.9, by making the consent mechanism the platform already had (a kid cannot exist without a verified guardian) carry the analytics gate. Spec: `/INSIGHTS.md`.
- **Migration 0023**: `analytics_consents` (per-kid, guardian-granted, auditable revocation) + `learning_events` (closed event/route enums, numeric value, NO free-text column by construction) + three `insights_*` SQL views (calibration, daily activity, family engagement) with client roles explicitly revoked. Applied + re-applied on the local stack (idempotent), verified `anon`/`authenticated` cannot select the views and `service_role` can.
- **Core**: `POST /api/v1/events` (batch 1–25, identity/role stamped server-side, kid batches DROPPED 202/accepted:0 without active consent — fail-closed on Vault failure); family consent grant/revoke re-guarded by the verified guardian link; `/admin/insights/{calibration,activity,families}`; `/auth/me` now returns `analyticsEnabled` so an unconsented kid's browser does not even transmit. Server-side `territory_view` capture on the family territory route (subject: the PARENT). 13 new tests incl. the full consent lifecycle.
- **Frontend**: `lib/insights.ts` beacon (batched, visible-tab heartbeat, pagehide keepalive flush, disabled = queue cleared); wired in AppLayout (session/nav), LessonRoute (lesson_start / lesson_abandon with seconds — the drop-off signal the server cannot see) and the narration replay button (audio_replay); parent-dashboard consent toggle per kid; `/admin/insights` page (consent coverage KPI first — insight breadth is bounded by consent, by design). i18n ×3.
- **Verified E2E in-browser against the local stack**: parent toggle → row in `analytics_consents`; kid session BEFORE consent recorded nothing; after consent: session_start/nav_view/session_end rows with role `kid`; `/admin/insights` rendered live data — and the calibration table immediately surfaced a real miscalibrated exercise (`s1-order-steps`: 3.0 attempts/learner, first-try 20). Mobile (375px) + desktop (1280px) screenshots, no horizontal overflow, no console errors (§1.11).
- **Deploy note**: 0023 must go to the production Vault BEFORE the merge that deploys this code (the standing rule). The platform terms / privacy notice govern ADULT collection and remain a pre-launch dependency — kid collection is already consent-gated per family.

## Current State (2026-07-28c) — /admin/emails made real + a functional-defect sweep (UNCOMMITTED, lands in the next PR)

- **Courier's email history is durable.** It was a 1000-entry in-process ring buffer, wiped by every redeploy, restart and Haraka child death — `/admin/emails` was empty essentially always. New `email-server/src/db/emailLogsRepo.ts` writes through to `email_logs` (0021) with the service role; the buffer survives only as the dev/test fallback when `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are unset. Round trip verified against the PRODUCTION Vault (write → Postgres → read back), test rows deleted afterwards.
- **GoTrue auth mail is finally captured.** It reaches Haraka over SMTP :587 and never touches the HTTP API, so *nothing in the repo* was writing the platform's actual mail. New `haraka/plugins/log_delivery.js` reports each relayed message on `hook_queue_ok` to a new internal `POST /api/v1/logs`, recorded as `templateType='auth'`, `status='relayed'` (new i18n key in all three locales). The plugin holds no DB credentials and is fire-and-forget with a 2 s timeout — a logging outage must never bounce a password reset.
- **Adversarial defect sweep: 40 candidates, 33 confirmed, 7 refuted.** Fixed here, worst first:
  - **Completing a lesson could erase a child's entire learning record.** `getLearningStatsForUpdate` collapsed "Vault did not answer" into a zeroed row, and the following PATCH wrote deltas-from-zero back — silently, behind a 200. `minutes_learned` and both streak columns exist nowhere else, so the loss was permanent. The read now returns `null` on failure and the route refuses. Regression test proven to catch it (fails `expected 200 to be 502` when the guard is removed).
  - **Core would hang forever if Redis was slow to boot.** node-redis retries the INITIAL connect indefinitely, so `await connect()` neither resolved nor rejected: `listen()` was never reached, `process.exit(1)` was unreachable, and Railway's ON_FAILURE policy never fired. Now listens first and connects in the background.
  - **A Redis outage after boot 500'd every request including `/health`**, failing the healthcheck and taking Core down over a degraded rate limiter. `passOnStoreError: true` (fail-open — availability control, not authorization) and `/health` mounted above the limiter.
  - **`/admin/generation` spun an infinite render loop in its default state** (`?? {}` as a `useEffect` dependency). Stable `EMPTY_BREAKDOWN` + idempotent updaters; regression test counts renders inside the mocked hook (a parent-level counter can't see it, since `setNodes` only re-renders the child) and fails with a `render loop: N renders` throw when the fix is reverted.
  - **Depot could be killed by one request** — `createReadStream().pipe()` with no `error` listener, and `void serve(...)` dropping an async rejection. Both closed; source destroyed on client disconnect.
  - **Prism answered 502 for every failure**, so Forge retried terminal errors — up to 12 paid image generations for a result that can never differ. Terminal codes now map to 422.
  - **The image budget kill switch was swallowed** by `images.ts`, so a run past `FORGE_MAX_USD_PER_RUN` kept paying and shipped lessons with missing art.
  - **`timingSafeEqual` threw `RangeError` → 500 HTML instead of 401** on any non-ASCII internal-key header, in 7 services (JS string length vs UTF-8 byte length). All now compare fixed-width SHA-256 digests, which also removes the key-length side channel.
  - 429s carried no CORS headers (limiter before `cors`), and malformed/oversized bodies answered 500 instead of 400/413.
- **Two gate repairs.** `docs:check` and `secrets:check` only ever ran under `database/**`, so they were unreachable for the exact commits they exist to catch — new `repo-gates.yml` runs them (plus i18n parity) with no path filter. And `check-secrets.sh` now exempts values that declare themselves placeholders (`test-`, `replace-me`, …), resolving a real conflict with §1.14, which *requires* fixtures to satisfy the production schema and therefore to be 16+ chars. Verified both directions: still passes clean, still catches a planted secret.

## Current State (2026-07-28b) — Production release of `fix/lesson-engine-hardening` (100 commits)

- **Pre-flight audit before merge.** Every service's gates were run against the merge candidate: backend 183/183, frontend 340/340, coursegen 505/505, audiogen 151/151, picturegen 49/49, email-server 18/18; type-check + lint + build green in all six; root `docs:check`, `secrets:check`, `i18n:check` and the migration gate green.
- **Merge blocker found and fixed — frontend CI was red.** `RunTimeline.tsx:68` read `data.snapshots.length` on an envelope whose `snapshots` key was absent. Every assertion passed but vitest exited 1 on 2 uncaught render errors, which would have blocked `frontend CD` entirely (it triggers only on `workflow_run.conclusion == 'success'`) — the Vercel deploy would never have run. Fixed at the source (`!data?.snapshots?.length`, since the page has no error boundary above it and would white-screen) and in the test mock.
- **Realtime was authorized but silent — migration 0022.** `0019` created the `staff_select_live` RLS policy that lets an admin subscribe, but no migration ever added `generation_runs_live` to the `supabase_realtime` publication. Verified on the production Vault: the publication existed with **zero tables**, so the Live Monitor would have connected, authorized, and received nothing forever. `0022_realtime_publication.sql` adds the table (guarded — `ALTER PUBLICATION ... ADD TABLE` has no `IF NOT EXISTS` and errors 42710 on re-run) and sets `REPLICA IDENTITY FULL`, required because the subscription listens for `event: '*'` including DELETE and because Realtime evaluates the RLS policy against the replicated row.
- **§1.6 envelope violation fixed in Courier.** `GET /api/v1/logs` used bare `z.parse()` on query params: `?limit=abc`, `?limit=999` and `?offset=-1` each returned **500 text/html with a stack trace** instead of a 400 envelope. Now `safeParse` + a 4-arg error handler so every response — including malformed JSON bodies and failed `adapter.send()` rejections — stays in the envelope. Covered by a new `logs.test.ts` (8 tests).
- **Production infrastructure wired:** `picturegen` (Prism) Railway service created with 17 variables — it did not exist, and `picturegen-cd.yml` would have gone red on merge. `EMAIL_SERVER_URL=http://email-server.railway.internal:4005` set on Core (its two new admin email routes were pointed at `localhost:4005` by default and would have 502'd forever). `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` added to Vercel Production **as Non-sensitive** — the CLI defaults new variables to Sensitive, which is exactly the 2026-07-17 incident that baked the literal `[SENSITIVE]` into the bundle.
- **Deploy ordering is load-bearing:** migrations 0012–0022 were applied to the production Vault BEFORE the merge. The reverse order is never safe and fails *silently* — `supabaseRest.ts` returns `null` on any non-2xx, so a missing table renders 0 XP / 0 streak / an empty lesson tree rather than an error anyone would notice.

## Current State (2026-07-28) — Admin dashboard hardening + email tracking + cybersecurity audit

- **Admin Content+Moderation merged** (`/admin/content`): courses table + lesson review queue in a single unified view. Deleted `AdminModerationPage.tsx`. Removed `moderation` from admin nav (7 sections now → 8 with new Emails section). Overview page "awaiting review" CTA now points to `/admin/content`.
- **Admin Users stats bar:** 3-card grid above the table — role distribution (top-role-first, stacked bar), locale distribution (per-locale colored bars: en-US=blue, es-MX=papaya, pt-BR=green), age groups (histogram from `profiles.birth_date`: <6, 6-8, 9-10, 11-12, 13-17, 18+).
- **Signup timeline chart:** SVG bar chart with period selector (30d/90d/1y) at `/admin/users`. Backend `GET /admin/users/timeline?days=N` (Zod-validated 7-365). Groups `profiles.created_at` by day, fills zero-count days.
- **Tutor upgrade hidden for staff:** `AppLayout.tsx` sidebar card now checks `!isStaff` so admin/superadmin never see "Verify your identity to become a Tutor".
- **React Router v7 future flags:** `BrowserRouter` in `main.tsx` now carries `v7_startTransition: true` + `v7_relativeSplatPath: true` — silenced the console deprecation warnings in dev.
- **New migration 0021 `email_logs`:** idempotent DDL, RLS enabled with zero client policies (service-role-only, same posture as 0017/0018). Columns: id, message_id, to_address, subject, template_type, locale, user_id, status, detail (jsonb), created_at. Indexes on created_at, status, to_address.
- **email-server email tracking:** New `src/services/emailLog.ts` — ring buffer of 1000 entries logged on every `POST /api/v1/send`. New endpoints `GET /api/v1/logs?limit=&offset=` and `GET /api/v1/logs/summary` (Zod-validated query params, authenticated via `INTERNAL_API_KEY` middleware now scoped to `/api/v1/*`). `SendBody` schema extended with `templateType`, `locale`, `userId` optional fields.
- **Backend email proxy:** `GET /admin/emails/logs` and `GET /admin/emails/summary` proxy email-server through Core (never direct browser access per §1.5). Zod-validated query params (`EmailLogsQuerySchema`), response shapes (`EmailLogsSchema`, `EmailSummarySchema`), `AbortSignal.timeout(10_000)` on fetch. New env var `EMAIL_SERVER_URL` (default `http://localhost:4005`).
- **Admin Email Dashboard** (`/admin/emails`): KPI cards (total sent + status breakdown: queued/delivered/failed), paginated table (to, subject, type badge, status badge, sent-at), prev/next navigation. 3-locale i18n. New admin nav entry with `mail` icon.
- **Cybersecurity audit — 6 vulnerabilities fixed:**
  1. CRITICAL: `/admin/emails/logs` — unvalidated `limit`/`offset` query params → Zod `EmailLogsQuerySchema`
  2. CRITICAL: email-server `/api/v1/logs` — same → Zod `.parse()` on query params
  3. CRITICAL: `/admin/emails/*` — blind proxy (passthrough without response validation) → `EmailLogsSchema`/`EmailSummarySchema` validate email-server response shape before `ok()`
  4. HIGH: `/admin/emails/*` — no fetch timeout → `AbortSignal.timeout(10_000)`
  5. HIGH: `/admin/users/timeline` — unvalidated `days` param → Zod `TimelineQuerySchema` (min 7, max 365)
  6. HIGH: `/admin/generation/{analytics,coach}` — unvalidated `course`/`track` → Zod `CoachQuerySchema` with regex
  7. (Bug fix, non-security): `SignupTimeline.tsx` — dead `loading && 'opacity-0'` className (always false behind ternary gate) → removed
  8. (Bug fix, non-security): `AdminUsersPage.tsx` — phantom i18n key `admin.users.ageRange` (didn't exist in any locale) → replaced with simple `{k}: {nf.format(v)}`
- **i18n:** `admin.content.coursesHeading`, `admin.moderation.heading`, `admin.emails.*` (14 keys), `admin.users.timeline*` (4 keys), `admin.users.stats*` (4 keys) — all 3 locales in sync. `admin.nav.moderation` removed; `admin.nav.emails` added.
- **Gates:** type-check, lint, tests (frontend 340/340, backend 183/183, email-server 10/10), i18n parity, docs:check — all green.

## Current State (2026-07-27f) — i18n fix + PipelineFlow particles + mobile optimization (Phase 6b)

- **i18n audit & fix (35 issues resolved):** Hardcoded Spanish cycles ("1 ciclo:", "2 ciclos:", "3+ ciclos:") → `coach.cycle1/2/3` keys. Hardcoded English "Realtime connection lost" → `live.connectionLost`. Raw `failedFrom` stage values ("written", "reviewed"…) → `failedFromLabels.*` i18n keys. Em dashes `'—'` → `noData` key. `toFixed()` → locale-aware `formatPct()`/`formatFixed()`. "s" seconds suffix → `secondsUnit` key. New shared module `generationI18n.ts` with `failedFromI18nKey()`, `formatPct()`, `formatFixed()`.
- **PipelineFlow slot particles:** Edges now show slot count labels with accent-colored arrow markers when slots are flowing — stage nodes connect through visible, labeled edges with animated dashed flow. Active edges are papaya-colored, inactive edges are outline-gray. Node size auto-adjusts on mobile via inline CSS media query.
- **Mobile optimization:** canvas height reduced on mobile (220px vs 280px), node sizes shrink via CSS media query, `fitView` handles zoom. Tab labels hidden on mobile (icon-only).
- **New i18n keys:** `noData`, `secondsUnit`, `connectionLost`, `failedFromLabels.*`, `coach.cycle1/2/3`, `coach.minLabel`.
- **Gates:** type-check, lint, tests (13/13), i18n parity — all green.

## Current State (2026-07-27e) — Analytics + alertas: forecast, success rate, anomaly detection (Phase 6)

- **AlertBanner:** top-of-page warning cards on all tabs. Live alerts: estimated cost overrun, cache-hit below 20%, failure rate >30%. Historical alerts: quality dimension drops >0.8 between runs, cost spike >2× baseline. Color-coded by severity (critical=red, warning=yellow) with detail text and badge.
- **Enhanced analytics:** stage success rate card (overall published/failed ratio), cost forecast card (per-lesson avg × 500 lesson course estimate, based on actual published count). Backend: `getGenerationAnalytics` now returns `stageSuccessRate` + `costForecast`.
- **Analytics tab** now includes `AlertBanner` for historical anomaly detection between runs.
- **5 i18n keys added** per locale (`successRate*`, `forecast*`, `alerts.*`).
- **Gates:** type-check, lint, tests (13/13 gen page), i18n parity, docs sync, secrets check — all green.

## Current State (2026-07-27d) — Supabase Realtime: true push-based live monitoring (Phase 5)

- **RLS migration (0019):** SELECT policy on `generation_runs_live` for admin/superadmin — the ONLY client-accessible policy on generation telemetry tables. Enables Supabase Realtime (Postgres CDC via logical replication) so the browser subscribes to live row changes instead of polling.
- **Supabase Realtime client (`lib/supabaseRealtime.ts`):** thin wrapper creating a Supabase client from `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`. Only used for the admin generation dashboard; every other Vault interaction stays through Core (service role).
- **LiveStats rewritten:** replaced 2s polling with a Supabase Realtime channel subscription on `generation_runs_live`. INSERT/UPDATE events → heartbeat updates; DELETE → clear (run finished). Fallback to idle when Supabase is not configured (dev without env vars). Stale-timer clears after 2 min of no updates. Status indicator shows "Live (Realtime)" when connected.
- **PipelineFlow unchanged:** already receives heartbeat via prop, so it updates instantly when Realtime fires.
- **Env:** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` added to `.env.example`. New dep: `@supabase/supabase-js`.
- **Gates:** 19 migrations (sequential + RLS) · type-check ✅ · lint ✅ · i18n ✅ · docs ✅ · secrets ✅. Frontend gen page tests: 13/13.

## Current State (2026-07-27c) — Coach dashboard: forge:coach improvement loop surfaced in admin (Phase 4)

- **Coach endpoint (`GET /admin/generation/coach`):** Core aggregates data from `generation_runs` + `generation_slots` across up to 20 runs to produce a deterministic, free, proposal-only diagnosis. Computes: outcomes (published/failed/other), failure heatmap by stage, top recurring error patterns, judge dimension means/mins with cycles histogram and early-stop count, worst lessons (low kid_safety/age_fit), cost per published lesson, cache efficiency, image reuse rate, and evidence-backed proposed actions (low cache-hit → prefix drift; low judge dimension → playbook section; high cost → inheritance check; top failure stage → targeted pipeline fix).
- **CoachTab frontend:** 4th tab in `/admin/generation`. Renders the diagnosis in structured cards: outcomes KPI row, failure heatmap + top errors side-by-side, judge quality panel (dimension progress bars with mean/min + cycles histogram pills), worst lessons list, cost breakdown with image reuse stat, and proposed actions with tag badges and evidence quotes.
- **All 4 tabs live:** Live Monitor (PipelineFlow + LiveStats) · Run History · Analytics · Coach. 13 frontend tests for generation page.
- **Gates:** type-check ✅ · lint ✅ · i18n:check ✅ · docs:check ✅ · secrets:check ✅. Frontend 339 tests (including 13 gen page tests), backend 183 tests, coursegen 505 tests.

## Current State (2026-07-27b) — Admin Generation Dashboard v2: live flow canvas + cross-run analytics (Phase 2)

- **React Flow interactive canvas (`PipelineFlow.tsx`):** 7-stage Forge pipeline shown as connected nodes on a zoomable React Flow canvas. Nodes color dynamically from live heartbeat data: gray (idle), papaya pulse (active slots), green (terminal). Edges animate when slots are flowing. Built with `@xyflow/react` (new dependency).
- **Live stats panel (`LiveStats.tsx`):** polls `GET /api/v1/admin/generation/live` every 2s, renders overall progress bar, per-stage breakdown pills (colored by activity), 5 KPI cards, and cost ledger. Auto-stops polling when no active runs exist. Stale heartbeat detection (>2 min).
- **Cross-run analytics (`AnalyticsCharts.tsx`):** fetches `GET /api/v1/admin/generation/analytics` — displays cost per published lesson trend (TrendChart), cache-hit % over time, latest-run quality dimensions (ProgressBar grid), failure breakdown by stage (ProgressBar grid), and platform averages.
- **Three-tab layout:** Live Monitor (PipelineFlow + LiveStats), Run History (preserved v1 inspector with track cards + run selector + per-slot detail), Analytics (AnalyticsCharts). Tab bar with live indicator dot when a run is active.
- **i18n:** all new keys added across en-US, es-MX, pt-BR. `npm run i18n:check` parity verified.
- **Gates:** type-check, lint, build all green. 327 frontend tests pass. 505 coursegen tests pass.

## Current State (2026-07-27) — Generation live monitoring: heartbeat telemetry + cross-run analytics (Phase 1)

- **Live telemetry (Vault 0018):** `generation_runs_live` table + `liveTelemetry.ts` module in coursegen. On every slot stage transition during an active run, a heartbeat row is upserted with active/completed/failed counts, per-stage breakdown, cost ledger totals, and image counts. `LiveTelemetry` class is instantiated once per `runGeneration()` and called by `processSlot` after each `store.save`. Row is deleted at run end; stale rows (>2 min) are filtered out by Core.
- **Core endpoints:** `GET /api/v1/admin/generation/live` (polls `generation_runs_live` for near-real-time dashboard) + `GET /api/v1/admin/generation/analytics?course=...` (cross-run trends: cost per published lesson, judge dimension means over time, cache-hit %, failure patterns by stage/locale, platform averages).
- **coursegen integration:** `processSlot` now accepts an optional `LiveTelemetry` parameter; 7 `onTransition` calls were added after each stage's `store.save` (planned → written → reviewed → localized → illustrated → published), plus `addImages` after illustration stages and `setCost/flush` after each pool worker completes. Swallow-on-failure by design — live telemetry can never kill a run.
- **Next (Phase 2):** React Flow canvas + live stats panel in the admin dashboard frontend; cross-run analytics charts.

## Current State (2026-07-24b) — Render-truth pass: no people in images, local currency, fixed pattern/robot/type_answer

- **Owner reviewed the RENDERED player (a screenshot), not JSON, and caught what the JSON-judges missed.** Fixes, each verified in the player via the new `/dev/lesson-view` (loads real DB docs into the production `LessonPlayer`):
  - **No people in generated images.** Dina/Liruf/Rho/Zara are the app's own NON-HUMAN characters (Liruf has a tail), drawn by the character rig — so Prism now forbids any person/human/face/hands/character: identity brief + judge hard-rule + `BASE_NEGATIVE`, and the pictorial verifier now flags a depicted PERSON too (verdict `defect` = text OR person). `STYLE_VERSION` v3→v4 invalidated every human image; all regenerated as objects+setting scenes.
  - **Local currency.** en-US renders "$"/"20-dollar bill", pt-BR reais — `localize` translator instruction + a deterministic `currency`/`unit` ENUM remap (the enum was in NON_VISIBLE_KEYS so it stayed MXN → Intl formatted pesos everywhere). NB: a blanket peso-word scrub was rejected — "pesos"=weights in balance_scale.
  - **pattern_complete** was unsolvable (a SIZE/PRICE ladder drawn as identical icon+tint tiles, answer keyed to the wrong slot). Gate 8 now: 0-based slot-index keys, sequence must vary by icon/tint, and a period-detection check that the ANSWER continues the visible pattern. **robot_path** solvability gate (simulate the payload commands). **type_answer** must be applied-arithmetic, not word-recall.
  - **answerable-from-screen** gate refined twice: a load-bearing price stated only in a hint fails — counting only prompt_md + STRUCTURAL numeric payload values (a distractor token string "5" no longer masks a hidden price).
- **Re-review trend (Fable judges, 3 rounds):** overall ok 4 → 23 → **30/62**; clarity 3.1 → 3.92 → **4.24**; child_fit 2.95 → 3.79 → **4.26**; visual_first 2.03 → 3.61 → **3.77**; blockers 16 → 13 → **6** (residual: a few fact-in-hint + compare_table/debug_hunt mechanical, being closed). interest_peek remains its prior version (owner-confirmed hold-out — compound interest is tier3, mismatched to a tier2 course).

## Current State (2026-07-24) — Visual-first overhaul: AI images across every exercise type + terse prompts

- **Owner 1x1 review verdict (Fable-judge workflow over the 62 GENERATED lessons, not dev fixtures):** the course was pedagogically planned but IMPLEMENTED wrong for young kids — `visual_first` scored **2.03/5**, with 55 Material-icon fields vs only 3 AI images across 70 segments, and 56/70 exercise prompts over 140 chars (text walls). 57/62 lessons "needs_work". Dev-lab fixtures (hand-written) are NOT the generated content — the review must read the DB documents.
- **Engine:** every concrete-object item type now carries optional `image_url` (a real Prism illustration) + a universal segment-level `image_url` "scene anchor"; text-only item arrays became `idVisual`. New shared `VisualMark` primitive renders the AI image, falling back to the Material icon, then text — the single home of the image-preferred rule. A 40px glyph is not recognizable to a 6-year-old; the illustration is.
- **coursegen:** `illustrateSegments` rewritten to a per-type illustration PLAN covering every image slot (+ scene anchors); **Gate 8** (prompt ≤160/≤3 sentences, no fake question in non-graded types, no answer-leak); visual-first + text-discipline + positive-stakes playbook; deterministic repairs (interest_peek choice, savings_goal key drop); `standalone` course flag + type-appropriate judge floors (low-decision concreteness/engagement, standalone age_fit) so a type-coverage harness stops false-failing otherwise-excellent lessons. KEYLESS graded types extended to every self-contained grader (coin_count/make_change/budget_fit/balance_scale/robot_path).
- **Prism strengthening:** per-purpose art direction (item_card / option_card visually-parallel-to-siblings / scene_anchor / outcome) + a child-legibility rule (draw the literal object, never a symbolic stand-in).
- **Result — regenerated Testing course:** segments-with-AI-image **3 → 44 / 70**, prompts>140 chars **56 → 1**. **61/62 lessons regenerated to the (stricter) quality bar; interest_peek is the one hold-out** — its schema mandates percentage-compound interest (a tier3 concept) and the judge correctly rejects it as developmentally inappropriate for the kids' band on cognitive_engagement/distractor_quality; forcing it would mean gutting the quality gate. It keeps its prior (functional) version pending a tier/schema decision.
- Verified: needs-wants lemon/ice/popsicle/comic and the price-compare lemonade-stand render as clean, text-free, on-palette illustrations (the pictorial verifier keeps signs blank).

## Current State (2026-07-23) — Lesson Engine + Forge closed at 100%; Prism (picturegen/) born

- Testing course (`first-lemonade-stand`): **62/62 published under the strict content-playbook judge, 186/186 documents contract-valid, 0 gradable segments without keys, fully narrated (846 units)** — fixture re-exported (`db:import-course`-able by any dev).
- Forge convergence hardening for mass generation: `FORGE_SLOT_ATTEMPTS` outer regen-from-scratch retries, `stripNullValues` (+ SEMANTIC_NULL_KEYS), `repairDocument` (balance_scale, interest_peek), icon whitelist in-prompt, graded-answer-key gate, judge calibrations (fluency drills + content-only story lessons).
- **DECISION — Prism (`picturegen/`, port 4007), owner-directed:** the ONLY image-generation service (mirror of Echo for audio). Art-director judge (Qwen chat) turns a label+context into a detailed prompt carrying the LF illustration identity; generation = official Qwen `qwen-image` on DashScope (verified live); assets stored in Depot; `picture_assets` cache in Vault (migration 0014) so an identical request NEVER hits the paid API twice ("optimizar consumo"). **Gemini image gen DISCARDED** — every Google image model returned quota-0 on the available key. Forge now calls Prism over HTTP (`PICTUREGEN_URL`, internal key); `providers/gemini.ts` deleted. Hardened same-day after live inspection: cache keyed on the REQUEST descriptor computed BEFORE the judge (prompt-keyed cache never hit — the judge is nondeterministic), and a **pictorial verifier** (qwen-vl vision model reads the actual pixels; readable text/numerals → regenerate from a fresh judge prompt, ≤3 attempts, exhaustion = `IMAGE_VERIFICATION_FAILED` + nothing cached) because qwen-image's text bias survived every prompt-level defense — the no-text guarantee is now mechanical, not stylistic.
- **DECISION — ElevenLabs is SOUND-EFFECTS-ONLY** (TTS stays Qwen3-TTS): kid-friendly player SFX to be generated ONCE and committed as static assets — **this has not happened yet**; no ElevenLabs asset is committed and the shipped set is still the rescued v1 one in `frontend/public/sounds/` — zero runtime generation calls, exactly the consumption-discipline rule Prism enforces for images.


## Current State (2026-07-22) — Analytics deepened + GA4 dual-tracking + sidebar scroll + Pulse cost trim

**Verified analytics transport was live end-to-end (Task: "analytics working 100%").** Confirmed in prod, not assumed: the Plausible tracker fires (`/api/event` → 202) and Umami fires (`/api/send` → 200); the earlier no-auto-pageview scare was a measurement artifact — the automated tab loads `hidden`, and Plausible *correctly* defers the initial pageview until visible (the per-site `pa-<id>.js` self-inits with `autoCapturePageviews` via `plausible.o`). Core holds every Pulse key (`PLAUSIBLE_URL/API_KEY/SITE_ID`, `UMAMI_URL/USERNAME/PASSWORD/WEBSITE_ID`, `KUMA_URL/STATUS_SLUG`). **Scope correction, 2026-08-13:** the earlier tracker policy was too broad; public-acquisition capture is now restricted before collection as recorded in the latest Current State.

**Admin analytics deepened (the "muchos campos no aprovechados" ask).** Core gained Plausible Stats API v2 **breakdowns** (top pages/sources/channels/countries/devices/browsers/os/entry+exit/UTM campaigns), an audience-shaped `/analytics/report` aggregator, a **branded, watermarked PDF export** (`/analytics/report.pdf`, pdfkit — papaya/navy, per team: Marketing/Sales/Frontend/Full; raw-PDF is a documented envelope exception like Depot's file route), and **display filters** on overview+breakdown. Frontend `AnalyticsHealthPage` was rebuilt into a dense, filter-aware surface (KPIs+trend, 10 breakdown cards with row-click-to-filter, PDF export card, health). **Retraction, 2026-08-13:** the former `/analytics/exclusions` and its Excluded-IPs card were removed because the claimed Plausible CE `IP_BLOCKLIST` enforcement was not documented or verified. Tracker scope is now the actual enforced exclusion boundary.

**GA4 dual-tracking re-added — PUBLIC PAGES ONLY (§1.9).** Google Analytics (`G-0XH7S80QG2`, property littlefounders.ai / stream 13256321210) runs alongside Plausible but scoped to the NARROWEST surface: marketing/public paths only, never app or kid sessions. Unlike cookieless Plausible/Umami, GA4 uses cookies, so `analytics.tsx` fires `page_view` manually (`send_page_view:false`) and re-asserts a hard `ga-disable-<id>` kill-switch on every route change — GA4 can't observe an app/kid path even if its script stays resident across an SPA nav. `VITE_GA4_MEASUREMENT_ID` (public, Production-only) set in Vercel. **Cookie-consent follow-up (Consent Mode banner for EU/UK) is the correct next step — not yet built.**

**Sidebar scrolls now.** The desktop sidebar `<nav>` became `flex-1 min-h-0 overflow-y-auto`; brand + profile block stay pinned, so the Staff group's 7 sections no longer push the profile card off the bottom of the viewport.

**Railway cost trimmed conservatively (owner chose "limit resources", not "consolidate").** The bill is ~95% memory; the Pulse stack (5 always-on services, cannot scale-to-zero) pushed the estimate ~$12 → ~$28.81. Measured per-service RSS: **pulse-clickhouse ~850 MB** (biggest, climbing toward its cap), pulse-plausible ~500 MB (BEAM). Trimmed ClickHouse ceilings (`max_server_memory_usage` 1.5G→1G, `mark_cache_size` 500M→256M, +512M per-query cap) — safe, our event volume is tiny. Node heap caps on Umami/Kuma **deliberately skipped** (measured low; a cap saves nothing + adds OOM risk — same conclusion as the 2026-07-17 Core finding). The larger lever (pausing Umami pre-launch) is the aggressive route the owner deferred. Full detail: RUNBOOK.md § Railway cost.

**GA4 historical import — DONE (2026-07-22, owner present for credential steps).** Created a dedicated GCP OAuth client "Pulse Plausible (GA4 import)" in `littlefounders-auth` (redirect `…/auth/google/callback`), enabled the Analytics Admin + Google Analytics APIs (Data API already on), set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` on `pulse-plausible` (owner pasted the secret), and ran the import: **GA4 property 514526552 → Jan 6–Jul 18 2026, ~5k pageviews / 1.6k visitors**, auto-bounded by Plausible to *before* its own native data (activated ~Jul 20) — exactly the pre-Plausible history requested. Verified live in Plausible's 12-mo dashboard. The two hard blockers were both human-only and handled by the owner in-session: GCP console password re-auth (org policy) and the OAuth consent grant; the agent set only the non-secret Client ID.

**Owner-facing note (open, NOT session tasks):** Vercel shows a **payment-overdue / "Action Required"** banner — deploys still work (grace period) but must be resolved to avoid a shutdown; and the daily **Pulse backup** workflow failed on 2026-07-21 (worth checking).

## Current State (2026-07-21) — Admin console rebuilt: full, integrated into the app shell

**Correcting a real miss.** The first console shipped only the Analytics & Health panel as a separate back-office and deferred every other approved panel — the owner had explicitly approved a full console (Content, Users/Support, Moderation, Audit for admin; + Roles & Access for superadmin) and wanted it INTEGRATED into the app dashboard, dense, with admin/superadmin clearly differentiated. Rebuilt to that spec:

- **Integrated, not a back-office.** Killed `ConsoleLayout`; admin routes render inside `AppLayout` (same sidebar/top-bar/bottom-tabs as Learn/Profile). Sidebar grows a "Staff" group (`routes/admin/adminNav.ts` registry); mobile gets a `shield_person` top-bar button + a horizontal section sub-nav on each admin page (§1.11 verified at 375 + 1280). Hidden (not locked) for non-staff.
- **All panels, real data.** New Core `/api/v1/admin/*`: `/overview` (dense counts), `/users`, `/content` (+ publish/unpublish/archive), `/moderation` (lesson `review` gate + approve/reject — §1.9), `/audit`, `/roles` (+ grant/revoke, **superadmin-only**). Service-role reads via `services/adminData.ts` behind `requireRole` (RLS grants admins nothing, §1.3 app-layer gate). Role mutations lean on the DB triggers as the real guardrail (ROLE_REJECTED surfaced). Every page uses a shared `AdminPage` shell with an always-visible **role chip** (admin=primary, superadmin=accent). 138 backend + 246 frontend tests green.
- **Verified in-browser** as admin and superadmin: Overview (6 users, real role distribution, 11 audit), Users/Audit/Roles tables, admin vs superadmin gating (Roles section only for superadmin), dark+light, mobile.

## Current State (2026-07-20) — Pulse (analytics + system health) + admin console groundwork

**New §1.5 domain: `pulse/` (codename Pulse)** — human-signed-off change to the LOCKED §1.2 stack and §1.5 service map (owner authorization in-session, 2026-07-20). Pulse is a *pinned third-party stack* (Vault pattern), not a TS service: **Plausible CE v3.2.1** (web analytics — cookieless/no-PII, ClickHouse + Postgres, Stats API v2, GA4 import), **Umami v3.2.0** (behavioral analytics — funnels/heatmaps/session replay, MIT, single-Postgres), and **Uptime Kuma 2.4.0** (continuous `/health` uptime + latency + alerting — fills the gap left by Railway's deploy-gate-only healthchecks). Five Railway services (`pulse-plausible`, `pulse-clickhouse`, `pulse-db`, `pulse-umami`, `pulse-kuma`) over IPv6 private networking; data reads reach the browser only through Core `/api/v1/admin/*`. Version pins live in the Dockerfile `FROM` lines; **Dependabot** watches them daily and patch bumps automerge after `pulse CI` (minor/major stay human-reviewed — upstream majors have carried data migrations). Research basis: 28 load-bearing claims adversarially verified against primary sources (25 confirmed) before adoption; v3.2.1 is the Plausible security floor (CVE-2026-8467 `/storybook` RCE removed) and the ghcr.io registry is mandatory (Docker Hub frozen at v2.1.4).

**§1.9 tracking boundary (non-negotiable):** Plausible may see every surface (it stores no PII by construction). Umami — including its rrweb replay/heatmap recorder — mounts ONLY on marketing + parent/admin surfaces and NEVER on kid-role sessions; enforcement lives in the frontend gate. Full rationale + the admin/superadmin console scope (admin = content/support; superadmin = + roles & access) recorded this session; GA4 historical import is the one remaining manual step (bring-your-own GCP OAuth app — runbook in pulse/README.md).

**Deployed to production same session (2026-07-21 UTC):** all five Pulse services live on Railway (Plausible `/api/health` all-ok after three real fixes worth remembering: `PGDATA` must point below the volume mount, `RAILWAY_RUN_UID=0` + a seed-volume entrypoint restore compose's copy-up semantics for the CE image's `/var/lib/plausible` data, and `PORT` must mirror `HTTP_PORT` so Railway's healthcheck probes the right port; a borrowed `max_concurrent_queries=4` ClickHouse cap caused a connection storm and was removed — CE's own tuning only). Core deployed with `/api/v1/admin/*` (backend CD) and the console shipped (frontend CD). First **superadmin** granted in prod to jesusv@littlefounders.ai via service-role insert (domain trigger enforced, audit-logged). The no-floating-tags CI gate caught CE's own patch-floating `postgres:16-alpine` on its first run (now pinned 16.14-alpine), and Dependabot opened clickhouse/postgres MAJOR bumps within a minute of the push — closed with rationale and ignored going forward (they move only with the Plausible pin). Console verified per §1.11: desktop 1280 dark+light via screenshots; mobile 375 via DOM assertions (the preview pane's mobile screenshot pipeline served stale frames — live DOM was authoritative). Remaining first-boot HUMAN steps (passwords/API keys — deliberately not agent-performed): Plausible admin + site + Stats API key, Umami admin password + website + Core creds, Kuma admin + 9 monitors + `pulse` status page, Vercel `VITE_*` tracker vars, then GA4 import.

## Current State (2026-07-20) — Login/signup are a bare trust surface

**`/login` and `/signup` no longer render inside `MarketingLayout`.** They were nested under the marketing shell, so every visit carried the full marketing nav (logo, How it works/Families/FAQ, language dropdown, theme toggle, CTA) and the navy footer band — noise on a page whose whole job is one focused task. DESIGN.md's Auth recipe already specified "trust surface: focused single centered column... ONE resting card" with no chrome; the routing just didn't match it. New `frontend/src/routes/auth/AuthLayout.tsx` gives `/login`/`/signup` a bare `min-h-screen` wrapper (background + the same scroll-reset/page-enter motion every top-level route gets) with no nav or footer — `AuthShell` (unchanged) still renders the title/subtitle + card exactly as before, now with nothing else on the page.

**Fixed a real bug this surfaced: theme only worked if `ThemeToggle` happened to be mounted.** `useTheme()` was a plain hook — each mounted `ThemeToggle` held its own independent `choice`/`isDark` state, and the `dark` class on `<html>` was only ever applied inside that hook's own effect. Auth pages render no `ThemeToggle` by design (chrome-free), so stripping the marketing header would have silently broken dark mode there (system-dark or a stored 'dark' preference would never reach `<html>` on load). Converted `frontend/src/theme/useTheme.tsx` (renamed from `.ts` — now contains JSX) to a `ThemeProvider` context mounted once at `App()`'s root, so theme applies on first paint regardless of route; `ThemeToggle` is now a consumer of the same shared state, not an independent instance. Verified live: `/login` with `lf-theme=dark` in localStorage (or system dark, via `auto`) correctly gets `<html class="dark">` with zero toggle UI on the page. 3 new tests (`AuthLayout.test.tsx`); 244 frontend tests green; verified in-browser at ~375px and ~1280px, light + dark.

## Current State (2026-07-20) — Google account chooser + prod cleanup

**Google login now always shows the account chooser.** Without it, a browser holding a single existing Google session gets silently signed back in — a real problem for anyone with multiple Google accounts, who'd never get to pick. Verified live via the raw `location` redirect header (not assumed) that GoTrue forwards arbitrary extra query params on `/authorize` straight through to the provider's own OAuth URL: `GET .../authorize?provider=google&prompt=select_account` came back with `location: https://accounts.google.com/o/oauth2/v2/auth?...&prompt=select_account&...`. Core's `authorizeUrl()` now always adds it for Google via a small `PROVIDER_AUTHORIZE_PARAMS` map (`backend/src/services/gotrue.ts`), architected per-provider since the equivalent param differs across providers. New backend test asserts `prompt=select_account` on the built URL. 114 backend tests green.

**Production hygiene closed out.** Deleted the orphaned first Google OAuth client secret (`****n9h9`, created 2026-07-19, never copied/used — disabled then deleted per Google's own guidance, the live secret `****y-c-` untouched) and the two stale deploy-verification test users left over from the 2026-07-17 rollout (`cost-opt-verify-…`, `kong-cap-verify-…`) — verified zero orphaned `profiles` rows after.

## Current State (2026-07-20) — Google OAuth LIVE

**Google social login is live in production (2026-07-20).** OAuth client "LittleFounders v2 (GoTrue)" created in Google Cloud project `littlefounders-auth` (consent screen: External, In production; redirect URI `https://auth-b2c.littlefounders.ai/auth/v1/callback`); owner set `GOTRUE_EXTERNAL_GOOGLE_SECRET`, agent set `CLIENT_ID`/`ENABLED=true`; auth redeployed clean. **Verified E2E in production:** `/oauth/providers` → `["google"]`, the login button renders, and the full loop (Google → GoTrue → `/auth/callback` → session → dashboard) completed — OAuth user `provider=google`, display_name "Jesus V." from Google metadata (migration 0011 working), `universal` role, email auto-confirmed. Also this session: the trust-proxy fix + docs shipped through CD, and `EMAIL_SERVER_LIVE=true` was set — Courier's CD ran its first gated deploy successfully, so email-server now auto-deploys like every other app service. Operational gotchas recorded: Google client secrets are one-time-view (recover via "Add secret" on the client page), and a Railway CLI `variables --set` clobbers changes still staged in the dashboard — never mix the two mid-flight.

## Current State (2026-07-18) — email LIVE + Google OAuth ready + Resend retired

**Courier is deployed and delivering real auth mail in production.** email-server went live as the **17th Railway service** (project `littlefounders-b2c`, internal-only, always-warm): GoTrue → `email-server.railway.internal:587` (Haraka) → Amazon SES over TLS + SMTP AUTH, verified live (SES returns `250 Ok` with a message-id on real signups; the relay log shows `code=235` AUTH success to `email-smtp.us-east-1.amazonaws.com`). `GOTRUE_MAILER_AUTOCONFIRM` flipped to **`false`** — signups are now verified against real mailbox ownership. Amazon SES (us-east-1) has domain identity + Easy DKIM + custom MAIL FROM (`mail.littlefounders.ai`) + production access; DNS auth records live in Vercel's zone.

**Branded, trilingual auth email.** Five email-safe templates (confirmation / recovery / magic-link / invite / email-change) in the LittleFounders Arcade brand (navy/papaya/Figtree, bulletproof MSO CTA) live at `https://littlefounders.ai/email-templates/*.html` (`frontend/public/email-templates/`, served static by Vercel), wired via `GOTRUE_MAILER_TEMPLATES_*`/`SUBJECTS_*`. Each is **English by default with es-MX/pt-BR** branches selected by `{{ .Data.locale }}` (the user's registration locale, threaded through `user_metadata`); unknown locale → English. Doc: `frontend/public/email-templates/README.md`.

**Google social login is code-complete, pending only credentials.** Core brokers the GoTrue provider flow (`GET /api/v1/auth/oauth/providers` + `GET /api/v1/auth/oauth/:provider` → 302 to GoTrue `/authorize`, browser never leaves Core per §1.5); frontend has the 4-color Google button (auto-hidden while no provider is enabled), `/auth/callback` token-fragment handler, and `AuthContext.completeOAuth`. Migration **0011** teaches `handle_new_user()` to derive `display_name` from a provider's `full_name`/`name` (applied in prod). The redirect URI is pre-staged; the owner's last step is the Google Cloud OAuth client → `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true` + `CLIENT_ID` + `SECRET`.

**Resend fully retired + one security fix.** Resend is gone from the platform: code is clean (no live references), Railway env clean, and its 3 leftover DNS records (`resend._domainkey` TXT, `send` TXT/MX) were deleted from the Vercel zone — Courier authenticates under `mail.*`, so nothing broke. Security audit of the whole email/auth surface surfaced one real fix, now shipped: Core sets `trust proxy: 1` so express-rate-limit keys on the real client IP behind Railway's edge (was one shared bucket for all clients). Other findings were adversarially downgraded to documented tradeoffs (internal IP-trust relay hop) or flagged as owner-only (rotate the stale git-ignored Resend key in `.vercel/`).

## Current State (2026-07-18) — Courier engine built

**Courier (email-server) engine built — Haraka → Amazon SES relay (2026-07-18).** The transactional-email engine (open since 2026-07-11) is decided after a deep 6-candidate comparison (Postal/Stalwart/Maddy/Haraka/Plunk/Cuttlefish) against 5 criteria — stable versioning, active community, reviews, stack fit, deliverability: **Haraka** (MIT, semver ≥1.0, Node), run as a send-only outbound relay to **Amazon SES**. The honest driver: no self-hosted engine solves "not spam" alone (Railway blocks outbound port 25, no PTR control), so the correct architecture is self-host the control plane + rent SES's warm IP reputation. Built in `email-server/`: a supervisor (`src/index.ts`) runs the Haraka engine — private SMTP listener on `[::]:587` (for GoTrue) + `127.0.0.1:2525` (for the co-located HTTP API), `nodes=1`, custom `relay_internal` plugin grants private-IP relaying, `smtp_forward` forwards to SES over TLS+AUTH — alongside the Express `POST /api/v1/send` API whose `SmtpAdapter` (nodemailer) submits into Haraka. SES creds + the internal TLS cert are rendered at boot from env, never committed. Verified end-to-end locally: full path adapter → Haraka → TLS to **real** SES → SMTP AUTH, SES returned `550 Authentication Credentials Invalid` for placeholder creds (real creds = delivered). 10 tests green; type-check/lint/build clean. CD workflow added, gated by the `EMAIL_SERVER_LIVE` repo variable. **(Went live the same day — see the "email LIVE" entry above: deployed, GoTrue wired, `GOTRUE_MAILER_AUTOCONFIRM=false`, real mail flowing through SES.)**

## Current State (2026-07-17)

**Production deployment executed (2026-07-17):** `littlefounders_v2` squashed into one commit on `main` (branch kept intact; `main` is now the only branch that deploys). Live: `littlefounders.ai` (Vercel, frontend), `api-b2c.littlefounders.ai` (Railway, Core/backend), `auth-b2c.littlefounders.ai` (Railway, Vault/Kong gateway), `media-b2c.littlefounders.ai` (Railway, Depot/filebase) — one Railway project (`littlefounders-b2c`) holds all 16 services: the 9-service Vault stack (db, kong, auth, rest, realtime, storage, meta, supavisor, studio — imgproxy and edge-runtime intentionally not deployed, no app code uses them), Redis (new, for backend's production rate-limit store), and 6 app services (backend reuses the pre-existing Railway service; coursegen/audiogen/gamegen/parent-id-check are Railway-private-network-only, no public domain, per §1.5). Migrations 0001–0010 were applied during the rollout; 0011 followed in the OAuth update. CD is 7 GitHub Actions workflows (one per app-facing service + frontend), token-authenticated (`RAILWAY_TOKEN`/`VERCEL_TOKEN`), no native Git-App connection on either platform; all fired and succeeded on the first real push. Real signup verified end-to-end in a browser against the live stack. Postgres backups run daily (`.github/workflows/vault-backup.yml`, stored on filebase's volume since Railway's trial expired mid-rollout and blocked creating a dedicated one) and one restore drill was performed for real. Full narrative, the two real bugs found and fixed (Vercel Root Directory / `frontend/vercel.json` never read; `VITE_BACKEND_URL` accidentally marked Sensitive, baking a literal `"[SENSITIVE]"` into the build), and what's still open (domain/billing renewals — owner action; a dedicated backup volume once billing allows it): ROADMAP.md Day 8.

## Current State (2026-07-12)

v2 total reset executed on branch `littlefounders_v2`; v1 preserved on `main`. **The full scaffold is green:** all 8 services pass type-check/lint/test locally; frontend production build passes; `/health` envelopes verified on live processes; browser smoke passed. 8 per-service CI workflows in place. `DESIGN.md` is authoritative (**LittleFounders Arcade**) with tokens implemented and a reusable UI kit; i18n fragmented per route area. Agent rules hardened (§1.11 responsive invariant, §1.12 anti-hallucination).

**Vault is live locally:** the pinned `supabase/supabase@v1.26.07` self-hosted stack (11 containers, all healthy) runs from `database/supabase/` (gitignored clone; pin = `database/SUPABASE_VERSION`); migrations 0001–0004 applied and reset-from-zero verified; `types/database.ts` is real generated output (11 tables). Session pooler on host port **54322** (5432 is taken by a pre-existing local Postgres).

**Auth + Tutor verification shipped (2026-07-12, E2E-verified locally):** Core `/api/v1/auth/*` (GoTrue proxy, local HS256 JWT verify, CORS pinned to the SPA) and `/api/v1/verification/parent`; Guardian v1 = **stateless local OCR** (tesseract.js `spa+eng+por`, ID photo in-memory only, NEVER stored, verdicts only — Core owns all writes: isolated `parent_verifications` (0004), `parent` grant, audit); frontend `/login`, `/signup` (Tutor-intent checkbox; every signup starts `universal`), `/verify-parent` (privacy-first form, per-check retry guidance), AuthContext + RequireAuth, `auth.json` i18n ×3, new UI-kit form primitives (Field/Checkbox/FileField) codified in DESIGN.md with a new Auth screen recipe. Verified: 47 service tests green; real browser E2E (signup→OCR verify→Tutor badge) at ~375px AND ~1280px, light + dark; impostor E2E rejected without role grant; failed attempts audited with boolean checks only (zero PII). **Development stays local by decision — nothing deploys to Railway/Vercel yet.**

**App dashboard v1 live (2026-07-12):** role-scalable shell (navConfig registry → gamified 280px sidebar / mobile glass bottom tabs; locked-not-hidden role gating; Tutor-upgrade card), Learn home with published-course cards (`GET /api/v1/learn/courses`), AI Tutor/Games/Tasks placeholders (Tasks parent-gated). 6 real test users via `npm run db:seed:users` (password123; Testing Tutor↔Niño linked verified).

**Profile platform live (2026-07-12):** collapsible sidebar (288↔88px, favicon brand collapsed; language selector REMOVED from shell — locale is a DB setting), `/profile` (token-gradient covers ONLY — no upload path exists anywhere, avatar w/ edit indicator, gamified StatCards, share-to-invite "littlefounders.ai/@usuariox"), `/profile/avatar` (DiceBear Avataaars editor, local SVG render, options jsonb in `avatars`), `/profile/settings` (name, unique @username w/ USERNAME_TAKEN, locale-of-record → drives UI+content; email/password pending Courier), public `/@username` profiles (session-required, Core-whitelisted fields, Tutor badge) with follow/unfollow (`follows` table, RLS self-managed edges). Migration 0005.

**Social + gamified stats extended (2026-07-12):** migration `0006_social_and_stats` adds `profiles.birth_date` (any user, editable in Settings — distinct from Guardian's verified adult birth_date), `learning_stats` (xp/minutes/lessons/streak — one row per user via trigger, system-written only, zero until the lesson/game engines exist), and `blocks` (DB-enforced: `is_blocked()` blocks new `follows` rows either direction). Frontend: `/profile/followers` + `/profile/following` (own, unfollow-capable) and public `/@handle/followers` + `/@handle/following` (read-only) via one shared `UserListPage`; a "Block" action on public profiles with a two-step inline confirm (no modal) that removes any existing follow edge both ways and mutually 404s both profiles (never leaks who blocked whom); a "Blocked accounts" section in Settings with Unblock. Profile stat grid grew to 6 (streak/lessons/XP/minutes/followers/following) with followers/following now clickable. DESIGN.md gained a formal, NON-NEGOTIABLE **Grid Systems** subsection (§Layout) closing the 3 repeating-pattern categories (stat row 2/3/6, card grid 1/2/3, list rows single-column) — this is the concrete answer to "grids definidos para mobile & desktop". Core profile API: 47 tests green (11 new). Browser-verified end-to-end: follow→followers/following lists→unfollow→block(mutual 404 + auto-unfollow)→unblock, birth date save, both breakpoints, light+dark. Next: course consumption (lesson player) and kid-account creation from the Tutor dashboard. Local-only survivors on disk (gitignored): `.claude/`, `LEGAL/`, `.github/skills/`, `database/supabase/`, per-service `.env`.

**Lesson Engine v1 live (2026-07-12, spec `/LESSON_ENGINE.md`):** 56 segment types (51 graded + 5 story/content) across 8 families (`story, choice, input, arrange, money, analyze, storyplay, maker`) in `frontend/src/lesson-engine/` — each family owns schema.ts (Zod) / grade.ts (pure validators over shared scoring helpers: Kendall, footrule, Jaccard, signal detection, calibration, tolerance/falloff, allocation) / components / fixtures (es-MX) / register slice; the central registry composes slices and the composed `lessonDocumentSchema` (discriminated union of all 56) is the contract Forge will generate against. Fullscreen `LessonPlayer` (intro with cast → glass header with progress/hearts/streak/XP → one segment at a time with narrator strip → tier-tinted feedback banner with per-distractor rationale + character reaction → score-ring results): session reducer with cheer mode (hearts null, kid default — no fail state) vs arcade mode, compounding hint penalty, retries-only-improve, first-try streaks. **Character Control** (`components/characters/control/`): unified `CharacterActor` (7 emotions mapped to each character's native props, 12 one-shot actions via `lf-act-*` wrapper keyframes + `lf-rig-*` limb hooks added INSIDE the 4 SVGs — wrappers only, appearance untouched, RAF-owned head/pupils never rigged, reduced-motion safe) + a director rotating reactions per session event. Answer keys live in a separate `answer` block, `stripAnswers()` is the single stripper, grading is a pluggable `Grader` boundary — the in-browser grader is dev-only (`/dev/lesson-lab`, lazy + DEV-gated); production grading = Core, deferred to the content-schema session along with `learning_stats` XP writes. New i18n fragment `lesson.json` ×3; new dep (sign-off flagged): `zod` in frontend; `font-code` token + Lesson recipe expansion + motion recipe 7 added to DESIGN.md. Gates: 229 frontend tests green, type-check/lint/build clean, i18n/docs/secrets checks OK; browser-verified at ~375px AND ~1280px, light + dark (lab grid, story dialogue, quiz wrong→rationale→retry→perfect, coin_count MXN Intl flow, results). Fun facts for QA: `/dev/lesson-lab` plays every fixture + a full 56-segment showcase; batch-clicking via JS collapses React state updates (known gotcha) — tap sequentially.

**Course platform live end-to-end (2026-07-12, spec `/COURSE_ENGINE.md`):** Vault 0007 replaces the provisional 0002 content domain with the REAL hierarchy — `courses→adventures→sagas→topics→lessons→lesson_documents(document + answer_keys)` + `lesson_segment_attempts` + `lesson_progress`; `lesson_documents` deliberately has ZERO client RLS policies (row-level RLS can't hide the answer_keys column — Core reads with service role and serves stripped documents); reset-from-zero ×2 verified, types regenerated, demo slice seeded (financial-education → 1 adventure → 2 sagas → 4 topics → 8 lessons ×3 locales). Core owns the learn API (`/api/v1/learn/*`): course tree with the SINGLE unlock-rule implementation (global lesson order; current = first non-passed; adventures gate on the previous one fully passed), stripped lesson serving by profile locale, **server-authoritative grading** (graders are parity-checked COPIES of the frontend's pure validators — `npm run contract:check` in backend AND coursegen guard drift; attempt caps + reveal gating enforced server-side; client attempt numbers ignored), and `/complete` that recomputes score/XP from recorded attempts and feeds `lesson_progress` + `learning_stats` (streak via updated_at proxy, documented limitation). Frontend: adventure-map course viewer (`/learn/:courseSlug`) with the 6 v1 world scenes ported as a data-driven, dark-aware, reduced-motion-safe scene registry (illustration-asset exemption like the characters), per-lesson wavy path nodes with server states, auto-scroll to current + floating "Ir a mi lección" pill; `/learn/lesson/:id` plays real lessons fullscreen through `coreGrader` (409 → terminal verdict). **New service `filebase/` (Depot, 4006)**: content-addressed media storage on a Railway volume (sha256 dedup, Range/ETag/immutable streaming, public reads for PII-free media, `x-internal-api-key` writes) + CI workflow. **Echo implemented** (TTS decision RESOLVED: qwen3-tts-flash via DashScope): narratable-unit extraction from LessonDocuments, WAV→mono-MP3 (`@breezystack/lamejs`), Depot upload, idempotent audio manifest patched into lesson_documents; batch narration is operator-opt-in. **Forge implemented, NOT executed** (paid runs are operator-triggered): catalog loader/validator, DeepSeek author (plan→write with deterministic plan-repair, corrective retries, per-segment salvage), 5 deterministic gates (contract Zod, Piaget forbidden-vocabulary per tier×locale, fact gate, arithmetic RE-EXECUTION of money answer keys, rationale/canon), independent Qwen judge with revise loop, structure-frozen localization es-MX→en-US/pt-BR, Gemini (nanobanana) image module with flood-fill background removal → Depot, publish-as-`review` (human publishes — blocking kid-safety gate), file checkpoint/resume, token/USD kill-switches, JSONL cost ledger. **Educación Financiera catalog complete: 768 blueprints** (8 adventures ×4 sagas ×6 topics ×4 lessons; tier1/tier2 vocabulary gates self-scanned clean; 32 fact anchors; `catalog:check` 0 errors). E2E browser-verified on the real stack: login → map (2/8 after playing) → lesson → Core verdicts (rationale on wrong, reveal gating) → complete (+40 XP, streak) → next lesson unlocked; ~375px AND ~1280px, light + dark. Tests: frontend 241, backend 99, coursegen 115, audiogen 45, filebase 24 (= 524) — all green; per-service dev scripts now load `.env` (`tsx watch --env-file-if-exists`). API keys (DeepSeek/Qwen) live ONLY in gitignored `.env` files.

## Decision Log

| Date | Decision | Why |
|---|---|---|
| 2026-08-21 | **Two HUD layout systems that cannot see each other get ONE shared registry of what space is taken, not tuned constants.** `SafeAreaContext` now publishes `chromeRef` — every viewport-anchored surface including the way out — as a SUPERSET of the three rects the camera composes around. World-anchored chrome answers being covered in exactly two ways: a `WorldChip` hides, and the speech caption MOVES, by the shortest displacement that clears and stays in frame (`tutor-scene/hudSpace.ts`). Recorded in /DESIGN.md → Screen Recipes → Tutor. | Three collisions shipped at once and every gate was green: at 375 px the greeting caption (54, 31, 266, 68) sat under the way-out chip (16, 16, 155, 44) on three of three fresh mounts, so the learner read the second half of a sentence; the disabled mic orb (139, 632, 96, 96) sat on the goodbye plate AND on the indigo button beneath it; and `unavailable` printed the same sentence in two plates that overlapped. None is a constant to retune — the caption rides a projected point, so any offset correct at one shot is wrong at the next. `exit` is deliberately absent from the CAMERA's list: charging a 44 px corner chip as a 60 px top inset would push the subject down the frame in every phase to make room for a back arrow, for a collision the HUD can settle by itself for 22 px sideways. The way out therefore drops its label below `md:` (155 px → 44 px), because labelled it spans the caption's only horizontal escape route on a 375 px screen and the solver's only remaining move is 37 px straight DOWN, across the tutor's forehead. |
| 2026-08-21 | **"Present in every phase" and "present in a phase where speaking is over" are different claims, and the microphone now makes only the first.** `StageMicPlan` gained `present`; `closing` is the single phase without an orb, `unavailable` keeps one and carries the phase's OWN sentence so the phase explains itself once. Recorded in /ORACLE.md §14.1 and /DESIGN.md. | Mounting the orb in every phase was the right fix for four phases having none — including the first screen a new learner sees — and the wrong fix for the goodbye: measured on a phone, a 96 px DISABLED microphone covered the second line of "See you soon!", covered "Start another session" (the one action of the phase), and covered its own reason line. The control added so the microphone could always be found was taking away the button the learner needed. The decision is a field on a total function over the phase vocabulary rather than an `&&`, and the ABSENCE is asserted as tightly as the presence — the list of phases without an orb is spelled out in the test, so a second removal is deliberate rather than a silent consequence. |
| 2026-08-21 | **A ResizeObserver teardown that also forgets WHAT it was observing cannot survive a StrictMode remount, and dev is the only build anybody looks at.** `SafeAreaProvider`'s cleanup now drops the observer but keeps the node map, and the setup re-observes and re-publishes whatever is already registered. | React 18 StrictMode mounts, unmounts and remounts every effect; the ref callbacks that filled the map do not run again. So after the remount there was no observer, nothing observed, and the window-resize handler iterated an empty map: every HUD rect stayed frozen at its very first measurement for the life of the page. Measured live in a headless browser — resized 375 → 430 px, the microphone dock kept reporting the 345 px width it had had at mount. The camera composed around a HUD that had moved, and the new caption-avoidance read the same stale rects. Invisible in production, where StrictMode does not double-invoke, which is exactly why it survived: the one build where this route gets looked at is the one build where it was broken. |
| 2026-08-21 | **A live lesson segment may not change the camera at all, and the shot mapping is no longer allowed to be told about one.** `over-shoulder` deleted from the shot vocabulary (six shots → five); `StageShotInput` lost its `segmentLive` field, so the coupling now fails `type-check`. Recorded in `/TUTOR_3D.md` §9.1. | Driven at 375×812 and photographed, `conversing` with an activity on the plate filled the phone with HAIR AND ONE EAR — no island, no face, no companion; at 1280×800 the back of Dr Rho's head took the left two-thirds in profile. Type-check, lint and 946 tests were green, and the previous verification pass scored the frame at 100% "scene coverage", because a character's own body counts as painted scene. Two independent reasons to delete rather than retune. (1) The one caller was itself the violation: `/ORACLE.md` §9.3, its §16 shipping gate and `DESIGN.md` → Screen Recipes → Tutor all require the character's on-screen height to be IDENTICAL with and without a segment, and every shot sits at its own distance. Clearing the plate is `composition.ts`'s job, which shifts the AIM and never the distance. (2) It is geometrically impossible in portrait, which §1.11 makes non-negotiable: a cartoon head is ~47% of body height, so making the near figure a foreground edge needs ~2.1× height of stand-off (3.5 m) while the cast stands 1.4 m apart — from there the lead subtends 5.97° and the companion 4.27°, 1.7° apart, and half the horizontal field of view at 375×812 is only 8.53°, so no lateral offset separates them. An over-the-shoulder needs the stand-off small relative to the separation; here it is the reverse. There was also never anything in the WORLD to look at: the activity is DOM chrome on a plate. |
| 2026-08-21 | **A framing test must assert what the shot HOLDS, not that its arithmetic is finite and correctly signed.** `shots.test.ts` now projects every shot's promised points at 1280×800 AND 375×812, paired and solo — heads 12% inside the frame edge, crown/chest/rim anchors merely inside it. | The suite that let the ear ship measured `establishing` for distance, `closeup`/`closeup-wide` for on-screen SIZE, and everything else for the sign of a dot product. A pose can be finite, correctly signed, and pointed at the inside of a skull. The new suite still cannot see that a head is BACKWARDS — an ear projects inside the frame perfectly well — which is exactly why the screenshot pass is not optional and why this row exists beside the one above it. |
| 2026-08-21 | **A HUD offset whose correct size depends on how big the subject is on screen is an ANCHOR, not a CSS margin.** The Tutor's caption now rides a published `lead.crown` slot (`focus.y + height * 0.25`) instead of nudging upward off `lead.head`. Recorded in `/TUTOR_3D.md` §9.2. | `lead.head` is the MID-head, because that is what the camera aims at. The gap from there to the top of the skull measures about 290 CSS px at a close-up on a 1280 viewport and about 40 px at the establishing shot, so no single pixel value is right in both, and the value that was shipped (`bottom-10`, 40 px) parked the caption across the speaker's forehead in exactly the shot a conversation spends most of its time in. Captions above the head are the owner's stated accessibility requirement for deaf learners, so this was the requirement being quietly voided rather than a spacing nit. Type-check, lint and 817 tests were green through it, because the failure only exists once a camera is projecting. |
| 2026-08-21 | **The Tutor route's way out is VIEWPORT-anchored, and /DESIGN.md's count of viewport-anchored elements went from two to three to say so.** A HudPlate chip at the top-left safe area, first in the tab order, above the loading veil, never culled; the `sky.mark.4` exit rune and the `sr-only` exit button are both gone. Recorded in /DESIGN.md (Screen Recipes → Tutor, and §Elevation item 5). | The route drops the sidebar and the mobile tab bar by design, and the two exits it shipped with were each unreachable for a real learner: a world rune is hidden and inert whenever the camera stops framing its anchor, which at close-up is most of a session, and a skip link is revealed by a key a thumb never presses. A pointer user mid-conversation had the browser back button. The count of two existed to stop the HUD accreting floating panels, and navigation the immersive exception removed is not one, so the recipe was changed rather than worked around. The count is closed again at three. |
| 2026-08-21 | **An anchored HUD node is culled against its BOX, never against its centre point.** `culling.ts` holds the geometry (imports nothing, so it is unit-testable); the projector measures each node's own box on the same quarter-second tick as the canvas rect. | The projector positions a node by its centre, and the cull test was the centre plus a flat 96 px margin. A chip whose centre was up to 96 px outside the frame therefore stayed un-hidden and un-inert: half off the screen, still fully focusable, so keyboard focus landed on a control the learner could not read. Nothing catches this without a camera projecting, which is why the arithmetic now lives outside the frame loop where a test can reach it. |
| 2026-08-21 | **State scoped to one live session is cleared when the session identity changes, INCLUDING when it changes to nothing.** `useTutorSocket` now resets all ten of its session fields on a `socketUrl` change, not just `connection`. | Only `connection` was reset, so "start another session" was impossible to complete: the second socket opened while the FIRST session's `closedReason` was still set, the watcher read it, and the brand new conversation was declared over before its greeting arrived, inheriting the previous transcript. It cannot be fixed at the caller, because a guard that ignores a stale reason cannot distinguish it from a genuine close. |
| 2026-08-20 | **When the interactive `Agent` tool's subagent cap is exhausted, use the `Workflow` tool instead of falling back to unassisted hand-authoring — its `agent()` calls run on a separate budget.** Standard fallback now for any large authoring run that hits the cap mid-session. | Emprendimiento's 200-spawn budget was gone with no live agents to resume, blocking further `Agent` calls outright. `Workflow` launched successfully in the same session and let all 8 Inversiones adventures author/judge/translate concurrently instead of sequentially — the whole course finished in one sitting instead of one adventure at a time. |
| 2026-08-20 | **`order_steps`/`rank_choices`/`build_sentence`/`timeline_order`/`code_order` seeded display order must be reseeded by renaming `segment.id`, never by reordering the authored `items`/`tokens` array — and the fix may need retrying.** | `seededSortMiddlingIds` derives the render purely from `(item ids, segment.id)`, so reordering the JSON array has zero effect. A 3-item sequence has only 6 possible renders, 2 of them "bad" (matches the key or its reverse), so a single reseed can still land on a bad render — confirmed empirically requiring up to 4 attempts on the same segment. |
| 2026-08-20 | **`compare_table` is not a valid choice for any exercise whose objective is "derive/count the value" — only for "read the given value."** Documented as a hard exclusion in `coursegen/AGENTS.md`, not just a sizing caution. | Its own hard gate requires every source cell's value to be stated together with its row in `prompt_md` for solvability — which is exactly what makes "count the signals yourself" impossible to test with this type: the prompt handing over the count *is* the leak. |
| 2026-08-20 | **Sunk cost repeatedly gets authored as opportunity cost, and this is a content-accuracy defect for a financial-literacy course, not a style note.** Fix pattern documented: winning rationales must cite only forward-looking reasons ("doesn't repeat" / "can be taken later"), never "already invested." | Three segments across two sibling lessons scored "the tournament already had 3 weeks invested" as the textbook opportunity-cost argument — backward-looking honoring of sunk cost is the opposite of the forward-looking concept the course teaches. One instance hard-coded the confusion as a graded MCQ's correct answer. All 9 gates passed every instance; only the judge's holistic pedagogy read caught it. |
| 2026-08-20 | **Topic-level titles (en-US/pt-BR) must be generated as a single `--titles` file covering every unique topic slug before the first publish attempt, not per adventure.** | The catalog authors `title_es` only; `author-publish` fails closed per-lesson (`no en-US/pt-BR title for topic "…"`) if any of the course's unique topic slugs (272 for this course) is missing from the file. This is a separate translation surface from the per-lesson `author-localize` pipeline, easy to discover only at the moment of publish. |
| 2026-08-18 | **A subagent authoring world file (`WORLD.md`) must state it is subordinate to the brief, never the reverse.** Pinning a world before dispatch is now standard for any multi-batch subagent authoring run. | An adventure's world file wrongly pinned the wrong product; two authoring batches obeyed it over their own catalog-authored briefs, discarding a brief's explicit narrative beat. The catalog is human-reviewed content design — no file an agent writes on the fly outranks it. Cost 23 lessons of re-homing to fix. |
| 2026-08-18 | **`author-judge ingest` reports an oversized `notes` field as a schema `problems` entry, and an operator must treat that shape as "verdict lost", never as "lesson failed".** | `reviewRubricSchema` caps `notes` at 2000 characters and fails the whole verdict object past it — correct fail-closed behavior, but it silently discarded 11 verdicts for lessons that were actually clean, making them read as unjudged. Recovery: truncate the oversized `notes` in place and re-run `ingest`. |
| 2026-08-17 | **Geometry says how a surface BEHAVES, never what it IS — placement needs a semantic input.** A walkability mask is baked per island from its own texture (`npm run assets:walkmask`) and applied as a hard gate in `findStandingSpots`. | `diorama-b` stood its ENTIRE CAST in the pond — every pairing, both characters, for as long as the island had shipped. Water is the flattest, most open surface a diorama has, so it beat every patch of grass on the two terms carrying most of the score. No threshold fixes this: the pond is not badly shaped, it is beautifully shaped and wet. There is also no geometric signal to recover — one mesh, one material, quantized so the water is not even exactly planar, no vertex colours. The meaning only exists in the texture, so the rule reads it there and does so at BUILD time, where a wrong classification is a visibly wrong mask in a diff (`--preview` paints blocked cells magenta) rather than a mystery in production. A missing mask returns `null`, never a permissive default. |
| 2026-08-17 | **Looking finds what measuring cannot; measuring disproves what looking only suggests. Neither substitutes for the other.** Added `npm run verify:placement`, a headless harness that runs the REAL solver against the REAL islands. | The pond was found by finally photographing the second island with people on it — no test, type-check or number had ever complained. But two of the three "defects" that same screenshot appeared to show did not survive measurement: the companion "standing on a boulder" was a low-resolution crop in which the boulders sit BETWEEN him and the camera (a tight re-render shows both feet flat on sand), and Dina "overhanging the rim by 44 cm" assumed she would be placed on the outer sampling ring — measured, she stood 2.01 m out with 4 cm to spare. Both had already been written into a committed doc and a published report before the harness existed to check them. |
| 2026-08-17 | **Fixing a placement rule can create a composition bug, so the fix is not done until the scene is looked at again.** Added a togetherness preference: after the lead is placed, later spots are pulled toward it. | With the pond off-limits, the two highest-scoring patches of grass on diorama-b sat on OPPOSITE SHORES and the solver dutifully chose both — 5.39 m apart against 1.82 m on diorama-a. Nobody was standing anywhere wrong; they were ignoring each other across a lake, and the quarter-turn each character takes toward the other means nothing at six metres. Now 2.28 m. Kept a preference rather than a rule because rejecting on it can return NO spot, and `Cast` renders nothing without one: a cramped character beats an empty island. |
| 2026-08-17 | **Measured facts about a model must not live behind a bundler global.** `measurements.ts` split out of `assets.ts`; the latter now only adds URLs. | `assets.ts` reads `import.meta.env` to resolve Depot's content-addressed URLs, which made every height and footprint unreadable outside Vite — so a headless placement check could not import a single number without dragging in asset URL resolution. Shimming `import.meta` does not work either: it is per-module. The alternative was to soften the product for the harness, which is the wrong direction. |
| 2026-08-17 | **Liruf and Dina keep their painted mouths — closed after exhausting every approach, not abandoned.** | Five fits on Liruf (planar, cylindrical, ribbon, ribbon widened 4 cm a side after re-measuring his grin at −0.191..0.237, and two grid densities) and six on Dina (ribbon, curve raised 0.0008, four gaps, three densities). The card ends up split into disconnected pieces with the face poking through between them: the snout curves more across the patch than a bilinear surface can hug, and raising density past 21×13 makes Liruf WORSE (bulge 0.0347 → 0.1019) because more samples land on his teeth. The one remaining fix is painting the mouth out of the albedo so the card ADDS one, as Rho's does — rejected because a UV sweep shows these models' layouts are fragmented into islands spanning the whole atlas (u 0.024–0.994), so a masked repaint would recolour large disjoint areas of a shaded curved face. High risk of visibly damaging two characters that look good today, for two companions who do not carry the speech. |
| 2026-08-16 | **Small deltas survive a rest-pose mismatch; large ones do not.** The seven emotion clips were audited across all three bipeds and need NO per-character overrides, unlike the arm gestures. | The first metric said otherwise: head DISPLACEMENT at each emotion's peak put Rho at roughly twice Zara on every one, and Liruf's `surprised` at a seventeenth. That measure is confounded by head size — Rho's head is large and far from the pivot, so the same tilt travels further. The ANGLE, which is what a viewer actually reads, is identical to a tenth of a degree on all three (happy 10°, excited 15°, surprised 13°, proud 19°). Rotations very nearly commute at 6–19°, so an emotion arrives intact on a skeleton whose rest differs, while a 150° arm swing does not. Recording the negative result because "the actions needed per-character values, so the emotions must too" is the obvious wrong inference. |
| 2026-08-16 | **Judge a gesture from the side the gesture is on.** `point` on Rho was declared unimprovable after five rounds of candidates; three of those rounds were rendered from his LEFT, where his own body occludes the pointing arm. | Every candidate looked like nothing was happening, because nothing could be seen. Re-rendered from his right, the shipped pose measures better than all five alternatives (9.86 forward against 1.38–5.64) and the real limitation is anatomical: shoulder-to-hand is barely wider than his head. Hours went into tuning a pose against an image that could not show it. |
| 2026-08-16 | **Same bone NAMES is not the same skeleton, and an animation clip may never be shared absolutely between rigs.** Every clip in `clips-biped.glb` is now stripped to rotation (plus `Hips.position`) and converted to deltas against an exported rest pose before it plays. | `clipLibrary.ts` asserted in a comment that rho, zara and liruf "share ONE 24-joint skeleton". They share the names; **23 of the 24 bones differ in rest orientation**, by up to 74° at the hip. Because glTF stores a bone's rest offset in its `translation` channel, a force-sampled clip ships the authoring character's PROPORTIONS as if they were motion: Rho's feet collapsed 60.6% and Liruf's 79.4%, both to exactly Zara's 0.09214. What made it survive review is that **Zara — the rig it was authored on — looked perfect throughout**, so the other two read as bad animation rather than as a broken assumption. Verified after: 0.0% drift on all three. |
| 2026-08-16 | **A retarget is not a substitute for per-character art direction.** An armature-space retarget was implemented, proven correct (identity on the authoring rig: 2e-6) and then NOT adopted. | It helps Liruf and hurts Rho. The rests differ in incompatible ways, so no single linear transform serves both — and the deeper finding is that some gestures are anatomically impossible to share at all: Rho's arm reach is 15.99 from a shoulder at ~3.2, topping out at 19.2 against a crown at 25.94, so he *cannot* raise his arms overhead. `celebrate` for him has to be a different pose, not a transformed one. Measuring the limb rather than tuning the number is what turned "the animation looks wrong" into a decidable question. |
| 2026-08-15 | **Rotate bones in PARENT space (`premultiply`), never in local space (`multiply`).** All procedural gestures in `characterActions.ts` premultiply, and a test asserts each action actually moves the bone it targets. | Post-multiplying rotates a bone about its OWN axes, and on these rigs a bone's local +Y runs along its length (measured: `LeftArm`'s child sits at `[0, 28.03, 0]`). So an arm "swing" of 2.0 rad came out as a twist around the limb: a real rotation, mathematically, and completely invisible on screen. Type-check, lint, the bound-slot log, and even a quaternion diff all passed — the quaternion genuinely changed every frame. Only a screenshot showed nothing moving. A structural assertion ("the value changed") is not a behavioural one ("the character moved"). |
| 2026-08-15 | **A debug probe that fights the render loop proves nothing.** | Two hours of the above went into invalid experiments: pinning `bone.rotation` from the browser console at 8 ms intervals showed no movement — because `resetRig()` runs inside `useFrame`, immediately before render, and overwrote the pin every frame. A second probe walked `parent` to the GLOBAL scene root and "discovered" two skinned meshes, which were simply the two characters. When instrumenting a frame-driven system, write the probe INSIDE the same frame callback that owns the value. |
| 2026-08-15 | **A build pass that can silently destroy a rig must fail the build, not report a size win.** `optimize-glb` refuses to write when skins, animations or skinning attributes decrease. | `prune({keepLeaves: false})` deleted Liruf's skeleton: joints ARE leaf nodes, so pruning leaves invalidated the skin, which prune then removed too. The output was a smaller, structurally valid .glb whose character could no longer deform — and the animation entry still survived, so nothing looked wrong until a character was on screen frozen in bind pose. Corruption that shrinks a file looks exactly like success. |
| 2026-08-15 | **A React state updater must be pure; anything with side effects becomes a pure reducer outside React.** Tier stepping moved to `tutor-scene/governor.ts` as `(state, fps) => state`. | The first version mutated a demotion counter and called `setLocked` INSIDE a `setTier` updater. StrictMode invokes updaters twice to surface exactly that, and it did: one bad measurement window counted as two demotions and latched the tier immediately, permanently barring a device that merely hiccuped from climbing back. Caught by reading the tier in a screenshot — `medium` and "locked" cannot both be true after one demotion. |
| 2026-08-15 | **Scene placement is SOLVED from the geometry, never authored as coordinates.** Characters are positioned by `findStandingSpots` (raycast grid + flatness + openness scoring) and grounded by a downward ray, not by hand-tuned x/z/y. | Three separate placement bugs in one session, each invisible to type-checking: resting the island's bounding-box TOP on y=0 put characters standing in mid-air above the back wall; hand-picked coordinates put Liruf on top of the stone table; and facing the island's centre showed the cast's backs, because "inward" and "toward the viewer" are opposites when the camera is outside the scene. Coordinates tuned by eye against one diorama do not survive the second one. |
| 2026-08-15 | **Measure the asset, do not trust the export.** `npm run assets:inspect` reports bind-pose bounds, rig, clips and texture inventory before anything is decided. | The four characters disagreed by 59× in unit scale (Dina came from Unreal at 0.028 m) and by 76× in triangle count (3,080 vs 235,014) — while all looking equally fine in a viewer. Heights, decimation targets and scales are recorded in `tutor-scene/assets.ts` FROM those measurements. The measurement itself needed correcting twice: a skinned mesh's node transform must be ignored per the glTF spec, and a meshopt-quantized mesh cannot be measured this way at all (it reports ~65,000 and the tool now says so instead of printing it). |
| 2026-08-15 | **A prompt template that reaches every generation describes STYLE and never a SUBJECT, and the prohibition is stated positively.** `LF_VISUAL_IDENTITY` now carries a `SUBJECT DISCIPLINE` clause instead of an example scene. | It used to end with "Cheerful lemonade-stand world…". Injected into every prompt, that sentence became the subject whenever the label supplied none — a lemonade stand over exercises about markets, budgets and fraud. Silence is not a prohibition: a model asked for a scene with no subject always invents one, so the rule has to be written down. |
| 2026-08-15 | **A checker that validates the FORM of generated output must also validate its SUBJECT.** The pixel verifier gained `depicts_subject`, biased toward accepting, with a missing answer never blocking. | `has_text` and `has_person` both pass on a beautiful, on-style illustration of entirely the wrong thing. Form was verified from day one; content never was. The asymmetry is deliberate — a false negative costs a paid redraw, and treating silence as failure would loop forever. |
| 2026-08-15 | **A coverage metric counts DISTINCTNESS, not presence.** `verify:course` fails if any scene image serves more than one lesson; object tiles are exempt and reported informationally. | The broken catalog reported 100% visual coverage. Every planned image was present and they were the same file. Presence-counting is what made a total failure look like success, and the distinctness check costs nothing — no API calls, no vision model. |
| 2026-08-15 | **A deterministic fixer that can only correct one half of a model-authored pair must either fix both halves or make the divergence visible.** Mix-rule violations are now a REPLAN; `planRepair` survives as a net and stamps `retypedFrom`, which the write prompt turns into a re-anchor instruction. | `planRepair` rewrote `seg.type` in five places and never touched `seg.brief`, so the writer received a mechanic with no relation to the narrative — and always late in the lesson, because both the money rule and the diversify rule pick their victim from the end. That is what "a question out of nowhere" is, mechanically. |
| 2026-08-15 | **A flag named `--dry-run` means no side effects, and money is the largest side effect.** A restyle needs `--confirm-spend` AND `--max-usd` before it may contact the provider; one predicate (`spendAllowed`) gates both the health probe and every illustrate call. | `--dry-run` meant "no Vault writes" and still ran the full paid pass. Because a restyle CLEARS art before redrawing it, measuring the cost of a repair would have paid for the repair. Caught mid-flight, at zero spend. Where a mode genuinely previews paid output, it now says so loudly and offers `--reuse-only`. |
| 2026-08-15 | **Re-publishing live kid-facing content is a decision with no default.** Publish reads the slot's status and refuses to write unless the run passes `keep-published` or `demote-to-review`. | The learner RLS policy requires `status='published'`, and publish upserted `'review'` unconditionally. Regenerating one adventure would have removed ~150 lessons from every child's path, silently, as a side effect of an improvement. Both policies are legitimate; choosing one for the operator is not (§1.0.1). |
| 2026-08-15 | **A provider error surfaces the provider's own message, and a systemic failure aborts instead of walking on.** The DashScope client includes the response body; a restyle stops after 3 consecutive image-hungry lessons that receive nothing. | `DashScope responded 400` said nothing; the body said `Arrearage` — an unpaid account. Meanwhile the pass kept clearing art it could not replace. A status without a body is not a diagnosis, and several barren lessons in a row is never a content problem. |
| 2026-08-15 | **Local Qwen inference was evaluated for the repair and DEFERRED, not adopted.** | The 8 GB laptop can technically run a quantised 20B image model with CPU offload, at roughly minutes per image — ~7 days for the catalog against $255 of API. It also changes `IMAGE_MODEL`, which is part of the cache key, so new scenes would come from a different model than the 9,179 existing tiles. And the judge/verifier share the blocked key, so local images alone would run the repair with its quality gates off. Revisit for FUTURE courses, where there is no prior catalog to clash with. |
| 2026-08-14 | **Every dataLayer push must be an `arguments` object, asserted by test.** `mountGa4` uses Google's `function gtag(){dataLayer.push(arguments)}` form, and a test fails if any entry is a real Array. | An arrow function pushing a rest array is silently ignored by gtag.js: the tag loads, the console shows no error, and the property receives nothing. It cost three weeks of GA4 data. No type checker or lint rule can catch it, so it has to be a test. |
| 2026-08-14 | **Staff-IP exclusions are verified with `whois` before approval, and shared egress is surfaced in the console.** | A CDN77 VPN exit was approved as a "team device", excluding every other visitor behind that exit while failing to exclude staff, because exit IPs rotate. Our own data already held the tell: two different staff accounts at one address. |
| 2026-08-14 | **One period control per screen.** A chart never carries its own range control when the page has a picker; where a panel has no page-level picker, discrete presets are the control and a drag Brush is not. | Three controls governing one window can only contradict each other, and nothing on screen says which the figures obey. A drag-only affordance also has no tap equivalent, which DESIGN's responsive rules prohibit. |
| 2026-08-14 | **Ordered categories are drawn as ordered bars, never as a pie.** | A pie has no "worse than" direction and forces angle comparison, which is less accurate than comparing lengths on a shared baseline. Churn severity was losing both its ordering and its readability. |
| 2026-08-14 | **The exported PDF is localised, and its formatters are built per render.** Period and dimension names are localised in the report service rather than reused from pulse.ts's English-only console constants. | A module-level `Intl` instance pinned to one locale is exactly how the report stayed English regardless of who exported it. Sharing PERIOD_LABELS would have left "Last 30 days" atop a Spanish document. |
| 2026-08-14 | **Every third-party tracker is mounted with automatic SPA capture OFF and driven explicitly by our own code.** Plausible takes `autoCapturePageviews: false`, Umami `data-auto-track="false"`; each approved navigation emits one pageview from the effect. | Both vendors hook `history.pushState` on load, so the route gate only chose whether to add the tag — the vendor, not our consent logic, was deciding what got recorded. `/admin/content` became the site's #1 page and 79.6% of stored Plausible pageviews were out of boundary. Unmounting a script never revokes what it already installed on `window`/`history`. |
| 2026-08-14 | **Contaminated analytics history is corrected at read time, per tool, and never silently half-corrected.** Plausible gets an always-on acquisition allowlist inside `plausibleQuery()`; Umami reports `outOfBoundaryPageviews` instead of a scoped total. | Neither vendor can delete by filter, so the choice is read-time scoping or knowingly publishing bad numbers. Umami has no negation filter: `pageviews` is correctable by subtraction but `visits`/`bounces`/`totaltime` are not, and fixing only the summable metric yields a bounce rate computed against visits that still include the removed sessions — internally inconsistent, and worse than an honest caveat. |
| 2026-08-14 | **A cross-package invariant that cannot share an import gets a CI gate, not a comment.** `check-marketing-paths.mjs` compares the frontend and backend definitions of the acquisition surface and fails on either direction. | Nine packages, no workspaces, so the definition is duplicated by necessity — but the enforcement need not be. Drift produces no error and no visibly wrong number, only a quietly incomplete one: a marketing route added to the frontend alone is recorded and then filtered out of every report. |
| 2026-08-14 | **A repo-consistency assertion was split rather than satisfied.** ROADMAP now tracks the live migration state and must state a verified production high-water mark; the frozen 2026-08-01 audit keeps its own dated range, asserted only to be well-formed. | The original test required both documents to name the same unapplied range. With production at 46/46 and nothing pending, that is no longer expressible, and making a dated snapshot carry today's numbers would falsify a historical record to satisfy a test. The replacement is net stricter — it catches a new migration shipping without a doc update, a stale high-water mark, and a partial ledger recorded as verified. |
| 2026-08-14 | **Staff-IP exclusion suggestions are verified with `whois` before approval; VPN and datacenter exits are never excluded.** | All three detected staff addresses were CDN77/Datacamp VPN exits. Excluding one removes every other person using that exit server — silently, unrecoverably — while failing to exclude staff at all, because exit IPs rotate. Same reasoning that already refused ASN blocking over iCloud Private Relay. |
| 2026-08-02 | **The production migration runner stays Bash 3.2-compatible and is integration-tested without a network.** Migration-file collection uses a portable `while read` loop instead of `mapfile`, and `railway-migrate.test.mjs` executes the dry-run against fake Railway/`psql` binaries. | The macOS system Bash is 3.2 and has no `mapfile`; the first integration test caught the failure before production. A fake no-write session also proves the forwarded base64/`psql` pipeline is actually executed, not merely syntactically present. |
| 2026-08-02 | **The Railway migration runner passes its remote pipeline as an executable `sh -c` argument, without literal wrapper quotes.** The transport was shell-audited after the handoff script was added. | Literal single quotes around the whole forwarded command would make the remote shell treat the base64/`psql` pipeline as a string instead of running it. Keeping the base64 payload quoted inside the command preserves safe transport while ensuring the dry-run and apply paths actually execute remotely. |
| 2026-08-02 | **Every object-tile purpose guide repeats the pure-white/transparent edge-to-edge rule and the original animated-editorial vector brief.** The deterministic tile prompt and the art-director role guidance now agree; scenes retain complete setting backgrounds. | Four legacy role descriptions still said "near-plain warm background", which could reintroduce a colored canvas if the deterministic path is expanded or a future director call uses the role text. Repeating the constraint at both prompt layers makes the requested visual contract resilient without another paid generation. |
| 2026-08-02 | **The root release gate must include every TypeScript service, and Data Intel export jobs must read the schema's `rows` column through an explicit `row_count` alias.** `run-all.sh` now covers Prism, Depot and Data Intel alongside the existing services; Data Intel's create→list path is regression-tested. | A green root gate that skipped three deployable services was weaker than their individual CI gates. The expanded run exposed a real export-list 502: `export_jobs` stored `rows`, while both read queries selected the nonexistent `row_count`. Keeping the API's `rows` field while aliasing at the SQL boundary fixes the live admin path without a schema migration. |
| 2026-08-02 | **Illustration inheritance is provenance-gated by migration `0032`.** New lesson documents record the Forge illustration bundle version, and old/null documents cannot donate free art after a visual style change. | Prism's cache discriminator already regenerated identical requests under `v5`/`v6`, but Forge's separate previous-document inheritance path could have reattached a pre-change URL without consulting Prism. A style marker keeps the cost optimization while making the new flat-vector/white-canvas contract true for every release candidate. |
| 2026-08-02 | **LittleFounders illustrations are strict 2D flat vectors; the global and object-tile cache keys were bumped.** Prism now excludes 3D/plastic/photoreal/painterly treatments in both the identity and negative prompt (`v5-flat-vector`, `v6-object-white-flat-vector`). | The first mechanically valid v12 scenes had no text or people but looked softly rendered and three-dimensional, outside the intended high-contrast educational vector language. This is a true look change, so reuse would silently preserve the wrong visual identity; a version bump makes all future candidate requests honest. |
| 2026-08-02 | **Forge's literal-object filter is locale-aware during its post-localization image sweep.** It rejects person/action/concept labels in es-MX, en-US and pt-BR before calling Prism. | A source-safe Spanish option became `Child holding a toy` after localization and was misclassified as an object; Prism correctly spent three attempts and rejected the non-white person tile. Classifying it before the paid call keeps the icon/text fallback intentional and prevents that spend from repeating. |
| 2026-08-02 | **A provider-local DeepSeek 402 may fail over to Qwen; credential and request faults remain fail-closed.** Forge already requires Qwen for independent review, so a DeepSeek account-capacity failure can be ledgered and completed by the separately configured provider under the same run budget. | The single-slot `v12` candidate obtained a valid compact blueprint, then stopped with DeepSeek `Insufficient Balance` before any visual cost. Treating an exhausted author account as a global content defect strands an otherwise controlled local candidate; routing only 402 preserves the safety boundary without masking invalid credentials, malformed requests, or billable empty completions. |
| 2026-08-02 | **Required visual runs admit the complete remaining illustration bundle before their first Prism call.** Forge conservatively reserves `missing targets × verifier redraw limit × unit image cost` as an admission check, releases that temporary hold, and then keeps per-request reservations for concurrent-worker safety. | A USD 0.50 cap used to stop only after it had purchased several tiles, leaving an unreleasable partial lesson. Cache status cannot be known safely without the request because context belongs to the descriptor, so a fail-closed worst-case preflight is the honest contract: a low cap is a budget-admission probe, while a full visual candidate needs its own approved cap. |
| 2026-08-01 | **Known image cost is reserved before the network request, not merely checked after prior calls settle.** `UsageLedger.reserve()` admits a fresh Prism request only when its fixed Qwen-image unit cost fits alongside all in-flight image reservations; it releases on cache hit or failure and records only a real fresh generation. | With concurrent slot workers, a plain “current spend < cap” check lets every worker observe the same total and start an image, exceeding a small pilot ceiling together. Image price is known exactly before the call, unlike an LLM completion; reserving only this known component makes the dominant pilot cost actually bounded without falsely reserving an LLM's maximum output. |
| 2026-08-01 | **The legacy `first-lemonade-stand` corpus is review-only in both Vault and its portable fixture.** Its course/adventure/saga/topic rows are `draft` and its 62 lesson rows are `review`; the fixture was regenerated rather than hand-edited. | The corpus deliberately exercises unusual exercise shapes and currently proves that the visual release gate rejects 9 missing context anchors. A QA fixture marked `published` could appear through the learner API despite being explicitly non-shipping; aligning its data state with its role makes the release boundary true in the data, not only in documentation. |
| 2026-08-01 | **Visual repair has an explicit zero-spend first pass.** `images:backfill -- --reuse-only` builds a deterministic course-local index of already-approved object art and fills only exact normalized-label matches; it never contacts Prism and never inherits a scene anchor. Its first dry-run against the legacy `first-lemonade-stand` corpus scanned all 186 documents, proposed zero writes and made zero image calls, correctly leaving its 9 context-specific visual gaps visible to the release verifier. | Reusing a lemon or a cup can be safe and free; reusing an establishing scene under a different prompt can teach the wrong context. The former is an optimization, the latter is a semantic defect. Separating them gives operators evidence before any paid repair and keeps the visual-release gate honest. |
| 2026-08-01 | **Production course generation is visual fail-closed; cheap text pilots remain explicitly non-shipping.** Forge now has `--require-images`, which requires Prism configuration before the first paid author call, persists that choice in checkpoint compatibility, and fails the slot on any illustration error. `--no-images` and `--require-images` are mutually exclusive. The first Educación Financiera slot also completed a free dry-run (1/1 validated, zero tokens, $0). | A release verifier that catches missing art only after thousands of text calls is too late: it protects learners but not the pilot budget. The new production mode prevents that spend and makes visual delivery a prerequisite rather than a warning, while retaining the zero-cost structural validation path. |
| 2026-08-02 | **A billable reasoning-only completion is ledgered before Forge fails it, and full documents have a 16,384-token configurable ceiling.** `ProviderCompletionExhaustedError` carries the provider usage for an empty `finish_reason=length` response; DeepSeek and Qwen wrappers append it exactly once before rethrowing. `write`, `localize`, and `revise` use `FORGE_DOCUMENT_MAX_TOKENS` rather than a fixed 8,192-token ceiling. | A live financial-education pilot showed that a reasoning model can spend all 8,192 output tokens before emitting JSON. Treating that HTTP 200 as an unrecorded failure understated spend and invited a repeat. The new path keeps the pilot budget auditable and provides enough normal headroom without changing the small title-only calls. |
| 2026-08-02 | **Rejected Prism pixels are now metered, not silently lost from Forge's budget.** Prism reports `generated_images` on success and `x-picturegen-generated-images` on an error; Forge reserves the verified maximum redraw count before a request and records the returned exact count even when no image URL exists. | A real visual pilot received `IMAGE_VERIFICATION_FAILED` after Prism generated three defective images. Reserving/recording only a successful URL left those paid calls outside the run ledger and let a nominal budget understate the maximum spend. |
| 2026-08-02 | **Prism's strict visual gate now emits a mechanical diagnosis without weakening the gate.** The verifier returns `hasText` and `hasPerson` alongside its verdict; only a complete `false/false` response is clean, while a partial all-clear is unavailable. Terminal failures expose the detected category but discard provider free-form prose. | A repeated `IMAGE_VERIFICATION_FAILED` for a white-background object tile was actionable only as a generic failure, which encouraged prompt guessing and unnecessary paid redraws. The flags make the next correction evidence-based, preserve the no-text/no-person rule, and avoid passing untrusted provider text into logs or API responses. |
| 2026-08-02 | **A white object tile means a pure-white canvas, not a white card on a colored background.** The four object-tile purposes now have a selective `v5-object-white-canvas` cache discriminator, an explicit edge-to-edge canvas prompt, and a deterministic border-pixel gate; scenes retain global style `v4`. | The first real `Helado` probe passed the text/person verifier but human inspection found a dark gray canvas around a rounded white panel. A vision-only third flag rejected subsequent valid colored objects because it could not reliably segment foreground from background. The scoped deterministic gate makes the visual contract enforceable without regenerating the established scene corpus. |
| 2026-08-02 | **Object-tile prompts favor concise positive specifications over brand/context prose.** The deterministic prompt now states only the literal object, centered composition, pure-white four-edge canvas, flat 2D animated vector treatment, clean geometry, crisp contrast and bright colors; it omits LittleFounders and lesson context. | The model was treating a long identity brief as noise. The controlled canary showed that simplification improves prompt clarity but does not fix the current `qwen-image` canvas behavior: the service still exhausted three attempts, and a direct image still had a green surround plus a rounded white card. The verifier and production block remain unchanged. |
| 2026-08-02 | **Prism's image model changes to the owner-authorized `qwen-image-max`.** Picturegen and Forge defaults, local environment, ledger model labels and style/provenance discriminators now agree; old-model art cannot be inherited. Max uses the synchronous multimodal endpoint and its `1328*1328` square preset. | A model change can alter composition and cost, so the cache key alone is insufficient: the provenance marker must force fresh art through Forge's inheritance path too. The first canary generated one object tile and passed both Prism verifiers; the current provider tariff remains an operator check before a course budget is quoted. |
| 2026-08-02 | **The Max visual pilot completed a publish-as-review candidate after a schema-minimum prompt correction.** `fe-pilot-financial-20260802-max-live01` failed closed on incomplete `sort_buckets` and `dialogue_choice` collections; the writer now prints those minimum counts beside the skeleton. `fe-pilot-financial-20260802-max-live02` then published one lesson in all three locales with 12 placed images, 14 fresh generations, 70,352 tokens and USD 1.0880 estimated; no production release was performed. | The first Max run proved the model endpoint and image gates but exposed that tiny shape placeholders let the author omit required interaction choices. Making the schema minimums explicit improved convergence without padding or weakening validation. The generated bundle is now the local release candidate for human review and the production handoff remains external. |
| 2026-08-02 | **`FORGE_CHAT_TIMEOUT_MS` is a total LLM-operation deadline, not a per-retry timeout.** The OpenAI-compatible completion client passes the remaining time to each abort controller and refuses retry backoff after the common deadline. | A local 300-second write stayed active beyond five minutes because retryable timeouts started a fresh 300-second window. That can multiply a bounded pilot into a 20-minute stalled worker; the shared deadline keeps the operator's budget and liveness expectation true. |
| 2026-08-02 | **A Forge run directory is single-writer.** `RunLock` atomically owns `runs/<run-id>/.run.lock`, rejects a live PID, and removes a stale lock after a crashed process is gone. | Several local CLI children read the same `planned` checkpoint and spent concurrently when their parent terminal returned early. Atomic checkpoint writes preserve one process's state, but cannot make two authors one run; exclusion must happen before paid work. |
| 2026-08-01 | **Production course release is one atomic, attested human action — never a direct `courses.status` PATCH.** Migration `0031_course_release_gate.sql` adds service-role-only `course_release_verifications` and `release_course(course_id)`; Forge now rejects partial locale execution at both run entry points and `verify:course` reruns every deterministic gate over every release-ready document before recording a fresh attestation. Core's Content publish action calls the RPC and writes the audit log only after success. | Learner visibility requires every hierarchy level to be published. The previous Core action changed only the course row, which could claim “published” while every child stayed draft/review and invisible. The RPC locks descendants in one transaction, rejects missing hierarchy/locale, ineligible lessons and a verification older than the latest document update, then publishes all levels together. It preserves the one human moderation gate (§1.9) without allowing a partial or stale bundle to reach learners. |
| 2026-07-30 | **gamegen's open approach question RESOLVED: 8 prebuilt, hand-written, deterministic game mechanics (code) skinned per instance by a generated `GameDocument` manifest (data). Fully-generated HTML5 games REJECTED** — spec `/GAME_ENGINE.md`, mechanic set CLOSED at 8 and growable only through its §12 extension protocol | Three independently disqualifying reasons. (1) §1.9: a novel program per instance is an unreviewable surface aimed at children — generated *code* cannot be moderated the way generated *content* can, and "sandboxed" is a containment claim, not a safety claim. (2) No shared quality bar: N generated engines = N feel-and-fairness, accessibility, §1.11-responsive and motion implementations; with 8 hand-written mechanics there is exactly one of each, and improving `runner` once improves every `runner` game ever generated, retroactively. (3) Rewards are derived by server replay, which requires a simulator the server also has — generated code cannot be replayed, cannot be bot-tested for winnability before publish, and cannot be trusted with XP, which would leave client-reported scores as the only reward signal. The question had been OPEN in `gamegen/AGENTS.md` since the v2 scaffold, which is why `games/` never advanced past `<SectionComingSoon>` |
| 2026-07-30 | **A game's reward is the SERVER's replay of the input log, never the client's number — and "accept the client score after a plausibility check" was rejected outright.** The client posts `{ run_id, seed, input_log, duration_seconds, local_date }` with no score field; Core re-runs the mechanic's simulator through the single shared `replayGame()` and derives score/stats; a log that violates its bounds (non-monotonic ticks, unknown action, event count over `validation.max_events`, tick past `maxTicks`) is `422 RESULT_REJECTED` with no reward | A plausibility check on a self-reported score only *bounds* the exploit — it cannot distinguish an honest play from a fabricated one, so every accepted number is still a claim the platform chose to believe, and the ceiling becomes the new cheat target. Replay removes the claim from the protocol entirely: there is nothing to inflate because nothing inflatable is transmitted. It also pays for itself twice — the same simulator the server replays with is the one the generation pipeline's bot-gate uses to prove a game is winnable before publish. The cost is the determinism contract below, which is a bounded engineering constraint rather than an open-ended trust problem |
| 2026-07-30 | **The §1.5 Arcade mission line corrected — "**Personalized** minigames bound to learn/ concepts" was never true and had to stop implying otherwise** | Games are generated from the CURRICULUM, not from children: prompts carry only the blueprint, catalog concept context, age TIER and character canon, and there is no per-child generation path anywhere in the design (adding one would need explicit human sign-off against §1.9). Leaving "Personalized" in a LOCKED table read as a promise the platform must not make — the exact class of doc drift where an agent later "implements what the map says" and ships per-child prompting. Concept binding (a game reinforces one `topic_path`) and adaptive easing inside the simulator deliver the pedagogical intent with zero minor PII leaving our infra |
| 2026-07-30 | **`game_complete` returns to the `learning_events` vocabulary that `0025` deleted as dead, joined by a new `game_start`, plus a nullable `game_id` column with deliberately NO foreign key** (`0028_game_insights.sql`, via the 0024/0025 drop-and-re-add CHECK mechanism) | `0025` removed `video_play`, `game_complete` and `task_complete` because nothing could emit them and "declared-but-never-emitted events are how a dashboard silently lies with empty series" — and it wrote its own re-entry condition into the migration: *"They come back in the same commit as the features that emit them."* This is that commit; `game_complete` is no longer dead. §1.9 review of the addition: the vocabulary stays a closed CHECK list, the payload stays a numeric `value` with no free-text column by construction, kid rows stay behind the existing fail-closed consent gate (no active consent → no row; a failed consent lookup → no row), and `game_id` omits the FK for the same documented reason as `lesson_id` — an analytics row must survive an identity/content migration that the referenced row does not. `game_start` is distinct from the pre-existing `game_open` (opening a hub card vs. actually beginning a session) |
| 2026-07-30 | **Simulators may not use the transcendental `Math.*` functions.** `Math.sin/cos/tan/atan/atan2/exp/log/pow/hypot/cbrt` and `**` with a non-integer exponent are BANNED in every `simulate.ts`; allowed arithmetic is `+ - * /` plus `Math.sqrt/abs/min/max/floor/ceil/round/trunc/sign`, and `core/mathd.ts` supplies `dsin/dcos/datan2/dpow` from fixed-term polynomial series built only from the allowed ops. Fixed integer tick `TICK_MS = 50` (never delta-time), randomness only from the injected mulberry32 seeded PRNG, deterministic iteration order | ECMAScript leaves the transcendental functions **implementation-defined** — the browser's V8 and a different Node build are permitted to disagree in the low bits. Because the reward path is a bit-identical replay of the player's log, one divergent bit in a projectile arc is a `RESULT_REJECTED` for an honest child, on a machine we cannot reproduce. The ban is therefore not a style preference but the integrity of the XP economy; the same rule is what makes the pre-publish bot-gate's verdict trustworthy. It also caps how far a mechanic's physics can go, which is one of the three reasons `flyer` is 2.5D instead of 6DoF (`/GAME_ENGINE.md` §13) |
| 2026-07-30 | **The mechanic bots left the `Simulator` interface for a sibling `bots.ts`, and Core's `MechanicSimSlice` has no bots field either** — `bots.ts` is imported only by gamegen's winnability gate and by tests, never by `register.ts`, `components.tsx` or anything else on the client import graph, and `registry.test.tsx` walks the real import graph and fails on that edge by name | `bots.perfect` returns the exact `GameInputEvent[]` Core replays to grant XP, and a maximal log is short. While `bots` was a member of `Simulator`, every mechanic's `register.ts` — the module `MECHANIC_LOADERS` dynamic-imports, i.e. the ROOT of that mechanic's lazy chunk — pulled an optimal headless player into the JavaScript the browser downloads. Anyone could lift it out of the emitted chunk, run it against the document the API had already served them, and POST a maximal input log without playing a tick; replay-derived rewards exist precisely so the client cannot assert a score, and shipping the optimal player hands that back. Keeping `bots` OFF the shared interface makes "no bots in the browser" the default rather than a rule someone has to remember — there is no field to helpfully fill in |
| 2026-07-30 | **Passing a game is a three-way conjunction and XP is gated on it: `score >= pass_score` AND a non-empty input log AND `score > idleScore`, where `idleScore` is what the same document and seed score for an EMPTY log. No proportional credit below the bar. And the SEED is the server's** (`seedFromString(run_id)`); the body's `seed` is only compared against it, a mismatch being `422 RESULT_REJECTED` | Several mechanics award points for state the simulation reaches on its own — an audit measured 23..45 points for an empty input log across six manifests — so partial credit paid real XP into a child's `learning_stats` for opening a game and submitting nothing. Deriving the floor per replay from the content itself needs no per-manifest authoring and cannot be forgotten by the pipeline, and it holds even for a manifest whose `pass_score` was written below what idling reaches: the §9 winnability gate bounds `pass_score` against the *random* bot, never against doing nothing at all, and the sidecar carries no floor either. Separately, a client that chose its own seed could re-roll against the document it had already been served until it drew a favourable layout — a seed-shop the replay could never detect, because every seed replays honestly |
| 2026-07-30 | **"A run is paid exactly once" is enforced by the DATABASE, not by the application check** — migration `0029_game_attempt_integrity.sql` adds `UNIQUE (user_id, game_id, run_id)`, the attempt insert uses `ON CONFLICT DO NOTHING`, and Core credits only when the insert actually returns a row | The pre-replay check on recorded attempts is necessary but cannot be sufficient: the window it must close is the window between its own read and its own write, so two concurrent POSTs both read zero attempts and both credit. The unique index is the backstop that makes the invariant true under concurrency, and it deliberately gives an honest double-submit the same `422 RESULT_REJECTED` / `run_already_recorded` answer — the run was already credited, so this one credits nothing and no write follows. Scoped to `(user_id, game_id, run_id)` rather than `run_id` alone so one account's row can never deny another account credit |
| 2026-07-30 | **gamegen's localize string-freeze skips whole CONTAINER keys, not a list of field names** — `sprites`, `background_url`, `palette`, `sfx`, `bgm`, `config`, `mechanic`, `topic_path`, `image_slot`, `icon` and every id — with a schema-derived coverage test proving both halves (no visible string escapes translation, no non-visible key is translated) | A different shape from coursegen's field-name list, and necessarily so: `skin.sprites` is a `Record<string, string>` whose keys are arbitrary per-mechanic sprite slot ids, so the leaves cannot be enumerated and the whole container has to be skipped. This is load-bearing because `illustrate` runs on the es-MX document BEFORE the freeze so one image serves three locales — if a container leaked into translation, the URLs the other two locales inherit would come back as prose. Forge learned the same lesson the expensive way when a `mode: "typed"` enum returned as pt-BR text and broke the contract |
| 2026-07-30 | **`generate:full` splits ONE illustration-lane budget between Forge and Arcade (`--lanes 3` → Forge 2, Arcade 1) and refuses a paid run without an explicit `--confirm`; Arcade's `publish` can only ever write `status='review'`, enforced by `upsertGame()` having no status parameter at all** | Prism fronts a SINGLE DashScope quota and has no serialization of its own — its retry ladder slows a contended caller but never removes the contention — and both pipelines illustrate sequentially inside a slot, so in-flight image calls equal each pipeline's slot concurrency. Run together at their defaults that is 4, strictly more contention than either was tuned against; one shared budget set by the parent process is authoritative over each service's own `.env` (a parent-provided env var wins over `--env-file`). The `--confirm` gate is `agent/core/BOUNDARIES.md` #8 applied twice over, since the script spends on two paid pipelines at once. And making `review` a module constant instead of a parameter is what turns "never auto-publish" from a convention into something with no code path — including for a regenerated game that a human had already promoted, which is downgraded back to `review` on purpose, because new unreviewed content behind an old approval is unreviewed content |
| 2026-07-29 | **Kid usage telemetry is consent-gated through the guardian link, fail-closed at BOTH ends (client beacon + Core ingest), with a schema that cannot carry free text** — and the alternative (a behavioral tracker on kid sessions) stays prohibited | Owner directive: deep knowledge of the end user is existential. §1.9 + COPPA/LGPD/LFPDPPP make collect-first-consent-later the one implementation that could kill the product in all three markets; the platform already required a verified guardian per kid, so consent is a toggle away rather than a legal project. The deepest learning data (attempts/hints/scores) was ALREADY first-party — the calibration report proved it by flagging a miscalibrated exercise from existing rows on day one |
| 2026-07-28 | **Redis is a degradable dependency — never a boot dependency, never a request dependency.** Core `listen()`s first and connects in the background; both limiters carry `passOnStoreError: true` (fail open); `GET /health` is mounted ABOVE the limiter | node-redis applies its reconnect strategy to the INITIAL connect too, so `await connect()` against an unreachable server neither resolved nor rejected: `listen()` was never reached, the catch's `process.exit(1)` was unreachable, and Railway's ON_FAILURE restart never fired because the process stayed alive. After boot the opposite failure applied — a store error is fail-CLOSED by default, so a Redis outage 500'd every route including `/health`, failing the healthcheck and taking Core down over a degraded *rate limiter*. §1.14 still mandates the limiter; this governs only how it degrades. Rate limiting is an availability control, not authorization — auth abuse stays bounded by GoTrue's own throttling |
| 2026-07-28 | **A read whose result is written back must distinguish "upstream did not answer" from "zero".** `getLearningStatsForUpdate` returns `LearningStatsForUpdateRow \| null` and `POST /learn/lessons/:id/complete` 502s on `null`; the display-only readers keep collapsing to `ZERO_STATS` | `supabaseRest` returns `null` on any non-2xx, and the completion route is a read-modify-write: a pooler blip or statement timeout collapsed into a zeroed row, then the following PATCH wrote deltas-from-zero back — erasing `xp_points`, `minutes_learned`, `lessons_completed`, `streak_days` and `longest_streak`, silently, behind a 200. `minutes_learned` and both streak columns exist nowhere else, so the loss was permanent. An empty result set is still `ZERO_STATS` (the 0006 trigger guarantees a row). Regression test proven to fail — `expected 200 to be 502` — with the guard removed |
| 2026-07-28 | **An HTTP status crossing a service boundary is a retry instruction, not decoration** — Prism answers 502 only for transient codes (`IMAGE_TIMEOUT`, `IMAGE_RATE_LIMITED`, `IMAGE_PROVIDER_ERROR`, `IMAGE_DOWNLOAD_FAILED`) and 422 for terminal ones (`IMAGE_BAD_RESPONSE`, `IMAGE_VERIFICATION_FAILED`); Forge rethrows `BudgetExceededError` instead of swallowing it | Forge's `withTransportRetry` retries 5xx and gives up on 4xx, so a blanket 502 made it re-request deterministic failures — up to 12 paid `qwen-image` generations per target for a result that can never differ. The mirror-image bug sat on the other side: the swallowed `BudgetExceededError` defeated `FORGE_MAX_USD_PER_RUN` entirely, so a run past its ceiling kept walking every remaining target, paying for each, and shipped lessons with silently missing art. A paid-API cost control only holds if both the status and the kill switch are honoured |
| 2026-07-28 | **Constant-time secret comparison runs on fixed-width SHA-256 digests, never on raw user-supplied buffers behind a length pre-check** — the internal-key middleware in all 7 services | The guard compared JS string `.length` (UTF-16 code units) before `Buffer.from()` (UTF-8 bytes), so a header of the same character length containing any byte ≥ 0x80 yielded a longer buffer and `timingSafeEqual` THREW `RangeError` — surfacing as a 500 HTML page ahead of the envelope handler instead of a 401/403 envelope (§1.6). Hashing first makes both sides equal-width by construction and removes the key-length side channel the pre-check itself leaked. §1.14 already mandated constant-time comparison; this fixes *how* |
| 2026-07-28 | **`secrets:check` recognises a declared-placeholder convention** (values BEGINNING with `test-`/`dev-`/`fake-`/`placeholder-`/`replace-`/`example-`/`local-`, or `replace-me`), and the repo-wide gates moved into their own path-filter-free `repo-gates.yml` | §1.14 forbids relaxing a Zod schema for tests, so a fixture for a `z.string().min(16)` credential must itself be 16+ chars — exactly what the scanner's generic pattern flags. The two rules were in genuine conflict and the scanner was losing; the exemption is narrow enough that a real credential cannot hide behind it without being renamed to announce itself as fake. Separately, `docs:check` and `secrets:check` had only ever run inside `database-ci.yml` (`paths: database/**`), making them unreachable for the exact commits they exist to catch — a secret hardcoded in `backend/`, or an AGENTS.md edit not mirrored to CLAUDE.md. Verified both directions: passes clean, still catches a planted secret |
| 2026-07-28 | **A Realtime RLS policy is only half the wiring — publication membership is the other half, and it is now a §1.5 documented exception with three standing constraints** (zero PII, JWT-authenticated subscription, staff-gated RLS). `generation_runs_live` is the only table in the exception | Verified on the live Vault that `supabase_realtime` had zero tables: `0019`'s policy authorized a subscription that would have received no events forever, and the failure is invisible — the channel reports connected. Codified in `0022` so the next table added to the exception cannot repeat it |
| 2026-07-28 | **Migrations are applied to production BEFORE the merge that deploys the code reading them** — never after, never concurrently | No CD workflow applies migrations, so merging gives no ordering control; 0012–0022 are purely additive, so old code keeps working against the new schema and there is no reason to deploy code first. The wrong order fails silently (`supabaseRest.ts` returns `null` on non-2xx → 0 XP / empty lesson tree, no error), which is strictly worse than a loud break |
| 2026-07-26 | **Fire-and-forget generation is the production contract, with ONE human gate** — `generate:track` runs a whole course unattended; audiogen partial failures stay retryable (unversioned manifests re-enter the batch), `narrate:all` gained `--course` scoping + honest exit codes, a down Vault THROWS instead of "0 pending". The only human step is the `db:publish-course` flip (§1.9, non-negotiable). Generation telemetry persists to Vault (0017: runs/slots/tracks, service-role-only) → staff console `/admin/generation` (KPIs, failure heatmap by stage, judge-dimension bars, duration chart, slot table). Level-2 improvement loop shipped: `rubrics.jsonl` per run + `npm run coach` (offline, free, PROPOSE-only — humans apply). COURSE_ENGINE.md §4.0 now carries mermaid diagrams of the per-slot pipeline, slot state machine and the end-to-end chain | Owner directive: "dispara y olvida" for production generation + a permanent evaluative record of how the agentic system behaved, with §1.9 keeping human moderation as the single blocking gate; coach stays propose-only because judge scores have a measured ±0.4 noise floor and an autonomous optimizer would Goodhart them into kid-facing content |
| 2026-07-26 | **Multi-agent frameworks (LangGraph/CrewAI/AutoGen) NOT adopted — their proven patterns re-implemented in our own TS instead** (commit 7d6a7f2): stage-aware checkpoint retries, truly-free `--dry-run`, `generate:track` coordinator with a composing global budget, revise-loop early stop. Voice garnishes shipped alongside: tier-gated light colloquialisms per locale + sparse emojis with emoji-proof TTS (gate 7 + audiogen strip) | Researched in depth: CrewAI is Python-only with default-on telemetry and hidden prompt scaffolding (unacceptable under §1.9); AutoGen is officially in maintenance mode (successor MAF is also Python/.NET); LangGraph.js is MIT/self-hostable but Forge already implements its useful capabilities — migration = risk without capability gain. Autonomous group-chat orchestration measured by the field at 3-5x token cost with nondeterministic convergence: wrong tool for a fixed-stage pipeline. An adversarial review workflow over the diff found and fixed 10 real defects pre-commit (2 reproduced empirically) |
| 2026-07-25 | **Tutor IA (Oracle) DESCOPED por el dueño** — no se desarrolla de paso; requiere sesión dedicada. La implementación v1 de Money Moments fue construida, verificada y REVERTIDA (referencia en `git show 67dfb6e`); el diseño completo quedó en `ORACLE.md` | Complejidad: el tutor es una superficie kid-facing de alto riesgo (§1.9) que merece su propia sesión con evaluación dedicada; el resto del programa edtech se conserva |
| 2026-07-25 | **scene_tap (hotspot-scene exercise type) REJECTED after its mandated smoke test** — do not re-attempt without a new annotation source | qwen-vl-plus failed 2/2 grounding smokes on representative LF stylized scenes with DIFFERENT failure modes (a repetition loop hallucinating 200+ out-of-bounds coin boxes; a JSON-structure collapse under hard json_object+max_tokens constraints). A mass pipeline cannot depend on it, box-geometry correctness has no cheap automatic verifier, and hand-authored hotspots contradict the automated-generation requirement. Revisit if a grounding-specialized model lands in our stack |
| 2026-07-25 | Generated images stored as **WebP q82** (Prism transcodes post-verify, pre-upload); full corpus backfilled + old PNGs deleted | Measured on the live corpus: −96.9%, visually transparent at 1:1 (Depot 1.5 GB → 51 MB); verifier keeps seeing original PNG bytes; owner directed the storage-optimization pass |
| 2026-07-25 | TTS audio stays **MP3 24 kHz mono 48 kbps** (owner decision after measured trade-off) | Source model emits 24 kHz mono; mono plays centered in both ears; upsampling adds no information; CBR weight depends on bitrate×duration only |
| 2026-07-25 | Global **speech_assets** cache (Vault 0015, mirror of picture_assets): an identical TTS request never pays twice | Manifest-only dedup re-paid on wiped manifests / new segment ids / cross-lesson repeats; key = JSON tuple (text, voice, model, language_type, bitrate), post-normalization |
| 2026-07-25 | Batching/chunking of LLM calls REJECTED on measured data; the cost lever is DeepSeek's automatic prefix cache (prompts assembled static-first + cached tokens priced/telemetered) | 32-ledger audit (6,107 calls): judge independence is load-bearing, batch retry blast radius eats the saving, 1 truncation in 1,164 calls; prefix cache captures the same dollars with zero validation churn |
| 2026-07-20 | **Pulse** (`pulse/`) added to LOCKED §1.2/§1.5: self-hosted Plausible CE + Umami v3 + Uptime Kuma on Railway | Owner sign-off in-session. Analytics + health for the admin console; COPPA-safe (self-hosted, Plausible = no PII); verified research (25/28 claims confirmed vs primary sources) |
| 2026-07-20 | Umami behavioral capture (incl. replay/heatmaps) restricted to marketing + parent/admin surfaces; NEVER kid sessions | §1.9 outranks feature scope — rrweb replay records DOM/inputs (minor-PII risk). Plausible covers kid-traffic KPIs safely |
| 2026-07-20 | Dependabot (native) over hosted Renovate app for Pulse image auto-bumps | Zero external install, PRs trigger CI, patch automerge via fetch-metadata; Renovate = revisit trigger if per-package rules outgrow Dependabot |
| 2026-07-20 | Analytics/health data brokered by Core `/api/v1/admin/*`; no Plausible iframe/shared links | §1.5 browser-only-calls-Core invariant; tokens stay server-side; envelope + caching (600 req/h Stats API limit) |
| 2026-07-11 | Total v2 rewrite on `littlefounders_v2`; v1 frozen on `main` | Radical platform change; main = rollback path |
| 2026-07-11 | All services TypeScript + Express (dropped Python/FastAPI) | One toolchain, shared types, sibling-proven patterns |
| 2026-07-11 | Supabase **self-hosted on Railway** (full stack) replaces Supabase Cloud | Control + one infra provider; accepted ops cost (~$20-40/mo, manual backups) |
| 2026-07-11 | 8 independent npm packages, **no workspaces** | Vercel/Railway deploy isolation; per-service CI path filters |
| 2026-07-11 | 6-role model (universal/parent/kid/bigfounder/admin/superadmin) | Low-friction signup + verified upgrade paths |
| 2026-07-11 | `agent/` first-class agent environment (core/tools/prompts/workflows) | Sibling lacked it; kills context repetition across sessions |
| 2026-07-11 | English for all project documentation | Team + agent consistency |
| 2026-07-11 | CD deferred; CI first. Platform-native deploys later (Vercel Git, Railway watch-paths) | Nothing to deploy yet; avoid v1's CLI-in-Actions complexity until needed |
| 2026-07-11 | Email engine deferred (candidates: Postal/Maddy/Haraka/Stalwart) | Contract stubbed in Courier; decision when implementation starts |
| 2026-07-11 | i18n locales locked: en-US, es-MX, pt-BR | Product decision |
| 2026-07-11 | DiceBear `avataaars` for avatars | Product decision |
| 2026-07-11 | v1 characters (Dina, Liruf, Dr. Rho, Zara Vex) carried into v2 | Brand continuity; archived + restored into frontend |
| 2026-07-11 | `.github/skills/` stays untracked (via `.github/.gitignore`) | 13MB third-party content; local + `.claude/skills` mirror suffice (v1 precedent) |

| 2026-07-11 | DESIGN.md v1 authored from `template/` mockup — "LittleFounders Tactile" (claymorphism, Quicksand+Nunito Sans, indigo primary, closed lf-* type scale, 4 clay shadow tokens) | Mockup approved by Jesús; standardization mandate: nothing outside tokens |
| 2026-07-11 | Frontend token implementation: CSS vars (light/dark) + Tailwind theme + `src/components/ui/` kit (Button/Card/IconChip/ProgressBar/Badge/StatCard); views re-skinned | DESIGN.md §Components; verified in browser both modes |
| 2026-07-11 | Desktop+Mobile responsiveness codified as a NON-NEGOTIABLE invariant, AGENTS.md §1.11 (own weight class alongside schema/child-safety invariants) | Jesús: platform must adapt correctly to both, space must be used deliberately; prior docs only implied it in prose |
| 2026-07-11 | Anti-hallucination & instruction-fidelity rules added, AGENTS.md §1.12 (verify-before-asserting, no fabricated specifics, decompose+check off multi-part instructions, evidence required for "tests pass"/"CI green" claims) | Jesús: harden agents against hallucination and silently dropping parts of instructions |

| 2026-07-11 | Marketing site v1 shipped: `/` landing (mini-pitch: problem→solution, S&P FinLit fact, human motivation, reach & goals), `how-it-works`/`families`/`faq` (coming soon), `legal/terms`+`legal/privacy` (under construction), footer contact informame@littlefounders.ai | Jesús's spec; brand assets recovered from main (logo-main.png, Hero-Families.webp) + 2 verified Pexels photos in `frontend/public/marketing/` |
| 2026-07-11 | Added `dark-secondary` token trio to DESIGN.md + CSS | Contact/footer links (`text-secondary`) were unreadable on dark surfaces — caught in §1.11 dark-mode verification |

| 2026-07-11 | **Composition-fidelity rule added as DESIGN.md §0** after the landing shipped visually unlike the mockup: template/ mockups govern composition (structure, rhythm, shapes); DESIGN.md governs values; mockup wins conflicts and DESIGN.md gets amended. Landing rebuilt to the mockup recipe; corrections: buttons are rounded-md chunky w/ 4px bottom border (NOT pills), cards carry the 1px white clay border, icon set is Material Symbols (not Lucide/emojis), hero gradient text is the one gradient exception | Jesús flagged the mismatch; root cause: agent designed "from tokens" instead of replicating the approved mockup |

| 2026-07-11 | Marketing site polish per Jesús feedback: removed the app-shell placeholder routes (`/learn`…`/profile`) — only the shipped marketing pages remain until each section is actually built; CTAs point to `/` meanwhile. Removed hero badge and the "built for families" trust strip. Custom `Dropdown` component replaces the native `<select>` everywhere (DESIGN.md: native pickers now prohibited); language switcher shows a country flag + the language name localized into the current UI language, never a raw locale code. `useTheme` extended to 3-way `auto/light/dark` with a live `prefers-color-scheme` listener when `auto`; new segmented `ThemeToggle` component. Header/footer logo swapped to `logo-main-trimmed.png` (alpha-bbox crop) — the original PNG's wordmark occupied only ~23% of its own canvas height, so sizing by CSS height alone couldn't make it look bigger | User: no browser-native pickers, bigger logo, simpler theme control matching v1's 3-way pattern, drop badge/trust content |

| 2026-07-11 | **Motion system codified** (DESIGN.md §Motion): closed set — `--lf-ease` + 5 duration tokens, 5 recipes (route transition keyed on pathname, `<Reveal>` scroll reveal w/ ≤3×80ms stagger, `.lf-pop` panels, press physics, arrow nudge), `.lf-float` sole infinite animation, all reduced-motion safe. Applied across the marketing site | Jesús: fluid/organic transitions + a quality standard for future iterations |
| 2026-07-11 | **DESIGN.md §Screen Recipes added** — all 7 template/ screens distilled into our token vocabulary (recurring patterns: app sidebar w/ mobile bottom-nav, icon tiles, stat cards, progress bars, pills, sunken wells + per-screen recipes: dashboard, lesson, games hub, profile, catalog, assessment, landing). `template/` now deprecated as build reference; deletable with sign-off once all recipes ship | Jesús: make template/ obsolete behind a solid self-sufficient design system |

| 2026-07-11 | UI/UX polish round 2: title typography swapped Quicksand→**Baloo 2** (Duolingo/Brilliant-adjacent, chunkier brand character, Nunito Sans stays for body); language switcher trigger now flag-only, flag+localized-name only in the open panel; palette expanded with a signature `delight` magenta + `-strong`/`on-*` trios for success/warning/error, DESIGN.md gains a NON-NEGOTIABLE **Action Color Contract** (primary=main action, secondary=alternative, success=positive completion, danger=destructive, warning/accent/delight=decorative-only never a button fill), `Button` gains `success`/`danger` variants; scroll resets to top on every route change (`useLayoutEffect` + explicit `behavior:'auto'` override); `frontend/vercel.json` SPA rewrite added so direct-loaded/refreshed routes (`/faq`, `/legal/terms`, etc.) don't 404 on Vercel | Jesús: more brand-distinctive titles, color-psychology standard for all future actions, page always starts at top, fix Vercel deep-link 404s |

| 2026-07-12 | **Design system replaced wholesale: "LittleFounders Tactile" (claymorphism) → "LittleFounders Arcade"** — Brilliant.org-style gaming clarity (analyzed from the local `Clone` reference project: Figtree extrabold/tight type, blue #456dff / papaya #ff775c / pear / ink palette, full pill buttons with 1px press, rounded-3xl-feel cards, full-bleed navy `inverse` bands, 1200px container) fused with **liquid glass** (`.lf-glass`/`.lf-glass-deep` frosted panels + `shadow-glass*`/`shadow-pop`, @supports fallback). Action Color Contract redefined: papaya `accent` IS the CTA fill; blue = links/focus/info. Real designed dark mode (navy world, all tokens re-derived). `template/` DELETED — DESIGN.md §Screen Recipes is the sole composition source. Marketing site fully migrated | Jesús: abandon claymorphism 100%, adopt the Brilliant gaming style from `Clone` + liquid glass touches |
| 2026-07-12 | **i18n fragmented per route area** — each locale is now a directory `src/i18n/<locale>/{common,marketing,errors}.json` assembled in `i18n/index.ts` (fragment name = key prefix; `common` spreads at root, so `t()` key paths are unchanged); `check-i18n.sh` now verifies file-set parity AND per-file key parity | Jesús: platform will have many pages; one monolithic JSON per locale doesn't scale |

| 2026-07-12 | **Vault stack source = pinned `supabase/supabase` clone (NON-NEGOTIABLE)** — `database/SUPABASE_VERSION` pins the latest functional/approved upstream release (v1.26.07, published 2026-07-09); `scripts/sync-supabase.sh` materializes a blobless sparse clone of `docker/` at `database/supabase/` (gitignored); `scripts/local-stack.sh` delegates to upstream tooling (`run.sh`, `reset.sh`, `utils/generate-keys.sh` — secrets generated per-machine, never committed). Local dev AND production run this exact stack; DEPLOYMENT.md pin table mirrors the release's docker-compose image tags; upgrades = bump pin → sync → reset-twice + gates → update pin table, same commit. Supabase-CLI-based local dev (`supabase start`) replaced; CLI kept only for `db:types` via the Supavisor pooler | Jesús: clone supabase/supabase in database/, keep it permanently on the newest approved release for security; DB is foundational and must be conceived to scale |
| 2026-07-12 | **`0003_auth_bootstrap.sql`** — delta migration: `auth.users` INSERT trigger auto-creates profile + grants `universal` (§1.4 default role) so GoTrue signup yields a usable account with no backend round-trip; role grants/revokes audited into append-only `audit_logs` by trigger; `touch_updated_at` on profiles/avatars; scale indexes on every RLS-helper/hot path (family_members.user_id, guardian_links kid + partial verified, audit_logs actor/created, tasks family/assignee, lessons course+position). Dev seed upgraded to UPSERT profiles (trigger now pre-creates them) | Prepares the Logins + Guardian work: signup path and role auditing enforced at DB level, indexes sized for growth |

| 2026-07-12 | **Guardian engine = local OCR (tesseract.js), photo NEVER stored** — Guardian is a stateless verdict service (`POST /internal/v1/verifications/parent`: multipart in-memory image + form fields → fuzzy name match w/ 1-edit OCR tolerance, multi-format birth-date search, expiry detection incl. INE `VIGENCIA <year>`, readability floor; never fails open; responses never echo OCR text/PII — test-gated). Core owns consequences: isolated `parent_verifications` table (0004: RLS self-read, service-role-only writes, stores form data + boolean checks ONLY on verified outcomes), idempotent `parent` grant, audit rows for failures (booleans only). Rate limit 5/h/user in Core. UI term = **Tutor** (GLOSSARY), role = `parent` — the locked 6-role model is untouched | Jesús's spec: advanced low-cost OCR, photo deleted the moment OCR runs, verification data in an isolated table; local OCR also keeps adult PII entirely inside our infra (§1.9 spirit) |
| 2026-07-12 | **Auth v1 shipped** — Core proxies GoTrue (frontend calls ONLY Core, §1.5): signup/login/refresh/logout/me; local HS256 JWT verification (`node:crypto`, zero deps); `/me` reads profile+roles with the USER's token so RLS does the authz; hand-rolled single-origin CORS (Authorization header, no cookies); GoTrue error normalization → new envelope codes (INVALID_CREDENTIALS, EMAIL_IN_USE, EMAIL_NOT_CONFIRMED, ALREADY_VERIFIED, DOCUMENT_UNREADABLE) with i18n ×3. Frontend: AuthContext (localStorage session, auto-refresh <60s-to-expiry), RequireAuth guard, signup handles both autoconfirm ON (local) and OFF (prod: confirmationRequired state). Social login reserved: Google first, then Discord/Facebook — GoTrue provider flow will extend `/api/v1/auth` without breaking shapes. New deps (sign-off flagged): tesseract.js + multer (Guardian), multer (Core) | Jesús: build login/ + signup/ with all-good-practices; social later; `universal` default with Tutor-intent field |
| 2026-07-12 | **UI kit grew form primitives + Auth recipe** (DESIGN.md same-commit): Field (rounded-md input w/ error/hint/trailing slot), Checkbox (custom, primary fill), FileField (dashed drop-well, no native look) + §Screen Recipes → Auth (centered trust column, one papaya CTA, privacy strip before the form, outcome states replace the card). Marketing CTAs now point to `/signup` | Auth forms needed primitives the closed kit lacked; §0 composition-fidelity requires recipes to exist before screens |

| 2026-07-12 | **App dashboard v1 (universal-first, role-scalable)** — `routes/app/navConfig.ts` is the single nav registry (item = key/path/icon/`requiresRole`); AppLayout renders desktop 280px gamified sidebar + mobile glass top bar & bottom tabs from it. Role-locked sections render LOCKED (lock chip/icon), never hidden — visible upgrade path; `RequireRole` guards routes (waits for `meLoaded` so refreshes don't mis-redirect); non-parents get a sidebar "Become a Tutor" card → /verify-parent. Sections live: Learn (home, `/learn` — published course cards via new `GET /api/v1/learn/courses`, RLS-scoped, skeleton loading, Dina empty state), AI Tutor + Games (in-app coming-soon), Tasks (parent-gated coming-soon). Post-login/marketing CTAs land on `/learn`; DESIGN.md Dashboard recipe expanded with sidebar anatomy; `dashboard.json` i18n fragment ×3 | Jesús: universal-first dashboard, gamified left sidebar, sections lock/unlock by role, built to scale to new features fast |
| 2026-07-12 | **Dev test users** — `npm run db:seed:users` (database/): 6 real GoTrue accounts, password `password123` — universal/tutor/kid/bigfounder/admin `@email.com` + `superadmin@littlefounders.ai` (**cannot** be @email.com — §1.3 domain trigger, verified live); Testing Tutor ↔ Testing Niño linked (Testing Family + VERIFIED guardian link). Dev seed also gained 3 published demo courses + 1 draft (RLS-visibility control) | Jesús: 6 test users, one per role, linked Tutor↔Niño for future kid-account flows |

| 2026-07-12 | **Profile platform** (migration `0005_profile_identity`): `profiles.username` (unique handle, format-checked in DB) + `profiles.cover` jsonb + `follows` table (RLS: you only write edges where you're the follower). **NO image uploads for avatars or covers — NON-NEGOTIABLE**: covers are 10 token-gradient presets (id in jsonb), avatars are DiceBear **Avataaars** option sets rendered locally by `@dicebear/core` (no external avatar API, nothing leaves the browser), and Core's strict Zod whitelists mean no binary path exists at any layer. Public profiles (`/@username`, session required) are served ONLY by Core with whitelisted fields (service role) — profiles RLS untouched. `locale` elevated to language-of-record: saved in settings, UI + future content follow it (AppLayout syncs i18n to profile.locale). Sidebar: collapsible (288↔88px `sidebar-sm` token, favicon brand, minimal chevron), locale selector removed from app chrome, user card shows the live Avataaars. New deps (sign-off flagged): @dicebear/core, @dicebear/collection. Gotchas hit: Vite doesn't hot-reload tailwind.config (restart needed for `sidebar-sm`); hand-rolled CORS was missing PUT in Allow-Methods | Jesús: perfil como Brilliant/Duolingo — avatar Avataaars público + portada solo-colores, @usuario, stats, compartir/invitar/seguir, settings con idioma persistente |

| 2026-07-12 | **Social graph completed: followers/following lists, blocking, birth date, real learning-stat fields** (migration `0006_social_and_stats`). Blocking is DB-enforced, not just app-level: `is_blocked()` is wired into the `follows_insert_own` RLS policy itself, so a blocked pair can't create a follow row even bypassing Core; Core additionally clears any pre-existing follow edge (both directions, service role — the reverse edge isn't the blocker's own row) the moment a block is inserted, and mutually 404s both public profiles (`resolveVisible()` — never distinguishes "doesn't exist" from "blocked you", by design). `learning_stats` (xp_points/minutes_learned/lessons_completed/streak_days) got its own bootstrap trigger + backfill, mirroring the 0003 pattern, so every account — including pre-0006 ones — has a row from day one; it's system-written only (no client route sets it), a deliberate placeholder until the lesson/game engines exist to feed it for real. `birth_date` is plain editable profile data for every user (kid, universal, tutor…), unrelated to Guardian's separate verified adult birth_date used only for the Tutor upgrade — conflating the two was the one thing to explicitly avoid here. One shared `UserListPage` component powers both the viewer's own followers/following (with unfollow) and public read-only lists, keeping the followers/following UI a single implementation. | Jesús: ver seguidores/seguidos, dejar de seguir, bloquear; fecha de nacimiento editable para todos; XP y minutos como stats reales; grids mobile/desktop definidos como no-negociable |
| 2026-07-12 | **DESIGN.md §Layout gained a formal "Grid Systems" subsection** — three closed categories (stat row 2/3/6, card grid 1/2/3, list rows single-column), each breakpoint-exact, gap held constant across breakpoints, incomplete last rows accepted by design rather than re-flowed. This directly answers "grids definidos... no-negociable" without touching root `/AGENTS.md` (already defers all frontend visual specifics to DESIGN.md, itself marked AUTHORITATIVE) — editing the root doc is a BOUNDARIES item requiring separate human sign-off, offered but not applied here | Jesús: gamified experience with defined mobile/desktop grids as a non-negotiable frontend requirement |

| 2026-07-12 | **Lesson Engine v1** — engine spec `/LESSON_ENGINE.md` authored as the authoritative engine doc (level 6): 56-type taxonomy in 8 families, envelope+payload+server-only-answer document contract, tap-first interaction rule, pedagogy principles P1–P7 (narrative first, visual before verbal, feedback teaches — tiered verdicts + REQUIRED per-distractor `rationale_md`, cheer-mode default for kids, earned celebration, calibration/metacognition types, real partial-credit algorithms). Implementation is family-sliced (`families/*/` own schema/grade/components/fixtures/register) so adding type #57 never touches another family; unknown types render an i18n "unsupported" card (old clients survive new content). Grading boundary is pluggable: local grader is dev-lab-only; Core grading + definitive content schema deliberately deferred to the content-schema session (0002 stays PROVISIONAL) | Build the niche, highly-gamified kids engine now (Jesús's /goal: ≥50 types, functional, documented for Forge) without prematurely locking the DB schema |
| 2026-07-12 | **Character Control rig** — the four canonical SVG characters gained standardized `lf-rig-*` limb hooks (WRAPPER `<g>` elements only — geometry/colors untouched; CSS `transform-box: fill-box` percentage pivots so no per-character coordinate math) + a unified `CharacterActor` API (7 emotions translated to each character's native `expression`/`mood` prop; 12 one-shot actions; celebrate/dance may loop only under the results overlay; reduced-motion falls back to emotion-only). RAF-owned head/pupil groups are explicitly off-limits to the rig (they'd fight the mouse-tracking loops) | Jesús: characters must "come to life" (jump, wave, gesture) with one standard control surface, appearance NON-NEGOTIABLE |
| 2026-07-12 | New frontend dep `zod` (validation is stack-of-record) + `font-code` monospace token (code CONTENT in lessons only) + DESIGN.md motion recipe 7 (lesson/rig one-shots) + Lesson screen recipe expanded to the full player anatomy | Engine needs runtime document validation and code-block styling; DESIGN.md must stay the single visual authority |

| 2026-07-12 | **New service `filebase/` (Depot, 4006) added to the LOCKED service map** — TS/Express + Railway volume, content-addressed (sha256) immutable objects, public GET only for PII-free media (lesson audio/images), all writes `x-internal-api-key`. Chosen over deploying FileGator (PHP — breaks the locked TS stack) and over Supabase Storage (owner wants a dedicated, reusable media service) | Jesús's explicit request: dedicated open-source-style storage microservice on Railway for lesson audio + any media |
| 2026-07-12 | **Content hierarchy became REAL data (0007)** — Aventuras→Saga→Tema→Lección as tables under `courses`, killing v1's triple-hardcoded taxonomy; `lesson_documents` splits `document` (client-safe) from `answer_keys` (service-role only, ZERO client policies — column-level secrecy via row absence); unlock rule computed ONLY in Core; XP is real (recomputed server-side from attempts, fed to `learning_stats`) | v1 post-mortem: hardcoded dicts, fake XP=25, client-derived locks were its biggest structural failures |
| 2026-07-12 | **TTS decision RESOLVED: qwen3-tts-flash (DashScope)** — Echo narrates client-safe documents only, encodes mono MP3 (small, quality-preserving), stores in Depot, idempotent by (unit, voice, text-hash); per-locale default voices env-mapped; CHARACTER voices land later via the same voice map; batch narration operator-triggered (paid) | Jesús: Qwen3-TTS as the engine; low-size audio; voices supplied before the course run |
| 2026-07-12 | **Forge = catalog-grounded generation, no RAG** — the curated catalog (768 blueprints) + `facts.yaml` + character canon ARE the ground truth (LF-Brain pattern); DeepSeek authors, Qwen judges (independent provider decorrelates errors), 5 deterministic gates run BEFORE any judge tokens (incl. Piaget forbidden-vocabulary per age tier×locale and programmatic RE-EXECUTION of money arithmetic against answer keys); generated lessons land as `status='review'` — a HUMAN publishes (blocking gate for kids' content); transport backoff is separate from schema-corrective retries; token+USD kill-switches per run | Cheap models demand maximum prompt/gate discipline (Jesús); child safety §1.9; LF-Business weaknesses #1/#4/#6 fixed by design |
| 2026-07-12 | **Educación Financiera curriculum: 8 adventures × 4 sagas × 6 topics × 4 lessons = 768 slots (~2 years at 1/day)** — arcs: trueque → ganar → ahorrar → gastar bien → emprender → confianza/anti-estafas → comunidad/impuestos-como-cooperación → capstone; adventures 1-5 tier1 (6-7), 6-8 tier2 (8-10) | Jesús: complete elementary financial literacy for a 6-year-old over 2 daily-lesson years |
| 2026-07-12 | Per-service `dev` scripts now `tsx watch --env-file-if-exists=.env` (Node 24 flag) — dev servers self-load their env | Backend booted env-less under the preview runner; fixes the class of failure for all 7 Express services |
| 2026-07-12 | **Spaced-review layer (COURSE_ENGINE §3.1): catalog 768 → 1,216 blueprints (768 teaching + 448 review, 37% consolidation)** — 3-rung ladder: per-saga "El Cofre del Repaso" (retrieval, days-later) + "Reto Entrelazado" (interleaving with earlier sagas/adventures, weeks-later) and a per-adventure review saga "La Gran Misión" (cumulative quest, months-later; adventure 8's is the graduation quest citing all 8 worlds). Review blueprints carry `kind` + `review_of` source paths (all 453 resolve); Forge subsets the palette, caps difficulty, injects source concepts + a hard "consolidate, never introduce" rule. Deliberately NOT a 2× duplication: >40% review saturates — growing further means growing TEACHING breadth (tier2 sagas 6→8 topics), recorded as the sanctioned path | Jesús: ampliar el catálogo con lecciones de repaso sin saturar, aplicando pedagogía/psicología (spacing effect, retrieval practice, interleaving) |

| 2026-07-13 | **Pedagogy hardening from external-reference analysis (os-taxonomy, Understand-Anything) + tier2 teaching breadth: catalog 1,216 → 1,312** (864 teaching + 448 review, 34% consolidation). Adopted from Marble's os-taxonomy (STRUCTURE only — its text is CC BY-SA and was not reused): `parent_check` per teaching topic (216 authored, es-MX, {{name}} placeholder — §1.9 parent-visibility in data form) and hard/soft `prerequisites` edges with human-readable reasons (43 curated, earlier-only-validated — deliberately modeling the cross-domain math→money edges Marble under-models; this DAG is the future Duolingo-style placement backbone, §3.2). Adopted from Understand-Anything (a code-comprehension tool, NOT a pedagogy engine — its "persona-adaptive" UI is only a visibility filter, recorded as the anti-pattern): the deterministic-script-before-LLM-judge two-phase gate → Forge gate 6 anti-genericity (title-restating prompts, ungrounded/short explanations, per-locale filler lists) + its tour "connect to previous step, concrete instance, never restate" discipline → connect-to-prior prompt rule (prior micro-objective threaded per slot) + `concreteness` judge dimension. Adult track groundwork (§3.3): `--register adult` REGENERATES the same blueprints as a parallel `<slug>-adultos` course (full palette, no Piaget ceiling, adult tone); kid register is always vocabulary-gated (not a toggle). Tri-lingual serving VERIFIED live (same lesson → "The wish begins"/"Nace un deseo"/"Nasce um desejo" as profile locale changes); locale-N extension path documented (§3.4). Forge tests 137 → 203; catalog:check 0/0 | Jesús: seguir subiendo calidad pedagógica, ampliar catálogo, curso también para adultos (placement en fase posterior), verificar tri-lingüe y escalabilidad de idiomas |

| 2026-07-13 | **The 3-course track completed — lessons platform CLOSED, ready to generate: 4,192 blueprints total, catalog:check 0 errors/0 warnings.** New courses authored complete-from-birth (review ladder + parent_check + prerequisites): **Emprendimiento** (`entrepreneurship`, 1,408 = 2 tier1 + 6 tier2 adventures; idea→producto→cliente→precio justo→ventas [kingdom theme debut]→equipo→ética→capstone founder; requires financial-education) and **Inversiones** (`investing`, 1,472 = 3 tier2 + 5 tier3; tiempo→interés simple→riesgos→metas/inflación→canastas/fondos/índice→interés compuesto→FRAUDES de inversión→capstone simulado; requires both). **tier3 (10-12) created**: investing vocabulary becomes concretely teachable (inversión, interés compuesto, acciones-como-pedacito, fondo, índice, diversificar, inflación); still bans apalancamiento/derivados/opciones/venta-en-corto/margen/trading/forex/cripto; simulations only, never transactional, a full adventure of fraud literacy (§1.9 posture). Migration **0008**: age_tier CHECK widened to tier3 + `courses.requires` jsonb (course-level placement edge) + course sequence seeded (FE published pos 1; entrepreneurship/investing draft pos 2/3; 0002-era placeholder courses archived — /learn now shows only the real track). Forge: catalog:check scans ALL curriculum dirs with cross-course requires validation (missing/cycle warnings) and tiers fully taxonomy-driven (216 tests). Generation cost estimate recorded in ROADMAP (~$225-320 full FE run, ~5-6 GB Depot, ~1.5-3 days dedicated; 1-saga pilot first) | Jesús: generar los cursos Emprendimiento e Inversiones siguiendo todo lo aprendido; dejar el apartado de lecciones terminado y funcional para ejecutar pipelines o pasar a otras funcionalidades |

| 2026-07-13 | **Pipeline QA-ready end to end, execution deliberately NOT triggered.** `GEMINI_API_KEY` added (coursegen/.env only, gitignored) and VERIFIED live (`GET /v1beta/models` → HTTP 200, `gemini-2.5-flash-image` confirmed available — nanobanana is unblocked). Forge gained `forced_types` (COURSE_ENGINE §4 addendum, coursegen/src only): a blueprint may pin its exact segment-type skeleton, skipping the plan-stage DeepSeek call — write/gates/judge/localize/images/publish still all run for real; validated at load time against the composed contract's 56 type ids. Echo gained the real per-character voice map (`audiogen/src/env.ts` `voiceFor()`, 12 optional `TTS_VOICE_<CHARACTER>_<LOCALE>` env vars): resolves per NARRATION UNIT — a `story_dialogue`'s own per-line speaker or a `story_scene`'s own character wins first, then the segment envelope's `narrator.character`, then the locale default; `AudioUnitEntry.voice` already stored per-unit, `contentHash` already keyed on voice, so idempotency and mixed-narrator lessons both fell out for free. New 4th course `first-lemonade-stand` (never in the real §3.1b sequence): 62 lessons — one `forced_types`-isolated lesson per each of the 56 LESSON_ENGINE types (verified 56/56 covered, 0 missing/unknown by independent script), 4 multi-type combo lessons (sequencing), one minimal `review_spaced` topic (review pathway) — `catalog:check` 0 errors / 19 shape-quota warnings (expected: a compact QA catalog doesn't match real-course grammar by design). Forge 223 tests, Echo 54 tests. Deliberately NOT executed this session — `npm run generate` (dry-run or not) makes real, identically-priced DeepSeek/Qwen/Gemini calls; character voice reference files are pending (owner to supply their location next) | Jesús: mini-curso de prueba para validar TODO el pipeline (texto, audio, imágenes, endpoints) antes de las corridas masivas, sin ejecutar todavía — deja todo listo |
| 2026-07-14 | **Software Quality & Robustness Policies (Backend & Mocks)**: Implementation of strict mathematical validation (Zod UUIDv4) across all backend traffic, test mock standardization to comply with these rules, use of `crypto.timingSafeEqual` for internal assertions, and highly restrictive CORS (allowed origins only). | Jesús: Establish a non-negotiable standard of software quality and best practices (robustness, traffic control, and strict type validation) to ensure AI agents do not introduce technical debt or fragile code in the future. |

| 2026-07-17 | **Production deployed, `main` becomes the only branch that deploys** — `littlefounders_v2` squashed into one commit on `main` (branch kept intact); domain convention `<service>-b2c.littlefounders.ai` (suffix) chosen over the pre-existing `b2c-api` prefix style; CD is token-authenticated CLI deploys from GitHub Actions (`railway up` / Vercel CLI), no native Git-App connection on either platform — supersedes the ROADMAP backlog item that assumed platform-native integration | Jesús: llevar todo lo trabajado a producción, un dominio `-b2c` por microservicio, sin conexiones nativas de GitHub en Railway/Vercel |
| 2026-07-17 | **Vault self-hosted stack trimmed to 9 of 11 upstream components** — `imgproxy` and `functions` (edge-runtime) not deployed; no app code calls Supabase Storage or Edge Functions (Depot/filebase is the real media path), and Railway has no equivalent of docker-compose's shared-volume dependency between storage+imgproxy. `db` and `kong` run from small custom Dockerfiles (`database/railway/{db,kong}/`) that bake in upstream's init SQL / declarative config, since Railway's Docker-image services can't bind-mount from the repo the way docker-compose does locally | Necessity: Railway's deploy model doesn't map 1:1 onto docker-compose's bind-mount + shared-volume patterns; reduces attack surface for two genuinely-unused components |
| 2026-07-17 | **`GOTRUE_MAILER_AUTOCONFIRM=true` in production, as an interim tradeoff** — email-server/Courier isn't deployed yet, so real email confirmation isn't possible; disabling autoconfirm with no working SMTP would make signup permanently unusable. Known gap: signups aren't verified against real mailbox ownership until Courier ships and this flips to `false` | Keeps the product functional (§1.14 "queden funcionales") while Courier is still undecided/undeployed; must be revisited before real-user launch |
| 2026-07-17 | **Postgres backups shipped, on an interim disk** — the original plan (dedicated Railway volume + service) was blocked when Railway's trial expired mid-rollout and refused new resource creation. Pivoted: `.github/workflows/vault-backup.yml` (daily + on-demand) runs `pg_dump` inside `db` via `railway ssh` and stores the dump on **filebase's existing volume** instead — a real separate disk/service from `db`'s, written to directly (not through filebase's media-only HTTP API). One restore drill performed for real (production dump → scratch database → row counts verified against live data → dropped) | Zero-new-resources path around the Railway billing block; RUNBOOK.md required this + a drill before real user data. Revisit for a dedicated backup volume once billing allows it |
| 2026-07-17 | **v1 leftovers cleaned up in Vercel + Railway** — removed 6 unused v1 environment variables from the `littlefounders-ai` Vercel project (`VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `LF_AUDIO_API_URL`, `LF_AUDIO_API_KEY` — confirmed zero references in v2 code before deleting) and the 2 stale `b2c-api` DNS records (CNAME + ownership TXT) left over from the old backend domain, already superseded by `api-b2c`. Verified after cleanup: all 4 live domains still 200, `b2c-api.littlefounders.ai` now correctly 404s. Other pre-existing DNS records unrelated to this migration (`analytics`, `auth` → old Supabase Cloud, `resend._domainkey`, `send`, Google Workspace MX) were deliberately left alone — out of scope, not created by this rollout | Jesús: limpieza y orden — sin "basura" de la migración anterior |
| 2026-07-17 | **Railway cost right-sized: Kong worker cap** (`KONG_NGINX_WORKER_PROCESSES=2`). Root-caused the ~$52.74/mo estimate — **97% of it is memory**, and **Kong alone was ~63%** (`nginx worker_processes auto` = one worker per host core ≈ 50 workers ≈ 5.8 GB RSS / 52 procs; measured live via `railway ssh`). Capping to 2 workers → ~280 MB / 5 procs (~95% less; verified locally that Kong stays healthy first). Baked into `database/railway/kong/Dockerfile` ENV + staged as a Railway variable. Projected: Kong ~$34→~$1.6/mo, whole bill ~$52→~$21/mo from this one change. Full lever list (Node heap caps, scale-to-zero for idle studio/gen services, the unused realtime/supavisor/storage) in RUNBOOK.md "Railway cost / right-sizing" | Jesús: costo alto para pocos usuarios; optimizar sin afectar rendimiento ni escalabilidad |
| 2026-07-17 | **Cost optimizations APPLIED after billing resolved.** Kong cap redeployed → measured live **192 MB / 6 procs** (from 5769 MB / 52). Node heap cap **deliberately skipped** — measured backend/Core at ~105 MB steady-state (the high bill figure was rollout-redeploy noise, not real usage), so a cap would add risk for zero benefit. **Scale-to-zero (Railway Serverless) enabled on 8 idle services**: studio, meta, storage, supavisor, realtime, coursegen, audiogen, gamegen (all confirmed SLEEPING / will sleep on idle timeout). Hot path kept always-warm: kong, auth, rest, db, backend, Redis, filebase, parent-id-check. Full signup→/me→login E2E re-verified through the optimized stack (201/200/200). Estimated bill **~$52.74 → ~$12/mo** (observed live: dropped to $11.98, ~77% down), no capability removed, all reversible | Jesús: pagos resueltos, aplicar todo lo pendiente al 100% |
| 2026-07-17 | **Deployment isolation gap fixed + platform deploy spec authored.** Audit found no per-service `.railwayignore` — since `railway up --path-as-root` re-roots the archive, the repo-root `.gitignore`'s path rules (`audiogen/src/samples/`, `coursegen/runs/`, `filebase/data/`) stopped matching, which is exactly why the first audiogen deploy timed out on 210 MB of samples. Added a `.railwayignore` to all 7 app services (backend, coursegen, audiogen, gamegen, parent-id-check, filebase, email-server) excluding deps/build/secrets/dev-bulk while KEEPING runtime data (curriculum, OCR traineddata). Verified: audiogen redeploys in ~40 s (was timing out). New root **`DEPLOYMENT.md`** documents the full production contract — topology, deployment isolation, networking/security posture, build params, token-based CD, honest scaling model, cost right-sizing, and a §8 new-microservice checklist — wired into doc_map/README + the new-service template & scaffold workflow | Jesús: confirmar seguridad/aislamiento/escalamiento/costo, y documentar params/specs para futuros microservicios |
| 2026-07-18 | **Courier email engine DECIDED + built: Haraka → Amazon SES relay.** Deep 6-candidate comparison (Postal/Stalwart/Maddy/Haraka/Plunk/Cuttlefish) against 5 criteria → Haraka (MIT, semver ≥1.0, Node) as a send-only relay to Amazon SES. Honest driver: no self-hosted engine solves "not spam" alone (Railway blocks outbound port 25, no PTR control) — self-host the control plane, rent SES's warm IP reputation. Built in `email-server/` (supervisor runs Haraka + the Express API in one container; `relay_internal` grants private-IP relaying; `smtp_forward` → SES; `nodes=1` to avoid the Kong-style worker blowup). Verified end-to-end locally to real SES (placeholder creds AUTH-rejected). Internal hop is plaintext-IP-trust (Haraka advertises AUTH only after STARTTLS, and GoTrue doesn't reliably accept a self-signed internal cert) — hardening to internal AUTH+cert is a tracked follow-up. NOT deployed; CD gated by `EMAIL_SERVER_LIVE` until owner wires SES creds/DNS | Jesús: clonar un servicio de email OSS con buen versionado/comunidad/reseñas/integración/no-spam; dejar listo para solo conectar y probar |
| 2026-07-18 | **Courier deployed + email system LIVE end-to-end; Google OAuth code-complete; Resend retired.** email-server is the 17th Railway service; GoTrue → Courier → Amazon SES verified in prod (`250 Ok`, real message-ids), `GOTRUE_MAILER_AUTOCONFIRM=false` so confirmation is real. Auth mail uses **branded, trilingual** templates hosted static on the frontend (`frontend/public/email-templates/`, en-US default + es-MX/pt-BR via `{{ .Data.locale }}`), wired through `GOTRUE_MAILER_TEMPLATES_*`/`SUBJECTS_*`. **Google social login** built through Core's `/api/v1/auth/oauth/*` broker (+ frontend button, `/auth/callback`, migration 0011 OAuth display-name bootstrap) — enabling it is owner-only (Google Cloud client → `GOTRUE_EXTERNAL_GOOGLE_*`). **Resend retired**: code/env clean, 3 leftover Vercel DNS records deleted. Security audit of the email/auth surface produced one real fix — Core `trust proxy: 1` (rate limits were keyed on the proxy IP = one shared bucket). Language selector chosen as GoTrue-native `text/template` conditionals (zero new infra) over per-locale template files | Jesús: verificar todo el sistema de correo, plantillas 100% con el estilo de LittleFounders (inglés + selector de idioma), limpiar Resend, auditoría de ciberseguridad, documentación al día, e implementar Social Login con Google listo para solo agregar credenciales |
| 2026-07-20 | **Google OAuth LIVE + full production push.** Trust-proxy fix + doc currency shipped through CD (all green); `EMAIL_SERVER_LIVE=true` activated Courier's gated CD (first run succeeded). Google Cloud OAuth client "LittleFounders v2 (GoTrue)" created in the pre-existing `littlefounders-auth` project (consent screen already External + In production from v1; basic scopes need no Google verification); split of duties held: agent created the client + set `CLIENT_ID`/`ENABLED` (public/non-secret), owner pasted `GOTRUE_EXTERNAL_GOOGLE_SECRET`. E2E verified on prod: button → Google → GoTrue → `/auth/callback` → dashboard; OAuth user with 0011-derived display_name, `universal` role. Gotchas: Google client secrets are ONE-TIME-VIEW (first secret lost → recovered via "Add secret"); Railway CLI `variables --set` CLOBBERS dashboard-staged changes (the owner's first secret paste was lost this way — keep CLI and dashboard edits strictly sequential) | Jesús: "Hay que poner en producción todo, con Google OAuth" |
| 2026-07-20 | **Google login forces the account chooser + prod cleanup.** `authorizeUrl()` gained a `PROVIDER_AUTHORIZE_PARAMS` map adding `prompt=select_account` for Google — verified LIVE that GoTrue forwards arbitrary `/authorize` query params straight through to the provider (raw `location` header showed `prompt=select_account` on the real `accounts.google.com` redirect), confirming the mechanism before shipping rather than assuming it from memory. Deleted the orphaned first Google client secret and the two stale rollout-verification test users from prod, zero orphaned `profiles` rows after | Jesús: "quiero que al dar iniciar sesión con Google me salga el 'Selector de cuentas'... acaba pendientes, actualiza la documentación" |
| 2026-07-20 | **`/login` and `/signup` moved out of `MarketingLayout` into a new bare `AuthLayout`** — no nav/footer chrome, just the (unchanged) centered `AuthShell` card, matching DESIGN.md's Auth recipe for real instead of only in prose. Surfaced and fixed a latent bug this would have hit: `useTheme()` converted from a per-`ThemeToggle`-instance hook to a `ThemeProvider` context mounted once at the app root, so `<html class="dark">` is correct on first paint on any route — including ones, like auth, that render no toggle at all | Jesús: "Limpia las paginas de login/ y signup/, deben de verse limpias con unicamente textos de bienvenida los recuadros y formularios. Centralizados." |

## Known Issues

- **Tutor scene assets are readable from production (RESOLVED 2026-08-17)** — Depot public objects now send CORS headers, so `GLTFLoader` can read them. Verified from the `https://littlefounders.ai` origin in script, not with curl: curl does not enforce CORS and passed nine times while the page was broken.
- **`diorama-b` stood its whole cast in the pond (RESOLVED 2026-08-17)** — walkability is now a baked per-island mask (`npm run assets:walkmask`) applied as a hard gate in `findStandingSpots`, with `npm run verify:placement` as the regression gate. A new diorama must have its mask baked and committed before it ships; `assets:walkmask` is NOT part of `assets:3d`.
- **Two reported placement defects did not exist (RETRACTED 2026-08-17)** — "the companion stands on a boulder" was a low-resolution crop in which the boulders sit between him and the camera, and "Dina overhangs the rim by 44 cm" assumed a sampling ring she is not placed on (measured: 4 cm of clearance, now 49 cm). Both had reached a committed doc and a published report before the headless harness existed to check them. Kept here because the failure mode — trusting a reading of an image as if it were a measurement — is the same one that produced the real find.
- **The vignette framing wastes almost half the frame at 375 px (open, 2026-08-17)** — measured on the capture, the island covers 61% of the width and 48% of the height. The distance calculation adds half the island's depth to a requirement that already accounts for the camera angle. Cosmetic, cheap to fix, not attempted this session.
- **Rho's moustache hides most of his lip-sync (open, 2026-08-17)** — the mouth card works and `closed` vs `A` are distinct, but they have to be looked for. Zara reads clearly at a glance. If speech becomes the centre of the product, the lead character is a product decision worth revisiting; today the lead is Rho.
- **`think` behaves differently per animation layer (open, 2026-08-17)** — a biped's authored clip clamps and freezes after 2.2 s while Dina's procedural driver keeps drifting in a loop. The loop sets genuinely disagree between `clipLibrary.ts` and `characterActions.ts`, and the test only asserts one of them. Harmless today; decide which is correct.
- **`celebrate`, `dance` and `bow` lose their vertical bounce on the clip path (open, 2026-08-17)** — `CLIP_LIFT` lists only `jump` and `hop`, so Dina rebounds when celebrating and the bipeds do not.
- **🔴 The DashScope / Alibaba Model Studio account is IN ARREARS (owner action, 2026-08-15)** — every image call returns `{"code":"Arrearage","message":"Access denied, please make sure your account is in good standing."}`. No image can be generated and nothing is billed until it is settled. It also blocks the art-director judge and the subject verifier, which default to the same key (`JUDGE_API_KEY ?? IMAGE_API_KEY`). This blocks the financial-education scene repair (3,397 redraws, ~$255) and any new course generation. Same class as the standing Vercel/Railway billing items below. RUNBOOK: "Every image fails with `DashScope responded 400`".
- **Financial-education scene art is still the WRONG art (2026-08-15)** — the pipeline is fixed and deployed, but the 1,208 published lessons keep the images generated under the old style, i.e. a lemonade stand over almost every exercise. The repair is built, measured and ready (`images:backfill --restyle-scenes`); it is waiting only on the arrears above.
- **Published lesson TEXT still predates the sequencing fix (2026-08-15)** — #44 changes future generation only, and plan `fixes` were never persisted, so the affected lessons cannot be identified retrospectively. Deciding whether to regenerate (and under which `--on-existing-published` policy) is open.
- **Admin overview KPIs were counting role rows and a capped audit sample (RESOLVED 2026-08-08)** — `/admin/overview` now uses unique primary-role buckets, paged identity/role reads, exact PostgREST status counts, and an exact audit total; an unavailable count fails the whole overview instead of rendering a false zero.
- **Admin content totals and lesson review were capped and too shallow (RESOLVED 2026-08-08)** — `/admin/content` and `/admin/moderation` now page through all rows, return exact status summaries and hierarchy metadata, and expose a rendered answer-stripped lesson preview with centered full-page overlays.
- **Postgres backups run daily but on a shared/interim disk** (filebase's Railway volume, not a dedicated one) — works and is drilled, but Railway's billing block should be resolved and a proper dedicated backup volume created when possible (RUNBOOK.md).
- **`TTS_API_KEY` in production is a placeholder** (`REPLACE_WITH_REAL_DASHSCOPE_KEY`) — audiogen boots and passes `/health`, but any real narration call will fail until a real DashScope key is set.
- **Email confirmation is real (RESOLVED 2026-07-18)** — Courier is live and `GOTRUE_MAILER_AUTOCONFIRM=false`; signups now require confirming a real mailbox, with branded trilingual mail delivered via Amazon SES.
- **Google OAuth is LIVE (RESOLVED 2026-07-20)** — credentials set, provider enabled, full loop verified in production (see Current State 2026-07-20).
- **email-server CD is ACTIVE (RESOLVED 2026-07-20)** — `EMAIL_SERVER_LIVE=true` set; the gated CD workflow ran its first successful deploy and now auto-deploys `email-server/` changes.
- **Old Google client secret and stale test users (RESOLVED 2026-07-20)** — the orphaned first secret (`****n9h9`) was disabled + deleted; the two deploy-verification test users (`cost-opt-verify-…`, `kong-cap-verify-…`) were deleted from prod `auth.users` with zero orphaned `profiles` rows after.
- **Stale Resend API key in a git-ignored local file (owner action)** — the retired `RESEND_API_KEY` may still sit in `.vercel/.env.production.local` (never committed, gitignored); rotate/revoke it in the Resend console for hygiene even though it's no longer referenced anywhere in the platform.
- **`littlefounders.ai` domain registration (GoDaddy) and the Vercel/Railway billing accounts** need the owner's direct action (renewal / payment) — not resolvable by an agent.
- **One orphaned Railway volume (`db-volume`, from the initial deploy's volume-mount debugging) is scheduled to self-purge 2026-07-19** — already fully detached (no service, `serviceName: null`), Railway gives no CLI/dashboard way to force an earlier purge. Harmless; nothing to do.
- **Scale-to-zero services have a cold start on first hit after idle** (~10-20s for studio/generation services) — expected and acceptable since they're admin/operator-only with no live-user traffic. If realtime subscriptions or supavisor pooling are wired later, disable Serverless on those two first (RUNBOOK.md "Railway cost / right-sizing"). Not a bug.

# Oracle — the AI Tutor runtime

Port **4009**. TypeScript + Express, ESM, Node 24.

Live tutoring sessions: turn orchestration, prompt-injection defence,
moderation before speech, the session budget, and the only service that reaches
a real-time voice provider.

- **Product spec:** [`/ORACLE.md`](../ORACLE.md)
- **Domain rules:** [`AGENTS.md`](./AGENTS.md) — read before editing
- **The stage it drives:** [`/TUTOR_3D.md`](../TUTOR_3D.md)
- **Legal review in progress:** [`/LEGAL/AI_TUTOR_LEGAL_REVIEW.md`](../LEGAL/AI_TUTOR_LEGAL_REVIEW.md)

---

## Quick start

```bash
npm install
cp .env.example .env    # fill INTERNAL_API_KEY and TUTOR_SESSION_SECRET
npm run dev
```

It boots with **no provider keys at all**. Sessions run silent and captioned
and fall back to scripted lines — a supported posture, not a broken one. The
startup log says exactly what this instance can and cannot do.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Watch mode |
| `npm run build` / `start` | Compile / run |
| `npm run type-check` · `lint` · `test` | The usual gates |
| `npm run verify:tutor` | **The §5 gate.** Prints, check by check, that the model context rejects every unlisted field and the injection canary corpus still fails to escape |
| `npm run voices:clone` | Enrols the four characters' cloned voices, per locale, from Echo's reference samples |
| `npm run voices:verify` · `speaks:verify` | The provider round trip, and whether a character can actually be heard end to end |
| `npm run speech:pregenerate` | **Buys the fixed lines once.** Synthesises every scripted line (12 texts × 4 characters × 3 locales = 144 clips) and records the URLs in `speech.pregenerated.json`. Reports without `--confirm`; makes zero network calls in that mode |

## Routes

Everything under `/api/v1/` requires `x-internal-api-key`. `/health` does not.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness. Above the rate limiter and every optional dependency; reports component status without ever failing on it |
| `POST` | `/api/v1/tutor/preflight` | Core asks whether a session can start, BEFORE minting a token — so a degraded Oracle produces an honest disabled button rather than a thirty-second load that ends in a closed socket |
| `POST` | `/api/v1/tutor/placement-intake` | Turns a learner's own words about what they already know into ONE prior fraction, so a course placement quiz opens somewhere worth their time. 12+ only (Core enforces the floor and sends an age BAND). Advisory: the number moves the first question and never the placement — see /ORACLE.md §4.1b |
| `GET` | `/api/v1/tutor/status` | Operational read for the admin console. No learner data, by construction |
| `WS` | `/ws/tutor?token=…` | **The one browser-facing surface** (`/AGENTS.md` §1.5, Oracle exception). Takes a Core-minted, single-use, session-scoped token — never a Supabase JWT |

## How a session runs

```
browser ──HTTPS──> Core            auth, preferences, personalization, grading
   │                 └──internal──> Oracle   (preflight, session context)
   └──WSS──────────> Oracle
                       ├──> DeepSeek   the tutor's words
                       ├──> Qwen       independent moderation + exercise review
                       ├──> Inworld    speech only, behind an interface
                       └──> Depot      the TUTOR's audio (never the learner's)
```

Oracle holds **no database credentials**. Every fact about a learner arrives
from Core over HTTP, already scoped to one person.

## What speech costs, and why most of it is free

Text-to-speech is the most expensive surface in the product, and most of what
the tutor says it has said before. Three things sit in front of the paid call,
cheapest first (`src/voice/speech.ts`):

1. **The fixed lines are bought once, ever.** Greetings, the six safety
   responses, both closes and the fallbacks are a closed set — 12 texts × 4
   characters × 3 locales — synthesised by `npm run speech:pregenerate` and
   recorded in `speech.pregenerated.json`. **The greeting is written, not
   generated**: it costs no model call and no synthesis, so the session opens
   as fast as the socket.
2. **A cache**, keyed on a hash of (voice fingerprint, exact text), in the
   Redis already here for the rate limiter. An unreachable Redis is a MISS —
   one paid call, spoken normally. Never a silence.
3. **The provider**, and only then. What it charges lands in the session ledger
   (`voiceCostUsd`), which is what makes the saving measurable.

Two buckets, because reuse and deletion are the same question: `tutor-speech`
holds one child's session audio and is swept at 90 days; `tutor-speech-shared`
holds the scripted set, belongs to nobody, and Core's sweep refuses to touch
it.

## Environment

See [`.env.example`](./.env.example). Three that catch people out:

- `TUTOR_SESSION_SECRET` must **differ** from `INTERNAL_API_KEY`.
- `SESSION_HARD_BUDGET_MS` must exceed `SESSION_SOFT_BUDGET_MS`, or startup
  fails deliberately.
- `VOICE_PROVIDER=none` is the default. The API surface in
  `src/voice/inworld.ts` was verified against the live service on 2026-08-21
  (`npm run voices:verify` re-runs it), but a minor's microphone additionally
  needs `TUTOR_VOICE_FOR_MINORS=true`, which needs a data-processing agreement
  covering minors' audio.
- `SPEECH_CACHE_SCOPE=scripted` is the default and the safe one. `all` shares
  model-generated audio between learners, which outlives the 90-day retention
  window — an owner decision, not a tuning knob.

## Deployment

Railway, via `.github/workflows/oracle-cd.yml` on a green `oracle CI`. Needs a
public domain (the browser opens a websocket to it) plus private access to
Core, Depot and the model providers.

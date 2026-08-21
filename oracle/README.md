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

## Routes

Everything under `/api/v1/` requires `x-internal-api-key`. `/health` does not.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness. Above the rate limiter and every optional dependency; reports component status without ever failing on it |
| `POST` | `/api/v1/tutor/preflight` | Core asks whether a session can start, BEFORE minting a token — so a degraded Oracle produces an honest disabled button rather than a thirty-second load that ends in a closed socket |
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

## Environment

See [`.env.example`](./.env.example). Three that catch people out:

- `TUTOR_SESSION_SECRET` must **differ** from `INTERNAL_API_KEY`.
- `SESSION_HARD_BUDGET_MS` must exceed `SESSION_SOFT_BUDGET_MS`, or startup
  fails deliberately.
- `VOICE_PROVIDER=none` is the default. Set `inworld` only after verifying the
  API surface in `src/voice/inworld.ts` (marked UNVERIFIED) **and** with a
  data-processing agreement covering minors' audio in place.

## Deployment

Railway, via `.github/workflows/oracle-cd.yml` on a green `oracle CI`. Needs a
public domain (the browser opens a websocket to it) plus private access to
Core, Depot and the model providers.

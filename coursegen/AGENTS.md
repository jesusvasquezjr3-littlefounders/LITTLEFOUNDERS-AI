# AGENTS.md — coursegen (Forge)

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

Generates courses and lessons for learn/ using **DeepSeek + Qwen**. Internal service — reachable only with `INTERNAL_API_KEY`.

## Intended shape (engine spec `COURSE_ENGINE.md` — planned)

A map-reduce pipeline with **checkpoint/resume** and safe failure:
`survey → plan → scaffold → lessons → resources → finalize`.
Each stage's output is Zod-validated before the next stage runs; a malformed AI response fails the stage, not the run.

## Invariants that bite here

- **All AI output is Zod-validated.** Never persist unvalidated model output.
- Answer keys are **server-only** — never in payloads the client can see.
- Generated content ships in **3 locales** (en-US, es-MX, pt-BR) or declares itself untranslated — no silent English-only lessons.
- Child safety (§1.9): no minor PII in prompts to DeepSeek/Qwen — age band + first name maximum.
- Paid-API bulk runs are a BOUNDARIES action — human sign-off first.

## Read before touching

- `agent/prompts/templates/new-lesson-type.md` — the protocol for extending the taxonomy.
- `agent/core/CONVENTIONS.md` — app layout, envelope, test shape.

---
template: new-lesson-type
inputs:
  type_name: "snake_case exercise type id"
  interaction: "what the learner does"
---

# Task: add a lesson/exercise type (coursegen + frontend)

## Read first
- `coursegen/AGENTS.md` — generation pipeline rules & lesson JSON contract
- `agent/core/CONTEXT.md` §sections — how learn/ consumes lessons
- `/AGENTS.md` §1.9 — child safety applies to generated content

## Steps
1. Define the type's JSON schema (Zod) in coursegen; answer keys are **server-only** — never shipped to the client payload.
2. Generation prompt fragment for the type (DeepSeek/Qwen) with 3-locale output support.
3. Frontend renderer for the type in learn/ (follow `new-component.md` rules).
4. Grading logic server-side; distractor rationale/feedback fields included.
5. Round-trip test: generated sample → validates against schema → renders → grades correctly (happy + wrong-answer paths).

## Acceptance
- [ ] Schema rejects malformed AI output (test with a broken sample)
- [ ] No answer keys in client-visible payloads
- [ ] 3-locale rendering verified; coursegen + frontend suites green

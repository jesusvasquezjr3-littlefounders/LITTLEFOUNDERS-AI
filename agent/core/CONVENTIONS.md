# CONVENTIONS.md — Machine-Usable Code Conventions

> Copy-paste-ready shapes. Authority for the rules themselves: `/AGENTS.md` §1.6–§1.8.

## Response envelope (every endpoint, every status code)

```ts
type Envelope<T> = { data: T; error: null } | { data: null; error: { code: string; message: string } };
// 200: res.json({ data: payload, error: null })
// 4xx/5xx: res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "…" } })
```

Error codes (SCREAMING_SNAKE, map to frontend `errors.api.<code>`):
`VALIDATION_ERROR` · `UNAUTHORIZED` · `FORBIDDEN` · `NOT_FOUND` · `CONFLICT` · `RATE_LIMITED` · `INTERNAL`

## Zod at the edge

```ts
const Body = z.object({ name: z.string().min(1) });
const parsed = Body.safeParse(req.body);
if (!parsed.success) return res.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message } });
```

Env validation: one `src/config.ts` per service exporting a Zod-parsed, frozen config object. Services crash at boot on invalid env — never at request time.

## Express app layout (every service)

```
src/
├── index.ts        # entry: reads config, createApp(), app.listen guarded by import.meta check
├── app.ts          # createApp(): middleware + routes + envelope 404; NO listen here (testable)
├── config.ts       # Zod-validated env
├── routes/         # thin: parse → call ONE service fn → envelope
├── services/       # business logic, no HTTP concerns
└── __tests__/      # *.test.ts, Supertest against createApp()
```

## Tests

- File: `src/__tests__/<unit>.test.ts`. Runner: Vitest. HTTP: Supertest against `createApp()` — never a live port.
- Every endpoint: happy path + at least one sad path (validation or auth).

## Commits

`type(scope): imperative summary` — types: `feat fix chore docs test refactor ci`. Scope = service dir name. Body explains why, not what.

## Frontend

- i18n: `const { t } = useTranslation()` — no user-facing literals. Keys dot-pathed from `en-US`.
- Dark mode: style both modes at write time (`dark:` variants / CSS vars). Never ship a light-only component.
- Design tokens: ONLY what `/DESIGN.md` defines (authoritative) — closed `lf-*` type scale, liquid-glass elevation, pill/rounded shapes. Build from `frontend/src/components/ui/` primitives; never restyle per-view or invent values.
- **Responsive is non-negotiable** (/AGENTS.md §1.11): design and implement for Desktop (≥1024px) AND Mobile (<768px) from the first commit — not mobile-only with desktop deferred. Verify both in-browser before calling any UI task done.

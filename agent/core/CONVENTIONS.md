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

## Envelope error handler (last middleware, every service)

Honour the status a thrown error already carries — body-parser attaches one for a malformed (400) or oversized (413) body. Flattening every throw to 500 tells the caller "we broke" when in fact their request was. `MulterError` carries no status: match it on `err.name` and map it to 400.

```ts
const raw = (err as { status?: unknown; statusCode?: unknown } | null)?.status
  ?? (err as { statusCode?: unknown } | null)?.statusCode;
const status = typeof raw === 'number' && raw >= 400 && raw <= 599 ? raw : 500;
// 413 → PAYLOAD_TOO_LARGE · other 4xx → VALIDATION_ERROR · 5xx → INTERNAL
```

Any new code this handler can emit needs its `errors.api.<code>` key in all three locales in the same commit (/AGENTS.md §1.6, §1.8).

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

## Comparing secrets (internal API key, session ids)

Hash both sides to a fixed-width digest, then compare. Never length-check the raw strings first.

```ts
const digest = (s: string) => crypto.createHash('sha256').update(s).digest();
if (!crypto.timingSafeEqual(digest(provided), digest(expected))) { /* 401 envelope */ }
```

The trap this replaces: `provided.length !== expected.length || crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))`. JS `.length` counts UTF-16 code units, `Buffer.from()` yields UTF-8 bytes — a header with the same character count but any byte ≥ 0x80 clears the pre-check and then makes `timingSafeEqual` **throw** `RangeError`, which surfaces as a 500 (raw HTML, thrown before the envelope handler) instead of a 401. Digests are always equal-length, so the throw is impossible and the pre-check's key-length side channel is gone too (/AGENTS.md §1.14).

## Async handlers and streamed responses

- Never `void handler(req, res)`. A rejection inside becomes an unhandled rejection, and Node 24 exits the process on those — one malformed request takes the service down for everyone.

```ts
router.get('/:bucket/:file', (req, res, next) => { serve(req, res).catch(next); });
```

- A stream piped to the response attaches `'error'` **before** `.pipe()` and destroys the source on client disconnect. `createReadStream(p).pipe(res)` with no listener turns any failure after the `stat()` (deleted mid-request, EACCES, volume EIO) into an uncaught exception; skipping the disconnect handler leaks an fd per aborted download.

```ts
const rs = createReadStream(path);
rs.on('error', () => (res.headersSent ? res.destroy() : notFound(res)));
res.on('close', () => rs.destroy());
rs.pipe(res);
```

## Read-modify-write

A read that feeds a write MUST distinguish "upstream did not answer" from "the result set was empty": return `null` for the former, a zeroed/default row only for the latter, and abort the write on `null`. Collapsing both into a default row writes a transient blip back as ground truth — an accumulate-and-`PATCH` (`POST /learn/lessons/:id/complete`) overwrites the learner's stored totals with deltas-from-zero, behind a 200. Display-only readers may keep defaulting; the distinction is load-bearing only when the value goes back out.

## Tests

- File: `src/__tests__/<unit>.test.ts`. Runner: Vitest. HTTP: Supertest against `createApp()` — never a live port.
- Every endpoint: happy path + at least one sad path (validation or auth).
- Fixtures satisfy the PRODUCTION schema — never relax a Zod rule for tests (/AGENTS.md §1.14). A fixture for a `z.string().min(16)` credential is itself 16+ chars; an id typed `z.string().uuid()` is a real UUID, not `course-1`.
- **Declared-placeholder convention.** Those long fixtures are exactly what `agent/tools/check-secrets.sh` greps for, so announce them as fake: a quoted value beginning with `test`, `dev`, `fake`, `placeholder`, `replace`, `example` or `local` followed by `-`/`_` (or the literal `replace-me`) is exempt from the scan. e.g. `INTERNAL_API_KEY = 'test-internal-key-0123456789'`. A real credential cannot hide behind it without renaming itself to say it is fake.

## Commits

`type(scope): imperative summary` — types: `feat fix chore docs test refactor ci`. Scope = service dir name. Body explains why, not what.

## Frontend

- i18n: `const { t } = useTranslation()` — no user-facing literals. Keys dot-pathed from `en-US`.
- Dark mode: style both modes at write time (`dark:` variants / CSS vars). Never ship a light-only component.
- Design tokens: ONLY what `/DESIGN.md` defines (authoritative) — closed `lf-*` type scale, liquid-glass elevation, pill/rounded shapes. Build from `frontend/src/components/ui/` primitives; never restyle per-view or invent values.
- **Responsive is non-negotiable** (/AGENTS.md §1.11): design and implement for Desktop (≥1024px) AND Mobile (<768px) from the first commit — not mobile-only with desktop deferred. Verify both in-browser before calling any UI task done.

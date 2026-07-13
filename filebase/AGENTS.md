# AGENTS.md — filebase (Depot)

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

Depot is the platform's media storage service: a content-addressed object
store for lesson audio and images (and any other binary media the platform
generates). `coursegen` (Forge) and `audiogen` (Echo) write objects here;
`backend` (Core) issues download URLs; the frontend reads `public` objects
directly, no proxy hop through Core required.

## Owns / does not own

- **Owns:** the object bytes themselves, their content hash, mime type,
  size, and visibility. Streaming them back over HTTP (including Range
  support for audio scrubbing).
- **Does NOT own:** which lesson/course an object belongs to, or any other
  domain relationship — that's a foreign key living in `database/` (Vault),
  populated by whichever service uploaded the object. Depot only knows
  `bucket + hash + ext`; it has no database and no opinion about lessons,
  courses, or users.

## Invariants that bite here

- **Content-addressed, immutable.** An object's identity is
  `sha256(bytes)`. The same bytes uploaded twice — even under different
  original filenames or a different declared mimetype — resolve to the same
  stored object; the second call is a no-op that reports
  `deduplicated: true`. Objects are never rewritten in place. To change
  content, upload it as a new object and delete the old one; there is no
  "update" endpoint by design.
- **Public objects must never contain PII, and never PII of minors
  specifically (/AGENTS.md §1.9).** `visibility: 'public'` means
  world-readable, unauthenticated, forever cacheable
  (`Cache-Control: immutable`) — treat marking something public as
  equivalent to publishing it. Lesson audio/images qualify because they are
  generated content with no personally identifying data baked in. If a
  future media type could carry PII, it MUST be uploaded as
  `visibility: 'internal'`, gated by `INTERNAL_API_KEY` like every other
  internal service (§1.5) — never as a workaround, that's the whole reason
  visibility exists as a first-class field instead of "everything public."
- **Envelope on every JSON response, including errors** (§1.6) — the ONE
  documented exception is the success path of the streaming download route
  (`GET/HEAD /files/:bucket/:hash.:ext`), which returns raw bytes with
  `Content-Type`/`Content-Length`/`Range` headers because it has to work as
  the `src` of an `<audio>`/`<img>` tag. Every error status on that route
  (400/401/404/416) still returns the standard envelope.
- **No database, no S3 SDK** — this is a deliberate scope boundary
  (/AGENTS.md §1.2 dep discipline). If the platform ever needs multi-region
  replication, CDN-backed storage, or signed URLs beyond what a Railway
  volume + `INTERNAL_API_KEY` can do, that is a stack change and requires
  human sign-off (BOUNDARIES), not a quiet dependency addition here.
- **Path traversal is defended by input validation, not by chance.** Bucket
  slugs, hashes, and extensions are each checked against a closed regex
  (`lib/validation.ts`) *before* any filesystem path is built from them. A
  request that doesn't match is rejected (400) — it never reaches
  `fs`/`path` with attacker-controlled characters.
- **Management API vs. public download are two different trust surfaces.**
  `POST/GET/DELETE /api/v1/files*` requires `x-internal-api-key` on every
  call, full stop — it's how objects get written, listed, and destroyed.
  `GET/HEAD /files/:bucket/:hash.:ext` is intentionally public for `public`
  objects (that's the point — the frontend loads audio directly from Depot)
  and falls back to the same key check only for `internal` objects.

## Read before touching

- `/AGENTS.md` §1.5 (service map, internal-only calling convention) + §1.6
  (envelope + the streaming exception) + §1.9 (child safety/PII) — all
  blocking here.
- `agent/core/CONVENTIONS.md` — app layout, envelope shape, test shape.
- `README.md` (this dir) — route table, env vars, Railway volume note.

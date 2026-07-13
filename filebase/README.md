# filebase (Depot)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** content-addressed media storage for lesson audio and images — the write target for `coursegen` (Forge) and `audiogen` (Echo), and the read source the frontend streams from directly for `public` objects.
**Port (dev):** 4006 · **Deploy:** Railway (persistent volume) · **Access:** management API is internal only (`INTERNAL_API_KEY`); the download route is public for `public`-visibility objects.

```bash
npm install
cp .env.example .env
npm run dev
npm test
```

## Storage layout

Content-addressed, deduplicated by `sha256(bytes)`, sharded by the first two hex chars to keep directories small:

```
<FILEBASE_ROOT>/<bucket>/<sha256[0:2]>/<sha256>.<ext>      the object bytes
<FILEBASE_ROOT>/<bucket>/<sha256[0:2]>/<sha256>.json       metadata sidecar
```

`bucket` is a validated slug (`[a-z0-9-]{3,40}`, e.g. `lesson-audio`, `lesson-images`). Objects are immutable — a second upload of identical bytes never rewrites anything; it returns the existing object with `deduplicated: true`.

## Routes

All JSON routes use the standard envelope (`/AGENTS.md` §1.6): `{ "data": <payload|null>, "error": <{code,message}|null> }`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Service health envelope |
| POST | `/api/v1/files` | `x-internal-api-key` | Multipart upload. Fields: `bucket` (slug), `visibility` (`public`\|`internal`), `file` (the binary, allowlisted mime, ≤ `FILEBASE_MAX_BYTES`). Streams to a temp file, hashes, dedups, atomically commits. Optional `x-service-name` header is recorded as `uploaderService`. → `{ id, url, bytes, mime, visibility, deduplicated }` |
| GET | `/api/v1/files` | `x-internal-api-key` | Paginated listing. Query: `bucket` (required), `cursor` (opaque, the last hash of the previous page), `limit` (1–200, default 50). → `{ items: [...], nextCursor }` |
| DELETE | `/api/v1/files/:bucket/:hash.:ext` | `x-internal-api-key` | Deletes the object + its metadata sidecar. 404 if it doesn't exist or the extension doesn't match the stored one. |
| **GET/HEAD** | **`/files/:bucket/:hash.:ext`** | none for `public` objects; `x-internal-api-key` for `internal` objects | **Streaming exception** (see below) — serves the raw object bytes, not the JSON envelope, on success. |

### The streaming exception

`GET/HEAD /files/:bucket/:hash.:ext` is the one route in this service (and, per `/AGENTS.md` §1.6, the one documented exception platform-wide) whose **success** response is not the `{data,error}` envelope — it streams raw bytes so it can be used directly as the `src` of an `<audio>` or `<img>` tag. Every *error* status on this route (400 invalid id, 401 unauthorized for an internal object, 404 not found, 416 range not satisfiable) still returns the standard JSON envelope.

Behavior on success:
- `Content-Type` set from the stored mime type.
- `ETag` is the object hash (`"<sha256>"`) — immutable, so `Cache-Control: public, max-age=31536000, immutable`.
- `If-None-Match` matching the ETag → `304 Not Modified`.
- `Range: bytes=start-end` (also `start-` and `-suffixLength`) → `206 Partial Content` with `Content-Range`/`Content-Length` set to the requested slice, for audio scrubbing. An unsatisfiable range → `416` (JSON envelope).
- `HEAD` returns identical headers with no body.

Allowed mime types (each maps to a fixed extension, independent of the uploader's original filename): `audio/mpeg`→mp3, `audio/wav`→wav, `audio/ogg`→ogg, `image/png`→png, `image/jpeg`→jpg, `image/webp`→webp, `application/json`→json.

## Env vars

| Var | Required | Default | Notes |
|---|---|---|---|
| `PORT` | no | `4006` | |
| `INTERNAL_API_KEY` | prod: yes · dev/test: no | `dev-internal-key` (dev/test only) | Must match every caller's key (Core, Forge, Echo). Boot crashes if unset in `NODE_ENV=production`. |
| `FILEBASE_ROOT` | no | `./data` | Local dir in dev; the Railway volume mount path in prod (see below). |
| `FILEBASE_MAX_BYTES` | no | `26214400` (25MB) | Multipart upload size cap. |
| `PUBLIC_BASE_URL` | no | unset | If set, upload responses return absolute URLs; otherwise root-relative `/files/...` paths. |

## Railway deployment note

Depot needs a **persistent volume** — the storage root must survive redeploys, unlike the ephemeral container filesystem. In the Railway service settings, attach a volume and set its mount path as `FILEBASE_ROOT` (e.g. `/data`). Without a volume, every deploy silently drops all stored media.

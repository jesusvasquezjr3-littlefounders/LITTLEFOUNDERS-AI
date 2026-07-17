# parent-id-check (Guardian)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** Guardian identity verification — the only path to verified `parent`/`kid`/`bigfounder` states.
**Port (dev):** 4004 · **Deploy:** Railway · **Access:** internal only (`INTERNAL_API_KEY`)

**Engine (decided 2026-07-12):** local OCR via tesseract.js (WASM, `spa+eng+por`) — the ID image never leaves our infrastructure and is processed entirely in memory. This service is stateless: no database access, no storage; it returns verdicts and Core owns every write.

```bash
npm install
cp .env.example .env
npm run dev
npm test
```

## Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /health | — | Service health envelope |
| POST | /internal/v1/verifications/parent | x-internal-api-key | multipart: `givenNames`, `surnames`, `birthDate` (yyyy-mm-dd) + `document` image (jpeg/png/webp ≤8MB) → `{ verified, checks }` verdict. Image discarded after OCR; responses never echo OCR text or applicant data |

# parent-id-check (Guardian)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** Guardian identity verification — the only path to verified `parent`/`kid`/`bigfounder` states.
**Port (dev):** 4004 · **Deploy:** Railway · **Access:** internal only (`INTERNAL_API_KEY`) + signed provider webhooks

```bash
npm install
cp .env.example .env
npm run dev
npm test
```

## Routes

| Method | Path | Description |
|---|---|---|
| GET | /health | Service health envelope |

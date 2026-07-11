# backend (Core)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** Main API — the only service the frontend calls. Auth, roles, families, guardian links, tasks, profiles; orchestrates internal services.
**Port (dev):** 4000 · **Deploy:** Railway

```bash
npm install
cp .env.example .env   # fill values
npm run dev
npm test
```

## Routes

| Method | Path | Description |
|---|---|---|
| GET | /health | Service health envelope |

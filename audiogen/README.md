# audiogen (Echo)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md).

**Mission:** TTS audio generation for lessons, per-locale voices (en-US, es-MX, pt-BR).
**Port (dev):** 4002 · **Deploy:** Railway · **Access:** internal only (`INTERNAL_API_KEY`)

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

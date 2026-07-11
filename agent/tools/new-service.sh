#!/usr/bin/env bash
# Stamps a new Express+TS service from the canonical template.
# Usage: new-service.sh <name> <port>
# Then follow agent/workflows/service-scaffold.md for CI + docs wiring.
set -euo pipefail
cd "$(dirname "$0")/../.."

NAME="${1:?usage: new-service.sh <name> <port>}"
PORT="${2:?usage: new-service.sh <name> <port>}"

[ -d "$NAME" ] && { echo "ERROR: $NAME/ already exists" >&2; exit 1; }
mkdir -p "$NAME/src/__tests__"

cat > "$NAME/package.json" <<EOF
{
  "name": "@littlefounders/$NAME",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "license": "UNLICENSED",
  "engines": { "node": "24.x" },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "type-check": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "express": "^5.1.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^24.0.0",
    "@types/supertest": "^6.0.0",
    "eslint": "^9.0.0",
    "supertest": "^7.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.6.0",
    "typescript-eslint": "^8.0.0",
    "vitest": "^3.0.0"
  }
}
EOF

cat > "$NAME/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"],
  "exclude": ["src/__tests__"]
}
EOF

cat > "$NAME/eslint.config.js" <<'EOF'
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
EOF

cat > "$NAME/vitest.config.ts" <<'EOF'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
EOF

cat > "$NAME/src/app.ts" <<EOF
import express from 'express';

export const SERVICE = '$NAME';
export const VERSION = '0.1.0';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ data: { service: SERVICE, version: VERSION, status: 'ok' }, error: null });
  });

  app.use((_req, res) => {
    res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  return app;
}
EOF

cat > "$NAME/src/index.ts" <<EOF
import { createApp, SERVICE } from './app.js';

const port = Number(process.env.PORT ?? $PORT);
createApp().listen(port, () => {
  console.log(\`[\${SERVICE}] listening on :\${port}\`);
});
EOF

cat > "$NAME/src/__tests__/health.test.ts" <<'EOF'
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, SERVICE } from '../app.js';

describe('GET /health', () => {
  it('returns the ok envelope', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { service: SERVICE, version: expect.any(String), status: 'ok' },
      error: null,
    });
  });

  it('unknown routes return the error envelope', async () => {
    const res = await request(createApp()).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
EOF

cat > "$NAME/.env.example" <<EOF
PORT=$PORT
EOF

cat > "$NAME/README.md" <<EOF
# $NAME

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first.

**Mission:** TODO
**Port (dev):** $PORT · **Deploy:** Railway

\`\`\`bash
npm install
npm run dev
npm test
\`\`\`

## Routes

| Method | Path | Description |
|---|---|---|
| GET | /health | Service health envelope |
EOF

cat > "$NAME/AGENTS.md" <<EOF
# AGENTS.md — $NAME

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

TODO — one paragraph.

## Owns / does not own

- **Owns:** TODO
- **Does NOT own:** TODO (and where that lives instead)

## Invariants that bite here

- Envelope + /api/v1/ + Zod on every route (/AGENTS.md §1.6).
- TODO service-specific.

## Read before touching

- agent/core/CONVENTIONS.md — app layout, envelope, test shape.
EOF

echo "Stamped $NAME/ on port $PORT."
echo "Next: agent/workflows/service-scaffold.md (install, CI workflow, docs wiring)."

// The parity gate has to fail on the exact drift that shipped, or it is
// decoration. Each case below is a real shape from this repo's history.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defaultFor } from './check-provider-parity.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(root, 'agent/tools/check-provider-parity.mjs');

// ── the parser, against the real shapes it has to read ──────────────────────

const FORGE_LIKE = `
  DEEPSEEK_API_KEY: z.string().min(8).optional(),
  DEEPSEEK_BASE_URL: z.url().default('https://api.deepseek.com/v1'),
  DEEPSEEK_MODEL: z.string().min(1).default('deepseek-v4-pro'),
  FORGE_DEEPSEEK_FALLBACK_TO_QWEN: z.stringbool().default(true),
`;

assert.equal(defaultFor(FORGE_LIKE, 'DEEPSEEK_BASE_URL'), 'https://api.deepseek.com/v1');
assert.equal(defaultFor(FORGE_LIKE, 'DEEPSEEK_MODEL'), 'deepseek-v4-pro');

// A key with no default at all is NOT the same as an empty default, and must
// never be reported as agreeing with anything.
assert.deepEqual(defaultFor(FORGE_LIKE, 'DEEPSEEK_API_KEY'), { declaredWithoutDefault: true });
assert.equal(defaultFor(FORGE_LIKE, 'NOT_A_REAL_KEY'), null);

// A non-string default must not be misread as the string 'true'.
assert.deepEqual(defaultFor(FORGE_LIKE, 'FORGE_DEEPSEEK_FALLBACK_TO_QWEN'), {
  declaredWithoutDefault: true,
});

// Substring collisions: reading MODEL must not match DEEPSEEK_MODEL, and
// reading a prefix must not match the longer key that starts with it.
const COLLIDING = `
  MODEL_NAME: z.string().min(1).default('deepseek-v4-pro'),
  JUDGE_MODEL_NAME: z.string().min(1).default('qwen3-max'),
`;
assert.equal(defaultFor(COLLIDING, 'MODEL_NAME'), 'deepseek-v4-pro');
assert.equal(defaultFor(COLLIDING, 'JUDGE_MODEL_NAME'), 'qwen3-max');

// ── the gate, against the live repository ───────────────────────────────────

const live = spawnSync('node', [script], { cwd: root, encoding: 'utf8' });
assert.equal(live.status, 0, `the live repository should agree:\n${live.stdout}${live.stderr}`);
assert.match(live.stdout, /provider:check OK/);

// The failures this file exists for, asserted as facts about the repo rather
// than as fixtures — a fixture that drifts from reality proves nothing.
assert.match(live.stdout, /DeepSeek base URL: both 'https:\/\/api\.deepseek\.com\/v1'/);
assert.doesNotMatch(
  live.stdout,
  /deepseek-chat/,
  'deepseek-chat was retired 2026-07-24 and must not be a default anywhere',
);

// The model name is a RECORDED divergence, and the recording is the point: a
// green run that said nothing about it would be indistinguishable from the
// silent drift this gate exists to catch.
assert.match(live.stdout, /ALLOWED DeepSeek model: forge 'deepseek-v4-pro' vs oracle 'deepseek-v4-flash'/);
assert.match(live.stdout, /REASONING model/, 'the divergence must carry its reason, not just a pass');
assert.match(live.stdout, /recorded divergence/, 'the summary must not claim agreement it did not find');
assert.doesNotMatch(
  live.stdout,
  /agree on all/,
  'the old summary claimed total agreement even when a pair differed by design',
);

console.log('check-provider-parity OK — parser handles missing/non-string/colliding keys, live repo agrees');

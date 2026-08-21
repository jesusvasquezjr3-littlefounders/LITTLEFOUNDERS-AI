#!/usr/bin/env node
/**
 * Forge and Oracle call the SAME two provider accounts. This checks they are
 * configured to call them the same way.
 *
 * WHY THIS EXISTS. Oracle shipped to production with
 * `MODEL_API_BASE=https://api.deepseek.com` while `coursegen` has always used
 * `https://api.deepseek.com/v1`. Neither service uses an SDK that appends the
 * version, so Oracle built `https://api.deepseek.com/chat/completions` and
 * 404'd on every single turn. Nothing caught it: the service was healthy, its
 * `/health` reported `model: up` because a key was present, all 142 tests
 * passed against a local fake, and the only symptom was that every learner was
 * told "my thoughts got tangled for a moment" instead of being taught.
 *
 * The model NAMES matter for a quieter reason. Oracle defaulted to
 * `deepseek-chat`, retired 2026-07-24 and now an alias for a v4-flash mode,
 * while Forge writes every course with `deepseek-v4-pro`. That failure has no
 * error at all — the tutor simply explains a topic with a weaker model than
 * the lesson that taught it, and nobody would think to look.
 *
 * WHAT THIS IS NOT. It does not compare API KEYS (they are not in the repo)
 * and it does not force the two services to stay identical forever. If Oracle
 * genuinely needs a different model — a cheaper one for per-turn moderation,
 * say — record it in the ALLOWED_DIVERGENCE table below with the reason. The
 * point is that a difference must be a decision someone wrote down, not a
 * default nobody compared.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Each pair: the same fact, spelled differently in two services. */
const PAIRS = [
  {
    what: 'DeepSeek base URL',
    forge: { file: 'coursegen/src/env.ts', key: 'DEEPSEEK_BASE_URL' },
    oracle: { file: 'oracle/src/env.ts', key: 'MODEL_API_BASE' },
  },
  {
    what: 'DeepSeek model',
    forge: { file: 'coursegen/src/env.ts', key: 'DEEPSEEK_MODEL' },
    oracle: { file: 'oracle/src/env.ts', key: 'MODEL_NAME' },
  },
  {
    what: 'Qwen base URL',
    forge: { file: 'coursegen/src/env.ts', key: 'QWEN_BASE_URL' },
    oracle: { file: 'oracle/src/env.ts', key: 'JUDGE_API_BASE' },
  },
  {
    what: 'Qwen judge model',
    forge: { file: 'coursegen/src/env.ts', key: 'QWEN_JUDGE_MODEL' },
    oracle: { file: 'oracle/src/env.ts', key: 'JUDGE_MODEL_NAME' },
  },
];

/**
 * Divergences that are deliberate. Empty on purpose: today the two agree, and
 * the next person to disagree with that should have to say why here.
 *
 * Shape: { what: 'DeepSeek model', reason: '…' }
 */
const ALLOWED_DIVERGENCE = [];

/** The `.default('…')` argument of a Zod field, or null if there is no default. */
export function defaultFor(source, key) {
  // Deliberately narrow: `KEY: z.<anything>.default('value')` on one line, the
  // shape every env schema in this repo uses. A field written differently is
  // reported as unreadable rather than guessed at.
  const line = new RegExp(`^\\s*${key}\\s*:\\s*z\\..*?\\.default\\(\\s*'([^']*)'\\s*\\)`, 'm');
  const match = line.exec(source);
  if (match !== null && match[1] !== undefined) return match[1];
  const declared = new RegExp(`^\\s*${key}\\s*:`, 'm').test(source);
  return declared ? { declaredWithoutDefault: true } : null;
}

function describe(value) {
  if (value === null) return 'NOT DECLARED';
  if (typeof value === 'object') return 'declared without a default';
  return `'${value}'`;
}

function main() {
  const cache = new Map();
  const read = (file) => {
    if (!cache.has(file)) cache.set(file, readFileSync(path.join(ROOT, file), 'utf8'));
    return cache.get(file);
  };

  const problems = [];
  for (const pair of PAIRS) {
    const excused = ALLOWED_DIVERGENCE.find((e) => e.what === pair.what);
    const forge = defaultFor(read(pair.forge.file), pair.forge.key);
    const oracle = defaultFor(read(pair.oracle.file), pair.oracle.key);

    if (forge === null || typeof forge === 'object' || oracle === null || typeof oracle === 'object') {
      problems.push(
        `${pair.what}: could not read a default — ` +
          `${pair.forge.key} is ${describe(forge)}, ${pair.oracle.key} is ${describe(oracle)}`,
      );
      continue;
    }

    if (forge === oracle) {
      console.log(`OK    ${pair.what}: both '${forge}'`);
    } else if (excused) {
      console.log(`ALLOWED ${pair.what}: forge '${forge}' vs oracle '${oracle}' — ${excused.reason}`);
    } else {
      problems.push(
        `${pair.what}: ${pair.forge.key}='${forge}' but ${pair.oracle.key}='${oracle}'\n` +
          `      Two services on one provider account, configured differently. If that is\n` +
          `      intended, add it to ALLOWED_DIVERGENCE in this file with the reason.`,
      );
    }
  }

  if (problems.length > 0) {
    console.error('\nprovider:check FAILED\n');
    for (const problem of problems) console.error(`  ${problem}`);
    console.error('');
    process.exit(1);
  }
  console.log(`provider:check OK — Forge and Oracle agree on all ${PAIRS.length} provider settings`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}

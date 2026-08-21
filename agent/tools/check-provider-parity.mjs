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
 * `deepseek-chat`, retired 2026-07-24, while Forge writes every course with
 * `deepseek-v4-pro`. That failure has no error at all — the tutor simply
 * explains a topic with a different model than the lesson that taught it, and
 * nobody would think to look.
 *
 * WHAT THIS IS NOT. It does not compare API KEYS (they are not in the repo)
 * and it does not force the two services to stay identical forever. The model
 * name is now a RECORDED divergence: Forge reasons, Oracle answers a waiting
 * learner, and those want different models on the same account. That is what
 * ALLOWED_DIVERGENCE is for — a difference has to be a decision someone wrote
 * down, not a default nobody compared.
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
 * Divergences that are deliberate, each with the evidence that made it one.
 *
 * A difference belongs here only when someone has decided it; the point of the
 * table is that the next person reads a reason instead of finding a default
 * nobody compared.
 */
const ALLOWED_DIVERGENCE = [
  {
    what: 'DeepSeek model',
    reason:
      'deepseek-v4-pro is a REASONING model. Asked for a tutor turn it spent all 400 ' +
      'completion tokens on reasoning_content and returned empty content with ' +
      'finish_reason: length — measured in production 2026-08-21. Right for Forge, ' +
      'which authors a course offline and would rather think than hurry; wrong for ' +
      'Oracle, where a learner is waiting. Oracle uses deepseek-v4-flash, the ' +
      'non-reasoning sibling on the same account.',
  },
];

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
  let agreed = 0;
  let allowed = 0;
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
      agreed += 1;
      console.log(`OK    ${pair.what}: both '${forge}'`);
    } else if (excused) {
      allowed += 1;
      console.log(`ALLOWED ${pair.what}: forge '${forge}' vs oracle '${oracle}'`);
      console.log(`        ${excused.reason}`);
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
  // Say what was actually found. "agree on all 4" while one of them differs by
  // design is the same species of untruth this whole file exists to catch.
  const tail = allowed > 0 ? `, ${allowed} recorded divergence(s)` : '';
  console.log(`provider:check OK — ${agreed}/${PAIRS.length} settings agree${tail}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}

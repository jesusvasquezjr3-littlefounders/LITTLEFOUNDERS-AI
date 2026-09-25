import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RANDOMNESS_ALLOWLIST, REWARD_PATHS, checkFile, checkRepository } from './check-reward-mechanics.mjs';

// B.22 (S05.3e): red-team samples the gate must block, and the declared cases it must pass.

test('blocks a random draw on a reward path, even when someone allowlists it', () => {
  const xpRoll = 'export function bonusXp(base) { return base + Math.floor(Math.random() * 20); }';
  assert.match(checkFile('backend/src/routes/learn.ts', xpRoll)[0], /reward code draws a random number/);
  assert.match(checkFile('backend/src/routes/learn.ts', xpRoll, { 'backend/src/routes/learn.ts': 'nope' })[0], /reward code/);
  assert.match(checkFile('frontend/src/lesson-engine/player/Chest.tsx', 'const prize = crypto.getRandomValues(new Uint8Array(1))[0] % 3')[0], /reward code/);
});

test('blocks undeclared randomness anywhere, and passes declared non-reward draws', () => {
  assert.match(checkFile('backend/src/services/newThing.ts', 'const n = randomInt(10);')[0], /undeclared randomness/);
  assert.match(checkFile('frontend/src/lib/cards.ts', 'const deck = _.shuffle(cards);')[0], /undeclared randomness/);
  assert.deepEqual(checkFile('frontend/src/lib/avatarOptions.ts', 'Math.random()'), []);
  assert.deepEqual(checkFile('backend/src/services/ids.ts', 'const id = crypto.randomUUID(); const t = randomBytes(24);'), []);
  // A sentence ABOUT Math.random is not a draw.
  assert.deepEqual(checkFile('backend/src/services/doc.ts', '// never use Math.random() here\nexport const x = 1;'), []);
});

test('blocks SQL draws in a migration, never gen_random_uuid', () => {
  assert.match(checkFile('database/migrations/0999_bonus.sql', "UPDATE learning_stats SET xp_points = xp_points + floor(random() * 10);")[0], /undeclared randomness/);
  assert.match(checkFile('database/migrations/0999_sample.sql', 'SELECT * FROM badges TABLESAMPLE SYSTEM (10);')[0], /undeclared/);
  assert.deepEqual(checkFile('database/migrations/0999_ids.sql', 'id uuid DEFAULT gen_random_uuid() -- random() is banned here'), []);
});

test('blocks mystery-reward language in three languages, and allows a mystery-machine puzzle', () => {
  for (const text of ['"reward": "Open your mystery box!"', 'Spin the wheel for coins', 'a loot box', 'Caja misteriosa', 'premio sorpresa', 'recompensa aleatoria',
    'Baú surpresa', 'raspadinha', 'prêmio surpresa', 'Random reward tiers', 'surprise bonus']) {
    assert.ok(checkFile('frontend/src/i18n/en-US/common.json', text).some((f) => f.includes('mystery-reward language')), text);
  }
  assert.deepEqual(checkFile('frontend/src/lesson-engine/families/maker/x.ts', 'The mystery machine transforms numbers.'), []);
  assert.deepEqual(checkFile('frontend/src/components/characters/x.tsx', "expression: 'surprised'"), []);
});

test('the allowlist never names reward code, and the repository passes as a whole', () => {
  for (const path of Object.keys(RANDOMNESS_ALLOWLIST)) assert.ok(!REWARD_PATHS.some((p) => p.test(path)), path);
  const root = mkdtempSync(join(tmpdir(), 'lf-reward-'));
  try {
    mkdirSync(join(root, 'backend/src/routes'), { recursive: true });
    writeFileSync(join(root, 'backend/src/routes/tasks.ts'), 'export const reward = 5 + Math.round(Math.random());');
    const red = checkRepository(root, ['backend/src']);
    assert.equal(red.files, 1);
    assert.match(red.findings[0], /reward code draws/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  const real = checkRepository();
  assert.deepEqual(real.findings, []);
  assert.ok(real.files > 500);
});

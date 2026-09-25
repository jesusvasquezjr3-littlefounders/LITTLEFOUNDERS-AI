import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSocialTiers } from './check-social-tiers.mjs';

/*
 * The E.8/E.9/E.13 guardrail must pass on the real tree and fail on each
 * regression it exists to catch — a checker nobody has seen fail is not a
 * checker.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const FILES = [
  'backend/src/routes/profile.ts',
  'backend/src/services/socialVisibility.ts',
  'backend/src/services/profileFieldSafety.ts',
  'frontend/src/routes/app/profile/ProfilePage.tsx',
  'frontend/src/routes/app/profile/PublicProfilePage.tsx',
  'database/scripts/fixtures/profile-field-safety-cases.json',
  'docs/rebuild/policies/SOCIAL-TIERS.md',
];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'lf-social-tiers-'));
  for (const file of FILES) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(resolve(repo, file), join(root, file));
  }
  cpSync(resolve(repo, 'database/migrations'), join(root, 'database/migrations'), { recursive: true });
  return root;
}

function edit(root, file, from, to) {
  const path = join(root, file);
  const source = readFileSync(path, 'utf8');
  assert.ok(source.includes(from), `${file} fixture lacks ${from}`);
  writeFileSync(path, source.replace(from, to));
}

function withFixture(mutate, expected) {
  const root = fixture();
  try {
    mutate(root);
    const failures = checkSocialTiers(root);
    assert.ok(failures.some((f) => expected.test(f)), `expected ${expected} in ${JSON.stringify(failures)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function latestMigration(root) {
  return readdirSync(join(root, 'database/migrations')).filter((f) => f.endsWith('.sql')).sort().at(-1);
}

test('the real tree passes', () => {
  assert.deepEqual(checkSocialTiers(repo), []);
});

test('E.9: a count read back into the profile route fails', () => {
  withFixture((root) => edit(root, 'backend/src/routes/profile.ts', '  getFullOwnProfile,\n', '  getFollowCounts,\n  getFullOwnProfile,\n'), /reads follower\/following counts/);
});

test('E.9: a count rendered on the public page fails', () => {
  withFixture((root) => edit(root, 'frontend/src/routes/app/profile/PublicProfilePage.tsx',
    "{t('profile.stats.followers')}</Button>", "{t('profile.stats.followers')} {data.followers}</Button>"), /renders a follower\/following count/);
});

test('E.8: a later migration that drops teen consent from the follow trigger fails', () => {
  withFixture((root) => {
    const next = String(Number(latestMigration(root).slice(0, 4)) + 1).padStart(4, '0');
    writeFileSync(join(root, 'database/migrations', `${next}_regression.sql`), `-- @phase: contract
CREATE OR REPLACE FUNCTION public.guard_social_follow_admission()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
`);
  }, /no longer enforces SUBJECT_CONSENT_REQUIRED/);
});

test('E.8: a later visibility function without the tier fails', () => {
  withFixture((root) => {
    const next = String(Number(latestMigration(root).slice(0, 4)) + 1).padStart(4, '0');
    writeFileSync(join(root, 'database/migrations', `${next}_regression.sql`), `-- @phase: contract
CREATE OR REPLACE FUNCTION public.social_subject_visible(p_subject uuid)
RETURNS boolean LANGUAGE sql AS $$ SELECT true; $$;
`);
  }, /social_subject_visible no longer applies social_tier/);
});

test('E.8: a teen made public by default in Core fails', () => {
  withFixture((root) => edit(root, 'backend/src/services/socialVisibility.ts', "      return 'card';", "      return 'full';"), /keep a teen private/);
});

test('E.8: a teen decision that trusts a client identity fails', () => {
  withFixture((root) => edit(root, 'backend/src/routes/profile.ts', 'decideTeenConnection(id.data, authedUser(res).id,', 'decideTeenConnection(id.data, String(req.body.subjectId),'), /always be the session's own/);
});

test('E.13: classifier drift between Core and the database fails', () => {
  withFixture((root) => edit(root, 'backend/src/services/profileFieldSafety.ts', "'insta', 'xbl'", "'insta'"), /platform token list differs/);
  withFixture((root) => edit(root, 'backend/src/services/profileFieldSafety.ts', '|kinder|', '|'), /SCHOOL differs/);
});

test('E.13: a new free-text profile field fails', () => {
  withFixture((root) => edit(root, 'backend/src/routes/profile.ts', '    locale: z.enum(LOCALES).optional(),\n  })', '    locale: z.enum(LOCALES).optional(),\n    bio: z.string().max(200).optional(),\n  })'), /accepts bio,displayName,locale,username/);
});

test('E.13: a missing corpus or write guard fails', () => {
  withFixture((root) => rmSync(join(root, 'database/scripts/fixtures/profile-field-safety-cases.json')), /corpus is missing/);
  withFixture((root) => {
    for (const file of readdirSync(join(root, 'database/migrations'))) {
      const path = join(root, 'database/migrations', file);
      const sql = readFileSync(path, 'utf8');
      if (sql.includes('FUNCTION public.guard_profile_fields(')) writeFileSync(path, sql.replace('FUNCTION public.guard_profile_fields(', 'FUNCTION public.unused_guard('));
    }
  }, /write guard on minors' profile fields is missing/);
});

test('the policy must keep its sections and tier rows', () => {
  withFixture((root) => edit(root, 'docs/rebuild/policies/SOCIAL-TIERS.md', '## 2. No comparison count (E.9)', '## 2. Counts'), /missing section "## 2. No comparison count \(E.9\)"/);
  withFixture((root) => edit(root, 'docs/rebuild/policies/SOCIAL-TIERS.md', '| closed |', '| shut |'), /lacks the closed row/);
});

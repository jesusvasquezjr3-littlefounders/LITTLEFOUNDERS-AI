import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOCIAL_SCREENS, checkSocialTiers } from './check-social-tiers.mjs';

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
  'backend/src/services/socialProtection.ts',
  'backend/src/routes/admin.ts',
  'backend/src/routes/family.ts',
  'frontend/src/rebuild/staff/console/programmeApi.ts',
  ...SOCIAL_SCREENS,
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

test('E.9: a count rendered on the public profile fails', () => {
  withFixture((root) => edit(root, 'frontend/src/rebuild/social/PublicProfile.tsx',
    '{copy.followers}</AppLink>', '{copy.followers} {person.followers}</AppLink>'), /PublicProfile\.tsx: renders a follower\/following count/);
});

test('E.9: a count rendered on a people list fails', () => {
  withFixture((root) => edit(root, 'frontend/src/rebuild/social/PeopleList.tsx',
    '<h1 data-copy-role="heading">{title}</h1>', '<h1 data-copy-role="heading">{title} {view.followersCount}</h1>'), /PeopleList\.tsx: renders a follower\/following count/);
});

test('E.9: a count rendered on the rebuilt own profile fails', () => {
  withFixture((root) => edit(root, 'frontend/src/rebuild/account/OwnProfile.tsx',
    '{copy.followers}</AppLink>', '{copy.followers} {data.followers}</AppLink>'), /OwnProfile\.tsx: renders a follower\/following count/);
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

// S-03 (OD-27 (2)): the 16-17 discoverable-profile opt-in stays narrow.
function laterMigration(root, sql) {
  const next = String(Number(latestMigration(root).slice(0, 4)) + 1).padStart(4, '0');
  writeFileSync(join(root, 'database/migrations', `${next}_regression.sql`), sql);
}

test('S-03: a later eligibility function that drops the 16+ proof, the teen tier or the flag check fails', () => {
  for (const [body, expected] of [
    ["SELECT public.social_tier(p_user) = 'teen' AND NOT public.profile_fields_flagged(p_user)", /no longer requires age_at_least_by_birth_month/],
    ["SELECT public.age_at_least_by_birth_month(p_user, 16) OR interval '16 years' IS NOT NULL AND NOT public.profile_fields_flagged(p_user)", /no longer requires social_tier\(p_user\) = 'teen'/],
    ["SELECT public.social_tier(p_user) = 'teen' AND public.age_at_least_by_birth_month(p_user, 16) OR interval '16 years' IS NOT NULL", /no longer requires NOT public\.profile_fields_flagged/],
  ]) {
    withFixture((root) => laterMigration(root, `-- @phase: contract\nCREATE OR REPLACE FUNCTION public.teen_discoverable_eligible(p_user uuid)\nRETURNS boolean LANGUAGE sql AS $$ ${body}; $$;\n`), expected);
  }
});

test('OD-9 4.2: an eligibility function that drops the discoverable-profile consent, or a setter that stops naming it, fails', () => {
  const body = "SELECT public.social_tier(p_user) = 'teen' AND public.age_at_least_by_birth_month(p_user, 16) OR interval '16 years' IS NOT NULL AND NOT public.profile_fields_flagged(p_user)";
  withFixture((root) => laterMigration(root, `-- @phase: contract\nCREATE OR REPLACE FUNCTION public.teen_discoverable_eligible(p_user uuid)\nRETURNS boolean LANGUAGE sql AS $$ ${body}; $$;\n`),
    /no longer requires data_practice_applies\(p_user, 'sharing\.discoverable_profile'\)/);
  withFixture((root) => laterMigration(root, `-- @phase: contract\nCREATE OR REPLACE FUNCTION public.set_teen_profile_discoverable(p_user uuid, p_discoverable boolean)\nRETURNS boolean LANGUAGE plpgsql AS $$ BEGIN IF p_discoverable AND NOT public.teen_discoverable_eligible(p_user) THEN RAISE EXCEPTION 'DISCOVERABLE_NOT_ELIGIBLE'; END IF; INSERT INTO public.audit_logs DEFAULT VALUES; RETURN p_discoverable; END; $$;\n`),
    /name a missing OD-9 consent/);
});

test('S-03: a discoverable reader that stops re-checking eligibility, or an unaudited setter, fails', () => {
  withFixture((root) => laterMigration(root, `-- @phase: contract\nCREATE OR REPLACE FUNCTION public.teen_profile_discoverable(p_user uuid)\nRETURNS boolean LANGUAGE sql AS $$ SELECT true; $$;\n`), /must re-check eligibility on every read/);
  withFixture((root) => laterMigration(root, `-- @phase: contract\nCREATE OR REPLACE FUNCTION public.set_teen_profile_discoverable(p_user uuid, p_discoverable boolean)\nRETURNS boolean LANGUAGE sql AS $$ SELECT p_discoverable; $$;\n`), /must refuse an ineligible opt-in and audit every change/);
});

test('S-03: visibility that shows a discoverable teen outside the E.13 check fails', () => {
  withFixture((root) => laterMigration(root, `-- @phase: contract
CREATE OR REPLACE FUNCTION public.social_subject_visible(p_subject uuid)
RETURNS boolean LANGUAGE sql AS $$ SELECT public.social_tier(p_subject) <> 'closed' AND (public.teen_profile_discoverable(p_subject)
  OR (NOT public.profile_fields_flagged(p_subject) AND public.has_current_teen_consent(auth.uid(), p_subject))); $$;
`), /must stay behind the E\.13 flag check/);
});

test('S-03: Core asking the opt-in before the flag check, or a route that takes more than a boolean, fails', () => {
  withFixture((root) => {
    const file = 'backend/src/services/socialVisibility.ts';
    const path = join(root, file);
    const source = readFileSync(path, 'utf8');
    const probe = "      if (await isTeenProfileDiscoverable(subjectId)) return 'full';\n";
    assert.ok(source.includes(probe));
    writeFileSync(path, source.replace(probe, '').replace("      if (await isFlagged(subjectId, fields)) return 'none';\n      if (await hasCurrentTeenConsent", `${probe}      if (await isFlagged(subjectId, fields)) return 'none';\n      if (await hasCurrentTeenConsent`));
  }, /discoverable check must come after the E\.13 flag check/);
  withFixture((root) => edit(root, 'backend/src/routes/profile.ts', 'z.object({ discoverable: z.boolean() }).strict()', 'z.object({ discoverable: z.coerce.boolean() })'), /must take one literal boolean/);
});

test('S-03: the policy must keep the discoverable-profile section', () => {
  withFixture((root) => edit(root, 'docs/rebuild/policies/SOCIAL-TIERS.md', '### 1.1 A discoverable profile at 16 or 17 (S-03, OD-27)', '### 1.1 Public teens'), /missing the 16-17 discoverable-profile section/);
});

// Appendix J E.1-E.5: each of the nine metrics is pinned from SQL to screen.
function metricsMigration(root) {
  return readdirSync(join(root, 'database/migrations')).filter((f) => f.endsWith('_social_protection_metrics.sql')).sort().at(-1);
}

test('Appendix J: a metric dropped from the SQL answer fails', () => {
  withFixture((root) => {
    const file = `database/migrations/${metricsMigration(root)}`;
    edit(root, file, "'patternEscalation', ", "'escalationGone', ");
  }, /no longer answers patternEscalation/);
});

test('Appendix J: a metric dropped from Core validation fails', () => {
  withFixture((root) => edit(root, 'backend/src/services/socialProtection.ts', "'ageBoundary', 'tutorBadge'", "'tutorBadge'"), /no longer validates the ageBoundary metric/);
});

test('Appendix J: a metric the staff programme stops reading fails', () => {
  withFixture((root) => {
    edit(root, 'frontend/src/rebuild/staff/console/programmeApi.ts', "['familySocialPanel', 'views']", "['panel', 'views']");
    edit(root, 'frontend/src/rebuild/staff/console/programmeApi.ts', "['familySocialPanel', 'guardiansWithLinkedChild']", "['panel', 'guardiansWithLinkedChild']");
  }, /no longer reads the familySocialPanel metric/);
});

test('Appendix J: Core no longer recording a Tutor badge shown fails', () => {
  withFixture((root) => edit(root, 'backend/src/routes/profile.ts', "noteSocialProtectionEvent('tutor_badge_shown'", "void ('tutor_badge_shown'"), /no longer records tutor_badge_shown/);
});

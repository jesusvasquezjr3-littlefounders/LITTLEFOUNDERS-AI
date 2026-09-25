import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * check-social-tiers.mjs — the standing guardrail for Product 10 E.8, E.9 and
 * E.13 (Block E standard components 1, 3 and 4; Appendix J's Age-Tier
 * Differentiation Coverage, Comparison-Metric Audit and Profile-Content
 * Safety Review Coverage, automated instead of left to a quarterly look).
 *
 * Service suites pin behaviour inside each package; this gate pins the facts
 * that span packages and documents:
 *
 *   1. E.9: no follower/following COUNT exists on any profile surface. Core's
 *      profile routes never read or emit a count, and the legacy profile
 *      pages never render one.
 *   2. E.8 in the database: the tier classifier exists, and the LATEST
 *      definitions of the follow trigger and the visibility policy function
 *      (a later migration could silently replace them) still apply it: teen
 *      consent, the child's managed connections, the closed tier and the
 *      E.13 flag.
 *   3. E.8 in Core: visibility asks the database's tier, a teen request goes
 *      through the teen's own consent function, and the teen's decision is
 *      always the session's.
 *   4. E.13: the SQL classifier and Core's mirror carry the same rules (every
 *      pattern compared literally), the shared corpus exists, and the latest
 *      write guard on profiles is in place.
 *   5. The written policy states the tier table, the E.9 decision and the
 *      E.13 field audit.
 */

function read(root, path) {
  return readFileSync(resolve(root, path), 'utf8');
}

/** The body of the last migration (by number) that defines `name`. */
function latestDefinition(root, name) {
  const dir = resolve(root, 'database/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  let found = null;
  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8');
    const at = sql.indexOf(`FUNCTION public.${name}(`);
    if (at === -1) continue;
    const end = sql.indexOf('$$;', at);
    found = { file, body: sql.slice(at, end === -1 ? undefined : end) };
  }
  return found;
}

function tsPattern(source, name) {
  const match = new RegExp(`const ${name} = /(.*)/;`).exec(source);
  return match ? match[1].replaceAll('\\/', '/') : null;
}

export function checkSocialTiers(root) {
  const failures = [];

  // 1. E.9 — no count on the wire or on screen.
  const route = read(root, 'backend/src/routes/profile.ts');
  if (/getFollowCounts/.test(route)) failures.push('backend/src/routes/profile.ts: reads follower/following counts (E.9 removed them from every profile surface)');
  if (/\bfollowers:\s*counts\b|\bfollowing:\s*counts\b/.test(route)) failures.push('backend/src/routes/profile.ts: emits a follower/following count');
  for (const page of ['frontend/src/routes/app/profile/ProfilePage.tsx', 'frontend/src/routes/app/profile/PublicProfilePage.tsx']) {
    const source = read(root, page);
    if (/(?<!\.)\bdata\.follow(?:ers|ing)\b|name="followers"|name="following"/.test(source)) failures.push(`${page}: renders a follower/following count (E.9)`);
  }

  // 2. E.8 in the database: the latest definitions still apply the tiers.
  if (!latestDefinition(root, 'social_tier')) failures.push('database/migrations: public.social_tier is not defined (E.8)');
  const guard = latestDefinition(root, 'guard_social_follow_admission');
  for (const needle of ['social_tier', 'SUBJECT_CONSENT_REQUIRED', 'GUARDIAN_MANAGED_CONNECTIONS', 'SOCIAL_TIER_CLOSED', 'GUARDIAN_APPROVAL_REQUIRED', 'PROFILE_REVIEW_REQUIRED']) {
    if (!guard || !guard.body.includes(needle)) failures.push(`${guard?.file ?? 'database/migrations'}: the latest follow admission trigger no longer enforces ${needle} (E.8/E.13)`);
  }
  const visible = latestDefinition(root, 'social_subject_visible');
  for (const needle of ['social_tier', 'has_current_teen_consent', 'profile_fields_flagged', "'closed'"]) {
    if (!visible || !visible.body.includes(needle)) failures.push(`${visible?.file ?? 'database/migrations'}: the latest social_subject_visible no longer applies ${needle} (E.8/E.13)`);
  }

  // 3. E.8 in Core.
  const visibility = read(root, 'backend/src/services/socialVisibility.ts');
  if (!/readSocialTier\(/.test(visibility) || !/case 'teen':[\s\S]*return 'card';/.test(visibility)) failures.push("backend/src/services/socialVisibility.ts: visibility must ask the database's tier and keep a teen private ('card') by default");
  if (!/requestTeenConnection\(user\.id, profile\.user_id\)/.test(route)) failures.push('backend/src/routes/profile.ts: a teen request must bind the session requester and the resolved teen');
  if (!/decideTeenConnection\(id\.data, authedUser\(res\)\.id,/.test(route)) failures.push("backend/src/routes/profile.ts: the teen's decision must always be the session's own");
  if (!/subjectTier === 'teen'\) return fail\(res, 403, 'SUBJECT_CONSENT_REQUIRED'/.test(route)) failures.push('backend/src/routes/profile.ts: a direct follow into a teen must be refused');

  // 4. E.13 parity and guard.
  const flagsSql = latestDefinition(root, 'profile_field_flags');
  const mirror = read(root, 'backend/src/services/profileFieldSafety.ts');
  if (!flagsSql) failures.push('database/migrations: public.profile_field_flags is not defined (E.13)');
  else {
    // In order: contact (email), link, platform names, school, location, year.
    const sqlPatterns = [...flagsSql.body.matchAll(/v ~ '([^']*)'/g)].map((m) => m[1]);
    for (const [index, name] of [[1, 'LINK'], [2, 'PLATFORM_NAMES'], [3, 'SCHOOL'], [4, 'LOCATION'], [5, 'YEAR']]) {
      const sql = sqlPatterns[index] ?? null;
      const ts = tsPattern(mirror, name);
      if (!sql || !ts || sql !== ts) failures.push(`E.13 classifier drift: ${name} differs between ${flagsSql.file} (${sql}) and profileFieldSafety.ts (${ts})`);
    }
    const tokens = /ARRAY\[([^\]]*)\]/.exec(flagsSql.body)?.[1]?.replace(/[\s']/g, '');
    const tsTokens = /PLATFORM_TOKENS = new Set\(\[([^\]]*)\]\)/.exec(mirror)?.[1]?.replace(/[\s']/g, '');
    if (!tokens || tokens !== tsTokens) failures.push(`E.13 classifier drift: the platform token list differs (${tokens} vs ${tsTokens})`);
  }
  try {
    const corpus = JSON.parse(read(root, 'database/scripts/fixtures/profile-field-safety-cases.json'));
    if (!Array.isArray(corpus.cases) || corpus.cases.length < 40) failures.push('database/scripts/fixtures/profile-field-safety-cases.json: the shared E.13 corpus needs at least 40 cases');
  } catch {
    failures.push('database/scripts/fixtures/profile-field-safety-cases.json: the shared E.13 corpus is missing or unreadable');
  }
  const fieldGuard = latestDefinition(root, 'guard_profile_fields');
  if (!fieldGuard || !fieldGuard.body.includes('PROFILE_FIELD_UNSAFE') || !fieldGuard.body.includes('profile_review_in_scope')) {
    failures.push('database/migrations: the E.13 write guard on minors\' profile fields is missing');
  }

  // E.13 standing constraint: the profile has no free-text field beyond the reviewed ones.
  const patchBody = /const ProfilePatchBody = z\s*\.object\(\{([\s\S]*?)\}\)\s*\.strict\(\)/.exec(route)?.[1];
  const patchKeys = patchBody ? [...patchBody.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]).sort().join(',') : null;
  if (patchKeys !== 'displayName,locale,username') failures.push(`backend/src/routes/profile.ts: the profile patch schema accepts ${patchKeys}; a new free-text field on a minor's profile needs the E.13 review first`);

  // 5. The written policy.
  let policy = '';
  try { policy = read(root, 'docs/rebuild/policies/SOCIAL-TIERS.md'); } catch { failures.push('docs/rebuild/policies/SOCIAL-TIERS.md: the social-tier policy is missing'); }
  if (policy) {
    for (const heading of ['## 1. The tiers (E.8)', '## 2. No comparison count (E.9)', '## 3. Profile-content audit (E.13)']) {
      if (!policy.includes(heading)) failures.push(`docs/rebuild/policies/SOCIAL-TIERS.md: missing section "${heading}"`);
    }
    for (const tier of ['| guardian |', '| teen |', '| adult |', '| closed |']) {
      if (!policy.includes(tier)) failures.push(`docs/rebuild/policies/SOCIAL-TIERS.md: the tier table lacks the ${tier.replaceAll('|', '').trim()} row`);
    }
  }

  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const failures = checkSocialTiers(root);
  if (failures.length) {
    console.error('social-tiers check FAILED:');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log('social-tiers check OK: no comparison count, tiers enforced in the database and Core, classifier parity, write guard, policy');
}

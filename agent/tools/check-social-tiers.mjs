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
 *      profile routes never read or emit a count, and the rebuilt profile
 *      screens and people lists never render one.
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
 *   6. S-03 (OD-27 (2)): the 16-17 discoverable-profile opt-in stays narrow,
 *      and applies to a migrated child only with the specific OD-9 consent.
 *      The latest eligibility function still requires the teen tier, proven
 *      16+ age evidence and an unflagged profile; the latest visibility
 *      function consults only the eligibility-checked reader; Core's teen case
 *      asks it only after the E.13 flag check and keeps 'card' as the default;
 *      the opt-in route takes one literal boolean; and the policy records it.
 *   7. Appendix J E.1-E.5 (DoD 2.1(3)): the nine metrics of
 *      social_protection_metrics stay answered end to end. The latest SQL
 *      definition answers every key, Core validates every key and serves the
 *      route, the staff programme reads every group, and Core still records
 *      the events only it sees (follow refusals, the Tutor badge shown, the
 *      Family social panel view).
 *   8. E.1/E.3/E.13 (GAP-FIX-R3 social): the approval gate works both ways.
 *      The latest guardian_end_social_connection re-checks the guardian,
 *      refuses a self-managed teen, takes the pair locks and writes its
 *      guardian_ended audit row; the audit-completeness metric reconciles
 *      those unfollows; Core serves the end and report routes with the
 *      session guardian and records each removed edge; and the Family graph
 *      and safety notices offer both actions.
 *   9. E.2 / Law 5 / OD-27 (1) (GAP-FIX-R4 social): the verified Tutor sees
 *      a parent-created child's goals together. The latest
 *      coop_goal_guardian_goals checks the verified link and the guardian tier
 *      (a self-registered teen's goals stay its own, OD-3 Option B),
 *      reconciles first and returns no progress; Core serves it behind the
 *      guardian check, names people only through the discovery check and
 *      re-checks the link after the read; the guardian history reads every
 *      social.coop_* action the policy lists; and the Family card and the
 *      history render both.
 *  10. E.3 from the request queues (GAP-FIX-R5 social; OD-8's report action
 *      for unwanted contact; D-19). An inbound connection request is the
 *      first unwanted-contact event: Core serves a report on the Tutor's
 *      queue (the session guardian, admitted by the request addressed to the
 *      child, the link re-checked after the write) and a report and a block
 *      on the teen's own queue (the session, admitted by the request addressed
 *      to it, never by profile visibility); both admit a request closed
 *      without a connection for 30 days; both queues render the report dialog
 *      and the teen's a confirmed block; and the PostgreSQL proof that queue
 *      reports and blocks feed the E.3 pattern trigger is in the social gate.
 */

/** The nine Appendix J Part 1.1-1.2 metrics for E.1-E.5. Dropping one fails social:check. */
export const SOCIAL_PROTECTION_METRICS = [
  'discovery', 'unauthorizedConnections', 'approvalLatency', 'reports', 'patternEscalation',
  'ageBoundary', 'tutorBadge', 'familySocialPanel', 'auditCompleteness',
];

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

/** The screens, and their data planes, that show a profile or a list of people. */
export const SOCIAL_SCREENS = [
  'frontend/src/rebuild/account/OwnProfile.tsx', 'frontend/src/routes/app/profile/OwnProfileRoute.tsx',
  'frontend/src/rebuild/social/PublicProfile.tsx', 'frontend/src/routes/app/profile/PublicProfileRoute.tsx',
  'frontend/src/rebuild/social/PeopleList.tsx', 'frontend/src/routes/app/profile/PeopleListRoute.tsx',
];

export function checkSocialTiers(root) {
  const failures = [];

  // 1. E.9 — no count on the wire or on screen.
  const route = read(root, 'backend/src/routes/profile.ts');
  if (/getFollowCounts/.test(route)) failures.push('backend/src/routes/profile.ts: reads follower/following counts (E.9 removed them from every profile surface)');
  if (/\bfollowers:\s*counts\b|\bfollowing:\s*counts\b/.test(route)) failures.push('backend/src/routes/profile.ts: emits a follower/following count');
  // Every profile surface is a rebuilt screen and its data plane: the own profile (W2P.1), the public profile and the people lists (W2P.2).
  for (const page of SOCIAL_SCREENS) {
    const source = read(root, page);
    if (/(?<!\.)\b(?:data|person)\.follow(?:ers|ing)\b|name="followers"|name="following"|follow(?:er|ing)s?Count/.test(source)) failures.push(`${page}: renders a follower/following count (E.9)`);
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
  if (!/subjectTier === 'teen'\)\s*(?:\{[^}]{0,240}?)?return fail\(res, 403, 'SUBJECT_CONSENT_REQUIRED'/.test(route)) failures.push('backend/src/routes/profile.ts: a direct follow into a teen must be refused');

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

  // 6. S-03 (OD-27 (2)): the discoverable opt-in, only for a proven 16-17-year-old teen.
  const eligibleSql = latestDefinition(root, 'teen_discoverable_eligible');
  // OD-9 4.2 (GAP-FIX-R3): a new sharing surface applies to a migrated child only with its specific consent.
  for (const needle of ["social_tier(p_user) = 'teen'", 'age_at_least_by_birth_month(p_user, 16)', "interval '16 years'", 'NOT public.profile_fields_flagged(p_user)',
    "data_practice_applies(p_user, 'sharing.discoverable_profile')"]) {
    if (!eligibleSql || !eligibleSql.body.includes(needle)) failures.push(`${eligibleSql?.file ?? 'database/migrations'}: the latest teen_discoverable_eligible no longer requires ${needle} (S-03, OD-27)`);
  }
  const discoverableSql = latestDefinition(root, 'teen_profile_discoverable');
  if (!discoverableSql || !discoverableSql.body.includes('teen_discoverable_eligible(p_user)')) failures.push(`${discoverableSql?.file ?? 'database/migrations'}: teen_profile_discoverable must re-check eligibility on every read (S-03)`);
  const setSql = latestDefinition(root, 'set_teen_profile_discoverable');
  if (!setSql || !setSql.body.includes('DISCOVERABLE_NOT_ELIGIBLE') || !setSql.body.includes('audit_logs')) failures.push(`${setSql?.file ?? 'database/migrations'}: set_teen_profile_discoverable must refuse an ineligible opt-in and audit every change (S-03)`);
  if (!setSql || !setSql.body.includes('teen_discoverable_eligible(p_user)') || !setSql.body.includes('DATA_PRACTICE_CONSENT_REQUIRED')) failures.push(`${setSql?.file ?? 'database/migrations'}: set_teen_profile_discoverable must refuse what teen_discoverable_eligible refuses and name a missing OD-9 consent (DATA_PRACTICE_CONSENT_REQUIRED)`);
  if (visible && /teen_profile_discoverable|teen_discoverable/.test(visible.body) && !/teen_profile_discoverable\(p_subject\)/.test(visible.body)) failures.push(`${visible.file}: social_subject_visible may consult only teen_profile_discoverable(p_subject) (S-03)`);
  if (visible && /teen_profile_discoverable\(p_subject\)/.test(visible.body) && !/NOT public\.profile_fields_flagged\(p_subject\) AND \([\s\S]*teen_profile_discoverable\(p_subject\)/.test(visible.body)) failures.push(`${visible.file}: a discoverable teen must stay behind the E.13 flag check (S-03)`);
  const teenCase = /case 'teen':([\s\S]*?)return 'card';/.exec(visibility)?.[1] ?? '';
  if (/isTeenProfileDiscoverable/.test(visibility) && teenCase.indexOf('isFlagged') > teenCase.indexOf('isTeenProfileDiscoverable')) failures.push('backend/src/services/socialVisibility.ts: the discoverable check must come after the E.13 flag check (S-03)');
  if (!/router\.put\('\/discoverable'[\s\S]*?z\.object\(\{ discoverable: z\.boolean\(\) \}\)\.strict\(\)/.test(route)) failures.push('backend/src/routes/profile.ts: the discoverable opt-in must take one literal boolean (S-03)');

  // 7. Appendix J E.1-E.5: the nine metrics, SQL to screen.
  const metricsSql = latestDefinition(root, 'social_protection_metrics');
  const protection = (() => { try { return read(root, 'backend/src/services/socialProtection.ts'); } catch { return ''; } })();
  const admin = (() => { try { return read(root, 'backend/src/routes/admin.ts'); } catch { return ''; } })();
  const programme = (() => { try { return read(root, 'frontend/src/rebuild/staff/console/programmeApi.ts'); } catch { return ''; } })();
  const family = (() => { try { return read(root, 'backend/src/routes/family.ts'); } catch { return ''; } })();
  if (!metricsSql) failures.push('database/migrations: public.social_protection_metrics is not defined (Appendix J E.1-E.5)');
  if (!latestDefinition(root, 'record_social_protection_event')) failures.push('database/migrations: public.record_social_protection_event is not defined (Appendix J E.1-E.5)');
  const coreKeys = /SOCIAL_PROTECTION_METRIC_KEYS = \[([\s\S]*?)\]/.exec(protection)?.[1] ?? '';
  for (const key of SOCIAL_PROTECTION_METRICS) {
    if (metricsSql && !metricsSql.body.includes(`'${key}', `)) failures.push(`${metricsSql.file}: social_protection_metrics no longer answers ${key} (Appendix J)`);
    if (!coreKeys.includes(`'${key}'`) || !protection.includes(`  ${key}: z.object(`)) failures.push(`backend/src/services/socialProtection.ts: Core no longer validates the ${key} metric (Appendix J)`);
    if (!programme.includes(`['${key}', `)) failures.push(`frontend/src/rebuild/staff/console/programmeApi.ts: the staff programme no longer reads the ${key} metric (Appendix J)`);
  }
  if (!/router\.get\('\/analytics\/social-protection'/.test(admin)) failures.push('backend/src/routes/admin.ts: GET /analytics/social-protection is not served (Appendix J E.1-E.5)');
  for (const event of ['follow_refused_guardian', 'follow_refused_teen', 'tutor_badge_shown']) {
    if (!route.includes(`noteSocialProtectionEvent('${event}'`)) failures.push(`backend/src/routes/profile.ts: Core no longer records ${event} (Appendix J)`);
  }
  if (!/noteResolution\(surface, viewerId, profile\.user_id, access\)/.test(route)) failures.push('backend/src/routes/profile.ts: profile resolutions are no longer recorded (Appendix J E.1 discovery)');
  if (!family.includes("noteSocialProtectionEvent('family_social_panel_view'")) failures.push('backend/src/routes/family.ts: Family social panel views are no longer recorded (Appendix J E.2)');

  // 8. E.1/E.3/E.13: the Tutor ends or reports a connection of their child.
  const endSql = latestDefinition(root, 'guardian_end_social_connection');
  for (const needle of ['social_guardian_is_current(p_guardian, p_kid)', "'SOCIAL_SELF_MANAGED'", 'pg_advisory_xact_lock', "status = 'revoked'", "'guardian_ended'", 'audit_logs']) {
    if (!endSql || !endSql.body.includes(needle)) failures.push(`${endSql?.file ?? 'database/migrations'}: the latest guardian_end_social_connection no longer carries ${needle} (E.1/E.13)`);
  }
  if (metricsSql && !metricsSql.body.includes("'guardian_ended'")) failures.push(`${metricsSql.file}: audit completeness no longer reconciles guardian-ended unfollows (Appendix J E.2)`);
  if (!/router\.delete\('\/kids\/:kidId\/social\/connections\/:userId'[\s\S]*?guardianEndSocialConnection\(guardian, kidId, other\.data\)[\s\S]*?noteSocialProtectionEvent\('unfollow', guardian, kidId\)/.test(family)) {
    failures.push('backend/src/routes/family.ts: the guardian end route must end with the session guardian and record each removed edge (E.1/E.13, Appendix J)');
  }
  if (!/router\.post\('\/kids\/:kidId\/social\/connections\/:userId\/report'[\s\S]*?submitSocialReport\(guardian, other\.data,/.test(family)) {
    failures.push('backend/src/routes/family.ts: the guardian report route must file the report as the session guardian (E.3)');
  }
  const actions = (() => { try { return read(root, 'frontend/src/rebuild/social/ConnectionActions.tsx'); } catch { return ''; } })();
  if (!/<DestructiveAction\b/.test(actions) || !/<ReportDialog\b/.test(actions)) failures.push('frontend/src/rebuild/social/ConnectionActions.tsx: a connection must offer a confirmed end and the report dialog (E.1/E.3)');
  for (const surface of ['frontend/src/rebuild/social/SocialGraph.tsx', 'frontend/src/rebuild/social/SocialNotices.tsx']) {
    const source = (() => { try { return read(root, surface); } catch { return ''; } })();
    if (!/<ConnectionActions\b/.test(source)) failures.push(`${surface}: the Family surface no longer offers the Tutor's connection actions (E.1/E.3/E.13)`);
  }

  // 9. E.2 / Law 5: the Tutor sees the child's goals together, and the history carries them.
  const guardianGoals = latestDefinition(root, 'coop_goal_guardian_goals');
  for (const needle of ["verification_status = 'verified'", "'COOP_GUARDIAN_NOT_LINKED'", "social_tier(p_kid) IS DISTINCT FROM 'guardian'", "'COOP_NOT_ALLOWED'", 'coop_goal_reconcile(']) {
    if (!guardianGoals || !guardianGoals.body.includes(needle)) failures.push(`${guardianGoals?.file ?? 'database/migrations'}: the latest coop_goal_guardian_goals no longer carries ${needle} (E.2, OD-3 Option B)`);
  }
  if (guardianGoals && /coop_goal_done|'done'|'progress'/.test(guardianGoals.body)) failures.push(`${guardianGoals.file}: coop_goal_guardian_goals returns progress; the Tutor sees members and statuses only (OD-27 (1))`);
  if (!/router\.get\('\/kids\/:kidId\/coop-goals'[\s\S]*?guardKid\(req, res\)[\s\S]*?tier !== 'guardian'[\s\S]*?readCoopGuardianGoals\(guardian, kidId\)[\s\S]*?mayDiscoverProfile\(guardian, id\)[\s\S]*?if \(!await guardKid\(req, res\)\) return res;/.test(family)) {
    failures.push('backend/src/routes/family.ts: GET /kids/:kidId/coop-goals must check the guardian, refuse a self-managed teen, read as the session guardian, name people only through the discovery check and re-check the link after the read (E.2)');
  }
  const rest = (() => { try { return read(root, 'backend/src/services/supabaseRest.ts'); } catch { return ''; } })();
  const coopActions = /COOP_AUDIT_ACTIONS = \[([\s\S]*?)\] as const/.exec(rest)?.[1] ?? '';
  for (const action of ['social.coop_goal_created', 'social.coop_member_invited', 'social.coop_member_joined', 'social.coop_member_ended', 'social.coop_goal_closed']) {
    if (!coopActions.includes(`'${action}'`)) failures.push(`backend/src/services/supabaseRest.ts: the guardian history no longer reads ${action} (E.2)`);
  }
  if (!/export async function getGuardianSocialAuditPage[\s\S]*?COOP_AUDIT_ACTIONS[\s\S]*?or\(actor_id\.eq\./.test(rest)) failures.push('backend/src/services/supabaseRest.ts: getGuardianSocialAuditPage must read the goals-together rows where the child is the actor or the subject (E.2)');
  const coopCard = (() => { try { return read(root, 'frontend/src/rebuild/family/CoopGoalsConsent.tsx'); } catch { return ''; } })();
  if (!/data-coop-goal=/.test(coopCard) || !/copy\.privatePerson/.test(coopCard)) failures.push("frontend/src/rebuild/family/CoopGoalsConsent.tsx: the Tutor card no longer lists the child's goals and who is in them (E.2)");
  const history = (() => { try { return read(root, 'frontend/src/rebuild/social/SocialHistory.tsx'); } catch { return ''; } })();
  if (!/COOP_HISTORY_ACTIONS/.test(history) || !/coopSentence\(entry\)/.test(history)) failures.push('frontend/src/rebuild/social/SocialHistory.tsx: the Family history no longer renders goals-together events (E.2)');

  // 10. E.3 from the request queues (GAP-FIX-R5 social).
  if (!/router\.post\('\/kids\/:kidId\/social\/requests\/:requestId\/report'[\s\S]*?guardKid\(req, res\)[\s\S]*?GuardianReportBody\.safeParse[\s\S]*?getGuardianReportableRequest\(requestId\.data, kidId\)[\s\S]*?submitSocialReport\(guardian, request\.requesterId,[\s\S]*?if \(!await guardKid\(req, res\)\) return res;/.test(family)) {
    failures.push("backend/src/routes/family.ts: POST /kids/:kidId/social/requests/:requestId/report must check the guardian, bound the body, admit only a request addressed to the child, file the report as the session guardian and re-check the link after the write (E.3, OD-8)");
  }
  if (!/router\.post\('\/connection-requests\/:requestId\/report'[\s\S]*?queueRequester\(req, res, user\.id\)[\s\S]*?submitSocialReport\(user\.id, requester,/.test(route)
    || !/router\.post\('\/connection-requests\/:requestId\/block'[\s\S]*?queueRequester\(req, res, user\.id\)[\s\S]*?blockUser\(user\.accessToken, user\.id, requester\)/.test(route)
    || !/async function queueRequester[\s\S]*?getTeenActionableRequest\(id\.data, userId\)/.test(route)) {
    failures.push("backend/src/routes/profile.ts: the teen's queue must report and block the requester of a request addressed to the session, as the session (E.3, D-19)");
  }
  if (!/export const SOCIAL_REQUEST_ACTION_DAYS = 30;/.test(rest)) failures.push('backend/src/services/supabaseRest.ts: a closed request must stay reportable for 30 days (SOCIAL_REQUEST_ACTION_DAYS, E.3)');
  const guardianQueue = (() => { try { return read(root, 'frontend/src/rebuild/social/SocialRequests.tsx'); } catch { return ''; } })();
  if (!/<ReportDialog\b[\s\S]*?onReport\(request\.requestId,/.test(guardianQueue)) failures.push("frontend/src/rebuild/social/SocialRequests.tsx: the Tutor's request queue must offer the report dialog on every request (E.3, OD-8)");
  const teenQueue = (() => { try { return read(root, 'frontend/src/rebuild/social/TeenConnections.tsx'); } catch { return ''; } })();
  if (!/<ReportDialog\b[\s\S]*?onReport\(request\.requestId,/.test(teenQueue) || !/<DestructiveAction\b[\s\S]*?onBlock\(request\.requestId\)/.test(teenQueue)) {
    failures.push("frontend/src/rebuild/social/TeenConnections.tsx: the teen's request queue must offer the report dialog and a confirmed block on every request (E.3, D-19)");
  }
  const queueProof = (() => { try { return read(root, 'database/scripts/verify-social-request-report-postgres.py'); } catch { return ''; } })();
  if (!/evaluate_social_pattern/.test(queueProof) || !/request_teen_connection/.test(queueProof)) {
    failures.push('database/scripts/verify-social-request-report-postgres.py: the proof that queue reports and blocks feed the E.3 pattern trigger is missing (D-19)');
  }

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
    if (!policy.includes('### 1.1 A discoverable profile at 16 or 17 (S-03, OD-27)')) failures.push('docs/rebuild/policies/SOCIAL-TIERS.md: missing the 16-17 discoverable-profile section (S-03, OD-27)');
    if (!policy.includes('**The Tutor sees the goals (E.2, Law 5; GAP-FIX-R4).**')) failures.push("docs/rebuild/policies/SOCIAL-TIERS.md: missing the Tutor's view of goals together (E.2, GAP-FIX-R4)");
    if (!policy.includes('**Report and block from the request queues (E.3, D-19; GAP-FIX-R5).**')) failures.push('docs/rebuild/policies/SOCIAL-TIERS.md: missing the request-queue report and block (E.3, GAP-FIX-R5)');
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

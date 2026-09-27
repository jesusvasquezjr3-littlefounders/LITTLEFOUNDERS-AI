import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * check-social-governance.mjs (`npm run guardrails:check`): the standing
 * guardrail for Product 10 E.7, E.10, E.11 and E.12 (Block E standard
 * component 5; Appendix J's Future-Feature Messaging Gate Compliance,
 * Social-Data Retention-Policy Compliance, Avatar/No-Upload Constraint
 * Integrity, Brand-Narrative Coverage Check and Threshold Recalibration Log,
 * automated instead of left to a feature-launch checklist nobody opens).
 *
 * Policy: docs/rebuild/policies/SOCIAL-GOVERNANCE.md. Each numbered block
 * below pins one fact that spans packages and documents:
 *
 *   1. E.7: the policy adopts Appendix I and its recalibration log has no
 *      overdue review (a lapsed quarterly review turns this gate red).
 *   2. E.10: no table, view, column, function, Core route or frontend route
 *      carries a messaging word unless the policy reviewed it; the SQL scan,
 *      Core and the policy share one vocabulary and one reviewed list; the
 *      register of messaging-adjacent features demands default-off and
 *      opt-in; Core's route test exists.
 *   3. E.11: the retention windows are identical in SQL, Core and the policy;
 *      the latest sweep still covers every class; Core mounts it behind the
 *      internal key; a scheduled workflow calls it; social-graph data is not
 *      an analytics event and does not reach the warehouse.
 *   4. E.12: the avatar option set and the cover presets are identical in
 *      SQL, Core and the frontend; the write guards exist; every Core read
 *      projects; no upload surface exists beyond the reviewed ones; the brand
 *      position is written.
 */

const POLICY = 'docs/rebuild/policies/SOCIAL-GOVERNANCE.md';
const REGISTER = 'docs/rebuild/policies/messaging-features.json';

function read(root, path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function tryRead(root, path) {
  try { return read(root, path); } catch { return null; }
}

function walk(root, dir, keep) {
  const out = [];
  const base = resolve(root, dir);
  let entries;
  try { entries = readdirSync(base); } catch { return out; }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const full = join(base, name);
    if (statSync(full).isDirectory()) out.push(...walk(root, relative(root, full), keep));
    else if (keep(name)) out.push(relative(root, full).replaceAll('\\', '/'));
  }
  return out;
}

const isTest = (path) => /(__tests__|\.test\.|\.spec\.|test-setup)/.test(path);

function migrationFiles(root) {
  return readdirSync(resolve(root, 'database/migrations')).filter((f) => f.endsWith('.sql')).sort();
}

/** The body of the last migration (by number) that defines `name`. */
function latestDefinition(root, name) {
  let found = null;
  for (const file of migrationFiles(root)) {
    const sql = read(root, `database/migrations/${file}`);
    const at = sql.indexOf(`FUNCTION public.${name}(`);
    if (at === -1) continue;
    const end = sql.indexOf('$$;', at);
    found = { file, body: sql.slice(at, end === -1 ? undefined : end) };
  }
  return found;
}

/** Words of a quoted SQL/TS list: 'a', 'b' -> [a, b]. */
function quoted(text) {
  return [...(text ?? '').matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

function tsArray(source, name) {
  const m = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`).exec(source);
  return m ? quoted(m[1]) : null;
}

function tsPattern(source, name) {
  const m = new RegExp(`export const ${name} = /(.*)/;`).exec(source);
  return m ? m[1] : null;
}

/** Split a name into lowercase tokens (snake, kebab, camel, path). */
export function tokens(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Schema object names a migration creates: tables, views, columns, functions. */
export function schemaNames(sql) {
  const names = [];
  const clean = sql.replace(/--[^\n]*/g, '');
  for (const m of clean.matchAll(/CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(([\s\S]*?)\n\);/gi)) {
    const table = m[1].toLowerCase();
    names.push(`table:${table}`);
    for (const line of m[2].split('\n')) {
      const col = /^\s*"?([a-z_][a-z0-9_]*)"?\s+[a-z]/i.exec(line);
      if (col && !/^(constraint|primary|unique|check|foreign|exclude|like)$/i.test(col[1])) names.push(`column:${table}.${col[1].toLowerCase()}`);
    }
  }
  for (const m of clean.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi)) names.push(`view:${m[1].toLowerCase()}`);
  for (const m of clean.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?([\s\S]*?);/gi)) {
    for (const c of m[2].matchAll(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z_][a-z0-9_]*)"?/gi)) names.push(`column:${m[1].toLowerCase()}.${c[1].toLowerCase()}`);
  }
  for (const m of clean.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi)) names.push(`function:${m[1].toLowerCase()}`);
  return [...new Set(names)];
}

/** Core route paths: app.use mounts and router.<verb> paths. */
export function coreRoutePaths(source) {
  return [...source.matchAll(/\b(?:app|router)\.(?:use|get|post|put|patch|delete|all)\(\s*(['"`])([^'"`]*)\1/g)].map((m) => m[2]);
}

/** Frontend route paths: <Route path="..."> and { path: '...' }. */
export function frontendRoutePaths(source) {
  return [
    ...[...source.matchAll(/\bpath=["']([^"']*)["']/g)].map((m) => m[1]),
    ...[...source.matchAll(/\bpath:\s*["'`]([^"'`]*)["'`]/g)].map((m) => m[1]),
  ];
}

/** Rows of the markdown table that follows `heading`, as arrays of trimmed cells (header and rule skipped). */
function tableAfter(markdown, heading) {
  const at = markdown.indexOf(heading);
  if (at === -1) return null;
  const rows = [];
  let started = false;
  for (const line of markdown.slice(at + heading.length).split('\n')) {
    if (line.startsWith('|')) { started = true; rows.push(line.split('|').slice(1, -1).map((c) => c.trim())); }
    else if (started) break;
    else if (/^#{1,6} /.test(line)) break;
  }
  return rows.slice(2);
}

function sameList(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function checkSocialGovernance(root, { today = new Date() } = {}) {
  const failures = [];
  const policy = tryRead(root, POLICY);
  if (!policy) {
    failures.push(`${POLICY}: the social-governance policy is missing`);
    return failures;
  }
  for (const heading of [
    '## 1. Research foundation (E.7)', '### 1.2 Threshold Recalibration Log (Block E)', '### 1.3 Regulatory watch list',
    '## 2. No person-to-person messaging (E.10)', '### 2.1 The standing constraint', '### 2.2 Reviewed names',
    '## 3. Social-graph data: retention, deletion and disclosure (E.11)', '### 3.2 Retention', '### 3.3 Being followed is its own disclosure event',
    '## 4. Cartoon-only avatars, no image upload (E.12)', '### 4.2 Reviewed upload surfaces', '## 5. Brand position (E.12)',
  ]) if (!policy.includes(heading)) failures.push(`${POLICY}: missing section "${heading}"`);

  // ── 1. E.7: Appendix I adopted; no recalibration overdue ─────────────────
  if (!policy.includes('10-APPENDIX-I-PROFILE-SOCIAL-SAFETY-RESEARCH-FRAMEWORK.md')) failures.push(`${POLICY}: section 1 must name Appendix I as the authoritative research basis (E.7)`);
  const log = tableAfter(policy, '### 1.2 Threshold Recalibration Log (Block E)') ?? [];
  if (log.length < 8) failures.push(`${POLICY}: the Threshold Recalibration Log lists ${log.length} thresholds; Block E has at least 8`);
  const todayIso = today.toISOString().slice(0, 10);
  for (const row of log) {
    const due = row[row.length - 1];
    const last = row[row.length - 2];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(last ?? '')) failures.push(`${POLICY}: recalibration row "${row[0]}" needs ISO "Last reviewed" and "Next review due" dates`);
    else if (due < todayIso) failures.push(`${POLICY}: the recalibration of "${row[0]}" was due ${due} (E.7/Appendix J 1.4); record the Safety/Trust review and the next date`);
    else if (due <= last) failures.push(`${POLICY}: recalibration row "${row[0]}" is due before it was last reviewed`);
  }

  // ── 2. E.10: no unreviewed messaging surface ─────────────────────────────
  const scan = latestDefinition(root, 'social_messaging_surfaces');
  const governance = tryRead(root, 'backend/src/services/socialGovernance.ts') ?? '';
  const coreVocabulary = tsArray(governance, 'MESSAGING_VOCABULARY');
  let vocabulary = coreVocabulary ?? [];
  let sqlReviewed = [];
  if (!scan) failures.push('database/migrations: public.social_messaging_surfaces is not defined (E.10)');
  else {
    const sqlVocabulary = quoted(/vocabulary\(word\) AS \(\s*SELECT unnest\(ARRAY\[([\s\S]*?)\]\)/.exec(scan.body)?.[1]);
    sqlReviewed = quoted(/reviewed\(name\) AS \(\s*SELECT unnest\(ARRAY\[([\s\S]*?)\]\)/.exec(scan.body)?.[1]);
    if (!coreVocabulary || !sameList(sqlVocabulary, coreVocabulary)) failures.push(`E.10 vocabulary drift between ${scan.file} and backend/src/services/socialGovernance.ts`);
    if (!scan.body.includes('multi_account') || !scan.body.includes("'auth.users'::regclass")) failures.push(`${scan.file}: the latest scan no longer applies the structure rule (free text in a table referencing two accounts)`);
    if (sqlVocabulary.length > 0) vocabulary = sqlVocabulary;
  }
  const policyReviewed = (tableAfter(policy, '### 2.2 Reviewed names') ?? []).map((row) => /^`([^`]+)`$/.exec(row[0] ?? '')?.[1]).filter(Boolean);
  const reviewedSchema = policyReviewed.filter((n) => !n.startsWith('route:'));
  if (!sameList([...reviewedSchema].sort(), [...sqlReviewed].sort())) {
    failures.push(`E.10 reviewed-name drift: the policy's section 2.2 lists [${reviewedSchema.join(', ')}] and the SQL scan [${sqlReviewed.join(', ')}]`);
  }
  const reviewed = new Set(policyReviewed);
  const words = new Set(vocabulary);
  const carries = (name) => tokens(name.replace(/^[a-z]+:/, '')).some((t) => words.has(t));

  const created = new Set();
  for (const file of migrationFiles(root)) {
    const sql = read(root, `database/migrations/${file}`);
    for (const name of schemaNames(sql)) {
      created.add(name);
      if (carries(name) && !reviewed.has(name)) failures.push(`database/migrations/${file}: ${name} is a messaging surface not reviewed in ${POLICY} §2.2 (E.10)`);
    }
    // A renamed table keeps its columns under the new name.
    for (const m of sql.replace(/--[^\n]*/g, '').matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s+RENAME\s+TO\s+"?([a-z_][a-z0-9_]*)"?/gi)) {
      const [from, to] = [m[1].toLowerCase(), m[2].toLowerCase()];
      if (carries(`table:${to}`) && !reviewed.has(`table:${to}`)) failures.push(`database/migrations/${file}: table:${to} is a messaging surface not reviewed in ${POLICY} §2.2 (E.10)`);
      for (const name of [...created]) {
        if (name === `table:${from}`) created.add(`table:${to}`);
        if (name.startsWith(`column:${from}.`)) created.add(`column:${to}.${name.slice(`column:${from}.`.length)}`);
      }
    }
  }
  for (const file of ['backend/src/app.ts', ...walk(root, 'backend/src/routes', (n) => n.endsWith('.ts')).filter((f) => !isTest(f))]) {
    const source = tryRead(root, file);
    if (source === null) continue;
    for (const path of coreRoutePaths(source)) if (carries(path) && !reviewed.has(`route:${path}`)) failures.push(`${file}: Core route "${path}" is a messaging surface not reviewed in ${POLICY} §2.2 (E.10)`);
  }
  for (const file of walk(root, 'frontend/src', (n) => /\.(tsx|ts)$/.test(n)).filter((f) => !isTest(f))) {
    const source = read(root, file);
    for (const path of frontendRoutePaths(source)) if (carries(path) && !reviewed.has(`route:${path}`)) failures.push(`${file}: frontend route "${path}" is a messaging surface not reviewed in ${POLICY} §2.2 (E.10)`);
  }

  let register = null;
  try { register = JSON.parse(read(root, REGISTER)); } catch { failures.push(`${REGISTER}: the E.10 register of messaging-adjacent features is missing or not JSON`); }
  if (register) {
    if (!Array.isArray(register.features)) failures.push(`${REGISTER}: "features" must be an array`);
    for (const feature of register.features ?? []) {
      const id = feature?.id ?? '(no id)';
      const d = feature?.defaultOn ?? {};
      const a = feature?.activation ?? {};
      if (d.guardian !== false || d.teen !== false || d.closed !== false) failures.push(`${REGISTER}: ${id} must default off for the guardian, teen and closed tiers (E.10)`);
      if (a.guardian !== 'guardian_opt_in_per_child' || a.teen !== 'teen_opt_in_with_guardian_notice' || a.closed !== 'never') failures.push(`${REGISTER}: ${id} must require a guardian opt-in per child, a teen opt-in with guardian notice, and never for the closed tier (E.10)`);
      if (feature?.stage0Classification !== 'discoverability/safety') failures.push(`${REGISTER}: ${id} must be classified discoverability/safety at Stage 0 (Appendix J Part 3)`);
      for (const key of ['stage0Date', 'stage3ReviewDate']) if (!/^\d{4}-\d{2}-\d{2}$/.test(feature?.[key] ?? '')) failures.push(`${REGISTER}: ${id} needs ${key} (Stage 3 review before shipping)`);
      if (!Array.isArray(feature?.surfaces) || feature.surfaces.length === 0) failures.push(`${REGISTER}: ${id} must list its surfaces`);
      for (const surface of feature?.surfaces ?? []) if (!reviewed.has(surface)) failures.push(`${REGISTER}: ${id}'s surface ${surface} is not listed in ${POLICY} §2.2`);
    }
  }
  const coreTest = tryRead(root, 'backend/src/__tests__/socialGovernance.test.ts') ?? '';
  if (!coreTest.includes('no mounted or routed path carries a messaging word')) failures.push('backend/src/__tests__/socialGovernance.test.ts: Core\'s E.10 route test is missing');

  // ── 3. E.11: retention windows, sweep, schedule, no third-party disclosure ─
  const windowsSql = latestDefinition(root, 'social_retention_windows');
  const sqlWindows = Object.fromEntries([...(windowsSql?.body ?? '').matchAll(/'(\w+)',\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]));
  const coreWindowsBlock = /export const SOCIAL_RETENTION_WINDOWS = \{([\s\S]*?)\} as const;/.exec(governance)?.[1] ?? '';
  const coreWindows = Object.fromEntries([...coreWindowsBlock.matchAll(/(\w+):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]));
  const policyWindows = Object.fromEntries((tableAfter(policy, '### 3.2 Retention') ?? []).map((row) => [/^`(\w+)`$/.exec(row[0] ?? '')?.[1], Number(/^(\d+) days$/.exec(row[1] ?? '')?.[1])]).filter(([k, v]) => k && Number.isInteger(v)));
  const keys = Object.keys(sqlWindows).sort();
  if (keys.length < 7) failures.push('database/migrations: public.social_retention_windows is missing or incomplete (E.11)');
  for (const [label, other] of [['backend/src/services/socialGovernance.ts', coreWindows], [`${POLICY} §3.2`, policyWindows]]) {
    const otherKeys = Object.keys(other).sort();
    if (!sameList(keys, otherKeys) || keys.some((k) => sqlWindows[k] !== other[k])) failures.push(`E.11 retention-window drift between ${windowsSql?.file ?? 'the database'} ${JSON.stringify(sqlWindows)} and ${label} ${JSON.stringify(other)}`);
  }
  const sweepSql = latestDefinition(root, 'run_social_graph_retention');
  for (const needle of ['social_consent_requests', 'social_connection_requests', 'social_reports', 'social_review_cases', 'social_safety_notices', 'public.follows', 'audit_logs', 'social_edge_consented', 'social_retention.sweep_ran', 'social_retention_windows']) {
    if (!sweepSql || !sweepSql.body.includes(needle)) failures.push(`${sweepSql?.file ?? 'database/migrations'}: the latest run_social_graph_retention no longer covers ${needle} (E.11)`);
  }
  // public.audit_logs is append-only (README non-negotiables): no migration deletes or updates it.
  for (const file of migrationFiles(root)) {
    if (/(DELETE\s+FROM|UPDATE)\s+public\.audit_logs\b/i.test(read(root, `database/migrations/${file}`).replace(/--[^\n]*/g, ''))) failures.push(`database/migrations/${file}: deletes or updates public.audit_logs, which is append-only; an audit expiry is an owner decision (${POLICY} §8)`);
  }
  const consent = latestDefinition(root, 'social_edge_consented');
  if (!consent || !consent.body.includes('social_guardian_is_current') || !consent.body.includes('social_child_account')) failures.push(`${consent?.file ?? 'database/migrations'}: the E.11 consent rule must require a CURRENT guardian's approval for every child edge`);
  const app = tryRead(root, 'backend/src/app.ts') ?? '';
  const sweepRoute = tryRead(root, 'backend/src/routes/socialRetention.ts') ?? '';
  if (!/app\.use\('\/api\/v1\/internal\/social-retention', socialRetentionSweepRouter\(\)\)/.test(app)) failures.push('backend/src/app.ts: the E.11 sweep route is not mounted at /api/v1/internal/social-retention');
  if (!/router\.use\(requireInternalKey\)/.test(sweepRoute) || !/runSocialGraphRetention\(/.test(sweepRoute)) failures.push('backend/src/routes/socialRetention.ts: the sweep must run behind the internal key');
  const workflow = tryRead(root, '.github/workflows/social-retention.yml') ?? '';
  if (!/schedule:\s*\n\s*- cron:/.test(workflow) || !workflow.includes('/api/v1/internal/social-retention/run')) failures.push('.github/workflows/social-retention.yml: the daily E.11 sweep workflow is missing or does not call Core\'s sweep');
  // The published half (E.11 "publish"; E.10 stated to families): the FAQ in every locale.
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) {
    let items = null;
    try { items = JSON.parse(read(root, `frontend/src/i18n/${locale}/marketing.json`)).faq?.items ?? null; } catch { /* reported below */ }
    const retention = items?.socialRetention?.answer ?? '';
    if (!items?.noMessaging?.answer || !items?.noMessaging?.question) failures.push(`frontend/src/i18n/${locale}/marketing.json: the FAQ must state the no-messaging constraint (faq.items.noMessaging, E.10)`);
    if (!retention.includes(String(sqlWindows.pendingRequestDays)) || !retention.includes(String(sqlWindows.closedRequestDays))) failures.push(`frontend/src/i18n/${locale}/marketing.json: the FAQ must publish the request windows (${sqlWindows.pendingRequestDays} and ${sqlWindows.closedRequestDays} days; faq.items.socialRetention, E.11)`);
  }
  const faqPage = tryRead(root, 'frontend/src/routes/marketing/FAQ.tsx') ?? '';
  for (const id of ['noMessaging', 'socialRetention']) if (!faqPage.includes(`{ id: "${id}", category: "privacy" }`)) failures.push(`frontend/src/routes/marketing/FAQ.tsx: the FAQ does not list ${id}`);

  const events = tsArray(tryRead(root, 'backend/src/services/insights.ts') ?? '', 'RECORDABLE_EVENTS');
  if (!events) failures.push('backend/src/services/insights.ts: RECORDABLE_EVENTS not found');
  for (const event of events ?? []) if (/follow|block|connection|social/.test(event)) failures.push(`backend/src/services/insights.ts: analytics event "${event}" discloses social-graph data (E.11 §3.3)`);
  for (const file of walk(root, 'dataintel/src', (n) => n.endsWith('.ts')).filter((f) => !isTest(f))) {
    if (/['"`/.](follows|blocks|social_connection_requests|social_consent_requests)\b/.test(read(root, file))) failures.push(`${file}: the warehouse reads social-graph data (E.11 §3.3: it never leaves Core's database)`);
  }

  // ── 4. E.12: cartoon-only avatar and preset cover, no upload ──────────────
  const shape = tryRead(root, 'backend/src/services/profileShape.ts') ?? '';
  const avatarSql = latestDefinition(root, 'avatar_options_valid');
  if (!avatarSql) failures.push('database/migrations: public.avatar_options_valid is not defined (E.12)');
  else {
    const arrayKeys = quoted(/ELSIF entry\.key IN \(([^)]*)\) THEN\s*IF jsonb_typeof\(entry\.value\) <> 'array'/.exec(avatarSql.body)?.[1]);
    const numberKeys = quoted(/ELSIF entry\.key IN \(([^)]*)\) THEN\s*IF jsonb_typeof\(entry\.value\) <> 'number'/.exec(avatarSql.body)?.[1]);
    if (!sameList(arrayKeys, tsArray(shape, 'AVATAR_ARRAY_KEYS') ?? [])) failures.push(`E.12 avatar key drift: ${avatarSql.file} [${arrayKeys}] vs profileShape.ts AVATAR_ARRAY_KEYS`);
    if (!sameList(numberKeys, tsArray(shape, 'AVATAR_NUMBER_KEYS') ?? [])) failures.push(`E.12 avatar key drift: ${avatarSql.file} [${numberKeys}] vs profileShape.ts AVATAR_NUMBER_KEYS`);
    for (const name of ['AVATAR_SEED_PATTERN', 'AVATAR_VALUE_PATTERN']) {
      const pattern = tsPattern(shape, name);
      if (!pattern || !avatarSql.body.includes(`!~ '${pattern}'`)) failures.push(`E.12 avatar pattern drift: ${name} (${pattern}) is not the pattern ${avatarSql.file} applies`);
    }
    if (/ELSE\s+RETURN false;/.test(avatarSql.body) === false) failures.push(`${avatarSql.file}: avatar_options_valid must refuse every key it does not name`);
  }
  const coverSql = latestDefinition(root, 'profile_cover_valid');
  const sqlPresets = quoted(/IN \(([^)]*)\)\)/.exec(coverSql?.body ?? '')?.[1]);
  const corePresets = tsArray(shape, 'COVER_PRESETS') ?? [];
  const frontendPresets = [...(tryRead(root, 'frontend/src/lib/coverPresets.ts') ?? '').matchAll(/\{ id: '([^']+)'/g)].map((m) => m[1]);
  // The rebuilt look editor and profile (W2P.1) draw the same ten presets from their own list.
  const rebuiltPresets = quoted(/export const COVER_IDS = \[([^\]]*)\]/.exec(tryRead(root, 'frontend/src/rebuild/account/avatar/avatarKit.ts') ?? '')?.[1]);
  if (sqlPresets.length !== 10 || !sameList(sqlPresets, corePresets) || !sameList(corePresets, frontendPresets) || !sameList(corePresets, rebuiltPresets)) {
    failures.push(`E.12 cover preset drift: SQL [${sqlPresets}], Core [${corePresets}], frontend [${frontendPresets}], rebuilt [${rebuiltPresets}]`);
  }
  const migrationsText = migrationFiles(root).map((f) => read(root, `database/migrations/${f}`)).join('\n');
  for (const [trigger, fn] of [['avatar_shape_guard', 'guard_avatar_shape'], ['profile_cover_guard', 'guard_profile_cover']]) {
    if (!new RegExp(`CREATE (?:OR REPLACE )?TRIGGER ${trigger}`).test(migrationsText) || new RegExp(`DROP TRIGGER (?:IF EXISTS )?${trigger}`).test(migrationsText) || !latestDefinition(root, fn)) failures.push(`database/migrations: the E.12 write guard ${trigger} is missing or dropped`);
  }
  const profileRoute = tryRead(root, 'backend/src/routes/profile.ts') ?? '';
  if (!/const AvatarBody = z\.object\(\{ options: AvatarOptions \}\)/.test(profileRoute)) failures.push('backend/src/routes/profile.ts: the avatar write must accept only profileShape.ts\'s AvatarOptions');
  if (!/cover: projectCover\(profile\.cover\),\s*avatarOptions: projectAvatarOptions\(avatarOptions\)/.test(profileRoute)) failures.push('backend/src/routes/profile.ts: public profiles must project the avatar and cover (E.12)');
  if (/\bcover: profile\.cover\b/.test(profileRoute)) failures.push('backend/src/routes/profile.ts: a stored cover is served without projectCover (E.12)');
  if (!/avatarOptions: projectAvatarOptions\(/.test(tryRead(root, 'backend/src/services/supabaseRest.ts') ?? '')) failures.push('backend/src/services/supabaseRest.ts: social cards must project the avatar (E.12)');
  const authRoute = tryRead(root, 'backend/src/routes/auth.ts') ?? '';
  if (!/avatarOptions: projectAvatarOptions\(/.test(authRoute) || !/cover: projectCover\(/.test(authRoute)) failures.push('backend/src/routes/auth.ts: /auth/me must project the avatar and cover (E.12)');

  const uploadRows = (tableAfter(policy, '### 4.2 Reviewed upload surfaces') ?? []).map((row) => /^`([^`]+)`$/.exec(row[0] ?? '')?.[1]).filter(Boolean);
  const reviewedUploads = new Set(uploadRows);
  for (const file of walk(root, 'backend/src', (n) => n.endsWith('.ts')).filter((f) => !isTest(f))) {
    const source = read(root, file);
    if (/^\s*import\s[^;]*from\s+['"](multer|busboy|formidable|@fastify\/multipart)['"]/m.test(source) || /\bexpress\.raw\(/.test(source)) {
      if (!reviewedUploads.has(file)) failures.push(`${file}: an upload parser outside the reviewed upload surfaces (${POLICY} §4.2); a profile image needs the full E.12 child-safety re-review`);
    }
  }
  for (const file of walk(root, 'frontend/src', (n) => n.endsWith('.tsx')).filter((f) => !isTest(f))) {
    if (/type=["']file["']/.test(read(root, file)) && !reviewedUploads.has(file)) failures.push(`${file}: a file input outside the reviewed upload surfaces (${POLICY} §4.2; E.12)`);
  }
  if (/multer|upload\.single|multipart/.test(profileRoute)) failures.push('backend/src/routes/profile.ts: the profile routes accept an upload (E.12 forbids image upload for profiles, avatars and covers)');

  const narrative = tryRead(root, 'docs/product-audit/COSMIC_NARRATIVE.md') ?? '';
  const start = narrative.indexOf('## 6. People You Already Know');
  if (start === -1) failures.push('docs/product-audit/COSMIC_NARRATIVE.md: missing the "People You Already Know" social-layer brand position (E.12)');
  else {
    const section = narrative.slice(start, narrative.indexOf('\n---', start + 10) === -1 ? undefined : narrative.indexOf('\n---', start + 10)).toLowerCase();
    for (const [needle, why] of [
      ['a small, safe way to say hello to people you already know', 'the E.12 position itself'],
      ['not the feed', 'the distinction from the Feed'],
      ['public social graph', 'the refusal of a public social graph'],
      ['no messages', 'the no-messaging constraint (E.10)'],
      ['cartoon', 'the cartoon-only avatar (E.12)'],
      ['follower count', 'no comparison count (E.9)'],
      ['law 5', 'the Law 5 grounding'],
    ]) if (!section.includes(needle)) failures.push(`COSMIC_NARRATIVE.md §6 must state ${why} ("${needle}")`);
  }

  // Unused-name guard: a reviewed schema name that no migration creates is stale.
  for (const name of reviewedSchema) {
    if (name.startsWith('text:')) {
      const [table, column] = name.slice(5).split('.');
      if (!created.has(`column:${table}.${column}`)) failures.push(`${POLICY} §2.2: ${name} names a column no migration creates`);
    } else if (!created.has(name)) failures.push(`${POLICY} §2.2: ${name} names an object no migration creates`);
  }

  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const failures = checkSocialGovernance(root);
  if (failures.length) {
    console.error('social-governance check FAILED:');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log('social-governance check OK: Appendix I adopted and recalibration current, no unreviewed messaging surface, retention windows and sweep in step, cartoon-only avatars and presets, no unreviewed upload, brand position');
}

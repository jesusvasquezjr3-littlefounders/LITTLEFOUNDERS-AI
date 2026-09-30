import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSocialGovernance, coreRoutePaths, frontendRoutePaths, schemaNames, tokens } from './check-social-governance.mjs';

/*
 * The E.7/E.10/E.11/E.12 guardrail must pass on the real tree and fail on
 * each regression it exists to catch: a checker nobody has seen fail is not
 * a checker. One copy of the scanned tree is made; every case edits it and
 * restores it before the next case.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const DIRS = ['database/migrations', 'backend/src', 'frontend/src', 'dataintel/src'];
const FILES = [
  'docs/rebuild/policies/SOCIAL-GOVERNANCE.md',
  'docs/rebuild/policies/messaging-features.json',
  'docs/product-audit/COSMIC_NARRATIVE.md',
  '.github/workflows/social-retention.yml',
];
const TODAY = new Date('2026-09-25T12:00:00Z');
let root;

before(() => {
  root = mkdtempSync(join(tmpdir(), 'lf-social-governance-'));
  for (const dir of DIRS) cpSync(resolve(repo, dir), join(root, dir), { recursive: true, filter: (src) => !src.includes('node_modules') });
  for (const file of FILES) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(resolve(repo, file), join(root, file));
  }
});
after(() => rmSync(root, { recursive: true, force: true }));

/** Apply edits ([file, from, to] replaces; [file, null, content] creates), check, then restore. */
function expectFailure(edits, expected, options = {}) {
  const restore = [];
  try {
    for (const [file, from, to] of edits) {
      const path = join(root, file);
      if (from === null) {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, to);
        restore.push(() => rmSync(path, { force: true }));
        continue;
      }
      const source = readFileSync(path, 'utf8');
      assert.ok(source.includes(from), `${file} fixture lacks ${JSON.stringify(from.slice(0, 80))}`);
      writeFileSync(path, source.replace(from, to));
      restore.push(() => writeFileSync(path, source));
    }
    const failures = checkSocialGovernance(root, { today: TODAY, ...options });
    assert.ok(failures.some((f) => expected.test(f)), `expected ${expected} in ${JSON.stringify(failures, null, 1)}`);
  } finally {
    for (const undo of restore.reverse()) undo();
  }
}

const NEXT = 'database/migrations/9999_regression.sql';

test('the real tree passes', () => {
  assert.deepEqual(checkSocialGovernance(root, { today: TODAY }), []);
  assert.deepEqual(checkSocialGovernance(repo, { today: TODAY }), []);
});

test('parsers find tables, columns, views, functions and routes', () => {
  assert.deepEqual(schemaNames('CREATE TABLE IF NOT EXISTS public.kid_chats (\n  id uuid PRIMARY KEY,\n  body text,\n  CONSTRAINT x CHECK (true)\n);\nALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS reply_text text;\nCREATE OR REPLACE FUNCTION public.send_greeting(p uuid) RETURNS void AS $$ $$;\nCREATE VIEW public.inbox_view AS SELECT 1;').sort(),
    ['column:kid_chats.body', 'column:kid_chats.id', 'column:tasks.reply_text', 'function:send_greeting', 'table:kid_chats', 'view:inbox_view']);
  assert.deepEqual(coreRoutePaths("app.use('/api/v1/x', r());\nrouter.post('/say-hi/:id', h);"), ['/api/v1/x', '/say-hi/:id']);
  assert.deepEqual(frontendRoutePaths('<Route path="profile/messages" />{ path: \'/dm\' }'), ['profile/messages', '/dm']);
  assert.deepEqual(tokens('kidDirectMessages/:id'), ['kid', 'direct', 'messages', 'id']);
});

test('E.10: a messaging table, a reply column, a function, a view or a renamed table in a migration fails', () => {
  expectFailure([[NEXT, null, '-- @phase: expand\nCREATE TABLE public.direct_messages (\n  id uuid PRIMARY KEY,\n  body text\n);\n']], /table:direct_messages is a messaging surface/);
  expectFailure([[NEXT, null, '-- @phase: expand\nALTER TABLE public.tasks ADD COLUMN kid_reply text;\n']], /column:tasks\.kid_reply is a messaging surface/);
  expectFailure([[NEXT, null, '-- @phase: expand\nCREATE OR REPLACE FUNCTION public.send_kid_greeting() RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;\n']], /function:send_kid_greeting/);
  expectFailure([[NEXT, null, '-- @phase: expand\nCREATE VIEW public.family_chat AS SELECT 1;\n']], /view:family_chat/);
  expectFailure([[NEXT, null, '-- @phase: contract\nALTER TABLE public.social_reports RENAME TO social_comments;\n']], /table:social_comments/);
});

test('E.10: a messaging route in Core or the frontend fails', () => {
  expectFailure([['backend/src/routes/profile.ts', "router.get('/followers',", "router.post('/say-hi/reply', (_q, r) => r.end());\n  router.get('/followers',"]], /Core route "\/say-hi\/reply"/);
  expectFailure([['backend/src/app.ts', "app.use('/api/v1/profile', ownProfileRouter());", "app.use('/api/v1/profile', ownProfileRouter());\n  app.use('/api/v1/kid-chat', ownProfileRouter());"]], /Core route "\/api\/v1\/kid-chat"/);
  expectFailure([['frontend/src/app-routes/site.tsx', 'path="faq"', 'path="faq" element={null} /><Route path="family/messages"']], /frontend route "family\/messages"/);
});

test('E.10: vocabulary or reviewed-list drift fails', () => {
  expectFailure([['backend/src/services/socialGovernance.ts', "'greeting', 'greetings',", "'greeting',"]], /E\.10 vocabulary drift/);
  expectFailure([['docs/rebuild/policies/SOCIAL-GOVERNANCE.md', '| `text:tasks.title` | A task title a guardian writes for their own child, inside the family |\n', '']], /reviewed-name drift/);
  expectFailure([['docs/rebuild/policies/SOCIAL-GOVERNANCE.md', '| `text:tasks.title` |', '| `text:tasks.title` | x |\n| `text:tasks.ghost_note` |']], /text:tasks\.ghost_note names a column no migration creates|reviewed-name drift/);
  // The gate reads the LATEST definition of the scan (0121 first, redefined by
  // later migrations such as the S07 merge's reconciliation), so the mutation
  // targets whichever migration defines it last.
  const latestScan = readdirSync(resolve(repo, 'database/migrations')).filter((f) => f.endsWith('.sql')).sort()
    .filter((f) => readFileSync(resolve(repo, 'database/migrations', f), 'utf8').includes('FUNCTION public.social_messaging_surfaces(')).at(-1);
  expectFailure([[`database/migrations/${latestScan}`, "AND con.confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass)", "AND false"]], /structure rule/);
});

test('E.10: the register refuses a feature that is on by default, lacks the opt-ins, the reviews or reviewed surfaces', () => {
  const register = JSON.parse(readFileSync(resolve(repo, 'docs/rebuild/policies/messaging-features.json'), 'utf8'));
  const good = {
    id: 'family-hello', summary: 'a family-only hello', defaultOn: { guardian: false, teen: false, adult: false, closed: false },
    activation: { guardian: 'guardian_opt_in_per_child', teen: 'teen_opt_in_with_guardian_notice', teenWithoutGuardian: 'never', closed: 'never' },
    stage0Classification: 'discoverability/safety', stage0Date: '2026-10-01', stage3ReviewDate: '2026-10-15', surfaces: ['text:tasks.title'],
  };
  const write = (feature) => [['docs/rebuild/policies/messaging-features.json', '"features": []', `"features": [${JSON.stringify(feature)}]`]];
  expectFailure(write({ ...good, defaultOn: { ...good.defaultOn, teen: true } }), /must default off/);
  expectFailure(write({ ...good, activation: { ...good.activation, guardian: 'teen_opt_in' } }), /guardian opt-in per child/);
  expectFailure(write({ ...good, stage3ReviewDate: undefined }), /stage3ReviewDate/);
  // Owner answer S-08: an entry that lets a teen with no linked guardian turn it on, or says nothing, fails.
  const { teenWithoutGuardian: _omitted, ...withoutS08 } = good.activation;
  expectFailure(write({ ...good, activation: withoutS08 }), /teenWithoutGuardian "never".*S-08/);
  expectFailure(write({ ...good, activation: { ...good.activation, teenWithoutGuardian: 'teen_opt_in' } }), /teenWithoutGuardian "never".*S-08/);
  expectFailure([['docs/rebuild/policies/messaging-features.json', '"teenWithoutGuardian": "never", ', '']], /requiredShape\.activation must carry teenWithoutGuardian/);
  expectFailure(write({ ...good, stage0Classification: 'presentation-only' }), /discoverability\/safety/);
  expectFailure(write({ ...good, surfaces: ['table:hello_notes'] }), /surface table:hello_notes is not listed/);
  assert.deepEqual(register.features, []);
});

test('E.11: a retention window that differs between SQL, Core and the policy fails', () => {
  expectFailure([['docs/rebuild/policies/SOCIAL-GOVERNANCE.md', '| `reportNoteDays` | 90 days |', '| `reportNoteDays` | 180 days |']], /retention-window drift/);
  expectFailure([['backend/src/services/socialGovernance.ts', 'pendingRequestDays: 30,', 'pendingRequestDays: 60,']], /retention-window drift/);
  expectFailure([[NEXT, null, "-- @phase: expand\nCREATE OR REPLACE FUNCTION public.social_retention_windows()\nRETURNS jsonb LANGUAGE sql IMMUTABLE AS $$\n    SELECT jsonb_build_object('pendingRequestDays', 30, 'closedRequestDays', 30, 'reportNoteDays', 90, 'resolvedReportDays', 3650, 'resolvedCaseDays', 365, 'readNoticeDays', 90, 'unreadNoticeDays', 365);\n$$;\n"]], /retention-window drift/);
});

test('E.11: a sweep that drops a class, a weaker consent rule, an unmounted route or no schedule fails', () => {
  expectFailure([[NEXT, null, "-- @phase: contract\nCREATE OR REPLACE FUNCTION public.run_social_graph_retention(p_limit integer DEFAULT 500)\nRETURNS jsonb LANGUAGE plpgsql AS $$\nBEGIN\n  DELETE FROM public.social_consent_requests WHERE false;\n  INSERT INTO public.audit_logs (action) VALUES ('social_retention.sweep_ran');\n  RETURN public.social_retention_windows();\nEND;\n$$;\n"]], /no longer covers social_edge_consented/);
  expectFailure([[NEXT, null, "-- @phase: expand\nCREATE OR REPLACE FUNCTION public.social_edge_consented(p_follower uuid, p_followed uuid)\nRETURNS boolean LANGUAGE sql AS $$ SELECT true $$;\n"]], /CURRENT guardian/);
  expectFailure([['backend/src/app.ts', "  app.use('/api/v1/internal/social-retention', socialRetentionSweepRouter());\n", '']], /not mounted/);
  expectFailure([['backend/src/routes/socialRetention.ts', 'router.use(requireInternalKey);', '']], /behind the internal key/);
  expectFailure([['.github/workflows/social-retention.yml', "    - cron: '15 4 * * *'", '']], /daily E\.11 sweep workflow/);
});

test('E.11/E.10: the FAQ must publish the windows and the no-messaging constraint in every locale', () => {
  expectFailure([['frontend/src/i18n/pt-BR/rebuild-site.json', 'expiram em 30 dias, e os encerrados são excluídos 30 dias depois', 'expiram em 60 dias, e os encerrados são excluídos 60 dias depois']], /pt-BR\/rebuild-site\.json: the FAQ must publish/);
  expectFailure([['frontend/src/i18n/es-MX/rebuild-site.json', '"noMessaging"', '"noMessagingOld"']], /es-MX\/rebuild-site\.json: the FAQ must state the no-messaging/);
  expectFailure([['frontend/src/rebuild/site/faqItems.ts', '{ id: "socialRetention", category: "privacy" },', '']], /does not list socialRetention/);
});

test('E.11: a migration that deletes from the append-only audit log fails', () => {
  expectFailure([[NEXT, null, "-- @phase: contract\nDELETE FROM public.audit_logs WHERE created_at < now() - interval '400 days';\n"]], /append-only/);
  expectFailure([[NEXT, null, "-- @phase: contract\nUPDATE public.audit_logs SET detail = '{}'::jsonb;\n"]], /append-only/);
});

test('E.11: social-graph data in analytics or the warehouse fails', () => {
  expectFailure([['backend/src/services/insights.ts', "'profile_edit', 'avatar_edit',", "'profile_edit', 'avatar_edit', 'profile_follow',"]], /analytics event "profile_follow"/);
  expectFailure([['dataintel/src/index.ts', 'import', "const leak = '/follows';\nimport"]], /warehouse reads social-graph data/);
});

test('E.12: an image key, a pattern or preset drift, a dropped guard or an unprojected read fails', () => {
  expectFailure([['backend/src/services/profileShape.ts', "'clothesColor', 'accessories'] as const;", "'clothesColor', 'accessories', 'imageUrl'] as const;"]], /avatar key drift/);
  expectFailure([['backend/src/services/profileShape.ts', 'export const AVATAR_VALUE_PATTERN = /^[A-Za-z0-9]{1,40}$/;', 'export const AVATAR_VALUE_PATTERN = /^.{1,400}$/;']], /avatar pattern drift/);
  expectFailure([['frontend/src/lib/coverPresets.ts', "{ id: 'dawn'", "{ id: 'photo'"]], /cover preset drift/);
  expectFailure([['frontend/src/rebuild/account/avatar/avatarKit.ts', "'grape', 'dawn'] as const;", "'grape', 'photo'] as const;"]], /cover preset drift/);
  expectFailure([[NEXT, null, '-- @phase: contract\nDROP TRIGGER IF EXISTS avatar_shape_guard ON public.avatars;\n']], /avatar_shape_guard is missing or dropped/);
  expectFailure([['backend/src/routes/profile.ts', 'cover: projectCover(profile.cover),\n        avatarOptions: projectAvatarOptions(avatarOptions),\n        isSelf: false,', 'cover: profile.cover,\n        avatarOptions,\n        isSelf: false,']], /served without projectCover/);
  expectFailure([['backend/src/services/supabaseRest.ts', 'avatarOptions: projectAvatarOptions(avatarById.get(id)),', 'avatarOptions: avatarById.get(id) ?? {},']], /social cards must project/);
  expectFailure([['backend/src/routes/auth.ts', 'cover: projectCover(', 'cover: (']], /\/auth\/me must project/);
});

test('E.12: a new upload surface fails, a reviewed one passes', () => {
  expectFailure([['backend/src/routes/profile.ts', "import { Router } from 'express';", "import multer from 'multer';\nimport { Router } from 'express';"]], /profile\.ts: an upload parser outside the reviewed upload surfaces/);
  expectFailure([['frontend/src/rebuild/account/LookEditor.tsx', '  const header = <header', '  const picker = <input type="file" accept="image/*" />;\n  const header = <header']], /LookEditor\.tsx: a file input outside the reviewed upload surfaces/);
});

test('E.12: the brand position must stay written', () => {
  expectFailure([['docs/product-audit/COSMIC_NARRATIVE.md', '## 6. People You Already Know', '## 6. Community']], /People You Already Know/);
  expectFailure([['docs/product-audit/COSMIC_NARRATIVE.md', 'A small, safe way to say hello to people you already know', 'A fun place to meet new friends']], /the E\.12 position itself/);
});

test('E.12, Appendix J 1.4: the brand position must stay current with OD-27 (1) and (2)', () => {
  const narrative = 'docs/product-audit/COSMIC_NARRATIVE.md';
  // The pre-OD-27 claim that a teen approves every viewer returns while the discoverable profile exists.
  expectFailure([[narrative, "A teen's profile is private by default,", 'A teen chooses, one by one, who may see them. A teen\'s profile is private by default,']], /approves every viewer one by one/);
  // The 16-17 opt-in, its default and its off switch each must be named.
  expectFailure([[narrative, 'At 16 or 17, a teen may choose', 'An older teen may choose']], /16-17 discoverable-profile opt-in/);
  expectFailure([[narrative, "A teen's profile is private by default,", "A teen's profile starts closed,"]], /private by default/);
  expectFailure([[narrative, 'can turn that off at any time', 'can change it']], /turn the discoverable profile off/);
  // The cooperative goals and their no-ranking rule must be named.
  expectFailure([[narrative, 'work toward a small goal together with', 'work toward a small goal alongside']], /teen cooperative goals/);
  expectFailure([[narrative, 'with no rankings and no score', 'with no score'], [narrative, 'A goal together has no rankings,', 'A goal together is small,']], /cooperative goals have no rankings/);
  // Before the discoverable profile exists, the old sentence is not flagged: the check follows the shipped schema.
  const discoverable = 'database/migrations/' + readdirSync(join(root, 'database/migrations')).find((f) => f.endsWith('_teen_discoverable_profile.sql'));
  const source = readFileSync(join(root, discoverable), 'utf8');
  const narrativeSource = readFileSync(join(root, narrative), 'utf8');
  try {
    writeFileSync(join(root, discoverable), source.replaceAll('teen_profile_discoverable(', 'teen_profile_findable('));
    writeFileSync(join(root, narrative), narrativeSource.replace("A teen's profile is private by default,", 'A teen chooses, one by one, who may see them. A teen\'s profile is private by default,'));
    const failures = checkSocialGovernance(root, { today: TODAY });
    assert.ok(!failures.some((f) => /one by one/.test(f)), JSON.stringify(failures, null, 1));
  } finally {
    writeFileSync(join(root, discoverable), source);
    writeFileSync(join(root, narrative), narrativeSource);
  }
});

test('L-04: a looser eligibility, a bigger group, a free-text column, a loose body, an unswept class or a missing policy note fails', () => {
  // The orchestrator renumbers migrations at merge: find them by name, never by number.
  const named = (suffix) => 'database/migrations/' + readdirSync(join(root, 'database/migrations')).find((f) => f.endsWith(suffix));
  const tables = named('_teen_cooperative_goals.sql');
  const actions = named('_teen_cooperative_goal_actions.sql');
  const sweep = named('_cooperative_goals_retention.sql');
  // A function a later migration redefines (OD-9 4.2 redefines coop_goal_eligible
  // and create_coop_goal) is mutated in its latest definition, the one the gate reads.
  const latest = (fn) => 'database/migrations/' + readdirSync(join(root, 'database/migrations')).filter((f) => f.endsWith('.sql')).sort()
    .filter((f) => readFileSync(join(root, 'database/migrations', f), 'utf8').includes(`FUNCTION public.${fn}(`)).at(-1);
  expectFailure([[latest('coop_goal_eligible'), "WHEN 'teen' THEN true", "WHEN 'adult' THEN true"]], /coop_goal_eligible must admit only/);
  expectFailure([[tables, "interval '13 years'", "interval '10 years'"]], /coop_goal_child_teen/);
  expectFailure([[tables, 'AND public.social_edge_consented(p_from, p_to)', '']], /coop_goal_edge/);
  expectFailure([[latest('create_coop_goal'), 'cardinality(p_invitees) NOT BETWEEN 1 AND 4', 'cardinality(p_invitees) NOT BETWEEN 1 AND 9']], /create_coop_goal must cap/);
  expectFailure([[actions, "'members', (SELECT jsonb_agg(x.user_id", "'rank', 1, 'members', (SELECT jsonb_agg(x.user_id"]], /group total only/);
  expectFailure([[tables, '    closed_at     timestamptz,\n', '    title         text,\n    closed_at     timestamptz,\n']], /free-text column \(title\)/);
  expectFailure([['backend/src/routes/coopGoals.ts', 'const InviteBody = z.object({ username: USERNAME }).strict();', 'const InviteBody = z.object({ username: USERNAME, note: z.string() });']], /bodies must stay strict/);
  expectFailure([[sweep, 'PERFORM public.coop_goal_reconcile(item.id);', 'NULL;']], /no longer covers PERFORM public.coop_goal_reconcile/);
  expectFailure([['docs/rebuild/policies/SOCIAL-GOVERNANCE.md', '**Cooperative goals (L-04).**', '**Goals.**']], /cover cooperative goals/);
});

test('E.7: a lapsed recalibration or a missing Appendix I adoption fails', () => {
  expectFailure([], /was due 2026-12-24/, { today: new Date('2027-01-02T00:00:00Z') });
  assert.deepEqual(checkSocialGovernance(root, { today: new Date('2026-12-24T12:00:00Z') }), []);
  expectFailure([['docs/rebuild/policies/SOCIAL-GOVERNANCE.md', '(`docs/littlefounders-spec/product/10-APPENDIX-I-PROFILE-SOCIAL-SAFETY-RESEARCH-FRAMEWORK.md`)', '']], /Appendix I as the authoritative/);
  expectFailure([['docs/rebuild/policies/SOCIAL-GOVERNANCE.md', '### 1.3 Regulatory watch list', '### 1.3 Notes']], /Regulatory watch list/);
});

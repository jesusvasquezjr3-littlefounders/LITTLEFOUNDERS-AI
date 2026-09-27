// Synthetic legacy dataset for the OD-9 toolkit proof. No real data: every
// account, name and record is generated from a seeded PRNG, so the same seed
// always yields the same SQL and the same expectations.
//
// The dataset is written against the LEGACY schema (the migration chain up
// to the last migration before the rebuild, *_rename_banking_accounts.sql)
// and exercises every record OD-9 section 4.1 promises and every defect of
// section 4.3. Its catalog uses real topic paths from the B.6 KC map
// (database/seeds/kc_topic_map.v1.json), so the OD-24 credit runs against
// the real map entries.
//
// generateLegacyFixture() returns
//   legacySql     the legacy platform's data (apply to the legacy schema)
//   seedKcSql     what `npm run seed:kc` writes after the chain (KC rows and
//                 topic links for this catalog)
//   expectations  what the toolkit must find, computed here independently of
//                 the SQL it checks

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SEEDS = fileURLToPath(new URL('../../seeds/', import.meta.url));
const MAP = JSON.parse(readFileSync(`${SEEDS}kc_topic_map.v1.json`, 'utf8'));
const GRAPH = JSON.parse(readFileSync(`${SEEDS}kc_graph.v1.json`, 'utf8'));

export const PRACTICES = [
  ['analytics.learning_quality_events', true], ['analytics.motivation_events', true],
  ['analytics.engagement_heartbeats', true], ['analytics.family_money_events', true],
  ['analytics.achievement_share_initiations', true], ['analytics.mentor_behavioral_telemetry', true],
  ['analytics.mentor_integrity_evidence', true], ['research.family_longitudinal', false],
  ['mentor.disposition_profile', false], ['mentor.alliance_record', false],
  ['mentor.dialogue_calibration', false], ['learning.decision_journal', false],
  ['sharing.social_connections', false], ['sharing.learning_family_bridge', false],
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const q = (value) => (value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`);
const j = (value) => `${q(JSON.stringify(value))}::jsonb`;
const ts = (days) => `(timestamptz '2026-06-01 12:00:00+00' + interval '${days} days')`;
/** A birth date `years` years and 40 days before today: the band is stable whatever day the proof runs. */
const birth = (years) => (years === null ? 'NULL' : `(current_date - interval '${years} years 40 days')::date`);
export const bandForAge = (age) => (age === null ? null : age < 13 ? 'under_13' : age < 18 ? '13_to_17' : 'adult');

/** Pick catalog slices from the real map: [course, adventureIndex, sagaCount, tier]. */
const CATALOG = [
  { course: 'first-lemonade-stand', subject: 'money', adventures: [[0, 99, 'tier2']] },
  { course: 'financial-education', subject: 'money', adventures: [[0, 2, 'tier1']] },
  { course: 'entrepreneurship', subject: 'economics', adventures: [[0, 1, 'tier4']] },
];
const STAGE = { tier1: 'child', tier2: 'child', tier3: 'tween', tier4: 'teen' };

export function generateLegacyFixture({ seed = 20260927, randomFamilies = 12 } = {}) {
  const rand = mulberry32(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const uuid = () => {
    const h = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16));
    h[12] = '4';
    h[16] = '89ab'[Math.floor(rand() * 4)];
    const s = h.join('');
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  };
  const hex = (n) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');

  const sql = [];
  const seedKc = [];

  // ── Catalog ───────────────────────────────────────────────────────────
  const topics = []; // { id, course, courseId, path, stage, kind, teaches, lessons: [ids] }
  const courses = [];
  CATALOG.forEach((spec, ci) => {
    const courseId = uuid();
    const entry = MAP.courses.find((c) => c.course === spec.course);
    courses.push({ id: courseId, slug: spec.course });
    sql.push(`INSERT INTO public.courses (id, slug, title, status, subject, position, badge_asset) VALUES (${q(courseId)}, ${q(spec.course)}, ${j({ 'en-US': spec.course })}, 'published', ${q(spec.subject)}, ${ci}, ${q(`course-badges/${spec.course}.png`)});`);
    const byAdventure = new Map();
    for (const t of entry.topics) {
      const [a, s] = t.path.split('/');
      if (!byAdventure.has(a)) byAdventure.set(a, new Map());
      const sagas = byAdventure.get(a);
      if (!sagas.has(s)) sagas.set(s, []);
      sagas.get(s).push(t);
    }
    const adventureSlugs = [...byAdventure.keys()];
    for (const [ai, sagaCount, tier] of spec.adventures) {
      const aSlug = adventureSlugs[ai];
      const advId = uuid();
      sql.push(`INSERT INTO public.adventures (id, course_id, position, slug, theme, age_tier, status) VALUES (${q(advId)}, ${q(courseId)}, ${ai}, ${q(aSlug)}, 'archipelago', ${q(tier)}, 'published');`);
      [...byAdventure.get(aSlug).entries()].slice(0, sagaCount).forEach(([sSlug, sagaTopics], si) => {
        const sagaId = uuid();
        sql.push(`INSERT INTO public.sagas (id, adventure_id, position, slug, status) VALUES (${q(sagaId)}, ${q(advId)}, ${si}, ${q(sSlug)}, 'published');`);
        sagaTopics.forEach((t, ti) => {
          const topicId = uuid();
          const lessons = [uuid(), uuid()];
          const tSlug = t.path.split('/')[2];
          sql.push(`INSERT INTO public.topics (id, saga_id, position, slug, status, kind) VALUES (${q(topicId)}, ${q(sagaId)}, ${ti}, ${q(tSlug)}, 'published', ${q(t.kind)});`);
          lessons.forEach((lid, li) => sql.push(
            `INSERT INTO public.lessons (id, topic_id, position, slug, status, xp_total) VALUES (${q(lid)}, ${q(topicId)}, ${li}, ${q(`${tSlug}-${li}`)}, 'published', 20);`));
          // A draft lesson never counts toward completion (E1: published lessons
          // only). Kept out of the lemonade stand, whose live badge rule (0043)
          // counts every non-archived lesson.
          if (ti === 0 && spec.course !== 'first-lemonade-stand') sql.push(`INSERT INTO public.lessons (topic_id, position, slug, status) VALUES (${q(topicId)}, 9, ${q(`${tSlug}-draft`)}, 'draft');`);
          topics.push({ id: topicId, course: spec.course, courseId, path: t.path, stage: STAGE[tier], kind: t.kind, teaches: t.teaches ?? [], reviewOf: t.review_of ?? [], lessons });
        });
      });
    }
  });

  // ── Seed:kc after the chain: KC rows and topic links for this catalog ──
  const neededKcs = new Set(topics.flatMap((t) => t.teaches));
  const kcByKey = new Map(GRAPH.kcs.map((k) => [k.key, k]));
  const kcId = new Map();
  // Two legacy-strand KCs exist on the legacy platform already (the Mentor's
  // mastery rows reference them); seed:kc must keep their ids.
  const legacyKcs = GRAPH.kcs.filter((k) => (k.status ?? 'active') === 'active' && ['money_math', 'entrepreneurship'].includes(k.strand)).slice(0, 2);
  for (const k of legacyKcs) {
    kcId.set(k.key, uuid());
    sql.push(`INSERT INTO public.kc (id, key, strand, title, objective, tier_min, p_l0, p_t, p_g, p_s, status) VALUES (${q(kcId.get(k.key))}, ${q(k.key)}, ${q(k.strand)}, ${j(k.title)}, ${j(k.objective)}, ${k.tier_min}, ${k.p_l0}, ${k.p_t}, ${k.p_g}, ${k.p_s}, 'active');`);
  }
  for (const key of [...neededKcs].sort()) {
    const k = kcByKey.get(key);
    if (!k) throw new Error(`KC ${key} missing from the graph`);
    if (!kcId.has(key)) kcId.set(key, uuid());
    seedKc.push(`INSERT INTO public.kc (id, key, strand, title, objective, tier_min, p_l0, p_t, p_g, p_s, status) VALUES (${q(kcId.get(key))}, ${q(key)}, ${q(k.strand)}, ${j(k.title)}, ${j(k.objective)}, ${k.tier_min}, ${k.p_l0}, ${k.p_t}, ${k.p_g}, ${k.p_s}, ${q(k.status ?? 'active')}) ON CONFLICT (key) DO NOTHING;`);
  }
  const topicByPath = new Map(topics.map((t) => [`${t.course}:${t.path}`, t]));
  for (const t of topics) {
    t.teaches.forEach((key, i) => seedKc.push(
      `INSERT INTO public.topic_knowledge_components (topic_id, kc_id, role, is_primary, map_version) VALUES (${q(t.id)}, ${q(kcId.get(key))}, 'teaches', ${i === 0}, 1);`));
    // A review topic reviews what its cited topics teach; it never credits (E2).
    const reviewed = new Set(t.reviewOf.flatMap((p) => topicByPath.get(`${t.course}:${p}`)?.teaches ?? []));
    for (const key of [...reviewed].sort()) seedKc.push(
      `INSERT INTO public.topic_knowledge_components (topic_id, kc_id, role, is_primary, map_version) VALUES (${q(t.id)}, ${q(kcId.get(key))}, 'reviews', false, 1) ON CONFLICT DO NOTHING;`);
  }

  // ── Accounts ──────────────────────────────────────────────────────────
  const accounts = new Map(); // name -> { id, age, anonymous, google, roles, verifiedBirthAge, guardians: [] }
  const account = (name, { age = null, anonymous = false, google = false, username = null } = {}) => {
    const id = uuid();
    accounts.set(name, { id, name, age, anonymous, google, roles: ['universal'], verifiedAge: null, verifiedGuardians: [], revokedVerification: false, justified: false, staffGranted: false });
    const appMeta = google ? { provider: 'google', providers: ['google'] } : { provider: anonymous ? 'anonymous' : 'email', providers: [anonymous ? 'anonymous' : 'email'] };
    sql.push(`INSERT INTO auth.users (id, email, is_anonymous, raw_app_meta_data, created_at) VALUES (${q(id)}, ${anonymous ? 'NULL' : q(`${name}@example.test`)}, ${anonymous}, ${j(appMeta)}, ${ts(-int(30, 300))});`);
    if (google) sql.push(`INSERT INTO auth.identities (id, user_id, provider, provider_id) VALUES (${q(uuid())}, ${q(id)}, 'google', ${q(hex(21))});`);
    sql.push(`UPDATE public.profiles SET display_name = ${q(name)}, username = ${q(username)}, birth_date = ${birth(age)} WHERE user_id = ${q(id)};`);
    return accounts.get(name);
  };
  const verifiedParent = (name, age = 38) => {
    const a = account(name, { age: null });
    a.roles.push('parent');
    a.verifiedAge = age;
    sql.push(`INSERT INTO public.parent_verifications (user_id, given_names, surnames, birth_date) VALUES (${q(a.id)}, 'Synthetic', 'Parent', ${birth(age)});`);
    sql.push(`INSERT INTO public.user_roles (user_id, role, granted_by) VALUES (${q(a.id)}, 'parent', ${q(a.id)});`);
    return a;
  };
  const kid = (name, parents, age) => {
    const a = account(name, { age, username: name.replace(/[^a-z0-9_]/g, '_').slice(0, 20) });
    for (const p of parents) {
      sql.push(`INSERT INTO public.guardian_links (id, parent_user_id, kid_user_id, verification_status, verified_at) VALUES (${q(uuid())}, ${q(p.id)}, ${q(a.id)}, 'verified', ${ts(-10)});`);
      a.verifiedGuardians.push(p.id);
    }
    a.roles.push('kid');
    sql.push(`INSERT INTO public.user_roles (user_id, role, granted_by) VALUES (${q(a.id)}, 'kid', ${q(parents[0].id)});`);
    return a;
  };

  const staff = account('staff_member');
  const parentA = verifiedParent('parent_a');
  const kidA1 = kid('kid_a_one', [parentA], 8);
  const kidA2 = kid('kid_a_two', [parentA], 11);
  const parentB = account('parent_b');
  parentB.roles.push('parent'); parentB.staffGranted = true;
  sql.push(`INSERT INTO public.user_roles (user_id, role, granted_by) VALUES (${q(parentB.id)}, 'parent', ${q(staff.id)});`);
  const kidB = kid('kid_b', [parentB], null);
  const parentC = account('parent_c', { age: 41 });
  parentC.roles.push('parent'); parentC.staffGranted = true; parentC.justified = true;
  sql.push(`INSERT INTO public.user_roles (user_id, role, granted_by) VALUES (${q(parentC.id)}, 'parent', ${q(staff.id)});`);
  sql.push(`INSERT INTO public.audit_logs (actor_id, action, subject, detail) VALUES (${q(staff.id)}, 'admin.parent_role_justification', ${q(parentC.id)}, ${j({ justification: 'In-person identity check at a partner school.' })});`);
  const kidC = kid('kid_c', [parentC], 14);
  const parentD = verifiedParent('parent_d', 45);
  parentD.revokedVerification = true;
  sql.push(`INSERT INTO public.parent_verifications (user_id, status, given_names, surnames, birth_date, created_at, verified_at) VALUES (${q(parentD.id)}, 'revoked', 'Synthetic', 'Parent', ${birth(45)}, now() + interval '1 second', now());`);
  const teen = account('teen_indie', { age: 15, username: 'teen_indie' });
  const guestNoDob = account('guest_nodob', { anonymous: true });
  const guestChild = account('guest_child', { anonymous: true, age: 10 });
  const guestAdult = account('guest_adult', { anonymous: true, age: 30 });
  const googleNoDob = account('google_nodob', { google: true });
  const googleAdult = account('google_adult', { google: true, age: 35 });
  const emailNoDob = account('email_nodob');

  // Random verified families for volume.
  const randomKids = [];
  for (let f = 0; f < randomFamilies; f++) {
    const parents = [verifiedParent(`rparent_${f}`, int(28, 55))];
    if (rand() < 0.3) parents.push(verifiedParent(`rparent_${f}_b`, int(28, 55)));
    for (let k = 0, n = int(1, 3); k < n; k++) randomKids.push(kid(`rkid_${f}_${k}`, parents, rand() < 0.1 ? null : int(6, 16)));
  }

  // ── Learning records ─────────────────────────────────────────────────
  const passed = new Map(); // userId -> Map(lessonId, day)
  const credited = new Map();
  const mark = (store, user, lesson, day) => {
    if (!store.has(user.id)) store.set(user.id, new Map());
    store.get(user.id).set(lesson, day);
  };
  const courseTopics = (slug) => topics.filter((t) => t.course === slug);
  const pass = (user, lesson, day, score = 90) => {
    mark(passed, user, lesson, day);
    sql.push(`INSERT INTO public.lesson_progress (user_id, lesson_id, best_score, passed, attempts, xp_earned, completed_at) VALUES (${q(user.id)}, ${q(lesson)}, ${score}, true, ${int(1, 3)}, 20, ${ts(day)});`);
  };
  const fail = (user, lesson) => sql.push(`INSERT INTO public.lesson_progress (user_id, lesson_id, best_score, passed, attempts, xp_earned) VALUES (${q(user.id)}, ${q(lesson)}, 40, false, 2, 0);`);
  const credit = (user, topic, lesson, day) => {
    mark(credited, user, lesson, day);
    sql.push(`INSERT INTO public.placement_credits (user_id, lesson_id, topic_id, course_id, created_at) VALUES (${q(user.id)}, ${q(lesson)}, ${q(topic.id)}, ${q(topic.courseId)}, ${ts(day)});`);
  };
  const placement = (user, slug, method = 'quiz') => sql.push(
    `INSERT INTO public.course_placements (user_id, course_id, claimed_level, education_level, method) VALUES (${q(user.id)}, ${q(courses.find((c) => c.slug === slug).id)}, 'some', 'elementary', ${q(method)});`);

  // kid_a_one finishes the lemonade stand (16 passed, 4 placement-credited): a course badge.
  courseTopics('first-lemonade-stand').forEach((t, i) => t.lessons.forEach((l, li) => (i < 2 && li === 1 ? credit(kidA1, t, l, i) : pass(kidA1, l, i + li))));
  placement(kidA1, 'first-lemonade-stand');
  const fe = courseTopics('financial-education');
  fe.slice(0, 3).forEach((t, i) => t.lessons.forEach((l) => pass(kidA1, l, 20 + i)));
  pass(kidA1, fe[3].lessons[0], 30);
  fail(kidA1, fe[3].lessons[1]);
  // kid_a_two: the first saga placement-credited, so the credit basis is placement.
  placement(kidA2, 'financial-education');
  fe.filter((t) => t.path.split('/')[1] === fe[0].path.split('/')[1]).forEach((t, i) => t.lessons.forEach((l) => credit(kidA2, t, l, i)));
  // kid_b: two complete fin-ed topics, one mixed (passed + credited).
  fe[0].lessons.forEach((l) => pass(kidB, l, 5));
  pass(kidB, fe[1].lessons[0], 6); credit(kidB, fe[1], fe[1].lessons[1], 6);
  // kid_c (14) and the independent teen: teen-stage entrepreneurship.
  const en = courseTopics('entrepreneurship');
  en.slice(0, 4).forEach((t, i) => t.lessons.forEach((l) => pass(kidC, l, 40 + i)));
  en.slice(0, 2).forEach((t, i) => t.lessons.forEach((l) => pass(teen, l, 50 + i)));
  // Random kids: random complete and partial topics across the catalog.
  for (const k of randomKids) {
    for (const t of topics) {
      const r = rand();
      if (r < 0.25) t.lessons.forEach((l, li) => pass(k, l, int(0, 90), li === 0 ? 100 : 85));
      else if (r < 0.32) t.lessons.forEach((l) => credit(k, t, l, int(0, 90)));
      else if (r < 0.4) pass(k, t.lessons[0], int(0, 90));
    }
  }

  // ── Stats, streaks, Mentor, Family Hub ───────────────────────────────
  const learners = [kidA1, kidA2, kidB, kidC, teen, ...randomKids];
  for (const k of learners) {
    const streak = int(0, 9);
    sql.push(`UPDATE public.learning_stats SET xp_points = ${int(0, 4000)}, minutes_learned = ${int(0, 900)}, lessons_completed = ${int(0, 80)}, streak_days = ${streak}, longest_streak = ${streak + int(0, 20)}, last_active_date = date '2026-09-01' + ${int(0, 20)} WHERE user_id = ${q(k.id)};`);
  }
  const mentor = (k) => {
    sql.push(`INSERT INTO public.tutor_plans (user_id, content) VALUES (${q(k.id)}, ${j({ goals: ['save-for-a-bike'], next: fe[0].path })});`);
    for (let n = 0; n < int(1, 3); n++) sql.push(`INSERT INTO public.tutor_notebook_entries (id, user_id, whiteboard, turn_seq) VALUES (${q(uuid())}, ${q(k.id)}, ${j({ kind: 'number_line', from: 0, to: 10 + n })}, ${n + 1});`);
    sql.push(`INSERT INTO public.learner_memory (user_id, store, content) VALUES (${q(k.id)}, 'learner', 'Likes stories about markets.');`);
    for (const lk of legacyKcs) sql.push(`INSERT INTO public.learner_kc_mastery (user_id, kc_id, p_known, attempts, correct) VALUES (${q(k.id)}, ${q(kcId.get(lk.key))}, ${(0.3 + rand() * 0.6).toFixed(3)}, 4, 3);`);
  };
  [kidA1, kidC, teen, ...randomKids.filter(() => rand() < 0.5)].forEach(mentor);

  const family = (k, parentId) => {
    const goalReached = uuid();
    const goalActive = uuid();
    sql.push(`INSERT INTO public.savings_goals (id, kid_user_id, title, target, icon, status, reached_at) VALUES (${q(goalReached)}, ${q(k.id)}, 'Kite', 30, 'toy', 'reached', ${ts(12)}), (${q(goalActive)}, ${q(k.id)}, 'Bike', 200, 'bike', 'active', NULL);`);
    const approved = [uuid(), uuid()];
    for (const t of approved) {
      const coins = int(5, 20);
      sql.push(`INSERT INTO public.tasks (id, assigned_by, assigned_to, title, status, reward_coins, allocated) VALUES (${q(t)}, ${q(parentId)}, ${q(k.id)}, 'Water the plants', 'approved', ${coins}, true);`);
      sql.push(`INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, task_id, created_by, created_at) VALUES (${q(k.id)}, 'save', ${coins}, 'task_approved', ${q(t)}, ${q(parentId)}, ${ts(int(1, 60))});`);
    }
    sql.push(`INSERT INTO public.tasks (assigned_by, assigned_to, title, status, reward_coins) VALUES (${q(parentId)}, ${q(k.id)}, 'Tidy the desk', 'open', 3);`);
    sql.push(`INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, created_at) VALUES (${q(k.id)}, 'spend', ${int(3, 15)}, 'allowance', ${q(parentId)}, ${ts(int(1, 60))}), (${q(k.id)}, 'share', 2, 'allowance', ${q(parentId)}, ${ts(int(1, 60))});`);
    const catalog = uuid();
    sql.push(`INSERT INTO public.redemption_catalog (id, parent_user_id, title, cost) VALUES (${q(catalog)}, ${q(parentId)}, 'Park trip', 5);`);
    sql.push(`INSERT INTO public.redemptions (catalog_id, kid_user_id, status, decided_at, decided_by) VALUES (${q(catalog)}, ${q(k.id)}, 'approved', ${ts(20)}, ${q(parentId)});`);
    sql.push(`INSERT INTO public.kid_task_streaks (kid_user_id, current_streak_days, longest_streak_days, last_completed_date) VALUES (${q(k.id)}, ${int(0, 6)}, ${int(6, 30)}, date '2026-09-10');`);
    sql.push(`INSERT INTO public.banking_accounts (kid_user_id, display_number, opened_by) VALUES (${q(k.id)}, ${q(`LF-${hex(4)}`)}, ${q(parentId)});`);
  };
  family(kidA1, parentA.id);
  family(kidA2, parentA.id);
  family(kidB, parentB.id);
  family(kidC, parentC.id);
  randomKids.filter(() => rand() < 0.6).forEach((k) => family(k, k.verifiedGuardians[0]));

  // ── Badge shares (F.2): legacy shares had no expiry column at all ──────
  const shares = [];
  const share = (k, parentId, createdDaysAgo) => {
    const id = uuid();
    shares.push({ id, kid: k.id, createdDaysAgo });
    sql.push(`INSERT INTO public.badge_shares (id, token, kid_user_id, created_by, achievement_kind, achievement_label, first_name, image_bucket, image_hash, image_ext, image_url, created_at) VALUES (${q(id)}, ${q(hex(24))}, ${q(k.id)}, ${q(parentId)}, 'course_badge', 'First Lemonade Stand', 'Synthetic', 'badges', ${q(hex(64))}, 'png', ${q(`https://depot.example.test/badges/${hex(8)}.png`)}, now() - interval '${createdDaysAgo} days');`);
  };
  share(kidA1, parentA.id, 90);
  share(kidA2, parentA.id, 3);
  share(kidC, parentC.id, 45);

  // ── Expectations, computed independently of the toolkit's SQL ─────────
  const all = [...accounts.values()];
  const complete = (userId, t) => t.lessons.every((l) => passed.get(userId)?.has(l) || credited.get(userId)?.has(l));
  const credits = [];
  for (const a of all) {
    for (const t of topics) {
      if (t.kind !== 'teaching' || !complete(a.id, t)) continue;
      for (const key of t.teaches) credits.push({ user: a.id, kc: key, topic: t.id, stage: t.stage });
    }
  }
  const badgeHolders = all.filter((a) => courseTopics('first-lemonade-stand').every((t) => complete(a.id, t))).map((a) => a.id);

  const defects = {};
  const bump = (key) => { defects[key] = (defects[key] ?? 0) + 1; };
  for (const a of all) {
    if (a.roles.includes('parent') && !a.justified && a.verifiedAge === null) bump('A5_parent_role_without_justification:mark_staff_granted');
    if (a.revokedVerification) bump('A5_parent_role_without_justification:review_revoked_verification');
    const band = bandForAge(a.age ?? a.verifiedAge);
    if (a.anonymous) bump(band ? 'A2_legacy_guest:declare_from_birth_date' : 'A2_legacy_guest:protective_under13_marker');
    else if (band) bump('age_declaration_from_birth_date:declare_from_birth_date');
    else bump(a.google ? 'A3_google_no_dob:age_screen_required' : 'A4_no_age_evidence:age_screen_required');
  }
  // 0109 already gave every legacy share the default window when the chain is
  // applied; the proof then drifts one share (driftSql) to a 400-day window,
  // the only one the F.2 step must correct.
  bump('F2_share_without_expiry:default_expiry');

  // Consent: youngest band from the evidence left after the defects step.
  const consent = { children: 0, missing: 0, byGrantor: {} };
  for (const a of all) {
    const band = a.anonymous && a.age === null ? 'under_13' : bandForAge(a.age ?? a.verifiedAge);
    if (band === 'adult') continue;
    consent.children += 1;
    for (const [, teenSelf] of PRACTICES) {
      const grantor = a.verifiedGuardians.length > 0 ? 'tutor' : band === '13_to_17' && teenSelf ? 'self' : 'none_available';
      consent.missing += 1;
      consent.byGrantor[grantor] = (consent.byGrantor[grantor] ?? 0) + 1;
    }
  }

  return {
    legacySql: sql.join('\n'),
    seedKcSql: seedKc.join('\n'),
    driftSql: `UPDATE public.badge_shares SET expires_at = created_at + interval '400 days' WHERE id = ${q(shares[0].id)};`,
    expectations: {
      accounts: all.length,
      ids: Object.fromEntries(all.map((a) => [a.name, a.id])),
      usernames: all.filter((a) => a.roles.includes('kid') || a.name === 'teen_indie').length,
      credits,
      badgeHolders,
      defects,
      consent,
      shares: shares.map((s) => ({ id: s.id, expiredByDefault: s.createdDaysAgo >= 30 })),
      kcIdByKey: Object.fromEntries(kcId),
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { legacySql, seedKcSql } = generateLegacyFixture();
  process.stdout.write(`${legacySql}\n-- seed:kc (after the chain)\n${seedKcSql}\n`);
}

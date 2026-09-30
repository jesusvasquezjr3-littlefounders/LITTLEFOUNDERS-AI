import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { makeDb } from './learnFixtures.js';
import { assembleLearningQaSignals, GATE_REVIEW_MAX_OPEN_DAYS, loadLearningQaSignals } from '../services/learningQaSignals.js';

/*
 * Gap-fix round 7 learning (Appendix C Part 1.3 "Defect Escape Rate", Part 3
 * Stage 6, Part 2.1 criterion 4): every defect escape opens a
 * gate-effectiveness review (the database trigger; proved on PostgreSQL by
 * database/scripts/verify-gate-effectiveness-reviews-postgres.py). These tests
 * pin Core's boundary: the panel sees the open reviews and their age, only
 * content staff may close one, and never without an outcome and a note.
 */

const STAFF_ID = '22222222-2222-4222-8222-222222222222';
const REVIEW_ID = 'cccccccc-0000-4000-8000-000000000001';
const LESSON_ID = 'dddddddd-0000-4000-8000-000000000001';
const URL = `/api/v1/admin/content/learning-quality/gate-reviews/${REVIEW_ID}/resolve`;
const NOTE = 'The tone lexicon had no entry for this debt idiom.';

let db: FakeDb;
let userId: string;
let token: string;
const staff = mintToken({ sub: STAFF_ID });
beforeEach(() => {
  userId = '11111111-1111-4111-8111-111111111111';
  token = mintToken({ sub: userId });
  db = makeDb(userId);
  vi.stubGlobal('fetch', createFakeFetch(db));
});
afterEach(() => vi.unstubAllGlobals());
const auth = (req: request.Test, bearer = token) => req.set('Authorization', `Bearer ${bearer}`);

function grantStaff(permissions: string[]) {
  db.user_roles = [{ user_id: STAFF_ID, role: 'admin' }];
  db.admin_permissions = permissions.map((permission) => ({ user_id: STAFF_ID, permission }));
}
function scriptResolve(code: string, status = 200) {
  db.__rpc = [{ name: 'resolve_gate_effectiveness_review', status, body: [{ ok: code === 'RESOLVED', code, message: code }] }];
}
const calls = () => (db.__rpc_calls ?? []).filter((row) => row.name === 'resolve_gate_effectiveness_review');

const row = (age: number, gate = 'forge.gate.12.tone') => ({
  review_id: REVIEW_ID, escape_id: 'eeeeeeee-0000-4000-8000-000000000001', lesson_id: LESSON_ID, gate_id: gate,
  gate_description: 'Gate 12: Law 2 tone', owner_role: 'pedagogical_lead' as const, defect_kind: 'pedagogical',
  opened_at: '2026-06-01T00:00:00Z', age_days: age,
});
const empty = { graded: 0, reported: 0, agreed: 0, agreement_share: null };
const base = { parity: empty, phases: [], cues: { responses: 0, hits: 0, missed: 0, false_ticks: 0 }, variants: [], entries: [], qa: [], escapes: [], coverage: null };

describe('gate-effectiveness reviews on the staff learning-quality report', () => {
  it('lists every open review with its gate, owner and age, and flags those open longer than the cadence', () => {
    const signals = assembleLearningQaSignals({ ...base, gateReviews: [row(GATE_REVIEW_MAX_OPEN_DAYS + 1), { ...row(GATE_REVIEW_MAX_OPEN_DAYS), review_id: 'cccccccc-0000-4000-8000-000000000002' }] });
    expect(GATE_REVIEW_MAX_OPEN_DAYS).toBe(90);
    expect(signals.gateReviews).toMatchObject({ overdue: 1, maxOpenDays: 90 });
    expect(signals.gateReviews!.open[0]).toEqual({
      reviewId: REVIEW_ID, escapeId: 'eeeeeeee-0000-4000-8000-000000000001', lessonId: LESSON_ID, gateId: 'forge.gate.12.tone',
      gateDescription: 'Gate 12: Law 2 tone', ownerRole: 'pedagogical_lead', defectKind: 'pedagogical', openedAt: '2026-06-01T00:00:00Z',
      ageDays: 91, overdue: true,
    });
    expect(signals.gateReviews!.open[1]!.overdue).toBe(false);
  });

  it('is null before the migration while the rest of the QA report still loads', async () => {
    const window = { p_since: '2026-09-01T00:00:00Z', p_until: '2026-09-29T00:00:00Z' };
    db.__rpc = [
      { name: 'learning_scorer_parity', body: [] }, { name: 'learning_detection_cells_by_phase', body: [] }, { name: 'learning_cue_hits', body: [] },
      { name: 'learning_variant_transfer', body: [] }, { name: 'learning_cpa_entry_stage_distribution', body: [] }, { name: 'learning_qa_rates', body: [] },
      { name: 'content_defect_escape_rate', body: [{ gate_id: 'forge.gate.12.tone', escapes: 1, published_versions: 4 }] },
      { name: 'gate_effectiveness_reviews_open', status: 404, body: { message: 'function not found' } },
    ];
    const before = await loadLearningQaSignals(window);
    expect(before?.defectEscapes.escapes).toBe(1);
    expect(before?.gateReviews).toBeNull();
    db.__rpc = db.__rpc.map((item) => item.name === 'gate_effectiveness_reviews_open' ? { name: item.name, body: [row(12)] } : item);
    const after = await loadLearningQaSignals(window);
    expect(after?.gateReviews).toMatchObject({ overdue: 0, open: [{ reviewId: REVIEW_ID, ageDays: 12, overdue: false }] });
  });
});

describe('resolving a gate-effectiveness review', () => {
  it('refuses every non-content population before the database is asked: learner, parent, analytics-only staff, guest', async () => {
    scriptResolve('RESOLVED');
    db.user_roles = [{ user_id: userId, role: 'kid' }];
    expect((await auth(request(createApp()).post(URL)).send({ outcome: 'lexicon_extended', note: NOTE })).status).toBe(403);
    db.user_roles = [{ user_id: userId, role: 'parent' }];
    expect((await auth(request(createApp()).post(URL)).send({ outcome: 'lexicon_extended', note: NOTE })).status).toBe(403);
    grantStaff(['view_analytics']);
    expect((await auth(request(createApp()).post(URL), staff).send({ outcome: 'lexicon_extended', note: NOTE })).status).toBe(403);
    const guest = mintToken({ sub: '13131313-1313-4313-8313-131313131313', is_anonymous: true });
    expect((await auth(request(createApp()).post(URL), guest).send({ outcome: 'lexicon_extended', note: NOTE })).status).toBe(403);
    expect(calls()).toHaveLength(0);
  });

  it('never closes a review without an outcome, a note, or with a reference that does not match the outcome', async () => {
    grantStaff(['manage_content']);
    scriptResolve('RESOLVED');
    const app = createApp();
    for (const body of [
      { note: NOTE },
      { outcome: 'fixed_it', note: NOTE },
      { outcome: 'lexicon_extended' },
      { outcome: 'lexicon_extended', note: 'too short' },
      { outcome: 'gate_changed', note: NOTE },
      { outcome: 'gate_changed', note: NOTE, gateChangeRef: '-bad ref' },
      { outcome: 'accepted_limitation', note: NOTE, gateChangeRef: 'a1b2c3d' },
      { outcome: 'lexicon_extended', note: NOTE, actorId: STAFF_ID },
    ]) {
      const res = await auth(request(app).post(URL), staff).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect((await auth(request(app).post('/api/v1/admin/content/learning-quality/gate-reviews/not-a-uuid/resolve'), staff)
      .send({ outcome: 'lexicon_extended', note: NOTE })).status).toBe(400);
    expect(calls()).toHaveLength(0);
  });

  it('closes a review with the verified staff actor and the named change', async () => {
    grantStaff(['manage_content']);
    scriptResolve('RESOLVED');
    const res = await auth(request(createApp()).post(URL), staff).send({ outcome: 'gate_changed', note: NOTE, gateChangeRef: 'a1b2c3d4e5f6' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: REVIEW_ID, status: 'resolved' });
    expect(calls()[0]?.body).toEqual({ p_actor: STAFF_ID, p_review_id: REVIEW_ID, p_outcome: 'gate_changed', p_note: NOTE, p_gate_change_ref: 'a1b2c3d4e5f6' });
    scriptResolve('RESOLVED');
    await auth(request(createApp()).post(URL), staff).send({ outcome: 'accepted_limitation', note: `  ${NOTE}  ` });
    expect(calls().at(-1)?.body).toMatchObject({ p_outcome: 'accepted_limitation', p_note: NOTE, p_gate_change_ref: null });
  });

  it('maps every database refusal to an explicit error', async () => {
    grantStaff(['manage_content']);
    const send = () => auth(request(createApp()).post(URL), staff).send({ outcome: 'lexicon_extended', note: NOTE });
    for (const [code, status] of [['FORBIDDEN', 403], ['NOT_FOUND', 404], ['ALREADY_RESOLVED', 409], ['NOTE_REQUIRED', 400], ['INVALID_OUTCOME', 400], ['CHANGE_REF_UNEXPECTED', 400]] as const) {
      scriptResolve(code);
      expect((await send()).status, code).toBe(status);
    }
    scriptResolve('RESOLVED', 500);
    expect((await send()).status).toBe(502);
  });
});

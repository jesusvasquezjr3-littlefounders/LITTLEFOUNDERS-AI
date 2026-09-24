import type { FakeDb } from './fakePostgrest.js';
export const USER_ID = '99999999-9999-4999-8999-999999999911';
export const COURSE_ID = 'c0000000-0000-4000-8000-000000000001';
export const ADVENTURE_ID = 'a0000000-0000-4000-8000-000000000001';
export const SAGA_ID = 'a0000000-0000-4000-8000-0000000000a1';
export const T1 = 'a0000000-0000-4000-8000-0000000000b1';
export const T2 = 'a0000000-0000-4000-8000-0000000000b2';
export const T3 = 'a0000000-0000-4000-8000-0000000000b3';
export const L1 = 'a0000000-0000-4000-8000-0000000000c1';
export const L2 = 'a0000000-0000-4000-8000-0000000000c2';
export const L3 = 'a0000000-0000-4000-8000-0000000000c3';
export const COURSE_SLUG = 'placement-course';

export const probeFor = (subject: string, correctIndex: number) => ({
  'en-US': { prompt: `What is ${subject}?`, options: ['Wrong one', 'Right one'], correctIndex },
  'es-MX': { prompt: `¿Qué es ${subject}?`, options: ['La incorrecta', 'La correcta'], correctIndex },
});

export const PROBE_T1 = probeFor('money', 1);
export const PROBE_T2 = probeFor('saving', 1);
export const PROBE_T3 = probeFor('budgeting', 1);

export function makeDb(): FakeDb {
  return {
    account_age_declarations: [{ user_id: USER_ID, declared_age_band: '13_to_17' }],
    courses: [{ id: COURSE_ID, slug: COURSE_SLUG, title: { 'en-US': 'Money' }, description: {}, subject: 'money', badge_asset: 'course-badges/x.png', status: 'published', position: 1 }],
    adventures: [{ id: ADVENTURE_ID, course_id: COURSE_ID, position: 1, slug: 'adventure-1', title: { 'en-US': 'Trading' }, description: {}, theme: 'archipelago', status: 'published' }],
    sagas: [{ id: SAGA_ID, adventure_id: ADVENTURE_ID, position: 1, slug: 'saga-1', title: {}, icon: 'auto_stories', status: 'published' }],
    topics: [
      { id: T1, saga_id: SAGA_ID, position: 1, slug: 'topic-1', title: {}, kind: 'teaching', review_of: [], prerequisites: [], placement_probe: PROBE_T1, status: 'published' },
      { id: T2, saga_id: SAGA_ID, position: 2, slug: 'topic-2', title: {}, kind: 'teaching', review_of: [], prerequisites: [], placement_probe: PROBE_T2, status: 'published' },
      { id: T3, saga_id: SAGA_ID, position: 3, slug: 'topic-3', title: {}, kind: 'teaching', review_of: [], prerequisites: [], placement_probe: PROBE_T3, status: 'published' },
    ],
    lessons: [
      { id: L1, topic_id: T1, position: 1, slug: 'lesson-1', title: {}, difficulty: 1, xp_total: 10, estimated_minutes: 5, status: 'published' },
      { id: L2, topic_id: T2, position: 1, slug: 'lesson-2', title: {}, difficulty: 1, xp_total: 10, estimated_minutes: 5, status: 'published' },
      { id: L3, topic_id: T3, position: 1, slug: 'lesson-3', title: {}, difficulty: 1, xp_total: 10, estimated_minutes: 5, status: 'published' },
    ],
    lesson_progress: [],
    course_placements: [],
    placement_credits: [],
    profiles: [{ user_id: USER_ID, display_name: 'Ana', username: null, locale: 'en-US', theme: 'light', cover: {}, birth_date: null, created_at: '2026-01-01T00:00:00.000Z' }],
  };
}

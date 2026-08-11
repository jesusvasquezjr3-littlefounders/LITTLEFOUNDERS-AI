import type { FakeDb } from './fakePostgrest.js';

/*
 * A tiny published course-hierarchy fixture (1 course -> 1 adventure -> 1
 * saga -> 1 topic -> 2 lessons) used by the /api/v1/learn HTTP tests.
 * lesson-1 carries a graded quiz_mcq segment with a REAL answer key so
 * grading/completion can be exercised end to end.
 */

export const COURSE_ID = '33333333-3333-4333-8333-333333333333';
export const ADVENTURE_ID = '44444444-4444-4444-8444-444444444444';
export const SAGA_ID = '55555555-5555-4555-8555-555555555555';
export const TOPIC_ID = '66666666-6666-4666-8666-666666666666';
export const LESSON_1_ID = '77777777-7777-4777-8777-777777777777';
export const LESSON_2_ID = '88888888-8888-4888-8888-888888888888';
export const COURSE_SLUG = 'financial-education';

function lessonDocument(locale: string) {
  return {
    schema_version: 1,
    meta: { slug: 'lesson-1', title: 'Lesson One', locale, subject: 'money', estimated_minutes: 5, objectives: ['x'], cast: ['dina'] },
    scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
    segments: [
      {
        id: 'story-1',
        type: 'story_scene',
        prompt_md: 'The tale begins',
        difficulty: 1,
        xp: 0,
        payload: { backdrop: 'band', body_md: 'Once upon a time...' },
      },
      {
        id: 'quiz-1',
        type: 'quiz_mcq',
        prompt_md: 'Pick the right answer',
        difficulty: 1,
        xp: 20,
        payload: {
          options: [
            { id: 'a', text_md: 'Right answer' },
            { id: 'b', text_md: 'Wrong answer', rationale_md: 'because that is wrong' },
          ],
        },
      },
      {
        // Keyless grader: memory_flip scores from the board (no answer key).
        id: 'memory-1',
        type: 'memory_flip',
        prompt_md: 'Find the pairs',
        difficulty: 1,
        xp: 10,
        payload: { pairs: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] },
      },
    ],
  };
}

export function makeDb(userId: string): FakeDb {
  return {
    courses: [
      {
        id: COURSE_ID,
        slug: COURSE_SLUG,
        title: { 'en-US': 'Financial Education' },
        description: {},
        subject: 'money',
        badge_asset: 'course-badges/financial-education.png',
        status: 'published',
        position: 1,
      },
    ],
    adventures: [
      {
        id: ADVENTURE_ID,
        course_id: COURSE_ID,
        position: 1,
        slug: 'adventure-1',
        title: {},
        description: {},
        theme: 'archipelago',
        status: 'published',
      },
    ],
    sagas: [{ id: SAGA_ID, adventure_id: ADVENTURE_ID, position: 1, slug: 'saga-1', title: {}, icon: 'auto_stories', status: 'published' }],
    topics: [{ id: TOPIC_ID, saga_id: SAGA_ID, position: 1, slug: 'topic-1', title: {}, status: 'published' }],
    lessons: [
      {
        id: LESSON_1_ID,
        topic_id: TOPIC_ID,
        position: 1,
        slug: 'lesson-1',
        title: { 'en-US': 'Lesson One' },
        difficulty: 1,
        xp_total: 20,
        estimated_minutes: 5,
        status: 'published',
      },
      {
        id: LESSON_2_ID,
        topic_id: TOPIC_ID,
        position: 2,
        slug: 'lesson-2',
        title: { 'en-US': 'Lesson Two' },
        difficulty: 1,
        xp_total: 10,
        estimated_minutes: 5,
        status: 'published',
      },
    ],
    lesson_documents: [
      {
        lesson_id: LESSON_1_ID,
        locale: 'en-US',
        schema_version: 1,
        updated_at: '2026-08-09T00:00:00.000Z',
        document: lessonDocument('en-US'),
        answer_keys: { 'quiz-1': { correct_option_id: 'a' } },
        audio: {
          version: 1,
          voice_profile: 'Jennifer',
          units: { 'story-1.prompt': { url: 'http://filebase.test/files/abc', duration_ms: 2000, voice: 'Jennifer' } },
        },
      },
      {
        lesson_id: LESSON_1_ID,
        locale: 'es-MX',
        schema_version: 1,
        updated_at: '2026-08-09T00:00:00.000Z',
        document: lessonDocument('es-MX'),
        answer_keys: { 'quiz-1': { correct_option_id: 'a' } },
        audio: {},
      },
      // lesson-2 is STORY-ONLY (no graded segments, empty answer keys) — the
      // "completing IS passing, score 100" case every real course's opening
      // lessons hit (LESSON_ENGINE.md §5.1 / client lessonScore parity).
      {
        lesson_id: LESSON_2_ID,
        locale: 'en-US',
        schema_version: 1,
        updated_at: '2026-08-09T00:00:00.000Z',
        document: {
          schema_version: 1,
          meta: { slug: 'lesson-2', title: 'Lesson Two', locale: 'en-US', subject: 'money', estimated_minutes: 5, objectives: ['x'], cast: ['dina'] },
          scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
          segments: [
            { id: 'story-only', type: 'story_scene', prompt_md: 'Only a story', difficulty: 1, xp: 0, payload: { backdrop: 'band', body_md: 'The end.' } },
          ],
        },
        answer_keys: {},
        audio: {},
      },
    ],
    lesson_progress: [],
    lesson_segment_attempts: [],
    // Placement (0043) already completed by default — these fixtures exist to
    // exercise LESSON unlock behavior, not the placement gate itself (see
    // placement.test.ts for that). Tests that specifically want an ungated
    // course can clear this array.
    course_placements: [
      {
        user_id: userId,
        course_id: COURSE_ID,
        claimed_level: 'new',
        education_level: 'elementary',
        quiz_answers: [],
        start_topic_id: TOPIC_ID,
        start_lesson_id: LESSON_1_ID,
        method: 'claimed_beginner_shortcut',
        created_at: '2020-01-01T00:00:00.000Z',
      },
    ],
    placement_credits: [],
    learning_stats: [
      { user_id: userId, xp_points: 0, minutes_learned: 0, lessons_completed: 0, streak_days: 0, last_active_date: null, updated_at: '2020-01-01T00:00:00.000Z' },
    ],
    profiles: [
      { user_id: userId, display_name: 'Test User', username: null, locale: 'en-US', theme: 'light', cover: {}, birth_date: null, created_at: '2026-01-01T00:00:00.000Z' },
    ],
  };
}

import type { FakeDb } from './fakePostgrest.js';

/** Current-engine fixture: immutable publication, with actual run/token routes exercised by callers. */
export function activateChoiceFixture(db: FakeDb, lessonId: string, segmentIds = ['quiz-1'], versionId = '99999999-9999-4999-8999-999999990001') {
  segmentIds = segmentIds.map(id => id.length < 3 ? `step-${id}` : id);
  const document = {
    schema_version: 2, course_id: 'test-course', pathway_id: 'test-pathway', chapter_id: 'test-chapter',
    lesson_id: lessonId, version_id: 'revision-001', locale: 'en-US', age_band: '6-9',
    eligibility: { minimum_age: 6, maximum_age: 119 }, knowledge_component_ids: ['test-skill'], adventure_scene_id: 'diorama-a', title: 'Find your place',
    required_capabilities: ['visual.story-scene.v1', 'operation.choose-option.v1'],
    segments: segmentIds.map(id => ({ id, type: 'story.branch.v2', grading: 'server', prompt: 'Choose a pocket.', visual: { type: 'story-scene' },
      payload: { scene: 'Which pocket is for later?', options: [{ id: 'save', label: 'Save' }, { id: 'spend', label: 'Spend' }] } })),
  };
  (db.lesson_document_versions ??= []).push({ id: versionId, lesson_id: lessonId, locale: 'en-US', schema_version: 2, version_id: 'revision-001', document,
    answer_keys: Object.fromEntries(segmentIds.map(id => [id, { acceptable_choice_ids: ['save'] }])), audio: {} });
  (db.lesson_document_version_current ??= []).push({ lesson_id: lessonId, locale: 'en-US', document_version_id: versionId });
}

import { beforeEach, describe, expect, it } from 'vitest';
import { checkpointKey, clearLessonCheckpoints, newCheckpoint, readCheckpoint, writeCheckpoint } from './lessonRunCheckpoint';

beforeEach(() => sessionStorage.clear());
describe('v2 lesson run recovery', () => {
  it('recovers only the version-pinned run, without answers or attempt tokens', () => {
    const key = checkpointKey('learner', 'lesson');
    const value = { runId: '99999999-9999-4999-8999-999999999999', document: 'v2:version-1' };
    writeCheckpoint(key, value);
    expect(readCheckpoint(key)).toEqual(value);
    sessionStorage.setItem(key, JSON.stringify({ ...value, attemptToken: 'private' }));
    expect(readCheckpoint(key)).toEqual(newCheckpoint());
  });
  it('rejects a retired document or a malformed run', () => {
    const key = checkpointKey('learner', 'lesson');
    for (const value of [{ runId: 'bad', document: 'v2:version-1' }, { runId: null, document: 'schema-1' }]) {
      sessionStorage.setItem(key, JSON.stringify(value));
      expect(readCheckpoint(key)).toEqual(newCheckpoint());
    }
  });
  it('clears both current and retired recovery records on identity changes', () => {
    sessionStorage.setItem(checkpointKey('learner', 'lesson'), '{}');
    sessionStorage.setItem('lf.lesson.checkpoint.v1:learner:lesson', '{}');
    sessionStorage.setItem('unrelated', 'kept');
    clearLessonCheckpoints();
    expect(Object.keys(sessionStorage)).toEqual(['unrelated']);
  });
});

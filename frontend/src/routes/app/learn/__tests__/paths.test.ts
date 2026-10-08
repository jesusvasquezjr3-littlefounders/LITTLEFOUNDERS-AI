import { describe, expect, it } from 'vitest';
import { matchPath } from 'react-router-dom';
import {
  LEARNING_RHYTHM_ROUTE_PATH,
  learningRhythmPath,
  COURSE_ROUTE_PATH,
  LESSON_ROUTE_PATH,
  PLACEMENT_ROUTE_PATH,
  PLAY_ROUTE_PATH,
  TERRITORY_ROUTE_PATH,
  coursePath,
  lessonPath,
  placementPath,
  playPath,
  territoryPath,
  guidedReviewPath,
  guidedReviewLessonFrom,
  guidedReviewSkillFrom,
} from '../paths';

/*
 * The gate that would have caught the 2026-09-04 defect.
 *
 * A link is not "correct" because it looks plausible — it is correct when the
 * router can MATCH it. The broken chapter link (`/learn/:courseSlug/lesson/
 * :slug`) read perfectly well and matched no route at all, and because
 * <Routes> had no catch-all it failed as a blank page rather than an error.
 * So these tests assert routability, not string equality: they feed what the
 * builder produces back into react-router's own matcher.
 */
describe('lessonPath', () => {
  const ABSOLUTE_PATTERN = `/${LESSON_ROUTE_PATH}`;

  it('produces a URL the lesson route actually matches', () => {
    const match = matchPath(ABSOLUTE_PATTERN, lessonPath('af55925c-c918-42fd-bc5d-c481e4a9ab59'));

    expect(match).not.toBeNull();
    expect(match?.params.lessonId).toBe('af55925c-c918-42fd-bc5d-c481e4a9ab59');
  });

  it('is absolute, so it does not resolve relative to whatever route rendered it', () => {
    expect(lessonPath('lesson-1').startsWith('/')).toBe(true);
  });

  it('does not nest the lesson under a course segment', () => {
    /*
     * The exact shape that shipped broken. Kept as a named negative because
     * "/learn/money-basics/lesson/x" is the intuitive guess every time someone
     * writes this link by hand, and it has no route.
     */
    expect(matchPath(ABSOLUTE_PATTERN, '/learn/money-basics/lesson/some-slug')).toBeNull();
    expect(lessonPath('lesson-1')).toBe('/learn/lesson/lesson-1');
  });
});

/*
 * Same property for every other /learn URL. These were each hand-written in two
 * or three files before, which is the condition that produced the lesson-link
 * defect — so the builder and the route pattern are pinned together here.
 */
describe('the rest of the /learn URLs are routable', () => {
  const CASES = [
    { name: 'course', pattern: COURSE_ROUTE_PATH, build: coursePath, expected: '/learn/money-basics' },
    { name: 'placement', pattern: PLACEMENT_ROUTE_PATH, build: placementPath, expected: '/learn/money-basics/placement' },
    { name: 'territory', pattern: TERRITORY_ROUTE_PATH, build: territoryPath, expected: '/learn/money-basics/territory' },
  ] as const;

  for (const { name, pattern, build, expected } of CASES) {
    it(`${name}: the builder's output matches its own route pattern`, () => {
      const href = build('money-basics');
      const match = matchPath(`/${pattern}`, href);

      expect(href).toBe(expected);
      expect(match, `${href} matches no route`).not.toBeNull();
      expect(match?.params.courseSlug).toBe('money-basics');
    });
  }
});

describe('learningRhythmPath (S05.3e)', () => {
  it('is matched by its own route and never read as a course slug first', () => {
    expect(matchPath(`/${LEARNING_RHYTHM_ROUTE_PATH}`, learningRhythmPath())).not.toBeNull();
    expect(learningRhythmPath()).toBe('/learn/rhythm');
  });
});

describe('guidedReviewPath (S05.3f, B.26)', () => {
  it('opens the Mentor with the skill key, and only a skill key is read back', () => {
    const href = guidedReviewPath('financial-education/saving-goal');
    expect(matchPath('/tutor', href.split('?')[0]!)).not.toBeNull();
    expect(guidedReviewSkillFrom(href.slice(href.indexOf('?')))).toBe('financial-education/saving-goal');
    for (const search of ['', '?review=', '?review=../admin', '?review=a/b/c', '?review=ABC/def', '?review=%3Cscript%3E/x']) {
      expect(guidedReviewSkillFrom(search), search).toBeNull();
    }
  });

  it('carries the lesson a review was opened from, and reads back only a uuid (OD-43)', () => {
    const href = guidedReviewPath('financial-education/saving-goal', '11111111-1111-4111-8111-111111111111');
    expect(guidedReviewSkillFrom(href.slice(href.indexOf('?')))).toBe('financial-education/saving-goal');
    expect(guidedReviewLessonFrom(href.slice(href.indexOf('?')))).toBe('11111111-1111-4111-8111-111111111111');
    expect(guidedReviewLessonFrom('?lesson=not-a-uuid')).toBeNull();
    expect(guidedReviewLessonFrom('')).toBeNull();
  });
});

describe('playPath (a game inside /learn)', () => {
  it('is matched by its own route, with the game id as the parameter', () => {
    const href = playPath('kartrush');
    expect(href).toBe('/learn/play/kartrush');
    expect(matchPath(`/${PLAY_ROUTE_PATH}`, href)?.params.gameId).toBe('kartrush');
  });

  it('is not the course route: a static play segment, so a game id is never read as a course slug', () => {
    expect(matchPath(`/${COURSE_ROUTE_PATH}`, playPath('kartrush'))).toBeNull();
    expect(matchPath(`/${PLACEMENT_ROUTE_PATH}`, playPath('kartrush'))).toBeNull();
  });

  it('encodes the id so it cannot add a path segment', () => {
    expect(playPath('a/b')).toBe('/learn/play/a%2Fb');
  });
});

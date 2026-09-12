import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, matchPath } from 'react-router-dom';
import '@/i18n';
import { ChapterLessons } from '../ChapterLessons';
import { LESSON_ROUTE_PATH } from '../paths';
import type { LessonNode, TopicNode } from '../types';

/*
 * The /learn chapter shortcut is the FIRST thing a returning learner taps, and
 * until now nothing asserted where it goes. It shipped on 2026-09-04 pointing
 * at a route that does not exist; every lesson opened from the learn home was a
 * white screen until 2026-09-11. CoursePage.test.tsx had pinned the identical
 * property for the course page — this component simply had no test at all.
 */

const ABSOLUTE_LESSON_PATTERN = `/${LESSON_ROUTE_PATH}`;

function lesson(overrides: Partial<LessonNode> & Pick<LessonNode, 'id' | 'slug' | 'state'>): LessonNode {
  return {
    title: { 'en-US': overrides.slug },
    position: 1,
    difficulty: 1,
    xp_total: 25,
    estimated_minutes: 5,
    bestScore: 0,
    placementCredited: false,
    ...overrides,
  };
}

const topic: TopicNode = {
  id: 'topic-1',
  slug: 'wants-and-needs',
  title: { 'en-US': 'We do not all want the same' },
  position: 2,
  kind: 'teaching',
  reviewOf: [],
  state: 'in-progress',
  lessons: [
    lesson({ id: 'lesson-passed-id', slug: 'two-islanders', state: 'passed', title: { 'en-US': 'Two islanders' } }),
    lesson({ id: 'lesson-current-id', slug: 'same-wish', state: 'current', title: { 'en-US': 'Same wish' }, position: 2 }),
    lesson({ id: 'lesson-locked-id', slug: 'respect', state: 'locked', title: { 'en-US': 'Respect' }, position: 3 }),
  ],
};

function renderChapter() {
  return render(
    <MemoryRouter>
      <ChapterLessons courseSlug="money-basics" topic={topic} chapterNumber={2} locale="en-US" />
    </MemoryRouter>,
  );
}

describe('ChapterLessons', () => {
  it('points every playable lesson at a URL the lesson route matches', () => {
    renderChapter();

    for (const [name, id] of [
      [/Two islanders/, 'lesson-passed-id'],
      [/Same wish/, 'lesson-current-id'],
    ] as const) {
      const href = screen.getByRole('link', { name }).getAttribute('href');
      const match = matchPath(ABSOLUTE_LESSON_PATTERN, href ?? '');

      // Routability, not a string comparison: a link that matches no route
      // renders as a blank page, which is how this went unnoticed for a week.
      expect(match, `${href} matches no route`).not.toBeNull();
      // Keyed by the lesson's id — the player feeds :lessonId straight into
      // GET /learn/lessons/:id, which Core looks up by id and not by slug.
      expect(match?.params.lessonId).toBe(id);
    }
  });

  it('never nests the lesson under the course segment', () => {
    renderChapter();

    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toMatch(/^\/learn\/money-basics\/lesson\//);
    }
  });

  it('leaves a locked lesson as text, not a link', () => {
    renderChapter();

    expect(screen.queryByRole('link', { name: /Respect/ })).toBeNull();
    expect(screen.getByText(/Respect/)).toBeInTheDocument();
  });

  /*
   * Production's `lesson.position` is unique per topic but NOT contiguous, so
   * this three-lesson chapter rendered as 1, 3, 4 beside its own "2 of 3
   * lessons" badge — which reads as a missing lesson, and made the locked
   * row's "unlocks after lesson N-1" hint point at the wrong number.
   * The fixture keeps the real gaps so the test fails if anyone goes back to
   * rendering the storage ordinal.
   */
  it('numbers rows by their place in the chapter, not by the gapped storage ordinal', () => {
    const gapped: TopicNode = {
      ...topic,
      lessons: [
        lesson({ id: 'a', slug: 'a', state: 'passed', title: { 'en-US': 'First' }, position: 1 }),
        lesson({ id: 'b', slug: 'b', state: 'current', title: { 'en-US': 'Second' }, position: 3 }),
        lesson({ id: 'c', slug: 'c', state: 'locked', title: { 'en-US': 'Third' }, position: 4 }),
      ],
    };

    render(
      <MemoryRouter>
        <ChapterLessons courseSlug="money-basics" topic={gapped} chapterNumber={2} locale="en-US" />
      </MemoryRouter>,
    );

    expect(screen.getByText(/^1\. First$/)).toBeInTheDocument();
    expect(screen.getByText(/^2\. Second$/)).toBeInTheDocument();
    expect(screen.getByText(/^3\. Third$/)).toBeInTheDocument();
    expect(screen.queryByText(/^4\./)).toBeNull();
  });
});

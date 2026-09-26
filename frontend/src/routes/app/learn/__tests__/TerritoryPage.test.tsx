import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CourseTree } from '../types';
import { TerritoryView } from '../TerritoryPage';

const fixtureTree: CourseTree = {
  course: {
    id: 'course-1',
    slug: 'money-basics',
    title: { 'en-US': 'Money Basics' },
    description: { 'en-US': '' },
    subject: 'money',
    progress: { passed: 1, total: 3, pct: 33 },
    placementRequired: false,
  },
  adventures: [
    {
      id: 'adv-open',
      slug: 'adv-open',
      title: { 'en-US': 'Open Adventure' },
      description: { 'en-US': '' },
      theme: 'archipelago',
      position: 1,
      state: 'available',
      progress: { passed: 1, total: 2, pct: 50 },
      sagas: [
        {
          id: 'saga-1',
          slug: 'saga-1',
          title: { 'en-US': 'Trading Saga' },
          icon: 'savings',
          position: 1,
          progress: { passed: 1, total: 2, pct: 50 },
          topics: [
            {
              id: 'topic-1',
              slug: 'topic-1',
              title: { 'en-US': 'What is money' },
              position: 1,
              kind: 'teaching',
              reviewOf: [],
              state: 'not-started',
              lessons: [
                {
                  id: 'lesson-passed',
                  slug: 'l1',
                  title: { 'en-US': 'Lesson One' },
                  position: 1,
                  difficulty: 1,
                  xp_total: 10,
                  estimated_minutes: 5,
                  state: 'passed',
                  bestScore: 100,
                  placementCredited: false,
                },
                {
                  id: 'lesson-current',
                  slug: 'l2',
                  title: { 'en-US': 'Lesson Two' },
                  position: 2,
                  difficulty: 1,
                  xp_total: 15,
                  estimated_minutes: 6,
                  state: 'current',
                  bestScore: 0,
                  placementCredited: false,
                },
              ],
            },
            {
              id: 'topic-2',
              slug: 'topic-2',
              title: { 'en-US': 'Saving basics' },
              position: 2,
              kind: 'teaching',
              reviewOf: [],
              state: 'not-started',
              lessons: [
                {
                  id: 'lesson-locked',
                  slug: 'l3',
                  title: { 'en-US': 'Lesson Three' },
                  position: 1,
                  difficulty: 2,
                  xp_total: 20,
                  estimated_minutes: 8,
                  state: 'locked',
                  bestScore: 0,
                  placementCredited: false,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'adv-locked',
      slug: 'adv-locked',
      title: { 'en-US': 'Locked Adventure' },
      description: { 'en-US': '' },
      theme: 'forest',
      position: 2,
      state: 'locked',
      progress: { passed: 0, total: 2, pct: 0 },
      sagas: [],
    },
  ],
  nextLessonId: 'lesson-current',
};

/* W2L.1: the territory map's own test, kept when the legacy course page it shared a file with was replaced. */
describe('TerritoryView', () => {
  it('turns playable territory topics into direct lesson links', () => {
    render(
      <MemoryRouter>
        <TerritoryView tree={fixtureTree} locale="en-US" courseSlug="money-basics" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /What is money/ })).toHaveAttribute('href', '/learn/lesson/lesson-current');
  });
});

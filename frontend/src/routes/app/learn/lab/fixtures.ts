/*
 * Fixture course tree for the dev-only learn lab. Same wire shape Core
 * returns (`./types`), so the lab drives the REAL pages rather than a
 * lookalike. Ids are valid UUIDv4 strings because the app's schemas are
 * strict everywhere, tests and labs included (/AGENTS.md §1.14).
 */
import type { CourseTree, LessonNode, SagaNode, TopicNode } from '../types'

function uuid(seed: number): string {
  const hex = seed.toString(16).padStart(12, '0')
  return `4f2b1a7c-9d3e-4c8b-a5f6-${hex}`
}

let counter = 0

function lesson(title: string, state: LessonNode['state'], minutes: number, xp: number): LessonNode {
  counter += 1
  return {
    id: uuid(counter),
    slug: `lesson-${counter}`,
    title: { 'en-US': title, 'es-MX': title, 'pt-BR': title },
    position: counter,
    difficulty: 2,
    xp_total: xp,
    estimated_minutes: minutes,
    state,
    bestScore: state === 'passed' ? 90 : 0,
    placementCredited: false,
  }
}

function topic(title: string, state: TopicNode['state'], lessons: LessonNode[]): TopicNode {
  counter += 1
  return {
    id: uuid(counter),
    slug: `topic-${counter}`,
    title: { 'en-US': title },
    position: counter,
    kind: 'teaching',
    reviewOf: [],
    state,
    lessons,
  }
}

function saga(title: string, icon: string, topics: TopicNode[]): SagaNode {
  counter += 1
  const all = topics.flatMap((entry) => entry.lessons)
  const passed = all.filter((entry) => entry.state === 'passed').length
  return {
    id: uuid(counter),
    slug: `saga-${counter}`,
    title: { 'en-US': title },
    icon,
    position: counter,
    progress: { passed, total: all.length, pct: Math.round((passed / all.length) * 100) },
    topics,
  }
}

const adventureOne = {
  id: uuid(900),
  slug: 'money-in-motion',
  title: { 'en-US': 'Money in motion', 'es-MX': 'El dinero en movimiento' },
  description: { 'en-US': 'Where money comes from and where it goes.' },
  theme: 'archipelago',
  position: 1,
  state: 'available' as const,
  progress: { passed: 3, total: 7, pct: 43 },
  sagas: [
    saga('Earning and spending', 'payments', [
      topic('What money is for', 'completed', [
        lesson('Why we trade things', 'passed', 4, 20),
        lesson('The first coins ever made', 'passed', 5, 25),
      ]),
      topic('Where money goes', 'in-progress', [
        lesson('Needs, wants and the difference that costs you', 'passed', 6, 30),
        lesson('Your first spending plan', 'current', 7, 35),
        lesson('Tracking what you spend', 'available', 5, 25),
      ]),
    ]),
    saga('Saving on purpose', 'savings', [
      topic('Building a cushion', 'not-started', [
        lesson('Paying yourself first', 'available', 6, 30),
        lesson('The emergency fund', 'locked', 8, 40),
      ]),
    ]),
  ],
}

const adventureTwo = {
  id: uuid(901),
  slug: 'the-value-forest',
  title: { 'en-US': 'The value forest' },
  description: { 'en-US': 'How things get their price.' },
  theme: 'forest',
  position: 2,
  state: 'completed' as const,
  progress: { passed: 4, total: 4, pct: 100 },
  sagas: [
    saga('Price and value', 'sell', [
      topic('What a price really is', 'completed', [
        lesson('Who decides the price', 'passed', 5, 25),
        lesson('Supply meets demand', 'passed', 6, 30),
      ]),
      topic('Getting a deal', 'review-due', [
        lesson('Comparing two offers', 'passed', 5, 25),
        lesson('When cheap costs more', 'passed', 6, 30),
      ]),
    ]),
  ],
}

const adventureThree = {
  id: uuid(902),
  slug: 'the-compound-city',
  title: { 'en-US': 'The compound city' },
  description: { 'en-US': 'Money that works while you sleep.' },
  theme: 'city',
  position: 3,
  state: 'locked' as const,
  progress: { passed: 0, total: 5, pct: 0 },
  sagas: [
    saga('Interest', 'trending_up', [
      topic('Compound interest', 'not-started', [
        lesson('The snowball effect', 'locked', 7, 35),
        lesson('Time is the ingredient', 'locked', 6, 30),
      ]),
    ]),
  ],
}

export const FIXTURE_TREE: CourseTree = {
  course: {
    id: uuid(800),
    slug: 'financial-education',
    title: { 'en-US': 'Financial education', 'es-MX': 'Educación financiera' },
    description: {
      'en-US': 'Real money skills, from your first coin to your first investment.',
    },
    subject: 'finance',
    badgeAsset: null,
    progress: { passed: 7, total: 16, pct: 44 },
    placementRequired: false,
  },
  adventures: [adventureOne, adventureTwo, adventureThree],
  // Derived, never hand-written: a hand-written id drifts the moment a lesson
  // is inserted above it, and the lab then paints the highlight on a lesson
  // the learner already passed.
  nextLessonId:
    [adventureOne, adventureTwo, adventureThree]
      .flatMap((adventure) => adventure.sagas)
      .flatMap((entry) => entry.topics)
      .flatMap((entry) => entry.lessons)
      .find((entry) => entry.state === 'current')?.id ?? null,
}

export const FIXTURE_COURSES = {
  courses: [
    {
      id: uuid(800),
      slug: 'financial-education',
      title: { 'en-US': 'Financial education', 'es-MX': 'Educación financiera' },
      lessonCount: 475,
      badgeAsset: null,
      progress: { passed: 7, total: 475, pct: 1 },
    },
    {
      id: uuid(801),
      slug: 'entrepreneurship',
      title: { 'en-US': 'Entrepreneurship', 'es-MX': 'Emprendimiento' },
      lessonCount: 414,
      badgeAsset: null,
      progress: { passed: 0, total: 414, pct: 0 },
    },
    {
      id: uuid(802),
      slug: 'investing',
      title: { 'en-US': 'Investing', 'es-MX': 'Inversiones' },
      lessonCount: 416,
      badgeAsset: null,
      progress: { passed: 416, total: 416, pct: 100 },
    },
  ],
}

export const FIXTURE_PROBE = {
  probes: [
    {
      topicId: uuid(700),
      prompt: 'If you save 10 pesos a week, how much do you have after a month?',
      options: ['10 pesos', '40 pesos', '100 pesos', 'It depends on the bank'],
    },
    {
      topicId: uuid(701),
      prompt: 'Which of these is a need, not a want?',
      options: ['A new game', 'Lunch', 'Concert tickets', 'A skateboard'],
    },
  ],
  ageAlreadyKnown: false,
}

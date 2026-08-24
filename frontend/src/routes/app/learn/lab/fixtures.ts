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
    // Turned on in the lab so the path's full "still being built" notice is
    // something a reviewer can actually see at both breakpoints (0048).
    inProgress: true,
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
      // Mirrors production: live, fully written, and with zero narration or art (0048).
      inProgress: true,
      progress: { passed: 0, total: 414, pct: 0 },
    },
    {
      id: uuid(802),
      slug: 'investing',
      title: { 'en-US': 'Investing', 'es-MX': 'Inversiones' },
      lessonCount: 416,
      badgeAsset: null,
      inProgress: true,
      progress: { passed: 416, total: 416, pct: 100 },
    },
  ],
}

/*
 * Placement is now a MULTI-STEP conversation, so the lab needs more than one
 * canned payload: the info the page opens with, the intake reply, a couple of
 * adaptive questions, and a result worth looking at. `FIXTURE_PLACEMENT_STEPS`
 * is consumed in order, so clicking through the lab walks a real quiz.
 */
export const FIXTURE_PLACEMENT_INTAKE_INFO = {
  ageAlreadyKnown: true,
  conversationalIntakeAvailable: true,
}

export const FIXTURE_PLACEMENT_INTAKE_REPLY = {
  available: true,
  priorFraction: 0.55,
  reflection: 'Ya llevas un presupuesto, eso es terreno ganado.',
}

export const FIXTURE_PLACEMENT_STEPS = [
  {
    kind: 'ask',
    probe: {
      topicId: uuid(700),
      prompt: 'Si ahorras 10 pesos cada semana, ¿cuánto tienes después de un mes?',
      options: ['10 pesos', '40 pesos', '100 pesos'],
    },
    questionNumber: 1,
    questionsRemaining: 7,
    phase: 'search',
  },
  {
    kind: 'ask',
    probe: {
      topicId: uuid(701),
      prompt: '¿Cuál de estas es una necesidad y no un gusto?',
      options: ['Un videojuego nuevo', 'La comida del día', 'Boletos para un concierto'],
    },
    questionNumber: 2,
    questionsRemaining: 5,
    phase: 'search',
  },
  {
    kind: 'ask',
    probe: {
      topicId: uuid(702),
      prompt: 'Una más para confirmar: ¿qué pasa si gastas todo el día que te pagan?',
      options: ['No pasa nada', 'Te quedas sin nada para el resto', 'Ganas más al día siguiente'],
    },
    questionNumber: 3,
    questionsRemaining: 2,
    phase: 'confirm',
  },
  {
    kind: 'done',
    result: {
      frontier: 128,
      startTopicId: uuid(703),
      startLessonId: uuid(704),
      creditedLessonCount: 213,
      creditedTopicCount: 128,
      totalTopicCount: 216,
      method: 'adaptive_quiz',
      cappedByPrerequisite: false,
    },
  },
]

export const FIXTURE_PLACEMENT_COMMIT = { startLessonId: uuid(704) }

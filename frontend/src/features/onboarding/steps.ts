import { ADULT_AGE, type Answers, type Mentor, type Path } from '@/features/onboarding/store';

/*
 * The two walks through the onboarding, as data. A step is a question (it needs an answer before
 * the button works), a value screen (it only shows something) or the last one, where the person
 * joins now or later. Which composition each step shows is here too, so the page never decides it.
 *
 * Before a mentor is chosen the four are together; from then on the chosen one is alone with the
 * person. Most steps reuse one of three plain poses (docs/design/CHARACTER-COMPOSITIONS.md, scene
 * family "onboarding"); mini-games and Seeds have a scene of their own.
 */
export const LEARNER_STEPS = ['welcome', 'age', 'name', 'mentor', 'lessons', 'games', 'mentoria', 'seeds', 'tasks', 'join'] as const;

export const PARENT_STEPS = ['welcome', 'age', 'minor', 'name', 'mentor', 'child', 'family', 'progress', 'suggestions', 'join'] as const;

export type StepId = (typeof LEARNER_STEPS)[number] | (typeof PARENT_STEPS)[number];

export type Pose = 'look' | 'nod' | 'lean' | 'games' | 'seeds';

export type Scene = 'group-greet' | 'group-attend' | `${Mentor}-${Pose}`;

const POSE: Partial<Record<StepId, Pose>> = {
  lessons: 'look', games: 'games', mentoria: 'nod', seeds: 'seeds', tasks: 'lean',
  // A parent's first value screen is about what the child gets, Seeds among it: the Seeds scene breaks the run of
  // plain poses that follows, and no pose is then shown twice before the last screen.
  child: 'seeds', family: 'nod', progress: 'lean', suggestions: 'look', join: 'nod',
};

/** The steps this person walks, in order. What they answered decides which ones exist. */
export function stepsFor(path: Path, age: number | undefined): StepId[] {
  if (path === 'parent') {
    // Somebody under 18 who came in as a parent is shown the way to their own place, and nothing else.
    const isMinor = age !== undefined && age < ADULT_AGE;

    return isMinor ? ['welcome', 'age', 'minor'] : PARENT_STEPS.filter((step) => step !== 'minor');
  }

  // Tasks from a parent or guardian are for an account under 18.
  return LEARNER_STEPS.filter((step) => step !== 'tasks' || age === undefined || age < ADULT_AGE);
}

/** True when the step has what it asks for. A value screen always has. */
export function isAnswered(step: StepId, answers: Answers): boolean {
  if (step === 'age') return answers.age !== undefined;

  if (step === 'name') return answers.name !== undefined;

  if (step === 'mentor') return answers.mentor !== undefined;

  return true;
}

/** The furthest step the person may open: the first one still waiting for an answer. */
export function furthest(steps: StepId[], answers: Answers): number {
  const waiting = steps.findIndex((step) => !isAnswered(step, answers));

  return waiting === -1 ? steps.length - 1 : waiting;
}

export function sceneFor(step: StepId, mentor: Mentor | undefined): Scene {
  if (step === 'welcome') return 'group-greet';

  const pose = POSE[step];

  return pose && mentor ? `${mentor}-${pose}` : 'group-attend';
}

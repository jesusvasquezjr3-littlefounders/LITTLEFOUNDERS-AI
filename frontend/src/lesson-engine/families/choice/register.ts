// `choice` family registry slice — composed by lesson-engine/registry.ts.

import type { Registry } from '../../core/types'
import {
  BestDecision,
  ConfidenceQuiz,
  OddOneOut,
  PictureChoice,
  QuizMcq,
  SpeedTap,
  TrueFalse,
  YesNoCases,
  buildYesNoAnswer,
  choiceCanSubmit,
} from './components'

export { choiceSchemas } from './schema'
export { choiceGraders } from './grade'
export { choiceFixtures } from './fixtures'

export const choiceRegistry: Registry = {
  quiz_mcq: { kind: 'input', component: QuizMcq, canSubmit: choiceCanSubmit.quiz_mcq },
  true_false: { kind: 'input', component: TrueFalse, canSubmit: choiceCanSubmit.true_false },
  picture_choice: {
    kind: 'input',
    component: PictureChoice,
    canSubmit: choiceCanSubmit.picture_choice,
  },
  odd_one_out: { kind: 'input', component: OddOneOut, canSubmit: choiceCanSubmit.odd_one_out },
  best_decision: {
    kind: 'input',
    component: BestDecision,
    canSubmit: choiceCanSubmit.best_decision,
  },
  yes_no_cases: {
    kind: 'input',
    component: YesNoCases,
    canSubmit: choiceCanSubmit.yes_no_cases,
    buildAnswer: buildYesNoAnswer,
  },
  speed_tap: { kind: 'flow', component: SpeedTap },
  confidence_quiz: {
    kind: 'input',
    component: ConfidenceQuiz,
    canSubmit: choiceCanSubmit.confidence_quiz,
  },
}

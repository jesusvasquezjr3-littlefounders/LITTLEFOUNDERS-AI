// `input` family registry slice — composed by lesson-engine/registry.ts.

import type { Registry } from '../../core/types'
import {
  CountObjects,
  EquationBuilder,
  EstimateSlider,
  FillBlank,
  NumberInput,
  TypeAnswer,
  buildNumericAnswer,
  buildSliderAnswer,
  inputCanSubmit,
} from './components'

export { inputSchemas } from './schema'
export { inputGraders } from './grade'
export { inputFixtures } from './fixtures'

export const inputRegistry: Registry = {
  type_answer: { kind: 'input', component: TypeAnswer, canSubmit: inputCanSubmit.type_answer },
  fill_blank: { kind: 'input', component: FillBlank, canSubmit: inputCanSubmit.fill_blank },
  number_input: {
    kind: 'input',
    component: NumberInput,
    canSubmit: inputCanSubmit.number_input,
    buildAnswer: buildNumericAnswer,
  },
  estimate_slider: {
    kind: 'input',
    component: EstimateSlider,
    canSubmit: inputCanSubmit.estimate_slider,
    buildAnswer: buildSliderAnswer,
  },
  count_objects: {
    kind: 'input',
    component: CountObjects,
    canSubmit: inputCanSubmit.count_objects,
    buildAnswer: buildNumericAnswer,
  },
  equation_builder: {
    kind: 'input',
    component: EquationBuilder,
    canSubmit: inputCanSubmit.equation_builder,
  },
}

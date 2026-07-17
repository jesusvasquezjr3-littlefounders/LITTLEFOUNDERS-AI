// `analyze` family registry slice — composed by lesson-engine/registry.ts.

import type { Registry } from '../../core/types'
import {
  CauseEffect,
  CompareTable,
  EvidenceHunt,
  FactOpinion,
  ReadChart,
  RedFlags,
  SpotError,
  analyzeCanSubmit,
  buildFactOpinionAnswer,
} from './components'

export { analyzeSchemas } from './schema'
export { analyzeGraders } from './grade'
export { analyzeFixtures } from './fixtures'

export const analyzeRegistry: Registry = {
  spot_error: { kind: 'input', component: SpotError, canSubmit: analyzeCanSubmit.spot_error },
  cause_effect: {
    kind: 'input',
    component: CauseEffect,
    canSubmit: analyzeCanSubmit.cause_effect,
  },
  compare_table: {
    kind: 'input',
    component: CompareTable,
    canSubmit: analyzeCanSubmit.compare_table,
  },
  read_chart: { kind: 'input', component: ReadChart, canSubmit: analyzeCanSubmit.read_chart },
  evidence_hunt: {
    kind: 'input',
    component: EvidenceHunt,
    canSubmit: analyzeCanSubmit.evidence_hunt,
  },
  red_flags: { kind: 'input', component: RedFlags, canSubmit: analyzeCanSubmit.red_flags },
  fact_opinion: {
    kind: 'input',
    component: FactOpinion,
    canSubmit: analyzeCanSubmit.fact_opinion,
    buildAnswer: buildFactOpinionAnswer,
  },
}

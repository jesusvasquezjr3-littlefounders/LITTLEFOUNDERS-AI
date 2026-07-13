// `arrange` family registry slice — composed by lesson-engine/registry.ts.

import type { Registry } from '../../core/types'
import {
  BuildSentence,
  GroupSets,
  MatchPairs,
  MemoryFlip,
  NumberLine,
  OrderSteps,
  PatternComplete,
  RankChoices,
  SortBuckets,
  TimelineOrder,
  arrangeCanSubmit,
  buildGroupSetsAnswer,
  buildMatchPairsAnswer,
  buildNumberLineAnswer,
  buildPatternCompleteAnswer,
  buildSortBucketsAnswer,
} from './components'

export { arrangeSchemas } from './schema'
export { arrangeGraders } from './grade'
export { arrangeFixtures } from './fixtures'

export const arrangeRegistry: Registry = {
  match_pairs: {
    kind: 'input',
    component: MatchPairs,
    canSubmit: arrangeCanSubmit.match_pairs,
    buildAnswer: buildMatchPairsAnswer,
  },
  memory_flip: { kind: 'flow', component: MemoryFlip },
  sort_buckets: {
    kind: 'input',
    component: SortBuckets,
    canSubmit: arrangeCanSubmit.sort_buckets,
    buildAnswer: buildSortBucketsAnswer,
  },
  order_steps: { kind: 'input', component: OrderSteps, canSubmit: arrangeCanSubmit.order_steps },
  rank_choices: {
    kind: 'input',
    component: RankChoices,
    canSubmit: arrangeCanSubmit.rank_choices,
  },
  build_sentence: {
    kind: 'input',
    component: BuildSentence,
    canSubmit: arrangeCanSubmit.build_sentence,
  },
  timeline_order: {
    kind: 'input',
    component: TimelineOrder,
    canSubmit: arrangeCanSubmit.timeline_order,
  },
  pattern_complete: {
    kind: 'input',
    component: PatternComplete,
    canSubmit: arrangeCanSubmit.pattern_complete,
    buildAnswer: buildPatternCompleteAnswer,
  },
  group_sets: {
    kind: 'input',
    component: GroupSets,
    canSubmit: arrangeCanSubmit.group_sets,
    buildAnswer: buildGroupSetsAnswer,
  },
  number_line: {
    kind: 'input',
    component: NumberLine,
    canSubmit: arrangeCanSubmit.number_line,
    buildAnswer: buildNumberLineAnswer,
  },
}

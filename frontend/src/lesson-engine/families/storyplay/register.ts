// `storyplay` family registry slice — composed by lesson-engine/registry.ts.

import type { Registry } from '../../core/types'
import {
  DialogueChoice,
  FlashMatch,
  LightningRound,
  StoryBranch,
  WouldYouRather,
  storyplayCanSubmit,
} from './components'

export { storyplaySchemas } from './schema'
export { storyplayGraders } from './grade'
export { storyplayFixtures } from './fixtures'

export const storyplayRegistry: Registry = {
  story_branch: { kind: 'flow', component: StoryBranch },
  dialogue_choice: { kind: 'flow', component: DialogueChoice },
  flash_match: { kind: 'flow', component: FlashMatch },
  lightning_round: { kind: 'flow', component: LightningRound },
  would_you_rather: {
    kind: 'input',
    component: WouldYouRather,
    canSubmit: storyplayCanSubmit.would_you_rather,
  },
}

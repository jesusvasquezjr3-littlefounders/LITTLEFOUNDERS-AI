// `story` family registry slice — composed by lesson-engine/registry.ts.

import type { Registry } from '../../core/types'
import { Checkpoint, ConceptReveal, KeyIdeas, StoryDialogue, StoryScene } from './components'

export { storySchemas } from './schema'
export { storyGraders } from './grade'
export { storyFixtures } from './fixtures'

export const storyRegistry: Registry = {
  story_dialogue: { kind: 'content', component: StoryDialogue },
  story_scene: { kind: 'content', component: StoryScene },
  key_ideas: { kind: 'content', component: KeyIdeas },
  concept_reveal: { kind: 'content', component: ConceptReveal },
  checkpoint: { kind: 'content', component: Checkpoint },
}

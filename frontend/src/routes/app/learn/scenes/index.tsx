// Data-driven scene registry for the adventure map (COURSE_ENGINE.md §2:
// `adventures.theme` is a closed-but-extensible scene id). One import of
// scenes.css here is enough — every scene component below lives under this
// directory and shares the same ambient keyframes.
import './scenes.css'
import type { ComponentType } from 'react'
import ArchipelagoScene from './ArchipelagoScene'
import ForestScene from './ForestScene'
import CityScene from './CityScene'
import ValleyScene from './ValleyScene'
import KingdomScene from './KingdomScene'
import CosmosScene from './CosmosScene'
import GradientFallbackScene from './GradientFallbackScene'

export type SceneTheme = 'archipelago' | 'forest' | 'city' | 'valley' | 'kingdom' | 'cosmos'

export const SCENES: Record<SceneTheme, ComponentType> = {
  archipelago: ArchipelagoScene,
  forest: ForestScene,
  city: CityScene,
  valley: ValleyScene,
  kingdom: KingdomScene,
  cosmos: CosmosScene,
}

export function isKnownScene(theme: string): theme is SceneTheme {
  return Object.prototype.hasOwnProperty.call(SCENES, theme)
}

export { GradientFallbackScene }

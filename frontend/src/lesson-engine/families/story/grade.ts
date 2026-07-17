// `story` family — content types are ungraded (LESSON_ENGINE.md §5.1): they
// carry no answer keys and complete on advance / self-mark, never through the
// Grader boundary. The empty record keeps the per-family naming convention so
// registry composition stays uniform across all 8 families.

import type { FamilyGrader } from '../../core/types'

export const storyGraders: Record<string, FamilyGrader> = {}

import type { ComponentProps } from 'react';
import { LegacySheetScope } from '@/app-routes/legacySheet';
import LessonPlayer from '@/lesson-engine/player/LessonPlayer';

/*
 * The v1 Lesson Player with its legacy sheet scoped to its lifetime, for a
 * lazy host outside the learner island (the staff v1 preview): the sheet
 * string ships in this chunk only, and leaves the document with the player.
 */
export default function ScopedLessonPlayer(props: ComponentProps<typeof LessonPlayer>) {
  return <LegacySheetScope><LessonPlayer {...props} /></LegacySheetScope>;
}

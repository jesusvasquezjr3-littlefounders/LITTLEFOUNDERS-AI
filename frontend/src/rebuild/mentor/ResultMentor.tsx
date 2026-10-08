import { lazy, Suspense, useState, type ReactNode } from 'react';
import { readEnvironment } from './MentorStage';
import { poseById } from '../../tutor-scene/poseLibrary';
import { StaticThemeProvider } from '../../theme/useTheme';
import type { MentorCharacter } from '../design/controls';

/*
 * The learner's own Mentor on the end-of-lesson screen: the real model alone on the screen's colour, in the catalogue's own
 * pose for "lesson complete, on the results screen" (`celebrate.lesson`; the calm register gets `celebrate.applaud`, the
 * same character with calmer framing). With `mood="ponder"` it is the same character thinking (`think.ponder`, calm: `teach.aside`),
 * which is how the story asks "same choice today?" before a lesson. No Diorama and no scenery behind it: the result is a close-up of the Mentor and the
 * learner's numbers, not a place. Where the device cannot hold a live 3D scene (no WebGL, data saver, low power) or while
 * the model loads, `fallback` (the medal) holds the same slot, so the layout never moves.
 */
const CharacterStage = lazy(() => import('../../tutor-scene/CharacterStage').then((module) => ({ default: module.CharacterStage })));

export function ResultMentor({ character, calm, fallback, mood = 'celebrate' }: { character: MentorCharacter; calm: boolean; fallback: ReactNode; mood?: 'celebrate' | 'ponder' }) {
  const [environment] = useState(() => readEnvironment());
  if (!environment.webgl || environment.saveData || environment.lowPower) return <>{fallback}</>;
  const pose = poseById(mood === 'ponder' ? (calm ? 'teach.aside' : 'think.ponder') : calm ? 'celebrate.applaud' : 'celebrate.lesson');
  if (!pose) return <>{fallback}</>;
  return <div className="lf-result-mentor" aria-hidden="true">
    {/* The screen is the accent orange in both colour modes, so the character is lit for a light surface in both (the dark rig turns it to a silhouette). */}
    <StaticThemeProvider isDark={false}>
      <Suspense fallback={fallback}>
        <CharacterStage id={character} className="lf-scene-fill" emotion={pose.emotion} action={pose.action} rotation={pose.rotation ?? 0} fill={mood === 'ponder' ? 1.35 : 0.96} />
      </Suspense>
    </StaticThemeProvider>
  </div>;
}

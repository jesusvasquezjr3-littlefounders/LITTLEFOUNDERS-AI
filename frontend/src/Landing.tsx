import { Landing as LandingSurface } from '@/rebuild/site/Landing';
import { useShellLocale } from '@/ShellRoot';
import type { StartAction, TutorAction } from '@/rebuild/site/blocks';

/*
 * `/`: the landing page and its calls to action.
 *
 * The calls to action ("I'm a Parent", "I just want to learn") render as
 * buttons but do nothing yet: no navigation, no network. Attach their real
 * behaviour here, through `start` and `tutor`.
 */
const start: StartAction = { onStart: () => {} };
const tutor: TutorAction = { onStart: () => {} };

export function Landing() {
  return <LandingSurface locale={useShellLocale()} start={start} tutor={tutor} />;
}

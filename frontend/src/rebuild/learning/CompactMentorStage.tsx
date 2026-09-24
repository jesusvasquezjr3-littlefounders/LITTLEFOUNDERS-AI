import { lazy, Suspense, useEffect, useState } from 'react';
import type { AgeBand } from '../design/copyBudget';
import { StaticThemeProvider } from '../../theme/useTheme';
import { getDeviceProbe, pickInitialTier } from '../../tutor-scene/quality';
import './mentorStage.css';

const TutorStage = lazy(() => import('../../tutor-scene/TutorStage').then((module) => ({ default: module.TutorStage })));

/** Isolated lesson-stage composition using the existing real 3D renderer and Diorama. */
export function CompactMentorStage({ ageBand, theme, verdict }: { ageBand: AgeBand; theme: 'light' | 'dark'; verdict: 'met' | 'review' | 'incomplete' | 'invalid' | null }) {
  const [ready, setReady] = useState(false);
  const [staticScene, setStaticScene] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches || pickInitialTier(getDeviceProbe()) === 'low');
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      setReady(false);
      setStaticScene(preference.matches || pickInitialTier(getDeviceProbe()) === 'low');
    };
    preference.addEventListener('change', onChange);
    return () => preference.removeEventListener('change', onChange);
  }, []);
  const emotion = verdict === 'met' ? 'happy' : verdict ? 'encouraging' : 'neutral';
  const action = verdict && verdict !== 'met' ? 'nod' : 'idle';
  const variant = ageBand === '13-17' || ageBand === 'adult' ? 'teen' : 'young';
  const mode = theme === 'dark' ? 'dark' : 'light';
  return <div className={`lf-mentor-band lf-mentor-band--${ageBand}`} aria-label="Dina" data-render-mode={staticScene ? 'still' : '3d'} data-mentor-state={emotion}>
    {staticScene || !ready ? <picture>
      <source media="(min-width: 640px)" srcSet={`/rebuild/mentor-stills/dina-square-${mode}.png`} />
      <img className="lf-mentor-band-still" src={`/rebuild/mentor-stills/dina-${variant}-${mode}.png`} alt="" aria-hidden="true" />
    </picture> : null}
    {!staticScene ? <StaticThemeProvider isDark={theme === 'dark'}><Suspense fallback={null}>
      <TutorStage className="lf-mentor-band-canvas" scene="diorama-a" character="dina" companion={null} shot="closeup-wide" emotion={emotion} action={action} onQuality={(quality) => { if (quality.tier === 'low') { setReady(false); setStaticScene(true); } }} onReady={() => setReady(true)} />
    </Suspense></StaticThemeProvider> : null}
  </div>;
}

import { lazy, Suspense, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AgeBand } from '../design/copyBudget';
import { REGISTERS, registerForCopyBand } from '../design/learnerRegisterPolicy.generated';
import type { LessonMentorStage } from './lessonDocument';
import { StaticThemeProvider } from '../../theme/useTheme';
import { getDeviceProbe, pickInitialTier } from '../../tutor-scene/quality';
import './mentorStage.css';

const TutorStage = lazy(() => import('../../tutor-scene/TutorStage').then((module) => ({ default: module.TutorStage })));

/**
 * B.23 / B.26 (S05.3f): presence and reactions come from the one register
 * policy. A miss is always met with encouragement, never a sad or
 * disappointed state; a teen's Mentor is calmer and smaller. Never a
 * celebration for a single answer (OD-7).
 */
export function mentorReaction(ageBand: AgeBand, verdict: 'met' | 'review' | 'incomplete' | 'invalid' | null) {
  const mentor = REGISTERS[registerForCopyBand(ageBand)].mentor;
  const emotion = verdict === 'met' ? (mentor.metReaction === 'happy' ? 'happy' as const : 'neutral' as const) : verdict ? mentor.missReaction : 'neutral' as const;
  const action = verdict === 'met' ? (mentor.metReaction === 'nod' ? 'nod' as const : 'idle' as const) : verdict ? (mentor.animation === 'calm' ? 'idle' as const : 'nod' as const) : 'idle' as const;
  return { mentor, emotion, action };
}

/** Isolated lesson-stage composition using the existing real 3D renderer and Diorama. */
export function CompactMentorStage({ ageBand, theme, verdict, character, scene }: {
  ageBand: AgeBand; theme: 'light' | 'dark'; verdict: 'met' | 'review' | 'incomplete' | 'invalid' | null;
  character: LessonMentorStage['character']; scene: LessonMentorStage['scene'];
}) {
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
  const { mentor, emotion, action } = mentorReaction(ageBand, verdict);
  const band = { '--lf-mentor-band-size': `${mentor.stageBandPx}px` } as CSSProperties;
  const variant = ageBand === '13-17' || ageBand === 'adult' ? 'teen' : 'young';
  const mode = theme === 'dark' ? 'dark' : 'light';
  // Only Dina stills are authored (the asset manifest carries exactly the six
  // dina stills). Every other character renders the real 3D model even when
  // the tier governor asked for a still — a look-alike would be a false
  // learner continuity, so a non-dina static band is simply rendered 3D.
  const staticStill = staticScene && character === 'dina';
  const showStill = character === 'dina' && (staticScene || !ready);
  return <div className={`lf-mentor-band lf-mentor-band--${ageBand}`} style={band} data-mentor-presence={mentor.presence} aria-label={character} data-render-mode={staticStill ? 'still' : '3d'} data-mentor-state={emotion} data-mentor-character={character} data-mentor-scene={scene}>
    {showStill ? <picture>
      <source media="(min-width: 640px)" srcSet={`/rebuild/mentor-stills/dina-square-${mode}.png`} />
      <img className="lf-mentor-band-still" src={`/rebuild/mentor-stills/dina-${variant}-${mode}.png`} alt="" aria-hidden="true" />
    </picture> : null}
    {!staticStill ? <StaticThemeProvider isDark={theme === 'dark'}><Suspense fallback={null}>
      <TutorStage className="lf-mentor-band-canvas" scene={scene} character={character} companion={null} shot="closeup-wide" emotion={emotion} action={action} onQuality={(quality) => { if (quality.tier === 'low') { setReady(false); if (character === 'dina') setStaticScene(true); } }} onReady={() => setReady(true)} />
    </Suspense></StaticThemeProvider> : null}
  </div>;
}

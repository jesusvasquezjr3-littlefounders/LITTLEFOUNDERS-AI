import { useEffect, useState } from 'react';
import { RebuildRoot } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import { StaticThemeProvider } from '../../theme/useTheme';
import { CharacterStage } from '../../tutor-scene/CharacterStage';
import { poseById } from '../../tutor-scene/poseLibrary';

/*
 * A Mentor performing a catalogue pose, alone and on a transparent canvas, for the landing's character
 * clips (`rebuild.html?screen=site-actor&who=dina&pose=greet.hop&fire=0.5&fill=0.9`). The model rests, and
 * when the capture script sets `window.__actorStart` it starts the pose's action `fire` seconds later (on the capture's own
 * clock), so every clip begins and ends at rest. Rendered to MP4 by `scripts/render-site-actors.mjs`. Development-only.
 */
export const ACTOR_SIZE = { width: 640, height: 760 } as const;

export function SiteActorPreview({ locale, theme, params }: { locale: Locale; theme: 'light' | 'dark'; params: URLSearchParams }) {
  const who = (['rho', 'zara', 'liruf', 'dina'] as const).find((id) => id === params.get('who')) ?? 'dina';
  const pose = poseById(params.get('pose') ?? 'ambient.idle.happy') ?? poseById('ambient.idle.happy')!;
  const fire = Number(params.get('fire') ?? 0.5);
  const fill = Number(params.get('fill')) || 0.9;
  const [key, setKey] = useState(0);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const start = (window as unknown as { __actorStart?: number }).__actorStart;
      if (start !== undefined && (performance.now() - start) / 1000 >= fire) { setActing(true); setKey((count) => count + 1); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [fire]);

  return <RebuildRoot theme={theme} locale={locale}>
    {/* Always the light rig: lit for a dark page the character turns dim and flat, and a clip has to look bright on both. */}
    <StaticThemeProvider isDark={false}>
      {/* No background at all: the clip is transparent. The canvas fades toward its edges so the contact shadow never ends in a straight line. */}
      <div data-site-actor style={{ position: 'fixed', insetBlockStart: 0, insetInlineStart: 0, inlineSize: ACTOR_SIZE.width, blockSize: ACTOR_SIZE.height, overflow: 'hidden', background: 'transparent' }}>
        <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: 'radial-gradient(ellipse 54% 54% at 50% 50%, #000 82%, transparent 100%)', maskImage: 'radial-gradient(ellipse 54% 54% at 50% 50%, #000 82%, transparent 100%)' }}>
          <CharacterStage id={who} className="lf-scene-fill" emotion={pose.emotion} action={acting ? pose.action : 'idle'} actionKey={key} rotation={pose.rotation ?? 0} fill={fill} />
        </div>
      </div>
    </StaticThemeProvider>
  </RebuildRoot>;
}

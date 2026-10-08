import { RebuildRoot } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import { StaticThemeProvider } from '../../theme/useTheme';
import { CharacterStage } from '../../tutor-scene/CharacterStage';
import { poseById } from '../../tutor-scene/poseLibrary';

/*
 * Zara leaning in from the edge of the frame (catalogue pose `ambient.curious`:
 * "watching the learner work, from the edge of the frame"), alone on a
 * transparent canvas, for the landing's tablet section. Rendered to a WebP with
 * alpha by `scripts/render-site-tablet.mjs` (preview entry
 * `rebuild.html?screen=site-peek`). The capture asks for reduced motion, so the
 * pose is held at its one representative frame. Development-only.
 */
export const PEEK_SIZE = { width: 640, height: 760 } as const;

export function SitePeekPreview({ locale, theme }: { locale: Locale; theme: 'light' | 'dark' }) {
  const pose = poseById('ambient.curious')!;
  return <RebuildRoot theme={theme} locale={locale}>
    <StaticThemeProvider isDark={theme === 'dark'}>
      <div data-site-peek style={{ position: 'fixed', insetBlockStart: 0, insetInlineStart: 0, inlineSize: PEEK_SIZE.width, blockSize: PEEK_SIZE.height, background: 'transparent' }}>
        <CharacterStage id="zara" className="lf-scene-fill" emotion={pose.emotion} action={pose.action} rotation={pose.rotation ?? 0} fill={0.92} />
      </div>
    </StaticThemeProvider>
  </RebuildRoot>;
}

/*
 * A Mentor in a catalogue pose, alone on a transparent canvas (`rebuild.html?screen=site-problem&who=dina&pose=think.puzzled&fill=0.76`),
 * for the landing: Dina puzzled beside the problem, and Dina's reactions in the lesson demo. Same capture as the peek.
 */
export function SiteProblemPreview({ locale, theme, params }: { locale: Locale; theme: 'light' | 'dark'; params: URLSearchParams }) {
  const who = (['rho', 'zara', 'liruf', 'dina'] as const).find((id) => id === params.get('who')) ?? 'dina';
  const pose = poseById(params.get('pose') ?? 'think.puzzled') ?? poseById('think.puzzled')!;
  const fill = Number(params.get('fill')) || 0.76;
  return <RebuildRoot theme={theme} locale={locale}>
    <StaticThemeProvider isDark={theme === 'dark'}>
      <div data-site-problem style={{ position: 'fixed', insetBlockStart: 0, insetInlineStart: 0, inlineSize: PEEK_SIZE.width, blockSize: PEEK_SIZE.height, background: 'transparent' }}>
        <CharacterStage id={who} className="lf-scene-fill" emotion={pose.emotion} action={pose.action} rotation={pose.rotation ?? 0} fill={fill} />
      </div>
    </StaticThemeProvider>
  </RebuildRoot>;
}

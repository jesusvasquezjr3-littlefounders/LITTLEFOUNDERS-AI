import { lazy, Suspense } from 'react';
import { StaticThemeProvider } from '@/theme/useTheme';
import { RebuildRoot } from '../../design/controls';
import type { Locale } from '../../design/copyBudget';

/*
 * The hero scene on a fixed canvas, for `scripts/render-hero-video.mjs`
 * (preview screen `hero-capture`, theme light or dark). It is
 * development-only: the site ships the video this page is rendered to, never
 * this scene. The canvas sits at the page's top-left corner and is exactly
 * HERO_VIDEO_SIZE, on the page's own background colour, so a screenshot of that
 * rectangle is a frame of the video.
 */
const HeroScene = lazy(() => import('./HeroScene'));

export const HERO_VIDEO_SIZE = { width: 1000, height: 800 } as const;

export function HeroCapture({ theme, locale }: { theme: 'light' | 'dark'; locale: Locale }) {
  return <RebuildRoot theme={theme} locale={locale}>
    <StaticThemeProvider isDark={theme === 'dark'}>
      <div data-hero-capture style={{ position: 'fixed', insetBlockStart: 0, insetInlineStart: 0, inlineSize: HERO_VIDEO_SIZE.width, blockSize: HERO_VIDEO_SIZE.height, background: 'var(--base)' }}>
        <Suspense fallback={null}><HeroScene /></Suspense>
      </div>
    </StaticThemeProvider>
  </RebuildRoot>;
}

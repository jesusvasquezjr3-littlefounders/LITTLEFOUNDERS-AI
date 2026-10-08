import { useEffect, useState } from 'react';
import { LearnerShell, MENTOR_NAMES, RebuildRoot, type ShellNavItem } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import { NAV_MARKS } from '../design/navMarks';
import { NarrativeRecallView } from '../learning/NarrativeRecallView';
import { LessonResultView } from '../learning/LessonResultView';
import { milestoneReceipt } from '../learning/motivationFixtures';
import { recallFixture } from '../learning/narrativeFixtures';
import { rebuildNamespaceCopy } from '../../i18n/rebuild';
import { StaticThemeProvider } from '../../theme/useTheme';
import { ChildCoinsScreen } from './ChildCoinsPreview';

/*
 * The three real screens the landing's "value of money" section shows inside
 * a tablet (owner brief, 2026-10-06): the child's Wallet with a savings goal
 * under way, the Decision Journal, and the end of a lesson. They are the app's
 * own components, mounted with fixture data inside the learner shell at a
 * tablet's width, and rendered to images by `scripts/render-site-tablet.mjs`
 * (preview entry `rebuild.html?screen=site-tablet&view=wallet|journal|result`).
 * Development-only: the site ships the images, not these components.
 */
export const TABLET_VIEWS = ['wallet', 'recall', 'result'] as const;
export type TabletView = (typeof TABLET_VIEWS)[number];
export const TABLET_SIZE = { width: 1024, height: 768 } as const;

const NAV: Record<TabletView, string> = { wallet: 'wallet', recall: 'learn', result: 'learn' };

function Wallet({ locale, dark }: { locale: Locale; dark: boolean }) {
  return <ChildCoinsScreen locale={locale} dark={dark} params={new URLSearchParams()} />;
}

export function SiteTabletPreview({ locale, theme, view }: { locale: Locale; theme: 'light' | 'dark'; view: TabletView }) {
  const dark = theme === 'dark';
  // The video capture (scripts/render-site-tablet-video.mjs) replays the end of a lesson from its own mount by sending this event.
  const [replay, setReplay] = useState(0);
  useEffect(() => {
    const again = () => setReplay((count) => count + 1);
    window.addEventListener('lf-replay', again);
    return () => window.removeEventListener('lf-replay', again);
  }, []);
  const shell = rebuildNamespaceCopy[locale].core.appShell;
  const href = (id: string) => `#${id}`;
  const item = (id: 'learn' | 'tasks' | 'wallet' | 'profile'): ShellNavItem => ({ id, label: shell.nav[id], href: href(id), iconAssetId: NAV_MARKS[id] });
  const items = [item('learn'), item('tasks'), item('wallet'), item('profile')];
  const body = view === 'wallet' ? <Wallet locale={locale} dark={dark} />
    : view === 'recall'
      ? <NarrativeRecallView key={replay} fixture locale={locale} dark={dark} recall={recallFixture(locale)} mentor={{ character: 'zara', scene: 'diorama-a' }} onContinue={() => {}} />
      : <LessonResultView key={replay} locale={locale} onContinue={() => {}} fixture rawReceipt={{ ...milestoneReceipt(locale), completion_id: `sample-completion-3-${replay}` }} mentor={{ character: 'zara', scene: 'diorama-a' }} />;
  const box = { position: 'fixed', insetBlockStart: 0, insetInlineStart: 0, inlineSize: TABLET_SIZE.width, blockSize: TABLET_SIZE.height, overflow: 'hidden' } as const;
  // The recall and the end of a lesson are full-screen routes of their own in the app, with no navigation around it.
  if (view === 'result' || view === 'recall') return <RebuildRoot theme={theme} locale={locale}><StaticThemeProvider isDark={dark}><div data-site-tablet style={box}>{body}</div></StaticThemeProvider></RebuildRoot>;
  return <RebuildRoot theme={theme} locale={locale}>
    <StaticThemeProvider isDark={dark}>
      <div data-site-tablet style={box}>
        <LearnerShell appName="LittleFounders" pageTitle={shell.nav[NAV[view] as 'learn' | 'wallet']} routeKey={`tablet:${view}`} locale={locale} onNavigate={() => {}}
          current={NAV[view]} items={items} labels={{ skip: shell.skip, navigation: shell.navigation }}
          mentor={{ href: href('mentor'), name: MENTOR_NAMES.zara, character: 'zara' }}>{body}</LearnerShell>
      </div>
    </StaticThemeProvider>
  </RebuildRoot>;
}

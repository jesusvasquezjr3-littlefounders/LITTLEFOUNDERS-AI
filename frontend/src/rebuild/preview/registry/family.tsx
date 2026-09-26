import { LearningNarrative } from '../../family/LearningNarrative';
import { LearningBridges } from '../../family/LearningBridges';
import { bridgesFixture, narrativePreviewStates } from '../../family/familyLearningFixtures';
import { AchievementSharePreview } from '../../family/AchievementSharePreview';
import { StreakPauseControl } from '../../family/StreakPauseControl';
import { streak as streakFixture, streakPausePreviewStates } from '../../learning/motivationFixtures';
import { framed, standalone, type PreviewRegistry } from './types';

/*
 * Lane 4 (family): the Family Hub, the Tutor console, tasks, banking and the
 * teen wallet.
 */
export const familyPreviewScreens: PreviewRegistry = {
  'achievement-share': standalone(({ locale, theme, params }) => <AchievementSharePreview locale={locale} theme={theme} state={params.get('state')} />),
  familylearning: framed(({ locale, theme, params }) => <main className="lf-family-preview" data-surface="app" data-screen="family-learning-preview">
    <LearningBridges key={`bridges:${locale}`} fixture locale={locale} dark={theme === 'dark'}
      state={params.get('bridges') === '0' ? { status: 'ready', prompts: [] } : bridgesFixture(locale)}
      onAct={async () => 'created'} onDismiss={async () => 'dismissed'} onRetry={() => {}} />
    <LearningNarrative key={`narrative:${locale}`} fixture locale={locale} dark={theme === 'dark'} open={params.get('open') !== '0'}
      state={narrativePreviewStates(locale)[params.get('narrative') ?? 'ready'] ?? narrativePreviewStates(locale).ready!}
      onToggle={() => {}} onRetry={() => {}} onMore={() => {}} />
  </main>),
  streakpause: framed(({ locale, theme, params }) => <main className="lf-family-preview" data-surface="app" data-screen="streak-pause-host">
    <StreakPauseControl key={`pause:${locale}:${params.get('pause')}`} fixture locale={locale} dark={theme === 'dark'} today="2026-09-24"
      state={streakPausePreviewStates[params.get('pause') ?? 'ready'] ?? streakPausePreviewStates.ready!}
      onPause={async (startsOn, endsOn) => ({ status: 'saved', streak: streakFixture({ status: 'paused', pause: { startsOn, endsOn } }) })}
      onEnd={async () => ({ status: 'ended', streak: streakFixture({}) })} onRetry={() => {}} />
  </main>),
};

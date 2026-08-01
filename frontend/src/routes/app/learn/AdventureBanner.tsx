import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import { GradientFallbackScene, SCENES, isKnownScene } from './scenes';
import { localizedText, type AdventureNode } from './types';

/*
 * One vertically-stacked adventure banner on the course map (DESIGN.md
 * Screen Recipes — no dedicated "Lesson map" recipe exists yet; this
 * composition follows the Dashboard/Lesson recipes' grammar: scene +
 * .lf-glass-deep chrome on an inverse-equivalent illustrated band; documented
 * here per §0 Composition Fidelity since the recipe itself wasn't extended
 * (frontend/AGENTS.md forbids touching root docs from this task).
 */

interface AdventureBannerProps {
  adventure: AdventureNode;
  locale: string;
  expanded: boolean;
  onToggle: () => void;
}

export function AdventureBanner({ adventure, locale, expanded, onToggle }: AdventureBannerProps) {
  const { t } = useTranslation();
  const Scene = isKnownScene(adventure.theme) ? SCENES[adventure.theme] : GradientFallbackScene;
  const locked = adventure.state === 'locked';
  const completed = adventure.state === 'completed';
  const title = localizedText(adventure.title, locale, adventure.slug);

  const content = (
    <>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="h-[280px] w-full shrink-0">
          <Scene />
        </div>
      </div>

      {locked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-[#080f28]/55 backdrop-blur-[1px]">
          <Icon name="lock" className="text-[26px] text-white" />
          <span className="lf-label text-white">{t('learn.locked')}</span>
        </div>
      )}

      {completed && (
        <div className="lf-glass-deep absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 md:right-4 md:top-4">
          <Icon name="emoji_events" fill className="text-[16px] text-on-inverse" />
          <span className="lf-caption font-bold text-on-inverse">{t('learn.completed')}</span>
        </div>
      )}

      <div className="lf-glass-deep absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4">
        <h2 className="lf-title text-on-inverse">{title}</h2>
        <span className="lf-caption lf-number shrink-0 rounded-full bg-white/15 px-3 py-1 font-bold text-on-inverse">
          {t('learn.lessonsProgress', { passed: adventure.progress.passed, total: adventure.progress.total })}
        </span>
      </div>
    </>
  );

  if (locked) {
    return (
      <div aria-disabled="true" className="relative isolate h-[120px] w-full overflow-hidden rounded-lg shadow-glass md:h-[280px]">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="motion-safe-press relative isolate h-[120px] w-full overflow-hidden rounded-lg text-left shadow-glass transition-shadow duration-200 hover:shadow-pop focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:h-[280px]"
    >
      {content}
    </button>
  );
}

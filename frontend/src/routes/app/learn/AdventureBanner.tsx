import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import { GradientFallbackScene, SCENES, isKnownScene } from './scenes';
import { localizedText, type AdventureNode } from './types';

/*
 * The illustrated chapter band (/DESIGN.md §Screen Recipes → Learn). The
 * scene is the premium surface on this route and the only decoration that
 * earns its place, so the chrome over it stays to a name, a count and a
 * chevron. "Completed" is a trophy rather than a trophy plus the word, and
 * the accessible name carries the state for anyone the trophy does not reach.
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
      {/*
        * The scenes are authored at 280px with their subject anchored to the
        * bottom, so a short band that CROPS them shows sky and a slice of a
        * tree trunk. Below md the whole scene is scaled down instead: a small
        * island is still an island, half a trunk is not.
        */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="h-[280px] w-[222%] shrink-0 scale-[0.45] md:w-full md:scale-100">
          <Scene />
        </div>
      </div>

      {locked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#080f28]/60 backdrop-blur-[1px]">
          <Icon name="lock" className="text-[26px] text-white" aria-hidden />
        </div>
      )}

      {completed && (
        <span className="lf-glass-deep absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full md:right-4 md:top-4">
          <Icon name="emoji_events" fill className="text-[18px] text-on-inverse" aria-hidden />
        </span>
      )}

      <div className="lf-glass-deep absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4">
        <h2 className="lf-title min-w-0 flex-1 truncate text-on-inverse">{title}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <span className="lf-caption lf-number font-bold text-on-inverse">
            {t('learn.lessonsProgress', { passed: adventure.progress.passed, total: adventure.progress.total })}
          </span>
          {!locked && (
            <Icon
              name="expand_more"
              className={`text-[20px] text-on-inverse transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
          )}
        </div>
      </div>
    </>
  );

  const stateLabel = locked ? t('learn.locked') : completed ? t('learn.completed') : '';

  if (locked) {
    return (
      <div
        aria-disabled="true"
        aria-label={`${title}, ${stateLabel}`}
        className="relative isolate h-[126px] w-full overflow-hidden md:h-[280px]"
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={stateLabel ? `${title}, ${stateLabel}` : title}
      className="motion-safe-press relative isolate h-[126px] w-full overflow-hidden text-left transition-shadow duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary md:h-[280px]"
    >
      {content}
    </button>
  );
}

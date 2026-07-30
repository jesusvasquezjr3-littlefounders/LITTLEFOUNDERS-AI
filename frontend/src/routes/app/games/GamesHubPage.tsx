import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { trackInsight } from '@/lib/insights';
import { Card, LoadingOverlay } from '@/components/ui';
import CharacterActor from '@/components/characters/control/CharacterActor';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { localizedText } from '@/routes/app/learn/types';
import { fetchGameCatalog, type CatalogCourse, type Json } from './api';
import { GameCard, LockedGameCard, type HubCard } from './GameCard';

/*
 * /games — the Games hub (GAME_ENGINE.md §8, /DESIGN.md §Screen Recipes →
 * Games hub). A section INSIDE the Dashboard shell, never a fullscreen layer:
 * AppLayout already supplies `max-w-container` and the responsive gutters.
 *
 * This page loads ZERO mechanic code. It renders from `MECHANIC_META` — the
 * synchronous half of the registry — so browsing the arcade never downloads a
 * simulator, a schema or a view. The play route is where a mechanic chunk is
 * fetched, and only the one being played.
 *
 * Lock state, progress and grouping are all SERVER-computed
 * (backend/src/services/gameCatalog.ts). Nothing here re-derives "has this child
 * passed a lesson" — a second implementation of that rule is the v1 failure the
 * platform already paid for once.
 */

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; code: string }
  | { status: 'ready'; courses: CatalogCourse[] };

/** One course → adventure section of the hub. Groups stack in curriculum order
 *  and never collapse into accordions. */
interface HubGroup {
  key: string;
  courseTitle: Json;
  courseSlug: string;
  adventureTitle: Json;
  adventureSlug: string;
  cards: HubCard[];
}

/** Flatten the catalog into the recipe's groups. Core already prunes branches with
 *  no games and orders everything by curriculum position, so this only reshapes. */
export function buildHubGroups(courses: readonly CatalogCourse[]): HubGroup[] {
  const groups: HubGroup[] = [];
  for (const course of courses) {
    for (const adventure of course.adventures) {
      const cards: HubCard[] = [];
      for (const topic of adventure.topics) {
        for (const game of topic.games) cards.push({ game, topic, courseSlug: course.slug });
      }
      if (cards.length === 0) continue;
      groups.push({
        key: `${course.id}:${adventure.id}`,
        courseTitle: course.title,
        courseSlug: course.slug,
        adventureTitle: adventure.title,
        adventureSlug: adventure.slug,
        cards,
      });
    }
  }
  return groups;
}

/**
 * The ONE card that carries papaya: the next/resume game — the first unlocked
 * game, in curriculum order, that has not been passed yet.
 *
 * When every unlocked game is already passed there is no forward action left, so
 * the view carries no papaya at all: the recipe puts passed cards in the
 * secondary pill ("Play again"), and inventing a main CTA where none exists is
 * exactly what the Action Color Contract forbids.
 */
export function pickPrimaryGameId(groups: readonly HubGroup[]): string | null {
  for (const group of groups) {
    for (const card of group.cards) {
      if (card.game.state !== 'locked' && !card.game.passed) return card.game.id;
    }
  }
  return null;
}

export function GamesHubPage() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  // The demand signal the placeholder used to carry (/INSIGHTS.md): "how many
  // people opened Games" stays a roadmap input now that the section is real.
  // No-op for unconsented kids — the beacon's own gate, not a decision here.
  useEffect(() => {
    trackInsight('game_open', { routeClass: 'games' });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      const token = await getToken();
      const { data, error } = await fetchGameCatalog(token);
      if (cancelled) return;
      setState(error ? { status: 'error', code: error.code } : { status: 'ready', courses: data.courses });
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const locale = i18n.resolvedLanguage ?? 'en-US';
  const courses = state.status === 'ready' ? state.courses : null;
  const groups = useMemo(() => (courses === null ? [] : buildHubGroups(courses)), [courses]);
  const primaryGameId = useMemo(() => pickPrimaryGameId(groups), [groups]);
  const countFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  return (
    <div>
      <header>
        <h1 className="lf-display-lg text-content">{t('games.hub.title')}</h1>
        <p className="lf-body mt-2 max-w-2xl text-content-muted">{t('games.hub.subtitle')}</p>
      </header>

      <section className="mt-8" aria-busy={state.status === 'loading'}>
        {state.status === 'loading' ? <LoadingOverlay label={t('games.states.loading')} /> : null}

        {state.status === 'error' ? <ErrorBanner code={state.code} /> : null}

        {/* Empty ONLY when the learner genuinely has no games. A hub where games
            exist but every one is locked is NOT empty — it renders the full
            locked grid, which is the whole "learn first, then play" message. */}
        {state.status === 'ready' && groups.length === 0 ? (
          <Card hero className="flex flex-col items-center gap-4 text-center">
            <CharacterActor character="dina" emotion="happy" action="idle" size="lg" />
            <h2 className="lf-title text-content">{t('games.hub.emptyTitle')}</h2>
            <p className="lf-body max-w-md text-content-muted">{t('games.hub.emptyBody')}</p>
          </Card>
        ) : null}

        {groups.length > 0 ? (
          <div className="flex flex-col gap-10">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`games-group-${group.key}`}>
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="lf-caption text-content-muted">{localizedText(group.courseTitle, locale, group.courseSlug)}</p>
                    <h2 id={`games-group-${group.key}`} className="lf-headline text-content">
                      {localizedText(group.adventureTitle, locale, group.adventureSlug)}
                    </h2>
                  </div>
                  <span className="lf-caption lf-number shrink-0 text-content-muted">
                    {countFormatter.format(group.cards.length)}
                  </span>
                </div>

                {/* DESIGN §Layout → Grid Systems, Card grid: 1 / 2 / 3 columns
                    with gap-4 at EVERY breakpoint. A short last row stays short. */}
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {group.cards.map((card) =>
                    card.game.state === 'locked' ? (
                      <LockedGameCard key={card.game.id} card={card} locale={locale} />
                    ) : (
                      <GameCard
                        key={card.game.id}
                        card={card}
                        primary={card.game.id === primaryGameId}
                        locale={locale}
                      />
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default GamesHubPage;

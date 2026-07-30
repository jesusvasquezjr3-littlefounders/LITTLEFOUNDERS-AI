import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Card, Icon, LoadingOverlay } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { MECHANIC_META, isMechanicId } from '@/game-engine/registry';
import { TerritoryProgressStrip, TerritoryView } from '@/routes/app/learn/TerritoryPage';
import { localizedText, type CourseTree, type Json } from '@/routes/app/learn/types';

/*
 * /family/:kidId/territory — a kid's territory through the parent's eyes:
 * the SAME TerritoryView the kid sees (one renderer, zero drift), fed by
 * Core's guardian-guarded family endpoint, plus a stats strip. Wording
 * discipline: territory still to explore, never deficiency; kids are never
 * ranked against each other (one kid per page, by design).
 *
 * Games (GAME_ENGINE.md §7) are the second category of kid activity, so the
 * same page carries them: parent visibility into what a child actually DOES
 * here is a product invariant (§1.9), and a dashboard that reported only
 * lessons once games shipped would silently under-report half of it.
 */

interface KidStats {
  xpPoints: number;
  lessonsCompleted: number;
  streakDays: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

/** Course-scoped game rollup — Core's `foldGameProgress` output (backend/src/routes/family.ts). */
interface GameTotals {
  gamesPlayed: number;
  gamesPassed: number;
  totalPlays: number;
  /** A COMPONENT of stats.xpPoints, never an addition to it — never sum the two. */
  xpEarned: number;
  lastPlayedAt: string | null;
}

interface GameItem {
  gameId: string;
  topicId: string;
  slug: string;
  title: Json;
  mechanic: string;
  tier: number;
  position: number;
  xpMax: number;
  estimatedMinutes: number;
  bestScore: number;
  passed: boolean;
  plays: number;
  xpEarned: number;
  lastPlayedAt: string | null;
}

interface TerritoryPayload {
  tree: CourseTree;
  /*
   * Optional on the WIRE, not in the contract: Core always sends it, but the
   * SPA and Core deploy independently, so an older Core simply means "games
   * unknown" — the section hides rather than rendering a fabricated zero.
   */
  games?: { totals: GameTotals; items: GameItem[] };
  stats: KidStats | null;
}

/** Locale-aware short date, or null when the timestamp is absent/unparseable. */
function formatDay(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(ms));
}

type LoadState = { status: 'loading' } | { status: 'error'; code: string } | { status: 'ready'; payload: TerritoryPayload };

/** v1 platform has one published course; first-in-list keeps this correct when more land. */
async function firstCourseSlug(token: string): Promise<string | null> {
  const { data, error } = await api<{ courses: { slug: string }[] }>('/learn/courses', { token });
  if (error || data.courses.length === 0) return null;
  return data.courses[0]?.slug ?? null;
}

/** One game row: what it is, how far they got, and what it is worth. */
function GameRow({ item, locale }: { item: GameItem; locale: string }) {
  const { t } = useTranslation();
  const meta = isMechanicId(item.mechanic) ? MECHANIC_META[item.mechanic] : null;
  const played = item.plays > 0;

  return (
    <li className="flex min-h-14 items-center gap-3 px-4 py-3">
      <Icon
        name={meta?.icon ?? 'stadia_controller'}
        className={`shrink-0 text-[22px] ${item.passed ? 'text-success-strong' : 'text-content-faint'}`}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="lf-label block truncate text-content">{localizedText(item.title, locale)}</span>
        <span className="lf-caption block truncate text-content-faint">
          {meta ? t(meta.titleKey) : t('family.games.row.game')}
          {played ? ` · ${t('family.games.row.plays', { count: item.plays })}` : ''}
        </span>
      </span>
      {played ? (
        <span className="lf-caption shrink-0 rounded-full bg-primary-soft px-2.5 py-0.5 font-bold text-primary">
          {t('family.games.row.best', { score: item.bestScore })}
        </span>
      ) : (
        <span className="lf-caption shrink-0 text-content-faint">{t('family.games.row.notYet')}</span>
      )}
    </li>
  );
}

/**
 * The parent-facing games strip. Same card + stat idioms as the lesson stats
 * above it; wording stays non-judgmental, exactly like the territory map — a
 * game not played yet is territory left to explore, never a deficiency.
 */
function GamesSection({ games, locale }: { games: { totals: GameTotals; items: GameItem[] }; locale: string }) {
  const { t } = useTranslation();
  const { totals, items } = games;
  const nf = new Intl.NumberFormat(locale);
  const lastPlayed = formatDay(totals.lastPlayedAt, locale);

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="lf-title text-content">{t('family.games.title')}</h2>
        <p className="lf-body text-content-muted">{t('family.games.subtitle')}</p>
      </div>

      {totals.totalPlays === 0 ? (
        /*
         * Nothing played yet is an INVITATION, not a scoreboard of zeros: a row
         * of 0s reads as a verdict on the child, which is exactly the wording
         * this dashboard refuses. The games still show below, waiting.
         */
        <Card className="flex flex-col items-center gap-2 p-6 text-center">
          <Icon name="stadia_controller" className="text-[32px] text-content-faint" aria-hidden />
          <h3 className="lf-label text-content">{t('family.games.emptyTitle')}</h3>
          <p className="lf-body max-w-md text-content-muted">{t('family.games.emptyBody')}</p>
        </Card>
      ) : (
        /* Stat row grid (/DESIGN.md §Layout → Grid Systems: 2 / 3 / 6, gap-4 at every breakpoint). */
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card className="p-4">
            <p className="lf-caption text-content-faint">{t('family.games.stats.played')}</p>
            <p className="lf-title lf-number mt-1 text-content">{nf.format(totals.gamesPlayed)}</p>
          </Card>
          <Card className="p-4">
            <p className="lf-caption text-content-faint">{t('family.games.stats.cleared')}</p>
            <p className="lf-title lf-number mt-1 text-success-strong">{nf.format(totals.gamesPassed)}</p>
          </Card>
          <Card className="p-4">
            <p className="lf-caption text-content-faint">{t('family.games.stats.xp')}</p>
            <p className="lf-title lf-number mt-1 text-primary">{nf.format(totals.xpEarned)}</p>
          </Card>
          <Card className="p-4">
            <p className="lf-caption text-content-faint">{t('family.games.stats.lastPlayed')}</p>
            <p className="lf-label mt-1 text-content">{lastPlayed ?? t('family.games.stats.notYet')}</p>
          </Card>
        </div>
      )}

      {/* List rows grid (/DESIGN.md §Layout → Grid Systems): one resting card, single column. */}
      <Card className="p-0">
        <ul className="divide-y divide-outline/50">
          {items.map((item) => (
            <GameRow key={item.gameId} item={item} locale={locale} />
          ))}
        </ul>
      </Card>
    </section>
  );
}

export function KidTerritoryPage() {
  const { t, i18n } = useTranslation();
  const { kidId = '' } = useParams();
  const { getToken } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const locale = i18n.resolvedLanguage ?? 'en-US';

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      const slug = await firstCourseSlug(token);
      if (cancelled) return;
      if (!slug) {
        setState({ status: 'error', code: 'NOT_FOUND' });
        return;
      }
      const { data, error } = await api<TerritoryPayload>(`/family/kids/${kidId}/courses/${slug}/territory`, { token });
      if (cancelled) return;
      setState(error ? { status: 'error', code: error.code } : { status: 'ready', payload: data });
    })();
    return () => {
      cancelled = true;
    };
  }, [kidId, getToken]);

  if (state.status === 'loading') return <LoadingOverlay label={t('family.territoryLoading')} />;
  if (state.status === 'error') return <ErrorBanner code={state.code} />;

  // No games in this course at all (or an older Core that does not send them)
  // → no section. An empty rollup with nothing to play is not a story about
  // the child, so it is not told.
  const { tree, stats, games } = state.payload;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/family" className="lf-caption flex items-center gap-1 font-bold text-primary hover:underline">
            <Icon name="arrow_back" className="text-[16px]" aria-hidden /> {t('family.back')}
          </Link>
          <h1 className="lf-display mt-1 text-content">{t('family.territoryTitle')}</h1>
          <p className="lf-body text-content-muted">{t('family.territorySubtitle')}</p>
        </div>
        <TerritoryProgressStrip tree={tree} />
      </header>

      {stats ? (
        /* Stat row grid (/DESIGN.md §Layout → Grid Systems: 2 / 3 / 6, gap-4 at every breakpoint). */
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card className="p-4">
            <p className="lf-caption text-content-faint">{t('family.stats.xp')}</p>
            <p className="lf-title lf-number mt-1 text-primary">{stats.xpPoints}</p>
          </Card>
          <Card className="p-4">
            <p className="lf-caption text-content-faint">{t('family.stats.lessons')}</p>
            <p className="lf-title lf-number mt-1 text-content">{stats.lessonsCompleted}</p>
          </Card>
          <Card className="p-4">
            <p className="lf-caption text-content-faint">{t('family.stats.streak')}</p>
            <p className="lf-title lf-number mt-1 text-warning-strong">{stats.streakDays}</p>
          </Card>
          <Card className="p-4">
            <p className="lf-caption text-content-faint">{t('family.stats.longestStreak')}</p>
            <p className="lf-title lf-number mt-1 text-success-strong">{stats.longestStreak}</p>
          </Card>
        </div>
      ) : null}

      {games && games.items.length > 0 ? <GamesSection games={games} locale={locale} /> : null}

      <TerritoryView tree={tree} locale={locale} chipLinkTo="/family" />
    </div>
  );
}

export default KidTerritoryPage;

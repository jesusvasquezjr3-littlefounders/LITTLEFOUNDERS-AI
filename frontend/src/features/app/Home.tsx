import { useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AppContext } from '@/features/app/AppLayout';
import { Deck, type DeckCard } from '@/features/app/Deck';
import { greetingFor } from '@/features/app/greeting';
import { HomeCover, type DayTile } from '@/features/app/HomeCover';
import type { Destination, Home as HomeRead } from '@/features/app/homeData';
import { Loop } from '@/features/landing/LoopVideo';
import { SavedNotice } from '@/features/onboarding/SavedNotice';
import { useAppCopy, useLocale } from '@/i18n/useCopy';

/*
 * The home of the signed-in person (D-051): the pile of the day, with the stage beside it.
 *
 * The pile leads. Its cover is the board of the day (HomeCover.tsx), flat colored tiles with no
 * character on them; under it lies one card for each of the person's places, and playing a card goes
 * there. Over the stage, a greeting for the hour and
 * a line under it, from a collection in the locale files (greeting.ts). The stage is the composition
 * of the day (D-052): the four mentors doing something, a different one each day, chosen by Core. It
 * is a decoration and says nothing a person needs.
 *
 * `values` is what the features have for the person today, one for each tile of the board. No
 * feature exists yet, so the page passes none and each tile says "soon"; the development page
 * (DevHome.tsx) passes made-up ones to show the board full.
 */
// each card's paper (lf-theme.css): pale, so a card is light on the light page and on the dark one
const TINT: Record<Destination, string> = { home: 'var(--lf-card-home)', learn: 'var(--lf-card-learn)', mentor: 'var(--lf-card-mentor)', wallet: 'var(--lf-card-wallet)', tasks: 'var(--lf-card-tasks)', family: 'var(--lf-card-family)' };

/** The name of a scene in the person's language; empty for one this build does not know yet. */
const titleOf = (scene: string, titles: Record<string, string>): string => (Object.hasOwn(titles, scene) ? titles[scene] ?? '' : '');

export type TileName = 'lesson' | 'tasks' | 'seeds' | 'streak';

export type DayValues = Partial<Record<TileName, { label?: string; value: string; progress?: number }>>;

const TILES: { name: TileName; icon: DayTile['icon']; color: string }[] = [
  { name: 'lesson', icon: 'learn', color: 'var(--lf-tile-learn)' },
  { name: 'tasks', icon: 'tasks', color: 'var(--lf-tile-tasks)' },
  { name: 'seeds', icon: 'wallet', color: 'var(--lf-tile-seeds)' },
  { name: 'streak', icon: 'streak', color: 'var(--lf-tile-streak)' },
];

/** The home, given what Core said. `home` is null while it is on its way. */
export function HomeView({ home, values }: { home: HomeRead | null; values: DayValues }) {
  const copy = useAppCopy();
  const locale = useLocale();
  const navigate = useNavigate();
  const name = home?.displayName ?? '';
  const composition = home?.composition ?? null;
  const places = useMemo(() => (home?.destinations ?? []).filter((destination) => destination !== 'home'), [home]);
  const now = useMemo(() => new Date(), []);
  const words = useMemo(() => greetingFor({ greetings: copy.home.greetings, subtitles: copy.home.subtitles, any: copy.home.subtitles.any, name, day: composition?.day ?? '', hour: now.getHours() }), [copy, name, composition, now]);
  const [weekday, date] = useMemo(() => [new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(now), new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(now)], [locale, now]);

  const cards = useMemo<DeckCard[]>(() => (composition ? [
    {
      id: 'cover', name: copy.nav.home, suit: 'home', tint: TINT.home, isBoard: true,
      face: (isTop) => <HomeCover isTop={isTop} weekday={weekday} date={date}
        tiles={TILES.map(({ name: tile, icon, color }): DayTile => ({ icon, color, label: values[tile]?.label ?? copy.home.cover.tiles[tile], value: values[tile]?.value, progress: values[tile]?.progress }))}
        scene={{ title: titleOf(composition.name, copy.scenes), number: composition.number, total: composition.total }}
        words={{ today: copy.home.cover.today, scene: copy.home.cover.scene.replace('{n}', String(composition.number)).replace('{total}', String(composition.total)), soon: copy.home.cover.soon }} />,
    },
    ...places.map((place): DeckCard => ({
      id: place, name: copy.nav[place], suit: place, tint: TINT[place], onPlay: () => { void navigate(`/${place}`); },
      face: (isTop) => <span className="grid justify-items-center gap-[5cqw] text-center">
        <AppIcon name={place} size="50cqw" alive={isTop} />
        <span className="text-[11cqw] font-extrabold leading-none tracking-[-0.02em]">{copy.nav[place]}</span>
      </span>,
    })),
  ] : []), [copy, places, navigate, weekday, date, composition, values]);

  return <div className="grid items-center gap-x-8 gap-y-4 sm:gap-y-6 lg:min-h-[calc(100dvh-140px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
    {/* the same shapes while it loads, so nothing moves when the words, the cards and the composition arrive */}
    <div className="order-2 grid justify-items-center lg:order-1">
      {home ? <Deck cards={cards} label={copy.home.deck} hint={copy.home.hint} position={(index, total, card) => copy.home.position.replace('{name}', card).replace('{n}', String(index)).replace('{total}', String(total))} />
        : <Skeleton variant="card" className="aspect-[5/7] w-[min(320px,66vw)]" />}
    </div>

    <div className="order-1 grid justify-items-center gap-2 sm:gap-4 lg:order-2 lg:justify-items-start">
      {home ? <div className="grid gap-1.5 text-center lg:text-start">
        <h1 className="m-0 text-balance text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[40px]">{words.greeting}</h1>
        <p className="m-0 text-balance text-[16px] text-[color:var(--v-text-2)] sm:text-[18px]">{words.subtitle}</p>
      </div> : <div className="grid justify-items-center gap-2 lg:justify-items-start"><Skeleton className="h-10 w-64" /><Skeleton variant="line" className="w-56" /></div>}
      {/* a guest is told, in one small line, that what they chose lives on this device (guest.ts) */}
      <SavedNotice />
      <div className="aspect-[3/2] w-full max-w-[176px] sm:max-w-[400px] lg:max-w-[560px]">
        {composition ? <Loop src={`/stage/loops/${composition.name}`} width={1200} height={800} className="h-auto w-full" priority /> : <Skeleton variant="card" className="size-full" />}
      </div>
    </div>
  </div>;
}

// no feature has anything for the day yet
const NO_VALUES: DayValues = {};

export function Home() {
  const copy = useAppCopy();
  const { home } = useOutletContext<AppContext>();

  if (home.status === 'failed') {
    return <div role="alert" className="mx-auto grid max-w-[520px] justify-items-center gap-4 py-16 text-center">
      <p className="m-0 text-[20px] font-extrabold">{copy.home.failed}</p>
      <Button type="button" variant="outline" onClick={home.retry}>{copy.home.retry}</Button>
    </div>;
  }

  return <HomeView home={home.status === 'ready' ? home.home : null} values={NO_VALUES} />;
}

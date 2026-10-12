import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/icons/rest';

/*
 * The cover of the pile of the home: the board of the day, the first thing a person reads. It is a
 * picture of what today holds, made of flat colored tiles inside the card, with no character on it:
 *
 *   - the day;
 *   - the scene on the stage today, by name, and how far the person is through the round of scenes
 *     (they collect one a day; Core counts);
 *   - one tile for each thing a feature has for them today (a lesson to go on with, tasks left, Seeds,
 *     a streak). A tile belongs to its feature: until the feature exists its tile carries no `value`
 *     and says so. Nothing here invents a number.
 *
 * Sizes are in `cqw`, hundredths of the card's width, so the board is the same picture on a card of
 * any size. The tiles share the height of the card between them, however many there are.
 */
export type DayTile = {
  icon: IconName;
  /** The tile's color (lf-theme.css, `--lf-tile-*`). */
  color: string;
  label: string;
  /** Missing while the feature has nothing to say. */
  value?: string;
  /** 0 to 1, when the thing has a measure. */
  progress?: number;
};

const LABEL = 'text-[3.9cqw] font-bold leading-[1.15] opacity-75';

const TILE = 'grid min-h-0 content-center rounded-[6cqw] px-[3.6cqw] py-[2.4cqw]';

/** How far through the round of scenes, as a ring with the number inside. */
function Round({ number, total, label }: { number: number; total: number; label: string }) {
  const turn = 2 * Math.PI * 16;

  return <span role="img" aria-label={label} className="relative grid aspect-square w-[16cqw] shrink-0 place-items-center">
    <svg viewBox="0 0 40 40" className="absolute inset-0 size-full -rotate-90" aria-hidden>
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="5" />
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(number / total) * turn} ${turn}`} />
    </svg>
    <span className="text-[5.8cqw] font-extrabold leading-none tabular-nums">{number}</span>
  </span>;
}

export function HomeCover({ weekday, date, scene, tiles, isTop, words }: {
  weekday: string;
  date: string;
  scene: { title: string; number: number; total: number };
  tiles: DayTile[];
  isTop: boolean;
  words: { today: string; scene: string; soon: string };
}) {
  return <span className="flex size-full flex-col gap-[2.6cqw] text-start">
    <span className="flex items-baseline justify-between gap-[2cqw] px-[1cqw]">
      <span className="text-[7.4cqw] font-extrabold leading-none tracking-[-0.02em]">{date}</span>
      <span className="text-[3.9cqw] font-bold uppercase leading-none tracking-[0.08em] opacity-60">{weekday}</span>
    </span>

    <span className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-[2.2cqw]">
      {/* the scene of the day, by name, and the round */}
      <span className={`${TILE} col-span-2 grid-cols-[minmax(0,1fr)_auto] items-center gap-[2cqw] bg-[var(--lf-tile-scene)]`}>
        <span className="grid min-w-0 gap-[1.2cqw]">
          <span className={LABEL}>{words.today}</span>
          <span className="text-balance text-[6.4cqw] font-extrabold leading-[1.05] tracking-[-0.02em]">{scene.title}</span>
        </span>
        <Round number={scene.number} total={scene.total} label={words.scene} />
      </span>

      {/* what each feature has for the person today; an odd one out takes the whole row */}
      {tiles.map((tile, index) => <span key={tile.label} className={`${TILE} gap-[1.4cqw] ${tiles.length % 2 === 1 && index === 0 ? 'col-span-2' : ''}`} style={{ background: tile.color }}>
        <span className="flex items-center gap-[2cqw]">
          <AppIcon name={tile.icon} size="12cqw" alive={isTop} />
          {tile.value === undefined
            ? <span className="rounded-full bg-white/60 px-[2.4cqw] py-[1.1cqw] text-[3.4cqw] font-extrabold leading-none">{words.soon}</span>
            : <span className="text-[7cqw] font-extrabold leading-none tracking-[-0.02em] tabular-nums">{tile.value}</span>}
        </span>
        <span className={LABEL}>{tile.label}</span>
        {tile.progress === undefined ? null : <span className="h-[1.7cqw] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--lf-card-ink)_14%,transparent)]">
          <span className="block h-full rounded-full bg-[var(--lf-card-ink)]" style={{ width: `${Math.round(tile.progress * 100)}%` }} />
        </span>}
      </span>)}
    </span>
  </span>;
}

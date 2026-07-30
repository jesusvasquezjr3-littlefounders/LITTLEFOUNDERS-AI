import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Badge, Card, Icon, IconChip } from '@/components/ui';
import { MECHANIC_META, isMechanicId } from '@/game-engine/registry';
import { cn } from '@/lib/utils';
import { localizedText } from '@/routes/app/learn/types';
import type { CatalogGame, CatalogTopic } from './api';

/*
 * The games-hub poster card — /DESIGN.md §Screen Recipes → Games hub.
 *
 * Anatomy, in the recipe's order: ① 16:9 media area clipped to the card radius
 * ② `lf-title` title clamped to 2 lines ③ the concept chip (the topic this game
 * reinforces — the reason the card exists, never omitted) ④ the progress chip
 * ⑤ the `lf-caption` meta row ⑥ exactly one action slot.
 *
 * CTA DENSITY (Action Color Contract): papaya is spent PER VIEW, not per card.
 * The hub hands `primary` to exactly one card — the next/resume game — and every
 * other ready card gets the outlined secondary pill. A papaya pill on twelve
 * cards would be twelve "one main CTA per view"s in one view.
 */

/** Whichever mechanic id a document was authored with, the card must render — a
 *  mechanic this build has never heard of is forward-compatible content, not an
 *  error (GAME_ENGINE.md §7). */
const UNKNOWN_MECHANIC_ICON = 'stadia_controller';

/*
 * The action slot is a SPAN, not a <Button>. The recipe makes the whole poster
 * card ONE link, and an interactive control nested inside an <a> is invalid
 * markup and a keyboard trap. It therefore borrows Button's exact pill geometry
 * and Action-Color-Contract fills (components/ui/Button.tsx) rather than
 * inventing a look, and is aria-hidden so the link's accessible name stays the
 * game's title instead of becoming "Play Play".
 */
const CTA_BASE =
  'lf-label inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-6 py-3';
const CTA_PRIMARY = 'bg-accent text-on-accent';
const CTA_SECONDARY = 'border border-outline bg-surface/60 text-content';

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export interface HubCard {
  game: CatalogGame;
  topic: CatalogTopic;
  /** Where "go learn it first" points for a locked card. */
  courseSlug: string;
}

interface MediaProps {
  icon: string;
  locked: boolean;
}

/**
 * ① The media area. Prism's `game_background` raster belongs here, and the
 * catalog does not carry one yet — so this renders the recipe's declared
 * fallback (the mechanic's IconChip on an `inverse` fill) rather than a broken
 * image or a blank rectangle. `-mx-6 -mt-6` bleeds it out of the Card's own
 * padding; the Card's `overflow-hidden` clips it to the card radius.
 */
function CardMedia({ icon, locked }: MediaProps) {
  return (
    <div
      className={cn(
        '-mx-6 -mt-6 mb-4 flex aspect-video items-center justify-center',
        locked ? 'bg-surface-sunken' : 'bg-inverse',
      )}
    >
      {locked ? (
        <Icon name="lock" className="text-[32px] text-content-faint" />
      ) : (
        <IconChip size="lg">
          <Icon name={icon} />
        </IconChip>
      )}
    </div>
  );
}

interface MetaRowProps {
  mechanicIcon: string;
  mechanicName: string | null;
  minutes: number;
  muted: boolean;
}

/** ⑤ mechanic icon + name + estimated minutes. */
function CardMetaRow({ mechanicIcon, mechanicName, minutes, muted }: MetaRowProps) {
  const { t } = useTranslation();
  return (
    <p className={cn('lf-caption mt-2 flex flex-wrap items-center gap-1.5', muted ? 'text-content-faint' : 'text-content-muted')}>
      <Icon name={mechanicIcon} className="!text-[16px]" />
      {mechanicName === null ? null : <span>{mechanicName}</span>}
      {mechanicName === null ? null : <span aria-hidden="true">·</span>}
      <span className="lf-number">{t('learn.minutes', { count: minutes })}</span>
    </p>
  );
}

interface ProgressChipProps {
  game: CatalogGame;
}

/**
 * ④ The progress chip: `success-soft` once passed, a resting chip while played
 * but not passed, and NOTHING when never played — absence is the signal, and a
 * rendered `0` would be noise.
 */
function ProgressChip({ game }: ProgressChipProps) {
  const { t } = useTranslation();
  if (game.plays === 0) return null;
  const label = <span className="lf-number">{t('games.hub.bestScore', { score: game.best_score })}</span>;
  if (game.passed) {
    return (
      <Badge className="gap-1 bg-success-soft text-success">
        <Icon name="check" className="!text-[14px]" />
        {label}
      </Badge>
    );
  }
  return <Badge>{label}</Badge>;
}

export interface GameCardProps {
  card: HubCard;
  /** The single papaya card of the view (the next/resume game). */
  primary: boolean;
  locale: string;
}

export function GameCard({ card, primary, locale }: GameCardProps) {
  const { t } = useTranslation();
  const { game, topic } = card;
  const meta = isMechanicId(game.mechanic) ? MECHANIC_META[game.mechanic] : null;

  return (
    <Link
      to={`/games/${game.slug}`}
      // The hub knows the id; the route falls back to a slug lookup when this is
      // absent (a refresh or a pasted link).
      state={{ gameId: game.id }}
      className={cn('rounded-lg', FOCUS_RING)}
    >
      <Card interactive className="flex h-full flex-col overflow-hidden">
        <CardMedia icon={meta?.icon ?? UNKNOWN_MECHANIC_ICON} locked={false} />

        <div className="flex flex-wrap items-center gap-2">
          {/* ③ the concept chip — the topic this game reinforces. */}
          <Badge className="bg-primary-soft text-primary">{localizedText(topic.title, locale, topic.slug)}</Badge>
          <ProgressChip game={game} />
        </div>

        <h3 className="lf-title mt-3 line-clamp-2 text-content">{localizedText(game.title, locale, game.slug)}</h3>

        <CardMetaRow
          mechanicIcon={meta?.icon ?? UNKNOWN_MECHANIC_ICON}
          mechanicName={meta === null ? null : t(meta.titleKey)}
          minutes={game.estimated_minutes}
          muted={false}
        />

        <div className="mt-auto pt-5">
          <span aria-hidden="true" className={cn(CTA_BASE, primary ? CTA_PRIMARY : CTA_SECONDARY)}>
            {t(game.passed ? 'games.hub.replay' : 'games.hub.play')}
            <Icon name="play_arrow" className="!text-[18px]" />
          </span>
        </div>
      </Card>
    </Link>
  );
}

export interface LockedGameCardProps {
  card: HubCard;
  locale: string;
}

/**
 * Locked — NEVER hidden. A game unlocks when its bound topic has a passed lesson,
 * so a locked card is the platform's clearest "learn first, then play" signal;
 * hiding it would hide the reason to go learn.
 *
 * Activating it does not start a game: it reveals the unlock reason NAMING the
 * topic and a link into that topic's course map. The reason is a real revealed
 * block rather than a tooltip, because mobile has no hover. The card is a
 * `<button>` and the revealed link is a SIBLING of it — never a control inside a
 * control.
 */
export function LockedGameCard({ card, locale }: LockedGameCardProps) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const { game, topic } = card;
  const meta = isMechanicId(game.mechanic) ? MECHANIC_META[game.mechanic] : null;
  const topicTitle = localizedText(topic.title, locale, topic.slug);

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      {/* No `interactive`: a locked card does not lift on hover. */}
      <button
        type="button"
        onClick={() => setRevealed((open) => !open)}
        aria-expanded={revealed}
        className={cn('flex flex-1 flex-col rounded-md text-left', FOCUS_RING)}
      >
        <CardMedia icon={meta?.icon ?? UNKNOWN_MECHANIC_ICON} locked />

        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-primary-soft text-primary">{topicTitle}</Badge>
        </div>

        <h3 className="lf-title mt-3 line-clamp-2 text-content-faint">{localizedText(game.title, locale, game.slug)}</h3>
        <p className="lf-caption mt-2 text-content-faint">{t('games.hub.locked.body')}</p>

        <CardMetaRow
          mechanicIcon={meta?.icon ?? UNKNOWN_MECHANIC_ICON}
          mechanicName={meta === null ? null : t(meta.titleKey)}
          minutes={game.estimated_minutes}
          muted
        />

        <div className="mt-auto pt-5">
          {/* ⑥ the lock chip stands in for the action pill. */}
          <Badge className="gap-1">
            <Icon name="lock" className="!text-[14px]" />
            {t('games.hub.locked.badge')}
          </Badge>
        </div>
      </button>

      {revealed ? (
        <div className="mt-4 border-t border-outline/70 pt-4">
          <p className="lf-caption font-bold text-content">{topicTitle}</p>
          <p className="lf-body mt-1 text-content-muted">{t('games.hub.locked.explain')}</p>
          <Link
            to={`/learn/${card.courseSlug}`}
            className={cn(
              'lf-label mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline bg-surface/60 px-5 py-3 text-primary',
              FOCUS_RING,
            )}
          >
            <Icon name="school" className="!text-[18px]" />
            {t('learn.goToMyLesson')}
          </Link>
        </div>
      ) : null}
    </Card>
  );
}

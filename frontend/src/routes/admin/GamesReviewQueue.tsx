import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Icon, ProgressBar } from '@/components/ui';
import { MECHANIC_IDS } from '@/game-engine/core/types';
import type { MechanicId } from '@/game-engine/core/types';
import { MECHANIC_META } from '@/game-engine/registry';
import { cn } from '@/lib/utils';
import { AdminAction, AdminEmpty, StatusBadge, Unavailable, useAdminMutation, type Loadable } from './adminShared';

/*
 * Games review queue — the HUMAN PUBLISH GATE for the Arcade pipeline
 * (GAME_ENGINE.md §9). Generated games land as `status='review'` and NEVER
 * auto-publish: nothing here reaches a child until a person promotes it (§1.9).
 *
 * So this is deliberately not a list of slugs with a Publish button. A reviewer
 * gets what they need to actually decide — the mechanic, the concept the game is
 * bound to (course → topic), the age tier, the XP it can award, and the judge's
 * five rubric dimensions — plus a Play action that mounts the REAL GamePlayer on
 * the real document. Approving a game you have not played is the failure mode
 * this tab exists to prevent.
 *
 * The player is lazily imported: browsing the console must not pull the game
 * engine, its mechanic chunks or the character rig into the admin bundle.
 */

const GameReviewPreview = lazy(() => import('./GameReviewPreview'));

/** Mirrors the Core mapper for `GET /api/v1/admin/games` (rubric shape matches
 *  `generation_slots.rubric`, exactly as SlotDetailModal reads it). */
export interface AdminReviewGame {
  id: string;
  slug: string;
  title: string;
  mechanic: string;
  tier: number;
  xpMax: number;
  estimatedMinutes: number;
  status: string;
  courseTitle: string | null;
  courseSlug: string | null;
  topicTitle: string | null;
  topicPath: string | null;
  locales: string[];
  rubric: Record<string, number | string> | null;
}

/** The Arcade judge's rubric (GAME_ENGINE.md §9). Rendered in this order; a
 *  dimension the judge did not emit is simply absent, never faked as a zero. */
const GAME_RUBRIC_DIMS = ['concept_fit', 'fun_agency', 'clarity', 'kid_safety', 'difficulty_fairness'] as const;

function isMechanicId(value: string): value is MechanicId {
  return (MECHANIC_IDS as readonly string[]).includes(value);
}

export function GamesReviewQueue({
  data,
  reload,
}: {
  data: Loadable<{ games: AdminReviewGame[] }>;
  reload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const mutate = useAdminMutation();
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdminReviewGame | null>(null);
  /* Publishing is the moment content becomes visible to children, and archiving
   * pulls it back out of the arcade. Both get a confirm step that NAMES the game
   * and states the consequence — a misclick at this gate is the one that ships. */
  const [confirming, setConfirming] = useState<{ game: AdminReviewGame; status: 'published' | 'archived' } | null>(null);

  async function setStatus(id: string, status: 'published' | 'archived') {
    setConfirming(null);
    setBusy(id);
    await mutate(`/admin/games/${id}/status`, { status });
    await reload();
    setBusy(null);
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="lf-title">{t('admin.games.heading')}</h2>
      <div className="flex items-start gap-2.5 rounded-lg bg-primary-soft px-4 py-3 text-primary">
        <Icon name="shield" className="mt-0.5 shrink-0" />
        <p className="lf-caption">{t('admin.games.note')}</p>
      </div>

      {data.state === 'error' ? (
        <Unavailable code={data.code} />
      ) : data.state === 'ready' ? (
        data.data.games.length === 0 ? (
          <AdminEmpty icon="stadia_controller" message={t('admin.games.empty')} />
        ) : (
          // DESIGN.md §Layout → Grid Systems: Card grid (1 / 2 / 3), gap-4 at
          // every breakpoint — no breakpoint-specific gaps.
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.data.games.map((game) => (
              <li key={game.id} className="flex">
                <GameReviewCard
                  game={game}
                  busy={busy === game.id}
                  onPlay={() => setPreview(game)}
                  onPublish={() => setConfirming({ game, status: 'published' })}
                  onArchive={() => setConfirming({ game, status: 'archived' })}
                />
              </li>
            ))}
          </ul>
        )
      ) : (
        <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />
      )}

      {preview && (
        <Suspense fallback={null}>
          <GameReviewPreview
            gameId={preview.id}
            title={preview.title}
            onClose={() => setPreview(null)}
          />
        </Suspense>
      )}

      {confirming && (
        <ConfirmDialog
          scope={confirming.status === 'published' ? 'confirmPublish' : 'confirmArchive'}
          gameTitle={confirming.game.title}
          tone={confirming.status === 'published' ? 'success' : 'danger'}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void setStatus(confirming.game.id, confirming.status)}
        />
      )}
    </section>
  );
}

function GameReviewCard({
  game,
  busy,
  onPlay,
  onPublish,
  onArchive,
}: {
  game: AdminReviewGame;
  busy: boolean;
  onPlay: () => void;
  onPublish: () => void;
  onArchive: () => void;
}) {
  const { t } = useTranslation();
  const mechanic = isMechanicId(game.mechanic) ? game.mechanic : null;
  const meta = mechanic ? MECHANIC_META[mechanic] : null;

  return (
    <Card className="flex w-full flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="lf-label truncate text-content">{game.title}</p>
          <p className="lf-number lf-caption truncate text-content-muted">{game.slug}</p>
        </div>
        <StatusBadge status={game.status} />
      </div>

      {/* What this game IS: mechanic + age tier + reward ceiling. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className="bg-surface-sunken text-content-muted">
          <Icon name={meta?.icon ?? 'stadia_controller'} className="mr-1 !text-[14px]" />
          {meta ? t(meta.titleKey) : t('admin.games.unknownMechanic')}
        </Badge>
        <Badge className="bg-surface-sunken text-content-muted">{t('admin.games.tier', { tier: game.tier })}</Badge>
        <Badge className="bg-surface-sunken text-content-muted">{t('admin.games.xpMax', { xp: game.xpMax })}</Badge>
        <Badge className="bg-surface-sunken text-content-muted">
          {t('admin.games.minutes', { minutes: game.estimatedMinutes })}
        </Badge>
      </div>

      {/* What it is BOUND to — a game that reinforces the wrong concept is the
          single most likely content defect, so it reads before anything else. */}
      <dl className="flex flex-col gap-1">
        <MetaRow label={t('admin.games.course')} value={game.courseTitle ?? game.courseSlug} />
        <MetaRow label={t('admin.games.topic')} value={game.topicTitle ?? game.topicPath} mono={game.topicTitle === null} />
        <MetaRow label={t('admin.games.locales')} value={game.locales.length > 0 ? game.locales.join(' · ') : null} mono />
      </dl>

      <GameRubric rubric={game.rubric} />

      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        <AdminAction tone="primary" icon="play_arrow" onClick={onPlay}>
          {t('admin.games.play')}
        </AdminAction>
        {game.status !== 'published' && (
          <AdminAction tone="success" icon="publish" onClick={onPublish} disabled={busy}>
            {t('admin.games.publish')}
          </AdminAction>
        )}
        {game.status !== 'archived' && (
          <AdminAction tone="neutral" icon="archive" onClick={onArchive} disabled={busy}>
            {t('admin.games.archive')}
          </AdminAction>
        )}
      </div>
    </Card>
  );
}

function MetaRow({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-[minmax(0,5rem)_minmax(0,1fr)] gap-x-2">
      <dt className="lf-caption truncate text-content-faint">{label}</dt>
      <dd className={cn('lf-caption truncate text-content-muted', mono && value !== null && 'lf-number')}>
        {value ?? t('admin.games.noData')}
      </dd>
    </div>
  );
}

/** The judge's five dimensions, 1–5 each. Absent rubric = say so; a missing
 *  judgement must never render as a passing score. */
function GameRubric({ rubric }: { rubric: Record<string, number | string> | null }) {
  const { t, i18n } = useTranslation();
  const loc = i18n.resolvedLanguage ?? 'en-US';
  const scored = GAME_RUBRIC_DIMS.map((dim) => {
    const value = rubric?.[dim];
    return typeof value === 'number' ? { dim, value } : null;
  }).filter((entry): entry is { dim: (typeof GAME_RUBRIC_DIMS)[number]; value: number } => entry !== null);

  if (scored.length === 0) {
    return <p className="lf-caption text-content-faint">{t('admin.games.rubricEmpty')}</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="lf-caption font-bold text-content-muted">{t('admin.games.rubricTitle')}</p>
      {scored.map(({ dim, value }) => (
        // Label + score on one line, bar underneath: the card is ~340px wide at
        // BOTH 375px and at lg (3-col grid), so a side-by-side bar would be a
        // sliver at every breakpoint rather than at none.
        <div key={dim} className="flex flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="lf-caption truncate text-content-muted">{t(`admin.games.dims.${dim}`)}</span>
            {/* Locale-aware figure, never string-built (§1.8). Out of 5 by the
                rubric's own definition — the bar carries the proportion. */}
            <span className="lf-number lf-caption shrink-0 text-content">{value.toLocaleString(loc)}</span>
          </div>
          <ProgressBar value={(value / 5) * 100} tone={value >= 4 ? 'primary' : 'accent'} label={t(`admin.games.dims.${dim}`)} />
        </div>
      ))}
    </div>
  );
}

/** The publish/archive confirm. Names the game and states the consequence in the
 *  body — a confirm that only says "Are you sure?" trains people to click through. */
function ConfirmDialog({
  scope,
  gameTitle,
  tone,
  onConfirm,
  onCancel,
}: {
  scope: 'confirmPublish' | 'confirmArchive';
  gameTitle: string;
  tone: 'success' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-label={t(`admin.games.${scope}.title`)}
        className="flex w-full max-w-md flex-col gap-3 p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="lf-title text-content">{t(`admin.games.${scope}.title`)}</h3>
        <p className="lf-body-sm text-content-muted">{t(`admin.games.${scope}.body`, { title: gameTitle })}</p>
        <div className="mt-1 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {t(`admin.games.${scope}.cancel`)}
          </Button>
          <Button variant={tone} onClick={onConfirm}>
            {t(`admin.games.${scope}.confirm`)}
          </Button>
        </div>
      </Card>
    </div>,
    document.body,
  );
}

export default GamesReviewQueue;

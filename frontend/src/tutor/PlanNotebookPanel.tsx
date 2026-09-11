import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { TutorWhiteboard } from './TutorWhiteboard';
import {
  getKidNotebook,
  getKidPlan,
  getNotebook,
  getPlan,
  listSessions,
  getTranscript,
  type TutorNotebookEntry,
  type TutorPlan,
} from './tutorApi';
import type { TutorWhiteboardWire } from './types';

/*
 * CLASS V ARTIFACTS (/TUTOR_INSTRUMENTS.md §3.6, migration 0069): the first
 * state a learner keeps ON PURPOSE — the savings plan the tutor and learner
 * build together, the boards the learner explicitly marked "keep this", and
 * a recap of their most recent session. SHARED between the two audiences the
 * catalog names ("for learner and parent"): a `kidUserId` renders the
 * GUARDIAN's view of a specific child (`KidTutorPage.tsx`); its absence
 * renders the LEARNER's own view of themselves (`OfferChips.tsx`, reached
 * from the tutor's own "Mi progreso" chip). Same data shape, same component,
 * different auth — the same "one surface, two callers" pattern
 * `TutorWhiteboard` itself already is between the live conversation and
 * session replay.
 *
 * `plan`/`notebook` reuse `TutorWhiteboard` unmodified, so a plan or a kept
 * board looks here exactly as it looked the moment it was drawn. `recap`
 * needed no new table or route at all — a research finding, not a
 * shortcut: the most recent session's own transcript (already fetched to
 * find its last board) and summary already carry everything "the day's
 * best board" needs, computed here rather than duplicated server-side.
 *
 * HIDDEN ENTIRELY WHEN THERE IS NOTHING TO SHOW, unlike an always-relevant
 * inbox such as the memory-notes panel. All three artifacts here are
 * OPT-IN or simply not-yet-earned (a first conversation has no recap until
 * it ends), and an empty "nothing yet" card on every visit, forever, would
 * be exactly the kind of accumulated clutter this product avoids elsewhere.
 */

interface Recap {
  sessionId: string;
  minutes: number;
  xpAwarded: number;
  bestBoard: TutorWhiteboardWire | null;
}

type Load =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; plan: TutorPlan | null; entries: TutorNotebookEntry[]; recap: Recap | null };

/** Whole minutes, rounded down — "0 min" for a session under a minute reads as more honest than "1 min". */
function minutesBetween(startIso: string, endIso: string | null): number {
  if (!endIso) return 0;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.floor(ms / 60_000));
}

/*
 * MODULE SCOPE ON PURPOSE. Defined inside `PlanNotebookPanel`'s own body, a
 * `const Wrap = (...) => ...` is a NEW component type on every render — not
 * just a new function value, a new IDENTITY React mounts fresh each time,
 * exactly the "state read back out of a shared object" class /AGENTS.md
 * §1.14 already documents (there for a different shared object). Every
 * `TutorWhiteboard` a `Wrap` here is currently hosting plays a mount-time
 * "drop" reveal sound and re-runs its bar-growth animation from its own
 * `useState` initializer — both keyed on THIS component surviving as the
 * same instance. `PlanNotebookPanel`'s own parents (`OfferChips.tsx`
 * especially — mic state, live captions, chip animations) re-render far
 * more often than this panel's own data changes, and each of those
 * re-renders would have replayed the chime on every board on screen, for as
 * long as the sheet stayed open, with no state change of this panel's own
 * to explain why.
 */
function Wrap({ variant, children }: { variant: 'bare' | 'card'; children: ReactNode }) {
  return variant === 'card' ? (
    <Card className="p-4">{children}</Card>
  ) : (
    <div className={cn('flex flex-col gap-4')}>{children}</div>
  );
}

export function PlanNotebookPanel({
  kidUserId,
  token,
  variant = 'bare',
}: {
  kidUserId?: string;
  token: string | null;
  /**
   * `'card'` wraps the same content in the app's own `Card` chrome, for a
   * guardian route (`KidTutorPage.tsx`) that stands beside plain cards.
   * `'bare'` (default) renders content only — the tutor's own "Mi progreso"
   * sheet (`OfferChips.tsx`) already supplies its chrome via `HudPlate`, and
   * double-framing the same content in two nested containers is the
   * "Lumen sheet, glass on glass" arrangement `/DESIGN.md` forbids outright
   * (the same rule `SessionHistory.tsx`'s own header cites for the identical
   * reason).
   */
  variant?: 'bare' | 'card';
}) {
  const { t, i18n } = useTranslation();
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });
    if (!token) return undefined;
    void (async () => {
      const [planResult, notebookResult] = await Promise.all([
        kidUserId ? getKidPlan(token, kidUserId) : getPlan(token),
        kidUserId ? getKidNotebook(token, kidUserId) : getNotebook(token),
      ]);
      if (cancelled) return;
      if (planResult.error || notebookResult.error) {
        setLoad({ status: 'failed' });
        return;
      }

      /*
       * The recap read is best-effort and SEPARATE from the two above: a
       * learner with no sessions yet (or a transient failure reading the
       * one transcript) still has a perfectly good plan/notebook view, and
       * a person who has never used either of THOSE has every reason to
       * still see how their last conversation went. Never fails the whole
       * panel — see `recap: null` below.
       */
      let recap: Recap | null = null;
      if (!kidUserId) {
        const sessions = await listSessions(token);
        const latest = sessions.data?.sessions[0];
        if (!cancelled && latest && latest.endedAt) {
          const transcript = await getTranscript(token, latest.id);
          if (!cancelled && transcript.data) {
            const lastBoard = [...transcript.data.turns].reverse().find((turn) => turn.whiteboard != null);
            recap = {
              sessionId: latest.id,
              minutes: minutesBetween(latest.startedAt, latest.endedAt),
              xpAwarded: latest.xpAwarded,
              bestBoard: lastBoard?.whiteboard ?? null,
            };
          }
        }
      }
      if (cancelled) return;

      setLoad({
        status: 'ready',
        plan: planResult.data?.plan ?? null,
        entries: notebookResult.data?.entries ?? [],
        recap,
      });
    })();
    return () => {
      cancelled = true;
    };
    // Re-fetched per child: rendered inside a route whose :kidId can change
    // without a remount, and re-fetched per learner for the same reason.
  }, [kidUserId, token]);

  /*
   * A DELIBERATELY-OPENED SHEET SHOWS "LOADING", NEVER NOTHING.
   *
   * This panel fetches four things (plan, notebook, the recent session's
   * summary and its transcript) before it can render, and it used to return
   * `null` for that whole window. On desktop the reads land fast enough that
   * nobody notices; on a phone a live audit (2026-09-10) opened "Mi progreso"
   * and saw an apparently-empty sheet — a drag handle over blank space —
   * because the panel was still loading and rendering nothing. An opened sheet
   * that shows nothing reads as broken, so the load now says it is loading.
   *
   * The ready-but-EMPTY case below still returns `null` on purpose (the panel
   * is hidden entirely when a learner genuinely has nothing kept yet — see the
   * file header); this only covers the transient fetch.
   */
  if (load.status === 'loading') {
    return (
      <Wrap variant={variant}>
        <h2 className="lf-title flex items-center gap-2 text-content">
          <Icon name="savings" className="text-primary" aria-hidden />
          {t('tutor.planNotebook.title')}
        </h2>
        <p role="status" className="lf-body text-content-muted">
          {t('tutor.planNotebook.loading')}
        </p>
      </Wrap>
    );
  }

  if (load.status === 'failed') {
    return (
      <Wrap variant={variant}>
        <h2 className="lf-title flex items-center gap-2 text-content">
          <Icon name="savings" className="text-primary" aria-hidden />
          {t('tutor.planNotebook.title')}
        </h2>
        <p role="alert" className="lf-body text-error-strong">
          {t('tutor.planNotebook.loadFailed')}
        </p>
      </Wrap>
    );
  }

  const { plan, entries, recap } = load;
  if (!plan && entries.length === 0 && !recap) return null;

  const formatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });

  return (
    <Wrap variant={variant}>
      <h2 className="lf-title flex items-center gap-2 text-content">
        <Icon name="savings" className="text-primary" aria-hidden />
        {t('tutor.planNotebook.title')}
      </h2>

      {recap && (
        <div className="flex flex-col gap-2">
          <p className="lf-caption text-content-faint">
            {t('tutor.planNotebook.recapLabel', { minutes: recap.minutes, xp: recap.xpAwarded })}
          </p>
          {recap.bestBoard && <TutorWhiteboard board={recap.bestBoard} seq={0} className="min-h-[9rem]" />}
        </div>
      )}

      {plan && (
        <div className="flex flex-col gap-2">
          <p className="lf-caption text-content-faint">
            {t('tutor.planNotebook.planUpdatedOn', { date: formatter.format(new Date(plan.updatedAt)) })}
          </p>
          <TutorWhiteboard board={plan.content} seq={0} className="min-h-[9rem]" />
        </div>
      )}

      {entries.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="lf-caption text-content-faint">
            {t('tutor.planNotebook.notebookLabel', { count: entries.length })}
          </p>
          <ul className="flex flex-col gap-4">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-outline/70 bg-surface p-3 shadow-glass-sm">
                <TutorWhiteboard board={entry.whiteboard} seq={0} className="min-h-[8rem]" />
                <p className="lf-caption mt-2 text-content-faint">{formatter.format(new Date(entry.keptAt))}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Wrap>
  );
}

export default PlanNotebookPanel;

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Icon } from '@/components/ui';
import { TutorWhiteboard } from '@/tutor/TutorWhiteboard';
import { getKidNotebook, getKidPlan, type TutorNotebookEntry, type TutorPlan } from '@/tutor/tutorApi';

/*
 * CLASS V ARTIFACTS, AS A GUARDIAN SURFACE (/TUTOR_INSTRUMENTS.md §3.6,
 * migration 0069): the first state a learner keeps ON PURPOSE — the savings
 * plan the tutor and learner build together, and the boards the learner
 * explicitly marked "keep this" — visible here, the same way the memory
 * notes panel above already makes the tutor's OWN notes visible.
 *
 * HIDDEN ENTIRELY WHEN THERE IS NOTHING TO SHOW, unlike the memory-notes
 * panel above (an always-relevant inbox). A plan and a notebook are OPT-IN
 * artifacts most families will not have touched yet, and an empty "no plan,
 * nothing kept" card on every guardian page, for every family, forever,
 * would be exactly the kind of accumulated clutter this product avoids
 * elsewhere.
 *
 * Both reuse `TutorWhiteboard` unmodified — the same component the live
 * conversation and session replay already render, so a plan or a kept board
 * looks here exactly as it looked the moment it was drawn.
 */

type Load =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; plan: TutorPlan | null; entries: TutorNotebookEntry[] };

export function TutorPlanNotebookPanel({ kidUserId, token }: { kidUserId: string; token: string | null }) {
  const { t, i18n } = useTranslation();
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });
    if (!token) return undefined;
    void (async () => {
      const [planResult, notebookResult] = await Promise.all([
        getKidPlan(token, kidUserId),
        getKidNotebook(token, kidUserId),
      ]);
      if (cancelled) return;
      if (planResult.error || notebookResult.error) {
        setLoad({ status: 'failed' });
        return;
      }
      setLoad({
        status: 'ready',
        plan: planResult.data?.plan ?? null,
        entries: notebookResult.data?.entries ?? [],
      });
    })();
    return () => {
      cancelled = true;
    };
    // Re-fetched per child: this component is rendered inside a route whose
    // :kidId can change without a remount.
  }, [kidUserId, token]);

  if (load.status === 'loading') return null;

  if (load.status === 'failed') {
    return (
      <Card className="p-4">
        <h2 className="lf-title mb-1 flex items-center gap-2 text-content">
          <Icon name="savings" className="text-primary" aria-hidden />
          {t('tutor.guardian.planNotebook.title')}
        </h2>
        <p role="alert" className="lf-body text-error-strong">
          {t('tutor.guardian.planNotebook.loadFailed')}
        </p>
      </Card>
    );
  }

  const { plan, entries } = load;
  if (!plan && entries.length === 0) return null;

  const formatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });

  return (
    <Card className="p-4">
      <h2 className="lf-title mb-3 flex items-center gap-2 text-content">
        <Icon name="savings" className="text-primary" aria-hidden />
        {t('tutor.guardian.planNotebook.title')}
      </h2>

      {plan && (
        <div className="mb-4 flex flex-col gap-2">
          <p className="lf-caption text-content-faint">
            {t('tutor.guardian.planNotebook.planUpdatedOn', { date: formatter.format(new Date(plan.updatedAt)) })}
          </p>
          <TutorWhiteboard board={plan.content} seq={0} className="min-h-[9rem]" />
        </div>
      )}

      {entries.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="lf-caption text-content-faint">
            {t('tutor.guardian.planNotebook.notebookLabel', { count: entries.length })}
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
    </Card>
  );
}

export default TutorPlanNotebookPanel;

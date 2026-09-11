import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

/**
 * `notebook` — Class V (migration 0069, /TUTOR_INSTRUMENTS.md §3.6): "boards
 * marked 'keep this', collected." The one piece of Class V that is the
 * LEARNER's own choice rather than the tutor's — no existing UI affordance
 * for it anywhere in this file's own history, confirmed while researching
 * this feature (no `keep`/`save`/`star`/`bookmark` control on any whiteboard
 * before this one.
 *
 * Rendered as a SIBLING of `<TutorWhiteboard>`, never nested inside it — the
 * same reasoning `WhiteboardShell`'s own `onAdvance` button already
 * documents: a `role="img"` (most kinds) or `role="group"` (the interactive
 * few) node presents its subtree to assistive tech as its own content, which
 * would swallow a nested control rather than let it be reached on its own.
 *
 * The server, not this component, decides what gets copied: `POST /notebook`
 * re-reads the real turn and refuses a session that is not the caller's own
 * or a turn that drew no board (`backend/src/routes/tutor.ts`) — this button
 * only ever names `(sessionId, turnSeq)`, never the board's own content.
 */
export function NotebookKeepButton({
  token,
  sessionId,
  turnSeq,
  className,
}: {
  token: string;
  sessionId: string;
  turnSeq: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'saving' | 'kept' | 'error'>('idle');

  const save = () =>
    api('/tutor/notebook', {
      method: 'POST',
      token,
      body: { sessionId, turnSeq },
    });

  const keep = async () => {
    setStatus('saving');
    /*
     * ONE SILENT RETRY BEFORE THE CHILD EVER SEES A FAILURE.
     *
     * A live audit (2026-09-10) hit "No se pudo guardar — intenta de nuevo" on
     * the first tap and success on the second: an intermittent, transient
     * failure of a keep the child had already decided to make. The request is
     * idempotent — it only names `(sessionId, turnSeq)`, and the server refuses
     * a duplicate — so re-issuing it once costs nothing and turns the common
     * transient blip into a save the learner never had to notice. A second
     * failure is a real one and DOES surface, with the retry still available:
     * this narrows the error window, it does not hide a persistent problem.
     */
    let result = await save();
    if (result.error) {
      await new Promise((r) => setTimeout(r, 600));
      result = await save();
    }
    setStatus(result.error ? 'error' : 'kept');
  };

  return (
    <button
      type="button"
      onClick={status === 'idle' || status === 'error' ? keep : undefined}
      disabled={status === 'saving' || status === 'kept'}
      className={cn(
        /*
         * 44 px OF TAP, not 16.
         *
         * Text plus a 16 px icon with no floor measured 94x16 in production
         * (2026-09-09) — under WCAG 2.5.8's 24 px minimum and well under
         * /DESIGN.md §Layout's non-negotiable 44, on a control aimed at a
         * six-year-old's finger. It was also the only thing on that rail with
         * no floor at all, which is why it was the one that shrank: measured
         * a frame earlier, while the board was still laying out, its rect was
         * 0x0 — a keyboard-focusable button with no dimensions.
         *
         * `px-2 -mr-2` keeps the LABEL optically flush with the board's right
         * edge while the target itself extends past it, so the floor costs
         * the layout nothing.
         */
        'lf-caption pointer-events-auto flex min-h-11 shrink-0 items-center gap-1 self-end px-2 -mr-2 transition-colors',
        status === 'kept' ? 'text-content-muted' : 'text-primary hover:underline',
        className,
      )}
    >
      <Icon name={status === 'kept' ? 'bookmark_added' : 'bookmark'} className="!text-[16px]" />
      {status === 'kept'
        ? t('tutor.notebook.kept')
        : status === 'saving'
          ? t('tutor.notebook.keeping')
          : status === 'error'
            ? t('tutor.notebook.keepFailed')
            : t('tutor.notebook.keep')}
    </button>
  );
}

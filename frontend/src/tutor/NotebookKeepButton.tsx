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

  const keep = async () => {
    setStatus('saving');
    const result = await api('/tutor/notebook', {
      method: 'POST',
      token,
      body: { sessionId, turnSeq },
    });
    setStatus(result.error ? 'error' : 'kept');
  };

  return (
    <button
      type="button"
      onClick={status === 'idle' || status === 'error' ? keep : undefined}
      disabled={status === 'saving' || status === 'kept'}
      className={cn(
        'lf-caption pointer-events-auto flex shrink-0 items-center gap-1 self-end transition-colors',
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

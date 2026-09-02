import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Icon } from '@/components/ui';
import {
  decideMemoryNote,
  getPendingMemoryNotes,
  type PendingMemoryNote,
} from '@/tutor/tutorApi';

/*
 * THE PARENTAL APPROVAL GATE, as a surface (/ORACLE.md §20, migration 0068).
 *
 * The tutor keeps a short prose note about each learner — what they are into,
 * what motivates them, what to steer away from — and it is read back into
 * every future conversation. For a child that note used to write itself after
 * each session, with the guardian able to READ it afterwards and nothing more.
 * /ORACLE.md marked closing that gap BLOCKING before real families. This is
 * the close: nothing enters the note until a verified guardian says so.
 *
 * WHY THE OLD TEXT IS SHOWN NEXT TO THE NEW ONE. A note is a full replacement,
 * not an addition, so approving one silently discards whatever it replaced. A
 * parent shown only the new paragraph is being asked to approve a diff they
 * cannot see. Both are rendered, the old one dimmed and labelled.
 *
 * WHY A NOTE CAN BE OUT OF DATE BEFORE ANYONE TOUCHES IT. Each note is
 * computed from the note that existed when its conversation started, so two
 * conversations close together can leave two notes both written against the
 * same older text. Approving one moves the tutor's note; the other no longer
 * fits what it was written against, and applying it anyway would erase the one
 * just approved. Those are marked before the guardian taps anything, and the
 * server refuses them independently, because a badge is a rendering decision
 * and the refusal is the record.
 *
 * Everything here is guarded twice over on the server: the verified guardian
 * link is re-checked on every request, and row-level security says the same
 * thing again in the database.
 */

type Load =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; notes: PendingMemoryNote[]; current: string | null };

/** Per-note UI state. `busy` blocks a double tap; the rest are outcomes. */
type NoteState = 'busy' | 'approved' | 'rejected' | 'stale' | 'failed';

export function MemoryNotesPanel({ kidUserId, token }: { kidUserId: string; token: string | null }) {
  const { t, i18n } = useTranslation();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [noteState, setNoteState] = useState<Record<string, NoteState>>({});

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });
    setNoteState({});
    if (!token) return undefined;
    void (async () => {
      const result = await getPendingMemoryNotes(token, kidUserId);
      if (cancelled) return;
      setLoad(
        result.error || !result.data
          ? { status: 'failed' }
          : { status: 'ready', notes: result.data.proposals, current: result.data.current },
      );
    })();
    return () => {
      cancelled = true;
    };
    // Re-fetched per child: this component is rendered inside a route whose
    // :kidId can change without a remount.
  }, [kidUserId, token]);

  async function decide(noteId: string, verdict: 'approved' | 'rejected') {
    if (!token || noteState[noteId]) return;
    setNoteState((prev) => ({ ...prev, [noteId]: 'busy' }));
    const result = await decideMemoryNote(token, noteId, verdict);
    /*
     * Every outcome gets its own state. Collapsing them would tell a parent
     * their approval landed when the server refused it, which is the one
     * mistake this whole surface exists to prevent.
     */
    if (result.data) {
      setNoteState((prev) => ({ ...prev, [noteId]: verdict === 'approved' ? 'approved' : 'rejected' }));
      return;
    }
    const code = result.error?.code;
    setNoteState((prev) => ({
      ...prev,
      // ALREADY_DECIDED lands here too: somebody else decided it, so it is no
      // longer this guardian's to act on, and saying "out of date" is the
      // honest description of the button they just pressed.
      [noteId]: code === 'NOTE_OUT_OF_DATE' || code === 'ALREADY_DECIDED' ? 'stale' : 'failed',
    }));
  }

  if (load.status === 'loading') return null;

  if (load.status === 'failed') {
    return (
      <Card className="p-4">
        <h2 className="lf-title mb-1 flex items-center gap-2 text-content">
          <Icon name="rate_review" className="text-primary" aria-hidden />
          {t('tutor.guardian.memoryNotes.title')}
        </h2>
        <p role="alert" className="lf-body text-error-strong">
          {t('tutor.guardian.memoryNotes.loadFailed')}
        </p>
      </Card>
    );
  }

  const formatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });
  const undecided = load.notes.filter((note) => !noteState[note.id] || noteState[note.id] === 'busy');

  return (
    <Card className="p-4">
      <h2 className="lf-title mb-1 flex items-center gap-2 text-content">
        <Icon name="rate_review" className="text-primary" aria-hidden />
        {t('tutor.guardian.memoryNotes.title')}
      </h2>
      <p className="lf-body mb-3 text-content-muted">{t('tutor.guardian.memoryNotes.help')}</p>

      {/* What the tutor holds today, whether or not anything is waiting. A
          parent who opens this page should be able to see the note itself,
          not only the queue of changes to it. */}
      <div className="mb-4 rounded-md bg-surface-sunken px-3 py-2">
        <p className="lf-caption text-content-faint">{t('tutor.guardian.memoryNotes.currentLabel')}</p>
        <p className="lf-body text-content">
          {load.current ?? t('tutor.guardian.memoryNotes.currentEmpty')}
        </p>
      </div>

      {load.notes.length === 0 ? (
        <p className="lf-body text-content-muted">{t('tutor.guardian.memoryNotes.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {load.notes.map((note) => {
            const state = noteState[note.id];
            /*
             * Stale by comparison, computed here rather than sent as a flag:
             * `current` is the note as it stands right now and `expectedBefore`
             * is what this proposal was written against, so the two disagreeing
             * IS the definition. Marked before the guardian taps, so nobody
             * approves something the server is going to refuse.
             */
            const outOfDate = note.expectedBefore !== load.current;
            return (
              <li
                key={note.id}
                className="rounded-lg border border-outline/70 bg-surface p-3 shadow-glass-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="lf-caption text-content-faint">
                    {t('tutor.guardian.memoryNotes.proposedOn', {
                      date: formatter.format(new Date(note.createdAt)),
                    })}
                  </span>
                  {outOfDate && state !== 'approved' && state !== 'rejected' && (
                    <span className="lf-caption rounded-full bg-warning-soft px-2 py-0.5 text-content">
                      {t('tutor.guardian.memoryNotes.outOfDateBadge')}
                    </span>
                  )}
                </div>

                <p className="lf-body whitespace-pre-line text-content">{note.proposed}</p>

                {/* The text it would replace. Without it a guardian is
                    approving a change they can only see one half of. */}
                {note.expectedBefore !== null && (
                  <div className="mt-2 border-l-2 border-outline pl-3">
                    <p className="lf-caption text-content-faint">
                      {t('tutor.guardian.memoryNotes.replacesLabel')}
                    </p>
                    <p className="lf-body whitespace-pre-line text-content-muted">{note.expectedBefore}</p>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {state === 'approved' || state === 'rejected' ? (
                    <p className="lf-caption flex items-center gap-1 text-content-muted">
                      <Icon
                        name={state === 'approved' ? 'check_circle' : 'cancel'}
                        className="text-[18px]"
                        aria-hidden
                      />
                      {/* Two whole literal keys, not one built from a
                          fragment: `i18n:check` verifies both branches of a
                          literal ternary and cannot see inside a template
                          string, so a rename would ship the key itself. */}
                      {state === 'approved'
                        ? t('tutor.guardian.memoryNotes.approvedDone')
                        : t('tutor.guardian.memoryNotes.rejectedDone')}
                    </p>
                  ) : (
                    <>
                      <Button
                        variant="success"
                        disabled={state === 'busy'}
                        onClick={() => void decide(note.id, 'approved')}
                      >
                        {t('tutor.guardian.memoryNotes.approve')}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={state === 'busy'}
                        onClick={() => void decide(note.id, 'rejected')}
                      >
                        {t('tutor.guardian.memoryNotes.reject')}
                      </Button>
                    </>
                  )}
                </div>

                {state === 'stale' && (
                  <p role="alert" className="lf-caption mt-2 text-content-muted">
                    {t('tutor.guardian.memoryNotes.outOfDateExplained')}
                  </p>
                )}
                {state === 'failed' && (
                  <p role="alert" className="lf-caption mt-2 text-error-strong">
                    {t('tutor.guardian.memoryNotes.decisionFailed')}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {load.notes.length > 0 && undecided.length === 0 && (
        <p className="lf-caption mt-3 text-content-muted">{t('tutor.guardian.memoryNotes.allDone')}</p>
      )}
    </Card>
  );
}

export default MemoryNotesPanel;

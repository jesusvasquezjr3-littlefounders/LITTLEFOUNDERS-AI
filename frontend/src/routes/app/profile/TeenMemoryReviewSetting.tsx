import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/useTheme';
import { decideMemoryNote, deleteOwnMemoryNote, getOwnPendingMemoryNotes, type PendingMemoryNote, type PendingMemoryNotes } from '@/rebuild/mentor/session/tutorApi';
import { MemorySelfReview, type MemoryStore, type NoteDeletion, type SettledVerdict, type Verdict } from '@/rebuild/memory/MemorySelfReview';
import en from '@/i18n/en-US/rebuild-profile.json';
import es from '@/i18n/es-MX/rebuild-profile.json';
import pt from '@/i18n/pt-BR/rebuild-profile.json';

/*
 * OD-18 (24 September 2026, C.4): an independent screened teen reviews their
 * OWN Mentor memory notes. This is that surface, mounted on /profile/settings
 * beside the analytics choice - the two places a teen governs their own data.
 *
 * GATING IS SERVER-CONFIRMED, NEVER CLIENT-INFERRED. Nothing about the
 * account is inspected locally to decide whether to show the queue: the
 * panel renders only after `GET /tutor/memory-proposals` answers 200, and it
 * disappears the moment the server answers 403 FORBIDDEN. A kid's queue
 * belongs to their guardian, an adult has no parked notes, and both get the
 * same 403 - the server's refusal is the only signal we trust, on the first
 * load and on every decision (§1.14: "we could not check" is never rendered
 * as "you are not allowed").
 *
 * A read failure is a failure state with retry, never an empty queue: those
 * are the same screen with opposite meanings. A 409 (already decided / out
 * of date) refreshes the queue instead of claiming the decision landed.
 *
 * GAP-FIX-R5 (C.4, OD-18): the teen can also DELETE a stored note. The call
 * names the exact text on screen, so a note that changed in the meantime is
 * never removed unseen: Core answers 409 and the queue reloads with a notice.
 */

const isProposal = (value: unknown): value is PendingMemoryNote => {
  if (typeof value !== 'object' || value === null) return false;
  const proposal = value as Record<string, unknown>;
  return typeof proposal.id === 'string' && proposal.id.length > 0
    && (proposal.store === 'learner' || proposal.store === 'pedagogy')
    && typeof proposal.proposed === 'string'
    && (proposal.expectedBefore === null || typeof proposal.expectedBefore === 'string')
    && (proposal.sessionId === null || typeof proposal.sessionId === 'string')
    && typeof proposal.createdAt === 'string' && Number.isFinite(Date.parse(proposal.createdAt));
};

type Current = PendingMemoryNotes['current'];
interface Queue { notes: PendingMemoryNote[]; current: Current }

const nullableText = (value: unknown) => value === null || typeof value === 'string';
const isCurrent = (value: unknown): value is Current => typeof value === 'object' && value !== null
  && nullableText((value as Record<string, unknown>).learner) && nullableText((value as Record<string, unknown>).pedagogy);
type Phase = 'loading' | 'failed' | 'hidden' | 'ready';

export function TeenMemoryReviewSetting() {
  const { session, isGuest } = useAuth();
  return !session || isGuest ? null : <AccountMemoryReview key={session.user.id} />;
}

function AccountMemoryReview() {
  const { getToken } = useAuth();
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).memorySelfReview;
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [queue, setQueue] = useState<Queue | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [settled, setSettled] = useState<Record<string, SettledVerdict>>({});
  const [failedId, setFailedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<'alert' | 'status' | null>(null);
  const [deletions, setDeletions] = useState<Partial<Record<MemoryStore, NoteDeletion>>>({});
  const generation = useRef(0);

  useEffect(() => {
    const current = ++generation.current;
    setPhase('loading');
    setDeciding(null);
    setSettled({});
    setFailedId(null);
    setDeletions({});
    // A conflict notice set just before this reload must survive it.
    void (async () => {
      try {
        const token = await getToken();
        if (current !== generation.current) return;
        // No token means the server was never asked, so nothing is shown.
        if (!token) { setQueue(null); setPhase('hidden'); return; }
        const result = await getOwnPendingMemoryNotes(token);
        if (current !== generation.current) return;
        if (result.error?.code === 'FORBIDDEN') { setQueue(null); setPhase('hidden'); return; }
        if (result.error || !result.data || !result.data.proposals.every(isProposal) || !isCurrent(result.data.current)) {
          setQueue(null);
          setPhase('failed');
          return;
        }
        setQueue({ notes: result.data.proposals, current: result.data.current });
        setPhase('ready');
      } catch {
        if (current === generation.current) { setQueue(null); setPhase('failed'); }
      }
    })();
    return () => { generation.current += 1; };
  }, [getToken, attempt]);

  async function decide(noteId: string, verdict: Verdict) {
    if (!queue || deciding) return;
    const current = generation.current;
    setDeciding(noteId);
    setFailedId(null);
    setNotice(null);
    setNoticeKind(null);
    try {
      const token = await getToken();
      if (current !== generation.current) return;
      if (!token) { setPhase('hidden'); return; }
      const result = await decideMemoryNote(token, noteId, verdict);
      if (current !== generation.current) return;
      if (result.error?.code === 'FORBIDDEN' || result.error?.code === 'UNAUTHORIZED') {
        // Not this teen's note any more: re-confirm eligibility from the server.
        setAttempt((value) => value + 1);
        return;
      }
      if (result.error?.code === 'ALREADY_DECIDED' || result.error?.code === 'NOTE_OUT_OF_DATE') {
        // The queue moved under this note. Say so, then reload it.
        setNotice(copy.changed);
        setNoticeKind('alert');
        setAttempt((value) => value + 1);
        return;
      }
      if (result.error || !result.data) {
        setFailedId(noteId);
        return;
      }
      setSettled((prev) => ({ ...prev, [noteId]: verdict === 'approved' ? 'kept' : 'deleted' }));
      if (verdict === 'approved' && result.data.applied) {
        setQueue((prev) => {
          const note = prev?.notes.find((entry) => entry.id === noteId);
          return prev && note ? { notes: prev.notes, current: { ...prev.current, [note.store]: note.proposed } } : prev;
        });
      }
    } finally {
      if (current === generation.current) setDeciding(null);
    }
  }

  async function deleteNote(store: MemoryStore) {
    const expected = queue?.current[store];
    if (!expected) return;
    const current = generation.current;
    setNotice(null);
    setNoticeKind(null);
    setDeletions((prev) => ({ ...prev, [store]: undefined }));
    try {
      const token = await getToken();
      if (current !== generation.current) return;
      if (!token) { setPhase('hidden'); return; }
      const result = await deleteOwnMemoryNote(token, store, expected);
      if (current !== generation.current) return;
      if (result.error?.code === 'GUARDIAN_MANAGED' || result.error?.code === 'AGE_EVIDENCE_REQUIRED' || result.error?.code === 'UNAUTHORIZED') {
        // No longer this teen's to decide: re-confirm eligibility from the server.
        setAttempt((value) => value + 1);
        return;
      }
      if (result.error?.code === 'NOTE_OUT_OF_DATE' || result.error?.code === 'NOT_FOUND') {
        setNotice(copy.changed);
        setNoticeKind('alert');
        setAttempt((value) => value + 1);
        return;
      }
      if (result.error || !result.data?.deleted) {
        setDeletions((prev) => ({ ...prev, [store]: 'failed' }));
        return;
      }
      setDeletions((prev) => ({ ...prev, [store]: 'deleted' }));
      setQueue((prev) => prev ? { notes: prev.notes, current: { ...prev.current, [store]: null } } : prev);
    } catch {
      if (current === generation.current) setDeletions((prev) => ({ ...prev, [store]: 'failed' }));
    }
  }

  if (phase === 'hidden') return null;
  return <MemorySelfReview copy={copy} locale={locale} dark={isDark}
    phase={phase === 'loading' ? 'loading' : phase === 'failed' ? 'failed' : 'ready'}
    notes={queue?.notes ?? []} current={queue?.current ?? { learner: null, pedagogy: null }}
    deciding={deciding} settled={settled} failedId={failedId} notice={notice} noticeKind={noticeKind}
    onDecide={(id, verdict) => void decide(id, verdict)}
    deletions={deletions} onDeleteNote={deleteNote}
    onRetry={() => { setNotice(null); setNoticeKind(null); setAttempt((value) => value + 1); }} />;
}

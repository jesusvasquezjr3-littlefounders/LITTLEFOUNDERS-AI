import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Button, Card, Icon, LoadingOverlay } from '@/components/ui';
import { MarkdownLite } from '@/lesson-engine/core/MarkdownLite';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { buildReplayScript } from '@/tutor/replay/replayScript';
import { TutorWhiteboard } from '@/tutor/TutorWhiteboard';
import { DemoStepsSummary } from '@/tutor/replay/DemoStepsSummary';
import { getKidTutorHistory, getTranscript, type KidTutorHistory } from '@/tutor/tutorApi';
import type { SessionTranscript } from '@/tutor/types';
import { MemoryNotesPanel } from './MemoryNotesPanel';

/*
 * `/family/:kidId/tutor` — a child's tutor conversations, through the parent's
 * eyes.
 *
 * PARENT VISIBILITY IS A PRODUCT INVARIANT (/AGENTS.md §1.9), and this page is
 * that invariant becoming a surface. It shows the FULL transcript — not a
 * summary, not a redaction. A guardian who can only see that a conversation
 * happened has not been given visibility; they have been given a receipt.
 *
 * ACTIVITIES ARE PART OF THE TRANSCRIPT, NOT A FOOTNOTE TO IT. Found by
 * adversarial review, round 67 (2026-08-30, HIGH): `SessionTranscript.segments`
 * was fetched and typed and never once read in this file — only `turns` was
 * rendered, so a guardian saw every word the child and the tutor exchanged but
 * NOTHING about the graded activities served in between: no prompt, no score,
 * no XP. `/ORACLE.md` §12 documents the segments as persisted precisely FOR
 * this view. Fixed by reusing `buildReplayScript` (`tutor/replay/replayScript`)
 * — the SAME pure ordering function the 3D replay stage already trusts to
 * interleave a session's turns and activities by their real `seq`, not by
 * inventing a second sort here — and rendering each `activity` beat with the
 * same "scored X out of 100 · N XP" language `ReplayInWorld`'s `ActivitySummary`
 * already uses. The answer key never travels with it: `TranscriptSegment` has
 * no `answer` field on the wire (/ORACLE.md §8, migration 0047), so there is
 * nothing here to accidentally show.
 *
 * THE WHITEBOARD IS PART OF THE TRANSCRIPT TOO, FOR THE SAME REASON. Found by
 * adversarial review sweep tutor-review-sweep-101 (guardian-dashboard-depth,
 * HIGH): `buildReplayScript` already computes `beat.whiteboard` for every
 * tutor beat — the SAME field the learner's own live view (`ConversationView`)
 * and replay (`ReplayInWorld`) draw with `TutorWhiteboard` — and this file
 * never once rendered it. A parent could read the tutor's caption narrating a
 * growth or spending story ("empiezas con 10 y cada semana...") with no board
 * underneath it, while the learner's own screen showed the actual worked
 * numbers (/ORACLE.md §20.5). Fixed by reusing `TutorWhiteboard` unmodified —
 * no second component, no re-derived numbers (§20.5: "values ARE NEVER
 * RECOMPUTED HERE") — directly below the tutor's line, the same beat it
 * belongs to. `TutorWhiteboard`'s chart area is `flex-1` and needs a real
 * height from its parent; the live and replay call sites get one for free
 * from the 3D stage's fixed-height plate, which this plain scrolling page
 * does not have, so a fixed-height well is given here instead.
 *
 * Safety flags are surfaced FIRST and deliberately prominently. A child
 * disclosing distress to a tutor is precisely the case where a parent must
 * find out, and burying it under a list of chat logs would be a product
 * failure dressed up as tidiness. The flag carries a category and a severity
 * and never the child's words — the words are in the transcript, where they
 * belong in context, rather than duplicated into an alert.
 *
 * TWO PROVENANCES, ONE SEVERITY-ORDERED LIST (2026-09-01). `/ORACLE.md` §4.1b
 * closed its own "not yet done" note here: `placementSafetyFlags` (migration
 * 0065) is a flag raised while the learner was CHOOSING A COURSE, before any
 * `tutor_sessions` row existed, and it was real, RLS-protected,
 * guardian-queryable data that this page never rendered. It is now shown in
 * the SAME card, through the SAME chip and severity treatment, and — this is
 * the load-bearing part — inside the SAME severity-first sort as the
 * session flags rather than in a second card below them. A separate section
 * would have recreated, one layer up, the exact defect the 2026-08-30 review
 * fixed inside this one: a HIGH `self_harm` flag sitting below a batch of LOW
 * ones, with "surfaced FIRST" true of the section and false of what a parent
 * actually reads first. The two arrays stay separate ON THE WIRE (they are
 * different row shapes); only the ORDERING is shared.
 *
 * The one thing a placement flag cannot offer is the "Read it" control: it has
 * no `session_id`/`turn_seq`, so there is no transcript to open. That absence
 * is stated in words on the row itself rather than left as a missing button,
 * because a parent looking at an urgent flag must not be left wondering
 * whether the transcript failed to load.
 *
 * Core re-checks the verified guardian link on every request here; this page
 * cannot show anything the server would not already hand over.
 *
 * THE NARRATIVE, ADDED 2026-09-01, DOES NOT CONTRADICT "NOT A SUMMARY"
 * ABOVE — it sits ON TOP of the full transcript, never in place of it. This
 * closes the §19.5 v3-tail item ("the parent-portal 'what is happening'
 * narrative"): a one- or two-sentence gist of what a session was actually
 * about — topics practiced, a struggle worked through — so a guardian does
 * not have to open and read every conversation end to end just to learn
 * that much. `session.narrative` (`GET /kids/:kidUserId/sessions`) is
 * entirely deterministic, built server-side from `kc_attempt` evidence and
 * the session's own memory digest (/ORACLE.md §12) — no model call, no new
 * data collected. The "Read it" transcript below is unchanged and one tap
 * away for anyone who wants the receipt itself.
 */

type State =
  | { status: 'loading' }
  | { status: 'error'; code: string }
  | { status: 'ready'; history: KidTutorHistory };

/**
 * One row of the "Worth your attention" list, from either provenance.
 *
 * A discriminated union rather than one widened row shape: `source` is the
 * only thing that proves a `session_id`/`turn_seq` is there to open a
 * transcript with, and this way the compiler enforces that instead of a
 * runtime `in` check that would quietly pass on a partially-typed row.
 * `key` is the composite React key, because the two ids come from two
 * different tables.
 */
type GuardianFlag =
  | (KidTutorHistory['safetyFlags'][number] & { source: 'session'; key: string })
  | (KidTutorHistory['placementSafetyFlags'][number] & { source: 'placement'; key: string });

export function KidTutorPage() {
  const { t, i18n } = useTranslation();
  const { kidId = '' } = useParams();
  const { getToken } = useAuth();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [token, setToken] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openFlagId, setOpenFlagId] = useState<string | null>(null);
  /*
   * Found by adversarial review, round 110 (2026-08-31, MEDIUM,
   * guardian-dashboard-depth): the sessions list was hardcoded to the 30
   * most recent, with no pagination anywhere on this page — a guardian who
   * skipped a few weeks lost UI access to every older, non-flagged session,
   * even though it was still inside the 90-day retention window (§1.9).
   * `loadingMore`/`loadMoreFailed` are local to the "Load more" affordance
   * only; they never touch the `loading`/`error` states above, which stay
   * about the FIRST page.
   */
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    /*
     * Found by adversarial review, round 31 (2026-08-30, MEDIUM): the route
     * has no `key={kidId}`, so React Router reuses this component instance
     * across a `:kidId` change instead of remounting it. Without this reset,
     * `state` kept whichever kid's history last rendered until the NEW kid's
     * fetch resolved — meaning a parent could, for a moment, see one child's
     * safety flags (self-harm, abuse) under a URL that already names a
     * different child. Not reachable through today's shipped navigation, but
     * a real defect in the component itself and cheap to close now.
     */
    setState({ status: 'loading' });
    setOpenId(null);
    setOpenFlagId(null);
    setLoadingMore(false);
    setLoadMoreFailed(false);
    void (async () => {
      const authToken = await getToken();
      if (!authToken || cancelled) return;
      setToken(authToken);
      const result = await getKidTutorHistory(authToken, kidId);
      if (cancelled) return;
      setState(
        result.error || !result.data
          ? { status: 'error', code: result.error?.code ?? 'INTERNAL' }
          : { status: 'ready', history: result.data },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [kidId, getToken]);

  const handleLoadMore = async () => {
    if (!token || state.status !== 'ready') return;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    const result = await getKidTutorHistory(token, kidId, { offset: state.history.sessions.length });
    setLoadingMore(false);
    if (result.error || !result.data) {
      setLoadMoreFailed(true);
      return;
    }
    const nextPage = result.data;
    setState((prev) =>
      prev.status === 'ready'
        ? {
            status: 'ready',
            history: {
              sessions: [...prev.history.sessions, ...nextPage.sessions],
              hasMore: nextPage.hasMore,
              // Refreshed rather than kept stale: a page turn is also a
              // chance to surface a flag raised since the first load. Both
              // provenances, for the same reason.
              safetyFlags: nextPage.safetyFlags,
              placementSafetyFlags: nextPage.placementSafetyFlags,
            },
          }
        : prev,
    );
  };

  if (state.status === 'loading') return <LoadingOverlay label={t('tutor.guardian.loading')} />;
  if (state.status === 'error') return <ErrorBanner code={state.code} />;

  const { sessions, hasMore, safetyFlags, placementSafetyFlags } = state.history;
  const formatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  /*
   * SEVERITY FIRST, THEN RECENCY — not the server's raw `created_at DESC`.
   *
   * Found by adversarial review, 2026-08-30 (MEDIUM/HIGH): flags rendered in
   * plain chronological order, so an old HIGH-severity flag (self_harm) could
   * sit BELOW a newer LOW-severity one (model_output_blocked) — "surfaced
   * FIRST" was true of the section, never of what a parent actually sees
   * first inside it. `severity` was already fetched and simply never read.
   *
   * BOTH provenances go into the SAME sort (2026-09-01, see the header): the
   * ordering is about what a parent reads first, and a flag's severity does
   * not become less urgent because it was raised during course selection
   * instead of mid-conversation. `source` is what decides whether a row can
   * offer a transcript, and nothing else. The composite key exists because the
   * two ids come from two different tables and only their PAIRING with a
   * source is unique by construction.
   */
  const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sortedFlags: GuardianFlag[] = [
    ...safetyFlags.map((flag) => ({ ...flag, source: 'session' as const, key: `session:${flag.id}` })),
    ...placementSafetyFlags.map((flag) => ({
      ...flag,
      source: 'placement' as const,
      key: `placement:${flag.id}`,
    })),
  ].sort((a, b) => {
    const rank = (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3);
    return rank !== 0 ? rank : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-6">
      <header>
        <Link to="/family" className="lf-caption text-primary">
          {t('tutor.guardian.backToFamily')}
        </Link>
        <h1 className="lf-display-lg text-content">{t('tutor.guardian.title')}</h1>
        <p className="lf-body text-content-muted">{t('tutor.guardian.subtitle')}</p>
      </header>

      {sortedFlags.length > 0 && (
        <Card className="border-warning/60 p-4">
          <h2 className="lf-title mb-2 flex items-center gap-2 text-content">
            <Icon name="flag" className="text-warning" aria-hidden />
            {t('tutor.guardian.flagsTitle')}
          </h2>
          <p className="lf-body mb-3 text-content-muted">{t('tutor.guardian.flagsHelp')}</p>
          <ul className="space-y-2">
            {sortedFlags.map((flag) => (
              <li key={flag.key} className="lf-body rounded-md bg-warning-soft px-3 py-2 text-content">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="lf-label flex items-center gap-2">
                      {t(`tutor.guardian.flagCategory.${flag.category}`, { defaultValue: flag.category })}
                      <span
                        className={
                          flag.severity === 'high'
                            ? 'lf-caption rounded-full bg-error px-2 py-0.5 text-on-error'
                            : 'lf-caption rounded-full bg-surface px-2 py-0.5 text-content-muted'
                        }
                      >
                        {t(`tutor.guardian.flagSeverity.${flag.severity}`, { defaultValue: flag.severity })}
                      </span>
                    </span>
                    <span className="lf-caption text-content-muted">
                      {formatter.format(new Date(flag.created_at))}
                    </span>
                    {/*
                     * Said in words, not left as a missing button. A placement
                     * flag has no session to open, and a parent staring at an
                     * urgent flag must not have to guess whether the "Read it"
                     * control is absent by design or failed to appear.
                     */}
                    {flag.source === 'placement' && (
                      <span className="lf-caption block text-content-muted">
                        {t('tutor.guardian.flagFromPlacement')}
                      </span>
                    )}
                  </div>
                  {/*
                   * Found by adversarial review, round 41 (2026-08-30, HIGH):
                   * a flag carried `session_id`/`turn_seq` on the wire —
                   * exactly what Oracle's own turn/flag correlation fix
                   * exists to provide — and this page never read either.
                   * "The words are in the transcript, where they belong in
                   * context" (this file's own header comment) was a promise
                   * with no control behind it: a parent saw "Self-harm —
                   * Urgent" and had no way to find out what was said. Reuses
                   * the exact same `Transcript` component the session list
                   * below already opens BY ID — it fetches by `sessionId`
                   * alone and never depends on that session appearing in the
                   * capped `sessions` list, so this works for a flag from
                   * any point in the retention window, not only a recent one.
                   *
                   * Session flags only: a placement flag names no session, so
                   * there is nothing this control could fetch.
                   */}
                  {flag.source === 'session' && (
                    <Button
                      variant="secondary"
                      onClick={() => setOpenFlagId(openFlagId === flag.key ? null : flag.key)}
                    >
                      {openFlagId === flag.key ? t('tutor.guardian.hide') : t('tutor.guardian.read')}
                    </Button>
                  )}
                </div>
                {flag.source === 'session' && openFlagId === flag.key && token && (
                  <Transcript token={token} sessionId={flag.session_id} highlightSeq={flag.turn_seq} />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/*
        * THE PARENTAL APPROVAL GATE (/ORACLE.md §20, migration 0068) — the one
        * item that document marked BLOCKING before real families.
        *
        * Placed ABOVE the conversation list and BELOW the safety flags. It is
        * an inbox: it asks the guardian to DO something, and an inbox under a
        * scrolling archive is an inbox nobody empties. It stays below the
        * flags because a child disclosing distress outranks a pending note,
        * which is the same ordering argument the flags card itself is built
        * on. The panel renders nothing at all while it is loading, so it
        * never pushes the list down after the fact.
        */}
      <MemoryNotesPanel kidUserId={kidId} token={token} />

      {sessions.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="lf-body text-content-muted">{t('tutor.guardian.empty')}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((session) => (
            <li key={session.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="lf-title text-content">
                      {t(`tutor.intent.${session.intent}`, { defaultValue: session.intent })}
                    </p>
                    {/*
                     * The "what is happening" narrative (/ORACLE.md §12,
                     * 2026-09-01) — a human sentence in place of the
                     * transcript a parent would otherwise have to open and
                     * read end to end to find out what this conversation
                     * was actually about. `narrative` is structured data;
                     * this is the ONLY place that turns it into a sentence
                     * (/AGENTS.md §1.8 — no backend-composed strings), by
                     * joining up to two already-complete translated
                     * sentences, the same way a person would say them one
                     * after another.
                     */}
                    {session.narrative && (session.narrative.topics.length > 0 || session.narrative.struggledTopic) && (
                      <p className="lf-body mt-1 text-content">
                        {session.narrative.topics.length === 1 &&
                          t('tutor.guardian.narrative.practicedOne', { topic: session.narrative.topics[0] })}
                        {session.narrative.topics.length === 2 &&
                          t('tutor.guardian.narrative.practicedTwo', {
                            topic1: session.narrative.topics[0],
                            topic2: session.narrative.topics[1],
                          })}
                        {session.narrative.struggledTopic && (
                          <>
                            {session.narrative.topics.length > 0 ? ' ' : ''}
                            {t(
                              session.narrative.struggleResolved
                                ? 'tutor.guardian.narrative.struggledResolved'
                                : 'tutor.guardian.narrative.struggledOngoing',
                              { topic: session.narrative.struggledTopic },
                            )}
                          </>
                        )}
                      </p>
                    )}
                    <p className="lf-caption text-content-muted">
                      {formatter.format(new Date(session.startedAt))} ·{' '}
                      {session.endedAt === null
                        ? t('tutor.guardian.ongoing')
                        : t('tutor.guardian.turns', { count: session.turnCount })}
                    </p>
                    {session.narrative?.gradedTotal !== null &&
                      session.narrative?.gradedTotal !== undefined &&
                      session.narrative.gradedTotal > 0 && (
                        <p className="lf-caption text-content-muted">
                          {t('tutor.guardian.narrative.score', {
                            correct: session.narrative.gradedCorrect ?? 0,
                            total: session.narrative.gradedTotal,
                          })}
                        </p>
                      )}
                    {/*
                     * Found by adversarial review, round 54 (2026-08-30,
                     * MEDIUM): `closeReason` reached this component on every
                     * session but was never read anywhere — a session force-
                     * closed by an internal error, a dropped-and-never-
                     * resumed connection, or a mid-session consent
                     * revocation rendered identically to an ordinary
                     * finished chat. `completed` needs no annotation (the
                     * unremarkable default); every other reason gets one.
                     */}
                    {session.closeReason !== null && session.closeReason !== 'completed' && (
                      <p className="lf-caption text-content-muted">
                        {t(`tutor.guardian.closeReason.${session.closeReason}`, {
                          defaultValue: session.closeReason,
                        })}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => setOpenId(openId === session.id ? null : session.id)}
                  >
                    {openId === session.id ? t('tutor.guardian.hide') : t('tutor.guardian.read')}
                  </Button>
                </div>
                {openId === session.id && token && <Transcript token={token} sessionId={session.id} />}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="flex flex-col items-center gap-2">
          <Button variant="secondary" onClick={() => void handleLoadMore()} disabled={loadingMore}>
            {loadingMore ? t('tutor.guardian.loadingMore') : t('tutor.guardian.loadMore')}
          </Button>
          {loadMoreFailed && (
            <p role="alert" className="lf-caption text-error-strong">
              {t('tutor.guardian.loadMoreFailed')}
            </p>
          )}
        </div>
      )}

      <p className="lf-caption text-content-muted">{t('tutor.guardian.retentionNote')}</p>
    </div>
  );
}

function Transcript({
  token,
  sessionId,
  highlightSeq = null,
}: {
  token: string;
  sessionId: string;
  /** The exact turn a safety flag names (`turn_seq`), or null for an ordinary read. */
  highlightSeq?: number | null;
}) {
  const { t } = useTranslation();
  const [transcript, setTranscript] = useState<SessionTranscript | null>(null);
  const [failed, setFailed] = useState(false);
  const highlightRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getTranscript(token, sessionId).then((result) => {
      if (cancelled) return;
      if (result.data) setTranscript(result.data);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [token, sessionId]);

  // Scrolls the flagged moment into view once the transcript it belongs to
  // has actually rendered — a highlight nobody can see is not a highlight.
  useEffect(() => {
    if (highlightRef.current) highlightRef.current.scrollIntoView({ block: 'center' });
  }, [transcript]);

  /*
   * The turns AND the activities, interleaved in the order they actually
   * happened — `buildReplayScript`'s own job, reused rather than re-sorted
   * here. `seq` on each beat is the row's real schema seq (not `index`,
   * which is only the beat's position in this array), and it is what lets
   * `highlightSeq` — a safety flag's `turn_seq` — find the one turn it names
   * even though a segment can share a `seq` with the turn that served it.
   */
  const beats = useMemo(() => (transcript ? buildReplayScript(transcript).beats : []), [transcript]);

  if (failed) return <p className="lf-body mt-4 text-content-muted">{t('tutor.guardian.loadFailed')}</p>;
  if (!transcript) return <p className="lf-body mt-4 text-content-muted">{t('tutor.guardian.loading')}</p>;

  return (
    <div className="mt-4 space-y-2 border-t border-outline pt-4">
      {beats.map((beat) => {
        if (beat.kind === 'activity') {
          // No answer key here, ever: `TranscriptSegment` never carries
          // `answer` over the wire (/ORACLE.md §8, migration 0047) — the same
          // reason the 3D replay's own `ActivityDetail` cannot show one.
          const activity = beat.activity;
          return (
            <div key={beat.id} className="lf-body rounded-md bg-surface-sunken px-3 py-2 text-content">
              <p className="lf-label text-content-muted">{t('tutor.replay.activity')}</p>
              {activity && activity.prompt !== '' && (
                <MarkdownLite text={activity.prompt} className="lf-body mt-1 text-content" />
              )}
              <p className="lf-caption mt-1 text-content-muted">
                {activity && activity.score === null
                  ? t('tutor.replay.activityUnanswered')
                  : t('tutor.replay.activityScored', { score: activity?.score ?? 0 })}
                {activity && activity.xpAwarded > 0
                  ? ` · ${t('tutor.history.xp', { count: activity.xpAwarded })}`
                  : ''}
              </p>
            </div>
          );
        }

        const isFlagged = highlightSeq !== null && beat.seq === highlightSeq;
        return (
          <Fragment key={beat.id}>
            <p
              ref={isFlagged ? highlightRef : undefined}
              className={
                (beat.kind === 'tutor'
                  ? 'lf-body rounded-md bg-surface-sunken px-3 py-2 text-content'
                  : 'lf-body ml-auto max-w-[85%] rounded-md bg-accent-soft px-3 py-2 text-content') +
                (isFlagged ? ' ring-2 ring-warning' : '')
              }
            >
              {beat.text}
            </p>
            {/*
             * V4's whiteboard, exactly as drawn — never recomputed here
             * (/ORACLE.md §20.5). Present only on a `tutor` beat that set one
             * (`buildReplayScript`'s own contract). A fixed height stands in
             * for the flex-parent height `TutorWhiteboard` gets for free on
             * the 3D stage's own plate, which this plain scrolling transcript
             * has no equivalent of.
             */}
            {beat.kind === 'tutor' && beat.whiteboard && (
              <div className="h-40 rounded-md bg-surface-sunken px-3 py-2">
                <TutorWhiteboard board={beat.whiteboard} seq={beat.seq} className="h-full" />
              </div>
            )}
            {/*
             * What the tutor's hands did on the money tray (/ORACLE.md §20.8).
             *
             * This surface rendered NOTHING for it until 2026-09-01, even
             * though migration `0067`'s own header states the defect it fixed
             * was losing that fact "silently, on replay AND on the guardian
             * transcript viewer" — the replay half shipped, this half did
             * not, and the migration went on claiming both. A parent reading
             * "so I take one of these away…" had no way to see what "these"
             * were, which is the same missing-referent complaint that put
             * `demonstrate` on the wire in the first place.
             *
             * The plain-sentence summary, not a re-animated tray, for the
             * data reason `DemoStepsSummary`'s own comment gives.
             */}
            {beat.kind === 'tutor' && beat.demonstrate && <DemoStepsSummary steps={beat.demonstrate} />}
          </Fragment>
        );
      })}
    </div>
  );
}

export default KidTutorPage;

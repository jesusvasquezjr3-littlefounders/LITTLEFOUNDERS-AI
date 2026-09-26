import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, ButtonGroup, Card, Chip, Copy, EmptyState, InlineNotice, LoadingState, type GlyphName, type StatusTone } from '../../design/controls';
import { DispositionSummary, type DispositionSummaryCopy } from '../../mentor/DispositionSummary';
import type { DispositionSummaryData } from '../../mentor/allianceApi';
import {
  childName, decideMemoryNote, fetchChildren, fetchDisposition, fetchKeptBoards, fetchMemoryNotes, fetchMentorHistory, fetchTranscript, resetDisposition,
  type BoardNote, type ConsoleTransport, type KeptBoards, type MemoryDecision, type MemoryNotes as Notes, type MentorHistory, type MentorSession,
  type SafetyFlag, type TranscriptBeat,
} from './consoleApi';
import { MicrophoneConsent } from './ChildControls';
import {
  BackLink, FailureState, fill, isRefusal, PageLoading, type ChildConsentCopy, type ChildMentorCopy, type ConsoleLocale, type MemoryNotesCopy, type PageFailure,
} from './consoleParts';
import '../../design/tokens.css';
import '../../design/system.css';
import './console.css';

/*
 * F3, a child's Mentor talks through the verified Tutor's eyes (W2F.1),
 * rebuilt from the design system (it replaces the legacy guardian page and
 * its legacy transcript, whiteboard and memory-note components, 02 rule 23).
 *
 * PARENT VISIBILITY IS A PRODUCT INVARIANT (§1.9): this shows the FULL
 * transcript, turns and the activities served between them, in the order
 * they happened, never a redaction. Order of the page, most urgent first:
 *
 *   1. Worth your attention: safety flags from a talk AND from choosing a
 *      course, in ONE list sorted by severity then recency. A flag carries a
 *      category and a severity, never the child's words; a talk's flag opens
 *      that talk at the flagged moment. A course-choice flag has no talk to
 *      open, and says so in words.
 *   2. What the Mentor remembers: the parental approval gate on the note the
 *      Mentor reads before each talk. The current note and what a suggestion
 *      would replace are both shown; a suggestion written against an older
 *      note is marked before anyone taps, and Core refuses it independently.
 *   3. The microphone consent (the same deliberate two-step control as the
 *      Family console).
 *   4. How the child learns (C.7): the disposition profile in closed labels,
 *      readable and resettable by the Tutor (Appendix D §2.6).
 *   5. The savings plan and the boards the child kept, by their captions.
 *   6. The talks, newest first, each with its plain-language narrative, its
 *      length, how it ended when that was not the ordinary way, and the full
 *      transcript one press away; older talks load on request (90-day
 *      retention, stated at the end).
 *
 * The boards are shown by their own captions: the drawn board is the Mentor
 * lane's rebuilt teaching-visual renderer (Bible 05/08), which this page will
 * mount when it exists. The answer key never travels (Core never sends it).
 * Core re-checks the verified guardian link on every request.
 */

type Load = { status: 'loading' } | { status: 'failed'; failure: PageFailure } | { status: 'ready'; history: MentorHistory };

const SEVERITY: Record<string, { tone: StatusTone; glyph: GlyphName; key: 'high' | 'medium' | 'low' }> = {
  high: { tone: 'error', glyph: 'warning', key: 'high' },
  medium: { tone: 'warning', glyph: 'warning', key: 'medium' },
  low: { tone: 'sky', glyph: 'info', key: 'low' },
};

const pick = (table: Record<string, string>, key: string | null) => (key && key in table ? table[key] : table.other) ?? '';

export function ChildMentorTalks({ copy, notesCopy, consentCopy, profileCopy, locale, dark, transport, kidId, backHref, onNavigate }: {
  copy: ChildMentorCopy;
  notesCopy: MemoryNotesCopy;
  consentCopy: ChildConsentCopy;
  profileCopy: DispositionSummaryCopy;
  locale: ConsoleLocale;
  dark: boolean;
  transport: ConsoleTransport;
  kidId: string;
  backHref: string;
  onNavigate: (href: string) => void;
}) {
  const [name, setName] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [retrying, setRetrying] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [more, setMore] = useState<'idle' | 'loading' | 'failed'>('idle');
  const generation = useRef(0);

  const read = useCallback(async () => {
    const current = ++generation.current;
    const [family, history] = await Promise.all([fetchChildren(transport), fetchMentorHistory(transport, kidId)]);
    if (current !== generation.current) return;
    setRetrying(false);
    const self = family.ok ? family.data.find((child) => child.userId === kidId) : undefined;
    setName(self ? childName(self) : null);
    setLoad(history.ok ? { status: 'ready', history: history.data } : { status: 'failed', failure: { code: history.code } });
  }, [transport, kidId]);

  useEffect(() => {
    // A different child never shows the previous child's flags, even for a moment.
    setLoad({ status: 'loading' }); setOpen(null); setMore('idle'); setName(null);
    void read();
    return () => { generation.current++; };
  }, [read]);

  async function loadMore() {
    if (load.status !== 'ready' || more === 'loading') return;
    setMore('loading');
    const result = await fetchMentorHistory(transport, kidId, load.history.sessions.length);
    if (!result.ok) { setMore('failed'); return; }
    setMore('idle');
    // A page turn also refreshes the flags: a flag raised since the first load surfaces now.
    setLoad((previous) => previous.status === 'ready' ? { status: 'ready', history: {
      sessions: [...previous.history.sessions, ...result.data.sessions.filter((s) => !previous.history.sessions.some((p) => p.id === s.id))],
      hasMore: result.data.hasMore, flags: result.data.flags,
    } } : previous);
  }

  const root = (body: ReactNode) => <div className="lf-rebuild lf-family-console" data-screen="child-mentor" data-theme={dark ? 'dark' : 'light'} lang={locale}>
    <header className="lf-console-header">
      <BackLink href={backHref} label={copy.back} onNavigate={onNavigate} />
      <h1 className="ugc" data-copy-role="heading">{name ? fill(copy.title, { name }) : copy.titleFallback}</h1>
      <Copy role="body">{copy.intro}</Copy>
    </header>
    {body}
  </div>;

  if (load.status === 'loading') return root(<PageLoading label={copy.loading} />);
  if (load.status === 'failed') {
    if (isRefusal(load.failure.code)) return root(<EmptyState heading={copy.forbiddenTitle} body={copy.forbiddenBody} />);
    return root(<FailureState failure={load.failure} copy={copy} retrying={retrying} onRetry={() => { setRetrying(true); void read(); }} />);
  }

  const { sessions, hasMore, flags } = load.history;
  const speakerName = name ?? copy.childSpeaker;
  return root(<>
    {flags.length > 0 ? <Flags flags={flags} copy={copy} locale={locale} transport={transport} speakerName={speakerName} open={open} onOpen={setOpen} /> : null}
    <MemoryNotesReview key={`notes:${kidId}`} kidId={kidId} copy={notesCopy} locale={locale} transport={transport} />
    <div className="lf-console-group-items">
      <MicrophoneConsent key={`mic:${kidId}`} kidId={kidId} name={name ?? copy.childSpeaker} copy={consentCopy} locale={locale} transport={transport} />
    </div>
    <ChildDisposition key={`profile:${kidId}`} kidId={kidId} copy={profileCopy} locale={locale} dark={dark} transport={transport} />
    <Kept key={`kept:${kidId}`} kidId={kidId} copy={copy} locale={locale} transport={transport} />
    <section className="lf-console-group" aria-labelledby="child-mentor-talks" data-console-part="sessions">
      <h2 id="child-mentor-talks" data-copy-role="heading">{copy.sessionsTitle}</h2>
      {sessions.length === 0 ? <Copy role="body">{copy.empty}</Copy>
        : <ul className="lf-console-list">
          {sessions.map((session) => <Session key={session.id} session={session} copy={copy} locale={locale} transport={transport} speakerName={speakerName}
            open={open === `session:${session.id}`} onToggle={() => setOpen(open === `session:${session.id}` ? null : `session:${session.id}`)} />)}
        </ul>}
      {hasMore ? <ButtonGroup>
        <Button pending={more === 'loading'} pendingLabel={copy.loadingMore} onClick={() => void loadMore()}>{copy.more}</Button>
      </ButtonGroup> : null}
      {more === 'failed' ? <InlineNotice tone="error" live>{copy.moreFailed}</InlineNotice> : null}
      <Copy role="body">{copy.retention}</Copy>
    </section>
  </>);
}

function Flags({ flags, copy, locale, transport, speakerName, open, onOpen }: {
  flags: SafetyFlag[]; copy: ChildMentorCopy; locale: string; transport: ConsoleTransport; speakerName: string; open: string | null; onOpen: (key: string | null) => void;
}) {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return <Card as="div">
    <section className="lf-console-group" aria-labelledby="child-mentor-flags" data-console-part="flags">
      {/* Most severe first: each row's severity chip says so, so no sentence repeats it (06 §5 rule 5). */}
      <h2 id="child-mentor-flags" data-copy-role="heading">{copy.flagsTitle}</h2>
      <ul className="lf-console-list">
        {flags.map((flag) => {
          const severity = SEVERITY[flag.severity] ?? SEVERITY.low!;
          const key = `flag:${flag.key}`;
          return <li key={flag.key} className="lf-console-item" data-severity={flag.severity} data-flag-source={flag.source}>
            <div className="lf-console-row">
              <div>
                <span data-copy-role="body">{pick(copy.category, flag.category)}</span>
                <Chip tone={severity.tone} glyph={severity.glyph} role="option">{copy[severity.key]}</Chip>
                <time dateTime={flag.createdAt} data-copy-role="data">{date.format(new Date(flag.createdAt))}</time>
                {flag.source === 'placement' ? <span data-copy-role="body">{copy.fromPlacement}</span> : null}
              </div>
              {flag.source === 'session'
                ? <Button size="sm" aria-expanded={open === key} onClick={() => onOpen(open === key ? null : key)}>{open === key ? copy.hide : copy.read}</Button>
                : null}
            </div>
            {flag.source === 'session' && open === key
              ? <Transcript sessionId={flag.sessionId} highlightSeq={flag.turnSeq} copy={copy} locale={locale} transport={transport} speakerName={speakerName} />
              : null}
          </li>;
        })}
      </ul>
    </section>
  </Card>;
}

function Session({ session, copy, locale, transport, speakerName, open, onToggle }: {
  session: MentorSession; copy: ChildMentorCopy; locale: string; transport: ConsoleTransport; speakerName: string; open: boolean; onToggle: () => void;
}) {
  const heading = useId();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const narrative = session.narrative;
  const practiced = narrative ? (narrative.topics.length === 1 ? fill(copy.practicedOne, { topic: narrative.topics[0]! })
    : narrative.topics.length === 2 ? fill(copy.practicedTwo, { topic1: narrative.topics[0]!, topic2: narrative.topics[1]! }) : null) : null;
  const struggle = narrative?.struggledTopic
    ? fill(narrative.struggleResolved ? copy.struggledResolved : copy.struggledOngoing, { topic: narrative.struggledTopic }) : null;
  return <li className="lf-console-item" data-session-id={session.id}>
    <section className="lf-console-row" aria-labelledby={heading}>
      <div>
        <h3 id={heading} data-copy-role="heading">{pick(copy.intent, session.intent)}</h3>
        {/* The narrative is structured data joined into whole translated sentences here, never a server-composed string. */}
        {practiced ? <span data-copy-role="body">{practiced}</span> : null}
        {struggle ? <span data-copy-role="body">{struggle}</span> : null}
        <span data-copy-role="data">
          <time dateTime={session.startedAt}>{date.format(new Date(session.startedAt))}</time>
          {' · '}{session.endedAt === null ? copy.ongoing : fill(copy.messages, { count: session.turnCount })}
        </span>
        {narrative && narrative.gradedTotal !== null && narrative.gradedTotal > 0
          ? <span data-copy-role="body">{fill(copy.score, { correct: narrative.gradedCorrect ?? 0, total: narrative.gradedTotal })}</span> : null}
        {session.closeReason !== null && session.closeReason !== 'completed'
          ? <span data-copy-role="body">{pick(copy.closeReason, session.closeReason)}</span> : null}
      </div>
      <Button size="sm" aria-expanded={open} onClick={onToggle}>{open ? copy.hide : copy.read}</Button>
    </section>
    {open ? <Transcript sessionId={session.id} highlightSeq={null} copy={copy} locale={locale} transport={transport} speakerName={speakerName} /> : null}
  </li>;
}

type TranscriptLoad = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; beats: TranscriptBeat[] };

function Transcript({ sessionId, highlightSeq, copy, locale, transport, speakerName }: {
  sessionId: string; highlightSeq: number | null; copy: ChildMentorCopy; locale: string; transport: ConsoleTransport; speakerName: string;
}) {
  const [load, setLoad] = useState<TranscriptLoad>({ status: 'loading' });
  const highlight = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    let live = true;
    void fetchTranscript(transport, sessionId).then((result) => {
      if (live) setLoad(result.ok ? { status: 'ready', beats: result.data } : { status: 'failed' });
    });
    return () => { live = false; };
  }, [transport, sessionId]);
  // A highlight nobody can see is not a highlight: the flagged moment scrolls into view once it exists.
  useEffect(() => { highlight.current?.scrollIntoView?.({ block: 'center' }); }, [load.status]);

  if (load.status === 'loading') return <LoadingState label={copy.transcriptLoading} lines={3} />;
  if (load.status === 'failed') return <InlineNotice tone="error" live>{copy.transcriptFailed}</InlineNotice>;
  const signed = new Intl.NumberFormat(locale, { signDisplay: 'exceptZero', maximumFractionDigits: 0 });
  const list = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
  const boardText = (board: BoardNote) => board.label ? fill(copy.board, { label: board.label }) : copy.boardUnlabeled;
  return <ol className="lf-console-transcript" data-console-part="transcript">
    {load.beats.map((beat) => {
      if (beat.kind === 'activity') {
        return <li key={beat.id} className="lf-console-beat" data-speaker="activity">
          <span className="lf-console-speaker" data-copy-role="body">{copy.activity}</span>
          {beat.prompt ? <span className="lf-console-ugc" data-copy-role="data">{beat.prompt}</span> : null}
          <span data-copy-role="body">{beat.score === null ? copy.unanswered : fill(copy.scored, { score: Math.round(beat.score) })}
            {beat.xpAwarded > 0 ? ` · ${fill(copy.xp, { count: beat.xpAwarded })}` : ''}</span>
        </li>;
      }
      const flagged = highlightSeq !== null && beat.seq === highlightSeq;
      const speaker = beat.kind === 'mentor' ? copy.mentorSpeaker : beat.kind === 'child' ? speakerName : copy.noteSpeaker;
      return <li key={beat.id} ref={flagged ? highlight : undefined} className="lf-console-beat" data-speaker={beat.kind} data-flagged={flagged || undefined}>
        <span className="lf-console-speaker ugc" data-copy-role="data">{speaker}{flagged ? ` · ${copy.flagged}` : ''}</span>
        <span className="lf-console-ugc" data-copy-role="data">{beat.text}</span>
        {beat.board ? <span data-copy-role="data" data-board-kind={beat.board.kind}>{boardText(beat.board)}</span> : null}
        {beat.demonstrated.length > 0
          ? <span data-copy-role="data">{fill(copy.demonstrated, { steps: list.format(beat.demonstrated.map((step) => signed.format(step))) })}</span> : null}
      </li>;
    })}
  </ol>;
}

type NotesLoad = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; notes: Notes };

function MemoryNotesReview({ kidId, copy, locale, transport }: { kidId: string; copy: MemoryNotesCopy; locale: string; transport: ConsoleTransport }) {
  const [load, setLoad] = useState<NotesLoad>({ status: 'loading' });
  const [decided, setDecided] = useState<Record<string, MemoryDecision | 'busy'>>({});
  const read = useCallback(async () => {
    setLoad({ status: 'loading' });
    const result = await fetchMemoryNotes(transport, kidId);
    setLoad(result.ok ? { status: 'ready', notes: result.data } : { status: 'failed' });
  }, [transport, kidId]);
  useEffect(() => { void read(); }, [read]);

  async function decide(noteId: string, verdict: 'approved' | 'rejected') {
    if (decided[noteId]) return;
    setDecided((previous) => ({ ...previous, [noteId]: 'busy' }));
    // Every outcome keeps its own state: an approval Core refused is never shown as landed.
    const outcome = await decideMemoryNote(transport, noteId, verdict);
    setDecided((previous) => ({ ...previous, [noteId]: outcome }));
  }

  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return <Card as="div">
    <section className="lf-console-group" aria-labelledby="child-mentor-notes" data-console-part="memory-notes" aria-busy={load.status === 'loading'}>
      <h2 id="child-mentor-notes" data-copy-role="heading">{copy.title}</h2>
      <Copy role="body">{copy.body}</Copy>
      {load.status === 'loading' ? <LoadingState label={copy.loading} lines={2} />
        : load.status === 'failed' ? <>
          <InlineNotice tone="error" live>{copy.loadFailed}</InlineNotice>
          <ButtonGroup><Button size="sm" onClick={() => void read()}>{copy.retry}</Button></ButtonGroup>
        </> : <>
          {/* No note and nothing waiting is one line, not two. */}
          {load.notes.current === null && load.notes.proposals.length === 0 ? <Copy role="body">{copy.currentEmpty}</Copy> : <div className="lf-console-note-now">
            <span className="lf-console-speaker" data-copy-role="body">{copy.current}</span>
            {load.notes.current ? <span className="lf-console-ugc" data-copy-role="data">{load.notes.current}</span> : <Copy role="body">{copy.currentEmpty}</Copy>}
          </div>}
          {load.notes.proposals.length === 0 ? (load.notes.current === null ? null : <Copy role="body">{copy.empty}</Copy>) : <ul className="lf-console-list">
            {load.notes.proposals.map((note) => {
              const state = decided[note.id];
              // Written against another note than the one in force: marked before anyone taps.
              const outOfDate = note.expectedBefore !== load.notes.current;
              return <li key={note.id} className="lf-console-item" data-memory-note={note.id} data-out-of-date={outOfDate || undefined}>
                <div className="lf-console-row">
                  <span data-copy-role="data">{fill(copy.proposed, { date: date.format(new Date(note.createdAt)) })}</span>
                  {outOfDate && state !== 'approved' && state !== 'rejected' ? <Chip tone="warning" glyph="warning" role="option">{copy.outOfDate}</Chip> : null}
                </div>
                <span className="lf-console-ugc" data-copy-role="data">{note.proposed}</span>
                {note.expectedBefore !== null ? <div className="lf-console-replaces">
                  <span className="lf-console-speaker" data-copy-role="body">{copy.replaces}</span>
                  <span className="lf-console-ugc" data-copy-role="data">{note.expectedBefore}</span>
                </div> : null}
                {state === 'approved' || state === 'rejected'
                  ? <InlineNotice tone="success" live>{state === 'approved' ? copy.approved : copy.rejected}</InlineNotice>
                  : <ButtonGroup>
                    <Button size="sm" variant="success" disabled={state === 'busy'} onClick={() => void decide(note.id, 'approved')}>{copy.approve}</Button>
                    <Button size="sm" disabled={state === 'busy'} onClick={() => void decide(note.id, 'rejected')}>{copy.reject}</Button>
                  </ButtonGroup>}
                {state === 'stale' ? <InlineNotice tone="info" live>{copy.stale}</InlineNotice> : null}
                {state === 'failed' ? <InlineNotice tone="error" live>{copy.failed}</InlineNotice> : null}
              </li>;
            })}
          </ul>}
          {load.notes.proposals.length > 0 && load.notes.proposals.every((note) => decided[note.id] && decided[note.id] !== 'busy')
            ? <Copy role="body">{copy.allDone}</Copy> : null}
        </>}
    </section>
  </Card>;
}

function ChildDisposition({ kidId, copy, locale, dark, transport }: { kidId: string; copy: DispositionSummaryCopy; locale: string; dark: boolean; transport: ConsoleTransport }) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [data, setData] = useState<DispositionSummaryData | null>(null);
  const [reset, setReset] = useState<'idle' | 'resetting' | 'done' | 'failed'>('idle');
  const read = useCallback(async () => {
    const result = await fetchDisposition(transport, kidId);
    if (result.ok) { setData(result.data); setPhase('ready'); } else setPhase('failed');
  }, [transport, kidId]);
  useEffect(() => { void read(); }, [read]);
  return <div className="lf-console-share" data-console-part="disposition">
    <DispositionSummary copy={copy} locale={locale} dark={dark} audience="child" phase={phase} data={data} canReset resetState={reset}
      onReset={() => {
        setReset('resetting');
        void resetDisposition(transport, kidId).then(async (result) => {
          setReset(result.ok ? 'done' : 'failed');
          if (result.ok) await read();
        });
      }} />
  </div>;
}

type KeptLoad = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; kept: KeptBoards };

/** Opt-in artifacts: hidden entirely when there is nothing, a quiet line when they could not load. */
function Kept({ kidId, copy, locale, transport }: { kidId: string; copy: ChildMentorCopy; locale: string; transport: ConsoleTransport }) {
  const [load, setLoad] = useState<KeptLoad>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    void fetchKeptBoards(transport, kidId).then((result) => { if (live) setLoad(result.ok ? { status: 'ready', kept: result.data } : { status: 'failed' }); });
    return () => { live = false; };
  }, [transport, kidId]);
  if (load.status === 'loading') return null;
  if (load.status === 'failed') return <InlineNotice tone="info">{copy.keptFailed}</InlineNotice>;
  const { plan, kept } = load.kept;
  if (!plan && kept.length === 0) return null;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const caption = (board: BoardNote) => board.label ? fill(copy.board, { label: board.label }) : copy.boardUnlabeled;
  return <Card as="div">
    <section className="lf-console-group" aria-labelledby="child-mentor-kept" data-console-part="kept">
      <h2 id="child-mentor-kept" data-copy-role="heading">{copy.keptTitle}</h2>
      <ul className="lf-console-list">
        {plan ? <li className="lf-console-item" data-kept="plan">
          <span className="lf-console-speaker" data-copy-role="body">{fill(copy.planLabel, { date: date.format(new Date(plan.updatedAt)) })}</span>
          <span className="lf-console-ugc" data-copy-role="data" data-board-kind={plan.board.kind}>{caption(plan.board)}</span>
        </li> : null}
        {kept.map((entry) => <li key={entry.id} className="lf-console-item" data-kept="board">
          <span className="lf-console-speaker" data-copy-role="body">{fill(copy.keptLabel, { date: date.format(new Date(entry.keptAt)) })}</span>
          <span className="lf-console-ugc" data-copy-role="data" data-board-kind={entry.board.kind}>{caption(entry.board)}</span>
        </li>)}
      </ul>
    </section>
  </Card>;
}

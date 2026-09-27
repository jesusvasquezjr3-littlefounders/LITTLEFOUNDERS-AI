import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Locale } from '../../design/copyBudget';
import {
  Button, ErrorState, InlineNotice, List, ListRow, LoadingState, MentorAvatar, MENTOR_NAMES, RadioGroup, SegmentedControl, Switch, TextField,
  type MentorCharacter,
} from '../../design/controls';
import { findMentorAvatar, MENTOR_CHARACTERS } from '../../design/assets';
import { MENTOR_STAGE_LIGHTS } from '../MentorStage';
import { ADAPTATION_KEYS, type TutorMapNode, type TutorMapResponse } from '../session/tutorApi';
import type { Adaptation, SessionSummary, TutorCatalog, TutorPreferences, TutorWhiteboardWire } from '../session/types';
import { MentorBoard, type MentorBoardCopy } from './MentorBoard';
import { mapSteps, waitsOn } from './mapModel';
import type { MentorData, MentorNotebook } from './mentorData';

/*
 * The Mentor screen's secondary views (T1a, T1e-T1g), each the body of a sheet
 * opened from the menu: the stage stays the screen, these are details behind a
 * tap (06 §4). Every view has its loading, failed and empty states, and none
 * shows anything Core did not send.
 */

export interface MentorPersonaliseCopy {
  menu: string; heading: string; companion: string; companionNone: string; island: string; islands: Record<string, string>;
  light: string; lights: Record<string, string>; nickname: string; nicknameHelp: string; nicknameSave: string; nicknameInvalid: string;
  nicknameRejected: string; adaptations: string; adaptation: Record<Adaptation, string>; on: string; off: string; saving: string; failed: string;
}
export interface MentorMapCopy {
  menu: string; heading: string; loading: string; failed: string; retry: string; empty: string; upNext: string; reviewCount: string;
  step: string; lockedBy: string; readOnly: string; states: Record<TutorMapNode['state'], string>;
}
export interface MentorNotebookCopy {
  menu: string; heading: string; loading: string; failed: string; retry: string; empty: string; lastTime: string; recap: string;
  recapMinutes: string; plan: string; planUpdated: string; kept: string; keptOn: string; keep: string; keeping: string; keptDone: string; keepFailed: string;
}
export interface MentorHistoryCopy {
  menu: string; heading: string; loading: string; failed: string; retry: string; empty: string; rowTitle: string;
  intents: Record<string, string>; detail: string;
}

export const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template);

type Load<T> = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; value: T };

/** Reads once when the view opens; "Try again" reads again. Null from Core is the failed state. */
function useLoad<T>(read: () => Promise<T | null>): [Load<T>, () => void] {
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load<T>>({ status: 'loading' });
  useEffect(() => {
    let current = true;
    setLoad({ status: 'loading' });
    read().then((value) => { if (current) setLoad(value === null ? { status: 'failed' } : { status: 'ready', value }); },
      () => { if (current) setLoad({ status: 'failed' }); });
    return () => { current = false; };
    // `read` is a method of a stable data object; a new attempt is the only reason to read again.
  }, [attempt]);
  return [load, useCallback(() => setAttempt((n) => n + 1), [])];
}

function Loaded<T>({ load, loading, failed, retry, onRetry, children }: {
  load: Load<T>; loading: string; failed: string; retry: string; onRetry: () => void; children: (value: T) => ReactNode;
}) {
  if (load.status === 'loading') return <LoadingState label={loading} lines={3} />;
  if (load.status === 'failed') return <ErrorState heading={failed} retryLabel={retry} retryingLabel={loading} onRetry={onRetry} />;
  return <>{children(load.value)}</>;
}

const dateOf = (iso: string, locale: Locale, time = false) => {
  const value = new Date(iso);
  return Number.isNaN(value.getTime()) ? '' : new Intl.DateTimeFormat(locale, time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(value);
};

/* ------------------------------------------------------------------ T1a */

const NICKNAME = /^[\p{L}\p{N}][\p{L}\p{N} '_-]*$/u;

/**
 * The learner's own island (T1a): a friend beside the Mentor, the island, its
 * light, a nickname (the only name the Mentor is ever told; Core refuses a
 * real name), and how the Mentor explains. Each choice is saved to Core before
 * it is shown; a refused save keeps what was there and says so. The Mentor
 * itself is chosen in its own sheet (08 §8).
 */
export function PersonaliseView({ copy, catalog, preferences, character, onSave }: {
  copy: MentorPersonaliseCopy; catalog: TutorCatalog | null; preferences: TutorPreferences; character: MentorCharacter;
  onSave: (patch: Partial<TutorPreferences>) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [nickname, setNickname] = useState(preferences.nickname ?? '');
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const save = async (patch: Partial<TutorPreferences>) => {
    setSaving(true); setFailed(false);
    const saved = await onSave(patch);
    setSaving(false); setFailed(!saved);
    return saved;
  };
  const friends = (catalog?.characters ?? [...MENTOR_CHARACTERS]).filter((id): id is MentorCharacter =>
    (MENTOR_CHARACTERS as readonly string[]).includes(id) && id !== character);
  const islands = (catalog?.dioramas ?? []).filter((id) => copy.islands[id]);
  // `auto` first by name: the catalogue's order is not a contract.
  const lights = MENTOR_STAGE_LIGHTS.filter((id) => (catalog?.backdrops ?? []).includes(id));
  const adaptations = (catalog?.adaptations?.length ? catalog.adaptations : ADAPTATION_KEYS).filter((id) => copy.adaptation[id]);
  const submitNickname = async (event: FormEvent) => {
    event.preventDefault();
    const value = nickname.trim();
    if (value !== '' && !NICKNAME.test(value)) { setNicknameError(copy.nicknameInvalid); return; }
    setNicknameError(null);
    if ((value || null) === (preferences.nickname ?? null)) return;
    const saved = await save({ nickname: value || null });
    if (!saved) { setFailed(false); setNicknameError(copy.nicknameRejected); }
  };
  return <div className="lf-mentor-view" data-view="personalise" aria-busy={saving || undefined}>
    <RadioGroup legend={copy.companion} name="mentor-companion" disabled={saving}
      options={[{ value: 'none', label: copy.companionNone }, ...friends.map((id) => ({ value: id, label: MENTOR_NAMES[id] }))]}
      value={preferences.companion && preferences.companion !== character ? preferences.companion : 'none'}
      onValueChange={(value) => void save({ companion: value === 'none' ? null : value as MentorCharacter })} />
    {islands.length > 1 ? <SegmentedControl legend={copy.island} name="mentor-island" disabled={saving}
      options={islands.map((id) => ({ value: id, label: copy.islands[id]! }))} value={preferences.diorama}
      onValueChange={(value) => void save({ diorama: value })} /> : null}
    {lights.length > 1 ? <RadioGroup legend={copy.light} name="mentor-light" disabled={saving}
      options={lights.map((id) => ({ value: id, label: copy.lights[id] ?? id }))} value={preferences.backdrop}
      onValueChange={(value) => void save({ backdrop: value })} /> : null}
    <form className="lf-mentor-view-form" onSubmit={(event) => void submitNickname(event)}>
      <TextField label={copy.nickname} help={copy.nicknameHelp} value={nickname} maxLength={24} autoComplete="off" disabled={saving}
        error={nicknameError ?? undefined} errorLive onChange={(event) => { setNickname(event.target.value); setNicknameError(null); }} />
      <Button type="submit" variant="secondary" disabled={saving}>{copy.nicknameSave}</Button>
    </form>
    <fieldset className="lf-mentor-view-group">
      <legend className="lf-input-label" data-copy-role="body">{copy.adaptations}</legend>
      {adaptations.map((id) => <Switch key={id} label={copy.adaptation[id]} checked={preferences.adaptations.includes(id)} pending={saving}
        stateLabels={{ on: copy.on, off: copy.off }}
        onCheckedChange={(on) => void save({ adaptations: on ? [...preferences.adaptations, id] : preferences.adaptations.filter((entry) => entry !== id) })} />)}
    </fieldset>
    {saving ? <p className="lf-mentor-view-status" data-copy-role="body" role="status">{copy.saving}</p> : null}
    {failed ? <InlineNotice tone="error" live>{copy.failed}</InlineNotice> : null}
  </div>;
}

/* ------------------------------------------------------------------ T1f */

const STATE_TONE: Record<TutorMapNode['state'], 'success' | 'reward' | 'primary' | 'sky' | null> = {
  mastered: 'success', needs_review: 'reward', in_progress: 'primary', available: 'sky', locked: null,
};

/**
 * The learning map (T1f): the skills in steps, each with its state in words
 * (never colour alone, never red), and a skill that is not open yet naming the
 * one it waits on. Outside a conversation a startable skill starts a practice
 * conversation; during one the map is read-only and says why.
 */
export function LearningMapView({ copy, data, canStart, conversing, onStart }: {
  copy: MentorMapCopy; data: Pick<MentorData, 'map'>; canStart: boolean; conversing: boolean;
  onStart: (skillKey: string | null) => void;
}) {
  const [load, retry] = useLoad<TutorMapResponse>(() => data.map());
  return <div className="lf-mentor-view" data-view="map">
    <Loaded load={load} loading={copy.loading} failed={copy.failed} retry={copy.retry} onRetry={retry}>{(map) => {
      if (map.nodes.length === 0) return <p data-copy-role="body">{copy.empty}</p>;
      const startable = canStart && !conversing;
      const press = (skillKey: string | null) => (startable ? () => onStart(skillKey) : undefined);
      return <>
        {conversing ? <InlineNotice tone="info">{copy.readOnly}</InlineNotice> : null}
        {map.continueTarget ? <List label={copy.upNext}>
          <ListRow title={map.continueTarget.title} titleRole="data"
            supporting={map.continueTarget.reason === 'review_due' ? copy.states.needs_review : copy.upNext}
            onPress={press(map.continueTarget.skillKey)} />
        </List> : null}
        {map.review.count > 0 ? <p data-copy-role="body">{fill(copy.reviewCount, { n: map.review.count })}</p> : null}
        {mapSteps(map).map(({ step, nodes }) => <section key={step} className="lf-mentor-view-section" aria-labelledby={`mentor-map-step-${step}`}>
          <h3 id={`mentor-map-step-${step}`} className="lf-mentor-view-heading" data-copy-role="heading">{fill(copy.step, { n: step })}</h3>
          <List label={fill(copy.step, { n: step })}>
            {nodes.map((node) => {
              const before = node.state === 'locked' ? waitsOn(map, node) : null;
              const tone = STATE_TONE[node.state];
              // The state in words (never colour alone, never red); a skill not open yet names what it waits on instead.
              return <ListRow key={node.kcKey} title={node.title} titleRole="data"
                supporting={node.state === 'locked' ? (before ? fill(copy.lockedBy, { title: before.title }) : copy.states.locked) : copy.states[node.state]}
                leading={tone ? <span className={`lf-mentor-map-mark lf-mentor-map-mark--${tone}`} aria-hidden="true" /> : <span className="lf-mentor-map-mark" aria-hidden="true" />}
                onPress={node.state === 'locked' ? undefined : press(node.skillKey)} />;
            })}
          </List>
        </section>)}
      </>;
    }}</Loaded>
  </div>;
}

/* ------------------------------------------------------------------ T1g */

/**
 * The plan and the kept boards (T1g): the savings plan the learner and the
 * Mentor built, the boards the learner chose to keep, and a recap of the last
 * conversation. Each board is drawn in the shared Pizarrón frame exactly as it
 * was shown, never recomputed.
 */
export function NotebookView({ copy, boardCopy, data, locale }: {
  copy: MentorNotebookCopy; boardCopy: MentorBoardCopy; data: Pick<MentorData, 'notebook'>; locale: Locale;
}) {
  const [load, retry] = useLoad<MentorNotebook>(() => data.notebook());
  return <div className="lf-mentor-view" data-view="notebook">
    <Loaded load={load} loading={copy.loading} failed={copy.failed} retry={copy.retry} onRetry={retry}>{({ plan, entries, recap }) => {
      if (!plan && entries.length === 0 && !recap) return <p data-copy-role="body">{copy.empty}</p>;
      // The last talk's board is often the plan itself: it is shown once. Two boards that share a title are told apart by
      // their date, so every board on this sheet has its own name (each is a labelled region).
      const same = (a: TutorWhiteboardWire, b: TutorWhiteboardWire) => JSON.stringify(a) === JSON.stringify(b);
      const recapBoard = recap?.board && !(plan && same(recap.board, plan.content)) && !entries.some((entry) => same(entry.whiteboard, recap.board!)) ? recap.board : null;
      const labelOf = (board: TutorWhiteboardWire) => (board as { label?: unknown }).label;
      const labels = [recapBoard, plan?.content, ...entries.map((entry) => entry.whiteboard)].filter(Boolean).map((board) => labelOf(board!));
      const titled = (board: TutorWhiteboardWire, when: string) => {
        const label = labelOf(board);
        return typeof label === 'string' && labels.filter((other) => other === label).length > 1 ? `${label} · ${when}` : undefined;
      };
      return <>
        {recap ? <section className="lf-mentor-view-section" aria-labelledby="mentor-notebook-recap">
          <h3 id="mentor-notebook-recap" className="lf-mentor-view-heading" data-copy-role="heading">{copy.lastTime}</h3>
          {/* XP only when some was earned: a zero reads as a mark against the talk. */}
          <p data-copy-role="data">{fill(recap.xp > 0 ? copy.recap : copy.recapMinutes, { minutes: recap.minutes, xp: recap.xp })}</p>
          {recapBoard ? <MentorBoard board={recapBoard} copy={boardCopy} locale={locale} title={titled(recapBoard, copy.lastTime)} /> : null}
        </section> : null}
        {plan ? <section className="lf-mentor-view-section" aria-labelledby="mentor-notebook-plan">
          <h3 id="mentor-notebook-plan" className="lf-mentor-view-heading" data-copy-role="heading">{copy.plan}</h3>
          <p data-copy-role="data">{fill(copy.planUpdated, { date: dateOf(plan.updatedAt, locale) })}</p>
          <MentorBoard board={plan.content} copy={boardCopy} locale={locale} title={titled(plan.content, copy.plan)} />
        </section> : null}
        {entries.length > 0 ? <section className="lf-mentor-view-section" aria-labelledby="mentor-notebook-kept">
          <h3 id="mentor-notebook-kept" className="lf-mentor-view-heading" data-copy-role="heading">{copy.kept}</h3>
          <ul className="lf-mentor-view-boards">
            {entries.map((entry) => <li key={entry.id}>
              <MentorBoard board={entry.whiteboard} copy={boardCopy} locale={locale} title={titled(entry.whiteboard, dateOf(entry.keptAt, locale))} />
              <p data-copy-role="data">{fill(copy.keptOn, { date: dateOf(entry.keptAt, locale) })}</p>
            </li>)}
          </ul>
        </section> : null}
      </>;
    }}</Loaded>
  </div>;
}

/** "Keep board" under a live board (T1c/T1g): names the turn; Core copies the board it really drew. */
export function KeepBoard({ copy, seq, onKeep }: { copy: MentorNotebookCopy; seq: number; onKeep: (seq: number) => Promise<boolean> }) {
  const [status, setStatus] = useState<'idle' | 'keeping' | 'kept' | 'failed'>('idle');
  useEffect(() => setStatus('idle'), [seq]);
  const keep = async () => { setStatus('keeping'); setStatus(await onKeep(seq) ? 'kept' : 'failed'); };
  return <div className="lf-mentor-keep">
    <Button size="sm" variant="secondary" data-keep={status} disabled={status === 'keeping' || status === 'kept'}
      onClick={() => void keep()}>{status === 'kept' ? copy.keptDone : status === 'keeping' ? copy.keeping : copy.keep}</Button>
    {status === 'failed' ? <InlineNotice tone="error" live>{copy.keepFailed}</InlineNotice> : null}
  </div>;
}

/* ------------------------------------------------------------------ T1e */

/**
 * Past conversations (T1e): who it was with, what kind of talk, when and how
 * long. Pressing one replays it on the stage. A row never carries a score: a
 * number on a list of talks reads as a grade on each.
 */
export function HistoryView({ copy, data, locale, theme, onReplay }: {
  copy: MentorHistoryCopy; data: Pick<MentorData, 'sessions'>; locale: Locale; theme: 'light' | 'dark';
  onReplay: (session: SessionSummary) => void;
}) {
  const [load, retry] = useLoad<SessionSummary[]>(() => data.sessions());
  return <div className="lf-mentor-view" data-view="history">
    <Loaded load={load} loading={copy.loading} failed={copy.failed} retry={copy.retry} onRetry={retry}>{(sessions) => {
      if (sessions.length === 0) return <p data-copy-role="body">{copy.empty}</p>;
      return <List label={copy.heading}>
        {sessions.map((session) => {
          const character = (MENTOR_CHARACTERS as readonly string[]).includes(session.character) ? session.character as MentorCharacter : null;
          const render = character ? findMentorAvatar(character, theme) : null;
          return <ListRow key={session.id} titleRole="body"
            title={fill(copy.rowTitle, { what: copy.intents[session.intent] ?? copy.intents.open ?? '', name: character ? MENTOR_NAMES[character] : '' })}
            supporting={fill(copy.detail, { date: dateOf(session.startedAt, locale, true), n: session.turnCount })}
            leading={render ? <MentorAvatar renderId={render} label={null} size="sm" /> : undefined}
            onPress={() => onReplay(session)} />;
        })}
      </List>;
    }}</Loaded>
  </div>;
}

import { useId, useState } from 'react';
import { Button, Chip, InlineNotice, SegmentedControl, SelectField, TextAreaField } from '../../design/controls';
import { Facts, LoadFailure, Loading, useFormats } from './ConsoleParts';
import { useStaffRead, type StaffApi } from './staffConsoleApi';
import { fill, useConsoleCopy } from './staffConsoleCopy';
import {
  emptyDraft, isStage3State, stage3Body, stage3Path, stage3Refusal, stage3Status, STAGE3_ITEMS,
  type Stage3Draft, type Stage3ItemId, type Stage3RefusalKey, type Stage3Resolution, type Stage3Result, type Stage3State,
} from './stage3Api';

/*
 * Appendix C Part 3 Stage 3 (Pedagogical Human Review), GAP-FIX-R6 learning,
 * inside the lesson review sheet (the lesson's current content) and the G.2
 * version sheet (one v2 version). It shows whether a passing review covers the
 * content, and records one: the six Block B checks and the four Stage 3
 * questions, each with a result and a named finding, a resolution and a note
 * for every open Forge flag, and the Content Author (never the reviewer; Core
 * leaves the reviewer out of the list and Vault refuses it anyway). Core
 * derives pass or fail; a release of content no passing review covers is
 * refused (RELEASE_STAGE3_REVIEW_REQUIRED).
 */

const STATUS_CHIP = {
  passed: { tone: 'success', glyph: 'check', key: 'passed' },
  failed: { tone: 'error', glyph: 'warning', key: 'failed' },
  itemsOpen: { tone: 'warning', glyph: 'info', key: 'needed' },
  needed: { tone: 'warning', glyph: 'info', key: 'needed' },
} as const;

type Saved = { kind: 'recorded'; result: 'pass' | 'fail' } | { kind: 'refused'; key: Stage3RefusalKey } | { kind: 'failed' };

function Stage3Form({ api, state, onSaved }: { api: StaffApi; state: Stage3State; onSaved: () => void }) {
  const { copy } = useConsoleCopy();
  const t = copy.stage3;
  const name = useId();
  const [draft, setDraft] = useState<Stage3Draft>(emptyDraft);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const body = stage3Body(state, draft);
  const setCheck = (id: Stage3ItemId, patch: Partial<{ result: Stage3Result | null; finding: string }>) =>
    setDraft((current) => ({ ...current, checks: { ...current.checks, [id]: { result: null, finding: '', ...current.checks[id], ...patch } } }));
  const setFlag = (id: string, patch: Partial<{ resolution: Stage3Resolution | null; note: string }>) =>
    setDraft((current) => ({ ...current, forgeItems: { ...current.forgeItems, [id]: { resolution: null, note: '', ...current.forgeItems[id], ...patch } } }));
  const save = async () => {
    if (!body) return;
    setPending(true);
    setSaved(null);
    const result = await api.post<{ reviewId: string; result: 'pass' | 'fail' }>(stage3Path(state.lessonId), body);
    setPending(false);
    if (result.ok) {
      setSaved({ kind: 'recorded', result: result.data.result === 'fail' ? 'fail' : 'pass' });
      setDraft(emptyDraft());
      onSaved();
      return;
    }
    const key = stage3Refusal(result.code);
    setSaved(key ? { kind: 'refused', key } : { kind: 'failed' });
  };
  const item = (entry: (typeof STAGE3_ITEMS)[number]) => {
    const value = draft.checks[entry.id];
    const options = (entry.allowsNotApplicable ? ['pass', 'fail', 'not_applicable'] as const : ['pass', 'fail'] as const)
      .map((option) => ({ value: option, label: t.option[option] }));
    return <div key={entry.id} className="lf-staff-stack" data-stage3-item={entry.id}>
      <SegmentedControl<Stage3Result> legend={t.body[`q_${entry.id}`]} name={`${name}-${entry.id}`} value={value?.result ?? null}
        options={options} onValueChange={(result) => setCheck(entry.id, { result })} />
      <TextAreaField label={t.body.finding} help={t.body.findingHelp} value={value?.finding ?? ''} maxLength={600}
        onChange={(event) => setCheck(entry.id, { finding: event.target.value })} />
    </div>;
  };
  return <form className="lf-staff-stack" data-form="stage3-review" onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <h4 data-copy-role="heading" className="lf-staff-subheading">{t.heading.form}</h4>
    {state.versionAuthorId ? <p data-copy-role="body">{t.body.authorFixed}</p>
      : state.authors.length === 0 ? <InlineNotice tone="error">{t.body.noAuthors}</InlineNotice>
        : <SelectField label={t.body.author} help={t.body.authorHelp} value={draft.authorId} required
          onChange={(event) => setDraft((current) => ({ ...current, authorId: event.target.value }))}
          options={[{ value: '', label: t.body.authorPick }, ...state.authors.map((author) => ({ value: author.userId, label: author.displayName || author.userId, role: 'data' as const }))]} />}
    <h4 data-copy-role="heading" className="lf-staff-subheading">{t.heading.checks}</h4>
    {STAGE3_ITEMS.filter((entry) => entry.group === 'check').map(item)}
    <h4 data-copy-role="heading" className="lf-staff-subheading">{t.heading.questions}</h4>
    {STAGE3_ITEMS.filter((entry) => entry.group === 'question').map(item)}
    {state.openItems.length > 0 ? <>
      <h4 data-copy-role="heading" className="lf-staff-subheading">{t.heading.forgeItems}</h4>
      {state.openItems.map((flag) => <div key={flag.id} className="lf-staff-stack" data-stage3-flag={flag.id}>
        <p data-copy-role="body" className="lf-staff-muted">{fill(t.body.gate, { n: flag.gate })}{flag.locale ? ` · ${flag.locale}` : ''}</p>
        <p data-copy-role="data" className="ugc">{flag.message}</p>
        <SegmentedControl<Stage3Resolution> legend={fill(t.body.gate, { n: flag.gate })} legendHidden name={`${name}-${flag.id}`}
          value={draft.forgeItems[flag.id]?.resolution ?? null}
          options={(['acceptable', 'needs_change'] as const).map((option) => ({ value: option, label: t.option[option] }))}
          onValueChange={(resolution) => setFlag(flag.id, { resolution })} />
        <TextAreaField label={t.body.note} help={t.body.findingHelp} value={draft.forgeItems[flag.id]?.note ?? ''} maxLength={600}
          onChange={(event) => setFlag(flag.id, { note: event.target.value })} />
      </div>)}
    </> : null}
    {body ? null : <p data-copy-role="body" className="lf-staff-muted">{t.body.incomplete}</p>}
    <div><Button type="submit" variant="success" disabled={pending || !body}>{pending ? t.action.saving : t.action.save}</Button></div>
    {saved?.kind === 'recorded' ? <InlineNotice tone={saved.result === 'pass' ? 'success' : 'error'} live>
      {saved.result === 'pass' ? t.body.recordedPass : t.body.recordedFail}</InlineNotice> : null}
    {saved?.kind === 'refused' ? <InlineNotice tone="error" live>{t.body[saved.key]}</InlineNotice> : null}
    {saved?.kind === 'failed' ? <InlineNotice tone="error" live>{copy.common.body.actionFailed}</InlineNotice> : null}
  </form>;
}

/** The Stage 3 panel of one lesson (current content) or one v2 version. */
export function Stage3Review({ api, lessonId, versionId, onRecorded }: { api: StaffApi; lessonId: string; versionId?: string; onRecorded?: () => void }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.stage3;
  const read = useStaffRead(api, stage3Path(lessonId, versionId), isStage3State);
  const [open, setOpen] = useState(false);
  const formId = useId();
  const state = read.load.state === 'ready' ? read.load.data : null;
  const status = state ? stage3Status(state) : null;
  const chip = status ? STATUS_CHIP[status] : null;
  const note = status === 'passed' ? t.body.passedNote : status === 'failed' ? t.body.failedNote : status === 'itemsOpen' ? t.body.itemsOpen : t.body.noneYet;
  return <section className="lf-staff-stack" aria-label={t.heading.review} data-stage3={status ?? read.load.state}>
    <h3 data-copy-role="heading" className="lf-staff-subheading">{t.heading.review}</h3>
    <p data-copy-role="body" className="lf-staff-muted">{t.body.intro}</p>
    {read.load.state === 'loading' ? <Loading />
      : read.load.state === 'error' ? <LoadFailure code={read.load.code} onRetry={read.reload} />
        : state && chip ? <>
          <div><Chip tone={chip.tone} glyph={chip.glyph}>{t.body[chip.key]}</Chip></div>
          <InlineNotice tone={status === 'passed' ? 'success' : 'info'}>{note}</InlineNotice>
          {state.latest ? <Facts items={[
            { id: 'latest', label: t.heading.latest, value: state.latest.result === 'pass' ? t.body.passed : t.body.failed },
            { id: 'findings', label: t.body.findings, value: format.number(state.latest.findingCount) },
            { id: 'recorded', label: t.body.recorded, value: format.dateTime(state.latest.recordedAt, copy.common.body.notAvailable) },
            { id: 'flags', label: t.body.openFlags, value: format.number(state.openItems.length) },
          ]} /> : <Facts items={[{ id: 'flags', label: t.body.openFlags, value: format.number(state.openItems.length) }]} />}
          <div className="lf-staff-actions">
            <Button aria-expanded={open} aria-controls={formId} onClick={() => setOpen(!open)}>{open ? t.action.hide : t.action.open}</Button>
          </div>
          <div id={formId} hidden={!open}>
            {open ? <Stage3Form api={api} state={state} onSaved={() => { read.reload(); onRecorded?.(); }} /> : null}
          </div>
        </> : null}
  </section>;
}

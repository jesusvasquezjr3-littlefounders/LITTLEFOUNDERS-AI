import { useMemo, useState } from 'react';
import { Button, ButtonGroup, Chip, ConfirmDialog, DataTable, EmptyState, InlineNotice, SelectField, Sheet, type TableColumn } from '../../design/controls';
import { useStaffRead, type StaffApi } from './staffConsoleApi';
import { CopyId, Facts, LoadFailure, Loading, Metrics, shortId, StaffPage, useFormats } from './ConsoleParts';
import { labelOf, useConsoleCopy, type ConsoleCopy } from './staffConsoleCopy';

/*
 * E.4 (as amended by OD-3), Appendix J 1.1: the staff-reviewed age correction
 * queue (manage_users). A self-registered account's age is locked after its
 * first declaration; with no guardian to re-confirm, the account asks and a
 * staff member decides here, after checking the evidence outside the app.
 *
 * A request shows only what Core keeps: the saved and the requested age group
 * and, for a 13-17 group, the birth month (never a day, never a name). Core
 * and the database decide who may decide (manage_users, never the requester)
 * and apply an approval and its audit row in one transaction; this screen asks
 * for a reason that matches the decision and confirms before sending.
 */

export type AgeBand = 'under_13' | '13_to_17' | 'adult';
export type CorrectionStatus = 'pending' | 'approved' | 'rejected';
export interface AgeCorrection {
  id: string; userId: string; status: CorrectionStatus; fromBand: AgeBand; requestedBand: AgeBand; requestedBirthMonth: string | null;
  reason: string | null; createdAt: string; decidedAt: string | null; decidedBy: string | null;
}

const BANDS: readonly string[] = ['under_13', '13_to_17', 'adult'];
const STATUSES: readonly string[] = ['pending', 'approved', 'rejected'];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNullableString = (value: unknown) => value === null || typeof value === 'string';

function isCorrection(value: unknown): value is AgeCorrection {
  return isRecord(value) && typeof value.id === 'string' && typeof value.userId === 'string' && STATUSES.includes(value.status as string)
    && BANDS.includes(value.fromBand as string) && BANDS.includes(value.requestedBand as string) && isNullableString(value.requestedBirthMonth)
    && isNullableString(value.reason) && typeof value.createdAt === 'string' && isNullableString(value.decidedAt) && isNullableString(value.decidedBy);
}
export const isCorrections = (value: unknown): value is { requests: AgeCorrection[] } =>
  isRecord(value) && Array.isArray(value.requests) && value.requests.every(isCorrection);

type Filter = CorrectionStatus | 'all';
export const correctionsPath = (filter: Filter) => `/admin/age-corrections?status=${filter}&limit=200`;
export const APPROVE_REASONS = ['evidence_verified', 'entry_error'] as const;
export const REJECT_REASONS = ['evidence_missing', 'not_credible'] as const;

function statusChip(copy: ConsoleCopy, status: CorrectionStatus) {
  const t = copy.ageCorrections.option;
  return status === 'pending' ? <Chip tone="warning" glyph="info">{t.pending}</Chip>
    : status === 'approved' ? <Chip tone="success" glyph="check">{t.approved}</Chip> : <Chip tone="sky" glyph="info">{t.rejected}</Chip>;
}

function Decision({ api, entry, onClose, onDecided }: { api: StaffApi; entry: AgeCorrection; onClose: () => void; onDecided: () => void }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.ageCorrections;
  const [approve, setApprove] = useState<boolean | null>(null);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<'approved' | 'rejected' | 'failed' | 'self' | 'notPending' | null>(null);
  const reasons = approve === null ? [] : approve ? APPROVE_REASONS : REJECT_REASONS;
  const band = (value: string) => labelOf(t.option, value);

  const send = async () => {
    if (approve === null || !reason) return;
    setPending(true);
    const result = await api.post<{ status: CorrectionStatus }>(`/admin/age-corrections/${entry.id}/decision`, { decision: approve ? 'approve' : 'reject', reason });
    setPending(false);
    setApprove(null);
    if (result.ok) { setOutcome(approve ? 'approved' : 'rejected'); onDecided(); return; }
    setOutcome(result.code === 'SELF_DECISION' ? 'self' : result.code === 'NOT_PENDING' ? 'notPending' : 'failed');
  };

  return <><Sheet open onClose={onClose} heading={t.heading.request} closeLabel={copy.common.action.close}>
    <div className="lf-staff-sheet" data-sheet="age-correction">
      <Facts items={[
        { id: 'account', label: t.body.account, value: entry.userId, ugc: true },
        { id: 'status', label: t.body.status, value: statusChip(copy, entry.status) },
        { id: 'from', label: t.body.from, value: band(entry.fromBand) },
        { id: 'to', label: t.body.to, value: band(entry.requestedBand) },
        { id: 'month', label: t.body.month, value: entry.requestedBirthMonth ?? copy.common.body.notAvailable },
        { id: 'requested', label: t.body.requested, value: format.dateTime(entry.createdAt, copy.common.body.notAvailable) },
        ...(entry.decidedAt ? [{ id: 'decided', label: t.body.decidedAt, value: format.dateTime(entry.decidedAt, copy.common.body.notAvailable) },
          { id: 'reason', label: t.body.reason, value: entry.reason ? labelOf(t.option, entry.reason) : copy.common.body.notAvailable }] : []),
      ]} />
      <CopyId value={entry.userId} />
      {entry.status === 'pending' && outcome === null ? <>
        <InlineNotice tone="info">{t.body.help}</InlineNotice>
        <SelectField label={t.body.reason} value={reason} onChange={(event) => setReason(event.target.value)}
          options={[{ value: '', label: t.option.chooseReason },
            ...[...APPROVE_REASONS, ...REJECT_REASONS].map((value) => ({ value, label: t.option[value] }))]} />
        <ButtonGroup>
          <Button variant="success" aria-haspopup="dialog" disabled={!(APPROVE_REASONS as readonly string[]).includes(reason)}
            onClick={() => setApprove(true)}>{t.action.approve}</Button>
          <Button aria-haspopup="dialog" disabled={!(REJECT_REASONS as readonly string[]).includes(reason)}
            onClick={() => setApprove(false)}>{t.action.reject}</Button>
        </ButtonGroup>
      </> : null}
      {outcome === 'approved' ? <InlineNotice tone="success" live>{t.body.approved}</InlineNotice> : null}
      {outcome === 'rejected' ? <InlineNotice tone="success" live>{t.body.rejected}</InlineNotice> : null}
      {outcome === 'failed' ? <InlineNotice tone="error" live>{t.body.failed}</InlineNotice> : null}
      {outcome === 'self' ? <InlineNotice tone="error" live>{t.body.self}</InlineNotice> : null}
      {outcome === 'notPending' ? <InlineNotice tone="error" live>{t.body.notPending}</InlineNotice> : null}
    </div>
  </Sheet>
    <ConfirmDialog open={approve !== null && reasons.length > 0} heading={approve ? t.heading.confirmApprove : t.heading.confirmReject}
      consequence={approve ? t.body.approveConsequence : t.body.rejectConsequence} keepLabel={t.action.keep}
      confirmLabel={approve ? t.action.approve : t.action.reject} pendingLabel={t.action.saving} pending={pending}
      onKeep={() => setApprove(null)} onConfirm={() => void send()} />
  </>;
}

export function StaffAgeCorrections({ api }: { api: StaffApi }) {
  const { copy, sections, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.ageCorrections;
  const [filter, setFilter] = useState<Filter>('pending');
  const read = useStaffRead(api, correctionsPath(filter), isCorrections);
  // The request as it was opened: a decision reloads the queue, and the sheet keeps showing its outcome.
  const [chosen, setChosen] = useState<AgeCorrection | null>(null);
  const list = useMemo(() => (read.load.state === 'ready' ? read.load.data.requests : []), [read.load]);
  const band = (value: string) => labelOf(t.option, value);

  const columns: TableColumn<AgeCorrection>[] = [
    { key: 'account', label: t.body.account, value: (entry) => shortId(entry.userId) },
    { key: 'from', label: t.body.from, value: (entry) => band(entry.fromBand) },
    { key: 'to', label: t.body.to, value: (entry) => band(entry.requestedBand) },
    { key: 'requested', label: t.body.requested, value: (entry) => format.dateTime(entry.createdAt, copy.common.body.notAvailable) },
    { key: 'status', label: t.body.status, value: (entry) => statusChip(copy, entry.status) },
    { key: 'details', label: copy.common.body.details, value: (entry) => <Button size="sm" onClick={() => setChosen(entry)}>{copy.common.action.open}</Button> },
  ];

  return <StaffPage screen="staff-age-corrections" title={sections.ageCorrections}
    actions={<Button size="sm" onClick={read.reload}>{copy.common.action.refresh}</Button>}>
    <div className="lf-staff-filters">
      <SelectField label={t.body.status} value={filter} onChange={(event) => setFilter(event.target.value as Filter)}
        options={[{ value: 'pending', label: t.option.pending }, { value: 'approved', label: t.option.approved },
          { value: 'rejected', label: t.option.rejected }, { value: 'all', label: t.option.all }]} />
    </div>
    {read.load.state === 'loading' || read.load.state === 'idle' ? <Loading />
      : read.load.state === 'error' ? <LoadFailure code={read.load.code} onRetry={read.reload} />
        : <>
          <Metrics label={sections.ageCorrections} items={[{ id: 'shown', label: t.body.shown, value: format.number(list.length) }]} />
          {list.length === 0 ? <EmptyState heading={t.body.empty} />
            : <DataTable caption={t.heading.requests} columns={columns} rows={list} rowKey={(entry) => entry.id} />}
        </>}
    {chosen ? <Decision key={chosen.id} api={api} entry={chosen} onClose={() => setChosen(null)} onDecided={read.reload} /> : null}
  </StaffPage>;
}

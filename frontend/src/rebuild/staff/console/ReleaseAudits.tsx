import { useState } from 'react';
import { Button, Card, InlineNotice, SegmentedControl, SelectField, TextAreaField, TextField } from '../../design/controls';
import type { MentorQualityDashboardData, OwnerRole, ReleaseAuditKind } from '../mentorQualityApi';
import { RELEASE_AUDIT_KINDS } from '../mentorQualityApi';
import type { StaffApi } from './staffConsoleApi';
import { useFormats } from './ConsoleParts';
import { fill, useConsoleCopy } from './staffConsoleCopy';

/*
 * GAP-FIX-R2 (Product C.24, Appendix C 1.2): the per-release manual audits
 * the dashboard reads. B.25 (dark patterns) and B.22 (variable-ratio rewards)
 * belong to the Safety and Trust lead, B.20 (reward framing) to the
 * pedagogical lead. Each kind shows its latest recorded audit; a named owner
 * records the next one here. Core (POST /admin/mentor-quality/audits) and
 * Vault (record_release_audit) enforce the owner and audit the write; the
 * form is shown only to an owner as a courtesy, never as the control.
 */

const RELEASE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

export function ReleaseAudits({ api, data, onRecorded }: { api: StaffApi; data: MentorQualityDashboardData; onRecorded: () => void }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.mentorQuality;
  const audits = data.releaseAudits;
  const owned = audits ? audits.kinds.filter((entry) => data.viewerOwnerRoles.includes(entry.ownerRole as OwnerRole)).map((entry) => entry.kind) : [];
  const [kind, setKind] = useState<ReleaseAuditKind | ''>(owned[0] ?? '');
  const [releaseId, setReleaseId] = useState('');
  const [result, setResult] = useState<'pass' | 'fail'>('pass');
  const [findings, setFindings] = useState('1');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  if (!audits) return null;
  const count = result === 'fail' ? Number(findings) : 0;
  const valid = kind !== '' && RELEASE_ID.test(releaseId.trim()) && (result === 'pass' || (Number.isInteger(count) && count >= 1 && count <= 10_000));
  const submit = async () => {
    if (!valid) return;
    setPending(true);
    setOutcome(null);
    const response = await api.post('/admin/mentor-quality/audits', {
      kind, releaseId: releaseId.trim(), result, findingCount: count, ...(note.trim() ? { note: note.trim() } : {}),
    });
    setPending(false);
    setOutcome(response.ok ? 'recorded' : response.code);
    if (response.ok) { setReleaseId(''); setNote(''); onRecorded(); }
  };
  const message = outcome === 'recorded' ? t.body.auditRecorded : outcome === 'NOT_NAMED_OWNER' ? t.body.auditNotOwner
    : outcome === 'ALREADY_RECORDED' ? t.body.auditDuplicate : outcome === 'VALIDATION_ERROR' ? t.body.auditInvalid
      : outcome ? copy.common.body.actionFailed : null;
  return <Card heading={t.heading.audits} headingLevel={2}>
    <div className="lf-staff-section" data-tool="release-audits">
      <p data-copy-role="body" className="lf-staff-muted">{fill(t.body.auditsIntro, { days: format.number(audits.cadenceDays) })}</p>
      <ul className="lf-staff-reports" aria-label={t.heading.audits}>
        {audits.kinds.map((entry) => <li key={entry.kind} data-audit-kind={entry.kind}>
          <p data-copy-role="body" className="lf-staff-report-category">{t.option[entry.kind]}</p>
          <p data-copy-role="data" className="lf-staff-muted">{entry.latest === null ? t.body.notRecorded
            : `${t.option[entry.latest.result]} · ${entry.latest.releaseId} · ${format.date(entry.latest.recordedAt, copy.common.body.notAvailable)}`
              + (entry.latest.result === 'fail' ? ` · ${fill(t.body.findingsValue, { n: format.number(entry.latest.findingCount) })}` : '')}</p>
        </li>)}
      </ul>
      {owned.length === 0 ? <p data-copy-role="body" className="lf-staff-muted">{t.body.ownersRecord}</p>
        : <form className="lf-staff-form" data-form="release-audit" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div className="lf-staff-filters">
            <SelectField label={t.body.auditKind} value={kind} onChange={(event) => setKind(event.target.value as ReleaseAuditKind)}
              options={RELEASE_AUDIT_KINDS.filter((value) => owned.includes(value)).map((value) => ({ value, label: t.option[value] }))} />
            <TextField label={t.body.release} help={t.body.releaseHelp} value={releaseId} maxLength={64} data-copy-role="data"
              onChange={(event) => setReleaseId(event.target.value)} />
          </div>
          <SegmentedControl legend={t.body.result} name="release-audit-result" value={result} onValueChange={setResult}
            options={(['pass', 'fail'] as const).map((value) => ({ value, label: t.option[value] }))} />
          {result === 'fail' ? <TextField type="number" label={t.body.findings} help={t.body.findingsHelp} value={findings} min={1} max={10000}
            inputMode="numeric" data-copy-role="data" onChange={(event) => setFindings(event.target.value)} /> : null}
          <TextAreaField label={t.body.auditNote} value={note} maxLength={600} onChange={(event) => setNote(event.target.value)} />
          <div className="lf-staff-actions"><Button type="submit" variant="brand" disabled={!valid} pending={pending} pendingLabel={copy.common.action.saving}>{t.action.recordAudit}</Button></div>
        </form>}
      {message ? <InlineNotice tone={outcome === 'recorded' ? 'success' : 'error'} live>{message}</InlineNotice> : null}
    </div>
  </Card>;
}

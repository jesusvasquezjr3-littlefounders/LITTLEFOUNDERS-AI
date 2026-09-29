import { useMemo, useState } from 'react';
import {
  Button, Card, Chip, DashboardLayout, DataTable, DestructiveAction, EmptyState, InlineNotice, ProgressBar, SelectField, Sheet, TextAreaField, TextField,
  type TableColumn,
} from '../../design/controls';
import {
  AGE_GROUPS, ageFrom, ageGroup, can, isAcquisition, isFunnelIntegrity, isRegistrations, isTimeline, isUsers, REVOKE_REASON, ROLE_ORDER, topRole,
  useStaffRead, type StaffApi, type StaffUser, type StaffViewer, type Verification,
} from './staffConsoleApi';
import { CopyId, Facts, LoadFailure, Loading, Metrics, ShareBars, StaffPage, useFormats } from './ConsoleParts';
import { DailyChart } from './DailyChart';
import { fill, labelOf, useConsoleCopy, type ConsoleCopy } from './staffConsoleCopy';

/*
 * S3 Users (manage_users; Core refuses /admin/users/* without it).
 *
 * A.5: the verification Core projects per account is shown as three distinct
 * statuses, never one badge: ID-verified (passed the document check),
 * staff-granted (the parent role granted through Roles & Access, with its
 * audited justification) and revoked. Revoking is the real trigger path the
 * requirement asks for: a mandatory reason (Core: 10-300 characters) and a
 * keep-first confirmation; Core writes the reason and the deciding staff
 * member to the audit log before the revoked row.
 *
 * The visitors-to-accounts funnel reads analytics endpoints, so it is shown
 * (and requested) only with view_analytics. Opening a person's details
 * changes nothing (G.6: no impersonation, no account operation here beyond
 * the audited revocation).
 */

const FUNNEL_DAYS = 90;

export function verificationChip(copy: ConsoleCopy, verification: Verification) {
  const label = copy.users.option[verification];
  if (verification === 'id-verified') return <Chip tone="success" glyph="check">{label}</Chip>;
  if (verification === 'staff-granted') return <Chip tone="warning" glyph="info">{label}</Chip>;
  return <Chip tone="error" glyph="cross">{label}</Chip>;
}

/**
 * A.2, A.5, OD-3 section 2 (F3-identity-site): a Tutor whose own age record
 * says a minor (verified before the database refused such checks). Staff
 * review it: revoke here, or settle an age correction. Never demoted silently.
 */
function verificationCell(copy: ConsoleCopy, user: StaffUser) {
  const chip = user.verification ? verificationChip(copy, user.verification) : copy.users.option.none;
  if (!user.ageRecordMinor) return chip;
  return <span className="lf-staff-chips">{chip}<Chip tone="warning" glyph="warning">{copy.users.option.ageRecordMinor}</Chip></span>;
}

function Funnel({ api }: { api: StaffApi }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.users;
  const acquisition = useStaffRead(api, `/admin/insights/acquisition?days=${FUNNEL_DAYS}`, isAcquisition);
  const integrity = useStaffRead(api, `/admin/insights/funnel-integrity?days=${FUNNEL_DAYS}`, isFunnelIntegrity);
  const registrations = useStaffRead(api, `/admin/insights/registrations?days=${FUNNEL_DAYS}`, isRegistrations);
  const body = () => {
    if (acquisition.load.state === 'error' || integrity.load.state === 'error') {
      return <LoadFailure code={acquisition.load.state === 'error' ? acquisition.load.code : integrity.load.state === 'error' ? integrity.load.code : 'INTERNAL'}
        onRetry={() => { acquisition.reload(); integrity.reload(); registrations.reload(); }} />;
    }
    if (acquisition.load.state !== 'ready' || integrity.load.state !== 'ready') return <Loading />;
    const visitors = acquisition.load.data.visitors;
    const accounts = integrity.load.data.accountsCreated;
    // Accounts per visitor against the SERVER count (a cookie banner cannot suppress it); no rate at all when nobody arrived.
    const rate = visitors > 0 ? accounts / visitors : null;
    const byRole = registrations.load.state === 'ready'
      ? Object.entries(registrations.load.data.entries.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.role]: (acc[row.role] ?? 0) + row.registrations }), {}))
        .sort((a, b) => b[1] - a[1])
      : [];
    return <>
      <p data-copy-role="body">{fill(t.body.funnelWindow, { n: FUNNEL_DAYS })}</p>
      <Metrics label={t.heading.funnel} items={[
        { id: 'visitors', label: t.body.visitors, value: format.number(visitors) },
        { id: 'accounts', label: t.body.registered, value: format.number(accounts) },
        { id: 'rate', label: t.body.rate, value: rate === null ? copy.common.body.notAvailable : format.percent(rate) },
      ]} />
      <ProgressBar label={t.body.rate} value={Math.min(accounts, visitors)} max={Math.max(visitors, 1)} tone="mint"
        valueText={fill(t.body.funnelBar, { accounts: format.number(accounts), visitors: format.number(visitors) })} />
      {byRole.length > 1 ? <ShareBars label={t.heading.byRole} locale={locale} total={accounts || byRole.reduce((sum, [, n]) => sum + n, 0)}
        rows={byRole.map(([role, count]) => ({ id: role, label: labelOf(copy.roleNames.option, role), count }))} /> : null}
      <InlineNotice tone="info">{integrity.load.data.unobserved > 0 ? fill(t.body.funnelGap, { n: format.number(integrity.load.data.unobserved) }) : t.body.funnelAgree}</InlineNotice>
    </>;
  };
  return <Card heading={t.heading.funnel}>{body()}</Card>;
}

function UserDetails({ api, user, onClose, onRevoked }: { api: StaffApi; user: StaffUser; onClose: () => void; onRevoked: () => void }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.users;
  const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  const verification = state === 'done' ? 'revoked' : user.verification ?? null;
  const age = ageFrom(user.birthDate);
  const reasonOk = reason.trim().length >= REVOKE_REASON.min;
  const name = user.displayName || t.body.unnamed;
  const revoke = async () => {
    const result = await api.post(`/admin/users/${user.userId}/verification/revoke`, { reason: reason.trim() });
    if (result.ok) { setState('done'); onRevoked(); } else setState('failed');
  };
  return <Sheet open onClose={onClose} heading={copy.common.body.details} closeLabel={copy.common.action.close}>
    <div className="lf-staff-sheet" data-sheet="user">
      <Facts items={[
        { id: 'name', label: t.body.name, value: name, ugc: true },
        { id: 'username', label: t.body.username, value: user.username ? `@${user.username}` : copy.common.body.notAvailable, ugc: true },
      ]} />
      <section className="lf-staff-section" aria-labelledby={`verification-${user.userId}`}>
        <h3 id={`verification-${user.userId}`} data-copy-role="heading" className="lf-staff-subheading">{t.heading.verification}</h3>
        {verification ? <div>{verificationChip(copy, verification)}</div> : <p data-copy-role="body">{t.body.noVerification}</p>}
        {user.ageRecordMinor && state !== 'done' ? <InlineNotice tone="info">{t.body.ageRecordMinor}</InlineNotice> : null}
        {verification === 'id-verified' || verification === 'staff-granted' ? <div className="lf-staff-form" data-form="revoke">
          <TextAreaField label={t.body.reasonLabel} help={t.body.reasonHelp} data-copy-role="data" value={reason} rows={3}
            maxLength={REVOKE_REASON.max} onChange={(event) => { setReason(event.target.value); setState('idle'); }} />
          {reasonOk
            ? <DestructiveAction label={t.action.revoke} onConfirm={revoke} confirm={{
              heading: t.heading.confirm, consequence: fill(t.body.consequence, { name }),
              keepLabel: t.action.keep, confirmLabel: t.action.revoke, pendingLabel: t.action.revoking,
            }} />
            : <div><Button disabled>{t.action.revoke}</Button></div>}
        </div> : null}
        {state === 'done' ? <InlineNotice tone="success" live>{t.body.revoked}</InlineNotice> : null}
        {state === 'failed' ? <InlineNotice tone="error" live>{t.body.revokeFailed}</InlineNotice> : null}
      </section>
      <Facts items={[
        { id: 'userId', label: t.body.userId, value: user.userId, ugc: true },
        { id: 'roles', label: t.body.roles, value: user.roles.length ? user.roles.map((role) => labelOf(copy.roleNames.option, role)).join(', ') : copy.common.body.notAvailable },
        { id: 'language', label: t.body.language, value: labelOf(t.option, user.locale) },
        { id: 'age', label: t.body.age, value: age === null ? copy.common.body.notAvailable : fill(copy.common.body.years, { n: age }) },
        { id: 'birthDate', label: t.body.birthDate, value: user.birthDate ? format.calendar(user.birthDate) : copy.common.body.notAvailable },
        { id: 'joined', label: t.body.joined, value: format.dateTime(user.createdAt, copy.common.body.notAvailable) },
      ]} />
      <CopyId value={user.userId} />
      <p data-copy-role="body" className="lf-staff-muted">{t.body.readOnly}</p>
    </div>
  </Sheet>;
}

export function StaffUsers({ api, viewer }: { api: StaffApi; viewer: StaffViewer }) {
  const { copy, sections, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.users;
  const users = useStaffRead(api, '/admin/users', isUsers);
  const timeline = useStaffRead(api, '/admin/users/timeline?days=365', isTimeline);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const list = useMemo(() => (users.load.state === 'ready' ? users.load.data.users : []), [users.load]);

  const stats = useMemo(() => {
    const roles: Record<string, number> = {}, languages: Record<string, number> = {}, ages: Record<string, number> = {};
    for (const user of list) {
      const top = topRole(user.roles);
      roles[top] = (roles[top] ?? 0) + 1;
      languages[user.locale] = (languages[user.locale] ?? 0) + 1;
      const group = ageGroup(user.birthDate);
      if (group) ages[group] = (ages[group] ?? 0) + 1;
    }
    return { roles, languages, ages };
  }, [list]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return list.filter((user) => (!needle || [user.displayName, user.username ?? '', user.userId].some((value) => value.toLowerCase().includes(needle)))
      && (role === 'all' || user.roles.includes(role)));
  }, [list, query, role]);
  const filtered = query.trim() !== '' || role !== 'all';
  const current = list.find((user) => user.userId === selected) ?? null;

  const columns: TableColumn<StaffUser>[] = [
    { key: 'name', label: t.body.name, value: (user) => user.displayName || t.body.unnamed, ugc: true },
    { key: 'username', label: t.body.username, value: (user) => (user.username ? `@${user.username}` : ''), ugc: true },
    { key: 'roles', label: t.body.roles, value: (user) => user.roles.map((item) => labelOf(copy.roleNames.option, item)).join(', ') },
    { key: 'language', label: t.body.language, value: (user) => labelOf(t.option, user.locale) },
    { key: 'verification', label: t.body.verificationCol, value: (user) => verificationCell(copy, user) },
    { key: 'joined', label: t.body.joined, value: (user) => format.date(user.createdAt, copy.common.body.notAvailable) },
    { key: 'details', label: copy.common.body.details, value: (user) => <Button size="sm" onClick={() => setSelected(user.userId)}>{copy.common.action.open}</Button> },
  ];

  const distribution = users.load.state === 'ready' ? <>
    <Card heading={t.heading.byRole}>
      <ShareBars label={t.heading.byRole} locale={locale} total={list.length}
        rows={ROLE_ORDER.filter((item) => stats.roles[item]).map((item) => ({ id: item, label: labelOf(copy.roleNames.option, item), count: stats.roles[item]! }))} />
    </Card>
    <Card heading={t.heading.byLanguage}>
      <ShareBars label={t.heading.byLanguage} locale={locale} total={list.length} tone="mint"
        rows={Object.entries(stats.languages).sort((a, b) => b[1] - a[1]).map(([item, count]) => ({ id: item, label: labelOf(t.option, item), count }))} />
    </Card>
    <Card heading={t.heading.byAge}>
      {Object.keys(stats.ages).length === 0 ? <p data-copy-role="body">{t.body.noAges}</p>
        : <ShareBars label={t.heading.byAge} locale={locale} total={Object.values(stats.ages).reduce((a, b) => a + b, 0)}
          rows={AGE_GROUPS.filter((group) => stats.ages[group]).map((group) => ({ id: group, label: t.option[group], count: stats.ages[group]! }))} />}
    </Card>
  </> : null;

  const signups = <Card heading={t.heading.signups}>
    {timeline.load.state === 'loading' ? <Loading />
      : timeline.load.state === 'error' ? <LoadFailure code={timeline.load.code} onRetry={timeline.reload} />
        : timeline.load.state === 'ready' ? <DailyChart points={timeline.load.data.timeline} seriesLabel={t.body.signups} /> : null}
  </Card>;

  return <StaffPage screen="staff-users" title={sections.users} intro={t.body.intro}>
    {users.load.state === 'loading' ? <Loading />
      : users.load.state === 'error' ? <LoadFailure code={users.load.code} onRetry={users.reload} />
        : <Metrics label={sections.users} items={[
          { id: 'total', label: t.body.total, value: format.number(list.length) },
          { id: 'children', label: t.body.children, value: format.number(stats.roles.kid ?? 0) },
          { id: 'tutors', label: t.body.tutors, value: format.number(stats.roles.parent ?? 0) },
          { id: 'staff', label: t.body.staff, value: format.number((stats.roles.admin ?? 0) + (stats.roles.superadmin ?? 0)) },
        ]} />}
    {users.load.state === 'ready' ? <section className="lf-staff-section" aria-labelledby="staff-users-people">
      <h2 id="staff-users-people" data-copy-role="heading">{t.heading.people}</h2>
      <div className="lf-staff-filters">
        <TextField type="search" label={t.body.search} value={query} onChange={(event) => setQuery(event.target.value)} data-copy-role="data" />
        <SelectField label={t.body.role} value={role} onChange={(event) => setRole(event.target.value)}
          options={[{ value: 'all', label: copy.roleNames.option.all }, ...ROLE_ORDER.map((item) => ({ value: item, label: copy.roleNames.option[item] }))]} />
      </div>
      {filtered ? <div className="lf-staff-result-row">
        <Button size="sm" onClick={() => { setQuery(''); setRole('all'); }}>{copy.common.action.clearFilters}</Button>
      </div> : null}
      {list.length === 0 ? <EmptyState heading={t.body.empty} />
        : rows.length === 0 ? <EmptyState heading={copy.common.body.noMatch} />
          : <DataTable caption={fill(t.body.count, { shown: format.number(rows.length), total: format.number(list.length) })}
            columns={columns} rows={rows} rowKey={(user) => user.userId} />}
    </section> : null}
    <DashboardLayout primary={<>{signups}{can(viewer, 'view_analytics') ? <Funnel api={api} /> : null}</>} secondary={distribution ?? undefined} />
    {current ? <UserDetails key={current.userId} api={api} user={current} onClose={() => setSelected(null)} onRevoked={users.reload} /> : null}
  </StaffPage>;
}

import { useEffect, useMemo, useState } from 'react';
import {
  Button, Card, DashboardLayout, DataTable, DestructiveAction, EmptyState, InlineNotice, List, ListRow, SelectField, Sheet, STAFF_PERMISSIONS, Switch,
  TextAreaField, TextField, type StaffPermission, type TableColumn,
} from '../../design/controls';
import {
  GRANTABLE_ROLES, isCandidates, isRolesData, JUSTIFICATION, reviewDue, ROLE_ORDER, useStaffRead, UUID,
  type Candidate, type GrantableRole, type Holder, type StaffApi,
} from './staffConsoleApi';
import { CopyId, Facts, LoadFailure, Loading, Metrics, ShareBars, shortId, StaffPage, useFormats } from './ConsoleParts';
import { fill, labelOf, useConsoleCopy } from './staffConsoleCopy';

/*
 * S10 Roles & Access (superadmin only: the route guard, the staff navigation
 * and Core's superadminOnly on every /admin/roles path).
 *
 *   - A.5: granting the parent role (the Tutor) needs a justification of
 *     10-200 characters; Core refuses the grant without it and writes it to
 *     its own audit row, so a staff-granted Tutor can always be explained.
 *   - G.1: the four staff grants are switches only for an admin, the one role
 *     they restrict. A superadmin opens every section, so no switch is shown
 *     for them: a label that restricts nothing is never displayed.
 *   - G.4: the access-review card lists every role grant older than 90 days,
 *     oldest first, so the quarterly re-justification is a visible task.
 *
 * Removing a role is destructive and always behind a keep-first confirmation.
 * The database's role triggers are the last word: a refusal says so.
 */

function useCandidates(api: StaffApi, query: string, open: boolean) {
  const [state, setState] = useState<{ phase: 'idle' | 'loading' | 'ready' | 'error'; people: Candidate[] }>({ phase: 'idle', people: [] });
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) { setState({ phase: 'idle', people: [] }); return; }
    let live = true;
    const timer = window.setTimeout(() => {
      setState((previous) => ({ ...previous, phase: 'loading' }));
      void api.get<unknown>(`/admin/roles/candidates?q=${encodeURIComponent(q)}&limit=10`).then((result) => {
        if (!live) return;
        setState(result.ok && isCandidates(result.data) ? { phase: 'ready', people: result.data.candidates } : { phase: 'error', people: [] });
      });
    }, 250);
    return () => { live = false; window.clearTimeout(timer); };
  }, [api, query, open]);
  return state;
}

function HolderDetails({ api, holder, onClose, onChanged, onRemoved }: {
  api: StaffApi; holder: Holder; onClose: () => void; onChanged: () => void; onRemoved: (text: string) => void;
}) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.access;
  const [pending, setPending] = useState<StaffPermission | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const roleName = (role: string) => labelOf(copy.roleNames.option, role);
  const toggle = async (permission: StaffPermission, on: boolean) => {
    setPending(permission);
    setNotice(null);
    const result = await api.post(`/admin/roles/permissions/${on ? 'grant' : 'revoke'}`, { userId: holder.userId, permission });
    setPending(null);
    setNotice(result.ok ? { tone: 'success', text: t.body.accessSaved } : { tone: 'error', text: result.code === 'ROLE_REJECTED' ? t.body.rejected : copy.common.body.actionFailed });
    if (result.ok) onChanged();
  };
  const remove = async (role: string) => {
    setNotice(null);
    const result = await api.post('/admin/roles/revoke', { userId: holder.userId, role });
    setNotice(result.ok ? { tone: 'success', text: fill(t.body.removed, { role: roleName(role) }) }
      : { tone: 'error', text: result.code === 'ROLE_REJECTED' ? t.body.rejected : copy.common.body.actionFailed });
    if (result.ok) { onRemoved(fill(t.body.removed, { role: roleName(role) })); onChanged(); }
  };
  const staff = holder.roles.includes('admin') && !holder.roles.includes('superadmin');
  return <Sheet open onClose={onClose} heading={copy.common.body.details} closeLabel={copy.common.action.close}>
    <div className="lf-staff-sheet" data-sheet="holder">
      <Facts items={[
        { id: 'name', label: t.body.name, value: holder.displayName, ugc: true },
        { id: 'username', label: t.body.username, value: holder.username ? `@${holder.username}` : copy.common.body.notAvailable, ugc: true },
        { id: 'userId', label: t.body.userId, value: holder.userId, ugc: true },
      ]} />
      <CopyId value={holder.userId} />
      {notice ? <InlineNotice tone={notice.tone} live>{notice.text}</InlineNotice> : null}
      <section className="lf-staff-section" aria-labelledby={`roles-${holder.userId}`}>
        <h3 id={`roles-${holder.userId}`} data-copy-role="heading" className="lf-staff-subheading">{t.heading.roles}</h3>
        <List label={t.heading.roles}>
          {holder.roles.map((role) => <ListRow key={role} title={roleName(role)}
            trailing={<DestructiveAction size="sm" label={fill(t.action.remove, { role: roleName(role) })} onConfirm={() => remove(role)} confirm={{
              heading: t.heading.confirm, consequence: fill(t.body.removeConsequence, { name: holder.displayName, role: roleName(role) }),
              keepLabel: t.action.keep, confirmLabel: t.action.confirmRemove, pendingLabel: t.action.removing,
            }} />} />)}
        </List>
      </section>
      <section className="lf-staff-section" aria-labelledby={`access-${holder.userId}`}>
        <h3 id={`access-${holder.userId}`} data-copy-role="heading" className="lf-staff-subheading">{t.heading.permissions}</h3>
        {holder.roles.includes('superadmin') ? <p data-copy-role="body">{t.body.superadminAll}</p>
          : !staff ? <p data-copy-role="body">{t.body.staffOnly}</p>
            : <div className="lf-staff-switches">
              {STAFF_PERMISSIONS.map((permission) => <Switch key={permission} label={copy.permissions.option[permission]} help={copy.permissions.body[permission]}
                checked={holder.permissions.includes(permission)} pending={pending === permission} disabled={pending !== null && pending !== permission}
                stateLabels={{ on: t.body.on, off: t.body.off }} onCheckedChange={(on) => void toggle(permission, on)} />)}
            </div>}
      </section>
      <section className="lf-staff-section" aria-labelledby={`history-${holder.userId}`}>
        <h3 id={`history-${holder.userId}`} data-copy-role="heading" className="lf-staff-subheading">{t.heading.history}</h3>
        <List label={t.heading.history}>
          {[...holder.roleAssignments.map((row) => ({ key: `role:${row.role}`, name: roleName(row.role), ...row })),
            ...holder.permissionAssignments.map((row) => ({ key: `permission:${row.permission}`, name: labelOf(copy.permissions.option, row.permission), ...row }))]
            .map((row) => <ListRow key={row.key} title={row.name}
              supporting={`${format.dateTime(row.grantedAt, copy.common.body.notAvailable)} · ${row.grantedBy ? fill(t.body.grantedBy, { id: shortId(row.grantedBy) }) : t.body.systemGrant}`} />)}
        </List>
      </section>
    </div>
  </Sheet>;
}

export function StaffAccess({ api }: { api: StaffApi }) {
  const { copy, sections, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const t = copy.access;
  const roles = useStaffRead(api, '/admin/roles', isRolesData);
  const data = roles.load.state === 'ready' ? roles.load.data : null;
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<GrantableRole>('admin');
  const [justification, setJustification] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [granting, setGranting] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [finding, setFinding] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const candidates = useCandidates(api, candidateQuery, finding);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string | null>(null);
  const roleName = (value: string) => labelOf(copy.roleNames.option, value);

  const idValid = UUID.test(userId.trim());
  const justified = role !== 'parent' || justification.trim().length >= JUSTIFICATION.min;
  const grant = async () => {
    setSubmitted(true);
    if (!idValid || !justified) return;
    setGranting(true);
    setResult(null);
    const response = await api.post('/admin/roles/grant', { userId: userId.trim(), role, ...(role === 'parent' ? { justification: justification.trim() } : {}) });
    setGranting(false);
    if (response.ok) {
      setResult({ tone: 'success', text: fill(t.body.granted, { role: roleName(role) }) });
      setUserId(''); setJustification(''); setSubmitted(false);
      roles.reload();
    } else setResult({ tone: 'error', text: response.code === 'ROLE_REJECTED' ? t.body.rejected : t.body.grantFailed });
  };

  const holders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data?.holders ?? []).filter((holder) => (!needle || [holder.displayName, holder.username ?? '', holder.userId].some((value) => value.toLowerCase().includes(needle)))
      && (roleFilter === 'all' || holder.roles.includes(roleFilter)));
  }, [data, search, roleFilter]);
  const due = useMemo(() => reviewDue(data?.holders ?? []), [data]);
  const current = data?.holders.find((holder) => holder.userId === selected) ?? null;

  const columns: TableColumn<Holder>[] = [
    { key: 'name', label: t.body.name, value: (holder) => holder.displayName, ugc: true },
    { key: 'username', label: t.body.username, value: (holder) => (holder.username ? `@${holder.username}` : ''), ugc: true },
    { key: 'roles', label: t.body.rolesCol, value: (holder) => holder.roles.map(roleName).join(', ') },
    { key: 'access', label: t.body.access, value: (holder) => (holder.permissions.length ? fill(t.body.grants, { n: holder.permissions.length }) : t.body.noGrants) },
    { key: 'changed', label: t.body.changed, value: (holder) => format.dateTime(holder.lastChangedAt, copy.common.body.notAvailable) },
    { key: 'details', label: copy.common.body.details, value: (holder) => <Button size="sm" onClick={() => setSelected(holder.userId)}>{t.action.manage}</Button> },
  ];

  const grantCard = <Card heading={t.heading.grant}>
    <div className="lf-staff-form" data-form="grant">
      <TextField label={t.body.userId} help={t.body.userIdHelp} value={userId} data-copy-role="data" autoComplete="off"
        error={submitted && !idValid ? t.body.userIdInvalid : undefined} onChange={(event) => { setUserId(event.target.value); setResult(null); }} />
      <div><Button size="sm" aria-haspopup="dialog" onClick={() => setFinding(true)}>{t.action.find}</Button></div>
      <SelectField label={t.body.role} value={role} onChange={(event) => { setRole(event.target.value as GrantableRole); setResult(null); }}
        options={GRANTABLE_ROLES.map((value) => ({ value, label: roleName(value) }))} />
      {role === 'parent' ? <TextAreaField label={t.body.justification} help={t.body.justificationHelp} value={justification} rows={3}
        maxLength={JUSTIFICATION.max} data-copy-role="data" onChange={(event) => setJustification(event.target.value)} /> : null}
      <div><Button variant="accent" pending={granting} pendingLabel={t.action.granting} disabled={!userId.trim() || !justified}
        onClick={() => void grant()}>{t.action.grant}</Button></div>
      {result ? <InlineNotice tone={result.tone} live>{result.text}</InlineNotice> : null}
    </div>
  </Card>;

  const secondary = data ? <>
    <Card heading={t.heading.review}>
      {due.length === 0 ? <InlineNotice tone="success">{t.body.reviewNone}</InlineNotice> : <>
        <InlineNotice tone="info">{fill(t.body.reviewDue, { n: format.number(due.length) })}</InlineNotice>
        <List label={t.heading.review}>
          {due.map(({ holder, assignment }) => <ListRow key={`${holder.userId}:${assignment.role}`} title={holder.displayName} titleRole="data"
            supporting={fill(t.body.reviewRow, { role: roleName(assignment.role), date: format.date(assignment.grantedAt, copy.common.body.notAvailable) })}
            trailing={<Button size="sm" onClick={() => setSelected(holder.userId)}>{t.action.manage}</Button>} />)}
        </List>
      </>}
    </Card>
    <Card heading={t.heading.distribution}>
      <ShareBars label={t.heading.distribution} locale={locale} total={data.summary.totalRoleAssignments}
        rows={GRANTABLE_ROLES.map((value) => ({ id: value, label: roleName(value), count: data.summary.roleCounts[value] ?? 0 }))} />
      <p data-copy-role="body" className="lf-staff-muted">{fill(t.body.lastChange, { date: format.dateTime(data.summary.lastChangedAt, copy.common.body.notAvailable) })}</p>
    </Card>
  </> : undefined;

  return <StaffPage screen="staff-roles" title={sections.roles} intro={t.body.intro}>
    {roles.load.state === 'loading' ? <Loading />
      : roles.load.state === 'error' ? <LoadFailure code={roles.load.code} onRetry={roles.reload} />
        : data ? <Metrics label={sections.roles} items={[
          { id: 'holders', label: t.body.holdersCount, value: format.number(data.summary.totalHolders) },
          { id: 'assignments', label: t.body.assignments, value: format.number(data.summary.totalRoleAssignments) },
          { id: 'superadmins', label: t.body.superadmins, value: format.number(data.summary.roleCounts.superadmin ?? 0) },
          { id: 'permissionGrants', label: t.body.permissionGrants, value: format.number(data.summary.totalPermissionAssignments) },
        ]} /> : null}
    <DashboardLayout primary={grantCard} secondary={secondary} />
    {data ? <section className="lf-staff-section" aria-labelledby="staff-roles-holders">
      <h2 id="staff-roles-holders" data-copy-role="heading">{t.heading.holders}</h2>
      {removed ? <InlineNotice tone="success">{removed}</InlineNotice> : null}
      <div className="lf-staff-filters">
        <TextField type="search" label={t.body.search} value={search} data-copy-role="data" onChange={(event) => setSearch(event.target.value)} />
        <SelectField label={t.body.role} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}
          options={[{ value: 'all', label: copy.roleNames.option.all }, ...ROLE_ORDER.filter((value) => value !== 'universal').map((value) => ({ value, label: roleName(value) }))]} />
      </div>
      {(search || roleFilter !== 'all') ? <div className="lf-staff-result-row">
        <Button size="sm" onClick={() => { setSearch(''); setRoleFilter('all'); }}>{copy.common.action.clearFilters}</Button>
      </div> : null}
      {data.holders.length === 0 ? <EmptyState heading={t.body.empty} />
        : holders.length === 0 ? <EmptyState heading={copy.common.body.noMatch} />
          : <DataTable caption={fill(t.body.count, { n: format.number(holders.length) })} columns={columns} rows={holders} rowKey={(holder) => holder.userId} />}
    </section> : null}
    {finding ? <Sheet open onClose={() => setFinding(false)} heading={t.heading.find} closeLabel={copy.common.action.close}>
      <div className="lf-staff-sheet" data-sheet="find">
        <TextField type="search" label={t.body.searchPeople} help={t.body.searchHelp} value={candidateQuery} data-copy-role="data"
          onChange={(event) => setCandidateQuery(event.target.value)} />
        {candidates.phase === 'loading' ? <p data-copy-role="body" aria-live="polite">{t.body.searching}</p>
          : candidates.phase === 'error' ? <InlineNotice tone="error" live>{copy.common.body.loadFailed}</InlineNotice>
            : candidates.phase === 'ready' && candidates.people.length === 0 ? <p data-copy-role="body">{t.body.noPeople}</p>
              : candidates.phase === 'ready' ? <List label={t.heading.find}>
                {candidates.people.map((person) => <ListRow key={person.userId} title={person.displayName} titleRole="data"
                  supporting={[person.username ? `@${person.username}` : shortId(person.userId), ...person.roles.map(roleName)].join(' · ')}
                  trailing={<Button size="sm" onClick={() => { setUserId(person.userId); setFinding(false); setResult(null); }}>{t.action.choose}</Button>} />)}
              </List> : null}
      </div>
    </Sheet> : null}
    {current ? <HolderDetails key={current.userId} api={api} holder={current} onClose={() => setSelected(null)} onChanged={roles.reload}
      onRemoved={(text) => setRemoved(text)} /> : null}
  </StaffPage>;
}

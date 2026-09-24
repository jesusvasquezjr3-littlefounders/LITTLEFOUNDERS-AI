import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Dropdown, Field, Icon, SectionHeading, StatCard, Table, type DropdownOption, type TableColumn } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { AdminAction, AdminDialog, AdminEmpty, AdminPage, RoleChip, Unavailable, useAdminData, useAdminMutation } from './adminShared';

interface Assignment {
  role: string;
  grantedAt: string | null;
  grantedBy: string | null;
}

interface PermissionAssignment {
  permission: string;
  grantedAt: string | null;
  grantedBy: string | null;
}

interface Holder {
  userId: string;
  displayName: string;
  username: string | null;
  locale: string | null;
  createdAt: string | null;
  roles: string[];
  permissions: string[];
  roleAssignments: Assignment[];
  permissionAssignments: PermissionAssignment[];
  lastChangedAt: string | null;
}

interface Candidate {
  userId: string;
  displayName: string;
  username: string | null;
  locale: string | null;
  createdAt: string | null;
  roles: string[];
}

interface RolesData {
  holders: Holder[];
  summary: {
    totalHolders: number;
    totalRoleAssignments: number;
    totalPermissionAssignments: number;
    roleCounts: Record<string, number>;
    permissionCounts: Record<string, number>;
    lastChangedAt: string | null;
  };
}

const GRANTABLE = ['parent', 'kid', 'bigfounder', 'admin', 'superadmin'] as const;
type Grantable = (typeof GRANTABLE)[number];
const ADMIN_PERMISSIONS = ['manage_users', 'manage_content', 'view_analytics', 'manage_support'] as const;
type AdminPerm = (typeof ADMIN_PERMISSIONS)[number];

function formatDate(value: string | null, language: string | undefined, empty: string): string {
  return value ? new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : empty;
}

export function AdminRolesPage() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const { data, reload } = useAdminData<RolesData>('/admin/roles');
  const mutate = useAdminMutation();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<Grantable>('admin');
  // A.5: a staff grant of the parent role must carry an audited
  // justification — the badge means "verified", so the reason must be
  // reconstructable afterwards.
  const [justification, setJustification] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedAdmin, setSelectedAdmin] = useState<Holder | null>(null);
  const [permMsg, setPermMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [permBusy, setPermBusy] = useState(false);
  const [candidateDialogOpen, setCandidateDialogOpen] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<{ userId: string; displayName: string; role: string } | null>(null);
  const distributionId = useId();
  const permissionsId = useId();
  const holdersId = useId();

  const roleOptions: DropdownOption<Grantable>[] = GRANTABLE.map((value) => ({ value, label: t(`roles.${value}`, value) }));
  const rolesData = data.state === 'ready' ? data.data : null;
  const holders = rolesData?.holders ?? [];
  const summary = rolesData?.summary;
  const filteredHolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return holders.filter((holder) => {
      const matchesSearch = !q || [holder.displayName, holder.username ?? '', holder.userId].some((value) => value.toLowerCase().includes(q));
      return matchesSearch && (roleFilter === 'all' || holder.roles.includes(roleFilter));
    });
  }, [holders, roleFilter, search]);

  useEffect(() => {
    if (!candidateDialogOpen) return;
    const query = candidateQuery.trim();
    if (query.length < 2) {
      setCandidates([]);
      setCandidateLoading(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setCandidateLoading(true);
      void (async () => {
        const token = await getToken();
        const result = await api<{ candidates: Candidate[] }>(`/admin/roles/candidates?q=${encodeURIComponent(query)}&limit=10`, { token });
        if (!active) return;
        setCandidateLoading(false);
        setCandidates(result.error ? [] : result.data.candidates);
      })();
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [candidateDialogOpen, candidateQuery, getToken]);

  async function grant() {
    if (!userId.trim()) return;
    if (role === 'parent' && justification.trim().length < 10) return;
    setBusy(true);
    setMsg(null);
    const result = await mutate('/admin/roles/grant', {
      userId: userId.trim(),
      role,
      ...(role === 'parent' ? { justification: justification.trim() } : {}),
    });
    setBusy(false);
    if (result.error) {
      setMsg({ tone: 'err', text: t(`errors.api.${result.error.code}`, { defaultValue: t('admin.roles.grantFailed') }) });
      return;
    }
    setMsg({ tone: 'ok', text: t('admin.roles.granted', { role: t(`roles.${role}`, role) }) });
    setUserId('');
    setJustification('');
    await reload();
  }

  async function revoke(uid: string, selectedRole: string) {
    setBusy(true);
    setMsg(null);
    const result = await mutate('/admin/roles/revoke', { userId: uid, role: selectedRole });
    setBusy(false);
    setPendingRevoke(null);
    if (result.error) {
      setMsg({ tone: 'err', text: t(`errors.api.${result.error.code}`, { defaultValue: t('admin.roles.revokeFailed') }) });
      return;
    }
    setMsg({ tone: 'ok', text: t('admin.roles.revoked', { role: t(`roles.${selectedRole}`, selectedRole) }) });
    await reload();
  }

  async function togglePermission(holder: Holder, permission: AdminPerm, currentlyHas: boolean) {
    setPermBusy(true);
    setPermMsg(null);
    const endpoint = currentlyHas ? '/admin/roles/permissions/revoke' : '/admin/roles/permissions/grant';
    const result = await mutate(endpoint, { userId: holder.userId, permission });
    setPermBusy(false);
    if (result.error) {
      setPermMsg({ tone: 'err', text: t('admin.roles.permissionFailed') });
      return;
    }
    setPermMsg({ tone: 'ok', text: currentlyHas ? t('admin.roles.permissionRevoked') : t('admin.roles.permissionGranted') });
    await reload();
    setSelectedAdmin((previous) => {
      if (!previous) return previous;
      const permissions = currentlyHas ? previous.permissions.filter((item) => item !== permission) : [...previous.permissions, permission];
      return { ...previous, permissions };
    });
  }

  const columns: TableColumn<Holder>[] = [
    { key: 'name', header: t('admin.roles.colName'), primary: true, cell: (holder) => <span className="font-semibold text-content">{holder.displayName}</span> },
    { key: 'username', header: t('admin.roles.colUsername'), cell: (holder) => holder.username ? <span className="lf-caption text-content-muted">@{holder.username}</span> : <span className="text-content-faint">{t('admin.roles.emptyValue')}</span> },
    { key: 'id', header: t('admin.roles.colUserId'), cell: (holder) => <button type="button" title={holder.userId} onClick={() => setUserId(holder.userId)} className="lf-caption font-mono text-content-muted transition-colors hover:text-primary">{holder.userId.slice(0, 8)}…</button> },
    { key: 'roles', header: t('admin.roles.colRoles'), cell: (holder) => <span className="flex flex-wrap gap-1">{holder.roles.map((item) => <RoleChip key={item} role={item} />)}</span> },
    { key: 'permissions', header: t('admin.roles.colPermissions'), cell: (holder) => <span className="lf-caption text-content-muted">{holder.permissions.length ? t('admin.roles.permissionCount', { count: holder.permissions.length }) : t('admin.roles.noPermissions')}</span> },
    { key: 'changed', header: t('admin.roles.colLastChanged'), cell: (holder) => <span className="lf-caption text-content-muted">{formatDate(holder.lastChangedAt, i18n.resolvedLanguage, t('admin.roles.notAvailable'))}</span> },
    {
      key: 'actions',
      header: t('admin.roles.colActions'),
      cell: (holder) => (
        <span className="flex flex-wrap items-center gap-1.5">
          {holder.roles.map((item) => <AdminAction key={item} tone="danger" icon="remove" onClick={() => setPendingRevoke({ userId: holder.userId, displayName: holder.displayName, role: item })} disabled={busy}>{t(`roles.${item}`, item)}</AdminAction>)}
          {holder.roles.some((item) => item === 'admin' || item === 'superadmin') && <AdminAction tone="primary" icon="tune" onClick={() => { setPermMsg(null); setSelectedAdmin(holder); }}>{t('admin.roles.manageAccess')}</AdminAction>}
        </span>
      ),
    },
  ];

  return (
    <AdminPage titleKey="admin.roles.title" subtitleKey="admin.roles.subtitle">
      <div className="flex flex-col gap-6">
        {summary && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={<Icon name="group" className="!text-[24px]" />} value={summary.totalHolders.toLocaleString(i18n.resolvedLanguage)} label={t('admin.roles.totalHolders')} tone="primary" />
            <StatCard icon={<Icon name="admin_panel_settings" className="!text-[24px]" />} value={summary.totalRoleAssignments.toLocaleString(i18n.resolvedLanguage)} label={t('admin.roles.roleAssignments')} tone="secondary" />
            <StatCard icon={<Icon name="shield_person" className="!text-[24px]" />} value={(summary.roleCounts.superadmin ?? 0).toLocaleString(i18n.resolvedLanguage)} label={t('admin.roles.superadminsCount')} tone="accent" />
            <StatCard icon={<Icon name="key" className="!text-[24px]" />} value={summary.totalPermissionAssignments.toLocaleString(i18n.resolvedLanguage)} label={t('admin.roles.permissionAssignments')} tone="primary" />
          </div>
        )}

        {summary && (
          <Card className="grid gap-5 border border-outline/50 p-5 shadow-glass lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <SectionHeading icon="donut_small" tone="delight" id={distributionId} meta={t('admin.roles.distributionHint')}>
                {t('admin.roles.roleDistribution')}
              </SectionHeading>
              <div role="group" aria-labelledby={distributionId} className="flex flex-col gap-3">
                {GRANTABLE.map((item) => {
                  const count = summary.roleCounts[item] ?? 0;
                  const width = summary.totalRoleAssignments ? Math.max(4, (count / summary.totalRoleAssignments) * 100) : 4;
                  return <div key={item}><div className="mb-1 flex justify-between gap-3"><span className="lf-caption font-semibold text-content">{t(`roles.${item}`, item)}</span><span className="lf-caption text-content-muted">{count}</span></div><div className="h-2 rounded-full bg-surface-sunken"><div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} /></div></div>;
                })}
              </div>
            </div>
            <div className="rounded-md border border-outline/40 bg-surface-sunken/40 p-4">
              <SectionHeading icon="history" tone="muted" as="h3">{t('admin.roles.lastChange')}</SectionHeading>
              <p className="lf-label font-bold text-content">{formatDate(summary.lastChangedAt, i18n.resolvedLanguage, t('admin.roles.notAvailable'))}</p>
              <p className="mt-2 lf-caption text-content-muted">{t('admin.roles.auditHint')}</p>
            </div>
          </Card>
        )}

        <Card className="flex flex-col gap-4 border border-outline/50 p-5 shadow-glass sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeading icon="verified_user" tone="accent" className="mb-0 min-w-0 flex-1">
              {t('admin.roles.grantTitle')}
            </SectionHeading>
            <AdminAction tone="primary" icon="person_search" onClick={() => setCandidateDialogOpen(true)}>{t('admin.roles.findUser')}</AdminAction>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label={t('admin.roles.userId')} hint={t('admin.roles.userIdHint')} placeholder={t('admin.roles.userIdPlaceholder')} value={userId} onChange={(event) => setUserId(event.target.value)} className="flex-1" />
            <div className="flex w-full flex-col gap-1.5 sm:w-48"><span className="lf-label text-content-muted">{t('admin.roles.role')}</span><Dropdown value={role} options={roleOptions} onChange={setRole} ariaLabel={t('admin.roles.role')} align="left" /></div>
          </div>
          {role === 'parent' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="parent-grant-justification" className="lf-label text-content-muted">{t('admin.roles.justificationLabel')}</label>
              <textarea
                id="parent-grant-justification"
                className="lf-body min-h-20 rounded-md border border-outline bg-surface px-3 py-2 text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                value={justification}
                maxLength={200}
                onChange={(event) => setJustification(event.target.value)}
                placeholder={t('admin.roles.justificationHint')}
              />
              <p className="lf-caption text-content-faint">{t('admin.roles.justificationNote')}</p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button onClick={() => void grant()} disabled={busy || !userId.trim() || (role === 'parent' && justification.trim().length < 10)} className="h-[42px] px-6">{t('admin.roles.grant')}</Button>
          </div>
          {msg && <p className={`lf-caption flex items-center gap-1.5 ${msg.tone === 'ok' ? 'text-success-strong' : 'text-error-strong'}`}><Icon name={msg.tone === 'ok' ? 'check_circle' : 'error'} className="!text-[16px]" /> {msg.text}</p>}
        </Card>

        <Card className="flex flex-col gap-3 border border-outline/50 p-4 shadow-glass lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5"><label htmlFor="roles-search" className="lf-label text-content">{t('admin.roles.searchLabel')}</label><div className="relative"><Icon name="search" className="pointer-events-none absolute left-3 top-1/2 !text-[18px] -translate-y-1/2 text-content-muted" /><input id="roles-search" type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('admin.roles.searchPlaceholder')} className="w-full rounded-md border border-outline/40 bg-surface-sunken py-2 pl-9 pr-4 text-sm text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-primary/50" /></div></div>
          <div className="flex gap-1 overflow-x-auto">{['all', ...GRANTABLE].map((item) => <button key={item} type="button" onClick={() => setRoleFilter(item)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${roleFilter === item ? 'bg-primary text-surface shadow-sm' : 'bg-surface-sunken text-content-muted hover:text-content'}`}>{item === 'all' ? t('admin.roles.allRoles') : t(`roles.${item}`, item)}</button>)}</div>
        </Card>

        {/*
          The lockup replaces the old h2 in place — it does NOT gain a card.
          Wrapping a holders table in a decorative panel would cost a row of
          padding on every breakpoint and buy nothing a staff member reading
          a list of admins wants.
        */}
        <section aria-labelledby={holdersId} className="flex flex-col gap-3">
          <div>
            <SectionHeading
              icon="admin_panel_settings"
              tone="accent"
              id={holdersId}
              className="mb-1"
              meta={t('admin.roles.matchCount', { count: filteredHolders.length })}
            >
              {t('admin.roles.holdersTitle')}
            </SectionHeading>
            <p className="lf-caption text-content-muted">{t('admin.roles.holdersDescription')}</p>
          </div>
          {data.state === 'error' ? <Unavailable code={data.code} /> : data.state === 'ready' ? filteredHolders.length === 0 ? <AdminEmpty icon="admin_panel_settings" message={holders.length === 0 ? t('admin.roles.empty') : t('admin.roles.noMatch')} /> : <Table columns={columns} rows={filteredHolders} rowKey={(holder) => holder.userId} /> : <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} />}
        </section>

        {selectedAdmin && <AdminDialog title={t('admin.roles.accessControlTitle', { name: selectedAdmin.displayName })} onClose={() => setSelectedAdmin(null)} className="max-w-2xl gap-0"><div className="border-b border-outline/50 px-5 py-4"><p className="lf-caption text-content-muted">{t('admin.roles.accessControlDesc')}</p><div className="mt-3 flex flex-wrap gap-1.5">{selectedAdmin.roles.map((item) => <RoleChip key={item} role={item} />)}</div></div><div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]"><div className="flex flex-col gap-3">
          <SectionHeading icon="key" tone="warning" as="h3" id={permissionsId}>{t('admin.roles.permissionsHeading')}</SectionHeading>
          {/*
            THE STUDY'S SETTINGS ROW, and the whole reason it exists: this was
            a hand-rolled 24x44 track whose knob moved by `translate-x-5` — the
            construction /DESIGN.md replaced precisely because a transform
            drifts out of its track when the row's font size changes. It is now
            `.lf-switch` / `-on` / `-knob`, alignment rather than transform, and
            the row is the shared `.lf-config-row` skeleton with a tinted tile.
            The button is the whole row, so the tap target is the row's height
            rather than a 24px slider — which matters most here, where the thing
            being toggled is somebody's access to staff tooling.
          */}
          <div role="group" aria-labelledby={permissionsId} className="flex flex-col gap-2.5">{ADMIN_PERMISSIONS.map((permission) => { const hasPermission = selectedAdmin.permissions.includes(permission); return <button key={permission} type="button" role="switch" aria-checked={hasPermission} disabled={permBusy} onClick={() => void togglePermission(selectedAdmin, permission, hasPermission)} className={cn('lf-config-row lf-press flex min-h-11 w-full items-center justify-between gap-3 p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', permBusy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}><span className="flex min-w-0 items-center gap-3"><span className={cn('lf-tile h-9 w-9', hasPermission ? 'text-success-strong' : 'text-content-muted')}><Icon name="key" className="!text-[18px]" /></span><span className="min-w-0"><span className="lf-label block font-bold text-content">{t(`admin.roles.permissions.${permission}`)}</span><span className="mt-0.5 block lf-caption text-content-muted">{t(`admin.roles.permissions.${permission}_desc`)}</span></span></span><span className={cn('lf-switch', hasPermission && 'lf-switch-on')} aria-hidden><span className="lf-switch-knob" /></span></button>; })}</div>{permMsg && <div className={`flex items-center justify-center gap-2 rounded-md p-2.5 lf-caption font-semibold ${permMsg.tone === 'ok' ? 'bg-success-soft text-success-strong' : 'bg-error-soft text-error-strong'}`}><Icon name={permMsg.tone === 'ok' ? 'check_circle' : 'error'} className="!text-[16px]" />{permMsg.text}</div>}</div><div className="rounded-md border border-outline/40 bg-surface-sunken/40 p-4"><SectionHeading icon="history" tone="muted" as="h3">{t('admin.roles.assignmentHistory')}</SectionHeading><div className="flex flex-col gap-3">{selectedAdmin.roleAssignments.map((assignment) => <div key={assignment.role} className="border-b border-outline/30 pb-2 last:border-0"><div className="flex items-center justify-between gap-2"><RoleChip role={assignment.role} /><span className="lf-caption text-content-muted">{formatDate(assignment.grantedAt, i18n.resolvedLanguage, t('admin.roles.notAvailable'))}</span></div><p className="mt-1 lf-caption text-content-muted">{assignment.grantedBy ? t('admin.roles.grantedBy', { id: assignment.grantedBy.slice(0, 8) }) : t('admin.roles.systemAssignment')}</p></div>)}</div></div></div><div className="flex justify-end border-t border-outline/50 bg-surface-sunken p-4"><Button onClick={() => setSelectedAdmin(null)} variant="secondary" className="px-6">{t('admin.close')}</Button></div></AdminDialog>}

        {candidateDialogOpen && <AdminDialog title={t('admin.roles.candidateTitle')} onClose={() => setCandidateDialogOpen(false)} className="max-w-3xl gap-5"><p className="lf-caption text-content-muted">{t('admin.roles.candidateDescription')}</p><Field label={t('admin.roles.candidateSearchLabel')} value={candidateQuery} onChange={(event) => setCandidateQuery(event.target.value)} placeholder={t('admin.roles.candidateSearchPlaceholder')} autoFocus /><div className="min-h-40">{candidateLoading ? <AdminEmpty icon="hourglass_empty" message={t('admin.loading')} /> : candidateQuery.trim().length < 2 ? <AdminEmpty icon="person_search" message={t('admin.roles.candidateSearchHint')} /> : candidates.length === 0 ? <AdminEmpty icon="person_off" message={t('admin.roles.candidateEmpty')} /> : <Table columns={[{ key: 'name', header: t('admin.roles.colName'), primary: true, cell: (candidate) => <div><span className="font-semibold text-content">{candidate.displayName}</span><span className="mt-0.5 block lf-caption text-content-muted">{candidate.username ? `@${candidate.username}` : candidate.userId}</span></div> }, { key: 'roles', header: t('admin.roles.colRoles'), cell: (candidate) => <span className="flex flex-wrap gap-1">{candidate.roles.length ? candidate.roles.map((item) => <RoleChip key={item} role={item} />) : <span className="lf-caption text-content-muted">{t('admin.roles.noRoles')}</span>}</span> }, { key: 'action', header: t('admin.roles.colActions'), cell: (candidate) => <AdminAction tone="primary" icon="check" onClick={() => { setUserId(candidate.userId); setCandidateDialogOpen(false); }}>{t('admin.roles.useUser')}</AdminAction> }]} rows={candidates} rowKey={(candidate) => candidate.userId} />}</div></AdminDialog>}

        {pendingRevoke && <AdminDialog title={t('admin.roles.confirmRevokeTitle')} onClose={() => setPendingRevoke(null)} className="max-w-md gap-5"><div className="rounded-md border border-error/30 bg-error-soft p-4"><p className="lf-label font-bold text-content">{t('admin.roles.confirmRevokeBody', { name: pendingRevoke.displayName, role: t(`roles.${pendingRevoke.role}`, pendingRevoke.role) })}</p><p className="mt-2 lf-caption text-content-muted">{t('admin.roles.confirmRevokeHint')}</p></div><div className="flex flex-wrap justify-end gap-2"><AdminAction tone="neutral" onClick={() => setPendingRevoke(null)}>{t('admin.close')}</AdminAction><AdminAction tone="danger" icon="remove" onClick={() => void revoke(pendingRevoke.userId, pendingRevoke.role)} disabled={busy}>{t('admin.roles.confirmRevoke')}</AdminAction></div></AdminDialog>}
      </div>
    </AdminPage>
  );
}

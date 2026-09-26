import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ButtonGroup, Card, ChipGroup, ChoiceChip, Copy, EmptyState, InlineNotice, Pill, RewardChip, DashboardLayout } from '../../design/controls';
import { ProfileSafetyNotice, type ProfileSafetyCopy } from '../../social/ProfileSafetyNotice';
import { childName, fetchChildren, type Child, type ConsoleTransport } from './consoleApi';
import { AddChild, ChildAdded, InsightsConsent, ManageChild, MicrophoneConsent } from './ChildControls';
import {
  ConsoleLink, FailureState, fill, PageLoading, type ChildAccountCopy, type ChildConsentCopy, type ConsoleCopy, type ConsoleLocale, type PageFailure,
} from './consoleParts';
import '../../design/tokens.css';
import '../../design/system.css';
import './console.css';

/*
 * F1, the Family console (W2F.1): the verified Tutor's page for their
 * family, rebuilt on the design system's dashboard layout (02 §4.5: a neutral
 * page with coloured cards; 03 §3.3: the child's work wide, the family-wide
 * pieces narrow, one column below 840 px of container).
 *
 * ONE CHILD AT A TIME. The legacy page stacked every tool of every child in
 * one long list; the console composes them by child: a picker (only when
 * there is more than one), the child's overview (coins, chore streak, what
 * waits for approval, and the ways into their progress, their Mentor talks
 * and their coins), then the child's tools in five groups: Learning, Coins
 * and chores, Connections, Privacy and safety, Tutors and account. The
 * family-wide pieces (this month's tip, safety notices, a second Tutor's
 * pending requests, adding a child, what the practice covers and how long
 * data is kept) sit beside it. Children are never ranked against each other.
 *
 * The wave-1 surfaces (S05, S07, S08) keep their own data planes: the route
 * adapter renders them into the slots below, one set per child, so every
 * server rule they carry (verification, OD-3 Option B, OD-20, E.8 tiers,
 * D.17 autonomy, D.21 retention) is unchanged. This component owns the
 * family list, the selection and the Tutor's own controls for a child.
 *
 * Nothing here authorizes anything: the route is parent-gated and Core
 * re-checks the verified guardian link on every request.
 */

export interface ChildSlots {
  learning: ReactNode;
  money: ReactNode;
  connections: ReactNode;
  privacy: ReactNode;
  account: ReactNode;
}

type Load = { status: 'loading' } | { status: 'failed'; failure: PageFailure } | { status: 'ready'; children: Child[] };

export function FamilyConsole({ copy, accountCopy, consentCopy, profileSafetyCopy, locale, dark, transport, selectedId, onSelect, onNavigate,
  childSlots, familyTop, familyAside, verifyHref = '/verify-parent' }: {
  copy: ConsoleCopy;
  accountCopy: ChildAccountCopy;
  consentCopy: ChildConsentCopy;
  profileSafetyCopy: ProfileSafetyCopy;
  locale: ConsoleLocale;
  dark: boolean;
  transport: ConsoleTransport;
  /** The child in view (from the address, so a way back returns to them); null: the first child. */
  selectedId: string | null;
  onSelect: (userId: string) => void;
  onNavigate: (href: string) => void;
  /** The wave-1 surfaces for one child, grouped. */
  childSlots: (child: Child) => ChildSlots;
  /** A second Tutor's invite being accepted (arrives with `?join=`): shown first, it is why they came. */
  familyTop?: ReactNode;
  /** Family-wide pieces, beside the child. `hasChildren` hides what only makes sense with a child. */
  familyAside: (hasChildren: boolean) => ReactNode;
  verifyHref?: string;
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [retrying, setRetrying] = useState(false);
  const [removed, setRemoved] = useState<string | null>(null);
  const [added, setAdded] = useState<{ name: string; username: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const generation = useRef(0);

  const read = useCallback(async () => {
    const current = ++generation.current;
    const result = await fetchChildren(transport);
    if (current !== generation.current) return;
    setRetrying(false);
    setLoad(result.ok ? { status: 'ready', children: result.data } : { status: 'failed', failure: { code: result.code } });
  }, [transport]);

  useEffect(() => {
    void read();
    return () => { generation.current++; };
  }, [read]);

  const update = (change: (children: Child[]) => Child[]) => setLoad((previous) => previous.status === 'ready' ? { status: 'ready', children: change(previous.children) } : previous);

  const root = (body: ReactNode) => <div className="lf-rebuild lf-family-console" data-screen="family-console" data-theme={dark ? 'dark' : 'light'} lang={locale}>
    <header className="lf-console-header"><h1 data-copy-role="heading">{copy.title}</h1></header>
    {body}
  </div>;

  if (load.status === 'loading') return root(<PageLoading label={copy.loading} />);
  if (load.status === 'failed') {
    if (load.failure.code === 'PARENT_VERIFICATION_REQUIRED') {
      return root(<EmptyState heading={copy.verifyTitle} body={copy.verifyBody}
        action={<ConsoleLink href={verifyHref} onNavigate={onNavigate} variant="accent">{copy.verifyAction}</ConsoleLink>} />);
    }
    return root(<FailureState failure={load.failure} copy={copy} retrying={retrying} onRetry={() => { setRetrying(true); void read(); }} />);
  }

  const children = load.children;
  const child = children.find((entry) => entry.userId === selectedId) ?? children[0] ?? null;
  const add = <AddChild copy={accountCopy} locale={locale} transport={transport} startOpen={adding} onOpenChange={setAdding}
    onAdded={(created) => {
      setRemoved(null);
      setAdded({ name: childName(created), username: created.username ?? '' });
      update((list) => [...list, created]);
      onSelect(created.userId);
    }} />;
  const removedNotice = removed ? <InlineNotice tone="info" live>{fill(accountCopy.removed, { name: removed })}</InlineNotice> : null;
  const addedNotice = added ? <ChildAdded copy={accountCopy} name={added.name} username={added.username} onDone={() => setAdded(null)} /> : null;

  if (!child) {
    return root(<>
      {familyTop}
      {removedNotice}
      {/* An open form replaces the empty state: the first view carries the form, not both (06 §3.1). */}
      <DashboardLayout primary={adding ? add : <EmptyState heading={copy.emptyTitle} action={add} />} secondary={familyAside(false)} />
    </>);
  }

  const slots = childSlots(child);
  return root(<>
    {familyTop}
    {removedNotice}
    <DashboardLayout
      primary={<>
        {addedNotice}
        {children.length > 1 ? <ChildPicker label={copy.children} family={children} selected={child.userId} onSelect={onSelect} /> : null}
        <ChildOverview key={child.userId} child={child} copy={copy} onNavigate={onNavigate}
          safety={child.profileReview?.flagged
            ? <ProfileSafetyNotice copy={profileSafetyCopy} locale={locale} dark={dark} audience="guardian" fields={child.profileReview.fields} name={childName(child)} />
            : null} />
        <Group id="learning" heading={copy.learning}>{slots.learning}</Group>
        <Group id="money" heading={copy.money}>{slots.money}</Group>
        <Group id="connections" heading={copy.connections}>{slots.connections}</Group>
        <Group id="privacy" heading={copy.privacy}>
          <InsightsConsent key={`insights:${child.userId}`} child={child} copy={consentCopy} transport={transport}
            onChanged={(userId, on) => update((list) => list.map((entry) => entry.userId === userId ? { ...entry, analyticsConsent: on } : entry))} />
          <MicrophoneConsent key={`mic:${child.userId}`} kidId={child.userId} name={childName(child)} copy={consentCopy} locale={locale} transport={transport} />
          {slots.privacy}
        </Group>
        <Group id="account" heading={copy.account}>
          {slots.account}
          <ManageChild key={`manage:${child.userId}`} child={child} copy={accountCopy} transport={transport}
            onRenamed={(userId, displayName) => update((list) => list.map((entry) => entry.userId === userId ? {
              ...entry, displayName,
              // Core accepted the new name, so it passed the E.13 review; a flagged username stays flagged.
              profileReview: entry.profileReview && {
                flagged: entry.profileReview.fields.includes('username'),
                fields: entry.profileReview.fields.filter((field) => field !== 'displayName'),
              },
            } : entry))}
            onRemoved={(userId) => {
              setAdded(null);
              setRemoved(childName(child));
              update((list) => list.filter((entry) => entry.userId !== userId));
            }} />
        </Group>
      </>}
      secondary={<>{add}{familyAside(true)}</>} />
  </>);
}

function ChildPicker({ label, family, selected, onSelect }: { label: string; family: Child[]; selected: string; onSelect: (userId: string) => void }) {
  return <nav className="lf-console-picker" aria-label={label} data-console-part="picker">
    <Copy role="body">{label}</Copy>
    <ChipGroup>
      {family.map((child) => <ChoiceChip key={child.userId} selected={child.userId === selected} onToggle={() => onSelect(child.userId)}>
        <span className="ugc">{childName(child)}</span>
      </ChoiceChip>)}
    </ChipGroup>
  </nav>;
}

function ChildOverview({ child, copy, onNavigate, safety }: { child: Child; copy: ConsoleCopy; onNavigate: (href: string) => void; safety: ReactNode }) {
  const heading = useId();
  const base = `/family/${encodeURIComponent(child.userId)}`;
  return <Card as="div">
    <section className="lf-console-overview" data-console-part="overview" data-child-id={child.userId} aria-labelledby={heading}>
      <div className="lf-console-who">
        <h2 id={heading} className="ugc" data-copy-role="data">{childName(child)}</h2>
        {child.username ? <span className="lf-console-handle ugc" data-copy-role="data">@{child.username}</span> : null}
      </div>
      <ChipGroup>
        {child.walletTotal === null
          ? <Pill tone="inverse">{copy.coinsUnknown}</Pill>
          : <RewardChip>{fill(copy.coins, { count: child.walletTotal })}</RewardChip>}
        {child.taskStreakDays > 0 ? <RewardChip>{fill(copy.choreStreak, { count: child.taskStreakDays })}</RewardChip> : null}
      </ChipGroup>
      <ButtonGroup>
        {child.pendingApprovalCount > 0
          ? <ConsoleLink href="/tasks" onNavigate={onNavigate} variant="brand">{fill(copy.approvals, { count: child.pendingApprovalCount })}</ConsoleLink>
          : null}
        <ConsoleLink href={`${base}/territory`} onNavigate={onNavigate}>{copy.progress}</ConsoleLink>
        <ConsoleLink href={`${base}/tutor`} onNavigate={onNavigate}>{copy.mentor}</ConsoleLink>
        <ConsoleLink href="/banking" onNavigate={onNavigate}>{copy.coinCard}</ConsoleLink>
      </ButtonGroup>
      {safety}
    </section>
  </Card>;
}

function Group({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  const headingId = useId();
  return <section className="lf-console-group" data-console-group={id} aria-labelledby={headingId}>
    <h2 id={headingId} data-copy-role="heading">{heading}</h2>
    <div className="lf-console-group-items">{children}</div>
  </section>;
}

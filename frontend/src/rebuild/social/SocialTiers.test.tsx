import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import en from '../../i18n/en-US/rebuild-profile.json';
import es from '../../i18n/es-MX/rebuild-profile.json';
import pt from '../../i18n/pt-BR/rebuild-profile.json';
import { ManagedConnectionsNote, PrivateProfile } from './PrivateProfile';
import { TeenConnections } from './TeenConnections';
import { ProfileSafetyNotice } from './ProfileSafetyNotice';

/*
 * E.8 / E.13 rebuild surfaces: every visible string declares its copy role,
 * no count is ever rendered, and each state offers exactly the actions the
 * tier allows.
 */

const LOCALES = { 'en-US': en, 'es-MX': es, 'pt-BR': pt } as const;

function everyTextHasRole(container: HTMLElement) {
  for (const element of container.querySelectorAll('p, h2, button, time')) {
    if (element.textContent?.trim()) expect(element.closest('[data-copy-role]'), element.outerHTML).not.toBeNull();
  }
}

describe('PrivateProfile (E.8 private teen card)', () => {
  it.each(Object.entries(LOCALES))('shows only the handle, the rule and one ask in %s', (locale, strings) => {
    const onRequest = vi.fn();
    const { container } = render(<PrivateProfile copy={strings.privateProfile} locale={locale} dark={false} username="rio" mode="teenRequest" state="idle" onRequest={onRequest} />);
    expect(screen.getByRole('heading', { name: strings.privateProfile.title })).toBeInTheDocument();
    expect(screen.getByText('@rio')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: strings.privateProfile.request }));
    expect(onRequest).toHaveBeenCalledTimes(1);
    everyTextHasRole(container);
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('settles on pending, cooldown, limit and connected without another ask', () => {
    for (const state of ['pending', 'cooldown', 'limit', 'connected'] as const) {
      const { unmount } = render(<PrivateProfile copy={en.privateProfile} locale="en-US" dark username="rio" mode="teenRequest" state={state} onRequest={() => undefined} />);
      expect(screen.getByRole('button', { name: en.privateProfile.request })).toBeDisabled();
      expect(screen.getByRole('status')).toHaveTextContent(en.privateProfile[state]);
      unmount();
    }
  });

  it('a failed ask is announced and can be retried', () => {
    render(<PrivateProfile copy={en.privateProfile} locale="en-US" dark={false} username="rio" mode="teenRequest" state="failed" onRequest={() => undefined} />);
    expect(screen.getByRole('alert')).toHaveTextContent(en.privateProfile.failed);
    expect(screen.getByRole('button', { name: en.privateProfile.request })).toBeEnabled();
  });

  it('a child gets no ask at all, only the Tutor line', () => {
    render(<PrivateProfile copy={en.privateProfile} locale="en-US" dark={false} username="rio" mode="managed" state="idle" onRequest={() => undefined} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(en.privateProfile.managed)).toBeInTheDocument();
    render(<ManagedConnectionsNote copy={en.privateProfile} locale="en-US" dark={false} />);
    expect(screen.getAllByText(en.privateProfile.managed)).toHaveLength(2);
  });
});

describe('TeenConnections (E.8 self-managed tier)', () => {
  const requests = [{ requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', requestedAt: '2026-09-24T10:00:00Z', username: 'omar', displayName: 'Omar' }];
  const followers = [{ userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', username: 'luz', displayName: 'Luz' }];
  const base = { requests, followers, loading: false, failed: false, busy: false, notice: null, hasMore: false, onRetry: () => undefined, onMore: () => undefined,
    reportCopy: en.report, onReport: () => Promise.resolve(true), onBlock: () => Promise.resolve(),
    onReportFollower: () => Promise.resolve(true), onBlockFollower: () => Promise.resolve() };

  it.each(Object.entries(LOCALES))('lets the teen accept, decline and remove in %s, with no count', (locale, strings) => {
    const onDecide = vi.fn();
    const onRemove = vi.fn();
    const { container } = render(<TeenConnections copy={strings.teenConnections} locale={locale} dark={false} {...base} reportCopy={strings.report} onDecide={onDecide} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: strings.teenConnections.accept }));
    fireEvent.click(screen.getByRole('button', { name: strings.teenConnections.decline }));
    fireEvent.click(screen.getByRole('button', { name: strings.teenConnections.remove }));
    expect(onDecide.mock.calls).toEqual([[requests[0]!.requestId, 'accept'], [requests[0]!.requestId, 'decline']]);
    expect(onRemove).toHaveBeenCalledWith(followers[0]!.userId);
    everyTextHasRole(container);
    // Only the request date may carry digits: no follower or request count anywhere.
    const withoutDates = [...container.querySelectorAll('p, h2, button')].map((element) => element.textContent ?? '').join(' ');
    expect(withoutDates).not.toMatch(/\d/);
  });

  it('disables every action while a decision is saving and announces outcomes', () => {
    render(<TeenConnections copy={en.teenConnections} locale="en-US" dark={false} {...base} busy notice={{ tone: 'alert', text: en.teenConnections.decisionFailed }} onDecide={() => undefined} onRemove={() => undefined} />);
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(en.teenConnections.decisionFailed);
  });

  // E.3 (GAP-FIX-R5 social; OD-8, D-19): each request can be reported or blocked from the queue, by request id.
  it.each(Object.entries(LOCALES))('reports and blocks a requester from the queue in %s', async (locale, strings) => {
    const onReport = vi.fn(() => Promise.resolve(true));
    const onBlock = vi.fn(() => Promise.resolve());
    const { container } = render(<TeenConnections copy={strings.teenConnections} locale={locale} dark={false} {...base} reportCopy={strings.report}
      onDecide={() => undefined} onRemove={() => undefined} onReport={onReport} onBlock={onBlock} />);
    const row = within(container.querySelector(`[data-request-actions="${requests[0]!.requestId}"]`) as HTMLElement);
    fireEvent.click(row.getByRole('button', { name: strings.teenConnections.report }));
    const dialog = within(await screen.findByRole('dialog', { name: strings.report.title }));
    fireEvent.click(dialog.getByRole('radio', { name: strings.report.categories.unwanted_contact }));
    await act(async () => { fireEvent.click(dialog.getByRole('button', { name: strings.report.send })); });
    expect(onReport).toHaveBeenCalledWith(requests[0]!.requestId, 'unwanted_contact', null);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(row.getByRole('button', { name: strings.teenConnections.block }));
    const confirm = within(await screen.findByRole('alertdialog'));
    expect(confirm.getByText(strings.teenConnections.blockBody)).toBeInTheDocument();
    expect(onBlock).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(confirm.getByRole('button', { name: strings.teenConnections.blockConfirm })); });
    expect(onBlock).toHaveBeenCalledWith(requests[0]!.requestId);
    everyTextHasRole(container);
  });

  // E.3 after a decline (GAP-FIX-R5 social finish): the request just declined keeps Report and Block beside the receipt.
  it.each(Object.entries(LOCALES))('keeps a just-declined request reportable and blockable in %s', async (locale, strings) => {
    const closedId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const onReport = vi.fn(() => Promise.resolve(true));
    const onBlock = vi.fn(() => Promise.resolve());
    const { container } = render(<TeenConnections copy={strings.teenConnections} locale={locale} dark={false} {...base} requests={[]} reportCopy={strings.report}
      notice={{ tone: 'status', text: strings.teenConnections.declined }} closedRequestId={closedId}
      onDecide={() => undefined} onRemove={() => undefined} onReport={onReport} onBlock={onBlock} />);
    const closed = within(container.querySelector(`[data-closed-request-actions="${closedId}"]`) as HTMLElement);
    fireEvent.click(closed.getByRole('button', { name: strings.teenConnections.report }));
    const dialog = within(await screen.findByRole('dialog', { name: strings.report.title }));
    fireEvent.click(dialog.getByRole('radio', { name: strings.report.categories.harassment }));
    await act(async () => { fireEvent.click(dialog.getByRole('button', { name: strings.report.send })); });
    expect(onReport).toHaveBeenCalledWith(closedId, 'harassment', null);
    fireEvent.click(closed.getByRole('button', { name: strings.teenConnections.block }));
    const confirm = within(await screen.findByRole('alertdialog'));
    await act(async () => { fireEvent.click(confirm.getByRole('button', { name: strings.teenConnections.blockConfirm })); });
    expect(onBlock).toHaveBeenCalledWith(closedId);
    everyTextHasRole(container);
  });

  // GAP-FIX-R8 social (E.3, E.8): a follower without a @username is listed, and removable, reportable and blockable by user id.
  it.each(Object.entries(LOCALES))('lists a handle-less follower and lets the teen remove, report and block it in %s', async (locale, strings) => {
    const pat = { userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', username: null, displayName: 'Pat' };
    const onRemove = vi.fn();
    const onReportFollower = vi.fn(() => Promise.resolve(true));
    const onBlockFollower = vi.fn(() => Promise.resolve());
    const { container } = render(<TeenConnections copy={strings.teenConnections} locale={locale} dark={false} {...base} requests={[]} followers={[pat]} reportCopy={strings.report}
      onDecide={() => undefined} onRemove={onRemove} onReportFollower={onReportFollower} onBlockFollower={onBlockFollower} />);
    expect(screen.getByText('Pat')).toBeInTheDocument();
    expect(container.textContent).not.toContain('@');
    const row = within(container.querySelector(`[data-follower-actions="${pat.userId}"]`) as HTMLElement);
    fireEvent.click(row.getByRole('button', { name: strings.teenConnections.remove }));
    expect(onRemove).toHaveBeenCalledWith(pat.userId);
    fireEvent.click(row.getByRole('button', { name: strings.teenConnections.report }));
    const dialog = within(await screen.findByRole('dialog', { name: strings.report.title }));
    fireEvent.click(dialog.getByRole('radio', { name: strings.report.categories.unwanted_contact }));
    await act(async () => { fireEvent.click(dialog.getByRole('button', { name: strings.report.send })); });
    expect(onReportFollower).toHaveBeenCalledWith(pat.userId, 'unwanted_contact', null);
    fireEvent.click(row.getByRole('button', { name: strings.teenConnections.block }));
    const confirm = within(await screen.findByRole('alertdialog'));
    expect(onBlockFollower).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(confirm.getByRole('button', { name: strings.teenConnections.blockConfirm })); });
    expect(onBlockFollower).toHaveBeenCalledWith(pat.userId);
    everyTextHasRole(container);
  });

  it('offers no closed-request actions without a just-declined request', () => {
    const { container } = render(<TeenConnections copy={en.teenConnections} locale="en-US" dark={false} {...base} onDecide={() => undefined} onRemove={() => undefined} />);
    expect(container.querySelector('[data-closed-request-actions]')).toBeNull();
  });

  it('shows empty and failed states with a retry', () => {
    const onRetry = vi.fn();
    const { unmount } = render(<TeenConnections copy={en.teenConnections} locale="en-US" dark={false} {...base} requests={[]} followers={[]} onDecide={() => undefined} onRemove={() => undefined} />);
    expect(screen.getByText(en.teenConnections.empty)).toBeInTheDocument();
    expect(screen.getByText(en.teenConnections.noFollowers)).toBeInTheDocument();
    unmount();
    render(<TeenConnections copy={en.teenConnections} locale="en-US" dark={false} {...base} failed onRetry={onRetry} onDecide={() => undefined} onRemove={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: en.teenConnections.retry }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('ProfileSafetyNotice (E.13)', () => {
  it.each(Object.entries(LOCALES))('tells each audience what to do in %s', (locale, strings) => {
    const copy = strings.profileSafety;
    const { container, unmount } = render(<ProfileSafetyNotice copy={copy} locale={locale} dark={false} audience="self" fields={['username', 'displayName']} />);
    expect(screen.getByText(copy.username)).toBeInTheDocument();
    expect(screen.getByText(copy.displayName)).toBeInTheDocument();
    everyTextHasRole(container);
    unmount();
    const kid = render(<ProfileSafetyNotice copy={copy} locale={locale} dark={false} audience="kidSelf" fields={['username']} />);
    expect(screen.getByText(copy.askTutor)).toBeInTheDocument();
    kid.unmount();
    render(<ProfileSafetyNotice copy={copy} locale={locale} dark={false} audience="guardian" fields={['displayName']} name="Beto" />);
    expect(screen.getByRole('heading', { name: copy.kidTitle.replace('{name}', 'Beto') })).toBeInTheDocument();
    // The Tutor renames the child in the Family panel, not in their own Settings.
    expect(screen.getByText(copy.kidDisplayName)).toBeInTheDocument();
    expect(screen.queryByText(copy.displayName)).toBeNull();
  });

  it('renders nothing when nothing is flagged', () => {
    const { container } = render(<ProfileSafetyNotice copy={en.profileSafety} locale="en-US" dark={false} audience="self" fields={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

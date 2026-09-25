import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import en from '../../i18n/en-US/rebuild.json';
import es from '../../i18n/es-MX/rebuild.json';
import pt from '../../i18n/pt-BR/rebuild.json';
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
  const followers = [{ username: 'luz', displayName: 'Luz' }];
  const base = { requests, followers, loading: false, failed: false, busy: false, notice: null, hasMore: false, onRetry: () => undefined, onMore: () => undefined };

  it.each(Object.entries(LOCALES))('lets the teen accept, decline and remove in %s, with no count', (locale, strings) => {
    const onDecide = vi.fn();
    const onRemove = vi.fn();
    const { container } = render(<TeenConnections copy={strings.teenConnections} locale={locale} dark={false} {...base} onDecide={onDecide} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: strings.teenConnections.accept }));
    fireEvent.click(screen.getByRole('button', { name: strings.teenConnections.decline }));
    fireEvent.click(screen.getByRole('button', { name: strings.teenConnections.remove }));
    expect(onDecide.mock.calls).toEqual([[requests[0]!.requestId, 'accept'], [requests[0]!.requestId, 'decline']]);
    expect(onRemove).toHaveBeenCalledWith('luz');
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

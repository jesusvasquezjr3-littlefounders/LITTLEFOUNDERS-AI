import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { FamilyConsole } from './FamilyConsole';
import { childWire, FAMILY, fakeTransport, KID_A, KID_B, micWire, ok, refuse, type Answer } from './consoleFixtures';
import type { ConsoleLocale } from './consoleParts';
import type { Child } from './consoleApi';

/*
 * W2F.1 F1: the rebuilt Family console. Server truth only (a switch never
 * flips before Core confirms), one child at a time, the Tutor's own controls
 * for that child rebuilt from the design system, every state (loading,
 * failure, offline, verification required, empty) reachable, and every text
 * node carrying a copy role.
 */

const copyFor = (locale: ConsoleLocale) => rebuildNamespaceCopy[locale];
const en = copyFor('en-US').family;

function everyTextHasARole(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    expect(node.parentElement?.closest('[data-copy-role]'), node.textContent).not.toBeNull();
  }
}

function setup(routes: Record<string, Answer>, { selectedId = null as string | null, locale = 'en-US' as ConsoleLocale } = {}) {
  const transport = fakeTransport({
    [`GET /tutor/consent/${KID_A}`]: ok(micWire()),
    [`GET /tutor/consent/${KID_B}`]: ok(micWire()),
    ...routes,
  });
  const onSelect = vi.fn();
  const onNavigate = vi.fn();
  const slots = vi.fn((child: Child) => ({
    learning: <p data-copy-role="data" data-slot="learning">{`learning:${child.userId}`}</p>,
    money: <p data-copy-role="data" data-slot="money">{`money:${child.userId}`}</p>,
    connections: <p data-copy-role="data" data-slot="connections">{`connections:${child.userId}`}</p>,
    privacy: <p data-copy-role="data" data-slot="privacy">{`privacy:${child.userId}`}</p>,
    account: <p data-copy-role="data" data-slot="account">{`account:${child.userId}`}</p>,
  }));
  const aside = vi.fn((hasChildren: boolean) => <p data-copy-role="data" data-slot="aside">{`aside:${hasChildren}`}</p>);
  const copy = copyFor(locale);
  const props = {
    copy: copy.family.familyConsole, accountCopy: copy.family.familyChildAccount, consentCopy: copy.family.familyChildConsent,
    profileSafetyCopy: copy.profile.profileSafety, locale, dark: false, transport, onSelect, onNavigate, childSlots: slots, familyAside: aside,
  };
  const view = render(<FamilyConsole {...props} selectedId={selectedId} />);
  return { transport, onSelect, onNavigate, slots, aside, view, rerender: (id: string | null) => view.rerender(<FamilyConsole {...props} selectedId={id} />) };
}

describe('FamilyConsole (F1)', () => {
  it('shows one child: overview, the ways in, the grouped tools and the family-wide column', async () => {
    const { view, onNavigate } = setup({ 'GET /family/kids': ok({ kids: [FAMILY[0]] }) });
    expect(screen.getByRole('status')).toHaveTextContent(en.familyConsole.loading);
    await screen.findByRole('heading', { level: 2, name: 'Sofía' });
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([en.familyConsole.title]);
    expect(screen.queryByRole('navigation', { name: en.familyConsole.children })).toBeNull();
    expect(screen.getByText('@sofia_2016')).toBeInTheDocument();
    expect(screen.getByText('34 coins')).toBeInTheDocument();
    expect(screen.getByText('6-day chore streak')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2 to approve' })).toHaveAttribute('href', '/tasks');
    expect(screen.getByRole('link', { name: en.familyConsole.progress })).toHaveAttribute('href', `/family/${KID_A}/territory`);
    expect(screen.getByRole('link', { name: en.familyConsole.mentor })).toHaveAttribute('href', `/family/${KID_A}/tutor`);
    expect(screen.getByRole('link', { name: en.familyConsole.coinCard })).toHaveAttribute('href', '/banking');
    fireEvent.click(screen.getByRole('link', { name: en.familyConsole.mentor }));
    expect(onNavigate).toHaveBeenCalledWith(`/family/${KID_A}/tutor`);
    for (const group of ['learning', 'money', 'connections', 'privacy', 'account']) {
      expect(view.container.querySelector(`[data-console-group="${group}"] [data-slot="${group}"]`), group).not.toBeNull();
    }
    expect(screen.getByText('aside:true')).toBeInTheDocument();
    await screen.findByText(en.familyChildConsent.micOff);
    everyTextHasARole(view.container);
  });

  it('never says "0 to approve" and says coins are unavailable instead of a zero', async () => {
    setup({ 'GET /family/kids': ok({ kids: [childWire({ pendingApprovalCount: 0, walletTotal: null, taskStreakDays: 0 })] }) });
    await screen.findByText(en.familyConsole.coinsUnknown);
    expect(screen.queryByRole('link', { name: /to approve/ })).toBeNull();
    expect(screen.queryByText(/chore streak/)).toBeNull();
  });

  it('picks a child when there are several, and shows that child\'s own state', async () => {
    const { onSelect, rerender, transport } = setup({ 'GET /family/kids': ok({ kids: FAMILY }) });
    const picker = await screen.findByRole('navigation', { name: en.familyConsole.children });
    expect(within(picker).getByRole('button', { name: 'Sofía' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(picker).getByRole('button', { name: 'Mateo' }));
    expect(onSelect).toHaveBeenCalledWith(KID_B);
    rerender(KID_B);
    await screen.findByRole('heading', { level: 2, name: 'Mateo' });
    expect(screen.getByRole('switch', { name: en.familyChildConsent.insights })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('learning:' + KID_B)).toBeInTheDocument();
    await waitFor(() => expect(transport.calls.some((call) => call.path === `/tutor/consent/${KID_B}`)).toBe(true));
  });

  it('sends a Tutor who is not verified yet to verification, with no control on screen', async () => {
    setup({ 'GET /family/kids': refuse('PARENT_VERIFICATION_REQUIRED') });
    expect(await screen.findByRole('link', { name: en.familyConsole.verifyAction })).toHaveAttribute('href', '/verify-parent');
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('says offline when offline, and a retry reads the family again', async () => {
    let calls = 0;
    const { transport } = setup({ 'GET /family/kids': () => (++calls === 1 ? refuse('NETWORK') : ok({ kids: [FAMILY[0]] })) });
    expect(await screen.findByText(en.familyConsole.offlineBody)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.familyConsole.retry }));
    await screen.findByRole('heading', { level: 2, name: 'Sofía' });
    expect(transport.calls.filter((call) => call.path === '/family/kids')).toHaveLength(2);
  });

  it('shows the empty family with the way to add a child, and no child-only pieces', async () => {
    const { aside } = setup({ 'GET /family/kids': ok({ kids: [] }) });
    expect(await screen.findByRole('heading', { name: en.familyConsole.emptyTitle })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.familyChildAccount.add })).toBeInTheDocument();
    expect(aside).toHaveBeenLastCalledWith(false);
  });
});

describe('Usage-data consent', () => {
  it('never flips before Core confirms, keeps the old state on failure, and uses the verb for the direction', async () => {
    let release: (value: ReturnType<typeof refuse>) => void = () => {};
    const { transport } = setup({
      'GET /family/kids': ok({ kids: [FAMILY[0]] }),
      [`POST /family/kids/${KID_A}/analytics-consent`]: () => new Promise((resolve) => { release = resolve; }),
    });
    const toggle = await screen.findByRole('switch', { name: en.familyChildConsent.insights });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveAttribute('aria-busy', 'true');
    await act(async () => { release(refuse('DATA_UNAVAILABLE')); });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(await screen.findByRole('alert')).toHaveTextContent(en.familyChildConsent.insightsFailed);
    expect(transport.calls.find((call) => call.path.endsWith('/analytics-consent'))?.method).toBe('POST');
  });

  it('shows the new state once Core confirms it', async () => {
    setup({ 'GET /family/kids': ok({ kids: [FAMILY[0]] }), [`POST /family/kids/${KID_A}/analytics-consent`]: ok({ kidId: KID_A, analyticsConsent: true }) });
    const toggle = await screen.findByRole('switch', { name: en.familyChildConsent.insights });
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
  });
});

describe('Adding a child', () => {
  async function openForm(routes: Record<string, Answer> = {}) {
    const ctx = setup({ 'GET /family/kids': ok({ kids: [] }), ...routes });
    fireEvent.click(await screen.findByRole('button', { name: en.familyChildAccount.add }));
    return ctx;
  }
  const fillIn = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

  it('asks for a first name, a username, a passphrase and an optional birth date, and nothing else', async () => {
    await openForm();
    const form = screen.getByRole('heading', { name: en.familyChildAccount.addTitle }).closest('section')!;
    const fields = [...form.querySelectorAll('input')].map((input) => input.type);
    expect(fields).toEqual(['text', 'text', 'password', 'date']);
    expect(form.querySelector('input[type=email], input[autocomplete=email]')).toBeNull();
    expect(screen.queryByRole('heading', { name: en.familyConsole.emptyTitle })).toBeNull();
  });

  it('sends exactly the documented fields, normalised, with a null birth date when skipped, and confirms without the passphrase', async () => {
    const onAdded = vi.fn();
    const { transport, onSelect } = await openForm({ 'POST /family/kids': ok({ kid: { userId: KID_A, displayName: 'Ana', username: 'ana_2016' } }) });
    void onAdded;
    fillIn(en.familyChildAccount.name, ' Ana ');
    fillIn(en.familyChildAccount.username, 'Ana_2016');
    fillIn(en.familyChildAccount.passphrase, 'a long secret');
    fireEvent.click(screen.getByRole('button', { name: en.familyChildAccount.create }));
    await screen.findByText('Ana signs in as @ana_2016 with the passphrase you chose.');
    expect(transport.calls.find((call) => call.method === 'POST')).toEqual({ method: 'POST', path: '/family/kids',
      body: { displayName: 'Ana', username: 'ana_2016', passphrase: 'a long secret', birthDate: null, locale: 'en-US' } });
    expect(document.body.textContent).not.toContain('a long secret');
    expect(onSelect).toHaveBeenCalledWith(KID_A);
  });

  it('will not submit a username or passphrase Core would reject', async () => {
    await openForm();
    fillIn(en.familyChildAccount.name, 'Ana');
    fillIn(en.familyChildAccount.username, 'a!');
    fillIn(en.familyChildAccount.passphrase, 'short');
    expect(screen.getByRole('button', { name: en.familyChildAccount.create })).toBeDisabled();
    expect(screen.getByText(en.familyChildAccount.usernameInvalid)).toBeInTheDocument();
    expect(screen.getByText(en.familyChildAccount.passphraseShort)).toBeInTheDocument();
  });

  it('says why Core refused and does not pretend the child exists', async () => {
    const { onSelect } = await openForm({ 'POST /family/kids': refuse('USERNAME_IN_USE') });
    fillIn(en.familyChildAccount.name, 'Ana');
    fillIn(en.familyChildAccount.username, 'ana_2016');
    fillIn(en.familyChildAccount.passphrase, 'a long secret');
    fireEvent.click(screen.getByRole('button', { name: en.familyChildAccount.create }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.familyChildAccount.usernameTaken);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: en.familyChildAccount.create })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Ana' })).toBeNull();
  });
});

describe('Managing a child', () => {
  async function openManage(kid: Record<string, unknown>, routes: Record<string, Answer> = {}) {
    const ctx = setup({ 'GET /family/kids': ok({ kids: [kid] }), ...routes });
    fireEvent.click(await screen.findByRole('button', { name: en.familyChildAccount.manage }));
    return ctx;
  }

  it('renames with only the display name, and never offers the username', async () => {
    const { transport } = await openManage(childWire(), { [`PATCH /family/kids/${KID_A}`]: ok({ kid: { userId: KID_A, displayName: 'Sofi' } }) });
    const panel = screen.getByRole('heading', { name: en.familyChildAccount.manage }).closest('section')!;
    expect(within(panel).getByText(en.familyChildAccount.renameHelp)).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText(en.familyChildAccount.name), { target: { value: 'Sofi' } });
    fireEvent.click(within(panel).getByRole('button', { name: en.familyChildAccount.saveName }));
    await screen.findByRole('heading', { level: 2, name: 'Sofi' });
    expect(transport.calls.find((call) => call.method === 'PATCH')?.body).toEqual({ displayName: 'Sofi' });
  });

  it('saves a new passphrase and clears it from the field', async () => {
    const { transport } = await openManage(childWire(), { [`POST /family/kids/${KID_A}/passphrase`]: ok({ rotated: true }) });
    const field = screen.getByLabelText(en.familyChildAccount.newPassphrase) as HTMLInputElement;
    fireEvent.change(field, { target: { value: 'another long one' } });
    fireEvent.click(screen.getByRole('button', { name: en.familyChildAccount.savePassphrase }));
    await screen.findByText('Saved. Tell Sofía the new passphrase.');
    expect(field.value).toBe('');
    expect(transport.calls.find((call) => call.path.endsWith('/passphrase'))?.body).toEqual({ passphrase: 'another long one' });
  });

  it('keeps removal disabled until the username is typed exactly, names what goes, and removes the child', async () => {
    const { transport } = await openManage(childWire(), { [`DELETE /family/kids/${KID_A}`]: ok({ deleted: true, status: 'completed' }) });
    expect(screen.getByText("This deletes Sofía's progress, streaks and Mentor talks. It cannot be undone.")).toBeInTheDocument();
    const remove = screen.getByRole('button', { name: en.familyChildAccount.removeAction });
    expect(remove).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Type sofia_2016 to confirm'), { target: { value: 'sofia_201' } });
    expect(remove).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Type sofia_2016 to confirm'), { target: { value: 'SOFIA_2016 ' } });
    fireEvent.click(screen.getByRole('button', { name: en.familyChildAccount.removeAction }));
    const dialog = await screen.findByRole('alertdialog');
    expect(transport.calls.filter((call) => call.method === 'DELETE')).toHaveLength(0);
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: en.familyChildAccount.keep }));
    fireEvent.click(within(dialog).getByRole('button', { name: en.familyChildAccount.removeAction }));
    await screen.findByText("Sofía's account was removed.");
    expect(screen.getByRole('heading', { name: en.familyConsole.emptyTitle })).toBeInTheDocument();
    expect(transport.calls.filter((call) => call.method === 'DELETE')).toHaveLength(1);
  });

  it('keeps the child when Core holds the removal, and says nothing was deleted', async () => {
    await openManage(childWire(), { [`DELETE /family/kids/${KID_A}`]: ok({ deleted: false, status: 'held' }) });
    fireEvent.change(screen.getByLabelText('Type sofia_2016 to confirm'), { target: { value: 'sofia_2016' } });
    fireEvent.click(screen.getByRole('button', { name: en.familyChildAccount.removeAction }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: en.familyChildAccount.removeAction }));
    await screen.findByText(en.familyChildAccount.removeHeld);
    expect(screen.getByRole('heading', { level: 2, name: 'Sofía' })).toBeInTheDocument();
  });

  it('never enables removal for a child with no username, whatever is typed', async () => {
    await openManage(childWire({ username: null }));
    expect(screen.getByText(en.familyChildAccount.removeBlocked)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.familyChildAccount.removeAction })).toBeDisabled();
  });

  it('offers no account management for a self-registered teen', async () => {
    setup({ 'GET /family/kids': ok({ kids: [childWire({ accountType: 'teen' })] }) });
    await screen.findByText('Sofía manages their own sign-in.');
    expect(screen.queryByRole('button', { name: en.familyChildAccount.manage })).toBeNull();
  });

  it('explains Core\'s self-managed refusal when the family list could not say the account is a teen\'s', async () => {
    await openManage(childWire({ accountType: null }), { [`POST /family/kids/${KID_A}/passphrase`]: refuse('ACCOUNT_SELF_MANAGED') });
    fireEvent.change(screen.getByLabelText(en.familyChildAccount.newPassphrase), { target: { value: 'another long one' } });
    fireEvent.click(screen.getByRole('button', { name: en.familyChildAccount.savePassphrase }));
    expect(await screen.findByText('Sofía manages their own sign-in.')).toBeInTheDocument();
    expect(screen.queryByText(en.familyChildAccount.failed)).toBeNull();
  });
});

describe('Microphone consent', () => {
  it('shows the exact wording before a second, deliberate press, and stores what was shown', async () => {
    const { transport } = setup({
      'GET /family/kids': ok({ kids: [FAMILY[0]] }),
      'POST /tutor/consent': ok({ granted: true, grantedAt: '2026-09-21T00:00:00.000Z' }),
    });
    fireEvent.click(await screen.findByRole('button', { name: en.familyChildConsent.micAllow }));
    expect(screen.getByText(en.familyChildConsent.micConsent)).toBeInTheDocument();
    expect(transport.calls.some((call) => call.path === '/tutor/consent')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: en.familyChildConsent.micConfirm }));
    await screen.findByRole('button', { name: en.familyChildConsent.micTurnOff });
    expect(transport.calls.find((call) => call.path === '/tutor/consent')?.body).toEqual({ kidUserId: KID_A, consentText: en.familyChildConsent.micConsent, locale: 'en-US' });
    expect(en.familyChildConsent.micConsent.length).toBeGreaterThanOrEqual(40);
  });

  it('turns off in one press', async () => {
    const { transport } = setup({
      'GET /family/kids': ok({ kids: [FAMILY[0]] }),
      [`GET /tutor/consent/${KID_A}`]: ok(micWire({ active: true, grantedAt: '2026-09-01T00:00:00.000Z' })),
      [`DELETE /tutor/consent/${KID_A}`]: ok({ revoked: true }),
    });
    fireEvent.click(await screen.findByRole('button', { name: en.familyChildConsent.micTurnOff }));
    await screen.findByRole('button', { name: en.familyChildConsent.micAllow });
    expect(transport.calls.filter((call) => call.method === 'DELETE')).toHaveLength(1);
  });

  it('offers nothing to allow while policy keeps the microphone from children, but a past consent stays revocable', async () => {
    setup({ 'GET /family/kids': ok({ kids: [FAMILY[0]] }), [`GET /tutor/consent/${KID_A}`]: ok(micWire({ policy: 'blocked' })) });
    await screen.findByText(en.familyChildConsent.micUnavailable);
    expect(screen.queryByRole('button', { name: en.familyChildConsent.micAllow })).toBeNull();
  });

  it('keeps "turn off" available when a consent exists and policy is closed', async () => {
    setup({ 'GET /family/kids': ok({ kids: [FAMILY[0]] }), [`GET /tutor/consent/${KID_A}`]: ok(micWire({ policy: 'blocked', active: true, grantedAt: '2026-09-01T00:00:00.000Z' })) });
    await screen.findByText(en.familyChildConsent.micPaused);
    expect(screen.getByRole('button', { name: en.familyChildConsent.micTurnOff })).toBeInTheDocument();
  });
});

describe('Copy that assumes no gender (no gender is ever collected for a child)', () => {
  it('es-MX and pt-BR name the child without a masculine-only noun or pronoun', () => {
    const text = (locale: ConsoleLocale) => JSON.stringify([copyFor(locale).family.familyChildAccount, copyFor(locale).family.familyChildConsent,
      copyFor(locale).family.familyChildMentor, copyFor(locale).family.familyConsole]);
    expect(text('es-MX')).not.toMatch(/\bun hijo\b(?! o)|\btu hijo\b(?! o)|\blo van a\b/);
    expect(text('pt-BR')).not.toMatch(/\bum filho\b|\bdele\b|\bele fez\b|chamá-lo|\bseu filho\b/);
  });
});

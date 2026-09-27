import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { RebuildRoot } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import { rebuildNamespaceCopy } from '../../i18n/rebuild';
import { authErrorText, isoDate, type GoogleState } from './authBlocks';
import { LoginScreen, SignupScreen } from './SignInScreens';
import { ForgotPasswordScreen, OAuthCallbackScreen, ResetPasswordScreen, UpgradeAccountScreen } from './RecoveryScreens';
import { VerifyParentScreen } from './VerifyParentScreen';
import { OnboardingFlow } from './OnboardingFlow';
import { AgeScreen } from './AgeScreen';
import { KidSuspendedScreen } from './KidSuspendedScreen';
import { IdDocumentField } from './IdDocumentField';

/*
 * The rebuilt sign-in, recovery, verification and onboarding surfaces (A1–A7,
 * O1; W2S.2): behaviour, states and the SPEC's mechanical rules each surface
 * holds on its own. The bridges' Core contracts are tested beside the routes.
 */

const copy = (locale: Locale = 'en-US') => rebuildNamespaceCopy[locale].site;
const inRoot = (node: ReactNode, locale: Locale = 'en-US') => render(<RebuildRoot theme="light" locale={locale}>{node}</RebuildRoot>);
const noGoogle: GoogleState = { available: false, pending: false, failed: false, onStart: () => {} };

/** 02 rule 19: every visible string sits inside an element that declares its copy role. */
function undeclaredText(container: HTMLElement): string[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const found: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const host = node.parentElement;
    if (!/\p{L}/u.test(node.textContent ?? '') || !host || host.closest('[aria-hidden="true"], [hidden]')) continue;
    if (!host.closest('[data-copy-role]')) found.push(node.textContent!.trim());
  }
  return found;
}

describe('shared pieces', () => {
  it('maps every code Core can answer to words, and anything else to "something went wrong", never a raw code', () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      expect(authErrorText(copy(locale), 'INVALID_CREDENTIALS')).toBe(copy(locale).authCommon.errors.INVALID_CREDENTIALS);
      expect(authErrorText(copy(locale), 'NETWORK_ERROR')).toBe(copy(locale).authCommon.errors.INTERNAL);
    }
  });

  it('accepts only real calendar dates', () => {
    expect(isoDate({ day: '4', month: '7', year: '1988' })).toBe('1988-07-04');
    expect(isoDate({ day: '31', month: '2', year: '2010' })).toBeNull();
    expect(isoDate({ day: '1', month: '13', year: '2010' })).toBeNull();
    expect(isoDate({ day: '1', month: '1', year: '88' })).toBeNull();
  });
});

describe('A1 Log in', () => {
  it('takes an email or a username, never an email-only field, and submits both values once', () => {
    const onSubmit = vi.fn();
    const { container } = inRoot(<LoginScreen locale="en-US" google={noGoogle} pending={false} errorCode={null} onSubmit={onSubmit} />);
    const identifier = screen.getByLabelText(copy().authLogin.identifier);
    expect(identifier).toHaveAttribute('type', 'text');
    expect(identifier).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByRole('button', { name: copy().authLogin.submit })).toBeDisabled();
    fireEvent.change(identifier, { target: { value: ' kiddo_7 ' } });
    fireEvent.change(screen.getByLabelText(copy().authCommon.password), { target: { value: 'passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: copy().authLogin.submit }));
    expect(onSubmit).toHaveBeenCalledWith('kiddo_7', 'passphrase');
    expect(screen.getByRole('link', { name: copy().authLogin.forgot })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('link', { name: copy().authLogin.signup })).toHaveAttribute('href', '/signup');
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('main')).toBeNull();
    expect(undeclaredText(container)).toEqual([]);
  });

  it('reveals the password on request and says the specific reason a sign-in failed', () => {
    inRoot(<LoginScreen locale="en-US" google={noGoogle} pending={false} errorCode="EMAIL_NOT_CONFIRMED" onSubmit={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(copy().authCommon.errors.EMAIL_NOT_CONFIRMED);
    const password = screen.getByLabelText(copy().authCommon.password);
    fireEvent.click(screen.getByRole('button', { name: copy().authCommon.showPassword }));
    expect(password).toHaveAttribute('type', 'text');
  });

  it('shows Google only when Core has it enabled, as words without a third-party mark, and says a failed start', () => {
    const onStart = vi.fn();
    const { rerender, container } = inRoot(<LoginScreen locale="en-US" google={noGoogle} pending={false} errorCode={null} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: copy().authCommon.google })).toBeNull();
    rerender(<RebuildRoot theme="light" locale="en-US"><LoginScreen locale="en-US" google={{ available: true, pending: false, failed: true, onStart }} pending={false} errorCode={null} onSubmit={vi.fn()} /></RebuildRoot>);
    fireEvent.click(screen.getByRole('button', { name: copy().authCommon.google }));
    expect(onStart).toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(copy().authCommon.googleFailed);
    expect(container.querySelector('[data-auth="google"] svg, [data-auth="google"] img')).toBeNull();
  });
});

describe('A2 Sign up', () => {
  it('collects name, email, password (8+), a real date and the intent, and submits only when all are valid', () => {
    const onSubmit = vi.fn();
    const onFirstEdit = vi.fn();
    const { container } = inRoot(<SignupScreen locale="en-US" google={noGoogle} view={{ kind: 'form', pending: false, errorCode: null }} initialParentIntent
      onSubmit={onSubmit} onFirstEdit={onFirstEdit} onStartGuest={vi.fn()} />);
    const c = copy();
    expect(screen.getByRole('checkbox', { name: c.authSignup.tutorIntent })).toBeChecked();
    fireEvent.focus(screen.getByLabelText(c.authSignup.name));
    expect(onFirstEdit).toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(c.authSignup.name), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(c.authCommon.email), { target: { value: 'ana@example.test' } });
    fireEvent.change(screen.getByLabelText(c.authCommon.password), { target: { value: 'short' } });
    expect(screen.getByText(c.authCommon.passwordShort)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(c.authCommon.password), { target: { value: 'long-enough' } });
    fireEvent.change(screen.getByLabelText(c.authCommon.day), { target: { value: '31' } });
    fireEvent.change(screen.getByLabelText(c.authCommon.month), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(c.authCommon.year), { target: { value: '1990' } });
    expect(screen.getByText(c.authCommon.dateInvalid)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: c.authSignup.submit })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(c.authCommon.day), { target: { value: '28' } });
    fireEvent.click(screen.getByRole('button', { name: c.authSignup.submit }));
    expect(onSubmit).toHaveBeenCalledWith({ displayName: 'Ana', email: 'ana@example.test', password: 'long-enough', birthDate: '1990-02-28', parentIntent: true });
    expect(undeclaredText(container)).toEqual([]);
  });

  it('says where the confirmation went, the email as user data', () => {
    const { container } = inRoot(<SignupScreen locale="en-US" google={noGoogle} view={{ kind: 'confirm', email: 'a.very.long.address@example.test' }}
      initialParentIntent={false} onSubmit={vi.fn()} onStartGuest={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy().authSignup.confirmTitle);
    expect(screen.getByText('a.very.long.address@example.test')).toHaveAttribute('data-copy-role', 'data');
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
    expect(undeclaredText(container)).toEqual([]);
  });

  it('refuses under 13 with the guest way on (A.2), a pending start and a failure beside it', () => {
    const onStartGuest = vi.fn();
    const { rerender } = inRoot(<SignupScreen locale="es-MX" google={noGoogle} view={{ kind: 'refused', starting: false, failed: false }}
      initialParentIntent={false} onSubmit={vi.fn()} onStartGuest={onStartGuest} />, 'es-MX');
    const c = copy('es-MX');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(c.authSignup.refusedTitle);
    expect(screen.queryByLabelText(c.authCommon.email)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: c.authSignup.tryGuest }));
    expect(onStartGuest).toHaveBeenCalled();
    rerender(<RebuildRoot theme="light" locale="es-MX"><SignupScreen locale="es-MX" google={noGoogle} view={{ kind: 'refused', starting: true, failed: false }}
      initialParentIntent={false} onSubmit={vi.fn()} onStartGuest={onStartGuest} /></RebuildRoot>);
    expect(screen.getByRole('button', { name: c.authSignup.starting })).toHaveAttribute('aria-busy', 'true');
    rerender(<RebuildRoot theme="light" locale="es-MX"><SignupScreen locale="es-MX" google={noGoogle} view={{ kind: 'refused', starting: false, failed: true }}
      initialParentIntent={false} onSubmit={vi.fn()} onStartGuest={onStartGuest} /></RebuildRoot>);
    expect(screen.getByRole('alert')).toHaveTextContent(c.authSignup.guestFailed);
  });
});

describe('A3–A6 recovery, the Google return and saving progress', () => {
  it('A3: the same confirmation for every address, and a refused request is not called "sent"', () => {
    const onSubmit = vi.fn();
    const { rerender } = inRoot(<ForgotPasswordScreen locale="en-US" view={{ kind: 'form', pending: false, errorCode: 'RATE_LIMITED' }} onSubmit={onSubmit} />);
    expect(screen.getByRole('alert')).toHaveTextContent(copy().authCommon.errors.RATE_LIMITED);
    fireEvent.change(screen.getByLabelText(copy().authCommon.email), { target: { value: 'x@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: copy().authForgot.submit }));
    expect(onSubmit).toHaveBeenCalledWith('x@example.test');
    rerender(<RebuildRoot theme="light" locale="en-US"><ForgotPasswordScreen locale="en-US" view={{ kind: 'sent', email: 'x@example.test' }} onSubmit={onSubmit} /></RebuildRoot>);
    expect(screen.getByText(copy().authForgot.sentBody)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy().authCommon.backToLogin })).toHaveAttribute('href', '/login');
  });

  it('A4: checking, expired (with a new link), the 8-character rule and done', () => {
    const { rerender } = inRoot(<ResetPasswordScreen locale="en-US" view={{ kind: 'checking' }} onSubmit={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(copy().authReset.checking);
    rerender(<RebuildRoot theme="light" locale="en-US"><ResetPasswordScreen locale="en-US" view={{ kind: 'expired' }} onSubmit={vi.fn()} /></RebuildRoot>);
    expect(screen.getByRole('link', { name: copy().authReset.requestNew })).toHaveAttribute('href', '/forgot-password');
    // Reached on arrival: nothing takes focus (the skip link stays first).
    expect(document.activeElement).toBe(document.body);
    const onSubmit = vi.fn();
    rerender(<RebuildRoot theme="light" locale="en-US"><ResetPasswordScreen locale="en-US" view={{ kind: 'form', pending: false, errorCode: null }} onSubmit={onSubmit} /></RebuildRoot>);
    fireEvent.change(screen.getByLabelText(copy().authReset.newPassword), { target: { value: '1234567' } });
    expect(screen.getByRole('button', { name: copy().authReset.submit })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(copy().authReset.newPassword), { target: { value: '12345678' } });
    fireEvent.click(screen.getByRole('button', { name: copy().authReset.submit }));
    expect(onSubmit).toHaveBeenCalledWith('12345678');
    rerender(<RebuildRoot theme="light" locale="en-US"><ResetPasswordScreen locale="en-US" view={{ kind: 'done' }} onSubmit={onSubmit} /></RebuildRoot>);
    expect(screen.getByRole('link', { name: copy().authReset.login })).toHaveAttribute('href', '/login');
  });

  it('A5: signing in, or the way back', () => {
    const { rerender } = inRoot(<OAuthCallbackScreen locale="pt-BR" failed={false} />, 'pt-BR');
    expect(screen.getByRole('status')).toHaveTextContent(copy('pt-BR').authCallback.signingIn);
    rerender(<RebuildRoot theme="light" locale="pt-BR"><OAuthCallbackScreen locale="pt-BR" failed /></RebuildRoot>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy('pt-BR').authCallback.failedTitle);
    expect(screen.getByRole('link', { name: copy('pt-BR').authCommon.backToLogin })).toHaveAttribute('href', '/login');
  });

  it('A6: an email and a password (8+), "Not now" and "Log in" instead', () => {
    const onSubmit = vi.fn();
    const onLater = vi.fn();
    const { container } = inRoot(<UpgradeAccountScreen locale="en-US" pending={false} errorCode="EMAIL_IN_USE" onSubmit={onSubmit} onLater={onLater} />);
    expect(screen.getByRole('alert')).toHaveTextContent(copy().authCommon.errors.EMAIL_IN_USE);
    fireEvent.change(screen.getByLabelText(copy().authCommon.email), { target: { value: 'kid@example.test' } });
    fireEvent.change(screen.getByLabelText(copy().authCommon.password), { target: { value: 'long-enough' } });
    fireEvent.click(screen.getByRole('button', { name: copy().authUpgrade.submit }));
    expect(onSubmit).toHaveBeenCalledWith('kid@example.test', 'long-enough');
    fireEvent.click(screen.getByRole('button', { name: copy().authUpgrade.later }));
    expect(onLater).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: copy().authUpgrade.login })).toHaveAttribute('href', '/login');
    expect(undeclaredText(container)).toEqual([]);
  });
});

describe('A7 Become a Tutor', () => {
  const props = { locale: 'en-US' as const, homeHref: '/learn', familyHref: '/family', onRetryStatus: vi.fn(), onStart: vi.fn(), onSubmit: vi.fn() };

  it('explains the three steps before any form, with the way out', () => {
    const { container } = inRoot(<VerifyParentScreen {...props} view={{ kind: 'intro' }} />);
    expect(container.querySelectorAll('.lf-auth-step')).toHaveLength(3);
    expect(container.querySelector('input')).toBeNull();
    expect(screen.getByRole('link', { name: copy().authVerify.notNow })).toHaveAttribute('href', '/learn');
    expect(undeclaredText(container)).toEqual([]);
  });

  it('puts the privacy promise first on the form, asks no document type, and holds the photo to the server’s limits', () => {
    const { container } = inRoot(<VerifyParentScreen {...props} view={{ kind: 'form', pending: false, errorCode: null, failedChecks: null }} />);
    const page = container.querySelector('[data-screen="verify-form"]')!;
    expect(page.querySelector('[data-copy-role="legal"]')).toBe(page.querySelector('.lf-auth-privacy'));
    expect(within(page as HTMLElement).queryByLabelText(/document type|type of document/i)).toBeNull();
    const photo = screen.getByLabelText(copy().authVerify.photo);
    expect(photo).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    const big = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 9 * 1024 * 1024 });
    fireEvent.change(photo, { target: { files: [big] } });
    expect(screen.getByText(copy().authVerify.photoSize)).toBeInTheDocument();
    expect(undeclaredText(container)).toEqual([]);
  });

  it('a verdict with no named check still says it failed and offers a person', () => {
    inRoot(<VerifyParentScreen {...props} view={{ kind: 'form', pending: false, errorCode: null, failedChecks: [] }} />);
    expect(screen.getByRole('status')).toHaveTextContent(copy().authVerify.failTitle);
    expect(screen.getByRole('link', { name: copy().authVerify.writeToUs })).toBeInTheDocument();
  });
});

describe('the ID photo field (the one reviewed upload surface)', () => {
  it('is a real file input named by its label, with help and error described and the chosen name as data', () => {
    const onFileChange = vi.fn();
    const { rerender, container } = render(<IdDocumentField label="Photo of your ID" help="Up to 8 MB." accept="image/png" file={null}
      onFileChange={onFileChange} chooseLabel="Choose photo" replaceLabel="Change photo" />);
    const input = screen.getByLabelText('Photo of your ID');
    expect(input).toHaveAttribute('type', 'file');
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
    expect(container.querySelector('.lf-id-document-action')).toHaveTextContent('Choose photo');
    const file = new File(['x'], 'passport.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileChange).toHaveBeenCalledWith(file);
    rerender(<IdDocumentField label="Photo of your ID" accept="image/png" file={file} onFileChange={onFileChange} chooseLabel="Choose photo" replaceLabel="Change photo" error="Too large." />);
    expect(container.querySelector('.lf-id-document-action')).toHaveTextContent('Change photo');
    expect(screen.getByText('passport.png')).toHaveAttribute('data-copy-role', 'data');
    expect(screen.getByLabelText('Photo of your ID')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('O1 Onboarding', () => {
  const mentor = { chosen: null, saving: null, failed: false, onChoose: vi.fn() };

  it('is one full-bleed single-state screen per step, within the youngest band’s first view', () => {
    const { container } = inRoot(<OnboardingFlow locale="en-US" skipLabel="Skip to content" mentor={mentor} completing={null} failed={false} onComplete={vi.fn()} />);
    expect(container.querySelector('[data-shell="single-state"]')).toHaveAttribute('data-hue', 'primary');
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(container.querySelector('[data-age-band="6-9"]')).not.toBeNull();
    const words = (container.querySelector('main')!.textContent ?? '').split(/\s+/).filter(Boolean).length;
    expect(words).toBeLessThanOrEqual(25);
    expect(undeclaredText(container)).toEqual([]);
  });

  it('offers the four Mentors with their names and short lines (08 §8: at most 6 words each)', () => {
    const { container } = inRoot(<OnboardingFlow locale="pt-BR" skipLabel="Pular" mentor={{ ...mentor, chosen: 'dina' }} completing={null} failed={false}
      onComplete={vi.fn()} initialStep="mentor" initialName="Ana" />, 'pt-BR');
    const lines = copy('pt-BR').onboardingFlow.lines;
    for (const line of Object.values(lines)) expect(line.split(/\s+/).length).toBeLessThanOrEqual(6);
    expect(container.querySelectorAll('[data-slot="mentor-avatar"] img[data-character]')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /Dina/ })).toHaveTextContent(copy('pt-BR').onboardingFlow.chosen);
    expect(undeclaredText(container)).toEqual([]);
  });

  it('the account step reports which choice is in flight and keeps the other still', () => {
    inRoot(<OnboardingFlow locale="en-US" skipLabel="Skip" mentor={mentor} completing="created_now" failed={false} onComplete={vi.fn()} initialStep="account" initialName="Ana" />);
    expect(screen.getByRole('button', { name: copy().onboardingFlow.saving })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: copy().onboardingFlow.later })).toBeDisabled();
  });
});

describe('the age question (A.3) and the paused account (A.1)', () => {
  const ageCopy = rebuildNamespaceCopy['en-US'].site.ageScreen;
  const handlers = { onSubmit: vi.fn(), onRetry: vi.fn(), onExit: vi.fn() };

  it('is a single-state screen of its own when it is the whole screen', () => {
    const { container } = render(<AgeScreen copy={ageCopy} locale="en-US" dark={false} state="form" {...handlers} />);
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(container.querySelector('[data-shell="single-state"] .lf-age-date')).not.toBeNull();
    expect(container.querySelector('.lf-skip-link')).not.toBeNull();
  });

  it('is the page’s content only inside a shell’s <main>, so the page keeps one <main>', () => {
    const { container } = render(<div data-shell="auth"><main><AgeScreen copy={ageCopy} locale="en-US" dark state="form" {...handlers} /></main></div>);
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(container.querySelector('[data-shell="single-state"]')).toBeNull();
    expect(container.querySelectorAll('.lf-age-date input')).toHaveLength(3);
  });

  it('the paused-account screen offers the support address as a link a parent can press', () => {
    const suspended = rebuildNamespaceCopy['es-MX'].site.kidSuspended;
    const { container } = inRoot(<KidSuspendedScreen copy={suspended} variant="suspended" />, 'es-MX');
    expect(screen.getByRole('link', { name: suspended.supportEmail })).toHaveAttribute('href', `mailto:${suspended.supportEmail}`);
    expect(container.textContent).not.toContain('{email}');
    expect(undeclaredText(container)).toEqual([]);
  });
});

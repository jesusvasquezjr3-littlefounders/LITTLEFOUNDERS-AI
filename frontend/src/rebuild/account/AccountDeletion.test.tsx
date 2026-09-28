import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import en from '../../i18n/en-US/rebuild-profile.json';
import es from '../../i18n/es-MX/rebuild-profile.json';
import pt from '../../i18n/pt-BR/rebuild-profile.json';
import { AccountDeletion, type AccountDeletionView } from './AccountDeletion';
import { ACCOUNT_DELETION_PREVIEW_STATES } from './AccountDeletionPreview';

/*
 * E.6 at the surface: the person sees the shape and the timeline before
 * confirming (Law 5), the confirmation cannot be sent without the explicit
 * acknowledgement (and the password where Core asks for it), the stated date
 * is shown afterwards, and a parent-created child gets no control at all.
 * Core enforces every one of these again (backend accountDeletion.test.ts).
 */

afterEach(() => cleanup());

const ready = (patch: Partial<Extract<AccountDeletionView, { kind: 'ready' }>> = {}): AccountDeletionView => ({
  kind: 'ready', step: 'intro', immediate: false, graceDays: 14, reauth: 'password', pausedChildren: 0, submitting: false, error: null, ...patch,
});

describe('AccountDeletion', () => {
  it('states the timeline, how to keep the account and what gets deleted before anything is confirmed', () => {
    const onStart = vi.fn();
    render(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={ready()} onStart={onStart} />);
    expect(screen.getByText('We delete your account and its data 14 days after you confirm.')).toBeTruthy();
    expect(screen.getByText('Sign in before that date to keep it.')).toBeTruthy();
    const summary = screen.getByText('What gets deleted');
    expect(summary.tagName).toBe('SUMMARY');
    expect(screen.getByText(/stay, without your name/)).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('cannot confirm until the acknowledgement is ticked and the password entered', () => {
    const onConfirm = vi.fn();
    render(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={ready({ step: 'confirm' })} onConfirm={onConfirm} />);
    const confirm = screen.getByRole('button', { name: 'Confirm deletion' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'I understand this cannot be undone' }));
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter22' } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith({ password: 'hunter22' });
  });

  it('a guest confirms with no password and is told the deletion is immediate', () => {
    const onConfirm = vi.fn();
    const { rerender } = render(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={ready({ immediate: true, graceDays: 0, reauth: 'none' })} />);
    expect(screen.getByText('We delete your account and its data as soon as you confirm.')).toBeTruthy();
    expect(screen.queryByText('Sign in before that date to keep it.')).toBeNull();
    rerender(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={ready({ step: 'confirm', immediate: true, graceDays: 0, reauth: 'none' })} onConfirm={onConfirm} />);
    expect(screen.queryByLabelText('Password')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    expect(onConfirm).toHaveBeenCalledWith({ password: null });
  });

  it('names the children a parent supervises alone, and their 90-day rule, right above the decision', () => {
    const { rerender } = render(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={ready({ step: 'confirm', pausedChildren: 1 })} />);
    expect(screen.getByText('1 child account only you supervise will be paused.')).toBeTruthy();
    expect(screen.getByText('Without another Tutor, a paused account is deleted after 90 days.')).toBeTruthy();
    rerender(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={ready({ step: 'confirm', pausedChildren: 3 })} />);
    expect(screen.getByText('3 child accounts only you supervise will be paused.')).toBeTruthy();
    rerender(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={ready({ step: 'confirm', pausedChildren: 0 })} />);
    expect(screen.queryByText(/will be paused/)).toBeNull();
  });

  it('tells a linked teen, right above the decision, that their Tutors are told the date (D-14 (b))', () => {
    const { rerender } = render(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={ready({ step: 'confirm', tutorsTold: 1 })} />);
    expect(screen.getByText('We tell your Tutor the deletion date.')).toBeTruthy();
    rerender(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={ready({ step: 'confirm', tutorsTold: 2 })} />);
    expect(screen.getByText('We tell your 2 Tutors the deletion date.')).toBeTruthy();
    rerender(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={ready({ step: 'confirm', tutorsTold: 0 })} />);
    expect(screen.queryByText(/deletion date/)).toBeNull();
  });

  it('reports a wrong password and a stale sign-in as alerts, and offers to sign in again', () => {
    const onSignIn = vi.fn();
    const { rerender } = render(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={ready({ step: 'confirm', error: 'password' })} />);
    expect(screen.getByRole('alert').textContent).toBe('That password is not right. Try again.');
    expect(screen.getByLabelText('Password').getAttribute('aria-invalid')).toBe('true');
    rerender(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={ready({ step: 'confirm', reauth: 'recent_sign_in', error: 'reauth' })} onSignIn={onSignIn} />);
    expect(screen.getByRole('alert').textContent).toBe('For your safety, sign in again first.');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }));
    expect(onSignIn).toHaveBeenCalledOnce();
  });

  it('shows the stated date in the reader’s locale with the keep action, and the held and signed-out variants', () => {
    const onKeep = vi.fn();
    const scheduled = { kind: 'scheduled', status: 'pending', scheduledFor: '2026-10-08T21:00:00.000Z', signedOut: false, keeping: false, keepFailed: false } as const;
    const { rerender } = render(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={scheduled} onKeep={onKeep} />);
    expect(screen.getByRole('heading').textContent).toBe('Deletion scheduled');
    expect(screen.getByText(/Your account will be deleted on Oct 8, 2026\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep account' }));
    expect(onKeep).toHaveBeenCalledOnce();
    rerender(<AccountDeletion copy={es.accountDeletion} locale="es-MX" dark={false} view={scheduled} onKeep={onKeep} />);
    expect(screen.getByText(/Tu cuenta se eliminará el 8 oct 2026\./)).toBeTruthy();
    rerender(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={{ ...scheduled, status: 'held' }} />);
    expect(screen.getByText('Deletion is paused while we review a safety report.')).toBeTruthy();
    rerender(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={{ ...scheduled, signedOut: true }} />);
    expect(screen.queryByRole('button', { name: 'Keep account' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    rerender(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={{ ...scheduled, status: 'processing' }} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('gives a parent-created child and staff no control, only who removes the account', () => {
    const { rerender } = render(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={{ kind: 'blocked', reason: 'kid' }} />);
    expect(screen.getByText('Your Tutor can delete this account from Family.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<AccountDeletion copy={en.accountDeletion} locale="en-US" dark={false} view={{ kind: 'blocked', reason: 'staff' }} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('every visible string declares its copy role, in every state and locale', () => {
    for (const copy of [en.accountDeletion, es.accountDeletion, pt.accountDeletion]) {
      for (const [name, view] of Object.entries(ACCOUNT_DELETION_PREVIEW_STATES)) {
        const { container, unmount } = render(<AccountDeletion copy={copy} locale="en-US" dark={false} view={view}
          layout="screen" onSignOut={() => undefined} onContinue={() => undefined} />);
        for (const element of container.querySelectorAll('p, h1, h2, button, summary, label span')) {
          // A string, not a box: the shared Checkbox's control span inside the label holds no text.
          if (!element.textContent?.trim() && element.tagName !== 'BUTTON') continue;
          expect(element.getAttribute('data-copy-role'), `${name}: ${element.textContent}`).toBeTruthy();
        }
        unmount();
      }
    }
  });

  it('uses the controlled glossary: Tutor is the verified parent, the AI is the Mentor, coins are never money', () => {
    for (const copy of [en.accountDeletion, es.accountDeletion, pt.accountDeletion]) {
      const text = Object.values(copy).join(' ');
      expect(text).not.toMatch(/\bmoney\b|\bdinero\b|\bdinheiro\b|\bAI\b|\bIA\b|chatbot/i);
      expect(text).toMatch(/Mentor/);
      expect(text).not.toMatch(/—|!/);
    }
  });
});

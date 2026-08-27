import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManageKidPanel } from '../ManageKidPanel';

/*
 * Managing an existing child. The two properties worth pinning are both about
 * refusing to do something:
 *
 *  - the username is never offered for editing, because the child's auth
 *    address is derived from it and renaming the handle alone would strand the
 *    account at sign-in;
 *  - removal cannot be reached without typing that username, because a hard
 *    delete of a minor's whole record is not something a person should be able
 *    to trigger by muscle memory.
 */

const { mockApi, mockGetToken } = vi.hoisted(() => ({
  mockApi: vi.fn(),
  mockGetToken: vi.fn().mockResolvedValue('fake-token'),
}));

vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: mockGetToken }) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
    i18n: { resolvedLanguage: 'es-MX' },
  }),
}));

const KID = { userId: 'kid-1', displayName: 'Sofía', username: 'sofia_2016' };

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockResolvedValue({ data: { ok: true }, error: null });
});

function open(mode: 'rename' | 'rotate' | 'remove', props = {}) {
  render(<ManageKidPanel kid={KID} onRenamed={vi.fn()} onRemoved={vi.fn()} {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /family.manageKid.manage/ }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`family.manageKid.${mode}$`) }));
}

describe('ManageKidPanel', () => {
  it('never offers the username for editing, and says why', () => {
    open('rename');
    expect(screen.queryByLabelText(/family.addKid.username/)).toBeNull();
    expect(screen.getByText(/family.manageKid.usernameFixed/)).toBeInTheDocument();
  });

  it('renames through PATCH and sends only the display name', async () => {
    const onRenamed = vi.fn();
    open('rename', { onRenamed });
    fireEvent.change(screen.getByLabelText(/family.addKid.displayName/), { target: { value: 'Sofía Ren' } });
    fireEvent.click(screen.getByRole('button', { name: /family.manageKid.renameCta/ }));

    await waitFor(() => expect(mockApi).toHaveBeenCalled());
    const [path, init] = mockApi.mock.calls[0] as [string, { method: string; body: Record<string, unknown> }];
    expect(path).toBe('/family/kids/kid-1');
    expect(init.method).toBe('PATCH');
    expect(Object.keys(init.body)).toEqual(['displayName']);
    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith('kid-1', 'Sofía Ren'));
  });

  it('rotates the passphrase and clears it from the field afterwards', async () => {
    open('rotate');
    fireEvent.change(screen.getByLabelText(/family.addKid.passphrase/), { target: { value: 'frase-nueva-larga' } });
    fireEvent.click(screen.getByRole('button', { name: /family.manageKid.rotateCta/ }));

    await waitFor(() => expect(screen.getByText(/family.manageKid.rotateDone/)).toBeInTheDocument());
    const [path, init] = mockApi.mock.calls[0] as [string, { method: string }];
    expect(path).toBe('/family/kids/kid-1/passphrase');
    expect(init.method).toBe('POST');
    // The value must not survive on screen once it has been set.
    expect(document.body.textContent).not.toContain('frase-nueva-larga');
  });

  it('keeps removal disabled until the username is typed exactly', async () => {
    const onRemoved = vi.fn();
    open('remove', { onRemoved });
    const button = screen.getByRole('button', { name: /family.manageKid.removeCta/ });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/family.manageKid.removeConfirm/), { target: { value: 'sofia' } });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/family.manageKid.removeConfirm/), { target: { value: 'sofia_2016' } });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith('kid-1'));
    const [path, init] = mockApi.mock.calls[0] as [string, { method: string }];
    expect(path).toBe('/family/kids/kid-1');
    expect(init.method).toBe('DELETE');
  });

  it('names what removal destroys, rather than asking "are you sure"', () => {
    open('remove');
    expect(screen.getByText(/family.manageKid.removeWarning/)).toBeInTheDocument();
  });

  it('does not remove the child from the list when the API refuses', async () => {
    mockApi.mockResolvedValue({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'down' } });
    const onRemoved = vi.fn();
    open('remove', { onRemoved });
    fireEvent.change(screen.getByLabelText(/family.manageKid.removeConfirm/), { target: { value: 'sofia_2016' } });
    fireEvent.click(screen.getByRole('button', { name: /family.manageKid.removeCta/ }));

    await waitFor(() => expect(screen.getByText(/DATA_UNAVAILABLE/)).toBeInTheDocument());
    expect(onRemoved).not.toHaveBeenCalled();
  });
});

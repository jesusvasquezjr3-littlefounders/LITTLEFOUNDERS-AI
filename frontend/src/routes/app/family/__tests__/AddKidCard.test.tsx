import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddKidCard } from '../AddKidCard';

/*
 * The add-a-child form. What matters here is not that it renders - it is what
 * it SENDS and what it refuses to send.
 *
 * §1.9 caps what may travel with a minor at "age band + first name". This form
 * is the collection point, so the test asserts the request body by its exact
 * key set rather than by spot-checking a field: a future edit that quietly adds
 * a surname, an email or an address has to fail here.
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

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockResolvedValue({
    data: { kid: { userId: 'kid-1', displayName: 'Sofía', username: 'sofia_2016' } },
    error: null,
  });
  mockGetToken.mockResolvedValue('fake-token');
});

function open() {
  render(<AddKidCard onCreated={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /family.addKid.cta/ }));
}

function fill({ name = 'Sofía', username = 'sofia_2016', pass = 'una-frase-larga', birth = '' } = {}) {
  fireEvent.change(screen.getByLabelText(/family.addKid.displayName$/), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/family.addKid.username$/), { target: { value: username } });
  fireEvent.change(screen.getByLabelText(/family.addKid.passphrase$/), { target: { value: pass } });
  if (birth) fireEvent.change(screen.getByLabelText(/family.addKid.birthDate$/), { target: { value: birth } });
}

describe('AddKidCard', () => {
  it('asks for a first name, a username and a passphrase — and nothing else', () => {
    open();
    const labels = screen.getAllByText(/family\.addKid\.(displayName|username|passphrase|birthDate)$/);
    expect(labels.length).toBe(4);
    // The fields a child account must never have.
    for (const forbidden of [/email/i, /surname/i, /address/i, /apellido/i, /domicilio/i]) {
      expect(screen.queryByLabelText(forbidden)).toBeNull();
    }
  });

  it('sends exactly the five documented fields, with the username normalised', async () => {
    open();
    fill({ username: 'Sofia_2016', birth: '2016-04-09' });
    fireEvent.click(screen.getByRole('button', { name: /family.addKid.submit/ }));

    await waitFor(() => expect(mockApi).toHaveBeenCalled());
    const [path, init] = mockApi.mock.calls[0] as [string, { method: string; body: Record<string, unknown> }];
    expect(path).toBe('/family/kids');
    expect(init.method).toBe('POST');
    // An EXACT key set, so adding a field to this form is a deliberate act that
    // has to update this list.
    expect(Object.keys(init.body).sort()).toEqual(
      ['birthDate', 'displayName', 'locale', 'passphrase', 'username'].sort(),
    );
    expect(init.body.username).toBe('sofia_2016');
    expect(init.body.locale).toBe('es-MX');
  });

  it('sends a null birth date rather than an empty string when it is skipped', async () => {
    open();
    fill();
    fireEvent.click(screen.getByRole('button', { name: /family.addKid.submit/ }));
    await waitFor(() => expect(mockApi).toHaveBeenCalled());
    const [, init] = mockApi.mock.calls[0] as [string, { body: Record<string, unknown> }];
    // The field is optional; '' is not a date and Core's regex would reject it.
    expect(init.body.birthDate).toBeNull();
  });

  it('will not submit a username the database would reject', () => {
    open();
    fill({ username: 'ab' });
    expect(screen.getByRole('button', { name: /family.addKid.submit/ })).toBeDisabled();
    expect(mockApi).not.toHaveBeenCalled();
  });

  it('will not submit a passphrase under 8 characters', () => {
    open();
    fill({ pass: 'short' });
    expect(screen.getByRole('button', { name: /family.addKid.submit/ })).toBeDisabled();
  });

  it('confirms with the username and never re-displays the passphrase', async () => {
    open();
    fill({ pass: 'una-frase-muy-particular' });
    fireEvent.click(screen.getByRole('button', { name: /family.addKid.submit/ }));

    await waitFor(() => expect(screen.getByText(/family.addKid.doneTitle/)).toBeInTheDocument());
    expect(screen.getByText(/sofia_2016/)).toBeInTheDocument();
    // Showing a credential back to the person who just chose it teaches
    // nothing and puts it on screen for whoever is standing behind them.
    expect(document.body.textContent).not.toContain('una-frase-muy-particular');
  });

  it('surfaces the API error instead of pretending the child was created', async () => {
    mockApi.mockResolvedValue({ data: null, error: { code: 'USERNAME_IN_USE', message: 'taken' } });
    const onCreated = vi.fn();
    render(<AddKidCard onCreated={onCreated} />);
    fireEvent.click(screen.getByRole('button', { name: /family.addKid.cta/ }));
    fill();
    fireEvent.click(screen.getByRole('button', { name: /family.addKid.submit/ }));

    await waitFor(() => expect(screen.getByText(/USERNAME_IN_USE/)).toBeInTheDocument());
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.queryByText(/family.addKid.doneTitle/)).toBeNull();
  });
});

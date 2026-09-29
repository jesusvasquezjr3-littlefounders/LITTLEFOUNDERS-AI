import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import en from '@/i18n/en-US/rebuild-site.json';
import { VerifyParentPage } from '../VerifyParentPage';

/*
 * A.5: the Tutor status is Core's answer, never the `parent` role, and a
 * revoked or ineligible account is not offered another document upload.
 */
const v = en.authVerify;
const mocks = vi.hoisted(() => ({ api: vi.fn(), token: vi.fn().mockResolvedValue('synthetic'), refreshMe: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mocks.api }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ roles: ['parent'], getToken: mocks.token, refreshMe: mocks.refreshMe }) }));
beforeEach(async () => { vi.clearAllMocks(); await i18n.changeLanguage('en-US'); });
const mount = () => render(<MemoryRouter><VerifyParentPage /></MemoryRouter>);

function fillForm(photo: File) {
  fireEvent.change(screen.getByLabelText(v.givenNames), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText(v.surnames), { target: { value: 'Ruiz' } });
  fireEvent.change(screen.getByLabelText(en.authCommon.day), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText(en.authCommon.month), { target: { value: '7' } });
  fireEvent.change(screen.getByLabelText(en.authCommon.year), { target: { value: '1988' } });
  fireEvent.change(screen.getByLabelText(v.photo), { target: { files: [photo] } });
}

it('offers support rather than another document submission after revocation', async () => {
  mocks.api.mockResolvedValue({ data: null, error: { code: 'PARENT_VERIFICATION_REVOKED', message: 'Revoked' } });
  mount();
  await screen.findByRole('heading', { level: 1, name: v.revokedTitle });
  expect(screen.getByRole('link', { name: v.supportEmail })).toHaveAttribute('href', expect.stringMatching(/^mailto:informame@littlefounders\.ai/));
  expect(screen.queryByRole('button', { name: v.retry })).not.toBeInTheDocument();
  expect(document.querySelector('input[type=file]')).toBeNull();
});

it('tells a child account who can verify, with no retry that could never succeed', async () => {
  mocks.api.mockResolvedValue({ data: null, error: { code: 'FORBIDDEN', message: 'A child account cannot verify as an adult' } });
  mount();
  await screen.findByRole('heading', { level: 1, name: v.ineligibleTitle });
  expect(screen.queryByRole('button', { name: v.retry })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: v.ready })).not.toBeInTheDocument();
});

it('sends an account whose age record is under 18 to the age review, with no form (F3-identity-site)', async () => {
  mocks.api.mockResolvedValue({ data: null, error: { code: 'AGE_RECORD_MINOR', message: 'Age record is a minor' } });
  mount();
  await screen.findByRole('heading', { level: 1, name: v.minorTitle });
  expect(screen.getByText(v.minorBody)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: v.openSettings })).toHaveAttribute('href', '/profile/settings');
  expect(screen.getByRole('link', { name: v.supportEmail })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: v.ready })).not.toBeInTheDocument();
  expect(document.querySelector('input[type=file]')).toBeNull();
});

it('does not display an already-verified claim based on the parent role', async () => {
  mocks.api.mockResolvedValue({ data: { verified: false }, error: null });
  mount();
  await screen.findByRole('button', { name: v.ready });
  expect(screen.queryByText(v.alreadyTitle)).not.toBeInTheDocument();
});

it('displays the verified state only after server confirmation', async () => {
  mocks.api.mockResolvedValue({ data: { verified: true }, error: null });
  mount();
  await screen.findByRole('heading', { level: 1, name: v.alreadyTitle });
  expect(screen.getByText(v.verified)).toBeInTheDocument();
});

it('offers retry without claiming verification when status cannot be read, and retries', async () => {
  mocks.api.mockResolvedValueOnce({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Unavailable' } });
  mount();
  await screen.findByRole('alert');
  expect(screen.queryByText(v.alreadyTitle)).not.toBeInTheDocument();
  mocks.api.mockResolvedValueOnce({ data: { verified: false }, error: null });
  fireEvent.click(screen.getByRole('button', { name: v.retry }));
  await screen.findByRole('button', { name: v.ready });
  expect(mocks.api).toHaveBeenCalledTimes(2);
});

it('explains the steps first, then sends the form without a document type and names every failed check', async () => {
  mocks.api.mockResolvedValueOnce({ data: { verified: false }, error: null });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: v.ready }));
  expect(screen.getByText(v.privacy).closest('[data-copy-role]')).toHaveAttribute('data-copy-role', 'legal');
  fillForm(new File(['x'], 'id.png', { type: 'image/png' }));
  expect(screen.getByText('id.png')).toBeInTheDocument();
  mocks.api.mockResolvedValueOnce({ data: { verified: false, checks: { documentReadable: true, nameMatch: false, birthDateMatch: true, notExpired: false } }, error: null });
  fireEvent.click(screen.getByRole('button', { name: v.submit }));
  await screen.findByText(v.failTitle);
  const [, options] = mocks.api.mock.calls[1]!;
  const form = (options as { formData: FormData }).formData;
  expect([...form.keys()].sort()).toEqual(['birthDate', 'document', 'givenNames', 'surnames']);
  expect(form.get('birthDate')).toBe('1988-07-04');
  expect(screen.getByText(v.checks.nameMatch)).toBeInTheDocument();
  expect(screen.getByText(v.checks.notExpired)).toBeInTheDocument();
  expect(screen.queryByText(v.checks.documentReadable)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: v.writeToUs })).toHaveAttribute('href', expect.stringMatching(/^mailto:/));
  // The typed details stay for the retry.
  expect(screen.getByLabelText(v.givenNames)).toHaveValue('Ana');
});

it('refuses a photo Core would refuse, before sending it', async () => {
  mocks.api.mockResolvedValueOnce({ data: { verified: false }, error: null });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: v.ready }));
  fireEvent.change(screen.getByLabelText(v.photo), { target: { files: [new File(['x'], 'id.gif', { type: 'image/gif' })] } });
  expect(screen.getByText(v.photoType)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: v.submit })).toBeDisabled();
});

it('refreshes the account after a verified verdict and offers the family', async () => {
  mocks.api.mockResolvedValueOnce({ data: { verified: false }, error: null });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: v.ready }));
  fillForm(new File(['x'], 'id.jpg', { type: 'image/jpeg' }));
  mocks.api.mockResolvedValueOnce({ data: { verified: true, checks: {} }, error: null });
  fireEvent.click(screen.getByRole('button', { name: v.submit }));
  await screen.findByRole('heading', { level: 1, name: v.successTitle });
  await waitFor(() => expect(mocks.refreshMe).toHaveBeenCalled());
  expect(screen.getByRole('link', { name: v.openFamily })).toHaveAttribute('href', '/family');
});

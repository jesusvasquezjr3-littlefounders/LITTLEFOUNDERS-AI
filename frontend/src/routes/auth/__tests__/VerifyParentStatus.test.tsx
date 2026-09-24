import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { VerifyParentPage } from '../VerifyParentPage';

const mocks = vi.hoisted(() => ({ api: vi.fn(), token: vi.fn().mockResolvedValue('synthetic') }));
vi.mock('@/lib/api', () => ({ api: mocks.api }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ roles: ['parent'], getToken: mocks.token, refreshMe: vi.fn() }) }));
beforeEach(async () => { vi.clearAllMocks(); await i18n.changeLanguage('en-US'); });
const mount = () => render(<MemoryRouter><VerifyParentPage /></MemoryRouter>);

it('offers support rather than another document submission after revocation', async () => {
  mocks.api.mockResolvedValue({ data: null, error: { code: 'PARENT_VERIFICATION_REVOKED', message: 'Revoked' } });
  mount();
  await screen.findByRole('alert');
  expect(screen.getByRole('link', { name: 'informame@littlefounders.ai' })).toHaveAttribute('href', 'mailto:informame@littlefounders.ai');
  expect(screen.queryByRole('button', { name: i18n.t('actions.retry') })).not.toBeInTheDocument();
  expect(document.querySelector('input[type=file]')).toBeNull();
});

it('does not display an already-verified claim based on the parent role', async () => {
  mocks.api.mockResolvedValue({ data: { verified: false }, error: null });
  mount();
  await screen.findByText(i18n.t('auth.verify.introTitle'));
  expect(screen.queryByText(i18n.t('auth.verify.alreadyTitle'))).not.toBeInTheDocument();
});
it('displays the verified state only after server confirmation', async () => {
  mocks.api.mockResolvedValue({ data: { verified: true }, error: null });
  mount();
  await screen.findByText(i18n.t('auth.verify.alreadyTitle'));
});
it('offers retry without claiming verification when status cannot be read', async () => {
  mocks.api.mockResolvedValue({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Unavailable' } });
  mount();
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: i18n.t('actions.retry') })).toBeInTheDocument();
  expect(screen.queryByText(i18n.t('auth.verify.alreadyTitle'))).not.toBeInTheDocument();
});

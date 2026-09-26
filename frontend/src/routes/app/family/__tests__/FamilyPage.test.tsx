import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FamilyPage } from '../FamilyPage';

/*
 * The parent dashboard's front door. This file covers exactly one control:
 * the "share usage insights" switch and its `toggleConsent()` handler
 * (FamilyPage.tsx, around lines 56-71).
 *
 * That handler's own comment is a deliberate design choice, not a stray
 * remark: "the switch simply stays put — state is server truth" on a failed
 * request. That is NOT the same thing as a true optimistic-update pattern
 * (flip immediately, roll back on error) — it means the switch must never
 * have moved in the first place. The two look identical once a failed
 * request finishes, which is exactly why nothing before this file would have
 * caught a refactor that "improved" this into a naive flip-then-rollback: a
 * test that only checks the end state can't tell them apart. The tests below
 * inspect the switch WHILE the request is still in flight, which a naive
 * flip would already have shown.
 *
 * AddKidCard, ManageKidPanel and VoiceConsentControl each have their own
 * test file and each issue their own requests against `@/lib/api` (or, for
 * the voice control, a wrapper around it) as soon as they mount. They are
 * stubbed out here so every call the shared `mockApi` records in this file
 * is unambiguously about the analytics-consent toggle.
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

vi.mock('../AddKidCard', () => ({ AddKidCard: () => null }));
vi.mock('../BadgeSharesPanel', () => ({ BadgeSharesPanel: () => null }));
vi.mock('../LearningPanels', () => ({ LearningBridgesPanel: () => null, LearningNarrativePanel: () => null, StreakPausePanel: () => null }));
vi.mock('../GuardianInvitePanel', () => ({ GuardianInvitePanel: () => null, GuardianInviteJoin: () => null }));
vi.mock('../ManageKidPanel', () => ({ ManageKidPanel: () => null }));
vi.mock('../SocialGraphPanel', () => ({ SocialGraphPanel: () => null }));
vi.mock('../SocialHistoryPanel', () => ({ SocialHistoryPanel: () => null }));
vi.mock('../SocialNoticesPanel', () => ({ SocialNoticesPanel: () => null }));
vi.mock('../SocialRequestsPanel', () => ({ SocialRequestsPanel: () => null }));
vi.mock('@/tutor/VoiceConsentControl', () => ({ VoiceConsentControl: () => null }));

const KIDS = [
  { userId: 'kid-1', displayName: 'Sofía', username: 'sofia_2016', analyticsConsent: false },
  { userId: 'kid-2', displayName: 'Mateo', username: 'mateo_2018', analyticsConsent: true },
];

beforeEach(() => {
  mockApi.mockReset();
  mockGetToken.mockReset().mockResolvedValue('fake-token');
});

function renderPage(kids = KIDS) {
  mockApi.mockResolvedValueOnce({ data: { kids }, error: null });
  return render(
    <MemoryRouter>
      <FamilyPage />
    </MemoryRouter>,
  );
}

// KIDS is always exactly two entries, so callers can destructure by
// position without every access being an `HTMLElement | undefined` under
// noUncheckedIndexedAccess. `toHaveLength(2)` in the first test is the
// runtime check that backs this cast.
async function findSwitches(): Promise<[HTMLElement, HTMLElement]> {
  const switches = await screen.findAllByRole('switch', { name: /family.insightsConsent.label/ });
  return switches as [HTMLElement, HTMLElement];
}

describe('FamilyPage — usage-insights toggle', () => {
  it('provides the verification route when current adult verification is required', async () => {
    mockApi.mockResolvedValueOnce({ data: null, error: { code: 'PARENT_VERIFICATION_REQUIRED', message: 'Verification required' } });
    render(<MemoryRouter><FamilyPage /></MemoryRouter>);
    const link = await screen.findByRole('link', { name: 'auth.verify.checkIdentity' });
    expect(link).toHaveAttribute('href', '/verify-parent');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
  it('renders each switch with the aria-checked state the server sent', async () => {
    renderPage();
    const switches = await findSwitches();

    expect(switches).toHaveLength(2);
    expect(switches[0]).toHaveAttribute('aria-checked', 'false'); // kid-1: no consent yet
    expect(switches[1]).toHaveAttribute('aria-checked', 'true'); // kid-2: already granted
  });

  it('toggles through the analytics-consent endpoint, POST to grant', async () => {
    renderPage();
    const [kid1Switch] = await findSwitches();

    mockApi.mockResolvedValueOnce({ data: { kidId: 'kid-1', analyticsConsent: true }, error: null });
    fireEvent.click(kid1Switch);

    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2));
    const [path, init] = mockApi.mock.calls[1] as [string, { method: string }];
    expect(path).toBe('/family/kids/kid-1/analytics-consent');
    expect(init.method).toBe('POST');
  });

  it('toggles through the analytics-consent endpoint, DELETE to revoke', async () => {
    renderPage();
    const [, kid2Switch] = await findSwitches();

    mockApi.mockResolvedValueOnce({ data: { kidId: 'kid-2', analyticsConsent: false }, error: null });
    fireEvent.click(kid2Switch);

    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2));
    const [path, init] = mockApi.mock.calls[1] as [string, { method: string }];
    expect(path).toBe('/family/kids/kid-2/analytics-consent');
    expect(init.method).toBe('DELETE');
  });

  it('reflects the new state once a toggle succeeds', async () => {
    renderPage();
    const [kid1Switch] = await findSwitches();
    expect(kid1Switch).toHaveAttribute('aria-checked', 'false');

    mockApi.mockResolvedValueOnce({ data: { kidId: 'kid-1', analyticsConsent: true }, error: null });
    fireEvent.click(kid1Switch);

    await waitFor(() => expect(kid1Switch).toHaveAttribute('aria-checked', 'true'));
    expect(kid1Switch).not.toBeDisabled();
  });

  it('never flips optimistically, and stays at its PRE-toggle state when the request fails', async () => {
    renderPage();
    const [kid1Switch] = await findSwitches();
    expect(kid1Switch).toHaveAttribute('aria-checked', 'false');

    let resolveToggle!: (value: unknown) => void;
    mockApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveToggle = resolve;
        }),
    );

    fireEvent.click(kid1Switch);

    // The request is now in flight: busyKid is set (the switch is disabled)
    // but nothing has moved yet. This is the assertion that a naive
    // flip-then-rollback implementation would fail: it would show
    // aria-checked="true" here already, before the server has said anything.
    await waitFor(() => expect(kid1Switch).toBeDisabled());
    expect(kid1Switch).toHaveAttribute('aria-checked', 'false');

    resolveToggle({ data: null, error: { code: 'FORBIDDEN', message: 'nope' } });

    // The request has now failed. Per the code's own comment, the switch
    // "simply stays put" — it must read exactly what it read before the
    // click, not a flip that got reverted back to the same value.
    await waitFor(() => expect(kid1Switch).not.toBeDisabled());
    expect(kid1Switch).toHaveAttribute('aria-checked', 'false');
    expect(await screen.findByRole('alert')).toHaveTextContent('errors.api.FORBIDDEN');
  });

  it('disables only the kid whose toggle is in flight, and leaves a sibling kid untouched', async () => {
    renderPage();
    const [kid1Switch, kid2Switch] = await findSwitches();
    expect(kid1Switch).not.toBeDisabled();
    expect(kid2Switch).not.toBeDisabled();

    let resolveToggle!: (value: unknown) => void;
    mockApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveToggle = resolve;
        }),
    );

    fireEvent.click(kid1Switch);

    await waitFor(() => expect(kid1Switch).toBeDisabled());
    // busyKid (FamilyPage.tsx ~lines 136-152) is a single id, and the
    // disabled attribute is `busyKid === kid.userId` — so only the kid whose
    // request is actually in flight reads as disabled. A sibling kid's
    // switch is untouched by someone else's request.
    expect(kid2Switch).not.toBeDisabled();
    expect(kid2Switch).toHaveAttribute('aria-checked', 'true');

    // busyKid is also a single global latch (`if (... || busyKid) return`),
    // so clicking the sibling while kid-1's request is in flight is a silent
    // no-op rather than a second concurrent request — the mock call count
    // does not move.
    fireEvent.click(kid2Switch);
    expect(mockApi).toHaveBeenCalledTimes(2);

    resolveToggle({ data: { kidId: 'kid-1', analyticsConsent: true }, error: null });
    await waitFor(() => expect(kid1Switch).not.toBeDisabled());
  });
});

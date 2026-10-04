import { ConnectedStandaloneHeader } from '../StandaloneHeader';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/theme/useTheme';
import i18n from '@/i18n';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { AgeScreen } from '@/rebuild/identity/AgeScreen';
import { OnboardingFlow } from '@/rebuild/identity/OnboardingFlow';
import { BadgeLanding, type BadgeLandingState } from '@/rebuild/site/BadgeLanding';
import { RouteErrorScreen } from '@/rebuild/site/RouteErrorScreen';
import { TutorChunkFallback } from '@/app-routes/LazyRoute';

beforeEach(async () => { await i18n.changeLanguage('en-US'); });
const mount = (node: ReactNode) => render(<ThemeProvider>{node}</ThemeProvider>);
const age = <AgeScreen header={<ConnectedStandaloneHeader />} locale="en-US" dark={false} state="form" copy={rebuildNamespaceCopy['en-US'].site.ageScreen}
  onSubmit={vi.fn()} onRetry={vi.fn()} onExit={vi.fn()} />;
const error = (frame: 'standalone' | 'embedded') => <RouteErrorScreen header={<ConnectedStandaloneHeader />} locale="en-US" stale home="learn" frame={frame} onReload={vi.fn()} onHome={vi.fn()} />;
function expectHeader(container: HTMLElement) {
  const headers = container.querySelectorAll('.lf-standalone-header');
  expect(headers).toHaveLength(1);
  const header = headers[0] as HTMLElement;
  expect(within(header).getByRole('img', { name: 'LittleFounders' })).toHaveAttribute('src', '/rebuild/brand/logo.png');
  const language = within(header).getByRole('combobox', { name: 'Language' });
  fireEvent.click(language);
  expect(screen.getAllByRole('option')).toHaveLength(3);
  fireEvent.keyDown(language, { key: 'Escape' });
  const mode = header.querySelector<HTMLButtonElement>('.lf-icon-button')!;
  expect(mode).toHaveAccessibleName();
  expect(mode.textContent).toBe('');
  const before = document.documentElement.classList.contains('dark');
  fireEvent.click(mode);
  expect(document.documentElement.classList.contains('dark')).toBe(!before);
}

function expectNoHeader(container: HTMLElement) { expect(container.querySelector('.lf-standalone-header')).toBeNull(); }

describe('topbars are exclusive to marketing', () => {
  it('omits the topbar on the standalone age gate', () => {
    const { container } = mount(age); expectNoHeader(container);
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
  it('keeps onboarding progress and back navigation without a topbar', () => {
    const { container } = mount(<OnboardingFlow header={<ConnectedStandaloneHeader />} locale="en-US" skipLabel="Skip" completing={null} failed={false}
      askDiscovery={false} mentor={{ chosen: null, saving: null, failed: false, onChoose: vi.fn() }}
      onComplete={vi.fn()} initialStep="name" />);
    expectNoHeader(container);
    expect(container.querySelector('[data-onboarding="back"]')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
  const badgeStates: BadgeLandingState[] = [{ status: 'loading' }, { status: 'expired' }, { status: 'ready', payload: {
    firstName: 'Ana', achievementKind: 'course_badge', achievementLabel: 'Money', imageUrl: '/synthetic-badge.png',
  } }];
  for (const state of badgeStates) it(`keeps display controls on the ${state.status} badge route`, () => {
    const { container } = mount(<BadgeLanding header={<ConnectedStandaloneHeader marketing />} locale="en-US" state={state} start={{ kind: 'continue', href: '/learn' }} />);
    expectHeader(container); expect(screen.getAllByRole('main')).toHaveLength(1);
  });
  it('omits the topbar after an application chunk fails', () => {
    const { container } = mount(error('standalone')); expectNoHeader(container);
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  });
  it('keeps skip navigation while an application chunk downloads', () => {
    const { container } = mount(<TutorChunkFallback />); expectNoHeader(container);
    const main = screen.getByRole('main');
    const skip = container.querySelector<HTMLAnchorElement>('.lf-skip-link')!;
    expect(skip).toHaveAttribute('href', `#${main.id}`);
    expect(skip.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(skip);
    expect(main).toHaveFocus();
  });
  it.each(['age', 'error', 'loading'])('inherits the existing header in an embedded %s state', (state) => {
    const content = state === 'age' ? age : state === 'error' ? error('embedded') : <TutorChunkFallback />;
    const { container } = mount(<div data-shell="learner"><header data-existing-header /><main>{content}</main></div>);
    expect(container.querySelector('.lf-standalone-header')).toBeNull();
    expect(container.querySelectorAll('header')).toHaveLength(1);
    expect(container.querySelector('.lf-skip-link')).toBeNull();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

/*
 * The floor this component exists to hold: a route that throws must never
 * leave an empty document. /learn already shipped that failure once — a wrong
 * `to=` matched no route, React rendered nothing, and a week of broken taps
 * produced no error anywhere. Lazy routes add a second, ROUTINE way in: a tab
 * open across a deploy asks for a chunk hash that no longer exists.
 */

function Boom({ error }: { error: Error }): never {
  throw error;
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  // React logs the caught error itself; the boundary logs it again on purpose.
  // Neither is the thing under test, and both would drown the run.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  await i18n.changeLanguage('en-US');
});

afterEach(() => consoleError.mockRestore());

describe('RouteErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <RouteErrorBoundary>
        <p>the route</p>
      </RouteErrorBoundary>,
    );

    expect(screen.getByText('the route')).toBeInTheDocument();
  });

  it('never leaves an empty document when a route throws', () => {
    const { container } = render(
      <RouteErrorBoundary>
        <Boom error={new Error('kaboom')} />
      </RouteErrorBoundary>,
    );

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(i18n.t('routeError.title'));
  });

  /*
   * Every engine words a failed dynamic import differently, and getting the
   * match wrong shows a learner "something went wrong" for a situation that a
   * refresh fixes completely. One case per engine, quoted from the real
   * message, so a future regex edit has to keep them all.
   */
  it.each([
    ['Chrome/Edge', 'Failed to fetch dynamically imported module: https://x/assets/LessonRoute-abc.js'],
    ['Firefox', 'error loading dynamically imported module'],
    ['Safari', 'Importing a module script failed.'],
    ['Vite CSS preload', 'Unable to preload CSS for /assets/index-abc.css'],
  ])('recognises a stale chunk from %s and offers the refresh that fixes it', (_engine, message) => {
    render(
      <RouteErrorBoundary>
        <Boom error={new Error(message)} />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(i18n.t('routeError.staleTitle'));
    expect(screen.getByRole('button', { name: i18n.t('routeError.reload') })).toBeInTheDocument();
  });

  it('does not call an ordinary render failure a stale chunk', () => {
    render(
      <RouteErrorBoundary>
        <Boom error={new TypeError("Cannot read properties of undefined (reading 'map')")} />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(i18n.t('routeError.title'));
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import en from '@/i18n/en-US/rebuild-site.json';
import es from '@/i18n/es-MX/rebuild-site.json';

/*
 * The floor this component exists to hold (X2): a route that throws must never
 * leave an empty document. /learn already shipped that failure once: a wrong
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

  it('never leaves an empty document when a route throws, and names the way home', () => {
    const { container } = render(
      <RouteErrorBoundary>
        <Boom error={new Error('kaboom')} />
      </RouteErrorBoundary>,
    );

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.routeError.title);
    // The default home is Learn (the app and the lesson player).
    expect(screen.getByRole('button', { name: en.routeError.learn })).toBeInTheDocument();
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
  ])('recognises a stale chunk from %s and offers the reload that fixes it', (_engine, message) => {
    render(
      <RouteErrorBoundary>
        <Boom error={new Error(message)} />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.routeError.staleTitle);
    expect(screen.getByRole('button', { name: en.routeError.reload })).toBeInTheDocument();
  });

  it('does not call an ordinary render failure a stale chunk', () => {
    render(
      <RouteErrorBoundary>
        <Boom error={new TypeError("Cannot read properties of undefined (reading 'map')")} />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.routeError.title);
  });

  it('on a full-screen layer is the single-state screen with its own <main>; inside a shell it is content only', () => {
    const { unmount } = render(<RouteErrorBoundary><Boom error={new Error('kaboom')} /></RouteErrorBoundary>);
    expect(document.querySelector('[data-shell="single-state"] main')).not.toBeNull();
    unmount();

    render(<div data-shell="learner"><main><RouteErrorBoundary><Boom error={new Error('kaboom')} /></RouteErrorBoundary></main></div>);
    expect(document.querySelectorAll('main')).toHaveLength(1);
    expect(document.querySelector('[data-shell="single-state"]')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(en.routeError.body);
  });

  it('speaks the app language and sends "Home" to the home it was given', () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, assign } });
    try {
      void i18n.changeLanguage('es-MX');
      render(<RouteErrorBoundary home="/"><Boom error={new Error('kaboom')} /></RouteErrorBoundary>);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(es.routeError.title);
      fireEvent.click(screen.getByRole('button', { name: es.routeError.home }));
      expect(assign).toHaveBeenCalledWith('/');
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });
});

import { ConnectedStandaloneHeader } from '@/app-shell/StandaloneHeader';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTheme } from '@/theme/useTheme';
import { useShellLocale } from '@/app-shell/ShellRoot';
import { RouteErrorFrame } from '@/rebuild/site/RouteErrorScreen';

/*
 * The boundary that keeps a broken route from becoming a white screen (X2).
 *
 * Two reasons this exists, and both were live defects rather than theory:
 *
 *   1. A route that throws while rendering unmounts the whole React tree. The
 *      app had no boundary above any route, so the result was an empty #root:
 *      the exact failure mode that hid a wrong `to=` in the /learn chapter list
 *      for a week, reported as "the Lesson Engine is dead".
 *   2. Lazy routes add a SECOND way to get there, and it is routine rather than
 *      rare: after a deploy, a tab that is still running the previous build
 *      asks for a chunk whose content hash no longer exists. The import
 *      rejects, Suspense cannot recover, and the page goes blank for a user
 *      who did nothing wrong except leave the app open.
 *
 * A stale chunk is fixed by reloading, so that case says so and offers it. Any
 * other error sends the person somewhere real. Either way the screen SAYS
 * something. The screen itself is rebuilt (rebuild/site/RouteErrorScreen,
 * W2 Lane 1): inside a shell it renders as that page's content, so the shell
 * keeps its one <main> and its navigation; on a full-screen layer (the lesson
 * player, the Mentor stage) it is the single-state screen.
 */

interface Props {
  children: ReactNode;
  /** Where "take me somewhere that works" goes. Defaults to the app home. */
  home?: string;
}

interface State {
  error: Error | null;
}

/**
 * A failed dynamic import, as every engine words it differently.
 *
 * Chrome/Edge: "Failed to fetch dynamically imported module"
 * Firefox:     "error loading dynamically imported module"
 * Safari:      "Importing a module script failed"
 * Vite also throws its own "Unable to preload CSS" for the stylesheet half.
 */
export function isStaleChunk(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError/i.test(
    `${error.name} ${error.message}`,
  );
}

function useDarkMode(): boolean {
  // The boundary may sit outside the theme provider in an isolated render; it must still say something.
  try { return useTheme().isDark; } catch { return false; }
}

function Fallback({ error, home }: { error: Error; home: string }) {
  const locale = useShellLocale();
  const dark = useDarkMode();
  // A full reload, not a router navigation: a stale chunk is fixed only by fetching the new index and its new hashes.
  return <RouteErrorFrame header={<ConnectedStandaloneHeader />} theme={dark ? 'dark' : 'light'} locale={locale} stale={isStaleChunk(error)} home={home === '/' ? 'home' : 'learn'}
    onReload={() => window.location.reload()} onHome={() => window.location.assign(home)} />;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept to the console on purpose: this is the one place that knows a route
    // died, and a silent boundary trades a white screen for an invisible one.
    console.error('[app] route boundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.error) return <Fallback error={this.state.error} home={this.props.home ?? '/learn'} />;
    return this.props.children;
  }
}

export default RouteErrorBoundary;

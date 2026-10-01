import { StandaloneHeader } from '@/rebuild/design/StandaloneHeader';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button, ButtonGroup, InlineNotice, SingleStateScreen } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import { rebuildNamespaceCopy } from '../../i18n/rebuild';
import { siteCopy } from './blocks';

/*
 * X2, "this screen failed to load", rebuilt (W2 Lane 1). Shown by the route
 * error boundary when a lazily loaded screen cannot download (routinely: a tab
 * left open across a release, whose chunk names no longer exist) or throws
 * while rendering. It never leaves a blank page (the defect it exists to
 * prevent): it says what happened, offers a full reload (which fixes a stale
 * version) and a way home (Learn, for the lesson player and the app).
 *
 * Two frames. Standalone (a full-screen layer failed: the lesson player, the
 * Mentor stage): the single-state screen, one hue, its own <main>, skip link,
 * title and language (02 §4.5, rule 15). Embedded (a page inside a shell
 * failed): the content only, so the shell keeps the one <main> and its
 * navigation, and the person can still go elsewhere.
 */
export function RouteErrorScreen({ locale, stale, home, onReload, onHome, frame, header }: {
  locale: Locale; stale: boolean; home: 'learn' | 'home';
  onReload: () => void; onHome: () => void;
  frame: 'standalone' | 'embedded'; header?: ReactNode;
}) {
  const copy = siteCopy(locale).routeError;
  const title = stale ? copy.staleTitle : copy.title;
  const actions = <ButtonGroup>
    <Button variant="accent" data-route-error="reload" onClick={onReload}>{copy.reload}</Button>
    <Button data-route-error="home" onClick={onHome}>{home === 'learn' ? copy.learn : copy.home}</Button>
  </ButtonGroup>;
  const content = <>
    <h1 data-copy-role="heading">{title}</h1>
    {/* Announced when it appears: the screen replaced what the person was looking at. */}
    <InlineNotice tone={stale ? 'info' : 'error'} live>{stale ? copy.staleBody : copy.body}</InlineNotice>
  </>;
  if (frame === 'embedded') return <section className="lf-route-error" data-screen="route-error" data-stale={stale}>
    {content}
    {actions}
  </section>;
  return <SingleStateScreen appName="LittleFounders" pageTitle={title} routeKey="route-error" locale={locale} hue="primary"
    labels={{ skip: rebuildNamespaceCopy[locale].core.appShell.skip }} bar={header ?? <StandaloneHeader locale={locale} theme="light" />} actions={actions}>
    <div className="lf-route-error" data-screen="route-error" data-stale={stale}>{content}</div>
  </SingleStateScreen>;
}

/**
 * The design-system root around the screen, for the route error boundary: it
 * finds out where it was mounted (inside a rebuilt shell's <main>, or as the
 * whole screen) and renders the matching frame in the app's mode and language.
 */
export function RouteErrorFrame({ theme, ...props }: Omit<Parameters<typeof RouteErrorScreen>[0], 'frame'> & { theme: 'light' | 'dark' }) {
  const probe = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<'embedded' | 'standalone' | null>(null);
  useLayoutEffect(() => { setFrame(probe.current?.closest('[data-shell] main') ? 'embedded' : 'standalone'); }, []);
  return <div ref={probe} className={`lf-rebuild${frame === 'embedded' ? ' lf-route-error-root' : ''}`} data-theme={theme} lang={props.locale}>
    {frame ? <RouteErrorScreen {...props} frame={frame} /> : null}
  </div>;
}

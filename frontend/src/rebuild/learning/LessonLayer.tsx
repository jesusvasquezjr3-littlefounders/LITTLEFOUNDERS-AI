import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import enCore from '../../i18n/en-US/rebuild-core.json';
import esCore from '../../i18n/es-MX/rebuild-core.json';
import ptCore from '../../i18n/pt-BR/rebuild-core.json';
import type { AgeBand, Locale } from '../design/copyBudget';
import { RebuildRoot, SkipLink, useDocumentMeta } from '../design/controls';
import { noteRouteChange } from '../design/motion';
import { LessonStageRequestHost } from './lessonStage';
import './lessonLayer.css';

const skipLabel: Record<Locale, string> = { 'en-US': enCore.appShell.skip, 'es-MX': esCore.appShell.skip, 'pt-BR': ptCore.appShell.skip };

/**
 * W2L.3: the learner's lesson layer, the one frame every screen of a lesson
 * route renders in (opening, refusals, the recall, the lesson itself, the
 * result, the guided-review offer). A lesson is a full-screen single state
 * (02 §4.5, rule 15) with no app navigation, like the placement flow, so the
 * layer carries the shell duties itself: the design system's root (mode,
 * language, the Copy Budget band), the document title and language, a skip
 * link as the first Tab stop, and focus on the new screen's heading when the
 * lesson moves from one screen to the next (02 rule 13). The first screen's
 * arrival is left where the browser puts it, as on the app shells.
 *
 * Each screen renders exactly one `<main>` of its own (the boards own their
 * full-bleed hue); the layer finds it and points the skip link at it.
 */
export function LessonLayer({ theme, locale, ageBand, pageTitle, screen, children }: {
  theme: 'light' | 'dark'; locale: Locale; ageBand?: AgeBand;
  /** The document title for this screen; "{pageTitle} · LittleFounders". */
  pageTitle: string;
  /** Changes exactly when the lesson moves to another screen (opening, lesson, result…). */
  screen: string;
  children: ReactNode;
}) {
  useDocumentMeta(pageTitle, 'LittleFounders', locale);
  const layer = useRef<HTMLDivElement>(null);
  const mainId = `lf-lesson-main-${useId().replace(/:/g, '')}`;
  const settled = useRef(screen);
  // Every render: a board may replace its <main> (a new segment), so the id follows it.
  useLayoutEffect(() => {
    const main = layer.current?.querySelector<HTMLElement>('main');
    if (!main) return;
    if (!main.id) main.id = mainId;
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
  });
  useLayoutEffect(() => {
    if (settled.current === screen) return;
    settled.current = screen;
    // A new lesson screen is a screen entry for the orchestrated patterns (02 rule 14).
    noteRouteChange();
    const main = layer.current?.querySelector<HTMLElement>('main');
    const target = main?.querySelector<HTMLElement>('h1') ?? main;
    if (!target) return;
    try { window.scrollTo(0, 0); } catch { /* jsdom has no scroll implementation */ }
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }, [screen]);
  return <RebuildRoot theme={theme} locale={locale} ageBand={ageBand}>
    <div ref={layer} className="lf-lesson-layer" data-shell="lesson" data-lesson-screen={screen} lang={locale}>
      <SkipLink label={skipLabel[locale]} target={mainId} />
      {/* GAP-FIX-R5: one stage-request store above the lesson and the guided-review offer beside it (08 §3, §11). */}
      <LessonStageRequestHost>{children}</LessonStageRequestHost>
    </div>
  </RebuildRoot>;
}

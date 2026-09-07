import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import { MapGraph } from './map/MapGraph';
import type { TutorMapResponse } from './tutorApi';

/**
 * The learning map, opened as a temporary OVERLAY during `conversing`
 * (Sprint 3, /TUTOR_INSTRUMENTS.md). Portalled to `document.body` rather than
 * hosted in the dock's `above` slot the way `introducing`'s map is —
 * `phases.ts`'s `shotForPhase` deliberately never reads `mapOpen` outside
 * `introducing` (its own comment says so), because three documents
 * (/ORACLE.md §9.3, §16, /DESIGN.md) make the character's on-screen framing
 * during a conversation a shipping invariant no piece of chrome may move. A
 * portal that sits on top of the whole scene, unchanged underneath it,
 * satisfies "does not disturb the plate, the caption or the dock" BY
 * CONSTRUCTION — the same reasoning, and closely the same shape (`fixed
 * inset-0`, `bg-base/80 backdrop-blur-sm`, Escape-to-close, backdrop-click-
 * to-close, `document.body.style.overflow = 'hidden'`), as the one other real
 * modal in this codebase, `CookieConsentBanner.tsx`'s `PreferencesDialog`.
 *
 * READ-ONLY: `MapGraph` renders with `disabled` — tapping a node in
 * `introducing` STARTS a session, and starting a second one over an
 * already-live conversation is a new interaction this sprint does not open
 * (§7.2's own "make the map openable", not "make the map navigable
 * mid-conversation"). `readOnlyDuringSession` says so rather than leaving a
 * child to wonder why the nodes do not respond to a tap.
 */
export function MapOverlay({ map, onClose }: { map: TutorMapResponse; onClose: () => void }) {
  const { t } = useTranslation();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-base/80 p-4 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutor-map-overlay-title"
        className="lf-glass flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl min-w-0 flex-col overflow-hidden rounded-md shadow-pop sm:max-h-[calc(100dvh-3rem)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-outline/50 p-4 sm:p-5">
          <h2 id="tutor-map-overlay-title" className="lf-headline text-content">
            {t('tutor.map.openLabel')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('tutor.map.closeLabel')}
            title={t('tutor.map.closeLabel')}
            className="lf-press pointer-events-auto shrink-0 rounded-full p-1.5 text-content-muted hover:bg-content/10 hover:text-content"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <p className="lf-caption mb-3 text-content-muted">{t('tutor.map.readOnlyDuringSession')}</p>
          <MapGraph map={map} onPick={() => {}} disabled />
        </div>
      </section>
    </div>,
    document.body,
  );
}

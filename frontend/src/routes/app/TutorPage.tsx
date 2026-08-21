import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TutorExperience } from '@/tutor/TutorExperience';

/*
 * The Tutor product surface.
 *
 * This route is deliberately thin: a heading, an error boundary, and the
 * experience. Everything else lives in `@/tutor/` — the phases, the socket,
 * the personalization — because the route is also what App.tsx lazy-loads,
 * and `three` must only ever be reached through a lazy route (/TUTOR_3D.md §6).
 *
 * The 3D stage is shown to EVERY user (owner decision, 2026-08-15) — never
 * gated by role or device class. Device capability is handled by the adaptive
 * quality tiers inside the scene, not by withholding the feature.
 */

/**
 * A failed asset load, or a thrown render anywhere in the experience, must not
 * take the page down.
 *
 * The .glb files are served from Depot in deployed environments, so a bad
 * `VITE_SCENE_ASSET_BASE`, a Depot outage, or a device that runs out of memory
 * decoding them are all real, reachable states. Without a boundary, the throw
 * inside Suspense unmounts the whole route and the user gets a blank screen
 * with no explanation.
 */
class TutorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept as a console error on purpose: this is a real failure worth seeing
    // in the browser, and the Tutor's telemetry vocabulary is closed
    // (/ORACLE.md §13) — adding an event here would bypass the migration and
    // consent gate that vocabulary exists to enforce.
    console.error('[tutor] failed to render', error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function TutorPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-container px-5 py-6 md:px-8 md:py-10">
      <header className="mb-5">
        <h1 className="lf-display-lg text-content">{t('tutor.page.title')}</h1>
        <p className="lf-body text-content-muted">{t('tutor.page.subtitle')}</p>
      </header>

      <TutorBoundary
        fallback={
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-surface-sunken p-6 text-center lg:aspect-video">
            <p className="lf-body text-content-muted">{t('tutor.scene.loadFailed')}</p>
          </div>
        }
      >
        <TutorExperience />
      </TutorBoundary>
    </div>
  );
}

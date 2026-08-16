import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TutorStage } from '@/tutor-scene/TutorStage';

/*
 * The Tutor product surface.
 *
 * The 3D stage is shown to EVERY user (owner decision, 2026-08-15) — it is not
 * gated by role or by device class. Device capability is handled by the
 * adaptive quality tiers inside the scene, not by withholding the feature.
 *
 * The conversational layer (voice, live tutoring, the personalization contract
 * in /ORACLE.md) is NOT wired here yet — but the SEAM for it is. `TutorStage`
 * takes `speechUrl`, `emotion` and `action`, so connecting audiogen and the
 * tutoring logic is passing props from this component rather than reaching
 * into the scene. Nothing below here knows what a transcript is.
 */

/**
 * A failed asset load must not take the page down.
 *
 * The .glb files are served from Depot in deployed environments, so a bad
 * `VITE_SCENE_ASSET_BASE`, a Depot outage, or a device that runs out of memory
 * decoding them are all real, reachable states. Without a boundary, the throw
 * inside Suspense unmounts the whole route and the user gets a blank screen
 * with no explanation.
 */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept as a console error on purpose: this is a real failure worth seeing
    // in the browser, and there is no Tutor telemetry vocabulary yet (ORACLE.md
    // requires a closed event set, which adding here would bypass).
    console.error('[tutor-scene] failed to render', error, info.componentStack);
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

      <SceneBoundary
        fallback={
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-surface-sunken p-6 text-center lg:aspect-video">
            <p className="lf-body text-content-muted">{t('tutor.scene.loadFailed')}</p>
          </div>
        }
      >
        {/* No `speechUrl` yet: the stage stays on its establishing shot and the
            mouth stays closed until the conversational layer supplies audio. */}
        <TutorStage className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface-sunken lg:aspect-video" />
      </SceneBoundary>
    </div>
  );
}

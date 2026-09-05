import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { TutorExperience } from '@/tutor/TutorExperience';
import { APP_HOME } from '@/routes/app/navConfig';

/*
 * The Tutor product surface.
 *
 * This route is deliberately thin: an error boundary and the experience.
 * Everything else lives in `@/tutor/` — the phases, the socket, the
 * personalization — because the route is also what App.tsx lazy-loads, and
 * `three` must only ever be reached through a lazy route (/TUTOR_3D.md §6).
 * Any 3D preview added anywhere in the product has to live inside THIS chunk
 * for that to keep holding.
 *
 * THERE IS NO HEADING AND NO READING COLUMN HERE, and that is the point. The
 * stage is the page (/DESIGN.md → Screen Recipes → Tutor): `StageShell` takes
 * the whole viewport as its own layer, so the route renders a boundary and gets
 * out of the way. The `mx-auto max-w-container px-5 py-6` wrapper and the `<h1>`
 * that used to be here are what turned a 3D place into a picture of one inside
 * a dashboard, and the route sits OUTSIDE the app shell in App.tsx for the same
 * reason the Lesson Player does.
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

/**
 * What is left when the scene itself threw.
 *
 * It keeps the shell's own layer rather than dropping back into the app's
 * reading column, because the route no longer HAS a reading column to drop back
 * into — a grey card here would render at the top-left of an empty viewport.
 * The island cannot be drawn (drawing it is what failed), so this is the honest
 * floor: the stage's own ground colour, one sentence, and a way out. The way out
 * matters more here than anywhere else in the product: the app chrome is gone,
 * so without it the only exit is the browser's back button.
 */
function StageFailure() {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-base px-5 text-center">
      <p className="lf-body max-w-[46ch] text-content-muted">{t('tutor.scene.loadFailed')}</p>
      <Link
        to={APP_HOME}
        className="lf-press lf-glass lf-label flex min-h-11 items-center rounded-full px-5 text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {t('tutor.stage.leave')}
      </Link>
    </div>
  );
}

export default function TutorPage() {
  return (
    <TutorBoundary fallback={<StageFailure />}>
      <TutorExperience />
    </TutorBoundary>
  );
}

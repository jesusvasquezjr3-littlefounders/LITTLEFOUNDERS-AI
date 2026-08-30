import { createPortal } from 'react-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HudPlate } from '@/tutor/hud/HudPlate';
import { SessionHistory } from './SessionHistory';
import { useStageDock } from './stage/StageShell';
import type { SessionSummary } from './types';

/*
 * The goodbye (/ORACLE.md §9.5), and it stands where the microphone stands.
 *
 * WHY IT IS IN THE DOCK RATHER THAN IN A `bottom` LAYER. Both put the same three
 * surfaces against the bottom of the same viewport; only one of them is a place
 * the CAMERA knows about. A `bottom` layer registers with `keepClearOf`, which
 * moves the microphone dock up — and the microphone is deliberately absent on
 * this phase (`stage/micForPhase.ts` → `present: false`), so that channel pushed
 * an empty column and told the camera nothing. Measured on `/dev/tutor-lab` at
 * 1280x800: the establishing shot centres the island, the tutor stands in the
 * middle of it, and "See you soon!" landed at (480, 619) across Dr. Rho's chin
 * and mouth. The one thing this phase is for is a warm look at the character you
 * just spent twenty minutes with, and the plate was sitting on their face.
 *
 * The dock is measured on the `mic` safe-area slot, so anything portalled into
 * it is a rectangle the composition solver already aims around
 * (`tutor-scene/composition.ts`). The goodbye inherits that for free, and the
 * count of viewport-anchored surfaces on the route does not change: this IS the
 * bottom cluster, wearing a different set of controls on the one phase where
 * the microphone is not using it.
 *
 * ONE IMPLEMENTATION, TWO CALLERS. `/tutor` and `/dev/tutor-lab` both mount it.
 * They used to hold a copy each, kept in step by hand, which is exactly the
 * arrangement that lets the lab report on a screen nobody ships.
 */

export interface ClosingInWorldProps {
  /** Starts a fresh session. The ONE indigo action of the phase. */
  onStartAnother: () => void;
  /**
   * The learner's access token, for the replay list. Null before the bootstrap
   * has one, in which case the archive is simply not offered rather than
   * offered and broken.
   */
  token: string | null;
  /**
   * Perform one of them on this island (/ORACLE.md §12).
   *
   * The goodbye is the second place the archive is offered, and like the
   * introduction it can only point: the replay is a PHASE of the stage, so the
   * component that owns the phase is the one that enters it.
   */
  onReplay: (session: SessionSummary) => void;
  /**
   * Why the session ended (`useTutorSocket`'s `closedReason`, whatever the
   * socket's `closed` frame carried — `null` before one has arrived). Found by
   * adversarial review, round 33, 2026-08-30 (MEDIUM/HIGH): this used to be
   * ignored entirely, so a session the safety classifier stopped — the tutor's
   * own line just told the child "I am stopping our lesson here so you can
   * [tell a grown-up]" — was followed by the IDENTICAL cheerful "See you soon!
   * Saved. You can listen again any time." as an ordinary satisfied
   * completion. The §1.14 "failure indistinguishable from emptiness" pattern,
   * applied to the one close reason where the mismatch matters most.
   */
  closedReason: string | null;
}

export function ClosingInWorld({ onStartAnother, token, onReplay, closedReason }: ClosingInWorldProps) {
  const { t } = useTranslation();
  const dock = useStageDock();
  const [historyOpen, setHistoryOpen] = useState(false);
  const isSafetyStop = closedReason === 'safety_stop';

  const goodbye = (
    <>
      {/*
        THE ONE READING SURFACE OF THIS PHASE, so it takes the reading density
        and earns its second line honestly. There is no lesson plate in the
        goodbye, and §Lumen allows exactly one paragraph surface per phase; at
        chrome density the material would have flattened "Saved. You can listen
        again any time." up to full ink beside the headline, which is two shouts
        where the design wanted a statement and a reassurance.

        A safety-stopped session gets calmer, deliberately minimal wording
        instead — never the cheerful "see you soon, listen any time" framing,
        which would contradict the tutor's own closing line rather than follow
        it. The exact copy is a first pass, not a final word: this is
        child-safety-adjacent text and worth a human product/legal read before
        it is treated as settled (see RUNBOOK.md's entry for this fix).
      */}
      <HudPlate shape="plate" density="reading">
        <span className="flex flex-col gap-1 text-center">
          <span className="lf-display-lg text-content">
            {t(isSafetyStop ? 'tutor.page.sessionStoppedTitle' : 'tutor.page.seeYouSoon')}
          </span>
          <span className="lf-body text-content-muted">
            {t(isSafetyStop ? 'tutor.page.sessionStoppedBody' : 'tutor.page.sessionSaved')}
          </span>
        </span>
      </HudPlate>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {/*
          Starting again is what the close is FOR, so it is the phase's one
          indigo action (/DESIGN.md → Screen Recipes → Tutor). On this layer
          indigo is `.lf-lumen-solid` — a solid object at the pane radius,
          keeping only the seated shadow — and never a capsule, because a
          call to action should not read as one more window onto the island.
        */}
        <HudPlate
          as="button"
          shape="chip"
          floor="accent"
          onClick={onStartAnother}
          floorClassName="py-3"
        >
          <span className="lf-action">{t('tutor.page.startAnother')}</span>
        </HudPlate>

        {token && (
          <HudPlate
            as="button"
            shape="chip"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((open) => !open)}
            className="lf-settle-2"
          >
            <span className="lf-action">
              {historyOpen ? t('tutor.introduce.hideReplays') : t('tutor.introduce.replays')}
            </span>
          </HudPlate>
        )}
      </div>

      {/*
        Opened deliberately, closed again, exactly as it is on the introduction.
        A list of past conversations is a list, and a list over the island is the
        silhouette this rebuild removes; it is acceptable only because a learner
        asked for it by name. It becomes stones on the island's shore in
        increment 4 (/ORACLE.md §12).

        It scrolls inside itself: the dock grows UPWARD from the bottom edge, so
        an archive with thirty conversations in it would otherwise push its own
        first row off the top of the screen.
      */}
      {historyOpen && token && (
        <HudPlate shape="sheet" className="max-h-[52vh] overflow-y-auto overscroll-contain">
          <div className="flex w-full flex-col gap-3 text-left">
            <span className="lf-headline text-content">{t('tutor.history.title')}</span>
            <SessionHistory token={token} onReplay={onReplay} />
          </div>
        </HudPlate>
      )}
    </>
  );

  /*
   * No dock means no shell: a unit test, or a device where the stage never
   * mounted. The goodbye renders where it stands rather than disappearing,
   * because a farewell that only exists inside one configuration is a farewell
   * nobody tests.
   */
  if (!dock) return <div className="flex w-full flex-col items-center gap-2">{goodbye}</div>;
  // The slot exists but has not attached yet, which is true for exactly the
  // first render. Rendering in place for that one frame would flash the plate
  // across the top-left corner of the island.
  if (!dock.above) return null;
  return createPortal(goodbye, dock.above);
}

import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import type { AgeBand } from '../design/copyBudget';
import { Art } from '../design/controls';
import { REGISTERS, registerForCopyBand } from '../design/learnerRegisterPolicy.generated';
import { CompactMentorStage } from './CompactMentorStage';
import type { AdventureTheme, LessonMentorStage } from './lessonDocument';
import { sceneAssetId } from './territory';

/*
 * W2L.3 (B.8, Bible 08 §11): the compact Mentor stage on every v2 board, not
 * only the allocation pilot. The authenticated lesson response carries Core's
 * `mentor_stage` projection (the learner's own character and the lesson's
 * scene); the lesson renderer provides it here once and each board places the
 * slot under its progress row. Without a projection (a preview, a malformed
 * answer, a failed preference read) the slot renders nothing: the stage is
 * cosmetic and never blocks learning. The stage itself is the one named
 * bridge to the 3D engine (`CompactMentorStage.tsx`); when the Mentor lane
 * ships the shared `rebuild/mentor/MentorStage.tsx`, this slot is the one
 * place that switches to it.
 */
interface LessonStage { stage: LessonMentorStage | null; ageBand: AgeBand; theme: 'light' | 'dark'; adventureTheme: AdventureTheme | null }

const LessonStageContext = createContext<LessonStage | null>(null);

/*
 * B.8 (GAP-FIX-R1, reworked in GAP-FIX-R3): the lesson inherits its
 * adventure's scene. Core projects the chapter's closed-enum theme beside
 * `mentor_stage`; the slot draws `scene.<theme>.art` as the BACKDROP of the one
 * Mentor band (Bible 08 §11: "the band may show the active adventure's
 * scene"), never as its own stripe and never inside the board. The band is
 * the slot's single element, so the lesson layout's `:has(> .lf-mentor-band)`
 * side column (4 of 12 columns) applies, and the phone band keeps the
 * register's height (110/96/80 px), inside the 30/25/15% caps.
 */
export function LessonStageProvider({ stage, ageBand, theme, adventureTheme = null, children }: {
  stage: LessonMentorStage | null; ageBand: AgeBand; theme: 'light' | 'dark'; adventureTheme?: AdventureTheme | null; children: ReactNode;
}) {
  return <LessonStageContext.Provider value={stage || adventureTheme ? { stage, ageBand, theme, adventureTheme } : null}>{children}</LessonStageContext.Provider>;
}

/** The board's own verdict, read only as met or a miss; anything else is a neutral stage. Never a celebration (D7). */
export function stageVerdict(verdict: unknown): 'met' | 'review' | null {
  return verdict === 'met' ? 'met' : verdict === 'review' ? 'review' : null;
}

/** True inside a lesson that provides a stage or a scene (a board may then leave the band to the slot). */
export function useLessonStagePresent(): boolean {
  return useContext(LessonStageContext) !== null;
}

export function LessonStageSlot({ verdict }: { verdict?: unknown }) {
  const value = useContext(LessonStageContext);
  if (!value) return null;
  const scene = value.adventureTheme ? sceneAssetId(value.adventureTheme) : null;
  // Decorative: the lesson title names the place; the scene only sets it (07 §8).
  const backdrop = scene ? <Art assetId={scene} /> : null;
  if (value.stage) {
    return <CompactMentorStage ageBand={value.ageBand} theme={value.theme} verdict={stageVerdict(verdict)}
      character={value.stage.character} scene={value.stage.scene} backdrop={backdrop} />;
  }
  if (!backdrop) return null;
  // No stage projected (a failed preference read): the scene alone, in a band-sized element with the band's class contract.
  const style = { '--lf-mentor-band-size': `${REGISTERS[registerForCopyBand(value.ageBand)].mentor.stageBandPx}px` } as CSSProperties;
  return <div className={`lf-mentor-band lf-mentor-band--${value.ageBand} lf-mentor-band--scene`} style={style} aria-hidden="true"
    data-adventure-theme={value.adventureTheme ?? undefined}>{backdrop}</div>;
}

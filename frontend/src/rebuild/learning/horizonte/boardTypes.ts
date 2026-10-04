import type { ComponentType, LazyExoticComponent } from 'react';
import type { AgeBand, CopyRole, Locale } from '../../design/copyBudget';
import type { LessonClientDocument } from '../lessonDocument';
import type { LessonSequenceControl } from '../lessonSequence';
import type { OnGradeSegment } from '../segmentKit';
import type { HorizonteSegment } from './contract';

/** One authored string in three real native versions, tagged with the Copy Budget role its element will carry. */
export type HorizonteCopyEntry = { readonly role: CopyRole; /** Age band whose Copy Budget limits apply; absent means the strictest, 6-9. */ readonly band?: AgeBand } & { readonly [L in Locale]: string };
export type HorizonteCopy = Readonly<Record<string, HorizonteCopyEntry>>;

/** The ICAP level the piece is designed for (Chi and Wylie): a declared claim, checked by the board harness. */
export type IcapLevel = 'passive' | 'active' | 'constructive' | 'interactive';

export interface HorizonteBoardProps {
  document: LessonClientDocument;
  segment: HorizonteSegment;
  onBack: () => void;
  sequence?: LessonSequenceControl;
  onGrade?: OnGradeSegment;
}

export interface HorizonteBoardEntry {
  /** `lazy(() => import('./XBoard'))`: one chunk per board. */
  board: LazyExoticComponent<ComponentType<HorizonteBoardProps>>;
  icap: IcapLevel;
  /** Gzipped JS budget for this board's chunk, in KB. */
  chunkBudgetKb: number;
}
export type HorizonteBoards = Readonly<Record<string, HorizonteBoardEntry>>;

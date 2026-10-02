import { Suspense } from 'react';
import type { LessonClientDocument } from '../lessonDocument';
import type { LessonSequenceControl } from '../lessonSequence';
import type { OnGradeSegment } from '../segmentKit';
import type { HorizonteBoardEntry, HorizonteBoards } from './boardTypes';
import { useAttemptSeed } from './attemptSeed';
import { isHorizonteSegment, isSeededHorizonteType, type HorizonteSegment } from './contract';
import { GOLDEN_BOARDS } from './golden/boards';
import './horizonte.css';
import { NUM_A_BOARDS } from './num-a/boards';
import { NUM_B_BOARDS } from './num-b/boards';
import { BALANCE_BOARDS } from './balance/boards';
import { STATS1_BOARDS } from './stats1/boards';
import { PLANE1_BOARDS } from './plane1/boards';
import { FIN1_BOARDS } from './fin1/boards';
import { FIN2_BOARDS } from './fin2/boards';
import { ALG1_BOARDS } from './alg1/boards';
import { ALG2_BOARDS } from './alg2/boards';
import { GEOM2_BOARDS } from './geom2/boards';
import { PROB_BOARDS } from './prob/boards';
import { COM_BOARDS } from './com/boards';
import { SIM1_BOARDS } from './sim1/boards';
import { SIM2_BOARDS } from './sim2/boards';
import { SOLIDS_BOARDS } from './solids/boards';
import { SPACE1_BOARDS } from './space1/boards';
import { SPACE2_BOARDS } from './space2/boards';

/** Registered here once; each entry's board is a React.lazy chunk, so no board ships until its segment is on screen. */
export const HORIZONTE_BOARDS: HorizonteBoards = {
  ...GOLDEN_BOARDS,
  ...NUM_A_BOARDS,
  ...NUM_B_BOARDS,
  ...BALANCE_BOARDS,
  ...STATS1_BOARDS,
  ...PLANE1_BOARDS,
  ...FIN1_BOARDS,
  ...FIN2_BOARDS,
  ...ALG1_BOARDS,
  ...ALG2_BOARDS,
  ...GEOM2_BOARDS,
  ...PROB_BOARDS,
  ...COM_BOARDS,
  ...SIM1_BOARDS,
  ...SIM2_BOARDS,
  ...SOLIDS_BOARDS,
  ...SPACE1_BOARDS,
  ...SPACE2_BOARDS,
};

export { isHorizonteSegment };

/** A graded Horizonte kind needs the generic grader; an ungraded one renders anywhere. A kind with no board never renders. */
export function canRenderHorizonte(segment: HorizonteSegment, hasGrader: boolean): boolean {
  if (!Object.hasOwn(HORIZONTE_BOARDS, segment.type)) return false;
  return segment.grading !== 'server' || hasGrader;
}

export function HorizonteSegmentView({ document, segment, onBack, sequence, onGrade, unavailable }: {
  document: LessonClientDocument; segment: HorizonteSegment; onBack: () => void; sequence?: LessonSequenceControl; onGrade?: OnGradeSegment;
  unavailable: () => React.ReactNode;
}) {
  const seed = useAttemptSeed(segment.id);
  const entry: HorizonteBoardEntry | undefined = Object.hasOwn(HORIZONTE_BOARDS, segment.type) ? HORIZONTE_BOARDS[segment.type] : undefined;
  if (!entry || (segment.grading === 'server' && !onGrade) || (isSeededHorizonteType(segment.type) && seed === null)) return <>{unavailable()}</>;
  const Board = entry.board;
  return <Suspense fallback={<div className="lf-hz-loading" aria-busy="true" />}>
    <Board document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={onGrade} />
  </Suspense>;
}

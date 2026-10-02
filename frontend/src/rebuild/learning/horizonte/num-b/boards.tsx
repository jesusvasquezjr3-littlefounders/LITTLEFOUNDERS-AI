import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const NUM_B_BOARDS: HorizonteBoards = {
  'math.array-area.v2': { board: lazy(() => import('./ArrayAreaBoard')), icap: 'constructive', chunkBudgetKb: 20 },
  'math.ratio-line.v2': { board: lazy(() => import('./RatioLineBoard')), icap: 'constructive', chunkBudgetKb: 20 },
  'math.fraction-wall.v2': { board: lazy(() => import('./FractionWallBoard')), icap: 'constructive', chunkBudgetKb: 24 },
};

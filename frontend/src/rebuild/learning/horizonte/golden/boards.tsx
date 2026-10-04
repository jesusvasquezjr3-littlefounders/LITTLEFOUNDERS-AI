import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const GOLDEN_BOARDS: HorizonteBoards = {
  'math.ten-frame.v2': { board: lazy(() => import('./TenFrameBoard')), icap: 'active', chunkBudgetKb: 12 },
};

import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const SOLIDS_BOARDS: HorizonteBoards = {
  'geometry.solid-viewer.v2': { board: lazy(() => import('./SolidViewerBoard')), icap: 'active', chunkBudgetKb: 16 },
  'geometry.cube-net.v2': { board: lazy(() => import('./CubeNetBoard')), icap: 'constructive', chunkBudgetKb: 12 },
  'geometry.solid-net.v2': { board: lazy(() => import('./SolidNetBoard')), icap: 'constructive', chunkBudgetKb: 12 },
  'geometry.cube-stack.v2': { board: lazy(() => import('./CubeStackBoard')), icap: 'constructive', chunkBudgetKb: 14 },
};

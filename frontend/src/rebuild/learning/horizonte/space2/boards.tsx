import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const SPACE2_BOARDS: HorizonteBoards = {
  'math.surface.v2': { board: lazy(() => import('./SurfaceBoard')), icap: 'active', chunkBudgetKb: 18 },
  'geography.globe-route.v2': { board: lazy(() => import('./GlobeBoard')), icap: 'active', chunkBudgetKb: 40 },
  'space.ar-table.v2': { board: lazy(() => import('./ArTableBoard')), icap: 'active', chunkBudgetKb: 14 },
};

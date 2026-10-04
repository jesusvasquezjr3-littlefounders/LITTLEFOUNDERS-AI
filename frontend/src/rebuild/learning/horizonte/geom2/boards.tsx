import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const GEOM2_BOARDS: HorizonteBoards = {
  'math.geoboard.v2': { board: lazy(() => import('./GeoboardBoard')), icap: 'constructive', chunkBudgetKb: 12 },
  'math.area-squares.v2': { board: lazy(() => import('./AreaSquaresBoard')), icap: 'constructive', chunkBudgetKb: 12 },
  'math.transform.v2': { board: lazy(() => import('./TransformBoard')), icap: 'constructive', chunkBudgetKb: 12 },
  'math.tessellation.v2': { board: lazy(() => import('./TessellationBoard')), icap: 'constructive', chunkBudgetKb: 12 },
};

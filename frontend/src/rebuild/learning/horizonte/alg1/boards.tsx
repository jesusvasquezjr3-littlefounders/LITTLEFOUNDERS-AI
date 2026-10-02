import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const ALG1_BOARDS: HorizonteBoards = {
  'math.algebra-tiles.v2': { board: lazy(() => import('./TilesBoard')), icap: 'constructive', chunkBudgetKb: 30 },
  'math.algebra-cards.v2': { board: lazy(() => import('./CardsBoard')), icap: 'constructive', chunkBudgetKb: 30 },
  'math.area-model.v2': { board: lazy(() => import('./AreaBoard')), icap: 'constructive', chunkBudgetKb: 30 },
};

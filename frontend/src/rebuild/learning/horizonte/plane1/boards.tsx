import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const PLANE1_BOARDS: HorizonteBoards = {
  'alg.slope-triangle.v2': { board: lazy(() => import('./SlopeTriangleBoard')), icap: 'active', chunkBudgetKb: 12 },
  'alg.rate-of-change.v2': { board: lazy(() => import('./RateOfChangeBoard')), icap: 'active', chunkBudgetKb: 12 },
  'alg.linked-views.v2': { board: lazy(() => import('./LinkedViewsBoard')), icap: 'active', chunkBudgetKb: 14 },
  'fin.break-even.v2': { board: lazy(() => import('./BreakEvenBoard')), icap: 'active', chunkBudgetKb: 12 },
  'fin.cost-structure.v2': { board: lazy(() => import('./CostStructureBoard')), icap: 'active', chunkBudgetKb: 12 },
  'fin.margin-markup.v2': { board: lazy(() => import('./MarginMarkupBoard')), icap: 'active', chunkBudgetKb: 12 },
  'econ.market-shift.v2': { board: lazy(() => import('./MarketShiftBoard')), icap: 'active', chunkBudgetKb: 14 },
  'econ.elasticity.v2': { board: lazy(() => import('./ElasticityBoard')), icap: 'active', chunkBudgetKb: 12 },
};

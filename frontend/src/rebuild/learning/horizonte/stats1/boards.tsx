import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const STATS1_BOARDS: HorizonteBoards = {
  'stats.dot-plot.v2': { board: lazy(() => import('./DotPlotBoard')), icap: 'active', chunkBudgetKb: 14 },
  'stats.balance-point.v2': { board: lazy(() => import('./BalanceBoard')), icap: 'active', chunkBudgetKb: 12 },
  'stats.normal.v2': { board: lazy(() => import('./NormalBoard')), icap: 'active', chunkBudgetKb: 14 },
  'stats.binomial.v2': { board: lazy(() => import('./BinomialBoard')), icap: 'active', chunkBudgetKb: 14 },
  'stats.clt.v2': { board: lazy(() => import('./CltBoard')), icap: 'active', chunkBudgetKb: 14 },
};

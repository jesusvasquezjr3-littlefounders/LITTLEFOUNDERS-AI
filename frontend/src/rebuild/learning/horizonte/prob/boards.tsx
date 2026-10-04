import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const PROB_BOARDS: HorizonteBoards = {
  'prob.tree.v2': { board: lazy(() => import('./TreeBoard')), icap: 'constructive', chunkBudgetKb: 18 },
  'prob.bayes.v2': { board: lazy(() => import('./BayesBoard')), icap: 'constructive', chunkBudgetKb: 16 },
  'prob.regression.v2': { board: lazy(() => import('./RegressionBoard')), icap: 'constructive', chunkBudgetKb: 18 },
};

import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const FIN1_BOARDS: HorizonteBoards = {
  'money.compound-interest.v2': { board: lazy(() => import('./CompoundBoard')), icap: 'constructive', chunkBudgetKb: 14 },
  'money.time-value.v2': { board: lazy(() => import('./TimeValueBoard')), icap: 'constructive', chunkBudgetKb: 16 },
  'money.rate-return.v2': { board: lazy(() => import('./RateBoard')), icap: 'constructive', chunkBudgetKb: 18 },
};

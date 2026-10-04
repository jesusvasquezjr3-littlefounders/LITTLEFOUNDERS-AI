import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const BALANCE_BOARDS: HorizonteBoards = {
  'math.equation-balance.v2': { board: lazy(() => import('./BalanceBoard')), icap: 'constructive', chunkBudgetKb: 14 },
  'math.visual-proof.v2': { board: lazy(() => import('./ProofBoard')), icap: 'constructive', chunkBudgetKb: 18 },
};

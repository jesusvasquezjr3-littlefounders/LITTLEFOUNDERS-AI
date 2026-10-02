import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const FIN2_BOARDS: HorizonteBoards = {
  'money.cash-flow.v2': { board: lazy(() => import('./StatementBoard')), icap: 'constructive', chunkBudgetKb: 14 },
  'reasoning.decision-grid.v2': { board: lazy(() => import('./MatrixBoard')), icap: 'constructive', chunkBudgetKb: 16 },
  'plan.schedule-board.v2': { board: lazy(() => import('./ScheduleBoard')), icap: 'constructive', chunkBudgetKb: 16 },
};

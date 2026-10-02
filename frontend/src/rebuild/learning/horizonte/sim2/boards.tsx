import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const SIM2_BOARDS: HorizonteBoards = {
  'money.life-sim.v2': { board: lazy(() => import('./LifeSimBoard')), icap: 'active', chunkBudgetKb: 16 },
};

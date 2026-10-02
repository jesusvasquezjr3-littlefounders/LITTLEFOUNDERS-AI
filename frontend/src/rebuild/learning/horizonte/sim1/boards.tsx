import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const SIM1_BOARDS: HorizonteBoards = {
  'math.chance-sim.v2': { board: lazy(() => import('./ChanceBoard')), icap: 'active', chunkBudgetKb: 14 },
  'math.galton-sim.v2': { board: lazy(() => import('./GaltonBoard')), icap: 'active', chunkBudgetKb: 14 },
  'stats.coverage-sim.v2': { board: lazy(() => import('./CoverageBoard')), icap: 'active', chunkBudgetKb: 14 },
  'stats.bootstrap-sim.v2': { board: lazy(() => import('./BootstrapBoard')), icap: 'active', chunkBudgetKb: 14 },
};

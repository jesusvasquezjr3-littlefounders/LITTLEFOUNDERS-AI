import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const SPACE1_BOARDS: HorizonteBoards = {
  'geometry.mental-rotation.v2': { board: lazy(() => import('./MentalRotationBoard')), icap: 'constructive', chunkBudgetKb: 16 },
  'geometry.solid-section.v2': { board: lazy(() => import('./SolidSectionBoard')), icap: 'active', chunkBudgetKb: 24 },
  'money.market-stall.v2': { board: lazy(() => import('./MarketStallBoard')), icap: 'constructive', chunkBudgetKb: 14 },
  'money.coin-stack.v2': { board: lazy(() => import('./CoinStackBoard')), icap: 'active', chunkBudgetKb: 14 },
};

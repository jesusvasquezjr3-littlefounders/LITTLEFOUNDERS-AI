import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const ALG2_BOARDS: HorizonteBoards = {
  'math.function-graph.v2': { board: lazy(() => import('./FunctionGraphBoard')), icap: 'constructive', chunkBudgetKb: 14 },
  'math.line-system.v2': { board: lazy(() => import('./LineSystemBoard')), icap: 'constructive', chunkBudgetKb: 14 },
  'math.expression-editor.v2': { board: lazy(() => import('./ExpressionEditorBoard')), icap: 'constructive', chunkBudgetKb: 16 },
};

/*
 * The shared Pizarrón visuals (product B.7: one component set for lessons and
 * the Mentor's board). `PIZARRON_VISUALS` names every exported visual; the
 * whiteboard parity gate (agent/tools/check-instrument-parity.mjs) requires
 * every Oracle whiteboard kind to map to one of them.
 */
export {
  ArrayVisual, BalanceScaleVisual, BarModelVisual, SchemaSlotsVisual, BeadStringVisual, CIRCLE_DENOMINATORS, CoinGroupsVisual, DealVisual, FillContainerVisual,
  FractionCellsVisual, FractionCircleVisual, GrowthLinesVisual, IconArrayVisual, LedgerVisual, NumberLineVisual, PictographVisual, RatioLinesVisual,
  SERIES_TONES, SeriesBarsVisual, SortBinsVisual, TallyVisual, TapeKey, TenFrameVisual, TextCardsVisual, VennVisual, WaffleVisual, WorkedStepsVisual,
  WorkedStepsList, seriesTone,
} from './visuals';
export {
  AdditionDotsVisual, AllocationDonutVisual, AllocationStackVisual, AllocationWaffleVisual, BalanceMeterVisual, BaseTenVisual, ConditionRuleVisual,
  FunctionMachineVisual, GoalBulletVisual, GrowthCompareVisual, NumberAxisVisual, PercentGridVisual, SavingsLineVisual, StackedSlicesVisual,
} from './lessonVisuals';
export type { ComparePoint, LinePoint, PocketAmount, RuleCondition, StackSlice, WalletPocket } from './lessonVisuals';
// GAP-FIX-R4 (B.7): the concept pictures, shared with the Mentor's board.
export { RiskReturnVisual, StackedColumnsVisual, SupplyDemandVisual } from './conceptVisuals';
export type { Column, ColumnPart, PlotLine, PlotPoint } from './conceptVisuals';
// Bible 05 §5 (GAP-FIX-R2): KaTeX notation, loaded only when a board shows notation.
export { MathExpression, localizeTex } from './MathExpression';
export type {
  ChanceOutcome, CoinGroup, GrowthSeries, LedgerEntry, LineJump, LineMark, PictographRow, RatioGroup, RatioLine, RatioTick, SeriesBarRow, SeriesTone,
  SortBin, TallyRow, TapeRow, TapeSegment, TextCard, WaffleCategory, WorkedStep, WorkedStepRow, DropTargetProps, VennRegionKey,
} from './visuals';

export const PIZARRON_VISUALS = [
  'ArrayVisual', 'BalanceScaleVisual', 'BarModelVisual', 'SchemaSlotsVisual', 'BeadStringVisual', 'CoinGroupsVisual', 'DealVisual', 'FillContainerVisual',
  'FractionCellsVisual', 'FractionCircleVisual', 'GrowthLinesVisual', 'IconArrayVisual', 'LedgerVisual', 'NumberLineVisual', 'PictographVisual',
  'RatioLinesVisual', 'SeriesBarsVisual', 'SortBinsVisual', 'TallyVisual', 'TenFrameVisual', 'TextCardsVisual', 'VennVisual', 'WaffleVisual',
  'WorkedStepsVisual',
  // The lesson pictures (lessonVisuals.tsx): the same set, drawn beside the interactive layer of a lesson.
  'AdditionDotsVisual', 'AllocationDonutVisual', 'AllocationStackVisual', 'AllocationWaffleVisual', 'BalanceMeterVisual', 'BaseTenVisual',
  'ConditionRuleVisual', 'FunctionMachineVisual', 'GoalBulletVisual', 'GrowthCompareVisual', 'NumberAxisVisual', 'PercentGridVisual',
  'SavingsLineVisual', 'StackedSlicesVisual',
  // Notation (GAP-FIX-R2).
  'MathExpression',
  // The concept pictures (GAP-FIX-R4).
  'RiskReturnVisual', 'StackedColumnsVisual', 'SupplyDemandVisual',
] as const;
export type PizarronVisualName = (typeof PIZARRON_VISUALS)[number];

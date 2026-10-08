/*
 * The shared Pizarrón visuals (one component set for lessons and
 * the Mentor's board). `PIZARRON_VISUALS` names every exported visual.
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
// The concept pictures, shared with the Mentor's board.
export { RiskReturnVisual, StackedColumnsVisual, SupplyDemandVisual } from './conceptVisuals';
export type { Column, ColumnPart, PlotLine, PlotPoint } from './conceptVisuals';
// KaTeX notation, loaded only when a board shows notation.
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
  // Notation.
  'MathExpression',
  // The concept pictures.
  'RiskReturnVisual', 'StackedColumnsVisual', 'SupplyDemandVisual',
] as const;
export type PizarronVisualName = (typeof PIZARRON_VISUALS)[number];

import { boardSpace, sameArrangement, type Board, type Slots } from './boards.js';
import type { HzBuilder } from './shared.js';

const keyMet = (keys: Slots[]) => (slots: Slots) => keys.some((key) => sameArrangement(key, slots));

const cashFlow: HzBuilder = (p, r) => {
  const items = (p.items as Array<{ id: string }>).map((item) => item.id);
  const lines = ['earned', 'passive', 'expenses', 'assets', 'liabilities'];
  const board: Board = {
    pieces: [...items, 'goal-met', 'goal-short'], slots: [...lines, 'goal'], capacity: (slot) => (slot === 'goal' ? 1 : items.length), keys: r.solutions,
  };
  return boardSpace(board, { met: keyMet(r.solutions) });
};

const GRID_SLOTS: Record<string, string[]> = {
  swot: ['strengths', 'weaknesses', 'opportunities', 'threats'],
  eisenhower: ['do-now', 'schedule', 'delegate', 'drop'],
  'two-by-two': ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  'business-canvas': ['partners', 'activities', 'resources', 'value', 'relationships', 'channels', 'segments', 'costs', 'revenue'],
};

const decisionGrid: HzBuilder = (p, r, segment) => {
  const visual = segment.visual?.type as string;
  const pieces = p.pieces as string[];
  const matrix = visual === 'decision-matrix';
  const slots = matrix ? pieces.map((_, index) => `rank-${index + 1}`) : GRID_SLOTS[visual];
  if (!slots) return null;
  return boardSpace({ pieces, slots, capacity: () => (matrix ? 1 : pieces.length), keys: r.solutions }, { met: keyMet(r.solutions) });
};

interface Task { id: string; after: string[]; duration?: number; due?: number }

function ganttSchedules(tasks: Task[], periods: number, workers: number | undefined, descending: boolean, limit: number): Slots[] {
  const order: Task[] = [];
  const placed = new Set<string>();
  while (order.length < tasks.length) {
    const next = tasks.find((task) => !placed.has(task.id) && task.after.every((id) => placed.has(id)));
    if (!next) return [];
    order.push(next);
    placed.add(next.id);
  }
  const start = new Map<string, number>();
  const found: Slots[] = [];
  const load = (period: number) => [...start.entries()].filter(([id, from]) => { const task = tasks.find((item) => item.id === id)!; return from <= period && period < from + task.duration!; }).length;
  const visit = (index: number): void => {
    if (found.length >= limit) return;
    if (index === order.length) {
      const slots: Slots = {};
      for (const [id, from] of start) (slots[`period-${from}`] ??= []).push(id);
      found.push(slots);
      return;
    }
    const task = order[index]!;
    const earliest = 1 + Math.max(0, ...task.after.map((id) => start.get(id)! + tasks.find((item) => item.id === id)!.duration! - 1));
    const latest = periods - task.duration! + 1;
    const choices = Array.from({ length: Math.max(0, latest - earliest + 1) }, (_, offset) => earliest + offset);
    for (const from of descending ? choices.reverse() : choices) {
      start.set(task.id, from);
      const crowded = workers !== undefined && Array.from({ length: task.duration! }, (_, step) => from + step).some((period) => load(period) > workers);
      if (!crowded) visit(index + 1);
      start.delete(task.id);
      if (found.length >= limit) return;
    }
  };
  visit(0);
  return found;
}

function timelineSchedules(tasks: Task[], limit: number): Slots[] {
  const found: Slots[] = [];
  const steps: string[] = [];
  const visit = (): void => {
    if (found.length >= limit) return;
    const step = steps.length + 1;
    if (steps.length === tasks.length) { found.push(Object.fromEntries(steps.map((id, index) => [`step-${index + 1}`, [id]]))); return; }
    for (const task of tasks) {
      if (steps.includes(task.id) || !task.after.every((id) => steps.includes(id)) || (task.due !== undefined && step > task.due)) continue;
      steps.push(task.id);
      visit();
      steps.pop();
      if (found.length >= limit) return;
    }
  };
  visit();
  return found;
}

const startOf = (slots: Slots, prefix: string): Map<string, number> => {
  const out = new Map<string, number>();
  for (const [slot, pieces] of Object.entries(slots)) for (const id of pieces) out.set(id, Number(slot.slice(prefix.length)));
  return out;
};

const scheduleBoard: HzBuilder = (p, r, segment) => {
  const visual = segment.visual?.type as string;
  const tasks = p.tasks as Task[];
  const ids = tasks.map((task) => task.id);
  if (visual === 'gantt') {
    const board: Board = { pieces: ids, slots: Array.from({ length: p.periods }, (_, index) => `period-${index + 1}`), capacity: () => ids.length, keys: r.solutions };
    const met = (slots: Slots) => {
      const start = startOf(slots, 'period-');
      if (start.size !== tasks.length) return false;
      const end = (task: Task) => start.get(task.id)! + task.duration! - 1;
      if (tasks.some((task) => end(task) > p.periods || task.after.some((id) => start.get(task.id)! <= end(tasks.find((item) => item.id === id)!)))) return false;
      return p.workers === undefined || Array.from({ length: p.periods }, (_, index) => index + 1).every((period) => tasks.filter((task) => start.get(task.id)! <= period && period <= end(task)).length <= p.workers);
    };
    const extra = [...ganttSchedules(tasks, p.periods, p.workers, false, 120), ...ganttSchedules(tasks, p.periods, p.workers, true, 120)];
    return boardSpace(board, { met, extra });
  }
  if (visual === 'timeline') {
    const board: Board = { pieces: ids, slots: ids.map((_, index) => `step-${index + 1}`), capacity: () => 1, keys: r.solutions };
    const met = (slots: Slots) => {
      const step = startOf(slots, 'step-');
      return step.size === tasks.length && tasks.every((task) => (task.due === undefined || step.get(task.id)! <= task.due) && task.after.every((id) => step.get(id)! < step.get(task.id)!));
    };
    return boardSpace(board, { met, extra: timelineSchedules(tasks, 200) });
  }
  if (visual === 'kanban') {
    const done = p.done as string[];
    const movable = ids.filter((id) => !done.includes(id));
    const board: Board = { pieces: movable, slots: ['todo', 'doing'], capacity: (slot) => (slot === 'todo' ? movable.length : p.limit), keys: r.solutions };
    return boardSpace(board, { met: keyMet(r.solutions), initial: { todo: [...movable] } });
  }
  return null;
};

export const FIN2_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'money.cash-flow.v2': cashFlow,
  'reasoning.decision-grid.v2': decisionGrid,
  'plan.schedule-board.v2': scheduleBoard,
};

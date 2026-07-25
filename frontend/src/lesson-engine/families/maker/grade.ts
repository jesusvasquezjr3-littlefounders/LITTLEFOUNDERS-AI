// `maker` family — pure validators (LESSON_ENGINE.md §5.8, §6).
// Malformed answers → score 0, never throw. robot_path re-simulates the
// submitted program authoritatively; the renderer reuses the same simulator
// so what the kid watched IS what gets graded.

import type { FamilyGrader, GradeOutcome } from '../../core/types'
import { binary, decisionAccuracy, kendall, sumEquals, toleranceBands } from '../../core/scoring'

type Dict = Record<string, unknown>

function obj(v: unknown): Dict | null {
  return typeof v === 'object' && v !== null ? (v as Dict) : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function strArray(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

const MALFORMED: GradeOutcome = { score: 0 }

// ---- robot simulation (shared with the renderer) --------------------------------

export type RobotDir = 'up' | 'right' | 'down' | 'left'
export type RobotCommand = 'forward' | 'left' | 'right'

export interface RobotState {
  x: number
  y: number
  dir: RobotDir
  /** true when this step tried to move into a wall or off the grid (stayed put). */
  blocked: boolean
}

export interface RobotWorld {
  w: number
  h: number
  walls: Array<{ x: number; y: number }>
}

export const TURN_LEFT: Record<RobotDir, RobotDir> = {
  up: 'left',
  left: 'down',
  down: 'right',
  right: 'up',
}

export const TURN_RIGHT: Record<RobotDir, RobotDir> = {
  up: 'right',
  right: 'down',
  down: 'left',
  left: 'up',
}

export const DIR_DELTA: Record<RobotDir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
}

export function isRobotCommand(v: string): v is RobotCommand {
  return v === 'forward' || v === 'left' || v === 'right'
}

/** Pure walk: turns rotate, forward moves one cell; walls/borders block (stay in place). */
export function simulateRobot(
  world: RobotWorld,
  start: { x: number; y: number; dir: RobotDir },
  commands: RobotCommand[],
): RobotState[] {
  const states: RobotState[] = [{ x: start.x, y: start.y, dir: start.dir, blocked: false }]
  let cur = { x: start.x, y: start.y, dir: start.dir }
  for (const cmd of commands) {
    if (cmd === 'left') {
      cur = { ...cur, dir: TURN_LEFT[cur.dir] }
      states.push({ ...cur, blocked: false })
    } else if (cmd === 'right') {
      cur = { ...cur, dir: TURN_RIGHT[cur.dir] }
      states.push({ ...cur, blocked: false })
    } else {
      const d = DIR_DELTA[cur.dir]
      const nx = cur.x + d.dx
      const ny = cur.y + d.dy
      const outOfBounds = nx < 0 || ny < 0 || nx >= world.w || ny >= world.h
      const hitsWall = world.walls.some((wall) => wall.x === nx && wall.y === ny)
      if (outOfBounds || hitsWall) {
        states.push({ ...cur, blocked: true })
      } else {
        cur = { ...cur, x: nx, y: ny }
        states.push({ ...cur, blocked: false })
      }
    }
  }
  return states
}

interface RobotPayload {
  world: RobotWorld
  start: { x: number; y: number; dir: RobotDir }
  goal: { x: number; y: number }
  maxCommands: number
}

function isDir(v: unknown): v is RobotDir {
  return v === 'up' || v === 'right' || v === 'down' || v === 'left'
}

function coordPair(v: unknown): { x: number; y: number } | null {
  const o = obj(v)
  if (!o || typeof o.x !== 'number' || typeof o.y !== 'number') return null
  return { x: o.x, y: o.y }
}

export function parseRobotPayload(payload: Dict): RobotPayload | null {
  const grid = obj(payload.grid)
  const startRaw = obj(payload.start)
  const goal = coordPair(payload.goal)
  if (!grid || typeof grid.w !== 'number' || typeof grid.h !== 'number') return null
  if (!startRaw || typeof startRaw.x !== 'number' || typeof startRaw.y !== 'number' || !isDir(startRaw.dir)) {
    return null
  }
  if (!goal || typeof payload.max_commands !== 'number') return null
  const wallsRaw = Array.isArray(payload.walls) ? payload.walls : []
  const walls: Array<{ x: number; y: number }> = []
  for (const w of wallsRaw) {
    const c = coordPair(w)
    if (!c) return null
    walls.push(c)
  }
  return {
    world: { w: grid.w, h: grid.h, walls },
    start: { x: startRaw.x, y: startRaw.y, dir: startRaw.dir },
    goal,
    maxCommands: payload.max_commands,
  }
}

// ---- graders ---------------------------------------------------------------------

const gradeCodeOrder: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const order = a ? strArray(a.order) : null
  const key = obj(segment.answer)
  const correct = key ? strArray(key.order) : null
  if (!order || !correct) return MALFORMED
  // Accept a SET of equally-valid instruction orderings (genuinely swappable steps —
  // e.g. verify price ↔ take payment). Score against `order` and every `accept_orders`
  // entry, keep the best. Absent accept_orders, this is the single-order path.
  const alts =
    key && Array.isArray(key.accept_orders)
      ? (key.accept_orders as unknown[])
          .map(strArray)
          .filter((o): o is string[] => o !== null && o.length === correct.length)
      : []
  let best = { score: kendall(order, correct), order: correct }
  for (const cand of alts) {
    const s = kendall(order, cand)
    if (s > best.score) best = { score: s, order: cand }
  }
  return { score: best.score, reveal: { order: best.order } }
}

const gradeRobotPath: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const commands = a ? strArray(a.commands) : null
  const p = parseRobotPayload(segment.payload)
  if (!commands || !p || !commands.every(isRobotCommand)) return MALFORMED
  const states = simulateRobot(p.world, p.start, commands.slice(0, p.maxCommands))
  const final = states[states.length - 1] ?? { ...p.start, blocked: false }
  const distance = Math.abs(final.x - p.goal.x) + Math.abs(final.y - p.goal.y)
  const score = distance === 0 ? 100 : distance === 1 ? 40 : 0
  return { score, reveal: { goal: p.goal } }
}

const gradeDebugHunt: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const selected = a ? strArray(a.selected) : null
  const key = obj(segment.answer)
  const bugIds = key ? strArray(key.bug_ids) : null
  const blocks = Array.isArray(segment.payload.blocks)
    ? (segment.payload.blocks as Array<{ id?: unknown }>)
    : null
  if (!selected || !bugIds || !blocks || !blocks.every((b) => typeof b.id === 'string')) {
    return MALFORMED
  }
  const universe = blocks.map((b) => b.id as string)
  return {
    score: decisionAccuracy(selected, bugIds, universe),
    reveal: { bug_ids: bugIds, fix_md: key ? str(key.fix_md) ?? undefined : undefined },
  }
}

const gradeBalanceScale: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const placed = a ? strArray(a.placed) : null
  const leftFixed = Array.isArray(segment.payload.left_fixed)
    ? (segment.payload.left_fixed as Array<{ value?: unknown }>)
    : null
  const weights = Array.isArray(segment.payload.weights)
    ? (segment.payload.weights as Array<{ id?: unknown; value?: unknown }>)
    : null
  if (
    !placed ||
    !leftFixed ||
    !weights ||
    !leftFixed.every((i) => typeof i.value === 'number') ||
    !weights.every((w) => typeof w.id === 'string' && typeof w.value === 'number')
  ) {
    return MALFORMED
  }
  const valueById = new Map(weights.map((w) => [w.id as string, w.value as number]))
  if (!placed.every((id) => valueById.has(id))) return MALFORMED
  const leftSum = leftFixed.reduce((acc, i) => acc + (i.value as number), 0)
  const rightSum = [...new Set(placed)].reduce((acc, id) => acc + (valueById.get(id) ?? 0), 0)
  const smallest = Math.min(...weights.map((w) => w.value as number))
  return { score: sumEquals(rightSum, leftSum, smallest), reveal: { target: leftSum } }
}

const gradeMeasureRead: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const value = a ? num(a.value) : null
  const key = obj(segment.answer)
  const target = key ? num(key.value) : null
  const tolerance = key ? num(key.tolerance) : null
  if (value === null || target === null || tolerance === null) return MALFORMED
  return { score: toleranceBands(value, target, tolerance), reveal: { value: target } }
}

const gradeMachineIo: FamilyGrader = (segment, answer) => {
  const a = obj(answer)
  const key = obj(segment.answer)
  if (!key) return MALFORMED
  if (typeof key.correct_option_id === 'string') {
    const chosen = a ? str(a.option_id) : null
    if (!chosen) return MALFORMED
    return {
      score: binary(chosen === key.correct_option_id),
      reveal: { correct_option_id: key.correct_option_id },
    }
  }
  const target = num(key.value)
  const value = a ? num(a.value) : null
  if (target === null || value === null) return MALFORMED
  return { score: toleranceBands(value, target, 0), reveal: { value: target } }
}

export const makerGraders: Record<string, FamilyGrader> = {
  code_order: gradeCodeOrder,
  robot_path: gradeRobotPath,
  debug_hunt: gradeDebugHunt,
  balance_scale: gradeBalanceScale,
  measure_read: gradeMeasureRead,
  machine_io: gradeMachineIo,
}

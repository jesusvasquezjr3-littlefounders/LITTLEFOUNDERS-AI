import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import { Prose } from '../Prose';
import { FIN2_COPY } from './copy';
import { startSlots } from './placement.generated';
import { PERIOD_PREFIX, STEP_PREFIX, scheduleConflicts, scheduleFrame, scheduleOf, type SchedulePayload, type ScheduleTask } from './schedule.generated';
import type { SlotMap } from './slots.generated';
import { SlotBoardShell, Zone, describeZones, useSlotBoard, word, wrapLines, type Words } from './slotBoard';
import './ScheduleBoard.css';

type ScheduleSegment = Extract<HorizonteSegment, { type: 'plan.schedule-board.v2' }>;
type Labels = Readonly<Record<string, string>>;

const LEFT = 96;
const GRID = 224;
const HEAD = 18;
const ROW = 26;

function startsOf(slots: SlotMap, prefix: string): Map<string, number> {
  const starts = new Map<string, number>();
  for (const [slot, pieces] of Object.entries(slots)) if (slot.startsWith(prefix)) for (const id of pieces) starts.set(id, Number(slot.slice(prefix.length)));
  return starts;
}

interface RowsProps { t: Words; gantt: boolean; schedule: SchedulePayload; labels: Labels; slots: SlotMap; broken: ReadonlySet<string> }

function Rows({ t, gantt, schedule, labels, slots, broken }: RowsProps) {
  const columns = gantt ? schedule.periods! : schedule.tasks.length;
  const column = GRID / columns;
  const start = startsOf(slots, gantt ? PERIOD_PREFIX : STEP_PREFIX);
  const span = (task: ScheduleTask) => (gantt ? task.duration! : 1);
  const x = (at: number) => LEFT + (at - 1) * column;
  const y = (row: number) => HEAD + row * ROW;
  const count = schedule.tasks.length;
  const loaded = gantt && schedule.workers !== undefined;
  const bodyEnd = y(count) + (loaded ? ROW : 0);
  const height = bodyEnd + (gantt ? 16 : 4);
  const index = new Map(schedule.tasks.map((task, row) => [task.id, row]));
  const busy = (period: number) => schedule.tasks.filter((task) => start.has(task.id) && start.get(task.id)! <= period && period <= start.get(task.id)! + span(task) - 1).length;
  return <svg className="lf-sched-chart" viewBox={`0 0 320 ${height}`} role="img" aria-label={gantt ? t.chartGantt : t.chartTimeline} data-copy-role="data" focusable="false">
    {Array.from({ length: columns }, (_, at) => <g key={at}>
      <text x={x(at + 1) + column / 2} y="12" textAnchor="middle">{at + 1}</text>
      <line className="lf-sched-grid" x1={x(at + 1)} x2={x(at + 1)} y1={HEAD} y2={bodyEnd} />
    </g>)}
    <line className="lf-sched-grid" x1={LEFT + GRID} x2={LEFT + GRID} y1={HEAD} y2={bodyEnd} />
    {schedule.tasks.map((task, row) => <g key={task.id}>
      <line className="lf-sched-grid" x1="0" x2={LEFT + GRID} y1={y(row)} y2={y(row)} />
      {wrapLines(labels[task.id] ?? task.id, 15).slice(0, 2).map((line, at, lines) => <text key={at} x="0" y={y(row) + (lines.length === 1 ? 16 : 11 + at * 11)}>{line}</text>)}
      {start.has(task.id) ? <rect className={broken.has(task.id) ? 'lf-sched-bar lf-sched-bar--broken' : 'lf-sched-bar'} x={x(start.get(task.id)!) + 1}
        y={y(row) + 6} width={Math.max(4, Math.min(span(task) * column - 2, LEFT + GRID - x(start.get(task.id)!) - 1))} height="14" rx="3" /> : null}
      {!gantt && task.due !== undefined ? <line className="lf-sched-due" x1={x(task.due + 1)} x2={x(task.due + 1)} y1={y(row) + 3} y2={y(row) + ROW - 3} /> : null}
    </g>)}
    <line className="lf-sched-grid" x1="0" x2={LEFT + GRID} y1={y(count)} y2={y(count)} />
    {schedule.tasks.flatMap((task) => task.after.map((before) => {
      const from = schedule.tasks.find((other) => other.id === before)!;
      if (!start.has(task.id) || !start.has(before)) return null;
      const x1 = x(start.get(before)! + span(from)) - 1;
      const y1 = y(index.get(before)!) + 13;
      const x2 = x(start.get(task.id)!) + 1;
      const y2 = y(index.get(task.id)!) + 13;
      const bent = x2 - x1 >= 6;
      return <g key={`${before}>${task.id}`} className={broken.has(task.id) ? 'lf-sched-arrow lf-sched-arrow--broken' : 'lf-sched-arrow'}>
        <path d={bent ? `M${x1} ${y1} H${x1 + 3} V${y2} H${x2}` : `M${x1} ${y1} L${x2} ${y2}`} fill="none" />
        <polygon points={`${x2},${y2} ${x2 - 4},${y2 - 3} ${x2 - 4},${y2 + 3}`} />
      </g>;
    }))}
    {loaded ? <g>
      <text x="0" y={y(count) + 16}>{t.busy}</text>
      {Array.from({ length: columns }, (_, at) => <g key={at}>
        {busy(at + 1) > schedule.workers! ? <rect className="lf-sched-over" x={x(at + 1) + 1} y={y(count) + 3} width={column - 2} height={ROW - 6} rx="3" /> : null}
        <text x={x(at + 1) + column / 2} y={y(count) + 17} textAnchor="middle">{busy(at + 1)}</text>
      </g>)}
    </g> : null}
    {gantt ? <g>
      <line className="lf-sched-due" x1={LEFT + GRID} x2={LEFT + GRID} y1={HEAD} y2={bodyEnd} />
      <text x={LEFT + GRID} y={height - 3} textAnchor="end">{t.deadline}</text>
    </g> : null}
  </svg>;
}

interface ColumnsProps { t: Words; slots: SlotMap; limit: number; movable: number; done: number }

function Columns({ t, slots, limit, movable, done }: ColumnsProps) {
  const columns = [
    { name: word(t, 'slot:todo'), filled: slots.todo?.length ?? 0, capacity: movable, note: null as string | null },
    { name: word(t, 'slot:doing'), filled: slots.doing?.length ?? 0, capacity: limit, note: fillSlot(t.limit, limit) },
    { name: t.doneColumn, filled: done, capacity: done, note: null },
  ];
  const perRow = 5;
  const rows = Math.max(...columns.map((column) => Math.ceil(column.capacity / perRow)));
  return <svg className="lf-sched-chart" viewBox={`0 0 320 ${38 + rows * 20}`} role="img" aria-label={t.chartKanban} data-copy-role="data" focusable="false">
    {columns.map((column, at) => {
      const left = at * 108;
      return <g key={at}>
        <rect className="lf-sched-column" x={left} y="0" width="104" height={38 + rows * 20 - 2} rx="6" />
        <text x={left + 8} y="15">{column.name}</text>
        {column.note ? <text className="lf-sched-note" x={left + 8} y="29">{column.note}</text> : null}
        {Array.from({ length: column.capacity }, (_, card) => <rect key={card} className={card < column.filled ? 'lf-sched-card lf-sched-card--full' : 'lf-sched-card'}
          x={left + 8 + (card % perRow) * 18} y={36 + Math.floor(card / perRow) * 20} width="14" height="14" rx="3" />)}
      </g>;
    })}
  </svg>;
}

function Plan({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: ScheduleSegment }) {
  const t = copyText(FIN2_COPY, document.locale);
  const visual = segment.visual.type;
  const labels = segment.labels;
  const payload = segment.payload;
  const schedule = scheduleOf(visual, payload)!;
  const frame = scheduleFrame(visual, payload)!;
  const gantt = visual === 'gantt';
  const kanban = visual === 'kanban';
  const done = schedule.done ?? [];
  const taskName = (id: string) => labels[id] ?? id;
  const name = (slot: string) => (kanban ? word(t, `slot:${slot}`) : gantt ? fillSlot(t.period, slot.slice(PERIOD_PREFIX.length)) : fillSlot(t.step, slot.slice(STEP_PREFIX.length)));
  const afterOf = (task: ScheduleTask) => (task.after.length > 0 ? fillSlot(t.after, task.after.map(taskName).join(', ')) : null);
  const takes = (task: ScheduleTask) => (task.duration === 1 ? t.takes1 : fillSlot(t.takesN, task.duration!));
  const detail = (task: ScheduleTask): string | null => {
    const parts = [gantt ? takes(task) : null, afterOf(task), task.due !== undefined ? fillSlot(t.dueStep, task.due) : null].filter((part): part is string => part !== null);
    return parts.length > 0 ? parts.join('. ') : null;
  };
  const note = (id: string) => { const task = schedule.tasks.find((other) => other.id === id); return task ? detail(task) : null; };
  const board = useSlotBoard({ segmentId: segment.id, frame, start: startSlots(visual, payload), onGrade, label: taskName, note, name, trayLabel: kanban ? null : t.backToTray });

  const placeOf = (id: string) => Object.entries(board.slots).find(([, pieces]) => pieces.includes(id))?.[0];
  const placeName = (id: string) => (done.includes(id) ? t.doneColumn : placeOf(id) ? name(placeOf(id)!) : t.none);
  const broken = new Set(scheduleConflicts(visual, payload, board.slots));
  const brokenNames = schedule.tasks.filter((task) => broken.has(task.id)).map((task) => taskName(task.id)).join(', ');
  const zones = frame.slotIds.map((slot) => ({ name: name(slot), pieces: board.slots[slot] ?? [] })).filter((zone) => kanban || zone.pieces.length > 0);
  const placedCount = frame.pieceIds.length - board.tray.length;
  const rules = kanban ? [fillSlot(t.limit, schedule.limit!)] : gantt
    ? [`${t.deadline}: ${fillSlot(t.period, schedule.periods!)}`, ...(schedule.workers !== undefined ? [`${t.workers}: ${schedule.workers}`] : [])] : [];
  const status = [
    ...(kanban ? [] : [`${fillSlot(fillSlot(t.placed, placedCount), frame.pieceIds.length)}.`]),
    zones.length > 0 ? describeZones(zones, taskName, t.none) : `${t.none}.`,
    ...(kanban ? [`${t.doneColumn}: ${done.map(taskName).join(', ')}.`] : []),
    ...rules.map((rule) => `${rule}.`),
    ...(kanban || !brokenNames ? [] : [`${fillSlot(t.conflicts, brokenNames)}.`]),
  ].join(' ');
  const statusNode = <>{status}{kanban || brokenNames ? null : <> <Prose>{t.noConflicts}</Prose></>}</>;

  const lastColumn = gantt ? t.colTakes : t.colDue;
  const table = kanban
    ? { caption: t.tableKanban, head: [t.colTask, t.colAfter, t.colPlace], rows: schedule.tasks.map((task) => [taskName(task.id), task.after.map(taskName).join(', ') || t.none, placeName(task.id)]) }
    : { caption: gantt ? t.tableGantt : t.tableTimeline, head: [t.colTask, t.colAfter, lastColumn, t.colPlace],
      rows: schedule.tasks.map((task) => [taskName(task.id), task.after.map(taskName).join(', ') || t.none, String(gantt ? task.duration : task.due ?? t.none), placeName(task.id)]) };
  const named = gantt ? { met: t.planMet, hint: t.planHint } : kanban ? { met: t.kanbanMet, hint: t.kanbanHint } : { met: t.orderMet, hint: t.orderHint };

  return <SlotBoardShell screen="schedule-board" document={document} segment={segment} onBack={onBack} sequence={sequence} board={board} t={t}
    named={named} status={statusNode} tray={!kanban} heading={kanban ? t.moveHeading : t.tray} table={table}>
    {kanban
      ? <Columns t={t} slots={board.slots} limit={schedule.limit!} movable={frame.pieceIds.length} done={done.length} />
      : <Rows t={t} gantt={gantt} schedule={schedule} labels={labels} slots={board.slots} broken={broken} />}
    <div className="lf-slotzones">
      {frame.slotIds.map((slot) => <Zone key={slot} board={board} id={slot} name={name(slot)} note={kanban && slot === 'doing' ? fillSlot(t.limit, schedule.limit!) : null} />)}
      {kanban ? <div className="lf-slotzone lf-slotzone--static" role="group" aria-label={t.doneColumn}>
        <h3 data-copy-role="data">{t.doneColumn}</h3>
        <ul className="lf-sched-done">{done.map((id) => <li key={id} data-copy-role="data">{taskName(id)}</li>)}</ul>
      </div> : null}
    </div>
  </SlotBoardShell>;
}

export default function ScheduleBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'plan.schedule-board.v2' ? <Plan segment={segment} {...rest} /> : null;
}

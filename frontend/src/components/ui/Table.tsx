import type { MouseEvent, ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

/*
 * /DESIGN.md §Components — Table (console-only; Data table grid category).
 * The §1.11 mobile answer to a wide table is NEVER horizontal body scroll:
 * below `md:` each row renders as a stacked compact card (primary line +
 * caption pairs); from `md:` up it is a real <table> inside its own
 * overflow-x-auto container. Never used on kid/parent product surfaces.
 */

export interface TableColumn<Row> {
  key: string;
  header: string;
  /** Cell renderer. Also used for the value slot in the mobile card. */
  cell: (row: Row) => ReactNode;
  /** Right-align (figures). */
  numeric?: boolean;
  /** Mobile card: render this column as the card's primary line. */
  primary?: boolean;
}

interface TableProps<Row> {
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string | number;
  onRowClick?: (row: Row) => void;
  className?: string;
}

export function Table<Row>({ columns, rows, rowKey, onRowClick, className }: TableProps<Row>) {
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const rest = columns.filter((c) => c !== primary);
  const activateRow = (row: Row, event: MouseEvent<HTMLElement>) => {
    if (!onRowClick) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('button, a, input, select, textarea')) return;
    onRowClick(row);
  };

  return (
    <div className={className}>
      {/* Mobile: stacked card-per-row */}
      <ul className="flex flex-col gap-3 md:hidden" role="list">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className={cn('min-w-0', onRowClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary')}
            onClick={(event) => activateRow(row, event)}
            onKeyDown={(event) => {
              if (event.target instanceof HTMLElement && event.target.closest('button, a, input, select, textarea')) return;
              if (onRowClick && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                onRowClick(row);
              }
            }}
            tabIndex={onRowClick ? 0 : undefined}
          >
            <Card className="min-w-0 p-4">
              <div className="min-w-0 lf-label text-content">{primary?.cell(row)}</div>
              <dl className="mt-3 grid min-w-0 grid-cols-1 gap-y-2">
                {rest.map((col) => (
                  <div key={col.key} className="grid min-w-0 grid-cols-[minmax(5rem,auto)_minmax(0,1fr)] items-start gap-3">
                    <dt className="min-w-0 break-words lf-caption text-content-muted">{col.header}</dt>
                    <dd className={cn('min-w-0 max-w-full break-words text-right lf-body-sm text-content', col.numeric && 'lf-number')}>{col.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </li>
        ))}
      </ul>

      {/* md:+ — real table in its own scroll container */}
      <Card className="hidden overflow-hidden p-0 md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-outline/60">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn('lf-caption whitespace-nowrap px-5 py-3 font-bold text-content-muted', col.numeric && 'text-right')}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={cn('border-b border-outline/60 last:border-b-0', onRowClick && 'cursor-pointer hover:bg-surface-sunken transition-colors')}
                  onClick={(event) => activateRow(row, event)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn('lf-body-sm px-5 py-3.5 text-content', col.numeric && 'lf-number text-right')}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

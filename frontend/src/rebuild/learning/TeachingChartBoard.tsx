import { useId, useState, type ReactNode } from 'react';
import { Button } from '../design/controls';

export interface ChartTableRow { id: string | number; label: string | number; value: string }

type TableSource = { columns: readonly [string, string]; rows: readonly ChartTableRow[]; table?: undefined }
  | { table: ReactNode; columns?: undefined; rows?: undefined };
type TeachingChartBoardProps = TableSource & {
  title: string;
  showTableLabel: string;
  showChartLabel: string;
  chart: ReactNode;
  controlLeading?: ReactNode;
  onViewChange?: (showTable: boolean) => void;
  children?: (showTable: boolean) => ReactNode;
};

function renderTable(source: TableSource, title: string): ReactNode {
  if (source.table !== undefined) return source.table;
  if (!source.columns || !source.rows) throw new Error('Teaching chart table data is missing');
  return <table className="lf-learning-table" aria-label={title}>
    <thead><tr><th scope="col" data-copy-role="data">{source.columns[0]}</th><th scope="col" data-copy-role="data">{source.columns[1]}</th></tr></thead>
    <tbody>{source.rows.map((row) => <tr key={row.id}>
      <th scope="row" data-label={source.columns[0]} data-copy-role="data">{row.label}</th>
      <td data-label={source.columns[1]} data-copy-role="data">{row.value}</td>
    </tr>)}</tbody>
  </table>;
}

export function TeachingChartBoard(props: TeachingChartBoardProps) {
  const { title, showTableLabel, showChartLabel, chart, controlLeading, onViewChange, children } = props;
  const boardId = useId();
  const [showTable, setShowTable] = useState(false);
  return <div className="lf-learning-workspace">
    <section className="lf-learning-board" aria-labelledby={`${boardId}-title`}>
      <div className="lf-learning-board-heading">
        <h2 id={`${boardId}-title`} data-copy-role="heading">{title}</h2>
      </div>
      {showTable ? renderTable(props, title) : chart}
    </section>
    <div className="lf-learning-control-strip">
      <div className="lf-learning-control-bar">
        {controlLeading}
        <Button variant="sky" size="sm" className="lf-learning-view-toggle"
          onClick={() => { const next = !showTable; setShowTable(next); onViewChange?.(next); }}>
          {showTable ? showChartLabel : showTableLabel}
        </Button>
      </div>
      {children?.(showTable)}
    </div>
  </div>;
}

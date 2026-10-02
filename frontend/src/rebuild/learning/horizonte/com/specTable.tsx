export interface TableSpec { caption: string; head: readonly string[]; rows: ReadonlyArray<readonly string[]> }

/** A table the learner can open beside the board: the same facts as the picture, read row by row. */
export function SpecTable({ table }: { table: TableSpec }) {
  return <table className="lf-hz-table" data-hz-table="">
    <caption data-copy-role="heading">{table.caption}</caption>
    <thead><tr>{table.head.map((cell, index) => <th key={index} scope="col" data-copy-role="data">{cell}</th>)}</tr></thead>
    <tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((cell, column) => column === 0
      ? <th key={column} scope="row" data-copy-role="data">{cell}</th>
      : <td key={column} data-copy-role="data">{cell}</td>)}</tr>)}</tbody>
  </table>;
}

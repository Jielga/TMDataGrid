import { aggregationFns, type RowData } from "@tanstack/react-table";
import type { TMDataGridRowData } from "../TMDataGridContext";
import type { TMDataGridTable } from "../useTMDataGrid";

/** The registered aggregation names — the same set `aggregationFn` accepts. */
export type TMDataGridAggregationName = keyof typeof aggregationFns;

/**
 * One column aggregated over every filtered row — the number a summary-row
 * `footer` wants:
 *
 * ```tsx
 * columnHelper.accessor("salary", {
 *   footer: ({ table }) => sek(Number(aggregateColumn({ table, columnId: "salary" }))),
 * });
 * ```
 *
 * Filtered rather than paginated rows, so the total covers everything the
 * filters left — all pages — and follows the filters as they change. Reuses
 * TanStack's registered aggregation functions; `fn` defaults to `"sum"`.
 */
export function aggregateColumn<TData extends RowData>({
  table,
  columnId,
  fn = "sum",
}: {
  table: TMDataGridTable<TData>;
  columnId: string;
  fn?: TMDataGridAggregationName;
}): unknown {
  const erased = table as unknown as TMDataGridTable<TMDataGridRowData>;
  const rows = erased.getFilteredRowModel().rows;
  // Leaf and child rows are the same set here: the filtered model is flat.
  return aggregationFns[fn](columnId, rows, rows);
}

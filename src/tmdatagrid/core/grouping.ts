import type { Row, RowData } from "@tanstack/react-table";
import type { TMDataGridFeatures } from "../useTMDataGrid";

/**
 * The data rows under a group row, at any depth.
 *
 * Not `row.getLeafRows()`, despite the name: that flattens the whole subtree
 * and keeps the branches, so a group nested two deep reports its sub-groups
 * alongside the records. Grouping `city` then `name` would have Stockholm
 * counting four rows and three names as seven, and one tick on it selecting
 * ids that hold no record.
 *
 * A row with no subRows is a data row, which also makes this the identity on an
 * ungrouped grid.
 */
export function getGroupDataRows<TData extends RowData>(
  row: Row<TMDataGridFeatures, TData>,
): Array<Row<TMDataGridFeatures, TData>> {
  if (row.subRows.length === 0) return [row];
  return row.getLeafRows().filter((leaf) => leaf.subRows.length === 0);
}

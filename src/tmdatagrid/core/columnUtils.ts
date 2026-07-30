import type { TMDataGridColumnType } from "./filterOperators";
import type { TMDataGridColumnMeta } from "../useTMDataGrid";

/**
 * Structural shape of the column bits the chrome reads. Kept minimal so these
 * helpers work with any `Column`/`Header` instance without dragging generics
 * through every call site.
 */
type ColumnLike = {
  id: string;
  columnDef: { header?: unknown; meta?: TMDataGridColumnMeta };
  /** Set on a leaf that sits inside a header group. */
  parent?: unknown;
};

/** Menu- and panel-facing column name. */
export function getColumnLabel(column: ColumnLike): string {
  const label = column.columnDef.meta?.label;
  if (label) return label;
  const header = column.columnDef.header;
  return typeof header === "string" ? header : column.id;
}

export function getColumnType(column: ColumnLike): TMDataGridColumnType {
  return column.columnDef.meta?.type ?? "string";
}

export function getColumnAlign(column: ColumnLike): "left" | "right" | "center" {
  return column.columnDef.meta?.align ?? "left";
}

/**
 * Whether a column may be moved. Ordering is the one column feature TanStack
 * has no column option for, so the switch lives in `meta.enableOrdering`.
 *
 * A leaf inside a header group is never movable: `columnOrder` sequences leaf
 * columns, so moving one out of its group would leave the group header spanning
 * columns that no longer belong to it.
 */
export function isColumnReorderable(column: ColumnLike): boolean {
  if (column.columnDef.meta?.enableOrdering === false) return false;
  return column.parent === undefined;
}

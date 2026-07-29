import type { TMDataGridColumnType } from "./filterOperators.js";
import type { TMDataGridColumnMeta } from "./useTMDataGrid.js";

/**
 * Structural shape of the column bits the chrome reads. Kept minimal so these
 * helpers work with any `Column`/`Header` instance without dragging generics
 * through every call site.
 */
type ColumnLike = {
  id: string;
  columnDef: { header?: unknown; meta?: TMDataGridColumnMeta };
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

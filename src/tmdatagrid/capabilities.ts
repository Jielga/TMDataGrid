import type { Column, RowData } from "@tanstack/react-table";
import type { TMDataGridRowData } from "./TMDataGridContext";
import { isColumnReorderable } from "./columnUtils";
import type {
  TMDataGridFeatures,
  TMDataGridTable,
  UseTMDataGridOptions,
} from "./useTMDataGrid";

/**
 * Table-level feature switches, read straight off the options object.
 *
 * Why not just call `column.getCanSort()` everywhere? Because that is a method
 * call on a `column` whose identity survives an options change, so the React
 * Compiler caches the result and the chrome keeps rendering for a feature that
 * was switched off. Reading the options into a fresh object each render gives
 * every derived value something that actually changes to invalidate on.
 *
 * TanStack still decides: these flags are combined with `getCanX()`, which is
 * what applies the per-column overrides.
 */
export type TMDataGridFeatureFlags = {
  sorting: boolean;
  filtering: boolean;
  hiding: boolean;
  pinning: boolean;
  resizing: boolean;
  ordering: boolean;
  rowSelection: boolean;
};

export function readFeatureFlags<TData extends RowData>(
  options: Pick<
    UseTMDataGridOptions<TData>,
    | "enableSorting"
    | "enableColumnFilters"
    | "enableHiding"
    | "enableColumnPinning"
    | "enableColumnResizing"
    | "enableColumnOrdering"
    | "enableRowSelection"
  >,
): TMDataGridFeatureFlags {
  return {
    sorting: options.enableSorting !== false,
    filtering: options.enableColumnFilters !== false,
    hiding: options.enableHiding !== false,
    pinning: options.enableColumnPinning !== false,
    resizing: options.enableColumnResizing !== false,
    ordering: options.enableColumnOrdering !== false,
    rowSelection: options.enableRowSelection !== false,
  };
}

/**
 * What one column's header may offer.
 *
 * | Affordance | Turned off by |
 * | ---------- | ------------- |
 * | Sort arrow, Sort ASC/DESC | `enableSorting` (table or column) |
 * | Filter item, panel entry  | `enableColumnFilters` / `enableColumnFilter` |
 * | Hide column               | `enableHiding` (table or column) |
 * | Pin to left / right       | `enableColumnPinning` / `enablePinning` |
 * | Resize dragging           | `enableColumnResizing` / `enableResizing` |
 * | Header dragging, Move left / right | `enableColumnOrdering` / `meta.enableOrdering` |
 */
export type TMDataGridColumnCapabilities = {
  canSort: boolean;
  canFilter: boolean;
  canHide: boolean;
  canPin: boolean;
  canResize: boolean;
  canReorder: boolean;
};

export function getColumnCapabilities(
  column: Column<TMDataGridFeatures, TMDataGridRowData, unknown>,
  features: TMDataGridFeatureFlags,
): TMDataGridColumnCapabilities {
  return {
    canSort: features.sorting && column.getCanSort(),
    canFilter: features.filtering && column.getCanFilter(),
    canHide: features.hiding && column.getCanHide(),
    canPin: features.pinning && column.getCanPin(),
    canResize: features.resizing && column.getCanResize(),
    // Ordering has no TanStack capability method — see isColumnReorderable.
    canReorder: features.ordering && isColumnReorderable(column),
  };
}

/** The same questions, asked of the whole grid — used to hide toolbar buttons. */
export type TMDataGridCapabilities = {
  canSortAny: boolean;
  canFilterAny: boolean;
  canHideAny: boolean;
  canPinAny: boolean;
  canReorderAny: boolean;
  canSelectRows: boolean;
};

export function getGridCapabilities(
  table: TMDataGridTable<TMDataGridRowData>,
  features: TMDataGridFeatureFlags,
): TMDataGridCapabilities {
  const columns = table.getAllLeafColumns();
  const any = (predicate: (capabilities: TMDataGridColumnCapabilities) => boolean) =>
    columns.some((column) => predicate(getColumnCapabilities(column, features)));

  return {
    canSortAny: any((c) => c.canSort),
    canFilterAny: any((c) => c.canFilter),
    canHideAny: any((c) => c.canHide),
    canPinAny: any((c) => c.canPin),
    canReorderAny: any((c) => c.canReorder),
    canSelectRows: features.rowSelection,
  };
}

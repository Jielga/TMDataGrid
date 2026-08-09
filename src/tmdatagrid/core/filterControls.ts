import type { Column } from "@tanstack/react-table";
import type { ComponentType } from "react";
import type { TMDataGridRowData } from "../TMDataGridContext";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";
import type { TMDataGridOption } from "./columnOptions";
import type { TMDataGridFilterOperator } from "./filterOperators";
import type { TMDataGridLabels } from "./labels";
import type { TMDataGridSize } from "./sizes";

/**
 * What a filter control is handed — the value slot of one filter-panel row.
 *
 * The contract is value-only: the control reads `operator` to shape itself
 * (a `between` pair renders two ends, an `equals` a single input) and calls
 * `onChange` with the bare value; the grid composes the operator-aware
 * `TMDataGridFilterValue` around it. A control never builds that wrapper and
 * never writes the operator — `table` is the escape hatch for the rare
 * control that must.
 */
export type TMDataGridFilterControlArgs = {
  column: Column<TMDataGridFeatures, TMDataGridRowData, unknown>;
  table: TMDataGridTable<TMDataGridRowData>;
  /** The row's currently selected operator. Read-only for the control. */
  operator: TMDataGridFilterOperator;
  /** The bare filter value — never the `{ operator, value }` wrapper. */
  value: string | ReadonlyArray<string>;
  /** Writes the bare value; the grid pairs it with the current operator. */
  onChange: (next: string | ReadonlyArray<string>) => void;
  /**
   * The column's options through `resolveColumnOptions`, pre-resolved for a
   * column that declares `meta.options` or is select-shaped. Empty otherwise —
   * a control wanting faceted values on other columns resolves them itself.
   */
  options: ReadonlyArray<TMDataGridOption>;
  size: TMDataGridSize;
  labels: TMDataGridLabels;
};

/**
 * `meta.filterControl` — replaces the built-in value control for this column.
 * Rendered as JSX, never invoked as a bare function, so hooks are legal
 * inside. Define it at module scope so its identity is stable across renders.
 */
export type TMDataGridFilterControlComponent =
  ComponentType<TMDataGridFilterControlArgs>;
